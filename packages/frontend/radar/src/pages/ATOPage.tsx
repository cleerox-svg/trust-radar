import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { atoEvents, type ATOEvent } from "../lib/api";
import { Card, CardContent, Badge, Button } from "../components/ui";

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const statusBadge: Record<string, "critical" | "high" | "medium" | "low" | "info"> = {
  new: "critical", investigating: "medium", confirmed: "high", resolved: "low", false_positive: "info",
};

export function ATOPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: ["ato-events", statusFilter],
    queryFn: () => atoEvents.list(statusFilter),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => atoEvents.update(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ato-events"] }),
  });

  const stats = data?.stats ?? {} as Record<string, number>;
  const events = data?.events ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Account Takeover</h1>
        <p className="text-sm text-[--text-secondary]">Suspicious login detection, risk scoring, and incident response</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Events", value: stats.total ?? 0 },
          { label: "New", value: stats.new_count ?? 0, color: "text-threat-critical" },
          { label: "Investigating", value: stats.investigating ?? 0, color: "text-threat-medium" },
          { label: "Confirmed", value: stats.confirmed ?? 0, color: "text-threat-high" },
          { label: "High Risk", value: stats.high_risk ?? 0, color: "text-red-400" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "new", "investigating", "confirmed", "resolved", "false_positive"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === "all" ? undefined : s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              (s === "all" && !statusFilter) || s === statusFilter
                ? "border-cyan-500 bg-cyan-500/15 text-blue-500"
                : "border-[--border-subtle] text-[--text-tertiary] hover:text-[--text-secondary]"
            }`}
          >
            {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Event list */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">ATO Events ({events.length})</h3>
          {isLoading ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">No ATO events found</div>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-4 p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-[--text-primary] truncate">{ev.email}</span>
                      <Badge variant={statusBadge[ev.status] ?? "info"}>{ev.status.replace("_", " ")}</Badge>
                      <span className={`text-xs font-bold tabular-nums ${ev.risk_score >= 80 ? "text-red-400" : ev.risk_score >= 50 ? "text-threat-medium" : "text-[--text-tertiary]"}`}>
                        Risk: {ev.risk_score}
                      </span>
                    </div>
                    <div className="text-xs text-[--text-tertiary]">
                      {ev.event_type} · {ev.ip_address ?? "—"} · {ev.country_code ?? "—"} · {ev.source} · {timeAgo(ev.detected_at)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {ev.status === "new" && (
                      <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: ev.id, status: "investigating" })}>Investigate</Button>
                    )}
                    {ev.status === "investigating" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: ev.id, status: "confirmed" })}>Confirm</Button>
                        <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: ev.id, status: "false_positive" })}>FP</Button>
                      </>
                    )}
                    {ev.status === "confirmed" && (
                      <Button variant="ghost" size="sm" onClick={() => updateMut.mutate({ id: ev.id, status: "resolved" })}>Resolve</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
