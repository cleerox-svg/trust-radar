import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useFeeds, useFeedHistory } from '@/hooks/useFeeds';
import { useAdminAction } from '@/hooks/useAdminAction';
import type { FeedOverview, FeedPullRecord } from '@/hooks/useFeeds';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { RotateCw, Loader2, Check, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useMobile, DrillHeader, MobileBottomSheet, HeroStatGrid, MobileFilterChips } from '@/components/mobile';

/* ─── Helpers ─── */

function humanizeCron(cron: string): string {
  const map: Record<string, string> = {
    '*/5 * * * *':   'Every 5 minutes',
    '*/30 * * * *':  'Every 30 minutes',
    '0 * * * *':     'Every hour',
    '0 */2 * * *':   'Every 2 hours',
    '0 */4 * * *':   'Every 4 hours',
    '0 */6 * * *':   'Every 6 hours',
    '0 */12 * * *':  'Every 12 hours',
    '0 0 * * *':     'Daily at midnight',
    '0 6 * * *':     'Daily at 6 AM',
  };
  return map[cron] ?? cron;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function detectFeedIssue(feed: FeedOverview): string | null {
  if (!feed.enabled) return null;
  if (feed.total_pulls > 10 && feed.total_ingested === 0) {
    if (feed.feed_name === 'otx_alienvault')
      return 'HTTP 403 Forbidden — API key invalid or expired';
    if (feed.feed_name === 'cloudflare_scanner')
      return 'Rate limited — 500 scan/month cap reached';
    if (feed.feed_name === 'feodo')
      return 'No matching threats ingested — check filter config';
    if (feed.feed_name === 'cloudflare_email')
      return 'No email threats detected in current window';
    return '0 records ingested despite active pulls — investigate';
  }
  return null;
}

function successRate(feed: FeedOverview): number {
  if (feed.total_pulls === 0) return 0;
  return Math.round((feed.successes / feed.total_pulls) * 100);
}

function successBarColor(rate: number): string {
  if (rate >= 90) return 'bg-green-400';
  if (rate >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

type FeedCategory = 'healthy' | 'attention' | 'disabled';

function categorizeFeed(feed: FeedOverview): FeedCategory {
  if (!feed.enabled) return 'disabled';
  if (feed.total_ingested === 0) return 'attention';
  return 'healthy';
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

/* ─── Trigger Buttons ─── */

function TriggerAllButton() {
  const queryClient = useQueryClient();
  const action = useAdminAction('/api/feeds/trigger-all', () => {
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['feeds-overview'] }), 3000);
  });

  if (action.state === 'idle') {
    return (
      <button
        type="button"
        onClick={action.confirm}
        className="glass-btn flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider"
      >
        <RotateCw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Trigger All</span>
      </button>
    );
  }
  if (action.state === 'confirming') {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-amber-400">Trigger all feeds?</span>
        <button
          type="button"
          onClick={action.execute}
          className="glass-btn flex items-center gap-1 px-2 py-1 font-mono text-[10px] text-green-400"
        >
          <Check className="w-3 h-3" /> Confirm
        </button>
        <button
          type="button"
          onClick={action.cancel}
          className="glass-btn flex items-center gap-1 px-2 py-1 font-mono text-[10px] text-white/40"
        >
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>
    );
  }
  if (action.state === 'loading') {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[10px] text-orbital-teal">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Triggering...
      </span>
    );
  }
  if (action.state === 'success') {
    return (
      <span className="flex items-center gap-1.5 font-mono text-[10px] text-green-400">
        <Check className="w-3.5 h-3.5" /> Feeds triggered
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] text-red-400">{action.error || 'Failed'}</span>
  );
}

function RetryButton({ feedName }: { feedName: string }) {
  const queryClient = useQueryClient();
  const action = useAdminAction(`/api/feeds/${feedName}/trigger`, () => {
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['feeds-overview'] }), 3000);
  });

  if (action.state === 'idle') {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); action.confirm(); }}
        className="glass-btn flex items-center gap-1 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-amber-400"
      >
        <RotateCw className="w-3 h-3" /> Retry
      </button>
    );
  }
  if (action.state === 'confirming') {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={action.execute}
          className="glass-btn flex items-center gap-0.5 px-1.5 py-1 font-mono text-[9px] text-green-400"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={action.cancel}
          className="glass-btn flex items-center gap-0.5 px-1.5 py-1 font-mono text-[9px] text-white/40"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }
  if (action.state === 'loading') {
    return (
      <span className="flex items-center gap-1 font-mono text-[9px] text-orbital-teal" onClick={(e) => e.stopPropagation()}>
        <Loader2 className="w-3 h-3 animate-spin" />
      </span>
    );
  }
  if (action.state === 'success') {
    return (
      <span className="flex items-center gap-1 font-mono text-[9px] text-green-400">
        <Check className="w-3 h-3" />
      </span>
    );
  }
  return (
    <span className="font-mono text-[9px] text-red-400">
      <X className="w-3 h-3 inline" />
    </span>
  );
}

