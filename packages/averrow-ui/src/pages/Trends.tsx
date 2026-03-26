import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useThreatTrends, useThreatBreakdown, useCountryBreakdown, useFeedBreakdown } from '@/hooks/useTrends';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageLoader } from '@/components/ui/PageLoader';

const PERIODS = ['7d', '30d', '90d', '1y'] as const;

const SERIES_COLORS = ['#C83C3C', '#E8923C', '#B03C3C', '#C85078', '#7850C8', '#78A0C8', '#28A050'];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-cockpit/95 border border-white/10 rounded-lg px-3 py-2 text-xs">
      <div className="font-mono text-contrail/60 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-parchment">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function SeriesBreakdown({ title, data }: { title: string; data: { labels: string[]; series: Array<{ name: string; values: number[] }> } | undefined }) {
  if (!data || !data.series || data.series.length === 0) {
    return (
      <Card hover={false}>
        <SectionLabel className="mb-3">{title}</SectionLabel>
        <p className="text-sm text-contrail/40">No data</p>
      </Card>
    );
  }

  // Sum up total values per series for the breakdown bars
  const totals = data.series.map(s => ({
    name: s.name,
    total: s.values.reduce((sum, v) => sum + v, 0),
  })).sort((a, b) => b.total - a.total);

  const maxTotal = totals[0]?.total || 1;

  return (
    <Card hover={false}>
      <SectionLabel className="mb-3">{title}</SectionLabel>
      {totals.map((item, i) => {
        const pct = (item.total / maxTotal) * 100;
        return (
          <div key={item.name} className="flex items-center gap-3 py-1.5">
            <div className="w-32 text-sm text-parchment/80 truncate">{item.name.replace(/_/g, ' ')}</div>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            </div>
            <div className="font-mono text-xs text-contrail/60 w-12 text-right">{item.total}</div>
          </div>
        );
      })}
    </Card>
  );
}

export function Trends() {
  const [period, setPeriod] = useState<string>('30d');
  const { data: trends, isLoading: trendsLoading } = useThreatTrends({ period });
  const { data: breakdown } = useThreatBreakdown({ period });
  const { data: providers } = useCountryBreakdown({ period });
  const { data: tlds } = useFeedBreakdown({ period });

  // Transform { labels, values, high_sev, active } into Recharts-compatible data
  const chartData = useMemo(() => {
    if (!trends || !trends.labels) return [];
    return trends.labels.map((label, i) => ({
      date: label,
      total: trends.values[i] ?? 0,
      high_sev: trends.high_sev[i] ?? 0,
      active: trends.active[i] ?? 0,
    }));
  }, [trends]);

  if (trendsLoading) return <PageLoader />;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-parchment">Threat Trends</h1>
        <div className="flex gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`font-mono text-[11px] font-semibold px-3 py-1 rounded transition-all ${
                period === p
                  ? 'bg-accent/10 text-accent border border-accent/25'
                  : 'text-contrail/40 hover:bg-white/5 hover:text-parchment border border-transparent'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card hover={false}>
          <SectionLabel className="mb-4">Threat Volume</SectionLabel>
          {trendsLoading ? (
            <Skeleton className="h-72 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={288}>
              <AreaChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#78A0C8', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#78A0C8', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total" stackId="1" fill="#C83C3C" stroke="#C83C3C" fillOpacity={0.3} name="Total" />
                <Area type="monotone" dataKey="high_sev" stackId="2" fill="#E8923C" stroke="#E8923C" fillOpacity={0.3} name="High Severity" />
                <Area type="monotone" dataKey="active" stackId="3" fill="#28A050" stroke="#28A050" fillOpacity={0.3} name="Active" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="space-y-4">
          <SeriesBreakdown title="Threat Type Breakdown" data={breakdown} />
          <SeriesBreakdown title="Provider Breakdown" data={providers} />
          <SeriesBreakdown title="TLD Breakdown" data={tlds} />
        </div>
      </div>
    </div>
  );
}
