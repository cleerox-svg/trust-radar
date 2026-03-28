import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SpamTrapStats {
  total_captures: number;
  captures_24h: number;
  brands_spoofed: number;
  unique_ips: number;
  auth_fail_rate: number;
}

interface SpamTrapCapture {
  id: number;
  from_address: string | null;
  from_domain: string | null;
  subject: string | null;
  spoofed_brand_id: string | null;
  brand_name?: string;
  spf_result: string | null;
  dkim_result: string | null;
  dmarc_result: string | null;
  category: string;
  severity: string;
  captured_at: string;
}

interface TrapHealth {
  channel: string;
  count: number;
}

interface SeedCampaign {
  name: string;
  channel: string;
  catches: number;
}

export type { SpamTrapCapture };

export function useSpamTrapStats() {
  return useQuery({
    queryKey: ['spam-trap-stats'],
    queryFn: async () => {
      const res = await api.get<{
        stats: { total_captures: number; brands_spoofed: number; unique_ips: number; auth_fail_rate: number; last_24h: number };
        daily: unknown[];
        health: TrapHealth[];
      }>('/api/spam-trap/stats');
      const data = res.data;
      return {
        total_captures: data?.stats?.total_captures ?? 0,
        captures_24h: data?.stats?.last_24h ?? 0,
        brands_spoofed: data?.stats?.brands_spoofed ?? 0,
        unique_ips: data?.stats?.unique_ips ?? 0,
        auth_fail_rate: (data?.stats?.auth_fail_rate ?? 0) / 100,
      } as SpamTrapStats;
    },
    refetchInterval: 60_000,
  });
}

export function useSpamTrapCaptures(options?: { limit?: number; offset?: number }) {
  const { limit = 20, offset = 0 } = options || {};
  return useQuery({
    queryKey: ['spam-trap-captures', limit, offset],
    queryFn: async () => {
      const res = await api.get<SpamTrapCapture[]>(`/api/spam-trap/captures?limit=${limit}&offset=${offset}`);
      return res.data ?? [];
    },
  });
}

export function useSpamTrapCapture(captureId: number | null) {
  return useQuery({
    queryKey: ['spam-trap-capture', captureId],
    queryFn: async () => {
      const res = await api.get<unknown>(`/api/spam-trap/captures/${captureId}`);
      return res.data || null;
    },
    enabled: !!captureId,
  });
}

export function useSpamTrapHealth() {
  return useQuery({
    queryKey: ['spam-trap-health'],
    queryFn: async () => {
      // Health data is nested inside /api/spam-trap/stats, not a separate endpoint
      const res = await api.get<{
        stats: unknown;
        daily: unknown[];
        health: TrapHealth[];
      }>('/api/spam-trap/stats');
      return (res.data?.health ?? []) as TrapHealth[];
    },
  });
}

export function useSpamTrapCampaigns() {
  return useQuery({
    queryKey: ['spam-trap-campaigns'],
    queryFn: async () => {
      const res = await api.get<SeedCampaign[]>('/api/spam-trap/campaigns');
      return res.data || [];
    },
  });
}

export interface SeedAddress {
  id: number;
  address: string;
  domain: string;
  channel: string;
  seeded_location: string | null;
  total_catches: number;
  status: string;
  seeded_at: string;
}

export function useSpamTrapAddresses() {
  return useQuery({
    queryKey: ['spam-trap-addresses'],
    queryFn: async () => {
      const res = await api.get<SeedAddress[]>('/api/spam-trap/addresses');
      return res.data ?? [];
    },
    refetchInterval: 60_000,
  });
}
