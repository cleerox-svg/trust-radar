import { z } from "zod";
import { json } from "../lib/cors";
import type { Env, InfluencerProfile } from "../types";

const CreateSchema = z.object({
  display_name: z.string().min(1).max(100),
  handle: z.string().min(1).max(64),
  avatar_url: z.string().url().optional(),
  tier: z.enum(["starter", "pro", "enterprise"]).default("starter"),
});

const UpdateSchema = CreateSchema.partial().extend({
  active: z.number().int().min(0).max(1).optional(),
});

export async function handleListInfluencers(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  const rows = await env.DB.prepare(`
    SELECT
      ip.*,
      COUNT(DISTINCT ma.id) as monitored_count,
      SUM(CASE WHEN ir.status NOT IN ('resolved','dismissed') THEN 1 ELSE 0 END) as active_threats,
      SUM(CASE WHEN td.status IN ('draft','submitted','acknowledged','in_review') THEN 1 ELSE 0 END) as pending_takedowns
    FROM influencer_profiles ip
    LEFT JOIN monitored_accounts ma ON ma.influencer_id = ip.id
    LEFT JOIN impersonation_reports ir ON ir.influencer_id = ip.id
    LEFT JOIN takedown_requests td ON td.influencer_id = ip.id
    WHERE ip.active = 1
    GROUP BY ip.id
    ORDER BY ip.display_name ASC
  `).all<InfluencerProfile>();

  return json({ success: true, data: rows.results }, 200, origin);
}

export async function handleGetInfluencer(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const row = await env.DB.prepare(
    "SELECT * FROM influencer_profiles WHERE id = ? AND active = 1"
  ).bind(id).first<InfluencerProfile>();

  if (!row) return json({ success: false, error: "Not found" }, 404, origin);
  return json({ success: true, data: row }, 200, origin);
}

export async function handleCreateInfluencer(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { display_name, handle, avatar_url, tier } = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO influencer_profiles (id, display_name, handle, avatar_url, tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, display_name, handle, avatar_url ?? null, tier, now, now).run();

  return json({ success: true, data: { id, display_name, handle, avatar_url: avatar_url ?? null, tier, active: 1, created_at: now, updated_at: now } }, 201, origin);
}

export async function handleUpdateInfluencer(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: "Invalid data" }, 400, origin);

  const fields = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (fields.display_name !== undefined) { sets.push("display_name = ?"); vals.push(fields.display_name); }
  if (fields.handle !== undefined) { sets.push("handle = ?"); vals.push(fields.handle); }
  if (fields.avatar_url !== undefined) { sets.push("avatar_url = ?"); vals.push(fields.avatar_url); }
  if (fields.tier !== undefined) { sets.push("tier = ?"); vals.push(fields.tier); }
  if (fields.active !== undefined) { sets.push("active = ?"); vals.push(fields.active); }

  if (sets.length === 0) return json({ success: false, error: "No fields to update" }, 400, origin);

  sets.push("updated_at = datetime('now')");
  vals.push(id);

  await env.DB.prepare(
    `UPDATE influencer_profiles SET ${sets.join(", ")} WHERE id = ?`
  ).bind(...vals).run();

  const updated = await env.DB.prepare(
    "SELECT * FROM influencer_profiles WHERE id = ?"
  ).bind(id).first<InfluencerProfile>();

  return json({ success: true, data: updated }, 200, origin);
}
