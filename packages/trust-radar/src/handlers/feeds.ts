import { json } from "../lib/cors";
import { runAllFeeds, runFeed } from "../lib/feedRunner";
import type { FeedConfigRow } from "../lib/feedRunner";
import { feedModules } from "../feeds";
import type { Env } from "../types";

/** Mask a credential for safe display: show last 4 chars only */
function maskSecret(val: string | null): string | null {
  if (!val) return null;
  if (val.length <= 4) return "****";
  return "****" + val.slice(-4);
}

// ─── List all feed configs ──────────────────────────────────────
export async function handleListFeeds(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const configs = await env.DB.prepare(
      `SELECT c.*, s.last_successful_pull, s.last_failure, s.records_ingested_today, s.health_status
       FROM feed_configs c
       LEFT JOIN feed_status s ON c.feed_name = s.feed_name
       ORDER BY c.feed_name ASC`
    ).all();

    const masked = (configs.results as Record<string, unknown>[]).map((r) => ({
      ...r,
      api_key_encrypted: maskSecret(r.api_key_encrypted as string | null),
    }));
    return json({ success: true, data: masked }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Get single feed detail ─────────────────────────────────────
export async function handleGetFeed(request: Request, env: Env, feedName: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const feed = await env.DB.prepare(
      `SELECT c.*, s.last_successful_pull, s.last_failure, s.records_ingested_today, s.health_status
       FROM feed_configs c
       LEFT JOIN feed_status s ON c.feed_name = s.feed_name
       WHERE c.feed_name = ?`
    ).bind(feedName).first();

    if (!feed) return json({ success: false, error: "Feed not found" }, 404, origin);

    // Recent pull history
    const pulls = await env.DB.prepare(
      `SELECT id, status, records_ingested, records_rejected, error_message, duration_ms, started_at, completed_at
       FROM feed_pull_history WHERE feed_name = ? ORDER BY started_at DESC LIMIT 20`
    ).bind(feedName).all();

    const result = feed as Record<string, unknown>;
    result.api_key_encrypted = maskSecret(result.api_key_encrypted as string | null);

    return json({ success: true, data: { feed: result, pulls: pulls.results } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Update feed config ─────────────────────────────────────────
export async function handleUpdateFeed(request: Request, env: Env, feedName: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof body.enabled === "boolean" || typeof body.enabled === "number") {
      updates.push("enabled = ?");
      values.push(body.enabled ? 1 : 0);
    }
    if (typeof body.display_name === "string" && body.display_name) {
      updates.push("display_name = ?");
      values.push(body.display_name);
    }
    if (typeof body.description === "string") {
      updates.push("description = ?");
      values.push(body.description);
    }
    if (typeof body.source_url === "string" && body.source_url) {
      updates.push("source_url = ?");
      values.push(body.source_url);
    }
    if (typeof body.schedule_cron === "string" && body.schedule_cron) {
      updates.push("schedule_cron = ?");
      values.push(body.schedule_cron);
    }
    if (typeof body.rate_limit === "number") {
      updates.push("rate_limit = ?");
      values.push(body.rate_limit);
    }
    if (typeof body.batch_size === "number") {
      updates.push("batch_size = ?");
      values.push(body.batch_size);
    }

    if (updates.length === 0) {
      return json({ success: false, error: "No valid fields to update" }, 400, origin);
    }

    updates.push("updated_at = datetime('now')");
    values.push(feedName);

    await env.DB.prepare(
      `UPDATE feed_configs SET ${updates.join(", ")} WHERE feed_name = ?`
    ).bind(...values).run();

    const updated = await env.DB.prepare("SELECT * FROM feed_configs WHERE feed_name = ?").bind(feedName).first();
    return json({ success: true, data: updated }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Manually trigger a single feed ─────────────────────────────
export async function handleTriggerFeed(request: Request, env: Env, feedName: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const mod = feedModules[feedName];
    if (!mod) {
      console.log(`[triggerFeed] Feed "${feedName}" not found — available: ${Object.keys(feedModules).join(", ")}`);
      return json({ success: false, error: "Feed module not implemented" }, 501, origin);
    }

    const config = await env.DB.prepare("SELECT * FROM feed_configs WHERE feed_name = ?").bind(feedName).first<FeedConfigRow>();
    if (!config) return json({ success: false, error: "Feed not found" }, 404, origin);

    // Use runFeed() so feed_status and feed_pull_history are properly updated
    console.log(`[triggerFeed] Executing "${feedName}" (manual trigger)`);
    const result = await runFeed(env, config, mod);
    console.log(`[triggerFeed] "${feedName}" completed: fetched=${result.itemsFetched}, new=${result.itemsNew}`);

    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    console.error(`[triggerFeed] "${feedName}" threw:`, err);
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Trigger all feeds (full ingest cycle) ──────────────────────
export async function handleTriggerAll(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const result = await runAllFeeds(env, feedModules);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Trigger feeds by tier (stub — tiers removed in v2) ─────────
export async function handleTriggerTier(request: Request, env: Env, _tier: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  return json({ success: false, error: "Tier-based triggering not available in v2. Use /api/feeds/trigger-all." }, 410, origin);
}

// ─── Feed stats ─────────────────────────────────────────────────
export async function handleFeedStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const totals = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_feeds,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_feeds
      FROM feed_configs
    `).first();

    const statusSummary = await env.DB.prepare(`
      SELECT health_status, COUNT(*) as count
      FROM feed_status GROUP BY health_status
    `).all();

    const recentPulls = await env.DB.prepare(`
      SELECT feed_name, status, records_ingested, duration_ms, started_at
      FROM feed_pull_history ORDER BY started_at DESC LIMIT 50
    `).all();

    return json({
      success: true,
      data: {
        summary: totals,
        statusBreakdown: statusSummary.results,
        recentPulls: recentPulls.results,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Pull history (replaces ingestion jobs) ─────────────────────
export async function handleIngestionJobs(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") ?? "20", 10));
    const rows = await env.DB.prepare(
      "SELECT * FROM feed_pull_history ORDER BY started_at DESC LIMIT ?"
    ).bind(limit).all();
    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Reset feed health (replaces circuit breaker reset) ─────────
export async function handleResetCircuit(request: Request, env: Env, feedName: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    await env.DB.prepare(
      `UPDATE feed_status SET health_status = 'healthy', last_failure = NULL WHERE feed_name = ?`
    ).bind(feedName).run();
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Feed quota (stub — quota tracking deferred to Phase 2) ─────
export async function handleFeedQuota(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  return json({ success: true, data: [] }, 200, origin);
}
