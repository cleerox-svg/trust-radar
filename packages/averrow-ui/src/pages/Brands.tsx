import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrands, useBrandStats, useToggleMonitor, useAddBrand } from '@/hooks/useBrands';
import type { Brand } from '@/hooks/useBrands';
import { StatCard } from '@/components/brands/StatCard';
import { SocialDots } from '@/components/brands/SocialDots';
import { TrendBadge } from '@/components/brands/TrendBadge';
import { Sparkline } from '@/components/brands/Sparkline';
import { LiveFeedCard } from '@/components/brands/LiveFeedCard';
import { PortfolioHealthCard } from '@/components/brands/PortfolioHealthCard';
import { AttackVectorsCard } from '@/components/brands/AttackVectorsCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { CardGridLoader } from '@/components/ui/PageLoader';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { severityColor, severityOpacity, threatTypeColor } from '@/lib/severityColor';

/* ─── Types ─── */

type BrandView = 'list' | 'heatmap' | 'swimlane';

/* ─── Constants ─── */

const SECTORS = [
  'All Sectors',
  'Technology',
  'Financial Services',
  'Healthcare',
  'Retail',
  'Cryptocurrency',
  'Government',
  'Media',
  'Other',
] as const;

const GRADE_STYLES: Record<string, string> = {
  'A+': 'bg-green-900/40 text-green-400 border-green-500/30',
  A: 'bg-green-900/40 text-green-400 border-green-500/30',
  B: 'bg-blue-900/40 text-blue-400 border-blue-500/30',
  C: 'bg-amber-900/40 text-amber-400 border-amber-500/30',
  D: 'bg-orange-900/40 text-orange-400 border-orange-500/30',
  F: 'bg-red-900/40 text-red-400 border-red-500/30',
};

const THREAT_TYPE_STYLES: Record<string, string> = {
  phishing: 'text-contrail border-contrail/30',
  typosquat: 'text-yellow-400 border-yellow-400/30',
  malware: 'text-amber-400 border-amber-400/30',
  c2: 'text-red-400 border-red-400/30',
  credential: 'text-orange-400 border-orange-400/30',
  social: 'text-orbital-teal border-orbital-teal/30',
};

const PAGE_SIZE = 50;

const VIEW_OPTIONS = [
  { key: 'list' as const, label: '≡ LIST' },
  { key: 'heatmap' as const, label: '▦ MAP' },
  { key: 'swimlane' as const, label: '║ LANES' },
];

/* ─── Helpers ─── */

function threatColor(count: number): string {
  if (count >= 200) return 'text-[#f87171]';
  if (count >= 100) return 'text-[#fb923c]';
  if (count >= 50) return 'text-[#fbbf24]';
  return 'text-[#78A0C8]';
}

function threatTypePill(type: string | null) {
  if (!type) return null;
  const key = type.toLowerCase().replace(/[_\s]/g, '');
  const style = THREAT_TYPE_STYLES[key] ?? 'text-white/50 border-white/20';
  return (
    <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded border', style)}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function gradeBadge(grade: string | null) {
  if (!grade) return <span className="text-white/20 font-mono text-[10px]">&mdash;</span>;
  const g = grade.toUpperCase();
  const style = GRADE_STYLES[g] ?? GRADE_STYLES['F'];
  return (
    <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded border', style)}>
      {g}
    </span>
  );
}

function rankBadge(rank: number) {
  let style = 'border-white/10 text-white/20';
  if (rank === 1) style = 'border-yellow-400 text-yellow-400';
  else if (rank === 2) style = 'border-slate-300 text-slate-300';
  else if (rank === 3) style = 'border-amber-600 text-amber-600';
  return (
    <span className={cn('w-6 h-6 rounded-full border text-[10px] font-mono flex items-center justify-center flex-shrink-0', style)}>
      {rank}
    </span>
  );
}

function monitorStatus(brand: Brand): { label: string; style: string } {
  if (brand.threat_count > 0) {
    return { label: 'ACTIVE', style: 'bg-red-900/40 text-red-400 border-red-500/30' };
  }
  if (brand.created_at) {
    const days = Math.floor((Date.now() - new Date(brand.created_at).getTime()) / 86400000);
    if (days < 7) {
      return { label: 'NEW', style: 'bg-blue-900/40 text-blue-400 border-blue-500/30' };
    }
  }
  return { label: 'CLEAN', style: 'bg-green-900/40 text-green-400 border-green-500/30' };
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─── Star Toggle ─── */

function StarToggle({ brand, className }: { brand: Brand; className?: string }) {
  const toggleMonitor = useToggleMonitor();
  const isMonitored = brand.monitored ?? false;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleMonitor.mutate(brand.id);
      }}
      className={cn(
        'transition-colors',
        isMonitored ? 'text-yellow-400' : 'text-white/20 hover:text-yellow-400',
        className,
      )}
      aria-label={isMonitored ? 'Unmonitor brand' : 'Monitor brand'}
    >
      {isMonitored ? (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      )}
    </button>
  );
}

