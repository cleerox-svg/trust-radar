import { useNavigate } from 'react-router-dom';
import { useBrandStats } from '@/hooks/useBrands';
import { useObservatoryStats } from '@/hooks/useObservatory';
import { useAlertStats } from '@/hooks/useAlerts';
import { useAdminTakedowns } from '@/hooks/useTakedowns';
import { useAgents } from '@/hooks/useAgents';
import { useFeedStats } from '@/hooks/useFeeds';
import { useUnreadCount, useNotifications } from '@/hooks/useNotifications';
// --- Tile config -----------------------------------------------------------

interface TileConfig {
  label: string;
  icon: string;
  accent: string;
  route: string;
}

const TILES: TileConfig[] = [
  { label: 'BRANDS',    icon: '\u2B21', accent: '#E5A832', route: '/brands' },
  { label: 'THREATS',   icon: '\u25C8', accent: '#C83C3C', route: '/observatory' },
  { label: 'ALERTS',    icon: '\u25C9', accent: '#f59e0b', route: '/alerts' },
  { label: 'TAKEDOWNS', icon: '\u2298', accent: '#3CB878', route: '/admin/takedowns' },
  { label: 'AGENTS',    icon: '\u2699', accent: '#0a8ab5', route: '/agents' },
  { label: 'FEEDS',     icon: '\u25EB', accent: '#78A0C8', route: '/feeds' },
];

// --- Helpers ----------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#fbbf24',
  low: '#78A0C8',
  info: '#4ade80',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// --- Component --------------------------------------------------------------

export function MobileCommandCenter() {
  const navigate = useNavigate();

  // Data queries
  const { data: brandStats } = useBrandStats();
  const { data: obsStats } = useObservatoryStats();
  const { data: alertStats } = useAlertStats();
  const { data: takedownData } = useAdminTakedowns({ limit: 1 });
  const { data: agents } = useAgents();
  const { data: feedStats } = useFeedStats();
  const { data: unreadCount } = useUnreadCount();
  const { data: notifData } = useNotifications(true);

  // Resolve tile values — guard every nested access
  const safeAgents = Array.isArray(agents) ? agents : [];
  const tileValues: Record<string, { value: string; sub?: string }> = {
    BRANDS:    { value: String(brandStats?.total_tracked ?? '—'), sub: `${brandStats?.new_this_week ?? 0} new this week` },
    THREATS:   { value: String(obsStats?.threats_mapped ?? '—'), sub: `${obsStats?.countries ?? 0} countries` },
    ALERTS:    { value: String(alertStats?.total ?? '—'), sub: `${alertStats?.critical ?? 0} critical` },
    TAKEDOWNS: { value: String(takedownData?.total ?? '—'), sub: 'active requests' },
    AGENTS:    { value: String(safeAgents.length || '—'), sub: `${safeAgents.filter(a => a.status === 'healthy').length} healthy` },
    FEEDS:     { value: String(feedStats?.active ?? '—'), sub: `${feedStats?.total_ingested?.toLocaleString() ?? 0} ingested` },
  };

  // Latest intel from notifications
  const latestIntel = (Array.isArray(notifData?.notifications) ? notifData.notifications : []).slice(0, 3);

  // Last scan time — use most recent agent run
  const lastRunAt = safeAgents
    .filter(a => a.last_run_at)
    .sort((a, b) => new Date(b.last_run_at!).getTime() - new Date(a.last_run_at!).getTime())[0]
    ?.last_run_at;

  return (
    <div className="min-h-screen bg-cockpit px-4 pb-6 pt-3">
      {/* ---- HEADER ---- */}
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-[9px] tracking-[0.15em] text-accent">
            AVERROW
          </span>
          <h1 className="text-[22px] font-extrabold leading-tight text-parchment">
            Command Center
          </h1>
        </div>
        <div className="flex items-center gap-3 pt-1">
          {/* Notification bell */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-1"
            aria-label="Notifications"
          >
            <svg className="h-5 w-5 text-contrail/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {(unreadCount ?? 0) > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                {unreadCount! > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {/* User avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
            CL
          </div>
        </div>
      </div>

      {/* ---- STATUS BAR ---- */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/[0.08] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-green-400">
            ALL SYSTEMS OPERATIONAL
          </span>
        </div>
        <span className="text-[10px] text-white/55">
          {lastRunAt ? `Last scan: ${timeAgo(lastRunAt)}` : 'Scanning...'}
        </span>
      </div>

      {/* ---- TILE GRID ---- */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {TILES.map((tile) => {
          const tv = tileValues[tile.label];
          return (
            <button
              key={tile.label}
              onClick={() => navigate(tile.route)}
              className="relative overflow-hidden rounded-xl border border-bulkhead/35 bg-instrument p-4 text-left active:scale-[0.97] transition-transform"
            >
              {/* Accent glow */}
              <div
                className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-[0.04]"
                style={{ background: tile.accent }}
              />
              {/* Icon */}
              <span className="text-lg leading-none" style={{ color: tile.accent }}>
                {tile.icon}
              </span>
              {/* Value */}
              <div
                className="mt-2 text-[28px] font-extrabold leading-none"
                style={{ color: tile.accent }}
              >
                {tv?.value ?? '—'}
              </div>
              {/* Label */}
              <span className="mt-1.5 block text-[8px] font-mono uppercase tracking-widest text-white/55">
                {tile.label}
              </span>
              {/* Subtitle */}
              {tv?.sub && (
                <span className="mt-0.5 block text-[11px] text-contrail/55">
                  {tv.sub}
                </span>
              )}
              {/* Critical badge for alerts */}
              {tile.label === 'ALERTS' && (alertStats?.critical ?? 0) > 0 && (
                <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[9px] font-bold text-white">
                  {alertStats!.critical}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---- LATEST INTEL ---- */}
      <div className="mt-5 rounded-xl border border-bulkhead/35 bg-instrument p-4">
        <h2 className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">
          Latest Intel
        </h2>

        {latestIntel.length === 0 ? (
          <p className="mt-3 text-[12px] text-white/40">No recent alerts</p>
        ) : (
          <div className="mt-3 space-y-3">
            {latestIntel.map((n) => (
              <div key={n.id} className="flex items-start gap-2.5">
                <span
                  className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: SEVERITY_COLORS[n.severity] ?? '#78A0C8' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] leading-snug text-parchment/90">
                    <span className="font-semibold">{n.title}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-contrail/50">
                    {n.message}
                  </p>
                </div>
                <span className="flex-shrink-0 text-[10px] text-white/50">
                  {timeAgo(n.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/alerts')}
          className="mt-3 block text-[11px] font-medium text-afterburner"
        >
          View all alerts &rarr;
        </button>
      </div>
    </div>
  );
}
