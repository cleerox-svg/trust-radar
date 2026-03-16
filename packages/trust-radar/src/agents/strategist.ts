/**
 * Strategist Agent — Campaign correlation & clustering intelligence.
 *
 * Runs every 6 hours. Identifies threat campaigns by correlating
 * shared infrastructure (IPs, ASNs, registrars, timing patterns).
 * Creates/updates campaign records in the campaigns table.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { generateCampaignName, checkCostGuard } from "../lib/haiku";

export const strategistAgent: AgentModule = {
  name: "strategist",
  displayName: "Strategist",
  description: "Campaign correlation & clustering intelligence",
  color: "#F472B6",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    // Cost guard: strategist naming is non-critical
    const blocked = await checkCostGuard(env, false);
    if (blocked) {
      return { status: "skipped", itemsProcessed: 0, itemsUpdated: 0, result: { message: blocked } };
    }

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
        const fallbackName = `IP-cluster-${cluster.ip_address.replace(/\./g, "-")}`;

        // Fetch campaign context for AI naming
        const campDomains = await env.DB.prepare(
          `SELECT DISTINCT malicious_domain FROM threats WHERE ip_address = ? AND status = 'active' AND malicious_domain IS NOT NULL LIMIT 10`
        ).bind(cluster.ip_address).all<{ malicious_domain: string }>();
        const campBrands = await env.DB.prepare(
          `SELECT DISTINCT b.name FROM threats t JOIN brands b ON b.id = t.target_brand_id WHERE t.ip_address = ? AND t.status = 'active' LIMIT 5`
        ).bind(cluster.ip_address).all<{ name: string }>();
        const campProviders = await env.DB.prepare(
          `SELECT DISTINCT COALESCE(hp.name, t.hosting_provider_id) AS name FROM threats t LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id WHERE t.ip_address = ? AND t.hosting_provider_id IS NOT NULL LIMIT 3`
        ).bind(cluster.ip_address).all<{ name: string }>();

        // Generate AI name at creation time (fall back to technical ID if Haiku fails)
        let name = fallbackName;
        const nameResult = await generateCampaignName(env, {
          domains: campDomains.results.map(d => d.malicious_domain),
          target_brands: campBrands.results.map(b => b.name),
          threat_types: cluster.types ? cluster.types.split(",") : [],
          providers: campProviders.results.map(p => p.name),
          threat_count: cluster.threat_count,
          ip_count: 1,
        });
        if (nameResult.success && nameResult.data?.name) {
          name = nameResult.data.name;
          console.log(`[strategist] AI-named new IP campaign: "${name}" (IP ${cluster.ip_address})`);
        } else {
          console.log(`[strategist] Haiku naming failed for new IP campaign (IP ${cluster.ip_address}): ${nameResult.error ?? 'no name returned'} — using fallback "${fallbackName}"`);
        }

        // description stores the technical ID; name gets the AI name (or fallback)
        await env.DB.prepare(
          `INSERT INTO campaigns (id, name, description, threat_count, attack_pattern, status)
           VALUES (?, ?, ?, ?, ?, 'active')`
        ).bind(
          campaignId, name, fallbackName, cluster.threat_count,
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
          summary: `New campaign detected: "${name}" — ${cluster.threat_count} threats sharing IP ${cluster.ip_address}`,
          severity: cluster.threat_count >= 10 ? "high" : "medium",
          details: {
            ip: cluster.ip_address,
            threat_count: cluster.threat_count,
            sources: cluster.sources.split(","),
            ai_name: name,
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
      const fallbackName = `Registrar-cluster-${cluster.registrar.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30)}`;

      // Fetch context for AI naming
      const regDomains = await env.DB.prepare(
        `SELECT DISTINCT malicious_domain FROM threats WHERE registrar = ? AND status = 'active' AND malicious_domain IS NOT NULL AND created_at >= datetime('now', '-7 days') LIMIT 10`
      ).bind(cluster.registrar).all<{ malicious_domain: string }>();
      const regBrands = await env.DB.prepare(
        `SELECT DISTINCT b.name FROM threats t JOIN brands b ON b.id = t.target_brand_id WHERE t.registrar = ? AND t.status = 'active' AND t.created_at >= datetime('now', '-7 days') LIMIT 5`
      ).bind(cluster.registrar).all<{ name: string }>();

      let name = fallbackName;
      const nameResult = await generateCampaignName(env, {
        domains: regDomains.results.map(d => d.malicious_domain),
        target_brands: regBrands.results.map(b => b.name),
        threat_types: [],
        providers: [cluster.registrar],
        threat_count: cluster.threat_count,
      });
      if (nameResult.success && nameResult.data?.name) {
        name = nameResult.data.name;
        console.log(`[strategist] AI-named new registrar campaign: "${name}" (${cluster.registrar})`);
      } else {
        console.log(`[strategist] Haiku naming failed for new registrar campaign (${cluster.registrar}): ${nameResult.error ?? 'no name returned'} — using fallback "${fallbackName}"`);
      }

      await env.DB.prepare(
        `INSERT INTO campaigns (id, name, description, threat_count, attack_pattern, status)
         VALUES (?, ?, ?, ?, ?, 'active')`
      ).bind(
        campaignId, name, fallbackName, cluster.threat_count,
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
        summary: `Registrar campaign: "${name}" — ${cluster.threat_count} threats via ${cluster.registrar}`,
        severity: "medium",
        details: { registrar: cluster.registrar, count: cluster.threat_count, ai_name: name },
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

    // ─── Retroactive rename: fix campaigns with technical names ───
    const technicalCampaigns = await env.DB.prepare(
      `SELECT id, name, attack_pattern FROM campaigns
       WHERE name LIKE 'IP-cluster-%' OR name LIKE 'Registrar-cluster-%'
       LIMIT 5`
    ).all<{ id: string; name: string; attack_pattern: string | null }>();

    console.log(`[strategist] Retroactive rename: ${technicalCampaigns.results.length} campaigns need renaming`);

    let renameSuccessCount = 0;
    let renameFailCount = 0;
    let firstRenameResult: { campaign: string; success: boolean; newName?: string; error?: string } | null = null;

    for (const camp of technicalCampaigns.results) {
      // Fetch context from linked threats
      const campDomains = await env.DB.prepare(
        `SELECT DISTINCT malicious_domain FROM threats WHERE campaign_id = ? AND malicious_domain IS NOT NULL LIMIT 10`
      ).bind(camp.id).all<{ malicious_domain: string }>();
      const campBrands = await env.DB.prepare(
        `SELECT DISTINCT b.name FROM threats t JOIN brands b ON b.id = t.target_brand_id WHERE t.campaign_id = ? LIMIT 5`
      ).bind(camp.id).all<{ name: string }>();
      const campProviders = await env.DB.prepare(
        `SELECT DISTINCT COALESCE(hp.name, t.hosting_provider_id) AS name FROM threats t LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id WHERE t.campaign_id = ? AND t.hosting_provider_id IS NOT NULL LIMIT 3`
      ).bind(camp.id).all<{ name: string }>();
      const campTypes = await env.DB.prepare(
        `SELECT DISTINCT threat_type FROM threats WHERE campaign_id = ? AND threat_type IS NOT NULL LIMIT 5`
      ).bind(camp.id).all<{ threat_type: string }>();
      const campCount = await env.DB.prepare(
        `SELECT COUNT(*) as n FROM threats WHERE campaign_id = ?`
      ).bind(camp.id).first<{ n: number }>();

      console.log(`[strategist] Rename context for "${camp.name}": domains=${campDomains.results.length}, brands=${campBrands.results.length}, providers=${campProviders.results.length}, types=${campTypes.results.length}, threats=${campCount?.n ?? 0}`);

      const nameResult = await generateCampaignName(env, {
        domains: campDomains.results.map(d => d.malicious_domain),
        target_brands: campBrands.results.map(b => b.name),
        threat_types: campTypes.results.map(t => t.threat_type),
        providers: campProviders.results.map(p => p.name),
        threat_count: campCount?.n ?? 0,
      });

      // Log first rename attempt in detail
      if (!firstRenameResult) {
        console.log(`[strategist] First rename Haiku response: success=${nameResult.success}, data=${JSON.stringify(nameResult.data)}, error=${nameResult.error ?? 'none'}, tokens=${nameResult.tokens_used ?? 0}`);
        firstRenameResult = {
          campaign: camp.name,
          success: nameResult.success,
          newName: nameResult.data?.name,
          error: nameResult.error,
        };
      }

      if (nameResult.success && nameResult.data?.name) {
        await env.DB.prepare(
          `UPDATE campaigns SET name = ?, description = ? WHERE id = ?`
        ).bind(nameResult.data.name, camp.name, camp.id).run();
        itemsUpdated++;
        renameSuccessCount++;
        console.log(`[strategist] Renamed campaign "${camp.name}" → "${nameResult.data.name}"`);
      } else {
        renameFailCount++;
        console.log(`[strategist] Rename FAILED for "${camp.name}": ${nameResult.error ?? 'no name in response'}`);
      }
    }

    // Emit diagnostic output for rename telemetry
    outputs.push({
      type: "diagnostic",
      summary: `Retroactive rename: ${technicalCampaigns.results.length} candidates, ${renameSuccessCount} renamed, ${renameFailCount} failed`,
      severity: renameFailCount > 0 ? "medium" : technicalCampaigns.results.length > 0 ? "info" : "info",
      details: {
        campaigns_needing_rename: technicalCampaigns.results.length,
        rename_success: renameSuccessCount,
        rename_failed: renameFailCount,
        first_rename_attempt: firstRenameResult,
      },
    });

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
