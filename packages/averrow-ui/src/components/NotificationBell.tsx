import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useIsMobile } from '@/hooks/useWindowWidth';
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/useNotifications';
import type { Notification } from '@/hooks/useNotifications';
import { relativeTime } from '@/lib/time';
import { Dropdown } from './Dropdown';
import { BottomSheet } from './BottomSheet';

type FilterType = 'all' | 'brand_threat' | 'feed_health' | 'intelligence_digest';

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  brand_threat: 'Threats',
  feed_health: 'Feeds',
  intelligence_digest: 'Intel',
};

function severityBorderColor(severity: string): string {
  switch (severity) {
    case 'critical':
    case 'high': return 'rgba(200,60,60,0.6)';
    case 'medium': return 'rgba(251,146,60,0.4)';
    default: return 'rgba(0,212,255,0.3)';
  }
}

function severityDotClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'dot-pulse-red';
    case 'high': return 'dot-pulse-amber';
    case 'medium': return 'dot-pulse-amber';
    default: return 'dot-pulse-teal';
  }
}

function NotificationItem({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  const isUnread = !notification.read_at;
  return (
    <button
      onClick={() => onRead(notification.id)}
      className="w-full text-left px-4 py-3 transition-colors hover:bg-white/5 touch-target"
      style={{
        borderLeft: isUnread ? `2px solid ${severityBorderColor(notification.severity)}` : '2px solid transparent',
        background: isUnread ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
    >
      <div className="flex items-start gap-2">
        {isUnread && (
          <span className={`dot-pulse mt-1.5 flex-shrink-0 ${severityDotClass(notification.severity)}`} style={{ width: 6, height: 6 }} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-parchment/90 leading-snug line-clamp-2">
            {notification.title}
          </p>
          <p className="text-[11px] text-white/40 mt-1 line-clamp-1">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-mono text-contrail/50 uppercase">
              {notification.type.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] font-mono text-white/30 uppercase">
              {notification.severity}
            </span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] font-mono text-white/30">
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
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-contrail/70 font-bold">
            Notifications
          </span>
          <button
            onClick={() => markAllRead.mutate()}
            className="text-[10px] font-mono text-orbital-teal hover:text-thrust transition-colors touch-target"
          >
            Mark all read
          </button>
        </div>
        <p className="text-[11px] text-white/40 font-mono">
          {data?.unread_count ?? 0} unread
        </p>
      </div>

      <div className="flex gap-1 px-4 pb-3 flex-shrink-0">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map(key => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all touch-target ${
              filter === key
                ? 'glass-btn-active text-[#00D4FF]'
                : 'glass-btn text-white/50'
            }`}
          >
            {FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="border-t border-white/5" />

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-white/30 font-mono">
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
          className="text-[10px] font-mono text-orbital-teal hover:text-thrust transition-colors touch-target"
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
        className="relative glass-btn p-2 rounded-lg touch-target"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-white/70" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1.5 bg-[#C83C3C] rounded-full flex items-center justify-center text-[10px] font-bold font-mono text-white dot-pulse-red">
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
