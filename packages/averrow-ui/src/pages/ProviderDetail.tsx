import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProviderDetail, useProviderThreats } from '@/hooks/useProviders';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, Th, Td } from '@/components/ui/Table';
import { relativeTime } from '@/lib/time';

const THREAT_TYPES = ['all', 'phishing', 'typosquatting', 'impersonation', 'credential_harvesting'] as const;

function trendColor(val: number) {
  if (val < 0) return 'text-positive';
  if (val > 0) return 'text-accent';
  return 'text-contrail/50';
}

function trendArrow(val: number) {
  if (val < 0) return '↓';
  if (val > 0) return '↑';
  return '→';
}

function statusVariant(status: string): 'critical' | 'high' | 'success' | 'default' {
  if (status === 'active' || status === 'malicious') return 'critical';
  if (status === 'suspicious') return 'high';
  if (status === 'resolved' || status === 'taken_down') return 'success';
  return 'default';
}

export function ProviderDetail() {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const [threatType, setThreatType] = useState('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: provider, isLoading } = useProviderDetail(providerId || '');
  const { data: threatsRes } = useProviderThreats(providerId || '', {
    limit,
    offset: page * limit,
    type: threatType === 'all' ? undefined : threatType,
  });

  const threats = (threatsRes?.data ?? []) as Array<{
    id: string;
    url: string;
    threat_type: string;
    brand_name: string;
    first_seen: string;
    status: string;
  }>;
  const threatTotal = threatsRes?.total ?? threats.length;
  const totalPages = Math.ceil(threatTotal / limit);

  const threatTabs = THREAT_TYPES.map(t => ({
    id: t,
    label: t === 'all' ? 'All' : t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }));

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => navigate('/providers')} className="font-mono text-xs text-contrail/50 hover:text-accent transition-colors mb-4">
          &larr; Back to Providers
        </button>
        <Card hover={false}><p className="text-sm text-contrail/60">Provider not found</p></Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={() => navigate('/providers')} className="font-mono text-xs text-contrail/50 hover:text-accent transition-colors">
        &larr; Back to Providers
      </button>

      <div className="flex items-center gap-3">
        <h1 className="font-display text-xl font-bold text-parchment">{provider.name}</h1>
        {provider.asn && <Badge variant="info">{provider.asn}</Badge>}
        {provider.country && <Badge variant="default">{provider.country}</Badge>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Active Threats" value={provider.active_threat_count} />
        <StatCard
          label="7d Trend"
          value={`${trendArrow(provider.trend_7d)} ${Math.abs(provider.trend_7d)}%`}
          className={trendColor(provider.trend_7d)}
        />
        <StatCard
          label="30d Trend"
          value={`${trendArrow(provider.trend_30d)} ${Math.abs(provider.trend_30d)}%`}
          className={trendColor(provider.trend_30d)}
        />
        <StatCard label="Avg Response" value={provider.avg_response_time ? `${provider.avg_response_time}h` : '—'} />
        <StatCard label="Reputation" value={provider.reputation_score ?? '—'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <SectionLabel>Threats Hosted</SectionLabel>
            <Badge variant="info">{threatTotal}</Badge>
          </div>

          <Tabs
            tabs={threatTabs}
            activeTab={threatType}
            onChange={(id) => { setThreatType(id); setPage(0); }}
          />

          <Table>
            <thead>
              <tr>
                <Th>Malicious URL/IP</Th>
                <Th>Type</Th>
                <Th>Target Brand</Th>
                <Th>First Seen</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {threats.map(threat => (
                <tr key={threat.id} className="hover:bg-white/[0.02] transition-colors">
                  <Td>
                    <span className="font-mono text-xs text-parchment/90 break-all">{threat.url}</span>
                  </Td>
                  <Td>
                    <Badge variant="info">{threat.threat_type}</Badge>
                  </Td>
                  <Td>
                    <span className="font-display font-semibold text-sm text-parchment">{threat.brand_name}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-contrail/50">{relativeTime(threat.first_seen)}</span>
                  </Td>
                  <Td>
                    <Badge variant={statusVariant(threat.status)}>{threat.status}</Badge>
                  </Td>
                </tr>
              ))}
              {threats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-sm text-center text-contrail/40 border-b border-white/[0.03]">
                    No threats found
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="font-mono text-xs text-contrail/50 hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                &larr; Previous
              </button>
              <span className="font-mono text-xs text-contrail/40">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="font-mono text-xs text-contrail/50 hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {provider.countries && provider.countries.length > 0 && (
            <Card hover={false}>
              <SectionLabel className="mb-3">Target Locations</SectionLabel>
              <div className="space-y-2">
                {provider.countries.map(c => (
                  <div key={c.country_code} className="flex items-center justify-between">
                    <span className="text-sm text-parchment/80">{c.country_code}</span>
                    <span className="font-mono text-xs text-contrail/50">{c.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {provider.target_brands && provider.target_brands.length > 0 && (
            <Card hover={false}>
              <SectionLabel className="mb-3">Brands Targeted</SectionLabel>
              <div className="space-y-2">
                {provider.target_brands.map(b => {
                  const maxCount = provider.target_brands[0]?.count || 1;
                  const pct = (b.count / maxCount) * 100;
                  return (
                    <div key={b.brand_id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-parchment/80 truncate">{b.brand_name}</span>
                        <span className="font-mono text-xs text-contrail/50">{b.count}</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {provider.ai_assessment && (
            <Card hover={false} className="border-l-[3px] border-accent">
              <SectionLabel className="mb-3">AI Assessment</SectionLabel>
              <p className="text-sm text-parchment/80 whitespace-pre-line leading-relaxed">
                {provider.ai_assessment}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
