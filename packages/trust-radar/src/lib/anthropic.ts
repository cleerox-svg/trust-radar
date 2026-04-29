/**
 * Canonical Anthropic Messages API wrapper.
 *
 * Every Anthropic call in the worker goes through callAnthropic().
 * That is the whole point of this file: adding a new AI call site
 * without ledger tracking should be structurally impossible.
 *
 * Contract:
 * - Every successful call writes a row to budget_ledger via
 *   BudgetManager.recordCost(agentId, runId, model, input_tokens,
 *   output_tokens) exactly once. No caller needs to remember.
 * - Failed calls do NOT write a ledger row (no tokens consumed) but
 *   are logged to console with the agentId so operators can trace
 *   them to the right caller.
 * - Callers get the raw Anthropic response back, so code that needs
 *   usage.input_tokens / output_tokens / tool_use.input for its own
 *   logic still has everything it needs.
 *
 * Features:
 * - Plain text completion (content[].text)
 * - JSON mode — helper below extracts the first JSON object from text
 * - Tool use — pass tools + tool_choice, read content[].input
 * - Haiku and Sonnet (or any model in BudgetManager.COST_PER_MILLION)
 * - Optional routing through Cloudflare AI Gateway when CF_ACCOUNT_ID
 *   is set, otherwise direct api.anthropic.com
 *
 * If you need a new capability, add it here — do not spin up a new
 * direct fetch call site. rg "api\.anthropic\.com" across the worker
 * should only hit this file.
 */

import { BudgetManager } from "./budgetManager";
import { checkAgentBudget } from "./per-agent-budget";
import type { Env } from "../types";

const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 30_000;

// ─── Types ──────────────────────────────────────────────────────

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

export interface AnthropicResponse {
  id?: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: AnthropicUsage;
}

/**
 * Minimal env shape the wrapper needs. Accepts the full Env type at
 * call sites without forcing every caller to pass a DB binding it
 * may not have — db is used for ledger writes only, and callers
 * without DB access (rare, but lib helpers from public fetch paths
 * can hit this) will get an explicit warning instead of a crash.
 */
export type AnthropicEnv = Pick<
  Env,
  "ANTHROPIC_API_KEY" | "LRX_API_KEY" | "CF_ACCOUNT_ID" | "DB"
> & {
  // Optional KV — Phase 5.1's per-agent budget gate uses CACHE for
  // its 60s decision cache. Test fixtures + the retired architect
  // env shape don't carry CACHE; the gate's try/catch handles
  // absence by falling through to the slow path each call.
  CACHE?: KVNamespace;
};

export interface AnthropicCallOptions {
  /** Attribution ID for the ledger row — stable string, e.g. "sentinel", "admin". */
  agentId: string;
  /** Optional run ID (agent_runs.id). null for admin / lib helpers without a run context. */
  runId?: string | null;
  /** Any key in BudgetManager.COST_PER_MILLION. */
  model: string;
  /** System prompt. */
  system?: string;
  /** Chat messages — typically a single user message. */
  messages: AnthropicMessage[];
  /** Max output tokens. */
  maxTokens: number;
  /** Tool definitions for tool_use mode. */
  tools?: unknown[];
  /** Tool choice — typically { type: "tool", name: "..." } to force a call. */
  toolChoice?: unknown;
  /** Per-request timeout override (default 30s). */
  timeoutMs?: number;
  /**
   * Route through Cloudflare AI Gateway when CF_ACCOUNT_ID is set.
   * Default: true. Set false to force direct api.anthropic.com.
   */
  useGateway?: boolean;
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}

// ─── Key + transport ─────────────────────────────────────────────

function resolveApiKey(env: AnthropicEnv, agentId: string): string {
  const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
  if (!apiKey) {
    throw new AnthropicError(
      `[anthropic] No API key configured (checked ANTHROPIC_API_KEY and LRX_API_KEY). agentId=${agentId}`,
      agentId,
    );
  }
  if (apiKey.startsWith("lrx_")) {
    throw new AnthropicError(
      `[anthropic] LRX_API_KEY is an LRX proxy key — set ANTHROPIC_API_KEY to a real Anthropic key (sk-ant-...). agentId=${agentId}`,
      agentId,
    );
  }
  return apiKey;
}

