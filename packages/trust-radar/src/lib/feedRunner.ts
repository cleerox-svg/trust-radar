/**
 * Feed Runner v2 — Central orchestrator for intelligence feed ingestion.
 *
 * Uses v2 tables: feed_configs, feed_status, feed_pull_history, threats
 *
 * Features:
 * - Schedule-based execution from feed_configs
 * - IOC deduplication via KV cache + DB INSERT OR IGNORE
 * - Per-feed execution logging to feed_pull_history
 * - Feed health status tracking in feed_status
 */

import type { Env } from "../types";
import type { FeedModule, FeedContext, FeedResult, ThreatRow } from "../feeds/types";
import { createNotification } from "./notifications";

// ─── Deduplication ───────────────────────────────────────────────

/** Check if an IOC was already seen (KV-based, 24h TTL) */
export async function isDuplicate(env: Env, iocType: string, iocValue: string): Promise<boolean> {
  try {
    const key = `dedup:${iocType}:${iocValue}`;
    return (await env.CACHE.get(key)) !== null;
  } catch {
    return false;
  }
}

/** Mark an IOC as seen */
export async function markSeen(env: Env, iocType: string, iocValue: string): Promise<void> {
  try {
    const key = `dedup:${iocType}:${iocValue}`;
    await env.CACHE.put(key, "1", { expirationTtl: 86400 }); // 24h
  } catch { /* non-fatal */ }
}

// ─── Threat Insertion (v2 schema) ────────────────────────────────

export async function insertThreat(db: D1Database, threat: ThreatRow): Promise<void> {
  await db.prepare(
    `INSERT OR IGNORE INTO threats
       (id, source_feed, threat_type, malicious_url, malicious_domain,
        target_brand_id, hosting_provider_id, ip_address, asn, country_code,
        registrar, status, confidence_score, campaign_id, ioc_value, severity,
        first_seen, last_seen, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             datetime('now'), datetime('now'), datetime('now'))`
  ).bind(
    threat.id,
    threat.source_feed,
    threat.threat_type,
    threat.malicious_url,
    threat.malicious_domain,
    threat.target_brand_id ?? null,
    threat.hosting_provider_id ?? null,
    threat.ip_address ?? null,
    threat.asn ?? null,
    threat.country_code ?? null,
    threat.registrar ?? null,
    threat.status ?? "active",
    threat.confidence_score ?? null,
    threat.campaign_id ?? null,
    threat.ioc_value ?? null,
    threat.severity ?? null,
  ).run();
}

// ─── Feed Config Row ─────────────────────────────────────────────

export interface FeedConfigRow {
  feed_name: string;
  display_name: string;
  source_url: string | null;
  schedule_cron: string;
  rate_limit: number;
  batch_size: number;
  retry_count: number;
  enabled: number;
}

interface FeedStatusRow {
  feed_name: string;
  last_successful_pull: string | null;
  health_status: string;
}

// ─── Feed Execution ──────────────────────────────────────────────

