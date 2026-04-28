// AgentMesh — chicklet-grid redesign of the admin agents page.
//
// Replaces the long monolithic Agents.tsx layout with themed groups
// of chicklets and a fly-out drill-down. Mounted at /agents/mesh
// alongside the existing /agents page so reviewers can compare.
//
// Composition:
//   useAgents() (existing hook, refetches every 30s) → list of Agent
//   AGENT_GROUP_LIST (lib/agent-groups.ts)            → group taxonomy
//   AGENT_METADATA (lib/agent-metadata.ts)            → presentation data
//
//   For each group:
//     resolve member agents from metadata + live status
//     render AgentGroupSection with the chicklet grid
//     if the selected agent belongs to the group AND we're on
//       desktop (sm+), render AgentDrillDownPanel inline below
//
//   Above the grid: page header + a single global drill-down panel
//   for mobile (full-screen modal variant).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAgents, type Agent } from "@/hooks/useAgents";
import { AGENT_GROUP_LIST } from "@/lib/agent-groups";
import { AGENT_METADATA, type AgentId } from "@/lib/agent-metadata";
import { AgentGroupSection, type AgentChickletData } from "./chicklet/AgentGroupSection";
import { AgentDrillDownPanel } from "./chicklet/AgentDrillDownPanel";
import type { ChickletStatus } from "./chicklet/AgentChicklet";
import { PageHeader } from "@/design-system/components";

// ─── Tailwind sm breakpoint = 640px (matches the chicklet grid) ──
const DESKTOP_BREAKPOINT_PX = 640;

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`).matches,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

// ─── Map live agent status → chicklet status ────────────────────
function statusFor(agent: Agent | undefined): ChickletStatus {
  if (!agent) return "unknown";
  if (agent.circuit_state === "tripped" || agent.circuit_state === "manual_pause") return "tripped";
  if (agent.last_run_status === "running") return "running";
  if (agent.last_run_status === "failed" || agent.last_run_status === "error") return "stalled";
  if (agent.error_count_24h > 0) return "degraded";
  if (agent.last_run_status === "success" || agent.last_run_status === "completed") return "healthy";
  return "unknown";
}

export function AgentMesh() {
  const { data: agents = [], isLoading } = useAgents();
  const isDesktop = useIsDesktop();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Live-status lookup table — O(1) per chicklet vs. an O(n) find.
  const agentStatusMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents) m.set(a.agent_id, a);
    return m;
  }, [agents]);

  // Pre-resolve chicklet data per group so AgentGroupSection stays
  // dumb (just renders what it's given).
  const groupedChicklets = useMemo(() => {
    return AGENT_GROUP_LIST.map((group) => {
      const chicklets: AgentChickletData[] = group.agentIds.flatMap((id) => {
        const meta = AGENT_METADATA[id as AgentId];
        if (!meta) return [];
        const live = agentStatusMap.get(id);
        const item: AgentChickletData = {
          metadata: meta,
          status: statusFor(live),
        };
        if (live?.schedule && live.schedule !== "-") item.scheduleLabel = live.schedule;
        return [item];
      });
      return { group, chicklets };
    });
  }, [agentStatusMap]);

  // Toggle selection — clicking the selected chicklet again closes it.
  const onSelectAgent = useCallback((agentId: string) => {
    setSelectedAgentId((prev) => (prev === agentId ? null : agentId));
  }, []);

  const onClose = useCallback(() => setSelectedAgentId(null), []);

  // Resolve the selected agent's metadata + group accent for the
  // drill-down panel. Falls back to `null` if the selection points
  // at an agent with no metadata (shouldn't happen — defensive).
  const selectedDetails = useMemo(() => {
    if (!selectedAgentId) return null;
    const meta = AGENT_METADATA[selectedAgentId as AgentId];
    if (!meta) return null;
    const owningGroup = AGENT_GROUP_LIST.find((g) => g.agentIds.includes(selectedAgentId as never));
    return { meta, accentColor: owningGroup?.accentVar ?? "var(--amber, #E5A832)" };
  }, [selectedAgentId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Mesh"
        subtitle={`${agents.length} agents deployed across ${AGENT_GROUP_LIST.length} themed groups. Click a chicklet for details.`}
      />

      {isLoading && agents.length === 0 ? (
        <div
          role="status"
          aria-label="Loading agent mesh"
          className="text-xs text-[var(--text-secondary,rgba(255,255,255,0.60))] font-mono"
        >
          Loading mesh…
        </div>
      ) : null}

      <div className="space-y-8">
        {groupedChicklets.map(({ group, chicklets }) => (
          <AgentGroupSection
            key={group.key}
            group={group}
            agents={chicklets}
            selectedAgentId={selectedAgentId}
            onSelectAgent={onSelectAgent}
            // Inline drill-down only on desktop. Mobile uses the
            // full-screen modal rendered globally below.
            drillDownSlot={
              isDesktop && selectedDetails && group.agentIds.includes(selectedAgentId as never)
                ? (
                  <AgentDrillDownPanel
                    metadata={selectedDetails.meta}
                    accentColor={selectedDetails.accentColor}
                    variant="inline"
                    onClose={onClose}
                  />
                )
                : null
            }
          />
        ))}
      </div>

      {/* Mobile full-screen modal — rendered once globally rather
          than per group. */}
      {!isDesktop && selectedDetails ? (
        <AgentDrillDownPanel
          metadata={selectedDetails.meta}
          accentColor={selectedDetails.accentColor}
          variant="modal"
          onClose={onClose}
        />
      ) : null}
    </div>
  );
}
