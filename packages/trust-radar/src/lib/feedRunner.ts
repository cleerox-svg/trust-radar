/**
 * Feed Runner — Central orchestrator for intelligence feed ingestion.
 *
 * Features:
 * - Tiered priority scheduling (Tier 1 runs first)
 * - Circuit-breaker per feed (opens after 3 consecutive failures, auto-resets after 30 min)
 * - IOC deduplication via KV cache
 * - Per-feed execution logging to feed_ingestions table
 * - Batch job tracking via ingestion_jobs table
 */

import type { Env } from "../types";
import type { FeedModule, FeedContext, FeedResult, ThreatRow } from "../feeds/types";
import { enrichThreatsGeo } from "./geoip";
import { runEnrichmentChain } from "../enrichment";

const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 30 * 60 * 1000; // 30 minutes

// ─── Feed-level API quota tracking (KV-backed, per UTC day) ─────

function feedQuotaKey(feedName: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `feed-quota:${feedName}:${today}`;
}

/** Returns how many API calls a feed has made today. */
export async function getFeedCallsToday(env: Env, feedName: string): Promise<number> {
  try {
    const val = await env.CACHE.get(feedQuotaKey(feedName));
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

/** Increment today's call counter for a feed. */
export async function recordFeedApiCall(env: Env, feedName: string): Promise<void> {
  try {
    const key = feedQuotaKey(feedName);
    const val = await env.CACHE.get(key);
    const next = (val ? parseInt(val, 10) : 0) + 1;
    await env.CACHE.put(key, String(next), { expirationTtl: 25 * 60 * 60 }); // 25h TTL covers full UTC day
  } catch { /* non-fatal */ }
}

/**
 * Pin the counter to the daily_limit so all subsequent feed runs today
 * can check and short-circuit before making any API calls.
 */
export async function markFeedQuotaExhausted(env: Env, feedName: string, dailyLimit: number): Promise<void> {
  try {
    await env.CACHE.put(feedQuotaKey(feedName), String(dailyLimit), { expirationTtl: 25 * 60 * 60 });
  } catch { /* non-fatal */ }
}

// ─── Deduplication ───────────────────────────────────────────────

/** Check if an IOC was already seen (KV-based, 24h TTL) */
export async function isDuplicate(env: Env, iocType: string, iocValue: string): Promise<boolean> {
  const key = `dedup:${iocType}:${iocValue}`;
  const existing = await env.CACHE.get(key);
  return existing !== null;
}

/** Mark an IOC as seen */
export async function markSeen(env: Env, iocType: string, iocValue: string): Promise<void> {
  const key = `dedup:${iocType}:${iocValue}`;
  await env.CACHE.put(key, "1", { expirationTtl: 86400 }); // 24h
}

// ─── Circuit Breaker ─────────────────────────────────────────────

interface FeedScheduleRow {
  id: string;
  feed_name: string;
  display_name: string;
  tier: number;
  url: string;
  method: string;
  headers: string;
  interval_mins: number;
  enabled: number;
  requires_key: number;
  api_key_env: string | null;
  api_key_encrypted: string | null;
  parser: string;
  last_run_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
  circuit_open: number;
  circuit_opened_at: string | null;
}

async function shouldRun(schedule: FeedScheduleRow, now: Date): Promise<{ run: boolean; reason?: string }> {
  if (!schedule.enabled) return { run: false, reason: "disabled" };

  // Circuit breaker check
  if (schedule.circuit_open) {
    if (schedule.circuit_opened_at) {
      const openedAt = new Date(schedule.circuit_opened_at).getTime();
      if (now.getTime() - openedAt < CIRCUIT_RESET_MS) {
        return { run: false, reason: "circuit_open" };
      }
      // Auto-reset: enough time has passed
    }
  }

  // Interval check
  if (schedule.last_run_at) {
    const lastRun = new Date(schedule.last_run_at).getTime();
    const intervalMs = schedule.interval_mins * 60 * 1000;
    if (now.getTime() - lastRun < intervalMs) {
      return { run: false, reason: "interval_not_elapsed" };
    }
  }

  return { run: true };
}

async function openCircuit(db: D1Database, feedId: string): Promise<void> {
  await db.prepare(
    `UPDATE feed_schedules SET circuit_open = 1, circuit_opened_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).bind(feedId).run();
}

async function resetCircuit(db: D1Database, feedId: string): Promise<void> {
  await db.prepare(
    `UPDATE feed_schedules SET circuit_open = 0, circuit_opened_at = NULL, consecutive_failures = 0, updated_at = datetime('now') WHERE id = ?`
  ).bind(feedId).run();
}

async function recordFailure(db: D1Database, feedId: string, error: string): Promise<number> {
  await db.prepare(
    `UPDATE feed_schedules SET
       consecutive_failures = consecutive_failures + 1,
       last_run_at = datetime('now'),
       last_error = ?,
       last_items_new = 0,
       total_runs = total_runs + 1,
       updated_at = datetime('now')
     WHERE id = ?`
  ).bind(error, feedId).run();

  const row = await db.prepare("SELECT consecutive_failures FROM feed_schedules WHERE id = ?")
    .bind(feedId).first<{ consecutive_failures: number }>();
  return row?.consecutive_failures ?? 0;
}

async function recordSuccess(db: D1Database, feedId: string, itemCount: number): Promise<void> {
  await db.prepare(
    `UPDATE feed_schedules SET
       consecutive_failures = 0,
       circuit_open = 0,
       circuit_opened_at = NULL,
       last_run_at = datetime('now'),
       last_success_at = datetime('now'),
       last_error = NULL,
       last_items_new = ?,
       total_runs = total_runs + 1,
       total_items = total_items + ?,
       updated_at = datetime('now')
     WHERE id = ?`
  ).bind(itemCount, itemCount, feedId).run();
}

// ─── Threat Insertion ────────────────────────────────────────────

export async function insertThreat(db: D1Database, threat: ThreatRow): Promise<void> {
  await db.prepare(
    `INSERT OR IGNORE INTO threats (id, type, title, description, severity, confidence, status, source, source_ref,
       ioc_type, ioc_value, domain, url, ip_address, country_code, tags, metadata, first_seen, last_seen, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`
  ).bind(
    threat.id, threat.type, threat.title, threat.description ?? null,
    threat.severity, threat.confidence, threat.source, threat.source_ref ?? null,
    threat.ioc_type ?? null, threat.ioc_value ?? null, threat.domain ?? null,
    threat.url ?? null, threat.ip_address ?? null, threat.country_code ?? null,
    JSON.stringify(threat.tags ?? []), JSON.stringify(threat.metadata ?? {}),
    threat.created_by ?? threat.source
  ).run();
}

// ─── Feed Execution ──────────────────────────────────────────────

export async function runFeed(
  env: Env,
  schedule: FeedScheduleRow,
  feedModule: FeedModule,
): Promise<FeedResult> {
  const ingestionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Create ingestion log entry
  await env.DB.prepare(
    `INSERT INTO feed_ingestions (id, feed_id, feed_name, status, started_at) VALUES (?, ?, ?, 'running', ?)`
  ).bind(ingestionId, schedule.id, schedule.feed_name, startedAt).run();

  const ctx: FeedContext = {
    env,
    feedId: schedule.id,
    feedName: schedule.feed_name,
    feedUrl: schedule.url,
    method: schedule.method,
    headers: safeParseJSON(schedule.headers, {}),
    parser: schedule.parser,
    apiKey: (schedule.api_key_env && getApiKey(env, schedule.api_key_env))
      ?? schedule.api_key_encrypted
      ?? undefined,
  };

  const start = Date.now();

  try {
    const result = await feedModule.ingest(ctx);
    const durationMs = Date.now() - start;

    // Log success
    await env.DB.prepare(
      `UPDATE feed_ingestions SET
         status = 'success', items_fetched = ?, items_new = ?, items_duplicate = ?, items_error = ?,
         threats_created = ?, duration_ms = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(
      result.itemsFetched, result.itemsNew, result.itemsDuplicate, result.itemsError,
      result.threatsCreated, durationMs, ingestionId
    ).run();

    await recordSuccess(env.DB, schedule.id, result.itemsNew);
    if (schedule.circuit_open) await resetCircuit(env.DB, schedule.id);

    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Log failure
    await env.DB.prepare(
      `UPDATE feed_ingestions SET status = 'failed', error = ?, duration_ms = ?, completed_at = datetime('now') WHERE id = ?`
    ).bind(errorMsg, durationMs, ingestionId).run();

    const failures = await recordFailure(env.DB, schedule.id, errorMsg);
    if (failures >= CIRCUIT_THRESHOLD) {
      await openCircuit(env.DB, schedule.id);
    }

    return { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0, threatsCreated: 0, error: errorMsg };
  }
}

// ─── Coordinator ─────────────────────────────────────────────────

/** Run all eligible feeds, ordered by tier priority */
export async function runAllFeeds(env: Env, feedModules: Record<string, FeedModule>): Promise<{
  jobId: string;
  feedsRun: number;
  feedsSkipped: number;
  feedsFailed: number;
  totalNew: number;
}> {
  const jobId = crypto.randomUUID();
  const now = new Date();

  // Create batch job
  const schedules = await env.DB.prepare(
    "SELECT * FROM feed_schedules WHERE enabled = 1 ORDER BY tier ASC, feed_name ASC"
  ).all<FeedScheduleRow>();

  const total = schedules.results.length;
  await env.DB.prepare(
    `INSERT INTO ingestion_jobs (id, job_type, status, feeds_total, triggered_by, started_at) VALUES (?, 'full_ingest', 'running', ?, 'cron', datetime('now'))`
  ).bind(jobId, total).run();

  let feedsRun = 0;
  let feedsSkipped = 0;
  let feedsFailed = 0;
  let totalNew = 0;

  // Group by tier so feeds within each tier run concurrently
  const byTier = new Map<number, FeedScheduleRow[]>();
  for (const s of schedules.results) {
    const arr = byTier.get(s.tier) ?? [];
    arr.push(s);
    byTier.set(s.tier, arr);
  }

  const tiers = [...byTier.keys()].sort((a, b) => a - b);

  for (const tier of tiers) {
    const tierSchedules = byTier.get(tier)!;

    // Eligibility checks (shouldRun is pure date logic — safe to fan out)
    const checks = await Promise.all(tierSchedules.map(s => shouldRun(s, now)));

    const toRun: Array<{ schedule: FeedScheduleRow; mod: FeedModule }> = [];
    for (const [i, schedule] of tierSchedules.entries()) {
      if (!checks[i]?.run) { feedsSkipped++; continue; }
      const mod = feedModules[schedule.feed_name];
      if (!mod) { feedsSkipped++; continue; }
      toRun.push({ schedule, mod });
    }

    // Run all eligible feeds in this tier concurrently
    const results = await Promise.allSettled(
      toRun.map(({ schedule, mod }) => runFeed(env, schedule, mod))
    );

    for (const r of results) {
      feedsRun++;
      if (r.status === "fulfilled") {
        totalNew += r.value.itemsNew;
        if (r.value.error) feedsFailed++;
      } else {
        feedsFailed++;
      }
    }
  }

  // Post-ingestion enrichment chain
  if (totalNew > 0) {
    try {
      const geo = await enrichThreatsGeo(env.DB);
      console.log(`[geoip] enriched ${geo.enriched}/${geo.total} threats with geo/lat/lng`);
    } catch (err) {
      console.error("[geoip] enrichment failed:", err);
    }
  }
  // Shodan, RDAP, DNS enrichers run every cycle — they use metadata flags to
  // skip already-enriched threats, so this efficiently catches any backlog too.
  await runEnrichmentChain(env.DB, env);

  // Update job
  const status = feedsFailed === feedsRun ? "failed" : feedsFailed > 0 ? "partial" : "success";
  await env.DB.prepare(
    `UPDATE ingestion_jobs SET status = ?, feeds_complete = ?, feeds_failed = ?, total_items = ?, total_new = ?, completed_at = datetime('now') WHERE id = ?`
  ).bind(status, feedsRun, feedsFailed, totalNew, totalNew, jobId).run();

  return { jobId, feedsRun, feedsSkipped, feedsFailed, totalNew };
}

/** Run feeds for a specific tier only */
export async function runTier(env: Env, tier: number, feedModules: Record<string, FeedModule>): Promise<{
  feedsRun: number;
  totalNew: number;
}> {
  const now = new Date();
  const schedules = await env.DB.prepare(
    "SELECT * FROM feed_schedules WHERE enabled = 1 AND tier = ? ORDER BY feed_name ASC"
  ).bind(tier).all<FeedScheduleRow>();

  let feedsRun = 0;
  let totalNew = 0;

  const checks = await Promise.all(schedules.results.map(s => shouldRun(s, now)));
  const toRun = schedules.results
    .filter((_, i) => checks[i]?.run)
    .flatMap(s => {
      const mod = feedModules[s.feed_name];
      return mod ? [{ schedule: s, mod }] : [];
    });

  const results = await Promise.allSettled(
    toRun.map(({ schedule, mod }) => runFeed(env, schedule, mod))
  );

  for (const r of results) {
    feedsRun++;
    if (r.status === "fulfilled") totalNew += r.value.itemsNew;
  }

  return { feedsRun, totalNew };
}

// ─── Helpers ─────────────────────────────────────────────────────

function safeParseJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function getApiKey(env: Env, envVar: string): string | undefined {
  return (env as unknown as Record<string, string>)[envVar] ?? undefined;
}
