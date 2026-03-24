// TODO: Refactor to use handler-utils (Phase 6 continuation)
// Averrow — Audit Log Viewer (Admin)

import { json } from "../lib/cors";
import type { Env } from "../types";

// GET /api/admin/audit
export async function handleListAuditLog(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(200, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const userId = url.searchParams.get("user_id");
    const action = url.searchParams.get("action");
    const resourceType = url.searchParams.get("resource_type");
    const outcome = url.searchParams.get("outcome");
    const since = url.searchParams.get("since");
    const until = url.searchParams.get("until");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (userId) { conditions.push("user_id = ?"); params.push(userId); }
    if (action) { conditions.push("action = ?"); params.push(action); }
    if (resourceType) { conditions.push("resource_type = ?"); params.push(resourceType); }
    if (outcome) { conditions.push("outcome = ?"); params.push(outcome); }
    if (since) { conditions.push("timestamp >= ?"); params.push(since); }
    if (until) { conditions.push("timestamp <= ?"); params.push(until); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countParams = [...params];
    params.push(limit, offset);

    const rows = await env.AUDIT_DB.prepare(
      `SELECT id, timestamp, user_id, action, resource_type, resource_id, details, ip_address, user_agent, outcome
       FROM audit_log ${where}
       ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    ).bind(...params).all();

    const total = await env.AUDIT_DB.prepare(`SELECT COUNT(*) AS n FROM audit_log ${where}`)
      .bind(...countParams).first<{ n: number }>();

    return json({ success: true, data: rows.results, total: total?.n ?? 0 }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/admin/audit/export (CSV)
export async function handleExportAuditLog(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const since = url.searchParams.get("since") ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const until = url.searchParams.get("until") ?? new Date().toISOString();

    const rows = await env.AUDIT_DB.prepare(
      `SELECT timestamp, user_id, action, resource_type, resource_id, outcome, ip_address, details
       FROM audit_log
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC
       LIMIT 10000`,
    ).bind(since, until).all();

    const header = "timestamp,user_id,action,resource_type,resource_id,outcome,ip_address,details\n";
    const csvRows = rows.results.map((r: Record<string, unknown>) =>
      [r.timestamp, r.user_id, r.action, r.resource_type, r.resource_id, r.outcome, r.ip_address, `"${String(r.details ?? "").replace(/"/g, '""')}"`].join(","),
    );

    return new Response(header + csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-log-${since.slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, request.headers.get("Origin"));
  }
}
