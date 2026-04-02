import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────

export interface Org {
  id: number;
  name: string;
  slug: string;
  plan: string;
  status: string;
  max_brands: number;
  max_members: number;
  created_at: string;
}

export interface OrgMember {
  id: number;
  user_id: string;
  role: string;
  status: string;
  invited_at: string | null;
  accepted_at: string | null;
  last_active_at: string | null;
  email: string;
  user_name: string;
}

export interface OrgBrand {
  id: number;
  brand_id: string;
  is_primary: number;
  created_at: string;
  brand_name: string;
  canonical_domain: string;
  sector: string | null;
  threat_count: number;
}

export interface OrgInvite {
  id: string;
  email: string;
  org_role: string;
  created_at: string;
  expires_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
}

export interface Integration {
  id: string;
  type: string;
  category: string;
  name: string;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  events_sent: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookConfig {
  webhook_url: string | null;
  has_secret: boolean;
  webhook_events: string[];
  webhook_failures_24h: number;
  webhook_last_success: string | null;
  webhook_last_failure: string | null;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status_code: number;
  success: boolean;
  response_time_ms: number;
  delivered_at: string;
  error: string | null;
}

export interface SsoConfig {
  protocol: 'none' | 'saml' | 'oidc' | null;
  status: 'active' | 'configured' | 'disabled' | null;
  saml_metadata_url: string | null;
  saml_certificate: boolean;
  oidc_provider: string | null;
  oidc_client_id: string | null;
  oidc_client_secret: boolean;
  oidc_discovery_url: string | null;
}

// ─── Org ID — hardcoded to 1 for now (single-tenant demo) ──

const ORG_ID = '1';

// ─── Queries ────────────────────────────────────────────────

export function useOrg() {
  return useQuery({
    queryKey: ['org', ORG_ID],
    queryFn: async () => {
      const res = await api.get<Org>(`/api/orgs/${ORG_ID}`);
      return res.data ?? null;
    },
  });
}

export function useOrgMembers() {
  return useQuery({
    queryKey: ['org-members', ORG_ID],
    queryFn: async () => {
      const res = await api.get<OrgMember[]>(`/api/orgs/${ORG_ID}/members`);
      return res.data ?? [];
    },
  });
}

export function useOrgBrands() {
  return useQuery({
    queryKey: ['org-brands', ORG_ID],
    queryFn: async () => {
      const res = await api.get<OrgBrand[]>(`/api/orgs/${ORG_ID}/brands`);
      return res.data ?? [];
    },
  });
}

export function useOrgInvites() {
  return useQuery({
    queryKey: ['org-invites', ORG_ID],
    queryFn: async () => {
      const res = await api.get<OrgInvite[]>(`/api/orgs/${ORG_ID}/invites`);
      return res.data ?? [];
    },
  });
}

export function useOrgApiKeys() {
  return useQuery({
    queryKey: ['org-api-keys', ORG_ID],
    queryFn: async () => {
      const res = await api.get<ApiKey[]>(`/api/orgs/${ORG_ID}/api-keys`);
      return res.data ?? [];
    },
  });
}

export function useOrgIntegrations() {
  return useQuery({
    queryKey: ['org-integrations', ORG_ID],
    queryFn: async () => {
      const res = await api.get<Integration[]>(`/api/orgs/${ORG_ID}/integrations`);
      return res.data ?? [];
    },
  });
}

export function useWebhookConfig() {
  return useQuery({
    queryKey: ['org-webhook', ORG_ID],
    queryFn: async () => {
      const res = await api.get<WebhookConfig>(`/api/orgs/${ORG_ID}/webhook`);
      return res.data ?? null;
    },
  });
}

// ─── Mutations ──────────────────────────────────────────────

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { email: string; org_role: string }) => {
      return api.post(`/api/orgs/${ORG_ID}/invite`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-invites'] });
      qc.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return api.patch(`/api/orgs/${ORG_ID}/members/${userId}`, { role });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return api.delete(`/api/orgs/${ORG_ID}/members/${userId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members'] });
    },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      return api.delete(`/api/orgs/${ORG_ID}/invites/${inviteId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-invites'] });
    },
  });
}

export function useAssignBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { brand_id: string; is_primary?: boolean }) => {
      return api.post(`/api/orgs/${ORG_ID}/brands`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-brands'] });
      qc.invalidateQueries({ queryKey: ['org'] });
    },
  });
}

export function useRemoveBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (brandId: string) => {
      return api.delete(`/api/orgs/${ORG_ID}/brands/${brandId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-brands'] });
      qc.invalidateQueries({ queryKey: ['org'] });
    },
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; scopes: string[]; expires_at?: string }) => {
      return api.post<{ key: string; prefix: string; name: string; scopes: string[] }>(
        `/api/orgs/${ORG_ID}/api-keys`,
        payload,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-api-keys'] });
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      return api.delete(`/api/orgs/${ORG_ID}/api-keys/${keyId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-api-keys'] });
    },
  });
}

export function useCreateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { type: string; category: string; name: string; config?: Record<string, unknown> }) => {
      return api.post(`/api/orgs/${ORG_ID}/integrations`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-integrations'] });
    },
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (integrationId: string) => {
      return api.delete(`/api/orgs/${ORG_ID}/integrations/${integrationId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-integrations'] });
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: async (integrationId: string) => {
      return api.post(`/api/orgs/${ORG_ID}/integrations/${integrationId}/test`);
    },
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { webhook_url?: string; webhook_events?: string[] }) => {
      return api.patch(`/api/orgs/${ORG_ID}/webhook`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-webhook'] });
    },
  });
}

export function useRegenerateWebhookSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.post<{ webhook_secret: string }>(`/api/orgs/${ORG_ID}/webhook/regenerate-secret`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-webhook'] });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async () => {
      return api.post(`/api/orgs/${ORG_ID}/webhook/test`);
    },
  });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name?: string }) => {
      return api.patch(`/api/admin/organizations/${ORG_ID}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org'] });
    },
  });
}

// ─── SSO ───────────────────────────────────────────────────

export function useSsoConfig() {
  return useQuery({
    queryKey: ['org-sso', ORG_ID],
    queryFn: async () => {
      const res = await api.get<SsoConfig>(`/api/orgs/${ORG_ID}/sso`);
      return res.data ?? null;
    },
  });
}

export function useUpdateSsoConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      protocol: string;
      saml_metadata_url?: string;
      saml_certificate?: string;
      oidc_provider?: string;
      oidc_client_id?: string;
      oidc_client_secret?: string;
      oidc_discovery_url?: string;
    }) => {
      return api.put(`/api/orgs/${ORG_ID}/sso`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-sso'] });
    },
  });
}

export function useTestSsoConnection() {
  return useMutation({
    mutationFn: async () => {
      return api.post<{ success: boolean; error?: string }>(`/api/orgs/${ORG_ID}/sso/test`);
    },
  });
}

// ─── Webhook Deliveries ────────────────────────────────────

export function useWebhookDeliveries() {
  return useQuery({
    queryKey: ['org-webhook-deliveries', ORG_ID],
    queryFn: async () => {
      const res = await api.get<WebhookDelivery[]>(`/api/orgs/${ORG_ID}/webhook/deliveries`);
      return res.data ?? [];
    },
  });
}
