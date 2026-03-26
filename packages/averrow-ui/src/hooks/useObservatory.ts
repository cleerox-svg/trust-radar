import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ThreatPoint {
  id: string;
  lat: number;
  lng: number;
  threat_type: string;
  severity: string;
  target_brand_id: string | null;
  brand_name: string | null;
  malicious_domain: string | null;
  hosting_provider: string | null;
  country_code: string | null;
  source_feed: string;
  created_at: string;
}

interface ObservatoryStats {
  total_threats: number;
  active_threats: number;
  countries: number;
  brands_affected: number;
  providers: number;
  threats_24h: number;
}

interface ArcData {
  source_lat: number;
  source_lng: number;
  target_lat: number;
  target_lng: number;
  threat_type: string;
  severity: string;
  brand_name: string | null;
  count: number;
}

interface CountryCluster {
  country_code: string;
  country_name: string;
  lat: number;
  lng: number;
  threat_count: number;
  top_type: string;
}

export function useObservatoryThreats(options?: { period?: string; source?: string; limit?: number }) {
  const { period = '7d', source = 'all', limit = 2000 } = options || {};

  return useQuery({
    queryKey: ['observatory-threats', period, source, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ period, source, limit: String(limit) });
      const res = await api.get<ThreatPoint[]>(`/api/observatory/threats?${params}`);
      return res.data || [];
    },
    refetchInterval: 120_000,
  });
}

export function useObservatoryStats(options?: { period?: string; source?: string }) {
  const { period = '7d', source = 'all' } = options || {};

  return useQuery({
    queryKey: ['observatory-stats', period, source],
    queryFn: async () => {
      const params = new URLSearchParams({ period, source });
      const res = await api.get<ObservatoryStats>(`/api/observatory/stats?${params}`);
      return res.data || null;
    },
    refetchInterval: 120_000,
  });
}

export function useObservatoryArcs(options?: { period?: string; source?: string }) {
  const { period = '7d', source = 'all' } = options || {};

  return useQuery({
    queryKey: ['observatory-arcs', period, source],
    queryFn: async () => {
      const params = new URLSearchParams({ period, source });
      const res = await api.get<ArcData[]>(`/api/observatory/arcs?${params}`);
      return res.data || [];
    },
    refetchInterval: 120_000,
  });
}

export function useObservatoryCountries(options?: { period?: string; source?: string }) {
  const { period = '7d', source = 'all' } = options || {};

  return useQuery({
    queryKey: ['observatory-countries', period, source],
    queryFn: async () => {
      const params = new URLSearchParams({ period, source });
      const res = await api.get<CountryCluster[]>(`/api/observatory/countries?${params}`);
      return res.data || [];
    },
    refetchInterval: 120_000,
  });
}
