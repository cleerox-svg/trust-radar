import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminTakedowns, useTakedownEvidence, useUpdateTakedown } from '@/hooks/useTakedowns';
import type { Takedown, TakedownEvidence } from '@/hooks/useTakedowns';
import { useToast } from '@/components/ui/Toast';
import { relativeTime } from '@/lib/time';
import { useMobile, DrillHeader, MobileBottomSheet, HeroStatGrid, MobileFilterChips } from '@/components/mobile';

// ─── Status mapping (DB → display) ────────────────────────────

const STATUS_DISPLAY: Record<string, string> = {
  draft: 'DRAFT',
  requested: 'PENDING',
  submitted: 'SUBMITTED',
  pending_response: 'AWAITING',
  taken_down: 'RESOLVED',
  failed: 'FAILED',
  expired: 'EXPIRED',
  withdrawn: 'DISMISSED',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'badge-glass badge-dormant',
  requested: 'badge-glass badge-high',
  submitted: 'badge-glass badge-pivot',
  pending_response: 'badge-glass badge-accelerating',
  taken_down: 'badge-glass badge-success',
  failed: 'badge-glass badge-failed',
  expired: 'badge-glass badge-dormant',
  withdrawn: 'badge-glass badge-dormant',
};

const SEVERITY_BADGE_CLASS: Record<string, string> = {
  HIGH: 'badge-glass badge-critical',
  MEDIUM: 'badge-glass badge-high',
  LOW: 'badge-glass badge-dormant',
  CRITICAL: 'badge-glass badge-critical',
};

// ─── Filter pill definitions ───────────────────────────────────

const STATUS_PILLS = [
  { key: 'all', label: 'ALL' },
  { key: 'draft', label: 'DRAFT' },
  { key: 'requested', label: 'PENDING' },
  { key: 'submitted', label: 'SUBMITTED' },
  { key: 'taken_down', label: 'RESOLVED' },
  { key: 'withdrawn', label: 'DISMISSED' },
] as const;

const TYPE_PILLS = [
  { key: 'all', label: 'ALL' },
  { key: 'social_profile', label: 'SOCIAL' },
  { key: 'url', label: 'URL' },
  { key: 'domain', label: 'DOMAIN' },
] as const;

const SORT_OPTIONS = [
  { key: 'priority', label: 'Priority Score' },
  { key: 'newest', label: 'Newest' },
  { key: 'brand', label: 'Brand' },
] as const;

