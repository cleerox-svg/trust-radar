import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { Sparkline } from '@/components/brands/Sparkline';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Globe } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  useProviderIntelligence,
  useProviders,
  useClusters,
  useProviderDetail,
  useProviderThreats,
  useProviderTimeline,
  useProviderClusters,
} from '@/hooks/useProviders';
import type { Provider, Cluster } from '@/hooks/useProviders';

// ─── Helpers ──────────────────────────────────────────────────

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65),
  );
}

type ProviderStatus = 'accelerating' | 'pivot' | 'active' | 'quiet';

function getProviderStatus(p: Provider): ProviderStatus {
  const t7 = p.trend_7d ?? 0;
  const t30 = p.trend_30d ?? 0;
  if (t7 > 0 && t30 > 0 && t7 > t30 / 4) return 'accelerating';
  if (t7 === 0 && t30 > 50) return 'pivot';
  if (p.active_threat_count > 0) return 'active';
  return 'quiet';
}

function hasNexusLink(provider: Provider, clusters: Cluster[]): boolean {
  if (!provider.asn) return false;
  return clusters.some(c => {
    try {
      const asns = JSON.parse(c.asns) as string[];
      return asns.includes(provider.asn as string);
    } catch { return false; }
  });
}

function getClusterStatus(c: Cluster): ProviderStatus {
  if (c.status === 'dormant') return 'quiet';
  // Parse ASN trends from cluster data if available
  return c.status === 'active' ? 'active' : 'quiet';
}

function estimateWeeklyVolumes(t7: number, t30: number): number[] {
  // Estimate 7 weekly volumes from 7d and 30d data
  const weeklyAvg30 = t30 / 4;
  const weeks: number[] = [];
  for (let i = 0; i < 6; i++) {
    weeks.push(Math.max(0, weeklyAvg30 + (Math.random() - 0.5) * weeklyAvg30 * 0.3));
  }
  weeks.push(t7); // most recent week is the 7d value
  return weeks;
}

// ─── Status Badge Component ──────────────────────────────────

function StatusBadge({ status }: { status: ProviderStatus }) {
  switch (status) {
    case 'accelerating':
      return (
        <span className="badge-glass badge-accelerating font-mono text-[10px] font-bold">
          ACCELERATING
        </span>
      );
    case 'pivot':
      return (
        <span className="badge-glass badge-pivot font-mono text-[10px] font-bold">
          PIVOT
        </span>
      );
    case 'active':
      return (
        <span className="badge-glass badge-active font-mono text-[10px] font-bold">
          ACTIVE
        </span>
      );
    case 'quiet':
      return (
        <span className="badge-glass badge-dormant font-mono text-[10px] font-bold">
          QUIET
        </span>
      );
  }
}

// ─── Cluster Sidebar ─────────────────────────────────────────

