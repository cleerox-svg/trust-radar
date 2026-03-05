import { z } from "zod";
import { json } from "../lib/cors";
import type { Env } from "../types";

const UpdateUserSchema = z.object({
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
  is_admin: z.boolean().optional(),
});

export async function handleAdminStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  const [users, analyses] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN plan='pro' THEN 1 ELSE 0 END) AS pro, SUM(CASE WHEN plan='enterprise' THEN 1 ELSE 0 END) AS enterprise, AVG(impression_score) AS avg_score FROM users").first<{ total: number; pro: number; enterprise: number; avg_score: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS total, AVG(score) AS avg_score FROM analyses").first<{ total: number; avg_score: number }>(),
  ]);

  return json({
    success: true, data: {
      users: { total: users?.total ?? 0, pro: users?.pro ?? 0, enterprise: users?.enterprise ?? 0, avg_impression_score: Math.round(users?.avg_score ?? 0) },
      analyses: { total: analyses?.total ?? 0, avg_score: Math.round(analyses?.avg_score ?? 0) },
    },
  }, 200, origin);
}

export async function handleAdminListUsers(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const { results } = await env.DB.prepare(
    "SELECT id, email, username, display_name, plan, impression_score, total_analyses, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).bind(limit, offset).all();

  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();

  return json({ success: true, data: { users: results, total: total?.n ?? 0 } }, 200, origin);
}

export async function handleAdminUpdateUser(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const body = await request.json().catch(() => null);
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { plan, is_admin } = parsed.data;
  if (plan === undefined && is_admin === undefined) {
    return json({ success: false, error: "Nothing to update" }, 400, origin);
  }

  await env.DB.prepare(`
    UPDATE users SET
      plan       = COALESCE(?, plan),
      is_admin   = COALESCE(?, is_admin),
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(plan ?? null, is_admin !== undefined ? (is_admin ? 1 : 0) : null, userId).run();

  const user = await env.DB.prepare(
    "SELECT id, email, username, display_name, plan, impression_score, total_analyses, is_admin, created_at FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!user) return json({ success: false, error: "User not found" }, 404, origin);
  return json({ success: true, data: user }, 200, origin);
}
