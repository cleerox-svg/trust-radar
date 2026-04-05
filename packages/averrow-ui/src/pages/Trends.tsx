import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  useIntelligenceBriefings,
  useThreatVolume,
  useBrandMomentum,
  useProviderMomentum,
  useNexusActive,
} from '@/hooks/useTrends';
import type { IntelligenceBriefing, VolumePoint } from '@/hooks/useTrends';
import { Card } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageLoader } from '@/components/ui/PageLoader';
import { AgentAttribution } from '@/components/ui/AgentAttribution';
import { ExecutiveSummary } from '@/components/trends/ExecutiveSummary';
/* ── Constants ── */

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#fbbf24',
  low: '#78A0C8',
  clean: '#4ade80',
};

const WINDOWS = ['7d', '30d', '90d'] as const;

const THREAT_TYPE_COLORS: Record<string, string> = {
  phishing: '#C83C3C',
  malware_distribution: '#9333ea',
  malicious_ip: '#78A0C8',
  c2: '#ef4444',
  typosquatting: '#DCAA32',
  credential_harvesting: '#E8923C',
};

const THREAT_TYPE_LABELS: Record<string, string> = {
  phishing: 'Phishing',
  malware_distribution: 'Malware Distribution',
  malicious_ip: 'Malicious IP',
  c2: 'C2',
  typosquatting: 'Typosquatting',
  credential_harvesting: 'Credential Harvesting',
};

const THREAT_TYPES = Object.keys(THREAT_TYPE_COLORS);

