import { json } from "../lib/cors";
import type { Env } from "../types";

// ─── Create invite token (admin only) ─────────────────────────────

export async function handleCreateInvite(request: Request, env: Env, adminUserId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null) as {
    role?: string;
    group_id?: string;
    email_hint?: string;
    notes?: string;
    expires_days?: number;
  } | null;

  if (!body) return json({ success: false, error: "Invalid request body" }, 400, origin);

  const role = body.role ?? "analyst";
  if (!["admin", "analyst", "customer"].includes(role)) {
    return json({ success: false, error: "Invalid role. Must be admin, analyst, or customer" }, 400, origin);
  }

  const token = crypto.randomUUID();
  const id = crypto.randomUUID();
  const expDays = Math.min(body.expires_days ?? 7, 30);

  await env.DB.prepare(
    `INSERT INTO invite_tokens (id, token, role, group_id, email_hint, notes, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+' || ? || ' days'))`,
  )
    .bind(id, token, role, body.group_id ?? null, body.email_hint ?? null, body.notes ?? null, adminUserId, expDays)
    .run();

  const invite = await env.DB.prepare("SELECT * FROM invite_tokens WHERE id = ?").bind(id).first();

  return json({ success: true, data: invite }, 201, origin);
}

// ─── List invite tokens (admin only) ──────────────────────────────

export async function handleListInvites(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const { results } = await env.DB.prepare(
    `SELECT it.*, u.email as created_by_email
     FROM invite_tokens it
     LEFT JOIN users u ON u.id = it.created_by
     ORDER BY it.created_at DESC
     LIMIT 100`,
  ).all();

  return json({ success: true, data: results }, 200, origin);
}

// ─── Validate invite token (public) ──────────────────────────────

export async function handleValidateInvite(request: Request, env: Env, token: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const invite = await env.DB.prepare(
    `SELECT id, token, role, group_id, email_hint, expires_at, used_at
     FROM invite_tokens WHERE token = ?`,
  )
    .bind(token)
    .first<{ id: string; token: string; role: string; group_id: string | null; email_hint: string | null; expires_at: string; used_at: string | null }>();

  if (!invite) return json({ success: false, error: "Invalid invite token" }, 404, origin);
  if (invite.used_at) return json({ success: false, error: "Invite already used" }, 410, origin);
  if (new Date(invite.expires_at) < new Date()) {
    return json({ success: false, error: "Invite has expired" }, 410, origin);
  }

  return json({
    success: true,
    data: {
      token: invite.token,
      role: invite.role,
      group_id: invite.group_id,
      email_hint: invite.email_hint,
      expires_at: invite.expires_at,
    },
  }, 200, origin);
}

// ─── Revoke invite (admin only) ──────────────────────────────────

export async function handleRevokeInvite(request: Request, env: Env, inviteId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const result = await env.DB.prepare("DELETE FROM invite_tokens WHERE id = ? AND used_at IS NULL")
    .bind(inviteId)
    .run();

  if (!result.meta.changes) {
    return json({ success: false, error: "Invite not found or already used" }, 404, origin);
  }

  return json({ success: true, data: { message: "Invite revoked" } }, 200, origin);
}
