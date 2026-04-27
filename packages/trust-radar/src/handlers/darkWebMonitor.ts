// Averrow — Dark-Web Mention Monitoring HTTP Handlers
// Mirrors the app-store / social-monitor conventions:
//   GET   /api/darkweb/overview              — cross-brand dashboard
//   GET   /api/darkweb/mentions/:brandId     — list mentions with filters
//   POST  /api/darkweb/scan/:brandId         — trigger immediate scan
//   PATCH /api/darkweb/:id                   — update classification / status

import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import {
  runDarkWebMonitorForBrand,
  runDarkWebAIAssessmentBatch,
} from "../scanners/dark-web-monitor";
import type { Env } from "../types";
import type { AuthContext } from "../middleware/auth";

const VALID_CLASSIFICATIONS = [
  "confirmed",
  "suspicious",
  "false_positive",
  "resolved",
  "unknown",
] as const;

const VALID_STATUSES = [
  "active",
  "resolved",
  "false_positive",
  "investigating",
] as const;

// ─── Shared ownership guard ──────────────────────────────────────

async function assertBrandAccess(
  env: Env,
  brandId: string,
  userId: string,
): Promise<{ brand: { id: string; name: string; domain: string | null } } | { error: Response }> {
  const origin: string | null = null;
  const brand = await env.DB.prepare(
    "SELECT id, name, canonical_domain AS domain FROM brands WHERE id = ?",
  ).bind(brandId).first<{ id: string; name: string; domain: string | null }>();

  if (!brand) {
    return { error: json({ success: false, error: "Brand not found" }, 404, origin) };
  }

  const ownership = await env.DB.prepare(
    "SELECT brand_id FROM monitored_brands WHERE brand_id = ?",
  ).bind(brandId).first();
  const userRow = await env.DB.prepare(
    "SELECT role FROM users WHERE id = ?",
  ).bind(userId).first<{ role: string }>();
  const isAdmin = userRow?.role === "admin" || userRow?.role === "super_admin";

  if (!ownership && !isAdmin) {
    return {
      error: json({ success: false, error: "Brand not in your monitored list" }, 403, origin),
    };
  }

  return { brand };
}

// ─── GET /api/darkweb/mentions/:brandId ──────────────────────────

