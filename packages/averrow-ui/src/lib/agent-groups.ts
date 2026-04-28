// Themed groups for the admin agents redesign.
//
// Groups are a UX concept — they're how the admin agents page (chicklet
// view) lays the mesh out. Distinct from agent-metadata.ts's `category`
// field, which is more of a taxonomy used elsewhere. The groups here
// are:
//   1. Detection — agents that surface signals (feeds, certs, scans)
//   2. Intelligence — agents that classify, correlate, and reason
//   3. Action — agents that take outbound actions (takedowns, leads)
//   4. Surface — agents that monitor specific surfaces (social, app store, dark web)
//      (currently scanner-driven from the orchestrator, no agent module)
//   5. Platform — agents that keep the mesh itself healthy
//   6. Orchestration — Flight Control sits alone here as the supervisor
//
// Color is the chicklet's accent + drill-down panel border. Pulled from
// CLAUDE.md design tokens — every group uses one of the platform's
// canonical colors. Order is the visual order on the page (flight
// control first since it's the supervisor).

import type { AgentId } from "./agent-metadata";

export type AgentGroupKey =
  | "orchestration"
  | "detection"
  | "intelligence"
  | "action"
  | "platform"
  | "meta";

export interface AgentGroup {
  key: AgentGroupKey;
  label: string;
  tagline: string;
  /** CSS color from the design tokens (CLAUDE.md §5). */
  accentVar: string;
  /** Visual order on the page; lower renders first. */
  order: number;
  /** Agents that belong in this group. Source of truth for grouping. */
  agentIds: readonly AgentId[];
}

export const AGENT_GROUPS: Record<AgentGroupKey, AgentGroup> = {
  orchestration: {
    key: "orchestration",
    label: "Orchestration",
    tagline: "Supervises the mesh — scaling, stall recovery, budget enforcement.",
    accentVar: "var(--orbital-teal, #00d4ff)",
    order: 1,
    agentIds: ["flight_control"] as const,
  },
  detection: {
    key: "detection",
    label: "Detection",
    tagline: "Surfaces signals — certs, feeds, infrastructure, social mentions.",
    accentVar: "var(--red, #C83C3C)",
    order: 2,
    agentIds: ["sentinel", "cartographer", "navigator"] as const,
  },
  intelligence: {
    key: "intelligence",
    label: "Intelligence",
    tagline: "Classifies, correlates, and reasons over the signal stream.",
    accentVar: "var(--amber, #E5A832)",
    order: 3,
    agentIds: ["analyst", "strategist", "nexus", "observer"] as const,
  },
  action: {
    key: "action",
    label: "Action",
    tagline: "Takes outbound action — takedowns, lead generation, brand pursuit.",
    accentVar: "var(--green, #3CB878)",
    order: 4,
    agentIds: ["sparrow", "pathfinder"] as const,
  },
  platform: {
    key: "platform",
    label: "Platform Health",
    tagline: "Keeps the mesh and its data layer healthy.",
    accentVar: "var(--blue, #0A8AB5)",
    order: 5,
    agentIds: ["curator", "watchdog"] as const,
  },
  meta: {
    key: "meta",
    label: "Meta",
    tagline: "Reasons about the platform itself.",
    accentVar: "var(--text-secondary, rgba(255,255,255,0.60))",
    order: 6,
    agentIds: ["architect"] as const,
  },
};

/** All groups sorted by `order`. */
export const AGENT_GROUP_LIST: AgentGroup[] = Object.values(AGENT_GROUPS).sort(
  (a, b) => a.order - b.order,
);

/** Reverse lookup: which group does this agent belong to? */
export function getAgentGroup(agentId: AgentId): AgentGroup | null {
  for (const group of AGENT_GROUP_LIST) {
    if (group.agentIds.includes(agentId)) return group;
  }
  return null;
}
