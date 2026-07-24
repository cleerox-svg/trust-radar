/**
 * Unit tests for the progress-aware GeoIP refresh stall detector
 * (lib/geoip-stall.ts) — the state machine behind Flight Control's
 * Layer-C supervisor.
 *
 * The regression these guard: an age-only "stuck >180 min" kill that
 * force-failed live, progressing rebuilds (prod 2026-07-24, four
 * consecutive 3h00m recoveries). The detector must:
 *   - NEVER kill a run whose checkpoint is still advancing, however old;
 *   - kill a run whose checkpoint has been flat for the grace window
 *     once it's past the age floor;
 *   - kill a run whose checkpoint REGRESSED (import restart loop making
 *     no net progress) on the same flat-clock basis;
 *   - kill a true zombie via the hard ceiling regardless of progress;
 *   - never arm on the first observation.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateGeoipStall,
  GEOIP_STALL_DEFAULTS,
  type GeoipStallWatch,
} from '../src/lib/geoip-stall';

const MIN = 60_000;
const T0 = Date.parse('2026-07-24T00:00:00.000Z');

describe('evaluateGeoipStall', () => {
  it('never arms on the first observation (prev=null), even for an old run', () => {
    const d = evaluateGeoipStall({
      lastCommittedRow: 0,
      ageMin: 500,
      prev: null,
      nowMs: T0,
    });
    expect(d.kill).toBe(false);
    expect(d.advancing).toBe(true); // 0 > -1
    expect(d.nextWatch).toEqual({ hwm: 0, since: new Date(T0).toISOString() });
  });

  it('does not kill a young run even if the checkpoint is flat', () => {
    const prev: GeoipStallWatch = { hwm: 500_000, since: new Date(T0).toISOString() };
    const d = evaluateGeoipStall({
      lastCommittedRow: 500_000,
      ageMin: 30, // below the 180-min age floor
      prev,
      nowMs: T0 + 200 * MIN,
    });
    expect(d.kill).toBe(false);
  });

  it('does not kill an OLD run while the checkpoint keeps advancing', () => {
    const prev: GeoipStallWatch = { hwm: 1_000_000, since: new Date(T0).toISOString() };
    const d = evaluateGeoipStall({
      lastCommittedRow: 1_500_000, // advanced past hwm
      ageMin: 240, // well past the age floor
      prev,
      nowMs: T0 + 240 * MIN,
    });
    expect(d.kill).toBe(false);
    expect(d.advancing).toBe(true);
    // Stall clock reset to now; high-water bumped.
    expect(d.nextWatch.hwm).toBe(1_500_000);
    expect(d.nextWatch.since).toBe(new Date(T0 + 240 * MIN).toISOString());
  });

  it('kills an old run whose checkpoint has been flat past the grace window', () => {
    // Checkpoint flat at 2M since T0; now 200 min later, run is 200 min old.
    const prev: GeoipStallWatch = { hwm: 2_000_000, since: new Date(T0).toISOString() };
    const d = evaluateGeoipStall({
      lastCommittedRow: 2_000_000,
      ageMin: 200,
      prev,
      nowMs: T0 + 200 * MIN, // stalled 200 min >= 90 grace
    });
    expect(d.kill).toBe(true);
    expect(d.reason).toMatch(/no import progress for 200 min/);
    expect(d.reason).toMatch(/stuck at 2000000/);
  });

  it('does NOT kill when flat but still inside the grace window', () => {
    const prev: GeoipStallWatch = { hwm: 2_000_000, since: new Date(T0).toISOString() };
    const d = evaluateGeoipStall({
      lastCommittedRow: 2_000_000,
      ageMin: 200, // old enough
      prev,
      nowMs: T0 + 60 * MIN, // only 60 min flat < 90 grace
    });
    expect(d.kill).toBe(false);
    // Carries the original since forward so the clock keeps running.
    expect(d.nextWatch.since).toBe(new Date(T0).toISOString());
    expect(d.nextWatch.hwm).toBe(2_000_000);
  });

  it('treats a regressed checkpoint (restart loop) as non-advancing and eventually kills it', () => {
    // hwm was 2M; the import restarted and lcr fell back to 100K.
    const prev: GeoipStallWatch = { hwm: 2_000_000, since: new Date(T0).toISOString() };
    const d = evaluateGeoipStall({
      lastCommittedRow: 100_000, // regressed below hwm
      ageMin: 300,
      prev,
      nowMs: T0 + 120 * MIN, // 120 min flat >= 90 grace
    });
    expect(d.advancing).toBe(false);
    expect(d.kill).toBe(true);
    // hwm preserved (not lowered to the regressed value).
    expect(d.nextWatch.hwm).toBe(2_000_000);
    expect(d.reason).toMatch(/last_committed_row stuck at 100000/);
  });

  it('fires the runaway hard ceiling regardless of progress', () => {
    // Checkpoint IS advancing, but the run has blown the 12h ceiling.
    const prev: GeoipStallWatch = { hwm: 1_000_000, since: new Date(T0).toISOString() };
    const d = evaluateGeoipStall({
      lastCommittedRow: 1_200_000, // advancing
      ageMin: GEOIP_STALL_DEFAULTS.hardCeilingMin + 5,
      prev,
      nowMs: T0 + 5 * MIN,
    });
    expect(d.advancing).toBe(true);
    expect(d.kill).toBe(true);
    expect(d.reason).toMatch(/runaway >720 min/);
  });

  it('honours threshold overrides', () => {
    const prev: GeoipStallWatch = { hwm: 5, since: new Date(T0).toISOString() };
    const d = evaluateGeoipStall({
      lastCommittedRow: 5,
      ageMin: 10,
      prev,
      nowMs: T0 + 10 * MIN,
      thresholds: { ageFloorMin: 5, noProgressGraceMin: 5 },
    });
    expect(d.kill).toBe(true);
  });
});
