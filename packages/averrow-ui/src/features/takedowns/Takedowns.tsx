import { useState, useMemo, useCallback } from 'react';
import { useAdminTakedowns, useTakedownEvidence, useUpdateTakedown } from '@/hooks/useTakedowns';
import type { Takedown, TakedownEvidence } from '@/hooks/useTakedowns';
import { useToast } from '@/components/ui/Toast';
import { relativeTime } from '@/lib/time';
import { Shield } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Card,
  StatCard,
  StatGrid,
  FilterBar,
  PageHeader,
  Badge,
  Button,
} from '@/design-system/components';
import type { BadgeStatus, Severity } from '@/design-system/components';

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

const STATUS_TO_BADGE: Record<string, BadgeStatus> = {
  draft: 'draft',
  requested: 'pending',
  submitted: 'running',
  pending_response: 'warning',
  taken_down: 'success',
  failed: 'failed',
  expired: 'inactive',
  withdrawn: 'inactive',
};

const SEVERITY_TO_BADGE: Record<string, Severity> = {
  HIGH: 'critical',
  MEDIUM: 'high',
  LOW: 'low',
  CRITICAL: 'critical',
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

// ─── Evidence panel (expanded detail) ──────────────────────────

function EvidencePanel({ takedownId }: { takedownId: string }) {
  const { data: evidence, isLoading } = useTakedownEvidence(takedownId);
  if (isLoading) return <div className="animate-pulse h-16 rounded-lg bg-white/[0.03]" />;
  if (!evidence?.length) return <p className="text-[11px] text-white/30 font-mono">No evidence artifacts.</p>;
  return (
    <div className="space-y-2">
      {evidence.map((e: TakedownEvidence) => (
        <Card key={e.id} style={{ padding: '12px' }}>
          <div className="flex items-center gap-2 mb-1">
            <Badge label={e.evidence_type.replace(/_/g, ' ')} />
            <span className="font-mono text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{e.title}</span>
          </div>
          {e.content_text && (
            <p className="text-[11px] text-white/50 line-clamp-4">{e.content_text}</p>
          )}
        </Card>
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
              <Badge label={takedown.target_type.replace(/_/g, ' ')} />
            </DetailRow>
            <DetailRow label="Platform">
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>
                {takedown.target_platform ?? '\u2014'}
              </span>
            </DetailRow>
            <DetailRow label="Handle / URL">
              <span className="font-mono text-[11px] break-all select-all" style={{ color: 'var(--text-primary)' }}>
                {takedown.target_value}
              </span>
            </DetailRow>
            {takedown.target_url && (
              <DetailRow label="Full URL">
                <span className="font-mono text-[11px] break-all select-all" style={{ color: 'var(--amber)' }}>
                  {takedown.target_url}
                </span>
              </DetailRow>
            )}
            <DetailRow label="Brand">
              <span className="text-[11px]" style={{ color: 'var(--text-primary)' }}>{takedown.brand_name ?? '\u2014'}</span>
            </DetailRow>
            <DetailRow label="Source">
              <span className="text-white/50 font-mono text-[11px]">
                {takedown.source_type ? 'Sparrow AI' : 'Manual'}
              </span>
            </DetailRow>
            <DetailRow label="Severity">
              <Badge severity={SEVERITY_TO_BADGE[takedown.severity] ?? 'low'} label={takedown.severity} />
            </DetailRow>
            <DetailRow label="Priority">
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>{takedown.priority_score}/100</span>
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
            <Card style={{ padding: '12px' }}>
              <p className="text-[12px] text-[rgba(255,255,255,0.74)] leading-relaxed">{takedown.evidence_summary}</p>
            </Card>
          )}
          {takedown.evidence_detail && (
            <Card style={{ padding: '12px' }}>
              <p className="text-[11px] text-white/50 whitespace-pre-line">{takedown.evidence_detail}</p>
            </Card>
          )}
          <EvidencePanel takedownId={takedown.id} />
          {takedown.provider_abuse_contact && takedown.provider_method === 'form' && (
            <a
              href={takedown.provider_abuse_contact}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-base)',
                background: 'transparent',
                color: 'var(--amber)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Submit Form &rarr;
            </a>
          )}
          {takedown.provider_abuse_contact && takedown.provider_method === 'email' && (
            <a
              href={`mailto:${takedown.provider_abuse_contact}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-base)',
                background: 'transparent',
                color: 'var(--amber)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
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
          <hr style={{ border: 'none', height: 1, background: 'linear-gradient(90deg, transparent, rgba(229,168,50,0.2), transparent)', margin: '12px 0' }} />
          <div className="section-label">NOTES</div>
          <textarea
            className="w-full rounded-md px-3 py-2 font-mono text-[11px] h-24 resize-none"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-base)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            placeholder="Add notes..."
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdate(takedown.id, { notes: localNotes })}
            disabled={isUpdating}
          >
            Save Notes
          </Button>
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
  const btn = (label: string, status: string, variant: 'primary' | 'ghost' | 'success' = 'primary') => (
    <Button
      variant={variant}
      size="sm"
      onClick={() => onUpdate(takedown.id, { status })}
      disabled={isUpdating}
    >
      {label}
    </Button>
  );

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
    <Badge status="success" label="RESOLVED" />
  );
  return (
    <Badge status={STATUS_TO_BADGE[s] ?? 'draft'} label={STATUS_DISPLAY[s] ?? s} />
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
  const cardVariant: 'critical' | 'active' | 'base' =
    sev === 'HIGH' || sev === 'CRITICAL' ? 'critical'
      : sev === 'MEDIUM' ? 'active'
      : 'base';

  return (
    <Card variant={cardVariant} style={{ padding: '16px', cursor: 'pointer' }}>
      <div onClick={onToggle}>
        {/* Row 1: platform icon + handle + status badge */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <PlatformBadge platform={takedown.target_platform} />
            <span className="font-mono text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {takedown.target_value}
            </span>
          </div>
          <Badge
            status={STATUS_TO_BADGE[takedown.status] ?? 'draft'}
            label={STATUS_DISPLAY[takedown.status] ?? takedown.status}
          />
        </div>

        {/* Row 2: brand + platform + severity */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-[11px]">
            {takedown.brand_name && (
              <span className="text-[rgba(255,255,255,0.64)]">{takedown.brand_name}</span>
            )}
            {takedown.target_platform && (
              <>
                <span className="text-white/40">&middot;</span>
                <span className="text-white/40 font-mono">{takedown.target_platform}</span>
              </>
            )}
          </div>
          <Badge severity={SEVERITY_TO_BADGE[sev] ?? 'low'} label={sev} />
        </div>

        {/* Row 3: evidence summary */}
        <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2 mb-3">
          {takedown.evidence_summary}
        </p>

        <hr style={{ border: 'none', height: 1, background: 'linear-gradient(90deg, transparent, rgba(229,168,50,0.2), transparent)', margin: '12px 0' }} />

        {/* Row 4: priority bar + method + date */}
        <div className="space-y-1.5 mb-3">
          <PriorityBar score={takedown.priority_score} />
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/40 font-mono">
              Method: {takedown.provider_method ?? 'unknown'}
            </span>
            <span className="text-white/50 font-mono">{relativeTime(takedown.created_at)}</span>
          </div>
        </div>

        <hr style={{ border: 'none', height: 1, background: 'linear-gradient(90deg, transparent, rgba(229,168,50,0.2), transparent)', margin: '12px 0' }} />

        {/* Row 5: action buttons */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {isExpanded ? 'Close' : 'Review \u2192'}
          </Button>
          {takedown.status === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(takedown.id, { status: 'withdrawn' });
              }}
            >
              Dismiss
            </Button>
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
    </Card>
  );
}


// ─── Main page ─────────────────────────────────────────────────

export function Takedowns() {
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
      {/* Page header */}
      <PageHeader
        title="Takedowns"
        subtitle={`${stats.total} total requests`}
        meta={<span className="font-mono text-[10px] text-white/50 uppercase tracking-wider">Sparrow Queue</span>}
      />

      {/* ─── STAT CARDS ──────────────────────────────── */}
      <StatGrid cols={4}>
        <StatCard label="Total Takedowns" value={stats.total}     accentColor="var(--amber)" />
        <StatCard label="Pending Review"  value={stats.draft}     accentColor="var(--sev-high)" />
        <StatCard label="Submitted"       value={stats.submitted} accentColor="var(--blue)" />
        <StatCard label="Resolved"        value={stats.resolved}  accentColor="var(--green)" />
      </StatGrid>

      {/* ─── FILTER BAR ──────────────────────────────── */}
      <FilterBar
        filters={STATUS_PILLS.map(p => ({
          value: p.key,
          label: p.label,
          count: pillCounts[p.key as keyof typeof pillCounts],
        }))}
        active={statusFilter}
        onChange={setStatusFilter}
        search={{ value: search, onChange: handleSearch, placeholder: 'Search by brand, handle, or URL...' }}
        actions={
          <select
            className="rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-base)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key} style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>{o.label}</option>
            ))}
          </select>
        }
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TYPE_PILLS.map((pill) => (
            <Button
              key={pill.key}
              variant={typeFilter === pill.key ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter(pill.key)}
            >
              {pill.label}
            </Button>
          ))}
        </div>
      </FilterBar>

      {/* ─── LOADING STATE ───────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} style={{ padding: '16px', height: 192 }} className="animate-pulse"><div /></Card>
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
        <EmptyState
          icon={<Shield />}
          title="No takedown requests"
          subtitle="Create a takedown request from any identified threat to begin the removal process"
          variant="clean"
        />
      )}
    </div>
  );
}