// ─── Platform badges ───────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string | null }) {
  const config: Record<string, { label: string; classes: string }> = {
    tiktok: { label: 'TT', classes: 'bg-white/10 text-white' },
    youtube: { label: 'YT', classes: 'bg-red-500/20 text-red-400' },
    github: { label: 'GH', classes: 'bg-purple-500/20 text-purple-400' },
    linkedin: { label: 'LI', classes: 'bg-blue-500/20 text-blue-400' },
  };
  const fallback = { label: 'URL', classes: 'bg-amber-500/20 text-amber-400' };
  const c = (platform ? config[platform.toLowerCase()] : null) ?? fallback;
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md font-mono text-[10px] font-bold ${c.classes}`}>
      {c.label}
    </span>
  );
}

// ─── Priority bar ──────────────────────────────────────────────

function PriorityBar({ score }: { score: number }) {
  const fillClass = score > 70
    ? 'progress-bar-fill-red'
    : score > 40
      ? 'progress-bar-fill-amber'
      : 'progress-bar-fill-teal';
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-white/40 w-14 shrink-0">Priority</span>
      <div className="progress-bar-track h-[6px] flex-1">
        <div className={fillClass} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-[10px] text-white/60 w-10 text-right">{score}/100</span>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────

function StatCard({ title, value, glowClass }: {
  title: string;
  value: number;
  glowClass?: string;
}) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-2">{title}</div>
      <div className={`font-mono text-[28px] font-bold leading-none ${glowClass ?? 'text-parchment'}`}>
        {value}
      </div>
    </div>
  );
}

// ─── Evidence panel (expanded detail) ──────────────────────────

function EvidencePanel({ takedownId }: { takedownId: string }) {
  const { data: evidence, isLoading } = useTakedownEvidence(takedownId);
  if (isLoading) return <div className="animate-pulse h-16 rounded-lg bg-white/[0.03]" />;
  if (!evidence?.length) return <p className="text-[11px] text-white/30 font-mono">No evidence artifacts.</p>;
  return (
    <div className="space-y-2">
      {evidence.map((e: TakedownEvidence) => (
        <div key={e.id} className="glass-card rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-glass badge-pivot">{e.evidence_type.replace(/_/g, ' ')}</span>
            <span className="font-mono text-xs font-semibold text-parchment">{e.title}</span>
          </div>
          {e.content_text && (
            <p className="text-[11px] text-white/50 line-clamp-4">{e.content_text}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Detail panel (three-column) ───────────────────────────────

function DetailPanel({ takedown, onUpdate, updatingId }: {
  takedown: Takedown;
  onUpdate: (id: string, updates: { status?: string; notes?: string }) => void;
  updatingId: string | null;
}) {
  const [localNotes, setLocalNotes] = useState(takedown.notes ?? '');
  const isUpdating = updatingId === takedown.id;

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06]">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Target Details */}
        <div className="space-y-3">
          <div className="section-label">TARGET DETAILS</div>
          <div className="space-y-2">
            <DetailRow label="Type">
              <span className="badge-glass badge-pivot">{takedown.target_type.replace(/_/g, ' ')}</span>
            </DetailRow>
            <DetailRow label="Platform">
              <span className="text-parchment font-mono text-[11px]">
                {takedown.target_platform ?? '\u2014'}
              </span>
            </DetailRow>
            <DetailRow label="Handle / URL">
              <span className="text-parchment font-mono text-[11px] break-all select-all">
                {takedown.target_value}
              </span>
            </DetailRow>
            {takedown.target_url && (
              <DetailRow label="Full URL">
                <span className="text-afterburner font-mono text-[11px] break-all select-all">
                  {takedown.target_url}
                </span>
              </DetailRow>
            )}
            <DetailRow label="Brand">
              <span className="text-parchment text-[11px]">{takedown.brand_name ?? '\u2014'}</span>
            </DetailRow>
            <DetailRow label="Source">
              <span className="text-white/50 font-mono text-[11px]">
                {takedown.source_type ? 'Sparrow AI' : 'Manual'}
              </span>
            </DetailRow>
            <DetailRow label="Severity">
              <span className={SEVERITY_BADGE_CLASS[takedown.severity] ?? 'badge-glass badge-dormant'}>
                {takedown.severity}
              </span>
            </DetailRow>
            <DetailRow label="Priority">
              <span className="font-mono text-[11px] text-parchment">{takedown.priority_score}/100</span>
            </DetailRow>
            <DetailRow label="Created">
              <span className="font-mono text-[11px] text-white/40">{relativeTime(takedown.created_at)}</span>
            </DetailRow>
          </div>
        </div>

        {/* CENTER — Evidence */}
        <div className="space-y-3">
          <div className="section-label">EVIDENCE</div>
          {takedown.evidence_summary && (
            <div className="glass-card rounded-lg p-3">
              <p className="text-[12px] text-parchment/80 leading-relaxed">{takedown.evidence_summary}</p>
            </div>
          )}
          {takedown.evidence_detail && (
            <div className="glass-card rounded-lg p-3">
              <p className="text-[11px] text-white/50 whitespace-pre-line">{takedown.evidence_detail}</p>
            </div>
          )}
          <EvidencePanel takedownId={takedown.id} />
          {takedown.provider_abuse_contact && takedown.provider_method === 'form' && (
            <a
              href={takedown.provider_abuse_contact}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-btn inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-afterburner"
            >
              Submit Form &rarr;
            </a>
          )}
          {takedown.provider_abuse_contact && takedown.provider_method === 'email' && (
            <a
              href={`mailto:${takedown.provider_abuse_contact}`}
              className="glass-btn inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-afterburner"
            >
              Draft Email &rarr;
            </a>
          )}
        </div>

        {/* RIGHT — Actions */}
        <div className="space-y-3">
          <div className="section-label">ACTIONS</div>
          <StatusActions
            takedown={takedown}
            onUpdate={onUpdate}
            isUpdating={isUpdating}
          />
          <hr className="hud-divider" />
          <div className="section-label">NOTES</div>
          <textarea
            className="glass-input w-full rounded-md px-3 py-2 font-mono text-[11px] h-24 resize-none"
            placeholder="Add notes..."
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
          />
          <button
            className="glass-btn rounded-md px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-parchment"
            onClick={() => onUpdate(takedown.id, { notes: localNotes })}
            disabled={isUpdating}
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider w-20 shrink-0 pt-0.5">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ─── Status action buttons ─────────────────────────────────────

function StatusActions({ takedown, onUpdate, isUpdating }: {
  takedown: Takedown;
  onUpdate: (id: string, updates: { status?: string }) => void;
  isUpdating: boolean;
}) {
  const s = takedown.status;
  const btn = (label: string, status: string, variant: 'primary' | 'ghost' | 'success' = 'primary') => {
    const classes = {
      primary: 'glass-btn-active rounded-md px-4 py-2 font-mono text-[10px] uppercase tracking-wider',
      success: 'glass-btn rounded-md px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-green-400 border-green-400/30',
      ghost: 'glass-btn rounded-md px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/50',
    };
    return (
      <button
        className={classes[variant]}
        onClick={() => onUpdate(takedown.id, { status })}
        disabled={isUpdating}
      >
        {label}
      </button>
    );
  };

  if (s === 'draft') return (
    <div className="flex flex-wrap gap-2">
      {btn('Mark as Reviewed', 'requested')}
      {btn('Submit Takedown', 'submitted')}
      {btn('Dismiss', 'withdrawn', 'ghost')}
    </div>
  );
  if (s === 'requested') return (
    <div className="flex flex-wrap gap-2">
      {btn('Submit Takedown', 'submitted')}
      {btn('Back to Draft', 'draft', 'ghost')}
    </div>
  );
  if (s === 'submitted') return (
    <div className="flex flex-wrap gap-2">
      {btn('Mark Resolved', 'taken_down', 'success')}
      {btn('Mark Unresolved', 'requested', 'ghost')}
    </div>
  );
  if (s === 'pending_response') return (
    <div className="flex flex-wrap gap-2">
      {btn('Mark Resolved', 'taken_down', 'success')}
      {btn('Failed', 'failed', 'ghost')}
    </div>
  );
  if (s === 'taken_down') return (
    <span className="badge-glass badge-success">RESOLVED</span>
  );
  return (
    <span className={STATUS_BADGE_CLASS[s] ?? 'badge-glass badge-dormant'}>{STATUS_DISPLAY[s] ?? s}</span>
  );
}

// ─── Takedown card ─────────────────────────────────────────────

function TakedownCard({ takedown, isExpanded, onToggle, onUpdate, updatingId }: {
  takedown: Takedown;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: { status?: string; notes?: string }) => void;
  updatingId: string | null;
}) {
  const sev = takedown.severity?.toUpperCase() ?? '';
  const accentClass = sev === 'HIGH' || sev === 'CRITICAL'
    ? 'glass-card-red'
    : sev === 'MEDIUM'
      ? 'glass-card-amber'
      : '';

  return (
    <div className={`glass-card ${accentClass} rounded-xl p-4 cursor-pointer transition-all`}>
      <div onClick={onToggle}>
        {/* Row 1: platform icon + handle + status badge */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <PlatformBadge platform={takedown.target_platform} />
            <span className="font-mono text-sm font-semibold text-parchment truncate">
              {takedown.target_value}
            </span>
          </div>
          <span className={STATUS_BADGE_CLASS[takedown.status] ?? 'badge-glass badge-dormant'}>
            {STATUS_DISPLAY[takedown.status] ?? takedown.status}
          </span>
        </div>

        {/* Row 2: brand + platform + severity */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-[11px]">
            {takedown.brand_name && (
              <span className="text-parchment/70">{takedown.brand_name}</span>
            )}
            {takedown.target_platform && (
              <>
                <span className="text-white/20">&middot;</span>
                <span className="text-white/40 font-mono">{takedown.target_platform}</span>
              </>
            )}
          </div>
          <span className={SEVERITY_BADGE_CLASS[sev] ?? 'badge-glass badge-dormant'}>{sev}</span>
        </div>

        {/* Row 3: evidence summary */}
        <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2 mb-3">
          {takedown.evidence_summary}
        </p>

        <hr className="hud-divider" />

        {/* Row 4: priority bar + method + date */}
        <div className="space-y-1.5 mb-3">
          <PriorityBar score={takedown.priority_score} />
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/40 font-mono">
              Method: {takedown.provider_method ?? 'unknown'}
            </span>
            <span className="text-white/30 font-mono">{relativeTime(takedown.created_at)}</span>
          </div>
        </div>

        <hr className="hud-divider" />

        {/* Row 5: action buttons */}
        <div className="flex items-center justify-between gap-2">
          <button
            className="glass-btn-active rounded-md px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isExpanded ? 'Close' : 'Review \u2192'}
          </button>
          {takedown.status === 'draft' && (
            <button
              className="glass-btn rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(takedown.id, { status: 'withdrawn' });
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <DetailPanel
          takedown={takedown}
          onUpdate={onUpdate}
          updatingId={updatingId}
        />
      )}
    </div>
  );
}

// ─── Sortie ID generator ──────────────────────────────────────

function sortieId(index: number): string {
  return `SPR-${String(index + 1).padStart(4, '0')}`;
}

// ─── Mobile takedown row ──────────────────────────────────────

const MOBILE_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-white/10 text-white/60',
  requested: 'bg-amber-500/15 text-amber-400',
  submitted: 'bg-afterburner-muted text-afterburner',
  pending_response: 'bg-amber-500/15 text-amber-400',
  taken_down: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  expired: 'bg-white/10 text-white/40',
  withdrawn: 'bg-white/10 text-white/40',
};

function MobileTakedownRow({
  takedown,
  index,
  onTap,
}: {
  takedown: Takedown;
  index: number;
  onTap: () => void;
}) {
  const status = takedown.status;
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex w-full items-center gap-3 border-b border-bulkhead/25 px-4 py-3 text-left"
    >
      {/* Left: sortie ID + brand → domain */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold text-contrail/50">
            {sortieId(index)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[8px] font-mono font-bold uppercase ${MOBILE_STATUS_COLOR[status] ?? 'bg-white/10 text-white/40'}`}
          >
            {STATUS_DISPLAY[status] ?? status}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px]">
          <span className="text-parchment truncate">{takedown.brand_name ?? 'Unknown'}</span>
          <span className="text-contrail/30">&rarr;</span>
          <span className="font-mono text-contrail/60 truncate">{takedown.target_value}</span>
        </div>
      </div>

      {/* Right: time filed */}
      <span className="shrink-0 font-mono text-[9px] text-contrail/40">
        {relativeTime(takedown.created_at)}
      </span>
    </button>
  );
}

