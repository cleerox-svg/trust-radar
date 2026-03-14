// Trust Radar v2 — Brand API Endpoints

import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import type { Env } from "../types";

// GET /api/brands
export async function handleListBrands(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const search = url.searchParams.get("q");
    const sector = url.searchParams.get("sector");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) { conditions.push("(b.name LIKE ? OR b.canonical_domain LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    if (sector) { conditions.push("b.sector = ?"); params.push(sector); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const rows = await env.DB.prepare(`
      SELECT b.id, b.name, b.canonical_domain, b.sector, b.first_seen,
             COUNT(t.id) AS threat_count,
             MAX(t.created_at) AS last_threat_seen
      FROM brands b
      LEFT JOIN threats t ON t.target_brand_id = b.id
      ${where}
      GROUP BY b.id
      ORDER BY threat_count DESC
      LIMIT ? OFFSET ?
    `).bind(...params).all();

    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM brands b ${where}`)
      .bind(...params.slice(0, -2)).first<{ n: number }>();

    return json({ success: true, data: rows.results, total: total?.n ?? 0 }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/top-targeted
export async function handleTopTargetedBrands(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "10", 10));
    const period = url.searchParams.get("period") ?? "30d";

    let since = "datetime('now', '-30 days')";
    if (period === "7d") since = "datetime('now', '-7 days')";
    else if (period === "90d") since = "datetime('now', '-90 days')";
    else if (period === "1y") since = "datetime('now', '-1 year')";

    const rows = await env.DB.prepare(`
      SELECT b.id, b.name, b.sector, b.canonical_domain,
             COUNT(t.id) AS threat_count
      FROM brands b
      JOIN threats t ON t.target_brand_id = b.id AND t.created_at >= ${since}
      GROUP BY b.id
      ORDER BY threat_count DESC
      LIMIT ?
    `).bind(limit).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/monitored
export async function handleMonitoredBrands(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT b.id, b.name, b.canonical_domain, b.sector, b.first_seen,
             COUNT(t.id) AS threat_count,
             MAX(t.created_at) AS last_threat_seen
      FROM monitored_brands mb
      JOIN brands b ON b.id = mb.brand_id
      LEFT JOIN threats t ON t.target_brand_id = b.id AND t.status = 'active'
      GROUP BY b.id
      ORDER BY threat_count DESC
    `).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// POST /api/brands/monitor
export async function handleAddMonitoredBrand(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json().catch(() => null) as { brand_id?: string } | null;
    if (!body?.brand_id) return json({ success: false, error: "brand_id required" }, 400, origin);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO monitored_brands (id, brand_id, added_by) VALUES (?, ?, ?)",
    ).bind(id, body.brand_id, userId).run();

    await audit(env, { action: "brand_monitor_add", userId, resourceType: "brand", resourceId: body.brand_id, request });
    return json({ success: true, data: { id } }, 201, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// DELETE /api/brands/monitor/:id
export async function handleRemoveMonitoredBrand(request: Request, env: Env, brandId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    await env.DB.prepare("DELETE FROM monitored_brands WHERE brand_id = ?").bind(brandId).run();
    await audit(env, { action: "brand_monitor_remove", userId, resourceType: "brand", resourceId: brandId, request });
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id
export async function handleGetBrand(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const brand = await env.DB.prepare(
      "SELECT id, name, canonical_domain, sector, first_seen FROM brands WHERE id = ?",
    ).bind(brandId).first();
    if (!brand) return json({ success: false, error: "Brand not found" }, 404, origin);

    const [stats, providers] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) AS total_threats,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_threats,
               SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) AS phishing,
               SUM(CASE WHEN threat_type = 'typosquatting' THEN 1 ELSE 0 END) AS typosquatting,
               SUM(CASE WHEN threat_type = 'impersonation' THEN 1 ELSE 0 END) AS impersonation,
               SUM(CASE WHEN threat_type = 'credential_harvesting' THEN 1 ELSE 0 END) AS credential
        FROM threats WHERE target_brand_id = ?
      `).bind(brandId).first(),
      env.DB.prepare(`
        SELECT hosting_provider_id AS provider_id, COUNT(*) AS count
        FROM threats WHERE target_brand_id = ? AND hosting_provider_id IS NOT NULL
        GROUP BY hosting_provider_id ORDER BY count DESC LIMIT 10
      `).bind(brandId).all(),
    ]);

    return json({ success: true, data: { ...brand, stats, top_providers: providers.results } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/threats
export async function handleBrandThreats(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const rows = await env.DB.prepare(`
      SELECT id, threat_type, severity, status, malicious_domain, malicious_url,
             ip_address, country_code, hosting_provider_id, campaign_id,
             first_seen, last_seen, created_at
      FROM threats WHERE target_brand_id = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).bind(brandId, limit, offset).all();

    const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM threats WHERE target_brand_id = ?")
      .bind(brandId).first<{ n: number }>();

    return json({ success: true, data: rows.results, total: total?.n ?? 0 }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/threats/locations
export async function handleBrandThreatLocations(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT country_code, COUNT(*) AS count, lat, lng
      FROM threats
      WHERE target_brand_id = ? AND country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY count DESC
    `).bind(brandId).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/threats/timeline
export async function handleBrandThreatTimeline(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "30d";

    let bucket = "date(created_at)";
    let since = "datetime('now', '-30 days')";
    if (period === "7d") since = "datetime('now', '-7 days')";
    else if (period === "90d") { since = "datetime('now', '-90 days')"; bucket = "strftime('%Y-%W', created_at)"; }
    else if (period === "1y") { since = "datetime('now', '-1 year')"; bucket = "strftime('%Y-%m', created_at)"; }

    const rows = await env.DB.prepare(`
      SELECT ${bucket} AS period, COUNT(*) AS count,
             SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) AS phishing,
             SUM(CASE WHEN threat_type = 'typosquatting' THEN 1 ELSE 0 END) AS typosquatting,
             SUM(CASE WHEN threat_type = 'impersonation' THEN 1 ELSE 0 END) AS impersonation
      FROM threats WHERE target_brand_id = ? AND created_at >= ${since}
      GROUP BY ${bucket} ORDER BY period ASC
    `).bind(brandId).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/providers
export async function handleBrandProviders(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT hosting_provider_id AS provider_id, COUNT(*) AS threat_count,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count
      FROM threats WHERE target_brand_id = ? AND hosting_provider_id IS NOT NULL
      GROUP BY hosting_provider_id ORDER BY threat_count DESC LIMIT 20
    `).bind(brandId).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/campaigns
export async function handleBrandCampaigns(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT DISTINCT c.id, c.name, c.status, c.threat_count, c.first_seen, c.last_seen
      FROM campaign_clusters c
      JOIN threats t ON t.campaign_id = c.id
      WHERE t.target_brand_id = ?
      ORDER BY c.last_seen DESC
    `).bind(brandId).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
