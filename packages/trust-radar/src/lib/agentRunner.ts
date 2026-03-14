/**
 * Agent Runner — Orchestrator for AI agent execution (v2).
 *
 * Uses v2 tables: agent_runs, agent_outputs.
 * Supports both v2 named agents (sentinel, analyst, etc.) and
 * legacy rule-based agents (triage, threat-hunt, etc.).
 */

import type { Env } from "../types";

// ─── Types ──────────────────────────────────────────────────────

export type AgentName =
  // v2 AI agents
  | "sentinel"
  | "analyst"
  | "cartographer"
  | "strategist"
  | "observer"
  // legacy rule-based agents (kept for backward compat)
  | "triage"
  | "threat-hunt"
  | "impersonation-detector"
  | "takedown-orchestrator"
  | "evidence-preservation"
  | "abuse-mailbox"
  | "campaign-correlator"
  | "trust-score-monitor"
  | "executive-intel"
  | "trustbot"
  | "hosting-provider-analysis";

export type TriggerType = "scheduled" | "event" | "manual" | "api";
export type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled" | "timeout" | "awaiting_approval" | "partial";

export interface AgentRunRow {
  id: string;
  agent_id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: string;
  error_message: string | null;
  records_processed: number;
  outputs_generated: number;
}

export interface AgentOutputRow {
  id: string;
  agent_id: string;
  type: string;
  summary: string;
  severity: string | null;
  details: string | null;
  related_brand_ids: string | null;
  related_campaign_id: string | null;
  related_provider_ids: string | null;
  created_at: string;
}

export interface AgentContext {
  env: Env;
  runId: string;
  agentName: AgentName;
  input: Record<string, unknown>;
  triggeredBy: string | null;
}

export interface AgentResult {
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  output: Record<string, unknown>;
  model?: string;
  tokensUsed?: number;
  approvals?: ApprovalRequest[];
  /** Agent outputs to persist in agent_outputs table */
  agentOutputs?: AgentOutputEntry[];
}

export interface AgentOutputEntry {
  type: "insight" | "classification" | "correlation" | "score" | "trend_report";
  summary: string;
  severity?: "critical" | "high" | "medium" | "low" | "info";
  details?: Record<string, unknown>;
  relatedBrandIds?: string[];
  relatedCampaignId?: string;
  relatedProviderIds?: string[];
}

export interface ApprovalRequest {
  actionType: string;
  description: string;
  details: Record<string, unknown>;
  expiresInHours?: number;
}

export interface AgentModule {
  name: AgentName;
  displayName: string;
  description: string;
  color: string;
  trigger: TriggerType;
  requiresApproval: boolean;
  execute: (ctx: AgentContext) => Promise<AgentResult>;
}

// ─── Agent Definitions (static config for UI) ───────────────────

export const AGENT_DEFINITIONS: Array<{
  name: AgentName;
  displayName: string;
  description: string;
  color: string;
  trigger: TriggerType;
  requiresApproval: boolean;
}> = [
  // v2 AI agents (Haiku-powered)
  { name: "sentinel", displayName: "Sentinel", description: "Certificate & domain surveillance — classifies new threats via AI", color: "#22D3EE", trigger: "event", requiresApproval: false },
  { name: "analyst", displayName: "Analyst", description: "Threat classification & brand matching via Haiku", color: "#818CF8", trigger: "scheduled", requiresApproval: false },
  { name: "cartographer", displayName: "Cartographer", description: "Infrastructure mapping & provider reputation scoring", color: "#34D399", trigger: "scheduled", requiresApproval: false },
  { name: "strategist", displayName: "Strategist", description: "Campaign correlation & clustering intelligence", color: "#F472B6", trigger: "scheduled", requiresApproval: false },
  { name: "observer", displayName: "Observer", description: "Trend analysis & daily intelligence synthesis", color: "#FBBF24", trigger: "scheduled", requiresApproval: false },
  // Legacy rule-based agents
  { name: "triage", displayName: "Triage", description: "Auto-score and prioritize incoming threats", color: "#22D3EE", trigger: "event", requiresApproval: false },
  { name: "threat-hunt", displayName: "Threat Hunt", description: "Correlate across feeds to find campaigns", color: "#818CF8", trigger: "scheduled", requiresApproval: false },
  { name: "impersonation-detector", displayName: "Impersonation Detector", description: "Detect lookalike domains and homoglyphs", color: "#F472B6", trigger: "event", requiresApproval: false },
  { name: "takedown-orchestrator", displayName: "Takedown Orchestrator", description: "Draft and send abuse notices to providers", color: "#FB923C", trigger: "manual", requiresApproval: true },
  { name: "evidence-preservation", displayName: "Evidence Preservation", description: "Forensic snapshots of threat artifacts", color: "#34D399", trigger: "event", requiresApproval: false },
  { name: "abuse-mailbox", displayName: "Abuse Mailbox", description: "Triage phishing report emails", color: "#FBBF24", trigger: "event", requiresApproval: false },
  { name: "campaign-correlator", displayName: "Campaign Correlator", description: "Cluster threats by shared infrastructure", color: "#A78BFA", trigger: "scheduled", requiresApproval: false },
  { name: "trust-score-monitor", displayName: "Trust Score Monitor", description: "Continuous brand trust scoring", color: "#2DD4BF", trigger: "scheduled", requiresApproval: false },
  { name: "executive-intel", displayName: "Executive Intel", description: "Generate C-suite threat briefings", color: "#E879F9", trigger: "scheduled", requiresApproval: true },
  { name: "trustbot", displayName: "TrustBot", description: "Interactive AI threat intelligence copilot", color: "#60A5FA", trigger: "manual", requiresApproval: false },
  { name: "hosting-provider-analysis", displayName: "Hosting Provider Analysis", description: "Track hosting providers used by threat actors", color: "#F97316", trigger: "event", requiresApproval: false },
];

