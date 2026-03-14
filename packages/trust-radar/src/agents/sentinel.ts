/**
 * Sentinel Agent — Certificate & domain surveillance.
 *
 * Runs on every feed ingestion event. Classifies new threats
 * via Haiku AI and assigns confidence scores + severity.
 * Falls back to rule-based classification when Haiku is unavailable.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { classifyThreat } from "../lib/haiku";

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
        // Fallback: rule-based scoring
        const fb = ruleBasedClassify(threat.source_feed, threat.threat_type);
        confidence = fb.confidence;
        severity = fb.severity;
      }

      try {
        await env.DB.prepare(
          `UPDATE threats SET confidence_score = ?, severity = COALESCE(severity, ?) WHERE id = ?`
        ).bind(confidence, severity, threat.id).run();
        itemsUpdated++;
      } catch (err) {
        console.error(`[sentinel] update failed for ${threat.id}:`, err);
      }
    }

    // Generate summary output if threats were processed
    if (itemsProcessed > 0) {
      outputs.push({
        type: "classification",
        summary: `Sentinel classified ${itemsUpdated} threats (${itemsProcessed} processed)`,
        severity: "info",
        details: { processed: itemsProcessed, updated: itemsUpdated },
      });
    }

    return {
      itemsProcessed,
      itemsCreated: 0,
      itemsUpdated,
      output: { classified: itemsUpdated },
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
  // High-confidence sources
  const highConfidence = ["phishtank", "threatfox", "feodo"];
  const medConfidence = ["urlhaus", "openphish"];

  let confidence = 60;
  if (highConfidence.includes(sourceFeed)) confidence = 90;
  else if (medConfidence.includes(sourceFeed)) confidence = 80;

  let severity = "medium";
  if (threatType === "malware_distribution" || threatType === "credential_harvesting") severity = "high";
  if (sourceFeed === "feodo") severity = "critical"; // botnet C2

  return { confidence, severity };
}
