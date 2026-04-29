/**
 * Agent Runner — Orchestrator for AI agent execution (v2).
 *
 * Uses v2 tables: agent_runs, agent_outputs, agent_configs.
 * Circuit breaker: auto-trips agents after N consecutive failures.
 * flight_control and architect are protected from auto-trip.
 */

import type { Env } from "../types";
import { createNotification } from "./notifications";

// ─── Types ──────────────────────────────────────────────────────

export type AgentName =
  | "sentinel"
  | "analyst"
  | "cartographer"
  | "strategist"
  | "observer"
  | "pathfinder"
  | "sparrow"
  | "nexus"
  | "trustbot"
  | "seed_strategist"
  | "flight_control"
  | "curator"
  | "watchdog"
  | "architect"
  | "narrator"
  | "app_store_monitor"
  | "dark_web_monitor"
  | "social_monitor"
  | "social_discovery"
  | "auto_seeder"
  | "cube_healer"
  | "navigator"
  | "enricher"
  | "public_trust_check"
  | "qualified_report"
  | "brand_analysis";

export type TriggerType = "scheduled" | "event" | "manual" | "api";
export type RunStatus = "success" | "partial" | "failed";

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
  agentName: string;
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
  type: "insight" | "classification" | "correlation" | "score" | "trend_report" | "diagnostic" | "hygiene_report";
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
  requiresApproval?: boolean;
  execute: (ctx: AgentContext) => Promise<AgentResult>;
}

// ─── Circuit Breaker ────────────────────────────────────────────

/** Agents that can still be manually disabled but are never auto-tripped. */
export const PROTECTED_FROM_CIRCUIT_BREAKER = new Set(["flight_control", "architect"]);

/** Default consecutive-failure threshold when system_config has no row. */
const DEFAULT_AGENT_FAILURE_THRESHOLD = 3;

export type CircuitState = "closed" | "tripped";

export interface ExecuteAgentResult {
  runId: string;
  status: RunStatus | "circuit_open";
  result: AgentResult | null;
  error?: string;
  reason?: string;
}

// ─── Run Execution ──────────────────────────────────────────────

