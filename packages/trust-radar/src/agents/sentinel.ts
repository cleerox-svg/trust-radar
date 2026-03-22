/**
 * Sentinel Agent — Certificate & domain surveillance.
 *
 * Runs on every feed ingestion event. Classifies new threats
 * via Haiku AI and assigns confidence scores + severity.
 * Falls back to rule-based classification when Haiku is unavailable.
 *
 * Also performs:
 * - Source-quality confidence boosting (merged from triage agent)
 * - Homoglyph & brand-squatting detection (merged from impersonation-detector agent)
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import type { Env } from "../types";
import { classifyThreat } from "../lib/haiku";

// ─── Homoglyph & brand-squatting detection ──────────────────────

const FALLBACK_BRAND_KEYWORDS = [
  "paypal", "apple", "google", "microsoft", "amazon", "netflix", "facebook",
  "instagram", "twitter", "linkedin", "dropbox", "adobe", "zoom", "slack",
  "github", "cloudflare", "stripe", "shopify", "coinbase", "binance",
];

const HOMOGLYPHS: Record<string, string[]> = {
  a: ["а", "ą", "ä", "å", "α"],
  e: ["е", "ë", "ę", "ε"],
  o: ["о", "ö", "ø", "ο", "0"],
  i: ["і", "ì", "1", "l", "|"],
  l: ["1", "і", "|", "ℓ"],
  n: ["ñ", "ń", "η"],
  c: ["с", "ç", "ć"],
  s: ["ś", "ş", "ș"],
};

function detectHomoglyphs(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/[.-]/g, "");
  for (const glyphs of Object.values(HOMOGLYPHS)) {
    for (const glyph of glyphs) {
      if (normalized.includes(glyph)) return true;
    }
  }
  return false;
}

function detectBrandSquatting(domain: string, brandKeywords: string[]): string | null {
  const cleaned = domain.toLowerCase().replace(/[.-]/g, "");
  for (const brand of brandKeywords) {
    if (cleaned.includes(brand)) {
      const realPatterns = [`${brand}.com`, `${brand}.io`, `${brand}.org`, `${brand}.net`];
      if (!realPatterns.includes(domain)) return brand;
    }
  }
  return null;
}

// ─── Sentinel Agent ─────────────────────────────────────────────

export const sentinelAgent: AgentModule = {
  name: "sentinel",
  displayName: "Sentinel",
  description: "Certificate & domain surveillance — classifies new threats via AI",
  color: "#22D3EE",
  trigger: "event",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    // ─── Diagnostic logging ───────────────────────────────────
    console.log("[sentinel] === STARTING ===");
    console.log("[sentinel] ANTHROPIC_API_KEY configured:", !!env.ANTHROPIC_API_KEY, env.ANTHROPIC_API_KEY ? "present (length=" + env.ANTHROPIC_API_KEY.length + ")" : "MISSING");

    // Load monitored brand keywords from DB, fall back to hardcoded list
    const monitoredBrands = await env.DB.prepare(
      `SELECT b.name FROM brands b
       INNER JOIN monitored_brands mb ON mb.brand_id = b.id
       WHERE mb.status = 'active'`
    ).all<{ name: string }>().catch(() => ({ results: [] as { name: string }[] }));

    const brandKeywords = monitoredBrands.results.length > 0
      ? monitoredBrands.results.map((b) => b.name.toLowerCase().replace(/[^a-z0-9]/g, "")).filter((k) => k.length >= 3)
      : FALLBACK_BRAND_KEYWORDS;
    console.log(`[sentinel] brand keywords for squatting detection: ${brandKeywords.length} (source: ${monitoredBrands.results.length > 0 ? "DB" : "fallback"})`);

    // Get unclassified threats (no confidence_score yet)
    const threats = await env.DB.prepare(
      `SELECT id, malicious_url, malicious_domain, ip_address, source_feed, ioc_value, threat_type
       FROM threats
       WHERE confidence_score IS NULL
       ORDER BY created_at DESC LIMIT 50`
    ).all<{
      id: string; malicious_url: string | null; malicious_domain: string | null;
      ip_address: string | null; source_feed: string; ioc_value: string | null;
      threat_type: string;
    }>();

    console.log("[sentinel] Threats with confidence_score IS NULL:", threats.results.length);

    // Also check total threat count for context
    const totalCount = await env.DB.prepare("SELECT COUNT(*) as n FROM threats").first<{ n: number }>();
    const nullCount = await env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE confidence_score IS NULL").first<{ n: number }>();
    console.log("[sentinel] Total threats in DB:", totalCount?.n ?? 0, "| With NULL confidence:", nullCount?.n ?? 0);

    let itemsProcessed = 0;
    let itemsUpdated = 0;
    let impersonationsFound = 0;
    const outputs: AgentOutputEntry[] = [];
    let totalTokens = 0;
    let model: string | undefined;
    let haikuSuccesses = 0;
    let haikuFailures = 0;

    for (const threat of threats.results) {
      itemsProcessed++;

      // Try Haiku classification
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
        haikuSuccesses++;
        confidence = result.data.confidence;
        severity = result.data.severity;
        if (result.tokens_used) totalTokens += result.tokens_used;
        if (result.model) model = result.model;
        if (itemsProcessed <= 3) {
          console.log(`[sentinel] Haiku SUCCESS for ${threat.id}: confidence=${confidence}, severity=${severity}`);
        }
      } else {
        haikuFailures++;
        if (haikuFailures <= 3) {
          console.log(`[sentinel] Haiku FAILED for ${threat.id}: ${result.error ?? "no data"}`);
        }
        // Fallback: rule-based scoring with source-quality boosting
        const fb = ruleBasedClassify(threat.source_feed, threat.threat_type);
        confidence = fb.confidence;
        severity = fb.severity;
      }

      // Impersonation detection on domain
      let threatType = threat.threat_type;
      const domain = threat.malicious_domain;
      if (domain) {
        const hasHomoglyphs = detectHomoglyphs(domain);
        const squattedBrand = detectBrandSquatting(domain, brandKeywords);

        if (hasHomoglyphs || squattedBrand) {
          impersonationsFound++;
          if (severity === "low" || severity === "medium") severity = "high";
          if (threatType === "unknown") threatType = "impersonation";
          confidence = Math.min(95, confidence + 10);
        }
      }

      // Cross-reference with social profiles for coordinated attack detection
      if (domain) {
        try {
          const domainKeyword = domain.split('.')[0] || '';
          const socialMatch = await env.DB.prepare(`
            SELECT sp.handle, sp.platform, sp.classification, sp.profile_url, b.name AS brand_name
            FROM social_profiles sp
            JOIN brands b ON b.id = sp.brand_id
            WHERE sp.status = 'active'
              AND sp.classification IN ('suspicious', 'impersonation')
              AND (
                sp.profile_url LIKE '%' || ? || '%'
                OR sp.handle LIKE '%' || ? || '%'
              )
            LIMIT 3
          `).bind(domain, domainKeyword).all<{
            handle: string; platform: string; classification: string;
            profile_url: string | null; brand_name: string;
          }>();

          if (socialMatch.results.length > 0) {
            console.log("[sentinel] Social correlation found", {
              threat_id: threat.id,
              social_matches: socialMatch.results.length,
              brands: socialMatch.results.map(s => s.brand_name),
            });

            const correlationNote = socialMatch.results.map(s =>
              `Correlated with ${s.classification} ${s.platform} profile @${s.handle} (${s.brand_name})`
            ).join('; ');

            // Escalate severity on social correlation
            if (severity === 'medium') severity = 'high';
            else if (severity === 'high') severity = 'critical';

            outputs.push({
              type: "classification",
              summary: `**Social Correlation** — Threat ${threat.id} (${domain}) correlates with social impersonation: ${correlationNote}`,
              severity: severity as "critical" | "high" | "medium" | "low" | "info",
              details: {
                threat_id: threat.id,
                domain,
                social_matches: socialMatch.results,
                escalated_severity: severity,
              },
            });
          }
        } catch (socialErr) {
          // Non-fatal — social cross-ref is best-effort
          console.warn(`[sentinel] Social cross-ref error for ${threat.id}:`, socialErr);
        }
      }

      try {
        await env.DB.prepare(
          `UPDATE threats SET confidence_score = ?, severity = COALESCE(severity, ?), threat_type = ? WHERE id = ?`
        ).bind(confidence, severity, threatType, threat.id).run();
        itemsUpdated++;
      } catch (err) {
        console.error(`[sentinel] update failed for ${threat.id}:`, err);
      }
    }

    console.log(`[sentinel] Processing complete: processed=${itemsProcessed}, updated=${itemsUpdated}, haiku_ok=${haikuSuccesses}, haiku_fail=${haikuFailures}, impersonations=${impersonationsFound}`);

    // Always generate a summary output so agent_outputs gets populated
    outputs.push({
      type: "classification",
      summary: itemsProcessed > 0
        ? `Sentinel classified ${itemsUpdated} threats (${itemsProcessed} processed, ${impersonationsFound} impersonations, haiku=${haikuSuccesses}/${haikuFailures})`
        : `Sentinel found 0 unclassified threats (${totalCount?.n ?? 0} total in DB, ${nullCount?.n ?? 0} with NULL confidence)`,
      severity: "info",
      details: {
        processed: itemsProcessed,
        updated: itemsUpdated,
        impersonationsFound,
        haikuSuccesses,
        haikuFailures,
        totalThreats: totalCount?.n ?? 0,
        nullConfidenceThreats: nullCount?.n ?? 0,
        anthropicApiConfigured: !!env.ANTHROPIC_API_KEY,
      },
    });

    // ─── APT pattern detection (if batch >= 10 threats) ─────────
    let aptHits = 0;
    if (itemsProcessed >= 10) {
      try {
        const recentDomains = threats.results
          .filter(t => t.malicious_domain)
          .map(t => t.malicious_domain)
          .slice(0, 30);
        if (recentDomains.length >= 10) {
          const { callHaikuRaw } = await import("../lib/haiku");
          const aptResult = await callHaikuRaw(env,
            "You detect state-sponsored phishing patterns. Reply ONLY with valid JSON array, no markdown.",
            `Given these new threat domains: ${JSON.stringify(recentDomains)}. Do any match known state-sponsored phishing patterns (typosquats of government/military/financial domains)? Reply JSON: [{domain, apt_pattern, confidence: "high"|"medium"|"low", notes}]. Only include high/medium confidence. Empty array if none.`
          );
          if (aptResult.success && aptResult.text) {
            if (aptResult.tokens_used) totalTokens += aptResult.tokens_used;
            const jsonMatch = aptResult.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const hits = JSON.parse(jsonMatch[0]) as Array<{
                domain: string; apt_pattern: string; confidence: string; notes: string;
              }>;
              for (const hit of hits) {
                if (hit.confidence !== 'high' && hit.confidence !== 'medium') continue;
                aptHits++;
                // Escalate matching threats
                const matchingThreat = threats.results.find(t => t.malicious_domain === hit.domain);
                if (matchingThreat) {
                  await env.DB.prepare(
                    "UPDATE threats SET severity = 'critical' WHERE id = ? AND severity != 'critical'"
                  ).bind(matchingThreat.id).run();
                }
                outputs.push({
                  type: "classification",
                  summary: `**APT Pattern Detected** — ${hit.domain} matches ${hit.apt_pattern} pattern (${hit.confidence} confidence). ${hit.notes}`,
                  severity: "critical",
                  details: { domain: hit.domain, apt_pattern: hit.apt_pattern, confidence: hit.confidence },
                });
              }
            }
          }
        }
      } catch (aptErr) {
        console.error("[sentinel] APT detection error:", aptErr);
      }
    }

    console.log(`[sentinel] agentOutputs to persist: ${outputs.length} entries, apt_hits=${aptHits}`);
    console.log("[sentinel] === DONE ===");

    return {
      itemsProcessed,
      itemsCreated: 0,
      itemsUpdated,
      output: { classified: itemsUpdated, impersonationsFound, aptHits },
      model,
      tokensUsed: totalTokens,
      agentOutputs: outputs,
    };
  },
};

// ─── Social Assessment ───────────────────────────────────────

interface SocialAssessmentRow {
  id: string;
  brand_id: string;
  platform: string;
  handle_checked: string;
  suspicious_account_url: string | null;
  suspicious_account_name: string | null;
  impersonation_score: number;
  impersonation_signals: string;
  severity: string;
  brand_name: string;
  domain: string;
  official_handles: string | null;
}

interface SocialAssessmentAI {
  confirmed_impersonation: boolean;
  confidence: number;
  reasoning: string;
  recommended_action: string;
  evidence_summary: string | null;
}

/**
 * AI-assess open HIGH/CRITICAL social monitoring results that lack an ai_assessment.
 * Called by the cron orchestrator after runSocialMonitorBatch completes.
 * Uses the same callAnthropic pattern as the main sentinel classification loop.
 */
