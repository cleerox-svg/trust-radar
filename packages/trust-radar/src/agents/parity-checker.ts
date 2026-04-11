/**
 * Parity Checker Agent — Phase 4 automated cube drift detection.
 *
 * Runs hourly from the orchestrator. Verifies that threat_cube_geo and
 * threat_cube_provider (populated by Phase 2 cube-builder + Phase 3 fast_tick
 * refresh) still match the raw threats table for every relevant time window.
 *
 * What it checks per run:
 *   - 8 window checks: { 24h, 7d, 14d, 30d } × { geo, provider }
 *   - 48 hourly checks: last 24 hours × { geo, provider }, excluding the
 *     current in-progress hour.
 *
 * Tolerance rules:
 *   - Window checks: must match EXACTLY (drift_abs == 0). Windows are snapped
 *     to the top of the hour so sub-hour cube lag never causes false positives.
 *   - Hourly H-1 check (the most recently-closed hour): drift_abs <= 5 is
 *     considered tolerable, to account for cartographer retroactive updates
 *     landing between fast_tick refreshes.
 *   - Hourly H-2 through H-24 checks: must match EXACTLY.
 *
 * Outputs:
 *   - One row per check inserted into parity_checks (history table).
 *   - agent_runs row: status='success' if no critical drift, 'partial' if
 *     critical drift found (visible as an alarm in the Agent Monitor UI),
 *     'failed' if the function threw an uncaught exception. error_message
 *     carries a human-readable drift summary when drift > 0.
 *
 * This agent does NOT auto-remediate. Detection and logging only. Remediation
 * is deferred to Phase 4.5 if drift patterns emerge.
 *
 * Cube predicates mirrored from src/lib/cube-builder.ts exactly:
 *   - geo:      status='active' AND lat IS NOT NULL AND lng IS NOT NULL
 *   - provider: status='active' AND hosting_provider_id IS NOT NULL
 */

import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────

type CubeName = 'geo' | 'provider';
type CheckType = 'window' | 'hourly';

interface CheckRecord {
  checkType: CheckType;
  windowLabel: string;
  cubeName: CubeName;
  cubeTotal: number;
  rawTotal: number;
  driftAbs: number;
  driftPct: number | null;
  isTolerable: boolean;
}

