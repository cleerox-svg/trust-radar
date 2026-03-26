import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useBrandFullDetail(brandId: string) {
  return useQuery({
    queryKey: ['brand-full', brandId],
    queryFn: async () => {
      const [brand, threats, locations, providers, campaigns, timeline, analysis, safeDomains, emailSecurity, socialProfiles] = await Promise.all([
        api.get<any>(`/api/brands/${brandId}`).catch(() => ({ data: null })),
        api.get<any>(`/api/brands/${brandId}/threats?status=active&limit=50`).catch(() => ({ data: [] })),
        api.get<any>(`/api/brands/${brandId}/threats/locations`).catch(() => ({ data: [] })),
        api.get<any>(`/api/brands/${brandId}/providers`).catch(() => ({ data: [] })),
        api.get<any>(`/api/brands/${brandId}/campaigns`).catch(() => ({ data: [] })),
        api.get<any>(`/api/brands/${brandId}/threats/timeline?period=7d`).catch(() => ({ data: null })),
        api.get<any>(`/api/brands/${brandId}/analysis`).catch(() => ({ data: null })),
        api.get<any>(`/api/brands/${brandId}/safe-domains`).catch(() => ({ data: [] })),
        api.get<any>(`/api/email-security/${brandId}`).catch(() => ({ data: null })),
        api.get<any>(`/api/brands/${brandId}/social-profiles`).catch(() => ({ data: [] })),
      ]);
      return {
        brand: brand.data,
        threats: threats.data || [],
        locations: locations.data || [],
        providers: providers.data || [],
        campaigns: campaigns.data || [],
        timeline: timeline.data,
        analysis: analysis.data,
        safeDomains: safeDomains.data || [],
        emailSecurity: emailSecurity.data,
        socialProfiles: socialProfiles.data || [],
      };
    },
    enabled: !!brandId,
  });
}

export function useBrandTimeline(brandId: string, period: string) {
  return useQuery({
    queryKey: ['brand-timeline', brandId, period],
    queryFn: async () => {
      const res = await api.get<any>(`/api/brands/${brandId}/threats/timeline?period=${period}`);
      return res.data;
    },
    enabled: !!brandId,
  });
}

export function useTriggerAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (brandId: string) => api.post(`/api/brands/${brandId}/analysis`),
    onSuccess: (_, brandId) => qc.invalidateQueries({ queryKey: ['brand-full', brandId] }),
  });
}

export function useAddSafeDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ brandId, domain }: { brandId: string; domain: string }) =>
      api.post(`/api/brands/${brandId}/safe-domains`, { domain }),
    onSuccess: (_, { brandId }) => qc.invalidateQueries({ queryKey: ['brand-full', brandId] }),
  });
}

export function useDeleteSafeDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ brandId, domainId }: { brandId: string; domainId: string }) =>
      api.delete(`/api/brands/${brandId}/safe-domains/${domainId}`),
    onSuccess: (_, { brandId }) => qc.invalidateQueries({ queryKey: ['brand-full', brandId] }),
  });
}

export function useCleanFalsePositives() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (brandId: string) => api.post(`/api/brands/${brandId}/clean-false-positives`),
    onSuccess: (_, brandId) => qc.invalidateQueries({ queryKey: ['brand-full', brandId] }),
  });
}

export function useClassifySocialProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ brandId, profileId, classification }: { brandId: string; profileId: string; classification: string }) =>
      api.patch(`/api/brands/${brandId}/social-profiles/${profileId}`, { classification }),
    onSuccess: (_, { brandId }) => qc.invalidateQueries({ queryKey: ['brand-full', brandId] }),
  });
}

export function useScanSocialProfiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (brandId: string) => api.post(`/api/social/scan/${brandId}`),
    onSuccess: (_, brandId) => qc.invalidateQueries({ queryKey: ['brand-full', brandId] }),
  });
}

export function useDiscoverSocialProfiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (brandId: string) => api.post(`/api/brands/${brandId}/discover-social`),
    onSuccess: (_, brandId) => qc.invalidateQueries({ queryKey: ['brand-full', brandId] }),
  });
}
