import { useState, useMemo } from 'react';
import { useSpamTrapAddresses } from '@/hooks/useSpamTrap';
import type { SeedAddress } from '@/hooks/useSpamTrap';
import { Skeleton } from '@/components/ui/Skeleton';

const CHANNEL_COLORS: Record<string, string> = {
  employee: '#00D4FF',
  contact_page: '#A78BFA',
  whois: '#fb923c',
  forum: '#4ADE80',
  generic: 'rgba(255,255,255,0.3)',
};

const PAGE_SIZE = 15;

export function HoneypotNetworkPanel() {
  const { data: addresses, isLoading, isError, refetch } = useSpamTrapAddresses();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

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
      <div className="font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-4">
        Honeypot Network
      </div>

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

      {/* Table */}
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
    </div>
  );
}
