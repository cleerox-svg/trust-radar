import { describe, it, expect } from "vitest";
import {
  percentile,
  computeResolutionTimeStats,
  computeSuccessRate,
  computeDispatchStats,
  buildMonthly,
  getTakedownMetrics,
  type D1Like,
} from "../src/lib/takedown-metrics";

// ─── percentile ──────────────────────────────────────────────────

describe("percentile", () => {
  it("returns null on empty input", () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it("returns the single value regardless of p", () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.9)).toBe(42);
  });

  it("computes p50 (median) with linear interpolation", () => {
    // sorted: 1,2,3,4 → rank = 0.5*3 = 1.5 → between 2 and 3 → 2.5
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2.5);
  });

  it("computes p90 with linear interpolation", () => {
    // 1..10, rank = 0.9*9 = 8.1 → between idx8(9) and idx9(10) → 9.1
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9.1);
  });
});

// ─── computeResolutionTimeStats ──────────────────────────────────

describe("computeResolutionTimeStats", () => {
  it("returns nulls for an empty set", () => {
    const s = computeResolutionTimeStats([]);
    expect(s.count).toBe(0);
    expect(s.p50_hours).toBeNull();
    expect(s.avg_hours).toBeNull();
    expect(s.p50_days).toBeNull();
  });

  it("computes avg/p50/p90 in hours and derives days", () => {
    const s = computeResolutionTimeStats([24, 48, 72, 96]);
    expect(s.count).toBe(4);
    expect(s.avg_hours).toBe(60);
    expect(s.avg_days).toBe(2.5);
    expect(s.p50_hours).toBe(60); // between 48 and 72
    expect(s.p50_days).toBe(2.5);
  });

  it("excludes negative (anomalous) durations from stats and counts them", () => {
    const s = computeResolutionTimeStats([24, -5, 48]);
    expect(s.count).toBe(2);
    expect(s.anomalies_excluded).toBe(1);
    expect(s.avg_hours).toBe(36);
  });

  it("excludes null/NaN durations (unparseable timestamp) instead of counting them as 0h", () => {
    // A non-datetime timestamp makes julianday() return NULL -> hours null.
    // null >= 0 is true in JS, so without the finite guard this would sneak in
    // as a 0-hour resolution, deflating avg/p50 and inflating count.
    const s = computeResolutionTimeStats([24, null, 48, NaN, -3]);
    expect(s.count).toBe(2); // only 24 and 48 are usable
    expect(s.anomalies_excluded).toBe(3); // null, NaN, and -3
    expect(s.avg_hours).toBe(36); // NOT 24 (which is what (24+0+48+0)/? would give)
    expect(s.p50_hours).toBe(36);
  });
});

// ─── computeSuccessRate ──────────────────────────────────────────

describe("computeSuccessRate", () => {
  it("uses resolved-only denominator and computes taken_down %", () => {
    const s = computeSuccessRate(
      new Map([
        ["taken_down", 7],
        ["refused", 2],
        ["expired", 1],
      ]),
    );
    expect(s.denominator).toBe(10); // resolved-only, excludes in-flight by construction
    expect(s.taken_down).toBe(7);
    expect(s.refused).toBe(2);
    expect(s.expired).toBe(1);
    expect(s.withdrawn).toBe(0);
    expect(s.other).toBe(0);
    expect(s.success_rate_pct).toBe(70);
    expect(s.denominator_definition).toContain("resolved-only");
  });

  it("returns null rate with a zero denominator", () => {
    const s = computeSuccessRate(new Map());
    expect(s.denominator).toBe(0);
    expect(s.success_rate_pct).toBeNull();
  });

  it("counts unknown resolution values under `other`", () => {
    const s = computeSuccessRate(
      new Map([
        ["taken_down", 1],
        ["mystery", 3],
      ]),
    );
    expect(s.denominator).toBe(4);
    expect(s.other).toBe(3);
    expect(s.success_rate_pct).toBe(25);
  });
});

// ─── computeDispatchStats ────────────────────────────────────────

describe("computeDispatchStats", () => {
  it("treats submitted+queued as success over the terminal-outcome denominator", () => {
    const s = computeDispatchStats(
      new Map([
        ["submitted", 6],
        ["queued", 2],
        ["failed", 1],
        ["rejected", 1],
      ]),
    );
    expect(s.denominator).toBe(10);
    expect(s.dispatch_success_rate_pct).toBe(80);
  });

  it("returns null rate when there are no dispatch attempts", () => {
    const s = computeDispatchStats(new Map());
    expect(s.dispatch_success_rate_pct).toBeNull();
  });
});

