/**
 * ARCHITECT — Phase 1 CLI entrypoint.
 *
 * Runs the three context collectors (repo, data-layer, ops), assembles a
 * ContextBundle, writes it to /tmp, uploads it to R2, and records the
 * run in architect_reports. No AI calls and no synthesis — those land
 * in Phase 2+.
 *
 * Usage:
 *   pnpm --filter trust-radar architect:collect               # weekly run
 *   ARCHITECT_RUN_TYPE=deep pnpm ... architect:collect        # deep run
 *   ARCHITECT_WRANGLER_ENV=dev pnpm ... architect:collect     # target dev
 *
 * Environment variables:
 *   ARCHITECT_RUN_TYPE       weekly | ondemand | deep   (default: weekly)
 *   ARCHITECT_WRANGLER_ENV   wrangler --env name        (default: dev)
 *   ARCHITECT_R2_BUCKET      R2 bucket name             (default: averrow-architect-bundles)
 *   ARCHITECT_D1_BINDING     D1 binding name            (default: DB)
 */

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import type { Env } from "../../types";

import { collectRepoInventory } from "./collectors/repo";
import { collectDataLayerInventory } from "./collectors/data-layer";
import { collectOpsTelemetry } from "./collectors/ops";
import type {
  ContextBundle,
  DataLayerInventory,
  OpsTelemetry,
  RepoInventory,
  RunType,
} from "./types";
import { createD1Shim } from "./wrangler-shim";

const execFileAsync = promisify(execFile);

// ─── Config ───────────────────────────────────────────────────────

interface CliConfig {
  runType: RunType;
  wranglerEnv: string | null;
  r2Bucket: string;
  d1Binding: string;
  wranglerBin: string;
  packageDir: string; // dir containing wrangler.toml
  monorepoRoot: string; // repo root (two levels up from packageDir)
}

function loadConfig(): CliConfig {
  const runType = (process.env.ARCHITECT_RUN_TYPE ?? "weekly") as RunType;
  if (!["weekly", "ondemand", "deep"].includes(runType)) {
    throw new Error(
      `ARCHITECT_RUN_TYPE must be one of weekly|ondemand|deep (got "${runType}")`,
    );
  }
  // This file lives at src/agents/architect/cli.ts. The package dir is
  // three levels up from that. Use __dirname so tsx can run the file
  // under CJS without needing "type": "module" in package.json.
  const packageDir = resolve(__dirname, "..", "..", "..");
  const monorepoRoot = resolve(packageDir, "..", "..");
  const wranglerBin = resolve(
    packageDir,
    "node_modules",
    ".bin",
    "wrangler",
  );

  return {
    runType,
    wranglerEnv: process.env.ARCHITECT_WRANGLER_ENV ?? "dev",
    r2Bucket:
      process.env.ARCHITECT_R2_BUCKET ?? "averrow-architect-bundles",
    d1Binding: process.env.ARCHITECT_D1_BINDING ?? "DB",
    wranglerBin,
    packageDir,
    monorepoRoot,
  };
}

// ─── Entrypoint ───────────────────────────────────────────────────

export async function runCollect(): Promise<{
  runId: string;
  bundlePath: string;
  r2Key: string;
}> {
  const config = loadConfig();
  const runId = randomUUID();
  const startedAt = Date.now();
  const reportId = `arc-${runId}`;

  const db: D1Database = createD1Shim({
    binding: config.d1Binding,
    remote: true,
    wranglerBin: config.wranglerBin,
    cwd: config.packageDir,
  });

  console.log(
    `[architect] run_id=${runId} run_type=${config.runType} target=${config.wranglerEnv ?? "default"}`,
  );

  await insertReportRow(db, reportId, runId, config.runType, startedAt);

  try {
    // Step 1 — collectors in parallel. repo is filesystem-only and doesn't
    // touch env; data-layer + ops share the D1 shim.
    const env = { DB: db } as unknown as Env;
    const [repo, dataLayer, ops] = await Promise.all<
      [
        Promise<RepoInventory>,
        Promise<DataLayerInventory>,
        Promise<OpsTelemetry>,
      ]
    >([
      collectRepoInventory(config.monorepoRoot),
      collectDataLayerInventory(env),
      collectOpsTelemetry(env),
    ] as const);

    console.log(
      `[architect] collectors: repo=${repo.totals.agents}a/${repo.totals.feeds}f ` +
        `data_layer=${dataLayer.totals.table_count}t/${dataLayer.totals.total_rows}r ` +
        `ops=${ops.agents.length}a`,
    );

    // Step 2 — assemble bundle.
    const bundle: ContextBundle = {
      bundle_version: 1,
      run_id: runId,
      generated_at: new Date().toISOString(),
      repo,
      data_layer: dataLayer,
      ops,
    };

    // Step 3 — write bundle to /tmp.
    const bundlePath = join(tmpdir(), `architect-bundle-${runId}.json`);
    await writeFile(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
    console.log(`[architect] bundle written: ${bundlePath}`);

    // Step 4 — upload to R2.
    const r2Key = `architect/bundles/${runId}.json`;
    await uploadToR2({
      wranglerBin: config.wranglerBin,
      cwd: config.packageDir,
      bucket: config.r2Bucket,
      key: r2Key,
      filePath: bundlePath,
    });
    console.log(`[architect] bundle uploaded: r2://${config.r2Bucket}/${r2Key}`);

    // Step 5 — mark complete.
    const durationMs = Date.now() - startedAt;
    await markComplete(db, reportId, r2Key, durationMs);

    console.log(
      `[architect] status=complete run_id=${runId} duration_ms=${durationMs}`,
    );
    return { runId, bundlePath, r2Key };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[architect] status=failed run_id=${runId} error=${errMsg}`);
    const durationMs = Date.now() - startedAt;
    // Best-effort — don't let a failure-path crash mask the original error.
    try {
      await markFailed(db, reportId, errMsg, durationMs);
    } catch (markErr) {
      console.error(
        `[architect] additionally failed to mark run as failed: ${
          markErr instanceof Error ? markErr.message : String(markErr)
        }`,
      );
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

// ─── R2 upload via wrangler ───────────────────────────────────────

interface R2UploadArgs {
  wranglerBin: string;
  cwd: string;
  bucket: string;
  key: string;
  filePath: string;
}

async function uploadToR2(args: R2UploadArgs): Promise<void> {
  const objectPath = `${args.bucket}/${args.key}`;
  const cliArgs = [
    "r2",
    "object",
    "put",
    objectPath,
    "--remote",
    "--file",
    args.filePath,
    "--content-type",
    "application/json",
  ];
  await execFileAsync(args.wranglerBin, cliArgs, {
    cwd: args.cwd,
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
}

// ─── Bootstrap when invoked directly ──────────────────────────────

// Allow `pnpm architect:collect` to invoke this module directly via tsx.
// tsx transpiles this file as CommonJS (no "type": "module" in the
// package), so `require.main === module` is the canonical check.
if (require.main === module) {
  runCollect().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
