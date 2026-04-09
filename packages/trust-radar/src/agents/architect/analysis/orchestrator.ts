/**
 * ARCHITECT Phase 2 — analysis orchestrator.
 *
 * runAnalysis(runId, env) is the single entry point: it fetches the
 * ContextBundle for a given architect_reports row from R2, inserts
 * three architect_analyses rows (one per section) in status='pending',
 * then runs analyzeAgents / analyzeFeeds / analyzeDataLayer in
 * parallel with Promise.allSettled so one failure doesn't take the
 * others down with it. Each completion updates its row to 'complete'
 * with the analysis_json, tokens, cost, and duration; each failure
 * updates to 'failed' with a truncated error_message. The overall
 * function never silently swallows — unexpected errors bubble up
 * after best-effort cleanup.
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

interface ReportRow {
  run_id: string;
  status: string;
  context_bundle_r2_key: string | null;
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
    .bind(errorMessage.slice(0, 4000), durationMs, id)
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
): Promise<RunAnalysisResult> {
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

  // Single outer try/catch — we do NOT want to silently swallow an
  // infrastructure failure. Per-section failures are caught by
  // Promise.allSettled and recorded on the row.
  try {
    const results = await Promise.allSettled(
      SECTIONS.map(async (section) => {
        const id = rowIds[section];
        await markAnalyzing(env.DB, id);
        const startedAt = Date.now();
        try {
          const result = await runSection(section, bundle, env);
          await markComplete(env.DB, id, result);
          return { section, id, result, error: null as string | null };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const durationMs = Date.now() - startedAt;
          await markFailed(env.DB, id, errMsg, durationMs);
          return { section, id, result: null, error: errMsg, durationMs };
        }
      }),
    );

    const sections: RunAnalysisResult["sections"] = [];
    let totalCostUsd = 0;

    for (const settled of results) {
      if (settled.status === "fulfilled") {
        const { section, id, result, error } = settled.value;
        if (result) {
          totalCostUsd += result.cost_usd;
          sections.push({
            section,
            row_id: id,
            status: "complete",
            cost_usd: result.cost_usd,
            duration_ms: result.duration_ms,
            error_message: null,
          });
        } else {
          sections.push({
            section,
            row_id: id,
            status: "failed",
            cost_usd: 0,
            duration_ms: null,
            error_message: error,
          });
        }
      } else {
        // Promise.allSettled should never land here because the inner
        // callback catches its own errors — but if it ever does, we
        // log a synthetic failure row so the UI still shows three rows.
        console.error(
          "[architect-analysis] unexpected rejected settled result:",
          settled.reason,
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
  } catch (err) {
    // Outer failure — best-effort mark any still-pending rows as
    // failed and rethrow so the caller (HTTP route background task)
    // can log it.
    const errMsg = err instanceof Error ? err.message : String(err);
    for (const section of SECTIONS) {
      try {
        await env.DB.prepare(
          `UPDATE architect_analyses
              SET status = 'failed',
                  error_message = COALESCE(error_message, ?)
            WHERE id = ?
              AND status IN ('pending','analyzing')`,
        )
          .bind(errMsg.slice(0, 4000), rowIds[section])
          .run();
      } catch {
        /* best-effort cleanup — the outer throw is the source of truth */
      }
    }
    throw err;
  }
}
