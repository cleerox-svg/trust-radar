import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { StatCard, Card, StatGrid, FilterBar, PageHeader, DataRow } from '@/components/ui';
import { Badge } from '@/components/ui/Badge';
import type { Severity } from '@/components/ui/Badge';
import { Sparkline } from '@/features/brands/components/Sparkline';
import {
  useAlerts, useAlertStats, useUpdateAlert, useBulkAcknowledge, useBulkTakedown,
  type Alert, type AlertFilters,
} from '@/hooks/useAlerts';
import { useMobile, DrillHeader, MobileBottomSheet, HeroStatGrid, MobileFilterChips } from '@/components/mobile';
import { Bell } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

// ── Helpers ─────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function extractScore(summary: string): number | null {
  const m = summary.match(/(\d+)%/);
  return m ? parseInt(m[1], 10) : null;
}

function extractHandle(title: string): string {
  const m = title.match(/@[\w.]+/);
  return m ? m[0] : title;
}

function extractPlatform(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('tiktok')) return 'TikTok';
  if (lower.includes('youtube')) return 'YouTube';
  if (lower.includes('github')) return 'GitHub';
  if (lower.includes('linkedin')) return 'LinkedIn';
  if (lower.includes('twitter') || lower.includes(' x ')) return 'X';
  if (lower.includes('instagram')) return 'Instagram';
  if (lower.includes('facebook')) return 'Facebook';
  return 'Social';
}

const platformColors: Record<string, string> = {
  TikTok: 'bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30',
  YouTube: 'bg-red-500/15 text-red-400 border-red-500/30',
  GitHub: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  LinkedIn: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  X: 'bg-white/10 text-white/80 border-white/20',
  Instagram: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  Facebook: 'bg-blue-600/15 text-blue-400 border-blue-600/30',
  Social: 'bg-contrail/10 text-[rgba(255,255,255,0.60)] border-contrail/20',
};

const severityBadgeMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

// ── Filter Pills ────────────────────────────────────────────────

interface PillGroupProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string;
  onChange: (v: string) => void;
}

