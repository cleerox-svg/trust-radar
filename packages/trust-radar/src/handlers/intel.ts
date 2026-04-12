// TODO: Refactor to use handler-utils (Phase 6 continuation)
import { json } from "../lib/cors";
import { getDbContext, getReadSession, attachBookmark } from "../lib/db";
import type { Env, UpdateATOEventBody } from "../types";

// ─── Breach Checks ──────────────────────────────────────────────

export async function handleListBreaches(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const ctx = getDbContext(request);
  const session = getReadSession(env, ctx);
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const search = url.searchParams.get("q");

    // KV cache — 5 min TTL
    const cacheKey = `breaches:${limit}:${search ?? ""}`;
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return attachBookmark(json(JSON.parse(cached), 200, origin), session);

    let query = `SELECT id, check_type, target, breach_name, breach_date, data_types, source, severity, resolved, checked_at, created_at
                 FROM breach_checks`;
    const params: unknown[] = [];
    if (search) { query += " WHERE target LIKE ? OR breach_name LIKE ?"; params.push(`%${search}%`, `%${search}%`); }
    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const [rows, stats] = await Promise.all([
      session.prepare(query).bind(...params).all(),
      session.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(DISTINCT target) as unique_targets,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
          SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
          SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as unresolved
        FROM breach_checks
      `).first(),
    ]);

    const data = { success: true, data: { breaches: rows.results, stats } };
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
    return attachBookmark(json(data, 200, origin), session);
  } catch (err) {
    return attachBookmark(json({ success: false, error: "An internal error occurred" }, 500, origin), session);
  }
}

// ─── Account Takeover Events ────────────────────────────────────

export async function handleListATOEvents(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const ctx = getDbContext(request);
  const session = getReadSession(env, ctx);
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const status = url.searchParams.get("status");

    // KV cache — 5 min TTL
    const cacheKey = `ato_events:${limit}:${status ?? ""}`;
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return attachBookmark(json(JSON.parse(cached), 200, origin), session);

    let query = `SELECT id, email, event_type, ip_address, country_code, user_agent, risk_score, status, source, detected_at, created_at
                 FROM ato_events`;
    const params: unknown[] = [];
    if (status) { query += " WHERE status = ?"; params.push(status); }
    query += " ORDER BY detected_at DESC LIMIT ?";
    params.push(limit);

    const [rows, stats] = await Promise.all([
      session.prepare(query).bind(...params).all(),
      session.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
          SUM(CASE WHEN status = 'investigating' THEN 1 ELSE 0 END) as investigating,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
          SUM(CASE WHEN risk_score >= 80 THEN 1 ELSE 0 END) as high_risk,
          AVG(risk_score) as avg_risk_score
        FROM ato_events
      `).first(),
    ]);

    const data = { success: true, data: { events: rows.results, stats } };
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
    return attachBookmark(json(data, 200, origin), session);
  } catch (err) {
    return attachBookmark(json({ success: false, error: "An internal error occurred" }, 500, origin), session);
  }
}

export async function handleUpdateATOEvent(request: Request, env: Env, id: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as UpdateATOEventBody;
    if (!body.status) return json({ success: false, error: "Status required" }, 400, origin);

    const updates = ["status = ?"];
    const values: unknown[] = [body.status];
    if (body.status === "resolved") updates.push("resolved_at = datetime('now')");
    values.push(id);

    await env.DB.prepare(`UPDATE ato_events SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// ─── Email Authentication Reports ───────────────────────────────

export async function handleListEmailAuth(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const ctx = getDbContext(request);
  const session = getReadSession(env, ctx);
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const domain = url.searchParams.get("domain");

    // KV cache — 5 min TTL
    const cacheKey = `email_auth:${limit}:${domain ?? ""}`;
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return attachBookmark(json(JSON.parse(cached), 200, origin), session);

    let query = `SELECT id, domain, report_type, result, source_ip, source_domain, alignment, details, report_date, created_at
                 FROM email_auth_reports`;
    const params: unknown[] = [];
    if (domain) { query += " WHERE domain = ?"; params.push(domain); }
    query += " ORDER BY report_date DESC LIMIT ?";
    params.push(limit);

    const [rows, stats, byType] = await Promise.all([
      session.prepare(query).bind(...params).all(),
      session.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as pass_count,
          SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as fail_count,
          SUM(CASE WHEN result = 'softfail' THEN 1 ELSE 0 END) as softfail_count,
          COUNT(DISTINCT domain) as domains
        FROM email_auth_reports
      `).first(),
      session.prepare(
        "SELECT report_type, result, COUNT(*) as count FROM email_auth_reports GROUP BY report_type, result ORDER BY count DESC"
      ).all(),
    ]);

    const data = { success: true, data: { reports: rows.results, stats, byType: byType.results } };
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
    return attachBookmark(json(data, 200, origin), session);
  } catch (err) {
    return attachBookmark(json({ success: false, error: "An internal error occurred" }, 500, origin), session);
  }
}

// ─── Cloud Incidents ────────────────────────────────────────────

export async function handleListCloudIncidents(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const ctx = getDbContext(request);
  const session = getReadSession(env, ctx);
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const provider = url.searchParams.get("provider");
    const activeOnly = url.searchParams.get("active") === "true";

    // KV cache — 5 min TTL
    const cacheKey = `cloud_incidents:${limit}:${provider ?? ""}:${activeOnly}`;
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return attachBookmark(json(JSON.parse(cached), 200, origin), session);

    let query = `SELECT id, provider, service, title, description, severity, status, impact, source_url, started_at, resolved_at, created_at
                 FROM cloud_incidents`;
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (provider) { conditions.push("provider = ?"); params.push(provider); }
    if (activeOnly) { conditions.push("status != 'resolved'"); }
    if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
    query += " ORDER BY started_at DESC LIMIT ?";
    params.push(limit);

    const [rows, stats, byProvider] = await Promise.all([
      session.prepare(query).bind(...params).all(),
      session.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status != 'resolved' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
          COUNT(DISTINCT provider) as providers
        FROM cloud_incidents
      `).first(),
      session.prepare(
        "SELECT provider, COUNT(*) as count, SUM(CASE WHEN status != 'resolved' THEN 1 ELSE 0 END) as active FROM cloud_incidents GROUP BY provider ORDER BY count DESC"
      ).all(),
    ]);

    const data = { success: true, data: { incidents: rows.results, stats, byProvider: byProvider.results } };
    await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 });
    return attachBookmark(json(data, 200, origin), session);
  } catch (err) {
    return attachBookmark(json({ success: false, error: "An internal error occurred" }, 500, origin), session);
  }
}

// ─── Trust Score History ────────────────────────────────────────

export async function handleTrustScoreHistory(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain");
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "30", 10));

    let query = "SELECT id, domain, score, previous_score, delta, risk_level, measured_at, created_at FROM trust_score_history";
    const params: unknown[] = [];
    if (domain) { query += " WHERE domain = ?"; params.push(domain); }
    query += " ORDER BY measured_at DESC LIMIT ?";
    params.push(limit);

    const rows = await env.DB.prepare(query).bind(...params).all();
    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}
