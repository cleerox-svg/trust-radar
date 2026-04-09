/**
 * ARCHITECT Phase 2 — queue consumer.
 *
 * handleAnalysisJob runs one section (agents / feeds / data_layer)
 * inside its own Worker invocation, dispatched by Cloudflare Queues
 * with max_batch_size=1 so the three sections per run can't compete
 * for the same isolate's wall-clock budget.
 *
 * Contract:
 * 1. Flip the matching architect_analyses row from pending → analyzing.
 * 2. Load the bundle from R2 (the producer stashed the key in the
 *    message body — we don't pass the full bundle through the queue
 *    because blobs in queue messages are expensive).
 * 3. Dispatch to the right analyzer function (unchanged from the
 *    old in-process path — analyzer.ts is the single source of
 *    truth for the Haiku call + tool_use parse + stop_reason guard).
 * 4. On success: mark the row complete, ack the message.
 * 5. On transient failure (network, 429, 5xx): mark the row failed
 *    with the error message, call msg.retry() — Cloudflare Queues
 *    gives us up to max_retries=2 more attempts before the message
 *    lands in architect-analysis-dlq.
 * 6. On permanent failure (validation, 4xx, stop_reason mismatch,
 *    JSON parse error, schema drift): mark the row failed, ack the
 *    message. We don't want to burn retries on a bad API key or a
 *    response shape change — those need human attention, not wall
 *    clock.
 *
 * Each row this consumer touches is owned by this invocation. The
 * producer's `enqueue_failed` path is the only way a row ever goes
 * pending → failed without passing through this consumer.
 */

import type { Env } from "../../../types";
import type { ContextBundle } from "../types";

import {
  analyzeAgents,
  analyzeDataLayer,
  analyzeFeeds,
  type AnalyzerEnv,
} from "./analyzer";
import type { AnalysisJobMessage } from "./queue-types";
import type { AnalyzerResult, SectionAnalysis, SectionName } from "./types";

/**
 * Env subset the consumer needs: D1 for row bookkeeping, R2 for the
 * bundle, plus the analyzer's own credentials union.
 */
export type ConsumerEnv = Pick<Env, "DB" | "ARCHITECT_BUNDLES"> & AnalyzerEnv;

const ERROR_MESSAGE_MAX_LEN = 500;

function truncateError(msg: string): string {
  return msg.length > ERROR_MESSAGE_MAX_LEN
    ? msg.slice(0, ERROR_MESSAGE_MAX_LEN)
    : msg;
}

// ─── D1 row bookkeeping ────────────────────────────────────────────

async function markAnalyzing(
  db: D1Database,
  runId: string,
  section: SectionName,
): Promise<void> {
  // Scope by (run_id, section) so we hit the right row without
  // threading the row id through the queue message. Only flip rows
  // that aren't already terminal — a retry landing after a previous
  // attempt already marked the row failed should NOT reset to
  // analyzing.
  await db
    .prepare(
      `UPDATE architect_analyses
          SET status = 'analyzing'
        WHERE run_id = ?
          AND section = ?
          AND status IN ('pending','failed','analyzing')`,
    )
    .bind(runId, section)
    .run();
}

interface MarkCompleteFields {
  analysis_json: string;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string;
}

async function markComplete(
  db: D1Database,
  runId: string,
  section: SectionName,
  fields: MarkCompleteFields,
): Promise<void> {
  await db
    .prepare(
      `UPDATE architect_analyses
          SET status = 'complete',
              model = ?,
              input_tokens = ?,
              output_tokens = ?,
              cost_usd = ?,
              duration_ms = ?,
              analysis_json = ?,
              error_message = NULL
        WHERE run_id = ?
          AND section = ?`,
    )
    .bind(
      fields.model,
      fields.input_tokens,
      fields.output_tokens,
      fields.cost_usd,
      fields.duration_ms,
      fields.analysis_json,
      runId,
      section,
    )
    .run();
}

