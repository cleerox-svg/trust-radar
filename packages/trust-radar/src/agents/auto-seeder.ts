/**
 * Auto-Seeder Agent — weekly bulk seeding of spam-trap addresses.
 *
 * The Seed Strategist (agents/seed-strategist.ts) plans seeding via AI:
 * which channels to expand, which addresses to retire. That's a low-
 * volume daily analysis job. The Auto-Seeder is the *execution* arm —
 * actually planting addresses at scale into the channels the Strategist
 * recommended (paste sites, broker pages, GitHub gists, WHOIS records,
 * etc) and recording where each address landed for per-location yield
 * tracking (PR #874).
 *
 * This module is a placeholder. It runs the agent_runs lifecycle, logs
 * a no-op execution, and returns a clean success result. PR-b (the
 * seeding-at-scale job) replaces the body with real seeding logic
 * without any cron or wiring changes — the dispatch path scaffolded
 * here stays identical.
 *
 * Schedule: Sundays at 05:23 UTC. Off-peak, away from the existing
 * cron beats (:07 hourly, :12 every-6h, every-5min). Weekly cadence
 * is intentional — daily seeding overwhelms harvester ingestion windows
 * and costs more LLM tokens for the planning side.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";

export const autoSeederAgent: AgentModule = {
  name: "auto_seeder",
  displayName: "Auto-Seeder",
  description: "Bulk-plants spam-trap addresses into harvester channels on a weekly cadence",
  color: "#A78BFA",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(_ctx: AgentContext): Promise<AgentResult> {
    // Placeholder body. PR-b will replace this with the real seeding
    // logic: pull recent seed-strategist recommendations + active
    // seeding_locations from the seed_campaigns config, then plant N
    // addresses per channel with location attribution.
    //
    // Until then we run cleanly so the dispatch path + agent_runs
    // visibility are real, and the cron schedule has lived through at
    // least one tick before any meaningful change ships.
    const outputs: AgentOutputEntry[] = [
      {
        type: "diagnostic",
        summary:
          "auto_seeder placeholder run — no addresses planted (PR-b will fill in seeding logic)",
        severity: "info",
        details: { placeholder: true, planned_for: "PR (b) seeding-at-scale" },
      },
    ];

    return {
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      output: { placeholder: true },
      agentOutputs: outputs,
    };
  },
};
