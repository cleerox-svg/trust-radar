// Averrow — Takedown Effectiveness Metrics (S2.1)
//
// Computes the three real takedown-performance metrics the platform
// has always claimed but never measured:
//
//   1. Submission → resolution time  (p50 / p90 / avg elapsed)
//   2. Monthly volume                (submitted vs resolved, last ~12 months)
//   3. Success rate                  (of RESOLVED takedowns, the fraction
//                                      that ended in resolution='taken_down')
//
// Data model (verified against migrations 0039 + 0152):
//   - takedown_requests — the LIFECYCLE row. Terminal `resolution` in
//     {taken_down, refused, expired, withdrawn}. Timestamps
//     `submitted_at` (we sent the report) and `resolved_at` (a terminal
//     outcome was recorded).
//   - takedown_submissions — the per-dispatch-attempt row. `outcome` in
//     {submitted, queued, failed, rejected}. This is the DISPATCH layer
//     (did the report leave the building), NOT resolution (did the
//     content come down). Exposed here only as a clearly-labeled
//     SECONDARY metric.
//
// ── Denominator definitions (auditable, do not change silently) ──
//   * Resolution-time set: requests with BOTH `submitted_at IS NOT NULL`
//     AND `resolved_at IS NOT NULL`. A request submitted but still
//     in-flight (resolved_at NULL) is EXCLUDED — it has no elapsed time
//     yet. Rows with resolved_at < submitted_at (clock/data anomalies)
//     are excluded from percentiles and counted separately.
//   * Headline success-rate denominator: RESOLVED-ONLY, i.e. requests
//     with `resolution IS NOT NULL`. Still-in-flight takedowns
//     (resolution NULL: draft/requested/submitted/pending_response) are
//     NOT in the denominator — the rate answers "of the takedowns that
//     reached a terminal outcome, how many succeeded", not "of all
//     takedowns ever opened". This is the honest, defensible figure.
//   * Dispatch-success denominator: takedown_submissions rows with a
//     terminal outcome (submitted + queued + failed + rejected). Success
//     = submitted + queued (the report was accepted for delivery).
//
// SCOPE / DISCLOSURE GATE: this module and its ops endpoint make the
// numbers AVAILABLE TO OPS ONLY. Do NOT wire any figure here into the
// public/marketing site — the customer-facing takedown-success claim
// (improvement-plan S1.5) is gated behind explicit owner sign-off.

// Minimal structural type so this module is testable against a mock and
// works with both env.DB (D1Database) and a read-replica D1DatabaseSession
// — both expose prepare().
export interface D1Like {
  prepare(query: string): D1PreparedStatement;
}

export interface ResolutionTimeStats {
  /** Requests counted (submitted_at & resolved_at both present, non-negative elapsed). */
  count: number;
  /** Rows excluded because resolved_at < submitted_at (data/clock anomaly). */
  anomalies_excluded: number;
  p50_hours: number | null;
  p90_hours: number | null;
  avg_hours: number | null;
  p50_days: number | null;
  p90_days: number | null;
  avg_days: number | null;
}

export interface SuccessRateStats {
  /** Resolved-only: requests with resolution IS NOT NULL. */
  denominator: number;
  denominator_definition: string;
  taken_down: number;
  refused: number;
  expired: number;
  withdrawn: number;
  /** Any resolution value outside the four known terminals (defensive). */
  other: number;
  /** taken_down / denominator, as a percentage 0-100 (null when denominator=0). */
  success_rate_pct: number | null;
}

export interface DispatchStats {
  /** Secondary/diagnostic — dispatch layer, not resolution. */
  denominator: number;
  denominator_definition: string;
  submitted: number;
  queued: number;
  failed: number;
  rejected: number;
  /** (submitted + queued) / denominator, percentage 0-100 (null when denominator=0). */
  dispatch_success_rate_pct: number | null;
}

export interface MonthlyVolumePoint {
  /** 'YYYY-MM' (UTC, per the DB clock). */
  month: string;
  submitted: number;
  resolved: number;
}

export interface ProviderMetric {
  provider_name: string;
  resolution_time: ResolutionTimeStats;
  success_rate: SuccessRateStats;
}

export interface TakedownMetrics {
  generated_at: string;
  window: {
    monthly_lookback_months: number;
  };
  overall: {
    resolution_time: ResolutionTimeStats;
    success_rate: SuccessRateStats;
    dispatch: DispatchStats;
  };
  monthly: MonthlyVolumePoint[];
  by_provider: ProviderMetric[];
  disclosure: string;
}

