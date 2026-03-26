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
      const res = await api.get<SpamTrapStats>('/api/spam-trap/stats');
      return res.data || null;
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
      return res;
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
      const res = await api.get<TrapHealth[]>('/api/spam-trap/health');
      return res.data || [];
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