function PillGroup({ label, options, selected, onChange }: PillGroupProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-white/55 mr-1">{label}</span>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'font-mono text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md border transition-all',
            selected === o.value
              ? 'bg-afterburner-muted text-[#E5A832] border-afterburner-border'
              : 'bg-white/[0.03] text-[rgba(255,255,255,0.30)] border-white/[0.06] hover:border-white/15 hover:text-[rgba(255,255,255,0.42)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Brand Group ─────────────────────────────────────────────────

interface BrandGroup {
  brand_id: string;
  brand_name: string | null;
  brand_domain: string | null;
  alerts: Alert[];
}

function groupByBrand(alerts: Alert[]): BrandGroup[] {
  const map = new Map<string, BrandGroup>();
  for (const a of alerts) {
    const key = a.brand_id || 'unknown';
    if (!map.has(key)) {
      map.set(key, { brand_id: key, brand_name: a.brand_name, brand_domain: a.brand_domain, alerts: [] });
    }
    map.get(key)!.alerts.push(a);
  }
  return Array.from(map.values()).sort((a, b) => b.alerts.length - a.alerts.length);
}

interface BrandGroupCardProps {
  group: BrandGroup;
  selectedAlertId: string | null;
  onSelectAlert: (a: Alert) => void;
  onAcknowledgeAll: () => void;
  onCreateTakedowns: () => void;
  isAcknowledging: boolean;
  isCreatingTakedowns: boolean;
}

function BrandGroupCard({
  group, selectedAlertId, onSelectAlert,
  onAcknowledgeAll, onCreateTakedowns,
  isAcknowledging, isCreatingTakedowns,
}: BrandGroupCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const visibleAlerts = showAll ? group.alerts : group.alerts.slice(0, 5);
  const remaining = group.alerts.length - 5;
  const newCount = group.alerts.filter(a => a.status === 'new').length;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <img
          src={`https://www.google.com/s2/favicons?domain=${group.brand_domain ?? 'example.com'}&sz=32`}
          alt=""
          className="w-5 h-5 rounded-sm"
        />
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
              {group.brand_name ?? 'Unknown Brand'}
            </span>
            <Badge variant="critical">{group.alerts.length} alerts</Badge>
          </div>
          <div className="font-mono text-[10px] text-white/40">{group.brand_domain ?? ''}</div>
        </div>
        <svg
          className={cn('w-4 h-4 text-white/50 transition-transform', expanded && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <>
          {/* Alert rows */}
          <div className="border-t border-white/[0.06]">
            {visibleAlerts.map(alert => {
              const score = extractScore(alert.summary);
              const handle = extractHandle(alert.title);
              const platform = extractPlatform(alert.title);
              const isSelected = selectedAlertId === alert.id;

              const sev = (severityBadgeMap[alert.severity] ?? 'low') as Severity;
              return (
                <DataRow
                  key={alert.id}
                  severity={sev}
                  unread={alert.status === 'new'}
                  onClick={() => onSelectAlert(alert)}
                  className={cn('flex items-center gap-3', isSelected && 'bg-afterburner-muted')}
                >
                  {/* Severity dot */}
                  <span className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    alert.severity === 'CRITICAL' && 'bg-[#f87171] dot-pulse-red',
                    alert.severity === 'HIGH' && 'bg-[#fb923c] dot-pulse-amber',
                    alert.severity === 'MEDIUM' && 'bg-[#fbbf24]',
                    alert.severity === 'LOW' && 'bg-contrail',
                  )} />

                  {/* Handle + platform */}
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{handle}</span>
                    <span className="font-mono text-[10px] text-white/40 ml-1.5">on</span>
                    <span className={cn(
                      'ml-1.5 inline-flex items-center font-mono text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border',
                      platformColors[platform] ?? platformColors.Social,
                    )}>
                      {platform}
                    </span>
                  </div>

                  {/* Score */}
                  {score !== null && (
                    <span className={cn(
                      'font-mono text-[12px] font-bold tabular-nums',
                      score >= 75 ? 'text-[#fb923c]' : 'text-[rgba(255,255,255,0.36)]',
                    )}>
                      {score}%
                    </span>
                  )}

                  {/* Severity badge */}
                  <Badge variant={severityBadgeMap[alert.severity] ?? 'low'}>{alert.severity}</Badge>

                  {/* Status */}
                  <span className={cn(
                    'font-mono text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded',
                    alert.status === 'new' && 'bg-[#fb923c]/15 text-[#fb923c]',
                    alert.status === 'acknowledged' && 'bg-afterburner-muted text-[#E5A832]',
                    alert.status === 'resolved' && 'bg-[#4ade80]/15 text-[#4ade80]',
                    alert.status === 'false_positive' && 'bg-white/5 text-white/40',
                  )}>
                    {alert.status === 'false_positive' ? 'dismissed' : alert.status}
                  </span>

                  {/* Time */}
                  <span className="font-mono text-[10px] text-white/50 tabular-nums w-14 text-right flex-shrink-0">
                    {timeAgo(alert.created_at)}
                  </span>
                </DataRow>
              );
            })}
          </div>

          {/* Show more + actions */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              {remaining > 0 && !showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  className="font-mono text-[10px] font-semibold hover:text-[#D49A28] transition-colors" style={{ color: 'var(--amber)' }}
                >
                  + {remaining} more
                </button>
              )}
              {showAll && remaining > 0 && (
                <button
                  onClick={() => setShowAll(false)}
                  className="font-mono text-[10px] font-semibold text-[rgba(255,255,255,0.30)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Show less
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {newCount > 0 && (
                <button
                  onClick={onAcknowledgeAll}
                  disabled={isAcknowledging}
                  className="font-mono text-[10px] font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border border-afterburner-border text-[#E5A832] hover:bg-afterburner-muted transition-all disabled:opacity-50"
                >
                  {isAcknowledging ? 'Acknowledging...' : 'Acknowledge All'}
                </button>
              )}
              <button
                onClick={onCreateTakedowns}
                disabled={isCreatingTakedowns}
                className="font-mono text-[10px] font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md bg-accent hover:bg-accent/80 transition-all disabled:opacity-50" style={{ color: 'var(--text-primary)' }}
              >
                {isCreatingTakedowns ? 'Creating...' : 'Create Takedowns'}
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ── Alert Detail Panel ──────────────────────────────────────────

interface AlertDetailProps {
  alert: Alert;
  onClose: () => void;
  onUpdate: (status: string, notes?: string) => void;
  isUpdating: boolean;
}

function AlertDetail({ alert, onClose, onUpdate, isUpdating }: AlertDetailProps) {
  const [notes, setNotes] = useState(alert.resolution_notes ?? '');
  const score = extractScore(alert.summary);
  const handle = extractHandle(alert.title);
  const platform = extractPlatform(alert.title);

  return (
    <Card variant="active" style={{ padding: '20px', marginTop: 4 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant={severityBadgeMap[alert.severity] ?? 'low'}>{alert.severity}</Badge>
          <span className={cn(
            'font-mono text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded',
            alert.status === 'new' && 'bg-[#fb923c]/15 text-[#fb923c]',
            alert.status === 'acknowledged' && 'bg-afterburner-muted text-[#E5A832]',
            alert.status === 'resolved' && 'bg-[#4ade80]/15 text-[#4ade80]',
            alert.status === 'false_positive' && 'bg-white/5 text-white/40',
          )}>
            {alert.status === 'false_positive' ? 'dismissed' : alert.status}
          </span>
          <span className="badge-glass badge-nexus font-mono text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border">
            Social Impersonation
          </span>
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-[var(--text-primary)] transition-colors p-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* LEFT — Alert Details */}
        <div className="space-y-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[rgba(255,255,255,0.30)] mb-2">Alert Details</div>

          <div className="flex items-center gap-2">
            <img
              src={`https://www.google.com/s2/favicons?domain=${alert.brand_domain ?? 'example.com'}&sz=32`}
              alt=""
              className="w-4 h-4 rounded-sm"
            />
            <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{alert.brand_name ?? 'Unknown'}</span>
            <span className="font-mono text-[10px] text-white/40">{alert.brand_domain ?? ''}</span>
          </div>

          <div>
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Platform</div>
            <span className={cn(
              'inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border',
              platformColors[platform] ?? platformColors.Social,
            )}>
              {platform}
            </span>
          </div>

          <div>
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Handle Detected</div>
            <span className="font-mono text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{handle}</span>
          </div>

          {score !== null && (
            <div>
              <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-1">Impersonation Score</div>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-display text-[28px] font-extrabold tabular-nums leading-none"
                  style={score >= 75
                    ? { color: '#fb923c', textShadow: '0 0 20px rgba(251,146,60,0.7)' }
                    : { color: 'var(--text-secondary)' }}
                >
                  {score}%
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Detected</div>
            <span className="font-mono text-[11px] text-[rgba(255,255,255,0.64)]">{timeAgo(alert.created_at)}</span>
          </div>

          <div>
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-0.5">Source</div>
            <span className="font-mono text-[11px] text-[rgba(255,255,255,0.36)]">Social Monitor Agent</span>
          </div>
        </div>

        {/* CENTER — Evidence & Assessment */}
        <div className="space-y-3 border-l border-white/[0.06] pl-5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[rgba(255,255,255,0.30)] mb-2">Evidence & Assessment</div>

          <div>
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-1">Summary</div>
            <p className="text-[12px] text-[rgba(255,255,255,0.74)] leading-relaxed">{alert.summary}</p>
          </div>

          {score !== null && (
            <div>
              <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-1">Score</div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${score}%`,
                    backgroundColor: score >= 75 ? '#fb923c' : score >= 50 ? '#fbbf24' : '#78A0C8',
                  }}
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-1">AI Assessment</div>
            {alert.ai_assessment ? (
              <div className="space-y-2">
                <p className="text-[12px] text-[rgba(255,255,255,0.74)] leading-relaxed">{alert.ai_assessment}</p>
                {alert.ai_recommendations && (
                  <div>
                    <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-1">Recommendations</div>
                    <p className="text-[12px] text-[rgba(255,255,255,0.42)] leading-relaxed">{alert.ai_recommendations}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-white/50 italic">No AI assessment yet</div>
            )}
          </div>
        </div>

        {/* RIGHT — Actions */}
        <div className="space-y-3 border-l border-white/[0.06] pl-5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[rgba(255,255,255,0.30)] mb-2">Actions</div>

          <div className="flex flex-col gap-2">
            {alert.status === 'new' && (
              <>
                <button
                  onClick={() => onUpdate('acknowledged')}
                  disabled={isUpdating}
                  className="w-full font-mono text-[10px] font-semibold uppercase tracking-wide px-3 py-2 rounded-md border border-afterburner-border text-[#E5A832] hover:bg-afterburner-muted transition-all disabled:opacity-50"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => onUpdate('false_positive')}
                  disabled={isUpdating}
                  className="w-full font-mono text-[10px] font-semibold uppercase tracking-wide px-3 py-2 rounded-md border border-white/10 text-[rgba(255,255,255,0.36)] hover:bg-white/[0.04] transition-all disabled:opacity-50"
                >
                  Dismiss
                </button>
              </>
            )}
            {alert.status === 'acknowledged' && (
              <>
                <button
                  onClick={() => onUpdate('resolved')}
                  disabled={isUpdating}
                  className="w-full font-mono text-[10px] font-semibold uppercase tracking-wide px-3 py-2 rounded-md bg-[#28A050] text-white hover:bg-[#28A050]/80 transition-all disabled:opacity-50"
                >
                  Mark Resolved
                </button>
                <button
                  onClick={() => onUpdate('new')}
                  disabled={isUpdating}
                  className="w-full font-mono text-[10px] font-semibold uppercase tracking-wide px-3 py-2 rounded-md border border-white/10 text-[rgba(255,255,255,0.36)] hover:bg-white/[0.04] transition-all disabled:opacity-50"
                >
                  Re-open
                </button>
              </>
            )}
            {alert.status === 'resolved' && (
              <button
                onClick={() => onUpdate('new')}
                disabled={isUpdating}
                className="w-full font-mono text-[10px] font-semibold uppercase tracking-wide px-3 py-2 rounded-md border border-white/10 text-[rgba(255,255,255,0.36)] hover:bg-white/[0.04] transition-all disabled:opacity-50"
              >
                Re-open
              </button>
            )}
            {alert.status === 'false_positive' && (
              <button
                onClick={() => onUpdate('new')}
                disabled={isUpdating}
                className="w-full font-mono text-[10px] font-semibold uppercase tracking-wide px-3 py-2 rounded-md border border-white/10 text-[rgba(255,255,255,0.36)] hover:bg-white/[0.04] transition-all disabled:opacity-50"
              >
                Re-open
              </button>
            )}
          </div>

          {/* Notes */}
          <div className="pt-2">
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-1">Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className="w-full rounded-md bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-[11px] placeholder:text-white/30 focus:outline-none focus:border-afterburner-border resize-none font-mono" style={{ color: 'var(--text-primary)' }}
            />
            {notes !== (alert.resolution_notes ?? '') && (
              <button
                onClick={() => onUpdate(alert.status, notes)}
                disabled={isUpdating}
                className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md bg-afterburner-muted text-[#E5A832] border border-afterburner-border hover:bg-afterburner-muted transition-all disabled:opacity-50"
              >
                Save Notes
              </button>
            )}
          </div>

          {/* Resolution notes */}
          {alert.status === 'resolved' && alert.resolution_notes && (
            <div className="pt-2">
              <div className="font-mono text-[9px] text-white/40 uppercase tracking-wide mb-1">Resolution Notes</div>
              <p className="text-[11px] text-[rgba(255,255,255,0.64)] leading-relaxed">{alert.resolution_notes}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Mobile Alert Row ───────────────────────────────────────────

function MobileAlertRow({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false);
  const handle = extractHandle(alert.title);
  const severityDotColor: Record<string, string> = {
    CRITICAL: '#f87171',
    HIGH: '#fb923c',
    MEDIUM: '#fbbf24',
    LOW: '#78A0C8',
  };
  const dotColor = severityDotColor[alert.severity] ?? '#78A0C8';
  const severityPillClass: Record<string, string> = {
    CRITICAL: 'text-[#f87171] bg-[#f87171]/10',
    HIGH: 'text-[#fb923c] bg-[#fb923c]/10',
    MEDIUM: 'text-[#fbbf24] bg-[#fbbf24]/10',
    LOW: 'text-[rgba(255,255,255,0.60)] bg-contrail/10',
  };

  return (
    <button
      type="button"
      onClick={() => setExpanded(prev => !prev)}
      className="w-full text-left border-b border-bulkhead/20 px-4 py-3"
    >
      <div className="flex items-center gap-2.5">
        {/* Severity dot with glow */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{
            backgroundColor: dotColor,
            boxShadow: `0 0 6px ${dotColor}60`,
          }}
        />

        {/* Severity badge pill */}
        <span className={cn(
          'font-mono text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
          severityPillClass[alert.severity] ?? severityPillClass.LOW,
        )}>
          {alert.severity}
        </span>

        {/* Brand name */}
        <span className="flex-1 font-mono text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {alert.brand_name ?? handle}
        </span>

        {/* Time ago */}
        <span className="font-mono text-[9px] text-white/50 tabular-nums flex-shrink-0">
          {timeAgo(alert.created_at)}
        </span>
      </div>

      {/* Message text */}
      <div className="mt-1 ml-5 font-mono text-[10px] text-[rgba(255,255,255,0.30)] leading-relaxed truncate">
        {alert.summary}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-2 ml-5 space-y-1.5 border-l-2 border-bulkhead/40 pl-3">
          <div className="font-mono text-[9px] text-white/55 uppercase tracking-wide">Handle</div>
          <div className="font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>{handle}</div>
          {alert.ai_assessment && (
            <>
              <div className="font-mono text-[9px] text-white/55 uppercase tracking-wide mt-1.5">AI Assessment</div>
              <div className="font-mono text-[10px] text-[rgba(255,255,255,0.36)] leading-relaxed">{alert.ai_assessment}</div>
            </>
          )}
        </div>
      )}
    </button>
  );
}

// ── Mobile Alerts Layout ───────────────────────────────────────

type SeverityFilter = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM';

function MobileAlertsLayout({
  alerts,
  stats,
  statsLoading,
}: {
  alerts: Alert[];
  stats: { total: number; new_count: number; critical: number; high: number; medium: number } | undefined;
  statsLoading: boolean;
}) {
  const navigate = useNavigate();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const activeCount = stats ? stats.new_count : 0;

  // Severity breakdown hero stats
  const heroStats = useMemo(() => [
    {
      label: 'CRITICAL',
      value: statsLoading ? '...' : String(stats?.critical ?? 0),
      color: '#f87171',
    },
    {
      label: 'HIGH',
      value: statsLoading ? '...' : String(stats?.high ?? 0),
      color: '#fb923c',
    },
    {
      label: 'MEDIUM',
      value: statsLoading ? '...' : String(stats?.medium ?? 0),
      color: '#fbbf24',
    },
  ], [stats, statsLoading]);

  // 24h trend calculation
  const now = Date.now();
  const alerts24h = useMemo(() =>
    alerts.filter(a => now - new Date(a.created_at).getTime() < 86_400_000),
  [alerts, now]);
  const alertsYesterday = useMemo(() =>
    alerts.filter(a => {
      const age = now - new Date(a.created_at).getTime();
      return age >= 86_400_000 && age < 172_800_000;
    }),
  [alerts, now]);
  const pctChange = alertsYesterday.length > 0
    ? Math.round(((alerts24h.length - alertsYesterday.length) / alertsYesterday.length) * 100)
    : 0;

  // Generate sparkline data (7 buckets across 24h)
  const sparklineData = useMemo(() => {
    const buckets = Array(7).fill(0) as number[];
    const bucketSize = 86_400_000 / 7;
    for (const a of alerts24h) {
      const age = now - new Date(a.created_at).getTime();
      const idx = Math.min(6, Math.floor((86_400_000 - age) / bucketSize));
      buckets[idx]++;
    }
    return buckets;
  }, [alerts24h, now]);

  // Filter alerts by severity for the bottom sheet
  const filteredAlerts = useMemo(() => {
    if (severityFilter === 'all') return alerts;
    return alerts.filter(a => a.severity === severityFilter);
  }, [alerts, severityFilter]);

  const filterChips = useMemo(() => [
    { label: 'All', active: severityFilter === 'all', onClick: () => setSeverityFilter('all') },
    { label: 'Critical', active: severityFilter === 'CRITICAL', onClick: () => setSeverityFilter('CRITICAL') },
    { label: 'High', active: severityFilter === 'HIGH', onClick: () => setSeverityFilter('HIGH') },
    { label: 'Medium', active: severityFilter === 'MEDIUM', onClick: () => setSeverityFilter('MEDIUM') },
  ], [severityFilter]);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--bg-page)' }}>
      {/* DrillHeader */}
      <DrillHeader
        title="ALERTS"
        badge={`${activeCount} active`}
        onBack={() => navigate('/v2/')}
      />

      {/* Scrollable hero area */}
      <div className="flex-1 overflow-y-auto pt-[52px] pb-[120px]">
        <div className="p-4 space-y-3">
          {/* 3-col severity breakdown */}
          <HeroStatGrid stats={heroStats} cols={3} />

          {/* 24h trend card */}
          <div className="rounded-[10px] border border-bulkhead/40 bg-instrument p-3">
            <span className="text-[8px] font-mono uppercase tracking-widest text-white/55">
              LAST 24 HOURS
            </span>
            <div className="mt-1.5 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>
                  {alerts24h.length}
                </span>
                {pctChange !== 0 && (
                  <span className={cn(
                    'font-mono text-[10px] font-bold',
                    pctChange > 0 ? 'text-[#f87171]' : 'text-[#4ade80]',
                  )}>
                    {pctChange > 0 ? '▲' : '▼'} {Math.abs(pctChange)}%
                  </span>
                )}
              </div>
              <Sparkline data={sparklineData} width={80} height={24} color="#fb923c" />
            </div>
            <span className="mt-0.5 block text-[9px] text-white/55">vs yesterday</span>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <MobileBottomSheet
        peekHeight={110}
        halfHeight={340}
        fullHeight={500}
        defaultState="half"
        headerLeft={
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono font-bold tracking-wider" style={{ color: 'var(--text-primary)' }}>ALL ALERTS</span>
            <span className="text-[9px] font-mono text-white/55">{filteredAlerts.length}</span>
          </div>
        }
        headerRight={<MobileFilterChips filters={filterChips} />}
      >
        <div className="flex flex-col">
          {filteredAlerts.map(alert => (
            <MobileAlertRow key={alert.id} alert={alert} />
          ))}
          {filteredAlerts.length === 0 && (
            <EmptyState
              icon={<Bell />}
              title="No pending alerts"
              subtitle="All alerts have been acknowledged. You're up to date."
              variant="clean"
              compact
            />
          )}
        </div>
      </MobileBottomSheet>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export function Alerts() {
  const isMobile = useMobile();
  const [filters, setFilters] = useState<AlertFilters>({ limit: 200 });
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [search, setSearch] = useState('');

  const { data: statsData, isLoading: statsLoading } = useAlertStats();
  const { data: alertsData, isLoading: alertsLoading } = useAlerts({
    ...filters,
    search: search || undefined,
  });

  const updateAlert = useUpdateAlert();
  const bulkAck = useBulkAcknowledge();
  const bulkTakedown = useBulkTakedown();

  const alerts = Array.isArray(alertsData?.alerts) ? alertsData.alerts : [];
  const stats = statsData && typeof statsData.total === 'number' ? statsData : undefined;

  const groups = useMemo(() => groupByBrand(alerts), [alerts]);

  const setFilter = (key: keyof AlertFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value === 'all' ? undefined : value }));
    setSelectedAlert(null);
  };

  /* ─── Mobile layout ─── */
  if (isMobile) {
    return (
      <MobileAlertsLayout
        alerts={alerts}
        stats={stats}
        statsLoading={statsLoading}
      />
    );
  }

  /* ─── Desktop layout (unchanged) ─── */
  return (
    <div className="space-y-5">
      <PageHeader title="Alerts" subtitle="Active contacts requiring attention" />

      <StatGrid cols={4}>
        <StatCard
          label="Total Alerts"
          value={statsLoading ? '...' : (stats?.total ?? 0)}
          accentColor="var(--red)"
        />
        <StatCard
          label="New / Unacknowledged"
          value={statsLoading ? '...' : (stats?.new_count ?? 0)}
          accentColor="var(--sev-high)"
        />
        <StatCard
          label="Acknowledged"
          value={statsLoading ? '...' : (stats?.acknowledged ?? 0)}
          accentColor="var(--amber)"
        />
        <StatCard
          label="Resolved"
          value={statsLoading ? '...' : (stats?.resolved ?? 0)}
          accentColor="var(--green)"
        />
      </StatGrid>

      {stats && stats.new_count > 0 && (
        <Card variant="critical" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="w-2.5 h-2.5 rounded-full dot-pulse-red flex-shrink-0" style={{ background: 'var(--sev-critical)' }} />
          <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {stats.new_count} unacknowledged {stats.high > 0 ? 'HIGH' : ''} severity alert{stats.new_count !== 1 ? 's' : ''} require review
          </span>
        </Card>
      )}

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search alerts...' }}
        filters={[
          { value: 'all',      label: 'All',      count: stats?.total },
          { value: 'CRITICAL', label: 'Critical', count: stats?.critical },
          { value: 'HIGH',     label: 'High',     count: stats?.high },
          { value: 'MEDIUM',   label: 'Medium',   count: stats?.medium },
        ]}
        active={filters.severity ?? 'all'}
        onChange={v => setFilter('severity', v)}
      >
        <div className="flex flex-wrap items-center gap-4">
          <PillGroup
            label="Status"
            options={[
              { value: 'all', label: 'All' },
              { value: 'new', label: 'New' },
              { value: 'acknowledged', label: 'Ack' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'false_positive', label: 'Dismissed' },
            ]}
            selected={filters.status ?? 'all'}
            onChange={v => setFilter('status', v)}
          />
          <PillGroup
            label="Type"
            options={[
              { value: 'all', label: 'All' },
              { value: 'social_impersonation', label: 'Social' },
              { value: 'phishing_detected', label: 'Phishing' },
              { value: 'lookalike_domain_active', label: 'Lookalike' },
              { value: 'bimi_removed', label: 'BIMI Removed' },
              { value: 'dmarc_downgraded', label: 'DMARC Downgraded' },
              { value: 'vmc_expiring', label: 'VMC Expiring' },
              { value: 'typosquat_bimi', label: 'BIMI Spoofing' },
            ]}
            selected={filters.alert_type ?? 'all'}
            onChange={v => setFilter('alert_type', v)}
          />
        </div>
      </FilterBar>

      {/* Loading */}
      {alertsLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-afterburner-border border-t-afterburner rounded-full animate-spin" />
        </div>
      )}

      {/* Grouped alert list */}
      {!alertsLoading && (
        <div className="space-y-3">
          {groups.length === 0 && (
            <EmptyState
              icon={<Bell />}
              title="No alerts match your filters"
              subtitle="All alerts have been acknowledged. You're up to date."
              variant="clean"
            />
          )}

          {groups.map(group => (
            <div key={group.brand_id}>
              <BrandGroupCard
                group={group}
                selectedAlertId={selectedAlert?.id ?? null}
                onSelectAlert={a => setSelectedAlert(prev => prev?.id === a.id ? null : a)}
                onAcknowledgeAll={() => bulkAck.mutate({ brand_id: group.brand_id })}
                onCreateTakedowns={() => bulkTakedown.mutate({ brand_id: group.brand_id })}
                isAcknowledging={bulkAck.isPending}
                isCreatingTakedowns={bulkTakedown.isPending}
              />

              {/* Detail panel - rendered below the group */}
              {selectedAlert && group.alerts.some(a => a.id === selectedAlert.id) && (
                <AlertDetail
                  alert={selectedAlert}
                  onClose={() => setSelectedAlert(null)}
                  onUpdate={(status, notes) => {
                    updateAlert.mutate(
                      { id: selectedAlert.id, status, notes },
                      { onSuccess: () => setSelectedAlert(null) },
                    );
                  }}
                  isUpdating={updateAlert.isPending}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Total count */}
      {!alertsLoading && alertsData && (
        <div className="text-center font-mono text-[10px] text-white/40 pb-4">
          Showing {alerts.length} of {alertsData.total} alerts
        </div>
      )}
    </div>
  );
}
