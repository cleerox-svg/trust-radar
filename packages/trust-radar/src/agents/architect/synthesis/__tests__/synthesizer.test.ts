/**
 * ARCHITECT Phase 3 — synthesiser regression tests.
 *
 * Three tests covering the three terminal paths through synthesize():
 *
 * 1. Happy: fetch mock returns a canned tool_use response with valid
 *    markdown, all three Phase 2 rows are complete, the call resolves
 *    with { report_md, computed_scorecard, usage } and the scorecard
 *    is derived from the fixture assessments.
 * 2. max_tokens: fetch mock returns a response with
 *    stop_reason='max_tokens' — synthesize() throws with a clear
 *    error mentioning max_tokens so the HTTP route's catch block can
 *    write that verbatim to architect_syntheses.error_message.
 * 3. not-ready: one of the three rows is still in status='pending' —
 *    synthesize() throws with an error matching /analyses_not_ready/
 *    before ever calling the Sonnet API.
 *
 * We mock D1 directly (no module-level vi.doMock) and stub global
 * fetch so the synthesiser's transport layer is exercised end-to-end
 * except for the network hop. R2 is left null so loadBundleTotals()
 * takes its best-effort branch — the happy test doesn't need bundle
 * totals to assert the returned scorecard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type {
  AgentsAnalysis,
  ArchitectAnalysisRow,
  DataLayerAnalysis,
  FeedsAnalysis,
} from "../../analysis/types";
import { synthesize, type SynthesizerEnv } from "../synthesizer";

// ─── Shared fixtures ───────────────────────────────────────────────

const AGENTS_ANALYSIS: AgentsAnalysis = {
  section: "agents",
  summary: "Agents.",
  scorecard: { green: 0, amber: 0, red: 0 },
  assessments: [
    {
      name: "sentinel",
      severity: "green",
      recommendation: "keep",
      rationale: "Healthy.",
      evidence: ["runs_7d=336"],
      concerns: [],
      suggested_actions: [],
    },
    {
      name: "observer",
      severity: "red",
      recommendation: "kill",
      rationale: "Dead.",
      evidence: ["runs_7d=0"],
      concerns: [],
      suggested_actions: [],
    },
  ],
  cross_cutting_concerns: [],
};

const FEEDS_ANALYSIS: FeedsAnalysis = {
  section: "feeds",
  summary: "Feeds.",
  scorecard: { green: 0, amber: 0, red: 0 },
  assessments: [
    {
      name: "phishtank",
      severity: "green",
      recommendation: "keep",
      rationale: "Healthy.",
      evidence: ["enabled=1"],
      concerns: [],
      suggested_actions: [],
    },
  ],
  cross_cutting_concerns: [],
};

const DATA_LAYER_ANALYSIS: DataLayerAnalysis = {
  section: "data_layer",
  summary: "Data.",
  scorecard: { green: 0, amber: 0, red: 0 },
  assessments: [
    {
      name: "threats",
      severity: "amber",
      recommendation: "refactor",
      rationale: "Growing.",
      evidence: ["rows=113000"],
      concerns: [],
      suggested_actions: [],
      scale_risk: "medium",
    },
  ],
  hot_tables: [],
  scale_bottlenecks: [],
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

// ─── Mock D1 ───────────────────────────────────────────────────────
//
// Just enough surface area for the synthesiser: loadAnalyses() issues
// an `all()` against architect_analyses with a WHERE run_id = ?, and
// loadBundleTotals() issues a `first()` against architect_reports. We
// return the seeded rows for the first and null for the second so
// loadBundleTotals takes its "no bundle key" best-effort branch.

function makeMockDb(rows: ArchitectAnalysisRow[]): D1Database {
  function prepare(sql: string) {
    return {
      bind(..._params: unknown[]) {
        return {
          async first<T>(): Promise<T | null> {
            if (sql.includes("FROM architect_reports")) {
              // No bundle key — loadBundleTotals short-circuits and
              // returns null, which is fine for these tests.
              return null;
            }
            return null;
          },
          async all<T>(): Promise<{ results: T[]; success: true; meta: Record<string, unknown> }> {
            if (sql.includes("FROM architect_analyses")) {
              return {
                results: rows as unknown as T[],
                success: true,
                meta: {},
              };
            }
            return { results: [] as T[], success: true, meta: {} };
          },
          async run() {
            return { success: true, meta: {} };
          },
        };
      },
    };
  }
  return { prepare } as unknown as D1Database;
}

function makeEnv(db: D1Database): SynthesizerEnv {
  return {
    DB: db,
    ARCHITECT_BUNDLES: undefined,
    ANTHROPIC_API_KEY: "sk-ant-test",
    LRX_API_KEY: undefined,
    CF_ACCOUNT_ID: undefined,
  } as unknown as SynthesizerEnv;
}

// ─── fetch mock helpers ────────────────────────────────────────────

function mockFetchOnce(response: unknown, status = 200): void {
  const fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
}

function toolUseResponse(reportMd: string) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-5-20250929",
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        id: "tool_test",
        name: "report_synthesis_markdown",
        input: { report_md: reportMd },
      },
    ],
    usage: { input_tokens: 4200, output_tokens: 2100 },
  };
}

function maxTokensResponse() {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-5-20250929",
    stop_reason: "max_tokens",
    content: [
      {
        type: "text",
        text: "truncated mid-markdown...",
      },
    ],
    usage: { input_tokens: 4200, output_tokens: 20_480 },
  };
}

// ─── Test fixtures reset between tests ────────────────────────────

describe("synthesize — happy path", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns { report_md, computed_scorecard, usage } when Sonnet returns a tool_use block", async () => {
    const db = makeMockDb([
      asRow("agents", AGENTS_ANALYSIS),
      asRow("feeds", FEEDS_ANALYSIS),
      asRow("data_layer", DATA_LAYER_ANALYSIS),
    ]);
    const env = makeEnv(db);

    const fakeMarkdown = "# ARCHITECT Audit — 2026-04-09\n\n## Executive Summary\n\nAll good.";
    mockFetchOnce(toolUseResponse(fakeMarkdown));

    const result = await synthesize("test-run", env);

    expect(result.report_md).toBe(fakeMarkdown);

    // Scorecard matches the assessments above:
    // - agents: 1 green (sentinel) + 1 red (observer)
    // - feeds: 1 green (phishtank)
    // - data_layer: 1 amber (threats)
    expect(result.computed_scorecard.agents).toEqual({
      green: 1,
      amber: 0,
      red: 1,
      total: 2,
    });
    expect(result.computed_scorecard.feeds).toEqual({
      green: 1,
      amber: 0,
      red: 0,
      total: 1,
    });
    expect(result.computed_scorecard.data_layer).toEqual({
      green: 0,
      amber: 1,
      red: 0,
      total: 1,
    });
    expect(result.computed_scorecard.overall).toEqual({
      green: 2,
      amber: 1,
      red: 1,
      total: 4,
    });
    expect(result.computed_scorecard.kill_count).toBe(1);

    // Usage is populated from the mocked response.
    expect(result.usage.input_tokens).toBe(4200);
    expect(result.usage.output_tokens).toBe(2100);
    expect(result.usage.model).toBe("claude-sonnet-4-5-20250929");
    // 4200 * 3 / 1e6 + 2100 * 15 / 1e6 = 0.0126 + 0.0315 = 0.0441
    expect(result.usage.cost_usd).toBeCloseTo(0.0441, 4);
  });
});

describe("synthesize — max_tokens permanent failure", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws with a max_tokens-tagged error when Sonnet hits the output cap", async () => {
    const db = makeMockDb([
      asRow("agents", AGENTS_ANALYSIS),
      asRow("feeds", FEEDS_ANALYSIS),
      asRow("data_layer", DATA_LAYER_ANALYSIS),
    ]);
    const env = makeEnv(db);

    mockFetchOnce(maxTokensResponse());

    await expect(synthesize("test-run", env)).rejects.toThrow(/max_tokens/);
  });
});

describe("synthesize — analyses_not_ready", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws analyses_not_ready without calling the Sonnet API when a row is still pending", async () => {
    const db = makeMockDb([
      asRow("agents", AGENTS_ANALYSIS),
      // Feeds row still pending — this is the blocker we want to
      // catch before burning tokens on a half-ready run.
      asRow("feeds", FEEDS_ANALYSIS, "pending"),
      asRow("data_layer", DATA_LAYER_ANALYSIS),
    ]);
    const env = makeEnv(db);

    // Pre-stub fetch so we can assert it was never called. If the
    // preflight fires first, this mock should see zero invocations.
    const fetchMock = vi.fn(async () => {
      throw new Error("fetch should not be called when analyses are not ready");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(synthesize("test-run", env)).rejects.toThrow(
      /analyses_not_ready/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
