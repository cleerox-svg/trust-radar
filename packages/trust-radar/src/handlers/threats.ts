// TODO: Refactor to use handler-utils (Phase 6 continuation)
import { json } from "../lib/cors";
import { enrichThreatsGeo } from "../lib/geoip";
import type { Env, UpdateThreatBody } from "../types";
import type { OrgScope } from "../middleware/auth";

// ─── List threats with filtering ────────────────────────────────
export async function handleListThreats(request: Request, env: Env, scope?: OrgScope | null): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const severity = url.searchParams.get("severity");
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const source = url.searchParams.get("source");
    const search = url.searchParams.get("q");

    const conditions: string[] = [];
    const params: unknown[] = [];

    // Org scope filtering — use t. prefix for aliased query
    if (scope) {
      if (scope.brand_ids.length === 0) {
        return json({ success: true, data: { threats: [], total: 0 } }, 200, origin);
      }
      const placeholders = scope.brand_ids.map(() => "?").join(", ");
      conditions.push(`t.target_brand_id IN (${placeholders})`);
      params.push(...scope.brand_ids);
    }

    if (severity) { conditions.push("t.severity = ?"); params.push(severity); }
    if (type) { conditions.push("t.threat_type = ?"); params.push(type); }
    if (status) { conditions.push("t.status = ?"); params.push(status); }
    if (source) { conditions.push("t.source_feed = ?"); params.push(source); }
    if (search) {
      conditions.push("(t.malicious_domain LIKE ? OR t.malicious_url LIKE ? OR t.ip_address LIKE ? OR t.ioc_value LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    let rows: D1Result;
    try {
      rows = await env.DB.prepare(
        `SELECT t.id, t.threat_type, t.severity, t.confidence_score, t.status, t.source_feed,
                t.ioc_value, t.malicious_domain, t.malicious_url, t.ip_address, t.asn,
                t.country_code, t.target_brand_id, t.hosting_provider_id, t.campaign_id,
                t.first_seen, t.last_seen, t.created_at, t.lat, t.lng,
                b.name AS brand_name,
                (SELECT tai2.threat_actor_id FROM threat_actor_infrastructure tai2 WHERE tai2.asn = t.asn LIMIT 1) AS actor_id,
                (SELECT ta2.name FROM threat_actors ta2 JOIN threat_actor_infrastructure tai3 ON tai3.threat_actor_id = ta2.id WHERE tai3.asn = t.asn LIMIT 1) AS actor_name
         FROM threats t
         LEFT JOIN brands b ON b.id = t.target_brand_id
         ${where}
         ORDER BY t.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params).all();
    } catch {
      // Fallback if threat_actor_infrastructure table doesn't exist
      rows = await env.DB.prepare(
        `SELECT t.id, t.threat_type, t.severity, t.confidence_score, t.status, t.source_feed,
                t.ioc_value, t.malicious_domain, t.malicious_url, t.ip_address, t.asn,
                t.country_code, t.target_brand_id, t.hosting_provider_id, t.campaign_id,
                t.first_seen, t.last_seen, t.created_at, t.lat, t.lng,
                b.name AS brand_name,
                NULL AS actor_id,
                NULL AS actor_name
         FROM threats t
         LEFT JOIN brands b ON b.id = t.target_brand_id
         ${where}
         ORDER BY t.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params).all();
    }

    const countParams = params.slice(0, -2);
    const total = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM threats t ${where}`
    ).bind(...countParams).first<{ cnt: number }>();

    return json({ success: true, data: { threats: rows.results, total: total?.cnt ?? 0 } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── Threat stats for dashboard ─────────────────────────────────
export async function handleThreatStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const summary = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'remediated' THEN 1 ELSE 0 END) as remediated,
        COUNT(DISTINCT source_feed) as sources,
        COUNT(DISTINCT threat_type) as types
      FROM threats
    `).first();

    const last24h = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high
      FROM threats WHERE created_at >= datetime('now', '-24 hours')
    `).first();

    const today = await env.DB.prepare(`
      SELECT
        COUNT(*) as threats_flagged,
        COUNT(DISTINCT country_code) as countries_active,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_today,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_today
      FROM threats WHERE created_at >= date('now', 'start of day')
    `).first<{
      threats_flagged: number; countries_active: number;
      critical_today: number; high_today: number;
    }>();

    const yesterday = await env.DB.prepare(`
      SELECT
        COUNT(*) as threats_flagged,
        COUNT(DISTINCT country_code) as countries_active
      FROM threats WHERE created_at >= date('now', '-1 day', 'start of day') AND created_at < date('now', 'start of day')
    `).first<{ threats_flagged: number; countries_active: number }>();

    // Feed ingestion counts for today (v2 table)
    const feedIngestionsToday = await env.DB.prepare(
      "SELECT COALESCE(SUM(records_ingested), 0) as items_today FROM feed_pull_history WHERE started_at >= date('now', 'start of day') AND status = 'success'"
    ).first<{ items_today: number }>();

    const byType = await env.DB.prepare(
      "SELECT threat_type, COUNT(*) as count FROM threats GROUP BY threat_type ORDER BY count DESC LIMIT 10"
    ).all();

    const bySource = await env.DB.prepare(
      "SELECT source_feed, COUNT(*) as count FROM threats GROUP BY source_feed ORDER BY count DESC LIMIT 10"
    ).all();

    const bySeverity = await env.DB.prepare(
      "SELECT severity, COUNT(*) as count FROM threats GROUP BY severity"
    ).all();

    const byCountry = await env.DB.prepare(
      "SELECT country_code, COUNT(*) as count FROM threats WHERE country_code IS NOT NULL GROUP BY country_code ORDER BY count DESC LIMIT 30"
    ).all();

    // Recent threats for live feed
    const recentThreats = await env.DB.prepare(`
      SELECT id, threat_type, severity, source_feed, malicious_domain, ioc_value,
             ip_address, country_code, lat, lng, created_at
      FROM threats ORDER BY created_at DESC LIMIT 20
    `).all();

    // Top origin countries (by threat count today)
    const topOriginsToday = await env.DB.prepare(`
      SELECT country_code, COUNT(*) as count
      FROM threats
      WHERE country_code IS NOT NULL AND created_at >= date('now', 'start of day')
      GROUP BY country_code ORDER BY count DESC LIMIT 10
    `).all();

    // Hosting provider breakdown (v2: join hosting_providers)
    let byProvider: unknown[] = [];
    try {
      const providerRows = await env.DB.prepare(`
        SELECT hp.name as hosting_provider, COUNT(*) as count,
          SUM(CASE WHEN t.severity = 'critical' THEN 1 ELSE 0 END) as critical,
          SUM(CASE WHEN t.severity = 'high' THEN 1 ELSE 0 END) as high
        FROM threats t
        JOIN hosting_providers hp ON t.hosting_provider_id = hp.id
        GROUP BY hp.name ORDER BY count DESC LIMIT 20
      `).all();
      byProvider = providerRows.results;
    } catch { /* table may not be populated yet */ }

    const dailyStats = {
      scansToday: feedIngestionsToday?.items_today ?? 0,
      scansYesterday: 0,
      threatsFlagged: today?.threats_flagged ?? 0,
      threatsYesterday: yesterday?.threats_flagged ?? 0,
      countriesActive: today?.countries_active ?? 0,
      countriesYesterday: yesterday?.countries_active ?? 0,
    };

    return json({
      success: true,
      data: {
        summary, last24h, dailyStats,
        byType: byType.results, bySource: bySource.results,
        bySeverity: bySeverity.results, byCountry: byCountry.results,
        byProvider,
        recentThreats: recentThreats.results,
        topOriginsToday: topOriginsToday.results,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── Get single threat ──────────────────────────────────────────
export async function handleGetThreat(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const threat = await env.DB.prepare("SELECT * FROM threats WHERE id = ?").bind(id).first();
    if (!threat) return json({ success: false, error: "Threat not found" }, 404, origin);
    return json({ success: true, data: threat }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── Update threat status ───────────────────────────────────────
export async function handleUpdateThreat(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as UpdateThreatBody;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.status) { updates.push("status = ?"); values.push(body.status); }
    if (body.severity) { updates.push("severity = ?"); values.push(body.severity); }
    if (body.confidence_score != null) { updates.push("confidence_score = ?"); values.push(body.confidence_score); }

    if (updates.length === 0) return json({ success: false, error: "No valid fields" }, 400, origin);

    updates.push("last_seen = datetime('now')");
    values.push(id);

    await env.DB.prepare(`UPDATE threats SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── List briefings (v1 compat stub) ────────────────────────────
export async function handleListBriefings(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(
      `SELECT id, type, report_date, report_data, generated_at, trigger, emailed
       FROM threat_briefings ORDER BY generated_at DESC LIMIT 20`
    ).all();
    return json({ success: true, data: rows.results }, 200, origin);
  } catch {
    // Table may not exist in v2
    return json({ success: true, data: [] }, 200, origin);
  }
}

