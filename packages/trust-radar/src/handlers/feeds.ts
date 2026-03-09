import { json } from "../lib/cors";
import { runFeed, runAllFeeds, runTier } from "../lib/feedRunner";
import { feedModules } from "../feeds";
import type { Env } from "../types";

// ─── List all feed schedules ─────────────────────────────────────
export async function handleListFeeds(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(
      `SELECT id, feed_name, display_name, tier, category, url, interval_mins, enabled,
              requires_key, parser, last_run_at, last_success_at, last_error,
              consecutive_failures, circuit_open, total_runs, total_items, created_at
       FROM feed_schedules ORDER BY tier ASC, feed_name ASC`
    ).all();
    return json({ success: true, data: rows.results }, 200, origin);
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

// ─── Update feed schedule (enable/disable, interval) ─────────────
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
    if (updates.length === 0) {
      return json({ success: false, error: "No valid fields to update" }, 400, origin);
    }

    updates.push("updated_at = datetime('now')");
    values.push(feedId);

    await env.DB.prepare(
      `UPDATE feed_schedules SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();

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