/* ─── Components ─── */

function HeaderStats({ feeds }: { feeds: FeedOverview[] }) {
  const active = feeds.filter(f => f.enabled).length;
  const disabled = feeds.filter(f => !f.enabled).length;
  const totalIngested = feeds.reduce((s, f) => s + f.total_ingested, 0);
  const needsAttention = feeds.filter(f => f.enabled && f.total_ingested === 0).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="glass-card glass-card-green relative rounded-xl p-4">
        <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-2">Active Feeds</div>
        <div className="text-[28px] font-bold leading-none text-green-400 font-display">{active}</div>
      </div>
      <div className="glass-card glass-card-teal relative rounded-xl p-4">
        <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-2">Total Ingested</div>
        <div className="text-[28px] font-bold leading-none text-orbital-teal font-display">
          {totalIngested.toLocaleString()}
        </div>
      </div>
      <div className="glass-card glass-card-amber relative rounded-xl p-4">
        <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-2">Needs Attention</div>
        <div className={cn('text-[28px] font-bold leading-none font-display', needsAttention > 0 ? 'text-amber-400' : 'text-white/30')}>
          {needsAttention}
        </div>
      </div>
      <div className="glass-card relative rounded-xl p-4">
        <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-2">Disabled</div>
        <div className="text-[28px] font-bold leading-none text-white/40 font-display">{disabled}</div>
      </div>
    </div>
  );
}

function AttentionBanner({ feeds }: { feeds: FeedOverview[] }) {
  const attentionFeeds = feeds.filter(f => f.enabled && f.total_pulls > 10 && f.total_ingested === 0);
  if (attentionFeeds.length === 0) return null;

  const names = attentionFeeds.map(f => {
    const issue = detectFeedIssue(f);
    return issue ? `${f.display_name} (${issue.split('—')[0].trim().toLowerCase()})` : f.display_name;
  });

  return (
    <div className="glass-card glass-card-amber relative rounded-xl p-4">
      <div className="flex items-start gap-2">
        <span className="text-amber-400 text-sm mt-0.5">&#9888;</span>
        <div>
          <span className="text-[13px] font-semibold text-parchment font-display">
            {attentionFeeds.length} feed{attentionFeeds.length > 1 ? 's' : ''} need attention
          </span>
          <span className="text-[12px] text-white/50 ml-1">
            — {names.join(', ')} {attentionFeeds.length > 1 ? 'are' : 'is'} enabled but ingesting 0 records.
          </span>
        </div>
      </div>
    </div>
  );
}

