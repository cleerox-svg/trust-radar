import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrands, useBrandStats, useToggleMonitor, useAddBrand } from '@/hooks/useBrands';
import type { Brand } from '@/hooks/useBrands';
import { StatCard } from '@/components/brands/StatCard';
import { SocialDots } from '@/components/brands/SocialDots';
import { TrendBadge } from '@/components/brands/TrendBadge';
import { Sparkline } from '@/components/brands/Sparkline';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { CardGridLoader } from '@/components/ui/PageLoader';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';

/* ─── Constants ─── */

const TIME_RANGES = ['7D', '30D', '90D', '1Y'] as const;

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

const MONITOR_FILTERS = ['All', 'Active Threats', 'Clean', 'New'] as const;

const THREAT_TYPE_STYLES: Record<string, string> = {
  phishing: 'text-contrail border-contrail/30',
  typosquat: 'text-yellow-400 border-yellow-400/30',
  malware: 'text-amber-400 border-amber-400/30',
  c2: 'text-red-400 border-red-400/30',
  credential: 'text-orange-400 border-orange-400/30',
  social: 'text-orbital-teal border-orbital-teal/30',
};

const GRADE_STYLES: Record<string, string> = {
  'A+': 'bg-green-900/40 text-green-400 border-green-500/30',
  A: 'bg-green-900/40 text-green-400 border-green-500/30',
  B: 'bg-blue-900/40 text-blue-400 border-blue-500/30',
  C: 'bg-amber-900/40 text-amber-400 border-amber-500/30',
  D: 'bg-orange-900/40 text-orange-400 border-orange-500/30',
  F: 'bg-red-900/40 text-red-400 border-red-500/30',
};

const PAGE_SIZE = 25;

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
  if (!grade) return null;
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

  const inputClass = 'w-full bg-cockpit border border-white/10 rounded-lg px-3 py-2 font-mono text-sm text-parchment placeholder:text-white/30 focus:border-orbital-teal/50 focus:outline-none';
  const labelClass = 'block font-mono text-[10px] uppercase tracking-widest text-contrail/60 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-instrument p-6 shadow-2xl">
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

/* ─── Brand Card (shared between Top Targeted & Monitored) ─── */

function BrandCard({
  brand,
  rank,
  variant,
}: {
  brand: Brand;
  rank?: number;
  variant: 'top' | 'monitored';
}) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/brands/${brand.id}`)}
      className="rounded-xl border border-white/10 bg-cockpit p-4 hover:border-white/20 transition-colors cursor-pointer flex flex-col gap-2.5"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {variant === 'top' && rank != null && rankBadge(rank)}
          <img
            src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`}
            alt=""
            className="w-5 h-5 rounded flex-shrink-0"
            loading="lazy"
          />
          <div className="min-w-0">
            <div className="font-display font-semibold text-sm text-parchment truncate">{brand.name}</div>
            <div className="font-mono text-[11px] text-white/40 truncate">{brand.canonical_domain}</div>
          </div>
        </div>
        {variant === 'top' && gradeBadge(brand.email_security_grade)}
        {variant === 'monitored' && (() => {
          const s = monitorStatus(brand);
          return (
            <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded border', s.style)}>
              {s.label}
            </span>
          );
        })()}
      </div>

      {/* Social dots */}
      <SocialDots profiles={brand.social_profiles} />

      {/* Sparkline */}
      <Sparkline data={brand.threat_history ?? []} className="w-full" width={260} height={28} />

      {/* Footer row */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <span className={cn('text-2xl font-bold', threatColor(brand.threat_count))}>
            {brand.threat_count.toLocaleString()}
          </span>
          <span className="font-mono text-[10px] text-white/40 ml-1.5">active threats</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendBadge trend={brand.threat_trend} />
          {threatTypePill(brand.top_threat_type)}
        </div>
      </div>

      {/* Monitored-only footer */}
      {variant === 'monitored' && (
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="font-mono text-[10px] text-white/30 truncate">
            Monitored {daysAgo(brand.monitored_since)}
            {brand.monitored_by ? ` \u00B7 by ${brand.monitored_by}` : ''}
          </span>
          <StarToggle brand={brand} />
        </div>
      )}
    </div>
  );
}

