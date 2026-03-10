/**
 * Campaign Correlator Agent — Cluster threats by shared infrastructure.
 * Groups threats that share IPs, nameservers, registrars, or ASNs.
 */

import type { AgentModule, AgentContext, AgentResult } from "../lib/agentRunner";

export const campaignCorrelatorAgent: AgentModule = {
  name: "campaign-correlator",
  displayName: "Campaign Correlator",
  description: "Cluster threats by shared infrastructure",
  color: "#A78BFA",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const hoursBack = (ctx.input.hoursBack as number) ?? 24;

    // Find IP-based clusters (3+ threats sharing an IP)
    const ipClusters = await ctx.env.DB.prepare(
      `SELECT ip_address, COUNT(*) as cnt, GROUP_CONCAT(id) as threat_ids,
              GROUP_CONCAT(DISTINCT type) as types, GROUP_CONCAT(DISTINCT source) as sources
       FROM threats
       WHERE ip_address IS NOT NULL
         AND created_at >= datetime('now', ? || ' hours')
       GROUP BY ip_address
       HAVING cnt >= 3
       ORDER BY cnt DESC LIMIT 20`
    ).bind(-hoursBack).all<{
      ip_address: string; cnt: number; threat_ids: string; types: string; sources: string;
    }>();

    // Find domain-based clusters (shared registrar patterns)
    const domainClusters = await ctx.env.DB.prepare(
      `SELECT domain, COUNT(*) as cnt, GROUP_CONCAT(DISTINCT type) as types
       FROM threats
       WHERE domain IS NOT NULL
         AND created_at >= datetime('now', ? || ' hours')
       GROUP BY SUBSTR(domain, INSTR(domain, '.'))
       HAVING cnt >= 3
       ORDER BY cnt DESC LIMIT 20`
    ).bind(-hoursBack).all<{
      domain: string; cnt: number; types: string;
    }>();

    let clustersCreated = 0;

    // Create campaign cluster records for significant IP clusters
    for (const cluster of ipClusters.results) {
      if (cluster.cnt >= 5) {
        const clusterId = crypto.randomUUID();
        await ctx.env.DB.prepare(
          `INSERT OR IGNORE INTO campaign_clusters (id, name, description, indicator_type, indicator_value, threat_count, threat_ids, sources, confidence, created_at)
           VALUES (?, ?, ?, 'ip', ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          clusterId,
          `IP Cluster: ${cluster.ip_address}`,
          `${cluster.cnt} threats sharing IP ${cluster.ip_address}. Types: ${cluster.types}`,
          cluster.ip_address, cluster.cnt, cluster.threat_ids,
          cluster.sources, Math.min(95, 50 + cluster.cnt * 5),
        ).run();
        clustersCreated++;
      }
    }

    return {
      itemsProcessed: ipClusters.results.length + domainClusters.results.length,
      itemsCreated: clustersCreated,
      itemsUpdated: 0,
      output: {
        ipClusters: ipClusters.results.length,
        domainClusters: domainClusters.results.length,
        campaignsIdentified: clustersCreated,
        hoursBack,
      },
    };
  },
};
