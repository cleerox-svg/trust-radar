// Trust Radar v2 — Admin Handlers

import { z } from "zod";
import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import type { Env, UserRole, UserStatus } from "../types";
import { classifyThreat } from "../lib/haiku";
import { batchGeoLookup, normalizeProvider, upsertHostingProvider, enrichThreatsGeo, PRIVATE_IP_SQL_FILTER } from "../lib/geoip";
import { fuzzyMatchBrand } from "../lib/brandDetect";

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

  const [users, threats, sessions, sentinelBacklog, analystBacklog, cartoBacklog, strategistBacklog, observerLastRun, aiAttrPending, trancoCount] = await Promise.all([
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
    // Agent backlogs
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM threats WHERE status = 'active' AND created_at > datetime('now', '-1 hour')",
    ).first<{ n: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM threats WHERE status = 'active' AND severity IS NULL",
    ).first<{ n: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM threats WHERE status = 'active' AND ip_address IS NOT NULL AND lat IS NULL",
    ).first<{ n: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM threats WHERE status = 'active' AND campaign_id IS NULL AND threat_type IN ('phishing','typosquatting')",
    ).first<{ n: number }>(),
    env.DB.prepare(
      "SELECT MAX(created_at) AS last_run FROM agent_outputs WHERE agent_id = 'observer' AND type != 'diagnostic'",
    ).first<{ last_run: string | null }>().catch(() => null),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM threats WHERE target_brand_id IS NULL AND threat_type IN ('phishing','credential_harvesting','typosquatting','impersonation')",
    ).first<{ n: number }>().catch(() => null),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM brands",
    ).first<{ n: number }>().catch(() => null),
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
      agent_backlogs: {
        sentinel: sentinelBacklog?.n ?? 0,
        analyst: analystBacklog?.n ?? 0,
        cartographer: cartoBacklog?.n ?? 0,
        strategist: strategistBacklog?.n ?? 0,
        observer_last_run: observerLastRun?.last_run ?? null,
      },
      ai_attribution_pending: aiAttrPending?.n ?? 0,
      tranco_brand_count: trancoCount?.n ?? 0,
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
    // Count total pending before starting
    const totalRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM threats WHERE ip_address IS NOT NULL AND country_code IS NULL ${PRIVATE_IP_SQL_FILTER}`
    ).first<{ n: number }>();
    const totalPending = totalRow?.n ?? 0;

    if (totalPending === 0) {
      return json({ success: true, data: { message: "No threats need geo enrichment", total: 0, enriched: 0, remaining: 0 } }, 200, origin);
    }

    console.log(`[backfill-geo] Starting: ${totalPending} threats pending geo enrichment`);

    // Call the SAME enrichThreatsGeo function the Cartographer uses.
    // Each call processes up to 10 threats (5 actual IP lookups due to ipinfo cap).
    // Loop multiple rounds to make meaningful progress per click.
    let totalEnriched = 0;
    let totalSkippedPrivate = 0;
    let totalSkippedNoResult = 0;
    const allErrors: string[] = [];
    const sampleIps: string[] = [];
    const MAX_ROUNDS = 20;  // 20 rounds × 5 IPs = up to 100 IPs per click

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      console.log(`[backfill-geo] Round ${round}/${MAX_ROUNDS}...`);
      const result = await enrichThreatsGeo(env.DB, env.CACHE, env.IPINFO_TOKEN);

      totalEnriched += result.enriched;
      totalSkippedPrivate += result.skippedPrivate;
      totalSkippedNoResult += result.skippedNoResult;
      allErrors.push(...result.errors);

      console.log(`[backfill-geo] Round ${round}: enriched=${result.enriched}, private=${result.skippedPrivate}, noResult=${result.skippedNoResult}, total_selected=${result.total}`);

      // Collect sample IPs from first round for debugging
      if (round === 1 && result.total === 0) {
        console.log(`[backfill-geo] No threats selected in first round — nothing to do`);
        break;
      }

      if (result.total === 0) break; // No more threats to process

      // Rate-limit pause between rounds
      if (round < MAX_ROUNDS) {
        await new Promise((r) => setTimeout(r, 500));
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

    const remaining = Math.max(0, totalPending - totalEnriched - totalSkippedPrivate - totalSkippedNoResult);
    console.log(`[backfill-geo] Done: enriched=${totalEnriched}, skippedPrivate=${totalSkippedPrivate}, skippedNoResult=${totalSkippedNoResult}, remaining=${remaining}, errors=${allErrors.length}`);

    return json({
      success: true,
      data: {
        total: totalPending,
        enriched: totalEnriched,
        remaining,
        skippedPrivate: totalSkippedPrivate,
        skippedNoResult: totalSkippedNoResult,
        errors: allErrors.length > 0 ? allErrors.slice(0, 20) : undefined,
      },
    }, 200, origin);
  } catch (err) {
    console.error(`[backfill-geo] Fatal error:`, err);
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// Core brand-match backfill logic — returns { matched, checked, pending }
export async function runBrandMatchBackfill(env: Env): Promise<{ matched: number; checked: number; pending: number }> {
  const brandRows = await env.DB.prepare(
    "SELECT id, name, canonical_domain FROM brands",
  ).all<{ id: string; name: string; canonical_domain: string }>();

  const brands = brandRows.results;
  if (brands.length === 0) return { matched: 0, checked: 0, pending: 0 };

  const pendingRow = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM threats WHERE target_brand_id IS NULL AND (malicious_domain IS NOT NULL OR malicious_url IS NOT NULL OR ioc_value IS NOT NULL)",
  ).first<{ n: number }>();
  const totalPending = pendingRow?.n ?? 0;

  if (totalPending === 0) return { matched: 0, checked: 0, pending: 0 };

  const rows = await env.DB.prepare(
    `SELECT id, malicious_domain, malicious_url, ioc_value FROM threats
     WHERE target_brand_id IS NULL AND (malicious_domain IS NOT NULL OR malicious_url IS NOT NULL OR ioc_value IS NOT NULL)
     ORDER BY created_at DESC
     LIMIT 500`,
  ).all<{ id: string; malicious_domain: string | null; malicious_url: string | null; ioc_value: string | null }>();

  let matched = 0;

  for (const row of rows.results) {
    const haystacks = [row.malicious_domain, row.malicious_url, row.ioc_value].filter(
      (v): v is string => v != null && v.length > 0,
    );
    if (haystacks.length === 0) continue;

    const brandId = fuzzyMatchBrand(haystacks, brands);
    if (!brandId) continue;

    try {
      await env.DB.prepare(
        "UPDATE threats SET target_brand_id = ? WHERE id = ? AND target_brand_id IS NULL",
      ).bind(brandId, row.id).run();

      await env.DB.prepare(
        `UPDATE brands SET
           threat_count = threat_count + 1,
           last_threat_seen = datetime('now')
         WHERE id = ?`,
      ).bind(brandId).run();

      matched++;
    } catch (err) {
      console.error(`[backfill-brand-match] update failed for ${row.id}:`, err);
    }
  }

  const pending = Math.max(0, totalPending - rows.results.length);
  console.log(`[backfill-brand-match] Done: ${matched} matched out of ${rows.results.length} checked, ${pending} remaining`);
  return { matched, checked: rows.results.length, pending };
}

// POST /api/admin/backfill-brand-match
export async function handleBackfillBrandMatch(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  try {
    const body = await request.json().catch(() => null) as { rounds?: number } | null;
    const rounds = Math.min(Math.max(body?.rounds ?? 1, 1), 20);

    let totalMatched = 0;
    let totalChecked = 0;
    let lastPending = 0;

    for (let i = 0; i < rounds; i++) {
      const result = await runBrandMatchBackfill(env);
      totalMatched += result.matched;
      totalChecked += result.checked;
      lastPending = result.pending;
      console.log(`[backfill-brand-match] Round ${i + 1}/${rounds}: matched=${result.matched}, checked=${result.checked}, pending=${result.pending}`);
      if (result.pending === 0 || result.checked === 0) break;
    }

    return json({
      success: true,
      data: { matched: totalMatched, checked: totalChecked, pending: lastPending, rounds },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── AI Attribution (Haiku-powered batch brand attribution) ────

const GENERIC_HOSTING_DOMAINS = [
  'gitbook.io', 'github.io', 'pages.dev', 'netlify.app',
  'vercel.app', 'glitch.me', 'weebly.com', 'wordpress.com',
  'blogspot.com', 'herokuapp.com', 'firebaseapp.com', 'web.app',
];

function extractSignal(domain: string | null, url: string | null): string | null {
  if (!domain && !url) return null;
  const d = domain || '';
  // Check if it's on a generic hosting domain
  for (const generic of GENERIC_HOSTING_DOMAINS) {
    if (d.endsWith('.' + generic) || d === generic) {
      const subdomain = d.replace('.' + generic, '');
      if (subdomain.length >= 5 && /[a-z]/.test(subdomain)) return subdomain;
      return null; // Too short or purely numeric
    }
  }
  if (!d || d.length < 4) return null;
  return d;
}

export async function runAiAttribution(env: Env, maxBatch = 50): Promise<{
  attributed: number; skipped: number; calls: number; costUsd: number; cached: number;
}> {
  const result = { attributed: 0, skipped: 0, calls: 0, costUsd: 0, cached: 0 };

  // Fetch unattributed threats with domain signals
  const rows = await env.DB.prepare(
    `SELECT id, malicious_domain, malicious_url, ioc_value FROM threats
     WHERE target_brand_id IS NULL
       AND (malicious_domain IS NOT NULL OR malicious_url IS NOT NULL)
       AND threat_type IN ('phishing', 'credential_harvesting', 'typosquatting', 'impersonation')
     ORDER BY created_at DESC LIMIT ?`
  ).bind(maxBatch * 3).all<{
    id: string; malicious_domain: string | null; malicious_url: string | null; ioc_value: string | null;
  }>();

  if (rows.results.length === 0) return result;

  // Group by signal for deduplication
  const signalMap = new Map<string, { ids: string[]; url: string | null }>();
  for (const row of rows.results) {
    const signal = extractSignal(row.malicious_domain, row.malicious_url);
    if (!signal) { result.skipped++; continue; }

    const existing = signalMap.get(signal);
    if (existing) {
      existing.ids.push(row.id);
    } else {
      signalMap.set(signal, { ids: [row.id], url: row.malicious_url });
    }
  }

  // Check KV cache for already-attributed signals
  const uncachedSignals: Array<{ signal: string; ids: string[]; url: string | null }> = [];
  for (const [signal, data] of signalMap) {
    const cached = await env.CACHE.get('brand_attr_' + signal);
    if (cached) {
      result.cached++;
      // Apply cached result
      try {
        const parsed = JSON.parse(cached) as { brand_id: string | null };
        if (parsed.brand_id) {
          for (const id of data.ids) {
            await env.DB.prepare(
              "UPDATE threats SET target_brand_id = ? WHERE id = ? AND target_brand_id IS NULL"
            ).bind(parsed.brand_id, id).run();
          }
          await env.DB.prepare(
            "UPDATE brands SET threat_count = threat_count + ?, last_threat_seen = datetime('now') WHERE id = ?"
          ).bind(data.ids.length, parsed.brand_id).run();
          result.attributed += data.ids.length;
        }
      } catch { /* cache parse error, skip */ }
      continue;
    }
    uncachedSignals.push({ signal, ids: data.ids, url: data.url });
    if (uncachedSignals.length >= maxBatch) break;
  }

  if (uncachedSignals.length === 0) return result;

  // Batch Haiku call
  const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
  if (!apiKey || apiKey.startsWith('lrx_')) return result;

  const signals = uncachedSignals.map((s, i) => ({
    id: i, signal: s.signal, full_url: s.url || s.signal,
  }));

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: "You are a brand attribution engine for a cybersecurity platform. Given phishing domain signals, identify the real brand being impersonated. Be conservative — only attribute when genuinely confident. Reply ONLY with valid JSON, no markdown.",
        messages: [{ role: 'user', content: `Attribute these phishing signals to real brands:\n${JSON.stringify(signals)}\nReply with JSON array, only include confident matches:\n[{id, brand, confidence: "high"|"medium", reason}]\nOmit entries where brand is null or confidence is low.` }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    result.calls++;
    const apiRes = await res.json() as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    // Estimate cost
    const inputTokens = apiRes.usage?.input_tokens ?? 800;
    const outputTokens = apiRes.usage?.output_tokens ?? 300;
    result.costUsd = (inputTokens * 0.0000008 + outputTokens * 0.000004);

    // Track usage in KV
    const { getDailyUsage } = await import("../lib/haiku");
    const today = new Date().toISOString().slice(0, 10);
    const usage = await getDailyUsage(env, today);
    usage.calls += 1;
    usage.input_tokens += inputTokens;
    usage.output_tokens += outputTokens;
    usage.agent_calls += 1;
    await env.CACHE.put(`haiku_usage_${today}`, JSON.stringify(usage), { expirationTtl: 86400 * 31 });

    const textBlock = apiRes.content?.find(b => b.type === 'text');
    if (!textBlock) return result;

    // Parse JSON array from response
    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return result;

    const attributions = JSON.parse(jsonMatch[0]) as Array<{
      id: number; brand: string; confidence: 'high' | 'medium'; reason: string;
    }>;

    // Load all brands for matching
    const allBrands = await env.DB.prepare(
      "SELECT id, name FROM brands"
    ).all<{ id: string; name: string }>();
    const brandByName = new Map(allBrands.results.map(b => [b.name.toLowerCase(), b.id]));

    for (const attr of attributions) {
      if (!attr.brand || (attr.confidence !== 'high' && attr.confidence !== 'medium')) continue;
      const signalEntry = uncachedSignals[attr.id];
      if (!signalEntry) continue;

      // Look up brand
      let brandId = brandByName.get(attr.brand.toLowerCase());

      // If not found and high confidence, create brand
      if (!brandId && attr.confidence === 'high') {
        const newId = `brand_${attr.brand.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        try {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO brands (id, name, canonical_domain, source, threat_count, first_seen)
             VALUES (?, ?, ?, 'ai_attributed', 0, datetime('now'))`
          ).bind(newId, attr.brand, signalEntry.signal).run();
          brandId = newId;
          brandByName.set(attr.brand.toLowerCase(), newId);
        } catch { continue; }
      }

      if (!brandId) continue;

      // Cache the result
      await env.CACHE.put('brand_attr_' + signalEntry.signal, JSON.stringify({ brand_id: brandId }), { expirationTtl: 86400 * 30 });

      // Apply to all threats with this signal
      for (const threatId of signalEntry.ids) {
        await env.DB.prepare(
          "UPDATE threats SET target_brand_id = ? WHERE id = ? AND target_brand_id IS NULL"
        ).bind(brandId, threatId).run();
      }
      await env.DB.prepare(
        "UPDATE brands SET threat_count = threat_count + ?, last_threat_seen = datetime('now') WHERE id = ?"
      ).bind(signalEntry.ids.length, brandId).run();
      result.attributed += signalEntry.ids.length;
    }

    // Cache null result for unmatched signals
    for (const entry of uncachedSignals) {
      const wasMatched = attributions.some(a => uncachedSignals[a.id]?.signal === entry.signal);
      if (!wasMatched) {
        await env.CACHE.put('brand_attr_' + entry.signal, JSON.stringify({ brand_id: null }), { expirationTtl: 86400 * 30 });
      }
    }
  } catch (err) {
    console.error('[ai-attribution] Haiku call failed:', err);
  }

  // Log to agent_outputs
  try {
    await env.DB.prepare(
      `INSERT INTO agent_outputs (id, agent_id, type, summary, severity, created_at)
       VALUES (?, 'analyst', 'attribution', ?, 'info', datetime('now'))`
    ).bind(
      crypto.randomUUID(),
      `AI Attribution: ${result.attributed} attributed, ${result.skipped} skipped, ${result.calls} calls, ~$${result.costUsd.toFixed(4)} USD`,
    ).run();
  } catch { /* ok */ }

  return result;
}

// POST /api/admin/backfill-ai-attribution
export async function handleBackfillAiAttribution(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const result = await runAiAttribution(env, 50);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// POST /api/admin/backfill-safe-domains
export async function handleBackfillSafeDomains(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const brands = await env.DB.prepare(
      "SELECT id, canonical_domain FROM brands WHERE canonical_domain IS NOT NULL",
    ).all<{ id: string; canonical_domain: string }>();

    let domainsAdded = 0;
    for (const brand of brands.results) {
      const domain = brand.canonical_domain;
      if (!domain) continue;

      // Add exact domain
      const r1 = await env.DB.prepare(
        `INSERT OR IGNORE INTO brand_safe_domains (id, brand_id, domain, added_by, source)
         VALUES (?, ?, ?, NULL, 'auto_detected')`,
      ).bind(crypto.randomUUID(), brand.id, domain).run();
      if (r1.meta?.changes) domainsAdded++;

      // Add www variant
      const r2 = await env.DB.prepare(
        `INSERT OR IGNORE INTO brand_safe_domains (id, brand_id, domain, added_by, source)
         VALUES (?, ?, ?, NULL, 'auto_detected')`,
      ).bind(crypto.randomUUID(), brand.id, "www." + domain).run();
      if (r2.meta?.changes) domainsAdded++;

      // Add wildcard
      const r3 = await env.DB.prepare(
        `INSERT OR IGNORE INTO brand_safe_domains (id, brand_id, domain, added_by, source)
         VALUES (?, ?, ?, NULL, 'auto_detected')`,
      ).bind(crypto.randomUUID(), brand.id, "*." + domain).run();
      if (r3.meta?.changes) domainsAdded++;
    }

    return json({
      success: true,
      data: { brands_processed: brands.results.length, domains_added: domainsAdded },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── POST /api/admin/import-tranco ──────────────────────────────

const TRANCO_CSV_URL = "https://tranco-list.eu/top-1m.csv.zip";

export async function handleImportTranco(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json().catch(() => null) as {
      limit?: number;
      min_rank?: number;
      max_rank?: number;
      sectors?: Record<string, string>;
    } | null;

    const limit = Math.min(body?.limit ?? 10000, 10000);
    const minRank = body?.min_rank ?? 1;
    const maxRank = body?.max_rank ?? limit;

    // Fetch Tranco CSV (rank,domain format)
    const res = await fetch(TRANCO_CSV_URL);
    if (!res.ok) throw new Error(`Tranco fetch failed: HTTP ${res.status}`);

    // Tranco serves a zip — decompress it
    const zipBuffer = await res.arrayBuffer();
    const csvText = await extractCsvFromZip(zipBuffer);
    if (!csvText) throw new Error("Failed to extract CSV from Tranco zip");

    const lines = csvText.split("\n").filter(Boolean);
    const candidates: Array<{ rank: number; domain: string }> = [];

    for (const line of lines) {
      const [rankStr, domain] = line.split(",");
      if (!rankStr || !domain) continue;
      const rank = parseInt(rankStr, 10);
      if (rank < minRank || rank > maxRank) continue;
      const cleanDomain = domain.trim().toLowerCase();
      const baseName = cleanDomain.split(".")[0] ?? "";
      // Skip short names (< 4 chars) and purely numeric domains
      if (baseName.length < 4 || /^\d+$/.test(baseName)) continue;
      candidates.push({ rank, domain: cleanDomain });
      if (candidates.length >= limit) break;
    }

    // Filter out domains we already have
    const existing = await env.DB.prepare(
      "SELECT canonical_domain FROM brands"
    ).all<{ canonical_domain: string }>();
    const existingSet = new Set(existing.results.map(r => r.canonical_domain.toLowerCase()));

    const toImport = candidates.filter(c => !existingSet.has(c.domain));
    let imported = 0;
    const skipped = candidates.length - toImport.length;

    // Batch insert in groups of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE);
      const stmts = batch.map(c => {
        const brandId = `brand_${c.domain.replace(/[^a-z0-9]+/g, "_")}`;
        const name = extractBrandName(c.domain);
        const sector = body?.sectors?.[c.domain] ?? null;
        return env.DB.prepare(
          `INSERT OR IGNORE INTO brands (id, name, canonical_domain, sector, source, first_seen, threat_count)
           VALUES (?, ?, ?, ?, 'tranco', datetime('now'), 0)`
        ).bind(brandId, name, c.domain, sector);
      });
      await env.DB.batch(stmts);
      imported += batch.length;
    }

    // Clean up false positive brands — short/generic names that aren't real brands
    try {
      const GENERIC_NAMES = ['www','one','bit','dns','app','web','api','cdn','dev','net','goo','pages','forms','mail','blog','shop','host','info','link','news','data','live','play','docs','home','code','test','help','chat','free','plus','labs'];
      // Delete brands with very short names (<=3 chars) that were just imported from Tranco
      await env.DB.prepare(
        `DELETE FROM brands WHERE source = 'tranco' AND LENGTH(name) <= 3 AND threat_count = 0`
      ).run();
      // Delete purely numeric names
      await env.DB.prepare(
        `DELETE FROM brands WHERE source = 'tranco' AND threat_count = 0
         AND name GLOB '[0-9]*' AND name NOT GLOB '*[a-zA-Z]*'`
      ).run();
      // Delete generic names
      for (const generic of GENERIC_NAMES) {
        await env.DB.prepare(
          `DELETE FROM brands WHERE source = 'tranco' AND threat_count = 0 AND LOWER(name) = ?`
        ).bind(generic).run();
      }
      console.log('[import-tranco] cleaned up false positive brands');
    } catch (cleanupErr) {
      console.error('[import-tranco] cleanup error:', cleanupErr);
    }

    // Auto-run brand match backfill (10 rounds) to link existing threats to newly imported brands
    let backfillMatched = 0;
    if (imported > 0) {
      for (let i = 0; i < 10; i++) {
        const bf = await runBrandMatchBackfill(env);
        backfillMatched += bf.matched;
        console.log(`[import-tranco] backfill round ${i + 1}/10: matched=${bf.matched}, pending=${bf.pending}`);
        if (bf.pending === 0 || bf.checked === 0) break;
      }
    }

    return json({
      success: true,
      data: {
        candidates: candidates.length,
        imported,
        skipped,
        backfillMatched,
        message: `Imported ${imported} brands from Tranco top ${maxRank} (${skipped} already existed, ${backfillMatched} threats backfill-matched)`,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

/** Extract brand name from domain: "amazon.com" → "Amazon", "bank-of-america.com" → "Bank Of America" */
function extractBrandName(domain: string): string {
  const base = domain.split(".")[0] ?? domain;
  return base
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Minimal zip extraction — finds the first file and decompresses it */
async function extractCsvFromZip(buffer: ArrayBuffer): Promise<string | null> {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return new TextDecoder().decode(buffer);
  }
  const compressionMethod = bytes[8]! | (bytes[9]! << 8);
  const compressedSize = bytes[18]! | (bytes[19]! << 8) | (bytes[20]! << 16) | (bytes[21]! << 24);
  const fileNameLen = bytes[26]! | (bytes[27]! << 8);
  const extraLen = bytes[28]! | (bytes[29]! << 8);
  const dataOffset = 30 + fileNameLen + extraLen;

  if (compressionMethod === 0) {
    return new TextDecoder().decode(bytes.slice(dataOffset, dataOffset + compressedSize));
  }
  if (compressionMethod === 8) {
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(compressed);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) { result.set(c, offset); offset += c.length; }
    return new TextDecoder().decode(result);
  }
  return null;
}

// ─── GET /api/admin/brands — Admin brand management ─────────────

export async function handleAdminListBrands(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(200, parseInt(url.searchParams.get("limit") ?? "100", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const search = url.searchParams.get("q");
    const source = url.searchParams.get("source");
    const sort = url.searchParams.get("sort") ?? "threat_count";

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) { conditions.push("(b.name LIKE ? OR b.canonical_domain LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    if (source) { conditions.push("b.source = ?"); params.push(source); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const sortColumn = sort === "name" ? "b.name ASC" :
      sort === "created" ? "b.first_seen DESC" :
      sort === "threats" ? "threat_count DESC" : "threat_count DESC";

    params.push(limit, offset);

    const rows = await env.DB.prepare(`
      SELECT b.id, b.name, b.canonical_domain, b.sector, b.source, b.first_seen,
             COUNT(t.id) AS threat_count,
             SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) AS active_threats,
             (SELECT COUNT(*) FROM monitored_brands mb WHERE mb.brand_id = b.id) AS is_monitored
      FROM brands b
      LEFT JOIN threats t ON t.target_brand_id = b.id
      ${where}
      GROUP BY b.id
      ORDER BY ${sortColumn}
      LIMIT ? OFFSET ?
    `).bind(...params).all();

    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM brands b ${where}`)
      .bind(...params.slice(0, -2)).first<{ n: number }>();

    // Source breakdown
    const sources = await env.DB.prepare(
      "SELECT COALESCE(source, 'manual') AS source, COUNT(*) AS count FROM brands GROUP BY source"
    ).all<{ source: string; count: number }>();

    return json({
      success: true,
      data: rows.results,
      total: total?.n ?? 0,
      sources: sources.results,
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── POST /api/admin/brands/bulk-monitor — Bulk add to monitoring ─

export async function handleBulkMonitor(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json().catch(() => null) as { brand_ids?: string[] } | null;
    if (!body?.brand_ids?.length) return json({ success: false, error: "brand_ids required" }, 400, origin);

    const ids = body.brand_ids.slice(0, 100); // cap at 100
    let added = 0;

    const stmts = ids.map(id =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO monitored_brands (brand_id, tenant_id, added_by, status)
         VALUES (?, '__internal__', ?, 'active')`
      ).bind(id, userId)
    );

    // Batch in groups of 50
    for (let i = 0; i < stmts.length; i += 50) {
      const batch = stmts.slice(i, i + 50);
      const results = await env.DB.batch(batch);
      added += results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
    }

    return json({ success: true, data: { requested: ids.length, added } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── DELETE /api/admin/brands/bulk — Bulk delete brands ──────────

export async function handleBulkDeleteBrands(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json().catch(() => null) as { brand_ids?: string[] } | null;
    if (!body?.brand_ids?.length) return json({ success: false, error: "brand_ids required" }, 400, origin);

    const ids = body.brand_ids.slice(0, 100);
    let deleted = 0;

    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const placeholders = batch.map(() => "?").join(",");
      const result = await env.DB.prepare(
        `DELETE FROM brands WHERE id IN (${placeholders})`
      ).bind(...batch).run();
      deleted += result.meta?.changes ?? 0;

      // Also clean up monitored_brands
      await env.DB.prepare(
        `DELETE FROM monitored_brands WHERE brand_id IN (${placeholders})`
      ).bind(...batch).run();
    }

    await audit(env, { action: "brands_bulk_delete", userId, resourceType: "brand", resourceId: ids.join(","), details: { count: deleted }, request });
    return json({ success: true, data: { deleted } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
