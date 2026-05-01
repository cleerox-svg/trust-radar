/**
 * Enricher — dedicated, observable enrichment runner.
 *
 * Owns three jobs that previously lived inline inside runThreatFeedScan
 * (domain geo) and runObserverBriefing (brand logo/HQ + sector/RDAP).
 * Pulling them out:
 *   1. Decouples enrichment from feed-ingest / observer success — a
 *      feed failure no longer starves enrichment for a whole tick.
 *   2. Gives Flight Control visibility into whether enrichment ran.
 *   3. Tracks per-job duration so a slow job is distinguishable from
 *      one that silently broke.
 *
 * Phase 2.5 of agent audit: enricher previously wrote per-job rows to
 * `agent_activity_log` under `agent_id='enricher'` — a different table
 * than every other agent's `agent_runs`. That made it the only truly
 * hidden agent on the Agents page (the audit's §4 finding). Migrated to
 * the standard AgentModule + executeAgent() pattern per AGENT_STANDARD
 * §3-4: cumulative run lifecycle goes to agent_runs via the runner;
 * per-job results surface as agent_outputs (severity='high' on
 * failure, 'info' on success) so operators see the per-job detail
 * through the standard UI channel instead of a separate log table.
 */

import type { Env } from '../types';
import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from '../lib/agentRunner';
import {
  handleBackfillDomainGeo,
  handleBackfillBrandEnrichment,
  handleBackfillBrandSector,
} from '../handlers/admin';

type EnricherJob = 'domain_geo' | 'brand_logo_hq' | 'brand_sector_rdap';

interface EnricherJobResult {
  job: EnricherJob;
  ok: boolean;
  processed: number;
  enriched: number;
  durationMs: number;
  error: string | null;
}

async function runEnricherJob(
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
      return {
        job,
        ok: false,
        processed: 0,
        enriched: 0,
        durationMs,
        error: json.error ?? 'unknown',
      };
    }

    const processed = json.data?.processed ?? 0;
    // Each handler reports its "useful work" count under a different
    // key — coalesce so we always log a comparable number.
    const enriched =
      json.data?.enriched ??
      json.data?.resolved ??
      json.data?.classified ??
      0;
    return { job, ok: true, processed, enriched, durationMs, error: null };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      job,
      ok: false,
      processed: 0,
      enriched: 0,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Agent module ───────────────────────────────────────────────

export const enricherAgent: AgentModule = {
  name: 'enricher',
  displayName: 'Enricher',
  description: 'Domain geo, brand logo/HQ, and brand sector/RDAP enrichment — runs every hourly tick',
  color: '#22D3EE',
  trigger: 'scheduled',
  requiresApproval: false,
  stallThresholdMinutes: 30,
  parallelMax: 1,
  // Enricher's brand_sector_rdap step DOES make Haiku calls via
  // brand-enricher's classifySector — but those land under the
  // brand_enricher sync-agent attribution (via runSyncAgent in
  // handleBackfillBrandSector). The Enricher's direct AI surface
  // is zero, so cost guard is exempt at the orchestrator layer.
  costGuard: 'exempt',
  // No AI under the 'enricher' attribution; brand_enricher carries
  // its own cap. Cap=0 here surfaces regressions.
  budget: { monthlyTokenCap: 0 },
  // Delegates SQL to lib/enricher-tasks helpers; SQL extraction
  // doesn't see those, so the drift checker shows nothing.
  // External dependencies declared manually for operator visibility
  // (Phase 2026-04-30: multi-resolver DoH for domain_geo drain).
  reads: [
    { kind: "external", name: "Cloudflare DoH (1.1.1.1)", url: "https://cloudflare-dns.com" },
    { kind: "external", name: "Google DNS DoH", url: "https://dns.google" },
    { kind: "external", name: "Quad9 DoH", url: "https://dns.quad9.net:5053" },
  ],
  writes: [],
  outputs: [],
  status: 'active',
  category: 'ops',
  pipelinePosition: 21,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;
    // Order matters:
    //   1. domain_geo first — biggest backlog, cheapest per-row work.
    //   2. brand_logo_hq next — Clearbit HEAD + DNS + ipinfo lookups.
    //   3. brand_sector_rdap last — most expensive (Haiku + RDAP);
    //      if we run out of subrequests this is the cheapest job to skip.
    //
    // Each job is fully isolated — a failure in one never blocks the
    // next, matching the legacy runEnricher() behaviour.
    const jobs: EnricherJobResult[] = [];
    jobs.push(
      await runEnricherJob(env, 'domain_geo', handleBackfillDomainGeo, '/api/admin/backfill-domain-geo'),
    );
    jobs.push(
      await runEnricherJob(env, 'brand_logo_hq', handleBackfillBrandEnrichment, '/api/admin/backfill-brand-enrichment'),
    );
    jobs.push(
      await runEnricherJob(env, 'brand_sector_rdap', handleBackfillBrandSector, '/api/admin/backfill-brand-sector'),
    );

    const totalProcessed = jobs.reduce((s, j) => s + j.processed, 0);
    const totalEnriched = jobs.reduce((s, j) => s + j.enriched, 0);

    // Per-job agent_outputs row. Failure = severity='high' diagnostic.
    // Success with non-zero work = severity='info' insight. No-op job
    // (zero processed, ok) emits nothing — would be noise.
    const agentOutputs: AgentOutputEntry[] = [];
    for (const j of jobs) {
      if (!j.ok) {
        agentOutputs.push({
          type: 'diagnostic',
          summary: `enricher.${j.job} failed: ${j.error ?? 'unknown'}`,
          severity: 'high',
          details: { job: j.job, error: j.error, durationMs: j.durationMs },
        });
      } else if (j.processed > 0) {
        agentOutputs.push({
          type: 'insight',
          summary: `enricher.${j.job} processed=${j.processed} enriched=${j.enriched} (${j.durationMs}ms)`,
          severity: 'info',
          details: {
            job: j.job,
            processed: j.processed,
            enriched: j.enriched,
            durationMs: j.durationMs,
          },
        });
      }
    }

    return {
      itemsProcessed: totalProcessed,
      itemsCreated: totalEnriched,
      itemsUpdated: 0,
      output: {
        jobs: jobs.map((j) => ({
          job: j.job,
          ok: j.ok,
          processed: j.processed,
          enriched: j.enriched,
          durationMs: j.durationMs,
        })),
      },
      agentOutputs,
    };
  },
};
