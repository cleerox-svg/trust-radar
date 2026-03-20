/**
 * Prospector Agent — Sales intelligence & lead generation pipeline.
 *
 * Three-stage pipeline:
 *   1. Identify prospects by scoring brands from platform data
 *   2. Research company & security leadership via Haiku + web search
 *   3. Generate personalized outreach drafts
 *
 * Runs weekly. Processes max 5 prospects per run.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import type { Env } from "../types";

// ─── Types ──────────────────────────────────────────────────────

interface ProspectCandidate {
  brand_id: string;
  brand_name: string;
  brand_domain: string;
  prospect_score: number;
  score_breakdown: Record<string, number>;
  email_security_grade: string | null;
  threat_count_30d: number;
  phishing_urls_active: number;
  trap_catches_30d: number;
  composite_risk_score: number | null;
  pitch_angle: string;
  findings_summary: string;
}

interface ProspectResearch {
  company_name: string;
  company_domain: string;
  company_industry: string | null;
  company_size: string | null;
  company_revenue_range: string | null;
  company_hq: string | null;
  target_name: string | null;
  target_title: string | null;
  target_linkedin: string | null;
  target_email: string | null;
  security_maturity: string | null;
  compliance_frameworks: string[];
  recent_security_news: string | null;
  hiring_security: boolean;
  research_confidence: string;
  raw_research: string;
}

interface OutreachDrafts {
  variant_1_subject: string;
  variant_1_body: string;
  variant_2_subject: string;
  variant_2_body: string;
}

interface SalesLead {
  id: number;
  brand_id: string;
  company_name: string | null;
  company_domain: string | null;
  company_industry: string | null;
  company_size: string | null;
  email_security_grade: string | null;
  threat_count_30d: number | null;
  phishing_urls_active: number | null;
  trap_catches_30d: number | null;
  composite_risk_score: number | null;
  pitch_angle: string | null;
  findings_summary: string | null;
  target_name: string | null;
  target_title: string | null;
  research_json: string | null;
}

// ─── Scoring weights ────────────────────────────────────────────

const SCORING = {
  email_grade_f_or_d: 30,
  email_grade_c: 15,
  dmarc_none_or_missing: 20,
  active_phishing_urls: 25,
  spam_trap_catches: 20,
  high_risk_score: 15,
  ai_phishing_detected: 10,
  tranco_top_10k: 10,
  multiple_campaigns: 15,
  recent_risk_spike: 10,
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_PROSPECTS_PER_RUN = 5;
const MAX_IDENTIFIED = 20;
const MIN_SCORE = 50;

// ─── Haiku API helpers ──────────────────────────────────────────

async function callHaikuJSON<T>(
  env: Env,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024,
  tools?: unknown[],
): Promise<{ success: boolean; data?: T; error?: string; tokens_used?: number }> {
  const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
  if (!apiKey || apiKey.startsWith("lrx_")) {
    return { success: false, error: "No valid Anthropic API key" };
  }

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };
  if (tools) body.tools = tools;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    const apiResponse = await res.json() as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const textBlock = apiResponse.content.find((b) => b.type === "text");
    if (!textBlock?.text) {
      return { success: false, error: "No text content in response" };
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "No JSON in response" };
    }

    const parsed = JSON.parse(jsonMatch[0]) as T;
    return {
      success: true,
      data: parsed,
      tokens_used: apiResponse.usage.input_tokens + apiResponse.usage.output_tokens,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Stage 1: Prospect Identification ───────────────────────────

async function identifyProspects(db: D1Database): Promise<ProspectCandidate[]> {
  // Get brands with their latest email security grade
  const emailGrades = await db.prepare(`
    SELECT b.id as brand_id, b.name as brand_name, b.canonical_domain as brand_domain,
           b.tranco_rank,
           ess.email_security_grade, ess.dmarc_policy
    FROM brands b
    LEFT JOIN email_security_scans ess ON ess.brand_id = b.id
      AND ess.id = (SELECT id FROM email_security_scans WHERE brand_id = b.id ORDER BY scanned_at DESC LIMIT 1)
    WHERE b.id NOT IN (SELECT brand_id FROM org_brands)
      AND b.id NOT IN (
        SELECT brand_id FROM sales_leads
        WHERE status IN ('sent', 'responded', 'meeting_booked', 'converted', 'declined')
           OR created_at > datetime('now', '-90 days')
      )
  `).all<{
    brand_id: string; brand_name: string; brand_domain: string;
    tranco_rank: number | null; email_security_grade: string | null; dmarc_policy: string | null;
  }>();

  if (!emailGrades.results.length) return [];

  // Threat counts per brand (last 30 days)
  const threatCounts = await db.prepare(`
    SELECT target_brand_id as brand_id,
           COUNT(*) as threat_count,
           SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) as phishing_count
    FROM threats
    WHERE created_at >= datetime('now', '-30 days')
      AND target_brand_id IS NOT NULL
    GROUP BY target_brand_id
  `).all<{ brand_id: string; threat_count: number; phishing_count: number }>();
  const threatMap = new Map(threatCounts.results.map(r => [r.brand_id, r]));

  // Phishing URL signals (last 30 days)
  const phishingSignals = await db.prepare(`
    SELECT brand_id, COUNT(*) as signal_count
    FROM threat_signals
    WHERE signal_type = 'phishing_url'
      AND created_at >= datetime('now', '-30 days')
      AND brand_id IS NOT NULL
    GROUP BY brand_id
  `).all<{ brand_id: string; signal_count: number }>();
  const phishMap = new Map(phishingSignals.results.map(r => [r.brand_id, r.signal_count]));

  // Spam trap catches (last 30 days)
  const trapCatches = await db.prepare(`
    SELECT brand_id, COUNT(*) as catch_count
    FROM spam_trap_captures
    WHERE captured_at >= datetime('now', '-30 days')
      AND brand_id IS NOT NULL
    GROUP BY brand_id
  `).all<{ brand_id: string; catch_count: number }>();
  const trapMap = new Map(trapCatches.results.map(r => [r.brand_id, r.catch_count]));

  // Risk scores
  const riskScores = await db.prepare(`
    SELECT brand_id, composite_risk_score
    FROM brand_threat_assessments
    WHERE id IN (
      SELECT id FROM brand_threat_assessments bta2
      WHERE bta2.brand_id = brand_threat_assessments.brand_id
      ORDER BY bta2.assessed_at DESC LIMIT 1
    )
  `).all<{ brand_id: string; composite_risk_score: number }>();
  const riskMap = new Map(riskScores.results.map(r => [r.brand_id, r.composite_risk_score]));

  // Previous risk scores (for spike detection)
  const prevRiskScores = await db.prepare(`
    SELECT brand_id, composite_risk_score
    FROM brand_threat_assessments
    WHERE id IN (
      SELECT id FROM brand_threat_assessments bta2
      WHERE bta2.brand_id = brand_threat_assessments.brand_id
      ORDER BY bta2.assessed_at DESC LIMIT 1 OFFSET 1
    )
  `).all<{ brand_id: string; composite_risk_score: number }>();
  const prevRiskMap = new Map(prevRiskScores.results.map(r => [r.brand_id, r.composite_risk_score]));

  // AI phishing detection
  const aiPhishing = await db.prepare(`
    SELECT brand_id, COUNT(*) as ai_count
    FROM phishing_pattern_signals
    WHERE ai_generated_probability > 0.7
      AND created_at >= datetime('now', '-30 days')
      AND brand_id IS NOT NULL
    GROUP BY brand_id
  `).all<{ brand_id: string; ai_count: number }>();
  const aiMap = new Map(aiPhishing.results.map(r => [r.brand_id, r.ai_count]));

  // Distinct campaigns per brand (last 30 days)
  const campaignCounts = await db.prepare(`
    SELECT target_brand_id as brand_id, COUNT(DISTINCT campaign_id) as campaign_count
    FROM threats
    WHERE created_at >= datetime('now', '-30 days')
      AND target_brand_id IS NOT NULL
      AND campaign_id IS NOT NULL
    GROUP BY target_brand_id
  `).all<{ brand_id: string; campaign_count: number }>();
  const campaignMap = new Map(campaignCounts.results.map(r => [r.brand_id, r.campaign_count]));

  // Score each brand
  const candidates: ProspectCandidate[] = [];

  for (const brand of emailGrades.results) {
    const breakdown: Record<string, number> = {};
    let score = 0;

    // Email grade scoring
    const grade = brand.email_security_grade?.toUpperCase();
    if (grade === 'F' || grade === 'D') {
      breakdown.email_grade_f_or_d = SCORING.email_grade_f_or_d;
      score += SCORING.email_grade_f_or_d;
    } else if (grade === 'C') {
      breakdown.email_grade_c = SCORING.email_grade_c;
      score += SCORING.email_grade_c;
    }

    // DMARC
    const dmarc = brand.dmarc_policy?.toLowerCase();
    if (!dmarc || dmarc === 'none') {
      breakdown.dmarc_none_or_missing = SCORING.dmarc_none_or_missing;
      score += SCORING.dmarc_none_or_missing;
    }

    // Active phishing URLs
    const phishCount = phishMap.get(brand.brand_id) ?? 0;
    if (phishCount > 0) {
      breakdown.active_phishing_urls = SCORING.active_phishing_urls;
      score += SCORING.active_phishing_urls;
    }

    // Spam trap catches
    const trapCount = trapMap.get(brand.brand_id) ?? 0;
    if (trapCount > 0) {
      breakdown.spam_trap_catches = SCORING.spam_trap_catches;
      score += SCORING.spam_trap_catches;
    }

    // High risk score
    const riskScore = riskMap.get(brand.brand_id);
    if (riskScore && riskScore > 60) {
      breakdown.high_risk_score = SCORING.high_risk_score;
      score += SCORING.high_risk_score;
    }

    // AI phishing
    const aiCount = aiMap.get(brand.brand_id) ?? 0;
    if (aiCount > 0) {
      breakdown.ai_phishing_detected = SCORING.ai_phishing_detected;
      score += SCORING.ai_phishing_detected;
    }

    // Tranco top 10k
    if (brand.tranco_rank && brand.tranco_rank <= 10000) {
      breakdown.tranco_top_10k = SCORING.tranco_top_10k;
      score += SCORING.tranco_top_10k;
    }

    // Multiple campaigns
    const campCount = campaignMap.get(brand.brand_id) ?? 0;
    if (campCount >= 3) {
      breakdown.multiple_campaigns = SCORING.multiple_campaigns;
      score += SCORING.multiple_campaigns;
    }

    // Risk spike
    const prevScore = prevRiskMap.get(brand.brand_id);
    if (riskScore && prevScore && riskScore - prevScore >= 20) {
      breakdown.recent_risk_spike = SCORING.recent_risk_spike;
      score += SCORING.recent_risk_spike;
    }

    if (score < MIN_SCORE) continue;

    // Determine pitch angle
    const hasPhishing = phishCount > 0;
    const hasTrap = trapCount > 0;
    const hasBadEmail = grade === 'F' || grade === 'D';
    const hasDmarcNone = !dmarc || dmarc === 'none';
    const hasAI = aiCount > 0;
    const hasMultiCampaign = campCount >= 3;

    let pitchAngle = 'brand_protection';
    if (hasBadEmail && hasPhishing) pitchAngle = 'urgent_exposure';
    else if (hasPhishing && hasTrap) pitchAngle = 'active_attack';
    else if (hasBadEmail && hasDmarcNone) pitchAngle = 'email_security';
    else if (hasAI) pitchAngle = 'ai_threat';
    else if (hasMultiCampaign) pitchAngle = 'campaign_targeting';

    const threatData = threatMap.get(brand.brand_id);

    candidates.push({
      brand_id: brand.brand_id,
      brand_name: brand.brand_name,
      brand_domain: brand.brand_domain,
      prospect_score: score,
      score_breakdown: breakdown,
      email_security_grade: brand.email_security_grade,
      threat_count_30d: threatData?.threat_count ?? 0,
      phishing_urls_active: phishCount,
      trap_catches_30d: trapCount,
      composite_risk_score: riskScore ?? null,
      pitch_angle: pitchAngle,
      findings_summary: "", // Generated by Haiku below
    });
  }

  // Sort by score descending, take top 20
  candidates.sort((a, b) => b.prospect_score - a.prospect_score);
  return candidates.slice(0, MAX_IDENTIFIED);
}

// ─── Generate findings summary via Haiku ────────────────────────

async function generateFindingsSummary(
  env: Env,
  candidate: ProspectCandidate,
): Promise<string> {
  const result = await callHaikuJSON<{ summary: string }>(
    env,
    `You are a concise threat intelligence writer. Write a 2-3 sentence factual summary of security findings for a brand. Reference specific numbers. Output JSON: {"summary": "..."}`,
    `Brand: ${candidate.brand_name} (${candidate.brand_domain})
Email security grade: ${candidate.email_security_grade || 'Not scanned'}
Active phishing URLs detected (30d): ${candidate.phishing_urls_active}
Spam trap catches (brand impersonation, 30d): ${candidate.trap_catches_30d}
Total threats (30d): ${candidate.threat_count_30d}
Composite risk score: ${candidate.composite_risk_score ?? 'N/A'}/100
Pitch angle: ${candidate.pitch_angle}`,
    256,
  );

  return result.data?.summary ?? `Trust Radar detected ${candidate.threat_count_30d} threats targeting ${candidate.brand_name} in the past 30 days, including ${candidate.phishing_urls_active} active phishing URLs. Email security grade: ${candidate.email_security_grade || 'unknown'}.`;
}

// ─── Stage 2: Company & CISO Research ───────────────────────────

async function researchProspect(
  candidate: ProspectCandidate,
  env: Env,
): Promise<ProspectResearch> {
  const systemPrompt = `You are a sales intelligence researcher for Trust Radar, a brand threat intelligence platform that detects phishing, brand impersonation, and email security vulnerabilities.

Research this company to build a sales prospect profile:

Company: ${candidate.brand_name}
Domain: ${candidate.brand_domain}

Find and return as JSON:
1. company_industry: Their primary industry
2. company_size: "startup" (<50), "smb" (50-500), "mid-market" (500-5000), "enterprise" (5000+)
3. company_revenue_range: Approximate annual revenue bracket if findable
4. company_hq: Headquarters city/country
5. target_name: Name of their CISO, VP Security, Head of Security, or Director of InfoSec
6. target_title: Their exact title
7. target_linkedin: LinkedIn profile URL if findable
8. target_email: Work email ONLY if publicly listed (e.g. on company security page, press releases)
9. security_maturity: "high" if they have SOC2/ISO27001/bug bounty, "medium" if they have a security page, "low" if no visible security program
10. compliance_frameworks: Array of frameworks they likely comply with based on industry
11. recent_security_news: Any breaches, incidents, or security announcements in the last 12 months (one sentence summary or null)
12. hiring_security: true if they have open security job postings

IMPORTANT RULES:
- Only include information you can verify from search results
- If you cannot find a field, return null — do NOT fabricate
- For target identification, prioritize: CISO > VP Security > Head of InfoSec > Director of Security
- Do not include personal contact info that isn't publicly available
- Return ONLY valid JSON, no markdown, no explanation`;

  const result = await callHaikuJSON<{
    company_industry?: string | null;
    company_size?: string | null;
    company_revenue_range?: string | null;
    company_hq?: string | null;
    target_name?: string | null;
    target_title?: string | null;
    target_linkedin?: string | null;
    target_email?: string | null;
    security_maturity?: string | null;
    compliance_frameworks?: string[];
    recent_security_news?: string | null;
    hiring_security?: boolean;
  }>(
    env,
    systemPrompt,
    `Research the company "${candidate.brand_name}" (${candidate.brand_domain}) and return the requested JSON profile.`,
    2048,
    [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
  );

  if (!result.success || !result.data) {
    console.error(`[prospector] Research failed for ${candidate.brand_name}:`, result.error);
    return {
      company_name: candidate.brand_name,
      company_domain: candidate.brand_domain,
      company_industry: null,
      company_size: null,
      company_revenue_range: null,
      company_hq: null,
      target_name: null,
      target_title: null,
      target_linkedin: null,
      target_email: null,
      security_maturity: null,
      compliance_frameworks: [],
      recent_security_news: null,
      hiring_security: false,
      research_confidence: "low",
      raw_research: result.error ?? "Research failed",
    };
  }

  const d = result.data;
  return {
    company_name: candidate.brand_name,
    company_domain: candidate.brand_domain,
    company_industry: d.company_industry ?? null,
    company_size: d.company_size ?? null,
    company_revenue_range: d.company_revenue_range ?? null,
    company_hq: d.company_hq ?? null,
    target_name: d.target_name ?? null,
    target_title: d.target_title ?? null,
    target_linkedin: d.target_linkedin ?? null,
    target_email: d.target_email ?? null,
    security_maturity: d.security_maturity ?? null,
    compliance_frameworks: d.compliance_frameworks ?? [],
    recent_security_news: d.recent_security_news ?? null,
    hiring_security: d.hiring_security ?? false,
    research_confidence: d.target_name ? (d.company_industry ? "high" : "medium") : "low",
    raw_research: JSON.stringify(d),
  };
}

// ─── Stage 3: Outreach Generation ───────────────────────────────

async function generateOutreach(
  lead: SalesLead,
  research: ProspectResearch,
  env: Env,
): Promise<OutreachDrafts> {
  const systemPrompt = `You are drafting outreach emails from Trust Radar to a security leader.

RECIPIENT:
Name: ${research.target_name}
Title: ${research.target_title}
Company: ${research.company_name}
Industry: ${research.company_industry ?? 'Unknown'}
Size: ${research.company_size ?? 'Unknown'}

TRUST RADAR FINDINGS (share at HIGH LEVEL only — do not reveal specific URLs, IPs, or detailed IOCs):
${lead.findings_summary}

Email security grade: ${lead.email_security_grade ?? 'Unknown'}
Active phishing URLs detected: ${lead.phishing_urls_active ?? 0}
Spam trap catches (brand impersonation): ${lead.trap_catches_30d ?? 0}
Overall risk score: ${lead.composite_risk_score ?? 'N/A'}/100

${research.recent_security_news ? `Recent security news: ${research.recent_security_news}` : ''}
${research.compliance_frameworks?.length ? `Compliance frameworks: ${research.compliance_frameworks.join(', ')}` : ''}

Generate TWO email variants as JSON with keys: variant_1_subject, variant_1_body, variant_2_subject, variant_2_body.

VARIANT 1 — "Intelligence briefing" angle:
- Lead with a specific finding that would concern a CISO
- Frame as sharing intelligence, not selling
- Offer a 15-minute threat briefing
- Under 150 words body

VARIANT 2 — "Peer benchmark" angle:
- Compare their security posture to industry peers
- Reference specific gaps (email security grade, DMARC)
- Offer a free assessment report
- Under 150 words body

RULES FOR BOTH:
- Professional, direct tone — CISOs have zero patience for fluff
- No buzzwords: no "revolutionary", "cutting-edge", "game-changing", "leverage"
- No exclamation marks
- Reference exactly ONE specific finding to hook interest
- Do NOT reveal exact phishing URLs, IP addresses, or detailed IOCs
- Include a clear call to action (15-min call or briefing)
- Sign off as "Trust Radar Threat Intelligence Team"
- Return ONLY valid JSON, no markdown`;

  const result = await callHaikuJSON<OutreachDrafts>(
    env,
    systemPrompt,
    "Generate the two outreach email variants as described.",
    2048,
  );

  if (!result.success || !result.data) {
    console.error(`[prospector] Outreach generation failed for ${lead.company_name}:`, result.error);
    return {
      variant_1_subject: `Threat Intelligence Briefing: ${lead.company_name}`,
      variant_1_body: "Outreach generation failed — please draft manually.",
      variant_2_subject: `Security Assessment: ${lead.company_name}`,
      variant_2_body: "Outreach generation failed — please draft manually.",
    };
  }

  return result.data;
}

// ─── Database helpers ───────────────────────────────────────────

async function insertLead(db: D1Database, candidate: ProspectCandidate): Promise<number> {
  const result = await db.prepare(`
    INSERT INTO sales_leads (
      brand_id, prospect_score, score_breakdown_json, status,
      company_name, company_domain,
      email_security_grade, threat_count_30d, phishing_urls_active,
      trap_catches_30d, composite_risk_score, pitch_angle, findings_summary,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    candidate.brand_id, candidate.prospect_score, JSON.stringify(candidate.score_breakdown),
    candidate.brand_name, candidate.brand_domain,
    candidate.email_security_grade, candidate.threat_count_30d, candidate.phishing_urls_active,
    candidate.trap_catches_30d, candidate.composite_risk_score, candidate.pitch_angle,
    candidate.findings_summary,
  ).run();

  // Get the inserted ID
  const row = await db.prepare(
    "SELECT id FROM sales_leads WHERE brand_id = ? ORDER BY id DESC LIMIT 1"
  ).bind(candidate.brand_id).first<{ id: number }>();
  return row?.id ?? 0;
}

async function logActivity(
  db: D1Database,
  leadId: number,
  activityType: string,
  details: Record<string, unknown>,
  performedBy = "prospector_agent",
): Promise<void> {
  await db.prepare(`
    INSERT INTO lead_activity_log (lead_id, activity_type, details_json, performed_by, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).bind(leadId, activityType, JSON.stringify(details), performedBy).run();
}

async function updateLeadResearch(
  db: D1Database,
  leadId: number,
  research: ProspectResearch,
): Promise<void> {
  await db.prepare(`
    UPDATE sales_leads SET
      company_industry = ?, company_size = ?, company_revenue_range = ?,
      company_hq = ?, target_name = ?, target_title = ?,
      target_linkedin = ?, target_email = ?,
      research_json = ?, researched_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    research.company_industry, research.company_size, research.company_revenue_range,
    research.company_hq, research.target_name, research.target_title,
    research.target_linkedin, research.target_email,
    research.raw_research, leadId,
  ).run();
}

async function updateLeadOutreach(
  db: D1Database,
  leadId: number,
  outreach: OutreachDrafts,
): Promise<void> {
  await db.prepare(`
    UPDATE sales_leads SET
      outreach_variant_1 = ?, outreach_variant_2 = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    JSON.stringify({ subject: outreach.variant_1_subject, body: outreach.variant_1_body }),
    JSON.stringify({ subject: outreach.variant_2_subject, body: outreach.variant_2_body }),
    leadId,
  ).run();
}

async function updateLeadStatus(db: D1Database, leadId: number, status: string): Promise<void> {
  await db.prepare(
    "UPDATE sales_leads SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(status, leadId).run();
}

async function getLeadById(db: D1Database, leadId: number): Promise<SalesLead | null> {
  return db.prepare("SELECT * FROM sales_leads WHERE id = ?").bind(leadId).first<SalesLead>();
}

// ─── Main pipeline ──────────────────────────────────────────────

export async function runProspectorPipeline(env: Env): Promise<{
  identified: number;
  researched: number;
  outreachDrafted: number;
  errors: number;
}> {
  console.log("[prospector] Starting pipeline");

  // Stage 1: Identify prospects
  const candidates = await identifyProspects(env.DB);
  console.log(`[prospector] Stage 1: ${candidates.length} candidates identified`);

  if (candidates.length === 0) {
    return { identified: 0, researched: 0, outreachDrafted: 0, errors: 0 };
  }

  // Filter out brands already in sales_leads recently
  const existingLeads = await env.DB.prepare(
    "SELECT brand_id FROM sales_leads WHERE created_at > datetime('now', '-90 days')"
  ).all<{ brand_id: string }>();
  const existingSet = new Set(existingLeads.results.map(r => r.brand_id));

  const toProcess = candidates
    .filter(c => !existingSet.has(c.brand_id))
    .slice(0, MAX_PROSPECTS_PER_RUN);

  console.log(`[prospector] Processing ${toProcess.length} new prospects`);

  let researched = 0;
  let outreachDrafted = 0;
  let errors = 0;

  for (const candidate of toProcess) {
    try {
      // Generate findings summary via Haiku
      candidate.findings_summary = await generateFindingsSummary(env, candidate);

      // Insert lead row
      const leadId = await insertLead(env.DB, candidate);
      await logActivity(env.DB, leadId, "identified", candidate.score_breakdown);

      // Stage 2: Research
      const research = await researchProspect(candidate, env);
      await updateLeadResearch(env.DB, leadId, research);
      await logActivity(env.DB, leadId, "researched", { confidence: research.research_confidence });
      researched++;

      // Stage 3: Generate outreach (only if research found a target)
      if (research.target_name) {
        const lead = await getLeadById(env.DB, leadId);
        if (lead) {
          const outreach = await generateOutreach(lead, research, env);
          await updateLeadOutreach(env.DB, leadId, outreach);
          await logActivity(env.DB, leadId, "outreach_generated", { variants: 2 });
          await updateLeadStatus(env.DB, leadId, "outreach_drafted");
          outreachDrafted++;
        }
      } else {
        await updateLeadStatus(env.DB, leadId, "researched");
      }
    } catch (err) {
      console.error(`[prospector] Error processing ${candidate.brand_name}:`, err);
      errors++;
    }
  }

  console.log(`[prospector] Pipeline complete: identified=${candidates.length}, researched=${researched}, outreach=${outreachDrafted}, errors=${errors}`);
  return { identified: candidates.length, researched, outreachDrafted, errors };
}

// ─── Agent Module ───────────────────────────────────────────────

export const prospectorAgent: AgentModule = {
  name: "prospector",
  displayName: "Prospector",
  description: "Sales intelligence & lead generation",
  color: "#F59E0B",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;
    const outputs: AgentOutputEntry[] = [];

    // Check weekly throttle
    const lastRun = await env.CACHE.get("prospector:last_run");
    if (lastRun && Date.now() - parseInt(lastRun) < 7 * 24 * 60 * 60 * 1000) {
      console.log("[prospector] Throttled — last run was", new Date(parseInt(lastRun)).toISOString());
      outputs.push({
        type: "insight",
        summary: "Prospector skipped — last run was less than 7 days ago",
        severity: "info",
        details: { lastRun: new Date(parseInt(lastRun)).toISOString() },
      });
      return {
        itemsProcessed: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        output: { skipped: true, reason: "throttled" },
        agentOutputs: outputs,
      };
    }

    const result = await runProspectorPipeline(env);

    // Update throttle
    await env.CACHE.put("prospector:last_run", Date.now().toString());

    outputs.push({
      type: "insight",
      summary: `Prospector identified ${result.identified} prospects, researched ${result.researched}, drafted outreach for ${result.outreachDrafted}${result.errors > 0 ? `, ${result.errors} errors` : ""}`,
      severity: result.outreachDrafted > 0 ? "medium" : "info",
      details: result,
    });

    return {
      itemsProcessed: result.identified,
      itemsCreated: result.outreachDrafted,
      itemsUpdated: result.researched,
      output: result,
      agentOutputs: outputs,
    };
  },
};
