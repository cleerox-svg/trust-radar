import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Provider {
  id: string;
  name: string;
  asn: string | null;
  country: string | null;
  active_threat_count: number;
  total_threat_count: number;
  trend_7d: number;
  trend_30d: number;
  trend_90d: number;
  avg_response_time: number | null;
  reputation_score: number | null;
}

interface ProviderDetail extends Provider {
  description: string | null;
  threats: unknown[];
  threat_type_breakdown: Array<{ threat_type: string; count: number }>;
  target_brands: Array<{ brand_id: string; brand_name: string; count: number }>;
  ai_assessment: string | null;
  countries: Array<{ country_code: string; count: number }>;
}

export function useProviders(options?: { view?: string; limit?: number; offset?: number; timeRange?: string }) {
  const { view = 'worst', limit = 20, offset = 0, timeRange = '7d' } = options || {};
  return useQuery({
    queryKey: ['providers', view, limit, offset, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({ view, limit: String(limit), offset: String(offset), range: timeRange });
      const res = await api.get<Provider[]>(`/api/providers?${params}`);
      return res;
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
      return res;
    },
    enabled: !!providerId,
  });
}
