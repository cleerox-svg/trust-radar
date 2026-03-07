import { json } from "../lib/cors";
import type { Env } from "../types";

interface TableStat { name: string; rows: number; }

async function safeCount(db: D1Database, table: string): Promise<number> {
  try {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
    return row?.n ?? 0;
  } catch {
    return -1; // table doesn't exist yet
  }
}

export async function handleSystemHealth(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const t0 = Date.now();

  // ── Database connectivity ─────────────────────────────────────────────────
  let dbOk = false;
  let sqliteVersion = "unknown";
  let journalMode = "unknown";

  // Use a simple query for the liveness check — sqlite_version() is not supported in D1.
  try {
    await env.DB.prepare("SELECT 1").first();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  if (dbOk) {
    // These are best-effort; D1 may return null/unknown for both.
    try {
      const ver = await env.DB.prepare("SELECT sqlite_version() AS v").first<{ v: string }>();
      sqliteVersion = ver?.v ?? "unknown";
    } catch { /* D1 does not expose sqlite_version() */ }
    try {
      const jm = await env.DB.prepare("PRAGMA journal_mode").first<{ journal_mode: string }>();
      journalMode = jm?.journal_mode ?? "unknown";
    } catch { /* D1 WAL is managed by Cloudflare */ }
  }

  const dbResponseMs = Date.now() - t0;

  // ── Table row counts ──────────────────────────────────────────────────────
  const TABLES = [
    "users", "influencer_profiles", "monitored_accounts",
    "impersonation_reports", "takedown_requests",
    "agent_definitions", "agent_runs", "invite_tokens",
    "data_feeds", "campaigns",
  ];

  const tableCounts: TableStat[] = [];
  if (dbOk) {
    await Promise.all(
      TABLES.map(async (t) => {
        const rows = await safeCount(env.DB, t);
        tableCounts.push({ name: t, rows });
      })
    );
    tableCounts.sort((a, b) => TABLES.indexOf(a.name) - TABLES.indexOf(b.name));
  }

  // ── Bindings health ───────────────────────────────────────────────────────
  const kvOk = !!env.SESSIONS;
  const r2Ok = !!env.PROFILE_ASSETS;

  // ── Last migration ────────────────────────────────────────────────────────
  // Inferred from the highest migration file we've applied.
  // Update this constant when new migrations are added.
  const LAST_MIGRATION = "0014_github_feed_platform";

  // ── Overall status ────────────────────────────────────────────────────────
  const allOk = dbOk && kvOk;
  const overallStatus = allOk ? "healthy" : "degraded";

  return json({
    success: true,
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT ?? "unknown",

      database: {
        status:          dbOk ? "ok" : "error",
        response_ms:     dbResponseMs,
        sqlite_version:  sqliteVersion,
        journal_mode:    journalMode,
        // Cloudflare D1 encrypts all data at rest using AES-256 (platform-managed).
        // Key management is handled by Cloudflare's infrastructure — no customer action required.
        encryption_at_rest: "AES-256 (Cloudflare D1 — platform-managed)",
        encryption_in_transit: "TLS 1.3",
        last_migration:  LAST_MIGRATION,
        tables:          tableCounts,
      },

      kv_sessions: {
        status: kvOk ? "ok" : "missing_binding",
        binding: "SESSIONS",
      },

      r2_assets: {
        status:  r2Ok ? "ok" : "missing_binding",
        binding: "PROFILE_ASSETS",
      },

      compliance: {
        data_residency: "Cloudflare global edge (data processed nearest to user)",
        audit_logging:  "agent_runs + takedown_requests tables (append-only events)",
        hitl_enforced:  "ARBITER agent — no takedown submission without SOC approval",
      },
    },
  }, 200, origin);
}
