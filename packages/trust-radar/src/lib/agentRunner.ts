/**
 * Agent Runner — Orchestrator for AI agent execution.
 *
 * Manages agent lifecycle: create run → execute → record result.
 * Supports HITL (Human-in-the-Loop) approval gating.
 */

import type { Env } from "../types";

// ─── Types ──────────────────────────────────────────────────────

export type AgentName =
  | "triage"
  | "threat-hunt"
  | "impersonation-detector"
  | "takedown-orchestrator"
  | "evidence-preservation"
  | "abuse-mailbox"
  | "campaign-correlator"
  | "trust-score-monitor"
  | "executive-intel"
  | "trustbot";

export type TriggerType = "scheduled" | "event" | "manual" | "api";
export type RunStatus = "queued" | "running" | "success" | "failed" | "cancelled" | "timeout" | "awaiting_approval";

export interface AgentRunRow {
  id: string;
  agent_name: string;
  trigger_type: string;
  triggered_by: string | null;
  status: string;
  input: string;
  output: string;
  error: string | null;
  items_processed: number;
  items_created: number;
  items_updated: number;
  duration_ms: number | null;
  model: string | null;
  tokens_used: number;
  requires_approval: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AgentApprovalRow {
  id: string;
  run_id: string;
  agent_name: string;
  action_type: string;
  description: string;
  details: string;
  status: string;
  decided_by: string | null;
  decision_note: string | null;
  expires_at: string | null;
  decided_at: string | null;
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
  const startedAt = new Date().toISOString();

  // Create run record
  await env.DB.prepare(
    `INSERT INTO radar_agent_runs (id, agent_name, trigger_type, triggered_by, status, input, started_at, requires_approval, created_at)
     VALUES (?, ?, ?, ?, 'running', ?, ?, ?, datetime('now'))`
  ).bind(
    runId, agentModule.name, triggerType, triggeredBy,
    JSON.stringify(input), startedAt, agentModule.requiresApproval ? 1 : 0,
  ).run();

  const ctx: AgentContext = { env, runId, agentName: agentModule.name, input, triggeredBy };
  const start = Date.now();

  try {
    const result = await agentModule.execute(ctx);
    const durationMs = Date.now() - start;

    // Create approval requests if any
    if (result.approvals && result.approvals.length > 0) {
      for (const approval of result.approvals) {
        const approvalId = crypto.randomUUID();
        const expiresAt = approval.expiresInHours
          ? new Date(Date.now() + approval.expiresInHours * 3600000).toISOString()
          : null;

        await env.DB.prepare(
          `INSERT INTO radar_agent_approvals (id, run_id, agent_name, action_type, description, details, status, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`
        ).bind(
          approvalId, runId, agentModule.name, approval.actionType,
          approval.description, JSON.stringify(approval.details), expiresAt,
        ).run();
      }
    }

    const finalStatus: RunStatus = result.approvals?.length ? "awaiting_approval" : "success";

    await env.DB.prepare(
      `UPDATE radar_agent_runs SET
         status = ?, output = ?, items_processed = ?, items_created = ?, items_updated = ?,
         duration_ms = ?, model = ?, tokens_used = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(
      finalStatus, JSON.stringify(result.output), result.itemsProcessed,
      result.itemsCreated, result.itemsUpdated, durationMs,
      result.model ?? null, result.tokensUsed ?? 0, runId,
    ).run();

    return { runId, status: finalStatus, result };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    await env.DB.prepare(
      `UPDATE radar_agent_runs SET status = 'failed', error = ?, duration_ms = ?, completed_at = datetime('now') WHERE id = ?`
    ).bind(errorMsg, durationMs, runId).run();

    return { runId, status: "failed", result: null, error: errorMsg };
  }
}

// ─── Approval Management ────────────────────────────────────────

export async function resolveApproval(
  env: Env,
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  note?: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE radar_agent_approvals SET status = ?, decided_by = ?, decision_note = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'`
  ).bind(decision, decidedBy, note ?? null, approvalId).run();

  // If approved, check if all approvals for the run are resolved
  const approval = await env.DB.prepare(
    "SELECT run_id FROM radar_agent_approvals WHERE id = ?"
  ).bind(approvalId).first<{ run_id: string }>();

  if (approval) {
    const pending = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM radar_agent_approvals WHERE run_id = ? AND status = 'pending'"
    ).bind(approval.run_id).first<{ cnt: number }>();

    if (pending && pending.cnt === 0) {
      // All approvals resolved — update run status
      const rejected = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM radar_agent_approvals WHERE run_id = ? AND status = 'rejected'"
      ).bind(approval.run_id).first<{ cnt: number }>();

      const newStatus = rejected && rejected.cnt > 0 ? "cancelled" : "success";
      await env.DB.prepare(
        "UPDATE radar_agent_runs SET status = ?, completed_at = datetime('now') WHERE id = ?"
      ).bind(newStatus, approval.run_id).run();
    }
  }
}