function FeedHealthStrip({ feeds }: { feeds: FeedOverview[] }) {
  const healthy = feeds.filter(f => f.enabled && f.total_ingested > 0);
  const warning = feeds.filter(f => f.enabled && f.total_ingested === 0);
  const disabled = feeds.filter(f => !f.enabled);

  return (
    <div className="glass-card relative rounded-xl p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">Feed Health</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {healthy.map(f => (
            <div key={f.feed_name} className="w-2.5 h-2.5 rounded-full bg-green-400" title={f.display_name} />
          ))}
          {warning.map(f => (
            <div key={f.feed_name} className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" title={f.display_name} />
          ))}
          {disabled.map(f => (
            <div key={f.feed_name} className="w-2.5 h-2.5 rounded-full border border-white/20 bg-transparent" title={f.display_name} />
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto text-[10px] font-mono text-white/40">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> {healthy.length} healthy</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {warning.length} warning</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-white/20 inline-block" /> {disabled.length} disabled</span>
        </div>
      </div>
    </div>
  );
}

function FeedCard({
  feed,
  category,
  isExpanded,
  onToggle,
}: {
  feed: FeedOverview;
  category: FeedCategory;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const rate = successRate(feed);
  const issue = detectFeedIssue(feed);

  const cardClass = cn(
    'glass-card relative rounded-xl p-4 cursor-pointer transition-all',
    category === 'healthy' && 'hover:border-green-500/20',
    category === 'attention' && 'glass-card-amber',
    category === 'disabled' && 'opacity-60',
  );

  const badgeClass = cn(
    'text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded border',
    category === 'healthy' && 'text-green-400 border-green-500/30 bg-green-900/30',
    category === 'attention' && 'text-amber-400 border-amber-500/30 bg-amber-900/30',
    category === 'disabled' && 'text-white/40 border-white/10 bg-white/5',
  );

  const badgeLabel = category === 'healthy' ? 'ACTIVE' : category === 'attention' ? 'WARNING' : 'DISABLED';

  const dotClass = cn(
    'w-2.5 h-2.5 rounded-full flex-shrink-0',
    category === 'healthy' && 'bg-green-400',
    category === 'attention' && 'bg-amber-400 animate-pulse',
    category === 'disabled' && 'border border-white/20',
  );

  return (
    <div>
      <div className={cardClass} onClick={onToggle}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className={dotClass} />
            <span className="text-[14px] font-semibold text-parchment font-display truncate">
              {feed.display_name}
            </span>
          </div>
          <span className={badgeClass}>{badgeLabel}</span>
        </div>

        {/* Subtitle */}
        <div className="text-[11px] text-white/40 font-mono ml-[18px] mb-3">
          {feed.description ? `${feed.description} · ` : ''}
          {category === 'disabled' ? humanizeCron(feed.schedule_cron) : humanizeCron(feed.schedule_cron)}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <div className={cn('text-[16px] font-bold font-mono', feed.total_ingested > 0 ? 'text-parchment' : 'text-white/30')}>
              {formatNumber(feed.total_ingested)}
            </div>
            <div className="text-[9px] font-mono uppercase tracking-wider text-white/40">Threats</div>
          </div>
          <div>
            <div className="text-[16px] font-bold font-mono text-parchment">
              {formatNumber(feed.total_pulls)}
            </div>
            <div className="text-[9px] font-mono uppercase tracking-wider text-white/40">Pulls</div>
          </div>
          <div>
            {category === 'disabled' ? (
              <>
                <div className="text-[16px] font-bold font-mono text-white/30">&mdash;</div>
                <div className="text-[9px] font-mono uppercase tracking-wider text-white/40">Last Run</div>
              </>
            ) : (
              <>
                <div className="text-[16px] font-bold font-mono text-parchment">
                  {formatNumber(feed.successes)}
                </div>
                <div className="text-[9px] font-mono uppercase tracking-wider text-white/40">Successes</div>
              </>
            )}
          </div>
        </div>

        {/* Issue banner for attention feeds */}
        {issue && (
          <div className="text-[11px] text-amber-400 font-mono mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span>&#9888;</span> {issue}
            </div>
            {category === 'attention' && (
              <RetryButton feedName={feed.feed_name} />
            )}
          </div>
        )}

        {/* Footer */}
        {category !== 'disabled' && (
          <div className="space-y-2">
            <div className="text-[10px] text-white/40 font-mono">
              Last run: {timeAgo(feed.last_run)}
            </div>
            {/* Success rate bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', successBarColor(rate))}
                  style={{ width: `${rate}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-white/40">{rate}%</span>
            </div>
          </div>
        )}

        {category === 'disabled' && (
          <div className="text-[10px] text-white/30 font-mono">Disabled</div>
        )}
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <FeedDetailPanel feed={feed} />
      )}
    </div>
  );
}

function FeedDetailPanel({ feed }: { feed: FeedOverview }) {
  const { data: history, isLoading } = useFeedHistory(feed.feed_name, 20);

  const chartData = useMemo(() => {
    if (!history) return [];
    return [...history].reverse().map((h: FeedPullRecord) => ({
      time: new Date(h.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ingested: h.records_ingested,
    }));
  }, [history]);

  return (
    <div className="glass-card relative rounded-xl p-4 mt-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT — Feed Details */}
      <div className="space-y-3">
        <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-2">Feed Details</div>

        <DetailRow label="Feed Name" value={feed.feed_name} />
        <DetailRow label="Display Name" value={feed.display_name} />
        {feed.description && <DetailRow label="Description" value={feed.description} />}
        {feed.source_url && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-white/40 w-24 flex-shrink-0">Source URL</span>
            <a
              href={feed.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-contrail/60 hover:text-contrail truncate"
            >
              {feed.source_url}
            </a>
          </div>
        )}
        <DetailRow label="Schedule" value={humanizeCron(feed.schedule_cron)} />
        {feed.batch_size != null && <DetailRow label="Batch Size" value={String(feed.batch_size)} />}
        {feed.rate_limit != null && <DetailRow label="Rate Limit" value={String(feed.rate_limit)} />}
        {feed.retry_count != null && (
          <DetailRow
            label="Retry Config"
            value={`${feed.retry_count} retries, ${feed.retry_delay_seconds ?? 0}s delay`}
          />
        )}
        <DetailRow label="Status" value={feed.enabled ? 'Enabled' : 'Disabled'} />
        {feed.filters && (
          <div>
            <span className="text-[10px] font-mono text-white/40 block mb-1">Filters</span>
            <pre className="text-[10px] font-mono text-white/50 bg-white/5 rounded p-2 overflow-x-auto">
              {feed.filters}
            </pre>
          </div>
        )}
      </div>

      {/* RIGHT — Pull History */}
      <div className="space-y-3">
        <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-2">Pull History</div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : history && history.length > 0 ? (
          <>
            {/* Chart */}
            {chartData.length > 1 && (
              <div className="h-32 w-full mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0E1A2B',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                      itemStyle={{ color: '#00d4ff' }}
                    />
                    <Bar dataKey="ingested" fill="#00d4ff" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table */}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <div className="grid grid-cols-4 gap-2 text-[9px] font-mono uppercase tracking-wider text-white/30 px-1">
                <span>Started</span>
                <span>Duration</span>
                <span>Ingested</span>
                <span>Status</span>
              </div>
              {history.slice(0, 10).map((pull: FeedPullRecord) => (
                <div
                  key={pull.id}
                  className="grid grid-cols-4 gap-2 text-[10px] font-mono px-1 py-1 rounded hover:bg-white/5"
                >
                  <span className="text-white/50 truncate">
                    {new Date(pull.started_at).toLocaleString([], {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="text-white/50">
                    {pull.duration_ms != null ? `${(pull.duration_ms / 1000).toFixed(1)}s` : '—'}
                  </span>
                  <span className={pull.records_ingested > 0 ? 'text-parchment' : 'text-white/30'}>
                    {pull.records_ingested}
                  </span>
                  <span>
                    {pull.status === 'success' ? (
                      <span className="text-green-400">&#10003; success</span>
                    ) : (
                      <span className="text-red-400" title={pull.error_message ?? ''}>
                        &#10007; error
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-[11px] text-white/30 font-mono">No pull history available</div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-mono text-white/40 w-24 flex-shrink-0">{label}</span>
      <span className="text-[11px] font-mono text-parchment">{value}</span>
    </div>
  );
}

function FeedSection({
  title,
  feeds,
  category,
  expandedFeed,
  setExpandedFeed,
  cardClass,
}: {
  title: string;
  feeds: FeedOverview[];
  category: FeedCategory;
  expandedFeed: string | null;
  setExpandedFeed: (name: string | null) => void;
  cardClass?: string;
}) {
  if (feeds.length === 0) return null;

  return (
    <div>
      <div className={cn('font-mono text-[10px] font-bold uppercase tracking-widest mb-3', cardClass)}>
        {title}
        <span className="text-white/30 ml-2 font-normal">{feeds.length}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {feeds.map(feed => (
          <FeedCard
            key={feed.feed_name}
            feed={feed}
            category={category}
            isExpanded={expandedFeed === feed.feed_name}
            onToggle={() =>
              setExpandedFeed(expandedFeed === feed.feed_name ? null : feed.feed_name)
            }
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Mobile Feed Row ─── */

function MobileFeedRow({ feed }: { feed: FeedOverview }) {
  const category = categorizeFeed(feed);
  const rate = successRate(feed);

  const dotClass = cn(
    'w-2 h-2 rounded-full flex-shrink-0',
    category === 'healthy' && 'bg-green-400',
    category === 'attention' && 'bg-amber-400 animate-pulse',
    category === 'disabled' && 'border border-white/20',
  );

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
      <div className={dotClass} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-parchment truncate">{feed.display_name}</div>
        <div className="text-[10px] font-mono text-white/40">
          {humanizeCron(feed.schedule_cron)} · {timeAgo(feed.last_run)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[12px] font-bold font-mono text-parchment">
          {formatNumber(feed.total_ingested)}
        </div>
        <div className="text-[9px] font-mono text-white/40">{rate}%</div>
      </div>
    </div>
  );
}

/* ─── Mobile Feeds ─── */

function MobileFeeds({ feeds }: { feeds: FeedOverview[] }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'healthy' | 'attention' | 'disabled'>('all');

  const active = feeds.filter(f => f.enabled).length;
  const disabled = feeds.filter(f => !f.enabled).length;
  const totalIngested = feeds.reduce((s, f) => s + f.total_ingested, 0);
  const lastSync = feeds.reduce((latest, f) => {
    if (!f.last_run) return latest;
    return !latest || new Date(f.last_run) > new Date(latest) ? f.last_run : latest;
  }, null as string | null);

  const filtered = useMemo(() => {
    if (filter === 'all') return feeds;
    return feeds.filter(f => categorizeFeed(f) === filter);
  }, [feeds, filter]);

  const filterChips = useMemo(() => [
    { label: `All (${feeds.length})`, active: filter === 'all', onClick: () => setFilter('all') },
    { label: 'Healthy', active: filter === 'healthy', onClick: () => setFilter('healthy') },
    { label: 'Attention', active: filter === 'attention', onClick: () => setFilter('attention') },
    { label: 'Disabled', active: filter === 'disabled', onClick: () => setFilter('disabled') },
  ], [filter, feeds.length]);

  return (
    <div className="fixed inset-0 bg-cockpit flex flex-col">
      <DrillHeader title="INTEL FEEDS" badge={`${feeds.length}`} onBack={() => navigate('/v2/')} />

      <div className="flex-1 overflow-y-auto pt-[52px] pb-[120px]">
        <div className="p-4 space-y-3">
          <HeroStatGrid stats={[
            { label: 'ACTIVE FEEDS', value: String(active), color: '#4ADE80' },
            { label: 'DISABLED', value: String(disabled), color: disabled > 0 ? '#78A0C8' : 'rgba(255,255,255,0.3)' },
            { label: 'TOTAL INGESTED', value: totalIngested.toLocaleString(), color: '#78A0C8' },
            { label: 'LAST SYNC', value: lastSync ? timeAgo(lastSync) : 'Never', color: '#F0EDE8' },
          ]} />
        </div>
      </div>

      <MobileBottomSheet
        peekHeight={110}
        halfHeight={380}
        fullHeight={550}
        defaultState="half"
        headerLeft={
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono font-bold tracking-wider text-parchment">FEED STATUS</span>
            <span className="text-[9px] font-mono text-contrail/40">{filtered.length}</span>
          </div>
        }
        headerRight={<MobileFilterChips filters={filterChips} />}
      >
        <div className="flex flex-col">
          {filtered.map(feed => (
            <MobileFeedRow key={feed.feed_name} feed={feed} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 font-mono text-sm text-contrail/30">No feeds found</div>
          )}
        </div>
      </MobileBottomSheet>
    </div>
  );
}

/* ─── Page ─── */

export function Feeds() {
  const isMobile = useMobile();
  const { data: feeds, isLoading } = useFeeds();
  const [expandedFeed, setExpandedFeed] = useState<string | null>(null);

  const grouped = useMemo(() => {
    if (!feeds) return { healthy: [], attention: [], disabled: [] };
    const healthy: FeedOverview[] = [];
    const attention: FeedOverview[] = [];
    const disabled: FeedOverview[] = [];
    for (const f of feeds) {
      const cat = categorizeFeed(f);
      if (cat === 'healthy') healthy.push(f);
      else if (cat === 'attention') attention.push(f);
      else disabled.push(f);
    }
    return { healthy, attention, disabled };
  }, [feeds]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-parchment font-display">Feeds</h1>
          <p className="text-sm text-contrail/50 font-mono mt-1">Threat intelligence feed sources</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const allFeeds = feeds ?? [];

  if (isMobile) return <MobileFeeds feeds={allFeeds} />;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-parchment font-display">Feeds</h1>
          <p className="text-sm text-contrail/50 font-mono mt-1">
            {allFeeds.length} feed configurations &middot; Threat intelligence ingestion
          </p>
        </div>
        <TriggerAllButton />
      </div>

      {/* 1. Header stats */}
      <HeaderStats feeds={allFeeds} />

      {/* 2. Attention banner */}
      <AttentionBanner feeds={allFeeds} />

      {/* 3. Feed health strip */}
      <FeedHealthStrip feeds={allFeeds} />

      {/* 4. Feed sections */}
      <div className="space-y-6">
        <FeedSection
          title="Healthy Feeds"
          feeds={grouped.healthy}
          category="healthy"
          expandedFeed={expandedFeed}
          setExpandedFeed={setExpandedFeed}
          cardClass="text-green-400"
        />
        <FeedSection
          title="Needs Attention"
          feeds={grouped.attention}
          category="attention"
          expandedFeed={expandedFeed}
          setExpandedFeed={setExpandedFeed}
          cardClass="text-amber-400"
        />
        <FeedSection
          title="Disabled"
          feeds={grouped.disabled}
          category="disabled"
          expandedFeed={expandedFeed}
          setExpandedFeed={setExpandedFeed}
          cardClass="text-white/40"
        />
      </div>
    </div>
  );
}