// ─── Get briefing detail (v1 compat stub) ───────────────────────
export async function handleGetBriefing(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const briefing = await env.DB.prepare("SELECT * FROM threat_briefings WHERE id = ?").bind(id).first();
    if (!briefing) return json({ success: false, error: "Briefing not found" }, 404, origin);
    return json({ success: true, data: briefing }, 200, origin);
  } catch {
    return json({ success: false, error: "Not available in v2" }, 410, origin);
  }
}

// ─── Social IOCs (v1 compat stub) ───────────────────────────────
export async function handleListSocialIOCs(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const platform = url.searchParams.get("platform");

    let query = `SELECT id, platform, author, post_url, ioc_type, ioc_value, confidence, context, tags, verified, captured_at, created_at
                 FROM social_iocs`;
    const params: unknown[] = [];
    if (platform) { query += " WHERE platform = ?"; params.push(platform); }
    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const rows = await env.DB.prepare(query).bind(...params).all();
    return json({ success: true, data: { iocs: rows.results, stats: {} } }, 200, origin);
  } catch {
    return json({ success: true, data: { iocs: [], stats: {} } }, 200, origin);
  }
}

// ─── GeoIP Enrichment ─────────────────────────────────────────
export async function handleEnrichGeo(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const result = await enrichThreatsGeo(env.DB);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── Full enrichment pipeline trigger ─────────────────────────
export async function handleEnrichAll(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const { runEnrichmentPipeline } = await import("../lib/enrichment");
    const result = await runEnrichmentPipeline(env);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── Geo clusters for Observatory map ─────────────────────────
export async function handleGeoClusters(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT country_code, COUNT(*) AS threat_count,
             AVG(lat) AS lat, AVG(lng) AS lng,
             COUNT(DISTINCT target_brand_id) AS brands_targeted,
             COUNT(DISTINCT hosting_provider_id) AS provider_count,
             MIN(CASE
               WHEN severity = 'critical' THEN 'critical'
               WHEN severity = 'high' THEN 'high'
               WHEN severity = 'medium' THEN 'medium'
               ELSE 'low'
             END) AS top_severity
      FROM threats
      WHERE country_code IS NOT NULL AND lat IS NOT NULL AND lng IS NOT NULL
      GROUP BY country_code
      ORDER BY threat_count DESC
      LIMIT 50
    `).all();

    // Add computed intensity and top_threat_type
    const maxCount = Math.max(...rows.results.map((r: Record<string, unknown>) => (r.threat_count as number) || 1), 1);
    const enriched = await Promise.all(rows.results.map(async (r: Record<string, unknown>) => {
      const topType = await env.DB.prepare(
        `SELECT threat_type, COUNT(*) AS cnt FROM threats
         WHERE country_code = ? GROUP BY threat_type ORDER BY cnt DESC LIMIT 1`
      ).bind(r.country_code).first<{ threat_type: string }>();

      return {
        ...r,
        intensity: Math.min(1, (r.threat_count as number) / maxCount),
        top_threat_type: topType?.threat_type || null,
        country: r.country_code,
      };
    }));

    return json({ success: true, data: enriched }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── Brand HQ coordinates for attack flow arc targets ─────────
const BRAND_HQ_COORDS: Record<string, [number, number]> = {
  'paypal.com':        [37.3790, -121.9687],
  'stripe.com':        [37.7749, -122.4194],
  'visa.com':          [37.4419, -122.1430],
  'mastercard.com':    [40.7549,  -73.9840],
  'google.com':        [37.4220, -122.0841],
  'microsoft.com':     [47.6423, -122.1391],
  'apple.com':         [37.3346, -122.0090],
  'amazon.com':        [47.6062, -122.3321],
  'meta.com':          [37.4847, -122.1477],
  'facebook.com':      [37.4847, -122.1477],
  'netflix.com':       [37.2585, -121.9626],
  'twitter.com':       [37.7749, -122.4194],
  'shopify.com':       [45.4215,  -75.6972],
  'ebay.com':          [37.3861, -122.0839],
  'allegro.pl':        [52.4064,   16.9252],
  'docusign.com':      [37.3890, -122.0554],
  'salesforce.com':    [37.7749, -122.4194],
  'okta.com':          [37.7749, -122.4194],
  'cloudflare.com':    [37.7749, -122.4194],
  'instagram.com':     [37.4847, -122.1477],
  'linkedin.com':      [37.3861, -122.0839],
  'tiktok.com':        [37.3861, -122.0839],
  'roblox.com':        [37.5630, -122.0530],
  'github.com':        [37.7820, -122.3918],
  'walmart.com':       [36.3729,  -94.2088],
  'target.com':        [44.8600,  -93.3420],
  'chase.com':         [40.7549,  -73.9840],
  'wellsfargo.com':    [37.7749, -122.4194],
  'bankofamerica.com': [35.2271,  -80.8431],
  'att.com':           [32.7767,  -96.7970],
  'verizon.com':       [40.7128,  -74.0060],
  'files.fm':          [56.9460,   24.1059],
  'zdnet.com':         [40.7128,  -74.0060],
  'jd.com':            [39.9042,  116.4074],
  'lowes.com':         [35.5276,  -80.8504],
};

function getFlowBrandHQ(domain: string | null, brandName?: string | null): [number, number] | null {
  if (!domain) return null;
  const clean = domain.replace(/^www\./, '').toLowerCase();
  if (BRAND_HQ_COORDS[clean]) return BRAND_HQ_COORDS[clean];
  for (const [key, coords] of Object.entries(BRAND_HQ_COORDS)) {
    const keyBase = key.split('.')[0] ?? '';
    const cleanBase = clean.split('.')[0] ?? '';
    if (cleanBase && keyBase && (clean.includes(keyBase) || key.includes(cleanBase))) return coords;
  }
  return null;
}

// ─── Attack flows for Observatory arc overlay ─────────────────
export async function handleAttackFlows(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));

    const rows = await env.DB.prepare(`
      SELECT t.country_code AS origin_country,
             t.lat AS origin_lat, t.lng AS origin_lng,
             t.threat_type,
             b.canonical_domain AS target_name,
             b.name AS brand_name,
             COUNT(*) AS volume
      FROM threats t
      JOIN brands b ON b.id = t.target_brand_id
      WHERE t.lat IS NOT NULL
        AND t.lng IS NOT NULL
        AND t.target_brand_id IS NOT NULL
        AND t.status = 'active'
        AND t.threat_type IN ('phishing', 'credential_harvesting',
                              'typosquatting', 'impersonation', 'c2',
                              'malware_distribution')
        AND b.canonical_domain NOT LIKE '%.net'
        AND b.canonical_domain NOT LIKE '%1x1%'
        AND b.canonical_domain NOT LIKE '%1e1%'
        AND b.name NOT LIKE '1%'
        AND LENGTH(b.name) > 4
        AND b.threat_count >= 5
      GROUP BY t.country_code, t.target_brand_id, t.threat_type
      ORDER BY volume DESC
      LIMIT ?
    `).bind(limit).all();

    const flows = rows.results
      .map((r: Record<string, unknown>) => {
        const coords = getFlowBrandHQ(r.target_name as string | null, r.brand_name as string | null);
        if (!coords) return null;
        const [target_lat, target_lng] = coords;
        const jitter = () => (Math.random() - 0.5) * 0.8;
        return {
          origin_lat: r.origin_lat,
          origin_lng: r.origin_lng,
          target_lat: target_lat + jitter(),
          target_lng: target_lng + jitter(),
          volume: r.volume,
          origin_country: r.origin_country,
          target_name: r.target_name,
          threat_type: r.threat_type ?? 'phishing',
        };
      })
      .filter(Boolean);

    return json({ success: true, data: flows }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── Recent threats for live polling ──────────────────────────
export async function handleRecentThreats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

    const rows = await env.DB.prepare(`
      SELECT id, threat_type, severity, source_feed, malicious_domain,
             ip_address, country_code, lat, lng, created_at
      FROM threats
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── Daily snapshot trigger ───────────────────────────────────
export async function handleDailySnapshots(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const { generateDailySnapshots } = await import("../lib/snapshots");
    const result = await generateDailySnapshots(env.DB);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}
