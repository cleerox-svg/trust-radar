import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { dashboard, TrendPoint, SourceMixItem } from "../lib/api";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-radar-sidebar border border-radar-border rounded-lg px-3 py-2 text-xs">
      <div className="text-radar-muted mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function TrendsPage() {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [sources, setSources] = useState<SourceMixItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([dashboard.trend(), dashboard.sources()])
      .then(([t, s]) => { setTrend(t); setSources(s); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-radar-muted text-sm animate-pulse">
      Loading trends…
    </div>
  );
  if (error) return (
    <div className="card border-radar-red/30 bg-radar-red/5 text-radar-red text-sm">{error}</div>
  );

  const avgQuality = trend.length
    ? (trend.reduce((s, p) => s + p.quality, 0) / trend.length).toFixed(1)
    : "—";
  const totalSignals = trend.reduce((s, p) => s + p.count, 0);
  const peakDay = trend.reduce((best, p) => p.count > best.count ? p : best, { time: "—", count: 0, quality: 0 });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-semibold text-radar-text">Trends</h1>
        <p className="text-xs text-radar-muted mt-0.5">Signal volume and quality analytics over time</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="text-xs text-radar-muted">Total signals (period)</div>
          <div className="text-2xl font-bold font-mono text-radar-cyan">{totalSignals.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-radar-muted">Avg quality</div>
          <div className="text-2xl font-bold font-mono text-radar-green">{avgQuality}%</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-radar-muted">Peak day</div>
          <div className="text-lg font-bold font-mono text-radar-text">{peakDay.time}</div>
          <div className="text-xs text-radar-muted">{peakDay.count} signals</div>
        </div>
      </div>

      {/* Volume over time */}
      <div className="card">
        <div className="text-sm font-semibold text-radar-text mb-0.5">Signal Volume</div>
        <div className="text-xs text-radar-muted mb-4">Daily signal count</div>
        {trend.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-radar-muted text-xs">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4d4" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#00d4d4" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
              <XAxis dataKey="time" tick={{ fill: "#4a5c7a", fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: "#4a5c7a", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="signals" fill="url(#barGrad)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quality over time */}
      <div className="card">
        <div className="text-sm font-semibold text-radar-text mb-0.5">Quality Trend</div>
        <div className="text-xs text-radar-muted mb-4">Average signal quality over time</div>
        {trend.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-radar-muted text-xs">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff88" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
              <XAxis dataKey="time" tick={{ fill: "#4a5c7a", fontSize: 10 }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#4a5c7a", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="quality" name="quality" stroke="#00ff88" strokeWidth={2.5}
                dot={{ fill: "#00ff88", r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Source breakdown */}
      <div className="card">
        <div className="text-sm font-semibold text-radar-text mb-0.5">Source Distribution</div>
        <div className="text-xs text-radar-muted mb-4">Signal origin breakdown</div>
        {sources.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-radar-muted text-xs">No source data</div>
        ) : (
          <div className="space-y-3">
            {sources.map((s) => (
              <div key={s.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-radar-text">{s.name}</span>
                  <span className="text-radar-muted font-mono">{s.count.toLocaleString()} ({s.percentage}%)</span>
                </div>
                <div className="h-2 bg-radar-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${s.percentage}%`,
                      background: `linear-gradient(90deg, #00d4d4, #00ff88)`,
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
