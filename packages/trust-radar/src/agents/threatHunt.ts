/**
 * Threat Hunt Agent — Correlate across feeds to find campaigns.
 * Cross-references threats by shared IPs, domains, and infrastructure.
 */

import type { AgentModule, AgentContext, AgentResult } from "../lib/agentRunner";

export const threatHuntAgent: AgentModule = {
  name: "threat-hunt",
  displayName: "Threat Hunt",
  description: "Correlate across feeds to find campaigns",
  color: "#818CF8",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const hoursBack = (ctx.input.hoursBack as number) ?? 6;

    // Find IPs that appear in multiple threats from different sources
    const sharedIPs = await ctx.env.DB.prepare(
      `SELECT ip_address, COUNT(DISTINCT source) as source_count, COUNT(*) as threat_count,
              GROUP_CONCAT(DISTINCT source) as sources
       FROM threats
       WHERE ip_address IS NOT NULL
         AND created_at >= datetime('now', ? || ' hours')
       GROUP BY ip_address
       HAVING source_count >= 2
       ORDER BY threat_count DESC LIMIT 50`
    ).bind(-hoursBack).all<{
      ip_address: string; source_count: number; threat_count: number; sources: string;
    }>();

    // Find domains with multiple threat types
    const sharedDomains = await ctx.env.DB.prepare(
      `SELECT domain, COUNT(DISTINCT type) as type_count, COUNT(*) as threat_count,
              GROUP_CONCAT(DISTINCT type) as types
       FROM threats
       WHERE domain IS NOT NULL
         AND created_at >= datetime('now', ? || ' hours')
       GROUP BY domain
       HAVING type_count >= 2
       ORDER BY threat_count DESC LIMIT 50`
    ).bind(-hoursBack).all<{
      domain: string; type_count: number; threat_count: number; types: string;
    }>();

    let clustersFound = 0;

    // Escalate multi-source IP threats
    for (const row of sharedIPs.results) {
      if (row.source_count >= 3) {
        await ctx.env.DB.prepare(
          `UPDATE threats SET severity = 'critical', tags = json_insert(COALESCE(tags, '[]'), '$[#]', 'multi-source-ip')
           WHERE ip_address = ? AND severity != 'critical'`
        ).bind(row.ip_address).run();
        clustersFound++;
      }
    }

    // Escalate multi-type domain threats
    for (const row of sharedDomains.results) {
      if (row.type_count >= 2) {
        await ctx.env.DB.prepare(
          `UPDATE threats SET severity = CASE WHEN severity = 'low' THEN 'high' WHEN severity = 'medium' THEN 'high' ELSE severity END,
                  tags = json_insert(COALESCE(tags, '[]'), '$[#]', 'multi-type-domain')
           WHERE domain = ? AND severity IN ('low', 'medium')`
        ).bind(row.domain).run();
        clustersFound++;
      }
    }

    return {
      itemsProcessed: sharedIPs.results.length + sharedDomains.results.length,
      itemsCreated: 0,
      itemsUpdated: clustersFound,
      output: {
        sharedIPs: sharedIPs.results.length,
        sharedDomains: sharedDomains.results.length,
        clustersFound,
        hoursBack,
      },
    };
  },
};
