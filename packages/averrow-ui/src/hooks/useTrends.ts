import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/* ── Types ── */

export interface IntelligenceBriefing {
  id: string;
  agent_name: string;
  output_type: string;
  summary: string;
  severity: string;
  created_at: string;
}

export interface VolumePoint {
  date: string;
  phishing: number;
  malware_distribution: number;
  malicious_ip: number;
  c2: number;
  typosquatting: number;
  credential_harvesting: number;
}

export interface BrandMomentum {
  brand_name: string;
  this_week: number;
  last_week: number;
  change_pct: number;
}

export interface ProviderMomentum {
  provider: string;
  count: number;
}

export interface NexusCluster {
  id: string;
  label: string;
  threat_count: number;
  severity: string;
  created_at: string;
}

/* ── Hooks ── */

export function useIntelligenceBriefings(limit = 6) {
  return useQuery({
    queryKey: ['intelligence-briefings', limit],
    queryFn: async () => {
      const res = await api.get<IntelligenceBriefing[]>(`/api/trends/intelligence?limit=${limit}`);
      return res.data ?? [];
    },
  });
}

export function useThreatVolume(window = '30d') {
  return useQuery({
    queryKey: ['threat-volume', window],
    queryFn: async () => {
      const res = await api.get<VolumePoint[]>(`/api/trends/volume?window=${window}`);
      return res.data ?? [];
    },
  });
}

export function useBrandMomentum() {
  return useQuery({
    queryKey: ['brand-momentum'],
    queryFn: async () => {
      const res = await api.get<BrandMomentum[]>('/api/trends/brand-momentum');
      return res.data ?? [];
    },
  });
}

export function useProviderMomentum() {
  return useQuery({
    queryKey: ['provider-momentum'],
    queryFn: async () => {
      const res = await api.get<ProviderMomentum[]>('/api/trends/provider-momentum');
      return res.data ?? [];
    },
  });
}

export function useNexusActive() {
  return useQuery({
    queryKey: ['nexus-active'],
    queryFn: async () => {
      const res = await api.get<NexusCluster[]>('/api/trends/nexus-active');
      return res.data ?? [];
    },
  });
}