export async function handleListDarkWebMentions(
  request: Request,
  env: Env,
  brandId: string,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const access = await assertBrandAccess(env, brandId, userId);
    if ("error" in access) return access.error;

    const url = new URL(request.url);
    const source = url.searchParams.get("source");
    const classification = url.searchParams.get("classification");
    const severity = url.searchParams.get("severity");
    const matchType = url.searchParams.get("match_type");
    const status = url.searchParams.get("status") ?? "active";
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    let where = "WHERE brand_id = ?";
    const params: unknown[] = [brandId];

    if (source) { where += " AND source = ?"; params.push(source); }
    if (classification) { where += " AND classification = ?"; params.push(classification); }
    if (severity) { where += " AND severity = ?"; params.push(severity); }
    if (matchType) { where += " AND match_type = ?"; params.push(matchType); }
    if (status) { where += " AND status = ?"; params.push(status); }

    const rows = await env.DB.prepare(`
      SELECT * FROM dark_web_mentions
      ${where}
      ORDER BY
        CASE severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END,
        classification = 'confirmed' DESC,
        classification = 'suspicious' DESC,
        COALESCE(last_seen, first_seen) DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM dark_web_mentions ${where}`,
    ).bind(...params).first<{ n: number }>();

    const schedule = await env.DB.prepare(
      "SELECT platform, last_checked, next_check, check_interval_hours, enabled FROM brand_monitor_schedule WHERE brand_id = ? AND monitor_type = 'darkweb'",
    ).bind(brandId).all();

    return json({
      success: true,
      data: {
        brand: access.brand,
        results: rows.results,
        total: countRow?.n ?? 0,
        schedule: schedule.results,
      },
    }, 200, origin);
  } catch {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── POST /api/darkweb/scan/:brandId ─────────────────────────────

export async function handleTriggerDarkWebScan(
  request: Request,
  env: Env,
  brandId: string,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const access = await assertBrandAccess(env, brandId, userId);
    if ("error" in access) return access.error;

    const brandRow = await env.DB.prepare(
      "SELECT id, name, canonical_domain AS domain, aliases, executive_names FROM brands WHERE id = ?",
    ).bind(brandId).first<{
      id: string;
      name: string;
      domain: string | null;
      aliases: string | null;
      executive_names: string | null;
    }>();

    if (!brandRow) {
      return json({ success: false, error: "Brand not found" }, 404, origin);
    }

    const results = await runDarkWebMonitorForBrand(env, brandRow, {
      userId,
      triggeredBy: "manual",
    });

    // Advance the schedule so the cron doesn't immediately re-run this brand.
    const now = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE brand_monitor_schedule
      SET last_checked = ?,
          next_check = datetime(?, '+' || check_interval_hours || ' hours'),
          updated_at = datetime('now')
      WHERE brand_id = ? AND monitor_type = 'darkweb' AND enabled = 1
    `).bind(now, now, brandId).run();

    // Drain AI queue for this brand so the caller sees verdicts in the response.
    const ai = await runDarkWebAIAssessmentBatch(env, { brandId, limit: 10 });

    await audit(env, {
      action: "dark_web_scan_triggered",
      userId,
      resourceType: "brand",
      resourceId: brandId,
      details: {
        rows_returned: results.length,
        alerts_created: results.filter((r) => r.alert_id !== null).length,
        ai_processed: ai.processed,
        ai_upgraded: ai.upgraded,
      },
      request,
    });

    return json({
      success: true,
      data: {
        brand_id: brandId,
        brand_name: brandRow.name,
        results_count: results.length,
        alerts_created: results.filter((r) => r.alert_id !== null).length,
        ai_processed: ai.processed,
        ai_upgraded: ai.upgraded,
        results,
      },
    }, 200, origin);
  } catch {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── PATCH /api/darkweb/:id ──────────────────────────────────────

export async function handleUpdateDarkWebMention(
  request: Request,
  env: Env,
  mentionId: string,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const existing = await env.DB.prepare(
      "SELECT id, brand_id FROM dark_web_mentions WHERE id = ?",
    ).bind(mentionId).first<{ id: string; brand_id: string }>();

    if (!existing) {
      return json({ success: false, error: "Dark-web mention not found" }, 404, origin);
    }

    const access = await assertBrandAccess(env, existing.brand_id, userId);
    if ("error" in access) return access.error;

    const body = await request.json().catch(() => null) as {
      classification?: string;
      status?: string;
    } | null;

    if (!body) {
      return json({ success: false, error: "Request body is required" }, 400, origin);
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.classification !== undefined) {
      if (!VALID_CLASSIFICATIONS.includes(body.classification as typeof VALID_CLASSIFICATIONS[number])) {
        return json({
          success: false,
          error: `Invalid classification. Must be one of: ${VALID_CLASSIFICATIONS.join(", ")}`,
        }, 400, origin);
      }
      updates.push("classification = ?", "classified_by = 'manual'", "classification_confidence = 1.0");
      values.push(body.classification);
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
        return json({
          success: false,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        }, 400, origin);
      }
      updates.push("status = ?");
      values.push(body.status);
      if (body.status === "resolved" || body.status === "false_positive") {
        updates.push("resolved_at = datetime('now')", "resolved_by = ?");
        values.push(userId);
      }
    }

    if (updates.length === 0) {
      return json({ success: false, error: "No valid fields to update" }, 400, origin);
    }

    updates.push("updated_at = datetime('now')");
    values.push(mentionId);

    await env.DB.prepare(
      `UPDATE dark_web_mentions SET ${updates.join(", ")} WHERE id = ?`,
    ).bind(...values).run();

    const updated = await env.DB.prepare(
      "SELECT * FROM dark_web_mentions WHERE id = ?",
    ).bind(mentionId).first();

    await audit(env, {
      action: "dark_web_mention_update",
      userId,
      resourceType: "dark_web_mention",
      resourceId: mentionId,
      details: { classification: body.classification, status: body.status },
      request,
    });

    return json({ success: true, data: updated }, 200, origin);
  } catch {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── GET /api/darkweb/overview ───────────────────────────────────
// Scope rules match handleAppStoreOverview — see the comment block there.

export async function handleDarkWebOverview(
  request: Request,
  env: Env,
  ctx: AuthContext,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const isAdmin = ctx.role === "admin" || ctx.role === "super_admin";

    let scope: string;
    let scopeParams: unknown[];

    if (isAdmin) {
      scope = `INNER JOIN monitored_brands mb ON mb.brand_id = b.id`;
      scopeParams = [];
    } else if (ctx.orgId) {
      scope = `INNER JOIN monitored_brands mb ON mb.brand_id = b.id
               INNER JOIN org_brands ob ON ob.brand_id = b.id AND ob.org_id = ?`;
      scopeParams = [ctx.orgId];
    } else {
      return json({
        success: true,
        data: [],
        total: 0,
        totals: { total: 0, confirmed: 0, suspicious: 0, critical: 0, high: 0 },
      }, 200, origin);
    }

    const brands = await env.DB.prepare(`
      SELECT b.id, b.name AS brand_name, b.canonical_domain AS domain,
             b.executive_names, b.first_seen AS created_at
      FROM brands b
      ${scope}
      ORDER BY b.name ASC
      LIMIT ? OFFSET ?
    `).bind(...scopeParams, limit, offset).all<{
      id: string;
      brand_name: string;
      domain: string | null;
      executive_names: string | null;
      created_at: string;
    }>();

    const total = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM brands b ${scope}`,
    ).bind(...scopeParams).first<{ n: number }>();

    const brandsWithStats = await Promise.all(
      brands.results.map(async (brand) => {
        const classificationCounts = await env.DB.prepare(`
          SELECT classification, severity, COUNT(*) AS count
          FROM dark_web_mentions
          WHERE brand_id = ? AND status = 'active'
          GROUP BY classification, severity
        `).bind(brand.id).all<{
          classification: string;
          severity: string;
          count: number;
        }>();

        const counts = {
          total: 0,
          confirmed: 0,
          suspicious: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        };

        for (const row of classificationCounts.results) {
          counts.total += row.count;
          if (row.classification === "confirmed") counts.confirmed += row.count;
          if (row.classification === "suspicious") counts.suspicious += row.count;
          if (row.severity === "CRITICAL") counts.critical += row.count;
          if (row.severity === "HIGH") counts.high += row.count;
          if (row.severity === "MEDIUM") counts.medium += row.count;
          if (row.severity === "LOW") counts.low += row.count;
        }

        const schedule = await env.DB.prepare(
          `SELECT last_checked, next_check
           FROM brand_monitor_schedule
           WHERE brand_id = ? AND monitor_type = 'darkweb' AND enabled = 1
           LIMIT 1`,
        ).bind(brand.id).first<{ last_checked: string | null; next_check: string | null }>();

        return {
          ...brand,
          has_executives: Boolean(brand.executive_names && brand.executive_names !== "[]"),
          counts,
          last_checked: schedule?.last_checked ?? null,
          next_check: schedule?.next_check ?? null,
        };
      }),
    );

    const totals = await env.DB.prepare(`
      SELECT
        SUM(CASE WHEN classification = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN classification = 'suspicious' THEN 1 ELSE 0 END) AS suspicious,
        SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) AS high,
        COUNT(*) AS total
      FROM dark_web_mentions dwm
      INNER JOIN brands b ON b.id = dwm.brand_id
      ${scope}
      WHERE dwm.status = 'active'
    `).bind(...scopeParams).first<{
      confirmed: number | null;
      suspicious: number | null;
      critical: number | null;
      high: number | null;
      total: number | null;
    }>();

    return json({
      success: true,
      data: brandsWithStats,
      total: total?.n ?? 0,
      totals: {
        total: totals?.total ?? 0,
        confirmed: totals?.confirmed ?? 0,
        suspicious: totals?.suspicious ?? 0,
        critical: totals?.critical ?? 0,
        high: totals?.high ?? 0,
      },
    }, 200, origin);
  } catch {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}
