/**
 * Observer Agent — Trend analysis & daily intelligence synthesis.
 *
 * Runs daily. Generates narrative intelligence briefings by analyzing threat
 * trends, brand targeting patterns, provider behavior, and recent agent outputs.
 * Sends context to Haiku for 3-5 professional intelligence briefing items.
 * Writes to agent_outputs for analyst consumption on the HUD and insights panel.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { generateInsight, checkCostGuard } from "../lib/haiku";
import { createNotification } from "../lib/notifications";

export const observerAgent: AgentModule = {
  name: "observer",
  displayName: "Observer",
  description: "Trend analysis & daily intelligence synthesis",
  color: "#FBBF24",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    // Cost guard: observer is non-critical
    const blocked = await checkCostGuard(env, false);
    if (blocked) {
      console.warn(`[observer] ${blocked}`);
      return { itemsProcessed: 0, itemsCreated: 0, itemsUpdated: 0, output: { skipped: true, reason: blocked } };
    }

    let totalTokens = 0;
    let model: string | undefined;
    const outputs: AgentOutputEntry[] = [];

    // ─── Gather threat summary (last 24h) ────────────────────────
    const summary = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_24h,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        COUNT(DISTINCT source_feed) as feed_count,
        COUNT(DISTINCT threat_type) as type_count,
        COUNT(DISTINCT country_code) as country_count
      FROM threats WHERE created_at >= datetime('now', '-24 hours')
    `).first<{
      total_24h: number; critical: number; high: number;
      feed_count: number; type_count: number; country_count: number;
    }>();

    // ─── Top targeted brands (with IDs for linking) ──────────────
    const topBrands = await env.DB.prepare(`
      SELECT b.id, b.name, COUNT(*) as count
      FROM threats t JOIN brands b ON t.target_brand_id = b.id
      WHERE t.created_at >= datetime('now', '-24 hours')
      GROUP BY b.id ORDER BY count DESC LIMIT 10
    `).all<{ id: string; name: string; count: number }>();

    // ─── Top hosting providers ───────────────────────────────────
    const topProviders = await env.DB.prepare(`
      SELECT hp.name, COUNT(*) as count
      FROM threats t JOIN hosting_providers hp ON t.hosting_provider_id = hp.id
      WHERE t.created_at >= datetime('now', '-24 hours')
      GROUP BY hp.name ORDER BY count DESC LIMIT 10
    `).all<{ name: string; count: number }>();

    // ─── Threat type distribution ────────────────────────────────
    const typeBreakdown = await env.DB.prepare(`
      SELECT threat_type, COUNT(*) as count
      FROM threats WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY threat_type ORDER BY count DESC
    `).all<{ threat_type: string; count: number }>();

    // ─── Compare with previous day ───────────────────────────────
    const prevSummary = await env.DB.prepare(`
      SELECT COUNT(*) as total_prev
      FROM threats WHERE created_at >= datetime('now', '-48 hours') AND created_at < datetime('now', '-24 hours')
    `).first<{ total_prev: number }>();

    const totalNow = summary?.total_24h ?? 0;
    const totalPrev = prevSummary?.total_prev ?? 0;
    const changePercent = totalPrev > 0 ? Math.round(((totalNow - totalPrev) / totalPrev) * 100) : 0;

    // ─── Recent campaigns ────────────────────────────────────────
    const recentCampaigns = await env.DB.prepare(
      `SELECT id, name, threat_count FROM campaigns
       WHERE last_seen >= datetime('now', '-48 hours') AND status = 'active'
       ORDER BY threat_count DESC LIMIT 10`
    ).all<{ id: string; name: string; threat_count: number }>();

    // ─── Recent agent outputs for context ────────────────────────
    const recentOutputs = await env.DB.prepare(`
      SELECT agent_id as agent, summary
      FROM agent_outputs
      WHERE agent_id != 'observer' AND created_at >= datetime('now', '-24 hours')
      ORDER BY created_at DESC LIMIT 10
    `).all<{ agent: string; summary: string }>();

    // ─── Send to Haiku for intelligence briefing ─────────────────
    const insightResult = await generateInsight(env, {
      period: "daily",
      threats_summary: {
        total_24h: totalNow,
        critical: summary?.critical ?? 0,
        high: summary?.high ?? 0,
        change_percent: changePercent,
        previous_day_total: totalPrev,
        feed_count: summary?.feed_count ?? 0,
        country_count: summary?.country_count ?? 0,
      },
      top_brands: topBrands.results,
      top_providers: topProviders.results,
      trend_data: { prev_day_total: totalPrev, change_percent: changePercent },
      type_distribution: typeBreakdown.results,
      recent_campaigns: recentCampaigns.results,
      agent_context: recentOutputs.results,
    });

    if (insightResult.success && insightResult.data?.items?.length) {
      if (insightResult.tokens_used) totalTokens += insightResult.tokens_used;
      if (insightResult.model) model = insightResult.model;

      // Each briefing item becomes a separate agent_output with type='insight'
      for (const item of insightResult.data.items) {
        const severity = (["critical", "high", "medium", "low", "info"].includes(item.severity)
          ? item.severity : "medium") as "critical" | "high" | "medium" | "low" | "info";

        const output: AgentOutputEntry = {
          type: "insight",
          summary: `**${item.title}** — ${item.summary}`,
          severity,
          details: { title: item.title },
        };

        if (item.related_brand_id) {
          output.relatedBrandIds = [item.related_brand_id];
        }
        if (item.related_campaign_id) {
          output.relatedCampaignId = item.related_campaign_id;
        }

        outputs.push(output);
      }
    } else {
      // Fallback: generate rule-based briefing items when Haiku is unavailable
      const trendLabel = changePercent > 20 ? "Significant increase" :
        changePercent > 0 ? "Slight increase" :
        changePercent < -20 ? "Notable decrease" :
        changePercent < 0 ? "Slight decrease" : "Stable";

      const topBrand = topBrands.results[0];
      const topProvider = topProviders.results[0];

      // Item 1: Overall threat landscape
      outputs.push({
        type: "insight",
        summary: `**Daily Threat Landscape** — ${totalNow} threats detected in the last 24 hours (${trendLabel}, ${changePercent > 0 ? "+" : ""}${changePercent}% vs previous day). ${summary?.critical ?? 0} critical and ${summary?.high ?? 0} high severity threats identified across ${summary?.feed_count ?? 0} feed sources and ${summary?.country_count ?? 0} countries.`,
        severity: (summary?.critical ?? 0) > 0 ? "high" : "medium",
        details: {
          title: "Daily Threat Landscape",
          total_threats: totalNow,
          change_percent: changePercent,
        },
      });

      // Item 2: Top targeted brand (if any)
      if (topBrand) {
        outputs.push({
          type: "insight",
          summary: `**${topBrand.name} Under Active Targeting** — ${topBrand.count} new threats targeting ${topBrand.name} in the last 24 hours, making it the most-targeted brand this period.${topProvider ? ` Primary hosting infrastructure: ${topProvider.name}.` : ""}`,
          severity: topBrand.count >= 10 ? "high" : "medium",
          details: { title: `${topBrand.name} Under Active Targeting` },
          relatedBrandIds: [topBrand.id],
        });
      }

      // Item 3: New campaigns
      for (const campaign of recentCampaigns.results.slice(0, 2)) {
        outputs.push({
          type: "insight",
          summary: `**Campaign: ${campaign.name}** — Active campaign with ${campaign.threat_count} associated threats. Infrastructure analysis suggests coordinated targeting activity.`,
          severity: campaign.threat_count >= 10 ? "high" : "medium",
          details: { title: `Campaign: ${campaign.name}` },
          relatedCampaignId: campaign.id,
        });
      }
    }

    // Send intelligence digest notification (rate-limited: 1 per day)
    if (outputs.length > 0) {
      const firstInsight = outputs[0]!;
      const summaryText = firstInsight.summary.replace(/\*\*/g, '').substring(0, 100);
      try {
        await createNotification(env.DB, {
          type: 'intelligence_digest',
          severity: 'info',
          title: 'New intelligence briefing',
          message: summaryText + '...',
          link: '/agents',
        });
      } catch (e) {
        console.error(`[observer] notification error:`, e);
      }
    }

    return {
      itemsProcessed: 1,
      itemsCreated: outputs.length,
      itemsUpdated: 0,
      output: {
        total_threats_24h: totalNow,
        change_percent: changePercent,
        insights_generated: outputs.length,
      },
      model,
      tokensUsed: totalTokens,
      agentOutputs: outputs,
    };
  },
};
