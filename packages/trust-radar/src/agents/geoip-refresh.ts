/**
 * GeoIP Refresh — populates the dedicated GEOIP_DB with MaxMind
 * GeoLite2 City ranges (or db-ip Lite as a fallback).
 *
 * Cadence: monthly is enough — geographic ranges shift on the order
 * of weeks. Wired into the orchestrator hourly tick on the 1st of
 * the month at 04:07 UTC (gated inside flightControlAgent / index.ts
 * — no dedicated cron; Cloudflare's cron parser doesn't accept
 * day-of-month-and-hour combinations cleanly).
 *
 * Why an agent (not a feed):
 *   - Feeds populate `threats` with new threat records. This agent
 *     populates a reference table (`geo_ip_ranges`) used to enrich
 *     existing threats. Different write target, different cadence.
 *   - Refresh is a multi-phase durable operation (download, parse,
 *     batch write) — agent_runs lifecycle gives operators a clean
 *     status row and per-run records_processed.
 *
 * Refresh strategy:
 *   1. Download GeoLite2-City CSV from MaxMind permalink (requires
 *      MAXMIND_LICENSE_KEY).
 *   2. Stage to R2 (`GEOIP_STAGING`) so the parse phase doesn't
 *      have to keep the entire ~80MB body in Worker memory.
 *   3. Stream the CSV, parse in 5K-row chunks, bulk insert to
 *      GEOIP_DB.
 *   4. Stamp success/failure to `geo_ip_refresh_log`.
 *
 * Phase 1 of this work ships the SCAFFOLD (config check, log row
 * lifecycle, admin trigger, observability). Phase 2 will land the
 * actual download + chunked import as a Workflow — it's a multi-hour
 * operation that will exceed a single agent run's budget on the City
 * dataset.
 *
 * Until Phase 2: the agent reports a non-fatal "not_yet_implemented"
 * insight when invoked. The operator can pre-populate GEOIP_DB
 * via `wrangler d1 execute geoip-db --file=path/to/geoip.sql` for
 * the initial load — the lookup path works as soon as data lands.
 */

import type { Env } from '../types';
import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from '../lib/agentRunner';

interface RefreshConfigStatus {
  geoipDbBound: boolean;
  licenseKeyPresent: boolean;
  stagingBound: boolean;
}

function checkConfig(env: Env): RefreshConfigStatus {
  return {
    geoipDbBound: !!env.GEOIP_DB,
    licenseKeyPresent: !!env.MAXMIND_LICENSE_KEY,
    stagingBound: !!env.GEOIP_STAGING,
  };
}

