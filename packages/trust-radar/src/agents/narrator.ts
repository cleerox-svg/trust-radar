/**
 * Narrator Agent — AI-powered threat narrative generation.
 *
 * Correlates multiple threat signals (phishing, lookalike domains, social
 * impersonation, email security, CT certificates) for a brand into a
 * coherent attack narrative with stage identification and recommendations.
 */

import type { Env } from "../types";
import { createAlert } from "../lib/alerts";
import { checkCostGuard } from "../lib/haiku";

// ─── Types ────────────────────────────────────────────────────────

interface NarrativeContext {
  threats: any[];
  emailSecurity: any;
  socialFindings: any[];
  lookalikes: any[];
  ctCertificates: any[];
}

interface NarrativeResult {
  title: string;
  narrative: string;
  summary: string;
  severity: string;
  attackStage: string;
  recommendations: string[];
}

// ─── Core narrative generation ────────────────────────────────────

export async function generateThreatNarrative(
  env: Env,
  brandId: string,
  context: NarrativeContext,
): Promise<NarrativeResult> {
  const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
  if (!apiKey || apiKey.startsWith("lrx_")) {
    throw new Error("No valid Anthropic API key configured for narrative generation");
  }

  const signalSummary = buildSignalSummary(context);

  const systemPrompt = `You are a senior threat intelligence analyst writing an internal threat narrative for a brand protection team.

Your task is to synthesize multiple threat signals into a coherent attack narrative. You must:
1. Connect signals that might indicate coordinated activity (e.g., lookalike domain registered + phishing emails + social impersonation appearing together).
2. Identify the attack stage:
   - "reconnaissance" — Attacker is probing (CT certs issued, lookalike domains registered but not active yet)
   - "weaponization" — Infrastructure being prepared (lookalike domains with content, email spoofing capability due to weak DMARC)
   - "delivery" — Active attacks in progress (phishing URLs live, social impersonation accounts active)
   - "exploitation" — Successful compromise indicators (credential harvesting confirmed, malware distribution active)
3. Distinguish between noise and genuine threats. Not every signal is an attack.
4. Be specific about what was found and why it matters.
5. Provide 3-5 actionable recommendations.

Respond with ONLY a JSON object (no markdown, no explanation outside the JSON):
{
  "title": "Short descriptive title (e.g., 'Coordinated Phishing Campaign Targeting Brand X')",
  "narrative": "Full 3-5 paragraph narrative connecting the signals into a story. Include specific domains, counts, and timelines.",
  "summary": "2-3 sentence executive summary.",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "attack_stage": "reconnaissance | weaponization | delivery | exploitation",
  "recommendations": ["Specific action item 1", "Specific action item 2", ...]
}`;

  const userMessage = `Analyze these threat signals for brand ${brandId} and generate a threat narrative:\n\n${signalSummary}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(45000),
  });

  const responseText = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic API error: HTTP ${res.status}: ${responseText.slice(0, 300)}`);
  }

  const apiResponse = JSON.parse(responseText) as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const textBlock = apiResponse.content.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("No text content in Anthropic response");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in narrative response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    title: string;
    narrative: string;
    summary: string;
    severity: string;
    attack_stage: string;
    recommendations: string[];
  };

  return {
    title: parsed.title,
    narrative: parsed.narrative,
    summary: parsed.summary,
    severity: parsed.severity || "MEDIUM",
    attackStage: parsed.attack_stage || "reconnaissance",
    recommendations: parsed.recommendations || [],
  };
}

// ─── Brand-level narrative orchestrator ───────────────────────────

