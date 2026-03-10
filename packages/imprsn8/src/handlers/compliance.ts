import { json } from "../lib/cors";
import type { Env, ComplianceAuditEntry } from "../types";

export async function handleListComplianceAudit(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const showResolved = url.searchParams.get("resolved") === "true";
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));

  try {
    const filter = showResolved ? "" : "WHERE resolved_at IS NULL";
    const rows = await env.DB.prepare(
      `SELECT * FROM compliance_audit_log ${filter}
       ORDER BY created_at DESC LIMIT ?`
    ).bind(limit).all<ComplianceAuditEntry>();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch {
    // Table may not exist yet (pre-migration)
    return json({ success: true, data: [] }, 200, origin);
  }
}

export async function handleResolveComplianceItem(
  request: Request, env: Env, id: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  try {
    await env.DB.prepare(
      `UPDATE compliance_audit_log SET resolved_at = datetime('now') WHERE id = ?`
    ).bind(id).run();

    return json({ success: true, message: "Resolved" }, 200, origin);
  } catch {
    return json({ success: false, error: "Failed to resolve" }, 500, origin);
  }
}
