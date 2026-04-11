// Fast Tick — lightweight cron handler for the every-5-min schedule.
//
// Cloudflare sub-hour crons have a 30-second CPU ceiling. This handler
// must stay LEAN: no agent execution, no Haiku calls, no Flight Control.
//
// Current responsibilities:
//   1. Drain pending agent_events (mark done, no routing — just housekeeping)
//   2. Run one DNS backfill batch (200 domains, 8s soft cap)
//
// Budget: ~10s total, well under the 30s hard ceiling.

import type { Env } from '../types';
import { runDomainGeoBackfillBatch } from '../lib/dns-backfill';

/** How many agent_events to drain per tick. */
const EVENT_DRAIN_LIMIT = 50;

/** Default DNS batch size — conservative for 30s ceiling. */
const DNS_BATCH_SIZE = 200;

export async function runFastTick(
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const start = Date.now();
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

  // ── 3. Log to agent_runs ──
  const durationMs = Date.now() - start;
  try {
    await env.DB.prepare(`
      INSERT INTO agent_runs (id, agent_id, started_at, completed_at, duration_ms, status, records_processed, error_message)
      VALUES (?, 'fast_tick', datetime('now', '-' || ? || ' seconds'), datetime('now'), ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      Math.round(durationMs / 1000),
      durationMs,
      status,
      dnsResult.enriched + eventsDrained,
      errorMessage ?? null,
    ).run();
  } catch (err) {
    console.error('[fast-tick] agent_runs insert failed:', err);
  }

  console.log(
    `[fast-tick] done status=${status} events_drained=${eventsDrained} dns_resolved=${dnsResult.resolved} duration=${durationMs}ms`,
  );
}
