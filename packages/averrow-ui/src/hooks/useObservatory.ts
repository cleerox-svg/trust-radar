import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ThreatPoint {
  lat: number;
  lng: number;
  threat_count: number;
  top_severity: string | null;
  critical: number;
  high: number;
  medium: number;
  low: number;
  country_code: string | null;
  top_threat_type: string | null;
}

export interface ObservatoryStats {
  threats_mapped: number;
  countries: number;
  active_campaigns: number;
  brands_monitored: number;
  period: string;
}

export interface ArcData {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  threat_type: string;
  severity: string;
  source_region: string;
  target_brand: string;
  brand_name: string | null;
  volume: number;
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
      const params = new URLSearchParams({ period, source_feed: source === 'all' ? '' : source, limit: String(limit) });
      const res = await api.get<ThreatPoint[]>(`/api/observatory/nodes?${params}`);
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
      const params = new URLSearchParams({ period, source_feed: source === 'all' ? '' : source });
      const res = await api.get<any>(`/api/observatory/stats?${params}`);
      // Handle double-wrapped response
      const data = res.data?.data || res.data || res;
      return data as ObservatoryStats;
    },
    refetchInterval: 120_000,
  });
}

export function useObservatoryArcs(options?: { period?: string; source?: string }) {
  const { period = '7d', source = 'all' } = options || {};

  return useQuery({
    queryKey: ['observatory-arcs', period, source],
    queryFn: async () => {
      const params = new URLSearchParams({ period, source_feed: source === 'all' ? '' : source });
      const res = await api.get<ArcData[]>(`/api/observatory/arcs?${params}`);
      return res.data || [];
    },
    refetchInterval: 120_000,
  });
}

// TODO: /api/observatory/countries endpoint does not exist yet
export function useObservatoryCountries() {
  return useQuery({
    queryKey: ['observatory-countries'],
    queryFn: async () => [] as CountryCluster[],
    enabled: false,
  });
}
