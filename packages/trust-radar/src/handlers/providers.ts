// TODO: Refactor to use handler-utils (Phase 6 continuation)
// Averrow — Provider Intelligence API Endpoints

import { json } from "../lib/cors";
import type { Env } from "../types";

// GET /api/providers/stats (top providers by threat count)
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

    let periodWhere = "created_at >= date('now', 'start of day')";
    if (period === "7d") periodWhere = "created_at >= date('now', '-7 days')";
    else if (period === "30d") periodWhere = "created_at >= date('now', '-30 days')";
    else if (period === "all") periodWhere = "1=1";

    const summary = await env.DB.prepare(`
      SELECT COUNT(DISTINCT hosting_provider_id) as total_providers,
             COUNT(*) as total_threats,
             SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
             SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high
      FROM threats WHERE hosting_provider_id IS NOT NULL AND ${periodWhere}
    `).first();

    return json({ success: true, data: { providers: stats.results, summary, period } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers
export async function handleListProviders(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const search = url.searchParams.get("q");

    const conditions: string[] = ["t.hosting_provider_id IS NOT NULL"];
    const params: unknown[] = [];
    if (search) {
      conditions.push("(COALESCE(hp.name, t.hosting_provider_id) LIKE ? OR hp.asn LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    params.push(limit, offset);

    const where = `WHERE ${conditions.join(" AND ")}`;

    const rows = await env.DB.prepare(`
      SELECT t.hosting_provider_id AS id, t.hosting_provider_id AS provider_id,
             COALESCE(hp.name, t.hosting_provider_id) AS name,
             hp.asn, hp.country AS country_code,
             hp.reputation_score, hp.avg_response_time AS avg_response_time_hours,
             hp.trend_7d AS trend_7d_pct, hp.trend_30d AS trend_30d_pct,
             COUNT(*) AS threat_count,
             SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) AS active_threats,
             SUM(CASE WHEN t.severity IN ('critical','high') THEN 1 ELSE 0 END) AS high_sev,
             MIN(t.created_at) AS first_seen,
             MAX(t.created_at) AS last_seen,
             (
               SELECT json_group_array(daily_count)
               FROM (
                 SELECT COUNT(*) as daily_count
                 FROM threats t2
                 WHERE t2.hosting_provider_id = t.hosting_provider_id
                   AND t2.created_at >= datetime('now', '-14 days')
                 GROUP BY date(t2.created_at)
                 ORDER BY date(t2.created_at) ASC
               )
             ) as threat_history_json
      FROM threats t
      LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
      ${where}
      GROUP BY t.hosting_provider_id
      ORDER BY threat_count DESC LIMIT ? OFFSET ?
    `).bind(...params).all();

    const data = rows.results.map((row: Record<string, unknown>) => ({
      ...row,
      threat_history: row.threat_history_json
        ? JSON.parse(row.threat_history_json as string)
        : undefined,
      threat_history_json: undefined,
    }));
    return json({ success: true, data }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/worst
export async function handleWorstProviders(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT t.hosting_provider_id AS provider_id,
             COALESCE(hp.name, t.hosting_provider_id) AS name,
             hp.asn, hp.country AS country_code,
             hp.reputation_score, hp.avg_response_time AS avg_response_time_hours,
             COUNT(*) AS threat_count,
             SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) AS active_count,
             COUNT(DISTINCT t.target_brand_id) AS brands_targeted,
             COALESCE(ROUND(
               (CAST(SUM(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS REAL) /
                NULLIF(SUM(CASE WHEN t.created_at >= datetime('now', '-14 days') AND t.created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) - 1) * 100
             , 1), 0) AS trend_7d_pct
      FROM threats t
      LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
      WHERE t.hosting_provider_id IS NOT NULL
      GROUP BY t.hosting_provider_id
      ORDER BY threat_count DESC LIMIT 10
    `).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/improving
export async function handleImprovingProviders(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Providers where recent (7d) threats < previous (8-14d) threats
    const rows = await env.DB.prepare(`
      SELECT t.hosting_provider_id AS provider_id,
             COALESCE(hp.name, t.hosting_provider_id) AS name,
             hp.asn, hp.country AS country_code,
             hp.reputation_score, hp.avg_response_time AS avg_response_time_hours,
             SUM(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS threat_count,
             SUM(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS recent,
             SUM(CASE WHEN t.created_at >= datetime('now', '-14 days') AND t.created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END) AS previous,
             COALESCE(ROUND(
               (CAST(SUM(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS REAL) /
                NULLIF(SUM(CASE WHEN t.created_at >= datetime('now', '-14 days') AND t.created_at < datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) - 1) * 100
             , 1), 0) AS trend_7d_pct
      FROM threats t
      LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
      WHERE t.hosting_provider_id IS NOT NULL AND t.created_at >= datetime('now', '-14 days')
      GROUP BY t.hosting_provider_id
      HAVING previous > 0 AND recent < previous
      ORDER BY (CAST(recent AS REAL) / previous) ASC
      LIMIT 10
    `).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/:id (detail)
export async function handleGetProvider(request: Request, env: Env, providerId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const decoded = decodeURIComponent(providerId);

    // Try to get provider info from hosting_providers table
    const providerInfo = await env.DB.prepare(
      "SELECT id, name, asn, country, reputation_score, avg_response_time FROM hosting_providers WHERE id = ?"
    ).bind(decoded).first<{ id: string; name: string; asn: string | null; country: string | null; reputation_score: number | null; avg_response_time: number | null }>();

    const displayName = providerInfo?.name ?? decoded;

    const [stats, brandBreakdown, typeBreakdown] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) AS total_threats,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_threats,
               COUNT(DISTINCT target_brand_id) AS brands_targeted,
               COUNT(DISTINCT campaign_id) AS campaigns,
               MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
        FROM threats WHERE hosting_provider_id = ?
      `).bind(decoded).first(),
      env.DB.prepare(`
        SELECT target_brand_id AS brand_id, b.name AS brand_name, COUNT(*) AS count
        FROM threats t LEFT JOIN brands b ON b.id = t.target_brand_id
        WHERE t.hosting_provider_id = ? AND t.target_brand_id IS NOT NULL
        GROUP BY target_brand_id ORDER BY count DESC LIMIT 10
      `).bind(decoded).all(),
      env.DB.prepare(`
        SELECT threat_type, COUNT(*) AS count
        FROM threats WHERE hosting_provider_id = ?
        GROUP BY threat_type ORDER BY count DESC
      `).bind(decoded).all(),
    ]);

    return json({
      success: true,
      data: {
        id: decoded,
        name: displayName,
        asn: providerInfo?.asn ?? null,
        country: providerInfo?.country ?? null,
        reputation_score: providerInfo?.reputation_score ?? null,
        avg_response_time: providerInfo?.avg_response_time ?? null,
        ...stats,
        brand_breakdown: brandBreakdown.results,
        type_breakdown: typeBreakdown.results,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/:id/threats
export async function handleProviderDrilldown(request: Request, env: Env, provider: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const rows = await env.DB.prepare(`
      SELECT t.id, t.threat_type, t.severity, t.status, t.malicious_domain, t.malicious_url,
             t.ip_address, t.country_code, t.target_brand_id, b.name AS brand_name,
             t.first_seen, t.last_seen, t.created_at
      FROM threats t LEFT JOIN brands b ON b.id = t.target_brand_id
      WHERE t.hosting_provider_id = ?
      ORDER BY t.created_at DESC LIMIT ? OFFSET ?
    `).bind(decodeURIComponent(provider), limit, offset).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/:id/brands
export async function handleProviderBrands(request: Request, env: Env, providerId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT b.id, b.name, b.sector, COUNT(t.id) AS threat_count
      FROM threats t JOIN brands b ON b.id = t.target_brand_id
      WHERE t.hosting_provider_id = ?
      GROUP BY b.id ORDER BY threat_count DESC LIMIT 20
    `).bind(decodeURIComponent(providerId)).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/:id/timeline
export async function handleProviderTimeline(request: Request, env: Env, providerId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const period = new URL(request.url).searchParams.get("period") ?? "7d";
    let bucket = "strftime('%Y-%m-%dT%H:00', created_at)";
    let since = "datetime('now', '-7 days')";
    if (period === "24h") { since = "datetime('now', '-1 day')"; }
    else if (period === "30d") { since = "datetime('now', '-30 days')"; bucket = "date(created_at)"; }
    else if (period === "90d") { since = "datetime('now', '-90 days')"; bucket = "date(created_at)"; }

    const rows = await env.DB.prepare(`
      SELECT ${bucket} AS period, COUNT(*) AS count
      FROM threats WHERE hosting_provider_id = ? AND created_at >= ${since}
      GROUP BY ${bucket} ORDER BY period ASC
    `).bind(decodeURIComponent(providerId)).all();

    const results = rows.results as Array<{ period: string; count: number }>;
    const labels = results.map(r => r.period);
    const values = results.map(r => r.count);

    return json({ success: true, data: { labels, values } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/intelligence — Infrastructure Intelligence summary stats
export async function handleProviderIntelligence(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const [providerStats, clusterStats] = await Promise.all([
      env.DB.prepare(`
        SELECT
          COUNT(*) AS total_providers,
          SUM(CASE WHEN active_threat_count > 0 THEN 1 ELSE 0 END) AS active_operations,
          SUM(CASE WHEN trend_7d > 0 AND trend_30d > 0 AND trend_7d > trend_30d / 4.0 THEN 1 ELSE 0 END) AS accelerating,
          SUM(CASE WHEN trend_7d = 0 AND trend_30d > 50 THEN 1 ELSE 0 END) AS pivots_detected
        FROM hosting_providers
      `).first(),
      env.DB.prepare(`
        SELECT COUNT(*) AS total_clusters,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_clusters
        FROM infrastructure_clusters
      `).first(),
    ]);

    return json({
      success: true,
      data: {
        total_providers: providerStats?.total_providers ?? 0,
        active_operations: providerStats?.active_operations ?? 0,
        accelerating: providerStats?.accelerating ?? 0,
        pivots_detected: providerStats?.pivots_detected ?? 0,
        total_clusters: clusterStats?.total_clusters ?? 0,
        active_clusters: clusterStats?.active_clusters ?? 0,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/v2 — Enhanced provider list with status filtering and cluster linkage
export async function handleListProvidersV2(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const search = url.searchParams.get("q");
    const country = url.searchParams.get("country");
    const status = url.searchParams.get("status"); // active|accelerating|pivot|quiet
    const sort = url.searchParams.get("sort") ?? "active_threats"; // active_threats|trend_7d|trend_30d
    const clusterId = url.searchParams.get("cluster_id");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push("(hp.name LIKE ? OR hp.asn LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (country) {
      conditions.push("hp.country = ?");
      params.push(country);
    }
    if (status === "accelerating") {
      conditions.push("hp.trend_7d > 0 AND hp.trend_30d > 0 AND hp.trend_7d > hp.trend_30d / 4.0");
    } else if (status === "pivot") {
      conditions.push("hp.trend_7d = 0 AND hp.trend_30d > 50");
    } else if (status === "active") {
      conditions.push("hp.active_threat_count > 0");
    } else if (status === "quiet") {
      conditions.push("hp.active_threat_count = 0");
    }

    // If filtering by cluster, get ASNs from cluster first
    let clusterAsnFilter = "";
    if (clusterId) {
      const cluster = await env.DB.prepare(
        "SELECT asns FROM infrastructure_clusters WHERE id = ?"
      ).bind(clusterId).first<{ asns: string }>();
      if (cluster?.asns) {
        try {
          const asns = JSON.parse(cluster.asns) as string[];
          if (asns.length > 0) {
            const placeholders = asns.map(() => "?").join(",");
            clusterAsnFilter = `hp.asn IN (${placeholders})`;
            conditions.push(clusterAsnFilter);
            params.push(...asns);
          }
        } catch { /* ignore parse error */ }
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    let orderBy = "hp.active_threat_count DESC";
    if (sort === "trend_7d") orderBy = "hp.trend_7d DESC";
    else if (sort === "trend_30d") orderBy = "hp.trend_30d DESC";

    params.push(limit, offset);

    const rows = await env.DB.prepare(`
      SELECT hp.id, hp.name, hp.asn, hp.country,
             hp.active_threat_count, hp.total_threat_count,
             hp.trend_7d, hp.trend_30d,
             hp.reputation_score, hp.avg_response_time,
             hp.is_bulletproof,
             MIN(t.created_at) AS first_threat,
             MAX(t.created_at) AS last_threat,
             (
               SELECT json_group_array(daily_count)
               FROM (
                 SELECT COUNT(*) as daily_count
                 FROM threats t2
                 WHERE t2.hosting_provider_id = hp.id
                   AND t2.created_at >= datetime('now', '-14 days')
                 GROUP BY date(t2.created_at)
                 ORDER BY date(t2.created_at) ASC
               )
             ) as threat_history_json
      FROM hosting_providers hp
      LEFT JOIN threats t ON t.hosting_provider_id = hp.id
      ${where}
      GROUP BY hp.id
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...params).all();

    // Count total for pagination
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) AS total FROM hosting_providers hp ${where}
    `).bind(...params.slice(0, params.length - 2)).all();
    const total = (countResult.results[0] as Record<string, unknown>)?.total ?? 0;

    const data = rows.results.map((row: Record<string, unknown>) => ({
      ...row,
      threat_history: row.threat_history_json
        ? JSON.parse(row.threat_history_json as string)
        : undefined,
      threat_history_json: undefined,
    }));

    return json({ success: true, data, meta: { total, limit, offset } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/clusters — List infrastructure clusters
export async function handleListClusters(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "30", 10));

    const rows = await env.DB.prepare(`
      SELECT id, cluster_name, asns, countries, threat_count, status,
             confidence_score, agent_notes, first_detected, last_seen, last_updated
      FROM infrastructure_clusters
      ORDER BY threat_count DESC
      LIMIT ?
    `).bind(limit).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/:id/clusters — Clusters linked to a provider's ASN
export async function handleProviderClusters(request: Request, env: Env, providerId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const decoded = decodeURIComponent(providerId);
    const provider = await env.DB.prepare(
      "SELECT asn FROM hosting_providers WHERE id = ?"
    ).bind(decoded).first<{ asn: string | null }>();

    if (!provider?.asn) {
      return json({ success: true, data: [] }, 200, origin);
    }

    const rows = await env.DB.prepare(`
      SELECT id, cluster_name, asns, countries, threat_count, status,
             confidence_score, agent_notes, first_detected, last_seen
      FROM infrastructure_clusters
      WHERE asns LIKE ?
      ORDER BY threat_count DESC
    `).bind(`%${provider.asn}%`).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/providers/:id/locations
export async function handleProviderLocations(request: Request, env: Env, providerId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT country_code, COUNT(*) AS count,
             AVG(CAST(lat AS REAL)) AS lat, AVG(CAST(lng AS REAL)) AS lng
      FROM threats WHERE hosting_provider_id = ? AND country_code IS NOT NULL AND country_code NOT IN ('XX','PRIV')
      GROUP BY country_code ORDER BY count DESC
    `).bind(decodeURIComponent(providerId)).all();

    const mappable = rows.results.filter((r: Record<string, unknown>) => r.lat != null && r.lng != null);
    return json({ success: true, data: mappable, totalCountries: rows.results.length }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}
