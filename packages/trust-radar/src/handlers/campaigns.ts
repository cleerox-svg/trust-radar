// Trust Radar v2 — Campaign API Endpoints

import { json } from "../lib/cors";
import type { Env } from "../types";

// GET /api/campaigns (with status filter)
export async function handleListCampaignsV2(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) { conditions.push("c.status = ?"); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const rows = await env.DB.prepare(`
      SELECT c.id, c.name, c.status, c.threat_count, c.brand_count, c.provider_count,
             c.attack_pattern, c.first_seen, c.last_seen
      FROM campaigns c ${where}
      ORDER BY c.last_seen DESC LIMIT ? OFFSET ?
    `).bind(...params).all();

    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM campaigns c ${where}`)
      .bind(...params.slice(0, -2)).first<{ n: number }>();

    return json({ success: true, data: rows.results, total: total?.n ?? 0 }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/campaigns/stats
export async function handleCampaignStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const stats = await env.DB.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
             SUM(CASE WHEN status = 'dormant' THEN 1 ELSE 0 END) AS dormant_count,
             SUM(CASE WHEN status = 'disrupted' THEN 1 ELSE 0 END) AS disrupted_count,
             SUM(threat_count) AS active_threats,
             SUM(brand_count) AS brands_affected
      FROM campaigns
    `).first();

    return json({ success: true, data: stats }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/campaigns/:id
export async function handleGetCampaign(request: Request, env: Env, campaignId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const campaign = await env.DB.prepare(
      "SELECT * FROM campaigns WHERE id = ?",
    ).bind(campaignId).first();

    if (!campaign) return json({ success: false, error: "Campaign not found" }, 404, origin);

    const [brandBreakdown, providerBreakdown] = await Promise.all([
      env.DB.prepare(`
        SELECT target_brand_id AS brand_id, b.name AS brand_name, COUNT(*) AS count
        FROM threats t LEFT JOIN brands b ON b.id = t.target_brand_id
        WHERE t.campaign_id = ? AND t.target_brand_id IS NOT NULL
        GROUP BY target_brand_id ORDER BY count DESC
      `).bind(campaignId).all(),
      env.DB.prepare(`
        SELECT t.hosting_provider_id AS provider_id,
               COALESCE(hp.name, t.hosting_provider_id) AS provider_name,
               COUNT(*) AS count
        FROM threats t
        LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
        WHERE t.campaign_id = ? AND t.hosting_provider_id IS NOT NULL
        GROUP BY t.hosting_provider_id ORDER BY count DESC
      `).bind(campaignId).all(),
    ]);

    return json({
      success: true,
      data: { ...campaign, brand_breakdown: brandBreakdown.results, provider_breakdown: providerBreakdown.results },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/campaigns/:id/threats
export async function handleCampaignThreats(request: Request, env: Env, campaignId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const rows = await env.DB.prepare(`
      SELECT t.id, t.threat_type, t.severity, t.status, t.malicious_domain, t.malicious_url,
             t.ip_address, t.country_code, t.hosting_provider_id,
             t.target_brand_id, b.name AS brand_name,
             t.first_seen, t.last_seen, t.created_at
      FROM threats t LEFT JOIN brands b ON b.id = t.target_brand_id
      WHERE t.campaign_id = ?
      ORDER BY t.created_at DESC LIMIT ? OFFSET ?
    `).bind(campaignId, limit, offset).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/campaigns/:id/infrastructure
export async function handleCampaignInfrastructure(request: Request, env: Env, campaignId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const [domains, ips, providers] = await Promise.all([
      env.DB.prepare(`
        SELECT DISTINCT malicious_domain AS domain, ip_address, hosting_provider_id
        FROM threats WHERE campaign_id = ? AND malicious_domain IS NOT NULL
        LIMIT 100
      `).bind(campaignId).all(),
      env.DB.prepare(`
        SELECT DISTINCT ip_address, COUNT(*) AS domain_count, hosting_provider_id, country_code
        FROM threats WHERE campaign_id = ? AND ip_address IS NOT NULL
        GROUP BY ip_address ORDER BY domain_count DESC LIMIT 50
      `).bind(campaignId).all(),
      env.DB.prepare(`
        SELECT DISTINCT t.hosting_provider_id AS provider_id,
               COALESCE(hp.name, t.hosting_provider_id) AS provider_name,
               COUNT(*) AS threat_count
        FROM threats t
        LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
        WHERE t.campaign_id = ? AND t.hosting_provider_id IS NOT NULL
        GROUP BY t.hosting_provider_id ORDER BY threat_count DESC
      `).bind(campaignId).all(),
    ]);

    return json({
      success: true,
      data: { domains: domains.results, ips: ips.results, providers: providers.results },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/campaigns/:id/brands
export async function handleCampaignBrands(request: Request, env: Env, campaignId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT b.id, b.name, b.sector, COUNT(t.id) AS threat_count
      FROM threats t JOIN brands b ON b.id = t.target_brand_id
      WHERE t.campaign_id = ?
      GROUP BY b.id ORDER BY threat_count DESC
    `).bind(campaignId).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/campaigns/:id/timeline
export async function handleCampaignTimeline(request: Request, env: Env, campaignId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT date(created_at) AS period, COUNT(*) AS count,
             SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) AS phishing,
             SUM(CASE WHEN threat_type = 'typosquatting' THEN 1 ELSE 0 END) AS typosquatting
      FROM threats WHERE campaign_id = ?
      GROUP BY date(created_at) ORDER BY period ASC
    `).bind(campaignId).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
