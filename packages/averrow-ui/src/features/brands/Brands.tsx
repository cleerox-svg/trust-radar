import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrands, useBrandStats, useToggleMonitor, useAddBrand } from '@/hooks/useBrands';
import type { Brand } from '@/hooks/useBrands';
import { SocialDots } from './components/SocialDots';
import { TrendBadge } from './components/TrendBadge';
import { Sparkline } from './components/Sparkline';
import { LiveFeedCard } from './components/LiveFeedCard';
import { PortfolioHealthCard } from './components/PortfolioHealthCard';
import { AttackVectorsCard } from './components/AttackVectorsCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { CardGridLoader } from '@/components/ui/PageLoader';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { severityColor, severityOpacity, threatTypeColor } from '@/lib/severityColor';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, Shield } from 'lucide-react';
import { BIMIGradeBadge } from '@/components/ui/BIMIGradeBadge';
import {
  DeepCard,
  DimensionalAvatar,
  SeverityChip,
  GlowNumber,
  SectionLabel,
} from '@/components/ui';
import type { Severity } from '@/components/ui';
import { Button } from '@/design-system/components';

/* ─── Severity colors for UI Standard components ─── */
const SEV_COLORS: Record<string, { color: string; dim: string }> = {
  critical: { color: '#C83C3C', dim: '#8B1A1A' },
  high:     { color: '#fb923c', dim: '#7c2d12' },
  medium:   { color: '#fbbf24', dim: '#78350f' },
  low:      { color: '#60a5fa', dim: '#1e3a5f' },
  info:     { color: '#4ade80', dim: '#14532d' },
};

function sevFromBrand(exposure: number | null | undefined, count: number | null | undefined): Severity {
  const c = count ?? 0;
  const e = exposure ?? 100;
  if (e < 40 || c >= 200) return 'critical';
  if ((e >= 40 && e < 60) || (c >= 100 && c < 200)) return 'high';
  if ((e >= 60 && e < 80) || (c >= 50 && c < 100)) return 'medium';
  if (c === 0) return 'info';
  return 'low';
}

