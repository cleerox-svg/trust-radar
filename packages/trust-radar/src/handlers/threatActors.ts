// Averrow — Threat Actor API Handlers

import { json } from "../lib/cors";
import type { Env } from "../types";

// Helper: safely query a table that may not exist, returning a fallback
async function safeQuery<T>(db: D1Database, stmt: D1PreparedStatement, fallback: T): Promise<T> {
  try {
    const result = await stmt.first<T>();
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

async function safeQueryAll(_db: D1Database, stmt: D1PreparedStatement): Promise<{ results: Record<string, unknown>[] }> {
  try {
    return await stmt.all();
  } catch {
    return { results: [] };
  }
}

// GET /api/threat-actors?country=IR&status=active&affiliation=IRGC&limit=50&offset=0
export async function handleListThreatActors(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const country = url.searchParams.get("country");
    const status = url.searchParams.get("status");
    const affiliation = url.searchParams.get("affiliation");
    const search = url.searchParams.get("q");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (country) {
      conditions.push("ta.country_code = ?");
      params.push(country.toUpperCase());
    }
    if (status) {
      conditions.push("ta.status = ?");
      params.push(status);
    }
    if (affiliation) {
      conditions.push("ta.affiliation = ?");
      params.push(affiliation);
    }
    if (search) {
      conditions.push("(ta.name LIKE ? OR ta.aliases LIKE ? OR ta.description LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM threat_actors ta ${where}`
    ).bind(...params).first<{ total: number }>();

    // Column aliases to match frontend field names
    const selectCols = `ta.id, ta.name, ta.aliases,
          ta.affiliation AS attribution,
          ta.country_code AS country,
          ta.capability,
          ta.primary_ttps AS ttps,
          ta.description,
          ta.first_seen, ta.last_seen,
          ta.status,
          ta.attribution_confidence,
          ta.source, ta.created_at, ta.updated_at`;

    const orderBy = `ORDER BY
          CASE ta.status WHEN 'active' THEN 0 ELSE 1 END,
          CASE ta.attribution_confidence
            WHEN 'confirmed' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
          ta.name`;

    // Try query with join table counts first; fall back to basic query if tables missing
    let rows: D1Result;
    try {
      rows = await env.DB.prepare(`
        SELECT ${selectCols},
          (SELECT COUNT(*) FROM threat_actor_infrastructure tai WHERE tai.threat_actor_id = ta.id) AS infra_count,
          (SELECT COUNT(*) FROM threat_actor_targets tat WHERE tat.threat_actor_id = ta.id) AS target_count
        FROM threat_actors ta
        ${where}
        ${orderBy}
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all();
    } catch {
      // Join tables don't exist — query threat_actors alone
      rows = await env.DB.prepare(`
        SELECT ${selectCols}, 0 AS infra_count, 0 AS target_count
        FROM threat_actors ta
        ${where}
        ${orderBy}
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all();
    }

    return json({
      success: true,
      data: rows.results,
      total: countResult?.total ?? 0,
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "Failed to list threat actors" }, 500, origin);
  }
}

// GET /api/threat-actors/stats
export async function handleThreatActorStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM threat_actors").first<{ n: number }>();
    const active = await env.DB.prepare("SELECT COUNT(*) AS n FROM threat_actors WHERE status = 'active'").first<{ n: number }>();
    const byCountry = await env.DB.prepare(`
      SELECT country_code AS country, COUNT(*) AS count
      FROM threat_actors
      GROUP BY country_code
      ORDER BY count DESC
      LIMIT 10
    `).all();
    const byAttribution = await env.DB.prepare(`
      SELECT affiliation AS attribution, COUNT(*) AS count
      FROM threat_actors
      WHERE affiliation IS NOT NULL
      GROUP BY affiliation
      ORDER BY count DESC
    `).all();

    // These tables may not exist if migration 0063 partially failed
    const totalInfra = await safeQuery(env.DB,
      env.DB.prepare("SELECT COUNT(*) AS n FROM threat_actor_infrastructure"),
      { n: 0 }
    );
    const totalTargets = await safeQuery(env.DB,
      env.DB.prepare("SELECT COUNT(DISTINCT brand_id) AS n FROM threat_actor_targets WHERE brand_id IS NOT NULL"),
      { n: 0 }
    );

    return json({
      success: true,
      data: {
        total: total?.n ?? 0,
        active: active?.n ?? 0,
        by_country: byCountry.results,
        by_attribution: byAttribution.results,
        tracked_infrastructure: totalInfra.n ?? 0,
        targeted_brands: totalTargets.n ?? 0,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "Failed to get threat actor stats" }, 500, origin);
  }
}

// GET /api/threat-actors/:id
export async function handleGetThreatActor(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const actor = await env.DB.prepare(`
      SELECT id, name, aliases,
             affiliation AS attribution,
             country_code AS country,
             capability,
             primary_ttps AS ttps,
             description, first_seen, last_seen, status,
             attribution_confidence, source, created_at, updated_at
      FROM threat_actors WHERE id = ?
    `).bind(id).first();
    if (!actor) {
      return json({ success: false, error: "Threat actor not found" }, 404, origin);
    }

    // These tables may not exist — gracefully fall back to empty arrays
    const infrastructure = await safeQueryAll(env.DB,
      env.DB.prepare(
        "SELECT * FROM threat_actor_infrastructure WHERE threat_actor_id = ? ORDER BY last_observed DESC"
      ).bind(id)
    );

    const targets = await safeQueryAll(env.DB,
      env.DB.prepare(`
        SELECT tat.*, b.name AS brand_name, b.canonical_domain
        FROM threat_actor_targets tat
        LEFT JOIN brands b ON b.id = tat.brand_id
        WHERE tat.threat_actor_id = ?
        ORDER BY tat.last_targeted DESC
      `).bind(id)
    );

    // Count threats from this actor's known infrastructure
    const infraAsns = infrastructure.results
      .map((r) => (r as Record<string, unknown>).asn as string | null)
      .filter((a): a is string => a !== null);

    let linkedThreats = 0;
    if (infraAsns.length > 0) {
      const placeholders = infraAsns.map(() => "?").join(",");
      const result = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM threats WHERE asn IN (${placeholders})`
      ).bind(...infraAsns).first<{ n: number }>();
      linkedThreats = result?.n ?? 0;
    }

    return json({
      success: true,
      data: {
        ...actor,
        infrastructure: infrastructure.results,
        targets: targets.results,
        linked_threat_count: linkedThreats,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "Failed to get threat actor" }, 500, origin);
  }
}

// GET /api/threat-actors/by-brand/:brandId
export async function handleThreatActorsByBrand(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await safeQueryAll(env.DB,
      env.DB.prepare(`
        SELECT ta.id, ta.name, ta.aliases,
               ta.affiliation AS attribution,
               ta.country_code AS country,
               ta.capability,
               ta.primary_ttps AS ttps,
               ta.description, ta.first_seen, ta.last_seen, ta.status,
               ta.attribution_confidence, ta.source, ta.created_at, ta.updated_at,
               tat.context, tat.first_targeted, tat.last_targeted
        FROM threat_actors ta
        JOIN threat_actor_targets tat ON tat.threat_actor_id = ta.id
        WHERE tat.brand_id = ?
        ORDER BY
          CASE ta.attribution_confidence
            WHEN 'confirmed' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          ta.name
      `).bind(brandId)
    );

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "Failed to get threat actors for brand" }, 500, origin);
  }
}

// GET /api/threat-actors/:id/threats
export async function handleThreatActorThreats(request: Request, env: Env, actorId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    // Get threats matching this actor's known ASNs (table may not exist)
    const infraAsns = await safeQueryAll(env.DB,
      env.DB.prepare(
        "SELECT DISTINCT asn FROM threat_actor_infrastructure WHERE threat_actor_id = ? AND asn IS NOT NULL"
      ).bind(actorId)
    );

    const asns = infraAsns.results.map(r => (r as Record<string, unknown>).asn as string);
    if (asns.length === 0) {
      return json({ success: true, data: [], total: 0 }, 200, origin);
    }

    const placeholders = asns.map(() => "?").join(",");

    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM threats WHERE asn IN (${placeholders})`
    ).bind(...asns).first<{ total: number }>();

    const threats = await env.DB.prepare(`
      SELECT t.*, b.name AS brand_name
      FROM threats t
      LEFT JOIN brands b ON b.id = t.target_brand_id
      WHERE t.asn IN (${placeholders})
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...asns, limit, offset).all();

    return json({
      success: true,
      data: threats.results,
      total: countResult?.total ?? 0,
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "Failed to get threat actor threats" }, 500, origin);
  }
}
