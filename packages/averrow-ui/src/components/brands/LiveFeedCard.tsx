import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { severityColor } from '@/lib/severityColor';

interface RecentThreat {
  id: string;
  type: string;
  severity: string;
  brand_name: string;
  url?: string;
  domain?: string;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const SEVERITY_SCORE: Record<string, number> = {
  critical: 10,
  high: 30,
  medium: 50,
  low: 70,
  info: 90,
};

export function LiveFeedCard() {
  const { data: threats } = useQuery({
    queryKey: ['threats', 'recent'],
    queryFn: async () => {
      const res = await api.get<RecentThreat[]>('/api/v1/threats/recent?limit=8');
      return res.data ?? [];
    },
    refetchInterval: 30000,
  });

  const items = threats ?? [];

  return (
    <div className="rounded-xl glass-card glass-card-amber p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-[9px] tracking-widest text-afterburner">LIVE FEED</span>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-afterburner" />
      </div>

      {items.length === 0 ? (
        <p className="text-[11px] text-white/30">No recent activity</p>
      ) : (
        <div className="flex flex-col">
          {items.map((t) => {
            const score = SEVERITY_SCORE[t.severity?.toLowerCase()] ?? 50;
            const dotColor = severityColor(score);
            return (
              <div
                key={t.id}
                className="flex items-center gap-2 border-b border-white/[0.05] py-1.5 last:border-b-0"
              >
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="flex-shrink-0 font-mono text-[9px]" style={{ color: dotColor }}>
                  {t.type}
                </span>
                <span className="flex-shrink-0 text-[11px] text-white/80">{t.brand_name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/40">
                  {t.url || t.domain}
                </span>
                <span className="flex-shrink-0 font-mono text-[9px] text-white/30">
                  {timeAgo(t.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <a
        href="/contacts"
        className="mt-3 block text-[10px] text-afterburner transition-colors hover:text-white"
      >
        View all in Observatory →
      </a>
    </div>
  );
}
