import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useIsMobile } from '@/hooks/useWindowWidth';
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/useNotifications';
import type { Notification } from '@/hooks/useNotifications';
import { relativeTime } from '@/lib/time';
import { Badge } from '@/design-system/components';
import { USER_TOGGLEABLE_EVENTS, type NotificationEventKey } from '@averrow/shared';
import { Dropdown } from './Dropdown';
import { BottomSheet } from './BottomSheet';

// Filter pills are now generated from the @averrow/shared registry —
// all 5 user-toggleable events + an "All" pill. Adding a new event in
// notification-events.ts auto-surfaces here. System events
// (email_security_change, circuit_breaker_tripped) appear in the feed
// but aren't filterable from the bell — they're not user-controllable
// in any other surface either.
type FilterType = 'all' | NotificationEventKey;

function severityToBadgeSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  switch (severity) {
    case 'critical':
    case 'high':
    case 'medium':
    case 'low':
    case 'info':
      return severity;
    default:
      return 'info';
  }
}

function severityBorderToken(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--sev-critical-border)';
    case 'high':     return 'var(--sev-high-border)';
    case 'medium':   return 'var(--sev-medium-border)';
    case 'low':      return 'var(--sev-low-border)';
    default:         return 'var(--sev-info-border)';
  }
}

function severityDotClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'dot-pulse-red';
    case 'high':
    case 'medium':   return 'dot-pulse-amber';
    default:         return 'dot-pulse-afterburner';
  }
}

function NotificationItem({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  const isUnread = !notification.read_at;
  return (
    <button
      onClick={() => onRead(notification.id)}
      className="w-full text-left px-4 py-3 transition-colors hover:bg-white/5 touch-target"
      style={{
        borderLeft: isUnread ? `2px solid ${severityBorderToken(notification.severity)}` : '2px solid transparent',
        background: isUnread ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
    >
      <div className="flex items-start gap-2">
        {isUnread && (
          <span className={`dot-pulse mt-1.5 flex-shrink-0 ${severityDotClass(notification.severity)}`} style={{ width: 6, height: 6 }} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
            {notification.title}
          </p>
          <p className="text-[11px] mt-1 line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-secondary)' }}>
              {notification.type.replace(/_/g, ' ')}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>
            <Badge severity={severityToBadgeSeverity(notification.severity)} size="xs" />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>·</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {relativeTime(notification.created_at)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function NotificationList({
  onClose,
  filter,
  setFilter,
}: {
  onClose: () => void;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
}) {
  const navigate = useNavigate();
  const { data } = useNotifications(true);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  // Filter pills generated from the registry — `all` + each
  // user-toggleable event. Adding a new event to
  // `@averrow/shared/notification-events` auto-surfaces a pill here.
  const filterOptions = useMemo(
    () => [
      { key: 'all' as const, label: 'All' },
      ...USER_TOGGLEABLE_EVENTS.map((e) => ({ key: e.key, label: e.label })),
    ],
    [],
  );

  const notifications = data?.notifications ?? [];
  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type === filter);

  const handleRead = (id: string) => {
    markRead.mutate(id);
  };

  return (
    <div className="flex flex-col max-h-[520px] md:max-h-[520px]">
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: 'var(--text-secondary)' }}>
            Notifications
          </span>
          <button
            onClick={() => markAllRead.mutate()}
            className="text-[10px] font-mono transition-colors touch-target"
            style={{ color: 'var(--amber)' }}
          >
            Mark all read
          </button>
        </div>
        <p className="text-[11px] text-white/40 font-mono">
          {data?.unread_count ?? 0} unread
        </p>
      </div>

      <div className="flex flex-wrap gap-1 px-4 pb-3 flex-shrink-0">
        {filterOptions.map(({ key, label }) => {
          const isActive = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all touch-target"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, var(--amber), var(--amber-dim))'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(229, 168, 50, 0.60)'
                  : '1px solid var(--border-base)',
                color: isActive ? 'var(--text-on-amber, #0A0F1E)' : 'var(--text-secondary)',
                fontWeight: 800,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/5" />

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-white/40 font-mono">
            No notifications
          </div>
        ) : (
          filtered.map(n => (
            <NotificationItem key={n.id} notification={n} onRead={handleRead} />
          ))
        )}
      </div>

      <div className="border-t border-white/5 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => { navigate('/notifications'); onClose(); }}
          className="text-[10px] font-mono transition-colors touch-target"
          style={{ color: 'var(--amber)' }}
        >
          View all notifications &rarr;
        </button>
        <button
          onClick={() => { navigate('/notifications/preferences'); onClose(); }}
          className="text-[10px] font-mono text-white/40 hover:text-white/60 transition-colors touch-target"
        >
          Settings
        </button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const isMobile = useIsMobile();
  const { data: unreadCount = 0 } = useUnreadCount();

  const handleClose = useCallback(() => {
    setOpen(false);
    setFilter('all');
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg touch-target"
        style={{
          background: 'transparent',
          border: '1px solid var(--border-base)',
        }}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-white/70" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono dot-pulse-red"
            style={{
              background: 'var(--sev-critical)',
              color: '#fff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isMobile ? (
        <BottomSheet open={open} onClose={handleClose}>
          <NotificationList onClose={handleClose} filter={filter} setFilter={setFilter} />
        </BottomSheet>
      ) : (
        <Dropdown open={open} onClose={handleClose} width={380}>
          <NotificationList onClose={handleClose} filter={filter} setFilter={setFilter} />
        </Dropdown>
      )}
    </div>
  );
}
