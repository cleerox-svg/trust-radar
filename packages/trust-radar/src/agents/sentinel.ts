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
import { classifyThreat } from "../lib/haiku";

// ─── Homoglyph & brand-squatting detection ──────────────────────

const BRAND_KEYWORDS = [
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

function detectBrandSquatting(domain: string): string | null {
  const cleaned = domain.toLowerCase().replace(/[.-]/g, "");
  for (const brand of BRAND_KEYWORDS) {
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

    let itemsProcessed = 0;
    let itemsUpdated = 0;
    let impersonationsFound = 0;
    const outputs: AgentOutputEntry[] = [];
    let totalTokens = 0;
    let model: string | undefined;

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
        confidence = result.data.confidence;
        severity = result.data.severity;
        if (result.tokens_used) totalTokens += result.tokens_used;
        if (result.model) model = result.model;
      } else {
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
        const squattedBrand = detectBrandSquatting(domain);

        if (hasHomoglyphs || squattedBrand) {
          impersonationsFound++;
          // Escalate severity for impersonation threats
          if (severity === "low" || severity === "medium") severity = "high";
          if (threatType === "unknown") threatType = "impersonation";
          // Boost confidence for impersonation detections
          confidence = Math.min(95, confidence + 10);
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

    // Generate summary output if threats were processed
    if (itemsProcessed > 0) {
      outputs.push({
        type: "classification",
        summary: `Sentinel classified ${itemsUpdated} threats (${itemsProcessed} processed, ${impersonationsFound} impersonations detected)`,
        severity: "info",
        details: { processed: itemsProcessed, updated: itemsUpdated, impersonationsFound },
      });
    }

    return {
      itemsProcessed,
      itemsCreated: 0,
      itemsUpdated,
      output: { classified: itemsUpdated, impersonationsFound },
      model,
      tokensUsed: totalTokens,
      agentOutputs: outputs,
    };
  },
};

function ruleBasedClassify(
  sourceFeed: string,
  threatType: string,
): { confidence: number; severity: string } {
  // High-confidence sources (merged from triage agent)
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
  if (sourceFeed === "feodo") severity = "critical"; // botnet C2
  if (sourceFeed === "cisa_kev") severity = "critical"; // known exploited vulns

  return { confidence, severity };
}
