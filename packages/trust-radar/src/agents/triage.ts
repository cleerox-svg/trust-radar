/**
 * Triage Agent — Auto-score and prioritize incoming threats.
 * Scans new/unscored threats, assigns severity & confidence scores.
 */

import type { AgentModule, AgentContext, AgentResult } from "../lib/agentRunner";

export const triageAgent: AgentModule = {
  name: "triage",
  displayName: "Triage",
  description: "Auto-score and prioritize incoming threats",
  color: "#22D3EE",
  trigger: "event",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const limit = (ctx.input.limit as number) ?? 100;

    // Fetch unprocessed threats (new status, low confidence)
    const threats = await ctx.env.DB.prepare(
      `SELECT id, type, title, ioc_type, ioc_value, domain, ip_address, source, severity, confidence
       FROM threats WHERE status = 'new' AND confidence <= 30
       ORDER BY created_at DESC LIMIT ?`
    ).bind(limit).all<{
      id: string; type: string; title: string; ioc_type: string | null;
      ioc_value: string | null; domain: string | null; ip_address: string | null;
      source: string; severity: string; confidence: number;
    }>();

    let processed = 0;
    let updated = 0;

    for (const threat of threats.results) {
      processed++;

      // Score based on heuristics
      let confidence = threat.confidence;
      let severity = threat.severity;

      // Boost confidence for known high-quality sources
      const highQualitySources = ["threatfox", "cisa_kev", "phishtank", "feodo"];
      if (highQualitySources.includes(threat.source)) confidence = Math.min(95, confidence + 40);

      // Severity escalation rules
      if (threat.type === "phishing" && threat.domain) severity = "high";
      if (threat.type === "malware" && threat.ioc_type === "hash") severity = "high";
      if (threat.type === "c2" || threat.type === "botnet") severity = "critical";
      if (threat.source === "cisa_kev") severity = "critical";

      // Moderate confidence for social/community sources
      const socialSources = ["tweetfeed", "mastodon_ioc"];
      if (socialSources.includes(threat.source)) confidence = Math.min(70, confidence + 20);

      if (confidence !== threat.confidence || severity !== threat.severity) {
        await ctx.env.DB.prepare(
          `UPDATE threats SET confidence = ?, severity = ?, status = 'triaged', last_seen = datetime('now') WHERE id = ?`
        ).bind(confidence, severity, threat.id).run();
        updated++;
      }
    }

    return {
      itemsProcessed: processed,
      itemsCreated: 0,
      itemsUpdated: updated,
      output: {
        threatsScanned: processed,
        threatsUpdated: updated,
        skipped: processed - updated,
      },
    };
  },
};
