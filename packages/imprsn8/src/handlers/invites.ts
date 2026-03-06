import { z } from "zod";
import { json } from "../lib/cors";
import { sendInviteEmail } from "../lib/email";
import type { Env } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(): string {
  // 32 random bytes → 64-char hex string
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generatePassword(): string {
  // 16 chars: uppercase + lowercase + digits + symbols, always at least one of each
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const syms   = "@#$%&*!";
  const all    = upper + lower + digits + syms;
  const rand   = (set: string) => set[Math.floor(Math.random() * set.length)]!;
  const chars  = [rand(upper), rand(lower), rand(digits), rand(syms)];
  for (let i = 0; i < 12; i++) chars.push(rand(all));
  // shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

// ─── POST /api/admin/invites ──────────────────────────────────────────────────
// Admin creates an invite token linked to an influencer profile.

const CreateInviteSchema = z.object({
  influencer_id: z.string().uuid(),
  role:          z.enum(["influencer", "staff"]).default("influencer"),
  email_hint:    z.string().email().optional(),
  notes:         z.string().max(500).optional(),
  expires_days:  z.number().int().min(1).max(30).default(7),
});

export async function handleCreateInvite(
  request: Request,
  env: Env,
  adminId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = CreateInviteSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { influencer_id, role, email_hint, notes, expires_days } = parsed.data;

  // Verify influencer exists
  const inf = await env.DB.prepare(
    "SELECT id, display_name FROM influencer_profiles WHERE id = ?"
  ).bind(influencer_id).first<{ id: string; display_name: string }>();
  if (!inf) return json({ success: false, error: "Influencer not found" }, 404, origin);

  const token = generateToken();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + expires_days * 86_400_000).toISOString();

  await env.DB.prepare(
    `INSERT INTO invite_tokens (id, token, influencer_id, role, email_hint, notes, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, token, influencer_id, role, email_hint ?? null, notes ?? null, adminId, expiresAt).run();

  // Fire-and-forget email (no-op until EMAIL_PROVIDER is configured)
  if (email_hint) {
    const origin_ = request.headers.get("Origin") ?? "https://app.imprsn8.com";
    const inviteUrl = `${origin_}/register?invite=${token}`;
    void sendInviteEmail(
      { to: email_hint, influencerName: inf.display_name, inviteUrl, expiresAt, notes },
      env,
    );
  }

  return json({
    success: true,
    data: { id, token, influencer_id, influencer_name: inf.display_name, role, email_hint, notes, expires_at: expiresAt },
  }, 201, origin);
}

// ─── GET /api/admin/invites?influencer_id=… ───────────────────────────────────
// List pending (unused, unexpired) invites. Optionally filter by influencer.

export async function handleListInvites(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const influencerId = url.searchParams.get("influencer_id");

  let query = `
    SELECT i.id, i.token, i.influencer_id, p.display_name as influencer_name,
           i.role, i.email_hint, i.notes, i.created_by, i.expires_at,
           i.used_at, i.used_by_user_id, i.email_sent_at, i.created_at
    FROM invite_tokens i
    JOIN influencer_profiles p ON p.id = i.influencer_id
    WHERE 1=1`;
  const params: string[] = [];

  if (influencerId) {
    query += " AND i.influencer_id = ?";
    params.push(influencerId);
  }
  query += " ORDER BY i.created_at DESC LIMIT 100";

  const rows = await env.DB.prepare(query).bind(...params).all();
  return json({ success: true, data: rows.results }, 200, origin);
}

// ─── DELETE /api/admin/invites/:id ───────────────────────────────────────────
// Revoke (delete) an unused invite.

export async function handleRevokeInvite(
  request: Request,
  env: Env,
  inviteId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const invite = await env.DB.prepare(
    "SELECT id, used_at FROM invite_tokens WHERE id = ?"
  ).bind(inviteId).first<{ id: string; used_at: string | null }>();

  if (!invite) return json({ success: false, error: "Invite not found" }, 404, origin);
  if (invite.used_at) return json({ success: false, error: "Invite already used — cannot revoke" }, 409, origin);

  await env.DB.prepare("DELETE FROM invite_tokens WHERE id = ?").bind(inviteId).run();
  return json({ success: true }, 200, origin);
}

// ─── GET /api/invites/:token  (PUBLIC) ───────────────────────────────────────
// Validate a token before the user fills in the register form.

export async function handleValidateInvite(
  _request: Request,
  env: Env,
  token: string,
): Promise<Response> {
  const origin = _request.headers.get("Origin");
  const invite = await env.DB.prepare(
    `SELECT i.token, i.influencer_id, p.display_name as influencer_name,
            p.handle, p.avatar_url, i.role, i.email_hint, i.expires_at, i.used_at
     FROM invite_tokens i
     JOIN influencer_profiles p ON p.id = i.influencer_id
     WHERE i.token = ?`
  ).bind(token).first<Record<string, unknown>>();

  if (!invite) return json({ success: false, error: "Invalid invite link" }, 404, origin);
  if (invite.used_at) return json({ success: false, error: "This invite has already been used" }, 410, origin);
  if (new Date(invite.expires_at as string) < new Date()) {
    return json({ success: false, error: "This invite has expired" }, 410, origin);
  }

  return json({ success: true, data: invite }, 200, origin);
}

// ─── POST /api/admin/users/direct-create ─────────────────────────────────────
// Admin creates a full account directly (no invite link needed).
// Returns the generated password once — admin copies and shares manually.

import { hashPassword } from "../lib/hash";
import { signJWT } from "../lib/jwt";

const DirectCreateSchema = z.object({
  email:          z.string().email(),
  influencer_id:  z.string().uuid(),
  role:           z.enum(["influencer", "staff"]).default("influencer"),
  display_name:   z.string().max(64).optional(),
  // If omitted, a strong password is auto-generated
  password:       z.string().min(8).max(128).optional(),
});

export async function handleDirectCreate(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = DirectCreateSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { email, influencer_id, role, display_name } = parsed.data;
  const password = parsed.data.password ?? generatePassword();

  // Validate influencer
  const inf = await env.DB.prepare(
    "SELECT id FROM influencer_profiles WHERE id = ?"
  ).bind(influencer_id).first();
  if (!inf) return json({ success: false, error: "Influencer not found" }, 404, origin);

  // Check email uniqueness
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ success: false, error: "Email already registered" }, 409, origin);

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, role, plan, assigned_influencer_id)
     VALUES (?, ?, ?, ?, ?, 'influencer', ?)`
  ).bind(id, email, passwordHash, display_name ?? null, role, influencer_id).run();

  // Return generated password ONCE — it is not stored in plaintext
  const token = await signJWT({ sub: id, email, plan: "influencer" as "free" }, env.JWT_SECRET);
  return json({
    success: true,
    data: {
      id, email, display_name, role,
      plan: "influencer",
      assigned_influencer_id: influencer_id,
      generated_password: password, // show once, not stored
      token,
    },
  }, 201, origin);
}
