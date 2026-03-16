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

    console.log("[sentinel] agentOutputs to persist:", outputs.length, "entries");
    console.log("[sentinel] === DONE ===");

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
