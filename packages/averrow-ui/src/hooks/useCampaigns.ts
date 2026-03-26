import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Campaign {
  id: string;
  name: string;
  first_seen: string;
  last_seen: string;
  threat_count: number;
  brand_count: number;
  provider_count: number;
  domain_count: number;
  attack_pattern: string | null;
  status: string;
  severity: string | null;
}

interface CampaignDetail extends Campaign {
  threats: unknown[];
  brands: Array<{ brand_id: string; brand_name: string; count: number }>;
  providers: Array<{ provider_id: string; provider_name: string; count: number }>;
  ai_assessment: string | null;
  timeline: Array<{ date: string; count: number }>;
}

export function useCampaigns(options?: { status?: string; limit?: number; offset?: number }) {
  const { status = 'active', limit = 50, offset = 0 } = options || {};
  return useQuery({
    queryKey: ['campaigns', status, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ status, limit: String(limit), offset: String(offset) });
      const res = await api.get<Campaign[]>(`/api/campaigns?${params}`);
      return res;
    },
  });
}

export function useCampaignStats() {
  return useQuery({
    queryKey: ['campaign-stats'],
    queryFn: async () => {
      const res = await api.get<unknown>('/api/campaigns/stats');
      return res.data || null;
    },
  });
}

export function useCampaignDetail(campaignId: string) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      const res = await api.get<CampaignDetail>(`/api/campaigns/${campaignId}`);
      return res.data || null;
    },
    enabled: !!campaignId,
  });
}
