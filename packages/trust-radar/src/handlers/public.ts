/**
 * Averrow — Public API Endpoints (no auth required)
 * All endpoints rate-limited. No sensitive data exposed.
 */

import { json } from "../lib/cors";
import { setHaikuCategory, callHaikuRaw } from "../lib/haiku";
import type { Env } from "../types";

// ─── GET /api/v1/public/stats ────────────────────────────────────

export async function handlePublicStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const [
      totalThreats, activeThreats, brandsMonitored, activeFeeds,
      campaigns, countries, certsToday, classifiedToday,
      latestInsight, providers, typeCounts,
    ] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as n FROM threats").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE status = 'active' OR status IS NULL").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) as n FROM monitored_brands WHERE status = 'active'").first<{ n: number }>(),
      env.DB.prepare(
        `SELECT COUNT(*) as n FROM feed_status
         WHERE health_status IN ('healthy', 'degraded')
         AND feed_name NOT IN (SELECT feed_name FROM feed_configs WHERE enabled = 0)`
      ).first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) as n FROM campaigns").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(DISTINCT country_code) as n FROM threats WHERE country_code IS NOT NULL AND country_code != 'XX'").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE created_at >= date('now')").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE confidence_score IS NOT NULL AND created_at >= date('now')").first<{ n: number }>(),
      env.DB.prepare("SELECT summary FROM agent_outputs WHERE agent_id = 'observer' ORDER BY created_at DESC LIMIT 1").first<{ summary: string }>(),
      env.DB.prepare("SELECT COUNT(DISTINCT hosting_provider_id) as n FROM threats WHERE hosting_provider_id IS NOT NULL").first<{ n: number }>(),
      env.DB.prepare(
        `SELECT threat_type, COUNT(*) as count FROM threats
         WHERE threat_type IS NOT NULL
         GROUP BY threat_type ORDER BY count DESC`
      ).all<{ threat_type: string; count: number }>(),
    ]);

    return json({
      success: true,
      data: {
        total_threats: totalThreats?.n ?? 0,
        active_threats: activeThreats?.n ?? 0,
        brands_monitored: brandsMonitored?.n ?? 0,
        active_feeds: activeFeeds?.n ?? 0,
        threat_campaigns: campaigns?.n ?? 0,
        countries: countries?.n ?? 0,
        certificates_today: certsToday?.n ?? 0,
        threats_classified_today: classifiedToday?.n ?? 0,
        providers_mapped: providers?.n ?? 0,
        latest_insight_summary: latestInsight?.summary?.slice(0, 80) ?? "",
        threat_types: typeCounts?.results ?? [],
        // Legacy aliases
        brands_tracked: brandsMonitored?.n ?? 0,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/v1/public/geo ──────────────────────────────────────

export async function handlePublicGeo(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(
      `SELECT latitude as lat, longitude as lng,
              CASE WHEN confidence_score >= 80 THEN 'critical'
                   WHEN confidence_score >= 60 THEN 'high'
                   WHEN confidence_score >= 40 THEN 'medium'
                   ELSE 'low' END as severity
       FROM threats
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
       ORDER BY created_at DESC LIMIT 500`
    ).all<{ lat: number; lng: number; severity: string }>();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── GET /api/v1/public/feeds ────────────────────────────────────

export async function handlePublicFeeds(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(
      `SELECT fc.feed_name, fc.display_name, fc.description, fs.health_status,
              fs.records_ingested_today
       FROM feed_configs fc
       JOIN feed_status fs ON fc.feed_name = fs.feed_name
       WHERE fc.enabled = 1
       ORDER BY fs.records_ingested_today DESC`
    ).all<{
      feed_name: string; display_name: string; description: string;
      health_status: string; records_ingested_today: number;
    }>();

    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── POST /api/v1/public/assess ──────────────────────────────────

export async function handlePublicAssess(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Rate limit: 10 per IP per hour
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
    const rateLimitKey = `pub_assess_${ip}`;
    const currentCount = parseInt(await env.CACHE.get(rateLimitKey) || "0", 10);
    if (currentCount >= 10) {
      return json({ success: false, error: "Rate limit exceeded. Please try again in an hour." }, 429, origin);
    }
    await env.CACHE.put(rateLimitKey, String(currentCount + 1), { expirationTtl: 3600 });

    const body = await request.json().catch(() => null) as { domain?: string } | null;
    if (!body?.domain) return json({ success: false, error: "domain required" }, 400, origin);

    // Validate domain format
    const domain = body.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
    if (!domain || !domain.includes(".") || domain.includes("@")) {
      return json({ success: false, error: "Please enter a valid domain (e.g. yourbrand.com)" }, 400, origin);
    }

    const keyword = domain.split(".")[0]!;
    const brandName = keyword.charAt(0).toUpperCase() + keyword.slice(1);

    // Check if this brand is monitored
    const monitoredBrand = await env.DB.prepare(
      `SELECT b.id, b.name FROM brands b
       JOIN monitored_brands mb ON mb.brand_id = b.id
       WHERE mb.status = 'active' AND (b.canonical_domain = ? OR b.name LIKE ?)
       LIMIT 1`
    ).bind(domain, `%${keyword}%`).first<{ id: string; name: string }>();

    let threatCount: number, providerCount: number, campaignCount: number;
    let isMonitored = false;
    let threatTypes: { threat_type: string; count: number }[] = [];

    if (monitoredBrand) {
      // Brand is monitored — show REAL data
      isMonitored = true;
      const [tc, pc, cc, tt] = await Promise.all([
        env.DB.prepare(
          `SELECT COUNT(*) as c FROM threats WHERE target_brand_id = ?`
        ).bind(monitoredBrand.id).first<{ c: number }>(),
        env.DB.prepare(
          `SELECT COUNT(DISTINCT hosting_provider_id) as c FROM threats
           WHERE target_brand_id = ? AND hosting_provider_id IS NOT NULL`
        ).bind(monitoredBrand.id).first<{ c: number }>(),
        env.DB.prepare(
          `SELECT COUNT(DISTINCT campaign_id) as c FROM threats
           WHERE target_brand_id = ? AND campaign_id IS NOT NULL`
        ).bind(monitoredBrand.id).first<{ c: number }>(),
        env.DB.prepare(
          `SELECT threat_type, COUNT(*) as count FROM threats
           WHERE target_brand_id = ? AND threat_type IS NOT NULL
           GROUP BY threat_type ORDER BY count DESC`
        ).bind(monitoredBrand.id).all<{ threat_type: string; count: number }>(),
      ]);
      threatCount = tc?.c ?? 0;
      providerCount = pc?.c ?? 0;
      campaignCount = cc?.c ?? 0;
      threatTypes = tt?.results ?? [];
    } else {
      // Not monitored — keyword-based scan
      const [tc, pc, cc] = await Promise.all([
        env.DB.prepare(
          `SELECT COUNT(*) as c FROM threats
           WHERE malicious_url LIKE ? OR malicious_domain LIKE ?`
        ).bind(`%${keyword}%`, `%${keyword}%`).first<{ c: number }>(),
        env.DB.prepare(
          `SELECT COUNT(DISTINCT hosting_provider_id) as c FROM threats
           WHERE (malicious_url LIKE ? OR malicious_domain LIKE ?) AND hosting_provider_id IS NOT NULL`
        ).bind(`%${keyword}%`, `%${keyword}%`).first<{ c: number }>(),
        env.DB.prepare(
          `SELECT COUNT(DISTINCT id) as c FROM campaigns
           WHERE name LIKE ? OR id IN (
             SELECT DISTINCT campaign_id FROM threats
             WHERE campaign_id IS NOT NULL AND (malicious_url LIKE ? OR malicious_domain LIKE ?)
           )`
        ).bind(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`).first<{ c: number }>(),
      ]);
      threatCount = tc?.c ?? 0;
      providerCount = pc?.c ?? 0;
      campaignCount = cc?.c ?? 0;
    }

    // Check spam trap data for this brand
    let spamTrapCount = 0;
    let spamTrapIps = 0;
    try {
      const trapData = await env.DB.prepare(`
        SELECT COUNT(*) as count, COUNT(DISTINCT sending_ip) as ips
        FROM spam_trap_captures
        WHERE spoofed_domain = ? AND captured_at > datetime('now', '-30 days')
      `).bind(domain).first<{ count: number; ips: number }>();
      spamTrapCount = trapData?.count ?? 0;
      spamTrapIps = trapData?.ips ?? 0;
    } catch { /* spam trap tables may not exist yet */ }

    // Calculate trust score
    const trustScore = Math.max(0, 100 - threatCount * 2);
    const grade = trustScore >= 90 ? "A" : trustScore >= 80 ? "B" : trustScore >= 70 ? "C" : trustScore >= 60 ? "D" : "F";

    // Generate assessment text (AI if available, else rule-based)
    let assessmentText = "";
    setHaikuCategory("on_demand");
    const aiResult = await callHaikuRaw(
      env,
      "You are a cybersecurity analyst. Write a brief 2-3 sentence threat assessment. Be specific and actionable. Do not mention Averrow by name.",
      `Summarize the threat landscape for the brand ${brandName} (${domain}): ${threatCount} threats found, ${providerCount} hosting providers involved, ${campaignCount} campaigns detected.${isMonitored ? " This brand is actively monitored." : ""}${spamTrapCount > 0 ? ` Our trap network intercepted ${spamTrapCount} spoofed emails impersonating this domain from ${spamTrapIps} unique IPs in the last 30 days.` : ""}`,
    );
    if (aiResult.success && aiResult.text) {
      assessmentText = aiResult.text;
    } else {
      if (threatCount === 0) {
        assessmentText = `No active threats were detected targeting ${brandName}. This is a positive signal, but continuous monitoring is recommended as new phishing domains and impersonation attacks emerge daily.`;
      } else if (threatCount < 10) {
        assessmentText = `${brandName} has ${threatCount} known threats across ${providerCount} hosting provider(s). This represents a moderate exposure level that warrants active monitoring and takedown coordination.`;
      } else {
        assessmentText = `${brandName} faces significant exposure with ${threatCount} active threats across ${providerCount} provider(s) and ${campaignCount} campaign(s). Immediate action is recommended to protect customers and brand reputation.`;
      }
    }

    // Store assessment
    const assessmentId = `assess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await env.DB.prepare(
      `INSERT INTO assessments (id, domain, trust_score, grade, summary_text, threat_intel_results, ip_address, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      assessmentId, domain, trustScore, grade, assessmentText,
      JSON.stringify({ threat_count: threatCount, provider_count: providerCount, campaign_count: campaignCount, threat_types: threatTypes }),
      ip,
    ).run();

    // ─── Auto-add brand if it doesn't exist (from public assessment) ───
    try {
      const existingBrand = await env.DB.prepare(
        "SELECT id FROM brands WHERE canonical_domain = ?"
      ).bind(domain).first<{ id: string }>();
      if (!existingBrand) {
        const brandId = `brand_${domain.replace(/[^a-z0-9]+/g, "_")}`;
        await env.DB.prepare(
          `INSERT OR IGNORE INTO brands (id, name, canonical_domain, source, first_seen, threat_count)
           VALUES (?, ?, ?, 'public_assess', datetime('now'), 0)`
        ).bind(brandId, brandName, domain).run();
      }
    } catch { /* non-fatal — brand creation is best-effort */ }

    return json({
      success: true,
      data: {
        assessment_id: assessmentId,
        domain,
        brand_name: monitoredBrand?.name ?? brandName,
        trust_score: trustScore,
        grade,
        threat_count: threatCount,
        provider_count: providerCount,
        campaign_count: campaignCount,
        threat_types: threatTypes,
        is_monitored: isMonitored,
        assessment_text: assessmentText,
        spam_trap: spamTrapCount > 0 ? { emails_caught: spamTrapCount, unique_ips: spamTrapIps } : null,
        assessed_at: new Date().toISOString(),
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── POST /api/v1/public/leads ───────────────────────────────────

const FREEMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "protonmail.com", "aol.com", "mail.com", "yandex.com", "live.com",
]);

export async function handlePublicLeadCapture(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Rate limit
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
    const rateLimitKey = `pub_lead_${ip}`;
    const currentCount = parseInt(await env.CACHE.get(rateLimitKey) || "0", 10);
    if (currentCount >= 5) {
      return json({ success: false, error: "Rate limit exceeded." }, 429, origin);
    }
    await env.CACHE.put(rateLimitKey, String(currentCount + 1), { expirationTtl: 3600 });

    const body = await request.json().catch(() => null) as {
      email?: string; name?: string; company?: string; role?: string;
      domain?: string; trust_score?: number; grade?: string; assessment_id?: string;
    } | null;

    if (!body?.email || !body?.name || !body?.company) {
      return json({ success: false, error: "Email, name, and company are required" }, 400, origin);
    }

    // Validate business email
    const emailDomain = body.email.split("@")[1]?.toLowerCase();
    if (!emailDomain || FREEMAIL_DOMAINS.has(emailDomain)) {
      return json({ success: false, error: "Please use your business email address" }, 400, origin);
    }

    const assessmentId = body.assessment_id || `assess_placeholder_${Date.now()}`;
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // If no real assessment, create a placeholder
    if (!body.assessment_id) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO assessments (id, domain, trust_score, grade, ip_address) VALUES (?, ?, ?, ?, ?)`
      ).bind(assessmentId, body.domain || "", body.trust_score ?? 0, body.grade || "?", ip).run();
    }

    await env.DB.prepare(
      `INSERT INTO leads (id, assessment_id, name, email, company, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(leadId, assessmentId, body.name, body.email, body.company, body.role ? `Role: ${body.role}` : null).run();

    return json({ success: true, data: { lead_id: leadId } }, 201, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ─── POST /api/v1/public/monitor ────────────────────────────────
// Customer self-service: submit a domain for monitoring (creates brand + optional monitor)

export async function handlePublicMonitor(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    // Rate limit: 5 per IP per hour
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
    const rateLimitKey = `pub_monitor_${ip}`;
    const currentCount = parseInt(await env.CACHE.get(rateLimitKey) || "0", 10);
    if (currentCount >= 5) {
      return json({ success: false, error: "Rate limit exceeded. Please try again in an hour." }, 429, origin);
    }
    await env.CACHE.put(rateLimitKey, String(currentCount + 1), { expirationTtl: 3600 });

    const body = await request.json().catch(() => null) as {
      domain?: string;
      email?: string;
      company?: string;
    } | null;

    if (!body?.domain) return json({ success: false, error: "domain required" }, 400, origin);

    const domain = body.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
    if (!domain || !domain.includes(".") || domain.includes("@")) {
      return json({ success: false, error: "Please enter a valid domain" }, 400, origin);
    }

    const keyword = domain.split(".")[0]!;
    const brandName = keyword.charAt(0).toUpperCase() + keyword.slice(1);

    // Find or create brand
    let brand = await env.DB.prepare(
      "SELECT id FROM brands WHERE canonical_domain = ?"
    ).bind(domain).first<{ id: string }>();

    if (!brand) {
      const brandId = `brand_${domain.replace(/[^a-z0-9]+/g, "_")}`;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO brands (id, name, canonical_domain, source, first_seen, threat_count)
         VALUES (?, ?, ?, 'self_service', datetime('now'), 0)`
      ).bind(brandId, brandName, domain).run();
      brand = { id: brandId };
    }

    // Auto-add to monitored_brands
    await env.DB.prepare(
      `INSERT OR IGNORE INTO monitored_brands (brand_id, tenant_id, added_by, notes, status)
       VALUES (?, '__internal__', 'self_service', ?, 'active')`
    ).bind(brand.id, body.email ? `Self-service by ${body.email}` : "Self-service submission").run();

    // Count existing threats
    const threatCount = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM threats
       WHERE malicious_url LIKE ? OR malicious_domain LIKE ?`
    ).bind(`%${keyword}%`, `%${keyword}%`).first<{ n: number }>();

    // Store lead if email provided
    if (body.email && body.company) {
      const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const assessmentId = `assess_monitor_${Date.now()}`;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO assessments (id, domain, trust_score, grade, ip_address) VALUES (?, ?, 0, '?', ?)`
      ).bind(assessmentId, domain, ip).run();
      await env.DB.prepare(
        `INSERT INTO leads (id, assessment_id, name, email, company, notes)
         VALUES (?, ?, ?, ?, ?, 'Self-service monitor request')`
      ).bind(leadId, assessmentId, body.company, body.email, body.company).run();
    }

    return json({
      success: true,
      data: {
        brand_id: brand.id,
        domain,
        brand_name: brandName,
        existing_threats: threatCount?.n ?? 0,
        monitoring: true,
        message: `${brandName} is now being monitored. We'll detect threats targeting this domain.`,
      },
    }, 201, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
