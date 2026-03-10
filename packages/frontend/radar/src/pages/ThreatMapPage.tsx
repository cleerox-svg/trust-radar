import { useQuery } from "@tanstack/react-query";
import { threats, type ThreatStats } from "../lib/api";
import { Card, CardContent, Badge } from "../components/ui";

const severityColors: Record<string, string> = {
  critical: "#EF4444", high: "#F97316", medium: "#EAB308", low: "#22C55E",
};

export function ThreatMapPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Threat Map</h1>
        <p className="text-sm text-[--text-secondary]">Global threat distribution with severity-coded intelligence</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading threat intelligence...</div>
      ) : stats && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Threats", value: stats.summary.total ?? 0 },
              { label: "Critical", value: stats.summary.critical ?? 0, color: "text-threat-critical" },
              { label: "High", value: stats.summary.high ?? 0, color: "text-threat-high" },
              { label: "Unprocessed", value: stats.summary.unprocessed ?? 0, color: "text-threat-medium" },
              { label: "Last 24h", value: stats.last24h.total ?? 0, color: "text-cyan-400" },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent>
                  <div className="text-xs text-[--text-tertiary]">{c.label}</div>
                  <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Map visualization (country heatmap) */}
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-[--text-primary] mb-4">Threats by Country</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {stats.byCountry.map((c) => (
                  <div
                    key={c.country_code}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[--surface-base] border border-[--border-subtle] hover:border-[--border-default] transition-colors"
                  >
                    <span className="text-sm font-mono font-bold text-[--text-primary]">{c.country_code || "??"}</span>
                    <span className="text-sm tabular-nums text-[--text-secondary]">{c.count}</span>
                  </div>
                ))}
                {stats.byCountry.length === 0 && (
                  <div className="col-span-full text-center text-sm text-[--text-tertiary] py-8">No geographic data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* By Type and Source */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3">By Threat Type</h3>
                <div className="space-y-2">
                  {stats.byType.map((t) => {
                    const pct = stats.summary.total ? Math.round((t.count / stats.summary.total) * 100) : 0;
                    return (
                      <div key={t.type} className="flex items-center gap-3">
                        <span className="text-xs text-[--text-secondary] w-28 truncate">{t.type}</span>
                        <div className="flex-1 h-2 rounded-full bg-[--surface-base] overflow-hidden">
                          <div className="h-full rounded-full bg-cyan-500/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[--text-tertiary] tabular-nums w-12 text-right">{t.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3">By Severity</h3>
                <div className="space-y-2">
                  {stats.bySeverity.map((s) => (
                    <div key={s.severity} className="flex items-center gap-3">
                      <Badge variant={s.severity as "critical" | "high" | "medium" | "low"} className="w-20 justify-center">{s.severity}</Badge>
                      <div className="flex-1 h-2 rounded-full bg-[--surface-base] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${stats.summary.total ? Math.round((s.count / stats.summary.total) * 100) : 0}%`, backgroundColor: severityColors[s.severity] ?? "#888" }}
                        />
                      </div>
                      <span className="text-xs text-[--text-tertiary] tabular-nums w-12 text-right">{s.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Sources */}
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Top Intelligence Sources</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {stats.bySource.map((s) => (
                  <div key={s.source} className="p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                    <div className="text-xs text-[--text-tertiary] truncate">{s.source}</div>
                    <div className="text-lg font-bold text-[--text-primary] tabular-nums">{s.count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
