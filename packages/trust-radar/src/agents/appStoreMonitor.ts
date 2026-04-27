/**
 * App-Store Monitor Agent — wraps the per-brand app-store scanner as a
 * first-class AgentModule so every run lands in agent_runs / agent_outputs
 * and surfaces in Flight Control + platform-diagnostics + the Agents UI.
 *
 * The scanner batch (`runAppStoreMonitorBatch`) already handles:
 *   - brand-monitor-schedule seeding
 *   - due-brand selection
 *   - per-brand alerts on HIGH / CRITICAL findings
 *   - Haiku AI review promotion of ambiguous rows
 *   - post-scan brand exposure score recompute
 *
 * This wrapper just converts the batch return into an AgentResult and
 * emits a single insight-level agent_outputs row when the tick did work.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";

export const appStoreMonitorAgent: AgentModule = {
  name: "app_store_monitor",
  displayName: "App Store Monitor",
  description: "Mobile-app impersonation detection across iOS (Play + 3rd-party stores later)",
  color: "#0A8AB5",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;
    const { runAppStoreMonitorBatch } = await import("../scanners/app-store-monitor");

    const stats = await runAppStoreMonitorBatch(env);

    const outputs: AgentOutputEntry[] = [];
    if (stats.brands_processed > 0) {
      outputs.push({
        type: "diagnostic",
        summary: `App-store scan: ${stats.brands_processed} brands, ${stats.rows_upserted} listings upserted, ${stats.alerts_created} alerts, ${stats.ai_processed} AI-reviewed (${stats.ai_upgraded} promoted)`,
        severity: stats.alerts_created > 0 ? "medium" : "info",
        details: stats,
      });
    }

    return {
      itemsProcessed: stats.brands_processed,
      itemsCreated: stats.rows_upserted,
      itemsUpdated: 0,
      output: stats,
      agentOutputs: outputs,
    };
  },
};
