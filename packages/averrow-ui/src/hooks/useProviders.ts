import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Provider {
  id: string;
  name: string;
  asn: string | null;
  country: string | null;
  active_threat_count: number;
  total_threat_count: number;
  trend_7d: number | null;
  trend_30d: number | null;
  trend_90d: number | null;
  avg_response_time: number | null;
  reputation_score: number | null;
}

interface ProviderDetail {
  id: string;
  name: string;
  asn: string | null;
  country: string | null;
  reputation_score: number | null;
  avg_response_time: number | null;
  total_threats: number;
  active_threats: number;
  brands_targeted: number;
  campaigns: number;
  first_seen: string;
  last_seen: string;
  brand_breakdown: Array<{ brand_id: string | null; brand_name: string | null; count: number }>;
  type_breakdown: Array<{ threat_type: string; count: number }>;
}

export function useProviders(options?: { view?: string; limit?: number; offset?: number; timeRange?: string }) {
  const { view = 'worst', limit = 20, offset = 0, timeRange = '7d' } = options || {};
  return useQuery({
    queryKey: ['providers', view, limit, offset, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({ view, limit: String(limit), offset: String(offset), range: timeRange });
      const res = await api.get<Provider[]>(`/api/providers?${params}`);
      return res.data ?? [];
    },
  });
}

export function useProviderDetail(providerId: string) {
  return useQuery({
    queryKey: ['provider', providerId],
    queryFn: async () => {
      const res = await api.get<ProviderDetail>(`/api/providers/${providerId}`);
      return res.data || null;
    },
    enabled: !!providerId,
  });
}

export function useProviderThreats(providerId: string, options?: { limit?: number; offset?: number; type?: string }) {
  const { limit = 20, offset = 0, type } = options || {};
  return useQuery({
    queryKey: ['provider-threats', providerId, limit, offset, type],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (type) params.set('type', type);
      const res = await api.get<unknown>(`/api/providers/${providerId}/threats?${params}`);
      return res.data ?? [];
    },
    enabled: !!providerId,
  });
}
