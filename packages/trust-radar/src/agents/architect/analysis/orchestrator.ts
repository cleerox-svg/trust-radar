/**
 * ARCHITECT Phase 2 — analysis orchestrator.
 *
 * runAnalysis(runId, env) is the single entry point: it fetches the
 * ContextBundle for a given architect_reports row from R2, inserts
 * three architect_analyses rows (one per section) in status='pending',
 * then runs analyzeAgents / analyzeFeeds / analyzeDataLayer in
 * parallel with Promise.allSettled so one failure doesn't take the
 * others down with it.
 *
 * Structural guarantees (fixed after production stranded-row bug):
 * - Each analyzer call is raced against an ANALYZER_TIMEOUT_MS
 *   deadline (default 90s). Haiku tool calls should land in 5-15s,
 *   so 90s is generous but still prevents an unhandled hang from
 *   leaving a row `analyzing` forever.
 * - Every settled result — fulfilled or rejected — updates its row
 *   to `complete` or `failed` before the allSettled call returns.
 *   No row is ever left in `pending` or `analyzing` by the happy
 *   path.
 * - The entire runAnalysis body is wrapped in try/finally. The
 *   finally block force-transitions any rows still in
 *   `pending`/`analyzing` to `failed` with
 *   `orchestrator_exited_in_indeterminate_state` — the structural
 *   backstop in case something throws above the per-section update
 *   logic.
 * - Error messages persisted to `error_message` are truncated at
 *   500 chars; the raw error or response tail is what we actually
 *   want when debugging the next unexpected thing.
 */

import type { Env } from "../../../types";
import type { ContextBundle } from "../types";

import {
  analyzeAgents,
  analyzeDataLayer,
  analyzeFeeds,
  type AnalyzerEnv,
} from "./analyzer";
import { HAIKU_MODEL, MAX_COST_PER_RUN_USD } from "./pricing";
import type {
  AnalyzerResult,
  SectionAnalysis,
  SectionName,
} from "./types";

/**
 * Env subset the orchestrator depends on. Anthropic credentials come
 * in via the analyzer env; R2 + D1 are needed here for bundle fetch
 * and row bookkeeping.
 */
export type OrchestratorEnv = Pick<
  Env,
  | "DB"
  | "ARCHITECT_BUNDLES"
  | "ANTHROPIC_API_KEY"
  | "LRX_API_KEY"
  | "CF_ACCOUNT_ID"
>;

const SECTIONS: readonly SectionName[] = [
  "agents",
  "feeds",
  "data_layer",
] as const;

/** Default per-section analyzer deadline. Haiku tool calls finish in
 * 5-15s under normal load; 90s is the "something is wrong" backstop. */
export const DEFAULT_ANALYZER_TIMEOUT_MS = 90_000;

/** Max length of any persisted error_message. */
const ERROR_MESSAGE_MAX_LEN = 500;

export interface RunAnalysisOptions {
  /**
   * Override the per-section analyzer deadline. Used by tests to
   * make the timeout race observable within the test's own window;
   * do not use in production code.
   */
  analyzerTimeoutMs?: number;
}

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
 * Insert an id + row into architect_analyses in status='pending' so
 * concurrent callers can see the run is in flight and the UI can
 * render three placeholder rows immediately.
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

async function markAnalyzing(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      `UPDATE architect_analyses
          SET status = 'analyzing'
        WHERE id = ?`,
    )
    .bind(id)
    .run();
}

