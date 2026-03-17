// Trust Radar v2 — Brand API Endpoints

import { json } from "../lib/cors";
import { audit } from "../lib/audit";
import { analyzeBrandThreats, callHaikuRaw, setHaikuCategory } from "../lib/haiku";
import type { Env } from "../types";

// GET /api/brands/stats
export async function handleBrandStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM brands").first<{ n: number }>();

    const newThisWeek = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM brands WHERE first_seen >= datetime('now', '-7 days')"
    ).first<{ n: number }>();

    const fastestRising = await env.DB.prepare(`
      SELECT b.name, COUNT(t.id) AS cnt
      FROM brands b
      JOIN threats t ON t.target_brand_id = b.id AND t.created_at >= datetime('now', '-1 day')
      GROUP BY b.id ORDER BY cnt DESC LIMIT 1
    `).first<{ name: string; cnt: number }>();

    const topType = await env.DB.prepare(`
      SELECT threat_type, COUNT(*) AS cnt, ROUND(COUNT(*) * 100.0 / MAX(1, (SELECT COUNT(*) FROM threats)), 1) AS pct
      FROM threats GROUP BY threat_type ORDER BY cnt DESC LIMIT 1
    `).first<{ threat_type: string; cnt: number; pct: number }>();

    return json({
      success: true,
      data: {
        total_tracked: total?.n ?? 0,
        new_this_week: newThisWeek?.n ?? 0,
        fastest_rising: fastestRising?.name ?? null,
        fastest_rising_pct: fastestRising?.cnt ?? 0,
        top_threat_type: topType?.threat_type ?? null,
        top_threat_type_pct: topType?.pct ?? 0,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands
export async function handleListBrands(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const search = url.searchParams.get("q");
    const sector = url.searchParams.get("sector");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) { conditions.push("(b.name LIKE ? OR b.canonical_domain LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    if (sector) { conditions.push("b.sector = ?"); params.push(sector); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const rows = await env.DB.prepare(`
      SELECT b.id, b.name, b.canonical_domain, b.sector, b.first_seen,
             COUNT(t.id) AS threat_count,
             MAX(t.created_at) AS last_threat_seen
      FROM brands b
      LEFT JOIN threats t ON t.target_brand_id = b.id
      ${where}
      GROUP BY b.id
      ORDER BY threat_count DESC
      LIMIT ? OFFSET ?
    `).bind(...params).all();

    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM brands b ${where}`)
      .bind(...params.slice(0, -2)).first<{ n: number }>();

    return json({ success: true, data: rows.results, total: total?.n ?? 0 }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/top-targeted
export async function handleTopTargetedBrands(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "10", 10));
    const period = url.searchParams.get("period") ?? "30d";

    let since = "datetime('now', '-30 days')";
    if (period === "7d") since = "datetime('now', '-7 days')";
    else if (period === "90d") since = "datetime('now', '-90 days')";
    else if (period === "1y") since = "datetime('now', '-1 year')";

    const rows = await env.DB.prepare(`
      SELECT b.id, b.name, b.sector, b.canonical_domain,
             COUNT(t.id) AS threat_count
      FROM brands b
      JOIN threats t ON t.target_brand_id = b.id AND t.created_at >= ${since}
      GROUP BY b.id
      ORDER BY threat_count DESC
      LIMIT ?
    `).bind(limit).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/monitored
export async function handleMonitoredBrands(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT b.id, b.name, b.canonical_domain, b.sector, b.first_seen,
             COUNT(t.id) AS threat_count,
             MAX(t.created_at) AS last_threat_seen
      FROM monitored_brands mb
      JOIN brands b ON b.id = mb.brand_id
      LEFT JOIN threats t ON t.target_brand_id = b.id AND t.status = 'active'
      GROUP BY b.id
      ORDER BY threat_count DESC
    `).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// POST /api/brands/monitor
export async function handleAddMonitoredBrand(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json().catch(() => null) as {
      domain?: string; name?: string | null; sector?: string | null;
      reason?: string | null; notes?: string | null;
    } | null;

    if (!body?.domain) return json({ success: false, error: "domain required" }, 400, origin);

    const domain = body.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    const brandName = body.name || domain.split(".")[0]!.charAt(0).toUpperCase() + domain.split(".")[0]!.slice(1);

    // Find existing brand by canonical_domain, or create one
    let brand = await env.DB.prepare(
      "SELECT id FROM brands WHERE canonical_domain = ?"
    ).bind(domain).first<{ id: string }>();

    if (!brand) {
      const newId = `brand_${domain.replace(/[^a-z0-9]+/g, "_")}`;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO brands (id, name, canonical_domain, sector, first_seen, threat_count)
         VALUES (?, ?, ?, ?, datetime('now'), 0)`
      ).bind(newId, brandName, domain, body.sector ?? null).run();
      brand = { id: newId };
    }

    // Insert into monitored_brands (PK is brand_id + tenant_id)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO monitored_brands (brand_id, tenant_id, added_by, notes, status)
       VALUES (?, '__internal__', ?, ?, 'active')`
    ).bind(brand.id, userId, body.notes ?? null).run();

    // ─── Auto-add canonical domain to safe domains allowlist ───
    await env.DB.prepare(
      `INSERT OR IGNORE INTO brand_safe_domains (id, brand_id, domain, added_by, source)
       VALUES (?, ?, ?, ?, 'auto_detected')`
    ).bind(crypto.randomUUID(), brand.id, domain, userId).run();
    // Also add www variant
    await env.DB.prepare(
      `INSERT OR IGNORE INTO brand_safe_domains (id, brand_id, domain, added_by, source)
       VALUES (?, ?, ?, ?, 'auto_detected')`
    ).bind(crypto.randomUUID(), brand.id, "www." + domain, userId).run();
    // Also add wildcard for all subdomains
    await env.DB.prepare(
      `INSERT OR IGNORE INTO brand_safe_domains (id, brand_id, domain, added_by, source)
       VALUES (?, ?, ?, ?, 'auto_detected')`
    ).bind(crypto.randomUUID(), brand.id, "*." + domain, userId).run();

    // ─── Step A: Retroactive domain-based threat linking (free, no AI) ───
    const keyword = domain.split(".")[0]!; // e.g. "docusign.com" → "docusign"
    const hyphenated = keyword.includes("-") ? keyword : keyword.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    // Build LIKE patterns: exact keyword and hyphenated variant
    const patterns: string[] = [`%${keyword}%`];
    if (hyphenated !== keyword) patterns.push(`%${hyphenated}%`);
    // Also try splitting on common word boundaries: "docusign" → "docu-sign" won't match
    // but "docu-sign" domain → keyword "docu-sign" will match via the first pattern

    // Match threats by URL containing keyword or canonical_domain
    const likeClause = patterns.map(() => "malicious_url LIKE ?").join(" OR ");
    const domainLikeClause = `malicious_domain LIKE ? OR malicious_url LIKE ?`;
    const linkQuery = `UPDATE threats SET target_brand_id = ? WHERE target_brand_id IS NULL AND (${likeClause} OR ${domainLikeClause}) `;
    const bindValues = [brand.id, ...patterns, `%${domain}%`, `%${domain}%`];

    const linkResult = await env.DB.prepare(linkQuery).bind(...bindValues).run();
    const threatsLinked = linkResult.meta?.changes ?? 0;

    // Update brand aggregate counts
    if (threatsLinked > 0) {
      await env.DB.prepare(
        `UPDATE brands SET
           threat_count = (SELECT COUNT(*) FROM threats WHERE target_brand_id = ?),
           last_threat_seen = (SELECT MAX(created_at) FROM threats WHERE target_brand_id = ?)
         WHERE id = ?`
      ).bind(brand.id, brand.id, brand.id).run();
    }

    await audit(env, { action: "brand_monitor_add", userId, resourceType: "brand", resourceId: brand.id, details: { domain, reason: body.reason, threats_linked: threatsLinked }, request });
    return json({ success: true, data: { brand_id: brand.id, domain, name: brandName, threats_linked: threatsLinked, message: threatsLinked > 0 ? `Found ${threatsLinked} existing threats matching this brand` : "No existing threats matched" } }, 201, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// DELETE /api/brands/monitor/:id
export async function handleRemoveMonitoredBrand(request: Request, env: Env, brandId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    await env.DB.prepare("DELETE FROM monitored_brands WHERE brand_id = ?").bind(brandId).run();
    await audit(env, { action: "brand_monitor_remove", userId, resourceType: "brand", resourceId: brandId, request });
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id
export async function handleGetBrand(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const brand = await env.DB.prepare(
      "SELECT id, name, canonical_domain, sector, first_seen FROM brands WHERE id = ?",
    ).bind(brandId).first();
    if (!brand) return json({ success: false, error: "Brand not found" }, 404, origin);

    const [stats, providers] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) AS total_threats,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_threats,
               SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) AS phishing,
               SUM(CASE WHEN threat_type = 'typosquatting' THEN 1 ELSE 0 END) AS typosquatting,
               SUM(CASE WHEN threat_type = 'impersonation' THEN 1 ELSE 0 END) AS impersonation,
               SUM(CASE WHEN threat_type = 'credential_harvesting' THEN 1 ELSE 0 END) AS credential,
               COUNT(DISTINCT CASE WHEN country_code IS NOT NULL AND country_code NOT IN ('XX','PRIV') THEN country_code END) AS countries,
               COUNT(DISTINCT hosting_provider_id) AS provider_count
        FROM threats WHERE target_brand_id = ?
      `).bind(brandId).first(),
      env.DB.prepare(`
        SELECT hosting_provider_id AS provider_id, COUNT(*) AS count
        FROM threats WHERE target_brand_id = ? AND hosting_provider_id IS NOT NULL
        GROUP BY hosting_provider_id ORDER BY count DESC LIMIT 10
      `).bind(brandId).all(),
    ]);

    return json({ success: true, data: { ...brand, stats, top_providers: providers.results } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/threats
export async function handleBrandThreats(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const rows = await env.DB.prepare(`
      SELECT id, threat_type, severity, status, malicious_domain, malicious_url,
             ip_address, country_code, hosting_provider_id, campaign_id,
             first_seen, last_seen, created_at
      FROM threats WHERE target_brand_id = ?
        AND malicious_domain NOT IN (SELECT domain FROM brand_safe_domains WHERE brand_id = ?)
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).bind(brandId, brandId, limit, offset).all();

    const total = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM threats WHERE target_brand_id = ?
         AND malicious_domain NOT IN (SELECT domain FROM brand_safe_domains WHERE brand_id = ?)`
    ).bind(brandId, brandId).first<{ n: number }>();

    return json({ success: true, data: rows.results, total: total?.n ?? 0 }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/threats/locations
export async function handleBrandThreatLocations(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT country_code, COUNT(*) AS count,
             AVG(CAST(lat AS REAL)) AS lat, AVG(CAST(lng AS REAL)) AS lng
      FROM threats
      WHERE target_brand_id = ? AND country_code IS NOT NULL AND country_code NOT IN ('XX','PRIV')
      GROUP BY country_code
      ORDER BY count DESC
    `).bind(brandId).all();

    // Split into mappable (has lat/lng) and count-only
    const mappable = rows.results.filter((r: Record<string, unknown>) => r.lat != null && r.lng != null);
    const totalCountries = rows.results.length;

    return json({ success: true, data: mappable, totalCountries }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/threats/timeline
export async function handleBrandThreatTimeline(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "30d";

    let bucket = "date(created_at)";
    let since = "datetime('now', '-30 days')";
    if (period === "7d") since = "datetime('now', '-7 days')";
    else if (period === "90d") { since = "datetime('now', '-90 days')"; bucket = "strftime('%Y-%W', created_at)"; }
    else if (period === "1y") { since = "datetime('now', '-1 year')"; bucket = "strftime('%Y-%m', created_at)"; }

    const rows = await env.DB.prepare(`
      SELECT ${bucket} AS period, COUNT(*) AS count,
             SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) AS phishing,
             SUM(CASE WHEN threat_type = 'typosquatting' THEN 1 ELSE 0 END) AS typosquatting,
             SUM(CASE WHEN threat_type = 'impersonation' THEN 1 ELSE 0 END) AS impersonation
      FROM threats WHERE target_brand_id = ? AND created_at >= ${since}
      GROUP BY ${bucket} ORDER BY period ASC
    `).bind(brandId).all();

    // Reshape to {labels, values} for frontend chart compatibility
    const results = rows.results as Array<{ period: string; count: number; phishing: number; typosquatting: number; impersonation: number }>;
    const labels = results.map(r => r.period);
    const values = results.map(r => r.count);

    return json({
      success: true,
      data: {
        labels,
        values,
        series: [
          { name: "Phishing", values: results.map(r => r.phishing) },
          { name: "Typosquatting", values: results.map(r => r.typosquatting) },
          { name: "Impersonation", values: results.map(r => r.impersonation) },
        ],
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/providers
export async function handleBrandProviders(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT t.hosting_provider_id AS provider_id,
             COALESCE(hp.name, t.hosting_provider_id) AS name,
             COUNT(*) AS threat_count,
             SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) AS active_count
      FROM threats t
      LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
      WHERE t.target_brand_id = ? AND t.hosting_provider_id IS NOT NULL
      GROUP BY t.hosting_provider_id ORDER BY threat_count DESC LIMIT 20
    `).bind(brandId).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/campaigns
export async function handleBrandCampaigns(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(`
      SELECT DISTINCT c.id, c.name, c.status, c.threat_count, c.first_seen, c.last_seen
      FROM campaigns c
      JOIN threats t ON t.campaign_id = c.id
      WHERE t.target_brand_id = ?
      ORDER BY c.last_seen DESC
    `).bind(brandId).all();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/brands/:id/analysis
export async function handleGetBrandAnalysis(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const brand = await env.DB.prepare(
      "SELECT id, name, canonical_domain, threat_analysis, analysis_updated_at FROM brands WHERE id = ?",
    ).bind(brandId).first<{
      id: string; name: string; canonical_domain: string;
      threat_analysis: string | null; analysis_updated_at: string | null;
    }>();
    if (!brand) return json({ success: false, error: "Brand not found" }, 404, origin);

    // Return cached analysis if fresh (< 6 hours old)
    if (brand.threat_analysis && brand.analysis_updated_at) {
      const age = Date.now() - new Date(brand.analysis_updated_at).getTime();
      if (age < 6 * 60 * 60 * 1000) {
        const parsed = JSON.parse(brand.threat_analysis);
        return json({ success: true, data: { ...parsed, cached: true, updated_at: brand.analysis_updated_at } }, 200, origin);
      }
    }

    return json({
      success: true,
      data: brand.threat_analysis ? { ...JSON.parse(brand.threat_analysis), cached: true, stale: true, updated_at: brand.analysis_updated_at } : null,
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// POST /api/brands/:id/analysis — generate or refresh AI analysis
export async function handleGenerateBrandAnalysis(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  setHaikuCategory("on_demand");
  try {
    const brand = await env.DB.prepare(
      "SELECT id, name, canonical_domain FROM brands WHERE id = ?",
    ).bind(brandId).first<{ id: string; name: string; canonical_domain: string }>();
    if (!brand) return json({ success: false, error: "Brand not found" }, 404, origin);

    // Gather threat data for the brand
    const [stats, providerRows, campaignRows, domainRows] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) AS phishing,
               SUM(CASE WHEN threat_type = 'typosquatting' THEN 1 ELSE 0 END) AS typosquatting,
               SUM(CASE WHEN threat_type = 'impersonation' THEN 1 ELSE 0 END) AS impersonation,
               SUM(CASE WHEN threat_type = 'credential_harvesting' THEN 1 ELSE 0 END) AS credential,
               SUM(CASE WHEN threat_type = 'malware_distribution' THEN 1 ELSE 0 END) AS malware
        FROM threats WHERE target_brand_id = ?
      `).bind(brandId).first<Record<string, number>>(),
      env.DB.prepare(`
        SELECT COALESCE(hp.name, t.hosting_provider_id) AS name
        FROM threats t LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
        WHERE t.target_brand_id = ? AND t.hosting_provider_id IS NOT NULL
        GROUP BY t.hosting_provider_id ORDER BY COUNT(*) DESC LIMIT 10
      `).bind(brandId).all<{ name: string }>(),
      env.DB.prepare(`
        SELECT DISTINCT c.name FROM campaigns c JOIN threats t ON t.campaign_id = c.id
        WHERE t.target_brand_id = ? ORDER BY c.threat_count DESC LIMIT 5
      `).bind(brandId).all<{ name: string }>(),
      env.DB.prepare(`
        SELECT DISTINCT malicious_domain FROM threats
        WHERE target_brand_id = ? AND malicious_domain IS NOT NULL LIMIT 10
      `).bind(brandId).all<{ malicious_domain: string }>(),
    ]);

    const threatTypes: Record<string, number> = {};
    if (stats) {
      for (const [k, v] of Object.entries(stats)) {
        if (k !== "total" && v > 0) threatTypes[k] = v;
      }
    }

    const result = await analyzeBrandThreats(env, {
      brand_name: brand.name,
      threat_count: stats?.total ?? 0,
      providers: providerRows.results.map(r => r.name),
      domains: domainRows.results.map(r => r.malicious_domain),
      threat_types: threatTypes,
      campaigns: campaignRows.results.map(r => r.name),
    });

    if (result.success && result.data) {
      const analysisJson = JSON.stringify(result.data);
      await env.DB.prepare(
        "UPDATE brands SET threat_analysis = ?, analysis_updated_at = datetime('now') WHERE id = ?",
      ).bind(analysisJson, brandId).run();

      return json({
        success: true,
        data: { ...result.data, cached: false, updated_at: new Date().toISOString() },
        tokens_used: result.tokens_used,
      }, 200, origin);
    }

    return json({ success: false, error: result.error || "Analysis generation failed" }, 500, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// POST /api/brands/:id/deep-scan — AI-powered threat linking (user-triggered, costs tokens)
export async function handleBrandDeepScan(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  setHaikuCategory("on_demand");
  try {
    const brand = await env.DB.prepare(
      "SELECT id, name, canonical_domain FROM brands WHERE id = ?"
    ).bind(brandId).first<{ id: string; name: string; canonical_domain: string }>();
    if (!brand) return json({ success: false, error: "Brand not found" }, 404, origin);

    // Fetch up to 200 unlinked threats that haven't been AI-scored yet
    const unlinked = await env.DB.prepare(
      `SELECT id, malicious_url, malicious_domain FROM threats
       WHERE target_brand_id IS NULL
       ORDER BY created_at DESC LIMIT 200`
    ).all<{ id: string; malicious_url: string | null; malicious_domain: string | null }>();

    const threats = unlinked.results;
    if (!threats.length) {
      return json({ success: true, data: { scanned: 0, newly_linked: 0, message: "No unlinked threats to scan" } }, 200, origin);
    }

    const systemPrompt = "You are a brand impersonation detector. Reply with ONLY 'YES' or 'NO'.";
    let newlyLinked = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < threats.length; i += BATCH_SIZE) {
      const batch = threats.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (t) => {
          const url = t.malicious_url || t.malicious_domain || "";
          if (!url) return { id: t.id, match: false };
          const userMsg = `Does this URL target or impersonate the brand ${brand.name} (${brand.canonical_domain})? Consider typosquatting, homoglyph attacks, subdomain abuse, and lookalike domains. URL: ${url}`;
          const res = await callHaikuRaw(env, systemPrompt, userMsg);
          return { id: t.id, match: res.success && res.text?.toUpperCase().startsWith("YES") };
        })
      );

      const matchedIds = results.filter(r => r.match).map(r => r.id);
      if (matchedIds.length > 0) {
        // Batch update matched threats
        for (const id of matchedIds) {
          await env.DB.prepare("UPDATE threats SET target_brand_id = ? WHERE id = ?").bind(brandId, id).run();
        }
        newlyLinked += matchedIds.length;
      }
    }

    // Update brand aggregate counts
    if (newlyLinked > 0) {
      await env.DB.prepare(
        `UPDATE brands SET
           threat_count = (SELECT COUNT(*) FROM threats WHERE target_brand_id = ?),
           last_threat_seen = (SELECT MAX(created_at) FROM threats WHERE target_brand_id = ?)
         WHERE id = ?`
      ).bind(brandId, brandId, brandId).run();
    }

    return json({ success: true, data: { scanned: threats.length, newly_linked: newlyLinked, message: newlyLinked > 0 ? `Found ${newlyLinked} additional threats` : "No new matches found" } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// POST /api/brands/:id/clean-false-positives
export async function handleCleanFalsePositives(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const { loadSafeDomainSet, isSafeDomain } = await import("../lib/safeDomains");
    const safeSet = await loadSafeDomainSet(env.DB);

    const threats = await env.DB.prepare(
      `SELECT id, malicious_domain FROM threats
       WHERE target_brand_id = ? AND status = 'active' AND malicious_domain IS NOT NULL`,
    ).bind(brandId).all<{ id: string; malicious_domain: string }>();

    let cleaned = 0;
    for (const t of threats.results) {
      if (isSafeDomain(t.malicious_domain, safeSet)) {
        await env.DB.prepare(
          "UPDATE threats SET status = 'remediated', confidence_score = 0 WHERE id = ?",
        ).bind(t.id).run();
        cleaned++;
      }
    }

    return json({ success: true, data: { cleaned, checked: threats.results.length } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
