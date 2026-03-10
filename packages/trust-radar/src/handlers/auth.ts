import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/hash";
import { signJWT } from "../lib/jwt";
import { json } from "../lib/cors";
import { logSessionEvent } from "./sessions";
import type { Env } from "../types";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  invite_token: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (!env.JWT_SECRET) {
    return json({ success: false, error: "Server misconfiguration: JWT_SECRET not set" }, 503, origin);
  }
  if (!env.DB) {
    return json({ success: false, error: "Server misconfiguration: DB not bound" }, 503, origin);
  }

  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);

  if (!parsed.success) {
    return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);
  }

  const { email, password, invite_token: inviteToken } = parsed.data;

  // Validate invite token if provided
  let inviteRole: string | null = null;
  let inviteGroupId: string | null = null;
  let inviteId: string | null = null;

  if (inviteToken) {
    const invite = await env.DB.prepare(
      "SELECT id, role, group_id, expires_at, used_at FROM invite_tokens WHERE token = ?",
    )
      .bind(inviteToken)
      .first<{ id: string; role: string; group_id: string | null; expires_at: string; used_at: string | null }>();

    if (!invite) return json({ success: false, error: "Invalid invite token" }, 400, origin);
    if (invite.used_at) return json({ success: false, error: "Invite already used" }, 410, origin);
    if (new Date(invite.expires_at) < new Date()) {
      return json({ success: false, error: "Invite has expired" }, 410, origin);
    }

    inviteRole = invite.role;
    inviteGroupId = invite.group_id;
    inviteId = invite.id;
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();

  if (existing) {
    return json({ success: false, error: "Email already registered" }, 409, origin);
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  const plan = inviteRole === "admin" ? "enterprise" : "free";

  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, plan) VALUES (?, ?, ?, ?)",
  )
    .bind(id, email, passwordHash, plan)
    .run();

  // If invite was used, assign role and mark invite as consumed
  if (inviteId && inviteRole) {
    await env.DB.prepare(
      `INSERT INTO profiles (id, user_id, role) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET role = excluded.role`,
    )
      .bind(crypto.randomUUID(), id, inviteRole)
      .run();

    if (inviteGroupId) {
      await env.DB.prepare(
        "INSERT INTO user_group_assignments (id, user_id, group_id, assigned_by) VALUES (?, ?, ?, ?)",
      )
        .bind(crypto.randomUUID(), id, inviteGroupId, "system")
        .run();
    }

    await env.DB.prepare(
      "UPDATE invite_tokens SET used_at = datetime('now'), used_by_user_id = ? WHERE id = ?",
    )
      .bind(id, inviteId)
      .run();
  }

  const token = await signJWT({ sub: id, email, plan: plan as "free" | "pro" | "enterprise" }, env.JWT_SECRET);

  await logSessionEvent(env, id, "register", request);

  return json({ success: true, data: { token, user: { id, email, plan, is_admin: inviteRole === "admin" } } }, 201, origin);
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (!env.JWT_SECRET) {
    return json({ success: false, error: "Server misconfiguration: JWT_SECRET not set" }, 503, origin);
  }
  if (!env.DB) {
    return json({ success: false, error: "Server misconfiguration: DB not bound" }, 503, origin);
  }

  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);

  if (!parsed.success) {
    return json({ success: false, error: "Invalid request" }, 400, origin);
  }

  const { email, password } = parsed.data;

  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, plan FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: string; email: string; password_hash: string; plan: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ success: false, error: "Invalid credentials" }, 401, origin);
  }

  const token = await signJWT(
    { sub: user.id, email: user.email, plan: user.plan as "free" | "pro" | "enterprise" },
    env.JWT_SECRET
  );

  await logSessionEvent(env, user.id, "login", request);

  return json(
    { success: true, data: { token, user: { id: user.id, email: user.email, plan: user.plan } } },
    200,
    origin
  );
}

export async function handleMe(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const user = await env.DB.prepare(
    "SELECT id, email, plan, scans_used, scans_limit, is_admin, created_at FROM users WHERE id = ?"
  )
    .bind(userId)
    .first<{ id: string; email: string; plan: string; scans_used: number; scans_limit: number; is_admin: number; created_at: string }>();

  if (!user) {
    return json({ success: false, error: "User not found" }, 404, origin);
  }

  return json({ success: true, data: { ...user, is_admin: !!user.is_admin } }, 200, origin);
}
