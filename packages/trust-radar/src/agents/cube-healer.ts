/**
 * Cube Healer Agent — Phase 4.2 retroactive drift remediation.
 *
 * Runs 6-hourly via the "12 *\/6 * * *" cron. Performs a full 30-day
 * bulk rebuild of threat_cube_geo, threat_cube_provider, and
 * threat_cube_brand via INSERT OR REPLACE ... SELECT ... GROUP BY,
 * bounding drift from cartographer's retroactive enrichment to ≤6 hours
 * of back-fill.
 *
 * Why this exists:
 *   Cartographer's candidate query has no time filter — it enriches threats
 *   retroactively from any point in the N-day window. Phase 3's Navigator cube
 *   refresh only rebuilds the current + previous hour, so any hour older than
 *   H-1 freezes in the cube while raw threats continues to grow, producing
 *   permanent drift that Phase 4.1's parity_checker first detected (3.64% on
 *   the 30-day geo cube, 2.88% on provider).
 *
 * Scope — EXCLUDES the current partial hour (Phase 3's territory). The "prev
 * hour" overlap with Navigator is intentional and safe because INSERT OR
 * REPLACE is idempotent. The bulk SQL is verbatim from the manual test that
 * proved exact parity against the raw threats table.
 *
 * Status semantics:
 *   - All queries succeed              → 'success', rowsWritten = geo + provider + brand
 *   - Some succeed, some fail          → 'partial', rowsWritten = successful cubes
 *   - First query throws (rest skipped)→ 'failed',  rowsWritten = 0
 *
 * agent_runs lifecycle mirrors parity-checker.ts: insert a row with
 * status='partial' and NULL duration_ms at start, so a crashed run stays
 * machine-readable as "started but did not complete". Update to the final
 * status on completion. Never throws — all errors land in agent_runs and
 * the returned result object.
 */

import type { Env } from '../types';

export interface CubeHealerResult {
  status: 'success' | 'partial' | 'failed';
  rowsWritten: number;
  durationMs: number;
}

// ─── Heal SQL ────────────────────────────────────────────────────
// Literals only (no bind params). These exact queries were verified in
// production to produce exact parity against the raw threats table.

const GEO_HEAL_SQL = `
  INSERT OR REPLACE INTO threat_cube_geo
    (hour_bucket, lat_bucket, lng_bucket, country_code, threat_type, severity,
     source_feed, threat_count, updated_at)
  SELECT
    strftime('%Y-%m-%d %H:00:00', created_at),
    ROUND(lat * 100) / 100.0,
    ROUND(lng * 100) / 100.0,
    COALESCE(country_code, 'XX'),
    COALESCE(threat_type, 'unknown'),
    COALESCE(severity, 'unknown'),
    COALESCE(source_feed, 'unknown'),
    COUNT(*),
    datetime('now')
  FROM threats
  WHERE created_at >= datetime('now', '-30 days')
    AND created_at < strftime('%Y-%m-%d %H:00:00', datetime('now'))
    AND status = 'active'
    AND lat IS NOT NULL
    AND lng IS NOT NULL
  GROUP BY 1, 2, 3, 4, 5, 6, 7
`;

const PROVIDER_HEAL_SQL = `
  INSERT OR REPLACE INTO threat_cube_provider
    (hour_bucket, hosting_provider_id, threat_type, severity, source_feed,
     threat_count, updated_at)
  SELECT
    strftime('%Y-%m-%d %H:00:00', created_at),
    hosting_provider_id,
    COALESCE(threat_type, 'unknown'),
    COALESCE(severity, 'unknown'),
    COALESCE(source_feed, 'unknown'),
    COUNT(*),
    datetime('now')
  FROM threats
  WHERE created_at >= datetime('now', '-30 days')
    AND created_at < strftime('%Y-%m-%d %H:00:00', datetime('now'))
    AND status = 'active'
    AND hosting_provider_id IS NOT NULL
  GROUP BY 1, 2, 3, 4, 5
`;