// ─── Mobile view ──────────────────────────────────────────────

function TakedownsMobileView() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useAdminTakedowns({ limit: 100 });

  const takedowns = data?.takedowns ?? [];
  const statusCounts = data?.statusCounts ?? [];

  const stats = useMemo(() => {
    const map: Record<string, number> = {};
    statusCounts.forEach((sc) => { map[sc.status] = sc.count; });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    const pending = (map.draft ?? 0) + (map.requested ?? 0);
    const resolved = map.taken_down ?? 0;
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, pending, rate };
  }, [statusCounts]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return takedowns;
    if (statusFilter === 'pending') return takedowns.filter((t) => t.status === 'draft' || t.status === 'requested');
    if (statusFilter === 'submitted') return takedowns.filter((t) => t.status === 'submitted' || t.status === 'pending_response');
    if (statusFilter === 'complete') return takedowns.filter((t) => t.status === 'taken_down');
    return takedowns;
  }, [takedowns, statusFilter]);

  const filterChips = useMemo(
    () => [
      { label: 'All', active: statusFilter === 'all', onClick: () => setStatusFilter('all') },
      { label: 'Pending', active: statusFilter === 'pending', onClick: () => setStatusFilter('pending') },
      { label: 'Submitted', active: statusFilter === 'submitted', onClick: () => setStatusFilter('submitted') },
      { label: 'Complete', active: statusFilter === 'complete', onClick: () => setStatusFilter('complete') },
    ],
    [statusFilter],
  );

  const heroStats = useMemo(
    () => [
      { label: 'TOTAL', value: String(stats.total), color: '#F8F7F5' },
      { label: 'PENDING', value: String(stats.pending), color: '#fbbf24' },
      { label: 'SUCCESS RATE', value: `${stats.rate}%`, color: '#4ade80' },
    ],
    [stats],
  );

  return (
    <div className="fixed inset-0 bg-cockpit flex flex-col">
      <DrillHeader
        title="TAKEDOWNS"
        badge={`${stats.pending} pending`}
        onBack={() => navigate('/v2/')}
      />

      {/* Scrollable hero area */}
      <div className="flex-1 overflow-y-auto pt-[52px] pb-[120px]">
        <div className="p-4 space-y-3">
          <HeroStatGrid stats={heroStats} cols={3} />
        </div>
      </div>

      {/* Bottom sheet with takedown list */}
      <MobileBottomSheet
        peekHeight={110}
        halfHeight={380}
        fullHeight={520}
        defaultState="half"
        headerLeft={
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-parchment">SPARROW DRAFTS</span>
            <span className="text-[9px] font-mono text-contrail/40">{filtered.length} items</span>
          </div>
        }
        headerRight={<MobileFilterChips filters={filterChips} />}
      >
        <div className="flex flex-col">
          {isLoading && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.03]" />
              ))}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-8 text-center">
              <span className="font-mono text-[10px] text-contrail/40 uppercase tracking-wider">
                No takedowns match filter
              </span>
            </div>
          )}
          {!isLoading &&
            filtered.map((td, i) => (
              <MobileTakedownRow
                key={td.id}
                takedown={td}
                index={i}
                onTap={() => navigate(`/v2/takedowns/${td.id}`)}
              />
            ))}
        </div>
      </MobileBottomSheet>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────

