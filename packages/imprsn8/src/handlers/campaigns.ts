import { z } from "zod";
import { json } from "../lib/cors";
import type { Env } from "../types";

const CampaignSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum(["web", "mobile", "email", "api"]),
});

export async function handleListCampaigns(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  try {
    const rows = await env.DB.prepare(
      "SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 20"
    ).bind(userId).all<{
      id: string; name: string; channel: string; status: string;
      reach: number; impressions: number; conversions: number;
      started_at: string; created_at: string;
    }>();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch {
    return json({ success: true, data: [] }, 200, origin);
  }
}

export async function handleCreateCampaign(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = CampaignSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: "Invalid data" }, 400, origin);

  const { name, channel } = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO campaigns (id, user_id, name, channel, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, userId, name, channel, now, now).run().catch(() => {});

  return json({ success: true, data: { id, user_id: userId, name, channel, status: "active", reach: 0, impressions: 0, conversions: 0, started_at: now, created_at: now } }, 201, origin);
}

export async function handleListEvents(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

  try {
    const rows = await env.DB.prepare(
      `SELECT * FROM impression_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(userId, limit).all<{
      id: string; campaign_name: string | null; channel: string;
      action: string; influence_score: number; created_at: string;
    }>();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch {
    return json({ success: true, data: [] }, 200, origin);
  }
}
