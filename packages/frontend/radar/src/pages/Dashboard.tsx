import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { dashboard, DashboardStats, TrendPoint, SourceMixItem } from "../lib/api";

const EMPTY_STATS: DashboardStats = {
  total_signals: 0, processed: 0, avg_trust: 0, active_alerts: 0,
  queue_depth: 0, dead_letters: 0, duplicates: 0, stored: 0,
};

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="stat-card">
      <div className="text-xs text-radar-muted">{label}</div>
      <div className={`text-2xl font-bold font-mono ${accent ?? "text-radar-text"}`}>{value}</div>
      {sub && <div className="text-[11px] text-radar-muted">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-radar-sidebar border border-radar-border rounded-lg px-3 py-2 text-xs">
      <div className="text-radar-muted mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(p.name === "quality" ? 1 : 0) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [sources, setSources] = useState<SourceMixItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([dashboard.stats(), dashboard.trend(), dashboard.sources()])
      .then(([s, t, src]) => { setStats(s); setTrend(t); setSources(src); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-radar-muted text-sm animate-pulse">Loading dashboard…</div>
    </div>
  );

  if (error) return (
    <div className="card border-radar-red/30 bg-radar-red/5 text-radar-red text-sm">
      {error}
    </div>
  );

  const trustColor = stats.avg_trust >= 80 ? "text-radar-green" : stats.avg_trust >= 50 ? "text-radar-yellow" : "text-radar-red";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold text-radar-text">Dashboard</h1>
        <p className="text-xs text-radar-muted mt-0.5">Real-time signal intelligence overview</p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Signals" value={stats.total_signals.toLocaleString()} sub="all time" accent="text-radar-cyan" />
        <StatCard label="Processed" value={stats.processed.toLocaleString()} sub="analysed" />
        <StatCard label="Avg Trust Score" value={`${stats.avg_trust}%`} sub="last 30 days" accent={trustColor} />
        <StatCard label="Active Alerts" value={stats.active_alerts} sub="needs attention" accent={stats.active_alerts > 0 ? "text-radar-red" : "text-radar-green"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Queue Depth" value={stats.queue_depth} sub="pending" />
        <StatCard label="Dead Letters" value={stats.dead_letters} sub="failed" accent={stats.dead_letters > 0 ? "text-radar-yellow" : undefined} />
        <StatCard label="Duplicates" value={stats.duplicates} sub="deduped" />
        <StatCard label="Stored" value={stats.stored.toLocaleString()} sub="in DB" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Signal trend */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-radar-text">Signal Volume &amp; Quality</div>
              <div className="text-xs text-radar-muted">Last 30 days</div>
            </div>
          </div>
          {trend.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-radar-muted text-xs">No trend data</div>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                <XAxis dataKey="time" tick={{ fill: "#4a5c7a", fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: "#4a5c7a", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="signals" stroke="#00d4d4" strokeWidth={2} fill="url(#gradCount)" />
                <Area type="monotone" dataKey="quality" name="quality" stroke="#00ff88" strokeWidth={2} fill="url(#gradQual)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Source mix */}
        <div className="card">
          <div className="text-sm font-semibold text-radar-text mb-1">Source Mix</div>
          <div className="text-xs text-radar-muted mb-4">Signal origins</div>
          {sources.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-radar-muted text-xs">No source data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={sources} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
                  <XAxis dataKey="name" tick={{ fill: "#4a5c7a", fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: "#4a5c7a", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="count" fill="#00d4d4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {sources.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <div className="w-16 text-radar-muted font-mono truncate">{s.name}</div>
                    <div className="flex-1 bg-radar-border rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-radar-cyan rounded-full" style={{ width: `${s.percentage}%` }} />
                    </div>
                    <div className="w-8 text-right text-radar-muted font-mono">{s.percentage}%</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
