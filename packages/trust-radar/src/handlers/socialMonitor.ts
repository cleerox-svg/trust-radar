// Trust Radar v2 — Social Monitoring API Handlers

import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import { runSocialMonitorForBrand } from "../scanners/social-monitor";
import type { Env } from "../types";

// ─── GET /api/social/monitor — Social monitoring overview (all brands) ───

export async function handleSocialOverview(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    // Get all active brand profiles for this user with monitoring summary
    const brands = await env.DB.prepare(`
      SELECT bp.id, bp.brand_name, bp.domain, bp.official_handles,
             bp.monitoring_tier, bp.status, bp.social_risk_score,
             bp.last_full_scan, bp.created_at
      FROM brand_profiles bp
      WHERE bp.user_id = ? AND bp.status != 'archived'
      ORDER BY bp.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    const total = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM brand_profiles WHERE user_id = ? AND status != 'archived'"
    ).bind(userId).first<{ n: number }>();

    // For each brand, get latest monitoring stats
    const brandsWithStats = await Promise.all(
      brands.results.map(async (brand: Record<string, unknown>) => {
        const brandId = brand.id as string;

        // Count open issues by severity
        const severityCounts = await env.DB.prepare(`
          SELECT severity, COUNT(*) AS count
          FROM social_monitor_results
          WHERE brand_id = ? AND status = 'open'
          GROUP BY severity
        `).bind(brandId).all();

        // Get last check time
        const lastCheck = await env.DB.prepare(`
          SELECT MAX(last_checked) AS last_checked
          FROM social_monitor_schedule
          WHERE brand_id = ? AND enabled = 1
        `).bind(brandId).first<{ last_checked: string | null }>();

        // Get next scheduled check
        const nextCheck = await env.DB.prepare(`
          SELECT MIN(next_check) AS next_check
          FROM social_monitor_schedule
          WHERE brand_id = ? AND enabled = 1
        `).bind(brandId).first<{ next_check: string | null }>();

        const severityMap: Record<string, number> = {};
        for (const row of severityCounts.results) {
          severityMap[row.severity as string] = row.count as number;
        }

        return {
          ...brand,
          monitoring: {
            open_critical: severityMap["CRITICAL"] ?? 0,
            open_high: severityMap["HIGH"] ?? 0,
            open_medium: severityMap["MEDIUM"] ?? 0,
            open_low: severityMap["LOW"] ?? 0,
            last_checked: lastCheck?.last_checked ?? null,
            next_check: nextCheck?.next_check ?? null,
          },
        };
      })
    );

    return json({
      success: true,
      data: brandsWithStats,
      total: total?.n ?? 0,
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/social/monitor/:brandId — Specific brand monitoring results ───

export async function handleBrandSocialMonitor(request: Request, env: Env, brandId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Verify ownership
    const brand = await env.DB.prepare(
      "SELECT id, brand_name, domain, official_handles FROM brand_profiles WHERE id = ? AND user_id = ?"
    ).bind(brandId, userId).first();

    if (!brand) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    const url = new URL(request.url);
    const platform = url.searchParams.get("platform");
    const status = url.searchParams.get("status") ?? "open";
    const severity = url.searchParams.get("severity");
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    // Build query with optional filters
    let where = `WHERE brand_id = ?`;
    const params: unknown[] = [brandId];

    if (platform) {
      where += ` AND platform = ?`;
      params.push(platform);
    }
    if (status) {
      where += ` AND status = ?`;
      params.push(status);
    }
    if (severity) {
      where += ` AND severity = ?`;
      params.push(severity);
    }

    const results = await env.DB.prepare(`
      SELECT * FROM social_monitor_results
      ${where}
      ORDER BY
        CASE severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END,
        created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM social_monitor_results ${where}`
    ).bind(...params).first<{ n: number }>();

    // Get schedule info
    const schedule = await env.DB.prepare(
      "SELECT platform, last_checked, next_check, check_interval_hours, enabled FROM social_monitor_schedule WHERE brand_id = ?"
    ).bind(brandId).all();

    return json({
      success: true,
      data: {
        brand: {
          id: brand.id,
          brand_name: brand.brand_name,
          domain: brand.domain,
        },
        results: results.results,
        total: countRow?.n ?? 0,
        schedule: schedule.results,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/social/alerts — Active impersonation alerts ───

export async function handleSocialAlerts(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const severity = url.searchParams.get("severity");
    const status = url.searchParams.get("status") ?? "new";
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    let where = `WHERE a.user_id = ? AND a.alert_type = 'social_impersonation'`;
    const params: unknown[] = [userId];

    if (severity) {
      where += ` AND a.severity = ?`;
      params.push(severity);
    }
    if (status) {
      where += ` AND a.status = ?`;
      params.push(status);
    }

    const alerts = await env.DB.prepare(`
      SELECT a.*, bp.brand_name, bp.domain
      FROM alerts a
      LEFT JOIN brand_profiles bp ON bp.id = a.brand_id
      ${where}
      ORDER BY
        CASE a.severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END,
        a.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM alerts a ${where}`
    ).bind(...params).first<{ n: number }>();

    return json({
      success: true,
      data: alerts.results,
      total: countRow?.n ?? 0,
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── POST /api/social/scan/:brandId — Trigger immediate scan for a brand ───

export async function handleTriggerSocialScan(request: Request, env: Env, brandId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Verify ownership
    const brand = await env.DB.prepare(
      "SELECT id, brand_name, domain, official_handles FROM brand_profiles WHERE id = ? AND user_id = ?"
    ).bind(brandId, userId).first<{
      id: string;
      brand_name: string;
      domain: string;
      official_handles: string;
    }>();

    if (!brand) {
      return json({ success: false, error: "Brand profile not found" }, 404, origin);
    }

    // Run the scan
    const results = await runSocialMonitorForBrand(env, {
      id: brand.id,
      brand_name: brand.brand_name,
      domain: brand.domain,
      official_handles: brand.official_handles,
    });

    // Store results
    let alertsCreated = 0;
    for (const result of results) {
      const resultId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO social_monitor_results
          (id, brand_id, platform, check_type, handle_checked, handle_available,
           suspicious_account_url, suspicious_account_name,
           impersonation_score, impersonation_signals, severity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `).bind(
        resultId,
        result.brandId,
        result.platform,
        result.checkType,
        result.handleChecked,
        result.handleAvailable === null ? null : result.handleAvailable ? 1 : 0,
        result.suspiciousAccountUrl ?? null,
        result.suspiciousAccountName ?? null,
        result.impersonationScore,
        JSON.stringify(result.impersonationSignals),
        result.severity,
      ).run();

      // Create alerts for HIGH/CRITICAL
      if (result.severity === "HIGH" || result.severity === "CRITICAL") {
        const { createAlert } = await import("../lib/alerts");
        await createAlert(env.DB, {
          brandId: brand.id,
          userId,
          alertType: "social_impersonation",
          severity: result.severity,
          title: `${result.severity === "CRITICAL" ? "Likely" : "Possible"} impersonation on ${result.platform}: @${result.handleChecked}`,
          summary: `A ${result.platform} account "${result.handleChecked}" was detected that may be impersonating ${brand.brand_name}. Impersonation score: ${(result.impersonationScore * 100).toFixed(0)}%.`,
          details: {
            platform: result.platform,
            handle: result.handleChecked,
            url: result.suspiciousAccountUrl,
            score: result.impersonationScore,
            signals: result.impersonationSignals,
            check_type: result.checkType,
          },
          sourceType: "social_monitor",
          sourceId: resultId,
        });
        alertsCreated++;
      }
    }

    // Update schedule
    const now = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE social_monitor_schedule
      SET last_checked = ?,
          next_check = datetime(?, '+' || check_interval_hours || ' hours')
      WHERE brand_id = ? AND enabled = 1
    `).bind(now, now, brand.id).run();

    await audit(env, {
      action: "social_scan_triggered",
      userId,
      resourceType: "brand_profile",
      resourceId: brand.id,
      details: {
        results_count: results.length,
        alerts_created: alertsCreated,
      },
      request,
    });

    return json({
      success: true,
      data: {
        brand_id: brand.id,
        brand_name: brand.brand_name,
        results_count: results.length,
        alerts_created: alertsCreated,
        results,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
