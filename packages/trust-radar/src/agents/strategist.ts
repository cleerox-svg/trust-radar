/**
 * Strategist Agent — Campaign correlation & clustering intelligence.
 *
 * Runs every 6 hours. Identifies threat campaigns by correlating
 * shared infrastructure (IPs, ASNs, registrars, timing patterns).
 * Creates/updates campaign records in the campaigns table.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";

export const strategistAgent: AgentModule = {
  name: "strategist",
  displayName: "Strategist",
  description: "Campaign correlation & clustering intelligence",
  color: "#F472B6",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    let itemsProcessed = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const outputs: AgentOutputEntry[] = [];

    // ─── Strategy 1: IP-based clustering ────────────────────────
    // Find IPs hosting 3+ active threats (likely infrastructure)
    const ipClusters = await env.DB.prepare(
      `SELECT ip_address, COUNT(*) as threat_count,
              GROUP_CONCAT(DISTINCT source_feed) as sources,
              GROUP_CONCAT(DISTINCT threat_type) as types
       FROM threats
       WHERE ip_address IS NOT NULL AND status = 'active' AND campaign_id IS NULL
       GROUP BY ip_address
       HAVING COUNT(*) >= 3
       ORDER BY threat_count DESC LIMIT 20`
    ).all<{
      ip_address: string; threat_count: number;
      sources: string; types: string;
    }>();

    for (const cluster of ipClusters.results) {
      itemsProcessed++;

      // Check if a campaign already exists for this IP
      const existing = await env.DB.prepare(
        `SELECT id FROM campaigns WHERE attack_pattern LIKE ?`
      ).bind(`%${cluster.ip_address}%`).first<{ id: string }>();

      let campaignId: string;

      if (existing) {
        campaignId = existing.id;
        // Update existing campaign
        await env.DB.prepare(
          `UPDATE campaigns SET
             last_seen = datetime('now'),
             threat_count = (SELECT COUNT(*) FROM threats WHERE campaign_id = ?),
             status = 'active'
           WHERE id = ?`
        ).bind(campaignId, campaignId).run();
        itemsUpdated++;
      } else {
        // Create new campaign
        campaignId = crypto.randomUUID();
        const name = `IP-cluster-${cluster.ip_address.replace(/\./g, "-")}`;
        await env.DB.prepare(
          `INSERT INTO campaigns (id, name, threat_count, attack_pattern, status)
           VALUES (?, ?, ?, ?, 'active')`
        ).bind(
          campaignId, name, cluster.threat_count,
          JSON.stringify({
            type: "shared_ip",
            ip: cluster.ip_address,
            sources: cluster.sources,
            threat_types: cluster.types,
          }),
        ).run();
        itemsCreated++;

        outputs.push({
          type: "correlation",
          summary: `New campaign detected: ${cluster.threat_count} threats sharing IP ${cluster.ip_address}`,
          severity: cluster.threat_count >= 10 ? "high" : "medium",
          details: {
            ip: cluster.ip_address,
            threat_count: cluster.threat_count,
            sources: cluster.sources.split(","),
          },
        });
      }

      // Assign unlinked threats to this campaign
      await env.DB.prepare(
        `UPDATE threats SET campaign_id = ?
         WHERE ip_address = ? AND campaign_id IS NULL AND status = 'active'`
      ).bind(campaignId, cluster.ip_address).run();
    }

    // ─── Strategy 2: Domain-pattern clustering ──────────────────
    // Find domains with similar patterns (same registrar + recent creation)
    const registrarClusters = await env.DB.prepare(
      `SELECT registrar, COUNT(*) as threat_count
       FROM threats
       WHERE registrar IS NOT NULL AND status = 'active' AND campaign_id IS NULL
         AND created_at >= datetime('now', '-7 days')
       GROUP BY registrar
       HAVING COUNT(*) >= 5
       ORDER BY threat_count DESC LIMIT 10`
    ).all<{ registrar: string; threat_count: number }>();

    for (const cluster of registrarClusters.results) {
      itemsProcessed++;

      const campaignId = crypto.randomUUID();
      const name = `Registrar-cluster-${cluster.registrar.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30)}`;

      await env.DB.prepare(
        `INSERT INTO campaigns (id, name, threat_count, attack_pattern, status)
         VALUES (?, ?, ?, ?, 'active')`
      ).bind(
        campaignId, name, cluster.threat_count,
        JSON.stringify({ type: "shared_registrar", registrar: cluster.registrar }),
      ).run();

      await env.DB.prepare(
        `UPDATE threats SET campaign_id = ?
         WHERE registrar = ? AND campaign_id IS NULL AND status = 'active'
           AND created_at >= datetime('now', '-7 days')`
      ).bind(campaignId, cluster.registrar).run();

      itemsCreated++;

      outputs.push({
        type: "correlation",
        summary: `Registrar campaign: ${cluster.threat_count} threats via ${cluster.registrar}`,
        severity: "medium",
        details: { registrar: cluster.registrar, count: cluster.threat_count },
      });
    }

    // ─── Update campaign brand/provider counts ──────────────────
    await env.DB.prepare(`
      UPDATE campaigns SET
        brand_count = COALESCE(
          (SELECT COUNT(DISTINCT target_brand_id) FROM threats WHERE campaign_id = campaigns.id AND target_brand_id IS NOT NULL), 0
        ),
        provider_count = COALESCE(
          (SELECT COUNT(DISTINCT hosting_provider_id) FROM threats WHERE campaign_id = campaigns.id AND hosting_provider_id IS NOT NULL), 0
        )
    `).run();

    // Mark stale campaigns as dormant
    await env.DB.prepare(`
      UPDATE campaigns SET status = 'dormant'
      WHERE status = 'active'
        AND last_seen < datetime('now', '-30 days')
    `).run();

    // Always produce at least one output for diagnostics
    if (outputs.length === 0) {
      // Count eligible threats for clustering
      const eligibleIp = await env.DB.prepare(
        `SELECT COUNT(DISTINCT ip_address) as n FROM threats WHERE ip_address IS NOT NULL AND status = 'active' AND campaign_id IS NULL`
      ).first<{ n: number }>();
      const eligibleReg = await env.DB.prepare(
        `SELECT COUNT(DISTINCT registrar) as n FROM threats WHERE registrar IS NOT NULL AND status = 'active' AND campaign_id IS NULL AND created_at >= datetime('now', '-7 days')`
      ).first<{ n: number }>();
      const totalCampaigns = await env.DB.prepare(
        `SELECT COUNT(*) as n FROM campaigns`
      ).first<{ n: number }>();

      outputs.push({
        type: "correlation",
        summary: `Strategist: ${ipClusters.results.length} IP clusters (need 3+), ${registrarClusters.results.length} registrar clusters (need 5+). ${totalCampaigns?.n ?? 0} total campaigns.`,
        severity: "info",
        details: {
          ipClustersFound: ipClusters.results.length,
          registrarClustersFound: registrarClusters.results.length,
          eligibleUniqueIPs: eligibleIp?.n ?? 0,
          eligibleUniqueRegistrars: eligibleReg?.n ?? 0,
          totalCampaigns: totalCampaigns?.n ?? 0,
          campaignsCreated: itemsCreated,
          campaignsUpdated: itemsUpdated,
        },
      });
    }

    console.log(`[strategist] done: processed=${itemsProcessed}, created=${itemsCreated}, updated=${itemsUpdated}, ipClusters=${ipClusters.results.length}, regClusters=${registrarClusters.results.length}`);

    return {
      itemsProcessed,
      itemsCreated,
      itemsUpdated,
      output: {
        ipClusters: ipClusters.results.length,
        registrarClusters: registrarClusters.results.length,
        campaignsCreated: itemsCreated,
        campaignsUpdated: itemsUpdated,
      },
      agentOutputs: outputs,
    };
  },
};
