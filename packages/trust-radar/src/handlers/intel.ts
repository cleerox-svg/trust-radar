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

// ─── Intel Hotlist (PR-A from 2026-05-16 audit) ────────────────
//
// GET /api/intel/hotlist
//
// Surfaces three classes of high-signal intel that already exist
// in `threats` but were never shown in the UI:
//
//  1. top_fanout_ips      — IPs hosting threats against many
//                           distinct brands. Mass-impersonation
//                           infrastructure that wasn't getting
//                           consolidated as a campaign.
//                           (audit example: 76.223.54.146 → 597 brands)
//  2. multi_feed_consensus — IPs flagged by ≥4 independent feeds.
//                           Currently confidence_score is flat
//                           regardless of corroboration count.
//                           These are the highest-confidence IOCs
//                           in the corpus and we don't surface them.
//  3. recent_bursts        — Domain swarms targeting one brand in
//                           a tight time window. Detection rule
//                           from the audit:
//                             COUNT(*) ≥ 25 same brand in 1 hour
//                           (audit example: 786 domains targeting
//                           one brand in 14 min, zero campaign formed)
//
// KV-cached 5min — operators want freshness but we don't need
// per-second resolution; the underlying GROUP BYs are bounded
// scans against indexes on (ip_address, target_brand_id,
// source_feed, first_seen).
export async function handleIntelHotlist(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));

    const cacheKey = `intel:hotlist:v1:${limit}`;
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return json(JSON.parse(cached), 200, origin);

    const [fanoutRes, consensusRes, burstsRes] = await Promise.all([
      // 1. IPs hosting threats against the most distinct brands.
      // Active-only — taken-down/resolved threats don't count.
      // Exclude empty/placeholder IPs (Sentinel writes '0.0.0.0' on
      // DNS failures; audit-flagged for cleanup).
      env.DB.prepare(`
        SELECT ip_address,
               COUNT(DISTINCT target_brand_id) AS brand_count,
               COUNT(*)                         AS threat_count,
               MAX(first_seen)                  AS last_seen
          FROM threats
         WHERE status = 'active'
           AND ip_address IS NOT NULL
           AND ip_address NOT IN ('', '0.0.0.0')
           AND target_brand_id IS NOT NULL
         GROUP BY ip_address
        HAVING brand_count >= 5
         ORDER BY brand_count DESC, threat_count DESC
         LIMIT ?
      `).bind(limit).all<{
        ip_address: string;
        brand_count: number;
        threat_count: number;
        last_seen: string;
      }>(),
      // 2. Multi-feed-corroborated IPs. ≥4 distinct source_feed
      // means the IP is flagged by independent intelligence
      // sources — far higher confidence than a single feed.
      env.DB.prepare(`
        SELECT ip_address,
               COUNT(DISTINCT source_feed) AS feed_count,
               COUNT(*)                     AS threat_count,
               GROUP_CONCAT(DISTINCT source_feed) AS feeds,
               MAX(first_seen)              AS last_seen
          FROM threats
         WHERE status = 'active'
           AND ip_address IS NOT NULL
           AND ip_address NOT IN ('', '0.0.0.0')
         GROUP BY ip_address
        HAVING feed_count >= 4
         ORDER BY feed_count DESC, threat_count DESC
         LIMIT ?
      `).bind(limit).all<{
        ip_address: string;
        feed_count: number;
        threat_count: number;
        feeds: string;
        last_seen: string;
      }>(),
      // 3. Recent temporal bursts — same brand, ≥25 threats in 1h.
      // Window is the last 24h to keep operator-relevant; cube
      // would be more efficient but cubes aggregate to the hour
      // boundary, masking sub-hour swarms. Direct first_seen
      // grouping gives true burst detection.
      env.DB.prepare(`
        SELECT target_brand_id                              AS brand_id,
               strftime('%Y-%m-%d %H:00', first_seen)       AS hour_bucket,
               COUNT(*)                                      AS threat_count,
               COUNT(DISTINCT malicious_domain)              AS distinct_domains,
               MIN(first_seen)                               AS burst_start,
               MAX(first_seen)                               AS burst_end
          FROM threats
         WHERE status = 'active'
           AND first_seen >= datetime('now', '-24 hours')
           AND target_brand_id IS NOT NULL
         GROUP BY brand_id, hour_bucket
        HAVING threat_count >= 25
         ORDER BY threat_count DESC
         LIMIT ?
      `).bind(limit).all<{
        brand_id: string;
        hour_bucket: string;
        threat_count: number;
        distinct_domains: number;
        burst_start: string;
        burst_end: string;
      }>(),
    ]);

    // Resolve brand_id → name for the bursts payload so the UI
    // doesn't need an extra round-trip. Batched into one IN().
    const burstBrandIds = Array.from(new Set((burstsRes.results ?? []).map(b => b.brand_id))).filter(Boolean);
    let brandNameById = new Map<string, string>();
    if (burstBrandIds.length > 0) {
      const placeholders = burstBrandIds.map(() => '?').join(',');
      const brandRows = await env.DB.prepare(
        `SELECT id, name FROM brands WHERE id IN (${placeholders})`,
      ).bind(...burstBrandIds).all<{ id: string; name: string }>();
      brandNameById = new Map(brandRows.results.map(r => [r.id, r.name]));
    }
    const bursts = (burstsRes.results ?? []).map(b => ({
      brand_id:         b.brand_id,
      brand_name:       brandNameById.get(b.brand_id) ?? b.brand_id,
      hour_bucket:      b.hour_bucket,
      threat_count:     b.threat_count,
      distinct_domains: b.distinct_domains,
      burst_start:      b.burst_start,
      burst_end:        b.burst_end,
    }));

    const body = {
      success: true,
      data: {
        top_fanout_ips:        fanoutRes.results ?? [],
        multi_feed_consensus:  consensusRes.results ?? [],
        recent_bursts:         bursts,
        generated_at:          new Date().toISOString(),
      },
    };
    await env.CACHE.put(cacheKey, JSON.stringify(body), { expirationTtl: 300 });
    return json(body, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

