/**
 * Observer Agent — Trend analysis & daily intelligence synthesis.
 *
 * Runs daily. Generates intelligence insights by analyzing threat trends,
 * brand targeting patterns, and provider behavior. Writes to agent_outputs
 * for analyst consumption on the HUD and insights panel.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { generateInsight } from "../lib/haiku";

export const observerAgent: AgentModule = {
  name: "observer",
  displayName: "Observer",
  description: "Trend analysis & daily intelligence synthesis",
  color: "#FBBF24",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    let totalTokens = 0;
    let model: string | undefined;
    const outputs: AgentOutputEntry[] = [];

    // ─── Gather threat summary ──────────────────────────────────
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

    const topBrands = await env.DB.prepare(`
      SELECT b.name, COUNT(*) as count
      FROM threats t JOIN brands b ON t.target_brand_id = b.id
      WHERE t.created_at >= datetime('now', '-24 hours')
      GROUP BY b.name ORDER BY count DESC LIMIT 10
    `).all<{ name: string; count: number }>();

    const topProviders = await env.DB.prepare(`
      SELECT hp.name, COUNT(*) as count
      FROM threats t JOIN hosting_providers hp ON t.hosting_provider_id = hp.id
      WHERE t.created_at >= datetime('now', '-24 hours')
      GROUP BY hp.name ORDER BY count DESC LIMIT 10
    `).all<{ name: string; count: number }>();

    const typeBreakdown = await env.DB.prepare(`
      SELECT threat_type, COUNT(*) as count
      FROM threats WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY threat_type ORDER BY count DESC
    `).all<{ threat_type: string; count: number }>();

    // ─── Compare with previous day ──────────────────────────────
    const prevSummary = await env.DB.prepare(`
      SELECT COUNT(*) as total_prev
      FROM threats WHERE created_at >= datetime('now', '-48 hours') AND created_at < datetime('now', '-24 hours')
    `).first<{ total_prev: number }>();

    const totalNow = summary?.total_24h ?? 0;
    const totalPrev = prevSummary?.total_prev ?? 0;
    const changePercent = totalPrev > 0 ? Math.round(((totalNow - totalPrev) / totalPrev) * 100) : 0;

    // ─── Try Haiku insight generation ───────────────────────────
    const insightResult = await generateInsight(env, {
      period: "daily",
      threats_summary: {
        total_24h: totalNow,
        critical: summary?.critical ?? 0,
        high: summary?.high ?? 0,
        change_percent: changePercent,
        type_breakdown: typeBreakdown.results,
      },
      top_brands: topBrands.results,
      top_providers: topProviders.results,
      trend_data: { prev_day_total: totalPrev, change_percent: changePercent },
    });

    if (insightResult.success && insightResult.data) {
      if (insightResult.tokens_used) totalTokens += insightResult.tokens_used;
      if (insightResult.model) model = insightResult.model;

      outputs.push({
        type: "insight",
        summary: insightResult.data.summary,
        severity: insightResult.data.severity as "critical" | "high" | "medium" | "low" | "info",
        details: {
          title: insightResult.data.title,
          recommendations: insightResult.data.recommendations,
          period: "daily",
        },
      });
    } else {
      // Fallback: generate rule-based insight
      const trendLabel = changePercent > 20 ? "Significant increase" :
        changePercent > 0 ? "Slight increase" :
        changePercent < -20 ? "Notable decrease" :
        changePercent < 0 ? "Slight decrease" : "Stable";

      const topBrand = topBrands.results[0]?.name ?? "none";
      const topProvider = topProviders.results[0]?.name ?? "none";

      outputs.push({
        type: "insight",
        summary: `Daily briefing: ${totalNow} threats detected (${trendLabel}, ${changePercent > 0 ? "+" : ""}${changePercent}%). Top target: ${topBrand}. Top hosting: ${topProvider}. ${summary?.critical ?? 0} critical, ${summary?.high ?? 0} high severity.`,
        severity: (summary?.critical ?? 0) > 0 ? "high" : "medium",
        details: {
          total_threats: totalNow,
          change_percent: changePercent,
          critical: summary?.critical ?? 0,
          high: summary?.high ?? 0,
          top_brands: topBrands.results,
          top_providers: topProviders.results,
          period: "daily",
        },
      });
    }

    // ─── New campaign alerts ────────────────────────────────────
    const newCampaigns = await env.DB.prepare(
      `SELECT id, name, threat_count FROM campaigns
       WHERE first_seen >= datetime('now', '-24 hours') AND status = 'active'`
    ).all<{ id: string; name: string; threat_count: number }>();

    for (const campaign of newCampaigns.results) {
      outputs.push({
        type: "correlation",
        summary: `New campaign identified: "${campaign.name}" with ${campaign.threat_count} threats`,
        severity: campaign.threat_count >= 10 ? "high" : "medium",
        details: { campaign_id: campaign.id, name: campaign.name },
      });
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
