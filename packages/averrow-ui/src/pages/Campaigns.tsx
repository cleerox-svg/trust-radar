import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaigns, useCampaignStats } from '@/hooks/useCampaigns';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';

function statusVariant(status: string): 'critical' | 'info' | 'success' | 'default' {
  if (status === 'active') return 'critical';
  if (status === 'dormant') return 'info';
  if (status === 'disrupted') return 'success';
  return 'default';
}

function severityVariant(severity: string | null): 'critical' | 'high' | 'medium' | 'low' | 'default' {
  if (!severity) return 'default';
  const s = severity.toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'medium') return 'medium';
  if (s === 'low') return 'low';
  return 'default';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Campaigns() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('active');
  const { data: statsData } = useCampaignStats() as { data: Record<string, number> | null };
  const { data: campaignsRes, isLoading } = useCampaigns({ status });

  const campaigns = campaignsRes?.data || [];
  const total = campaignsRes?.total || campaigns.length;

  const tabs = [
    { id: 'active', label: 'ACTIVE', count: total },
    { id: 'dormant', label: 'DORMANT' },
    { id: 'disrupted', label: 'DISRUPTED' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-display text-xl font-bold text-parchment">Campaign Intelligence</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Campaigns" value={statsData?.active ?? '—'} />
        <StatCard label="Dormant" value={statsData?.dormant ?? '—'} />
        <StatCard label="Disrupted" value={statsData?.disrupted ?? '—'} />
        <StatCard label="Brands Affected" value={statsData?.brands_affected ?? '—'} />
      </div>

      <Tabs tabs={tabs} activeTab={status} onChange={setStatus} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(campaign => (
            <Card
              key={campaign.id}
              className="cursor-pointer"
              hover
            >
              <div
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
                className="space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="font-display font-semibold text-parchment truncate">{campaign.name}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                    {campaign.severity && (
                      <Badge variant={severityVariant(campaign.severity)}>{campaign.severity}</Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <div className="font-display text-lg font-bold text-parchment">{campaign.threat_count}</div>
                    <div className="font-mono text-[9px] text-contrail/40 uppercase">Threats</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display text-lg font-bold text-parchment">{campaign.brand_count}</div>
                    <div className="font-mono text-[9px] text-contrail/40 uppercase">Brands</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display text-lg font-bold text-parchment">{campaign.provider_count}</div>
                    <div className="font-mono text-[9px] text-contrail/40 uppercase">Providers</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display text-lg font-bold text-parchment">{campaign.domain_count}</div>
                    <div className="font-mono text-[9px] text-contrail/40 uppercase">Domains</div>
                  </div>
                </div>

                <div className="font-mono text-xs text-contrail/40">
                  {formatDate(campaign.first_seen)} &rarr; {formatDate(campaign.last_seen)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
