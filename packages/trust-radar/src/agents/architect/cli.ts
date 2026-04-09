/**
 * ARCHITECT — Phase 1 CLI entrypoint.
 *
 * Thin wrapper around runCollect() in ./core.ts. The core lifecycle is
 * runtime-agnostic and takes a Worker-style Env; the CLI side here
 * builds that env from shims that shell out to the wrangler CLI, so the
 * same code path runs from both local dev and the Worker HTTP route.
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
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import type { ArchitectRunEnv } from "./core";
import { runCollect } from "./core";
import type { RunType } from "./types";
import { createD1Shim } from "./wrangler-shim";

export { runCollect } from "./core";

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

// ─── CLI R2 shim ──────────────────────────────────────────────────

/**
 * Minimal R2Bucket stub that implements only `.put()` — enough for
 * ARCHITECT. Uploads are delegated to `wrangler r2 object put`.
 */
function createR2Shim(args: {
  bucket: string;
  wranglerBin: string;
  cwd: string;
}): R2Bucket {
  const stub: Partial<R2Bucket> = {
    async put(key: string, value: unknown): Promise<R2Object> {
      if (typeof value !== "string") {
        throw new Error(
          "CLI R2 shim only supports string values (bundle JSON)",
        );
      }
      const dir = await mkdtemp(join(tmpdir(), "architect-r2-"));
      const filePath = join(dir, "bundle.json");
      try {
        await writeFile(filePath, value, "utf8");
        await execFileAsync(
          args.wranglerBin,
          [
            "r2",
            "object",
            "put",
            `${args.bucket}/${key}`,
            "--remote",
            "--file",
            filePath,
            "--content-type",
            "application/json",
          ],
          {
            cwd: args.cwd,
            env: process.env,
            maxBuffer: 16 * 1024 * 1024,
          },
        );
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {
          /* best-effort cleanup */
        });
      }
      // We don't need the returned R2Object — callers only check for
      // throw/no-throw — so a minimal stub is fine.
      return { key } as unknown as R2Object;
    },
  };
  return stub as R2Bucket;
}

// ─── Bootstrap ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = loadConfig();

  const db: D1Database = createD1Shim({
    binding: config.d1Binding,
    remote: true,
    wranglerBin: config.wranglerBin,
    cwd: config.packageDir,
  });
  const architectBundles: R2Bucket = createR2Shim({
    bucket: config.r2Bucket,
    wranglerBin: config.wranglerBin,
    cwd: config.packageDir,
  });

  const env: ArchitectRunEnv = {
    DB: db,
    ARCHITECT_BUNDLES: architectBundles,
  };

  console.log(
    `[architect] run_type=${config.runType} target=${config.wranglerEnv ?? "default"}`,
  );

  try {
    const result = await runCollect(env, {
      runType: config.runType,
      monorepoRoot: config.monorepoRoot,
    });
    console.log(
      `[architect] status=complete run_id=${result.runId} ` +
        `duration_ms=${result.durationMs} ` +
        `bundle=r2://${config.r2Bucket}/${result.r2Key} ` +
        `bytes=${result.bundleBytes}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[architect] status=failed error=${msg}`);
    throw err;
  }
}

// Allow `pnpm architect:collect` to invoke this module directly via tsx.
// tsx transpiles this file as CommonJS (no "type": "module" in the
// package), so `require.main === module` is the canonical check.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