export interface ParityCheckerResult {
  status: 'success' | 'partial' | 'failed';
  summary: string;
  details: {
    runId: string | null;
    durationMs: number;
    totalChecks: number;
    exactMatches: number;
    tolerableDrift: number;
    criticalDrift: number;
    worstDrift: CheckRecord | null;
    error?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

const WINDOW_HOURS: Record<string, number> = {
  '24 hours': 24,
  '7 days': 168,
  '14 days': 336,
  '30 days': 720,
};

/**
 * Format a Date as a 'YYYY-MM-DD HH:00:00' UTC hour bucket string, matching
 * the format cube-builder.ts writes and fast-tick.ts reads.
 *
 * Duplicated locally from fast-tick.ts (which is in the Phase 3 stable-freeze
 * zone). Consolidation into a shared lib module is deferred to a future phase.
 */
function formatHourBucketUTC(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hour = String(d.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:00:00`;
}

/**
 * Compute a window-start timestamp snapped to the top of the hour,
 * N hours before the current top-of-hour.
 *
 * Snapping is critical: cube hour_bucket columns are string-compared against
 * this value, so a non-aligned windowStart like '2026-04-11 10:45:00' would
 * include raw threats from 10:45-10:59 while excluding the entire cube bucket
 * '2026-04-11 10:00:00'. Snapping forces both comparisons to the same hourly
 * grain, which is the only way cube==raw can match exactly.
 */
function snappedWindowStart(label: string): string {
  const hours = WINDOW_HOURS[label];
  if (hours === undefined) {
    throw new Error(`Unknown window label: ${label}`);
  }
  const nowSnapped = new Date();
  nowSnapped.setUTCMinutes(0, 0, 0);
  nowSnapped.setUTCMilliseconds(0);
  const d = new Date(nowSnapped.getTime() - hours * 60 * 60 * 1000);
  // 'YYYY-MM-DDTHH:00:00.000Z' → 'YYYY-MM-DD HH:00:00'
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function computeDriftPct(cubeTotal: number, rawTotal: number): number | null {
  if (rawTotal === 0) {
    return cubeTotal === 0 ? 0 : null;
  }
  return (Math.abs(cubeTotal - rawTotal) / rawTotal) * 100;
}

// ─── Parity queries ──────────────────────────────────────────────

/**
 * Compare cube vs raw for an open-ended window starting at windowStart.
 * Both tables are filtered by the same hour-aligned boundary.
 */
async function checkWindow(
  env: Env,
  cube: CubeName,
  windowLabel: string,
  windowStart: string,
): Promise<CheckRecord> {
  let cubeTotal = 0;
  let rawTotal = 0;

  if (cube === 'geo') {
    const cubeRow = await env.DB.prepare(
      `SELECT COALESCE(SUM(threat_count), 0) AS n
         FROM threat_cube_geo
        WHERE hour_bucket >= ?`
    ).bind(windowStart).first<{ n: number }>();
    cubeTotal = cubeRow?.n ?? 0;

    const rawRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n
         FROM threats
        WHERE created_at >= ?
          AND status = 'active'
          AND lat IS NOT NULL
          AND lng IS NOT NULL`
    ).bind(windowStart).first<{ n: number }>();
    rawTotal = rawRow?.n ?? 0;
  } else {
    const cubeRow = await env.DB.prepare(
      `SELECT COALESCE(SUM(threat_count), 0) AS n
         FROM threat_cube_provider
        WHERE hour_bucket >= ?`
    ).bind(windowStart).first<{ n: number }>();
    cubeTotal = cubeRow?.n ?? 0;

    const rawRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n
         FROM threats
        WHERE created_at >= ?
          AND status = 'active'
          AND hosting_provider_id IS NOT NULL`
    ).bind(windowStart).first<{ n: number }>();
    rawTotal = rawRow?.n ?? 0;
  }

  const driftAbs = Math.abs(cubeTotal - rawTotal);
  return {
    checkType: 'window',
    windowLabel,
    cubeName: cube,
    cubeTotal,
    rawTotal,
    driftAbs,
    driftPct: computeDriftPct(cubeTotal, rawTotal),
    isTolerable: driftAbs === 0,
  };
}

/**
 * Compare cube vs raw for a single closed hour bucket [hour, hour + 1 hour).
 */
async function checkHour(
  env: Env,
  cube: CubeName,
  hourBucket: string,
  hourEnd: string,
  allowedDrift: number,
): Promise<CheckRecord> {
  let cubeTotal = 0;
  let rawTotal = 0;

  if (cube === 'geo') {
    const cubeRow = await env.DB.prepare(
      `SELECT COALESCE(SUM(threat_count), 0) AS n
         FROM threat_cube_geo
        WHERE hour_bucket = ?`
    ).bind(hourBucket).first<{ n: number }>();
    cubeTotal = cubeRow?.n ?? 0;

    const rawRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n
         FROM threats
        WHERE created_at >= ?
          AND created_at < ?
          AND status = 'active'
          AND lat IS NOT NULL
          AND lng IS NOT NULL`
    ).bind(hourBucket, hourEnd).first<{ n: number }>();
    rawTotal = rawRow?.n ?? 0;
  } else {
    const cubeRow = await env.DB.prepare(
      `SELECT COALESCE(SUM(threat_count), 0) AS n
         FROM threat_cube_provider
        WHERE hour_bucket = ?`
    ).bind(hourBucket).first<{ n: number }>();
    cubeTotal = cubeRow?.n ?? 0;

    const rawRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n
         FROM threats
        WHERE created_at >= ?
          AND created_at < ?
          AND status = 'active'
          AND hosting_provider_id IS NOT NULL`
    ).bind(hourBucket, hourEnd).first<{ n: number }>();
    rawTotal = rawRow?.n ?? 0;
  }

  const driftAbs = Math.abs(cubeTotal - rawTotal);
  return {
    checkType: 'hourly',
    windowLabel: hourBucket,
    cubeName: cube,
    cubeTotal,
    rawTotal,
    driftAbs,
    driftPct: computeDriftPct(cubeTotal, rawTotal),
    isTolerable: driftAbs <= allowedDrift,
  };
}

async function persistCheck(env: Env, c: CheckRecord): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO parity_checks
       (check_type, window_label, cube_name, cube_total, raw_total,
        drift_abs, drift_pct, is_tolerable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    c.checkType,
    c.windowLabel,
    c.cubeName,
    c.cubeTotal,
    c.rawTotal,
    c.driftAbs,
    c.driftPct,
    c.isTolerable ? 1 : 0,
  ).run();
}

// ─── Main entry ──────────────────────────────────────────────────

export async function runParityChecker(
  env: Env,
  _ctx: ExecutionContext,
): Promise<ParityCheckerResult> {
  const startMs = Date.now();
  const runId = crypto.randomUUID();

  // Start: insert agent_runs row with status='partial' and NULL duration_ms.
  // We'll either UPDATE it to 'success' at the end (no critical drift) or
  // leave it as 'partial' with an error_message (critical drift detected).
  try {
    await env.DB.prepare(
      `INSERT INTO agent_runs
         (id, agent_id, started_at, status, records_processed, outputs_generated)
       VALUES (?, 'parity_checker', datetime('now'), 'partial', 0, 0)`
    ).bind(runId).run();
  } catch (err) {
    // If we can't even write the start row, bail early — nothing else is safe.
    return {
      status: 'failed',
      summary: `parity_checker: failed to create agent_runs row (${err instanceof Error ? err.message : String(err)})`,
      details: {
        runId: null,
        durationMs: Date.now() - startMs,
        totalChecks: 0,
        exactMatches: 0,
        tolerableDrift: 0,
        criticalDrift: 0,
        worstDrift: null,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }

  const checks: CheckRecord[] = [];
  let totalChecks = 0;
  let exactMatches = 0;
  let tolerableDrift = 0;
  let criticalDrift = 0;
  let worstDrift: CheckRecord | null = null;

  try {
    // ── 8 window parity checks ──────────────────────────────────
    const windowLabels = Object.keys(WINDOW_HOURS); // '24 hours', '7 days', '14 days', '30 days'
    const cubes: CubeName[] = ['geo', 'provider'];

    for (const label of windowLabels) {
      const windowStart = snappedWindowStart(label);
      for (const cube of cubes) {
        const c = await checkWindow(env, cube, label, windowStart);
        checks.push(c);
        await persistCheck(env, c);
        totalChecks++;
        if (c.driftAbs === 0) {
          exactMatches++;
        } else if (c.isTolerable) {
          tolerableDrift++;
        } else {
          criticalDrift++;
          if (worstDrift === null || c.driftAbs > worstDrift.driftAbs) {
            worstDrift = c;
          }
        }
      }
    }

    // ── 48 hourly parity checks (H-1 through H-24) ──────────────
    // Snap "now" to the top of the current hour, then walk back 1..24 hours.
    // The current in-progress hour (H-0) is NOT checked.
    const nowSnapped = new Date();
    nowSnapped.setUTCMinutes(0, 0, 0);
    nowSnapped.setUTCMilliseconds(0);
    const nowMs = nowSnapped.getTime();

    for (let i = 1; i <= 24; i++) {
      const hourDate = new Date(nowMs - i * 60 * 60 * 1000);
      const hourEndDate = new Date(nowMs - (i - 1) * 60 * 60 * 1000);
      const hourBucket = formatHourBucketUTC(hourDate);
      const hourEnd = formatHourBucketUTC(hourEndDate);
      // H-1 (the most recently closed hour) gets 5-row drift tolerance;
      // older hours must match exactly.
      const allowedDrift = i === 1 ? 5 : 0;

      for (const cube of cubes) {
        const c = await checkHour(env, cube, hourBucket, hourEnd, allowedDrift);
        checks.push(c);
        await persistCheck(env, c);
        totalChecks++;
        if (c.driftAbs === 0) {
          exactMatches++;
        } else if (c.isTolerable) {
          tolerableDrift++;
        } else {
          criticalDrift++;
          if (worstDrift === null || c.driftAbs > worstDrift.driftAbs) {
            worstDrift = c;
          }
        }
      }
    }

    // ── Build summary + update agent_runs row ───────────────────
    const durationMs = Date.now() - startMs;
    const anyDrift = criticalDrift > 0 || tolerableDrift > 0;
    const finalStatus: 'success' | 'partial' = criticalDrift > 0 ? 'partial' : 'success';

    let summary: string;
    let errorMessage: string | null = null;
    if (criticalDrift > 0 && worstDrift !== null) {
      const diff = worstDrift.cubeTotal - worstDrift.rawTotal;
      summary =
        `CRITICAL DRIFT: ${criticalDrift} ${worstDrift.checkType === 'window' ? 'window' : 'hour'}${criticalDrift === 1 ? '' : 's'}, ` +
        `${worstDrift.cubeName} cube. Worst: ${worstDrift.checkType === 'window' ? 'window' : 'hour'} ${worstDrift.windowLabel} ` +
        `cube=${worstDrift.cubeTotal} raw=${worstDrift.rawTotal} diff=${diff >= 0 ? '+' : ''}${diff}`;
      errorMessage = summary;
    } else if (anyDrift) {
      summary =
        `Parity OK (${exactMatches}/${totalChecks} exact, ${tolerableDrift} tolerable drift, 0 critical)`;
      // Tolerable drift is not an alarm, but surface it on the run row for visibility.
      errorMessage = `Tolerable drift on ${tolerableDrift} check(s) (within H-1 5-row tolerance). No critical drift.`;
    } else {
      summary = `Parity OK: ${exactMatches}/${totalChecks} checks exact, 0 drift`;
    }

    await env.DB.prepare(
      `UPDATE agent_runs SET
         status = ?,
         records_processed = ?,
         error_message = ?,
         completed_at = datetime('now'),
         duration_ms = ?
       WHERE id = ?`
    ).bind(finalStatus, totalChecks, errorMessage, durationMs, runId).run();

    return {
      status: finalStatus,
      summary,
      details: {
        runId,
        durationMs,
        totalChecks,
        exactMatches,
        tolerableDrift,
        criticalDrift,
        worstDrift,
      },
    };
  } catch (err) {
    // Uncaught failure — log to agent_runs and return 'failed'. Do not throw.
    const durationMs = Date.now() - startMs;
    const errorMsg = err instanceof Error ? err.message : String(err);
    try {
      await env.DB.prepare(
        `UPDATE agent_runs SET
           status = 'failed',
           records_processed = ?,
           error_message = ?,
           completed_at = datetime('now'),
           duration_ms = ?
         WHERE id = ?`
      ).bind(totalChecks, `parity_checker failure: ${errorMsg}`, durationMs, runId).run();
    } catch {
      // Swallow — run row update is best-effort when the main path already failed.
    }

    return {
      status: 'failed',
      summary: `parity_checker failed after ${totalChecks} checks: ${errorMsg}`,
      details: {
        runId,
        durationMs,
        totalChecks,
        exactMatches,
        tolerableDrift,
        criticalDrift,
        worstDrift,
        error: errorMsg,
      },
    };
  }
}
