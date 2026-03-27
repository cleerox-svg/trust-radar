import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { severityColor } from '@/lib/severityColor';

interface RecentThreat {
  id: string;
  type: string;
  brand_name: string;
  url?: string;
  domain?: string;
  created_at: string;
  severity?: string;
  threat_count?: number;
  exposure_score?: number | null;
}

export function LiveFeedCard() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['threats-recent'],
    queryFn: () => api.get<RecentThreat[]>('/api/v1/threats/recent?limit=8'),
    refetchInterval: 30000,
    retry: 1,
  });

  const threats = data?.data ?? [];

  return (
    <div className="rounded-xl border border-white/10 bg-cockpit p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orbital-teal opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orbital-teal" />
        </span>
        <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-orbital-teal">
          Live Feed
        </span>
      </div>

      {threats.length === 0 ? (
        <p className="font-mono text-[10px] text-white/30 py-4 text-center">
          No recent activity
        </p>
      ) : (
        <div className="space-y-2">
          {threats.map((t) => (
            <div key={t.id} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: severityColor(
                      t.exposure_score ?? null,
                      t.threat_count,
                    ),
                  }}
                />
                <span
                  className="font-mono text-[9px] font-semibold uppercase"
                  style={{
                    color: severityColor(
                      t.exposure_score ?? null,
                      t.threat_count,
                    ),
                  }}
                >
                  {t.type?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="pl-3">
                <span className="text-[11px] text-white/80 block truncate">
                  {t.brand_name}
                </span>
                {(t.url || t.domain) && (
                  <span className="text-[10px] text-white/40 font-mono block truncate">
                    {t.url ?? t.domain}
                  </span>
                )}
                <span className="text-[9px] text-white/30">
                  {formatTimestamp(t.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/observatory')}
        className="mt-3 w-full text-center font-mono text-[9px] text-orbital-teal/70 hover:text-orbital-teal transition-colors"
      >
        View all &rarr;
      </button>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '—';
  }
}
