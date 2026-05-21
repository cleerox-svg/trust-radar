/**
 * Tests for cube_healer hot/cold scope selection (PR-BM).
 *
 * Verifies:
 *   - pickHealScope() picks 'cold' at UTC hour 0, 'hot' otherwise.
 *   - healSQLForTest() embeds the right window literal for each scope.
 *   - The five cube SQLs (geo/provider/brand/status/arcs) all carry
 *     the same window — no drift between cubes within one tick.
 */

import { describe, it, expect } from "vitest";
import {
  pickHealScope,
  healSQLForTest,
  HOT_HEAL_WINDOW_DAYS,
  COLD_HEAL_WINDOW_DAYS,
} from "../src/agents/cube-healer";

describe("pickHealScope", () => {
  it("picks 'cold' at UTC hour 0 (the 00:12 cron tick)", () => {
    expect(pickHealScope(new Date("2026-05-21T00:12:00Z"))).toBe("cold");
  });

  it("picks 'hot' at every non-zero UTC hour", () => {
    expect(pickHealScope(new Date("2026-05-21T06:12:00Z"))).toBe("hot");
    expect(pickHealScope(new Date("2026-05-21T12:12:00Z"))).toBe("hot");
    expect(pickHealScope(new Date("2026-05-21T18:12:00Z"))).toBe("hot");
  });

  it("ignores local timezone — only UTC hour matters", () => {
    // 19:12 EST is 00:12 UTC the next day — UTC 0 wins, picks cold.
    expect(pickHealScope(new Date("2026-05-21T00:12:00Z"))).toBe("cold");
    // 00:12 EST is 05:12 UTC — UTC 5 → hot.
    expect(pickHealScope(new Date("2026-05-21T05:12:00Z"))).toBe("hot");
  });

  it("treats minutes/seconds within hour-0 as cold (cron jitter tolerance)", () => {
    expect(pickHealScope(new Date("2026-05-21T00:00:00Z"))).toBe("cold");
    expect(pickHealScope(new Date("2026-05-21T00:59:59Z"))).toBe("cold");
  });
});

describe("healSQL window selection", () => {
  const tables = ["geo", "provider", "brand", "status", "arcs"] as const;

  it("hot scope embeds the 2-day window literal", () => {
    for (const t of tables) {
      const sql = healSQLForTest(t, "hot");
      expect(sql).toContain(`datetime('now', '-${HOT_HEAL_WINDOW_DAYS} days')`);
      expect(sql).not.toContain(`datetime('now', '-${COLD_HEAL_WINDOW_DAYS} days')`);
    }
  });

  it("cold scope embeds the 14-day window literal", () => {
    for (const t of tables) {
      const sql = healSQLForTest(t, "cold");
      expect(sql).toContain(`datetime('now', '-${COLD_HEAL_WINDOW_DAYS} days')`);
      expect(sql).not.toContain(`datetime('now', '-${HOT_HEAL_WINDOW_DAYS} days')`);
    }
  });

  it("hot and cold differ only in the window literal", () => {
    for (const t of tables) {
      const hot = healSQLForTest(t, "hot");
      const cold = healSQLForTest(t, "cold");
      const hotNormalized = hot.replace(`-${HOT_HEAL_WINDOW_DAYS} days`, "WINDOW");
      const coldNormalized = cold.replace(`-${COLD_HEAL_WINDOW_DAYS} days`, "WINDOW");
      expect(hotNormalized).toBe(coldNormalized);
    }
  });

  it("every cube targets the correct destination table", () => {
    expect(healSQLForTest("geo", "hot")).toContain("INSERT OR REPLACE INTO threat_cube_geo");
    expect(healSQLForTest("provider", "hot")).toContain("INSERT OR REPLACE INTO threat_cube_provider");
    expect(healSQLForTest("brand", "hot")).toContain("INSERT OR REPLACE INTO threat_cube_brand");
    expect(healSQLForTest("status", "hot")).toContain("INSERT OR REPLACE INTO threat_cube_status");
    expect(healSQLForTest("arcs", "hot")).toContain("INSERT OR REPLACE INTO threat_cube_arcs");
  });

  it("status heal has NO status='active' filter (only reconciles status mutations)", () => {
    const sql = healSQLForTest("status", "hot");
    expect(sql).not.toMatch(/AND status = 'active'/);
  });

  it("geo/provider/brand/arcs healers all filter on status='active'", () => {
    for (const t of ["geo", "provider", "brand", "arcs"] as const) {
      expect(healSQLForTest(t, "hot")).toContain("AND status = 'active'");
    }
  });

  it("arcs heal aggregates source_lat/source_lng + first_seen/last_seen", () => {
    const sql = healSQLForTest("arcs", "cold");
    expect(sql).toContain("ROUND(AVG(lat), 1)");
    expect(sql).toContain("ROUND(AVG(lng), 1)");
    expect(sql).toContain("MIN(created_at)");
    expect(sql).toContain("MAX(created_at)");
  });

  it("HOT_HEAL_WINDOW_DAYS < COLD_HEAL_WINDOW_DAYS (sanity)", () => {
    expect(HOT_HEAL_WINDOW_DAYS).toBeLessThan(COLD_HEAL_WINDOW_DAYS);
  });

  it("write reduction sanity: 3 hot + 1 cold per day << 4 cold per day", () => {
    // 4 daily ticks. Pre-PR-BM was 4 × COLD; now is 3 × HOT + 1 × COLD.
    const preDays = 4 * COLD_HEAL_WINDOW_DAYS;
    const postDays = 3 * HOT_HEAL_WINDOW_DAYS + 1 * COLD_HEAL_WINDOW_DAYS;
    // Expect at least a 50% reduction in cumulative window-days/day.
    expect(postDays).toBeLessThan(preDays * 0.5);
  });
});
