import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface TrendData {
  date: string;
  total: number;
  phishing: number;
  typosquatting: number;
  malware_distribution: number;
  credential_harvesting: number;
  impersonation: number;
}

interface ThreatBreakdown {
  threat_type: string;
  count: number;
  percentage: number;
}

interface CountryBreakdown {
  country_code: string;
  count: number;
  percentage: number;
}

interface FeedBreakdown {
  source_feed: string;
  count: number;
  percentage: number;
}

export function useThreatTrends(options?: { period?: string }) {
  const { period = '30d' } = options || {};
  return useQuery({
    queryKey: ['threat-trends', period],
    queryFn: async () => {
      const res = await api.get<TrendData[]>(`/api/trends/threats?period=${period}`);
      return res.data || [];
    },
  });
}

export function useThreatBreakdown(options?: { period?: string }) {
  const { period = '30d' } = options || {};
  return useQuery({
    queryKey: ['threat-breakdown', period],
    queryFn: async () => {
      const res = await api.get<ThreatBreakdown[]>(`/api/trends/breakdown?period=${period}`);
      return res.data || [];
    },
  });
}

export function useCountryBreakdown(options?: { period?: string }) {
  const { period = '30d' } = options || {};
  return useQuery({
    queryKey: ['country-breakdown', period],
    queryFn: async () => {
      const res = await api.get<CountryBreakdown[]>(`/api/trends/countries?period=${period}`);
      return res.data || [];
    },
  });
}

export function useFeedBreakdown(options?: { period?: string }) {
  const { period = '30d' } = options || {};
  return useQuery({
    queryKey: ['feed-breakdown', period],
    queryFn: async () => {
      const res = await api.get<FeedBreakdown[]>(`/api/trends/feeds?period=${period}`);
      return res.data || [];
    },
  });
}