/* ─── Add Brand Modal ─── */

function AddBrandModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const addBrand = useAddBrand();
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [sector, setSector] = useState('Auto-detect');
  const [reason, setReason] = useState('Client Brand');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(() => {
    let cleanDomain = domain.trim();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (!cleanDomain.includes('.')) {
      setError('Domain must contain a dot (e.g. example.com)');
      return;
    }
    setError('');
    addBrand.mutate(
      {
        domain: cleanDomain,
        name: name.trim() || undefined,
        sector: sector === 'Auto-detect' ? undefined : sector,
        reason,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          showToast('Brand added for monitoring', 'success');
          onClose();
          setDomain('');
          setName('');
          setSector('Auto-detect');
          setReason('Client Brand');
          setNotes('');
        },
        onError: (err) => {
          showToast(err instanceof Error ? err.message : 'Failed to add brand', 'error');
        },
      },
    );
  }, [domain, name, sector, reason, notes, addBrand, showToast, onClose]);

  if (!open) return null;

  const inputClass = 'w-full glass-input rounded-lg px-3 py-2 font-mono text-sm';
  const labelClass = 'block font-mono text-[10px] uppercase tracking-widest text-contrail/60 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl p-6 shadow-2xl glass-card">
        <h2 className="font-display text-lg font-bold text-parchment mb-5">Monitor Brand</h2>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Domain *</label>
            <input
              className={inputClass}
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            {error && <p className="mt-1 font-mono text-[10px] text-red-400">{error}</p>}
          </div>

          <div>
            <label className={labelClass}>Brand Name</label>
            <input
              className={inputClass}
              placeholder="Auto-detected from domain"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Sector</label>
            <select
              className={inputClass}
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            >
              <option>Auto-detect</option>
              {SECTORS.slice(1).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Reason</label>
            <select
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {['Client Brand', 'Competitor', 'Prospect', 'Partner', 'Threat Intel'].map(r => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              className={cn(inputClass, 'resize-none h-20')}
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="font-mono text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-lg border border-white/10 text-contrail/60 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={addBrand.isPending}
            className="font-mono text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-lg border border-orbital-teal/50 text-orbital-teal hover:bg-orbital-teal/10 transition-colors disabled:opacity-50"
          >
            {addBrand.isPending ? 'Adding...' : 'Monitor Brand'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Stats Row ─── */

function StatsRow() {
  const { data: stats, isLoading } = useBrandStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const sectors = stats?.sector_breakdown?.slice(0, 3) ?? [];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Brands"
        metric={
          <span className="text-[32px] font-bold leading-none text-orbital-teal">
            {stats?.total_tracked ?? 0}
          </span>
        }
        metricLabel="tracked"
      >
        <div className="space-y-1.5">
          {sectors.map(s => (
            <div key={s.sector} className="flex items-center gap-2">
              <span className="block h-1.5 w-1.5 rounded-full bg-orbital-teal/60 flex-shrink-0" />
              <span className="font-mono text-[10px] text-white/50 truncate flex-1">{s.sector}</span>
              <span className="font-mono text-[10px] text-white/30">{s.count}</span>
            </div>
          ))}
          {sectors.length === 0 && (
            <span className="font-mono text-[10px] text-white/30">No sector data</span>
          )}
        </div>
      </StatCard>

      <StatCard
        title="New This Week"
        metric={
          <span className="text-[32px] font-bold leading-none text-[#4ade80]">
            {stats?.new_this_week ?? 0}
          </span>
        }
        metricLabel="new"
      >
        <div className="space-y-1">
          {stats?.newest_brand_name && (
            <span className="block font-mono text-[10px] text-white/50 truncate">{stats.newest_brand_name}</span>
          )}
          {stats?.newest_brand_sector && (
            <span className="block font-mono text-[10px] text-white/30">{stats.newest_brand_sector}</span>
          )}
          {stats?.newest_brand_added_by && (
            <span className="block font-mono text-[10px] text-white/20">added by {stats.newest_brand_added_by}</span>
          )}
        </div>
      </StatCard>

      <StatCard
        title="Fastest Rising"
        metric={
          <span className="text-[32px] font-bold leading-none text-[#fb923c]">
            {stats?.fastest_rising_pct ? `${stats.fastest_rising_pct}%` : '—'}
          </span>
        }
        metricLabel="trend"
      >
        <div className="space-y-1">
          {stats?.fastest_rising && (
            <span className="block font-mono text-[10px] text-white/50 truncate">{stats.fastest_rising}</span>
          )}
          {stats?.fastest_rising_domain && (
            <span className="block font-mono text-[10px] text-white/30 truncate">{stats.fastest_rising_domain}</span>
          )}
        </div>
      </StatCard>

      <StatCard
        title="Top Attack Type"
        metric={
          stats?.top_threat_type ? (
            <span className="text-sm font-bold leading-none">
              {threatTypePill(stats.top_threat_type)}
            </span>
          ) : (
            <span className="text-[32px] font-bold leading-none text-white/30">&mdash;</span>
          )
        }
        metricLabel="most common"
      >
        <div className="space-y-1.5">
          {stats?.second_threat_type && (
            <div className="flex items-center gap-2">
              <span className="block h-1.5 w-1.5 rounded-full bg-contrail/40 flex-shrink-0" />
              <span className="font-mono text-[10px] text-white/50">{stats.second_threat_type.replace(/_/g, ' ')}</span>
            </div>
          )}
          {stats?.third_threat_type && (
            <div className="flex items-center gap-2">
              <span className="block h-1.5 w-1.5 rounded-full bg-contrail/20 flex-shrink-0" />
              <span className="font-mono text-[10px] text-white/30">{stats.third_threat_type.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>
      </StatCard>
    </div>
  );
}

/* ─── Brand Row ─── */

interface BrandRowProps {
  brand: Brand;
  onToggleMonitor: (id: string) => void;
}

function BrandRow({ brand, onToggleMonitor }: BrandRowProps) {
  const navigate = useNavigate();
  const countColor = severityColor(brand.exposure_score ?? null, brand.threat_count);
  const typeColor = threatTypeColor(brand.top_threat_type ?? '');

  return (
    <div
      onClick={() => navigate(`/brands/${brand.id}`)}
      className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.03] cursor-pointer transition-colors group"
    >
      {/* 1. Favicon */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`}
        alt=""
        className="w-7 h-7 rounded-md object-contain bg-white/5 flex-shrink-0"
        loading="lazy"
        onError={(e) => {
          const target = e.currentTarget;
          target.classList.add('hidden');
          const fallback = target.nextElementSibling;
          if (fallback) (fallback as HTMLElement).classList.remove('hidden');
        }}
      />
      <div
        className="hidden w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold font-mono text-white"
        style={{ background: countColor }}
      >
        {(brand.name ?? '').slice(0, 2).toUpperCase()}
      </div>

      {/* 2. Name + domain */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-medium text-white/90 truncate">{brand.name}</span>
        <span className="text-[11px] text-white/35 font-mono truncate">{brand.canonical_domain}</span>
      </div>

      {/* 3. Social dots */}
      <div className="flex-shrink-0">
        <SocialDots profiles={brand.social_profiles} maxDots={4} />
      </div>

      {/* 4. Sparkline */}
      <div className="flex-shrink-0">
        <Sparkline data={brand.threat_history ?? []} width={80} height={20} />
      </div>

      {/* 5. Threat count */}
      <span
        className="w-14 text-right font-bold font-mono text-sm flex-shrink-0"
        style={{ color: countColor }}
      >
        {brand.threat_count.toLocaleString()}
      </span>

      {/* 6. Trend badge */}
      <div className="w-14 flex-shrink-0">
        <TrendBadge trend={brand.threat_trend ?? 0} />
      </div>

      {/* 7. Type pill */}
      <div className="flex-shrink-0">
        {brand.top_threat_type ? (
          <span
            className="text-[9px] font-mono px-2 py-0.5 rounded border"
            style={{ color: typeColor, borderColor: `${typeColor}4D` }}
          >
            {brand.top_threat_type.replace(/_/g, ' ')}
          </span>
        ) : (
          <span className="text-[9px] font-mono text-white/20">&mdash;</span>
        )}
      </div>

      {/* 8. Grade badge */}
      <div className="w-9 text-center flex-shrink-0">
        {gradeBadge(brand.email_security_grade)}
      </div>

      {/* 9. Star toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleMonitor(brand.id);
        }}
        className={cn(
          'flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
          brand.monitored ? 'text-yellow-400 opacity-100' : 'text-white/30 hover:text-yellow-400',
        )}
        aria-label={brand.monitored ? 'Unmonitor' : 'Monitor'}
      >
        {brand.monitored ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ─── Main Page ─── */

export function Brands() {
  const navigate = useNavigate();
  const { data: brands = [], isLoading } = useBrands({ view: 'all', timeRange: '7d' });
  const toggleMonitor = useToggleMonitor();

  /* ─── View toggle with localStorage persistence ─── */
  const [view, setView] = useState<BrandView>(() => {
    try {
      return (localStorage.getItem('averrow:brands:view') as BrandView) ?? 'list';
    } catch {
      return 'list';
    }
  });

  const handleViewChange = (v: BrandView) => {
    setView(v);
    try { localStorage.setItem('averrow:brands:view', v); } catch {}
  };

  /* ─── Shared filter state ─── */
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'monitored' | 'targeted'>('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const filteredBrands = useMemo(() => {
    return (brands ?? []).filter(b => {
      const matchSearch = !debouncedSearch ||
        b.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        b.canonical_domain?.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchSector = sector === 'all' || b.sector === sector;
      const matchTab = activeTab === 'all' ? true
        : activeTab === 'monitored' ? b.monitored
        : (b.threat_count ?? 0) > 0;
      return matchSearch && matchSector && matchTab;
    });
  }, [brands, debouncedSearch, sector, activeTab]);

  const totalPages = Math.ceil(filteredBrands.length / PAGE_SIZE);
  const pagedBrands = filteredBrands.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showFrom = filteredBrands.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(page * PAGE_SIZE, filteredBrands.length);

  const handleToggleMonitor = useCallback((id: string) => {
    toggleMonitor.mutate(id);
  }, [toggleMonitor]);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header row with title + view toggle + add brand */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-parchment">Brands</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {VIEW_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => handleViewChange(opt.key)}
                className={cn(
                  'px-3 py-1.5 text-[10px] font-mono tracking-wider rounded-lg transition-colors',
                  view === opt.key
                    ? 'glass-btn-active'
                    : 'glass-btn'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="font-mono text-[11px] font-semibold uppercase tracking-wider px-4 py-1.5 rounded-lg border border-orbital-teal/50 text-orbital-teal hover:bg-orbital-teal/10 transition-colors"
          >
            Monitor Brand
          </button>
        </div>
      </div>

      {/* Stats row — always visible */}
      <StatsRow />

      {/* View content */}
      {isLoading ? (
        <CardGridLoader count={12} />
      ) : view === 'list' ? (
        <div className="grid grid-cols-[1fr_240px] gap-4 mt-4">
          {/* Left: filter bar + brand rows */}
          <div>
            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-3">
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search brands or domains..."
                className="flex-1 glass-input rounded-lg px-3 py-1.5 text-sm"
              />
              <select
                className="glass-input rounded-lg px-3 py-1.5 font-mono text-xs"
                value={sector}
                onChange={(e) => { setSector(e.target.value); setPage(1); }}
              >
                <option value="all">All Sectors</option>
                {SECTORS.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex gap-1">
                {(['all', 'monitored', 'targeted'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setPage(1); }}
                    className={cn(
                      'px-3 py-1.5 text-[10px] font-mono tracking-wider capitalize rounded-lg border transition-colors',
                      activeTab === tab
                        ? 'text-orbital-teal border-orbital-teal/40 bg-orbital-teal/10'
                        : 'text-white/30 border-white/10 hover:text-white/50'
                    )}
                  >
                    {tab === 'targeted' ? 'Top Threatened' : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand rows */}
            <div className="flex flex-col">
              {pagedBrands.map(brand => (
                <BrandRow key={brand.id} brand={brand} onToggleMonitor={handleToggleMonitor} />
              ))}
              {pagedBrands.length === 0 && (
                <div className="text-center py-12 font-mono text-sm text-white/30">
                  No brands found
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3">
                <span className="font-mono text-[11px] text-white/40">
                  Showing {showFrom}&ndash;{showTo} of {filteredBrands.length} brands
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="font-mono text-[11px] px-2.5 py-1 rounded border border-white/10 text-white/40 hover:text-parchment disabled:opacity-30 transition-colors"
                  >
                    Prev
                  </button>
                  {pageNumbers.map((p, i) =>
                    p === 'ellipsis' ? (
                      <span key={`e${i}`} className="font-mono text-[11px] text-white/30 px-1">&hellip;</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          'font-mono text-[11px] px-2.5 py-1 rounded border transition-colors',
                          page === p
                            ? 'border-orbital-teal text-orbital-teal'
                            : 'border-white/10 text-white/40 hover:text-parchment',
                        )}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="font-mono text-[11px] px-2.5 py-1 rounded border border-white/10 text-white/40 hover:text-parchment disabled:opacity-30 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: sticky sidebar */}
          <div className="flex flex-col gap-3 sticky top-4 self-start">
            <LiveFeedCard />
            <PortfolioHealthCard brands={filteredBrands} />
            <AttackVectorsCard brands={filteredBrands} />
          </div>
        </div>
      ) : view === 'heatmap' ? (
        /* ─── Heatmap View ─── */
        (() => {
          const maxCount = Math.max(...filteredBrands.map(b => b.threat_count ?? 0), 1);
          const cols = filteredBrands.length < 20 ? 5
            : filteredBrands.length < 50 ? 8
            : filteredBrands.length < 100 ? 10 : 12;
          const heatmapBrands = [...filteredBrands].sort((a, b) => (b.threat_count ?? 0) - (a.threat_count ?? 0));
          const criticalCount = filteredBrands.filter(b => (b.threat_count ?? 0) >= 200).length;
          const cleanCount = filteredBrands.filter(b => (b.threat_count ?? 0) === 0).length;
          const totalThreats = filteredBrands.reduce((sum, b) => sum + (b.threat_count ?? 0), 0);

          return (
            <div className="mt-4">
              {/* Header bar */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <span className="text-[9px] font-mono text-white/35 tracking-widest">EXPOSURE</span>
                  {[
                    { label: 'Critical', color: '#f87171' },
                    { label: 'High',     color: '#fb923c' },
                    { label: 'Medium',   color: '#fbbf24' },
                    { label: 'Low',      color: '#78A0C8' },
                    { label: 'Clean',    color: '#4ade80' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                      <span className="text-[9px] text-white/50">{s.label}</span>
                    </div>
                  ))}
                </div>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search brands..."
                  className="glass-input rounded-lg px-3 py-1.5 text-sm w-48"
                />
              </div>

              {/* Grid */}
              {heatmapBrands.length > 0 ? (
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {heatmapBrands.map(brand => (
                    <div
                      key={brand.id}
                      className="aspect-square rounded cursor-pointer transition-all hover:ring-2 hover:ring-white/30 hover:scale-110 relative group"
                      style={{
                        background: severityColor(brand.exposure_score, brand.threat_count),
                        opacity: severityOpacity(brand.threat_count ?? 0, maxCount),
                      }}
                      onClick={() => navigate(`/brands/${brand.id}`)}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                        <div className="bg-cockpit border border-white/20 rounded px-2 py-1.5 whitespace-nowrap font-mono shadow-lg">
                          <div className="text-[11px] font-medium text-white/90">{brand.name}</div>
                          <div className="text-[10px] text-white/50">
                            {brand.threat_count ?? 0} threats
                            {brand.email_security_grade ? ` · ${brand.email_security_grade}` : ''}
                          </div>
                        </div>
                        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white/20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-16 text-white/30 text-sm">
                  No brands match current filters
                </div>
              )}

              {/* Summary bar */}
              <div className="flex gap-6 mt-4 text-[10px] font-mono">
                <span>
                  <span className="text-red-400 font-bold">{criticalCount}</span>
                  <span className="text-white/30 ml-1">critical brands</span>
                </span>
                <span>
                  <span className="text-green-400 font-bold">{cleanCount}</span>
                  <span className="text-white/30 ml-1">clean</span>
                </span>
                <span>
                  <span className="text-white/60 font-bold">{totalThreats.toLocaleString()}</span>
                  <span className="text-white/30 ml-1">total threats</span>
                </span>
                <span>
                  <span className="text-white/60 font-bold">{filteredBrands.length}</span>
                  <span className="text-white/30 ml-1">brands shown</span>
                </span>
              </div>
            </div>
          );
        })()
      ) : (
        /* ─── Swimlane View ─── */
        (() => {
          const SWIMLANE_SECTORS = [
            'Financial Services', 'Technology', 'Cryptocurrency',
            'Healthcare', 'Retail', 'Government', 'Media', 'Other',
          ];

          const grouped = SWIMLANE_SECTORS.reduce((acc, s) => {
            const sectorBrands = filteredBrands
              .filter(b => {
                const brandSector = b.sector ?? 'Other';
                return brandSector === s || (s === 'Other' && !SWIMLANE_SECTORS.includes(brandSector));
              })
              .sort((a, b) => (b.threat_count ?? 0) - (a.threat_count ?? 0));
            if (sectorBrands.length > 0) acc[s] = sectorBrands;
            return acc;
          }, {} as Record<string, Brand[]>);

          return (
            <div className="flex flex-col gap-6 mt-2">
              {Object.entries(grouped).map(([sectorName, sectorBrands]) => {
                const maxInSector = Math.max(...sectorBrands.map(b => b.threat_count ?? 0), 1);
                const visible = sectorBrands.slice(0, 7);
                const overflow = sectorBrands.length - 7;

                return (
                  <div key={sectorName}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[9px] font-mono text-white/35 tracking-widest uppercase flex-shrink-0">
                        {sectorName}
                      </span>
                      <span className="text-[9px] font-mono text-white/20 border border-white/10 rounded px-1.5 py-0.5 flex-shrink-0">
                        {sectorBrands.length}
                      </span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {visible.map(brand => {
                        const pillWidth = Math.max(56, Math.min(200, Math.round(
                          48 + ((brand.threat_count ?? 0) / maxInSector) * 152
                        )));
                        const color = severityColor(brand.exposure_score, brand.threat_count);

                        return (
                          <div
                            key={brand.id}
                            className="h-8 rounded flex items-center gap-1.5 justify-center px-2 cursor-pointer transition-all hover:brightness-110 hover:scale-105 flex-shrink-0 relative group"
                            style={{ background: color, width: `${pillWidth}px`, opacity: 0.82 }}
                            onClick={() => navigate(`/brands/${brand.id}`)}
                          >
                            <span className="text-[9px] font-bold text-cockpit truncate">
                              {brand.name}
                            </span>
                            {(brand.threat_count ?? 0) > 0 && (
                              <span className="text-[9px] text-cockpit/60 flex-shrink-0">
                                {(brand.threat_count ?? 0) >= 1000
                                  ? `${((brand.threat_count ?? 0) / 1000).toFixed(1)}k`
                                  : brand.threat_count}
                              </span>
                            )}

                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                              <div className="bg-cockpit border border-white/20 rounded px-2 py-1.5 whitespace-nowrap font-mono">
                                <div className="text-[11px] font-medium text-white/90">{brand.name}</div>
                                <div className="text-[10px] text-white/50">
                                  {brand.canonical_domain}
                                  {brand.email_security_grade ? ` · ${brand.email_security_grade}` : ''}
                                </div>
                                <div className="text-[10px]" style={{ color }}>
                                  {brand.threat_count ?? 0} threats
                                </div>
                              </div>
                              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white/20" />
                            </div>
                          </div>
                        );
                      })}

                      {overflow > 0 && (
                        <div className="h-8 rounded border border-white/10 flex items-center px-3 text-[9px] font-mono text-white/30 flex-shrink-0">
                          +{overflow} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {Object.keys(grouped).length === 0 && (
                <div className="flex items-center justify-center py-16 text-white/30 text-sm">
                  No brands match current filters
                </div>
              )}
            </div>
          );
        })()
      )}

      <AddBrandModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
