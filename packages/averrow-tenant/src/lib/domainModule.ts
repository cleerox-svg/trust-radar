// Domain Monitoring API client for averrow-tenant.
//
// Backed by:
//   GET /api/orgs/:orgId/modules/domain
//   GET /api/orgs/:orgId/modules/domain/brands/:brandId

import { useQuery } from '@tanstack/react-query';
import { apiGet } from './api';
import { useAuth } from './auth';

export interface DomainBrandSummary {
  brand_id:               string;
  brand_name:             string;
  canonical_domain:       string;
  lookalikes_total:       number;
  lookalikes_registered:  number;
  lookalikes_critical:    number;
  lookalikes_high:        number;
  lookalikes_taken_down:  number;
  certs_total:            number;
  certs_suspicious:       number;
  certs_new:              number;
  certs_malicious:        number;
}

export interface DomainModuleTotals {
  lookalikes_total:       number;
  lookalikes_registered:  number;
  lookalikes_critical:    number;
  lookalikes_high:        number;
  lookalikes_taken_down:  number;
  certs_total:            number;
  certs_suspicious:       number;
  certs_new:              number;
  certs_malicious:        number;
}

export interface DomainModuleSummary {
  org_id: number;
  brands: DomainBrandSummary[];
  totals: DomainModuleTotals;
}

export interface LookalikeRow {
  id:               string;
  brand_id:         string;
  domain:           string;
  permutation_type: string;
  registered:       number;
  resolves_to:      string | null;
  has_mx:           number;
  has_web:          number;
  first_seen:       string | null;
  last_checked:     string | null;
  threat_level:     string;
  ai_assessment:    string | null;
  status:           string;
  created_at:       string;
}

export interface CertRow {
  id:            string;
  brand_id:      string;
  domain:        string;
  issuer:        string | null;
  suspicious:    number;
  ai_assessment: string | null;
  status:        string;
  created_at:    string;
}

export interface BrandFindings {
  brand_id:   string;
  lookalikes: LookalikeRow[];
  certs:      CertRow[];
  page_size:  number;
}

export function useDomainModuleSummary() {
  const { user, hasOrg } = useAuth();
  const orgId = user?.organization?.id ?? null;
  return useQuery<DomainModuleSummary>({
    queryKey: ['domain-module', orgId],
    queryFn: async () => {
      const res = await apiGet<DomainModuleSummary>(`/api/orgs/${orgId}/modules/domain`);
      return res.data;
    },
    enabled: hasOrg && !!orgId,
    staleTime: 30_000,
  });
}

export function useBrandDomainFindings(brandId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organization?.id ?? null;
  return useQuery<BrandFindings>({
    queryKey: ['domain-brand-findings', orgId, brandId],
    queryFn: async () => {
      const res = await apiGet<BrandFindings>(
        `/api/orgs/${orgId}/modules/domain/brands/${brandId}`,
      );
      return res.data;
    },
    enabled: !!orgId && !!brandId,
    staleTime: 30_000,
  });
}
