/**
 * Brand Threat Report — Generates comprehensive report data for a brand.
 * GET /api/brands/:id/report?period=7d|30d|90d
 */

import { json } from "../lib/cors";
import { analyzeWithHaiku, setHaikuCategory } from "../lib/haiku";
import type { Env } from "../types";

interface ReportData {
  reportId: string;
  generatedAt: string;
  period: { label: string; days: number; start: string; end: string };
  brand: { id: string; name: string; canonical_domain: string; logo_url: string };
  executive: {
    trustScore: number;
    riskLevel: string;
    totalThreats: number;
    activeThreats: number;
    remediatedThreats: number;
    countriesInvolved: number;
    campaignsIdentified: number;
    hostingProviders: number;
    aiSummary: string;
  };
  threatBreakdown: {
    byType: Array<{ type: string; count: number }>;
    bySeverity: Array<{ severity: string; count: number }>;
    topThreats: Array<{
      id: string; malicious_url: string | null; malicious_domain: string | null;
      threat_type: string; severity: string; status: string; first_seen: string;
    }>;
  };
  campaigns: Array<{
    id: string; name: string; status: string;
    threat_count: number; first_seen: string; last_seen: string;
  }>;
  infrastructure: {
    providers: Array<{ name: string; threat_count: number; active_count: number }>;
    countries: Array<{ country_code: string; count: number }>;
    asns: Array<{ asn: string; count: number }>;
  };
  timeline: Array<{ period: string; count: number; phishing: number; typosquatting: number; malware: number }>;
  recommendations: string[];
}

