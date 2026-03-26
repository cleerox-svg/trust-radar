import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface TrendVolume {
  labels: string[];
  values: number[];
  high_sev: number[];
  active: number[];
}

interface TrendSeries {
  labels: string[];
  series: Array<{ name: string; values: number[] }>;
}

export function useThreatTrends(options?: { period?: string }) {
  const { period = '30d' } = options || {};
  return useQuery({
    queryKey: ['threat-trends', period],
    queryFn: async () => {
      const res = await api.get<TrendVolume>(`/api/trends/volume?period=${period}`);
      return res.data || { labels: [], values: [], high_sev: [], active: [] };
    },
  });
}

export function useThreatBreakdown(options?: { period?: string }) {
  const { period = '30d' } = options || {};
  return useQuery({
    queryKey: ['threat-breakdown', period],
    queryFn: async () => {
      const res = await api.get<TrendSeries>(`/api/trends/types?period=${period}`);
      return res.data || { labels: [], series: [] };
    },
  });
}

export function useCountryBreakdown(options?: { period?: string }) {
  const { period = '30d' } = options || {};
  return useQuery({
    queryKey: ['country-breakdown', period],
    queryFn: async () => {
      const res = await api.get<TrendSeries>(`/api/trends/providers?period=${period}`);
      return res.data || { labels: [], series: [] };
    },
  });
}

export function useFeedBreakdown(options?: { period?: string }) {
  const { period = '30d' } = options || {};
  return useQuery({
    queryKey: ['feed-breakdown', period],
    queryFn: async () => {
      const res = await api.get<TrendSeries>(`/api/trends/tlds?period=${period}`);
      return res.data || { labels: [], series: [] };
    },
  });
}
