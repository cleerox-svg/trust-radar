import { useEffect, useState } from "react";
import { alerts, SignalAlert } from "../lib/api";

function statusBadge(status: SignalAlert["status"]) {
  const map = {
    open:     "bg-radar-red/20 text-radar-red",
    acked:    "bg-radar-yellow/20 text-radar-yellow",
    resolved: "bg-radar-green/20 text-radar-green",
  };
  return (
    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${map[status]}`}>
      {status}
    </span>
  );
}

export default function AlertsPage() {
  const [data, setData] = useState<SignalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "acked" | "resolved">("all");

  useEffect(() => {
    alerts.list()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAck = async (id: string) => {
    setAcking(id);
    try {
      await alerts.ack(id);
      setData((prev) => prev.map((a) => a.id === id ? { ...a, status: "acked" } : a));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAcking(null);
    }
  };

  const filtered = data.filter((a) => filter === "all" || a.status === filter);
  const openCount = data.filter((a) => a.status === "open").length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-radar-text">Alerts</h1>
          <p className="text-xs text-radar-muted mt-0.5">Anomaly detections requiring review</p>
        </div>
        {openCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs bg-radar-red/10 border border-radar-red/30 text-radar-red rounded-lg px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-radar-red animate-pulse" />
            {openCount} open alert{openCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(["all", "open", "acked", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f
                ? "bg-radar-cyan/10 border-radar-cyan text-radar-cyan"
                : "border-radar-border text-radar-muted hover:text-radar-text"
            }`}
          >
            {f}
            {f !== "all" && (
              <span className="ml-1.5 text-[10px] opacity-70">
                {data.filter((a) => a.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="card border-radar-red/30 bg-radar-red/5 text-radar-red text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-radar-muted text-sm animate-pulse">
          Loading alerts…
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="card text-center text-radar-muted text-sm py-10">
              No alerts {filter !== "all" ? `with status "${filter}"` : "found"}
            </div>
          )}
          {filtered.map((a) => (
            <div
              key={a.id}
              className={`card flex items-start gap-4 transition-opacity ${
                a.status === "resolved" ? "opacity-50" : ""
              }`}
            >
              {/* Severity dot */}
              <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                a.status === "open" ? "bg-radar-red animate-pulse" :
                a.status === "acked" ? "bg-radar-yellow" : "bg-radar-green"
              }`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-mono text-radar-text">
                    {a.domain ?? a.scan_ref ?? a.source}
                  </span>
                  {statusBadge(a.status)}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-radar-muted">
                  <span>Source: <span className="text-radar-cyan font-mono">{a.source}</span></span>
                  <span>Quality: <span className={`font-mono ${
                    a.quality >= 80 ? "text-radar-green" : a.quality >= 50 ? "text-radar-yellow" : "text-radar-red"
                  }`}>{a.quality}%</span></span>
                  <span>{new Date(a.created_at).toLocaleString()}</span>
                </div>
              </div>

              {a.status === "open" && (
                <button
                  className="btn-ack shrink-0"
                  disabled={acking === a.id}
                  onClick={() => handleAck(a.id)}
                >
                  {acking === a.id ? "…" : "ACK"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
