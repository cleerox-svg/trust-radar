/**
 * Phase 3 / S0.4 (T1) — D1 hot-path discipline.
 *
 * Four page-load GROUP-BY-over-raw-threats sites were swapped to read
 * from the OLAP cubes / pre-computed columns instead of the 113K-row
 * `threats` table:
 *
 *   - handlers/dashboard.ts   handleDashboardProviders (worst + improving)
 *   - handlers/trends.ts      handleTrendBrandMomentum
 *   - handlers/trends.ts      handleTrendProviderMomentum
 *
 * These tests pin the NEW query path: they assert the swapped handlers
 * (a) no longer issue any `FROM threats` GROUP BY, (b) read the
 * expected cube / pre-computed source, and (c) map the cube rows into
 * the unchanged response shape the frontend consumes.
 *
 * This repo has no live-D1 harness, so D1 is faked at the
 * .prepare(sql).bind().all()/.first() level: each query is routed to a
 * canned result by matching a distinguishing substring in its SQL text
 * (same approach as agents-latest-run.test.ts).
 */

import { describe, it, expect } from "vitest";
import {
  handleDashboardProviders,
} from "../src/handlers/dashboard";
import {
  handleTrendBrandMomentum,
  handleTrendProviderMomentum,
} from "../src/handlers/trends";
import type { Env } from "../src/types";

type Row = Record<string, unknown>;
type Canned = (sql: string, binds: unknown[]) => { results: Row[]; meta: { rows_read: number; rows_written: number } };

interface Harness {
  env: Env;
  calls: string[];
}

// Build a fake Env whose DB.prepare/withSession route every query to
// `canned`, capturing the SQL text of every prepared statement.
function makeEnv(canned: Canned): Harness {
  const calls: string[] = [];

  const makeStmt = (sql: string) => {
    calls.push(sql);
    let bound: unknown[] = [];
    const stmt = {
      bind(...b: unknown[]) {
        bound = b;
        return stmt;
      },
      async all() {
        return canned(sql, bound);
      },
      async first() {
        return canned(sql, bound).results[0] ?? null;
      },
    };
    return stmt;
  };

  const db = {
    prepare: (sql: string) => makeStmt(sql),
    withSession: () => ({
      prepare: (sql: string) => makeStmt(sql),
      getBookmark: () => null,
    }),
  } as unknown as D1Database;

  const env = {
    DB: db,
    CACHE: {
      get: async () => null, // always cold — exercise the compute path
      put: async () => undefined,
    },
  } as unknown as Env;

  return { env, calls };
}

function req(url: string): Request {
  return new Request(url);
}

async function bodyOf(res: Response) {
  return res.json() as Promise<{ success: boolean; data: Row[] }>;
}

const result = (results: Row[]) => ({
  results,
  meta: { rows_read: results.length, rows_written: 0 },
});

// ─── dashboard.ts handleDashboardProviders ─────────────────────────

