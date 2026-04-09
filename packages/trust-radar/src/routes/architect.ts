/**
 * ARCHITECT — admin HTTP routes.
 *
 * Phase 1.5: one POST to trigger a collection run plus two GETs for the
 * runs list + detail view in the Averrow admin UI.
 *
 * Phase 2: one POST to kick off a Haiku analysis pass against an
 * already-collected run plus a GET to read the three section rows
 * (agents / feeds / data_layer) back out of architect_analyses.
 *
 * All routes require super_admin; background work runs in
 * ctx.waitUntil so the HTTP response returns fast while the
 * collector / analyzer finishes.
 */

import type { IRequest, RouterType } from "itty-router";

import { runAnalysis } from "../agents/architect/analysis/orchestrator";
import type { SectionName } from "../agents/architect/analysis/types";
import { runCollect } from "../agents/architect/core";
import { synthesize } from "../agents/architect/synthesis/synthesizer";
import type { RunType } from "../agents/architect/types";
import { json } from "../lib/cors";
import { isAuthContext, requireSuperAdmin } from "../middleware/auth";
import type { Env } from "../types";

// 30 minute window for the concurrency guard — matches the task spec.
const RUN_LOCK_WINDOW_MS = 30 * 60 * 1000;

const ALLOWED_RUN_TYPES: ReadonlySet<RunType> = new Set<RunType>([
  "ondemand",
  "deep",
]);

interface InProgressRow {
  run_id: string;
  status: string;
}

interface ArchitectReportRow {
  id: string;
  run_id: string;
  created_at: number;
  run_type: string;
  status: string;
  context_bundle_r2_key: string | null;
  cost_usd: number | null;
  error_message: string | null;
  duration_ms: number | null;
}

function serializeRun(row: ArchitectReportRow): {
  run_id: string;
  run_type: string;
  status: string;
  created_at: string;
  duration_ms: number | null;
  cost_usd: number | null;
  context_bundle_r2_key: string | null;
  error_message: string | null;
} {
  return {
    run_id: row.run_id,
    run_type: row.run_type,
    status: row.status,
    // created_at is stored as epoch-ms integer.
    created_at: new Date(row.created_at).toISOString(),
    duration_ms: row.duration_ms,
    cost_usd: row.cost_usd,
    context_bundle_r2_key: row.context_bundle_r2_key,
    error_message: row.error_message,
  };
}