export async function runSentinelSocialAssessment(env: Env): Promise<void> {
  console.log("[sentinel-social] === STARTING ===");

  // Fetch unassessed HIGH/CRITICAL results
  const rows = await env.DB.prepare(`
    SELECT smr.*, bp.brand_name, bp.domain, bp.official_handles
    FROM social_monitor_results smr
    JOIN brand_profiles bp ON bp.id = smr.brand_id
    WHERE smr.severity IN ('HIGH', 'CRITICAL')
      AND smr.ai_assessment IS NULL
      AND smr.status = 'open'
    ORDER BY smr.created_at DESC
    LIMIT 20
  `).all<SocialAssessmentRow>();

  console.log(`[sentinel-social] Found ${rows.results.length} unassessed HIGH/CRITICAL results`);
  if (rows.results.length === 0) {
    console.log("[sentinel-social] === DONE (nothing to assess) ===");
    return;
  }

  let assessed = 0;
  let failed = 0;

  for (const row of rows.results) {
    // Parse official handles to find the one for this platform
    let officialHandles: Record<string, string> = {};
    try { officialHandles = row.official_handles ? JSON.parse(row.official_handles) : {}; } catch { /* ignore */ }
    const officialHandle = officialHandles[row.platform]?.replace(/^@/, "") ?? "not set";

    // Parse impersonation signals into a bullet list
    let signals: string[] = [];
    try { signals = JSON.parse(row.impersonation_signals || "[]"); } catch { /* ignore */ }
    const signalBullets = signals.length > 0
      ? signals.map((s) => `- ${s}`).join("\n")
      : "- (none detected)";

    const systemPrompt =
      "You are a brand protection analyst. Evaluate whether this social media account is impersonating the brand below.\n" +
      "Respond in JSON only — no preamble, no markdown.";

    const userMessage =
      `BRAND: ${row.brand_name} — ${row.domain}\n` +
      `Official ${row.platform} handle: ${officialHandle}\n\n` +
      `SUSPICIOUS ACCOUNT:\n` +
      `- Handle: ${row.handle_checked}\n` +
      `- Platform: ${row.platform}\n` +
      `- Impersonation score: ${Math.round(row.impersonation_score * 100)}%\n` +
      `- Signals detected:\n${signalBullets}\n` +
      `- Follower count: unknown\n` +
      `- Account age: unknown days\n` +
      `- Verified: no\n\n` +
      `{\n` +
      `  "confirmed_impersonation": true | false,\n` +
      `  "confidence": 0.0-1.0,\n` +
      `  "reasoning": "1-2 sentence plain English assessment",\n` +
      `  "recommended_action": "monitor" | "report" | "legal_notice" | "dismiss",\n` +
      `  "evidence_summary": "one paragraph suitable for a platform abuse report, or null if dismiss"\n` +
      `}`;

    // Use classifyThreat's underlying pattern: callAnthropic via the same
    // Anthropic Messages API client with identical error handling
    try {
      const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
      if (!apiKey || apiKey.startsWith("lrx_")) {
        console.error("[sentinel-social] No valid Anthropic API key");
        break;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[sentinel-social] Haiku HTTP ${res.status} for ${row.id}: ${errText.slice(0, 200)}`);
        failed++;
        continue;
      }

      const apiResponse = await res.json() as {
        content: Array<{ type: string; text: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };

      const textBlock = apiResponse.content.find((b) => b.type === "text");
      if (!textBlock) {
        console.error(`[sentinel-social] No text block for ${row.id}`);
        failed++;
        continue;
      }

      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`[sentinel-social] No JSON in response for ${row.id}: ${textBlock.text.slice(0, 200)}`);
        failed++;
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]) as SocialAssessmentAI;

      // Store result into the four columns added by migration 0035
      await env.DB.prepare(`
        UPDATE social_monitor_results
        SET ai_assessment = ?,
            ai_confidence = ?,
            ai_action = ?,
            ai_evidence_draft = ?
        WHERE id = ?
      `).bind(
        parsed.reasoning,
        parsed.confidence,
        parsed.recommended_action,
        parsed.evidence_summary ?? null,
        row.id,
      ).run();

      assessed++;

      if (assessed <= 3) {
        console.log(`[sentinel-social] Assessed ${row.id}: confidence=${parsed.confidence}, action=${parsed.recommended_action}, impersonation=${parsed.confirmed_impersonation}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[sentinel-social] Error assessing ${row.id}: ${errMsg}`);
      failed++;
    }
  }

  console.log(`[sentinel-social] Processing complete: total=${rows.results.length}, assessed=${assessed}, failed=${failed}`);
  console.log("[sentinel-social] === DONE ===");
}

function ruleBasedClassify(
  sourceFeed: string,
  threatType: string,
): { confidence: number; severity: string } {
  const highConfidence = ["phishtank", "threatfox", "feodo", "cisa_kev"];
  const medConfidence = ["urlhaus", "openphish"];
  const socialSources = ["tweetfeed", "mastodon_ioc"];

  let confidence = 60;
  if (highConfidence.includes(sourceFeed)) confidence = 90;
  else if (medConfidence.includes(sourceFeed)) confidence = 80;
  else if (socialSources.includes(sourceFeed)) confidence = 70;

  let severity = "medium";
  if (threatType === "malware_distribution" || threatType === "credential_harvesting") severity = "high";
  if (threatType === "c2" || threatType === "botnet") severity = "critical";
  if (sourceFeed === "feodo") severity = "critical";
  if (sourceFeed === "cisa_kev") severity = "critical";

  return { confidence, severity };
}
