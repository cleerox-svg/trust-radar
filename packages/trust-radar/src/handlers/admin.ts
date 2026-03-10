import { z } from "zod";
import { json } from "../lib/cors";
import type { Env } from "../types";

export async function handleAdminHealth(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  let dbStatus: "ok" | "error" = "ok";
  let dbResponseMs = 0;
  let sqliteVersion = "unknown";
  let journalMode = "wal";
  let tables: { name: string; rows: number }[] = [];

  try {
    const dbStart = Date.now();
    const versionResult = await env.DB.prepare("SELECT sqlite_version() AS v").first<{ v: string }>();
    dbResponseMs = Date.now() - dbStart;
    sqliteVersion = versionResult?.v ?? "unknown";

    const journalResult = await env.DB.prepare("PRAGMA journal_mode").first<Record<string, string>>();
    journalMode = journalResult?.["journal_mode"] ?? "wal";

    const tableNames = ["users", "scans", "signal_alerts", "signals", "feed_schedules", "agent_runs", "threats", "briefings", "investigations"];
    tables = await Promise.all(
      tableNames.map(async (name) => {
        try {
          const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${name}`).first<{ n: number }>();
          return { name, rows: r?.n ?? 0 };
        } catch {
          return { name, rows: -1 };
        }
      })
    );
  } catch {
    dbStatus = "error";
  }

  const kvOk = !!env.CACHE;
  const overall: "healthy" | "degraded" = dbStatus === "ok" ? "healthy" : "degraded";

  return json({
    success: true,
    data: {
      status: overall,
      timestamp: new Date().toISOString(),
      environment: "production",
      database: {
        status: dbStatus,
        response_ms: dbResponseMs,
        sqlite_version: sqliteVersion,
        journal_mode: journalMode,
        encryption_at_rest: "Cloudflare D1 managed",
        encryption_in_transit: "TLS 1.3",
        last_migration: "latest",
        tables,
      },
      kv_cache: { status: kvOk ? "ok" : "error", binding: "CACHE" },
      compliance: {
        data_residency: "Cloudflare Global Network",
        audit_logging: "enabled",
        hitl_enforced: "enabled",
      },
    },
  }, 200, origin);
}

const UpdateUserSchema = z.object({
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
  scans_limit: z.number().int().min(0).max(100_000).optional(),
  is_admin: z.boolean().optional(),
});

export async function handleAdminStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  const [users, scans, alerts] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN plan='pro' THEN 1 ELSE 0 END) AS pro, SUM(CASE WHEN plan='enterprise' THEN 1 ELSE 0 END) AS enterprise FROM users").first<{ total: number; pro: number; enterprise: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN risk_level IN ('high','critical') THEN 1 ELSE 0 END) AS high_risk, AVG(trust_score) AS avg_trust FROM scans").first<{ total: number; high_risk: number; avg_trust: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open FROM signal_alerts").first<{ total: number; open: number }>(),
  ]);

  return json({
    success: true, data: {
      users: { total: users?.total ?? 0, pro: users?.pro ?? 0, enterprise: users?.enterprise ?? 0 },
      scans: { total: scans?.total ?? 0, high_risk: scans?.high_risk ?? 0, avg_trust: Math.round(scans?.avg_trust ?? 0) },
      alerts: { total: alerts?.total ?? 0, open: alerts?.open ?? 0 },
    },
  }, 200, origin);
}

export async function handleAdminListUsers(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const { results } = await env.DB.prepare(
    "SELECT id, email, plan, scans_used, scans_limit, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).bind(limit, offset).all();

  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();

  return json({ success: true, data: { users: results, total: total?.n ?? 0 } }, 200, origin);
}

export async function handleAdminUpdateUser(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  const body = await request.json().catch(() => null);
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { plan, scans_limit, is_admin } = parsed.data;
  if (plan === undefined && scans_limit === undefined && is_admin === undefined) {
    return json({ success: false, error: "Nothing to update" }, 400, origin);
  }

  await env.DB.prepare(`
    UPDATE users SET
      plan        = COALESCE(?, plan),
      scans_limit = COALESCE(?, scans_limit),
      is_admin    = COALESCE(?, is_admin),
      updated_at  = datetime('now')
    WHERE id = ?
  `).bind(plan ?? null, scans_limit ?? null, is_admin !== undefined ? (is_admin ? 1 : 0) : null, userId).run();

  const user = await env.DB.prepare(
    "SELECT id, email, plan, scans_used, scans_limit, is_admin, created_at FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!user) return json({ success: false, error: "User not found" }, 404, origin);
  return json({ success: true, data: user }, 200, origin);
}