// ─── buildMonthly ────────────────────────────────────────────────

describe("buildMonthly", () => {
  it("merges submitted + resolved by month and sorts ascending", () => {
    const series = buildMonthly(
      [
        { month: "2026-03", n: 5 },
        { month: "2026-01", n: 2 },
      ],
      [
        { month: "2026-01", n: 1 },
        { month: "2026-02", n: 4 },
      ],
    );
    expect(series).toEqual([
      { month: "2026-01", submitted: 2, resolved: 1 },
      { month: "2026-02", submitted: 0, resolved: 4 },
      { month: "2026-03", submitted: 5, resolved: 0 },
    ]);
  });

  it("ignores null months", () => {
    const series = buildMonthly(
      [{ month: null as unknown as string, n: 9 }, { month: "2026-05", n: 1 }],
      [],
    );
    expect(series).toEqual([{ month: "2026-05", submitted: 1, resolved: 0 }]);
  });
});

// ─── getTakedownMetrics (DB orchestration, mocked) ───────────────

type Row = Record<string, unknown>;

// Minimal D1 mock: routes each prepared query to a canned result set by
// matching a substring of the SQL. bind() is a no-op passthrough.
function mockDb(routes: Array<{ match: string; rows: Row[] }>): D1Like {
  const make = (rows: Row[]) => ({
    bind: () => make(rows),
    all: async () => ({ results: rows }),
    first: async () => rows[0] ?? null,
    run: async () => ({}),
    raw: async () => [],
  });
  return {
    prepare(query: string) {
      const route = routes.find(r => query.includes(r.match));
      return make(route ? route.rows : []) as unknown as D1PreparedStatement;
    },
  };
}

describe("getTakedownMetrics", () => {
  it("assembles overall + monthly + per-provider from the underlying queries", async () => {
    const db = mockDb([
      // durations (resolution-time set) with provider_name
      {
        match: "(julianday(resolved_at) - julianday(submitted_at))",
        rows: [
          { provider_name: "GoDaddy", hours: 24 },
          { provider_name: "GoDaddy", hours: 48 },
          { provider_name: "GoDaddy", hours: 72 },
          { provider_name: "Cloudflare", hours: 10 },
        ],
      },
      // overall resolution counts (unique: "GROUP BY resolution" — the
      // per-provider query is "GROUP BY provider_name, resolution")
      {
        match: "GROUP BY resolution",
        rows: [
          { resolution: "taken_down", n: 8 },
          { resolution: "refused", n: 2 },
        ],
      },
      // submitted by month
      {
        match: "strftime('%Y-%m', submitted_at)",
        rows: [{ month: "2026-06", n: 5 }],
      },
      // resolved by month
      {
        match: "strftime('%Y-%m', resolved_at)",
        rows: [{ month: "2026-06", n: 4 }],
      },
      // dispatch outcomes
      {
        match: "FROM takedown_submissions",
        rows: [
          { outcome: "submitted", n: 9 },
          { outcome: "failed", n: 1 },
        ],
      },
      // per-provider resolution counts
      {
        match: "GROUP BY provider_name, resolution",
        rows: [
          { provider_name: "GoDaddy", resolution: "taken_down", n: 3 },
          { provider_name: "Cloudflare", resolution: "taken_down", n: 1 }, // below PROVIDER_MIN_RESOLVED
        ],
      },
    ]);

    const m = await getTakedownMetrics(db);

    // overall success rate — resolved-only denominator
    expect(m.overall.success_rate.denominator).toBe(10);
    expect(m.overall.success_rate.success_rate_pct).toBe(80);

    // overall resolution time
    expect(m.overall.resolution_time.count).toBe(4);
    expect(m.overall.resolution_time.avg_hours).toBe(38.5);

    // dispatch (secondary)
    expect(m.overall.dispatch.dispatch_success_rate_pct).toBe(90);

    // monthly
    expect(m.monthly).toEqual([{ month: "2026-06", submitted: 5, resolved: 4 }]);

    // by_provider — only GoDaddy clears the min-resolved floor (3)
    expect(m.by_provider).toHaveLength(1);
    expect(m.by_provider[0].provider_name).toBe("GoDaddy");
    expect(m.by_provider[0].success_rate.denominator).toBe(3);
    expect(m.by_provider[0].resolution_time.count).toBe(3);

    expect(m.disclosure).toContain("owner sign-off");
  });
});