/* ── Tooltip ── */

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg px-3 py-2 text-xs">
      <div className="font-mono text-contrail/60 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{THREAT_TYPE_LABELS[p.name] ?? p.name}</span>
          <span className="font-mono text-parchment">{(p.value ?? 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Section 1: Observer Intelligence Briefings ── */

function BriefingCard({ briefing }: { briefing: IntelligenceBriefing }) {
  const [expanded, setExpanded] = useState(false);
  const sev = briefing.severity?.toLowerCase() ?? 'low';
  const cardClass =
    sev === 'critical' ? 'glass-card-red' :
    sev === 'high' ? 'glass-card-amber' : '';
  const dotColor = SEVERITY_COLORS[sev] ?? '#78A0C8';
  const title = briefing.summary?.slice(0, 100) ?? 'Untitled';
  const hasMore = (briefing.summary?.length ?? 0) > 100;

  return (
    <div className={`glass-card rounded-xl p-4 ${cardClass}`}>
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-parchment leading-snug">
            {expanded ? briefing.summary : title}
            {!expanded && hasMore && '…'}
          </p>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-[11px] font-mono text-afterburner hover:text-afterburner-hover transition-colors"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          <div className="mt-2 font-mono text-[10px] text-contrail/50">
            {new Date(briefing.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function IntelligenceBriefings() {
  const { data: briefings, isLoading } = useIntelligenceBriefings(6);

  return (
    <section>
      <SectionLabel className="mb-4">Observer Intelligence Briefings</SectionLabel>
      <AgentAttribution agent="Observer" />
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !briefings?.length ? (
        <Card hover={false}>
          <p className="text-sm text-white/40">No intelligence briefings available</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {briefings.map((b) => (
            <BriefingCard key={b.id} briefing={b} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Section 2: Threat Volume Chart ── */

function ThreatVolumeChart({ window }: { window: string }) {
  const { data: volume, isLoading } = useThreatVolume(window);

  return (
    <section>
      <SectionLabel className="mb-4">Threat Volume</SectionLabel>
      <Card hover={false}>
        {isLoading ? (
          <Skeleton className="h-[280px] lg:h-[280px] h-[200px] rounded-lg" />
        ) : !volume?.length ? (
          <p className="text-sm text-white/40 py-8 text-center">No volume data</p>
        ) : (
          <ResponsiveContainer width="100%" height={280} className="max-md:!h-[200px]">
            <AreaChart data={volume}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#78A0C8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#78A0C8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              {THREAT_TYPES.map((type) => (
                <Area
                  key={type}
                  type="monotone"
                  dataKey={type}
                  stackId="1"
                  fill={THREAT_TYPE_COLORS[type]}
                  stroke={THREAT_TYPE_COLORS[type]}
                  fillOpacity={0.3}
                  name={type}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </section>
  );
}

/* ── Section 3 Left: Brand Risk Momentum ── */

function BrandRiskMomentum() {
  const { data: brands, isLoading } = useBrandMomentum();

  function changeGlow(pct: number): string {
    if (pct > 100) return 'glow-red';
    if (pct > 50) return 'glow-amber';
    return 'glow-afterburner';
  }

  return (
    <Card hover={false} className="h-full">
      <SectionLabel className="mb-4">Brand Risk Momentum</SectionLabel>
      {isLoading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : !brands?.length ? (
        <p className="text-sm text-white/40">No brand data</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-contrail/50">
                <th className="pb-2">Brand</th>
                <th className="pb-2 text-right">This Week</th>
                <th className="pb-2 text-right">Last Week</th>
                <th className="pb-2 text-right">Change%</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => {
                const thisWeek = b.this_week ?? 0;
                const lastWeek = b.last_week ?? 0;
                const changePct = lastWeek === 0
                  ? (thisWeek > 0 ? 100 : 0)
                  : ((thisWeek - lastWeek) / lastWeek) * 100;
                const displayChange = isFinite(changePct)
                  ? `${changePct > 0 ? '+' : ''}${Math.round(changePct)}%`
                  : 'NEW';
                return (
                  <tr key={b.brand_name} className="data-row border-t border-white/5">
                    <td className="py-2 text-parchment">{b.brand_name}</td>
                    <td className="py-2 text-right font-mono text-parchment/80">{thisWeek.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-contrail/60">{lastWeek.toLocaleString()}</td>
                    <td className={`py-2 text-right font-mono font-semibold ${changeGlow(isFinite(changePct) ? changePct : 0)}`}>
                      {displayChange}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ── Section 3 Right: Provider Momentum + NEXUS Clusters ── */

function ProviderMomentumPanel() {
  const { data: providers, isLoading: provLoading } = useProviderMomentum();
  const { data: clusters, isLoading: nexusLoading } = useNexusActive();

  const maxCount = providers?.length
    ? Math.max(...providers.map((p) => p.count ?? 0), 1)
    : 1;

  function barColor(count: number | undefined | null): string {
    const c = count ?? 0;
    if (c > 500) return '#C83C3C';
    if (c > 100) return '#E8923C';
    return '#E5A832';
  }

  return (
    <div className="space-y-4">
      <Card hover={false}>
        <SectionLabel className="mb-4">Provider Momentum</SectionLabel>
        {provLoading ? (
          <Skeleton className="h-36 rounded-lg" />
        ) : !providers?.length ? (
          <p className="text-sm text-white/40">No provider data</p>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => {
              const count = p.count ?? 0;
              const pct = (count / maxCount) * 100;
              const color = barColor(count);
              return (
                <div key={p.provider} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-parchment/80 truncate font-mono">{p.provider}</div>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="font-mono text-[11px] text-contrail/60 w-12 text-right">
                    {count.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card hover={false}>
        <SectionLabel className="mb-3">NEXUS Active Clusters</SectionLabel>
        <AgentAttribution agent="Nexus" />
        {nexusLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : !clusters?.length ? (
          <p className="text-sm text-white/40">No active clusters</p>
        ) : (
          <div className="space-y-2">
            {clusters.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: SEVERITY_COLORS[c.severity?.toLowerCase() ?? 'low'] ?? '#78A0C8' }}
                  />
                  <span className="text-xs text-parchment truncate">{c.label}</span>
                </div>
                <span className="font-mono text-[10px] text-contrail/50 shrink-0">
                  {(c.threat_count ?? 0).toLocaleString()} threats
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Section 4: Threat Type Totals ── */

function ThreatTypeTotals({ volume }: { volume: VolumePoint[] }) {
  const totals = THREAT_TYPES.map((type) => ({
    name: THREAT_TYPE_LABELS[type],
    key: type,
    total: volume.reduce((sum, v) => sum + ((v[type as keyof VolumePoint] as number) ?? 0), 0),
  })).sort((a, b) => b.total - a.total);

  if (!totals.length || totals.every((t) => t.total === 0)) return null;

  return (
    <section>
      <SectionLabel className="mb-4">Threat Type Totals</SectionLabel>
      <Card hover={false}>
        <ResponsiveContainer width="100%" height={totals.length * 40 + 20}>
          <BarChart data={totals} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
            <XAxis
              type="number"
              tick={{ fill: '#78A0C8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#F0EDE8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              width={115}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0];
                return (
                  <div className="glass-card rounded-lg px-3 py-2 text-xs">
                    <span className="text-parchment font-mono">{((item.value as number) ?? 0).toLocaleString()}</span>
                  </div>
                );
              }}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {totals.map((entry) => (
                <Cell key={entry.key} fill={THREAT_TYPE_COLORS[entry.key]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}

/* ── Main Page ── */

function TrendsContent() {
  const [window, setWindow] = useState<string>('30d');
  const { data: volume, isLoading } = useThreatVolume(window);

  if (isLoading && !volume) return <PageLoader />;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header + Time Filter */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-parchment">Platform Intelligence</h1>
        <div className="flex gap-1.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`glass-btn font-mono text-[11px] font-semibold px-3 py-1 rounded ${
                window === w ? 'glass-btn-active' : ''
              }`}
            >
              {w.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Executive Summary */}
      <ExecutiveSummary period={window} />

      {/* Section 1: Intelligence Briefings */}
      <IntelligenceBriefings />

      {/* Section 2: Threat Volume */}
      <ThreatVolumeChart window={window} />

      {/* Section 3: Brand + Provider Momentum */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <BrandRiskMomentum />
        </div>
        <div className="lg:col-span-2">
          <ProviderMomentumPanel />
        </div>
      </div>

      {/* Section 4: Threat Type Totals */}
      {volume?.length ? <ThreatTypeTotals volume={volume} /> : null}
    </div>
  );
}

export function Trends() {
  return (
    <ErrorBoundary>
      <TrendsContent />
    </ErrorBoundary>
  );
}
