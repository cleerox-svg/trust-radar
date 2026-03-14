import { json } from "../lib/cors";
import { enrichThreatsGeo } from "../lib/geoip";
import type { Env } from "../types";

// ─── List threats with filtering ────────────────────────────────
export async function handleListThreats(request: Request, env: Env): Promise<Response> {
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

    if (severity) { conditions.push("severity = ?"); params.push(severity); }
    if (type) { conditions.push("threat_type = ?"); params.push(type); }
    if (status) { conditions.push("status = ?"); params.push(status); }
    if (source) { conditions.push("source_feed = ?"); params.push(source); }
    if (search) {
      conditions.push("(malicious_domain LIKE ? OR malicious_url LIKE ? OR ip_address LIKE ? OR ioc_value LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const rows = await env.DB.prepare(
      `SELECT id, threat_type, severity, confidence_score, status, source_feed,
              ioc_value, malicious_domain, malicious_url, ip_address, asn,
              country_code, target_brand_id, hosting_provider_id, campaign_id,
              first_seen, last_seen, created_at, lat, lng
       FROM threats ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params).all();

    const countParams = params.slice(0, -2);
    const total = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM threats ${where}`
    ).bind(...countParams).first<{ cnt: number }>();

    return json({ success: true, data: { threats: rows.results, total: total?.cnt ?? 0 } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
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
    return json({ success: false, error: String(err) }, 500, origin);
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
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Update threat status ───────────────────────────────────────
export async function handleUpdateThreat(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof body.status === "string") { updates.push("status = ?"); values.push(body.status); }
    if (typeof body.severity === "string") { updates.push("severity = ?"); values.push(body.severity); }
    if (typeof body.confidence_score === "number") { updates.push("confidence_score = ?"); values.push(body.confidence_score); }

    if (updates.length === 0) return json({ success: false, error: "No valid fields" }, 400, origin);

    updates.push("last_seen = datetime('now')");
    values.push(id);

    await env.DB.prepare(`UPDATE threats SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── List briefings (v1 compat stub) ────────────────────────────
export async function handleListBriefings(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(
      `SELECT id, title, summary, body, severity, category, status, generated_by, published_at, created_at
       FROM threat_briefings ORDER BY created_at DESC LIMIT 20`
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
    return json({ success: false, error: String(err) }, 500, origin);
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
    return json({ success: false, error: String(err) }, 500, origin);
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
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
