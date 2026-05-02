/**
 * GeoIP Refresh Workflow — Phase 3.5: zero-touch in-Worker import.
 *
 * Pipeline shape
 * ──────────────
 *   Step 1  probe                → verify license key + fetch the
 *                                  release sha256 fingerprint
 *   Step 2  skip-if-current      → bail early if the live data
 *                                  already matches this sha256
 *   Step 3  prepare-shadow-table → drop+create geo_ip_ranges_new
 *   Step 4  import-locations     → range-fetch + DEFLATE-decompress
 *                                  Locations CSV from MaxMind, build
 *                                  in-memory geoname → location map
 *   Step 5  import-blocks        → range-fetch + decompress Blocks
 *                                  CSV, parse row-by-row, batch
 *                                  INSERT 100 rows per D1 round-trip
 *                                  (no buffering of the full body)
 *   Step 6  atomic-swap          → DROP+RENAME so cartographer's
 *                                  next lookup hits the new data
 *   Step 7  finalize             → mark refresh log success +
 *                                  stamp source_version (sha256)
 *
 * No R2 dependency — `HttpZipReader` walks the MaxMind archive via
 * HTTP Range requests, so the Worker never holds more than ~1MB
 * of ZIP bytes in memory.
 *
 * Memory profile
 * ──────────────
 *   - HEAD + EOCD + central directory ranges: ~1MB peak
 *   - Locations map (in step 4): ~22MB (150K rows × ~150b each)
 *   - Blocks streaming (in step 5): ~few KB at a time
 *
 * Recovery semantics
 * ──────────────────
 * Each step has its own retry policy. A network blip on step 5
 * retries from the start of step 5 only — the chunk-import step
 * is idempotent because INSERT OR IGNORE against the shadow table's
 * PRIMARY KEY treats re-runs as no-ops.
 *
 * The shadow table approach also means a partially-written failure
 * NEVER affects the live `geo_ip_ranges` until the atomic-swap step
 * runs at the very end. Cartographer's Phase 0.5 lookups continue
 * uninterrupted throughout.
 */

import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import {
  streamLocationsCsv,
  streamBlocksCsv,
  cidrToIntRange,
  type LocationRow,
} from '../lib/geoip-csv';
import { HttpZipReader } from '../lib/zip-reader';

interface GeoipRefreshParams {
  /** Refresh log row id created by the geoip_refresh agent before
   *  workflow dispatch. Each step updates this row so the operator
   *  sees progress through `geo_ip_refresh_log` queries. */
  refreshLogId: string;
  /** Skip the "is this version already loaded?" guard. Useful when
   *  the operator wants a manual force-refresh after schema
   *  changes or partial loads. */
  forceReload?: boolean;
}

interface GeoipRefreshEnv {
  GEOIP_DB: D1Database;
  GEOIP_REFRESH: Workflow;
  MAXMIND_LICENSE_KEY: string;
}

const LOCATIONS_FILENAME = 'GeoLite2-City-Locations-en.csv';
const BLOCKS_FILENAME = 'GeoLite2-City-Blocks-IPv4.csv';

/** D1 batch limit is 100 statements per call. Chunking the imports
 *  at 100 rows means each round-trip writes a full batch. Round-trip
 *  latency dominates beneath that, so smaller batches just increase
 *  total wall time. */
const D1_BATCH_LIMIT = 100;

