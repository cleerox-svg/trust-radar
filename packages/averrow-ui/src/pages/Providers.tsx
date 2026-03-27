import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProviders } from '@/hooks/useProviders';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { CardGridLoader } from '@/components/ui/PageLoader';

const TIME_RANGES = ['7d', '30d', '90d', '1y'] as const;

function trendIndicator(trend: number) {
  if (trend === 0) return { arrow: '→', color: 'text-contrail/50' };
  if (trend < 0) return { arrow: '↓', color: 'text-positive' };
  return { arrow: '↑', color: 'text-accent' };
}

function reputationColor(score: number): string {
  if (score >= 80) return 'bg-positive';
  if (score >= 60) return 'bg-contrail';
  if (score >= 40) return 'bg-warning';
  return 'bg-accent';
}

export function Providers() {
  const navigate = useNavigate();
  const [view, setView] = useState('worst');
  const [timeRange, setTimeRange] = useState<string>('7d');
  const { data: providersRes, isLoading } = useProviders({ view, timeRange });

  if (isLoading) return <CardGridLoader count={12} />;

  const providers = providersRes || [];
  const total = providers.length;

  const tabs = [
    { id: 'worst', label: 'WORST ACTORS', count: total },
    { id: 'improving', label: 'IMPROVING' },
    { id: 'all', label: 'ALL PROVIDERS' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-display text-xl font-bold text-parchment">Infrastructure Intelligence</h1>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs tabs={tabs} activeTab={view} onChange={setView} />
        <div className="flex gap-1.5">
          {TIME_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`font-mono text-[11px] font-semibold px-3 py-1 rounded transition-all ${
                timeRange === r
                  ? 'bg-accent/10 text-accent border border-accent/25'
                  : 'text-contrail/40 hover:bg-white/5 hover:text-parchment border border-transparent'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {providers.map((provider, idx) => {
            const trend = trendIndicator(provider.trend_7d);
            return (
              <Card
                key={provider.id}
                className="cursor-pointer"
                hover
              >
                <div
                  onClick={() => navigate(`/providers/${provider.id}`)}
                  className="space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-[10px] text-contrail/30">#{idx + 1}</span>
                    {provider.country && (
                      <Badge variant="info">{provider.country}</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${(provider.name ?? '').toLowerCase().replace(/\s/g, '')}.com&sz=32`}
                      alt=""
                      className="w-6 h-6 rounded"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).classList.add('hidden');
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-parchment truncate">{provider.name}</div>
                      {provider.asn && (
                        <div className="font-mono text-xs text-contrail/40">{provider.asn}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-accent">
                      {provider.active_threat_count}
                    </span>
                    <span className="font-mono text-xs text-contrail/50">active threats</span>
                  </div>

                  <div className={`font-mono text-xs font-semibold ${trend.color}`}>
                    {trend.arrow} {Math.abs(provider.trend_7d)}% 7d
                  </div>

                  {provider.reputation_score !== null ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-contrail/40">Reputation</span>
                        <span className="font-mono text-[10px] text-parchment/70">{provider.reputation_score}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${reputationColor(provider.reputation_score)}`}
                          style={{ width: `${provider.reputation_score}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] text-contrail/30">No data</div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
