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
import { calculateConfidence, calculateSeverity, reclassifyThreatType } from "./threatScoring";

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
  // Apply heuristic reclassification (first-pass before AI Analyst)
  const reclassified = reclassifyThreatType(
    threat.threat_type,
    threat.malicious_url ?? null,
    threat.malicious_domain ?? null,
  );
  const threatType = reclassified ?? threat.threat_type;

  // Apply confidence score calibration if not set by the feed
  const confidence = threat.confidence_score ??
    calculateConfidence(threat.source_feed, threatType, !!threat.target_brand_id);

  // Derive severity from confidence if not set by the feed
  const severity = threat.severity ?? calculateSeverity(confidence);

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
    threatType,
    threat.malicious_url,
    threat.malicious_domain,
    threat.target_brand_id ?? null,
    threat.hosting_provider_id ?? null,
    threat.ip_address ?? null,
    threat.asn ?? null,
    threat.country_code ?? null,
    threat.registrar ?? null,
    threat.status ?? "active",
    confidence,
    threat.campaign_id ?? null,
    threat.ioc_value ?? null,
    severity,
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

  const start = Date.now();

  try {
    const result = await feedModule.ingest(ctx);
    const durationMs = Date.now() - start;
    // Log success in pull history
    const pullUpdate = await env.DB.prepare(
      `UPDATE feed_pull_history SET
         status = 'success', records_ingested = ?, records_rejected = ?,
         duration_ms = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(result.itemsNew, result.itemsDuplicate + result.itemsError, durationMs, pullId).run();

    // Ensure feed_status row exists (INSERT OR IGNORE), then update
    await env.DB.prepare(
      "INSERT OR IGNORE INTO feed_status (feed_name, health_status) VALUES (?, 'healthy')"
    ).bind(config.feed_name).run();

    // Update feed_status: only set healthy if records were ingested, clear error
    const statusUpdate = await env.DB.prepare(
      `UPDATE feed_status SET
         last_successful_pull = datetime('now'),
         records_ingested_today = records_ingested_today + ?,
         health_status = CASE WHEN ? > 0 THEN 'healthy' ELSE health_status END,
         last_error = NULL
       WHERE feed_name = ?`
    ).bind(result.itemsNew, result.itemsFetched, config.feed_name).run();

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

    // Update feed_status to degraded with error message
    await env.DB.prepare(
      `UPDATE feed_status SET
         last_failure = datetime('now'),
         health_status = 'degraded',
         last_error = ?
       WHERE feed_name = ?`
    ).bind(errorMsg.slice(0, 500), config.feed_name).run();

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
  const configs = await env.DB.prepare(
    "SELECT * FROM feed_configs WHERE enabled = 1"
  ).all<FeedConfigRow>();

  // Fetch feed status for last-run checks
  const statuses = await env.DB.prepare(
    "SELECT * FROM feed_status"
  ).all<FeedStatusRow>();
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
      feedsSkipped++;
      continue;
    }

    const status = statusMap.get(config.feed_name);
    const shouldRun = shouldRunNow(config, status, now);
    if (!shouldRun) {
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

    toRun.push({ config, mod });
  }

  // Run all eligible feeds concurrently
  const results = await Promise.allSettled(
    toRun.map(({ config, mod }) => runFeed(env, config, mod))
  );

  for (const [i, r] of results.entries()) {
    const name = toRun[i]!.config.feed_name;
    feedsRun++;
    if (r.status === "fulfilled") {
      totalNew += r.value.itemsNew;
    } else {
      feedsFailed++;
      console.error(`[feedRunner] ${name}: REJECTED — ${r.reason}`);
    }
  }

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

  // 60s tolerance: cron triggers may fire slightly before the exact interval boundary
  return now.getTime() - lastRun >= intervalMs - 60_000;
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

// ─── Run Enrichment Feeds (after ingest) ────────────────────────

/**
 * Run enrichment feeds — these enrich existing threats rather than ingesting new ones.
 * Called AFTER runAllFeeds so enrichment operates on freshly ingested data.
 */
export async function runAllEnrichmentFeeds(
  env: Env,
  enrichmentModules: Record<string, FeedModule>,
): Promise<{
  feedsRun: number;
  feedsSkipped: number;
  feedsFailed: number;
  totalEnriched: number;
}> {
  let feedsRun = 0;
  let feedsSkipped = 0;
  let feedsFailed = 0;
  let totalEnriched = 0;

  // Try to load enrichment configs from feed_configs table.
  // Fall back to running all registered enrichment modules directly if the query
  // fails (e.g. feed_type column doesn't exist) or returns no rows.
  let configs: { results: FeedConfigRow[] } = { results: [] };
  try {
    configs = await env.DB.prepare(
      "SELECT * FROM feed_configs WHERE enabled = 1 AND feed_type = 'enrichment'"
    ).all<FeedConfigRow>();
  } catch {
    // feed_type column likely doesn't exist — fall through to direct execution
  }

  if (configs.results.length > 0) {
    // Config-driven mode: use feed_configs for scheduling
    const statuses = await env.DB.prepare(
      "SELECT * FROM feed_status"
    ).all<FeedStatusRow>();
    const statusMap = new Map(statuses.results.map(s => [s.feed_name, s]));

    const now = new Date();
    const toRun: Array<{ config: FeedConfigRow; mod: FeedModule }> = [];

    for (const config of configs.results) {
      const mod = enrichmentModules[config.feed_name];
      if (!mod) {
        feedsSkipped++;
        continue;
      }

      const status = statusMap.get(config.feed_name);
      const shouldRun = shouldRunNow(config, status, now);
      if (!shouldRun) {
        feedsSkipped++;
        continue;
      }

      toRun.push({ config, mod });
    }

    // Run enrichment feeds sequentially to respect rate limits
    for (const { config, mod } of toRun) {
      feedsRun++;
      try {
        const result = await runFeed(env, config, mod);
        totalEnriched += result.itemsNew;
      } catch {
        feedsFailed++;
      }
    }
  } else {
    // Direct mode: no feed_configs rows for enrichment — run all registered modules
    console.log("[enrichment] no feed_configs rows found for enrichment feeds, running all registered modules directly");
    for (const [name, mod] of Object.entries(enrichmentModules)) {
      feedsRun++;
      const ctx: FeedContext = { env, feedName: name, feedUrl: "" };
      try {
        const result = await mod.ingest(ctx);
        totalEnriched += result.itemsNew;
        console.log(`[enrichment] ${name}: fetched=${result.itemsFetched} new=${result.itemsNew} errors=${result.itemsError}`);
      } catch (err) {
        feedsFailed++;
        console.error(`[enrichment] ${name} failed:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  return { feedsRun, feedsSkipped, feedsFailed, totalEnriched };
}

// ─── Reset daily counters (called at start of day) ───────────────

export async function resetDailyCounters(db: D1Database): Promise<void> {
  await db.prepare("UPDATE feed_status SET records_ingested_today = 0").run();
}