export const geoipRefreshAgent: AgentModule = {
  name: 'geoip_refresh',
  displayName: 'GeoIP Refresh',
  description:
    'Loads MaxMind GeoLite2 City ranges into the dedicated GEOIP_DB. ' +
    'Provides a third-tier geo source for cartographer when ip-api ' +
    'and ipinfo can\'t return lat/lng for malicious IPs.',
  color: '#10b981',
  trigger: 'scheduled',
  requiresApproval: false,
  // 4-hour stall window: a full refresh of the City dataset can run
  // ~30-90 minutes depending on D1 write contention. This is the
  // outer envelope; individual phases mark themselves complete in
  // agent_outputs as they finish.
  stallThresholdMinutes: 240,
  parallelMax: 1,
  // No AI surface — pure data plumbing.
  costGuard: 'exempt',
  budget: { monthlyTokenCap: 0 },
  // Phase-1 stub only writes geo_ip_refresh_log. The MaxMind
  // permalink fetch + geo_ip_ranges bulk-load lands in Phase 2
  // (Cloudflare Workflow). Declarations track what the file
  // actually does today — drift CI re-validates on each PR — so
  // they grow when Phase 2 lands instead of lying about current
  // surface area. The External Dependencies panel will pick up
  // the new external resource declaration the moment it goes in.
  reads: [],
  writes: [
    // Lives in GEOIP_DB, not the main DB. The drift extractor sees
    // the SQL identifier and lists it under d1_table — accurate
    // shape, just attached to a separate binding.
    { kind: 'd1_table', name: 'geo_ip_refresh_log' },
  ],
  outputs: [],
  status: 'active',
  category: 'ops',
  // Pipeline position 37 — first free slot after the existing
  // 0-36 chain. Conceptually clusters with cube_healer (13),
  // enricher (21), and curator (10) as Platform Operations
  // data-plumbing — but the registry is dense in those ranges
  // so the next free integer keeps the audit gate happy without
  // shuffling the existing pipeline drawing.
  pipelinePosition: 37,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const env = ctx.env;
    const start = Date.now();
    const config = checkConfig(env);
    const agentOutputs: AgentOutputEntry[] = [];

    // ── Phase A: config check ──
    // Diagnose before doing any work — the operator sees a clear
    // message telling them which binding/secret is missing instead
    // of a generic "0 records processed" run.
    if (!config.geoipDbBound) {
      agentOutputs.push({
        type: 'diagnostic',
        summary:
          'GEOIP_DB binding is not set. Provision the dedicated D1: ' +
          '`wrangler d1 create geoip-db`, copy the returned database_id ' +
          'into wrangler.toml (search for GEOIP_DB), then re-deploy.',
        severity: 'medium',
        details: { config, runbook: 'wrangler.toml comment block' },
      });
      return {
        itemsProcessed: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        output: { phase: 'config_check', status: 'unconfigured', config },
        agentOutputs,
      };
    }

    if (!config.licenseKeyPresent) {
      agentOutputs.push({
        type: 'diagnostic',
        summary:
          'MAXMIND_LICENSE_KEY secret is not set. Get a free GeoLite2 ' +
          'license from https://www.maxmind.com/en/geolite2/signup, then ' +
          '`wrangler secret put MAXMIND_LICENSE_KEY`.',
        severity: 'medium',
        details: { config },
      });
      // Not a hard failure — operator may be importing manually via
      // `wrangler d1 execute`. The lookup path still works once the
      // table has data, regardless of how it got there.
      return {
        itemsProcessed: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        output: { phase: 'config_check', status: 'awaiting_license', config },
        agentOutputs,
      };
    }

    // ── Phase B: open a refresh log row ──
    // Every refresh attempt gets a row regardless of outcome — the
    // dashboard reads the latest entry to render "last refreshed N
    // hours ago" and surfaces the previous failure if the latest run
    // bombed.
    const refreshId = `geoip_refresh_${Date.now()}`;
    try {
      await env.GEOIP_DB!.prepare(`
        INSERT INTO geo_ip_refresh_log
          (id, source, status, started_at)
        VALUES (?, 'maxmind-geolite2-city', 'running', datetime('now'))
      `).bind(refreshId).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      agentOutputs.push({
        type: 'diagnostic',
        summary: `GeoIP refresh log open failed: ${msg}. ` +
                 'Likely the geoip-db migrations haven\'t been applied — ' +
                 'run `wrangler d1 migrations apply geoip-db --remote`.',
        severity: 'high',
        details: { error: msg },
      });
      return {
        itemsProcessed: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        output: { phase: 'log_open', status: 'migration_missing', error: msg },
        agentOutputs,
      };
    }

    // ── Phase C: actual refresh (Phase-2 work) ──
    // The download + chunked import is ~30-90 min on the City
    // dataset and crosses the single-Worker-invocation budget. It
    // will land as a Cloudflare Workflow in a follow-up PR. For now,
    // we surface the configuration as healthy and let the operator
    // import out-of-band via wrangler d1 execute (the lookup path
    // is fully operational once any data lands in geo_ip_ranges).
    const durationMs = Date.now() - start;
    const message =
      'Refresh scaffold ready. Download + chunked import pending ' +
      'Phase-2 (Cloudflare Workflow) — see the agent module header ' +
      'for the runbook. To pre-populate the table now, import a ' +
      'CSV via `wrangler d1 execute geoip-db --file=path/to/geoip.sql`.';

    try {
      await env.GEOIP_DB!.prepare(`
        UPDATE geo_ip_refresh_log
        SET status = 'success',
            completed_at = datetime('now'),
            rows_written = 0,
            duration_ms = ?,
            error_message = ?
        WHERE id = ?
      `).bind(durationMs, message, refreshId).run();
    } catch {
      // Non-fatal — the row started_at was already written, the
      // operator can still see the attempt happened.
    }

    agentOutputs.push({
      type: 'insight',
      summary: message,
      severity: 'info',
      details: { phase: 'awaiting_phase2', config, durationMs },
    });

    return {
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      output: { phase: 'awaiting_phase2', config, durationMs },
      agentOutputs,
    };
  },
};