/* ─── Top Targeted Tab ─── */

function TopTargetedTab({ brands, timeRange, setTimeRange }: { brands: Brand[]; timeRange: string; setTimeRange: (r: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {TIME_RANGES.map(r => (
          <button
            key={r}
            onClick={() => setTimeRange(r.toLowerCase())}
            className={cn(
              'font-mono text-[11px] font-semibold px-3 py-1 rounded border transition-colors',
              timeRange === r.toLowerCase()
                ? 'border-orbital-teal text-orbital-teal'
                : 'border-white/10 text-white/30 hover:text-white/50',
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {brands.map((brand, idx) => (
          <BrandCard key={brand.id} brand={brand} rank={idx + 1} variant="top" />
        ))}
      </div>
    </div>
  );
}

/* ─── Monitored Tab ─── */

function MonitoredTab({ brands }: { brands: Brand[] }) {
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    let result = brands.filter(b => b.monitored);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(b =>
        b.name.toLowerCase().includes(q) || b.canonical_domain.toLowerCase().includes(q),
      );
    }
    if (filter === 'Active Threats') result = result.filter(b => b.threat_count > 0);
    else if (filter === 'Clean') result = result.filter(b => monitorStatus(b).label === 'CLEAN');
    else if (filter === 'New') result = result.filter(b => monitorStatus(b).label === 'NEW');
    return result;
  }, [brands, debouncedSearch, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {MONITOR_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'font-mono text-[11px] font-semibold px-3 py-1 rounded border transition-colors',
                filter === f
                  ? 'border-orbital-teal text-orbital-teal'
                  : 'border-white/10 text-white/30 hover:text-white/50',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          className="bg-cockpit border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs text-parchment placeholder:text-white/30 focus:border-orbital-teal/50 focus:outline-none w-56"
          placeholder="Search brands or domains..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filtered.map(brand => (
          <BrandCard key={brand.id} brand={brand} variant="monitored" />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 font-mono text-sm text-white/30">
            No monitored brands found
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── All Brands Tab ─── */

type SortKey = 'name' | 'sector' | 'threat_count' | 'threat_trend' | 'top_threat_type' | 'email_security_grade';
type SortDir = 'asc' | 'desc';

function AllBrandsTab({ brands }: { brands: Brand[] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('All Sectors');
  const [sortKey, setSortKey] = useState<SortKey>('threat_count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    let result = [...brands];
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(b =>
        b.name.toLowerCase().includes(q) || b.canonical_domain.toLowerCase().includes(q),
      );
    }
    if (sector !== 'All Sectors') {
      result = result.filter(b => b.sector === sector);
    }
    result.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return result;
  }, [brands, debouncedSearch, sector, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showFrom = filtered.length > 0 ? page * PAGE_SIZE + 1 : 0;
  const showTo = Math.min((page + 1) * PAGE_SIZE, filtered.length);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  }

  function headerClass(key: SortKey) {
    return cn(
      'font-mono text-[9px] font-semibold uppercase tracking-widest cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left',
      sortKey === key ? 'text-orbital-teal' : 'text-contrail/50',
    );
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (page > 2) pages.push('ellipsis');
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
      if (page < totalPages - 3) pages.push('ellipsis');
      pages.push(totalPages - 1);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="bg-cockpit border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs text-parchment placeholder:text-white/30 focus:border-orbital-teal/50 focus:outline-none w-64"
          placeholder="Search brands or domains..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
        <select
          className="bg-cockpit border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs text-parchment focus:border-orbital-teal/50 focus:outline-none"
          value={sector}
          onChange={(e) => { setSector(e.target.value); setPage(0); }}
        >
          {SECTORS.map(s => <option key={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setModalOpen(true)}
          className="ml-auto font-mono text-[11px] font-semibold uppercase tracking-wider px-4 py-1.5 rounded-lg border border-orbital-teal/50 text-orbital-teal hover:bg-orbital-teal/10 transition-colors"
        >
          Monitor Brand
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="font-mono text-[9px] font-semibold uppercase tracking-widest text-contrail/50 px-3 py-2.5 text-left w-10">
                &#9734;
              </th>
              <th className={headerClass('name')} onClick={() => toggleSort('name')}>
                Brand{sortIndicator('name')}
              </th>
              <th className={headerClass('sector')} onClick={() => toggleSort('sector')}>
                Sector{sortIndicator('sector')}
              </th>
              <th className={headerClass('threat_count')} onClick={() => toggleSort('threat_count')}>
                Threats{sortIndicator('threat_count')}
              </th>
              <th className={headerClass('threat_trend')} onClick={() => toggleSort('threat_trend')}>
                Trend{sortIndicator('threat_trend')}
              </th>
              <th className={headerClass('top_threat_type')} onClick={() => toggleSort('top_threat_type')}>
                Top Type{sortIndicator('top_threat_type')}
              </th>
              <th className={headerClass('email_security_grade')} onClick={() => toggleSort('email_security_grade')}>
                Email{sortIndicator('email_security_grade')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map(brand => (
              <tr
                key={brand.id}
                onClick={() => navigate(`/brands/${brand.id}`)}
                className="border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors"
              >
                <td className="px-3 py-3">
                  <StarToggle brand={brand} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`}
                      alt=""
                      className="w-4 h-4 rounded flex-shrink-0"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-sm text-parchment truncate">{brand.name}</div>
                      <div className="font-mono text-[11px] text-white/40 truncate">{brand.canonical_domain}</div>
                      <SocialDots profiles={brand.social_profiles} className="mt-1" />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-white/50">{brand.sector ?? '—'}</td>
                <td className="px-3 py-3">
                  <span className={cn('text-lg font-bold', threatColor(brand.threat_count))}>
                    {brand.threat_count.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <TrendBadge trend={brand.threat_trend} />
                </td>
                <td className="px-3 py-3">{threatTypePill(brand.top_threat_type) ?? <span className="text-white/30">&mdash;</span>}</td>
                <td className="px-3 py-3">{gradeBadge(brand.email_security_grade) ?? <span className="text-white/30">&mdash;</span>}</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 font-mono text-sm text-white/30">
                  No brands found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="font-mono text-[11px] text-white/40">
            Showing {showFrom}&ndash;{showTo} of {filtered.length} brands
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
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
                  {p + 1}
                </button>
              ),
            )}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="font-mono text-[11px] px-2.5 py-1 rounded border border-white/10 text-white/40 hover:text-parchment disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <AddBrandModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

/* ─── Main Page ─── */

export function Brands() {
  const [view, setView] = useState('top');
  const [timeRange, setTimeRange] = useState('7d');
  const { data: brandsRes, isLoading } = useBrands({ view: view === 'all' ? 'all' : view, timeRange });

  const brands = brandsRes?.data ?? [];
  const total = brandsRes?.total ?? brands.length;

  const tabs = [
    { id: 'top', label: 'TOP TARGETED', count: total },
    { id: 'monitored', label: 'MONITORED' },
    { id: 'all', label: 'ALL BRANDS' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-display text-xl font-bold text-parchment">Brands</h1>

      <StatsRow />

      <Tabs tabs={tabs} activeTab={view} onChange={setView} />

      {isLoading ? (
        <CardGridLoader count={12} />
      ) : (
        <>
          {view === 'top' && (
            <TopTargetedTab brands={brands} timeRange={timeRange} setTimeRange={setTimeRange} />
          )}
          {view === 'monitored' && <MonitoredTab brands={brands} />}
          {view === 'all' && <AllBrandsTab brands={brands} />}
        </>
      )}
    </div>
  );
}
