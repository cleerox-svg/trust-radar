import { z } from "zod";
import { hashPassword, verifyPassword, isLegacyHash } from "../lib/hash";
import { signJWT } from "../lib/jwt";
import { json } from "../lib/cors";
import { checkRateLimit, clientIp, rateLimitResponse } from "../lib/rate-limit";
import type { Env } from "../types";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z.string().min(2).max(32).regex(/^[a-z0-9_-]+$/i).optional(),
  display_name: z.string().max(64).optional(),
  // Optional: pre-links account to an influencer profile and marks token used
  invite_token: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  // H7: throttle account creation — 5 registrations per IP per hour.
  const regLimit = await checkRateLimit(env, "register:ip", clientIp(request), 5, 60 * 60);
  if (!regLimit.allowed) return rateLimitResponse(origin, regLimit.retryAfterSecs);

  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { email, password, username, display_name, invite_token } = parsed.data;

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ success: false, error: "Email already registered" }, 409, origin);

  if (username) {
    const usernameExists = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (usernameExists) return json({ success: false, error: "Username already taken" }, 409, origin);
  }

  // Validate invite token if provided
  let resolvedInfluencerId: string | null = null;
  let resolvedRole: string = "influencer";
  let inviteId: string | null = null;

  if (invite_token) {
    const invite = await env.DB.prepare(
      `SELECT id, influencer_id, role, expires_at, used_at
       FROM invite_tokens WHERE token = ?`
    ).bind(invite_token).first<{
      id: string; influencer_id: string; role: string; expires_at: string; used_at: string | null;
    }>();

    if (!invite) return json({ success: false, error: "Invalid invite token" }, 400, origin);
    if (invite.used_at) return json({ success: false, error: "Invite already used" }, 410, origin);
    if (new Date(invite.expires_at) < new Date()) return json({ success: false, error: "Invite has expired" }, 410, origin);

    resolvedInfluencerId = invite.influencer_id;
    resolvedRole = invite.role;
    inviteId = invite.id;
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const plan = "free"; // plan is always a tier (free/pro/enterprise); role carries the influencer/soc distinction

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, username, display_name, role, plan, assigned_influencer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, email, passwordHash, username ?? null, display_name ?? null, resolvedRole, plan, resolvedInfluencerId).run();

  // Mark invite as used
  if (inviteId) {
    await env.DB.prepare(
      "UPDATE invite_tokens SET used_at = datetime('now'), used_by_user_id = ? WHERE id = ?"
    ).bind(id, inviteId).run();
  }

  const jwtToken = await signJWT({ sub: id, email, plan: plan as "free" | "pro" | "enterprise" }, env.JWT_SECRET);
  return json({
    success: true,
    data: { token: jwtToken, user: { id, email, username, display_name, plan, role: resolvedRole, is_admin: false } },
  }, 201, origin);
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  // H7: throttle online guessing — 10 attempts per IP per 15 minutes.
  const ipLimit = await checkRateLimit(env, "login:ip", clientIp(request), 10, 15 * 60);
  if (!ipLimit.allowed) return rateLimitResponse(origin, ipLimit.retryAfterSecs);

  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: "Invalid request" }, 400, origin);

  const { email, password } = parsed.data;

  // H7: per-account throttle — 5 attempts per email per 15 minutes,
  // independent of source IP (defeats distributed guessing on one account).
  const emailLimit = await checkRateLimit(env, "login:email", email.toLowerCase(), 5, 15 * 60);
  if (!emailLimit.allowed) return rateLimitResponse(origin, emailLimit.retryAfterSecs);

  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, plan FROM users WHERE email = ?"
  ).bind(email).first<{ id: string; email: string; password_hash: string; plan: string }>();

  // Uniform message whether the account exists or not — no enumeration oracle.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ success: false, error: "Invalid credentials" }, 401, origin);
  }

  // C4 migration-on-login: transparently upgrade legacy unsalted SHA-256
  // hashes to PBKDF2 on the first successful login.
  if (isLegacyHash(user.password_hash)) {
    const upgraded = await hashPassword(password);
    await env.DB.prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(upgraded, user.id).run();
  }

  const token = await signJWT(
    { sub: user.id, email: user.email, plan: user.plan as "free" | "pro" | "enterprise" },
    env.JWT_SECRET
  );
  return json({ success: true, data: { token, user: { id: user.id, email: user.email, plan: user.plan } } }, 200, origin);
}

export async function handleMe(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const user = await env.DB.prepare(
    `SELECT id, email, username, display_name, bio, avatar_url, plan, role, is_admin,
            impression_score, total_analyses, assigned_influencer_id, created_at
     FROM users WHERE id = ?`
  ).bind(userId).first<Record<string, unknown>>();

  if (!user) return json({ success: false, error: "User not found" }, 404, origin);
  return json({ success: true, data: user }, 200, origin);
}

export async function handleUpdateProfile(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const UpdateSchema = z.object({
    display_name: z.string().max(64).optional(),
    bio: z.string().max(500).optional(),
    username: z.string().min(2).max(32).regex(/^[a-z0-9_-]+$/i).optional(),
  });

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { display_name, bio, username } = parsed.data;

  if (username) {
    const conflict = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? AND id != ?"
    ).bind(username, userId).first();
    if (conflict) return json({ success: false, error: "Username already taken" }, 409, origin);
  }

  await env.DB.prepare(
    `UPDATE users SET
       display_name = COALESCE(?, display_name),
       bio = COALESCE(?, bio),
       username = COALESCE(?, username),
       updated_at = datetime('now')
     WHERE id = ?`
  ).bind(display_name ?? null, bio ?? null, username ?? null, userId).run();

  const user = await env.DB.prepare(
    "SELECT id, email, username, display_name, bio, avatar_url, plan FROM users WHERE id = ?"
  ).bind(userId).first();

  return json({ success: true, data: user }, 200, origin);
}
