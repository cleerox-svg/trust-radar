/**
 * Enricher — dedicated, observable, self-healing enrichment runner.
 *
 * Owns three jobs that previously lived inline inside runThreatFeedScan
 * (domain geo) and runObserverBriefing (brand logo/HQ + sector/RDAP).
 * Pulling them out fixes three problems:
 *
 *   1. They were coupled to feed ingestion / observer success, so a
 *      single feed failure could starve enrichment for a whole tick.
 *   2. They never reached agent_activity_log — Flight Control could
 *      see the backlogs but had no idea whether anything was running.
 *   3. They had no per-job duration tracking, so it was impossible to
 *      tell from outside whether a job was slow vs. silently broken.
 *
 * Each job here:
 *   - Calls its underlying admin handler with a synthetic Request.
 *   - Records start, processed/enriched counts, and duration to
 *     agent_activity_log under agent_id='enricher'.
 *   - Catches its own errors and never throws upstream — one bad job
 *     must not poison the rest of the chain.
 */

import type { Env } from '../types';
import {
  handleBackfillDomainGeo,
  handleBackfillBrandEnrichment,
  handleBackfillBrandSector,
} from '../handlers/admin';

type EnricherJob = 'domain_geo' | 'brand_logo_hq' | 'brand_sector_rdap';

async function logEnricherEvent(
  env: Env,
  job: EnricherJob,
  severity: 'info' | 'warning' | 'critical',
  message: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO agent_activity_log (id, agent_id, event_type, message, metadata_json, severity, created_at)
      VALUES (?, 'enricher', ?, ?, ?, ?, datetime('now'))
    `).bind(
      crypto.randomUUID(),
      `enricher_${job}`,
      message,
      JSON.stringify(metadata),
      severity,
    ).run();
  } catch {
    /* logging must never break the run */
  }
}

interface EnricherJobResult {
  ok: boolean;
  processed: number;
  enriched: number;
  durationMs: number;
}

async function runJob(
  env: Env,
  job: EnricherJob,
  handler: (req: Request, env: Env) => Promise<Response>,
  path: string,
): Promise<EnricherJobResult> {
  const start = Date.now();
  try {
    const req = new Request(`https://localhost${path}`, { method: 'POST' });
    const res = await handler(req, env);
    const json = (await res.json()) as {
      success: boolean;
      data?: {
        processed?: number;
        enriched?: number;
        resolved?: number;
        classified?: number;
        remaining?: number;
      };
      error?: string;
    };
    const durationMs = Date.now() - start;

    if (!json.success) {
      await logEnricherEvent(
        env,
        job,
        'critical',
        `enricher.${job} failed: ${json.error ?? 'unknown'}`,
        { durationMs, error: json.error },
      );
      return { ok: false, processed: 0, enriched: 0, durationMs };
    }

    const processed = json.data?.processed ?? 0;
    // Each handler reports its "useful work" count under a different
    // key — coalesce them all so we always log a comparable number.
    const enriched =
      json.data?.enriched ??
      json.data?.resolved ??
      json.data?.classified ??
      0;
    const remaining = json.data?.remaining ?? null;

    await logEnricherEvent(
      env,
      job,
      'info',
      `enricher.${job} processed=${processed} enriched=${enriched} remaining=${remaining ?? '?'} (${durationMs}ms)`,
      { processed, enriched, remaining, durationMs },
    );

    return { ok: true, processed, enriched, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await logEnricherEvent(env, job, 'critical', `enricher.${job} threw: ${msg}`, {
      durationMs,
      error: msg,
    });
    return { ok: false, processed: 0, enriched: 0, durationMs };
  }
}

/**
 * Run all three enrichment jobs in order. Order matters:
 *   1. domain_geo runs first — biggest backlog, cheapest per-row work
 *      (single DoH lookup + bulk DB update).
 *   2. brand_logo_hq runs next — Clearbit HEAD + DNS + ipinfo lookup.
 *   3. brand_sector_rdap runs last — most expensive (Haiku call + RDAP),
 *      so if we run out of subrequests it's the cheapest job to skip.
 *
 * Each job is fully isolated. A failure in one never blocks the next.
 */
export async function runEnricher(env: Env): Promise<void> {
  await runJob(
    env,
    'domain_geo',
    handleBackfillDomainGeo,
    '/api/admin/backfill-domain-geo',
  );
  await runJob(
    env,
    'brand_logo_hq',
    handleBackfillBrandEnrichment,
    '/api/admin/backfill-brand-enrichment',
  );
  await runJob(
    env,
    'brand_sector_rdap',
    handleBackfillBrandSector,
    '/api/admin/backfill-brand-sector',
  );
}
