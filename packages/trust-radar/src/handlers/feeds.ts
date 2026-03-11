import { json } from "../lib/cors";
import { runFeed, runAllFeeds, runTier } from "../lib/feedRunner";
import { feedModules } from "../feeds";
import type { Env } from "../types";

/** Mask a credential for safe display: show last 4 chars only */
function maskSecret(val: string | null): string | null {
  if (!val) return null;
  if (val.length <= 4) return "****";
  return "****" + val.slice(-4);
}

// ─── List all feed schedules ─────────────────────────────────────
export async function handleListFeeds(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(
      `SELECT id, feed_name, display_name, tier, category, url, interval_mins, enabled,
              requires_key, parser, last_run_at, last_success_at, last_error,
              consecutive_failures, circuit_open, total_runs, total_items, created_at,
              description, settings_json, is_custom, created_by, last_items_new, provider_url,
              api_key_encrypted, api_secret_encrypted
       FROM feed_schedules ORDER BY tier ASC, feed_name ASC`
    ).all();
    // Mask credentials in response
    const masked = (rows.results as Record<string, unknown>[]).map((r) => ({
      ...r,
      api_key_encrypted: maskSecret(r.api_key_encrypted as string | null),
      api_secret_encrypted: maskSecret(r.api_secret_encrypted as string | null),
    }));
    return json({ success: true, data: masked }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Get single feed detail ──────────────────────────────────────
export async function handleGetFeed(request: Request, env: Env, feedId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const feed = await env.DB.prepare("SELECT * FROM feed_schedules WHERE id = ?").bind(feedId).first();
    if (!feed) return json({ success: false, error: "Feed not found" }, 404, origin);

    // Recent ingestions
    const ingestions = await env.DB.prepare(
      `SELECT id, status, items_fetched, items_new, items_duplicate, items_error,
              threats_created, error, duration_ms, started_at, completed_at
       FROM feed_ingestions WHERE feed_id = ? ORDER BY started_at DESC LIMIT 20`
    ).bind(feedId).all();

    return json({ success: true, data: { feed, ingestions: ingestions.results } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Update feed schedule (full update — all editable fields) ─────
export async function handleUpdateFeed(request: Request, env: Env, feedId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof body.enabled === "boolean" || typeof body.enabled === "number") {
      updates.push("enabled = ?");
      values.push(body.enabled ? 1 : 0);
    }
    if (typeof body.interval_mins === "number" && body.interval_mins >= 1) {
      updates.push("interval_mins = ?");
      values.push(Math.floor(body.interval_mins));
    }
    if (typeof body.display_name === "string" && body.display_name) {
      updates.push("display_name = ?");
      values.push(body.display_name);
    }
    if (typeof body.description === "string") {
      updates.push("description = ?");
      values.push(body.description);
    }
    if (typeof body.url === "string" && body.url) {
      updates.push("url = ?");
      values.push(body.url);
    }
    if (typeof body.category === "string" && body.category) {
      updates.push("category = ?");
      values.push(body.category);
    }
    if (typeof body.tier === "number" && body.tier >= 1 && body.tier <= 6) {
      updates.push("tier = ?");
      values.push(body.tier);
    }
    if (typeof body.parser === "string" && body.parser) {
      updates.push("parser = ?");
      values.push(body.parser);
    }
    if (typeof body.settings_json === "string") {
      updates.push("settings_json = ?");
      values.push(body.settings_json);
    }
    if (typeof body.provider_url === "string") {
      updates.push("provider_url = ?");
      values.push(body.provider_url);
    }
    // Only update credentials if explicitly provided (non-masked)
    if (typeof body.api_key === "string" && body.api_key && !/^\*+/.test(body.api_key as string)) {
      updates.push("api_key_encrypted = ?");
      values.push(body.api_key);
      updates.push("requires_key = 1");
    }
    if (typeof body.api_secret === "string" && body.api_secret && !/^\*+/.test(body.api_secret as string)) {
      updates.push("api_secret_encrypted = ?");
      values.push(body.api_secret);
    }

    if (updates.length === 0) {
      return json({ success: false, error: "No valid fields to update" }, 400, origin);
    }

    updates.push("updated_at = datetime('now')");
    values.push(feedId);

    await env.DB.prepare(
      `UPDATE feed_schedules SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();

    // Return updated feed
    const updated = await env.DB.prepare("SELECT * FROM feed_schedules WHERE id = ?").bind(feedId).first();
    if (updated) {
      (updated as Record<string, unknown>).api_key_encrypted = maskSecret((updated as Record<string, unknown>).api_key_encrypted as string | null);
      (updated as Record<string, unknown>).api_secret_encrypted = maskSecret((updated as Record<string, unknown>).api_secret_encrypted as string | null);
    }

    return json({ success: true, data: updated }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Create a new feed ────────────────────────────────────────────
export async function handleCreateFeed(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as Record<string, unknown>;
    const feedName = body.feed_name as string;
    const displayName = body.display_name as string;
    const url = body.url as string ?? "";

    if (!feedName || !displayName) {
      return json({ success: false, error: "feed_name and display_name are required" }, 400, origin);
    }

    // Generate unique ID
    const id = `feed-custom-${Date.now().toString(36)}`;

    await env.DB.prepare(`
      INSERT INTO feed_schedules (
        id, feed_name, display_name, tier, category, url, interval_mins, enabled,
        requires_key, parser, description, settings_json, is_custom, created_by,
        api_key_encrypted, api_secret_encrypted, api_key_env, provider_url, method, headers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 1, ?, ?, ?, NULL, ?, 'GET', '{}')
    `).bind(
      id,
      feedName,
      displayName,
      (body.tier as number) ?? 3,
      (body.category as string) ?? "threat",
      url,
      Math.max(5, (body.interval_mins as number) ?? 60),
      (body.api_key as string) ? 1 : 0,
      (body.parser as string) ?? "json",
      (body.description as string) ?? "",
      (body.settings_json as string) ?? "{}",
      userId,
      (body.api_key as string) ?? null,
      (body.api_secret as string) ?? null,
      (body.provider_url as string) ?? "",
    ).run();

    const created = await env.DB.prepare("SELECT * FROM feed_schedules WHERE id = ?").bind(id).first();
    if (created) {
      (created as Record<string, unknown>).api_key_encrypted = maskSecret((created as Record<string, unknown>).api_key_encrypted as string | null);
      (created as Record<string, unknown>).api_secret_encrypted = maskSecret((created as Record<string, unknown>).api_secret_encrypted as string | null);
    }

    return json({ success: true, data: created }, 201, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Delete a feed (custom feeds only) ────────────────────────────
export async function handleDeleteFeed(request: Request, env: Env, feedId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const feed = await env.DB.prepare("SELECT is_custom FROM feed_schedules WHERE id = ?").bind(feedId).first<{ is_custom: number }>();
    if (!feed) return json({ success: false, error: "Feed not found" }, 404, origin);
    if (!feed.is_custom) return json({ success: false, error: "Cannot delete system feeds. Disable it instead." }, 403, origin);

    await env.DB.prepare("DELETE FROM feed_ingestions WHERE feed_id = ?").bind(feedId).run();
    await env.DB.prepare("DELETE FROM feed_schedules WHERE id = ?").bind(feedId).run();

    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Manually trigger a single feed ──────────────────────────────
export async function handleTriggerFeed(request: Request, env: Env, feedId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const schedule = await env.DB.prepare("SELECT * FROM feed_schedules WHERE id = ?").bind(feedId).first<{
      id: string; feed_name: string; display_name: string; tier: number; url: string; method: string;
      headers: string; interval_mins: number; enabled: number; requires_key: number;
      api_key_env: string | null; parser: string; last_run_at: string | null; last_success_at: string | null;
      consecutive_failures: number; circuit_open: number; circuit_opened_at: string | null;
    }>();

    if (!schedule) return json({ success: false, error: "Feed not found" }, 404, origin);

    const mod = feedModules[schedule.feed_name];
    if (!mod) return json({ success: false, error: "Feed module not implemented" }, 501, origin);

    const result = await runFeed(env, schedule, mod);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Trigger all feeds (full ingest cycle) ───────────────────────
export async function handleTriggerAll(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const result = await runAllFeeds(env, feedModules);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Trigger feeds by tier ───────────────────────────────────────
export async function handleTriggerTier(request: Request, env: Env, tier: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  const tierNum = parseInt(tier, 10);
  if (isNaN(tierNum) || tierNum < 1 || tierNum > 6) {
    return json({ success: false, error: "Invalid tier (1-6)" }, 400, origin);
  }
  try {
    const result = await runTier(env, tierNum, feedModules);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Feed analytics / stats ──────────────────────────────────────
export async function handleFeedStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const totals = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_feeds,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_feeds,
        SUM(CASE WHEN circuit_open = 1 THEN 1 ELSE 0 END) as circuit_open,
        SUM(total_runs) as total_runs,
        SUM(total_items) as total_items
      FROM feed_schedules
    `).first();

    const recentIngestions = await env.DB.prepare(`
      SELECT feed_name, status, items_new, threats_created, duration_ms, started_at
      FROM feed_ingestions ORDER BY started_at DESC LIMIT 50
    `).all();

    const byTier = await env.DB.prepare(`
      SELECT tier, COUNT(*) as count, SUM(total_items) as items, SUM(total_runs) as runs
      FROM feed_schedules GROUP BY tier ORDER BY tier
    `).all();

    return json({
      success: true,
      data: {
        summary: totals,
        recentIngestions: recentIngestions.results,
        byTier: byTier.results,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Ingestion job history ───────────────────────────────────────
export async function handleIngestionJobs(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));
    const rows = await env.DB.prepare(
      "SELECT * FROM ingestion_jobs ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();
    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Reset circuit breaker ───────────────────────────────────────
export async function handleResetCircuit(request: Request, env: Env, feedId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    await env.DB.prepare(
      `UPDATE feed_schedules SET circuit_open = 0, circuit_opened_at = NULL, consecutive_failures = 0, updated_at = datetime('now') WHERE id = ?`
    ).bind(feedId).run();
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