// ─── Pure aggregation helpers (unit-tested independently) ────────

/**
 * Linear-interpolation percentile over an UNSORTED array of samples.
 * p in [0,1]. Returns null for an empty array. Rounds to 2 decimals.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return round2(sorted[0] as number);
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loVal = sorted[lo] as number;
  const hiVal = sorted[hi] as number;
  if (lo === hi) return round2(loVal);
  const frac = rank - lo;
  return round2(loVal * (1 - frac) + hiVal * frac);
}

/**
 * Build resolution-time stats from a list of elapsed-hours samples.
 * Negative samples (resolved before submitted) are treated as anomalies:
 * excluded from percentiles/avg and counted.
 */
export function computeResolutionTimeStats(hours: number[]): ResolutionTimeStats {
  const anomalies = hours.filter(h => h < 0).length;
  const clean = hours.filter(h => h >= 0);
  const count = clean.length;
  const avg = count === 0 ? null : round2(clean.reduce((s, h) => s + h, 0) / count);
  const p50 = percentile(clean, 0.5);
  const p90 = percentile(clean, 0.9);
  return {
    count,
    anomalies_excluded: anomalies,
    p50_hours: p50,
    p90_hours: p90,
    avg_hours: avg,
    p50_days: p50 === null ? null : round2(p50 / 24),
    p90_days: p90 === null ? null : round2(p90 / 24),
    avg_days: avg === null ? null : round2(avg / 24),
  };
}

/** Build the resolution-based (headline) success-rate stats from resolution→count. */
export function computeSuccessRate(counts: Map<string, number>): SuccessRateStats {
  const taken_down = counts.get("taken_down") ?? 0;
  const refused = counts.get("refused") ?? 0;
  const expired = counts.get("expired") ?? 0;
  const withdrawn = counts.get("withdrawn") ?? 0;
  let denominator = 0;
  for (const n of counts.values()) denominator += n;
  const other = denominator - taken_down - refused - expired - withdrawn;
  return {
    denominator,
    denominator_definition:
      "resolved-only: requests with resolution IS NOT NULL (excludes still-in-flight takedowns)",
    taken_down,
    refused,
    expired,
    withdrawn,
    other,
    success_rate_pct: denominator === 0 ? null : round2((taken_down / denominator) * 100),
  };
}

/** Build the secondary dispatch-success stats from outcome→count. */
export function computeDispatchStats(counts: Map<string, number>): DispatchStats {
  const submitted = counts.get("submitted") ?? 0;
  const queued = counts.get("queued") ?? 0;
  const failed = counts.get("failed") ?? 0;
  const rejected = counts.get("rejected") ?? 0;
  const denominator = submitted + queued + failed + rejected;
  return {
    denominator,
    denominator_definition:
      "dispatch attempts with a terminal outcome (submitted + queued + failed + rejected)",
    submitted,
    queued,
    failed,
    rejected,
    dispatch_success_rate_pct:
      denominator === 0 ? null : round2(((submitted + queued) / denominator) * 100),
  };
}

/**
 * Merge submitted-per-month and resolved-per-month rows into a single
 * sorted (ascending) series covering every month that appears in either.
 */
