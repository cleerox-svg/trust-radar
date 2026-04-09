/**
 * ARCHITECT Phase 2 — Haiku analyzer functions.
 *
 * Three pure-ish functions, one per bundle section, each of which
 * sends ONLY its relevant slice to claude-haiku-4-5-20251001 (don't
 * pay tokens to re-send the whole bundle for every call), and
 * constrains Haiku to call a single `tool_use` tool whose JSON schema
 * mirrors the corresponding TS interface in `./types.ts`.
 *
 * Why tool_use instead of prose-JSON:
 * - The Anthropic API guarantees that `content[i].input` for a
 *   `tool_use` block is already a parsed JSON object matching the
 *   declared `input_schema`, so we don't need fence-stripping,
 *   brace-hunting, or retry-with-stricter-prompt.
 * - The `maxLength` constraints in the schemas cap output token
 *   bloat at the source — Haiku can't write prose essays per field
 *   even if asked.
 * - `tool_choice: { type: "tool", name: ... }` forces Haiku to call
 *   the tool; it can't respond in free text.
 *
 * Transport selection:
 * - If `env.CF_ACCOUNT_ID` is set we route through Cloudflare AI
 *   Gateway (`averrow-ai-gateway/anthropic`) so cache hits are free
 *   on re-runs against the same bundle. The gateway proxies the
 *   same `/v1/messages` endpoint; tool_use works identically.
 * - Otherwise we hit `api.anthropic.com/v1/messages` directly.
 *
 * Cost governance:
 * - Per-call hard cap: MAX_COST_PER_CALL_USD ($0.50). If a call is
 *   measured to exceed it we throw — the orchestrator records the
 *   failed row but continues with the other sections.
 * - Per-run cap lives in the orchestrator; analyzers enforce the
 *   per-call cap only.
 */

import type { Env } from "../../../types";
import type {
  ContextBundle,
  DataLayerInventory,
  OpsTelemetry,
  RepoInventory,
} from "../types";

import { HAIKU_MODEL, MAX_COST_PER_CALL_USD, computeCostUsd } from "./pricing";
import {
  parseAgentsAnalysis,
  parseDataLayerAnalysis,
  parseFeedsAnalysis,
} from "./schema";
import {
  REPORT_AGENTS_ANALYSIS_TOOL,
  REPORT_DATA_LAYER_ANALYSIS_TOOL,
  REPORT_FEEDS_ANALYSIS_TOOL,
} from "./tool-schemas";
import type {
  AgentsAnalysis,
  AnalyzerResult,
  DataLayerAnalysis,
  FeedsAnalysis,
  SectionAnalysis,
} from "./types";

const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 8192;
const REQUEST_TIMEOUT_MS = 60_000;

// ─── Env subset the analyzers need ─────────────────────────────────

export type AnalyzerEnv = Pick<
  Env,
  "ANTHROPIC_API_KEY" | "LRX_API_KEY" | "CF_ACCOUNT_ID"
>;

