// Tenant monitoring-config API client (per brand).
//
// Backed by:
//   GET   /api/orgs/:orgId/brands/:brandId/monitoring-config
//   PATCH /api/orgs/:orgId/brands/:brandId/monitoring-config  (Analyst+)
//
// This is the org's watchlist (custom_keywords), suppression
// (excluded_domains), signal severity floor, and notification settings.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from './api';
import { useAuth } from './auth';

export interface MonitoringConfig {
  alert_severity_filter:        string[];   // severities that generate signals (CRITICAL/HIGH/MEDIUM/LOW)
  auto_acknowledge_low_days:    number;
  social_platforms_monitored:   string[];
  email_notifications:          boolean;
  email_notification_threshold: string;
  weekly_digest:                boolean;
  custom_keywords:              string[];   // watchlist
  excluded_domains:             string[];   // suppression
}

export function useMonitoringConfig(brandId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organization?.id ?? null;
  return useQuery<MonitoringConfig>({
    queryKey: ['monitoring-config', orgId, brandId],
    queryFn: async () => {
      const res = await apiGet<MonitoringConfig>(`/api/orgs/${orgId}/brands/${brandId}/monitoring-config`);
      return res.data;
    },
    enabled: !!orgId && !!brandId,
    staleTime: 60_000,
  });
}

export function useUpdateMonitoringConfig(brandId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organization?.id ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<MonitoringConfig>) => {
      return apiPatch<MonitoringConfig>(`/api/orgs/${orgId}/brands/${brandId}/monitoring-config`, patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitoring-config', orgId, brandId] });
    },
  });
}

export const SEVERITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
