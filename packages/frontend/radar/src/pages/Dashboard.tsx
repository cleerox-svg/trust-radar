import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { dashboard, threats, agents } from "../lib/api";
import { Card, CardContent, ScoreRing } from "../components/ui";
import { StatusDot } from "../components/ui/StatusDot";
import { Pulse } from "../components/ui/Pulse";
import { Link } from "react-router-dom";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs border" style={{ background: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}>
      <div className="text-[--text-tertiary] mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(p.name === "quality" ? 1 : 0) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ["dashboard-stats"], queryFn: dashboard.stats });
  const { data: trend } = useQuery({ queryKey: ["dashboard-trend"], queryFn: dashboard.trend });
  const { data: sources } = useQuery({ queryKey: ["dashboard-sources"], queryFn: dashboard.sources });
  const { data: threatStats } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });
  const { data: agentStats } = useQuery({ queryKey: ["agent-stats"], queryFn: agents.stats });

  const s = stats ?? { total_signals: 0, processed: 0, avg_trust: 0, active_alerts: 0, queue_depth: 0, dead_letters: 0, duplicates: 0, stored: 0 };
  const ts = threatStats?.summary ?? {} as Record<string, number>;
  const as_ = agentStats?.summary ?? {} as Record<string, number>;

  const trustScore = s.avg_trust || 0;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Mission Control</h1>
          <p className="text-sm text-[--text-secondary]">Real-time threat intelligence overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Pulse color="green" size="sm" />
          <span className="text-xs text-[--text-tertiary]">All systems operational</span>
        </div>
      </div>

      {/* Trust Score Hero + Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:row-span-2">
          <CardContent>
            <div className="flex flex-col items-center py-4">
              <ScoreRing score={trustScore} size="lg" label="Trust Score" />
              <div className="mt-3 text-center">
                <div className="text-xs text-[--text-tertiary] mt-1">
                  {trustScore >= 80 ? "Healthy posture" : trustScore >= 50 ? "Moderate risk" : "Elevated risk"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Threat KPIs */}
        {[
          { label: "Total Threats", value: ts.total ?? 0, sub: "All tracked", color: "text-cyan-400", link: "/threat-map" },
          { label: "Critical Threats", value: ts.critical ?? 0, sub: "Immediate action", color: (ts.critical ?? 0) > 0 ? "text-threat-critical" : "text-green-400", link: "/threat-map" },
          { label: "Active Alerts", value: s.active_alerts, sub: "Needs attention", color: s.active_alerts > 0 ? "text-threat-high" : "text-green-400", link: "/alerts" },
        ].map((c) => (
          <Link key={c.label} to={c.link} className="block">
            <Card className="h-full hover:border-[--border-default] transition-colors">
              <CardContent>
                <div className="text-xs text-[--text-tertiary]">{c.label}</div>
                <div className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
                <div className="text-xs text-[--text-secondary] mt-1">{c.sub}</div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Signal KPIs */}
        {[
          { label: "Signals Processed", value: s.processed.toLocaleString(), sub: "Total analysed" },
          { label: "Queue Depth", value: s.queue_depth, sub: "Pending processing", color: s.queue_depth > 10 ? "text-threat-medium" : undefined },
          { label: "Dead Letters", value: s.dead_letters, sub: "Failed", color: s.dead_letters > 0 ? "text-threat-high" : undefined },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
              <div className="text-xs text-[--text-secondary] mt-1">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Status + Threat Severity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[--text-primary]">Agent Status</h3>
              <Link to="/agent-hub" className="text-xs text-cyan-400 hover:text-cyan-300">View Hub</Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Runs", value: as_.total_runs ?? 0 },
                { label: "Running", value: as_.running ?? 0, dot: "active" as const },
                { label: "Awaiting Approval", value: as_.awaiting_approval ?? 0, dot: "alert" as const },
                { label: "Success Rate", value: (as_.total_runs ? Math.round(((as_.successes ?? 0) / as_.total_runs) * 100) : 0) + "%" },
              ].map((a) => (
                <div key={a.label} className="flex items-center gap-2 p-2 rounded bg-[--surface-base] border border-[--border-subtle]">
                  {a.dot && <StatusDot variant={a.dot} />}
                  <div>
                    <div className="text-xs text-[--text-tertiary]">{a.label}</div>
                    <div className="text-sm font-bold text-[--text-primary] tabular-nums">{a.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[--text-primary]">Threat Severity</h3>
              <Link to="/brand-exposure" className="text-xs text-cyan-400 hover:text-cyan-300">Exposure</Link>
            </div>
            <div className="space-y-2">
              {(threatStats?.bySeverity ?? []).map((sv) => {
                const total = (ts.total as number) || 1;
                const pct = Math.round((sv.count / total) * 100);
                const barColor = sv.severity === "critical" ? "bg-threat-critical" : sv.severity === "high" ? "bg-threat-high" : sv.severity === "medium" ? "bg-threat-medium" : "bg-green-500";
                return (
                  <div key={sv.severity} className="flex items-center gap-3">
                    <span className="text-xs text-[--text-secondary] w-16 capitalize">{sv.severity}</span>
                    <div className="flex-1 h-2 bg-[--surface-base] rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-[--text-tertiary] w-10 text-right">{sv.count}</span>
                  </div>
                );
              })}
              {(!threatStats?.bySeverity || threatStats.bySeverity.length === 0) && (
                <div className="text-xs text-[--text-tertiary] py-4 text-center">No threat data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signal Volume + Source Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[--text-primary]">Signal Volume & Quality</h3>
                <div className="text-xs text-[--text-tertiary]">Last 30 days</div>
              </div>
              <Link to="/trends" className="text-xs text-cyan-400 hover:text-cyan-300">Trends</Link>
            </div>
            {!trend || trend.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-[--text-tertiary] text-xs">No trend data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={trend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4d4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00d4d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradQual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="time" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="count" name="signals" stroke="#00d4d4" strokeWidth={2} fill="url(#gradCount)" />
                  <Area type="monotone" dataKey="quality" name="quality" stroke="#00ff88" strokeWidth={2} fill="url(#gradQual)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-1">Source Mix</h3>
            <div className="text-xs text-[--text-tertiary] mb-4">Signal origins</div>
            {!sources || sources.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-[--text-tertiary] text-xs">No source data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={sources} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="count" fill="#00d4d4" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {sources.map((src) => (
                    <div key={src.name} className="flex items-center gap-2 text-xs">
                      <div className="w-16 text-[--text-tertiary] font-mono truncate">{src.name}</div>
                      <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: "var(--surface-base)" }}>
                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${src.percentage}%` }} />
                      </div>
                      <div className="w-8 text-right text-[--text-tertiary] font-mono">{src.percentage}%</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Scan URL", path: "/scan", desc: "Run threat analysis" },
              { label: "View Signals", path: "/signals", desc: "Live signal feed" },
              { label: "TrustBot", path: "/trustbot", desc: "AI assistant" },
              { label: "Investigations", path: "/investigations", desc: "Case management" },
            ].map((a) => (
              <Link key={a.path} to={a.path} className="block">
                <div className="p-3 rounded-lg border border-[--border-subtle] bg-[--surface-base] hover:border-cyan-500/50 transition-colors">
                  <div className="text-sm font-medium text-[--text-primary]">{a.label}</div>
                  <div className="text-xs text-[--text-tertiary] mt-0.5">{a.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
