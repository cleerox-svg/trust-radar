import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '@/components/brands/StatCard';
import { Sparkline } from '@/components/brands/Sparkline';
import { Skeleton } from '@/components/ui/Skeleton';
import { CardGridLoader } from '@/components/ui/PageLoader';
import { useCampaigns, useCampaignStats } from '@/hooks/useCampaigns';
import {
  useOperations,
  useOperationsStats,
  useOperationTimeline,
  useOperationThreats,
} from '@/hooks/useOperations';
import type { Operation } from '@/hooks/useOperations';
import { useGeopoliticalCampaigns } from '@/hooks/useGeopoliticalCampaign';
import type { GeopoliticalCampaign } from '@/hooks/useGeopoliticalCampaign';
import { Activity, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

// ─── Helpers ──────────────────────────────────────────────────

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65),
  );
}

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val) as string[]; }
  catch { return []; }
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function estimateWeeklyVolumes(threatCount: number): number[] {
  const base = threatCount / 7;
  return Array.from({ length: 7 }, (_, i) =>
    Math.max(0, base + (Math.sin(i * 1.2) * base * 0.3))
  );
}

// ─── Status Badge ─────────────────────────────────────────────

type OpStatus = 'accelerating' | 'pivot' | 'active' | 'dormant';

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase() as OpStatus;
  switch (s) {
    case 'accelerating':
      return (
        <span className="badge-glass badge-accelerating font-mono text-[10px] font-bold">
          ACCELERATING
        </span>
      );
    case 'pivot':
      return (
        <span className="badge-glass badge-pivot font-mono text-[10px] font-bold">
          {'\u2192'} PIVOT
        </span>
      );
    case 'active':
      return (
        <span className="badge-glass badge-active font-mono text-[10px] font-bold">
          ACTIVE
        </span>
      );
    default:
      return (
        <span className="badge-glass badge-dormant font-mono text-[10px] font-bold">
          DORMANT
        </span>
      );
  }
}

// ─── Attack Type Badge ────────────────────────────────────────

function AttackTypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const t = type.toLowerCase();
  let cls = 'border-white/10 bg-white/5 text-white/40';
  if (t.includes('phishing')) cls = 'border-[#C83C3C]/30 bg-[#C83C3C]/10 text-[#C83C3C]';
  else if (t.includes('malware')) cls = 'border-[#FB923C]/30 bg-[#FB923C]/10 text-[#FB923C]';
  else if (t === 'c2') cls = 'border-[#A78BFA]/30 bg-[#A78BFA]/10 text-[#A78BFA]';
  else if (t.includes('credential')) cls = 'border-[#F97316]/30 bg-[#F97316]/10 text-[#F97316]';

  return (
    <span className={`inline-flex font-mono text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${cls}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Operation Card (Tier 1) ──────────────────────────────────

function OperationCard({
  operation,
  isSelected,
  onSelect,
}: {
  operation: Operation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const asns = parseJsonArray(operation.asns);
  const countries = parseJsonArray(operation.countries);
  const weeklyData = useMemo(() => estimateWeeklyVolumes(operation.threat_count), [operation.threat_count]);
  const primaryAsn = asns[0] ?? '';
  const primaryCountry = countries[0] ?? '';

  return (
    <button
      onClick={() => onSelect(operation.id)}
      className={`w-full text-left rounded-xl p-4 transition-all glass-card glass-card-purple ${
        isSelected
          ? 'ring-1 ring-afterburner/20 border-afterburner-border'
          : 'hover:-translate-y-0.5'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusBadge status={operation.status} />
          {primaryAsn && (
            <span className="font-mono text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-contrail/20 bg-contrail/5 text-contrail/60">
              {primaryAsn}
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="font-display text-sm font-semibold text-parchment truncate mb-0.5">
        {operation.cluster_name || `Cluster ${operation.id.slice(0, 8)}`}
      </div>
      <div className="font-mono text-[10px] text-white/50 mb-3">
        {primaryAsn} {primaryCountry ? `\u00B7 ${countryFlag(primaryCountry)} ${primaryCountry}` : ''}
        {operation.first_detected ? ` \u00B7 Since ${formatDate(operation.first_detected)}` : ''}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 py-2 border-t border-b border-white/[0.06] my-2">
        <div>
          <div className="font-display text-lg font-bold text-parchment">
            {operation.threat_count.toLocaleString()}
          </div>
          <div className="font-mono text-[9px] text-contrail/50 uppercase">Threats</div>
        </div>
        <div>
          <div className="font-display text-lg font-bold text-parchment">
            {operation.confidence_score != null ? `${operation.confidence_score}%` : '—'}
          </div>
          <div className="font-mono text-[9px] text-contrail/50 uppercase">Confidence</div>
        </div>
        <div>
          <div className="font-display text-lg font-bold text-parchment">
            {countries.length}
          </div>
          <div className="font-mono text-[9px] text-contrail/50 uppercase">Countries</div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="mt-2">
        <Sparkline data={weeklyData} width={280} height={20} />
      </div>

      {/* Status alert */}
      {operation.status === 'accelerating' && (
        <div className="mt-2 font-mono text-[10px] text-amber-400 glow-amber">
          {'\u26A0'} ACCELERATING: activity increasing across infrastructure
        </div>
      )}
      {operation.status === 'pivot' && (
        <div className="mt-2 font-mono text-[10px] text-afterburner glow-afterburner">
          {'\u2192'} PIVOT DETECTED: infrastructure migration observed
        </div>
      )}
      {operation.agent_notes && (
        <div className="mt-1 font-mono text-[10px] text-white/50 truncate">
          {operation.agent_notes}
        </div>
      )}
    </button>
  );
}

// ─── Operation Detail Panel ───────────────────────────────────

function OperationDetailPanel({ operationId, operation }: { operationId: string; operation: Operation }) {
  const { data: timeline, isLoading: timelineLoading } = useOperationTimeline(operationId);
  const { data: threats, isLoading: threatsLoading } = useOperationThreats(operationId, { limit: 10 });

  const asns = parseJsonArray(operation.asns);
  const countries = parseJsonArray(operation.countries);

  const chartData = timeline
    ? timeline.labels.map((label: string, i: number) => ({
        date: label.slice(5),
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
    <div className="rounded-xl p-6 animate-fade-in glass-card glass-card-purple">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            {countries[0] && <span className="text-xl">{countryFlag(countries[0])}</span>}
            <h3 className="font-display text-lg font-bold text-parchment">
              {operation.cluster_name || `Cluster ${operation.id.slice(0, 8)}`}
            </h3>
          </div>
          <div className="font-mono text-xs text-contrail/50 mt-1">
            {asns.join(', ')} {countries.length > 0 ? `\u00B7 ${countries.map(countryFlag).join(' ')}` : ''}
          </div>
        </div>
        <StatusBadge status={operation.status} />
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Cluster Info */}
        <div className="space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">
            Operation Details
          </div>
          <div className="space-y-2">
            {[
              ['First Detected', formatDate(operation.first_detected)],
              ['Last Seen', formatDate(operation.last_seen)],
              ['Total Threats', String(operation.threat_count)],
              ['Confidence', operation.confidence_score != null ? `${operation.confidence_score}%` : 'N/A'],
              ['ASNs', asns.join(', ') || 'N/A'],
              ['Countries', countries.join(', ') || 'N/A'],
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
                  <linearGradient id="opsTealGradient" x1="0" y1="0" x2="0" y2="1">
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
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                  labelStyle={{ color: '#78A0C8' }}
                  itemStyle={{ color: '#00D4FF' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#00D4FF"
                  fill="url(#opsTealGradient)"
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

        {/* Right — Agent Notes */}
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3">
            NEXUS Intelligence
          </div>
          {operation.agent_notes ? (
            <div className="rounded-lg p-3 glass-card">
              <div className="font-mono text-[11px] text-parchment/80 leading-relaxed">
                {operation.agent_notes}
              </div>
            </div>
          ) : (
            <div className="font-mono text-[11px] text-white/40 py-4 text-center">
              No intelligence notes
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
                {threats.map((threat, i) => (
                  <tr key={String(threat.id ?? i)} className="data-row border-b border-white/[0.04]">
                    <td className="font-mono text-[11px] text-parchment py-1.5 px-2">{String(threat.threat_type ?? '—')}</td>
                    <td className="font-mono text-[11px] text-contrail/60 py-1.5 px-2 truncate max-w-[200px]">
                      {String(threat.malicious_domain ?? '—')}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={`inline-flex font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${severityBadge(String(threat.severity ?? 'low'))}`}>
                        {String(threat.severity ?? '—')}
                      </span>
                    </td>
                    <td className="font-mono text-[10px] text-white/50 py-1.5 px-2">
                      {threat.first_seen ? new Date(String(threat.first_seen)).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Activity />}
            title="No threats linked"
            subtitle="Threats will appear as they are correlated to this operation"
            variant="clean"
            compact
          />
        )}
      </div>
    </div>
  );
}

// ─── Campaign Card (Tier 2) ──────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  first_seen: string;
  last_seen: string;
  threat_count: number;
  brand_count: number;
  provider_count: number;
  attack_pattern: string | null;
  status: string;
}

function CampaignCard({
  campaign,
  onClick,
}: {
  campaign: Campaign;
  onClick: () => void;
}) {
  let attackType: string | null = null;
  if (campaign.attack_pattern) {
    try {
      const parsed = JSON.parse(campaign.attack_pattern);
      attackType = parsed.type ?? parsed.attack_type ?? campaign.attack_pattern;
    } catch {
      attackType = campaign.attack_pattern;
    }
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 hover:-translate-y-0.5 transition-all glass-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <AttackTypeBadge type={attackType} />
      </div>

      {/* Name */}
      <div className="font-display text-sm font-semibold text-parchment truncate mb-0.5">
        {campaign.name}
      </div>
      <div className="font-mono text-[10px] text-white/50 mb-3">
        First seen {formatDate(campaign.first_seen)} {'\u00B7'} Last seen {formatDate(campaign.last_seen)}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 py-2 border-t border-white/[0.06]">
        <div>
          <div className="font-display text-base font-bold text-parchment">
            {campaign.threat_count}
          </div>
          <div className="font-mono text-[9px] text-contrail/50 uppercase">Threats</div>
        </div>
        <div>
          <div className="font-display text-base font-bold text-parchment">
            {campaign.brand_count}
          </div>
          <div className="font-mono text-[9px] text-contrail/50 uppercase">Brands</div>
        </div>
        <div>
          <div className="font-display text-base font-bold text-parchment">
            {campaign.provider_count}
          </div>
          <div className="font-mono text-[9px] text-contrail/50 uppercase">Providers</div>
        </div>
      </div>
    </button>
  );
}

// ─── Geopolitical Campaign Card ──────────────────────────────

function GeoCampaignCard({
  campaign,
  onClick,
}: {
  campaign: GeopoliticalCampaign;
  onClick: () => void;
}) {
  const adversaryCountries = parseJsonArray(campaign.adversary_countries);
  const targetCountries = parseJsonArray(campaign.target_countries);
  const threatActors = parseJsonArray(campaign.threat_actors);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 hover:-translate-y-0.5 transition-all glass-card border-signal-red/20"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${
          campaign.status === 'active'
            ? 'bg-signal-red/20 text-red-400 border-signal-red/30 animate-pulse'
            : campaign.status === 'dormant'
              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
              : 'bg-white/5 text-gauge-gray border-white/10'
        }`}>
          {campaign.status}
        </span>
        <span className="font-mono text-[9px] text-gauge-gray uppercase tracking-widest">
          Geopolitical
        </span>
      </div>

      {/* Name */}
      <div className="font-display text-sm font-semibold text-parchment truncate mb-1">
        {campaign.name}
      </div>
      {campaign.description && (
        <div className="font-mono text-[10px] text-white/55 mb-3 line-clamp-2">
          {campaign.description}
        </div>
      )}

      {/* Country flags */}
      <div className="flex items-center gap-4 py-2 border-t border-white/[0.06]">
        <div>
          <div className="font-mono text-[8px] text-white/55 uppercase mb-0.5">Adversary</div>
          <div className="flex gap-1">
            {adversaryCountries.map(c => (
              <span key={c} className="text-sm" title={c}>{countryFlag(c)}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="font-mono text-[8px] text-white/55 uppercase mb-0.5">Targets</div>
          <div className="flex gap-1">
            {targetCountries.map(c => (
              <span key={c} className="text-sm" title={c}>{countryFlag(c)}</span>
            ))}
          </div>
        </div>
        {threatActors.length > 0 && (
          <div className="ml-auto">
            <div className="font-mono text-[8px] text-white/55 uppercase mb-0.5">Actors</div>
            <div className="font-mono text-[10px] text-red-400">
              {threatActors.length} linked
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Filter Constants ─────────────────────────────────────────

const ATTACK_FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'phishing', label: 'PHISHING' },
  { id: 'malware', label: 'MALWARE' },
  { id: 'c2', label: 'C2' },
] as const;

const SORT_OPTIONS = [
  { id: 'threats', label: 'THREAT COUNT' },
  { id: 'brands', label: 'BRAND COUNT' },
  { id: 'recent', label: 'MOST RECENT' },
] as const;

// ─── Main Page ────────────────────────────────────────────────

export function Campaigns() {
  const navigate = useNavigate();
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [attackFilter, setAttackFilter] = useState('all');
  const [sortBy, setSortBy] = useState('threats');

  // Data fetching
  const { data: opsStats, isLoading: opsStatsLoading } = useOperationsStats();
  const { data: operations, isLoading: opsLoading } = useOperations({ limit: 12 });
  const { data: campaignsRes, isLoading: campaignsLoading } = useCampaigns({ status: 'active', limit: 50 });
  const { data: campStats } = useCampaignStats();
  const { data: geoCampaigns, isLoading: geoLoading } = useGeopoliticalCampaigns();

  const allOperations = operations ?? [];
  const allCampaigns = (campaignsRes ?? []) as Campaign[];

  // Find selected operation for detail panel
  const selectedOperation = allOperations.find(o => o.id === selectedOperationId) ?? null;

  // Filter & sort campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...allCampaigns];

    if (campaignSearch) {
      const q = campaignSearch.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }

    if (attackFilter !== 'all') {
      result = result.filter(c => {
        if (!c.attack_pattern) return false;
        return c.attack_pattern.toLowerCase().includes(attackFilter);
      });
    }

    if (sortBy === 'brands') {
      result.sort((a, b) => b.brand_count - a.brand_count);
    } else if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());
    } else {
      result.sort((a, b) => b.threat_count - a.threat_count);
    }

    return result;
  }, [allCampaigns, campaignSearch, attackFilter, sortBy]);

  if (opsLoading && campaignsLoading) return <CardGridLoader count={9} />;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Page Title */}
      <h1 className="font-display text-xl font-bold text-parchment">Threat Operations</h1>

      {/* ─── Header Stats (4 cards) ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Operations"
          metric={
            <span className="text-[32px] font-bold leading-none text-[#4ADE80]">
              {opsStatsLoading ? '—' : (opsStats?.active_operations ?? 0).toLocaleString()}
            </span>
          }
          metricLabel="Clusters"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="font-mono text-[11px] text-white/60">{opsStats?.accelerating ?? 0} accelerating</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-contrail/40" />
              <span className="font-mono text-[11px] text-white/50">{opsStats?.total_clusters ?? 0} total clusters</span>
            </div>
          </div>
        </StatCard>

        <StatCard
          title="Campaigns Tracked"
          metric={
            <span className="text-[32px] font-bold leading-none text-parchment">
              {opsStatsLoading ? '—' : (opsStats?.campaigns_tracked ?? 0).toLocaleString()}
            </span>
          }
          metricLabel="Active"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-contrail" />
            <span className="font-mono text-[11px] text-white/60">IP-level campaign clusters</span>
          </div>
        </StatCard>

        <StatCard
          title="Brands Targeted"
          metric={
            <span className="text-[32px] font-bold leading-none text-[#f87171]">
              {opsStatsLoading ? '—' : (opsStats?.brands_targeted ?? 0).toLocaleString()}
            </span>
          }
          metricLabel="Distinct"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f87171]" />
            <span className="font-mono text-[11px] text-white/60">Across active threats</span>
          </div>
        </StatCard>

        <StatCard
          title="Threat Types"
          metric={
            <span className="text-[32px] font-bold leading-none text-afterburner">
              {opsStatsLoading ? '—' : (() => {
                const raw = opsStats?.threat_types;
                if (raw == null) return '0';
                if (typeof raw === 'number') return raw.toLocaleString();
                if (typeof raw === 'string') return raw;
                if (Array.isArray(raw)) return raw.join(', ');
                if (typeof raw === 'object') return Object.keys(raw).join(', ');
                return String(raw);
              })()}
            </span>
          }
          metricLabel="Categories"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-afterburner" />
            <span className="font-mono text-[11px] text-white/60">Active attack types</span>
          </div>
        </StatCard>
      </div>

      {/* ─── Section A: Threat Actor Operations ────────────────── */}
      <section>
        <div className="mb-4">
          <div className="section-label font-mono font-bold mb-1">
            NEXUS Correlated Operations
          </div>
          <div className="font-mono text-[11px] text-contrail/50">
            Infrastructure-level operations detected by NEXUS correlation engine
          </div>
        </div>

        {opsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : allOperations.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allOperations.map(op => (
                <OperationCard
                  key={op.id}
                  operation={op}
                  isSelected={selectedOperationId === op.id}
                  onSelect={id => setSelectedOperationId(selectedOperationId === id ? null : id)}
                />
              ))}
            </div>

            {/* Operation Detail Panel */}
            {selectedOperationId && selectedOperation && (
              <div className="mt-4">
                <OperationDetailPanel operationId={selectedOperationId} operation={selectedOperation} />
              </div>
            )}

            {(opsStats?.total_clusters ?? 0) > 12 && (
              <div className="mt-3 text-center">
                <span className="font-mono text-[11px] text-white/55">
                  Showing 12 of {opsStats?.total_clusters ?? 0} operations
                </span>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<Activity />}
            title="No active threat operations"
            subtitle="Nexus will surface correlated attack clusters as threat data accumulates"
            variant="scanning"
          />
        )}
      </section>

      {/* ─── Section: Geopolitical Campaigns ─────────────────────── */}
      {(geoLoading || (geoCampaigns && geoCampaigns.length > 0)) && (
        <section>
          <div className="mb-4">
            <div className="section-label font-mono font-bold mb-1">
              Geopolitical Campaigns
            </div>
            <div className="font-mono text-[11px] text-contrail/50">
              State-linked threat campaigns tracked by adversary country and ASN
            </div>
          </div>

          {geoLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(geoCampaigns ?? []).map(gc => (
                <GeoCampaignCard
                  key={gc.id}
                  campaign={gc}
                  onClick={() => navigate(`/campaigns/geo/${gc.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── Section B: Active Campaigns ───────────────────────── */}
      <section>
        <div className="mb-4">
          <div className="section-label font-mono font-bold mb-1">
            Active Campaigns
          </div>
          <div className="font-mono text-[11px] text-contrail/50">
            IP-clustered campaigns tracked by Strategist agent
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search campaigns..."
            value={campaignSearch}
            onChange={e => setCampaignSearch(e.target.value)}
            className="glass-input rounded-lg px-3 py-1.5 font-mono text-[11px] w-full sm:w-64"
          />

          <div className="flex flex-wrap gap-1.5">
            {ATTACK_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setAttackFilter(f.id)}
                className={`font-mono text-[10px] font-semibold px-3 py-1 rounded transition-all ${
                  attackFilter === f.id
                    ? 'glass-btn-active'
                    : 'glass-btn'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

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

        {/* Campaign Cards Grid */}
        {campaignsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : filteredCampaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCampaigns.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Search />}
            title="No campaigns match current filters"
            subtitle="Try adjusting your filters to see more results"
            variant="clean"
          />
        )}
      </section>
    </div>
  );
}
