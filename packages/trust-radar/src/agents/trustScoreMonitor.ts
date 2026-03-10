/**
 * Trust Score Monitor Agent — Continuous brand trust scoring.
 * Calculates aggregate trust scores from threat data.
 */

import type { AgentModule, AgentContext, AgentResult } from "../lib/agentRunner";

export const trustScoreMonitorAgent: AgentModule = {
  name: "trust-score-monitor",
  displayName: "Trust Score Monitor",
  description: "Continuous brand trust scoring",
  color: "#2DD4BF",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    // Calculate overall platform trust health
    const totalThreats = await ctx.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM threats WHERE created_at >= datetime('now', '-24 hours')"
    ).first<{ cnt: number }>();

    const criticalThreats = await ctx.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM threats WHERE severity = 'critical' AND created_at >= datetime('now', '-24 hours')"
    ).first<{ cnt: number }>();

    const highThreats = await ctx.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM threats WHERE severity = 'high' AND created_at >= datetime('now', '-24 hours')"
    ).first<{ cnt: number }>();

    const resolvedThreats = await ctx.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM threats WHERE status = 'resolved' AND created_at >= datetime('now', '-24 hours')"
    ).first<{ cnt: number }>();

    const total = totalThreats?.cnt ?? 0;
    const critical = criticalThreats?.cnt ?? 0;
    const high = highThreats?.cnt ?? 0;
    const resolved = resolvedThreats?.cnt ?? 0;

    // Trust score formula: base 100, penalize for unresolved critical/high threats
    let score = 100;
    score -= critical * 5;  // -5 per critical
    score -= high * 2;      // -2 per high
    score += resolved * 1;  // +1 per resolved
    score = Math.max(0, Math.min(100, score));

    // Record the trust score snapshot
    const snapshotId = crypto.randomUUID();
    await ctx.env.DB.prepare(
      `INSERT INTO trust_score_history (id, score, total_threats, critical_threats, high_threats, resolved_threats, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(snapshotId, score, total, critical, high, resolved).run();

    // Also store in attack_metrics as daily aggregate
    await ctx.env.DB.prepare(
      `INSERT OR REPLACE INTO attack_metrics (id, metric_date, total_threats, critical_count, high_count, resolved_count, trust_score, created_at)
       VALUES (?, date('now'), ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(crypto.randomUUID(), total, critical, high, resolved, score).run();

    return {
      itemsProcessed: 1,
      itemsCreated: 1,
      itemsUpdated: 1,
      output: {
        trustScore: score,
        totalThreats24h: total,
        criticalThreats24h: critical,
        highThreats24h: high,
        resolvedThreats24h: resolved,
      },
    };
  },
};