export async function generateNarrativesForBrand(env: Env, brandId: string): Promise<void> {
  console.log(`[narrator] Generating narratives for brand ${brandId}`);

  // Cost guard: narrator is non-critical
  const blocked = await checkCostGuard(env, false);
  if (blocked) {
    console.warn(`[narrator] ${blocked}`);
    return;
  }

  // 1. Gather recent signals (last 7 days)
  const [threats, emailSecurity, socialFindings, lookalikes, ctCertificates] = await Promise.all([
    env.DB.prepare(
      `SELECT id, threat_type, malicious_domain, malicious_url, severity, status, source_feed, created_at
       FROM threats
       WHERE target_brand_id = ? AND created_at >= datetime('now', '-7 days')
       ORDER BY created_at DESC LIMIT 50`
    ).bind(brandId).all(),

    env.DB.prepare(
      `SELECT email_security_grade, email_security_score, email_security_scanned_at
       FROM brands WHERE id = ?`
    ).bind(brandId).first(),

    env.DB.prepare(
      `SELECT platform, username, display_name, similarity_score, status, found_at
       FROM social_monitor_results
       WHERE brand_id = ? AND found_at >= datetime('now', '-7 days')
       ORDER BY found_at DESC LIMIT 30`
    ).bind(brandId).all().catch(() => ({ results: [] })),

    env.DB.prepare(
      `SELECT domain, registered, dns_active, has_content, mx_records, created_at
       FROM lookalike_domains
       WHERE brand_id = ? AND registered = 1 AND created_at >= datetime('now', '-7 days')
       ORDER BY created_at DESC LIMIT 30`
    ).bind(brandId).all().catch(() => ({ results: [] })),

    env.DB.prepare(
      `SELECT domain, issuer, not_before, suspicious, san_count
       FROM ct_certificates
       WHERE brand_id = ? AND suspicious = 1 AND not_before >= datetime('now', '-7 days')
       ORDER BY not_before DESC LIMIT 20`
    ).bind(brandId).all().catch(() => ({ results: [] })),
  ]);

  // 2. Count distinct signal types
  const signalTypes: string[] = [];
  if (threats.results.length > 0) signalTypes.push("threats");
  if (emailSecurity?.email_security_grade && ["D", "F"].includes(emailSecurity.email_security_grade as string)) {
    signalTypes.push("email_degradation");
  }
  if (socialFindings.results.length > 0) signalTypes.push("social_impersonation");
  if (lookalikes.results.length > 0) signalTypes.push("lookalike_domains");
  if (ctCertificates.results.length > 0) signalTypes.push("ct_certificates");

  // Only generate if there are at least 2 different signal types
  if (signalTypes.length < 2) {
    console.log(`[narrator] Skipping brand ${brandId}: only ${signalTypes.length} signal type(s) (${signalTypes.join(", ")})`);
    return;
  }

  console.log(`[narrator] Brand ${brandId} has ${signalTypes.length} signal types: ${signalTypes.join(", ")}`);

  // 3. Generate the narrative
  const context: NarrativeContext = {
    threats: threats.results,
    emailSecurity,
    socialFindings: socialFindings.results,
    lookalikes: lookalikes.results,
    ctCertificates: ctCertificates.results,
  };

  let result: NarrativeResult;
  try {
    result = await generateThreatNarrative(env, brandId, context);
  } catch (err) {
    console.error(`[narrator] Narrative generation failed for brand ${brandId}:`, err);
    return;
  }

  // 4. Store in threat_narratives table
  const narrativeId = crypto.randomUUID();
  const threatIds = threats.results.map((t: any) => t.id);

  try {
    await env.DB.prepare(
      `INSERT INTO threat_narratives (id, brand_id, title, narrative, summary, threat_ids, signal_types, severity, confidence, attack_stage, recommendations, generated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'narrator')`
    ).bind(
      narrativeId,
      brandId,
      result.title,
      result.narrative,
      result.summary,
      JSON.stringify(threatIds),
      JSON.stringify(signalTypes),
      result.severity,
      signalTypes.length >= 4 ? 85 : signalTypes.length >= 3 ? 70 : 55,
      result.attackStage,
      JSON.stringify(result.recommendations),
    ).run();

    console.log(`[narrator] Stored narrative ${narrativeId} for brand ${brandId}: "${result.title}" (${result.severity})`);
  } catch (err) {
    console.error(`[narrator] Failed to store narrative for brand ${brandId}:`, err);
    return;
  }

  // 5. Create an alert if severity is HIGH or CRITICAL
  if (result.severity === "HIGH" || result.severity === "CRITICAL") {
    try {
      // Find the brand owner for the alert
      const brandOwner = await env.DB.prepare(
        `SELECT user_id FROM brand_profiles WHERE brand_id = ? LIMIT 1`
      ).bind(brandId).first<{ user_id: string }>();

      const userId = brandOwner?.user_id ?? "system";

      await createAlert(env.DB, {
        brandId,
        userId,
        alertType: "phishing_detected",
        severity: result.severity as "HIGH" | "CRITICAL",
        title: result.title,
        summary: result.summary,
        details: {
          narrative_id: narrativeId,
          attack_stage: result.attackStage,
          signal_types: signalTypes,
        },
        sourceType: "threat_narrative",
        sourceId: narrativeId,
        aiAssessment: result.narrative,
        aiRecommendations: result.recommendations,
      });

      console.log(`[narrator] Created alert for brand ${brandId}: ${result.severity} — ${result.title}`);
    } catch (err) {
      console.error(`[narrator] Failed to create alert for brand ${brandId}:`, err);
    }
  }
}

