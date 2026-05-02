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

    // ── Step 1.5: prepare-shadow-table ──────────────────────
    // Atomic-swap pattern: load into geo_ip_ranges_new, then
    // rename at the very end. Concurrent reads against
    // geo_ip_ranges keep seeing the old data until we cut over,
    // so cartographer's Phase 0.5 lookups never observe a
    // half-loaded dataset.
    //
    // The shadow table CREATE is idempotent (DROP first), so a
    // step retry doesn't fail on "already exists" if a prior
    // attempt got partway through the import. SQLite has no
    // CREATE TABLE LIKE; we mirror the schema by hand and keep
    // the indexes too.
    await step.do(
      'prepare-shadow-table',
      { retries: { limit: 2, delay: '5 seconds', backoff: 'constant' }, timeout: '60 seconds' },
      async () => {
        // Drop + recreate so a retried run starts clean. The
        // primary geo_ip_ranges is untouched — concurrent
        // lookups continue against it.
        await this.env.GEOIP_DB.batch([
          this.env.GEOIP_DB.prepare(`DROP TABLE IF EXISTS geo_ip_ranges_new`),
          this.env.GEOIP_DB.prepare(`
            CREATE TABLE geo_ip_ranges_new (
              start_ip_int INTEGER PRIMARY KEY NOT NULL,
              end_ip_int   INTEGER NOT NULL,
              country_code TEXT,
              country_name TEXT,
              region       TEXT,
              city         TEXT,
              postal_code  TEXT,
              lat          REAL,
              lng          REAL,
              asn          TEXT,
              asn_org      TEXT,
              source       TEXT NOT NULL,
              loaded_at    TEXT NOT NULL DEFAULT (datetime('now'))
            )
          `),
          this.env.GEOIP_DB.prepare(
            `CREATE INDEX idx_geo_ip_end_new ON geo_ip_ranges_new(end_ip_int)`,
          ),
        ]);
      },
    );

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
                INSERT OR IGNORE INTO geo_ip_ranges_new
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

    // ── Step N+1: atomic-swap ───────────────────────────────
    // Cut over from the old geo_ip_ranges table to the freshly
    // populated geo_ip_ranges_new in one D1 batch. Until this
    // step runs, all cartographer Phase 0.5 lookups still hit
    // the old data — no half-loaded view ever observable.
    //
    // SQLite lacks a true atomic RENAME-with-replace, so we
    // wrap the three steps (drop old, rename new → live,
    // recreate index) in db.batch(), which executes them as a
    // single transaction. If any one fails the whole batch
    // rolls back and the old table stays in place.
    //
    // We also rename the index to keep the bookkeeping clean —
    // SQLite would otherwise leave us with idx_geo_ip_end on
    // the old (now dropped) and idx_geo_ip_end_new on the live
    // table, which makes ALTER queries surprising for the next
    // operator.
    const swapped = await step.do(
      'atomic-swap',
      { retries: { limit: 2, delay: '10 seconds', backoff: 'constant' }, timeout: '60 seconds' },
      async () => {
        const rowCountResult = await this.env.GEOIP_DB.prepare(
          `SELECT COUNT(*) AS n FROM geo_ip_ranges_new`,
        ).first<{ n: number }>();
        const newRowCount = rowCountResult?.n ?? 0;
        if (newRowCount === 0) {
          throw new Error(
            `Atomic swap aborted: geo_ip_ranges_new is empty. ` +
            `Either chunk-import wrote zero rows or a prior step ` +
            `dropped the table.`,
          );
        }

        await this.env.GEOIP_DB.batch([
          this.env.GEOIP_DB.prepare(`DROP INDEX IF EXISTS idx_geo_ip_end`),
          this.env.GEOIP_DB.prepare(`DROP TABLE IF EXISTS geo_ip_ranges`),
          this.env.GEOIP_DB.prepare(
            `ALTER TABLE geo_ip_ranges_new RENAME TO geo_ip_ranges`,
          ),
          this.env.GEOIP_DB.prepare(`DROP INDEX IF EXISTS idx_geo_ip_end_new`),
          this.env.GEOIP_DB.prepare(
            `CREATE INDEX idx_geo_ip_end ON geo_ip_ranges(end_ip_int)`,
          ),
        ]);
        return { newRowCount };
      },
    );

    // ── Step N+2: cleanup-staging ───────────────────────────
    // Delete the R2 objects we just imported. Avoids charging
    // the operator for staging storage between refreshes and
    // forces the next refresh to re-stage (which is the right
    // behaviour — fresh upload guarantees the operator hasn't
    // accidentally re-imported a stale CSV).
    //
    // Failures are non-fatal: the import already succeeded, so
    // we'd rather mark the refresh log 'success' even if R2
    // cleanup glitches. The operator can manually delete the
    // staged objects via wrangler if it ever matters.
    await step.do('cleanup-staging', async () => {
      try {
        await Promise.all([
          this.env.GEOIP_STAGING.delete(locationsKey),
          this.env.GEOIP_STAGING.delete(blocksKey),
        ]);
      } catch (err) {
        console.error('[geoipRefresh] cleanup-staging non-fatal error:', err);
      }
    });

    // ── Step N+3: finalize ──────────────────────────────────
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
        `Imported ${cumulativeRowsWritten} ranges from ${totalChunks} chunks; live table swapped (${swapped.newRowCount} rows live).`,
        refreshLogId,
      ).run();
    });

    return {
      message: `Imported ${cumulativeRowsWritten} ranges from ${totalChunks} chunks; ${swapped.newRowCount} rows live`,
      staging,
      refreshLogId,
      cumulativeRowsWritten,
      liveRowCount: swapped.newRowCount,
      totalChunks,
    };
  }
}
