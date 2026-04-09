/**
 * ARCHITECT Phase 3 — scorecard unit tests.
 *
 * Feeds a fixture set of three architect_analyses rows into
 * computeScorecard and asserts the per-section + overall counts and
 * the cross-section recommendation tallies (kill / refactor / split).
 *
 * The fixtures are intentionally small and hand-written so every
 * severity tag and every recommendation is visible in the test body —
 * if the scorecard logic ever regresses, the failing assertion will
 * tell you exactly which row + field it's miscounting.
 */

import { describe, it, expect } from "vitest";

import type {
  AgentsAnalysis,
  ArchitectAnalysisRow,
  DataLayerAnalysis,
  FeedsAnalysis,
} from "../../analysis/types";
import { computeScorecard } from "../scorecard";

// ─── Fixture analyses ──────────────────────────────────────────────

const AGENTS_ANALYSIS: AgentsAnalysis = {
  section: "agents",
  summary: "Agents section mixed.",
  // Deliberately wrong self-reported numbers — computeScorecard must
  // ignore these and derive from the assessments array instead.
  scorecard: { green: 99, amber: 99, red: 99 },
  assessments: [
    {
      name: "sentinel",
      severity: "green",
      recommendation: "keep",
      rationale: "Healthy.",
      evidence: ["runs_7d=336", "failures_7d=0"],
      concerns: [],
      suggested_actions: [],
    },
    {
      name: "cartographer",
      severity: "amber",
      recommendation: "refactor",
      rationale: "Drift.",
      evidence: ["avg_duration_ms=9800"],
      concerns: ["slow"],
      suggested_actions: ["add index"],
    },
    {
      name: "observer",
      severity: "red",
      recommendation: "kill",
      rationale: "Dead code.",
      evidence: ["runs_7d=0"],
      concerns: ["never fires"],
      suggested_actions: ["delete file"],
    },
  ],
  cross_cutting_concerns: [],
};

const FEEDS_ANALYSIS: FeedsAnalysis = {
  section: "feeds",
  summary: "Feeds section mostly amber.",
  scorecard: { green: 0, amber: 0, red: 0 },
  assessments: [
    {
      name: "phishtank",
      severity: "green",
      recommendation: "keep",
      rationale: "pulls_7d=168 successes_7d=168.",
      evidence: ["enabled=1", "pulls_7d=168"],
      concerns: [],
      suggested_actions: [],
    },
    {
      name: "legacy_xyz",
      severity: "amber",
      recommendation: "kill",
      rationale: "enabled=0, orphan config.",
      evidence: ["enabled=0"],
      concerns: [],
      suggested_actions: ["drop feed_configs row"],
    },
  ],
  cross_cutting_concerns: [],
};

const DATA_LAYER_ANALYSIS: DataLayerAnalysis = {
  section: "data_layer",
  summary: "Data layer is noisy.",
  scorecard: { green: 0, amber: 0, red: 0 },
  assessments: [
    {
      name: "threats",
      severity: "red",
      recommendation: "split",
      rationale: "113k rows, one fat table.",
      evidence: ["rows=113000", "growth_7d_pct=8.2"],
      concerns: ["index pressure"],
      suggested_actions: ["split by month"],
      scale_risk: "high",
    },
    {
      name: "brands",
      severity: "amber",
      recommendation: "refactor",
      rationale: "Missing indexes.",
      evidence: ["rows=9652"],
      concerns: [],
      suggested_actions: ["add index"],
      scale_risk: "medium",
    },
    {
      name: "alerts",
      severity: "amber",
      recommendation: "refactor",
      rationale: "Needs pruning.",
      evidence: ["rows=5000"],
      concerns: [],
      suggested_actions: ["add TTL"],
      scale_risk: "low",
    },
    {
      name: "misc_logs",
      severity: "green",
      recommendation: "keep",
      rationale: "Small.",
      evidence: ["rows=20"],
      concerns: [],
      suggested_actions: [],
      scale_risk: "low",
    },
  ],
  hot_tables: ["threats", "brands"],
  scale_bottlenecks: ["threats"],
  cross_cutting_concerns: [],
};

