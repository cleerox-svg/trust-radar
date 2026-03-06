import { z } from "zod";
import { json } from "../lib/cors";
import type { Env } from "../types";

const UpdateUserSchema = z.object({
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
  is_admin: z.boolean().optional(),
  role: z.enum(["influencer", "staff", "soc", "admin"]).optional(),
  assigned_influencer_id: z.string().nullable().optional(),
});

export async function handleAdminListUsers(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const { results } = await env.DB.prepare(
    `SELECT id, email, username, display_name, plan, role, is_admin,
            impression_score, total_analyses, assigned_influencer_id, created_at
     FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();

  return json({ success: true, data: { users: results, total: total?.n ?? 0 } }, 200, origin);
}

export async function handleAdminUpdateUser(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const body = await request.json().catch(() => null);
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { plan, is_admin, role, assigned_influencer_id } = parsed.data;
  if (plan === undefined && is_admin === undefined && role === undefined && assigned_influencer_id === undefined) {
    return json({ success: false, error: "Nothing to update" }, 400, origin);
  }

  await env.DB.prepare(`
    UPDATE users SET
      plan                   = COALESCE(?, plan),
      is_admin               = COALESCE(?, is_admin),
      role                   = COALESCE(?, role),
      assigned_influencer_id = CASE WHEN ? IS NOT NULL THEN ? ELSE assigned_influencer_id END,
      updated_at             = datetime('now')
    WHERE id = ?
  `).bind(
    plan ?? null,
    is_admin !== undefined ? (is_admin ? 1 : 0) : null,
    role ?? null,
    // Use a sentinel to distinguish "not provided" from explicit null:
    // pass the string key as the condition; if assigned_influencer_id key was present,
    // pass its value, else leave the column unchanged via NULL sentinel.
    assigned_influencer_id !== undefined ? "set" : null,
    assigned_influencer_id !== undefined ? (assigned_influencer_id ?? null) : null,
    userId,
  ).run();

  const user = await env.DB.prepare(
    "SELECT id, email, username, display_name, plan, role, is_admin, impression_score, total_analyses, assigned_influencer_id, created_at FROM users WHERE id = ?"
  ).bind(userId).first().catch(() =>
    env.DB.prepare(
      "SELECT id, email, NULL AS username, display_name, plan, role, is_admin, impression_score, total_analyses, assigned_influencer_id, created_at FROM users WHERE id = ?"
    ).bind(userId).first()
  );

  if (!user) return json({ success: false, error: "User not found" }, 404, origin);
  return json({ success: true, data: user }, 200, origin);
}
