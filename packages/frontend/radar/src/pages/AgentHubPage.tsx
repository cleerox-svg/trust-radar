import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  agents, type AgentDefinition, type AgentRun, type AgentApproval, type AgentDetail,
} from "../lib/api";
import {
  Card, CardContent, Badge, Button, Tabs, TabsList, TabsTrigger, TabsContent,
  Sheet, SheetHeader, SheetTitle,
} from "../components/ui";
import { AgentCard } from "../components/ui/AgentCard";
import { StatusDot } from "../components/ui/StatusDot";

function timeAgo(date: string | null | undefined): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatMs(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function runStatusVariant(status: string): "active" | "alert" | "scanning" | "idle" | "offline" {
  switch (status) {
    case "success": return "active";
    case "failed": return "alert";
    case "running": return "scanning";
    case "awaiting_approval": return "idle";
    default: return "offline";
  }
}

function runStatusBadge(status: string) {
  const map: Record<string, "low" | "critical" | "info" | "medium" | "high"> = {
    success: "low", failed: "critical", running: "info",
    awaiting_approval: "medium", queued: "info", cancelled: "high", timeout: "critical",
  };
  return <Badge variant={map[status] ?? "default"}>{status}</Badge>;
}

// ─── Main Page ──────────────────────────────────────────────────

export function AgentHubPage() {
  const qc = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const { data: agentList, isLoading } = useQuery({ queryKey: ["agents"], queryFn: agents.list });
  const { data: statsData } = useQuery({ queryKey: ["agent-stats"], queryFn: agents.stats });
  const { data: approvals } = useQuery({ queryKey: ["agent-approvals"], queryFn: () => agents.approvals("pending") });

  const triggerMut = useMutation({
    mutationFn: (name: string) => agents.trigger(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
    },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Agent Hub</h1>
        <p className="text-sm text-[--text-secondary]">AI agent command center — monitor, trigger, and approve agent actions</p>
      </div>

      {/* Summary Cards */}
      {statsData && <AgentSummary stats={statsData} pendingApprovals={approvals?.length ?? 0} />}

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agents ({agentList?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals {approvals && approvals.length > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-threat-critical/20 text-threat-critical">
                {approvals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          {isLoading ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading agents...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(agentList ?? []).map((agent) => (
                <AgentCard
                  key={agent.name}
                  name={agent.displayName}
                  description={agent.description}
                  status={agentStatus(agent)}
                  color={agent.color}
                  lastRun={timeAgo(agent.latestRun?.completed_at ?? agent.latestRun?.created_at)}
                  runsToday={agent.runsToday}
                  onClick={() => setSelectedAgent(agent.name)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approvals">
          <ApprovalQueue approvals={approvals ?? []} />
        </TabsContent>

        <TabsContent value="runs">
          <RunHistory />
        </TabsContent>
      </Tabs>

      {/* Agent Detail Sheet */}
      <AgentDetailSheet
        agentName={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onTrigger={(name) => triggerMut.mutate(name)}
        triggering={triggerMut.isPending}
      />
    </div>
  );
}

// ─── Summary Cards ──────────────────────────────────────────────

function AgentSummary({ stats, pendingApprovals }: {
  stats: { summary: Record<string, number>; todayByAgent: Array<Record<string, unknown>> };
  pendingApprovals: number;
}) {
  const s = stats.summary;
  const cards = [
    { label: "Total Runs", value: s.total_runs ?? 0, sub: `${s.successes ?? 0} successes` },
    { label: "Running", value: s.running ?? 0, sub: `${s.awaiting_approval ?? 0} awaiting` },
    { label: "Pending Approvals", value: pendingApprovals, sub: pendingApprovals > 0 ? "Action needed" : "All clear" },
    { label: "Items Processed", value: s.total_processed ?? 0, sub: `${s.total_created ?? 0} created` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent>
            <div className="text-xs text-[--text-tertiary] mb-1">{c.label}</div>
            <div className="text-2xl font-bold text-[--text-primary] tabular-nums">{c.value}</div>
            <div className="text-xs text-[--text-secondary] mt-1">{c.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Approval Queue ─────────────────────────────────────────────

function ApprovalQueue({ approvals }: { approvals: AgentApproval[] }) {
  const qc = useQueryClient();
  const resolveMut = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      agents.resolveApproval(id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-approvals"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
    },
  });

  if (approvals.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <StatusDot variant="active" />
            </div>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-1">No Pending Approvals</h3>
            <p className="text-xs text-[--text-tertiary]">All agent actions have been reviewed.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {approvals.map((a) => {
        let details: Record<string, string> = {};
        try { details = JSON.parse(a.details) as Record<string, string>; } catch { /* ignore */ }

        return (
          <Card key={a.id}>
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="medium">{a.action_type}</Badge>
                    <span className="text-xs text-[--text-tertiary] font-mono">{a.agent_name}</span>
                  </div>
                  <p className="text-sm text-[--text-primary] mb-2">{a.description}</p>
                  {"draftNotice" in details && details.draftNotice && (
                    <pre className="text-xs text-[--text-secondary] bg-[--surface-base] rounded p-3 overflow-x-auto max-h-40 whitespace-pre-wrap">
                      {String(details.draftNotice)}
                    </pre>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-[--text-tertiary]">
                    <span>Created {timeAgo(a.created_at)}</span>
                    {a.expires_at && <span>Expires {timeAgo(a.expires_at)}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={resolveMut.isPending}
                    onClick={() => resolveMut.mutate({ id: a.id, decision: "approved" })}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={resolveMut.isPending}
                    onClick={() => resolveMut.mutate({ id: a.id, decision: "rejected" })}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Run History ────────────────────────────────────────────────

function RunHistory() {
  const { data: runs, isLoading } = useQuery({ queryKey: ["agent-runs"], queryFn: () => agents.runs(50) });

  if (isLoading) return <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading...</div>;

  return (
    <Card>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[--border-subtle] text-left text-xs text-[--text-tertiary]">
                <th className="pb-2 pr-4">Agent</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Trigger</th>
                <th className="pb-2 pr-4">Processed</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2 pr-4">Duration</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).map((run) => (
                <tr key={run.id} className="border-b border-[--border-subtle] last:border-0">
                  <td className="py-2 pr-4 font-medium text-[--text-primary]">{run.agent_name}</td>
                  <td className="py-2 pr-4">{runStatusBadge(run.status)}</td>
                  <td className="py-2 pr-4 text-[--text-secondary]">{run.trigger_type}</td>
                  <td className="py-2 pr-4 text-[--text-secondary] tabular-nums">{run.items_processed}</td>
                  <td className="py-2 pr-4 text-[--text-secondary] tabular-nums">{run.items_created}</td>
                  <td className="py-2 pr-4 text-[--text-secondary] tabular-nums">{formatMs(run.duration_ms)}</td>
                  <td className="py-2 text-[--text-tertiary]">{timeAgo(run.created_at)}</td>
                </tr>
              ))}
              {(!runs || runs.length === 0) && (
                <tr><td colSpan={7} className="py-8 text-center text-[--text-tertiary]">No runs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Agent Detail Sheet ─────────────────────────────────────────

function AgentDetailSheet({ agentName, onClose, onTrigger, triggering }: {
  agentName: string | null; onClose: () => void;
  onTrigger: (name: string) => void; triggering: boolean;
}) {
  const { data } = useQuery({
    queryKey: ["agent-detail", agentName],
    queryFn: () => agents.get(agentName!),
    enabled: !!agentName,
  });

  return (
    <Sheet open={!!agentName} onClose={onClose} width="w-[480px]">
      {data && (
        <>
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: data.agent.color + "25", color: data.agent.color }}
              >
                {data.agent.displayName.charAt(0)}
              </div>
              <div>
                <SheetTitle>{data.agent.displayName}</SheetTitle>
                <p className="text-xs text-[--text-tertiary] mt-0.5">{data.agent.description}</p>
              </div>
            </div>
          </SheetHeader>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Total Runs", value: data.stats.total_runs ?? 0 },
              { label: "Success Rate", value: data.stats.total_runs ? `${Math.round(((data.stats.successes ?? 0) / data.stats.total_runs) * 100)}%` : "—" },
              { label: "Avg Duration", value: formatMs(data.stats.avg_duration_ms) },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                <div className="text-[10px] text-[--text-tertiary] mb-1">{s.label}</div>
                <div className="text-lg font-bold text-[--text-primary] tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Trigger */}
          <div className="mb-6">
            <Button
              variant="default"
              size="sm"
              disabled={triggering}
              onClick={() => onTrigger(data.agent.name)}
              className="w-full"
            >
              {triggering ? "Running..." : `Trigger ${data.agent.displayName}`}
            </Button>
            <div className="flex items-center gap-3 mt-2 text-xs text-[--text-tertiary]">
              <span>Trigger: {data.agent.trigger}</span>
              {data.agent.requiresApproval && <Badge variant="medium">HITL</Badge>}
            </div>
          </div>

          {/* Recent Runs */}
          <h4 className="text-sm font-semibold text-[--text-primary] mb-3">Recent Runs</h4>
          <div className="space-y-2">
            {data.runs.slice(0, 15).map((run) => (
              <div key={run.id} className="flex items-center gap-3 p-2 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                <StatusDot variant={runStatusVariant(run.status)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {runStatusBadge(run.status)}
                    <span className="text-xs text-[--text-tertiary]">{run.trigger_type}</span>
                  </div>
                  <div className="text-[11px] text-[--text-tertiary] mt-0.5 font-mono">
                    {run.items_processed} processed · {run.items_created} created · {formatMs(run.duration_ms)}
                  </div>
                </div>
                <span className="text-[10px] text-[--text-tertiary] shrink-0">{timeAgo(run.created_at)}</span>
              </div>
            ))}
            {data.runs.length === 0 && (
              <div className="text-sm text-[--text-tertiary] text-center py-6">No runs yet</div>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function agentStatus(agent: AgentDefinition): "active" | "scanning" | "alert" | "idle" | "offline" {
  if (!agent.latestRun) return "idle";
  const status = agent.latestRun.status;
  if (status === "running") return "scanning";
  if (status === "failed") return "alert";
  if (status === "success") return "active";
  if (status === "awaiting_approval") return "idle";
  return "offline";
}