function sevColorOf(sev: Severity): string {
  return SEV_COLORS[sev].color;
}
function sevDimColorOf(sev: Severity): string {
  return SEV_COLORS[sev].dim;
}

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
  phishing: 'text-[rgba(255,255,255,0.60)] border-contrail/30',
  typosquat: 'text-yellow-400 border-yellow-400/30',
  malware: 'text-amber-400 border-amber-400/30',
  c2: 'text-red-400 border-red-400/30',
  credential: 'text-orange-400 border-orange-400/30',
  social: 'text-[#E5A832] border-afterburner-border',
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
  let style = 'border-white/10 text-white/40';
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

  const inputClass = 'w-full rounded-lg px-3 py-2 font-mono text-sm';
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-base)',
    color: 'var(--text-primary)',
    outline: 'none',
  };
  const labelClass = 'block font-mono text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.36)] mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl p-6 shadow-2xl" style={{ background:'rgba(15,23,42,0.50)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'0.75rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <h2 className="font-display text-lg font-bold mb-5" style={{ color:'var(--text-primary)' }}>Monitor Brand</h2>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Domain *</label>
            <input
              className={inputClass}
              style={inputStyle}
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
              style={inputStyle}
              placeholder="Auto-detected from domain"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Sector</label>
            <select
              className={inputClass}
              style={inputStyle}
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
              style={inputStyle}
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
              style={inputStyle}
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="font-mono text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-lg border border-white/10 text-[rgba(255,255,255,0.36)] hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={addBrand.isPending}
            className="font-mono text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-lg border border-afterburner-border hover:bg-afterburner-muted transition-colors disabled:opacity-50"
            style={{ color: 'var(--amber)' }}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const cards: Array<{
    label: string;
    value: number;
    suffix?: string;
    sub?: string;
    accent: string;
  }> = [
    {
      label: 'Total Tracked',
      value: stats?.total_tracked ?? 0,
      sub: stats?.sector_breakdown?.[0]?.sector ?? undefined,
      accent: '#E5A832',
    },
    {
      label: 'New This Week',
      value: stats?.new_this_week ?? 0,
      sub: stats?.newest_brand_name ?? undefined,
      accent: '#E5A832',
    },
    {
      label: 'Fastest Rising',
      value: stats?.fastest_rising_pct ?? 0,
      suffix: '%',
      sub: stats?.fastest_rising ?? undefined,
      accent: '#C83C3C',
    },
    {
      label: 'Top Attack',
      value: 0,
      sub: stats?.top_threat_type?.replace(/_/g, ' ') ?? '—',
      accent: '#C83C3C',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c, i) => (
        <DeepCard
          key={c.label}
          variant="active"
          accent={c.accent}
          style={{ padding: '16px 20px', minWidth: 160, position: 'relative', overflow: 'hidden' }}
        >
          <div style={{
            position: 'absolute', top: 12, left: 16,
            width: 4, height: 4, borderRadius: '50%',
            background: c.accent, boxShadow: `0 0 8px ${c.accent}`,
          }} />
          <div style={{
            position: 'absolute', right: -16, bottom: -16,
            width: 80, height: 80, borderRadius: '50%',
            background: `radial-gradient(circle, ${c.accent}40, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{ marginTop: 8, position: 'relative' }}>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.20em',
              color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginBottom: 6,
            }}>
              {c.label}
            </div>
            {i === 3 ? (
              <div style={{
                fontSize: 22, fontWeight: 800,
                color: c.accent, textShadow: `0 0 12px ${c.accent}66`,
                textTransform: 'capitalize', lineHeight: 1.1,
              }}>
                {c.sub ?? '—'}
              </div>
            ) : (
              <GlowNumber value={c.value} color={c.accent} size="lg" suffix={c.suffix} />
            )}
            {i !== 3 && c.sub && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                {c.sub}
              </div>
            )}
          </div>
        </DeepCard>
      ))}
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
  const sev = sevFromBrand(brand.exposure_score, brand.threat_count);
  const countColor = sevColorOf(sev);
  const dimColor = sevDimColorOf(sev);

  return (
    <div
      role="button"
      tabIndex={0}
      data-severity={sev}
      onClick={() => { if (brand.id) navigate(`/brands/${brand.id}`); }}
      onKeyDown={(e) => { if (e.key === 'Enter' && brand.id) navigate(`/brands/${brand.id}`); }}
      className="data-row flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-white/[0.06] cursor-pointer transition-colors group min-w-0"
    >
      {/* 1. Avatar */}
      <div className="flex-shrink-0">
        <DimensionalAvatar
          name={brand.name ?? '?'}
          color={countColor}
          dimColor={dimColor}
          size={36}
          radius={10}
          faviconUrl={brand.canonical_domain
            ? `https://www.google.com/s2/favicons?domain=${brand.canonical_domain}&sz=32`
            : undefined}
          severity={sev ?? undefined}
        />
      </div>

      {/* 2. Name + domain */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-bold text-white/90 truncate">{brand.name}</span>
        <span className="text-[11px] text-white/40 font-mono truncate">{brand.canonical_domain}</span>
      </div>

      {/* 3. Social dots — hidden on mobile */}
      <div className="flex-shrink-0 hidden md:block">
        <SocialDots profiles={brand.social_profiles} maxDots={4} />
      </div>

      {/* 4. Sparkline — hidden on mobile */}
      <div className="flex-shrink-0 hidden sm:block">
        <Sparkline data={brand.threat_history ?? []} width={80} height={20} />
      </div>

      {/* 5. Threat count */}
      <div className="w-16 text-right flex-shrink-0 flex justify-end">
        <GlowNumber value={brand.threat_count ?? 0} color={countColor} size="md" animate={false} />
      </div>

      {/* 6. Trend badge */}
      <div className="w-14 flex-shrink-0">
        <TrendBadge trend={brand.threat_trend} />
      </div>

      {/* 7. Severity chip — hidden on mobile */}
      <div className="flex-shrink-0 hidden md:block">
        {brand.top_threat_type ? (
          <SeverityChip severity={sev} size="xs" />
        ) : (
          <span className="text-[9px] font-mono text-white/20">&mdash;</span>
        )}
      </div>

      {/* 8. Grade badge — hidden on mobile */}
      <div className="w-9 text-center flex-shrink-0 hidden md:block">
        <BIMIGradeBadge grade={brand.bimi_grade} size="sm" tooltip />
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Brands</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex gap-1">
            {VIEW_OPTIONS.map(opt => (
              <Button
                key={opt.key}
                variant={view === opt.key ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="font-mono text-[11px] font-semibold uppercase tracking-wider px-3 sm:px-4 py-1.5 rounded-lg border border-afterburner-border hover:bg-afterburner-muted transition-colors whitespace-nowrap"
            style={{ color: 'var(--amber)' }}
          >
            <span className="hidden sm:inline">Monitor Brand</span>
            <span className="sm:hidden">+ Brand</span>
          </button>
        </div>
      </div>

      {/* Stats row — always visible */}
      <StatsRow />

      {/* View content */}
      {isLoading ? (
        <CardGridLoader count={12} />
      ) : view === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 mt-4">
          {/* Left: filter bar + brand rows */}
          <div className="min-w-0">
            {/* Filter bar */}
            <DeepCard variant="base" style={{ padding: '10px 16px', marginBottom: 12 }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search brands or domains..."
                className="flex-1 rounded-lg px-3 py-1.5 text-sm min-w-0"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-base)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                <select
                  className="rounded-lg px-3 py-1.5 font-mono text-xs flex-shrink-0"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-base)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                  value={sector}
                  onChange={(e) => { setSector(e.target.value); setPage(1); }}
                >
                  <option value="all">All Sectors</option>
                  {SECTORS.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-1 flex-shrink-0">
                  {(['all', 'monitored', 'targeted'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setPage(1); }}
                      className={cn(
                        'px-3 py-1.5 text-[10px] font-mono tracking-wider capitalize rounded-lg border transition-colors whitespace-nowrap',
                        activeTab === tab
                          ? 'text-[#E5A832] border-afterburner-border bg-afterburner-muted'
                          : 'text-white/50 border-white/10 hover:text-white/70'
                      )}
                    >
                      {tab === 'targeted' ? 'Top Threatened' : tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            </DeepCard>

            {/* Brand rows */}
            <DeepCard variant="base" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex flex-col">
              {pagedBrands.map(brand => (
                <BrandRow key={brand.id} brand={brand} onToggleMonitor={handleToggleMonitor} />
              ))}
              {pagedBrands.length === 0 && (
                <EmptyState
                  icon={(brands ?? []).length === 0 ? <Shield /> : <Search />}
                  title={(brands ?? []).length === 0 ? 'No brands monitored yet' : 'No brands match your search'}
                  subtitle={(brands ?? []).length === 0
                    ? 'Add your first brand to start tracking threats, typosquats, and email security posture'
                    : `Try a different name or domain — you're monitoring ${(brands ?? []).length} brands`}
                  action={(brands ?? []).length === 0
                    ? { label: 'Monitor new brand', onClick: () => setModalOpen(true) }
                    : { label: 'Clear search', onClick: () => { setSearch(''); setPage(1); } }}
                  variant={(brands ?? []).length === 0 ? 'scanning' : 'clean'}
                  compact
                />
              )}
            </div>
            </DeepCard>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3">
                <span className="font-mono text-[11px] text-white/40">
                  Showing {showFrom}&ndash;{showTo} of {filteredBrands.length} brands
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="font-mono text-[11px] px-2.5 py-1 rounded border border-white/10 text-white/40 hover:text-[rgba(255,255,255,0.92)] disabled:opacity-30 transition-colors"
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
                            ? 'border-afterburner text-[#E5A832]'
                            : 'border-white/10 text-white/40 hover:text-[rgba(255,255,255,0.92)]',
                        )}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="font-mono text-[11px] px-2.5 py-1 rounded border border-white/10 text-white/40 hover:text-[rgba(255,255,255,0.92)] disabled:opacity-30 transition-colors"
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
                  <span className="text-[9px] font-mono text-white/55 tracking-widest">EXPOSURE</span>
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
                  className="rounded-lg px-3 py-1.5 text-sm w-48"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-base)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
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
                        <div className="border border-white/20 rounded px-2 py-1.5 whitespace-nowrap font-mono shadow-lg" style={{ background: 'var(--bg-page)' }}>
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
                <div className="flex items-center justify-center py-16 text-white/40 text-sm">
                  No brands match current filters
                </div>
              )}

              {/* Summary bar */}
              <div className="flex gap-6 mt-4 text-[10px] font-mono">
                <span>
                  <span className="text-red-400 font-bold">{criticalCount}</span>
                  <span className="text-white/50 ml-1">critical brands</span>
                </span>
                <span>
                  <span className="text-green-400 font-bold">{cleanCount}</span>
                  <span className="text-white/50 ml-1">clean</span>
                </span>
                <span>
                  <span className="text-white/60 font-bold">{totalThreats.toLocaleString()}</span>
                  <span className="text-white/50 ml-1">total threats</span>
                </span>
                <span>
                  <span className="text-white/60 font-bold">{filteredBrands.length}</span>
                  <span className="text-white/50 ml-1">brands shown</span>
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
                      <span className="text-[9px] font-mono text-white/55 tracking-widest uppercase flex-shrink-0">
                        {sectorName}
                      </span>
                      <span className="text-[9px] font-mono text-white/40 border border-white/10 rounded px-1.5 py-0.5 flex-shrink-0">
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
                              <div className="border border-white/20 rounded px-2 py-1.5 whitespace-nowrap font-mono" style={{ background: 'var(--bg-page)' }}>
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
                        <div className="h-8 rounded border border-white/10 flex items-center px-3 text-[9px] font-mono text-white/40 flex-shrink-0">
                          +{overflow} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {Object.keys(grouped).length === 0 && (
                <EmptyState
                  icon={<Search />}
                  title="No brands match current filters"
                  subtitle={`Try a different filter — you're monitoring ${(brands ?? []).length} brands`}
                  action={{ label: 'Clear search', onClick: () => { setSearch(''); setPage(1); } }}
                  variant="clean"
                />
              )}
            </div>
          );
        })()
      )}

      <AddBrandModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
