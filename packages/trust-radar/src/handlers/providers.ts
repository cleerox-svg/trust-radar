/**
 * Hosting Provider Intelligence API handlers.
 *
 * Surfaces provider-level threat aggregations for the worst offenders widget.
 */

import { json } from "../lib/cors";
import type { Env } from "../types";

export async function handleProviderStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "today";

    const stats = await env.DB.prepare(`
      SELECT provider_name, threat_count, critical_count, high_count,
             phishing_count, malware_count, top_countries,
             trend_direction, trend_pct, computed_at
      FROM provider_threat_stats
      WHERE period = ?
      ORDER BY threat_count DESC
      LIMIT 20
    `).bind(period).all();

    // Also get the raw threat-level data for drill-down
    let periodWhere = "created_at >= date('now', 'start of day')";
    if (period === "7d") periodWhere = "created_at >= date('now', '-7 days')";
    else if (period === "30d") periodWhere = "created_at >= date('now', '-30 days')";
    else if (period === "all") periodWhere = "1=1";

    const summary = await env.DB.prepare(`
      SELECT
        COUNT(DISTINCT hosting_provider) as total_providers,
        COUNT(*) as total_threats,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high
      FROM threats
      WHERE hosting_provider IS NOT NULL AND ${periodWhere}
    `).first();

    return json({
      success: true,
      data: {
        providers: stats.results,
        summary,
        period,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

export async function handleProviderDrilldown(request: Request, env: Env, provider: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

    const threats = await env.DB.prepare(`
      SELECT id, type, title, severity, source, domain, ioc_value, ip_address, country_code, created_at
      FROM threats
      WHERE hosting_provider = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(decodeURIComponent(provider), limit).all();

    return json({ success: true, data: { threats: threats.results } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
