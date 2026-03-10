import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { breaches, type BreachCheck } from "../lib/api";
import { Card, CardContent, Badge } from "../components/ui";

export function DarkWebPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["breaches", search],
    queryFn: () => breaches.list(search || undefined),
  });

  const stats = data?.stats ?? {} as Record<string, number>;
  const list = data?.breaches ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Dark Web Monitor</h1>
        <p className="text-sm text-[--text-secondary]">Breach and credential exposure monitoring across dark web sources</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Breaches", value: stats.total ?? 0 },
          { label: "Unique Targets", value: stats.unique_targets ?? 0, color: "text-cyan-400" },
          { label: "Critical", value: stats.critical ?? 0, color: "text-threat-critical" },
          { label: "High", value: stats.high ?? 0, color: "text-threat-high" },
          { label: "Unresolved", value: stats.unresolved ?? 0, color: "text-threat-medium" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search by target or breach name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md text-sm px-3 py-2 rounded-lg bg-[--surface-base] border border-[--border-subtle] text-[--text-primary] placeholder:text-[--text-tertiary] focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* Breach list */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Breach Records ({list.length})</h3>
          {isLoading ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading...</div>
          ) : list.length === 0 ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">No breach records found</div>
          ) : (
            <div className="space-y-3">
              {list.map((b) => (
                <div key={b.id} className="flex items-center gap-4 p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[--text-primary] truncate">{b.breach_name}</span>
                      <Badge variant={b.severity as "critical" | "high" | "medium" | "low"}>{b.severity}</Badge>
                      {b.resolved ? <Badge variant="low">Resolved</Badge> : <Badge variant="medium">Open</Badge>}
                    </div>
                    <div className="text-xs text-[--text-tertiary]">
                      Target: <span className="text-[--text-secondary] font-mono">{b.target}</span>
                      {" · "}{b.check_type} · Source: {b.source}
                      {b.breach_date && <span className="ml-2">Breached: {new Date(b.breach_date).toLocaleDateString()}</span>}
                    </div>
                    {b.data_types && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {b.data_types.split(",").map((dt) => (
                          <span key={dt} className="text-[10px] px-1.5 py-0.5 rounded bg-[--surface-raised] text-[--text-tertiary]">{dt.trim()}</span>
                        ))}
                      </div>
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
