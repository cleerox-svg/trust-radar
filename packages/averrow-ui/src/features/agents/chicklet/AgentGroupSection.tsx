// AgentGroupSection — renders one themed group of agents.
//
// A group consists of: a header (label + tagline + count), a
// responsive grid of AgentChicklets, and a slot below for the
// drill-down panel (rendered by the parent based on selection state).
//
// Responsive grid:
//   mobile  (< sm) — 2 columns with smaller padding
//   tablet  (sm)   — 3 columns
//   desktop (lg)   — 4 columns
//   xl              — 5 columns for groups with > 4 agents
// All breakpoints use Tailwind defaults so they match the rest of the
// app's responsive scale.
//
// Selection state lifts to the parent (AgentMeshPage) so the drill-down
// panel can be rendered once globally rather than per-group, and so a
// selection in one group can deselect what was open in another.

import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import { AgentChicklet, type ChickletStatus } from "./AgentChicklet";
import type { AgentGroup } from "@/lib/agent-groups";
import type { AgentMetadata } from "@/lib/agent-metadata";

export interface AgentChickletData {
  metadata: AgentMetadata;
  status: ChickletStatus;
  scheduleLabel?: string;
}

export interface AgentGroupSectionProps {
  group: AgentGroup;
  /** Pre-resolved chicklet data for the agents in this group. */
  agents: AgentChickletData[];
  /** Currently-selected agentId (may be in another group). */
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  /**
   * Optional drill-down slot. Only rendered when the selected agent
   * belongs to THIS group — keeps the inline-expand UX contained.
   * On mobile the parent typically passes nothing here and uses a
   * full-screen modal instead.
   */
  drillDownSlot?: ReactNode;
}

const AgentGroupSectionInner = function AgentGroupSection({
  group,
  agents,
  selectedAgentId,
  onSelectAgent,
  drillDownSlot,
}: AgentGroupSectionProps) {
  // The drill-down only renders inline if the selected agent lives in
  // this group. Saves the parent from passing per-group slot prop.
  const ownsSelection = useMemo(
    () => selectedAgentId != null && group.agentIds.includes(selectedAgentId as never),
    [selectedAgentId, group.agentIds],
  );

  return (
    <section
      className="space-y-3"
      aria-labelledby={`agent-group-${group.key}`}
    >
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`agent-group-${group.key}`}
            className="text-sm font-mono font-semibold uppercase tracking-widest"
            style={{ color: group.accentVar }}
          >
            {group.label}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary,rgba(255,255,255,0.60))] line-clamp-2">
            {group.tagline}
          </p>
        </div>
        <span
          className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {agents.length} {agents.length === 1 ? "agent" : "agents"}
        </span>
      </header>

      {/* Responsive chicklet grid:
            mobile  → 2 cols
            sm      → 3 cols
            lg      → 4 cols
          The grid itself owns spacing — chicklets are width-agnostic. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {agents.map(({ metadata, status, scheduleLabel }) => (
          <AgentChicklet
            key={metadata.id}
            agentId={metadata.id}
            displayName={metadata.displayName}
            subtitle={metadata.subtitle}
            accentColor={group.accentVar}
            status={status}
            scheduleLabel={scheduleLabel}
            isSelected={selectedAgentId === metadata.id}
            onSelect={onSelectAgent}
          />
        ))}
      </div>

      {/* Drill-down rendered inline below the grid when an agent in
          THIS group is selected. Parent decides whether to render
          here or in a modal (mobile breakpoint). */}
      {ownsSelection && drillDownSlot ? (
        <div className="pt-1">{drillDownSlot}</div>
      ) : null}
    </section>
  );
};

export const AgentGroupSection = memo(AgentGroupSectionInner);
