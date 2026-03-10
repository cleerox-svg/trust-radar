import { useQuery } from "@tanstack/react-query";
import { threats, trustScores } from "../lib/api";
import { Card, CardContent, Badge, ScoreRing } from "../components/ui";

export function BrandExposurePage() {
  const { data: stats } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });
  const { data: scores } = useQuery({ queryKey: ["trust-scores"], queryFn: () => trustScores.list() });

  const s = stats?.summary ?? {} as Record<string, number>;
  const total = s.total ?? 0;
  const critical = s.critical ?? 0;
  const high = s.high ?? 0;
  const resolved = s.resolved ?? 0;

  // Calculate exposure score
  const exposureScore = Math.max(0, Math.min(100, 100 - (critical * 5) - (high * 2) + (resolved * 1)));

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Brand Exposure Engine</h1>
        <p className="text-sm text-[--text-secondary]">Attack surface overview and brand risk scoring</p>
      </div>

      {/* Hero score */}
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-8 py-4">
            <ScoreRing score={exposureScore} size="xl" />
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-lg font-display font-bold text-[--text-primary] mb-2">
                Brand Trust Score: {exposureScore}/100
              </h2>
              <p className="text-sm text-[--text-secondary] mb-4">
                {exposureScore >= 80 ? "Your brand exposure is well-managed. Keep monitoring for changes." :
                 exposureScore >= 50 ? "Moderate risk detected. Review high-severity threats." :
                 "Elevated risk. Critical threats require immediate attention."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Badge variant={critical > 0 ? "critical" : "low"}>{critical} Critical</Badge>
                <Badge variant={high > 0 ? "high" : "low"}>{high} High</Badge>
                <Badge variant="info">{total} Total Threats</Badge>
                <Badge variant="low">{resolved} Resolved</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attack Surface Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Threat Types", value: s.types ?? 0, desc: "Unique categories" },
          { label: "Intel Sources", value: s.sources ?? 0, desc: "Active feeds" },
          { label: "Unprocessed", value: s.unprocessed ?? 0, desc: "Awaiting triage" },
          { label: "Countries", value: stats?.byCountry?.length ?? 0, desc: "Geographic spread" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className="text-2xl font-bold text-[--text-primary] tabular-nums">{c.value}</div>
              <div className="text-xs text-[--text-secondary] mt-1">{c.desc}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trust Score History */}
      {scores && scores.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Trust Score History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-subtle] text-left text-xs text-[--text-tertiary]">
                    <th className="pb-2 pr-4">Domain</th>
                    <th className="pb-2 pr-4">Score</th>
                    <th className="pb-2 pr-4">Delta</th>
                    <th className="pb-2 pr-4">Risk</th>
                    <th className="pb-2">Measured</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.slice(0, 20).map((s) => (
                    <tr key={s.id} className="border-b border-[--border-subtle] last:border-0">
                      <td className="py-2 pr-4 font-medium text-[--text-primary]">{s.domain ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums text-[--text-primary]">{s.score}</td>
                      <td className="py-2 pr-4 tabular-nums">
                        <span className={s.delta > 0 ? "text-green-400" : s.delta < 0 ? "text-red-400" : "text-[--text-tertiary]"}>
                          {s.delta > 0 ? "+" : ""}{s.delta}
                        </span>
                      </td>
                      <td className="py-2 pr-4"><Badge variant={s.risk_level as "critical" | "high" | "medium" | "low"}>{s.risk_level}</Badge></td>
                      <td className="py-2 text-[--text-tertiary]">{new Date(s.measured_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Threat Distribution by Source */}
      {stats && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Threat Sources</h3>
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
      )}
    </div>
  );
}