// ─── Anthropic response shape (tool_use mode) ──────────────────────

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicMessageResponse {
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

// ─── Shared Haiku call ─────────────────────────────────────────────

interface CallResult {
  input: unknown;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number;
}

type ToolSchema =
  | typeof REPORT_AGENTS_ANALYSIS_TOOL
  | typeof REPORT_FEEDS_ANALYSIS_TOOL
  | typeof REPORT_DATA_LAYER_ANALYSIS_TOOL;

function resolveAnthropicBaseUrl(env: AnalyzerEnv): string {
  if (env.CF_ACCOUNT_ID) {
    return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/averrow-ai-gateway/anthropic`;
  }
  return "https://api.anthropic.com";
}

function resolveApiKey(env: AnalyzerEnv): string {
  const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ARCHITECT analyzer: no Anthropic API key configured (ANTHROPIC_API_KEY or LRX_API_KEY)",
    );
  }
  if (apiKey.startsWith("lrx_")) {
    throw new Error(
      "ARCHITECT analyzer: LRX_API_KEY is an LRX proxy key — set ANTHROPIC_API_KEY to a real Anthropic key (sk-ant-...)",
    );
  }
  return apiKey;
}

async function callHaikuTool(
  env: AnalyzerEnv,
  systemPrompt: string,
  userMessage: string,
  tool: ToolSchema,
): Promise<CallResult> {
  const apiKey = resolveApiKey(env);
  const baseUrl = resolveAnthropicBaseUrl(env);

  const body = {
    model: HAIKU_MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: systemPrompt,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: userMessage }],
  };

  const startedAt = Date.now();
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const responseText = await res.text();
  const durationMs = Date.now() - startedAt;

  if (!res.ok) {
    throw new Error(
      `ARCHITECT analyzer: Anthropic HTTP ${res.status}: ${responseText.slice(0, 500)}`,
    );
  }

  let apiResponse: AnthropicMessageResponse;
  try {
    apiResponse = JSON.parse(responseText) as AnthropicMessageResponse;
  } catch (err) {
    throw new Error(
      `ARCHITECT analyzer: failed to parse Anthropic response JSON: ${
        err instanceof Error ? err.message : String(err)
      }: ${responseText.slice(0, 500)}`,
    );
  }

  // Check stop_reason BEFORE reading content — catches the truncation
  // case explicitly instead of letting it cascade into a missing-tool
  // parse error. Expected: "tool_use". Anything else is a failure we
  // want surfaced with the actual reason in error_message.
  if (apiResponse.stop_reason !== "tool_use") {
    throw new Error(
      `ARCHITECT analyzer: expected stop_reason='tool_use' but got '${apiResponse.stop_reason}' ` +
        `(tool=${tool.name}, in=${apiResponse.usage?.input_tokens ?? "?"}, ` +
        `out=${apiResponse.usage?.output_tokens ?? "?"}) — raw: ${responseText.slice(0, 500)}`,
    );
  }

  const toolUse = apiResponse.content.find(
    (b) => b.type === "tool_use" && b.name === tool.name,
  );
  if (!toolUse || toolUse.input === undefined) {
    throw new Error(
      `ARCHITECT analyzer: no tool_use block for '${tool.name}' in response: ${responseText.slice(0, 500)}`,
    );
  }

  const inputTokens = apiResponse.usage.input_tokens;
  const outputTokens = apiResponse.usage.output_tokens;
  const costUsd = computeCostUsd(inputTokens, outputTokens);
  if (costUsd > MAX_COST_PER_CALL_USD) {
    throw new Error(
      `ARCHITECT analyzer: per-call cost cap exceeded: $${costUsd.toFixed(4)} > $${MAX_COST_PER_CALL_USD.toFixed(2)} (in=${inputTokens}, out=${outputTokens})`,
    );
  }

  return {
    input: toolUse.input,
    model: apiResponse.model || HAIKU_MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    duration_ms: durationMs,
  };
}

// ─── Bundle slicing ────────────────────────────────────────────────
//
// Each analyzer sees a focused slice of the bundle. We cross-reference
// ops telemetry in the agents slice (so the model can cite failures /
// CPU timeouts / ghost rows as evidence), and pass telemetry_warnings
// verbatim so the model knows which zero-valued fields mean "missing
// signal" rather than "nothing happened".

interface AgentsSlice {
  repo_totals: RepoInventory["totals"];
  agents: RepoInventory["agents"];
  crons: RepoInventory["crons"];
  agent_telemetry_7d: OpsTelemetry["agents"];
  cron_telemetry_7d: OpsTelemetry["crons"];
  ai_gateway_7d: OpsTelemetry["ai_gateway"];
  telemetry_warnings: string[];
  telemetry_window_days: number;
}

interface FeedsSlice {
  repo_totals: RepoInventory["totals"];
  feeds: RepoInventory["feeds"];
  crons: RepoInventory["crons"];
  queues_depth: OpsTelemetry["queues_depth"];
  telemetry_warnings: string[];
}

interface DataLayerSlice {
  collected_at: DataLayerInventory["collected_at"];
  totals: DataLayerInventory["totals"];
  tables: DataLayerInventory["tables"];
  telemetry_warnings: string[];
}

function buildAgentsSlice(bundle: ContextBundle): AgentsSlice {
  return {
    repo_totals: bundle.repo.totals,
    agents: bundle.repo.agents,
    crons: bundle.repo.crons,
    agent_telemetry_7d: bundle.ops.agents,
    cron_telemetry_7d: bundle.ops.crons,
    ai_gateway_7d: bundle.ops.ai_gateway,
    telemetry_warnings: bundle.ops.telemetry_warnings,
    telemetry_window_days: bundle.ops.window_days,
  };
}

function buildFeedsSlice(bundle: ContextBundle): FeedsSlice {
  return {
    repo_totals: bundle.repo.totals,
    feeds: bundle.repo.feeds,
    crons: bundle.repo.crons,
    queues_depth: bundle.ops.queues_depth,
    telemetry_warnings: bundle.ops.telemetry_warnings,
  };
}

function buildDataLayerSlice(bundle: ContextBundle): DataLayerSlice {
  return {
    collected_at: bundle.data_layer.collected_at,
    totals: bundle.data_layer.totals,
    tables: bundle.data_layer.tables,
    telemetry_warnings: bundle.ops.telemetry_warnings,
  };
}

// ─── System prompts — short, role/context only ─────────────────────
//
// No schema inlined — the tool's input_schema is the contract and
// Haiku is forced to match it via tool_choice. No "return JSON only"
// pleading; the tool_use API makes that impossible to violate.

const SYSTEM_BASE =
  "You are ARCHITECT, a meta-agent auditing the Averrow threat intelligence platform. " +
  "You review inventory and ops telemetry for a single section of the platform and submit a structured assessment via the provided tool. " +
  "Ground every evidence string in a concrete signal from the input (agent name, table name, failure count, growth pct, last error excerpt). " +
  "Do not invent metrics. If a field is zero AND appears in telemetry_warnings, treat it as missing signal, not healthy. " +
  "Severity rubric: green = healthy; amber = needs attention soon (rising failures, bloat, drift, low-value work); red = actively broken or a near-term liability (repeated failures, CPU timeouts, ghost rows, runaway growth). " +
  "Recommendations: keep | split | merge | kill | refactor. Rationale must be 1-3 sentences, specific, evidence-backed. Suggested actions must be actionable, not vague.";

const AGENTS_SYSTEM_PROMPT = `${SYSTEM_BASE}

You are reviewing the AGENTS section. Cross-reference the repo agent list with 7-day ops telemetry: flag agents with failing runs, CPU timeouts (look for "exceeded CPU" / "Exceeded CPU" / "script will never generate a response" in last_error), zero runs (dead code), or runs_7d > 0 but successes_7d === 0 (ghost rows / silent failures). Any agent with sustained failures or CPU timeouts must be marked red. Use merge_with only when recommendation === "merge" and split_into only when recommendation === "split".`;

const FEEDS_SYSTEM_PROMPT = `${SYSTEM_BASE}

You are reviewing the FEEDS section. Evaluate each feed module against its schedule, LOC, and any queue depth / telemetry warnings. Flag feeds that duplicate coverage, have no schedule wired, or whose backing cron is missing.`;

const DATA_LAYER_SYSTEM_PROMPT = `${SYSTEM_BASE}

You are reviewing the DATA_LAYER section. Focus on tables that will break at 10x scale: high row counts with no indexes, runaway 7-day growth (growth_7d_pct), large est_bytes relative to the D1 total, and unindexed hot tables. hot_tables = top 5 by est_bytes or 7-day growth. scale_bottlenecks = tables that will become painful at 10x current load (write amplification, index-less scans, unbounded log tables). scale_risk: low | medium | high per table, reflecting 10x projection.`;

// ─── Public analyzer functions ─────────────────────────────────────

export async function analyzeAgents(
  bundle: ContextBundle,
  env: AnalyzerEnv,
): Promise<AnalyzerResult<AgentsAnalysis>> {
  const slice = buildAgentsSlice(bundle);
  const userMessage = `Section: agents\n\nInput data:\n${JSON.stringify(slice, null, 2)}`;

  const call = await callHaikuTool(
    env,
    AGENTS_SYSTEM_PROMPT,
    userMessage,
    REPORT_AGENTS_ANALYSIS_TOOL,
  );
  // Belt-and-braces: the tool_use API guarantees the input matches
  // input_schema, but we still run the hand-rolled validator to catch
  // any drift between schema and TS types (and to narrow `unknown`).
  const analysis = parseAgentsAnalysis(call.input);
  return {
    analysis,
    model: call.model,
    input_tokens: call.input_tokens,
    output_tokens: call.output_tokens,
    cost_usd: call.cost_usd,
    duration_ms: call.duration_ms,
  };
}

export async function analyzeFeeds(
  bundle: ContextBundle,
  env: AnalyzerEnv,
): Promise<AnalyzerResult<FeedsAnalysis>> {
  const slice = buildFeedsSlice(bundle);
  const userMessage = `Section: feeds\n\nInput data:\n${JSON.stringify(slice, null, 2)}`;

  const call = await callHaikuTool(
    env,
    FEEDS_SYSTEM_PROMPT,
    userMessage,
    REPORT_FEEDS_ANALYSIS_TOOL,
  );
  const analysis = parseFeedsAnalysis(call.input);
  return {
    analysis,
    model: call.model,
    input_tokens: call.input_tokens,
    output_tokens: call.output_tokens,
    cost_usd: call.cost_usd,
    duration_ms: call.duration_ms,
  };
}

export async function analyzeDataLayer(
  bundle: ContextBundle,
  env: AnalyzerEnv,
): Promise<AnalyzerResult<DataLayerAnalysis>> {
  const slice = buildDataLayerSlice(bundle);
  const userMessage = `Section: data_layer\n\nInput data:\n${JSON.stringify(slice, null, 2)}`;

  const call = await callHaikuTool(
    env,
    DATA_LAYER_SYSTEM_PROMPT,
    userMessage,
    REPORT_DATA_LAYER_ANALYSIS_TOOL,
  );
  const analysis = parseDataLayerAnalysis(call.input);
  return {
    analysis,
    model: call.model,
    input_tokens: call.input_tokens,
    output_tokens: call.output_tokens,
    cost_usd: call.cost_usd,
    duration_ms: call.duration_ms,
  };
}

// Re-export the union for orchestrator convenience.
export type { SectionAnalysis };
