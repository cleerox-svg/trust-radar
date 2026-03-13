import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { dashboard } from "../lib/api";
import { Card, CardContent } from "../components/ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs border" style={{ background: "var(--surface-raised)", borderColor: "var(--border-subtle)" }}>
      <div className="text-[--text-tertiary] mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function TrendsPage() {
  const { data: trend } = useQuery({ queryKey: ["dashboard-trend"], queryFn: dashboard.trend });
  const { data: sources } = useQuery({ queryKey: ["dashboard-sources"], queryFn: dashboard.sources });

  const trendData = trend ?? [];
  const avgQuality = trendData.length ? (trendData.reduce((s, p) => s + p.quality, 0) / trendData.length).toFixed(1) : "—";
  const totalSignals = trendData.reduce((s, p) => s + p.count, 0);
  const peakDay = trendData.reduce((best, p) => p.count > best.count ? p : best, { time: "—", count: 0, quality: 0 });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Trends</h1>
        <p className="text-sm text-[--text-secondary]">Signal volume and quality analytics over time</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Signals", value: totalSignals.toLocaleString(), color: "text-blue-500" },
          { label: "Avg Quality", value: `${avgQuality}%`, color: "text-green-400" },
          { label: "Peak Day", value: peakDay.time, sub: `${peakDay.count} signals` },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent>
              <div className="text-xs text-[--text-tertiary]">{c.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${c.color ?? "text-[--text-primary]"}`}>{c.value}</div>
              {c.sub && <div className="text-xs text-[--text-secondary] mt-1">{c.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Volume chart */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-0.5">Signal Volume</h3>
          <div className="text-xs text-[--text-tertiary] mb-4">Daily signal count</div>
          {trendData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-[--text-tertiary] text-xs">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4d4" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#00d4d4" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="time" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="signals" fill="url(#barGrad)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Quality chart */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-0.5">Quality Trend</h3>
          <div className="text-xs text-[--text-tertiary] mb-4">Average signal quality over time</div>
          {trendData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-[--text-tertiary] text-xs">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="time" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="quality" name="quality" stroke="#00ff88" strokeWidth={2.5}
                  dot={{ fill: "#00ff88", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Source breakdown */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-0.5">Source Distribution</h3>
          <div className="text-xs text-[--text-tertiary] mb-4">Signal origin breakdown</div>
          {!sources || sources.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-[--text-tertiary] text-xs">No source data</div>
          ) : (
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[--text-primary]">{s.name}</span>
                    <span className="text-[--text-tertiary] font-mono">{s.count.toLocaleString()} ({s.percentage}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-base)" }}>
                    <div className="h-full rounded-full" style={{ width: `${s.percentage}%`, background: "linear-gradient(90deg, #00d4d4, #00ff88)", transition: "width 0.6s ease" }} />
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
