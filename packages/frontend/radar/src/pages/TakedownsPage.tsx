import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { erasures, type ErasureAction } from "../lib/api";
import { Card, CardContent, Badge, Button } from "../components/ui";
import { StatusDot } from "../components/ui/StatusDot";

function timeAgo(d: string | null): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const statusMap: Record<string, { variant: "active" | "alert" | "scanning" | "idle" | "offline"; badge: "low" | "critical" | "medium" | "info" | "high" }> = {
  pending: { variant: "idle", badge: "info" },
  submitted: { variant: "scanning", badge: "medium" },
  acknowledged: { variant: "scanning", badge: "high" },
  resolved: { variant: "active", badge: "low" },
  rejected: { variant: "alert", badge: "critical" },
};

export function TakedownsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["erasures"], queryFn: () => erasures.list() });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => erasures.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["erasures"] }),
  });

  const stats = data?.stats ?? {} as Record<string, number>;
  const list = data?.erasures ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Takedowns & Response</h1>
        <p className="text-sm text-[--text-secondary]">Erasure orchestrator with provider tracking and status workflow</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total ?? 0 },
          { label: "Pending", value: stats.pending ?? 0 },
          { label: "Submitted", value: stats.submitted ?? 0, color: "text-threat-medium" },
          { label: "Acknowledged", value: stats.acknowledged ?? 0, color: "text-threat-high" },
          { label: "Resolved", value: stats.resolved ?? 0, color: "text-green-400" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Erasure list */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Takedown Actions ({list.length})</h3>
          {isLoading ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading...</div>
          ) : list.length === 0 ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">No takedown actions found</div>
          ) : (
            <div className="space-y-3">
              {list.map((e) => {
                const sm = statusMap[e.status] ?? statusMap.pending;
                return (
                  <div key={e.id} className="flex items-center gap-4 p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                    <StatusDot variant={sm.variant} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[--text-primary] truncate">{e.target_value}</span>
                        <Badge variant={sm.badge}>{e.status}</Badge>
                        <span className="text-xs text-[--text-tertiary]">{e.target_type}</span>
                      </div>
                      <div className="text-xs text-[--text-tertiary]">
                        Provider: {e.provider || "—"} · Method: {e.method} · {timeAgo(e.created_at)}
                        {e.ticket_id && <span className="ml-2 text-cyan-400 font-mono">{e.ticket_id}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {e.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: e.id, status: "submitted" })}>Submit</Button>
                      )}
                      {e.status === "submitted" && (
                        <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: e.id, status: "acknowledged" })}>Ack</Button>
                      )}
                      {e.status === "acknowledged" && (
                        <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: e.id, status: "resolved" })}>Resolve</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
