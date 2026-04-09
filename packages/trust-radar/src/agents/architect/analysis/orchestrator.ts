/**
 * ARCHITECT Phase 2 — analysis orchestrator (producer).
 *
 * runAnalysis(runId, env) is now a thin producer: it validates
 * the architect_reports row, inserts three architect_analyses
 * rows in status='pending' (one per section), then enqueues
 * three messages on ARCHITECT_ANALYSIS_QUEUE and returns.
 *
 * Why this is a producer and not an in-process orchestrator:
 * running all three Haiku calls inside a single Worker invocation
 * via Promise.allSettled + ctx.waitUntil kept exceeding the wall
 * clock — calls in flight were being killed by the runtime with
 * no `finally` cleanup, leaving stranded `analyzing` rows. Each
 * section now gets its own queue invocation (max_batch_size=1),
 * which means its own full execution budget, plus Cloudflare
 * Queues handles retries + DLQ for us.
 *
 * Structural guarantees preserved across the rewrite:
 * - Every row this producer inserts lands in a terminal state
 *   before runAnalysis returns — if sendBatch fails we mark all
 *   three rows failed with 'enqueue_failed: <error>' so nothing
 *   is left pending with no consumer coming for it. The consumer
 *   is responsible for transitioning its row through analyzing →
 *   complete/failed on its own invocation.
 * - Error messages persisted to `error_message` are truncated at
 *   500 chars to fit the column.
 */

import type { Env } from "../../../types";

import { HAIKU_MODEL } from "./pricing";
import type { AnalysisJobMessage } from "./queue-types";
import type { SectionName } from "./types";

/**
 * Env subset the orchestrator depends on. The consumer pulls its
 * own R2 + AI creds off the full Env when the message fires; the
 * producer only needs D1 for bookkeeping and the queue binding.
 */
export type OrchestratorEnv = Pick<
  Env,
  "DB" | "ARCHITECT_BUNDLES" | "ARCHITECT_ANALYSIS_QUEUE"
>;

const SECTIONS: readonly SectionName[] = [
  "agents",
  "feeds",
  "data_layer",
] as const;

/** Max length of any persisted error_message. */
const ERROR_MESSAGE_MAX_LEN = 500;

interface ReportRow {
  run_id: string;
  status: string;
  context_bundle_r2_key: string | null;
}

function truncateError(msg: string): string {
  return msg.length > ERROR_MESSAGE_MAX_LEN
    ? msg.slice(0, ERROR_MESSAGE_MAX_LEN)
    : msg;
}

/**
 * Insert a pending row into architect_analyses so the concurrency
 * guard and UI both see the run is in flight before the queue
 * messages even leave the producer.
 */
async function insertPendingRow(
  db: D1Database,
  id: string,
  runId: string,
  section: SectionName,
  createdAtMs: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO architect_analyses
         (id, run_id, created_at, section, status, model)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(id, runId, createdAtMs, section, HAIKU_MODEL)
    .run();
}

/**
 * Mark every pending/analyzing row for this run as failed with a
 * shared error message. Used when the producer itself blows up
 * (e.g. sendBatch rejects) so nothing is left pending with no
 * consumer on the way.
 */
async function markRunFailed(
  db: D1Database,
  runId: string,
  errorMessage: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE architect_analyses
          SET status = 'failed',
              error_message = ?
        WHERE run_id = ?
          AND status IN ('pending','analyzing')`,
    )
    .bind(truncateError(errorMessage), runId)
    .run();
}

/**
 * Fetch just the architect_reports metadata we need to enqueue —
 * specifically the context_bundle_r2_key. The consumer will load
 * the bundle from R2 itself; we don't materialise it here because
 * the whole point of the queue is that producer and consumer are
 * on different Worker invocations.
 */
async function fetchReport(
  env: OrchestratorEnv,
  runId: string,
): Promise<ReportRow> {
  if (!env.ARCHITECT_BUNDLES) {
    throw new Error(
      "ARCHITECT analysis: ARCHITECT_BUNDLES R2 binding is not configured",
    );
  }

  const report = await env.DB.prepare(
    `SELECT run_id, status, context_bundle_r2_key
       FROM architect_reports
      WHERE run_id = ?
      LIMIT 1`,
  )
    .bind(runId)
    .first<ReportRow>();

  if (!report) {
    throw new Error(
      `ARCHITECT analysis: run_id ${runId} not found in architect_reports`,
    );
  }
  if (report.status !== "complete") {
    throw new Error(
      `ARCHITECT analysis: run_id ${runId} is in status '${report.status}', expected 'complete' before Phase 2`,
    );
  }
  if (!report.context_bundle_r2_key) {
    throw new Error(
      `ARCHITECT analysis: run_id ${runId} has no context_bundle_r2_key`,
    );
  }

  return report;
}

export interface RunAnalysisResult {
  run_id: string;
  /** row ids keyed by section — lets the caller (HTTP route / test) correlate. */
  row_ids: Record<SectionName, string>;
  /** Number of queue messages successfully enqueued (expected: 3). */
  enqueued: number;
}

/**
 * Producer entry point. Inserts three pending rows and enqueues
 * three messages. Returns immediately — the HTTP route wraps this
 * in a 202 Accepted response within milliseconds.
 *
 * Any failure here (bundle missing, sendBatch rejecting) flips all
 * pending rows to failed before re-throwing so the caller can
 * surface an error and nothing is left in limbo.
 */
export async function runAnalysis(
  runId: string,
  env: OrchestratorEnv,
): Promise<RunAnalysisResult> {
  if (!env.ARCHITECT_ANALYSIS_QUEUE) {
    throw new Error(
      "ARCHITECT analysis: ARCHITECT_ANALYSIS_QUEUE binding is not configured",
    );
  }

  // Validate the report row before inserting any analysis rows —
  // no point creating pending rows we can't enqueue for.
  const report = await fetchReport(env, runId);
  const bundleR2Key = report.context_bundle_r2_key!;

  const createdAtMs = Date.now();
  const rowIds: Record<SectionName, string> = {
    agents: crypto.randomUUID(),
    feeds: crypto.randomUUID(),
    data_layer: crypto.randomUUID(),
  };

  try {
    // Insert all three pending rows first. The UI sees them
    // immediately; the concurrency guard sees them immediately.
    for (const section of SECTIONS) {
      await insertPendingRow(
        env.DB,
        rowIds[section],
        runId,
        section,
        createdAtMs,
      );
    }

    // Enqueue in a single sendBatch call — all-or-nothing so we
    // don't end up with 1 of 3 in flight and the other 2 stranded.
    const enqueuedAt = Date.now();
    const messages: { body: AnalysisJobMessage }[] = SECTIONS.map(
      (section) => ({
        body: {
          run_id: runId,
          section,
          bundle_r2_key: bundleR2Key,
          enqueued_at: enqueuedAt,
          attempt: 1,
        },
      }),
    );
    await env.ARCHITECT_ANALYSIS_QUEUE.sendBatch(messages);

    return {
      run_id: runId,
      row_ids: rowIds,
      enqueued: messages.length,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    try {
      await markRunFailed(env.DB, runId, `enqueue_failed: ${errMsg}`);
    } catch (markErr) {
      // Best effort — surface the original error no matter what.
      console.error(
        `[architect-analysis] markRunFailed threw for run_id=${runId}:`,
        markErr,
      );
    }
    throw err;
  }
}