describe("handleDashboardProviders — worst (pre-computed column + cube trend)", () => {
  it("reads hosting_providers.total_threat_count and never GROUP BYs raw threats", async () => {
    const { env, calls } = makeEnv((sql) => {
      if (/FROM hosting_providers hp\s+WHERE hp\.total_threat_count > 0/.test(sql)) {
        return result([
          { provider_id: "p1", name: "ProvOne", asn: "AS1", threat_count: 500 },
          { provider_id: "p2", name: "ProvTwo", asn: "AS2", threat_count: 200 },
        ]);
      }
      if (/FROM threat_cube_provider/.test(sql)) {
        // p1 cooling (10 vs 40 → -75%), p2 heating (30 vs 20 → +50%)
        return result([
          { hosting_provider_id: "p1", recent: 10, previous: 40 },
          { hosting_provider_id: "p2", recent: 30, previous: 20 },
        ]);
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });

    const res = await handleDashboardProviders(req("https://averrow.com/api/dashboard/providers?sort=worst"), env);
    expect(res.status).toBe(200);
    const body = await bodyOf(res);

    // No query may scan the raw threats table.
    expect(calls.some((s) => /FROM threats/.test(s))).toBe(false);
    // The count comes from the pre-computed column.
    expect(calls.some((s) => /total_threat_count/.test(s))).toBe(true);
    // The trend comes from the provider cube.
    expect(calls.some((s) => /threat_cube_provider/.test(s))).toBe(true);

    expect(body.data[0]).toEqual({
      provider_id: "p1",
      name: "ProvOne",
      asn: "AS1",
      threat_count: 500,
      trend_7d_pct: -75.0,
    });
    expect(body.data[1]!.trend_7d_pct).toBe(50.0);
  });

  it("returns trend_7d_pct = null when a top provider has no recent cube inflow (previous=0)", async () => {
    const { env } = makeEnv((sql) => {
      if (/total_threat_count > 0/.test(sql)) {
        return result([{ provider_id: "p9", name: "Quiet", asn: null, threat_count: 12 }]);
      }
      if (/threat_cube_provider/.test(sql)) {
        return result([]); // no cube rows for p9
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });

    const res = await handleDashboardProviders(req("https://averrow.com/api/dashboard/providers"), env);
    const body = await bodyOf(res);
    expect(body.data[0]).toEqual({
      provider_id: "p9",
      name: "Quiet",
      asn: null,
      threat_count: 12,
      trend_7d_pct: null,
    });
  });
});

describe("handleDashboardProviders — improving (provider cube)", () => {
  it("reads threat_cube_provider for the recent<previous delta and never scans raw threats", async () => {
    const { env, calls } = makeEnv((sql) => {
      if (/FROM threat_cube_provider/.test(sql) && /HAVING previous > 0 AND recent < previous/.test(sql)) {
        return result([{ hosting_provider_id: "p3", recent: 5, previous: 20 }]);
      }
      if (/SELECT id, name, asn FROM hosting_providers WHERE id IN/.test(sql)) {
        return result([{ id: "p3", name: "ProvThree", asn: "AS3" }]);
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });

    const res = await handleDashboardProviders(req("https://averrow.com/api/dashboard/providers?sort=improving"), env);
    expect(res.status).toBe(200);
    const body = await bodyOf(res);

    expect(calls.some((s) => /FROM threats/.test(s))).toBe(false);
    expect(calls.some((s) => /threat_cube_provider/.test(s))).toBe(true);

    expect(body.data[0]).toEqual({
      provider_id: "p3",
      name: "ProvThree",
      asn: "AS3",
      threat_count: 5, // == recent
      recent: 5,
      previous: 20,
      trend_7d_pct: -75.0,
    });
  });
});

// ─── trends.ts momentum handlers ───────────────────────────────────

describe("handleTrendBrandMomentum — brand cube inflow", () => {
  it("sources this_week/last_week from threat_cube_brand, not a raw threats GROUP BY", async () => {
    const rows = [
      { target_brand_id: "b1", brand_name: "Acme", canonical_domain: "acme.com", this_week: 40, last_week: 10 },
      { target_brand_id: "b2", brand_name: "Globex", canonical_domain: "globex.com", this_week: 12, last_week: 30 },
    ];
    const { env, calls } = makeEnv((sql) => {
      if (/FROM threat_cube_brand/.test(sql)) return result(rows);
      throw new Error(`unexpected SQL: ${sql}`);
    });

    const res = await handleTrendBrandMomentum(req("https://averrow.com/api/trends/brand-momentum"), env);
    expect(res.status).toBe(200);
    const body = await bodyOf(res);

    expect(calls.some((s) => /FROM threats\b/.test(s))).toBe(false);
    expect(calls.some((s) => /threat_cube_brand/.test(s))).toBe(true);
    // Preserves the exact response shape the widget consumes.
    expect(body.data).toEqual(rows);
  });
});

describe("handleTrendProviderMomentum — provider cube inflow", () => {
  it("sources the 7d inflow from threat_cube_provider, not a raw threats GROUP BY", async () => {
    const rows = [
      { provider_id: "p1", provider: "ProvOne", count: 33 },
      { provider_id: "p2", provider: "ProvTwo", count: 9 },
    ];
    const { env, calls } = makeEnv((sql) => {
      if (/FROM threat_cube_provider/.test(sql)) return result(rows);
      throw new Error(`unexpected SQL: ${sql}`);
    });

    const res = await handleTrendProviderMomentum(req("https://averrow.com/api/trends/provider-momentum"), env);
    expect(res.status).toBe(200);
    const body = await bodyOf(res);

    expect(calls.some((s) => /FROM threats\b/.test(s))).toBe(false);
    expect(calls.some((s) => /threat_cube_provider/.test(s))).toBe(true);
    expect(body.data).toEqual(rows);
  });
});
