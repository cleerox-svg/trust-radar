// Fast Tick — lightweight cron handler for the every-5-min schedule.
//
// Cloudflare sub-hour crons have a 30-second CPU ceiling. This handler
// must stay LEAN: no agent execution, no Haiku calls, no Flight Control.
//
// Current responsibilities:
//   1. Drain pending agent_events (mark done, no routing — just housekeeping)
//   2. Run one DNS backfill batch (200 domains, 8s soft cap)
//   3. Refresh the three OLAP cubes (geo + provider + brand) for the current
//      and previous UTC hour — catches retroactive cartographer enrichment
//      and keeps Observatory aggregates in sync with raw threats.
//
// Budget: ~15s typical (DNS 13-18s + cube <1s), well under the 30s hard ceiling.

import type { Env } from '../types';
import { runDomainGeoBackfillBatch } from '../lib/dns-backfill';
import { buildGeoCubeForHour, buildProviderCubeForHour, buildBrandCubeForHour } from '../lib/cube-builder';
import type { CubeBuildResult } from '../lib/cube-builder';
import { handleObservatoryNodes, handleObservatoryArcs, handleObservatoryStats, handleObservatoryLive, handleObservatoryOperations } from '../handlers/observatory';
import { handleDashboardOverview } from '../handlers/dashboard';
import { handleListAgents } from '../handlers/agents';
import { handleListOperations, handleOperationsStats } from '../handlers/operations';

/** How many agent_events to drain per tick. */
const EVENT_DRAIN_LIMIT = 50;

/** Default DNS batch size — conservative for 30s ceiling. */
const DNS_BATCH_SIZE = 200;

/**
 * Fast-tick-wide soft cap (ms). If we've spent this long across all phases,
 * skip any remaining cube refresh work. Leaves ~5s headroom under the 30s
 * Cloudflare sub-hour cron hard ceiling for the final agent_runs INSERT.
 */
const FAST_TICK_SOFT_CAP_MS = 25_000;

/**
 * Format a Date as a 'YYYY-MM-DD HH:00:00' UTC hour bucket string, the exact
 * format cube-builder.ts expects. Uses getUTC* explicitly — D1's datetime('now')
 * and all stored created_at timestamps are UTC, so a local-time mismatch here
 * would bucket cube rows into the wrong hour.
 */
