import { json } from "../lib/cors";
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
    if (type) { conditions.push("type = ?"); params.push(type); }
    if (status) { conditions.push("status = ?"); params.push(status); }
    if (source) { conditions.push("source = ?"); params.push(source); }
    if (search) { conditions.push("(title LIKE ? OR domain LIKE ? OR ip_address LIKE ? OR ioc_value LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const rows = await env.DB.prepare(
      `SELECT id, type, title, severity, confidence, status, source, ioc_type, ioc_value,
              domain, ip_address, country_code, tags, first_seen, last_seen, created_at
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
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as unprocessed,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        COUNT(DISTINCT source) as sources,
        COUNT(DISTINCT type) as types
      FROM threats
    `).first();

    const last24h = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high
      FROM threats WHERE created_at >= datetime('now', '-24 hours')
    `).first();

    const byType = await env.DB.prepare(
      "SELECT type, COUNT(*) as count FROM threats GROUP BY type ORDER BY count DESC LIMIT 10"
    ).all();

    const bySource = await env.DB.prepare(
      "SELECT source, COUNT(*) as count FROM threats GROUP BY source ORDER BY count DESC LIMIT 10"
    ).all();

    const bySeverity = await env.DB.prepare(
      "SELECT severity, COUNT(*) as count FROM threats GROUP BY severity"
    ).all();

    const byCountry = await env.DB.prepare(
      "SELECT country_code, COUNT(*) as count FROM threats WHERE country_code IS NOT NULL GROUP BY country_code ORDER BY count DESC LIMIT 30"
    ).all();

    return json({
      success: true,
      data: { summary, last24h, byType: byType.results, bySource: bySource.results, bySeverity: bySeverity.results, byCountry: byCountry.results },
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
    if (typeof body.confidence === "number") { updates.push("confidence = ?"); values.push(body.confidence); }

    if (updates.length === 0) return json({ success: false, error: "No valid fields" }, 400, origin);

    updates.push("updated_at = datetime('now')");
    if (body.status === "resolved") updates.push("resolved_at = datetime('now')");
    values.push(id);

    await env.DB.prepare(`UPDATE threats SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── List briefings ─────────────────────────────────────────────
export async function handleListBriefings(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(
      `SELECT id, title, summary, severity, category, status, generated_by, published_at, created_at
       FROM threat_briefings ORDER BY created_at DESC LIMIT 20`
    ).all();
    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Get briefing detail ────────────────────────────────────────
export async function handleGetBriefing(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const briefing = await env.DB.prepare("SELECT * FROM threat_briefings WHERE id = ?").bind(id).first();
    if (!briefing) return json({ success: false, error: "Briefing not found" }, 404, origin);
    return json({ success: true, data: briefing }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Social IOCs ────────────────────────────────────────────────
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

    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified,
        AVG(confidence) as avg_confidence,
        COUNT(DISTINCT platform) as platforms
      FROM social_iocs
    `).first();

    return json({ success: true, data: { iocs: rows.results, stats } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
