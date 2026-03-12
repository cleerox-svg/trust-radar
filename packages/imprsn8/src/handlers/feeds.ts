import { z } from "zod";
import { json } from "../lib/cors";
import { runFeed } from "../lib/feedRunner";
import type { Env, DataFeed } from "../types";

const ALL_PLATFORMS = [
  "youtube", "twitch", "reddit", "tiktok", "bluesky",
  "mastodon", "rss", "github", "facebook", "pinterest", "threads",
  "x_basic", "instagram_graph", "apify", "dataforseo",
  "x_pro", "brandwatch", "meltwater", "proxycurl", "mention",
] as const;

const TIER_MAP: Record<string, string> = {
  youtube: "free", twitch: "free", reddit: "free", tiktok: "free",
  bluesky: "free", mastodon: "free", rss: "free", github: "free",
  facebook: "free", pinterest: "free", threads: "free",
  x_basic: "low_cost", instagram_graph: "low_cost", apify: "low_cost", dataforseo: "low_cost",
  x_pro: "paid", brandwatch: "paid", meltwater: "paid", proxycurl: "paid", mention: "paid",
};

const CreateFeedSchema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(ALL_PLATFORMS),
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
  settings_json: z.string().default("{}"),
  pull_interval_mins: z.number().int().min(5).max(10080).default(60),
});

const UpdateFeedSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
  settings_json: z.string().optional(),
  pull_interval_mins: z.number().int().min(5).max(10080).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});

/** Replace credential values with ****last4 for list responses */
function maskFeed(feed: DataFeed): DataFeed {
  return {
    ...feed,
    api_key: feed.api_key ? "****" + feed.api_key.slice(-4) : null,
    api_secret: feed.api_secret ? "****" + feed.api_secret.slice(-4) : null,
  };
}

export async function handleListFeeds(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const rows = await env.DB.prepare(
    `SELECT * FROM data_feeds ORDER BY tier, platform, created_at DESC`
  ).all<DataFeed>();
  return json({ success: true, data: rows.results.map(maskFeed) }, 200, origin);
}

export async function handleCreateFeed(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = CreateFeedSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { name, platform, api_key, api_secret, settings_json, pull_interval_mins } = parsed.data;
  const tier = TIER_MAP[platform] ?? "free";
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Validate settings_json is valid JSON
  try { JSON.parse(settings_json); } catch {
    return json({ success: false, error: "settings_json must be valid JSON" }, 400, origin);
  }

  await env.DB.prepare(
    `INSERT INTO data_feeds (id, name, platform, tier, api_key, api_secret, settings_json, pull_interval_mins, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, name, platform, tier, api_key ?? null, api_secret ?? null, settings_json, pull_interval_mins, now, now).run();

  const feed = await env.DB.prepare("SELECT * FROM data_feeds WHERE id = ?").bind(id).first<DataFeed>();
  return json({ success: true, data: maskFeed(feed!) }, 201, origin);
}

export async function handleUpdateFeed(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const body = await request.json().catch(() => null);
  const parsed = UpdateFeedSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const fields = parsed.data;
  const sets: string[] = ["updated_at = datetime('now')"];
  const vals: unknown[] = [];

  if (fields.name !== undefined)               { sets.push("name = ?"); vals.push(fields.name); }
  if (fields.api_key !== undefined)            { sets.push("api_key = ?"); vals.push(fields.api_key); }
  if (fields.api_secret !== undefined)         { sets.push("api_secret = ?"); vals.push(fields.api_secret); }
  if (fields.settings_json !== undefined)      { sets.push("settings_json = ?"); vals.push(fields.settings_json); }
  if (fields.pull_interval_mins !== undefined) { sets.push("pull_interval_mins = ?"); vals.push(fields.pull_interval_mins); }
  if (fields.is_active !== undefined)          { sets.push("is_active = ?"); vals.push(fields.is_active); }

  if (sets.length === 1) return json({ success: false, error: "Nothing to update" }, 400, origin);

  vals.push(id);
  await env.DB.prepare(`UPDATE data_feeds SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  const feed = await env.DB.prepare("SELECT * FROM data_feeds WHERE id = ?").bind(id).first<DataFeed>();
  if (!feed) return json({ success: false, error: "Feed not found" }, 404, origin);
  return json({ success: true, data: maskFeed(feed) }, 200, origin);
}

export async function handleDeleteFeed(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  await env.DB.prepare("DELETE FROM data_feeds WHERE id = ?").bind(id).run();
  return json({ success: true, message: "Feed deleted" }, 200, origin);
}

export async function handleTriggerFeed(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const feed = await env.DB.prepare("SELECT * FROM data_feeds WHERE id = ?").bind(id).first<DataFeed>();
  if (!feed) return json({ success: false, error: "Feed not found" }, 404, origin);
  if (!feed.is_active) return json({ success: false, error: "Feed is disabled" }, 400, origin);

  // Mark running immediately so UI can show spinner
  await env.DB.prepare(
    `UPDATE data_feeds SET last_pull_status = 'running', updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run();

  // Run the feed (async — ctx.waitUntil not available here, runs inline)
  const result = await runFeed(feed, env);

  await env.DB.prepare(
    `UPDATE data_feeds
     SET last_pulled_at = datetime('now'),
         last_pull_status = ?,
         last_pull_error = ?,
         pull_count = pull_count + 1,
         threats_found = threats_found + ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    result.success ? "success" : "error",
    result.error ?? null,
    result.threats_found,
    id,
  ).run();

  const updated = await env.DB.prepare("SELECT * FROM data_feeds WHERE id = ?").bind(id).first<DataFeed>();
  return json({
    success: true,
    data: { data: maskFeed(updated!), meta: { threats_found: result.threats_found, error: result.error } },
  }, 200, origin);
}
