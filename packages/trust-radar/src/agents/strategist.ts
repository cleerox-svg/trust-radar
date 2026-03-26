/**
 * Strategist Agent — Campaign correlation & clustering intelligence.
 *
 * Runs every 6 hours. Identifies threat campaigns by correlating
 * shared infrastructure (IPs, ASNs, registrars, timing patterns).
 * Creates/updates campaign records in the campaigns table.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { generateCampaignName, checkCostGuard } from "../lib/haiku";
import { createNotification } from "../lib/notifications";

export const strategistAgent: AgentModule = {
  name: "strategist",
  displayName: "Strategist",
  description: "Campaign correlation & clustering intelligence",
  color: "#8A8F9C",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    // Cost guard: strategist naming is non-critical
    const blocked = await checkCostGuard(env, false);
    if (blocked) {
      console.warn(`[strategist] ${blocked}`);
      return { itemsProcessed: 0, itemsCreated: 0, itemsUpdated: 0, output: { skipped: true, reason: blocked } };
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
        // Get old count before update
        const oldCount = await env.DB.prepare(
          `SELECT threat_count FROM campaigns WHERE id = ?`
        ).bind(campaignId).first<{ threat_count: number }>();
        // Update existing campaign
        await env.DB.prepare(
          `UPDATE campaigns SET
             last_seen = datetime('now'),
             threat_count = (SELECT COUNT(*) FROM threats WHERE campaign_id = ?),
             status = 'active'
           WHERE id = ?`
        ).bind(campaignId, campaignId).run();
        itemsUpdated++;
        // Get new count and notify on escalation
        const newCount = await env.DB.prepare(
          `SELECT name, threat_count FROM campaigns WHERE id = ?`
        ).bind(campaignId).first<{ name: string; threat_count: number }>();
        const addedThreats = (newCount?.threat_count ?? 0) - (oldCount?.threat_count ?? 0);
        if (addedThreats > 0 && newCount) {
          try {
            await createNotification(env.DB, {
              type: 'campaign_escalation',
              severity: 'medium',
              title: `Campaign growing: ${newCount.name}`,
              message: `${addedThreats} new threats added to campaign`,
              link: `/campaigns/${campaignId}`,
              metadata: { campaign_id: campaignId },
            });
          } catch (e) {
            console.error(`[strategist] escalation notification error:`, e);
          }
        }
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

        // Notify: new campaign identified
        try {
          await createNotification(env.DB, {
            type: 'agent_milestone',
            severity: 'medium',
            title: 'New campaign identified',
            message: `Strategist found: ${name}`,
            link: `/campaigns/${campaignId}`,
            metadata: { campaign_id: campaignId },
          });
        } catch (e) {
          console.error(`[strategist] notification error:`, e);
        }
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

    // Pre-fetch context for all technical campaigns to avoid N+1
    const techCampIds = technicalCampaigns.results.map(c => c.id);
    const techCampDomainsMap = new Map<string, string[]>();
    const techCampBrandsMap = new Map<string, string[]>();
    const techCampProvidersMap = new Map<string, string[]>();
    const techCampTypesMap = new Map<string, string[]>();
    const techCampCountMap = new Map<string, number>();

    if (techCampIds.length > 0) {
      const placeholders = techCampIds.map(() => '?').join(',');

      const [domainsRes, brandsRes, providersRes, typesRes, countsRes] = await Promise.all([
        env.DB.prepare(
          `SELECT campaign_id, malicious_domain FROM threats WHERE campaign_id IN (${placeholders}) AND malicious_domain IS NOT NULL GROUP BY campaign_id, malicious_domain`
        ).bind(...techCampIds).all<{ campaign_id: string; malicious_domain: string }>(),
        env.DB.prepare(
          `SELECT DISTINCT t.campaign_id, b.name FROM threats t JOIN brands b ON b.id = t.target_brand_id WHERE t.campaign_id IN (${placeholders})`
        ).bind(...techCampIds).all<{ campaign_id: string; name: string }>(),
        env.DB.prepare(
          `SELECT DISTINCT t.campaign_id, COALESCE(hp.name, t.hosting_provider_id) AS name FROM threats t LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id WHERE t.campaign_id IN (${placeholders}) AND t.hosting_provider_id IS NOT NULL`
        ).bind(...techCampIds).all<{ campaign_id: string; name: string }>(),
        env.DB.prepare(
          `SELECT DISTINCT campaign_id, threat_type FROM threats WHERE campaign_id IN (${placeholders}) AND threat_type IS NOT NULL`
        ).bind(...techCampIds).all<{ campaign_id: string; threat_type: string }>(),
        env.DB.prepare(
          `SELECT campaign_id, COUNT(*) as n FROM threats WHERE campaign_id IN (${placeholders}) GROUP BY campaign_id`
        ).bind(...techCampIds).all<{ campaign_id: string; n: number }>(),
      ]);

      for (const row of domainsRes.results) {
        const arr = techCampDomainsMap.get(row.campaign_id) ?? [];
        arr.push(row.malicious_domain);
        techCampDomainsMap.set(row.campaign_id, arr);
      }
      for (const row of brandsRes.results) {
        const arr = techCampBrandsMap.get(row.campaign_id) ?? [];
        arr.push(row.name);
        techCampBrandsMap.set(row.campaign_id, arr);
      }
      for (const row of providersRes.results) {
        const arr = techCampProvidersMap.get(row.campaign_id) ?? [];
        arr.push(row.name);
        techCampProvidersMap.set(row.campaign_id, arr);
      }
      for (const row of typesRes.results) {
        const arr = techCampTypesMap.get(row.campaign_id) ?? [];
        arr.push(row.threat_type);
        techCampTypesMap.set(row.campaign_id, arr);
      }
      for (const row of countsRes.results) {
        techCampCountMap.set(row.campaign_id, row.n);
      }
    }

    let renameSuccessCount = 0;
    let renameFailCount = 0;
    let firstRenameResult: { campaign: string; success: boolean; newName?: string; error?: string } | null = null;

    for (const camp of technicalCampaigns.results) {
      const campDomains = (techCampDomainsMap.get(camp.id) ?? []).slice(0, 10);
      const campBrands = (techCampBrandsMap.get(camp.id) ?? []).slice(0, 5);
      const campProviders = (techCampProvidersMap.get(camp.id) ?? []).slice(0, 3);
      const campTypes = (techCampTypesMap.get(camp.id) ?? []).slice(0, 5);
      const campCount = techCampCountMap.get(camp.id) ?? 0;

      const nameResult = await generateCampaignName(env, {
        domains: campDomains,
        target_brands: campBrands,
        threat_types: campTypes,
        providers: campProviders,
        threat_count: campCount,
      });

      if (!firstRenameResult) {
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
      } else {
        renameFailCount++;
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

    // ─── Coordination detection via Haiku ─────────────────────────
    let coordinationFound = 0;
    try {
      const activeCampaigns = await env.DB.prepare(
        `SELECT c.id, c.name, c.threat_count,
                GROUP_CONCAT(DISTINCT t.target_brand_id) as brand_ids,
                GROUP_CONCAT(DISTINCT t.hosting_provider_id) as provider_ids
         FROM campaigns c
         LEFT JOIN threats t ON t.campaign_id = c.id
         WHERE c.status = 'active'
         GROUP BY c.id
         ORDER BY c.threat_count DESC LIMIT 20`
      ).all<{ id: string; name: string; threat_count: number; brand_ids: string | null; provider_ids: string | null }>();

      if (activeCampaigns.results.length >= 5) {
        const blocked = await checkCostGuard(env, false);
        if (!blocked) {
          const campaignSummary = activeCampaigns.results.map(c => ({
            id: c.id, name: c.name, threats: c.threat_count,
            brands: c.brand_ids?.split(',').filter(Boolean).length ?? 0,
            providers: c.provider_ids?.split(',').filter(Boolean).length ?? 0,
          }));

          const { callHaikuRaw } = await import("../lib/haiku");
          const coordResult = await callHaikuRaw(env,
            "You detect coordinated phishing attack patterns. Reply ONLY with valid JSON array, no markdown.",
            `Given these active phishing campaigns with their target brands and hosting providers:\n${JSON.stringify(campaignSummary)}\nIdentify any that appear coordinated (same actor, infrastructure reuse, timing patterns). Reply JSON array: [{campaign_ids: string[], coordination_type: string, confidence: "high"|"medium", evidence: string}]. Empty array if none.`
          );

          if (coordResult.success && coordResult.text) {
            const jsonMatch = coordResult.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const coordinations = JSON.parse(jsonMatch[0]) as Array<{
                campaign_ids: string[]; coordination_type: string; confidence: string; evidence: string;
              }>;
              for (const coord of coordinations) {
                if (coord.confidence !== 'high' && coord.confidence !== 'medium') continue;
                coordinationFound++;
                outputs.push({
                  type: "correlation",
                  summary: `**Coordinated Attack Detected** — ${coord.coordination_type}: ${coord.campaign_ids.length} campaigns appear linked. ${coord.evidence}`,
                  severity: "high",
                  details: {
                    campaign_ids: coord.campaign_ids,
                    coordination_type: coord.coordination_type,
                    confidence: coord.confidence,
                  },
                });
                // Store as agent_output type='correlation'
                await env.DB.prepare(
                  `INSERT INTO agent_outputs (id, agent_id, type, summary, severity, details, created_at)
                   VALUES (?, 'strategist', 'correlation', ?, 'high', ?, datetime('now'))`
                ).bind(
                  crypto.randomUUID(),
                  `Coordinated: ${coord.coordination_type} — ${coord.campaign_ids.length} campaigns`,
                  JSON.stringify(coord),
                ).run();
              }
            }
          }
        }
      }
    } catch (coordErr) {
      console.error("[strategist] coordination detection error:", coordErr);
    }

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
