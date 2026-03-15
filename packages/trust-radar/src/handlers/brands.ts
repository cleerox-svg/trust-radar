// Trust Radar v2 — Brand API Endpoints

import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import { analyzeBrandThreats } from "../lib/haiku";
import type { Env } from "../types";

// GET /api/brands/stats
export async function handleBrandStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM brands").first<{ n: number }>();

    const newThisWeek = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM brands WHERE first_seen >= datetime('now', '-7 days')"
    ).first<{ n: number }>();

    const fastestRising = await env.DB.prepare(`
      SELECT b.name, COUNT(t.id) AS cnt
      FROM brands b
      JOIN threats t ON t.target_brand_id = b.id AND t.created_at >= datetime('now', '-1 day')
      GROUP BY b.id ORDER BY cnt DESC LIMIT 1
    `).first<{ name: string; cnt: number }>();

    const topType = await env.DB.prepare(`
      SELECT threat_type, COUNT(*) AS cnt, ROUND(COUNT(*) * 100.0 / MAX(1, (SELECT COUNT(*) FROM threats)), 1) AS pct
      FROM threats GROUP BY threat_type ORDER BY cnt DESC LIMIT 1
    `).first<{ threat_type: string; cnt: number; pct: number }>();

    return json({
      success: true,
      data: {
        total_tracked: total?.n ?? 0,
        new_this_week: newThisWeek?.n ?? 0,
        fastest_rising: fastestRising?.name ?? null,
        fastest_rising_pct: fastestRising?.cnt ?? 0,
        top_threat_type: topType?.threat_type ?? null,
        top_threat_type_pct: topType?.pct ?? 0,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

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
    const body = await request.json().catch(() => null) as {
      domain?: string; name?: string | null; sector?: string | null;
      reason?: string | null; notes?: string | null;
    } | null;

    if (!body?.domain) return json({ success: false, error: "domain required" }, 400, origin);

    const domain = body.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    const brandName = body.name || domain.split(".")[0]!.charAt(0).toUpperCase() + domain.split(".")[0]!.slice(1);

    // Find existing brand by canonical_domain, or create one
    let brand = await env.DB.prepare(
      "SELECT id FROM brands WHERE canonical_domain = ?"
    ).bind(domain).first<{ id: string }>();

    if (!brand) {
      const newId = `brand_${domain.replace(/[^a-z0-9]+/g, "_")}`;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO brands (id, name, canonical_domain, sector, first_seen, threat_count)
         VALUES (?, ?, ?, ?, datetime('now'), 0)`
      ).bind(newId, brandName, domain, body.sector ?? null).run();
      brand = { id: newId };
    }

    // Insert into monitored_brands (PK is brand_id + tenant_id)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO monitored_brands (brand_id, tenant_id, added_by, notes, status)
       VALUES (?, '__internal__', ?, ?, 'active')`
    ).bind(brand.id, userId, body.notes ?? null).run();

    await audit(env, { action: "brand_monitor_add", userId, resourceType: "brand", resourceId: brand.id, details: { domain, reason: body.reason }, request });
    return json({ success: true, data: { brand_id: brand.id, domain, name: brandName } }, 201, origin);
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
      SELECT country_code, COUNT(*) AS count,
             AVG(CAST(lat AS REAL)) AS lat, AVG(CAST(lng AS REAL)) AS lng
      FROM threats
      WHERE target_brand_id = ? AND country_code IS NOT NULL AND lat IS NOT NULL AND lng IS NOT NULL
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

    // Reshape to {labels, values} for frontend chart compatibility
    const results = rows.results as Array<{ period: string; count: number; phishing: number; typosquatting: number; impersonation: number }>;
    const labels = results.map(r => r.period);
    const values = results.map(r => r.count);

    return json({
      success: true,
      data: {
        labels,
        values,
        series: [
          { name: "Phishing", values: results.map(r => r.phishing) },
          { name: "Typosquatting", values: results.map(r => r.typosquatting) },
          { name: "Impersonation", values: results.map(r => r.impersonation) },
        ],
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/providers
export async function handleBrandProviders(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT t.hosting_provider_id AS provider_id,
             COALESCE(hp.name, t.hosting_provider_id) AS name,
             COUNT(*) AS threat_count,
             SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) AS active_count
      FROM threats t
      LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
      WHERE t.target_brand_id = ? AND t.hosting_provider_id IS NOT NULL
      GROUP BY t.hosting_provider_id ORDER BY threat_count DESC LIMIT 20
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
      FROM campaigns c
      JOIN threats t ON t.campaign_id = c.id
      WHERE t.target_brand_id = ?
      ORDER BY c.last_seen DESC
    `).bind(brandId).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/analysis
export async function handleGetBrandAnalysis(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const brand = await env.DB.prepare(
      "SELECT id, name, canonical_domain, threat_analysis, analysis_updated_at FROM brands WHERE id = ?",
    ).bind(brandId).first<{
      id: string; name: string; canonical_domain: string;
      threat_analysis: string | null; analysis_updated_at: string | null;
    }>();
    if (!brand) return json({ success: false, error: "Brand not found" }, 404, origin);

    // Return cached analysis if fresh (< 6 hours old)
    if (brand.threat_analysis && brand.analysis_updated_at) {
      const age = Date.now() - new Date(brand.analysis_updated_at).getTime();
      if (age < 6 * 60 * 60 * 1000) {
        const parsed = JSON.parse(brand.threat_analysis);
        return json({ success: true, data: { ...parsed, cached: true, updated_at: brand.analysis_updated_at } }, 200, origin);
      }
    }

    return json({
      success: true,
      data: brand.threat_analysis ? { ...JSON.parse(brand.threat_analysis), cached: true, stale: true, updated_at: brand.analysis_updated_at } : null,
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// POST /api/brands/:id/analysis — generate or refresh AI analysis
export async function handleGenerateBrandAnalysis(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const brand = await env.DB.prepare(
      "SELECT id, name, canonical_domain FROM brands WHERE id = ?",
    ).bind(brandId).first<{ id: string; name: string; canonical_domain: string }>();
    if (!brand) return json({ success: false, error: "Brand not found" }, 404, origin);

    // Gather threat data for the brand
    const [stats, providerRows, campaignRows, domainRows] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) AS phishing,
               SUM(CASE WHEN threat_type = 'typosquatting' THEN 1 ELSE 0 END) AS typosquatting,
               SUM(CASE WHEN threat_type = 'impersonation' THEN 1 ELSE 0 END) AS impersonation,
               SUM(CASE WHEN threat_type = 'credential_harvesting' THEN 1 ELSE 0 END) AS credential,
               SUM(CASE WHEN threat_type = 'malware_distribution' THEN 1 ELSE 0 END) AS malware
        FROM threats WHERE target_brand_id = ?
      `).bind(brandId).first<Record<string, number>>(),
      env.DB.prepare(`
        SELECT COALESCE(hp.name, t.hosting_provider_id) AS name
        FROM threats t LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
        WHERE t.target_brand_id = ? AND t.hosting_provider_id IS NOT NULL
        GROUP BY t.hosting_provider_id ORDER BY COUNT(*) DESC LIMIT 10
      `).bind(brandId).all<{ name: string }>(),
      env.DB.prepare(`
        SELECT DISTINCT c.name FROM campaigns c JOIN threats t ON t.campaign_id = c.id
        WHERE t.target_brand_id = ? ORDER BY c.threat_count DESC LIMIT 5
      `).bind(brandId).all<{ name: string }>(),
      env.DB.prepare(`
        SELECT DISTINCT malicious_domain FROM threats
        WHERE target_brand_id = ? AND malicious_domain IS NOT NULL LIMIT 10
      `).bind(brandId).all<{ malicious_domain: string }>(),
    ]);

    const threatTypes: Record<string, number> = {};
    if (stats) {
      for (const [k, v] of Object.entries(stats)) {
        if (k !== "total" && v > 0) threatTypes[k] = v;
      }
    }

    const result = await analyzeBrandThreats(env, {
      brand_name: brand.name,
      threat_count: stats?.total ?? 0,
      providers: providerRows.results.map(r => r.name),
      domains: domainRows.results.map(r => r.malicious_domain),
      threat_types: threatTypes,
      campaigns: campaignRows.results.map(r => r.name),
    });

    if (result.success && result.data) {
      const analysisJson = JSON.stringify(result.data);
      await env.DB.prepare(
        "UPDATE brands SET threat_analysis = ?, analysis_updated_at = datetime('now') WHERE id = ?",
      ).bind(analysisJson, brandId).run();

      return json({
        success: true,
        data: { ...result.data, cached: false, updated_at: new Date().toISOString() },
        tokens_used: result.tokens_used,
      }, 200, origin);
    }

    return json({ success: false, error: result.error || "Analysis generation failed" }, 500, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