export async function executeAgent(
  env: Env,
  agentModule: AgentModule,
  input: Record<string, unknown> = {},
  triggeredBy: string | null = null,
  triggerType: TriggerType = "manual",
): Promise<ExecuteAgentResult> {
  const agentId = agentModule.name;

  // ── Circuit breaker gate ────────────────────────────────────
  // Ensure the config row exists (zero-ceremony for agents added after migration).
  await env.DB.prepare(
    "INSERT OR IGNORE INTO agent_configs (agent_id) VALUES (?)"
  ).bind(agentId).run();

  const configRow = await env.DB.prepare(
    "SELECT enabled, paused_reason FROM agent_configs WHERE agent_id = ?"
  ).bind(agentId).first<{ enabled: number; paused_reason: string | null }>();

  if (configRow && configRow.enabled === 0) {
    const reason = configRow.paused_reason ?? "disabled";
    console.log(`[agentRunner] ${agentId}: circuit open (${reason}) — skipping`);

    // Log to agent_activity_log so FC dashboard can surface skips.
    try {
      await env.DB.prepare(
        `INSERT INTO agent_activity_log (id, agent_id, event_type, message, metadata_json, severity, created_at)
         VALUES (?, ?, 'circuit_open_skip', ?, ?, 'info', datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        agentId,
        `Agent ${agentId} skipped — circuit open (${reason})`,
        JSON.stringify({ agent_id: agentId, paused_reason: reason }),
      ).run();
    } catch { /* never block on logging */ }

    return { runId: "", status: "circuit_open", result: null, reason };
  }

  // ── Normal execution path ──────────────────────────────────
  const runId = crypto.randomUUID();

  // Create run record in v2 agent_runs table
  await env.DB.prepare(
    `INSERT INTO agent_runs (id, agent_id, started_at, status, records_processed, outputs_generated)
     VALUES (?, ?, datetime('now'), 'partial', 0, 0)`
  ).bind(runId, agentId).run();

  const ctx: AgentContext = { env, runId, agentName: agentId, input, triggeredBy };
  const start = Date.now();

  try {
    const result = await agentModule.execute(ctx);
    const durationMs = Date.now() - start;

    // Persist agent outputs if any
    let outputsGenerated = 0;
    if (result.agentOutputs && result.agentOutputs.length > 0) {
      for (const output of result.agentOutputs) {
        const outputId = crypto.randomUUID();
        try {
          await env.DB.prepare(
            `INSERT INTO agent_outputs (id, agent_id, type, summary, severity, details, related_brand_ids, related_campaign_id, related_provider_ids, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          ).bind(
            outputId, agentId, output.type, String(output.summary),
            output.severity ? String(output.severity) : null,
            output.details ? JSON.stringify(output.details) : null,
            output.relatedBrandIds ? JSON.stringify(output.relatedBrandIds) : null,
            output.relatedCampaignId ? String(output.relatedCampaignId) : null,
            output.relatedProviderIds ? JSON.stringify(output.relatedProviderIds) : null,
          ).run();
          outputsGenerated++;
        } catch (err) {
          console.error(`[agentRunner] ${agentId}: FAILED to persist output:`, err);
        }
      }
    }

    const finalStatus: RunStatus = result.approvals?.length ? "partial" : "success";

    await env.DB.prepare(
      `UPDATE agent_runs SET
         status = ?, duration_ms = ?, records_processed = ?,
         outputs_generated = ?, tokens_used = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(
      finalStatus, durationMs, result.itemsProcessed,
      outputsGenerated, result.tokensUsed ?? 0, runId,
    ).run();

    // ── Circuit breaker: reset counter on success/partial ────
    await env.DB.prepare(
      "UPDATE agent_configs SET consecutive_failures = 0, updated_at = datetime('now') WHERE agent_id = ?"
    ).bind(agentId).run();

    return { runId, status: finalStatus, result };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    await env.DB.prepare(
      `UPDATE agent_runs SET status = 'failed', error_message = ?, duration_ms = ?, completed_at = datetime('now') WHERE id = ?`
    ).bind(errorMsg, durationMs, runId).run();

    // ── Circuit breaker: increment counter + maybe trip ──────
    try {
      const prev = await env.DB.prepare(
        "SELECT consecutive_failures FROM agent_configs WHERE agent_id = ?"
      ).bind(agentId).first<{ consecutive_failures: number }>();
      const newCount = (prev?.consecutive_failures ?? 0) + 1;

      await env.DB.prepare(
        "UPDATE agent_configs SET consecutive_failures = ?, updated_at = datetime('now') WHERE agent_id = ?"
      ).bind(newCount, agentId).run();

      await tripCircuitIfNeeded(env, agentId, newCount, errorMsg);
    } catch (e) {
      console.error(`[agentRunner] ${agentId}: circuit breaker bookkeeping failed:`, e);
    }

    return { runId, status: "failed", result: null, error: errorMsg };
  }
}

// ─── Synchronous agent helper ───────────────────────────────────
//
// Thin wrapper around executeAgent for the synchronous (api-trigger)
// agent class introduced in AGENT_STANDARD §2. Synchronous agents are
// the ones called inline by HTTP handlers — they return a typed
// result the handler uses to build the response, instead of writing
// side effects and returning void.
//
// Identical lifecycle (agent_runs row, output schema validation,
// circuit breaker, cost guard) to executeAgent — the only difference
// is the default trigger label ('api' vs 'manual') and the return
// shape: callers get back the typed `data` directly so handlers
// don't have to reach into result.result.output.
//
// Per-agent input/output validation lives in the agent's execute()
// function via the inputSchema / outputSchema declared on the module
// (AGENT_STANDARD §8 G5/G6). runSyncAgent itself is type-agnostic —
// the generic <T> is convenience for the caller's cast.

export interface RunSyncAgentResult<T> {
  runId: string;
  status: RunStatus | "circuit_open";
  data: T | null;
  /** Populated when the underlying agent throws or its output schema
   *  rejects the AI response. Handlers should branch on `status` then
   *  fall back to a deterministic response if needed. */
  error?: string;
}

export async function runSyncAgent<T = unknown>(
  env: Env,
  agentModule: AgentModule,
  input: Record<string, unknown> = {},
): Promise<RunSyncAgentResult<T>> {
  const result = await executeAgent(env, agentModule, input, "api", "api");
  return {
    runId: result.runId,
    status: result.status,
    data: (result.result?.output ?? null) as T | null,
    error: result.error,
  };
}

// ─── Circuit Breaker Trip Check ─────────────────────────────────

async function tripCircuitIfNeeded(
  env: Env,
  agentId: string,
  newCount: number,
  lastError: string,
): Promise<void> {
  // Protected agents are never auto-tripped.
  if (PROTECTED_FROM_CIRCUIT_BREAKER.has(agentId)) return;

  // Resolve the effective threshold: per-agent override if non-NULL,
  // else global default from system_config, else hardcoded fallback.
  const perAgentRow = await env.DB.prepare(
    "SELECT consecutive_failure_threshold FROM agent_configs WHERE agent_id = ?"
  ).bind(agentId).first<{ consecutive_failure_threshold: number | null }>();

  let threshold: number;
  if (perAgentRow?.consecutive_failure_threshold != null && perAgentRow.consecutive_failure_threshold > 0) {
    threshold = perAgentRow.consecutive_failure_threshold;
  } else {
    try {
      const globalRow = await env.DB.prepare(
        "SELECT value FROM system_config WHERE key = 'agent_consecutive_failure_threshold'"
      ).first<{ value: string }>();
      const parsed = globalRow?.value != null ? parseInt(globalRow.value, 10) : NaN;
      threshold = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AGENT_FAILURE_THRESHOLD;
    } catch {
      threshold = DEFAULT_AGENT_FAILURE_THRESHOLD;
    }
  }

  if (newCount < threshold) return;

  // Check if already tripped (concurrent run could beat us to it).
  const current = await env.DB.prepare(
    "SELECT enabled FROM agent_configs WHERE agent_id = ?"
  ).bind(agentId).first<{ enabled: number }>();
  if (!current || current.enabled === 0) return;

  // Trip the circuit breaker.
  await env.DB.prepare(
    `UPDATE agent_configs SET
       enabled = 0,
       paused_reason = 'auto:consecutive_failures',
       paused_at = datetime('now'),
       paused_after_n_failures = ?,
       updated_at = datetime('now')
     WHERE agent_id = ? AND enabled = 1`
  ).bind(newCount, agentId).run();

  const truncatedError = lastError.slice(0, 500);

  // Fire critical notification — one per transition (rate-limited via
  // the agent_id metadata key in notifications.ts).
  try {
    await createNotification(env, {
      type: "circuit_breaker_tripped",
      severity: "critical",
      title: `Agent circuit breaker tripped: ${agentId}`,
      message: `${agentId} was auto-paused after ${newCount} consecutive failures (threshold ${threshold}). Last error: ${truncatedError}`,
      link: "/admin/agents",
      metadata: {
        agent_id: agentId,
        auto_paused: true,
        consecutive_failures: newCount,
        threshold,
        last_error: truncatedError,
      },
    });
  } catch (e) {
    console.error(`[agentRunner] ${agentId}: circuit breaker notification failed:`, e);
  }

  // Log to agent_activity_log.
  try {
    await env.DB.prepare(
      `INSERT INTO agent_activity_log (id, agent_id, event_type, message, metadata_json, severity, created_at)
       VALUES (?, ?, 'circuit_breaker_tripped', ?, ?, 'critical', datetime('now'))`
    ).bind(
      crypto.randomUUID(),
      agentId,
      `Agent ${agentId} auto-paused after ${newCount} consecutive failures (threshold ${threshold})`,
      JSON.stringify({
        agent_id: agentId,
        consecutive_failures: newCount,
        threshold,
        last_error: truncatedError,
      }),
    ).run();
  } catch (e) {
    console.error(`[agentRunner] ${agentId}: circuit breaker activity log failed:`, e);
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
