/**
 * ARCHITECT Phase 2 analyzer + orchestrator regression tests.
 *
 * These four tests cover the four failure modes that stranded rows
 * in production before the tool_use / timeout / finally-guard fix:
 *
 * 1. Happy path: the analyzer parses a tool_use block straight out of
 *    content[i].input without any string manipulation.
 * 2. Truncation: stop_reason === "max_tokens" throws a clear error and
 *    never attempts to read a (missing or partial) tool_use block.
 * 3. Hang: a never-resolving analyzer is killed by the orchestrator's
 *    90s race (100ms in tests) and the row is marked failed with
 *    'analyzer_timeout'.
 * 4. Stranded: a failure between insertPendingRow and the per-section
 *    updates leaves pending rows, and the finally block backstop
 *    flips them to 'failed' so nothing is stuck.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

import { analyzeAgents } from "../src/agents/architect/analysis/analyzer";
import { runAnalysis } from "../src/agents/architect/analysis/orchestrator";
import type { ContextBundle } from "../src/agents/architect/types";
import type { AgentsAnalysis } from "../src/agents/architect/analysis/types";

// ─── Fixture loader ────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_PATH = resolve(
  __dirname,
  "../../../docs/architect/samples/minimal-bundle.json",
);

function loadMinimalBundle(): ContextBundle {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  return JSON.parse(raw) as ContextBundle;
}

// ─── Canned Anthropic responses ────────────────────────────────────

const CANNED_AGENTS_INPUT: AgentsAnalysis = {
  section: "agents",
  summary:
    "Cartographer and sentinel are healthy. Nexus is broken: 42/42 failures with CPU timeout.",
  scorecard: { green: 2, amber: 0, red: 1 },
  assessments: [
    {
      name: "sentinel",
      severity: "green",
      recommendation: "keep",
      rationale: "336 runs, 0 failures, stable duration.",
      evidence: ["runs_7d=336", "failures_7d=0"],
      concerns: [],
      suggested_actions: [],
    },
    {
      name: "cartographer",
      severity: "green",
      recommendation: "keep",
      rationale: "670/672 success rate over 7d, AI spend in line.",
      evidence: ["successes_7d=670", "failures_7d=2", "ai_cost=$0.42"],
      concerns: [],
      suggested_actions: [],
    },
    {
      name: "nexus",
      severity: "red",
      recommendation: "refactor",
      rationale:
        "42/42 failures with 'Worker exceeded CPU time limit' — ghost rows, sustained CPU exhaustion.",
      evidence: [
        "runs_7d=42",
        "successes_7d=0",
        "last_error='Worker exceeded CPU time limit'",
      ],
      concerns: ["CPU budget exhausted every run"],
      suggested_actions: ["Split nexus into smaller workers"],
    },
  ],
  cross_cutting_concerns: [
    "CPU-heavy agents lack chunked processing",
  ],
};

function buildToolUseResponse(input: unknown) {
  return {
    id: "msg_test",
    model: "claude-haiku-4-5-20251001",
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        id: "toolu_test",
        name: "report_agents_analysis",
        input,
      },
    ],
    usage: { input_tokens: 1800, output_tokens: 900 },
  };
}

function buildMaxTokensResponse() {
  return {
    id: "msg_test",
    model: "claude-haiku-4-5-20251001",
    stop_reason: "max_tokens",
    content: [
      // A truncated / partial tool_use — important: the analyzer must
      // NOT try to read this. We put garbage here to guarantee that
      // reading it would fail loudly if the stop_reason guard were
      // missing.
      { type: "text", text: "(partial response, truncated)" },
    ],
    usage: { input_tokens: 1800, output_tokens: 8192 },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ─── Shared env ────────────────────────────────────────────────────

function makeAnalyzerEnv() {
  return {
    ANTHROPIC_API_KEY: "sk-ant-test",
    LRX_API_KEY: undefined,
    CF_ACCOUNT_ID: undefined,
  } as any;
}

// ─── Test 1: tool_use parse (no string manipulation) ───────────────

describe("analyzer — tool_use happy path", () => {
  let fetchSpy: Mock;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the tool_use input field directly without string manipulation", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(buildToolUseResponse(CANNED_AGENTS_INPUT)),
    );

    const bundle = loadMinimalBundle();
    const result = await analyzeAgents(bundle, makeAnalyzerEnv());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // The body sent must include the tool + tool_choice to force the
    // structured output path.
    const fetchCall = fetchSpy.mock.calls[0]!;
    const sentBody = JSON.parse(fetchCall[1].body as string);
    expect(sentBody.tools).toHaveLength(1);
    expect(sentBody.tools[0].name).toBe("report_agents_analysis");
    expect(sentBody.tool_choice).toEqual({
      type: "tool",
      name: "report_agents_analysis",
    });

    // The returned analysis is the tool_use.input verbatim, validated
    // by the hand-rolled schema guard.
    expect(result.analysis.section).toBe("agents");
    expect(result.analysis.scorecard).toEqual({ green: 2, amber: 0, red: 1 });
    expect(result.analysis.assessments).toHaveLength(3);
    expect(result.analysis.assessments[2]!.severity).toBe("red");
    expect(result.analysis.assessments[2]!.name).toBe("nexus");
    expect(result.input_tokens).toBe(1800);
    expect(result.output_tokens).toBe(900);
  });
});

// ─── Test 2: stop_reason=max_tokens surfaces cleanly ───────────────

describe("analyzer — stop_reason=max_tokens", () => {
  let fetchSpy: Mock;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws an error containing 'max_tokens' and does not read content as tool_use", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(buildMaxTokensResponse()));

    const bundle = loadMinimalBundle();
    await expect(analyzeAgents(bundle, makeAnalyzerEnv())).rejects.toThrow(
      /max_tokens/,
    );
  });
});

// ─── Mock D1 for orchestrator tests ────────────────────────────────

interface RecordedStatement {
  sql: string;
  params: unknown[];
}

interface MockRow {
  id: string;
  run_id: string;
  section: string;
  status: "pending" | "analyzing" | "complete" | "failed";
  error_message: string | null;
  duration_ms: number | null;
}

function makeMockDb(options: {
  reportRow?: { run_id: string; status: string; context_bundle_r2_key: string } | null;
  failInsertAfter?: number; // if set, the Nth insertPendingRow call throws
} = {}) {
  const rows = new Map<string, MockRow>();
  const rowsByRunId = new Map<string, Set<string>>();
  const statements: RecordedStatement[] = [];
  let insertCount = 0;

  const report = options.reportRow ?? {
    run_id: "test-run-0001",
    status: "complete",
    context_bundle_r2_key: "bundles/test-run-0001.json",
  };

  function prepare(sql: string) {
    return {
      bind(...params: unknown[]) {
        statements.push({ sql, params });
        return {
          async first<T>(): Promise<T | null> {
            if (sql.includes("FROM architect_reports")) {
              return report as unknown as T;
            }
            return null;
          },
          async run() {
            if (sql.includes("INSERT INTO architect_analyses")) {
              insertCount += 1;
              if (
                options.failInsertAfter !== undefined &&
                insertCount > options.failInsertAfter
              ) {
                throw new Error(
                  `mock D1: synthetic insert failure (insert #${insertCount})`,
                );
              }
              const [id, run_id, , section] = params as [
                string,
                string,
                number,
                string,
              ];
              const row: MockRow = {
                id,
                run_id,
                section,
                status: "pending",
                error_message: null,
                duration_ms: null,
              };
              rows.set(id, row);
              const set = rowsByRunId.get(run_id) ?? new Set<string>();
              set.add(id);
              rowsByRunId.set(run_id, set);
              return { success: true, meta: {} };
            }
            if (
              sql.includes("UPDATE architect_analyses") &&
              sql.includes("status = 'failed'") &&
              sql.includes("WHERE run_id = ?")
            ) {
              // Finally backstop: flip stranded rows for this run.
              const [runId] = params as [string];
              const ids = rowsByRunId.get(runId) ?? new Set<string>();
              for (const id of ids) {
                const row = rows.get(id);
                if (row && (row.status === "pending" || row.status === "analyzing")) {
                  row.status = "failed";
                  row.error_message =
                    "orchestrator_exited_in_indeterminate_state";
                }
              }
              return { success: true, meta: {} };
            }
            if (
              sql.includes("UPDATE architect_analyses") &&
              sql.includes("status = 'analyzing'")
            ) {
              const [id] = params as [string];
              const row = rows.get(id);
              if (row) row.status = "analyzing";
              return { success: true, meta: {} };
            }
            if (
              sql.includes("UPDATE architect_analyses") &&
              sql.includes("status = 'complete'")
            ) {
              const id = params[params.length - 1] as string;
              const row = rows.get(id);
              if (row) row.status = "complete";
              return { success: true, meta: {} };
            }
            if (
              sql.includes("UPDATE architect_analyses") &&
              sql.includes("status = 'failed'")
            ) {
              const [errorMessage, durationMs, id] = params as [
                string,
                number | null,
                string,
              ];
              const row = rows.get(id);
              if (row) {
                row.status = "failed";
                row.error_message = errorMessage;
                row.duration_ms = durationMs;
              }
              return { success: true, meta: {} };
            }
            return { success: true, meta: {} };
          },
        };
      },
    };
  }

  return {
    db: { prepare } as unknown as D1Database,
    rows,
    statements,
  };
}

function makeMockR2(bundle: ContextBundle) {
  return {
    async get(_key: string) {
      return {
        async json() {
          return bundle;
        },
      };
    },
  } as unknown as R2Bucket;
}

// ─── Test 3: orchestrator hard timeout race ────────────────────────

describe("orchestrator — analyzer timeout race", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("../src/agents/architect/analysis/analyzer");
  });

  it(
    "rejects a never-resolving analyzer via the configurable timeout and marks the row failed with analyzer_timeout",
    async () => {
      // Stub the analyzer module so every section call returns a
      // promise that never resolves — this models a hung Anthropic
      // request upstream.
      vi.doMock("../src/agents/architect/analysis/analyzer", () => ({
        analyzeAgents: vi.fn(() => new Promise(() => {})),
        analyzeFeeds: vi.fn(() => new Promise(() => {})),
        analyzeDataLayer: vi.fn(() => new Promise(() => {})),
      }));

      // Re-import under the mock.
      const { runAnalysis: runAnalysisMocked } = await import(
        "../src/agents/architect/analysis/orchestrator"
      );

      const bundle = loadMinimalBundle();
      const mock = makeMockDb();
      const env = {
        DB: mock.db,
        ARCHITECT_BUNDLES: makeMockR2(bundle),
        ANTHROPIC_API_KEY: "sk-ant-test",
        LRX_API_KEY: undefined,
        CF_ACCOUNT_ID: undefined,
      } as any;

      const startedAt = Date.now();
      const result = await runAnalysisMocked("test-run-0001", env, {
        analyzerTimeoutMs: 100,
      });
      const elapsedMs = Date.now() - startedAt;

      // The whole run should wrap up in well under a second despite
      // the analyzers hanging forever — that is the timeout doing
      // its job.
      expect(elapsedMs).toBeLessThan(2000);

      expect(result.sections).toHaveLength(3);
      for (const section of result.sections) {
        expect(section.status).toBe("failed");
        expect(section.error_message).toMatch(/analyzer_timeout/);
      }

      // Every row in the mock DB is in a terminal state — none left
      // in pending/analyzing.
      for (const row of mock.rows.values()) {
        expect(row.status).toBe("failed");
        expect(row.error_message).toMatch(/analyzer_timeout/);
      }
    },
    5_000,
  );
});

// ─── Test 4: finally backstop flips stranded rows ──────────────────

describe("orchestrator — finally backstop on stranded rows", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("../src/agents/architect/analysis/analyzer");
  });

  it(
    "flips pending rows to failed when runAnalysis throws before the per-section updates run",
    async () => {
      // Mock analyzer so it wouldn't have a chance to be called —
      // the third insertPendingRow will throw first.
      vi.doMock("../src/agents/architect/analysis/analyzer", () => ({
        analyzeAgents: vi.fn(() => {
          throw new Error("should not be called");
        }),
        analyzeFeeds: vi.fn(() => {
          throw new Error("should not be called");
        }),
        analyzeDataLayer: vi.fn(() => {
          throw new Error("should not be called");
        }),
      }));

      const { runAnalysis: runAnalysisMocked } = await import(
        "../src/agents/architect/analysis/orchestrator"
      );

      const bundle = loadMinimalBundle();
      // First 2 inserts succeed, 3rd one throws — simulating a D1
      // glitch after rows are partially created. The happy path
      // then never gets to run; the finally block is the only
      // thing standing between us and stranded rows.
      const mock = makeMockDb({ failInsertAfter: 2 });
      const env = {
        DB: mock.db,
        ARCHITECT_BUNDLES: makeMockR2(bundle),
        ANTHROPIC_API_KEY: "sk-ant-test",
        LRX_API_KEY: undefined,
        CF_ACCOUNT_ID: undefined,
      } as any;

      await expect(
        runAnalysisMocked("test-run-0001", env, { analyzerTimeoutMs: 100 }),
      ).rejects.toThrow(/synthetic insert failure/);

      // Two pending rows were inserted, then the third insert threw.
      // The finally backstop must have flipped the 2 surviving rows
      // to failed with 'orchestrator_exited_in_indeterminate_state'.
      const rows = [...mock.rows.values()];
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.status).toBe("failed");
        expect(row.error_message).toBe(
          "orchestrator_exited_in_indeterminate_state",
        );
      }

      // And the cleanup statement itself actually ran — grep the
      // recorded SQL to be sure the finally path fired.
      const cleanupRan = mock.statements.some(
        (s) =>
          s.sql.includes("UPDATE architect_analyses") &&
          s.sql.includes("status = 'failed'") &&
          s.sql.includes("WHERE run_id = ?"),
      );
      expect(cleanupRan).toBe(true);
    },
    5_000,
  );
});
