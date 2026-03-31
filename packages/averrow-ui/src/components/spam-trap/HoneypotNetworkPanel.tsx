import { useState, useMemo } from 'react';
import { useSpamTrapAddresses, useSeedingSources } from '@/hooks/useSpamTrap';
import type { SeedAddress } from '@/hooks/useSpamTrap';
import { Skeleton } from '@/components/ui/Skeleton';

const CHANNEL_COLORS: Record<string, string> = {
  employee: '#00D4FF',
  contact_page: '#A78BFA',
  whois: '#fb923c',
  forum: '#4ADE80',
  generic: 'rgba(255,255,255,0.3)',
};

const SOURCE_COLORS: Record<string, string> = {
  spider: '#00D4FF',
  broker: '#A78BFA',
  paste: '#fb923c',
  honeypot: '#f87171',
  directory: '#4ADE80',
};

const PAGE_SIZE = 15;

export function HoneypotNetworkPanel() {
  const { data: addresses, isLoading, isError, refetch } = useSpamTrapAddresses();
  const { data: seedingData } = useSeedingSources();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<'network' | 'sources' | 'activity'>('network');

  const filtered = useMemo(() => {
    if (!addresses) return [];
    if (!search.trim()) return addresses;
    const q = search.toLowerCase();
    return addresses.filter(
      (a: SeedAddress) =>
        a.address.toLowerCase().includes(q) ||
        a.domain.toLowerCase().includes(q) ||
        a.channel.toLowerCase().includes(q),
    );
  }, [addresses, search]);

  const channelCounts = useMemo(() => {
    if (!addresses) return [];
    const map: Record<string, number> = {};
    for (const a of addresses) {
      map[a.channel] = (map[a.channel] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [addresses]);

  const maxCount = channelCounts.length > 0 ? channelCounts[0][1] : 1;

  // Group seeding sources by type prefix (spider:*, broker:*, etc.)
  const seedingGroups = useMemo(() => {
    if (!seedingData?.sources) return [];
    const groups: Record<string, { seeds: number; catches: number; locations: string[] }> = {};
    for (const s of seedingData.sources) {
      const prefix = s.location.split(':')[0] || 'other';
      if (!groups[prefix]) groups[prefix] = { seeds: 0, catches: 0, locations: [] };
      groups[prefix].seeds += s.seeds;
      groups[prefix].catches += s.catches;
      groups[prefix].locations.push(s.location);
    }
    return Object.entries(groups).sort((a, b) => b[1].seeds - a[1].seeds);
  }, [seedingData]);

  const maxSourceSeeds = seedingGroups.length > 0 ? seedingGroups[0][1].seeds : 1;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when search changes
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  if (isError) {
    return (
      <div className="glass-card rounded-xl p-4 min-h-[400px] flex flex-col items-center justify-center gap-3">
        <span className="text-white/40 text-sm font-mono">Unable to load seed addresses</span>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-white/60 transition-colors"
        >
          RETRY
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4 min-h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70">
          Honeypot Network
        </div>
        <div className="flex gap-1">
          {(['network', 'sources', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'bg-white/10 text-white/80'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: NETWORK (original channel bars + address table) ── */}
      {activeTab === 'network' && (
        <>
          {/* Channel breakdown bars */}
          {isLoading ? (
            <div className="space-y-2 mb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 mb-4">
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1">
                Seeds by Channel
              </div>
              {channelCounts.map(([channel, count]) => (
                <div key={channel} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-white/50 w-[100px] truncate">
                    {channel}
                  </span>
                  <div className="flex-1 h-4 bg-white/5 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all"
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        backgroundColor: CHANNEL_COLORS[channel] || 'rgba(255,255,255,0.3)',
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-white/40 w-6 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search address, domain, or channel..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="glass-input w-full mb-3 text-xs"
          />
        </>
      )}

      {/* ── TAB: SEEDING SOURCES ── */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          {/* Source type breakdown */}
          <div className="space-y-1.5">
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1">
              Seeds by Source Type
            </div>
            {seedingGroups.map(([type, data]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-white/50 w-[80px] truncate capitalize">
                  {type}
                </span>
                <div className="flex-1 h-4 bg-white/5 rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${(data.seeds / maxSourceSeeds) * 100}%`,
                      backgroundColor: SOURCE_COLORS[type] || 'rgba(255,255,255,0.3)',
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-white/40 w-8 text-right">
                  {data.seeds}
                </span>
                {data.catches > 0 && (
                  <span className="font-mono text-[10px] text-red-400 w-8 text-right">
                    {data.catches}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Detailed location breakdown */}
          {seedingData?.sources && seedingData.sources.length > 0 && (
            <div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">
                Seeding Locations
              </div>
              <div className="space-y-1">
                {seedingData.sources.map((s) => (
                  <div key={s.location} className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                    <span className="font-mono text-[10px] text-white/60">{s.location}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-white/40">{s.seeds} seeds</span>
                      <span className={`font-mono text-[10px] ${s.catches > 0 ? 'text-red-400 font-semibold' : 'text-white/20'}`}>
                        {s.catches > 0 ? `${s.catches} caught` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {seedingGroups.length === 0 && (
            <div className="text-center py-6">
              <span className="text-white/20 text-xs font-mono">No seeding source data available</span>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: HONEYPOT ACTIVITY ── */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {/* Activity summary */}
          {seedingData?.honeypot_visits && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <div className="font-mono text-xl font-bold text-white/90">{seedingData.honeypot_visits.total}</div>
                  <div className="font-mono text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Total Visits</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <div className="font-mono text-xl font-bold text-red-400">{seedingData.honeypot_visits.bots}</div>
                  <div className="font-mono text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Bot Visits</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <div className="font-mono text-xl font-bold text-orbital-teal">{seedingData.honeypot_visits.last_24h}</div>
                  <div className="font-mono text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Last 24h</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                  <div className="font-mono text-xl font-bold text-white/90">{seedingData.honeypot_visits.unique_bots}</div>
                  <div className="font-mono text-[9px] text-white/40 uppercase tracking-wider mt-0.5">Unique Bots</div>
                </div>
              </div>

              {seedingData.honeypot_visits.total > 0 && (
                <p className="text-[11px] text-white/40 font-mono text-center">
                  Your honeypots have been crawled {seedingData.honeypot_visits.total} times by {seedingData.honeypot_visits.unique_bots} unique bots
                </p>
              )}

              {/* Visits by page */}
              {seedingData.honeypot_visits.by_page.length > 0 && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">
                    Visits by Page
                  </div>
                  {seedingData.honeypot_visits.by_page.map((p) => (
                    <div key={p.page} className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
                      <span className="font-mono text-[11px] text-white/60">{p.page}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-white/40">{p.visits} visits</span>
                        <span className="font-mono text-[10px] text-red-400">{p.bots} bots</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent crawlers */}
              {seedingData.honeypot_visits.recent_crawlers.length > 0 && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">
                    Recent Crawlers
                  </div>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {seedingData.honeypot_visits.recent_crawlers.map((c, i) => (
                      <div key={i} className="rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-red-400 font-semibold">
                            {c.bot_name || 'unknown'}
                          </span>
                          <span className="font-mono text-[9px] text-white/30">
                            {c.visited_at ? new Date(c.visited_at + 'Z').toLocaleString() : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-white/50">{c.page}</span>
                          {c.visitor_ip && (
                            <span className="font-mono text-[10px] text-white/30">{c.visitor_ip}</span>
                          )}
                          {c.country && (
                            <span className="font-mono text-[10px] text-white/30">{c.country}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!seedingData?.honeypot_visits && (
            <div className="text-center py-6">
              <span className="text-white/20 text-xs font-mono">No honeypot visit data yet</span>
            </div>
          )}
        </div>
      )}

      {/* Table — only on network tab */}
      {activeTab === 'network' && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="font-mono text-[9px] uppercase tracking-wider text-white/30 pb-2 pr-2">Address</th>
                  <th className="font-mono text-[9px] uppercase tracking-wider text-white/30 pb-2 pr-2">Channel</th>
                  <th className="font-mono text-[9px] uppercase tracking-wider text-white/30 pb-2 pr-2">Location</th>
                  <th className="font-mono text-[9px] uppercase tracking-wider text-white/30 pb-2 pr-2">Catches</th>
                  <th className="font-mono text-[9px] uppercase tracking-wider text-white/30 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-2"><Skeleton className="h-4 w-40" /></td>
                        <td className="py-2 pr-2"><Skeleton className="h-4 w-20" /></td>
                        <td className="py-2 pr-2"><Skeleton className="h-4 w-28" /></td>
                        <td className="py-2 pr-2"><Skeleton className="h-4 w-8" /></td>
                        <td className="py-2"><Skeleton className="h-4 w-4" /></td>
                      </tr>
                    ))
                  : pageItems.map((addr: SeedAddress) => (
                      <tr key={addr.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 pr-2">
                          <span
                            className="font-mono text-[11px] text-parchment/80 block truncate max-w-[200px]"
                            title={addr.address}
                          >
                            {addr.address.length > 30 ? addr.address.slice(0, 30) + '…' : addr.address}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <span
                            className="badge-glass text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{ color: CHANNEL_COLORS[addr.channel] || 'rgba(255,255,255,0.5)' }}
                          >
                            {addr.channel}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <span
                            className="text-[11px] text-white/40 block truncate max-w-[220px]"
                            title={addr.seeded_location || ''}
                          >
                            {addr.seeded_location
                              ? addr.seeded_location.length > 35
                                ? addr.seeded_location.slice(0, 35) + '…'
                                : addr.seeded_location
                              : '—'}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          {addr.total_catches > 0 ? (
                            <span className="font-mono text-[11px] text-red-400 font-semibold">{addr.total_catches}</span>
                          ) : (
                            <span className="font-mono text-[11px] text-white/20">—</span>
                          )}
                        </td>
                        <td className="py-2">
                          <span
                            className={addr.status === 'active' ? 'dot-pulse dot-pulse-green' : 'dot-pulse dot-pulse-gray'}
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-6">
              <span className="text-white/20 text-xs font-mono">
                {search ? 'No matching addresses' : 'No seed addresses deployed'}
              </span>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-mono text-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              <span className="font-mono text-[10px] text-white/30">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-mono text-white/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