export class GeoipRefreshWorkflow extends WorkflowEntrypoint<GeoipRefreshEnv, GeoipRefreshParams> {
  async run(event: WorkflowEvent<GeoipRefreshParams>, step: WorkflowStep) {
    const refreshLogId = event.payload.refreshLogId;
    const forceReload = event.payload.forceReload ?? false;
    const licenseKey = this.env.MAXMIND_LICENSE_KEY;
    if (!licenseKey) {
      throw new Error('MAXMIND_LICENSE_KEY not bound — workflow cannot start.');
    }

    const baseUrl = `https://download.maxmind.com/app/geoip_download` +
      `?edition_id=GeoLite2-City-CSV&license_key=${encodeURIComponent(licenseKey)}`;

    // ── Step 1: probe ────────────────────────────────────────
    // Fetch the .sha256 fingerprint. Tiny request (~70 bytes)
    // that authenticates the key AND identifies the release.
    // Failure here prevents any wasted bandwidth on the full
    // archive download.
    const probe = await step.do(
      'probe',
      { retries: { limit: 3, delay: '15 seconds', backoff: 'exponential' }, timeout: '30 seconds' },
      async (): Promise<{ sha256First12: string; full: string }> => {
        const res = await fetch(`${baseUrl}&suffix=zip.sha256`);
        if (!res.ok) {
          throw new Error(`MaxMind probe ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
        }
        const body = await res.text();
        const sha = body.trim().split(/\s+/)[0] ?? '';
        return { sha256First12: sha.slice(0, 12), full: sha };
      },
    );

    // ── Step 2: skip-if-current ──────────────────────────────
    // If the live geo_ip_ranges already came from this exact
    // sha256 (recorded as `source_version` on the most-recent
    // success row), there's nothing to do. Mark the refresh log
    // 'success' immediately and exit. This is what makes weekly
    // auto-polling cheap — most polls find no new release.
    const lastSuccess = await step.do(
      'check-last-version',
      async () => {
        const r = await this.env.GEOIP_DB.prepare(`
          SELECT source_version FROM geo_ip_refresh_log
          WHERE status = 'success'
          ORDER BY completed_at DESC
          LIMIT 1
        `).first<{ source_version: string | null }>();
        return r?.source_version ?? null;
      },
    );

    if (!forceReload && lastSuccess && probe.full.startsWith(lastSuccess)) {
      await step.do('mark-no-op', async () => {
        await this.env.GEOIP_DB.prepare(`
          UPDATE geo_ip_refresh_log
          SET status = 'success',
              completed_at = datetime('now'),
              rows_written = 0,
              source_version = ?,
              error_message = ?
          WHERE id = ?
        `).bind(
          probe.sha256First12,
          `No-op: live data already matches MaxMind release ${probe.sha256First12}`,
          refreshLogId,
        ).run();
      });
      return {
        message: `No new release — already at ${probe.sha256First12}`,
        skipped: true,
        sha256: probe.sha256First12,
      };
    }

    await step.do('log-refresh-starting', async () => {
      await this.env.GEOIP_DB.prepare(`
        UPDATE geo_ip_refresh_log
        SET status = 'running',
            source_version = ?,
            error_message = ?
        WHERE id = ?
      `).bind(
        probe.sha256First12,
        `New release ${probe.sha256First12}; loading from MaxMind...`,
        refreshLogId,
      ).run();
    });

    // ── Step 3: prepare-shadow-table ─────────────────────────
    // Atomic-swap pattern: write to geo_ip_ranges_new, then rename
    // at the end. Concurrent cartographer Phase 0.5 lookups never
    // observe a half-loaded dataset.
    await step.do(
      'prepare-shadow-table',
      { retries: { limit: 2, delay: '5 seconds', backoff: 'constant' }, timeout: '60 seconds' },
      async () => {
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

    // ── Step 4: import-locations ─────────────────────────────
    // Open the ZIP via HTTP Range, locate the Locations entry, and
    // stream-decompress it through our CSV reader. Returns the
    // built Map serialized as a Record so it survives Workflow's
    // step-result JSON encoding for handoff to step 5.
    const locationsRecord = await step.do(
      'import-locations',
      { retries: { limit: 3, delay: '20 seconds', backoff: 'exponential' }, timeout: '5 minutes' },
      async (): Promise<Record<string, LocationRow>> => {
        const archiveUrl = `${baseUrl}&suffix=zip`;
        const zip = new HttpZipReader(archiveUrl);
        await zip.open();
        const locEntry = zip.findEntry(LOCATIONS_FILENAME);
        if (!locEntry) {
          throw new Error(
            `Locations CSV missing in MaxMind archive — listed entries: ` +
            zip.listEntries().map((e) => e.name).slice(0, 5).join(', '),
          );
        }
        const stream = await zip.streamEntry(locEntry);
        const map = await streamLocationsCsv(stream);
        const record: Record<string, LocationRow> = {};
        for (const [k, v] of map) record[k] = v;
        return record;
      },
    );

    // ── Step 5: import-blocks ────────────────────────────────
    // Stream-parse the 3.5M-row Blocks CSV and INSERT OR IGNORE in
    // 100-row D1 batches. Total wall time ~30 min worst-case;
    // fits within Workflow's max step timeout (1 hour).
    const importResult = await step.do(
      'import-blocks',
      { retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' }, timeout: '1 hour' },
      async (): Promise<{ rowsWritten: number; rowsParsed: number }> => {
        const archiveUrl = `${baseUrl}&suffix=zip`;
        const zip = new HttpZipReader(archiveUrl);
        await zip.open();
        const blocksEntry = zip.findEntry(BLOCKS_FILENAME);
        if (!blocksEntry) {
          throw new Error(`Blocks CSV missing in MaxMind archive`);
        }
        const stream = await zip.streamEntry(blocksEntry);

        let pendingBatch: D1PreparedStatement[] = [];
        let rowsWritten = 0;
        let rowsParsed = 0;

        const flushBatch = async () => {
          if (pendingBatch.length === 0) return;
          const results = await this.env.GEOIP_DB.batch(pendingBatch);
          for (const r of results) {
            rowsWritten += r.meta?.changes ?? 0;
          }
          pendingBatch = [];
        };

        const { rowsParsed: parsed } = await streamBlocksCsv(stream, async (row) => {
          rowsParsed++;
          const range = cidrToIntRange(row.network);
          if (!range) return;
          const loc = row.geonameId
            ? locationsRecord[row.geonameId]
            : (row.registeredCountryGeonameId ? locationsRecord[row.registeredCountryGeonameId] : undefined);
          pendingBatch.push(
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
          if (pendingBatch.length >= D1_BATCH_LIMIT) {
            await flushBatch();
          }
        });
        // Flush whatever's left in the partial batch.
        await flushBatch();
        return { rowsWritten, rowsParsed: parsed };
      },
    );

    await step.do('log-import-done', async () => {
      await this.env.GEOIP_DB.prepare(`
        UPDATE geo_ip_refresh_log
        SET rows_written = ?,
            error_message = ?
        WHERE id = ?
      `).bind(
        importResult.rowsWritten,
        `Imported ${importResult.rowsWritten} of ${importResult.rowsParsed} parsed rows; preparing atomic swap.`,
        refreshLogId,
      ).run();
    });

    // ── Step 6: atomic-swap ──────────────────────────────────
    // Single D1 batch transaction. Either every operation lands or
    // none do — no broken-table window for cartographer lookups.
    const swapped = await step.do(
      'atomic-swap',
      { retries: { limit: 2, delay: '10 seconds', backoff: 'constant' }, timeout: '60 seconds' },
      async () => {
        const rowCountResult = await this.env.GEOIP_DB.prepare(
          `SELECT COUNT(*) AS n FROM geo_ip_ranges_new`,
        ).first<{ n: number }>();
        const newRowCount = rowCountResult?.n ?? 0;
        if (newRowCount === 0) {
          throw new Error('Atomic swap aborted: shadow table is empty.');
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

    // ── Step 7: finalize ─────────────────────────────────────
    await step.do('finalize', async () => {
      await this.env.GEOIP_DB.prepare(`
        UPDATE geo_ip_refresh_log
        SET status = 'success',
            completed_at = datetime('now'),
            rows_written = ?,
            source_version = ?,
            error_message = ?
        WHERE id = ?
      `).bind(
        importResult.rowsWritten,
        probe.full,
        `MaxMind release ${probe.sha256First12} live: ${swapped.newRowCount} rows. Imported ${importResult.rowsWritten} of ${importResult.rowsParsed} parsed.`,
        refreshLogId,
      ).run();
    });

    return {
      message: `MaxMind release ${probe.sha256First12} imported: ${swapped.newRowCount} rows live.`,
      sha256: probe.full,
      rowsWritten: importResult.rowsWritten,
      rowsParsed: importResult.rowsParsed,
      liveRowCount: swapped.newRowCount,
    };
  }
}
