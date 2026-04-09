/**
 * ARCHITECT — admin HTTP routes.
 *
 * Phase 1.5: one POST to trigger a collection run plus two GETs for the
 * runs list + detail view in the Averrow admin UI. All routes require
 * super_admin; runs execute in ctx.waitUntil so the HTTP response
 * returns fast while the collector finishes in the background.
 */

import type { IRequest, RouterType } from "itty-router";

import { runCollect } from "../agents/architect/core";
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
}