// ─── Helper: Build signal summary for the AI prompt ──────────────

function buildSignalSummary(context: NarrativeContext): string {
  const parts: string[] = [];

  // Threats
  if (context.threats.length > 0) {
    const byType: Record<string, number> = {};
    const domains = new Set<string>();
    for (const t of context.threats) {
      byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;
      if (t.malicious_domain) domains.add(t.malicious_domain);
    }
    const typeStr = Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(", ");
    parts.push(`## Active Threats (last 7 days)
Count: ${context.threats.length}
Types: ${typeStr}
Domains involved: ${Array.from(domains).slice(0, 15).join(", ")}
Sources: ${[...new Set(context.threats.map((t: any) => t.source_feed))].join(", ")}`);
  }

  // Email security
  if (context.emailSecurity) {
    const es = context.emailSecurity;
    parts.push(`## Email Security Posture
Grade: ${es.email_security_grade ?? "Not scanned"}
Score: ${es.email_security_score ?? "N/A"}
Last scanned: ${es.email_security_scanned_at ?? "Never"}`);
  }

  // Social impersonation
  if (context.socialFindings.length > 0) {
    const platforms = [...new Set(context.socialFindings.map((s: any) => s.platform))];
    const active = context.socialFindings.filter((s: any) => s.status === "active").length;
    parts.push(`## Social Impersonation
Findings: ${context.socialFindings.length} (${active} active)
Platforms: ${platforms.join(", ")}
Accounts: ${context.socialFindings.slice(0, 10).map((s: any) => `@${s.username} on ${s.platform} (similarity: ${s.similarity_score}%)`).join(", ")}`);
  }

  // Lookalike domains
  if (context.lookalikes.length > 0) {
    const withContent = context.lookalikes.filter((d: any) => d.has_content).length;
    const withMx = context.lookalikes.filter((d: any) => d.mx_records).length;
    parts.push(`## Lookalike Domains (registered)
Count: ${context.lookalikes.length} (${withContent} with content, ${withMx} with MX records)
Domains: ${context.lookalikes.slice(0, 15).map((d: any) => d.domain).join(", ")}`);
  }

  // CT certificates
  if (context.ctCertificates.length > 0) {
    parts.push(`## Suspicious CT Certificates
Count: ${context.ctCertificates.length}
Certificates: ${context.ctCertificates.slice(0, 10).map((c: any) => `${c.domain} (issuer: ${c.issuer}, SANs: ${c.san_count})`).join("; ")}`);
  }

  return parts.join("\n\n");
}
