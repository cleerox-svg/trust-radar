/**
 * Pathfinder (Prospector) Agent — Sales intelligence & lead generation pipeline.
 *
 * Two-phase architecture to prevent Worker timeouts:
 *
 *   Phase 1 — identifyAndCreate():
 *     Score brands from platform data, insert qualified leads immediately.
 *     No AI calls. Completes in < 10s for 10+ brands.
 *
 *   Phase 2 — enrichLeadWithAI():
 *     Pick up ONE unenriched lead, call Haiku for summary + outreach + research,
 *     then mark it enriched. Separate execution, 25s timeout guard.
 *
 * The main run() calls both phases on every cron tick, so leads are created fast
 * and enriched incrementally over subsequent runs.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import type { Env } from "../types";
import { getBrandSocialIntel } from "../lib/social-intel";

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

interface UnenrichedLead {
  id: number;
  brand_id: string;
  company_name: string | null;
  company_domain: string | null;
  email_security_grade: string | null;
  threat_count_30d: number | null;
  phishing_urls_active: number | null;
  trap_catches_30d: number | null;
  composite_risk_score: number | null;
  pitch_angle: string | null;
  findings_summary: string | null;
  prospect_score: number | null;
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
  social_impersonation: 15,
  social_high_risk: 10,
  social_takedown_needed: 10,
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_IDENTIFIED = 20;
const MIN_SCORE = 20;
const AI_TIMEOUT_MS = 25000;

// ─── Haiku API helper ────────────────────────────────────────────

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

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
    clearTimeout(timer);
    return { success: false, error: String(err) };
  }
}

// ─── Phase 1: Identify & Create ─────────────────────────────────

export async function identifyAndCreate(env: Env): Promise<{
  candidates_found: number;
  leads_created: number;
  errors: number;
}> {
  // Get brands with their latest email security grade, excluding already-monitored
  // orgs and leads created in the last 90 days
  let emailGrades: { results: Array<{
    brand_id: string; brand_name: string; brand_domain: string;
    tranco_rank: number | null; email_security_grade: string | null; dmarc_policy: string | null;
  }> };

  try {
    emailGrades = await env.DB.prepare(`
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
             OR created_at > datetime('now', '-30 days')
        )
    `).all<{
      brand_id: string; brand_name: string; brand_domain: string;
      tranco_rank: number | null; email_security_grade: string | null; dmarc_policy: string | null;
    }>();
  } catch (err) {
    throw err;
  }

  if (!emailGrades.results.length) {
    return { candidates_found: 0, leads_created: 0, errors: 0 };
  }

  // Parallel lookups for scoring signals
  const [threatCounts, phishingSignals, trapCatches, riskScores, prevRiskScores, aiPhishing, campaignCounts] =
    await Promise.all([
      env.DB.prepare(`
        SELECT target_brand_id as brand_id,
               COUNT(*) as threat_count,
               SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) as phishing_count
        FROM threats
        WHERE created_at >= datetime('now', '-30 days')
          AND target_brand_id IS NOT NULL
        GROUP BY target_brand_id
      `).all<{ brand_id: string; threat_count: number; phishing_count: number }>(),

      env.DB.prepare(`
        SELECT brand_match_id, COUNT(*) as signal_count
        FROM threat_signals
        WHERE signal_type = 'phishing_url'
          AND created_at >= datetime('now', '-30 days')
          AND brand_match_id IS NOT NULL
        GROUP BY brand_match_id
      `).all<{ brand_match_id: string; signal_count: number }>(),

      env.DB.prepare(`
        SELECT spoofed_brand_id, COUNT(*) as catch_count
        FROM spam_trap_captures
        WHERE captured_at >= datetime('now', '-30 days')
          AND spoofed_brand_id IS NOT NULL
        GROUP BY spoofed_brand_id
      `).all<{ spoofed_brand_id: string; catch_count: number }>(),

      env.DB.prepare(`
        SELECT brand_id, composite_risk_score
        FROM brand_threat_assessments
        WHERE id IN (
          SELECT id FROM brand_threat_assessments bta2
          WHERE bta2.brand_id = brand_threat_assessments.brand_id
          ORDER BY bta2.assessed_at DESC LIMIT 1
        )
      `).all<{ brand_id: string; composite_risk_score: number }>(),

      env.DB.prepare(`
        SELECT brand_id, composite_risk_score
        FROM brand_threat_assessments
        WHERE id IN (
          SELECT id FROM brand_threat_assessments bta2
          WHERE bta2.brand_id = brand_threat_assessments.brand_id
          ORDER BY bta2.assessed_at DESC LIMIT 1 OFFSET 1
        )
      `).all<{ brand_id: string; composite_risk_score: number }>(),

      env.DB.prepare(`
        SELECT brand_targeted, COUNT(*) as ai_count
        FROM phishing_pattern_signals
        WHERE ai_generated_probability > 0.7
          AND created_at >= datetime('now', '-30 days')
          AND brand_targeted IS NOT NULL
        GROUP BY brand_targeted
      `).all<{ brand_targeted: string; ai_count: number }>(),

      env.DB.prepare(`
        SELECT target_brand_id as brand_id, COUNT(DISTINCT campaign_id) as campaign_count
        FROM threats
        WHERE created_at >= datetime('now', '-30 days')
          AND target_brand_id IS NOT NULL
          AND campaign_id IS NOT NULL
        GROUP BY target_brand_id
      `).all<{ brand_id: string; campaign_count: number }>(),
    ]);

  const threatMap = new Map(threatCounts.results.map(r => [r.brand_id, r]));
  const phishMap = new Map(phishingSignals.results.map(r => [r.brand_match_id, r.signal_count]));
  const trapMap = new Map(trapCatches.results.map(r => [r.spoofed_brand_id, r.catch_count]));
  const riskMap = new Map(riskScores.results.map(r => [r.brand_id, r.composite_risk_score]));
  const prevRiskMap = new Map(prevRiskScores.results.map(r => [r.brand_id, r.composite_risk_score]));
  const aiMap = new Map(aiPhishing.results.map(r => [r.brand_targeted, r.ai_count]));
  const campaignMap = new Map(campaignCounts.results.map(r => [r.brand_id, r.campaign_count]));

  // Score each brand
  const candidates: ProspectCandidate[] = [];

  for (const brand of emailGrades.results) {
    const breakdown: Record<string, number> = {};
    let score = 0;

    const grade = brand.email_security_grade?.toUpperCase();
    if (grade === 'F' || grade === 'D') {
      breakdown.email_grade_f_or_d = SCORING.email_grade_f_or_d;
      score += SCORING.email_grade_f_or_d;
    } else if (grade === 'C') {
      breakdown.email_grade_c = SCORING.email_grade_c;
      score += SCORING.email_grade_c;
    }

    const dmarc = brand.dmarc_policy?.toLowerCase();
    if (!dmarc || dmarc === 'none') {
      breakdown.dmarc_none_or_missing = SCORING.dmarc_none_or_missing;
      score += SCORING.dmarc_none_or_missing;
    }

    const phishCount = phishMap.get(brand.brand_id) ?? 0;
    if (phishCount > 0) {
      breakdown.active_phishing_urls = SCORING.active_phishing_urls;
      score += SCORING.active_phishing_urls;
    }

    const trapCount = trapMap.get(brand.brand_id) ?? 0;
    if (trapCount > 0) {
      breakdown.spam_trap_catches = SCORING.spam_trap_catches;
      score += SCORING.spam_trap_catches;
    }

    const riskScore = riskMap.get(brand.brand_id);
    if (riskScore && riskScore > 60) {
      breakdown.high_risk_score = SCORING.high_risk_score;
      score += SCORING.high_risk_score;
    }

    const aiCount = aiMap.get(brand.brand_id) ?? 0;
    if (aiCount > 0) {
      breakdown.ai_phishing_detected = SCORING.ai_phishing_detected;
      score += SCORING.ai_phishing_detected;
    }

    if (brand.tranco_rank && brand.tranco_rank <= 10000) {
      breakdown.tranco_top_10k = SCORING.tranco_top_10k;
      score += SCORING.tranco_top_10k;
    }

    const campCount = campaignMap.get(brand.brand_id) ?? 0;
    if (campCount >= 3) {
      breakdown.multiple_campaigns = SCORING.multiple_campaigns;
      score += SCORING.multiple_campaigns;
    }

    const prevScore = prevRiskMap.get(brand.brand_id);
    if (riskScore && prevScore && riskScore - prevScore >= 20) {
      breakdown.recent_risk_spike = SCORING.recent_risk_spike;
      score += SCORING.recent_risk_spike;
    }

    try {
      const socialIntel = await getBrandSocialIntel({ DB: env.DB } as Env, brand.brand_id);
      if (socialIntel.impersonationProfiles > 0) {
        breakdown.social_impersonation = SCORING.social_impersonation;
        score += SCORING.social_impersonation;
      }
      if (socialIntel.socialRiskScore && socialIntel.socialRiskScore >= 60) {
        breakdown.social_high_risk = SCORING.social_high_risk;
        score += SCORING.social_high_risk;
      }
      if (socialIntel.aiTakedownRecommendations > 0) {
        breakdown.social_takedown_needed = SCORING.social_takedown_needed;
        score += SCORING.social_takedown_needed;
      }
    } catch { /* social intel is best-effort */ }

    if (score < MIN_SCORE) continue;

    // Determine pitch angle from highest-weighted factor
    const emailScore = breakdown.email_grade_f_or_d ?? breakdown.email_grade_c ?? 0;
    const threatScore = breakdown.active_phishing_urls ?? 0;
    const brandScore = (breakdown.spam_trap_catches ?? 0) + (breakdown.social_impersonation ?? 0);

    let pitchAngle: string;
    if (emailScore >= threatScore && emailScore >= brandScore) {
      pitchAngle = 'email_security_gap';
    } else if (threatScore >= brandScore) {
      pitchAngle = 'high_threat_volume';
    } else {
      pitchAngle = 'brand_protection';
    }

    // Template-based findings summary — no AI required
    const recentThreats = threatMap.get(brand.brand_id)?.threat_count ?? 0;
    const emailGrade = brand.email_security_grade ?? 'unknown';
    const factors: string[] = [];
    if (phishCount > 0) factors.push(`${phishCount} active phishing URLs`);
    if (trapCount > 0) factors.push(`${trapCount} spam trap catches`);
    if (!dmarc || dmarc === 'none') factors.push('no DMARC enforcement');
    if (grade === 'F' || grade === 'D') factors.push(`email grade ${grade}`);
    if (breakdown.social_impersonation) factors.push('social media impersonation');

    const findingsSummary = `${brand.brand_name} (${brand.brand_domain}) has ${recentThreats} active threats in the last 30 days with an email security grade of ${emailGrade}. Risk factors: ${factors.length ? factors.join(', ') : 'composite risk indicators'}.`;

    candidates.push({
      brand_id: brand.brand_id,
      brand_name: brand.brand_name,
      brand_domain: brand.brand_domain,
      prospect_score: score,
      score_breakdown: breakdown,
      email_security_grade: brand.email_security_grade,
      threat_count_30d: recentThreats,
      phishing_urls_active: phishCount,
      trap_catches_30d: trapCount,
      composite_risk_score: riskScore ?? null,
      pitch_angle: pitchAngle,
      findings_summary: findingsSummary,
    });
  }

  // Sort by score descending, take top MAX_IDENTIFIED
  candidates.sort((a, b) => b.prospect_score - a.prospect_score);
  const topCandidates = candidates.slice(0, MAX_IDENTIFIED);

  // Insert leads — no AI, just data
  let leadsCreated = 0;
  let errors = 0;

  for (const candidate of topCandidates) {
    try {
      await env.DB.prepare(`
        INSERT INTO sales_leads (
          brand_id, prospect_score, score_breakdown_json, status,
          company_name, company_domain,
          email_security_grade, threat_count_30d, phishing_urls_active,
          trap_catches_30d, composite_risk_score, pitch_angle, findings_summary,
          identified_by, ai_enriched,
          created_at, updated_at
        ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prospector_agent', 0, datetime('now'), datetime('now'))
      `).bind(
        candidate.brand_id,
        candidate.prospect_score,
        JSON.stringify(candidate.score_breakdown),
        candidate.brand_name,
        candidate.brand_domain,
        candidate.email_security_grade,
        candidate.threat_count_30d,
        candidate.phishing_urls_active,
        candidate.trap_catches_30d,
        candidate.composite_risk_score,
        candidate.pitch_angle,
        candidate.findings_summary,
      ).run();

      leadsCreated++;
    } catch (err) {
      errors++;
    }
  }

  return { candidates_found: topCandidates.length, leads_created: leadsCreated, errors };
}

