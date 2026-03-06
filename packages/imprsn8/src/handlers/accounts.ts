import { z } from "zod";
import { json } from "../lib/cors";
import type { Env, MonitoredAccount, Platform, RiskCategory } from "../types";

const PLATFORMS = ["tiktok", "instagram", "x", "youtube", "facebook", "linkedin", "twitch", "threads", "snapchat", "pinterest"] as const;
const RISK_CATEGORIES = ["legitimate", "suspicious", "imposter", "unscored"] as const;

const AddAccountSchema = z.object({
  influencer_id: z.string().min(1),
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).max(100),
  profile_url: z.string().url().optional(),
  is_verified: z.number().int().min(0).max(1).default(0),
  follower_count: z.number().int().optional(),
});

const UpdateAccountSchema = z.object({
  risk_score: z.number().int().min(0).max(100).optional(),
  risk_category: z.enum(RISK_CATEGORIES).optional(),
  follower_count: z.number().int().optional(),
  is_verified: z.number().int().min(0).max(1).optional(),
});

export async function handleListAccounts(request: Request, env: Env, userId: string, userRole: string, assignedInfluencerId: string | null): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const influencerId = url.searchParams.get("influencer_id");
  const platform = url.searchParams.get("platform") as Platform | null;
  const riskCat = url.searchParams.get("risk") as RiskCategory | null;

  let query = `
    SELECT ma.*, ip.display_name as influencer_name, ip.handle as influencer_handle
    FROM monitored_accounts ma
    JOIN influencer_profiles ip ON ip.id = ma.influencer_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  // Role-based scoping
  if (userRole === "influencer" || userRole === "staff") {
    if (!assignedInfluencerId) return json({ success: true, data: [] }, 200, origin);
    query += " AND ma.influencer_id = ?";
    params.push(assignedInfluencerId);
  } else if (influencerId) {
    query += " AND ma.influencer_id = ?";
    params.push(influencerId);
  }

  if (platform) { query += " AND ma.platform = ?"; params.push(platform); }
  if (riskCat) { query += " AND ma.risk_category = ?"; params.push(riskCat); }

  query += " ORDER BY ma.risk_score ASC, ma.added_at DESC LIMIT 200";

  const rows = await env.DB.prepare(query).bind(...params).all<MonitoredAccount & { influencer_name: string; influencer_handle: string }>();
  return json({ success: true, data: rows.results }, 200, origin);
}

export async function handleAddAccount(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = AddAccountSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { influencer_id, platform, handle, profile_url, is_verified, follower_count } = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO monitored_accounts
     (id, influencer_id, platform, handle, profile_url, is_verified, follower_count, added_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, influencer_id, platform, handle, profile_url ?? null, is_verified, follower_count ?? null, now, now).run();

  // Capture initial snapshot so baseline exists for drift detection
  await env.DB.prepare(
    `INSERT INTO account_snapshots (account_id, avatar_url, follower_count, is_verified, captured_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, profile_url ?? null, follower_count ?? null, is_verified, now).run();

  return json({ success: true, data: { id, influencer_id, platform, handle, risk_score: 100, risk_category: "unscored", added_at: now } }, 201, origin);
}

export async function handleUpdateAccount(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = UpdateAccountSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: "Invalid data" }, 400, origin);

  const fields = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (fields.risk_score !== undefined) { sets.push("risk_score = ?"); vals.push(fields.risk_score); }
  if (fields.risk_category !== undefined) { sets.push("risk_category = ?"); vals.push(fields.risk_category); }
  if (fields.follower_count !== undefined) { sets.push("follower_count = ?"); vals.push(fields.follower_count); }
  if (fields.is_verified !== undefined) { sets.push("is_verified = ?"); vals.push(fields.is_verified); }

  if (sets.length === 0) return json({ success: false, error: "No fields to update" }, 400, origin);

  sets.push("updated_at = datetime('now')");
  vals.push(id);

  await env.DB.prepare(
    `UPDATE monitored_accounts SET ${sets.join(", ")} WHERE id = ?`
  ).bind(...vals).run();

  const updated = await env.DB.prepare("SELECT * FROM monitored_accounts WHERE id = ?").bind(id).first<MonitoredAccount>();
  return json({ success: true, data: updated }, 200, origin);
}

export async function handleDeleteAccount(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  await env.DB.prepare("DELETE FROM monitored_accounts WHERE id = ?").bind(id).run();
  return json({ success: true, message: "Account removed" }, 200, origin);
}