async function markComplete(
  db: D1Database,
  id: string,
  result: AnalyzerResult<SectionAnalysis>,
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
        WHERE id = ?`,
    )
    .bind(
      result.model,
      result.input_tokens,
      result.output_tokens,
      result.cost_usd,
      result.duration_ms,
      JSON.stringify(result.analysis),
      id,
    )
    .run();
}

async function markFailed(
  db: D1Database,
  id: string,
  errorMessage: string,
  durationMs: number | null,
): Promise<void> {
  await db
    .prepare(
      `UPDATE architect_analyses
          SET status = 'failed',
              error_message = ?,
              duration_ms = COALESCE(?, duration_ms)
        WHERE id = ?`,
    )
    .bind(truncateError(errorMessage), durationMs, id)
    .run();
}

async function fetchBundle(
  env: OrchestratorEnv,
  runId: string,
): Promise<ContextBundle> {
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
    throw new Error(`ARCHITECT analysis: run_id ${runId} not found in architect_reports`);
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

  const obj = await env.ARCHITECT_BUNDLES.get(report.context_bundle_r2_key);
  if (!obj) {
    throw new Error(
      `ARCHITECT analysis: bundle object ${report.context_bundle_r2_key} missing from R2`,
    );
  }
  const bundle = (await obj.json()) as ContextBundle;
  if (!bundle || bundle.bundle_version !== 1) {
    throw new Error(
      `ARCHITECT analysis: unexpected bundle shape at ${report.context_bundle_r2_key}`,
    );
  }
  return bundle;
}

/** Per-section dispatch — keeps the Promise.allSettled call readable. */
function runSection(
  section: SectionName,
  bundle: ContextBundle,
  env: AnalyzerEnv,
): Promise<AnalyzerResult<SectionAnalysis>> {
  switch (section) {
    case "agents":
      return analyzeAgents(bundle, env);
    case "feeds":
      return analyzeFeeds(bundle, env);
    case "data_layer":
      return analyzeDataLayer(bundle, env);
  }
}

/**
 * Race an analyzer promise against a hard deadline. The timeout
 * rejects with a clearly-named error so the per-section `failed`
 * row says exactly what went wrong.
 */
function raceWithTimeout<T>(
  inner: Promise<T>,
  section: SectionName,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `analyzer_timeout: section=${section} exceeded ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
  });
  return Promise.race([inner, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export interface RunAnalysisResult {
  run_id: string;
  total_cost_usd: number;
  sections: Array<{
    section: SectionName;
    row_id: string;
    status: "complete" | "failed";
    cost_usd: number;
    duration_ms: number | null;
    error_message: string | null;
  }>;
}

export async function runAnalysis(
  runId: string,
  env: OrchestratorEnv,
  options: RunAnalysisOptions = {},
): Promise<RunAnalysisResult> {
  const analyzerTimeoutMs =
    options.analyzerTimeoutMs ?? DEFAULT_ANALYZER_TIMEOUT_MS;

  // Fail fast if the bundle doesn't exist or isn't complete — no
  // point inserting pending rows for a run we can't analyse.
  const bundle = await fetchBundle(env, runId);

  // Insert the three pending rows eagerly so the concurrency guard
  // and UI both see the in-flight state before the slow Haiku calls
  // start. Each row gets its own UUID.
  const createdAtMs = Date.now();
  const rowIds: Record<SectionName, string> = {
    agents: crypto.randomUUID(),
    feeds: crypto.randomUUID(),
    data_layer: crypto.randomUUID(),
  };

  for (const section of SECTIONS) {
    await insertPendingRow(env.DB, rowIds[section], runId, section, createdAtMs);
  }

  // Structural backstop: no matter what happens inside the try,
  // every row created above is guaranteed to land in a terminal
  // state (`complete` or `failed`) before runAnalysis returns.
  try {
    const settled = await Promise.allSettled(
      SECTIONS.map(async (section) => {
        const id = rowIds[section];
        const startedAt = Date.now();
        try {
          await markAnalyzing(env.DB, id);
          const result = await raceWithTimeout(
            runSection(section, bundle, env),
            section,
            analyzerTimeoutMs,
          );
          await markComplete(env.DB, id, result);
          return {
            section,
            id,
            status: "complete" as const,
            cost_usd: result.cost_usd,
            duration_ms: result.duration_ms,
            error_message: null as string | null,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const durationMs = Date.now() - startedAt;
          // Best effort — if markFailed itself throws (e.g. D1
          // down), the outer finally is our last line of defence.
          try {
            await markFailed(env.DB, id, errMsg, durationMs);
          } catch (markErr) {
            console.error(
              `[architect-analysis] markFailed threw for section=${section}:`,
              markErr,
            );
          }
          return {
            section,
            id,
            status: "failed" as const,
            cost_usd: 0,
            duration_ms: durationMs,
            error_message: truncateError(errMsg),
          };
        }
      }),
    );

    const sections: RunAnalysisResult["sections"] = [];
    let totalCostUsd = 0;

    for (const result of settled) {
      if (result.status === "fulfilled") {
        const v = result.value;
        totalCostUsd += v.cost_usd;
        sections.push({
          section: v.section,
          row_id: v.id,
          status: v.status,
          cost_usd: v.cost_usd,
          duration_ms: v.duration_ms,
          error_message: v.error_message,
        });
      } else {
        // The inner callback catches its own errors, so this branch
        // should be unreachable. If we do land here, the finally
        // backstop will flip the row to `failed`; surface a synthetic
        // row so the caller still sees three results.
        console.error(
          "[architect-analysis] unexpected rejected settled result:",
          result.reason,
        );
      }
    }

    // Per-run cost cap — trip after the fact so the user gets at
    // least the analyses that already completed, but surface a
    // hard error to the caller.
    if (totalCostUsd > MAX_COST_PER_RUN_USD) {
      throw new Error(
        `ARCHITECT analysis: per-run cost cap exceeded: $${totalCostUsd.toFixed(4)} > $${MAX_COST_PER_RUN_USD.toFixed(2)}`,
      );
    }

    return {
      run_id: runId,
      total_cost_usd: totalCostUsd,
      sections,
    };
  } finally {
    // Structural backstop — if anything above threw before the
    // per-section update loop ran (or between markAnalyzing and
    // markComplete/markFailed), any row still in
    // pending/analyzing gets flipped to failed here. This is the
    // last line of defence against a stranded row.
    try {
      await env.DB.prepare(
        `UPDATE architect_analyses
            SET status = 'failed',
                error_message = 'orchestrator_exited_in_indeterminate_state'
          WHERE run_id = ?
            AND status IN ('pending','analyzing')`,
      )
        .bind(runId)
        .run();
    } catch (cleanupErr) {
      // Do NOT swallow the original error — just log and let the
      // outer catch (if any) re-throw whatever was already in flight.
      console.error(
        `[architect-analysis] finally cleanup failed for run_id=${runId}:`,
        cleanupErr,
      );
    }
  }
}
