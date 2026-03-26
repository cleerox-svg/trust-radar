import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useThreatTrends, useThreatBreakdown, useCountryBreakdown, useFeedBreakdown } from '@/hooks/useTrends';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';

const PERIODS = ['7d', '30d', '90d', '1y'] as const;

const THREAT_COLORS: Record<string, string> = {
  phishing: '#C83C3C',
  typosquatting: '#E8923C',
  malware_distribution: '#B03C3C',
  credential_harvesting: '#C85078',
  impersonation: '#7850C8',
};

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

function BreakdownBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-32 text-sm text-parchment/80 truncate">{label}</div>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="font-mono text-xs text-contrail/60 w-12 text-right">{count}</div>
    </div>
  );
}

export function Trends() {
  const [period, setPeriod] = useState<string>('30d');
  const { data: trends, isLoading: trendsLoading } = useThreatTrends({ period });
  const { data: breakdown } = useThreatBreakdown({ period });
  const { data: countries } = useCountryBreakdown({ period });
  const { data: feeds } = useFeedBreakdown({ period });

  const breakdownTotal = breakdown?.reduce((sum, b) => sum + b.count, 0) ?? 0;
  const countryTotal = countries?.reduce((sum, c) => sum + c.count, 0) ?? 0;
  const feedTotal = feeds?.reduce((sum, f) => sum + f.count, 0) ?? 0;

  const breakdownColors = ['#C83C3C', '#E8923C', '#B03C3C', '#C85078', '#7850C8', '#78A0C8', '#28A050'];

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
              <AreaChart data={trends}>
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
                <Area type="monotone" dataKey="phishing" stackId="1" fill={THREAT_COLORS.phishing} stroke={THREAT_COLORS.phishing} fillOpacity={0.6} />
                <Area type="monotone" dataKey="typosquatting" stackId="1" fill={THREAT_COLORS.typosquatting} stroke={THREAT_COLORS.typosquatting} fillOpacity={0.6} />
                <Area type="monotone" dataKey="malware_distribution" stackId="1" fill={THREAT_COLORS.malware_distribution} stroke={THREAT_COLORS.malware_distribution} fillOpacity={0.6} />
                <Area type="monotone" dataKey="credential_harvesting" stackId="1" fill={THREAT_COLORS.credential_harvesting} stroke={THREAT_COLORS.credential_harvesting} fillOpacity={0.6} />
                <Area type="monotone" dataKey="impersonation" stackId="1" fill={THREAT_COLORS.impersonation} stroke={THREAT_COLORS.impersonation} fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="space-y-4">
          <Card hover={false}>
            <SectionLabel className="mb-3">Threat Type Breakdown</SectionLabel>
            {breakdown?.map((b, i) => (
              <BreakdownBar
                key={b.threat_type}
                label={b.threat_type.replace(/_/g, ' ')}
                count={b.count}
                total={breakdownTotal}
                color={breakdownColors[i % breakdownColors.length]}
              />
            ))}
            {(!breakdown || breakdown.length === 0) && (
              <p className="text-sm text-contrail/40">No data</p>
            )}
          </Card>

          <Card hover={false}>
            <SectionLabel className="mb-3">Country Breakdown</SectionLabel>
            {countries?.slice(0, 10).map((c, i) => (
              <BreakdownBar
                key={c.country_code}
                label={c.country_code}
                count={c.count}
                total={countryTotal}
                color={breakdownColors[i % breakdownColors.length]}
              />
            ))}
            {(!countries || countries.length === 0) && (
              <p className="text-sm text-contrail/40">No data</p>
            )}
          </Card>

          <Card hover={false}>
            <SectionLabel className="mb-3">Feed Breakdown</SectionLabel>
            {feeds?.map((f, i) => (
              <BreakdownBar
                key={f.source_feed}
                label={f.source_feed}
                count={f.count}
                total={feedTotal}
                color={breakdownColors[i % breakdownColors.length]}
              />
            ))}
            {(!feeds || feeds.length === 0) && (
              <p className="text-sm text-contrail/40">No data</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
