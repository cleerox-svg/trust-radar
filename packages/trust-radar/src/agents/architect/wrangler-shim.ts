/**
 * ARCHITECT — Node-only D1 shim that wraps the `wrangler` CLI.
 *
 * The collectors are typed against the Worker `Env` interface because we
 * eventually want to run them inside the worker runtime (Phase 2+). In
 * Phase 1 they run from a plain Node CLI, so this file satisfies the
 * `D1Database` surface area the collectors actually use — `.prepare()`,
 * `.bind()`, `.first()`, `.all()`, `.run()` — by shelling out to
 * `wrangler d1 execute --json`. Everything else throws on purpose.
 *
 * We validate parameters carefully and inline them via `?` replacement
 * because `wrangler d1 execute` has no first-class parameter binding.
 * Identifiers (table names) must be whitelisted by the collector BEFORE
 * they reach this module.
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Matches the D1Result shape closely enough for the collectors we have.
interface WranglerD1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

// ─── Public factory ───────────────────────────────────────────────

export interface D1ShimOptions {
  binding: string; // Wrangler D1 binding name, e.g. "DB"
  remote: boolean; // true = --remote, false = --local
  wranglerBin: string; // absolute path to node_modules/.bin/wrangler
  cwd: string; // directory containing wrangler.toml
}

export function createD1Shim(opts: D1ShimOptions): D1Database {
  const runner = new D1Runner(opts);
  const shim: Partial<D1Database> = {
    prepare(sql: string): D1PreparedStatement {
      return new D1PreparedStatementShim(runner, sql, []) as unknown as D1PreparedStatement;
    },
    async batch<T = unknown>(): Promise<D1Result<T>[]> {
      throw new Error("D1 shim: batch() not implemented");
    },
    async exec(_query: string): Promise<D1ExecResult> {
      throw new Error("D1 shim: exec() not implemented");
    },
    async dump(): Promise<ArrayBuffer> {
      throw new Error("D1 shim: dump() not implemented");
    },
  };
  return shim as D1Database;
}

// ─── Prepared statement ───────────────────────────────────────────

class D1PreparedStatementShim {
  constructor(
    private readonly runner: D1Runner,
    private readonly sql: string,
    private readonly params: readonly unknown[],
  ) {}

  bind(...params: unknown[]): D1PreparedStatementShim {
    return new D1PreparedStatementShim(this.runner, this.sql, params);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.runner.execute<T>(
      inlineParams(this.sql, this.params),
    );
    return result.results[0] ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
    meta: Record<string, unknown>;
  }> {
    const result = await this.runner.execute<T>(
      inlineParams(this.sql, this.params),
    );
    return {
      results: result.results,
      success: result.success,
      meta: result.meta ?? {},
    };
  }

  async run(): Promise<{
    success: boolean;
    meta: Record<string, unknown>;
  }> {
    const result = await this.runner.execute<Record<string, unknown>>(
      inlineParams(this.sql, this.params),
    );
    return { success: result.success, meta: result.meta ?? {} };
  }

  async raw(): Promise<unknown[]> {
    throw new Error("D1 shim: raw() not implemented");
  }
}

// ─── Runner — invokes `wrangler d1 execute` ───────────────────────

class D1Runner {
  constructor(private readonly opts: D1ShimOptions) {}

  async execute<T>(sql: string): Promise<WranglerD1Result<T>> {
    // SQL is written to a temp file and passed via --file to avoid shell
    // escaping gotchas with newlines, quotes, and comments.
    const dir = await mkdtemp(join(tmpdir(), "architect-d1-"));
    const filePath = join(dir, "query.sql");
    try {
      await writeFile(filePath, sql, "utf8");
      const args = [
        "d1",
        "execute",
        this.opts.binding,
        this.opts.remote ? "--remote" : "--local",
        "--json",
        "--file",
        filePath,
      ];
      const { stdout } = await execFileAsync(this.opts.wranglerBin, args, {
        cwd: this.opts.cwd,
        env: process.env,
        maxBuffer: 64 * 1024 * 1024,
      });
      const parsed = extractJsonPayload(stdout);
      // wrangler returns an array of results, one per executed statement.
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0] as WranglerD1Result<T>;
        return {
          results: first.results ?? [],
          success: first.success ?? true,
          meta: first.meta,
        };
      }
      return { results: [], success: true };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {
        /* best-effort cleanup */
      });
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Inline positional parameters into a SQL string. Safe because callers
 * have already whitelisted identifiers, and everything remaining is a
 * literal value that we escape. D1 does not expose parameter binding via
 * the wrangler CLI.
 */
export function inlineParams(sql: string, params: readonly unknown[]): string {
  let idx = 0;
  let inSingle = false;
  let inDouble = false;
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "?" && !inSingle && !inDouble) {
      if (idx >= params.length) {
        throw new Error(
          `D1 shim: not enough parameters for SQL (needed at least ${idx + 1})`,
        );
      }
      out += formatLiteral(params[idx]);
      idx++;
    } else {
      out += ch;
    }
  }
  if (idx !== params.length) {
    throw new Error(
      `D1 shim: ${params.length - idx} unused parameter(s) for SQL`,
    );
  }
  return out;
}

function formatLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`D1 shim: refusing to inline non-finite number ${value}`);
    }
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return `'${value.toISOString()}'`;
  const str =
    typeof value === "string" ? value : JSON.stringify(value);
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Wrangler emits auxiliary lines on stdout (proxy warnings, colour codes)
 * before and after the JSON payload. Grab the largest bracketed or braced
 * span we can find.
 */
function extractJsonPayload(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to scanning
    }
  }
  const firstBracket = stdout.indexOf("[");
  const firstBrace = stdout.indexOf("{");
  const start =
    firstBracket === -1
      ? firstBrace
      : firstBrace === -1
        ? firstBracket
        : Math.min(firstBracket, firstBrace);
  if (start === -1) {
    throw new Error(
      `D1 shim: no JSON payload found in wrangler output:\n${stdout.slice(0, 500)}`,
    );
  }
  const candidate = stdout.slice(start).trim();
  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new Error(
      `D1 shim: failed to parse wrangler JSON output: ${
        err instanceof Error ? err.message : String(err)
      }\nPayload head: ${candidate.slice(0, 500)}`,
    );
  }
}
