/**
 * Unified Alerts API handlers.
 *
 * Endpoints:
 *   GET    /api/alerts        — list alerts (filtered, paginated)
 *   GET    /api/alerts/stats  — severity/status breakdown
 *   GET    /api/alerts/:id    — single alert detail
 *   PATCH  /api/alerts/:id    — update status (acknowledge, resolve, etc.)
 */

import { json } from "../lib/cors";
import { getAlerts, updateAlertStatus } from "../lib/alerts";
import type { AlertStatus, Severity } from "../lib/alerts";
import type { Env } from "../types";

// GET /api/alerts
export async function handleListAlerts(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as AlertStatus | null;
    const severity = url.searchParams.get("severity") as Severity | null;
    const brandId = url.searchParams.get("brand_id");
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const result = await getAlerts(env.DB, userId, {
      status: status ?? undefined,
      severity: severity ?? undefined,
      brandId: brandId ?? undefined,
      limit,
      offset,
    });

    return json({ success: true, data: result.alerts, total: result.total }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/alerts/:id
export async function handleGetAlert(request: Request, env: Env, alertId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const row = await env.DB.prepare(
      `SELECT * FROM alerts WHERE id = ?`
    ).bind(alertId).first();

    if (!row) {
      return json({ success: false, error: "Alert not found" }, 404, origin);
    }

    return json({ success: true, data: row }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// PATCH /api/alerts/:id
export async function handleUpdateAlert(request: Request, env: Env, alertId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as { status?: AlertStatus; notes?: string };

    if (!body.status) {
      return json({ success: false, error: "Missing required field: status" }, 400, origin);
    }

    const validStatuses: AlertStatus[] = ['new', 'acknowledged', 'investigating', 'resolved', 'false_positive'];
    if (!validStatuses.includes(body.status)) {
      return json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400, origin);
    }

    const updated = await updateAlertStatus(env.DB, alertId, body.status, body.notes);
    if (!updated) {
      return json({ success: false, error: "Alert not found" }, 404, origin);
    }

    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/alerts/stats
export async function handleAlertStats(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const byStatus = await env.DB.prepare(
      `SELECT status, COUNT(*) as count FROM alerts WHERE user_id = ? GROUP BY status`
    ).bind(userId).all<{ status: string; count: number }>();

    const bySeverity = await env.DB.prepare(
      `SELECT severity, COUNT(*) as count FROM alerts WHERE user_id = ? AND status = 'new' GROUP BY severity`
    ).bind(userId).all<{ severity: string; count: number }>();

    const byType = await env.DB.prepare(
      `SELECT alert_type, COUNT(*) as count FROM alerts WHERE user_id = ? AND status = 'new' GROUP BY alert_type`
    ).bind(userId).all<{ alert_type: string; count: number }>();

    const recentCount = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM alerts WHERE user_id = ? AND created_at > datetime('now', '-24 hours')`
    ).bind(userId).first<{ c: number }>();

    return json({
      success: true,
      data: {
        by_status: byStatus.results,
        by_severity: bySeverity.results,
        by_type: byType.results,
        last_24h: recentCount?.c ?? 0,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
