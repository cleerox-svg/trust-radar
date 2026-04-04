import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { severityColor } from '@/lib/severityColor';
import { relativeTime } from '@/lib/time';

interface Threat {
  id: string;
  threat_type: string;
  severity: string | null;
  status: string;
  malicious_domain: string | null;
  malicious_url: string | null;
  ip_address: string | null;
  target_brand_id: string | null;
  country_code: string | null;
  created_at: string;
}

function severityWeight(s: string | null): number {
  if (s === 'critical') return 200;
  if (s === 'high') return 100;
  if (s === 'medium') return 50;
  return 1;
}

export function Threats() {
  const [status, setStatus] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['threats', status, severity, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      if (status) params.set('status', status);
      if (severity) params.set('severity', severity);
      const res = await api.get<{ threats: Threat[]; total: number }>(`/api/threats?${params}`);
      if (!res.success || !res.data) throw new Error(res.error ?? 'Failed');
      return res.data;
    },
  });

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <SectionLabel>Threats</SectionLabel>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="glass-input rounded-md px-3 py-1.5 font-mono text-[11px] text-parchment bg-instrument border border-white/10"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="down">Down</option>
          <option value="remediated">Remediated</option>
        </select>
        <select
          value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(0); }}
          className="glass-input rounded-md px-3 py-1.5 font-mono text-[11px] text-parchment bg-instrument border border-white/10"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {data && (
          <span className="font-mono text-[11px] text-contrail/50 self-center ml-auto">
            {data.total} total
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (
        <>
          <div className="glass-card rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">Type</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">Domain</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">IP</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">Severity</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">Status</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-contrail/50 px-4 py-2">Detected</th>
                </tr>
              </thead>
              <tbody>
                {(data?.threats ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-[11px] text-parchment/80">{t.threat_type}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-contrail truncate max-w-[200px]">{t.malicious_domain ?? '-'}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-contrail/70">{t.ip_address ?? '-'}</td>
                    <td className="px-4 py-2">
                      <span
                        className="font-mono text-[10px] font-bold uppercase"
                        style={{ color: severityColor(null, severityWeight(t.severity)) }}
                      >
                        {t.severity ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-contrail/60">{t.status}</td>
                    <td className="px-4 py-2 font-mono text-[10px] text-contrail/50">{relativeTime(t.created_at)}</td>
                  </tr>
                ))}
                {(data?.threats ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center font-mono text-[11px] text-contrail/40">
                      No threats found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > limit && (
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="font-mono text-[11px] text-contrail/60 hover:text-parchment disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="font-mono text-[10px] text-contrail/40">
                Page {page + 1} of {Math.ceil(data.total / limit)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * limit >= data.total}
                className="font-mono text-[11px] text-contrail/60 hover:text-parchment disabled:opacity-30 disabled:cursor-not-allowed"
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