function formatHourBucketUTC(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hour = String(d.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:00:00`;
}

export async function runFastTick(
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const start = Date.now();
  const isOverCap = () => Date.now() - start > FAST_TICK_SOFT_CAP_MS;
  console.log(`[fast-tick] start ${new Date().toISOString()}`);

  let eventsDrained = 0;
  let dnsResult = { processed: 0, resolved: 0, enriched: 0, durationMs: 0, softCapHit: false };
  let status: 'success' | 'partial' | 'failed' = 'success';
  let errorMessage: string | undefined;

  try {
    // ── 1. Drain stale pending agent_events ──
    // The hourly tick's processAgentEvents does full routing + execution.
    // Here we only mark old pending events as 'done' so they don't pile up
    // between hourly ticks. Events younger than 5 min are left for the
    // hourly tick to route properly.
    try {
      const stale = await env.DB.prepare(`
        UPDATE agent_events
        SET status = 'done', processed_at = datetime('now')
        WHERE status = 'pending'
          AND created_at <= datetime('now', '-5 minutes')
        LIMIT ?
      `).bind(EVENT_DRAIN_LIMIT).run();
      // D1 .run() returns meta with changes count
      eventsDrained = stale.meta?.changes ?? 0;
      if (eventsDrained > 0) {
        console.log(`[fast-tick] drained ${eventsDrained} stale agent_events`);
      }
    } catch (err) {
      console.error('[fast-tick] event drain error:', err);
      // Non-fatal — continue to DNS backfill
    }

    // ── 2. DNS backfill batch ──
    dnsResult = await runDomainGeoBackfillBatch(env, {
      batchSize: DNS_BATCH_SIZE,
      timeoutMs: 8000,
    });

    console.log(
      `[fast-tick] dns-backfill: processed=${dnsResult.processed} resolved=${dnsResult.resolved} enriched=${dnsResult.enriched} softCapHit=${dnsResult.softCapHit} duration=${dnsResult.durationMs}ms`,
    );

    if (dnsResult.softCapHit || dnsResult.enriched < dnsResult.resolved) {
      status = 'partial';
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[fast-tick] fatal error:', errorMessage);
  }

  // ── 3. Cube refresh ──
  // Rebuild current hour + previous hour for both cubes. Previous-hour rebuild
  // catches cartographer's retroactive lat/lng enrichment so cube aggregates
  // don't drift from raw threats. Hours further back are left alone — the
  // admin backfill endpoint handles historical rebuilds.
  //
  // cube-builder functions catch their own errors and return {error} results;
  // the outer try is purely defensive. A cube failure never fails fast_tick
  // overall — it just downgrades status from 'success' to 'partial'.
  const cubeResults: {
    currentHour: { geo: CubeBuildResult | null; provider: CubeBuildResult | null; brand: CubeBuildResult | null };
    prevHour: { geo: CubeBuildResult | null; provider: CubeBuildResult | null; brand: CubeBuildResult | null };
    totalRows: number;
    totalMs: number;
    errors: string[];
  } = {
    currentHour: { geo: null, provider: null, brand: null },
    prevHour: { geo: null, provider: null, brand: null },
    totalRows: 0,
    totalMs: 0,
    errors: [],
  };

  if (status !== 'failed') {
    try {
      if (!isOverCap()) {
        const currentHourBucket = formatHourBucketUTC(new Date());
        const prevHourBucket = formatHourBucketUTC(new Date(Date.now() - 60 * 60 * 1000));

        // Current hour — geo
        if (!isOverCap()) {
          const r = await buildGeoCubeForHour(env, currentHourBucket);
          cubeResults.currentHour.geo = r;
          cubeResults.totalMs += r.durationMs;
          if (r.error) cubeResults.errors.push(`geo ${currentHourBucket}: ${r.error}`);
          else cubeResults.totalRows += r.rowsWritten;
        }
        // Current hour — provider
        if (!isOverCap()) {
          const r = await buildProviderCubeForHour(env, currentHourBucket);
          cubeResults.currentHour.provider = r;
          cubeResults.totalMs += r.durationMs;
          if (r.error) cubeResults.errors.push(`provider ${currentHourBucket}: ${r.error}`);
          else cubeResults.totalRows += r.rowsWritten;
        }
        // Current hour — brand
        if (!isOverCap()) {
          const r = await buildBrandCubeForHour(env, currentHourBucket);
          cubeResults.currentHour.brand = r;
          cubeResults.totalMs += r.durationMs;
          if (r.error) cubeResults.errors.push(`brand ${currentHourBucket}: ${r.error}`);
          else cubeResults.totalRows += r.rowsWritten;
        }
        // Previous hour — geo
        if (!isOverCap()) {
          const r = await buildGeoCubeForHour(env, prevHourBucket);
          cubeResults.prevHour.geo = r;
          cubeResults.totalMs += r.durationMs;
          if (r.error) cubeResults.errors.push(`geo ${prevHourBucket}: ${r.error}`);
          else cubeResults.totalRows += r.rowsWritten;
        }
        // Previous hour — provider
        if (!isOverCap()) {
          const r = await buildProviderCubeForHour(env, prevHourBucket);
          cubeResults.prevHour.provider = r;
          cubeResults.totalMs += r.durationMs;
          if (r.error) cubeResults.errors.push(`provider ${prevHourBucket}: ${r.error}`);
          else cubeResults.totalRows += r.rowsWritten;
        }
        // Previous hour — brand
        if (!isOverCap()) {
          const r = await buildBrandCubeForHour(env, prevHourBucket);
          cubeResults.prevHour.brand = r;
          cubeResults.totalMs += r.durationMs;
          if (r.error) cubeResults.errors.push(`brand ${prevHourBucket}: ${r.error}`);
          else cubeResults.totalRows += r.rowsWritten;
        }
      } else {
        cubeResults.errors.push('skipped: over soft cap from DNS phase');
      }
    } catch (e) {
      // Defensive: cube-builder functions shouldn't throw, but if they do,
      // log and continue — cube failures never fail fast_tick overall.
      cubeResults.errors.push(`fatal: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Cube errors downgrade to 'partial' but never to 'failed'.
    if (cubeResults.errors.length > 0 && status === 'success') {
      status = 'partial';
    }
  }

  // ── 4. Cache pre-warming ──
  // Call handler functions with synthetic requests to populate KV caches.
  // Each handler checks KV (miss on first call after TTL), runs DB queries,
  // stores result in KV, returns response (discarded here). Next real user
  // request hits warm KV cache instead of cold DB queries.
  //
  // Targets: Observatory (nodes, arcs, stats, live, operations) + dashboard
  // overview + agents list + operations list/stats. These cover the 8 requests
  // Observatory fires on mount and the heaviest page-load queries.
  let cacheWarmed = 0;
  if (!isOverCap() && status !== 'failed') {
    const warmStart = Date.now();
    const fakeReq = (path: string) => new Request(`https://averrow.com${path}`);
    try {
      // Phase A: Observatory endpoints (highest impact — 10-15s cold load)
      // Run the 5 Observatory queries in parallel for maximum throughput.
      const obsResults = await Promise.allSettled([
        handleObservatoryNodes(fakeReq('/api/observatory/nodes?period=7d'), env),
        handleObservatoryArcs(fakeReq('/api/observatory/arcs?period=7d&limit=50'), env),
        handleObservatoryStats(fakeReq('/api/observatory/stats?period=7d'), env),
        handleObservatoryLive(fakeReq('/api/observatory/live?limit=20'), env),
        handleObservatoryOperations(fakeReq('/api/observatory/operations?limit=5'), env),
      ]);
      cacheWarmed += obsResults.filter(r => r.status === 'fulfilled').length;

      // Phase B: Other heavy pages (if still under cap)
      if (!isOverCap()) {
        const pageResults = await Promise.allSettled([
          handleDashboardOverview(fakeReq('/api/dashboard/overview'), env),
          handleListAgents(fakeReq('/api/agents'), env),
          handleListOperations(fakeReq('/api/v1/operations'), env),
          handleOperationsStats(fakeReq('/api/v1/operations/stats'), env),
        ]);
        cacheWarmed += pageResults.filter(r => r.status === 'fulfilled').length;
      }

      console.log(`[fast-tick] cache-warm: ${cacheWarmed} endpoints warmed in ${Date.now() - warmStart}ms`);
    } catch (e) {
      console.error('[fast-tick] cache-warm error:', e instanceof Error ? e.message : String(e));
    }
  }

  // ── 5. Log to agent_runs ──
  const durationMs = Date.now() - start;

  // Concatenate DNS + cube errors into error_message so they surface in the
  // agent_runs table without a schema change.
  const errorParts: string[] = [];
  if (errorMessage) errorParts.push(`dns: ${errorMessage}`);
  if (cubeResults.errors.length > 0) {
    errorParts.push(`cube: ${cubeResults.errors.join('; ')}`);
  }
  const finalErrorMessage = errorParts.length > 0 ? errorParts.join(' | ') : null;
  try {
    await env.DB.prepare(`
      INSERT INTO agent_runs (id, agent_id, started_at, completed_at, duration_ms, status, records_processed, error_message)
      VALUES (?, 'fast_tick', datetime('now', '-' || ? || ' seconds'), datetime('now'), ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      Math.round(durationMs / 1000),
      durationMs,
      status,
      // records_processed stays as the DNS enrichment count (primary metric);
      // cube row counts live in the log line and error_message field.
      dnsResult.enriched + eventsDrained,
      finalErrorMessage,
    ).run();
  } catch (err) {
    console.error('[fast-tick] agent_runs insert failed:', err);
  }

  console.log(
    `[fast-tick] done status=${status} events_drained=${eventsDrained} processed=${dnsResult.processed} resolved=${dnsResult.resolved} enriched=${dnsResult.enriched} cube_rows=${cubeResults.totalRows} cube_ms=${cubeResults.totalMs} cube_errors=${cubeResults.errors.length} cache_warmed=${cacheWarmed} softCapHit=${dnsResult.softCapHit} duration=${durationMs}ms`,
  );
}
