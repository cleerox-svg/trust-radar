/**
 * Cartographer Agent — Infrastructure mapping & provider reputation scoring.
 *
 * Runs every 6 hours + weekly batch.
 * Maps threat infrastructure to hosting providers and computes
 * reputation scores via Haiku AI analysis.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { scoreProvider } from "../lib/haiku";

export const cartographerAgent: AgentModule = {
  name: "cartographer",
  displayName: "Cartographer",
  description: "Infrastructure mapping & provider reputation scoring",
  color: "#34D399",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    // Get all hosting providers with threat data
    const providers = await env.DB.prepare(
      `SELECT hp.id, hp.name, hp.asn, hp.active_threat_count, hp.total_threat_count,
              hp.avg_response_time, hp.trend_7d, hp.trend_30d
       FROM hosting_providers hp
       WHERE hp.total_threat_count > 0
       ORDER BY hp.active_threat_count DESC LIMIT 50`
    ).all<{
      id: string; name: string; asn: string | null;
      active_threat_count: number; total_threat_count: number;
      avg_response_time: number | null; trend_7d: number; trend_30d: number;
    }>();

    let itemsProcessed = 0;
    let itemsUpdated = 0;
    let totalTokens = 0;
    let model: string | undefined;
    const outputs: AgentOutputEntry[] = [];

    for (const provider of providers.results) {
      itemsProcessed++;

      // Get threat type breakdown for this provider
      const typeBreakdown = await env.DB.prepare(
        `SELECT threat_type, COUNT(*) as count
         FROM threats WHERE hosting_provider_id = ?
         GROUP BY threat_type`
      ).bind(provider.id).all<{ threat_type: string; count: number }>();

      const threatTypes: Record<string, number> = {};
      for (const row of typeBreakdown.results) {
        threatTypes[row.threat_type] = row.count;
      }

      // Try Haiku scoring
      const result = await scoreProvider(env, {
        name: provider.name,
        asn: provider.asn,
        active_threats: provider.active_threat_count,
        total_threats: provider.total_threat_count,
        avg_response_time: provider.avg_response_time,
        threat_types: threatTypes,
        trend_7d: provider.trend_7d,
        trend_30d: provider.trend_30d,
      });

      let reputationScore: number;

      if (result.success && result.data) {
        reputationScore = result.data.reputation_score;
        if (result.tokens_used) totalTokens += result.tokens_used;
        if (result.model) model = result.model;

        outputs.push({
          type: "score",
          summary: `${provider.name}: reputation ${reputationScore}/100 — ${result.data.reasoning}`,
          severity: reputationScore < 30 ? "critical" : reputationScore < 50 ? "high" : reputationScore < 70 ? "medium" : "info",
          details: {
            provider: provider.name,
            score: reputationScore,
            risk_factors: result.data.risk_factors,
            response_assessment: result.data.response_assessment,
          },
          relatedProviderIds: [provider.id],
        });
      } else {
        // Fallback: simple heuristic scoring
        reputationScore = computeHeuristicScore(
          provider.active_threat_count,
          provider.total_threat_count,
          provider.avg_response_time,
        );
      }

      try {
        await env.DB.prepare(
          "UPDATE hosting_providers SET reputation_score = ? WHERE id = ?"
        ).bind(reputationScore, provider.id).run();
        itemsUpdated++;
      } catch (err) {
        console.error(`[cartographer] update failed for ${provider.id}:`, err);
      }
    }

    return {
      itemsProcessed,
      itemsCreated: 0,
      itemsUpdated,
      output: { providersScored: itemsUpdated },
      model,
      tokensUsed: totalTokens,
      agentOutputs: outputs,
    };
  },
};

function computeHeuristicScore(
  activeThreats: number,
  totalThreats: number,
  avgResponseTime: number | null,
): number {
  let score = 100;

  // Penalize for active threats
  if (activeThreats > 100) score -= 40;
  else if (activeThreats > 50) score -= 30;
  else if (activeThreats > 10) score -= 20;
  else if (activeThreats > 0) score -= 10;

  // Penalize for slow response
  if (avgResponseTime !== null) {
    if (avgResponseTime > 168) score -= 20;      // > 1 week
    else if (avgResponseTime > 72) score -= 15;   // > 3 days
    else if (avgResponseTime > 24) score -= 10;   // > 1 day
  }

  // Penalize for high total volume
  if (totalThreats > 1000) score -= 15;
  else if (totalThreats > 100) score -= 10;

  return Math.max(0, Math.min(100, score));
}
