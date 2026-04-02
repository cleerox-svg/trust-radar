import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ThreatActor {
  id: string;
  name: string;
  aliases: string | null;
  attribution: string | null;
  country: string | null;
  description: string | null;
  ttps: string | null;
  target_sectors: string | null;
  active_campaigns: string | null;
  first_seen: string | null;
  last_seen: string | null;
  status: string;
  infra_count?: number;
  target_count?: number;
  created_at: string;
  updated_at: string;
}

interface ThreatActorStats {
  total: number;
  active: number;
  by_country: Array<{ country: string; count: number }>;
  by_attribution: Array<{ attribution: string; count: number }>;
  tracked_infrastructure: number;
  targeted_brands: number;
}

interface ThreatActorDetail extends ThreatActor {
  infrastructure: Array<{
    id: string;
    asn: string | null;
    ip_range: string | null;
    domain: string | null;
    country_code: string | null;
    confidence: string;
    notes: string | null;
  }>;
  targets: Array<{
    id: string;
    brand_id: string | null;
    brand_name: string | null;
    canonical_domain: string | null;
    sector: string | null;
    context: string | null;
  }>;
  linked_threat_count: number;
}

export function useThreatActors(options?: { country?: string; status?: string; affiliation?: string }) {
  const { country, status, affiliation } = options || {};
  return useQuery({
    queryKey: ['threat-actors', country, status, affiliation],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (country) params.set('country', country);
      if (status) params.set('status', status);
      if (affiliation) params.set('affiliation', affiliation);
      const qs = params.toString();
      const res = await api.get<ThreatActor[]>(`/api/threat-actors${qs ? `?${qs}` : ''}`);
      return res.data ?? [];
    },
  });
}

export function useThreatActorStats() {
  return useQuery({
    queryKey: ['threat-actor-stats'],
    queryFn: async () => {
      const res = await api.get<ThreatActorStats>('/api/threat-actors/stats');
      return res.data || null;
    },
  });
}

export function useThreatActorDetail(id: string) {
  return useQuery({
    queryKey: ['threat-actor', id],
    queryFn: async () => {
      const res = await api.get<ThreatActorDetail>(`/api/threat-actors/${id}`);
      return res.data || null;
    },
    enabled: !!id,
  });
}

export function useThreatActorsByBrand(brandId: string) {
  return useQuery({
    queryKey: ['threat-actors-by-brand', brandId],
    queryFn: async () => {
      const res = await api.get<ThreatActor[]>(`/api/threat-actors/by-brand/${brandId}`);
      return res.data ?? [];
    },
    enabled: !!brandId,
  });
}
