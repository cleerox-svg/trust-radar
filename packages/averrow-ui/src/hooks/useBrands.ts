import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface BrandSocialProfile {
  platform: string;
  classification?: string;
}

interface Brand {
  id: string;
  name: string;
  canonical_domain: string;
  sector: string | null;
  threat_count: number;
  email_security_grade: string | null;
  exposure_score: number | null;
  monitoring_status: string;
  social_risk_score: number | null;
  last_social_scan: string | null;
  logo_url: string | null;
  social_profiles: BrandSocialProfile[] | null;
  threat_trend: number | null;
  top_threat_type: string | null;
  threat_history: number[] | null;
  bimi_grade: string | null;
  bimi_record: string | null;
  bimi_svg_url: string | null;
  bimi_vmc_url: string | null;
  bimi_vmc_valid: boolean | null;
  bimi_vmc_expiry: string | null;
  monitored: boolean | null;
  monitored_since: string | null;
  monitored_by: string | null;
  created_at: string | null;
}

interface BrandDetail extends Brand {
  threat_analysis: string | null;
  analysis_updated_at: string | null;
  official_handles: string | null;
  aliases: string | null;
  brand_keywords: string | null;
}

interface BrandStats {
  total_tracked: number;
  new_this_week: number;
  newest_brand_name: string | null;
  newest_brand_sector: string | null;
  newest_brand_added_by: string | null;
  fastest_rising: string | null;
  fastest_rising_domain: string | null;
  fastest_rising_pct: number;
  top_threat_type: string | null;
  top_threat_type_pct: number;
  second_threat_type: string | null;
  third_threat_type: string | null;
  sector_breakdown: { sector: string; count: number }[] | null;
}

interface SocialProfile {
  id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  display_name: string | null;
  followers_count: number | null;
  verified: number;
  classification: string;
  impersonation_score: number;
  impersonation_signals: string | null;
  severity: string;
  ai_assessment: string | null;
  ai_evidence_draft: string | null;
  status: string;
}

export type { Brand, BrandDetail, BrandStats, SocialProfile, BrandSocialProfile };

export function useBrands(options?: { view?: string; limit?: number; offset?: number; timeRange?: string }) {
  const { view = 'top', limit = 100, offset = 0, timeRange = '7d' } = options || {};
  return useQuery({
    queryKey: ['brands', view, limit, offset, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({ view, limit: String(limit), offset: String(offset), range: timeRange });
      const res = await api.get<Brand[]>(`/api/brands?${params}`);
      return res.data ?? [];
    },
  });
}

export function useBrandStats() {
  return useQuery({
    queryKey: ['brand-stats'],
    queryFn: async () => {
      const res = await api.get<BrandStats>('/api/brands/stats');
      return res.data || null;
    },
  });
}

export function useBrandDetail(brandId: string) {
  return useQuery({
    queryKey: ['brand', brandId],
    queryFn: async () => {
      const res = await api.get<BrandDetail>(`/api/brands/${brandId}`);
      return res.data || null;
    },
    enabled: !!brandId,
  });
}

export function useBrandThreats(brandId: string, options?: { limit?: number; offset?: number; type?: string; status?: string }) {
  const { limit = 20, offset = 0, type, status } = options || {};
  return useQuery({
    queryKey: ['brand-threats', brandId, limit, offset, type, status],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (type) params.set('type', type);
      if (status) params.set('status', status);
      const res = await api.get<unknown>(`/api/brands/${brandId}/threats?${params}`);
      return res.data ?? [];
    },
    enabled: !!brandId,
  });
}

export function useBrandSocialProfiles(brandId: string) {
  return useQuery({
    queryKey: ['brand-social', brandId],
    queryFn: async () => {
      const res = await api.get<SocialProfile[]>(`/api/brands/${brandId}/social`);
      return res.data || [];
    },
    enabled: !!brandId,
  });
}

export function useBrandEmailSecurity(brandId: string) {
  return useQuery({
    queryKey: ['brand-email', brandId],
    queryFn: async () => {
      const res = await api.get<unknown>(`/api/brands/${brandId}/email-security`);
      return res.data || null;
    },
    enabled: !!brandId,
  });
}

export function useToggleMonitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (brandId: string) => {
      return api.patch(`/api/brands/${brandId}/monitor`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brand-stats'] });
    },
  });
}

export function useAddBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      domain: string;
      name?: string;
      sector?: string;
      reason?: string;
      notes?: string;
    }) => {
      return api.post('/api/brands/monitor', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brand-stats'] });
    },
  });
}
