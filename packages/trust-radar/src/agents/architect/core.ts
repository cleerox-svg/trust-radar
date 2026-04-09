/**
 * ARCHITECT — runtime-agnostic core lifecycle.
 *
 * runCollect() runs the three context collectors, assembles a
 * ContextBundle, uploads it to R2, and records the run in
 * architect_reports. It takes a Worker-style Env (DB + ARCHITECT_BUNDLES)
 * so the same function can be invoked from a Cloudflare Worker HTTP route
 * or from the Node CLI with a shimmed env.
 *
 * Phase 1.5 — no AI calls, no synthesis. Those land in Phase 2+.
 */

import type { Env } from "../../types";

import {
  collectDataLayerInventory,
  collectFeedRuntime,
} from "./collectors/data-layer";
import { collectOpsTelemetry } from "./collectors/ops";
import { collectRepoInventory } from "./collectors/repo";
import type {
  ContextBundle,
  RepoInventory,
  RunType,
} from "./types";

/**
 * Env subset runCollect() depends on. Kept narrow so Worker + CLI
 * callers can construct a compatible shape.
 */
export type ArchitectRunEnv = Pick<Env, "DB" | "ARCHITECT_BUNDLES">;

export interface RunCollectOptions {
  runType: RunType;
  /**
   * Override the repo inventory. The CLI passes a freshly-walked
   * inventory from the Node fs collector for local verification; Worker
   * callers leave this undefined and the collector returns the build-
   * time manifest committed at src/agents/architect/manifest.generated.ts.
   */
  repoInventoryOverride?: RepoInventory;
  /**
   * Supply an already-inserted architect_reports row to skip the
   * insert step. Used by the HTTP route which inserts upfront so the
   * concurrency guard can see the new row before the background task
   * actually kicks off.
   */
  existingRun?: {
    runId: string;
    reportId: string;
    startedAtMs: number;
  };
}

export interface RunCollectResult {
  runId: string;
  reportId: string;
  r2Key: string;
  durationMs: number;
  bundleBytes: number;
}

export async function runCollect(
  env: ArchitectRunEnv,
  { runType, repoInventoryOverride, existingRun }: RunCollectOptions,
): Promise<RunCollectResult> {
  if (!env.ARCHITECT_BUNDLES) {
    throw new Error(
      "ARCHITECT_BUNDLES R2 binding is required to run the ARCHITECT collector",
    );
  }

  const runId = existingRun?.runId ?? crypto.randomUUID();
  const reportId = existingRun?.reportId ?? `arc-${runId}`;
  const startedAt = existingRun?.startedAtMs ?? Date.now();

  // Wrap the whole lifecycle so any failure after the initial insert
  // ends up with status=failed on the row. If the insert itself fails
  // there's no row to update, so the catch treats that as best-effort.
  let reportRowInserted = existingRun !== undefined;
  try {
    if (!existingRun) {
      await insertReportRow(env.DB, reportId, runId, runType, startedAt);
      reportRowInserted = true;
    }

    // Step 1 — collectors in parallel. The repo inventory is either a
    // CLI-supplied live-walk result or the build-time manifest baked
    // into the Worker bundle; either way it's synchronous here.
    const repo: RepoInventory =
      repoInventoryOverride ?? collectRepoInventory();

    const [dataLayer, ops, feedRuntime] = await Promise.all([
      collectDataLayerInventory(env as Env),
      collectOpsTelemetry(env as Env),
      collectFeedRuntime(env as Env),
    ]);

    // Step 2 — assemble bundle.
    // bundle_version=2 marks the addition of the top-level
    // feed_runtime array. Phase 2 analyzers must tolerate v1 bundles
    // (no feed_runtime field) by defaulting to an empty array so
    // in-flight R2 bundles generated before this change still parse.
    const bundle: ContextBundle = {
      bundle_version: 2,
      run_id: runId,
      generated_at: new Date().toISOString(),
      repo,
      data_layer: dataLayer,
      ops,
      feed_runtime: feedRuntime,
    };
    const bundleJson = JSON.stringify(bundle, null, 2);
    const bundleBytes = bundleJson.length;

    // Step 3 — upload bundle to R2 via the binding.
    const r2Key = `architect/bundles/${runId}.json`;
    await env.ARCHITECT_BUNDLES.put(r2Key, bundleJson, {
      httpMetadata: { contentType: "application/json" },
    });

    // Step 4 — mark complete.
    const durationMs = Date.now() - startedAt;
    await markComplete(env.DB, reportId, r2Key, durationMs);

    return { runId, reportId, r2Key, durationMs, bundleBytes };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;
    if (reportRowInserted) {
      try {
        await markFailed(env.DB, reportId, errMsg, durationMs);
      } catch {
        /* best-effort — don't let failure path mask the original error */
      }
    }
    throw err;
  }
}

// ─── D1 writes ────────────────────────────────────────────────────

async function insertReportRow(
  db: D1Database,
  id: string,
  runId: string,
  runType: RunType,
  createdAtMs: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO architect_reports
         (id, run_id, created_at, run_type, status)
       VALUES (?, ?, ?, ?, 'collecting')`,
    )
    .bind(id, runId, createdAtMs, runType)
    .run();
}

async function markComplete(
  db: D1Database,
  id: string,
  r2Key: string,
  durationMs: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE architect_reports
          SET status = 'complete',
              context_bundle_r2_key = ?,
              duration_ms = ?
        WHERE id = ?`,
    )
    .bind(r2Key, durationMs, id)
    .run();
}

async function markFailed(
  db: D1Database,
  id: string,
  errorMessage: string,
  durationMs: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE architect_reports
          SET status = 'failed',
              error_message = ?,
              duration_ms = ?
        WHERE id = ?`,
    )
    .bind(errorMessage.slice(0, 4000), durationMs, id)
    .run();
}