function resolveBaseUrl(env: AnthropicEnv, useGateway: boolean): string {
  if (useGateway && env.CF_ACCOUNT_ID) {
    return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/averrow-ai-gateway/anthropic`;
  }
  return "https://api.anthropic.com";
}

// ─── Core call ───────────────────────────────────────────────────

/**
 * The canonical entry point. Every Anthropic call in the worker goes
 * through here. Returns the raw response on success; callers extract
 * text, JSON, or tool_use as needed. Throws on any failure (HTTP
 * error, network error, timeout) — on throw, no ledger row is written.
 *
 * NOTE: DB is required for ledger attribution. If a caller genuinely
 * has no DB binding the wrapper will log a loud warning and continue
 * (the call itself still works) — but that should never happen in
 * practice since every Worker handler receives `env.DB`.
 */
export async function callAnthropic(
  env: AnthropicEnv,
  opts: AnthropicCallOptions,
): Promise<AnthropicResponse> {
  const {
    agentId,
    runId = null,
    model,
    system,
    messages,
    maxTokens,
    tools,
    toolChoice,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    useGateway = true,
  } = opts;

  const apiKey = resolveApiKey(env, agentId);
  const baseUrl = resolveBaseUrl(env, useGateway);

  // ── Per-agent budget pre-flight (Phase 5.1) ─────────────────
  // Refuses the call when the agent is over its declared
  // monthlyTokenCap. KV-cached for 60s per agent so a sync agent
  // burst pays at most one D1 read per minute. Fails open on D1/KV
  // hiccups (better to over-spend by a minute than crash a
  // customer-facing call). Unregistered agentIds (legacy kebab
  // attribution) pass through.
  if (env.DB) {
    const decision = await checkAgentBudget(env, agentId);
    if (!decision.ok) {
      console.warn(`[anthropic] per-agent budget rejected — agentId=${agentId}: ${decision.reason}`);
      throw new AnthropicError(`budget_cap_exceeded: ${decision.reason}`, agentId);
    }
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  };
  if (system !== undefined) body.system = system;
  if (tools !== undefined) body.tools = tools;
  if (toolChoice !== undefined) body.tool_choice = toolChoice;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[anthropic] fetch failed — agentId=${agentId} model=${model}: ${msg}`);
    throw new AnthropicError(`Anthropic fetch failed: ${msg}`, agentId);
  }

  const responseText = await res.text();

  if (!res.ok) {
    console.error(
      `[anthropic] HTTP ${res.status} — agentId=${agentId} model=${model}: ${responseText.slice(0, 300)}`,
    );
    throw new AnthropicError(
      `Anthropic HTTP ${res.status}: ${responseText.slice(0, 300)}`,
      agentId,
      res.status,
      responseText.slice(0, 1000),
    );
  }

  let apiResponse: AnthropicResponse;
  try {
    apiResponse = JSON.parse(responseText) as AnthropicResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[anthropic] response JSON parse failed — agentId=${agentId}: ${msg}`);
    throw new AnthropicError(
      `Anthropic response JSON parse failed: ${msg}`,
      agentId,
    );
  }

  // ─── Ledger ──────────────────────────────────────────────────
  // Exactly one recordCost per successful call. Failures above this
  // point write nothing — no tokens consumed. recordCost itself is
  // wrapped in try/catch so a transient D1 blip does not cascade
  // into the caller losing its response.
  const inputTokens = apiResponse.usage?.input_tokens ?? 0;
  const outputTokens = apiResponse.usage?.output_tokens ?? 0;
  if (env.DB) {
    try {
      const budget = new BudgetManager(env.DB);
      await budget.recordCost(
        agentId,
        runId,
        apiResponse.model || model,
        inputTokens,
        outputTokens,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[anthropic] recordCost failed — agentId=${agentId} model=${model} in=${inputTokens} out=${outputTokens}: ${msg}`,
      );
    }
  } else {
    console.warn(
      `[anthropic] env.DB missing — ledger row skipped. agentId=${agentId} model=${model} in=${inputTokens} out=${outputTokens}`,
    );
  }

  return apiResponse;
}

// ─── JSON mode helper ────────────────────────────────────────────

/**
 * Convenience wrapper for "tell the model to respond in JSON" call
 * sites. Strips markdown fences, extracts the first JSON object, and
 * parses it. Throws AnthropicError if parsing fails.
 */
export async function callAnthropicJSON<T>(
  env: AnthropicEnv,
  opts: AnthropicCallOptions,
): Promise<{ parsed: T; response: AnthropicResponse }> {
  const response = await callAnthropic(env, opts);
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock?.text) {
    throw new AnthropicError(
      `Anthropic response had no text block (agentId=${opts.agentId})`,
      opts.agentId,
    );
  }

  let jsonText = textBlock.text.trim();
  jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  // Accept either a JSON object or a JSON array — some call sites
  // (batch classification, attribution) expect arrays.
  const match = jsonText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) {
    throw new AnthropicError(
      `Anthropic response had no JSON payload: ${jsonText.slice(0, 200)} (agentId=${opts.agentId})`,
      opts.agentId,
    );
  }

  try {
    const parsed = JSON.parse(match[0]) as T;
    return { parsed, response };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AnthropicError(
      `Anthropic JSON parse failed: ${msg} (agentId=${opts.agentId}): ${match[0].slice(0, 200)}`,
      opts.agentId,
    );
  }
}

// ─── Text mode helper ────────────────────────────────────────────

/**
 * Convenience wrapper for plain-text completion call sites. Returns
 * the first text block's content verbatim.
 */
export async function callAnthropicText(
  env: AnthropicEnv,
  opts: AnthropicCallOptions,
): Promise<{ text: string; response: AnthropicResponse }> {
  const response = await callAnthropic(env, opts);
  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock?.text ?? "";
  return { text, response };
}