export async function runFeed(
  env: Env,
  config: FeedConfigRow,
  feedModule: FeedModule,
): Promise<FeedResult> {
  const pullId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Create pull history entry
  await env.DB.prepare(
    `INSERT INTO feed_pull_history (id, feed_name, started_at, status) VALUES (?, ?, ?, 'partial')`
  ).bind(pullId, config.feed_name, startedAt).run();

  const ctx: FeedContext = {
    env,
    feedName: config.feed_name,
    feedUrl: config.source_url ?? "",
  };

  console.log(`[runFeed] ${config.feed_name}: starting ingest (feedUrl=${ctx.feedUrl})`);
  const start = Date.now();

  try {
    const result = await feedModule.ingest(ctx);
    const durationMs = Date.now() - start;
    console.log(`[runFeed] ${config.feed_name}: ingest completed in ${durationMs}ms — fetched=${result.itemsFetched}, new=${result.itemsNew}, dup=${result.itemsDuplicate}, err=${result.itemsError}`);

    // Log success in pull history
    const pullUpdate = await env.DB.prepare(
      `UPDATE feed_pull_history SET
         status = 'success', records_ingested = ?, records_rejected = ?,
         duration_ms = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(result.itemsNew, result.itemsDuplicate + result.itemsError, durationMs, pullId).run();
    console.log(`[runFeed] ${config.feed_name}: pull_history updated, changes=${pullUpdate.meta.changes}`);

    // Ensure feed_status row exists (INSERT OR IGNORE), then update
    await env.DB.prepare(
      "INSERT OR IGNORE INTO feed_status (feed_name, health_status) VALUES (?, 'healthy')"
    ).bind(config.feed_name).run();

    // Update feed_status: only set healthy if records were ingested
    const statusUpdate = await env.DB.prepare(
      `UPDATE feed_status SET
         last_successful_pull = datetime('now'),
         records_ingested_today = records_ingested_today + ?,
         health_status = CASE WHEN ? > 0 THEN 'healthy' ELSE health_status END
       WHERE feed_name = ?`
    ).bind(result.itemsNew, result.itemsFetched, config.feed_name).run();
    console.log(`[runFeed] ${config.feed_name}: feed_status updated, changes=${statusUpdate.meta.changes}`);

    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[runFeed] ${config.feed_name}: FAILED after ${durationMs}ms — ${errorMsg}`);
    if (err instanceof Error && err.stack) console.error(`[runFeed] ${config.feed_name}: stack:`, err.stack);

    // Log failure in pull history
    await env.DB.prepare(
      `UPDATE feed_pull_history SET
         status = 'failed', error_message = ?, duration_ms = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(errorMsg, durationMs, pullId).run();

    // Check previous status for transition notification
    const prevStatus = await env.DB.prepare(
      `SELECT health_status FROM feed_status WHERE feed_name = ?`
    ).bind(config.feed_name).first<{ health_status: string }>();

    // Update feed_status to degraded
    await env.DB.prepare(
      `UPDATE feed_status SET
         last_failure = datetime('now'),
         health_status = 'degraded'
       WHERE feed_name = ?`
    ).bind(config.feed_name).run();

    // Notify only on status CHANGE (healthy → degraded)
    if (prevStatus?.health_status === 'healthy') {
      try {
        await createNotification(env.DB, {
          type: 'feed_health',
          severity: 'high',
          title: `Feed degraded: ${config.display_name}`,
          message: `${config.display_name} returned errors. Check Admin → Feeds.`,
          link: '/admin/feeds',
          metadata: { feed_name: config.feed_name },
        });
      } catch (e) {
        console.error(`[runFeed] notification error:`, e);
      }
    }

    // Re-throw so callers (handleTriggerFeed) can distinguish success from failure.
    // runAllFeeds uses Promise.allSettled, so this won't break the coordinator.
    const feedError = new Error(`Feed ${config.feed_name} failed: ${errorMsg}`);
    (feedError as Error & { feedResult: FeedResult }).feedResult = { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0 };
    throw feedError;
  }
}

// ─── Coordinator ─────────────────────────────────────────────────

/** Run all enabled feeds */
export async function runAllFeeds(
  env: Env,
  feedModules: Record<string, FeedModule>,
): Promise<{
  feedsRun: number;
  feedsSkipped: number;
  feedsFailed: number;
  totalNew: number;
}> {
  // Fetch enabled feed configs
  console.log("[feedRunner] querying feed_configs WHERE enabled = 1...");
  const configs = await env.DB.prepare(
    "SELECT * FROM feed_configs WHERE enabled = 1"
  ).all<FeedConfigRow>();
  console.log(`[feedRunner] found ${configs.results.length} enabled feed configs:`, configs.results.map(c => c.feed_name).join(", "));

  // Fetch feed status for last-run checks
  const statuses = await env.DB.prepare(
    "SELECT * FROM feed_status"
  ).all<FeedStatusRow>();
  console.log(`[feedRunner] feed_status rows:`, JSON.stringify(statuses.results));
  const statusMap = new Map(statuses.results.map(s => [s.feed_name, s]));

  let feedsRun = 0;
  let feedsSkipped = 0;
  let feedsFailed = 0;
  let totalNew = 0;

  const now = new Date();

  // Determine which feeds to run based on their cron schedule
  const toRun: Array<{ config: FeedConfigRow; mod: FeedModule }> = [];

  for (const config of configs.results) {
    const mod = feedModules[config.feed_name];
    if (!mod) {
      console.log(`[feedRunner] SKIP ${config.feed_name}: no module registered`);
      feedsSkipped++;
      continue;
    }

    const status = statusMap.get(config.feed_name);
    const shouldRun = shouldRunNow(config, status, now);
    if (!shouldRun) {
      console.log(`[feedRunner] SKIP ${config.feed_name}: shouldRunNow=false (last_pull=${status?.last_successful_pull}, cron=${config.schedule_cron})`);
      feedsSkipped++;

      // Write persistent diagnostic for CF scanner skips
      if (config.feed_name === 'cloudflare_scanner') {
        const intervalMs = parseCronIntervalMs(config.schedule_cron);
        const lastRun = status?.last_successful_pull ? new Date(status.last_successful_pull + 'Z').getTime() : null;
        const elapsed = lastRun ? now.getTime() - lastRun : null;
        try {
          await env.DB.prepare(
            "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
          ).bind(
            'diag_cf_skip_' + Date.now(),
            `CF Scanner SKIPPED by shouldRunNow: last_pull=${status?.last_successful_pull || 'NULL'}, interval=${intervalMs}ms (${intervalMs / 60000}min), elapsed=${elapsed !== null ? elapsed + 'ms (' + Math.round(elapsed / 60000) + 'min)' : 'N/A'}, now=${now.toISOString()}`,
          ).run();
        } catch { /* non-fatal */ }
      }
      continue;
    }

    console.log(`[feedRunner] WILL RUN ${config.feed_name} (source_url=${config.source_url})`);
    toRun.push({ config, mod });
  }

  // Run all eligible feeds concurrently
  console.log(`[feedRunner] running ${toRun.length} feeds concurrently...`);
  const results = await Promise.allSettled(
    toRun.map(({ config, mod }) => runFeed(env, config, mod))
  );

  for (const [i, r] of results.entries()) {
    const name = toRun[i]!.config.feed_name;
    feedsRun++;
    if (r.status === "fulfilled") {
      totalNew += r.value.itemsNew;
      console.log(`[feedRunner] ${name}: fulfilled — new=${r.value.itemsNew}, fetched=${r.value.itemsFetched}`);
    } else {
      feedsFailed++;
      console.error(`[feedRunner] ${name}: REJECTED — ${r.reason}`);
    }
  }

  console.log(`[feedRunner] SUMMARY: run=${feedsRun}, skipped=${feedsSkipped}, failed=${feedsFailed}, totalNew=${totalNew}`);
  return { feedsRun, feedsSkipped, feedsFailed, totalNew };
}

// ─── Schedule Check ──────────────────────────────────────────────

/**
 * Simple interval-based check derived from cron expression.
 * Parses the minute field of the cron to determine interval.
 */
function shouldRunNow(config: FeedConfigRow, status: FeedStatusRow | undefined, now: Date): boolean {
  if (!status) return true; // No status row = never run before
  if (!status.last_successful_pull) return true; // Never succeeded

  // Parse interval from cron: "*/5 * * * *" → 5 min, "0 * * * *" → 60 min, "0 */12 * * *" → 720 min
  const intervalMs = parseCronIntervalMs(config.schedule_cron);
  // Append 'Z' if missing — SQLite datetime('now') omits timezone, JS would parse as local
  const lastPull = status.last_successful_pull;
  const lastRun = new Date(lastPull.includes('Z') || lastPull.includes('+') ? lastPull : lastPull + 'Z').getTime();

  return now.getTime() - lastRun >= intervalMs;
}

function parseCronIntervalMs(cron: string): number {
  const parts = cron.split(/\s+/);
  if (parts.length < 5) return 5 * 60 * 1000; // default 5 min

  const minute = parts[0] ?? "*";
  const hour = parts[1] ?? "*";

  // "*/N * * * *" — every N minutes
  if (minute.startsWith("*/")) {
    return parseInt(minute.slice(2), 10) * 60 * 1000;
  }

  // "0 */N * * *" — every N hours
  if (minute === "0" && hour.startsWith("*/")) {
    return parseInt(hour.slice(2), 10) * 60 * 60 * 1000;
  }

  // "0 * * * *" — hourly
  if (minute === "0" && hour === "*") {
    return 60 * 60 * 1000;
  }

  // "0 0 * * *" — daily (specific hour, no wildcard)
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    return 24 * 60 * 60 * 1000;
  }

  // Default: 5 minutes
  return 5 * 60 * 1000;
}

// ─── Reset daily counters (called at start of day) ───────────────

export async function resetDailyCounters(db: D1Database): Promise<void> {
  await db.prepare("UPDATE feed_status SET records_ingested_today = 0").run();
}