export async function handleBrandReport(request: Request, env: Env, brandId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period") ?? "30d";
    const days = periodParam === "7d" ? 7 : periodParam === "90d" ? 90 : 30;
    const since = `datetime('now', '-${days} days')`;

    // ─── Brand info ───────────────────────────────────────────
    const brand = await env.DB.prepare(
      "SELECT id, name, canonical_domain FROM brands WHERE id = ?"
    ).bind(brandId).first<{ id: string; name: string; canonical_domain: string }>();
    if (!brand) return json({ success: false, error: "Brand not found" }, 404, origin);

    // ─── Gather all data in parallel ──────────────────────────
    const [
      statsRow, severityRows, typeRows, activeRow, remediatedRow,
      countryRows, campaignRows, providerRows, asnRows,
      topThreats, timelineRows,
    ] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) AS total FROM threats
        WHERE target_brand_id = ? AND created_at >= ${since}
      `).bind(brandId).first<{ total: number }>(),

      env.DB.prepare(`
        SELECT COALESCE(severity, 'info') AS severity, COUNT(*) AS count FROM threats
        WHERE target_brand_id = ? AND created_at >= ${since}
        GROUP BY severity ORDER BY count DESC
      `).bind(brandId).all<{ severity: string; count: number }>(),

      env.DB.prepare(`
        SELECT threat_type AS type, COUNT(*) AS count FROM threats
        WHERE target_brand_id = ? AND created_at >= ${since}
        GROUP BY threat_type ORDER BY count DESC
      `).bind(brandId).all<{ type: string; count: number }>(),

      env.DB.prepare(`
        SELECT COUNT(*) AS n FROM threats
        WHERE target_brand_id = ? AND status = 'active' AND created_at >= ${since}
      `).bind(brandId).first<{ n: number }>(),

      env.DB.prepare(`
        SELECT COUNT(*) AS n FROM threats
        WHERE target_brand_id = ? AND status = 'remediated' AND created_at >= ${since}
      `).bind(brandId).first<{ n: number }>(),

      env.DB.prepare(`
        SELECT country_code, COUNT(*) AS count FROM threats
        WHERE target_brand_id = ? AND country_code IS NOT NULL AND country_code NOT IN ('XX','PRIV')
          AND created_at >= ${since}
        GROUP BY country_code ORDER BY count DESC LIMIT 15
      `).bind(brandId).all<{ country_code: string; count: number }>(),

      env.DB.prepare(`
        SELECT DISTINCT c.id, c.name, c.status, c.threat_count, c.first_seen, c.last_seen
        FROM campaigns c JOIN threats t ON t.campaign_id = c.id
        WHERE t.target_brand_id = ? ORDER BY c.last_seen DESC LIMIT 10
      `).bind(brandId).all<{ id: string; name: string; status: string; threat_count: number; first_seen: string; last_seen: string }>(),

      env.DB.prepare(`
        SELECT COALESCE(hp.name, t.hosting_provider_id) AS name,
               COUNT(*) AS threat_count,
               SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) AS active_count
        FROM threats t LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
        WHERE t.target_brand_id = ? AND t.hosting_provider_id IS NOT NULL AND t.created_at >= ${since}
        GROUP BY t.hosting_provider_id ORDER BY threat_count DESC LIMIT 15
      `).bind(brandId).all<{ name: string; threat_count: number; active_count: number }>(),

      env.DB.prepare(`
        SELECT asn, COUNT(*) AS count FROM threats
        WHERE target_brand_id = ? AND asn IS NOT NULL AND created_at >= ${since}
        GROUP BY asn ORDER BY count DESC LIMIT 10
      `).bind(brandId).all<{ asn: string; count: number }>(),

      env.DB.prepare(`
        SELECT id, malicious_url, malicious_domain, threat_type, severity, status, first_seen
        FROM threats WHERE target_brand_id = ? AND created_at >= ${since}
        ORDER BY created_at DESC LIMIT 10
      `).bind(brandId).all<{ id: string; malicious_url: string | null; malicious_domain: string | null; threat_type: string; severity: string; status: string; first_seen: string }>(),

      env.DB.prepare(`
        SELECT date(created_at) AS period, COUNT(*) AS count,
               SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) AS phishing,
               SUM(CASE WHEN threat_type = 'typosquatting' THEN 1 ELSE 0 END) AS typosquatting,
               SUM(CASE WHEN threat_type IN ('malware_distribution','c2') THEN 1 ELSE 0 END) AS malware
        FROM threats WHERE target_brand_id = ? AND created_at >= ${since}
        GROUP BY date(created_at) ORDER BY period ASC
      `).bind(brandId).all<{ period: string; count: number; phishing: number; typosquatting: number; malware: number }>(),
    ]);

    const totalThreats = statsRow?.total ?? 0;
    const activeThreats = activeRow?.n ?? 0;
    const remediatedThreats = remediatedRow?.n ?? 0;
    const countriesInvolved = countryRows.results.length;
    const campaignsIdentified = campaignRows.results.length;
    const hostingProviders = providerRows.results.length;

    // Trust score: 100 - penalties
    let trustScore = 100;
    for (const s of severityRows.results) {
      if (s.severity === "critical") trustScore -= s.count * 8;
      else if (s.severity === "high") trustScore -= s.count * 4;
      else if (s.severity === "medium") trustScore -= s.count * 2;
      else trustScore -= s.count * 1;
    }
    trustScore += remediatedThreats * 2;
    trustScore = Math.max(0, Math.min(100, trustScore));

    const riskLevel = trustScore >= 80 ? "Low" : trustScore >= 60 ? "Medium" : trustScore >= 40 ? "High" : "Critical";

    // ─── AI-generated content ─────────────────────────────────
    const typeBreakdown = typeRows.results.map(r => `${r.type}: ${r.count}`).join(", ");

    let aiSummary = `${brand.name} faced ${totalThreats} threats over the past ${days} days. ${activeThreats} remain active. Primary threat types: ${typeBreakdown || "none detected"}.`;
    let recommendations = [
      "Monitor for new typosquatting domains daily",
      "Consider DMARC enforcement to prevent email spoofing",
      "Report phishing URLs to registrars for takedown",
      "Implement brand monitoring across social media",
    ];

    // Try AI generation (non-blocking — use defaults on failure)
    try {
      setHaikuCategory("on_demand");
      const [summaryResult, recsResult] = await Promise.all([
        analyzeWithHaiku(env,
          `You are a threat intelligence analyst writing an executive summary for a brand protection report. The brand is ${brand.name}. In the last ${days} days, ${totalThreats} threats were detected: ${typeBreakdown}. ${campaignsIdentified} campaigns were identified. ${remediatedThreats} threats were remediated. Write exactly 3 sentences summarizing the threat landscape, key risks, and trend direction. Be specific and data-driven. Return JSON: {"response": "your 3 sentences"}`,
          { brand: brand.name, threats: totalThreats, types: typeRows.results },
        ),
        analyzeWithHaiku(env,
          `Based on the following threat data for ${brand.name}: threat types: ${typeBreakdown}, campaigns: ${campaignRows.results.map(c => c.name).join(", ") || "none"}, top providers: ${providerRows.results.map(p => p.name).join(", ") || "none"}. Generate 4 specific, actionable recommendations for the brand's security team. Be concise — one sentence each. Return JSON: {"response": "rec1\\nrec2\\nrec3\\nrec4"}`,
          { brand: brand.name, types: typeRows.results, providers: providerRows.results.map(p => p.name) },
        ),
      ]);

      if (summaryResult.success && summaryResult.data?.response) {
        aiSummary = summaryResult.data.response;
      }
      if (recsResult.success && recsResult.data?.response) {
        const parsed = recsResult.data.response.split("\n").filter(Boolean);
        if (parsed.length >= 2) recommendations = parsed;
      }
    } catch {
      // Non-fatal — use defaults
    }

    // ─── Build period info ────────────────────────────────────
    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);
    const periodLabel = `${start.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

    const report: ReportData = {
      reportId: `RPT-${brandId.slice(0, 8)}-${Date.now().toString(36)}`,
      generatedAt: now.toISOString(),
      period: { label: periodLabel, days, start: start.toISOString(), end: now.toISOString() },
      brand: {
        id: brand.id,
        name: brand.name,
        canonical_domain: brand.canonical_domain,
        logo_url: `https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=128`,
      },
      executive: {
        trustScore, riskLevel, totalThreats, activeThreats, remediatedThreats,
        countriesInvolved, campaignsIdentified, hostingProviders, aiSummary,
      },
      threatBreakdown: {
        byType: typeRows.results,
        bySeverity: severityRows.results,
        topThreats: topThreats.results,
      },
      campaigns: campaignRows.results,
      infrastructure: {
        providers: providerRows.results,
        countries: countryRows.results,
        asns: asnRows.results,
      },
      timeline: timelineRows.results,
      recommendations,
    };

    return json({ success: true, data: report }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
