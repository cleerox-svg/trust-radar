/**
 * Sparrow Phase 3 — AI-Powered Evidence Assembler
 *
 * When a takedown request is created, collects all available intelligence
 * about the target and calls Haiku to generate a structured evidence package
 * suitable for submission to abuse providers.
 */

import type { Env, TakedownRequest } from "../types";

// ─── Types ──────────────────────────────────────────────────────

export interface EvidencePackage {
  takedown_id: string;
  target_summary: string;
  brand_impact: string;
  technical_evidence: string;
  recommended_action: string;
  provider_submission_draft: string;
  evidence_items: Array<{
    type: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface AiReport {
  target_summary?: string;
  brand_impact?: string;
  technical_evidence?: string;
  recommended_action?: string;
  provider_submission_draft?: string;
  raw_text?: string;
}

// ─── Main ───────────────────────────────────────────────────────

/**
 * Assemble comprehensive evidence for a takedown request.
 * Collects all available data, then calls Haiku to generate a structured report.
 */
export async function assembleEvidence(
  env: Env,
  takedownId: string,
): Promise<EvidencePackage> {
  // 1. Load the takedown request
  const takedown = await env.DB.prepare(
    "SELECT * FROM takedown_requests WHERE id = ?",
  )
    .bind(takedownId)
    .first<TakedownRequest>();

  if (!takedown) throw new Error(`Takedown ${takedownId} not found`);

  // 2. Collect all available intelligence based on target type
  const intel = await collectIntelligence(env, takedown);

  // 3. Call Haiku to generate structured evidence report
  const prompt = buildEvidencePrompt(takedown, intel);
  const aiReport = await callHaiku(env, prompt);

  // 4. Save AI evidence report
  await env.DB.prepare(`
    INSERT INTO takedown_evidence (id, takedown_id, evidence_type, title, content_text, metadata_json, created_at)
    VALUES (?, ?, 'ai_report', 'AI Evidence Assessment', ?, ?, datetime('now'))
  `).bind(
    crypto.randomUUID(),
    takedownId,
    aiReport.target_summary || aiReport.raw_text || "",
    JSON.stringify(aiReport),
  ).run();

  // 5. Update takedown with enriched evidence
  const updatedDetail =
    aiReport.provider_submission_draft ||
    aiReport.target_summary ||
    takedown.evidence_detail;

  await env.DB.prepare(`
    UPDATE takedown_requests
    SET evidence_detail = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(updatedDetail, takedownId).run();

  // 6. Build response
  return {
    takedown_id: takedownId,
    target_summary: aiReport.target_summary || "",
    brand_impact: aiReport.brand_impact || "",
    technical_evidence: aiReport.technical_evidence || "",
    recommended_action: aiReport.recommended_action || "",
    provider_submission_draft: aiReport.provider_submission_draft || "",
    evidence_items: (intel.existing_evidence || []).map((e) => ({
      type: (e as Record<string, unknown>).evidence_type as string,
      title: (e as Record<string, unknown>).title as string,
      content: (e as Record<string, unknown>).content_text as string,
    })),
  };
}

// ─── Intelligence Collection ────────────────────────────────────

interface IntelBundle {
  brand?: Record<string, unknown> | null;
  url_scan?: Record<string, unknown> | null;
  social_profile?: Record<string, unknown> | null;
  related_threats?: Record<string, unknown>[];
  threat_count?: number;
  provider?: Record<string, unknown> | null;
  existing_evidence?: Record<string, unknown>[];
  whois?: Record<string, unknown> | null;
}

async function collectIntelligence(
  env: Env,
  takedown: TakedownRequest,
): Promise<IntelBundle> {
  const intel: IntelBundle = {};

  // Run independent queries in parallel
  const [brand, urlScan, socialProfile, threats, provider, existingEvidence, whois] =
    await Promise.all([
      // Brand info
      takedown.brand_id
        ? env.DB.prepare(
            "SELECT name, canonical_domain, email_security_grade, threat_count, exposure_score FROM brands WHERE id = ?",
          ).bind(takedown.brand_id).first()
        : null,

      // URL scan results
      takedown.source_type === "url_scan" && takedown.source_id
        ? env.DB.prepare(
            "SELECT * FROM url_scan_results WHERE id = ?",
          ).bind(takedown.source_id).first()
        : null,

      // Social profile data
      takedown.source_type === "social_profile" && takedown.source_id
        ? env.DB.prepare(
            "SELECT * FROM social_profiles WHERE id = ?",
          ).bind(takedown.source_id).first()
        : null,

      // Related threats for the target domain
      takedown.target_value
        ? env.DB.prepare(`
            SELECT threat_type, severity, source_feed, hosting_provider_id, created_at
            FROM threats
            WHERE (malicious_domain = ? OR malicious_url LIKE ?)
            AND status = 'active'
            ORDER BY created_at DESC LIMIT 20
          `).bind(takedown.target_value, `%${takedown.target_value}%`).all()
        : null,

      // Hosting provider info
      takedown.provider_name
        ? env.DB.prepare(
            "SELECT * FROM takedown_providers WHERE provider_name = ?",
          ).bind(takedown.provider_name).first()
        : null,

      // Existing evidence artifacts
      env.DB.prepare(
        "SELECT * FROM takedown_evidence WHERE takedown_id = ? ORDER BY created_at",
      ).bind(takedown.id).all(),

      // WHOIS / infrastructure data from threats table
      takedown.target_type === "domain" || takedown.target_type === "url"
        ? env.DB.prepare(`
            SELECT registrar, ip_address, asn, country_code
            FROM threats WHERE malicious_domain = ? LIMIT 1
          `).bind(takedown.target_value).first()
        : null,
    ]);

  intel.brand = brand;
  intel.url_scan = urlScan;
  intel.social_profile = socialProfile;
  intel.related_threats = threats?.results as Record<string, unknown>[] | undefined;
  intel.threat_count = threats?.results?.length ?? 0;
  intel.provider = provider;
  intel.existing_evidence = existingEvidence.results as Record<string, unknown>[];
  intel.whois = whois;

  return intel;
}

// ─── AI Report Generation ───────────────────────────────────────

async function callHaiku(env: Env, prompt: string): Promise<AiReport> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
    };
    const aiText = data.content?.[0]?.text || "";

    // Parse AI response — expect JSON
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw_text: aiText };
    } catch {
      return { raw_text: aiText };
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Prompt Builder ─────────────────────────────────────────────

function buildEvidencePrompt(
  takedown: TakedownRequest,
  intel: IntelBundle,
): string {
  return `You are a cybersecurity analyst preparing evidence for a brand abuse takedown request. Generate a structured evidence package.

TARGET:
- Type: ${takedown.target_type}
- Value: ${takedown.target_value}
- Platform: ${takedown.target_platform || "N/A"}
- URL: ${takedown.target_url || "N/A"}

BRAND BEING PROTECTED:
${JSON.stringify(intel.brand || "Unknown", null, 2)}

THREAT INTELLIGENCE:
${JSON.stringify(intel.related_threats || [], null, 2)}

URL SCAN DATA:
${JSON.stringify(intel.url_scan || "None", null, 2)}

SOCIAL PROFILE DATA:
${JSON.stringify(intel.social_profile || "None", null, 2)}

INFRASTRUCTURE:
${JSON.stringify(intel.whois || "None", null, 2)}

EXISTING EVIDENCE:
${JSON.stringify(intel.existing_evidence || [], null, 2)}

PROVIDER:
${JSON.stringify(intel.provider || "Unknown", null, 2)}

Respond with ONLY a JSON object (no markdown, no backticks) containing:
{
  "target_summary": "2-3 sentence summary of what the target is and why it's malicious",
  "brand_impact": "How this target harms the brand and its customers",
  "technical_evidence": "Technical details: hosting, IP, domain age, WHOIS, threat signals",
  "recommended_action": "Specific recommended takedown action",
  "provider_submission_draft": "Ready-to-send abuse report text formatted for the hosting/platform provider. Include: reporter identity (Averrow, authorized brand protection service), target URL/account, evidence summary, request for removal. Professional tone."
}`;
}
