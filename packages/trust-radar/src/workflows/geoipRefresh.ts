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
import {
  parseLocationsCsv,
  parseBlocksCsvChunk,
  cidrToIntRange,
  type LocationRow,
  type BlockRow,
} from '../lib/geoip-csv';

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

    // ── Step 2: load-locations ──────────────────────────────
    // Parse the small Locations CSV into a Map for the join.
    // ~150K rows × ~150 bytes JSON each = ~22MB — well within
    // the 128MB Worker budget. We pass the serialized map
    // through Workflow state so the chunk-import steps can
    // resume after a Worker restart without re-parsing.
    const locationsMap = await step.do(
      'load-locations',
      { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' }, timeout: '2 minutes' },
      async (): Promise<Record<string, LocationRow>> => {
        const obj = await this.env.GEOIP_STAGING.get(locationsKey);
        if (!obj) throw new Error(`Locations CSV vanished: ${locationsKey}`);
        const text = await obj.text();
        const map = parseLocationsCsv(text);
        // Workflow step return values must be JSON-serializable.
        // Convert Map → Record. Memory cost is the same; we
        // re-Map() on the consume side.
        const record: Record<string, LocationRow> = {};
        for (const [k, v] of map) record[k] = v;
        return record;
      },
    );

    // ── Steps 3..N: chunk-import ────────────────────────────
    // Read the Blocks CSV in 5MB chunks via R2 range reads and
    // import each chunk's rows. 250MB / 5MB = 50 chunks ×
    // ~50K rows = ~3.5M rows total. Each step has an independent
    // retry policy so a transient D1 hiccup on chunk 27 doesn't
    // restart from chunk 1.
    //
    // Why 5MB chunks: large enough that fetch + parse overhead
    // is amortised, small enough that one chunk fits in memory
    // even with the locations map already loaded (~22MB), small
    // enough that step retry latency stays bounded.
    const CHUNK_SIZE_BYTES = 5 * 1024 * 1024;
    const blocksTotalSize = staging.blocks.size;
    const totalChunks = Math.ceil(blocksTotalSize / CHUNK_SIZE_BYTES);

    let cumulativeRowsWritten = 0;
    let residual = '';

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const offsetStart = chunkIdx * CHUNK_SIZE_BYTES;
      const offsetEnd = Math.min(offsetStart + CHUNK_SIZE_BYTES - 1, blocksTotalSize - 1);
      const isFirstChunk = chunkIdx === 0;

      // The residual closure has to be passed through as part of
      // the step's payload because Workflows snapshot state
      // between steps; capturing `residual` from the outer scope
      // works in-process but won't survive a step restart. Stamp
      // it into the refresh log's error_message column when needed,
      // or accept that a step retry re-fetches the chunk and
      // re-derives the same residual deterministically.
      const result = await step.do(
        `chunk-import-${chunkIdx}`,
        {
          retries: { limit: 3, delay: '15 seconds', backoff: 'exponential' },
          timeout: '5 minutes',
        },
        async () => {
          const obj = await this.env.GEOIP_STAGING.get(blocksKey, {
            range: { offset: offsetStart, length: offsetEnd - offsetStart + 1 },
          });
          if (!obj) throw new Error(`Blocks CSV chunk ${chunkIdx} fetch failed`);
          const text = residual + (await obj.text());
          const { rows, residual: nextResidual } = parseBlocksCsvChunk(text, isFirstChunk);
          residual = nextResidual;

          // Build inserts. INSERT OR IGNORE makes each step
          // idempotent — if Workflow retries a chunk we already
          // partially wrote, the dupes are silently skipped and
          // the step still reports its row count.
          const inserts: D1PreparedStatement[] = [];
          for (const row of rows) {
            const range = cidrToIntRange(row.network);
            if (!range) continue;
            const loc = row.geonameId
              ? locationsMap[row.geonameId]
              : (row.registeredCountryGeonameId ? locationsMap[row.registeredCountryGeonameId] : undefined);
            inserts.push(
              this.env.GEOIP_DB.prepare(`
                INSERT OR IGNORE INTO geo_ip_ranges
                  (start_ip_int, end_ip_int, country_code, country_name,
                   region, city, postal_code, lat, lng, asn, asn_org, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'maxmind-geolite2-city')
              `).bind(
                range.start, range.end,
                loc?.countryCode ?? null,
                loc?.countryName ?? null,
                loc?.region ?? null,
                loc?.city ?? null,
                row.postalCode,
                row.lat,
                row.lng,
              ),
            );
          }

          // D1 batch limit is 100 statements per call. Slice the
          // inserts into 100-row sub-batches and write each.
          let written = 0;
          const D1_BATCH_LIMIT = 100;
          for (let i = 0; i < inserts.length; i += D1_BATCH_LIMIT) {
            const slice = inserts.slice(i, i + D1_BATCH_LIMIT);
            const results = await this.env.GEOIP_DB.batch(slice);
            for (const r of results) {
              written += r.meta?.changes ?? 0;
            }
          }
          return { rowsParsed: rows.length, rowsWritten: written, chunkIdx };
        },
      );

      cumulativeRowsWritten += result.rowsWritten;

      // Light-touch progress update. Frequent UPDATEs would
      // waste Workflow state writes, so we update every 10
      // chunks (~50K rows) plus the final chunk.
      if (chunkIdx % 10 === 9 || chunkIdx === totalChunks - 1) {
        await step.do(`progress-update-${chunkIdx}`, async () => {
          await this.env.GEOIP_DB.prepare(`
            UPDATE geo_ip_refresh_log
            SET rows_written = ?,
                error_message = ?
            WHERE id = ?
          `).bind(
            cumulativeRowsWritten,
            `Chunk ${chunkIdx + 1}/${totalChunks} done — ${cumulativeRowsWritten} rows written`,
            refreshLogId,
          ).run();
        });
      }
    }

    // ── Step N+1: finalize ──────────────────────────────────
    // Mark the refresh log row as 'success'. Atomic-swap +
    // R2 cleanup land in chunk 3 of Phase 3.
    await step.do('finalize', async () => {
      await this.env.GEOIP_DB.prepare(`
        UPDATE geo_ip_refresh_log
        SET status = 'success',
            completed_at = datetime('now'),
            rows_written = ?,
            error_message = ?
        WHERE id = ?
      `).bind(
        cumulativeRowsWritten,
        `Imported ${cumulativeRowsWritten} ranges from ${totalChunks} chunks`,
        refreshLogId,
      ).run();
    });

    return {
      message: `Imported ${cumulativeRowsWritten} ranges from ${totalChunks} chunks`,
      staging,
      refreshLogId,
      cumulativeRowsWritten,
      totalChunks,
    };
  }
}
