// Averrow — Threat Actor API Handlers

import { json } from "../lib/cors";
import { getDbContext, getReadSession, attachBookmark } from "../lib/db";
import { newTally, addToTally, recordD1Reads } from "../lib/analytics";
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
    if (cached) {
      recordD1Reads(env, "threat_actors_list", newTally());
      return attachBookmark(json(JSON.parse(cached), 200, origin), session);
    }
    const tally = newTally();

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
    if (attribution) {
      conditions.push("ta.affiliation = ?");
      params.push(attribution);
    }
    if (search) {
      conditions.push("(ta.name LIKE ? OR ta.aliases LIKE ? OR ta.description LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Column names from actual DB schema (migration 0063), aliased to the
    // shape the frontend expects. target_sectors and active_campaigns are
    // derived/NULL for now (not stored as columns).
    //
    // last_seen falls back to first_seen so the card footer always has a
    // date to render. Migration 0093 backfills last_seen in the DB, but this
    // COALESCE keeps the API honest for any row where Sentinel hasn't bumped
    // last_seen yet.
    const selectCols = `ta.id, ta.name, ta.aliases,
          ta.affiliation AS attribution,
          ta.country_code AS country,
          ta.primary_ttps AS ttps,
          ta.capability,
          ta.description,
          ta.first_seen,
          COALESCE(ta.last_seen, ta.first_seen) AS last_seen,
          ta.status, ta.attribution_confidence,
          ta.created_at, ta.updated_at,
          NULL AS target_sectors,
          NULL AS active_campaigns`;

    // Sort: active actors first, then by most recent signal (Sentinel
    // bumps last_seen on ASN hits), alphabetical as a stable tiebreaker.
    const orderBy = `ORDER BY
          CASE ta.status WHEN 'active' THEN 0 ELSE 1 END,
          COALESCE(ta.last_seen, ta.first_seen) DESC,
          ta.name`;

    // Run count + list + sparkline data in parallel — each with its own
    // catch so one broken query doesn't take down the whole response.
    const countPromise = session.prepare(
      `SELECT COUNT(*) AS total FROM threat_actors ta ${where}`
    ).bind(...params).first<{ total: number }>().catch((err) => {
      console.error('[threatActors] count query failed:', err);
      return null;
    });

    // Main query. If the join-count subqueries fail (tables missing), fall
    // back to a basic query with 0 counts.
    const rowsPromise = session.prepare(`
      SELECT ${selectCols},
        (SELECT COUNT(*) FROM threat_actor_infrastructure tai WHERE tai.threat_actor_id = ta.id) AS infra_count,
        (SELECT COUNT(*) FROM threat_actor_targets tat WHERE tat.threat_actor_id = ta.id) AS target_count
      FROM threat_actors ta
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all().catch(async (err) => {
      console.error('[threatActors] main query with joins failed, trying fallback:', err);
      try {
        return await session.prepare(`
          SELECT ${selectCols}, 0 AS infra_count, 0 AS target_count
          FROM threat_actors ta
          ${where}
          ${orderBy}
          LIMIT ? OFFSET ?
        `).bind(...params, limit, offset).all();
      } catch (err2) {
        console.error('[threatActors] fallback query also failed:', err2);
        return { results: [] as Record<string, unknown>[], meta: undefined as unknown, success: false } as unknown as D1Result;
      }
    });

    // Sparkline: 14-day daily threat counts per actor via ASN infrastructure join.
    // Cheap: bounded by 7 actors × 14 days = ~98 rows max.
    const sparklinePromise = session.prepare(`
      SELECT tai.threat_actor_id,
             date(t.created_at) AS day,
             COUNT(*) AS cnt
      FROM threats t
      JOIN threat_actor_infrastructure tai ON tai.asn = t.asn
      WHERE t.created_at >= datetime('now', '-14 days')
        AND t.asn IS NOT NULL
      GROUP BY tai.threat_actor_id, date(t.created_at)
    `).all<{ threat_actor_id: string; day: string; cnt: number }>().catch((err) => {
      console.error('[threatActors] sparkline query failed:', err);
      return { results: [] as { threat_actor_id: string; day: string; cnt: number }[] };
    });

    const [countResult, rows, sparklineRows] = await Promise.all([countPromise, rowsPromise, sparklinePromise]);
    // .first() doesn't expose meta on countResult; .all() rows have meta.
    if (rows && 'meta' in rows) addToTally(tally, rows.meta);
    if (sparklineRows && 'meta' in sparklineRows) addToTally(tally, sparklineRows.meta);
    tally.queries += 1; // count query

    // Pivot sparkline rows into per-actor 14-day arrays (oldest first)
    const sparkMap = new Map<string, number[]>();
    const today = new Date();
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const byActor = new Map<string, Map<string, number>>();
    for (const row of (sparklineRows.results ?? [])) {
      if (!byActor.has(row.threat_actor_id)) byActor.set(row.threat_actor_id, new Map());
      byActor.get(row.threat_actor_id)!.set(row.day, row.cnt);
    }
    for (const [actorId, dayMap] of byActor) {
      sparkMap.set(actorId, days.map(d => dayMap.get(d) ?? 0));
    }

    // Attach threat_history to each actor row
    const enriched = (rows.results as Record<string, unknown>[]).map(r => ({
      ...r,
      threat_history: sparkMap.get(r.id as string) ?? [],
    }));

    const data = {
      success: true,
      data: enriched,
      total: countResult?.total ?? 0,
    };
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
    recordD1Reads(env, "threat_actors_list", tally);
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
    if (cached) {
      recordD1Reads(env, "threat_actor_stats", newTally());
      return attachBookmark(json(JSON.parse(cached), 200, origin), session);
    }
    const tally = newTally();

    // Run all 6 queries in parallel
    const [total, active, byCountry, byAttribution, totalInfra, totalTargets] = await Promise.all([
      session.prepare("SELECT COUNT(*) AS n FROM threat_actors").first<{ n: number }>(),
      session.prepare("SELECT COUNT(*) AS n FROM threat_actors WHERE status = 'active'").first<{ n: number }>(),
      session.prepare(`
        SELECT country_code AS country, COUNT(*) AS count
        FROM threat_actors
        GROUP BY country_code
        ORDER BY count DESC
        LIMIT 10
      `).all(),
      session.prepare(`
        SELECT affiliation AS attribution, COUNT(*) AS count
        FROM threat_actors
        WHERE affiliation IS NOT NULL
        GROUP BY affiliation
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
    addToTally(tally, byCountry.meta);
    addToTally(tally, byAttribution.meta);
    tally.queries += 4; // total, active, totalInfra, totalTargets via .first()/safeQuery

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
    recordD1Reads(env, "threat_actor_stats", tally);
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
             affiliation AS attribution,
             country_code AS country,
             primary_ttps AS ttps,
             capability,
             description,
             first_seen,
             COALESCE(last_seen, first_seen) AS last_seen,
             status, attribution_confidence,
             created_at, updated_at,
             NULL AS target_sectors,
             NULL AS active_campaigns
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
               ta.primary_ttps AS ttps,
               ta.capability,
               ta.description,
               ta.first_seen,
               COALESCE(ta.last_seen, ta.first_seen) AS last_seen,
               ta.status,
               ta.created_at, ta.updated_at,
               NULL AS target_sectors,
               NULL AS active_campaigns,
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
