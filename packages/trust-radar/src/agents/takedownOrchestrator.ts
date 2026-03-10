/**
 * Takedown Orchestrator Agent — Draft abuse notices for high-severity threats.
 * Requires HITL approval before any action is taken.
 */

import type { AgentModule, AgentContext, AgentResult, ApprovalRequest } from "../lib/agentRunner";

export const takedownOrchestratorAgent: AgentModule = {
  name: "takedown-orchestrator",
  displayName: "Takedown Orchestrator",
  description: "Draft and send abuse notices to providers",
  color: "#FB923C",
  trigger: "manual",
  requiresApproval: true,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const threatId = ctx.input.threatId as string | undefined;

    // Get critical/high threats that haven't been actioned
    const query = threatId
      ? `SELECT id, type, title, domain, ip_address, url, source, severity, metadata
         FROM threats WHERE id = ? LIMIT 1`
      : `SELECT id, type, title, domain, ip_address, url, source, severity, metadata
         FROM threats WHERE severity IN ('critical', 'high') AND status NOT IN ('resolved', 'takedown_sent')
         ORDER BY created_at DESC LIMIT 10`;

    const threats = threatId
      ? await ctx.env.DB.prepare(query).bind(threatId).all<{
          id: string; type: string; title: string; domain: string | null;
          ip_address: string | null; url: string | null; source: string;
          severity: string; metadata: string;
        }>()
      : await ctx.env.DB.prepare(query).all<{
          id: string; type: string; title: string; domain: string | null;
          ip_address: string | null; url: string | null; source: string;
          severity: string; metadata: string;
        }>();

    const approvals: ApprovalRequest[] = [];

    for (const threat of threats.results) {
      const target = threat.domain ?? threat.ip_address ?? threat.url ?? "unknown";

      approvals.push({
        actionType: "takedown",
        description: `Takedown request for ${threat.severity} ${threat.type} threat: ${target}`,
        details: {
          threatId: threat.id,
          threatType: threat.type,
          severity: threat.severity,
          target,
          title: threat.title,
          source: threat.source,
          draftNotice: generateAbuseNotice(threat),
        },
        expiresInHours: 48,
      });
    }

    return {
      itemsProcessed: threats.results.length,
      itemsCreated: approvals.length,
      itemsUpdated: 0,
      output: {
        threatsReviewed: threats.results.length,
        takedownsDrafted: approvals.length,
      },
      approvals,
    };
  },
};

function generateAbuseNotice(threat: {
  type: string; title: string; domain: string | null;
  ip_address: string | null; url: string | null; severity: string;
}): string {
  const target = threat.domain ?? threat.ip_address ?? threat.url ?? "N/A";
  return [
    `Subject: Abuse Report — ${threat.type} activity detected`,
    ``,
    `Dear Abuse Team,`,
    ``,
    `We have identified ${threat.severity}-severity ${threat.type} activity associated with: ${target}`,
    ``,
    `Threat: ${threat.title}`,
    `Severity: ${threat.severity}`,
    `Type: ${threat.type}`,
    threat.domain ? `Domain: ${threat.domain}` : null,
    threat.ip_address ? `IP: ${threat.ip_address}` : null,
    threat.url ? `URL: ${threat.url}` : null,
    ``,
    `We request immediate investigation and appropriate action to mitigate this threat.`,
    ``,
    `Regards,`,
    `Trust Radar Intelligence Platform`,
  ].filter(Boolean).join("\n");
}
