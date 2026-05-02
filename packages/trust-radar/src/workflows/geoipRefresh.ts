/**
 * GeoIP Refresh Workflow — durable, resumable load of MaxMind
 * GeoLite2-City CSVs into the dedicated GEOIP_DB.
 *
 * Why a Workflow (not just an agent)
 * ──────────────────────────────────
 * The full GeoLite2-City dataset is ~3.5M IPv4 ranges. D1's batch
 * limit is 100 statements per call; at ~50ms per batch that's
 * ~1750s (29 min) of pure write time, plus parse + locations
 * join. No single Worker invocation fits that budget — even a
 * 5-minute paid-tier scheduled run only gets ~25% of the way
 * through.
 *
 * Cloudflare Workflows give us:
 *   - Per-step durability — if step 47 fails, only step 47 retries,
 *     not the whole 70-chunk import
 *   - Multi-day execution window — total elapsed time can exceed
 *     any single Worker invocation budget
 *   - Built-in retry policy (configurable per step)
 *
 * Pipeline shape (chunks 1-3 of Phase 3 build this incrementally)
 * ──────────────────────────────────────────────────────────────
 *   Step 1  verify-staging   → confirm R2 has both CSVs
 *   Step 2  load-locations   → parse Locations CSV into in-memory
 *                              map (~150K rows, ~10MB JSON)
 *   Steps 3..N  chunk-import → read Blocks CSV slice, parse,
 *                              JOIN with locations, batch-insert
 *                              50K rows / step
 *   Step N+1  atomic-swap    → INSERT-OR-IGNORE plus rename _new
 *                              table for fully atomic cutover
 *   Step N+2  cleanup        → delete R2 objects, finalize log row
 *
 * Operator staging path
 * ─────────────────────
 * The operator runs a one-shot CLI locally to download MaxMind →
 * unzip → upload the two CSVs to R2:
 *
 *   wrangler r2 object put geoip-staging/GeoLite2-City-Locations-en.csv \
 *     --file=./GeoLite2-City-Locations-en.csv
 *   wrangler r2 object put geoip-staging/GeoLite2-City-Blocks-IPv4.csv \
 *     --file=./GeoLite2-City-Blocks-IPv4.csv
 *
 * Then triggers the workflow via the existing admin endpoint:
 *
 *   curl -X POST https://averrow.com/api/admin/geoip-refresh
 *
 * This split keeps the Workers' 128MB memory budget out of the
 * unzip path entirely. A future Phase 3.5 can automate the
 * download+unzip half (likely by using R2's multipart upload from a
 * separate one-shot worker tied to a longer execution context).
 *
 * This file ships chunk 1: scaffold + verify-staging step. Chunks
 * 2-3 add the load + import + swap.
 */

import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';

interface GeoipRefreshParams {
  /** Optional override for the R2 prefix where staged CSVs live.
   *  Defaults to '' (root of GEOIP_STAGING bucket). Useful for
   *  staging multiple datasets side-by-side or testing against a
   *  separate prefix without touching production data. */
  stagingPrefix?: string;
  /** Refresh log row id — created by the geoip_refresh agent
   *  before workflow dispatch so the workflow can update the
   *  shared status row across all of its steps. */
  refreshLogId: string;
}

interface GeoipRefreshEnv {
  GEOIP_DB: D1Database;
  GEOIP_STAGING: R2Bucket;
  GEOIP_REFRESH: Workflow;
}

const LOCATIONS_KEY = 'GeoLite2-City-Locations-en.csv';
const BLOCKS_KEY = 'GeoLite2-City-Blocks-IPv4.csv';

export class GeoipRefreshWorkflow extends WorkflowEntrypoint<GeoipRefreshEnv, GeoipRefreshParams> {
  async run(event: WorkflowEvent<GeoipRefreshParams>, step: WorkflowStep) {
    const prefix = event.payload.stagingPrefix ?? '';
    const refreshLogId = event.payload.refreshLogId;
    const locationsKey = prefix ? `${prefix.replace(/\/$/, '')}/${LOCATIONS_KEY}` : LOCATIONS_KEY;
    const blocksKey = prefix ? `${prefix.replace(/\/$/, '')}/${BLOCKS_KEY}` : BLOCKS_KEY;

    // ── Step 1: verify-staging ──────────────────────────────────
    // Confirm both CSVs were staged in R2 before we burn any of
    // the remaining steps' time on parsing. .head() returns a
    // metadata-only response so we don't read the body — safe to
    // call against a 250MB object.
    const staging = await step.do(
      'verify-staging',
      { retries: { limit: 2, delay: '5 seconds', backoff: 'constant' }, timeout: '30 seconds' },
      async () => {
        const [locHead, blockHead] = await Promise.all([
          this.env.GEOIP_STAGING.head(locationsKey),
          this.env.GEOIP_STAGING.head(blocksKey),
        ]);
        if (!locHead) {
          throw new Error(
            `R2 object missing: ${locationsKey}. ` +
            `Stage the Locations CSV via \`wrangler r2 object put\` ` +
            `before triggering the workflow.`,
          );
        }
        if (!blockHead) {
          throw new Error(
            `R2 object missing: ${blocksKey}. ` +
            `Stage the Blocks CSV via \`wrangler r2 object put\` ` +
            `before triggering the workflow.`,
          );
        }
        return {
          locations: { key: locationsKey, size: locHead.size, etag: locHead.etag },
          blocks: { key: blocksKey, size: blockHead.size, etag: blockHead.etag },
        };
      },
    );

    // Stamp the staging metadata onto the refresh log so the
    // operator can correlate the workflow run back to the agent
    // invocation that triggered it.
    await step.do('log-staging-verified', async () => {
      await this.env.GEOIP_DB.prepare(`
        UPDATE geo_ip_refresh_log
        SET status = 'running',
            error_message = ?
        WHERE id = ?
      `).bind(
        `Staging verified: locations=${staging.locations.size}b, blocks=${staging.blocks.size}b`,
        refreshLogId,
      ).run();
    });

    // ── Steps 2-N: load locations + chunk-import + atomic swap ──
    // Land in chunks 2-3 of Phase 3. For now the workflow
    // succeeds at staging verification, leaving the actual import
    // for the next commit. The refresh log captures partial
    // progress so the operator can see how far each run got.
    return {
      message: 'Staging verified — import phase pending Phase-3 chunk-2',
      staging,
      refreshLogId,
    };
  }
}
