/**
 * ARCHITECT Phase 2 consumer regression tests.
 *
 * Three tests covering the three terminal paths through
 * handleAnalysisJob:
 *
 * 1. Happy: analyzer resolves, row flipped to complete, msg.ack() called.
 * 2. Transient failure: analyzer throws something classified as
 *    transient (Anthropic 503), row marked failed, msg.retry() called.
 * 3. Permanent failure: analyzer throws something classified as
 *    permanent (stop_reason='max_tokens'), row marked failed,
 *    msg.ack() called (not retry — we don't want to burn retries
 *    on things a retry can't fix).
 *
 * Plus direct unit coverage of the isTransientError classifier so
 * its behaviour is observable without having to thread errors
 * through the full consumer flow.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

import { isTransientError } from "../consumer";
import type { AnalysisJobMessage } from "../queue-types";
import type { AgentsAnalysis } from "../types";

// ─── Shared fixtures ───────────────────────────────────────────────

const CANNED_AGENTS_ANALYSIS: AgentsAnalysis = {
  section: "agents",
  summary: "All green for the mock bundle.",
  scorecard: { green: 1, amber: 0, red: 0 },
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
  ],
  cross_cutting_concerns: [],
};

// Minimal bundle shape the consumer's loadBundleFromR2 accepts — we
// bypass the real loader because the mocked analyzer never reads it,
// but bundle_version=1 is checked by the loader itself.
const MINIMAL_BUNDLE = { bundle_version: 1 } as unknown;

// ─── Mock helpers ──────────────────────────────────────────────────

interface MockRow {
  run_id: string;
  section: string;
  status: "pending" | "analyzing" | "complete" | "failed";
  error_message: string | null;
  duration_ms: number | null;
  analysis_json: string | null;
}

interface MockDbHandle {
  db: D1Database;
  rows: Map<string, MockRow>; // keyed by `${run_id}::${section}`
  statements: Array<{ sql: string; params: unknown[] }>;
}

function makeMockDb(
  seed: Array<Pick<MockRow, "run_id" | "section" | "status">>,
): MockDbHandle {
  const rows = new Map<string, MockRow>();
  for (const s of seed) {
    rows.set(`${s.run_id}::${s.section}`, {
      run_id: s.run_id,
      section: s.section,
      status: s.status,
      error_message: null,
      duration_ms: null,
      analysis_json: null,
    });
  }
  const statements: MockDbHandle["statements"] = [];

  function prepare(sql: string) {
    return {
      bind(...params: unknown[]) {
        statements.push({ sql, params });
        return {
          async first<T>(): Promise<T | null> {
            return null as T | null;
          },
          async run() {
            if (
              sql.includes("UPDATE architect_analyses") &&
              sql.includes("status = 'analyzing'")
            ) {
              const [runId, section] = params as [string, string];
              const row = rows.get(`${runId}::${section}`);
              if (row && row.status !== "complete") {
                row.status = "analyzing";
              }
              return { success: true, meta: {} };
            }
            if (
              sql.includes("UPDATE architect_analyses") &&
              sql.includes("status = 'complete'")
            ) {
              // markComplete binds:
              //   model, in_tokens, out_tokens, cost, duration, analysis_json, run_id, section
              const runId = params[params.length - 2] as string;
              const section = params[params.length - 1] as string;
              const analysisJson = params[5] as string;
              const row = rows.get(`${runId}::${section}`);
              if (row) {
                row.status = "complete";
                row.analysis_json = analysisJson;
                row.error_message = null;
              }
              return { success: true, meta: {} };
            }
            if (
              sql.includes("UPDATE architect_analyses") &&
              sql.includes("status = 'failed'")
            ) {
              // markFailed binds: errorMessage, durationMs, run_id, section
              const [errorMessage, durationMs, runId, section] = params as [
                string,
                number,
                string,
                string,
              ];
              const row = rows.get(`${runId}::${section}`);
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

function makeMockR2() {
  return {
    async get(_key: string) {
      return {
        async json() {
          return MINIMAL_BUNDLE;
        },
      };
    },
  } as unknown as R2Bucket;
}

function makeMockMessage(
  body: AnalysisJobMessage,
): {
  msg: Message<AnalysisJobMessage>;
  ack: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
} {
  const ack = vi.fn();
  const retry = vi.fn();
  const msg = {
    id: "msg-test",
    timestamp: new Date(),
    attempts: 1,
    body,
    ack,
    retry,
  } as unknown as Message<AnalysisJobMessage>;
  return { msg, ack, retry };
}

function makeConsumerEnv(db: D1Database) {
  return {
    DB: db,
    ARCHITECT_BUNDLES: makeMockR2(),
    ANTHROPIC_API_KEY: "sk-ant-test",
    LRX_API_KEY: undefined,
    CF_ACCOUNT_ID: undefined,
  } as unknown as Parameters<
    typeof import("../consumer").handleAnalysisJob
  >[1];
}

function seedJob(runId: string): AnalysisJobMessage {
  return {
    run_id: runId,
    section: "agents",
    bundle_r2_key: `bundles/${runId}.json`,
    enqueued_at: Date.now(),
    attempt: 1,
  };
}

// ─── Test 1: happy path ────────────────────────────────────────────

describe("consumer — happy path", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("../analyzer");
  });

  it("runs the analyzer, marks the row complete, and acks the message", async () => {
    vi.doMock("../analyzer", () => ({
      analyzeAgents: vi.fn(async () => ({
        analysis: CANNED_AGENTS_ANALYSIS,
        model: "claude-haiku-4-5-20251001",
        input_tokens: 1800,
        output_tokens: 900,
        cost_usd: 0.0042,
        duration_ms: 5_000,
      })),
      analyzeFeeds: vi.fn(async () => {
        throw new Error("should not be called");
      }),
      analyzeDataLayer: vi.fn(async () => {
        throw new Error("should not be called");
      }),
    }));

    const { handleAnalysisJob } = await import("../consumer");

    const handle = makeMockDb([
      { run_id: "run-happy", section: "agents", status: "pending" },
    ]);
    const env = makeConsumerEnv(handle.db);
    const { msg, ack, retry } = makeMockMessage(seedJob("run-happy"));

    await handleAnalysisJob(msg, env);

    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    const row = handle.rows.get("run-happy::agents")!;
    expect(row.status).toBe("complete");
    expect(row.error_message).toBeNull();
    expect(row.analysis_json).not.toBeNull();
    expect(JSON.parse(row.analysis_json!)).toEqual(CANNED_AGENTS_ANALYSIS);
  });
});

// ─── Test 2: transient failure → retry ─────────────────────────────

describe("consumer — transient failure", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("../analyzer");
  });

  it("marks the row failed and calls msg.retry() on a transient error", async () => {
    vi.doMock("../analyzer", () => ({
      // The analyzer wraps upstream HTTP errors as
      // "ARCHITECT analyzer: Anthropic HTTP <status>: <body>" —
      // isTransientError classifies 503 as transient.
      analyzeAgents: vi.fn(async () => {
        throw new Error(
          "ARCHITECT analyzer: Anthropic HTTP 503: upstream hiccup",
        );
      }),
      analyzeFeeds: vi.fn(),
      analyzeDataLayer: vi.fn(),
    }));

    const { handleAnalysisJob } = await import("../consumer");

    const handle = makeMockDb([
      { run_id: "run-transient", section: "agents", status: "pending" },
    ]);
    const env = makeConsumerEnv(handle.db);
    const { msg, ack, retry } = makeMockMessage(seedJob("run-transient"));

    await handleAnalysisJob(msg, env);

    expect(retry).toHaveBeenCalledTimes(1);
    expect(ack).not.toHaveBeenCalled();

    const row = handle.rows.get("run-transient::agents")!;
    expect(row.status).toBe("failed");
    expect(row.error_message).toMatch(/Anthropic HTTP 503/);
  });
});

// ─── Test 3: permanent failure → ack ───────────────────────────────

describe("consumer — permanent failure", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("../analyzer");
  });

  it("marks the row failed and calls msg.ack() on a permanent error (not retry)", async () => {
    vi.doMock("../analyzer", () => ({
      // stop_reason !== 'tool_use' is a permanent shape-drift error.
      // A retry can't fix a bad response shape.
      analyzeAgents: vi.fn(async () => {
        throw new Error(
          "ARCHITECT analyzer: expected stop_reason='tool_use' but got 'max_tokens'",
        );
      }),
      analyzeFeeds: vi.fn(),
      analyzeDataLayer: vi.fn(),
    }));

    const { handleAnalysisJob } = await import("../consumer");

    const handle = makeMockDb([
      { run_id: "run-permanent", section: "agents", status: "pending" },
    ]);
    const env = makeConsumerEnv(handle.db);
    const { msg, ack, retry } = makeMockMessage(seedJob("run-permanent"));

    await handleAnalysisJob(msg, env);

    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    const row = handle.rows.get("run-permanent::agents")!;
    expect(row.status).toBe("failed");
    expect(row.error_message).toMatch(/stop_reason/);
  });
});

// ─── Test 4: isTransientError classifier unit coverage ────────────

describe("isTransientError", () => {
  it("treats 429 and 5xx as transient", () => {
    expect(
      isTransientError(
        new Error("ARCHITECT analyzer: Anthropic HTTP 429: rate limited"),
      ),
    ).toBe(true);
    expect(
      isTransientError(
        new Error("ARCHITECT analyzer: Anthropic HTTP 500: oops"),
      ),
    ).toBe(true);
    expect(
      isTransientError(
        new Error("ARCHITECT analyzer: Anthropic HTTP 503: overloaded"),
      ),
    ).toBe(true);
  });

  it("treats 4xx (non-429) as permanent", () => {
    expect(
      isTransientError(
        new Error("ARCHITECT analyzer: Anthropic HTTP 401: unauthorized"),
      ),
    ).toBe(false);
    expect(
      isTransientError(
        new Error("ARCHITECT analyzer: Anthropic HTTP 400: bad request"),
      ),
    ).toBe(false);
  });

  it("treats stop_reason / parse / tool_use shape errors as permanent", () => {
    expect(
      isTransientError(
        new Error("ARCHITECT analyzer: expected stop_reason='tool_use'"),
      ),
    ).toBe(false);
    expect(
      isTransientError(
        new Error(
          "ARCHITECT analyzer: failed to parse Anthropic response JSON",
        ),
      ),
    ).toBe(false);
    expect(
      isTransientError(
        new Error("ARCHITECT analyzer: no tool_use block for 'foo'"),
      ),
    ).toBe(false);
  });

  it("treats network errors as transient", () => {
    expect(isTransientError(new Error("fetch failed"))).toBe(true);
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    expect(isTransientError(abortErr)).toBe(true);
  });
});
