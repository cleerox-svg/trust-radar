// Averrow — Threat Actor API Handlers

import { json } from "../lib/cors";
import { getDbContext, getReadSession, attachBookmark } from "../lib/db";
import type { Env } from "../types";

// Helper: safely query a table that may not exist, returning a fallback
async function safeQuery<T>(session: D1Database, stmt: D1PreparedStatement, fallback: T): Promise<T> {
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

// GET /api/threat-actors?country=IR&status=active&attribution=IRGC&limit=50&offset=0
export async function handleListThreatActors(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const ctx = getDbContext(request);
  const session = getReadSession(env, ctx);
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const country = url.searchParams.get("country");
    const status = url.searchParams.get("status");
    const attribution = url.searchParams.get("affiliation") ?? url.searchParams.get("attribution");
    const search = url.searchParams.get("q");

    // KV cache — 5 min TTL. Key includes all filter dimensions.
    const cacheKey = `threat_actors:${limit}:${offset}:${country ?? ""}:${status ?? ""}:${attribution ?? ""}:${search ?? ""}`;
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return attachBookmark(json(JSON.parse(cached), 200, origin), session);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (country) {
      conditions.push("ta.country = ?");
      params.push(country.toUpperCase());
    }
    if (status) {
      conditions.push("ta.status = ?");
      params.push(status);
    }
    if (attribution) {
      conditions.push("ta.attribution = ?");
      params.push(attribution);
    }
    if (search) {
      conditions.push("(ta.name LIKE ? OR ta.aliases LIKE ? OR ta.description LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Column names match actual DB schema
    const selectCols = `ta.id, ta.name, ta.aliases,
          ta.attribution,
          ta.country,
          ta.ttps,
          ta.description,
          ta.target_sectors,
          ta.active_campaigns,
          ta.first_seen, ta.last_seen,
          ta.status,
          ta.created_at, ta.updated_at`;

    const orderBy = `ORDER BY
          CASE ta.status WHEN 'active' THEN 0 ELSE 1 END,
          ta.name`;

    // Run count + list in parallel
    const countPromise = session.prepare(
      `SELECT COUNT(*) AS total FROM threat_actors ta ${where}`
    ).bind(...params).first<{ total: number }>();

    // Try query with join table counts first; fall back to basic query if tables missing
    let rowsPromise: Promise<D1Result>;
    try {
      rowsPromise = session.prepare(`
        SELECT ${selectCols},
          (SELECT COUNT(*) FROM threat_actor_infrastructure tai WHERE tai.threat_actor_id = ta.id) AS infra_count,
          (SELECT COUNT(*) FROM threat_actor_targets tat WHERE tat.threat_actor_id = ta.id) AS target_count
        FROM threat_actors ta
        ${where}
        ${orderBy}
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all();
    } catch {
      rowsPromise = session.prepare(`
        SELECT ${selectCols}, 0 AS infra_count, 0 AS target_count
        FROM threat_actors ta
        ${where}
        ${orderBy}
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all();
    }

    const [countResult, rows] = await Promise.all([countPromise, rowsPromise]);

    const data = {
      success: true,
      data: rows.results,
      total: countResult?.total ?? 0,
    };
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
    return attachBookmark(json(data, 200, origin), session);
  } catch (err) {
    return attachBookmark(json({ success: false, error: "Failed to list threat actors" }, 500, origin), session);
  }
}

// GET /api/threat-actors/stats
export async function handleThreatActorStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const ctx = getDbContext(request);
  const session = getReadSession(env, ctx);
  try {
    // KV cache — 5 min TTL.
    const cacheKey = "threat_actor_stats";
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return attachBookmark(json(JSON.parse(cached), 200, origin), session);

    // Run all 6 queries in parallel
    const [total, active, byCountry, byAttribution, totalInfra, totalTargets] = await Promise.all([
      session.prepare("SELECT COUNT(*) AS n FROM threat_actors").first<{ n: number }>(),
      session.prepare("SELECT COUNT(*) AS n FROM threat_actors WHERE status = 'active'").first<{ n: number }>(),
      session.prepare(`
        SELECT country, COUNT(*) AS count
        FROM threat_actors
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `).all(),
      session.prepare(`
        SELECT attribution, COUNT(*) AS count
        FROM threat_actors
        WHERE attribution IS NOT NULL
        GROUP BY attribution
        ORDER BY count DESC
      `).all(),
      // These tables may not exist if migration 0063 partially failed
      safeQuery(session as unknown as D1Database,
        session.prepare("SELECT COUNT(*) AS n FROM threat_actor_infrastructure"),
        { n: 0 }
      ),
      safeQuery(session as unknown as D1Database,
        session.prepare("SELECT COUNT(DISTINCT brand_id) AS n FROM threat_actor_targets WHERE brand_id IS NOT NULL"),
        { n: 0 }
      ),
    ]);

    const data = {
      success: true,
      data: {
        total: total?.n ?? 0,
        active: active?.n ?? 0,
        by_country: byCountry.results,
        by_attribution: byAttribution.results,
        tracked_infrastructure: totalInfra.n ?? 0,
        targeted_brands: totalTargets.n ?? 0,
      },
    };
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
    return attachBookmark(json(data, 200, origin), session);
  } catch (err) {
    return attachBookmark(json({ success: false, error: "Failed to get threat actor stats" }, 500, origin), session);
  }
}

// GET /api/threat-actors/:id
export async function handleGetThreatActor(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const actor = await env.DB.prepare(`
      SELECT id, name, aliases,
             attribution,
             country,
             ttps,
             description,
             target_sectors,
             active_campaigns,
             first_seen, last_seen, status,
             created_at, updated_at
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
               ta.attribution,
               ta.country,
               ta.ttps,
               ta.description,
               ta.target_sectors,
               ta.active_campaigns,
               ta.first_seen, ta.last_seen, ta.status,
               ta.created_at, ta.updated_at,
               tat.context, tat.first_targeted, tat.last_targeted
        FROM threat_actors ta
        JOIN threat_actor_targets tat ON tat.threat_actor_id = ta.id
        WHERE tat.brand_id = ?
        ORDER BY ta.name
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