// ─── Phase 2: AI Enrichment ──────────────────────────────────────

export async function enrichLeadWithAI(env: Env): Promise<{
  enriched: boolean;
  lead_id?: number;
  company_name?: string;
  error?: string;
}> {
  // Pick the highest-scored unenriched lead
  const lead = await env.DB.prepare(`
    SELECT * FROM sales_leads
    WHERE ai_enriched = 0
    ORDER BY prospect_score DESC
    LIMIT 1
  `).first<UnenrichedLead>();

  if (!lead) {
    return { enriched: false };
  }

  try {
    // ── (a) Detailed findings summary ──────────────────────────
    const summaryResult = await callHaikuJSON<{ summary: string }>(
      env,
      `You are a concise threat intelligence writer for Averrow, a brand protection platform. Write a 2-3 sentence factual summary of security findings. Reference specific numbers. Output JSON: {"summary": "..."}`,
      `Brand: ${lead.company_name} (${lead.company_domain})
Email security grade: ${lead.email_security_grade || 'Not scanned'}
Active phishing URLs detected (30d): ${lead.phishing_urls_active ?? 0}
Spam trap catches (brand impersonation, 30d): ${lead.trap_catches_30d ?? 0}
Total threats (30d): ${lead.threat_count_30d ?? 0}
Composite risk score: ${lead.composite_risk_score ?? 'N/A'}/100
Pitch angle: ${lead.pitch_angle ?? 'brand_protection'}`,
      256,
    );

    const findingsSummary = summaryResult.data?.summary ?? lead.findings_summary;

    // ── (b) Personalized outreach email variants ────────────────
    const outreachResult = await callHaikuJSON<{
      variant_1_subject: string;
      variant_1_body: string;
      variant_2_subject: string;
      variant_2_body: string;
    }>(
      env,
      `You are drafting outreach emails from Averrow to a security leader at a company. Be direct and professional.

AVERROW FINDINGS (share at HIGH LEVEL only — do not reveal specific URLs, IPs, or detailed IOCs):
${findingsSummary}

Email security grade: ${lead.email_security_grade ?? 'Unknown'}
Active phishing URLs detected: ${lead.phishing_urls_active ?? 0}
Spam trap catches (brand impersonation): ${lead.trap_catches_30d ?? 0}
Overall risk score: ${lead.composite_risk_score ?? 'N/A'}/100

Generate TWO email variants as JSON: variant_1_subject, variant_1_body, variant_2_subject, variant_2_body.

VARIANT 1 — "Intelligence briefing" angle: lead with a specific finding, frame as sharing intelligence, offer a 15-minute threat briefing, under 150 words body.
VARIANT 2 — "Peer benchmark" angle: compare their security posture to industry peers, reference specific gaps, offer a free assessment report, under 150 words body.

RULES: Professional, direct tone. No buzzwords. No exclamation marks. Sign off as "Averrow Threat Intelligence Team". Return ONLY valid JSON.`,
      `Draft the two outreach email variants for ${lead.company_name} (${lead.company_domain}).`,
      1024,
    );

    // ── (c) Company research ────────────────────────────────────
    const researchResult = await callHaikuJSON<{
      company_industry?: string | null;
      company_size?: string | null;
      company_hq?: string | null;
      target_name?: string | null;
      target_title?: string | null;
      security_maturity?: string | null;
      recent_security_news?: string | null;
    }>(
      env,
      `You are a sales intelligence researcher. Research the company and return a JSON profile. If you cannot find a field, return null — do NOT fabricate. Return ONLY valid JSON.`,
      `Research "${lead.company_name}" (${lead.company_domain}). Return JSON with: company_industry, company_size (startup/smb/mid-market/enterprise), company_hq, target_name (CISO or VP Security), target_title, security_maturity (high/medium/low), recent_security_news (one sentence or null).`,
      1024,
      [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    );

    const research = researchResult.data ?? {};

    // ── Update the lead ─────────────────────────────────────────
    await env.DB.prepare(`
      UPDATE sales_leads SET
        findings_summary = ?,
        outreach_variant_1 = ?,
        outreach_variant_2 = ?,
        research_json = ?,
        ai_enriched = 1,
        ai_enriched_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      findingsSummary,
      outreachResult.data
        ? JSON.stringify({ subject: outreachResult.data.variant_1_subject, body: outreachResult.data.variant_1_body })
        : null,
      outreachResult.data
        ? JSON.stringify({ subject: outreachResult.data.variant_2_subject, body: outreachResult.data.variant_2_body })
        : null,
      JSON.stringify(research),
      lead.id,
    ).run();

    return { enriched: true, lead_id: lead.id, company_name: lead.company_name ?? undefined };

  } catch (err) {
    // Do NOT mark as enriched — it will be retried next run
    return { enriched: false, lead_id: lead.id, error: String(err) };
  }
}

// ─── Main run() ─────────────────────────────────────────────────

async function run(env: Env): Promise<{
  phase1: { candidates_found: number; leads_created: number; errors: number };
  phase2: { enriched: boolean; lead_id?: number; company_name?: string; error?: string };
}> {
  // Phase 1: always run — identify and create new leads (no AI)
  const phase1 = await identifyAndCreate(env);

  // Phase 2: always run — enrich one existing unenriched lead (AI)
  const phase2 = await enrichLeadWithAI(env);

  return { phase1, phase2 };
}

// ─── Agent Module ────────────────────────────────────────────────

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

    // Check weekly throttle for Phase 1 (lead creation)
    const lastRun = await env.CACHE.get("prospector:last_run");
    const throttled = lastRun && Date.now() - parseInt(lastRun) < 7 * 24 * 60 * 60 * 1000;

    let phase1 = { candidates_found: 0, leads_created: 0, errors: 0 };

    if (throttled) {
      // Phase 1 throttled — skip lead creation this tick
    } else {
      phase1 = await identifyAndCreate(env);
      await env.CACHE.put("prospector:last_run", Date.now().toString());
    }

    // Phase 2 always runs — enrich one lead on every cron tick
    const phase2 = await enrichLeadWithAI(env);

    outputs.push({
      type: "insight",
      summary: throttled
        ? `Pathfinder: lead creation throttled. Enriched ${phase2.enriched ? `lead ${phase2.lead_id} (${phase2.company_name})` : "no leads (none pending)"}.`
        : `Pathfinder created ${phase1.leads_created} leads from ${phase1.candidates_found} candidates. ${phase2.enriched ? `AI-enriched lead ${phase2.lead_id} (${phase2.company_name}).` : "No unenriched leads to process."}`,
      severity: phase1.leads_created > 0 || phase2.enriched ? "medium" : "info",
      details: { phase1, phase2, throttled: !!throttled },
    });

    return {
      itemsProcessed: phase1.candidates_found,
      itemsCreated: phase1.leads_created,
      itemsUpdated: phase2.enriched ? 1 : 0,
      output: { phase1, phase2 },
      agentOutputs: outputs,
    };
  },
};