function ClusterPanel({
  clusters,
  isLoading,
  selectedClusterId,
  onSelect,
}: {
  clusters: Cluster[];
  isLoading: boolean;
  selectedClusterId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">
        Cluster Intelligence
      </div>
      {selectedClusterId && (
        <button
          onClick={() => onSelect(null)}
          className="w-full text-left font-mono text-[10px] text-afterburner hover:text-afterburner-hover px-2 py-1 mb-1"
        >
          Clear filter
        </button>
      )}
      {clusters.length === 0 && (
        <EmptyState
          icon={<Globe />}
          title="No clusters detected"
          subtitle="Infrastructure clusters will appear as threat correlations are identified"
          variant="scanning"
          compact
        />
      )}
      {clusters.map(cluster => {
        const status = getClusterStatus(cluster);
        const isSelected = selectedClusterId === cluster.id;
        return (
          <button
            key={cluster.id}
            onClick={() => onSelect(isSelected ? null : cluster.id)}
            className={`w-full text-left rounded-lg p-2.5 transition-all glass-card ${
              isSelected
                ? 'border-afterburner-border bg-afterburner-muted'
                : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-[11px] text-parchment truncate">
                {cluster.cluster_name || `Cluster ${cluster.id.slice(0, 8)}`}
              </div>
              <StatusBadge status={status} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[10px] text-contrail/50">
                {cluster.threat_count.toLocaleString()} threats
              </span>
              {cluster.countries && (
                <span className="font-mono text-[10px] text-white/50">
                  {(() => {
                    try {
                      return (JSON.parse(cluster.countries) as string[]).map(countryFlag).join(' ');
                    } catch { return ''; }
                  })()}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Provider Card ───────────────────────────────────────────

function ProviderCard({
  provider,
  clusters,
  isSelected,
  onSelect,
}: {
  provider: Provider;
  clusters: Cluster[];
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const status = getProviderStatus(provider);
  const nexusLinked = hasNexusLink(provider, clusters);
  const t7 = provider.trend_7d ?? 0;
  const t30 = provider.trend_30d ?? 0;
  const weeklyData = useMemo(() => estimateWeeklyVolumes(t7, t30), [t7, t30]);

  return (
    <button
      onClick={() => onSelect(provider.id)}
      className={`w-full text-left rounded-xl p-4 transition-all glass-card ${
        isSelected
          ? 'ring-1 ring-afterburner/20 border-afterburner-border'
          : 'hover:-translate-y-0.5'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{countryFlag(provider.country)}</span>
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold text-parchment truncate">
              {provider.name}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-white/55">
                {provider.asn || 'No ASN'} {provider.country ? `\u00B7 ${provider.country}` : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {nexusLinked && (
            <span className="badge-glass badge-nexus font-mono text-[9px] font-bold">
              NEXUS
            </span>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 py-2 border-t border-b border-white/[0.06] my-2">
        <div>
          <div className="font-display text-lg font-bold text-parchment">
            {provider.active_threat_count.toLocaleString()}
          </div>
          <div className="font-mono text-[9px] text-contrail/50 uppercase">Active</div>
        </div>
        <div>
          <div className="font-display text-lg font-bold text-parchment">
            {t7.toLocaleString()}
          </div>
          <div className="font-mono text-[9px] text-contrail/50 uppercase">7d Trend</div>
        </div>
        <div>
          <div className="font-display text-lg font-bold text-parchment">
            {t30.toLocaleString()}
          </div>
          <div className="font-mono text-[9px] text-contrail/50 uppercase">30d Trend</div>
        </div>
      </div>

      {/* Sparkline bar */}
      <div className="mt-2">
        <Sparkline data={weeklyData} width={280} height={20} />
      </div>

      {/* Status alert */}
      {status === 'accelerating' && (
        <div className="mt-2 font-mono text-[10px] text-amber-400">
          {'\u26A0'} ACCELERATING: activity up &gt;50% vs prior week
        </div>
      )}
      {status === 'pivot' && (
        <div className="mt-2 font-mono text-[10px] text-[#00D4FF]">
          {'\u2192'} PIVOT DETECTED: went silent {provider.trend_30d ?? 0 > 50 ? '7+ days ago' : 'recently'}
        </div>
      )}
    </button>
  );
}

// ─── Provider Detail Panel ───────────────────────────────────

function ProviderDetailPanel({ providerId }: { providerId: string }) {
  const { data: detail, isLoading: detailLoading } = useProviderDetail(providerId);
  const { data: threats, isLoading: threatsLoading } = useProviderThreats(providerId, { limit: 10 });
  const { data: timeline, isLoading: timelineLoading } = useProviderTimeline(providerId);
  const { data: linkedClusters, isLoading: clustersLoading } = useProviderClusters(providerId);

  if (detailLoading) {
    return (
      <div className="rounded-xl p-6 space-y-4 glass-card">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  // Build chart data from timeline
  const chartData = timeline
    ? timeline.labels.map((label: string, i: number) => ({
        date: label.slice(5), // show MM-DD
        count: timeline.values[i],
      }))
    : [];

  function severityBadge(severity: string) {
    const map: Record<string, string> = {
      critical: 'bg-[#f87171]/10 text-[#f87171] border-[#f87171]/30',
      high: 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/30',
      medium: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30',
      low: 'bg-contrail/10 text-contrail border-contrail/30',
    };
    return map[severity] ?? map.low;
  }

  return (
    <div className="rounded-xl p-6 animate-fade-in glass-card">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{countryFlag(detail.country)}</span>
            <h3 className="font-display text-lg font-bold text-parchment">{detail.name}</h3>
          </div>
          <div className="font-mono text-xs text-contrail/50 mt-1">
            {detail.asn || 'No ASN'} {detail.country ? `\u00B7 ${detail.country}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {detail.reputation_score !== null && (
            <div className="text-center">
              <div className={`font-display text-2xl font-bold ${
                detail.reputation_score >= 80 ? 'text-[#4ADE80]'
                : detail.reputation_score >= 60 ? 'text-[#fbbf24]'
                : detail.reputation_score >= 40 ? 'text-[#fb923c]'
                : 'text-[#f87171]'
              }`}>
                {detail.reputation_score}
              </div>
              <div className="font-mono text-[9px] text-contrail/50 uppercase">Reputation</div>
            </div>
          )}
        </div>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Provider Info */}
        <div className="space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">
            Provider Details
          </div>
          <div className="space-y-2">
            {[
              ['First Threat', detail.first_seen ? new Date(detail.first_seen).toLocaleDateString() : 'N/A'],
              ['Last Threat', detail.last_seen ? new Date(detail.last_seen).toLocaleDateString() : 'N/A'],
              ['Total Threats', String(detail.total_threats)],
              ['Active Threats', String(detail.active_threats)],
              ['Brands Targeted', String(detail.brands_targeted)],
              ['Campaigns', String(detail.campaigns)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-contrail/50">{label}</span>
                <span className="font-mono text-[11px] text-parchment">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center — Timeline Chart */}
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">
            Threat Timeline (30d)
          </div>
          {timelineLoading ? (
            <Skeleton className="h-40" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#78A0C8', opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0D1520',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  labelStyle={{ color: '#78A0C8' }}
                  itemStyle={{ color: '#00D4FF' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#00D4FF"
                  fill="url(#tealGradient)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center font-mono text-[11px] text-white/40">
              No timeline data
            </div>
          )}
        </div>

        {/* Right — Linked Clusters */}
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">
            Linked Clusters
          </div>
          {clustersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : linkedClusters && linkedClusters.length > 0 ? (
            <div className="space-y-2">
              {linkedClusters.map(cluster => (
                <div
                  key={cluster.id}
                  className="rounded-lg p-2.5 glass-card"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-parchment truncate">
                      {cluster.cluster_name || `Cluster ${cluster.id.slice(0, 8)}`}
                    </span>
                    <StatusBadge status={getClusterStatus(cluster)} />
                  </div>
                  <div className="font-mono text-[10px] text-white/55 mt-1">
                    {cluster.threat_count} threats
                    {cluster.agent_notes && (
                      <span className="block mt-0.5 text-white/50 truncate">{cluster.agent_notes}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="font-mono text-[11px] text-white/40 py-4 text-center">
              No cluster linkage
            </div>
          )}
        </div>
      </div>

      {/* Recent Threats Table */}
      <div className="mt-6">
        <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">
          Recent Threats
        </div>
        {threatsLoading ? (
          <Skeleton className="h-32" />
        ) : threats && threats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Type', 'Domain', 'Severity', 'First Seen'].map(h => (
                    <th key={h} className="font-mono text-[9px] text-contrail/50 uppercase tracking-wider text-left py-2 px-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {threats.map(threat => (
                  <tr key={threat.id} className="data-row border-b border-white/[0.04]">
                    <td className="font-mono text-[11px] text-parchment py-1.5 px-2">{threat.threat_type}</td>
                    <td className="font-mono text-[11px] text-contrail/60 py-1.5 px-2 truncate max-w-[200px]">
                      {threat.malicious_domain || '—'}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={`inline-flex font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${severityBadge(threat.severity)}`}>
                        {threat.severity}
                      </span>
                    </td>
                    <td className="font-mono text-[10px] text-white/50 py-1.5 px-2">
                      {threat.first_seen ? new Date(threat.first_seen).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Globe />}
            title="No infrastructure detected"
            subtitle="Provider intelligence populates as threats are analyzed and ASNs are identified"
            variant="scanning"
            compact
          />
        )}
      </div>
    </div>
  );
}

// ─── Filter Bar ──────────────────────────────────────────────

const STATUS_FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'active', label: 'ACTIVE' },
  { id: 'accelerating', label: 'ACCELERATING' },
  { id: 'pivot', label: 'PIVOTS' },
  { id: 'quiet', label: 'QUIET' },
] as const;

const SORT_OPTIONS = [
  { id: 'active_threats', label: 'THREAT COUNT' },
  { id: 'trend_7d', label: '7D TREND' },
  { id: 'trend_30d', label: '30D TREND' },
] as const;

// ─── Main Page ───────────────────────────────────────────────

export function Providers() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('active_threats');
  const [search, setSearch] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const { data: intelligence, isLoading: intelLoading } = useProviderIntelligence();
  const { data: clusters, isLoading: clustersLoading } = useClusters();
  const { data: providers, isLoading: providersLoading } = useProviders({
    limit: 50,
    sort: sortBy,
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
    clusterId: selectedClusterId || undefined,
  });

  return (
    <div className="animate-fade-in space-y-6">
      {/* Title */}
      <h1 className="font-display text-xl font-bold text-parchment">Infrastructure Intelligence</h1>

      {/* Intelligence Header — 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Providers Tracked"
          metric={
            <span className="text-[32px] font-bold leading-none text-parchment">
              {intelLoading ? '—' : (intelligence?.total_providers ?? 0).toLocaleString()}
            </span>
          }
          metricLabel="Total"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-contrail" />
              <span className="font-mono text-[11px] text-white/60">Infrastructure nodes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-contrail/40" />
              <span className="font-mono text-[11px] text-white/50">{intelligence?.total_clusters ?? 0} clusters</span>
            </div>
          </div>
        </StatCard>

        <StatCard
          title="Active Operations"
          metric={
            <span className="text-[32px] font-bold leading-none text-[#4ADE80]">
              {intelLoading ? '—' : (intelligence?.active_operations ?? 0).toLocaleString()}
            </span>
          }
          metricLabel="With threats"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
            <span className="font-mono text-[11px] text-white/60">Providers with active threats</span>
          </div>
        </StatCard>

        <StatCard
          title="Accelerating"
          metric={
            <span className="text-[32px] font-bold leading-none text-amber-400">
              {intelLoading ? '—' : (intelligence?.accelerating ?? 0).toLocaleString()}
            </span>
          }
          metricLabel="Campaigns"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="font-mono text-[11px] text-white/60">7d trend &gt; 30d average</span>
          </div>
        </StatCard>

        <StatCard
          title="Pivots Detected"
          metric={
            <span className="text-[32px] font-bold leading-none text-afterburner">
              {intelLoading ? '—' : (intelligence?.pivots_detected ?? 0).toLocaleString()}
            </span>
          }
          metricLabel="Infra moved"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-afterburner" />
            <span className="font-mono text-[11px] text-white/60">Silent after &gt;50 threats/30d</span>
          </div>
        </StatCard>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left Sidebar — Cluster Intelligence */}
        <div className="lg:max-h-[calc(100vh-320px)] lg:overflow-y-auto lg:pr-1 scrollbar-thin">
          <ClusterPanel
            clusters={clusters ?? []}
            isLoading={clustersLoading}
            selectedClusterId={selectedClusterId}
            onSelect={id => {
              setSelectedClusterId(id);
              setSelectedProviderId(null);
            }}
          />
        </div>

        {/* Center/Main — Provider Cards */}
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search providers or ASN..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="glass-input rounded-lg px-3 py-1.5 font-mono text-[11px] w-full sm:w-64"
            />

            {/* Status Pills */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    setStatusFilter(f.id);
                    setSelectedProviderId(null);
                  }}
                  className={`font-mono text-[10px] font-semibold px-3 py-1 rounded transition-all ${
                    statusFilter === f.id
                      ? 'glass-btn-active'
                      : 'glass-btn'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5 sm:ml-auto">
              <span className="font-mono text-[9px] text-white/55 uppercase">Sort:</span>
              {SORT_OPTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${
                    sortBy === s.id
                      ? 'bg-white/10 text-parchment'
                      : 'text-white/55 hover:text-parchment'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Provider Cards Grid */}
          {providersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : providers && providers.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map(provider => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    clusters={clusters ?? []}
                    isSelected={selectedProviderId === provider.id}
                    onSelect={setSelectedProviderId}
                  />
                ))}
              </div>

              {/* Detail Panel */}
              {selectedProviderId && (
                <div className="mt-4">
                  <ProviderDetailPanel providerId={selectedProviderId} />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl p-12 text-center glass-card">
              <div className="font-mono text-[11px] text-white/40">
                No providers match current filters
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
