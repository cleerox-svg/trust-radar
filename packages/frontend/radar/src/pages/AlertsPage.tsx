import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alerts, type SignalAlert } from "../lib/api";
import { Card, CardContent, Badge, Button } from "../components/ui";
import { StatusDot } from "../components/ui/StatusDot";

const statusVariant: Record<string, "critical" | "medium" | "low"> = {
  open: "critical", acked: "medium", resolved: "low",
};

export default function AlertsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "open" | "acked" | "resolved">("all");
  const { data, isLoading } = useQuery({ queryKey: ["alerts"], queryFn: alerts.list });

  const ackMut = useMutation({
    mutationFn: (id: string) => alerts.ack(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const list = data ?? [];
  const filtered = list.filter((a) => filter === "all" || a.status === filter);
  const openCount = list.filter((a) => a.status === "open").length;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Critical Alerts</h1>
          <p className="text-sm text-[--text-secondary]">Anomaly detections requiring review</p>
        </div>
        {openCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-1.5">
            <StatusDot variant="alert" />
            {openCount} open alert{openCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "open", "acked", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-400"
                : "border-[--border-subtle] text-[--text-tertiary] hover:text-[--text-secondary]"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && <span className="ml-1.5 opacity-70">{list.filter((a) => a.status === f).length}</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-[--text-tertiary] py-12 text-center">Loading alerts...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-sm text-[--text-tertiary] py-8 text-center">
              No alerts {filter !== "all" ? `with status "${filter}"` : "found"}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id} className={a.status === "resolved" ? "opacity-50" : undefined}>
              <CardContent>
                <div className="flex items-start gap-4">
                  <StatusDot variant={a.status === "open" ? "alert" : a.status === "acked" ? "scanning" : "active"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-mono text-[--text-primary]">{a.domain ?? a.scan_ref ?? a.source}</span>
                      <Badge variant={statusVariant[a.status]}>{a.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[--text-tertiary]">
                      <span>Source: <span className="text-cyan-400 font-mono">{a.source}</span></span>
                      <span>Quality: <Badge variant={a.quality >= 80 ? "low" : a.quality >= 50 ? "medium" : "critical"}>{a.quality}%</Badge></span>
                      <span>{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {a.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ackMut.isPending}
                      onClick={() => ackMut.mutate(a.id)}
                    >
                      ACK
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