// ─── Run Execution ──────────────────────────────────────────────

export async function executeAgent(
  env: Env,
  agentModule: AgentModule,
  input: Record<string, unknown> = {},
  triggeredBy: string | null = null,
  triggerType: TriggerType = "manual",
): Promise<{ runId: string; status: RunStatus; result: AgentResult | null; error?: string }> {
  const runId = crypto.randomUUID();

  // Create run record in v2 agent_runs table
  await env.DB.prepare(
    `INSERT INTO agent_runs (id, agent_id, started_at, status, records_processed, outputs_generated)
     VALUES (?, ?, datetime('now'), 'running', 0, 0)`
  ).bind(runId, agentModule.name).run();

  const ctx: AgentContext = { env, runId, agentName: agentModule.name, input, triggeredBy };
  const start = Date.now();

  try {
    const result = await agentModule.execute(ctx);
    const durationMs = Date.now() - start;

    // Persist agent outputs if any
    let outputsGenerated = 0;
    if (result.agentOutputs && result.agentOutputs.length > 0) {
      for (const output of result.agentOutputs) {
        const outputId = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO agent_outputs (id, agent_id, type, summary, severity, details, related_brand_ids, related_campaign_id, related_provider_ids, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          outputId, agentModule.name, output.type, output.summary,
          output.severity ?? null,
          output.details ? JSON.stringify(output.details) : null,
          output.relatedBrandIds ? JSON.stringify(output.relatedBrandIds) : null,
          output.relatedCampaignId ?? null,
          output.relatedProviderIds ? JSON.stringify(output.relatedProviderIds) : null,
        ).run();
        outputsGenerated++;
      }
    }

    const finalStatus: RunStatus = result.approvals?.length ? "awaiting_approval" : "success";

    await env.DB.prepare(
      `UPDATE agent_runs SET
         status = ?, duration_ms = ?, records_processed = ?,
         outputs_generated = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(
      finalStatus, durationMs, result.itemsProcessed,
      outputsGenerated, runId,
    ).run();

    return { runId, status: finalStatus, result };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    await env.DB.prepare(
      `UPDATE agent_runs SET status = 'failed', error_message = ?, duration_ms = ?, completed_at = datetime('now') WHERE id = ?`
    ).bind(errorMsg, durationMs, runId).run();

    return { runId, status: "failed", result: null, error: errorMsg };
  }
}

// ─── Approval Management (legacy compat) ────────────────────────

export async function resolveApproval(
  env: Env,
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  note?: string,
): Promise<void> {
  // Try v1 table first (for legacy agents), gracefully handle if not exists
  try {
    await env.DB.prepare(
      `UPDATE radar_agent_approvals SET status = ?, decided_by = ?, decision_note = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'`
    ).bind(decision, decidedBy, note ?? null, approvalId).run();
  } catch {
    // radar_agent_approvals may not exist in v2-only deployments
  }
}
