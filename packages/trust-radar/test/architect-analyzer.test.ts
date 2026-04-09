/**
 * ARCHITECT Phase 2 analyzer regression tests.
 *
 * Two tests covering the two failure modes that stranded rows in
 * production before the tool_use guard fix. The orchestrator-level
 * timeout / finally-backstop tests that used to live here were
 * removed when the analyzer execution moved from in-process
 * Promise.allSettled to Cloudflare Queues — the orchestrator no
 * longer awaits analyzer calls so there is no timeout race or
 * finally backstop to test. Queue path tests live in
 * src/agents/architect/analysis/__tests__/.
 *
 * 1. Happy path: the analyzer parses a tool_use block straight out of
 *    content[i].input without any string manipulation.
 * 2. Truncation: stop_reason === "max_tokens" throws a clear error and
 *    never attempts to read a (missing or partial) tool_use block.
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
