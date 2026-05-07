// App Store Impersonation API client.
//
// Backed by:
//   GET /api/orgs/:orgId/modules/app-store
//   GET /api/orgs/:orgId/modules/app-store/brands/:brandId

import { useQuery } from '@tanstack/react-query';
import { apiGet } from './api';
import { useAuth } from './auth';

export interface AppStoreBrandSummary {
  brand_id:           string;
  brand_name:         string;
  canonical_domain:   string;
  apps_total:         number;
  apps_official:      number;
  apps_legitimate:    number;
  apps_suspicious:    number;
  apps_impersonation: number;
  apps_high_critical: number;
  stores_covered:     number;
}

export interface AppStoreModuleTotals {
  apps_total:         number;
  apps_official:      number;
  apps_legitimate:    number;
  apps_suspicious:    number;
  apps_impersonation: number;
  apps_high_critical: number;
}

export interface AppStoreModuleSummary {
  org_id: number;
  brands: AppStoreBrandSummary[];
  totals: AppStoreModuleTotals;
}

export interface AppStoreListingRow {
  id:                       string;
  brand_id:                 string;
  store:                    string;
  app_id:                   string;
  bundle_id:                string | null;
  app_name:                 string;
  developer_name:           string | null;
  developer_id:             string | null;
  app_url:                  string | null;
  icon_url:                 string | null;
  rating:                   number | null;
  rating_count:             number | null;
  release_date:             string | null;
  classification:           string;
  classified_by:            string | null;
  classification_confidence: number | null;
  classification_reason:    string | null;
  ai_assessment:            string | null;
  impersonation_score:      number;
  severity:                 string;
  status:                   string;
  created_at:               string;
}

export interface BrandAppStoreFindings {
  brand_id:  string;
  listings:  AppStoreListingRow[];
  page_size: number;
}

export function useAppStoreModuleSummary() {
  const { user, hasOrg } = useAuth();
  const orgId = user?.organization?.id ?? null;
  return useQuery<AppStoreModuleSummary>({
    queryKey: ['app-store-module', orgId],
    queryFn: async () => {
      const res = await apiGet<AppStoreModuleSummary>(`/api/orgs/${orgId}/modules/app-store`);
      return res.data;
    },
    enabled: hasOrg && !!orgId,
    staleTime: 30_000,
  });
}

export function useBrandAppStoreFindings(brandId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organization?.id ?? null;
  return useQuery<BrandAppStoreFindings>({
    queryKey: ['app-store-brand-findings', orgId, brandId],
    queryFn: async () => {
      const res = await apiGet<BrandAppStoreFindings>(
        `/api/orgs/${orgId}/modules/app-store/brands/${brandId}`,
      );
      return res.data;
    },
    enabled: !!orgId && !!brandId,
    staleTime: 30_000,
  });
}

// Customer-friendly store labels — shows on the UI rather than the raw token.
export const STORE_LABELS: Record<string, string> = {
  ios:         'iOS',
  google_play: 'Google Play',
  apkpure:     'APKPure',
  aptoide:     'Aptoide',
  galaxy:      'Samsung Galaxy',
  appgallery:  'Huawei AppGallery',
  amazon:      'Amazon',
};
