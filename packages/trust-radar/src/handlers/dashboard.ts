// Trust Radar v2 — Dashboard API Endpoints

import { json } from "../lib/cors";
import type { Env } from "../types";

// GET /api/dashboard/overview
export async function handleDashboardOverview(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const [threats, brands, providers, campaigns, feeds] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) AS active,
               SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS last_24h
        FROM threats WHERE status = 'active'
      `).first<{ active: number; last_24h: number }>(),
      env.DB.prepare(`
        SELECT COUNT(*) AS tracked,
               SUM(CASE WHEN first_seen >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS new_7d
        FROM brands
      `).first<{ tracked: number; new_7d: number }>(),
      env.DB.prepare(`
        SELECT COUNT(DISTINCT hosting_provider_id) AS tracked
        FROM threats WHERE hosting_provider_id IS NOT NULL
      `).first<{ tracked: number }>(),
      env.DB.prepare(`
        SELECT COUNT(*) AS active,
               SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS new_7d
        FROM campaign_clusters WHERE status = 'active'
      `).first<{ active: number; new_7d: number }>(),
      env.DB.prepare(`
        SELECT SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active,
               SUM(CASE WHEN health_status = 'degraded' THEN 1 ELSE 0 END) AS degraded,
               SUM(CASE WHEN health_status = 'down' THEN 1 ELSE 0 END) AS down
        FROM feed_configs
      `).first<{ active: number; degraded: number; down: number }>(),
    ]);

    return json({
      success: true,
      data: {
        active_threats: threats?.active ?? 0,
        threats_24h: threats?.last_24h ?? 0,
        brands_tracked: brands?.tracked ?? 0,
        brands_new: brands?.new_7d ?? 0,
        providers_tracked: providers?.tracked ?? 0,
        active_campaigns: campaigns?.active ?? 0,
        campaigns_new: campaigns?.new_7d ?? 0,
        feed_health: {
          active: feeds?.active ?? 0,
          degraded: feeds?.degraded ?? 0,
          down: feeds?.down ?? 0,
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
      LEFT JOIN threats t ON t.target_brand_id = b.id AND t.status = 'active'
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

    const rows = await env.DB.prepare(`
      SELECT hosting_provider_id AS provider_id,
             hosting_provider_id AS name,
             COUNT(*) AS threat_count,
             ROUND(
               (CAST(SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS REAL) /
                NULLIF(SUM(CASE WHEN created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) - 1) * 100
             , 1) AS trend_7d_pct
      FROM threats
      WHERE hosting_provider_id IS NOT NULL AND status = 'active'
      GROUP BY hosting_provider_id
      ORDER BY threat_count DESC
      LIMIT ?
    `).bind(limit).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