function TakedownsDesktop() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Debounce search
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => setDebouncedSearch(val), 300));
  }, [searchTimeout]);

  const { data, isLoading } = useAdminTakedowns({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    target_type: typeFilter !== 'all' ? typeFilter : undefined,
    sort: sortBy,
    search: debouncedSearch || undefined,
    limit: 100,
  });

  const updateTakedown = useUpdateTakedown();
  const { showToast } = useToast();

  const takedowns = data?.takedowns ?? [];
  const statusCounts = data?.statusCounts ?? [];

  // Compute stats from statusCounts (these are global, not filtered)
  const stats = useMemo(() => {
    const map: Record<string, number> = {};
    statusCounts.forEach((sc) => { map[sc.status] = sc.count; });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return {
      total,
      draft: map.draft ?? 0,
      submitted: (map.submitted ?? 0) + (map.pending_response ?? 0),
      resolved: map.taken_down ?? 0,
    };
  }, [statusCounts]);

  // Count per status pill for filter bar badges
  const pillCounts = useMemo(() => {
    const map: Record<string, number> = {};
    statusCounts.forEach((sc) => { map[sc.status] = sc.count; });
    return {
      all: Object.values(map).reduce((a, b) => a + b, 0),
      draft: map.draft ?? 0,
      requested: map.requested ?? 0,
      submitted: (map.submitted ?? 0) + (map.pending_response ?? 0),
      taken_down: map.taken_down ?? 0,
      withdrawn: (map.withdrawn ?? 0) + (map.failed ?? 0) + (map.expired ?? 0),
    };
  }, [statusCounts]);

  const handleUpdate = useCallback((id: string, updates: { status?: string; notes?: string }) => {
    setUpdatingId(id);
    updateTakedown.mutate({ id, ...updates }, {
      onSuccess: () => {
        showToast(updates.status ? 'Status updated' : 'Notes saved', 'success');
        setUpdatingId(null);
      },
      onError: () => {
        showToast('Update failed', 'error');
        setUpdatingId(null);
      },
    });
  }, [updateTakedown, showToast]);

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-parchment">Takedowns</h1>
        <span className="font-mono text-[10px] text-white/30 uppercase tracking-wider">Sparrow Queue</span>
      </div>

      {/* ─── STAT CARDS ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Takedowns" value={stats.total} />
        <StatCard title="Pending Review" value={stats.draft} glowClass="glow-amber" />
        <StatCard title="Submitted" value={stats.submitted} glowClass="glow-afterburner" />
        <StatCard title="Resolved" value={stats.resolved} glowClass="glow-green" />
      </div>

      {/* ─── FILTER BAR ──────────────────────────────── */}
      <div className="glass-card rounded-xl p-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Left: status pills + type pills */}
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_PILLS.map((pill) => (
              <button
                key={pill.key}
                className={`${statusFilter === pill.key ? 'glass-btn-active' : 'glass-btn'} rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider`}
                onClick={() => setStatusFilter(pill.key)}
              >
                {pill.label}
                {pillCounts[pill.key as keyof typeof pillCounts] != null && (
                  <span className="ml-1.5 text-white/30">{pillCounts[pill.key as keyof typeof pillCounts]}</span>
                )}
              </button>
            ))}
            <span className="w-px h-5 bg-white/10 mx-1" />
            {TYPE_PILLS.map((pill) => (
              <button
                key={pill.key}
                className={`${typeFilter === pill.key ? 'glass-btn-active' : 'glass-btn'} rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider`}
                onClick={() => setTypeFilter(pill.key)}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Right: sort + search */}
          <div className="flex items-center gap-2">
            <select
              className="glass-input rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider bg-transparent"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key} className="bg-cockpit text-parchment">{o.label}</option>
              ))}
            </select>
            <input
              type="text"
              className="glass-input rounded-md px-3 py-1.5 font-mono text-[11px] w-56"
              placeholder="Search by brand, handle, or URL..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ─── LOADING STATE ───────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse h-48" />
          ))}
        </div>
      )}

      {/* ─── CARD GRID ───────────────────────────────── */}
      {!isLoading && takedowns.length > 0 && (
        <div className={expandedId ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-2 gap-4'}>
          {takedowns.map((td) => (
            <TakedownCard
              key={td.id}
              takedown={td}
              isExpanded={expandedId === td.id}
              onToggle={() => setExpandedId(expandedId === td.id ? null : td.id)}
              onUpdate={handleUpdate}
              updatingId={updatingId}
            />
          ))}
        </div>
      )}

      {/* ─── EMPTY STATE ─────────────────────────────── */}
      {!isLoading && takedowns.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="font-mono text-[11px] text-white/30 uppercase tracking-wider">
            No takedowns match the current filters
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Exported wrapper (mobile vs desktop) ─────────────────────

export function Takedowns() {
  const isMobile = useMobile();
  if (isMobile) return <TakedownsMobileView />;
  return <TakedownsDesktop />;
}