export function registerArchitectRoutes(router: RouterType<IRequest>): void {
  // ─── POST /api/admin/architect/collect ──────────────────────────
  router.post(
    "/api/admin/architect/collect",
    async (request: Request, env: Env, ctx: ExecutionContext) => {
      const origin = request.headers.get("Origin");
      const auth = await requireSuperAdmin(request, env);
      if (!isAuthContext(auth)) return auth;

      if (!env.ARCHITECT_BUNDLES) {
        return json(
          {
            success: false,
            error:
              "ARCHITECT_BUNDLES R2 binding is not configured for this worker",
          },
          500,
          origin,
        );
      }

      // Optional body: { run_type?: 'ondemand' | 'deep' }
      let runType: RunType = "ondemand";
      try {
        const body = (await request.json().catch(() => ({}))) as {
          run_type?: string;
        };
        if (body.run_type) {
          if (!ALLOWED_RUN_TYPES.has(body.run_type as RunType)) {
            return json(
              {
                success: false,
                error: `run_type must be one of ${[...ALLOWED_RUN_TYPES].join(", ")}`,
              },
              400,
              origin,
            );
          }
          runType = body.run_type as RunType;
        }
      } catch {
        /* empty or non-JSON body is fine */
      }

      // Concurrency guard — refuse if any in-flight run in the last 30 minutes.
      const cutoffMs = Date.now() - RUN_LOCK_WINDOW_MS;
      const inProgress = await env.DB.prepare(
        `SELECT run_id, status
           FROM architect_reports
          WHERE status IN ('collecting','analyzing')
            AND created_at >= ?
          ORDER BY created_at DESC
          LIMIT 1`,
      )
        .bind(cutoffMs)
        .first<InProgressRow>();

      if (inProgress) {
        return json(
          {
            success: false,
            error: "architect_run_in_progress",
            run_id: inProgress.run_id,
            status: inProgress.status,
          },
          409,
          origin,
        );
      }

      // Insert the row eagerly so the response can include a run_id and
      // the row is visible to subsequent concurrency checks even while
      // the background task is still running.
      const runId = crypto.randomUUID();
      const reportId = `arc-${runId}`;
      const startedAtMs = Date.now();

      try {
        await env.DB.prepare(
          `INSERT INTO architect_reports
             (id, run_id, created_at, run_type, status)
           VALUES (?, ?, ?, ?, 'collecting')`,
        )
          .bind(reportId, runId, startedAtMs, runType)
          .run();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json(
          { success: false, error: `Failed to create run row: ${msg}` },
          500,
          origin,
        );
      }

      // Background work: run the collector in waitUntil so this HTTP
      // response returns immediately. runCollect() handles its own
      // status=failed bookkeeping when given an existingRun, so the
      // only thing left to do here is swallow the error after the
      // response has already gone out.
      ctx.waitUntil(
        runCollect(env, {
          runType,
          existingRun: { runId, reportId, startedAtMs },
        }).catch(() => {
          /* runCollect() already flipped the row to failed */
        }),
      );

      return json(
        {
          success: true,
          run_id: runId,
          status: "collecting",
          started_at: new Date(startedAtMs).toISOString(),
        },
        202,
        origin,
      );
    },
  );

  // ─── GET /api/admin/architect/runs ──────────────────────────────
  router.get(
    "/api/admin/architect/runs",
    async (request: Request, env: Env) => {
      const origin = request.headers.get("Origin");
      const auth = await requireSuperAdmin(request, env);
      if (!isAuthContext(auth)) return auth;

      const url = new URL(request.url);
      const limitRaw = parseInt(url.searchParams.get("limit") ?? "20", 10);
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), 100)
        : 20;

      const rows = await env.DB.prepare(
        `SELECT id, run_id, created_at, run_type, status,
                context_bundle_r2_key, cost_usd, error_message, duration_ms
           FROM architect_reports
          ORDER BY created_at DESC
          LIMIT ?`,
      )
        .bind(limit)
        .all<ArchitectReportRow>();

      return json(
        { success: true, runs: (rows.results ?? []).map(serializeRun) },
        200,
        origin,
      );
    },
  );

  // ─── GET /api/admin/architect/runs/:run_id ──────────────────────
  router.get(
    "/api/admin/architect/runs/:run_id",
    async (
      request: Request & { params: Record<string, string> },
      env: Env,
    ) => {
      const origin = request.headers.get("Origin");
      const auth = await requireSuperAdmin(request, env);
      if (!isAuthContext(auth)) return auth;

      const runId = request.params["run_id"] ?? "";
      if (!runId) {
        return json(
          { success: false, error: "Missing run_id" },
          400,
          origin,
        );
      }

      const row = await env.DB.prepare(
        `SELECT id, run_id, created_at, run_type, status,
                context_bundle_r2_key, cost_usd, error_message, duration_ms
           FROM architect_reports
          WHERE run_id = ?
          LIMIT 1`,
      )
        .bind(runId)
        .first<ArchitectReportRow>();

      if (!row) {
        return json(
          { success: false, error: "Run not found" },
          404,
          origin,
        );
      }

      const serialized = serializeRun(row);

      // When complete, hand the bundle back via a proxy fetch against
      // the R2 binding. Presigned URLs would require an account-level
      // token we don't want in the Worker, and the bundle is small.
      let bundle: unknown = null;
      if (
        row.status === "complete" &&
        row.context_bundle_r2_key &&
        env.ARCHITECT_BUNDLES
      ) {
        try {
          const obj = await env.ARCHITECT_BUNDLES.get(
            row.context_bundle_r2_key,
          );
          if (obj) {
            bundle = await obj.json();
          }
        } catch {
          /* bundle fetch is best-effort — row metadata is the source of truth */
        }
      }

      return json(
        { success: true, run: serialized, bundle },
        200,
        origin,
      );
    },
  );

  // ─── POST /api/admin/architect/analyze/:run_id ──────────────────
  //
  // Phase 2 — kicks off the Haiku inventory analysis for an already
  // collected run. Inserts three architect_analyses rows in
  // status='pending' immediately so concurrent callers / polling UIs
  // see the in-flight state, then flips them to complete/failed from
  // the background task. Returns 202 on a fresh start.
  router.post(
    "/api/admin/architect/analyze/:run_id",
    async (
      request: Request & { params: Record<string, string> },
      env: Env,
      ctx: ExecutionContext,
    ) => {
      const origin = request.headers.get("Origin");
      const auth = await requireSuperAdmin(request, env);
      if (!isAuthContext(auth)) return auth;

      const runId = request.params["run_id"] ?? "";
      if (!runId) {
        return json(
          { success: false, error: "Missing run_id" },
          400,
          origin,
        );
      }

      if (!env.ARCHITECT_BUNDLES) {
        return json(
          {
            success: false,
            error:
              "ARCHITECT_BUNDLES R2 binding is not configured for this worker",
          },
          500,
          origin,
        );
      }

      // The run must exist and be in status='complete' — the
      // analyzer cannot run against a collecting/failed row.
      const report = await env.DB.prepare(
        `SELECT run_id, status, context_bundle_r2_key
           FROM architect_reports
          WHERE run_id = ?
          LIMIT 1`,
      )
        .bind(runId)
        .first<{
          run_id: string;
          status: string;
          context_bundle_r2_key: string | null;
        }>();

      if (!report) {
        return json(
          { success: false, error: "Run not found" },
          404,
          origin,
        );
      }
      if (report.status !== "complete") {
        return json(
          {
            success: false,
            error: `run is in status '${report.status}', expected 'complete' before analysis`,
          },
          409,
          origin,
        );
      }
      if (!report.context_bundle_r2_key) {
        return json(
          {
            success: false,
            error: "run has no context_bundle_r2_key — nothing to analyse",
          },
          409,
          origin,
        );
      }

      // Concurrency guard — only one analysis per run_id at a time.
      // Any existing pending/analyzing row for this run_id blocks.
      const inFlight = await env.DB.prepare(
        `SELECT id, section, status
           FROM architect_analyses
          WHERE run_id = ?
            AND status IN ('pending','analyzing')
          LIMIT 1`,
      )
        .bind(runId)
        .first<{ id: string; section: string; status: string }>();

      if (inFlight) {
        return json(
          {
            success: false,
            error: "architect_analysis_in_progress",
            run_id: runId,
            section: inFlight.section,
            status: inFlight.status,
          },
          409,
          origin,
        );
      }

      // Background task — runAnalysis inserts its own pending rows
      // and flips them to complete/failed. We catch here so the
      // eventual error never escapes waitUntil unhandled.
      ctx.waitUntil(
        runAnalysis(runId, env).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[architect-analysis] runAnalysis failed for ${runId}:`,
            msg,
          );
        }),
      );

      return json(
        {
          success: true,
          run_id: runId,
          status: "pending",
          started_at: new Date().toISOString(),
        },
        202,
        origin,
      );
    },
  );

  // ─── GET /api/admin/architect/analyses/:run_id ──────────────────
  //
  // Returns all three architect_analyses rows for a run, with the
  // parsed analysis_json inlined. Phases 3/5 (synthesis + UI) read
  // this shape — no markdown, no rollup, just the raw section
  // assessments.
  router.get(
    "/api/admin/architect/analyses/:run_id",
    async (
      request: Request & { params: Record<string, string> },
      env: Env,
    ) => {
      const origin = request.headers.get("Origin");
      const auth = await requireSuperAdmin(request, env);
      if (!isAuthContext(auth)) return auth;

      const runId = request.params["run_id"] ?? "";
      if (!runId) {
        return json(
          { success: false, error: "Missing run_id" },
          400,
          origin,
        );
      }

      const rows = await env.DB.prepare(
        `SELECT id, run_id, created_at, section, status, model,
                input_tokens, output_tokens, cost_usd, duration_ms,
                analysis_json, error_message
           FROM architect_analyses
          WHERE run_id = ?
          ORDER BY section ASC`,
      )
        .bind(runId)
        .all<{
          id: string;
          run_id: string;
          created_at: number;
          section: SectionName;
          status: string;
          model: string;
          input_tokens: number | null;
          output_tokens: number | null;
          cost_usd: number | null;
          duration_ms: number | null;
          analysis_json: string | null;
          error_message: string | null;
        }>();

      const analyses = (rows.results ?? []).map((row) => {
        let parsed: unknown = null;
        if (row.analysis_json) {
          try {
            parsed = JSON.parse(row.analysis_json);
          } catch {
            /* ignore — surface as null, row still has raw JSON string */
          }
        }
        return {
          id: row.id,
          run_id: row.run_id,
          created_at: new Date(row.created_at).toISOString(),
          section: row.section,
          status: row.status,
          model: row.model,
          input_tokens: row.input_tokens,
          output_tokens: row.output_tokens,
          cost_usd: row.cost_usd,
          duration_ms: row.duration_ms,
          analysis: parsed,
          error_message: row.error_message,
        };
      });

      const totalCostUsd = analyses.reduce(
        (sum, a) => sum + (a.cost_usd ?? 0),
        0,
      );

      return json(
        {
          success: true,
          run_id: runId,
          total_cost_usd: totalCostUsd,
          analyses,
        },
        200,
        origin,
      );
    },
  );

  // ─── POST /api/admin/architect/synthesize/:run_id ──────────────
  //
  // Phase 3 — Sonnet synthesis. Requires all three
  // architect_analyses rows for the run to be in status='complete'.
  // Inserts / upserts an architect_syntheses row in status='pending'
  // immediately so the concurrency guard and any polling UI see the
  // in-flight state, then runs synthesize() in ctx.waitUntil and
  // flips the row to complete/failed from the background task.
  //
  // Synthesis runs in-process (not on a Queue) because it's a
  // single Sonnet call — ~10–30s wall-clock, well inside the Worker
  // budget for a background task launched from a 202 response.
  router.post(
    "/api/admin/architect/synthesize/:run_id",
    async (
      request: Request & { params: Record<string, string> },
      env: Env,
      ctx: ExecutionContext,
    ) => {
      const origin = request.headers.get("Origin");
      const auth = await requireSuperAdmin(request, env);
      if (!isAuthContext(auth)) return auth;

      const runId = request.params["run_id"] ?? "";
      if (!runId) {
        return json(
          { success: false, error: "Missing run_id" },
          400,
          origin,
        );
      }

      // The architect_reports row must exist. We don't require the
      // bundle to be loadable — loadBundleTotals() inside the
      // synthesiser is best-effort — but the report row itself is
      // the FK target for architect_syntheses.run_id, so a missing
      // row is a hard 404.
      const report = await env.DB.prepare(
        `SELECT run_id, status FROM architect_reports WHERE run_id = ? LIMIT 1`,
      )
        .bind(runId)
        .first<{ run_id: string; status: string }>();

      if (!report) {
        return json(
          { success: false, error: "Run not found" },
          404,
          origin,
        );
      }

      // All three architect_analyses rows must be in status='complete'
      // before synthesis can run. We count the matching rows in D1
      // and also surface the first non-complete status so the caller
      // can tell which section isn't ready.
      const completeRows = await env.DB.prepare(
        `SELECT section, status
           FROM architect_analyses
          WHERE run_id = ?
          ORDER BY section ASC`,
      )
        .bind(runId)
        .all<{ section: SectionName; status: string }>();

      const sections = completeRows.results ?? [];
      const requiredSections: SectionName[] = ["agents", "feeds", "data_layer"];
      const missing: string[] = [];
      for (const required of requiredSections) {
        const match = sections.find((s) => s.section === required);
        if (!match) {
          missing.push(`${required}:missing`);
        } else if (match.status !== "complete") {
          missing.push(`${required}:${match.status}`);
        }
      }
      if (missing.length > 0) {
        return json(
          {
            success: false,
            error: "analyses_not_ready",
            run_id: runId,
            details: missing,
          },
          409,
          origin,
        );
      }

      // Concurrency guard — refuse if a synthesis for this run is
      // already pending or in flight. architect_syntheses.run_id is
      // UNIQUE so we also cannot insert a second pending row for
      // the same run; this check just lets us return a clean 409
      // instead of leaking an FK / UNIQUE error.
      const existing = await env.DB.prepare(
        `SELECT id, status FROM architect_syntheses WHERE run_id = ? LIMIT 1`,
      )
        .bind(runId)
        .first<{ id: string; status: string }>();

      if (
        existing &&
        (existing.status === "pending" || existing.status === "synthesizing")
      ) {
        return json(
          {
            success: false,
            error: "architect_synthesis_in_progress",
            run_id: runId,
            status: existing.status,
          },
          409,
          origin,
        );
      }

      const synthesisId = existing?.id ?? `arcsyn-${runId}`;
      const createdAtMs = Date.now();

      // Either insert a fresh row or reset an existing terminal row
      // (complete/failed) back to pending so the background task can
      // overwrite it — this lets the caller re-run synthesis against
      // the same run without manually deleting the prior row.
      if (existing) {
        await env.DB.prepare(
          `UPDATE architect_syntheses
              SET status = 'pending',
                  created_at = ?,
                  model = ?,
                  input_tokens = NULL,
                  output_tokens = NULL,
                  cost_usd = NULL,
                  duration_ms = NULL,
                  report_md = NULL,
                  computed_scorecard_json = NULL,
                  error_message = NULL
            WHERE run_id = ?`,
        )
          .bind(
            createdAtMs,
            "claude-sonnet-4-5-20250929",
            runId,
          )
          .run();
      } else {
        await env.DB.prepare(
          `INSERT INTO architect_syntheses
             (id, run_id, created_at, status, model)
           VALUES (?, ?, ?, 'pending', ?)`,
        )
          .bind(synthesisId, runId, createdAtMs, "claude-sonnet-4-5-20250929")
          .run();
      }

      // Background work — the synthesiser runs in waitUntil so the
      // HTTP response returns immediately. We flip the row to
      // 'synthesizing' just before the Sonnet call and to complete
      // / failed in the same try/catch so nothing is left stranded.
      ctx.waitUntil(
        (async () => {
          const startedAt = Date.now();
          try {
            await env.DB.prepare(
              `UPDATE architect_syntheses
                  SET status = 'synthesizing'
                WHERE run_id = ?
                  AND status = 'pending'`,
            )
              .bind(runId)
              .run();

            const result = await synthesize(runId, env);

            await env.DB.prepare(
              `UPDATE architect_syntheses
                  SET status = 'complete',
                      model = ?,
                      input_tokens = ?,
                      output_tokens = ?,
                      cost_usd = ?,
                      duration_ms = ?,
                      report_md = ?,
                      computed_scorecard_json = ?,
                      error_message = NULL
                WHERE run_id = ?`,
            )
              .bind(
                result.usage.model,
                result.usage.input_tokens,
                result.usage.output_tokens,
                result.usage.cost_usd,
                result.usage.duration_ms,
                result.report_md,
                JSON.stringify(result.computed_scorecard),
                runId,
              )
              .run();
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const durationMs = Date.now() - startedAt;
            try {
              await env.DB.prepare(
                `UPDATE architect_syntheses
                    SET status = 'failed',
                        duration_ms = ?,
                        error_message = ?
                  WHERE run_id = ?`,
              )
                .bind(
                  durationMs,
                  errMsg.length > 500 ? errMsg.slice(0, 500) : errMsg,
                  runId,
                )
                .run();
            } catch (markErr) {
              console.error(
                `[architect-synthesis] mark failed threw for ${runId}:`,
                markErr,
              );
            }
          }
        })(),
      );

      return json(
        {
          success: true,
          run_id: runId,
          status: "pending",
          started_at: new Date(createdAtMs).toISOString(),
        },
        202,
        origin,
      );
    },
  );

  // ─── GET /api/admin/architect/synthesis/:run_id ────────────────
  //
  // Returns the architect_syntheses row for a run, with the parsed
  // computed_scorecard_json inlined. Phase 5's report viewer reads
  // this shape; Phase 3 exposes it so the admin can curl the
  // endpoint for manual verification before the UI lands.
  router.get(
    "/api/admin/architect/synthesis/:run_id",
    async (
      request: Request & { params: Record<string, string> },
      env: Env,
    ) => {
      const origin = request.headers.get("Origin");
      const auth = await requireSuperAdmin(request, env);
      if (!isAuthContext(auth)) return auth;

      const runId = request.params["run_id"] ?? "";
      if (!runId) {
        return json(
          { success: false, error: "Missing run_id" },
          400,
          origin,
        );
      }

      const row = await env.DB.prepare(
        `SELECT id, run_id, created_at, status, model,
                input_tokens, output_tokens, cost_usd, duration_ms,
                report_md, computed_scorecard_json, error_message
           FROM architect_syntheses
          WHERE run_id = ?
          LIMIT 1`,
      )
        .bind(runId)
        .first<{
          id: string;
          run_id: string;
          created_at: number;
          status: string;
          model: string;
          input_tokens: number | null;
          output_tokens: number | null;
          cost_usd: number | null;
          duration_ms: number | null;
          report_md: string | null;
          computed_scorecard_json: string | null;
          error_message: string | null;
        }>();

      if (!row) {
        return json(
          { success: false, error: "Synthesis not found" },
          404,
          origin,
        );
      }

      let computedScorecard: unknown = null;
      if (row.computed_scorecard_json) {
        try {
          computedScorecard = JSON.parse(row.computed_scorecard_json);
        } catch {
          /* leave null — raw string is still in the response below */
        }
      }

      return json(
        {
          success: true,
          synthesis: {
            id: row.id,
            run_id: row.run_id,
            created_at: new Date(row.created_at).toISOString(),
            status: row.status,
            model: row.model,
            input_tokens: row.input_tokens,
            output_tokens: row.output_tokens,
            cost_usd: row.cost_usd,
            duration_ms: row.duration_ms,
            report_md: row.report_md,
            computed_scorecard: computedScorecard,
            error_message: row.error_message,
          },
        },
        200,
        origin,
      );
    },
  );
}
