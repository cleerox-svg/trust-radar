import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { feeds, type FeedSchedule, type FeedStatsData } from "../lib/api";
import { Card, CardContent, Badge, Button } from "../components/ui";
import { StatusDot } from "../components/ui/StatusDot";

const tierLabels: Record<number, string> = {
  1: "Real-time Critical",
  2: "High Priority",
  3: "Standard",
  4: "Social / OSINT",
  5: "API-dependent",
  6: "Enrichment",
};

function FeedStatusBadge({ feed }: { feed: FeedSchedule }) {
  if (feed.circuit_open) return <Badge variant="critical">Circuit Open</Badge>;
  if (!feed.enabled) return <Badge variant="info">Disabled</Badge>;
  if (feed.consecutive_failures > 0) return <Badge variant="medium">Failing ({feed.consecutive_failures})</Badge>;
  return <Badge variant="low">Active</Badge>;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function FeedAnalyticsPage() {
  const qc = useQueryClient();
  const { data: feedList, isLoading: loadingFeeds } = useQuery({ queryKey: ["feeds"], queryFn: feeds.list });
  const { data: stats } = useQuery({ queryKey: ["feed-stats"], queryFn: feeds.stats });

  const triggerMut = useMutation({
    mutationFn: (id: string) => feeds.trigger(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feeds"] }); qc.invalidateQueries({ queryKey: ["feed-stats"] }); },
  });
  const resetMut = useMutation({
    mutationFn: (id: string) => feeds.resetCircuit(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feeds"] }); },
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => feeds.update(id, { enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feeds"] }); },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] mb-1">Feed Analytics</h1>
        <p className="text-sm text-[--text-secondary]">Intelligence feed performance, ingestion KPIs, and circuit status</p>
      </div>

      {/* Summary Cards */}
      {stats && <SummaryCards stats={stats} />}

      {/* Tier Breakdown */}
      {stats && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">By Tier</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {stats.byTier.map((t) => (
                <div key={t.tier} className="p-3 rounded-lg bg-[--surface-base] border border-[--border-subtle]">
                  <div className="text-xs text-[--text-tertiary] mb-1">Tier {t.tier}</div>
                  <div className="text-sm font-medium text-[--text-primary]">{tierLabels[t.tier] ?? `Tier ${t.tier}`}</div>
                  <div className="mt-2 text-xs text-[--text-secondary]">
                    {t.count} feeds &middot; {t.runs ?? 0} runs &middot; {t.items ?? 0} items
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed Table */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">All Feeds ({feedList?.length ?? 0})</h3>
          {loadingFeeds ? (
            <div className="text-sm text-[--text-tertiary] py-8 text-center">Loading feeds...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-subtle] text-left text-xs text-[--text-tertiary]">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Feed</th>
                    <th className="pb-2 pr-4">Tier</th>
                    <th className="pb-2 pr-4">Interval</th>
                    <th className="pb-2 pr-4">Last Run</th>
                    <th className="pb-2 pr-4">Runs</th>
                    <th className="pb-2 pr-4">Items</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(feedList ?? []).map((feed) => (
                    <tr key={feed.id} className="border-b border-[--border-subtle] last:border-0">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <StatusDot variant={feed.circuit_open ? "alert" : feed.enabled ? "active" : "offline"} />
                          <FeedStatusBadge feed={feed} />
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="font-medium text-[--text-primary]">{feed.display_name}</div>
                        <div className="text-xs text-[--text-tertiary]">{feed.feed_name}{feed.requires_key ? " (key)" : ""}</div>
                      </td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{feed.tier}</td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{feed.interval_mins}m</td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{timeAgo(feed.last_run_at)}</td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{feed.total_runs}</td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{feed.total_items}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMut.mutate({ id: feed.id, enabled: !feed.enabled })}
                          >
                            {feed.enabled ? "Disable" : "Enable"}
                          </Button>
                          {feed.circuit_open ? (
                            <Button variant="ghost" size="sm" onClick={() => resetMut.mutate(feed.id)}>
                              Reset
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={triggerMut.isPending}
                              onClick={() => triggerMut.mutate(feed.id)}
                            >
                              Run
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Ingestions */}
      {stats && stats.recentIngestions.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Recent Ingestions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-subtle] text-left text-xs text-[--text-tertiary]">
                    <th className="pb-2 pr-4">Feed</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">New</th>
                    <th className="pb-2 pr-4">Dupes</th>
                    <th className="pb-2 pr-4">Errors</th>
                    <th className="pb-2 pr-4">Threats</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentIngestions.slice(0, 20).map((ing, i) => (
                    <tr key={i} className="border-b border-[--border-subtle] last:border-0">
                      <td className="py-2 pr-4 font-medium text-[--text-primary]">{ing.feed_name ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={ing.status === "success" ? "low" : "critical"}>{ing.status}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{ing.items_new}</td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{ing.items_duplicate}</td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{ing.items_error}</td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{ing.threats_created}</td>
                      <td className="py-2 pr-4 text-[--text-secondary]">{formatDuration(ing.duration_ms)}</td>
                      <td className="py-2 text-[--text-tertiary]">{timeAgo(ing.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCards({ stats }: { stats: FeedStatsData }) {
  const s = stats.summary;
  const cards = [
    { label: "Total Feeds", value: s.total_feeds, sub: `${s.enabled_feeds} enabled` },
    { label: "Circuit Breakers Open", value: s.circuit_open, sub: s.circuit_open > 0 ? "Needs attention" : "All healthy" },
    { label: "Total Runs", value: s.total_runs, sub: "Lifetime" },
    { label: "Total Items Ingested", value: s.total_items, sub: "Across all feeds" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent>
            <div className="text-xs text-[--text-tertiary] mb-1">{c.label}</div>
            <div className="text-2xl font-bold text-[--text-primary]">{c.value ?? 0}</div>
            <div className="text-xs text-[--text-secondary] mt-1">{c.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
