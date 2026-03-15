// Trust Radar v2 — Admin Handlers

import { z } from "zod";
import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import type { Env, UserRole, UserStatus } from "../types";
import { classifyThreat } from "../lib/haiku";
import { batchGeoLookup, normalizeProvider, upsertHostingProvider } from "../lib/geoip";

export async function handleAdminHealth(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  let dbStatus: "ok" | "error" = "ok";
  let dbResponseMs = 0;
  let sqliteVersion = "unknown";
  let journalMode = "wal";
  let tables: { name: string; rows: number }[] = [];

  try {
    const dbStart = Date.now();
    await env.DB.prepare("SELECT 1").first();
    dbResponseMs = Date.now() - dbStart;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  if (dbStatus === "ok") {
    try {
      const versionResult = await env.DB.prepare("SELECT sqlite_version() AS v").first<{ v: string }>();
      sqliteVersion = versionResult?.v ?? "unknown";
    } catch { /* D1 does not expose sqlite_version() */ }

    try {
      const journalResult = await env.DB.prepare("PRAGMA journal_mode").first<Record<string, string>>();
      journalMode = journalResult?.["journal_mode"] ?? "wal";
    } catch { /* D1 WAL is managed by Cloudflare */ }

    const tableNames = ["users", "sessions", "invitations", "threats", "brands", "campaigns", "feed_configs", "agent_runs", "briefings"];
    tables = await Promise.all(
      tableNames.map(async (name) => {
        try {
          const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${name}`).first<{ n: number }>();
          return { name, rows: r?.n ?? 0 };
        } catch {
          return { name, rows: -1 };
        }
      })
    );
  }

  const kvOk = !!env.CACHE;
  const overall: "healthy" | "degraded" = dbStatus === "ok" ? "healthy" : "degraded";

  return json({
    success: true,
    data: {
      status: overall,
      timestamp: new Date().toISOString(),
      environment: "production",
      database: {
        status: dbStatus,
        response_ms: dbResponseMs,
        sqlite_version: sqliteVersion,
        journal_mode: journalMode,
        encryption_at_rest: "Cloudflare D1 managed",
        encryption_in_transit: "TLS 1.3",
        last_migration: "latest",
        tables,
      },
      kv_cache: { status: kvOk ? "ok" : "error", binding: "CACHE" },
      compliance: {
        data_residency: "Cloudflare Global Network",
        audit_logging: "enabled",
        hitl_enforced: "enabled",
      },
    },
  }, 200, origin);
}

const UpdateUserSchema = z.object({
  role: z.enum(["super_admin", "admin", "analyst", "client"] as const).optional(),
  status: z.enum(["active", "suspended", "deactivated"] as const).optional(),
});

export async function handleAdminStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  const [users, threats, sessions] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN role = 'super_admin' THEN 1 ELSE 0 END) AS super_admins,
              SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins,
              SUM(CASE WHEN role = 'analyst' THEN 1 ELSE 0 END) AS analysts,
              SUM(CASE WHEN role = 'client' THEN 1 ELSE 0 END) AS clients,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
       FROM users`,
    ).first<{ total: number; super_admins: number; admins: number; analysts: number; clients: number; active: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_threats
       FROM threats`,
    ).first<{ total: number; active_threats: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS active_sessions FROM sessions WHERE expires_at > datetime('now') AND revoked_at IS NULL",
    ).first<{ active_sessions: number }>(),
  ]);

  return json({
    success: true,
    data: {
      users: {
        total: users?.total ?? 0,
        super_admins: users?.super_admins ?? 0,
        admins: users?.admins ?? 0,
        analysts: users?.analysts ?? 0,
        clients: users?.clients ?? 0,
        active: users?.active ?? 0,
      },
      threats: { total: threats?.total ?? 0, active: threats?.active_threats ?? 0 },
      sessions: { active: sessions?.active_sessions ?? 0 },
    },
  }, 200, origin);
}

export async function handleAdminListUsers(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const roleFilter = url.searchParams.get("role");
  const statusFilter = url.searchParams.get("status");

  let sql = "SELECT id, email, name, role, status, created_at, last_login, last_active, invited_by FROM users WHERE 1=1";
  const params: unknown[] = [];

  if (roleFilter) {
    sql += " AND role = ?";
    params.push(roleFilter);
  }
  if (statusFilter) {
    sql += " AND status = ?";
    params.push(statusFilter);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();

  return json({ success: true, data: { users: results, total: total?.n ?? 0 } }, 200, origin);
}

export async function handleAdminUpdateUser(
  request: Request,
  env: Env,
  targetUserId: string,
  adminUserId: string,
  adminRole: UserRole,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  const body = await request.json().catch(() => null);
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400, origin);

  const { role, status } = parsed.data;
  if (role === undefined && status === undefined) {
    return json({ success: false, error: "Nothing to update" }, 400, origin);
  }

  // Only super_admin can change roles to/from admin/super_admin
  if (role && (role === "super_admin" || role === "admin") && adminRole !== "super_admin") {
    return json({ success: false, error: "Only super admins can assign admin or super_admin roles" }, 403, origin);
  }

  // Prevent self-demotion for super_admins (safety)
  if (targetUserId === adminUserId && role && role !== adminRole) {
    return json({ success: false, error: "Cannot change your own role" }, 400, origin);
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  if (role !== undefined) {
    sets.push("role = ?");
    params.push(role);
  }
  if (status !== undefined) {
    sets.push("status = ?");
    params.push(status);
  }

  params.push(targetUserId);
  await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();

  const user = await env.DB.prepare(
    "SELECT id, email, name, role, status, created_at, last_login FROM users WHERE id = ?",
  ).bind(targetUserId).first();

  if (!user) return json({ success: false, error: "User not found" }, 404, origin);

  await audit(env, {
    action: "user_updated",
    userId: adminUserId,
    resourceType: "user",
    resourceId: targetUserId,
    details: { changes: parsed.data },
    request,
  });

  return json({ success: true, data: user }, 200, origin);
}

// ─── Backfill: Classify all unclassified threats ────────────────

export async function handleBackfillClassifications(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  try {
    const totalRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM threats WHERE confidence_score IS NULL"
    ).first<{ n: number }>();
    const total = totalRow?.n ?? 0;

    if (total === 0) {
      return json({ success: true, data: { message: "No unclassified threats", total: 0, classified: 0 } }, 200, origin);
    }

    let classified = 0;
    let failed = 0;
    let batchNum = 0;
    const BATCH_SIZE = 50;

    while (true) {
      batchNum++;
      const batch = await env.DB.prepare(
        `SELECT id, malicious_url, malicious_domain, ip_address, source_feed, ioc_value, threat_type
         FROM threats WHERE confidence_score IS NULL
         ORDER BY created_at DESC LIMIT ?`
      ).bind(BATCH_SIZE).all<{
        id: string; malicious_url: string | null; malicious_domain: string | null;
        ip_address: string | null; source_feed: string; ioc_value: string | null;
        threat_type: string;
      }>();

      if (batch.results.length === 0) break;

      console.log(`[backfill-classify] Batch ${batchNum}: ${batch.results.length} threats`);

      for (const threat of batch.results) {
        const result = await classifyThreat(env, {
          malicious_url: threat.malicious_url,
          malicious_domain: threat.malicious_domain,
          ip_address: threat.ip_address,
          source_feed: threat.source_feed,
          ioc_value: threat.ioc_value,
        });

        let confidence: number;
        let severity: string;

        if (result.success && result.data) {
          confidence = result.data.confidence;
          severity = result.data.severity;
        } else {
          // Rule-based fallback
          const highConf = ["phishtank", "threatfox", "feodo"];
          const medConf = ["urlhaus", "openphish"];
          confidence = highConf.includes(threat.source_feed) ? 90 : medConf.includes(threat.source_feed) ? 80 : 60;
          severity = threat.threat_type === "c2" || threat.source_feed === "feodo" ? "critical"
            : threat.threat_type === "malware_distribution" ? "high" : "medium";
          failed++;
        }

        try {
          await env.DB.prepare(
            "UPDATE threats SET confidence_score = ?, severity = COALESCE(severity, ?) WHERE id = ?"
          ).bind(confidence, severity, threat.id).run();
          classified++;
        } catch (err) {
          console.error(`[backfill-classify] update failed for ${threat.id}:`, err);
        }
      }

      // 1-second delay between batches to avoid API rate limits
      if (batch.results.length === BATCH_SIZE) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    console.log(`[backfill-classify] Done: ${classified} classified, ${failed} haiku failures (rule-based fallback used)`);

    return json({
      success: true,
      data: { total, classified, haikuFailures: failed, batches: batchNum },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── Backfill: Geo-enrich all threats with IP but no lat/lng ────

export async function handleBackfillGeo(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  try {
    const totalRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM threats WHERE ip_address IS NOT NULL AND (lat IS NULL OR country_code IS NULL OR hosting_provider_id IS NULL)"
    ).first<{ n: number }>();
    const total = totalRow?.n ?? 0;

    if (total === 0) {
      return json({ success: true, data: { message: "No threats need geo enrichment", total: 0, enriched: 0 } }, 200, origin);
    }

    let enriched = 0;
    let providersUpserted = 0;
    let batchNum = 0;
    const BATCH_SIZE = 50;

    while (true) {
      batchNum++;
      const batch = await env.DB.prepare(
        `SELECT id, ip_address FROM threats
         WHERE ip_address IS NOT NULL AND (lat IS NULL OR country_code IS NULL OR hosting_provider_id IS NULL)
         LIMIT ?`
      ).bind(BATCH_SIZE).all<{ id: string; ip_address: string }>();

      if (batch.results.length === 0) break;

      console.log(`[backfill-geo] Batch ${batchNum}: ${batch.results.length} threats`);

      const ips = batch.results.map((r) => r.ip_address);
      const geoMap = await batchGeoLookup(ips);

      for (const row of batch.results) {
        const geo = geoMap.get(row.ip_address);
        if (!geo) continue;

        try {
          const providerName = normalizeProvider(geo.isp, geo.org);
          let providerId: string | null = null;
          if (providerName) {
            providerId = await upsertHostingProvider(env.DB, providerName, geo.as, geo.countryCode);
            providersUpserted++;
          }

          await env.DB.prepare(
            `UPDATE threats SET
               country_code = COALESCE(country_code, ?),
               asn = COALESCE(asn, ?),
               lat = COALESCE(lat, ?),
               lng = COALESCE(lng, ?),
               hosting_provider_id = COALESCE(hosting_provider_id, ?)
             WHERE id = ?`
          ).bind(geo.countryCode, geo.as, geo.lat, geo.lng, providerId, row.id).run();
          enriched++;
        } catch (err) {
          console.error(`[backfill-geo] update failed for ${row.id}:`, err);
        }
      }

      // 1-second delay between batches for rate limiting
      if (batch.results.length === BATCH_SIZE) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Sync provider counts after backfill
    try {
      await env.DB.prepare(`
        UPDATE hosting_providers SET
          active_threat_count = (SELECT COUNT(*) FROM threats WHERE threats.hosting_provider_id = hosting_providers.id AND threats.status = 'active'),
          total_threat_count = (SELECT COUNT(*) FROM threats WHERE threats.hosting_provider_id = hosting_providers.id)
      `).run();
    } catch { /* non-critical */ }

    console.log(`[backfill-geo] Done: ${enriched} enriched, ${providersUpserted} providers upserted`);

    return json({
      success: true,
      data: { total, enriched, providersUpserted, batches: batchNum },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
