// Trust Radar v2 — Dashboard API Endpoints

import { json } from "../lib/cors";
import type { Env } from "../types";

// GET /api/dashboard/overview
export async function handleDashboardOverview(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const [threatCount, threatActive, threat24h, brands, providers, campaigns, feeds] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS n FROM threats").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM threats WHERE status = 'active'").first<{ n: number }>().catch(() => ({ n: 0 })),
      env.DB.prepare("SELECT COUNT(*) AS n FROM threats WHERE created_at >= datetime('now', '-1 day')").first<{ n: number }>().catch(() => ({ n: 0 })),
      env.DB.prepare(`
        SELECT COUNT(*) AS tracked,
               SUM(CASE WHEN first_seen >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS new_7d
        FROM brands
      `).first<{ tracked: number; new_7d: number }>().catch(() => ({ tracked: 0, new_7d: 0 })),
      env.DB.prepare(`
        SELECT COUNT(DISTINCT hosting_provider_id) AS tracked
        FROM threats WHERE hosting_provider_id IS NOT NULL
      `).first<{ tracked: number }>().catch(() => ({ tracked: 0 })),
      env.DB.prepare(`
        SELECT COUNT(*) AS active,
               SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS new_7d
        FROM campaigns
      `).first<{ active: number; new_7d: number }>().catch(() => ({ active: 0, new_7d: 0 })),
      env.DB.prepare(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active
        FROM feed_configs
      `).first<{ total: number; active: number }>().catch(() => ({ total: 0, active: 0 })),
    ]);

    // Use active count if available, otherwise total count (threats may not have status='active')
    const activeThreats = (threatActive?.n ?? 0) > 0 ? (threatActive?.n ?? 0) : (threatCount?.n ?? 0);

    return json({
      success: true,
      data: {
        active_threats: activeThreats,
        threats_24h: threat24h?.n ?? 0,
        brands_tracked: brands?.tracked ?? 0,
        brands_new: brands?.new_7d ?? 0,
        providers_tracked: providers?.tracked ?? 0,
        active_campaigns: campaigns?.active ?? 0,
        campaigns_new: campaigns?.new_7d ?? 0,
        feed_health: {
          active: feeds?.active ?? 0,
          total: feeds?.total ?? 0,
          degraded: 0,
          down: 0,
        },
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/dashboard/top-brands
export async function handleDashboardTopBrands(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "10", 10));

    const rows = await env.DB.prepare(`
      SELECT b.id AS brand_id, b.name, b.sector,
             COUNT(t.id) AS threat_count,
             ROUND(
               (CAST(SUM(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS REAL) /
                NULLIF(SUM(CASE WHEN t.created_at >= datetime('now', '-14 days') AND t.created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) - 1) * 100
             , 1) AS trend_pct
      FROM brands b
      LEFT JOIN threats t ON t.target_brand_id = b.id
      GROUP BY b.id
      ORDER BY threat_count DESC
      LIMIT ?
    `).bind(limit).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/dashboard/providers
export async function handleDashboardProviders(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "10", 10));
    const sort = url.searchParams.get("sort") ?? "worst";

    if (sort === "improving") {
      // Return providers with decreasing threat counts (recent < previous period)
      const rows = await env.DB.prepare(`
        SELECT t.hosting_provider_id AS provider_id,
               COALESCE(hp.name, t.hosting_provider_id) AS name,
               hp.asn,
               SUM(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS threat_count,
               SUM(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS recent,
               SUM(CASE WHEN t.created_at >= datetime('now', '-14 days') AND t.created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END) AS previous,
               ROUND(
                 (CAST(SUM(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS REAL) /
                  NULLIF(SUM(CASE WHEN t.created_at >= datetime('now', '-14 days') AND t.created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) - 1) * 100
               , 1) AS trend_7d_pct
        FROM threats t
        LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
        WHERE t.hosting_provider_id IS NOT NULL AND t.created_at >= datetime('now', '-14 days')
        GROUP BY t.hosting_provider_id
        HAVING previous > 0 AND recent < previous
        ORDER BY (CAST(recent AS REAL) / previous) ASC
        LIMIT ?
      `).bind(limit).all();

      return json({ success: true, data: rows.results }, 200, origin);
    }

    // Default: worst actors (highest threat count)
    const rows = await env.DB.prepare(`
      SELECT t.hosting_provider_id AS provider_id,
             COALESCE(hp.name, t.hosting_provider_id) AS name,
             hp.asn,
             COUNT(*) AS threat_count,
             ROUND(
               (CAST(SUM(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS REAL) /
                NULLIF(SUM(CASE WHEN t.created_at >= datetime('now', '-14 days') AND t.created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) - 1) * 100
             , 1) AS trend_7d_pct
      FROM threats t
      LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
      WHERE t.hosting_provider_id IS NOT NULL
      GROUP BY t.hosting_provider_id
      ORDER BY threat_count DESC
      LIMIT ?
    `).bind(limit).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
