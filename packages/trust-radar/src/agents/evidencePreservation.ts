/**
 * Evidence Preservation Agent — Forensic snapshots of critical threat artifacts.
 * Creates evidence records for high/critical threats.
 */

import type { AgentModule, AgentContext, AgentResult } from "../lib/agentRunner";

export const evidencePreservationAgent: AgentModule = {
  name: "evidence-preservation",
  displayName: "Evidence Preservation",
  description: "Forensic snapshots of threat artifacts",
  color: "#34D399",
  trigger: "event",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const hoursBack = (ctx.input.hoursBack as number) ?? 6;

    // Find critical/high threats without evidence captures
    const threats = await ctx.env.DB.prepare(
      `SELECT t.id, t.type, t.title, t.domain, t.url, t.ip_address, t.ioc_value, t.metadata, t.severity
       FROM threats t
       LEFT JOIN evidence_captures e ON e.threat_id = t.id
       WHERE t.severity IN ('critical', 'high')
         AND t.created_at >= datetime('now', ? || ' hours')
         AND e.id IS NULL
       ORDER BY t.created_at DESC LIMIT 50`
    ).bind(-hoursBack).all<{
      id: string; type: string; title: string; domain: string | null;
      url: string | null; ip_address: string | null; ioc_value: string | null;
      metadata: string; severity: string;
    }>();

    let created = 0;

    for (const threat of threats.results) {
      const captureId = crypto.randomUUID();
      const snapshot: Record<string, unknown> = {
        threat_id: threat.id,
        threat_type: threat.type,
        title: threat.title,
        domain: threat.domain,
        url: threat.url,
        ip_address: threat.ip_address,
        ioc_value: threat.ioc_value,
        severity: threat.severity,
        captured_at: new Date().toISOString(),
      };

      // Parse and include existing metadata
      try {
        const meta = JSON.parse(threat.metadata || "{}");
        snapshot.original_metadata = meta;
      } catch { /* ignore */ }

      await ctx.env.DB.prepare(
        `INSERT INTO evidence_captures (id, threat_id, capture_type, capture_data, captured_by, created_at)
         VALUES (?, ?, 'automated_snapshot', ?, 'agent:evidence-preservation', datetime('now'))`
      ).bind(captureId, threat.id, JSON.stringify(snapshot)).run();

      created++;
    }

    return {
      itemsProcessed: threats.results.length,
      itemsCreated: created,
      itemsUpdated: 0,
      output: {
        threatsScanned: threats.results.length,
        evidenceCaptured: created,
        hoursBack,
      },
    };
  },
};
