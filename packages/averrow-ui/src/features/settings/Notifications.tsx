// /v2/notifications — full notification archive.
//
// Composition (matches the Profile page section style):
//   PageHeader (back button + "All Notifications" title)
//   Filters card  — type pills + severity pills + search input
//   Results card  — paginated list, mark-as-read inline, pagination row
//
// Cursor-based pagination so the list stays stable as new
// notifications arrive between page loads. Filter changes reset the
// cursor (you start from the newest matching row).

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, X } from 'lucide-react';
import {
  USER_TOGGLEABLE_EVENTS,
  NOTIFICATION_EVENTS,
  type NotificationEventKey,
  type NotificationSeverity,
} from '@averrow/shared';
import { Card, Badge, SectionLabel, Button } from '@/design-system/components';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  useNotificationsArchive, useMarkRead, useMarkAllRead,
  type Notification,
} from '@/hooks/useNotifications';
import { relativeTime } from '@/lib/time';
import { Bell } from 'lucide-react';

type TypeFilter = 'all' | NotificationEventKey;
type SeverityFilter = 'all' | NotificationSeverity;

const SEVERITY_OPTIONS: readonly { key: SeverityFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'high',     label: 'High' },
  { key: 'medium',   label: 'Medium' },
  { key: 'low',      label: 'Low' },
  { key: 'info',     label: 'Info' },
];

function severityToBadge(s: string): NotificationSeverity {
  if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low' || s === 'info') return s;
  return 'info';
}

// Resolve a notification type to its registry label so the UI shows
// "Brand Threats" instead of the raw `brand_threat` key.
function typeLabel(type: string): string {
  const def = NOTIFICATION_EVENTS.find((e) => e.key === type);
  return def?.label ?? type.replace(/_/g, ' ');
}

export function Notifications() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);

  const currentCursor = cursorStack[cursorStack.length - 1];

  // Filter pills built from the registry (all 7 events — toggleable
  // + system — surface here, unlike the bell which only shows
  // user-toggleable). System events arrive in the feed; users should
  // be able to filter them.
  const typeOptions = useMemo(
    () => [
      { key: 'all' as const, label: 'All' },
      ...NOTIFICATION_EVENTS.map((e) => ({ key: e.key, label: e.label })),
    ],
    [],
  );

  const filters = {
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
    ...(severityFilter !== 'all' ? { severity: severityFilter } : {}),
    ...(appliedSearch ? { q: appliedSearch } : {}),
    ...(currentCursor ? { cursor: currentCursor } : {}),
  };

  const { data, isLoading, isFetching } = useNotificationsArchive(filters);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  // Filter changes reset pagination. Only re-runs when filter values
  // actually change — `appliedSearch` (debounced submit) instead of
  // raw `searchInput` (on every keystroke).
  const onChangeTypeFilter = (next: TypeFilter) => {
    setTypeFilter(next);
    setCursorStack([null]);
  };
  const onChangeSeverityFilter = (next: SeverityFilter) => {
    setSeverityFilter(next);
    setCursorStack([null]);
  };
  const submitSearch = () => {
    setAppliedSearch(searchInput.trim());
    setCursorStack([null]);
  };
  const clearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setCursorStack([null]);
  };

  const goNextPage = () => {
    if (data?.next_cursor) {
      setCursorStack([...cursorStack, data.next_cursor]);
    }
  };
  const goPrevPage = () => {
    if (cursorStack.length > 1) {
      setCursorStack(cursorStack.slice(0, -1));
    }
  };

  const notifications = data?.notifications ?? [];
  const isFirstPage = cursorStack.length === 1;
  const hasNextPage = data?.next_cursor != null;

  return (
    <div className="max-w-3xl mx-auto page-enter">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg touch-target"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-base)',
              color: 'var(--text-secondary)',
              transition: 'var(--transition-fast)',
            }}
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: 'var(--text-muted)' }}>
            All Notifications
          </h1>
        </div>
        {(data?.unread_count ?? 0) > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
            Mark all read ({data?.unread_count})
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <SectionLabel className="mb-3">Filters</SectionLabel>

        <div className="space-y-3">
          {/* Type pills */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Type
            </div>
            <div className="flex flex-wrap gap-1.5">
              {typeOptions.map(({ key, label }) => (
                <FilterPill
                  key={key}
                  active={typeFilter === key}
                  onClick={() => onChangeTypeFilter(key)}
                >
                  {label}
                </FilterPill>
              ))}
            </div>
          </div>

          {/* Severity pills */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Severity
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SEVERITY_OPTIONS.map(({ key, label }) => (
                <FilterPill
                  key={key}
                  active={severityFilter === key}
                  onClick={() => onChangeSeverityFilter(key)}
                >
                  {label}
                </FilterPill>
              ))}
            </div>
          </div>

          {/* Search */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
              Search
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-tertiary)' }}
                />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitSearch();
                    if (e.key === 'Escape') clearSearch();
                  }}
                  placeholder="Search title or message…"
                  style={{ paddingLeft: 36 }}
                />
                {appliedSearch && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded touch-target"
                    style={{ color: 'var(--text-tertiary)' }}
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={submitSearch}>
                Search
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Results */}
      {isLoading ? (
        <Card>
          <p className="font-mono text-[12px] py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
            Loading…
          </p>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="w-10 h-10" />}
            title={appliedSearch || typeFilter !== 'all' || severityFilter !== 'all'
              ? 'No notifications match these filters'
              : 'No notifications yet'}
            subtitle={appliedSearch || typeFilter !== 'all' || severityFilter !== 'all'
              ? 'Try a different filter or clear the search.'
              : 'Future events will land here.'}
          />
        </Card>
      ) : (
        <Card>
          <div className="space-y-1 -mx-2">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onRead={() => markRead.mutate(n.id)} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={goPrevPage}
              disabled={isFirstPage || isFetching}
            >
              ← Newer
            </Button>
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {isFetching ? 'Loading…' : `Page ${cursorStack.length}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={goNextPage}
              disabled={!hasNextPage || isFetching}
            >
              Older →
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all touch-target"
      style={{
        background: active
          ? 'linear-gradient(135deg, var(--amber), var(--amber-dim))'
          : 'transparent',
        border: active
          ? '1px solid rgba(229, 168, 50, 0.60)'
          : '1px solid var(--border-base)',
        color: active ? 'var(--text-on-amber, #0A0F1E)' : 'var(--text-secondary)',
        fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  const isUnread = !notification.read_at;
  const sev = severityToBadge(notification.severity);

  return (
    <button
      onClick={isUnread ? onRead : undefined}
      className="w-full text-left px-3 py-3 rounded transition-colors hover:bg-white/[0.03] touch-target"
      style={{
        borderLeft: isUnread
          ? `2px solid var(--sev-${sev}-border, var(--sev-info-border))`
          : '2px solid transparent',
        background: isUnread ? 'rgba(255,255,255,0.02)' : 'transparent',
        cursor: isUnread ? 'pointer' : 'default',
        opacity: isUnread ? 1 : 0.65,
      }}
      aria-label={isUnread ? `Mark "${notification.title}" as read` : notification.title}
    >
      <div className="flex items-start gap-3">
        <Badge severity={sev} size="xs" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug" style={{ color: 'var(--text-primary)' }}>
            {notification.title}
          </p>
          <p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              {typeLabel(notification.type)}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {relativeTime(notification.created_at)}
            </span>
            {!isUnread && (
              <>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>read</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
