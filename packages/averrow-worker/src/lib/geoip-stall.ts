/**
 * Progress-aware stall detection for the GeoIP refresh workflow.
 *
 * Flight Control's Layer-C supervisor used to force-fail any
 * `geo_ip_refresh_log` row that had been 'running' longer than a fixed
 * age (180 min). That age threshold could never be set correctly: a
 * full 3.76M-row rebuild resumes across step retries and, under D1
 * contention, legitimately runs for hours while still writing rows —
 * so an age-only kill murdered live imports at exactly 180 min with
 * rows_written=0 (prod 2026-07-24: four consecutive 3h00m recoveries,
 * DB stuck stale for days).
 *
 * This helper decouples "stuck" from "old". A run is stuck only if its
 * checkpoint (`last_committed_row`) has stopped advancing. We track a
 * per-run high-water mark in KV between FC ticks:
 *
 *   - checkpoint advanced past the high-water since the last tick
 *     → healthy: reset the stall clock, never kill.
 *   - checkpoint flat OR regressed (an import restarting from row 0
 *     making no NET progress) for >= the no-progress grace window,
 *     AND the run is older than the age floor → stuck: recover it.
 *   - a hard ceiling recovers a true zombie regardless of the
 *     checkpoint, as a runaway backstop.
 *
 * FC runs hourly, so the grace window spans ~1-2 ticks. The function is
 * pure (time is injected via `nowMs`) so the state machine is unit
 * tested directly — see test/geoip-stall.test.ts.
 */

/** Per-run progress watermark persisted in KV between FC ticks. */
export interface GeoipStallWatch {
  /** Highest `last_committed_row` observed for this run so far. */
  hwm: number;
  /** ISO timestamp when the checkpoint last advanced past `hwm`. The
   *  stall clock is measured from here. */
  since: string;
}

export interface GeoipStallThresholds {
  /** Age floor (min from started_at) before a flat run is even
   *  considered for recovery. */
  ageFloorMin: number;
  /** How long the checkpoint must stay flat/regressed to count as
   *  stuck. */
  noProgressGraceMin: number;
  /** Absolute runaway backstop — recover regardless of progress. */
  hardCeilingMin: number;
}

export const GEOIP_STALL_DEFAULTS: GeoipStallThresholds = {
  ageFloorMin: 180,
  noProgressGraceMin: 90,
  hardCeilingMin: 12 * 60,
};

export interface GeoipStallInput {
  /** Current `last_committed_row` for the running refresh row. */
  lastCommittedRow: number;
  /** Age of the run in minutes (from started_at). */
  ageMin: number;
  /** Prior watermark read from KV, or null on the first observation. */
  prev: GeoipStallWatch | null;
  /** Injected clock (ms since epoch) for determinism. */
  nowMs: number;
  /** Optional threshold overrides (defaults to GEOIP_STALL_DEFAULTS). */
  thresholds?: Partial<GeoipStallThresholds>;
}

export interface GeoipStallDecision {
  /** True → mark the run 'failed' (recover) this tick. */
  kill: boolean;
  /** Human-readable recovery reason; null when not killing. */
  reason: string | null;
  /** Watermark to persist back to KV when NOT killing. */
  nextWatch: GeoipStallWatch;
  /** Whether the checkpoint advanced past the prior high-water. */
  advancing: boolean;
}

export function evaluateGeoipStall(input: GeoipStallInput): GeoipStallDecision {
  const t = { ...GEOIP_STALL_DEFAULTS, ...(input.thresholds ?? {}) };
  const { lastCommittedRow: lcr, ageMin, prev, nowMs } = input;
  const nowIso = new Date(nowMs).toISOString();

  // First observation (prev null) counts as advancing so the stall
  // clock starts fresh rather than immediately arming.
  const advancing = lcr > (prev?.hwm ?? -1);
  const hwm = advancing ? lcr : (prev?.hwm ?? lcr);
  const since = advancing ? nowIso : (prev?.since ?? nowIso);
  const stalledMin = Math.floor((nowMs - Date.parse(since)) / 60_000);

  const noProgressStuck =
    ageMin >= t.ageFloorMin && !advancing && stalledMin >= t.noProgressGraceMin;
  const runawayStuck = ageMin >= t.hardCeilingMin;
  const kill = noProgressStuck || runawayStuck;

  const reason = !kill
    ? null
    : runawayStuck
      ? `runaway >${t.hardCeilingMin} min (last_committed_row ${lcr})`
      : `no import progress for ${stalledMin} min (last_committed_row stuck at ${lcr})`;

  return { kill, reason, nextWatch: { hwm, since }, advancing };
}