async function markFailed(
  db: D1Database,
  runId: string,
  section: SectionName,
  errorMessage: string,
  durationMs: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE architect_analyses
          SET status = 'failed',
              error_message = ?,
              duration_ms = ?
        WHERE run_id = ?
          AND section = ?`,
    )
    .bind(truncateError(errorMessage), durationMs, runId, section)
    .run();
}

// ─── R2 bundle loader ──────────────────────────────────────────────

async function loadBundleFromR2(
  env: ConsumerEnv,
  key: string,
): Promise<ContextBundle> {
  if (!env.ARCHITECT_BUNDLES) {
    throw new Error(
      "ARCHITECT consumer: ARCHITECT_BUNDLES R2 binding is not configured",
    );
  }
  const obj = await env.ARCHITECT_BUNDLES.get(key);
  if (!obj) {
    throw new Error(`ARCHITECT consumer: bundle object ${key} missing from R2`);
  }
  const bundle = (await obj.json()) as ContextBundle;
  // v1 bundles have no `feed_runtime`; v2 adds it. Both shapes are
  // accepted so in-flight R2 bundles generated before the v2 bump
  // still analyze cleanly.
  if (!bundle || (bundle.bundle_version !== 1 && bundle.bundle_version !== 2)) {
    throw new Error(
      `ARCHITECT consumer: unexpected bundle shape at ${key}`,
    );
  }
  return bundle;
}

// ─── Transient vs permanent error classification ──────────────────
//
// Transient: worth retrying. Network blips, rate limits, upstream 5xx.
// Permanent: not worth retrying. Bad API key, schema drift, response
// parse errors — human attention required. We burn the message here
// to keep the DLQ clean of things a retry can't fix.

/**
 * Classify an error as transient (worth retrying) or permanent
 * (burn the message, human attention required).
 *
 * Exported so tests can assert the classification directly without
 * having to reach through the full consumer flow.
 */
export function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);

  // Our own analyzer wraps upstream HTTP errors as:
  //   "ARCHITECT analyzer: Anthropic HTTP <status>: <body snippet>"
  // Pull the status out and classify on it.
  const httpMatch = msg.match(/Anthropic HTTP (\d{3})/);
  if (httpMatch && httpMatch[1]) {
    const status = Number.parseInt(httpMatch[1], 10);
    // 429 rate limit and all 5xx are transient. Everything else in
    // the 4xx range (auth, validation, bad request) is permanent.
    if (status === 429) return true;
    if (status >= 500 && status < 600) return true;
    return false;
  }

  // JSON parse / stop_reason / no-tool_use errors all come from the
  // analyzer's own validation path — the upstream HTTP call succeeded
  // but the response shape was wrong. That's a permanent failure: a
  // retry will get the same bad shape.
  if (msg.includes("failed to parse Anthropic response JSON")) return false;
  if (msg.includes("expected stop_reason='tool_use'")) return false;
  if (msg.includes("no tool_use block")) return false;

  // Per-call cost cap — retrying doesn't help, the same prompt will
  // cost the same money. Permanent.
  if (msg.includes("per-call cost cap exceeded")) return false;

  // Missing API key / bad key format — permanent, needs config fix.
  if (msg.includes("no Anthropic API key configured")) return false;
  if (msg.includes("LRX_API_KEY is an LRX proxy key")) return false;

  // Schema validation (parse*Analysis) — permanent, shape drift.
  if (msg.includes("parseAgentsAnalysis")) return false;
  if (msg.includes("parseFeedsAnalysis")) return false;
  if (msg.includes("parseDataLayerAnalysis")) return false;

  // AbortError from AbortSignal.timeout — the 60s fetch safety net
  // tripped. This is upstream being slow, worth one more try.
  if (err instanceof Error && err.name === "AbortError") return true;
  if (msg.includes("The operation was aborted")) return true;

  // Generic network / fetch failures — transient.
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("network")) return true;
  if (msg.includes("ECONNRESET")) return true;
  if (msg.includes("ETIMEDOUT")) return true;

  // Unknown error — be conservative and treat as transient. Worst
  // case we burn 2 extra attempts before DLQ; best case the retry
  // works and we saved a manual intervention.
  return true;
}

// ─── Queue consumer entry point ────────────────────────────────────

/**
 * Handle one architect-analysis queue message: run exactly one
 * section's analyzer, persist the result, ack or retry the message.
 *
 * This is THE entry point from the Worker's queue handler — it is
 * called with one message per invocation because the queue binding
 * uses max_batch_size=1.
 */
export async function handleAnalysisJob(
  msg: Message<AnalysisJobMessage>,
  env: ConsumerEnv,
): Promise<void> {
  const { run_id, section, bundle_r2_key } = msg.body;
  const startedAt = Date.now();

  try {
    await markAnalyzing(env.DB, run_id, section);

    const bundle = await loadBundleFromR2(env, bundle_r2_key);

    let result: AnalyzerResult<SectionAnalysis>;
    switch (section) {
      case "agents":
        result = await analyzeAgents(bundle, env);
        break;
      case "feeds":
        result = await analyzeFeeds(bundle, env);
        break;
      case "data_layer":
        result = await analyzeDataLayer(bundle, env);
        break;
    }

    await markComplete(env.DB, run_id, section, {
      analysis_json: JSON.stringify(result.analysis),
      duration_ms: Date.now() - startedAt,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      cost_usd: result.cost_usd,
      model: result.model,
    });

    msg.ack();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;

    // Best effort — if markFailed itself throws (e.g. D1 outage),
    // we still want the retry / ack decision to run below so the
    // message doesn't sit in flight forever.
    try {
      await markFailed(env.DB, run_id, section, errMsg, durationMs);
    } catch (markErr) {
      console.error(
        `[architect-consumer] markFailed threw for run_id=${run_id} section=${section}:`,
        markErr,
      );
    }

    if (isTransientError(err)) {
      // Let Cloudflare Queues redeliver up to max_retries times
      // before the message lands in architect-analysis-dlq.
      msg.retry();
    } else {
      // Permanent failure — don't waste retry budget on something
      // a retry can't fix. The row is already marked failed.
      msg.ack();
    }
  }
}