export function buildMonthly(
  submittedRows: Array<{ month: string; n: number }>,
  resolvedRows: Array<{ month: string; n: number }>,
): MonthlyVolumePoint[] {
  const map = new Map<string, MonthlyVolumePoint>();
  const ensure = (month: string): MonthlyVolumePoint => {
    let p = map.get(month);
    if (!p) {
      p = { month, submitted: 0, resolved: 0 };
      map.set(month, p);
    }
    return p;
  };
  for (const r of submittedRows) if (r.month) ensure(r.month).submitted = r.n;
  for (const r of resolvedRows) if (r.month) ensure(r.month).resolved = r.n;
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// ─── DB orchestration ────────────────────────────────────────────

const MONTHLY_LOOKBACK_MONTHS = 12;
// Only segment providers with enough resolved rows to be meaningful.
const PROVIDER_MIN_RESOLVED = 3;

/**
 * Compute the full takedown-metrics result object. Reads only — pass a
 * read-replica session (getReadSession) at the call site. Prepared
 * statements only; no user input is interpolated.
 */
export async function getTakedownMetrics(db: D1Like): Promise<TakedownMetrics> {
  // 1. Resolution durations (hours) for the resolution-time set, carrying
  //    provider_name for per-provider segmentation. julianday() diff × 24 = hours.
  const durationRows = await db.prepare(`
    SELECT
      COALESCE(provider_name, '(unspecified)') AS provider_name,
      (julianday(resolved_at) - julianday(submitted_at)) * 24.0 AS hours
    FROM takedown_requests
    WHERE resolved_at IS NOT NULL AND submitted_at IS NOT NULL
  `).all<{ provider_name: string; hours: number }>();

  const durations = durationRows.results ?? [];
  const overallHours = durations.map(r => r.hours);

  // 2. Success-rate counts by resolution (headline metric).
  const resolutionRows = await db.prepare(`
    SELECT resolution, COUNT(*) AS n
    FROM takedown_requests
    WHERE resolution IS NOT NULL
    GROUP BY resolution
  `).all<{ resolution: string; n: number }>();
  const resolutionCounts = new Map<string, number>();
  for (const r of resolutionRows.results ?? []) resolutionCounts.set(r.resolution, r.n);

  // 3. Monthly volume — submitted and resolved, last ~12 months.
  const submittedByMonth = await db.prepare(`
    SELECT strftime('%Y-%m', submitted_at) AS month, COUNT(*) AS n
    FROM takedown_requests
    WHERE submitted_at IS NOT NULL
      AND submitted_at >= datetime('now', ?)
    GROUP BY month
  `).bind(`-${MONTHLY_LOOKBACK_MONTHS} months`).all<{ month: string; n: number }>();

  const resolvedByMonth = await db.prepare(`
    SELECT strftime('%Y-%m', resolved_at) AS month, COUNT(*) AS n
    FROM takedown_requests
    WHERE resolved_at IS NOT NULL
      AND resolved_at >= datetime('now', ?)
    GROUP BY month
  `).bind(`-${MONTHLY_LOOKBACK_MONTHS} months`).all<{ month: string; n: number }>();

  // 4. Dispatch success (secondary) from takedown_submissions.
  const dispatchRows = await db.prepare(`
    SELECT outcome, COUNT(*) AS n
    FROM takedown_submissions
    GROUP BY outcome
  `).all<{ outcome: string; n: number }>();
  const dispatchCounts = new Map<string, number>();
  for (const r of dispatchRows.results ?? []) dispatchCounts.set(r.outcome, r.n);

  // 5. Per-provider success-rate counts (resolution × provider).
  const providerResolutionRows = await db.prepare(`
    SELECT
      COALESCE(provider_name, '(unspecified)') AS provider_name,
      resolution,
      COUNT(*) AS n
    FROM takedown_requests
    WHERE resolution IS NOT NULL
    GROUP BY provider_name, resolution
  `).all<{ provider_name: string; resolution: string; n: number }>();

  // Assemble per-provider segments (duration + success rate), keeping only
  // providers with a meaningful number of resolved rows.
  const providerHours = new Map<string, number[]>();
  for (const r of durations) {
    const arr = providerHours.get(r.provider_name) ?? [];
    arr.push(r.hours);
    providerHours.set(r.provider_name, arr);
  }
  const providerResolutions = new Map<string, Map<string, number>>();
  for (const r of providerResolutionRows.results ?? []) {
    const m = providerResolutions.get(r.provider_name) ?? new Map<string, number>();
    m.set(r.resolution, r.n);
    providerResolutions.set(r.provider_name, m);
  }

  const by_provider: ProviderMetric[] = [];
  for (const [provider_name, counts] of providerResolutions) {
    const success_rate = computeSuccessRate(counts);
    if (success_rate.denominator < PROVIDER_MIN_RESOLVED) continue;
    by_provider.push({
      provider_name,
      resolution_time: computeResolutionTimeStats(providerHours.get(provider_name) ?? []),
      success_rate,
    });
  }
  by_provider.sort((a, b) => b.success_rate.denominator - a.success_rate.denominator);

  return {
    generated_at: new Date().toISOString(),
    window: { monthly_lookback_months: MONTHLY_LOOKBACK_MONTHS },
    overall: {
      resolution_time: computeResolutionTimeStats(overallHours),
      success_rate: computeSuccessRate(resolutionCounts),
      dispatch: computeDispatchStats(dispatchCounts),
    },
    monthly: buildMonthly(submittedByMonth.results ?? [], resolvedByMonth.results ?? []),
    by_provider,
    disclosure:
      "OPS-ONLY. Publishing any of these figures on the marketing/public site " +
      "requires owner sign-off (improvement-plan S1.5).",
  };
}

// ─── local ───────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
