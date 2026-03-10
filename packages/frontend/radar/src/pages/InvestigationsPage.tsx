import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tickets, type InvestigationTicket } from "../lib/api";
import { Card, CardContent, Badge, Button, Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui";

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const statusColors: Record<string, "critical" | "high" | "medium" | "low" | "info"> = {
  open: "critical", in_progress: "medium", resolved: "low", closed: "info",
};

export function InvestigationsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: ["tickets", statusFilter],
    queryFn: () => tickets.list({ status: statusFilter }),
  });

  const createMut = useMutation({
    mutationFn: () => tickets.create({ title: "New Investigation", severity: "medium", category: "general" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => tickets.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const stats = data?.stats ?? {} as Record<string, number>;
  const ticketList = data?.tickets ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Investigations</h1>
          <p className="text-sm text-[--text-secondary]">Case management with LRX ticket IDs and status workflow</p>
        </div>
        <Button variant="default" size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          + New Investigation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total ?? 0 },
          { label: "Open", value: stats.open_count ?? 0, color: "text-threat-critical" },
          { label: "In Progress", value: stats.in_progress ?? 0, color: "text-threat-medium" },
          { label: "Resolved", value: stats.resolved ?? 0, color: "text-green-400" },
          { label: "Critical", value: stats.critical ?? 0, color: "text-threat-critical" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <Tabs value={statusFilter ?? "all"} onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter ?? "all"}>
          <Card>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading...</div>
              ) : ticketList.length === 0 ? (
                <div className="text-sm text-[--text-tertiary] py-8 text-center">No investigations found</div>
              ) : (
                <div className="space-y-3">
                  {ticketList.map((t) => (
                    <div key={t.id} className="flex items-center gap-4 p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-cyan-400">{t.ticket_id}</span>
                          <Badge variant={t.severity as "critical" | "high" | "medium" | "low"}>{t.severity}</Badge>
                          <Badge variant={statusColors[t.status] ?? "info"}>{t.status.replace("_", " ")}</Badge>
                        </div>
                        <h4 className="text-sm font-medium text-[--text-primary] truncate">{t.title}</h4>
                        <div className="text-xs text-[--text-tertiary] mt-0.5">
                          {t.category} · {timeAgo(t.created_at)}
                          {t.sla_due_at && <span className="ml-2 text-threat-medium">SLA: {new Date(t.sla_due_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {t.status === "open" && (
                          <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: t.id, status: "in_progress" })}>Start</Button>
                        )}
                        {t.status === "in_progress" && (
                          <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: t.id, status: "resolved" })}>Resolve</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
