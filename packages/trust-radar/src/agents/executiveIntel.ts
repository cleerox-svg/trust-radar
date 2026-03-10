/**
 * Executive Intel Agent — Generate C-suite threat briefings.
 * Creates structured intelligence briefings from recent threat data.
 * Requires HITL approval before publishing.
 */

import type { AgentModule, AgentContext, AgentResult, ApprovalRequest } from "../lib/agentRunner";

export const executiveIntelAgent: AgentModule = {
  name: "executive-intel",
  displayName: "Executive Intel",
  description: "Generate C-suite threat briefings",
  color: "#E879F9",
  trigger: "scheduled",
  requiresApproval: true,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const hoursBack = (ctx.input.hoursBack as number) ?? 24;

    // Gather threat statistics
    const stats = await ctx.env.DB.prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
         SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
         SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
         SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
         SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
         COUNT(DISTINCT source) as sources,
         COUNT(DISTINCT type) as types
       FROM threats
       WHERE created_at >= datetime('now', ? || ' hours')`
    ).bind(-hoursBack).first<{
      total: number; critical: number; high: number; medium: number; low: number;
      resolved: number; sources: number; types: number;
    }>();

    // Top threat types
    const topTypes = await ctx.env.DB.prepare(
      `SELECT type, COUNT(*) as cnt FROM threats
       WHERE created_at >= datetime('now', ? || ' hours')
       GROUP BY type ORDER BY cnt DESC LIMIT 5`
    ).bind(-hoursBack).all<{ type: string; cnt: number }>();

    // Top sources
    const topSources = await ctx.env.DB.prepare(
      `SELECT source, COUNT(*) as cnt FROM threats
       WHERE created_at >= datetime('now', ? || ' hours')
       GROUP BY source ORDER BY cnt DESC LIMIT 5`
    ).bind(-hoursBack).all<{ source: string; cnt: number }>();

    // Critical threat highlights
    const criticalHighlights = await ctx.env.DB.prepare(
      `SELECT id, title, type, domain, ip_address, source
       FROM threats WHERE severity = 'critical' AND created_at >= datetime('now', ? || ' hours')
       ORDER BY created_at DESC LIMIT 5`
    ).bind(-hoursBack).all<{
      id: string; title: string; type: string; domain: string | null; ip_address: string | null; source: string;
    }>();

    // Build briefing
    const s = stats ?? { total: 0, critical: 0, high: 0, medium: 0, low: 0, resolved: 0, sources: 0, types: 0 };
    const briefing = {
      period: `Last ${hoursBack} hours`,
      generatedAt: new Date().toISOString(),
      summary: {
        totalThreats: s.total,
        bySeverity: { critical: s.critical, high: s.high, medium: s.medium, low: s.low },
        resolved: s.resolved,
        activeSources: s.sources,
        threatTypes: s.types,
      },
      topThreatTypes: topTypes.results,
      topSources: topSources.results,
      criticalHighlights: criticalHighlights.results,
      riskLevel: s.critical > 5 ? "ELEVATED" : s.critical > 0 ? "GUARDED" : "NORMAL",
    };

    // Store briefing
    const briefingId = crypto.randomUUID();
    await ctx.env.DB.prepare(
      `INSERT INTO threat_briefings (id, title, summary, body, severity, category, generated_by, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'general', 'agent:executive-intel', 'draft', datetime('now'), datetime('now'))`
    ).bind(
      briefingId,
      `Threat Intelligence Briefing — ${briefing.period}`,
      `${s.total} threats detected (${s.critical} critical, ${s.high} high). Risk level: ${briefing.riskLevel}.`,
      JSON.stringify(briefing),
      briefing.riskLevel === "ELEVATED" ? "critical" : briefing.riskLevel === "GUARDED" ? "high" : "medium",
    ).run();

    // Request approval to publish
    const approvals: ApprovalRequest[] = [{
      actionType: "publish_briefing",
      description: `Publish executive briefing: ${s.total} threats, ${s.critical} critical. Risk: ${briefing.riskLevel}`,
      details: { briefingId, ...briefing },
      expiresInHours: 24,
    }];

    return {
      itemsProcessed: 1,
      itemsCreated: 1,
      itemsUpdated: 0,
      output: briefing,
      approvals,
    };
  },
};
