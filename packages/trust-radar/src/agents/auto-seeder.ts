/**
 * Recon (auto_seeder) — weekly bulk seeding of spam-trap addresses.
 *
 * Plants synthetic Firstname.Lastname@<honeypot-domain> addresses
 * into seed_addresses, attributed to seeded_location =
 * 'auto-seeder:<domain>:<page>'. The /admin-portal and /internal-staff
 * page handlers (src/index.ts) read this same seeded_location at
 * render time and embed every active row as a visible mailto:
 * link, so the next time a harvester scrapes us they pick up the
 * fresh addresses.
 *
 * Per-page volume: SEEDS_PER_PAGE addresses / week × 2 pages × 52
 * weeks ≈ 600 addresses/year. Plenty of trap surface even before
 * we extend seeding to external paste sites / forums (a follow-up).
 *
 * Cohort tag (YYYYMMDD of run start) is embedded in agent_outputs
 * so an operator can see "this week's batch was N rows" without
 * cross-referencing seed_addresses.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { plantBatch, cohortTag } from "../lib/auto-seeder-planter";

const SEEDS_PER_PAGE = 6;

// Each entry is one (domain, page) target — addresses planted under
// the matching seeded_location are surfaced on that page's render.
// Adding a new honeypot page is two changes: a new entry here + a
// matching readRoster() call in the page handler.
const TARGETS: Array<{ domain: string; page: string }> = [
  { domain: "averrow.com", page: "/admin-portal" },
  { domain: "averrow.com", page: "/internal-staff" },
];

export const autoSeederAgent: AgentModule = {
  name: "auto_seeder",
  displayName: "Recon",
  description: "Spam-trap seeding agent — plants honeypot addresses into harvester channels and tracks per-location yield",
  color: "#10B981",
  trigger: "scheduled",
  requiresApproval: false,
  stallThresholdMinutes: 12100,
  parallelMax: 1,
  costGuard: "enforced",
  // No AI calls — auto-seeder plants spam-trap addresses. Cap at 0
  // so the diagnostic flags any unexpected AI spend as a regression.
  budget: { monthlyTokenCap: 0 },
  // Delegates SQL to lib/auto-seeder-planter.
  reads: [],
  writes: [],
  outputs: [{ type: "insight" }, { type: "diagnostic" }],
  status: "active",
  category: "intelligence",
  pipelinePosition: 19,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;
    const tag = cohortTag();
    const outputs: AgentOutputEntry[] = [];
    let totalCreated = 0;
    const perTarget: Array<{ location: string; planted: number }> = [];

    for (const target of TARGETS) {
      const seedLocationKey = `auto-seeder:${target.domain}:${target.page}`;
      try {
        const planted = await plantBatch(env, {
          domain: target.domain,
          seedLocationKey,
          count: SEEDS_PER_PAGE,
          cohortTag: tag,
        });
        totalCreated += planted.length;
        perTarget.push({ location: seedLocationKey, planted: planted.length });
      } catch (err) {
        // Defensive: plantBatch already catches per-row errors. A
        // throw here means something further upstream failed (eg D1
        // unavailable). Record per-target so the operator can tell
        // whether the run was a total wash or just one bucket.
        const errMsg = err instanceof Error ? err.message : String(err);
        outputs.push({
          type: "diagnostic",
          summary: `Recon: planting failed for ${seedLocationKey} — ${errMsg}`,
          severity: "high",
          details: { seedLocationKey, error: errMsg },
        });
        perTarget.push({ location: seedLocationKey, planted: 0 });
      }
    }

    outputs.push({
      type: "insight",
      summary: `Recon planted ${totalCreated} spam-trap addresses across ${TARGETS.length} honeypot pages (cohort ${tag})`,
      severity: "info",
      details: { cohortTag: tag, perTarget, seeds_per_page: SEEDS_PER_PAGE },
    });

    return {
      itemsProcessed: TARGETS.length,
      itemsCreated: totalCreated,
      itemsUpdated: 0,
      output: { cohortTag: tag, perTarget },
      agentOutputs: outputs,
    };
  },
};
