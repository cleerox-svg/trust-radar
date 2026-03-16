/**
 * Trust Radar — Public API Endpoints (no auth required)
 * All endpoints rate-limited. No sensitive data exposed.
 */

import { json } from "../lib/cors";
import { setHaikuCategory, callHaikuRaw } from "../lib/haiku";
import type { Env } from "../types";

// ─── GET /api/v1/public/stats ────────────────────────────────────

export async function handlePublicStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const [threats, brands, providers, campaigns, certsToday, classifiedToday, latestInsight] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE status = 'active' OR status IS NULL").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) as n FROM brands").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(DISTINCT hosting_provider_id) as n FROM threats WHERE hosting_provider_id IS NOT NULL").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) as n FROM campaigns").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE created_at >= date('now')").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE confidence_score IS NOT NULL AND created_at >= date('now')").first<{ n: number }>(),
      env.DB.prepare("SELECT summary FROM agent_outputs WHERE agent_id = 'observer' ORDER BY created_at DESC LIMIT 1").first<{ summary: string }>(),
    ]);

    return json({
      success: true,
      data: {
        active_threats: threats?.n ?? 0,
        brands_tracked: brands?.n ?? 0,
        providers_mapped: providers?.n ?? 0,
        threat_campaigns: campaigns?.n ?? 0,
        certificates_today: certsToday?.n ?? 0,
        threats_classified_today: classifiedToday?.n ?? 0,
        latest_insight_summary: latestInsight?.summary?.slice(0, 80) ?? "",
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

    // Query threats matching this keyword
    const [threatResult, providerResult, campaignResult] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) as threat_count FROM threats
         WHERE malicious_url LIKE ? OR malicious_domain LIKE ?`
      ).bind(`%${keyword}%`, `%${keyword}%`).first<{ threat_count: number }>(),
      env.DB.prepare(
        `SELECT COUNT(DISTINCT hosting_provider_id) as provider_count FROM threats
         WHERE (malicious_url LIKE ? OR malicious_domain LIKE ?) AND hosting_provider_id IS NOT NULL`
      ).bind(`%${keyword}%`, `%${keyword}%`).first<{ provider_count: number }>(),
      env.DB.prepare(
        `SELECT COUNT(DISTINCT id) as campaign_count FROM campaigns
         WHERE name LIKE ? OR id IN (
           SELECT DISTINCT campaign_id FROM threats
           WHERE campaign_id IS NOT NULL AND (malicious_url LIKE ? OR malicious_domain LIKE ?)
         )`
      ).bind(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`).first<{ campaign_count: number }>(),
    ]);

    const threatCount = threatResult?.threat_count ?? 0;
    const providerCount = providerResult?.provider_count ?? 0;
    const campaignCount = campaignResult?.campaign_count ?? 0;

    // Calculate trust score
    const trustScore = Math.max(0, 100 - threatCount * 2);
    const grade = trustScore >= 90 ? "A" : trustScore >= 80 ? "B" : trustScore >= 70 ? "C" : trustScore >= 60 ? "D" : "F";

    // Generate assessment text (AI if available, else rule-based)
    let assessmentText = "";
    setHaikuCategory("on_demand");
    const aiResult = await callHaikuRaw(
      env,
      "You are a cybersecurity analyst. Write a brief 2-3 sentence threat assessment. Be specific and actionable. Do not mention Trust Radar by name.",
      `Summarize the threat landscape for the brand ${brandName} (${domain}): ${threatCount} threats found, ${providerCount} hosting providers involved, ${campaignCount} campaigns detected.`,
    );
    if (aiResult.success && aiResult.text) {
      assessmentText = aiResult.text;
    } else {
      // Rule-based fallback
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
      JSON.stringify({ threat_count: threatCount, provider_count: providerCount, campaign_count: campaignCount }),
      ip,
    ).run();

    return json({
      success: true,
      data: {
        assessment_id: assessmentId,
        domain,
        brand_name: brandName,
        trust_score: trustScore,
        grade,
        threat_count: threatCount,
        provider_count: providerCount,
        campaign_count: campaignCount,
        assessment_text: assessmentText,
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