const BRAND_HEAL_SQL = `
  INSERT OR REPLACE INTO threat_cube_brand
    (hour_bucket, target_brand_id, threat_type, severity, source_feed,
     threat_count, updated_at)
  SELECT
    strftime('%Y-%m-%d %H:00:00', created_at),
    target_brand_id,
    COALESCE(threat_type, 'unknown'),
    COALESCE(severity, 'unknown'),
    COALESCE(source_feed, 'unknown'),
    COUNT(*),
    datetime('now')
  FROM threats
  WHERE created_at >= datetime('now', '-30 days')
    AND created_at < strftime('%Y-%m-%d %H:00:00', datetime('now'))
    AND status = 'active'
    AND target_brand_id IS NOT NULL
  GROUP BY 1, 2, 3, 4, 5
`;

// ─── Main entry ──────────────────────────────────────────────────

export async function runCubeHealer(
  env: Env,
  _ctx: ExecutionContext,
): Promise<CubeHealerResult> {
  const startMs = Date.now();
  const runId = crypto.randomUUID();

  // Insert agent_runs row with status='partial' and NULL duration_ms. If the
  // worker crashes mid-run, the row stays as 'partial' — a machine-readable
  // "started but did not complete" signal that mirrors parity_checker.
  try {
    await env.DB.prepare(
      `INSERT INTO agent_runs
         (id, agent_id, started_at, status, records_processed, outputs_generated)
       VALUES (?, 'cube_healer', datetime('now'), 'partial', 0, 0)`
    ).bind(runId).run();
  } catch {
    // If we can't even write the start row, bail early — nothing else is safe.
    return {
      status: 'failed',
      rowsWritten: 0,
      durationMs: Date.now() - startMs,
    };
  }

  let rowsWritten = 0;
  let finalStatus: 'success' | 'partial' | 'failed' = 'success';
  let errorMessage: string | null = null;

  // ── Geo heal ────────────────────────────────────────────────
  // If geo throws, nothing has landed yet. Report 'failed' with 0 rows and
  // skip provider entirely — we'd rather re-run on the next 10-minute tick.
  try {
    const geoResult = await env.DB.prepare(GEO_HEAL_SQL).run();
    const geoChanges = geoResult.meta?.changes ?? 0;
    rowsWritten += geoChanges;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    finalStatus = 'failed';
    errorMessage = `cube_healer geo heal failed: ${errMsg}`;

    const durationMs = Date.now() - startMs;
    try {
      await env.DB.prepare(
        `UPDATE agent_runs SET
           status = ?,
           records_processed = ?,
           error_message = ?,
           completed_at = datetime('now'),
           duration_ms = ?
         WHERE id = ?`
      ).bind(finalStatus, rowsWritten, errorMessage, durationMs, runId).run();
    } catch {
      // Best-effort — main path already failed.
    }

    return { status: finalStatus, rowsWritten, durationMs };
  }

  // ── Provider heal ───────────────────────────────────────────
  // If geo succeeded but provider throws, report 'partial' with geo's row
  // count preserved (partial progress is visible) and capture the provider
  // error. Never zero out rowsWritten in the error path — whatever landed
  // in the database is reported.
  try {
    const providerResult = await env.DB.prepare(PROVIDER_HEAL_SQL).run();
    const providerChanges = providerResult.meta?.changes ?? 0;
    rowsWritten += providerChanges;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    finalStatus = 'partial';
    errorMessage =
      `cube_healer provider heal failed (geo succeeded, ${rowsWritten} rows): ${errMsg}`;
  }

  // ── Brand heal ──────────────────────────────────────────────
  // Same pattern as provider: if brand throws after geo+provider succeeded,
  // report 'partial' and capture the error.
  try {
    const brandResult = await env.DB.prepare(BRAND_HEAL_SQL).run();
    const brandChanges = brandResult.meta?.changes ?? 0;
    rowsWritten += brandChanges;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (finalStatus === 'success') finalStatus = 'partial';
    const prevError = errorMessage ? `${errorMessage} | ` : '';
    errorMessage = `${prevError}cube_healer brand heal failed (${rowsWritten} rows so far): ${errMsg}`;
  }

  // ── Finalize agent_runs row ─────────────────────────────────
  const durationMs = Date.now() - startMs;
  try {
    await env.DB.prepare(
      `UPDATE agent_runs SET
         status = ?,
         records_processed = ?,
         error_message = ?,
         completed_at = datetime('now'),
         duration_ms = ?
       WHERE id = ?`
    ).bind(finalStatus, rowsWritten, errorMessage, durationMs, runId).run();
  } catch {
    // Best-effort — return the computed result even if the run row update fails.
  }

  return { status: finalStatus, rowsWritten, durationMs };
}