function asRow(
  section: "agents" | "feeds" | "data_layer",
  analysis: unknown,
  status: ArchitectAnalysisRow["status"] = "complete",
): ArchitectAnalysisRow {
  return {
    id: `row-${section}`,
    run_id: "test-run",
    created_at: 1,
    section,
    status,
    model: "claude-haiku-4-5-20251001",
    input_tokens: 1,
    output_tokens: 1,
    cost_usd: 0.001,
    duration_ms: 1,
    analysis_json: JSON.stringify(analysis),
    error_message: null,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("computeScorecard", () => {
  it("counts severities per section and overall from the assessments arrays", () => {
    const rows: ArchitectAnalysisRow[] = [
      asRow("agents", AGENTS_ANALYSIS),
      asRow("feeds", FEEDS_ANALYSIS),
      asRow("data_layer", DATA_LAYER_ANALYSIS),
    ];

    const result = computeScorecard(rows);

    // Agents: 1 green (sentinel), 1 amber (cartographer), 1 red
    // (observer). The fake 99/99/99 scorecard in the fixture above
    // must be ignored entirely.
    expect(result.agents).toEqual({
      green: 1,
      amber: 1,
      red: 1,
      total: 3,
    });

    // Feeds: 1 green (phishtank), 1 amber (legacy_xyz), 0 red.
    expect(result.feeds).toEqual({
      green: 1,
      amber: 1,
      red: 0,
      total: 2,
    });

    // Data layer: 1 green (misc_logs), 2 amber (brands, alerts),
    // 1 red (threats).
    expect(result.data_layer).toEqual({
      green: 1,
      amber: 2,
      red: 1,
      total: 4,
    });

    // Overall is the column-wise sum.
    expect(result.overall).toEqual({
      green: 3,
      amber: 4,
      red: 2,
      total: 9,
    });
  });

  it("counts kill / refactor / split recommendations across every section", () => {
    const rows: ArchitectAnalysisRow[] = [
      asRow("agents", AGENTS_ANALYSIS),
      asRow("feeds", FEEDS_ANALYSIS),
      asRow("data_layer", DATA_LAYER_ANALYSIS),
    ];

    const result = computeScorecard(rows);

    // Kill: observer (agents) + legacy_xyz (feeds) = 2.
    expect(result.kill_count).toBe(2);
    // Refactor: cartographer (agents) + brands (data_layer) +
    // alerts (data_layer) = 3.
    expect(result.refactor_count).toBe(3);
    // Split: threats (data_layer) only = 1.
    expect(result.split_count).toBe(1);
  });

  it("ignores Haiku's self-reported scorecard (ground truth is the assessments array)", () => {
    const manipulated: AgentsAnalysis = {
      ...AGENTS_ANALYSIS,
      // Wildly wrong self-reported numbers; assertions below prove
      // computeScorecard doesn't read them.
      scorecard: { green: 1000, amber: 1000, red: 1000 },
    };
    const rows: ArchitectAnalysisRow[] = [asRow("agents", manipulated)];

    const result = computeScorecard(rows);
    expect(result.agents.green).toBe(1);
    expect(result.agents.amber).toBe(1);
    expect(result.agents.red).toBe(1);
    expect(result.overall.total).toBe(3);
  });

  it("treats rows with missing / malformed analysis_json as empty", () => {
    const rows: ArchitectAnalysisRow[] = [
      { ...asRow("agents", AGENTS_ANALYSIS), analysis_json: null },
      { ...asRow("feeds", FEEDS_ANALYSIS), analysis_json: "not-json" },
      asRow("data_layer", DATA_LAYER_ANALYSIS),
    ];

    const result = computeScorecard(rows);
    expect(result.agents.total).toBe(0);
    expect(result.feeds.total).toBe(0);
    expect(result.data_layer.total).toBe(4);
    expect(result.overall.total).toBe(4);
  });
});
