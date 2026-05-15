// PR-AA — hooks for the /admin/abuse-mailbox page.
//
// Wraps GET /api/admin/abuse-mailbox + GET /api/admin/abuse-mailbox/messages.
// Same payload shape as the tenant module endpoints — see
// `src/handlers/adminAbuseMailbox.ts` for the wrapping rationale.

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AdminAbuseAlias {
  alias: string;
  forwarding_instructions: string | null;
}

export interface AdminAbuseMailboxTotals {
  messages_total:         number;
  messages_phishing:      number;
  messages_malware:       number;
  messages_spam:          number;
  messages_benign:        number;
  messages_pending:       number;
  messages_high_critical: number;
}

export interface AdminAbuseMailboxBrandSummary {
  brand_id:                string;
  brand_name:              string;
  canonical_domain:        string;
  messages_total:          number;
  messages_phishing:       number;
  messages_malware:        number;
  messages_spam:           number;
  messages_benign:         number;
  messages_pending:        number;
  messages_high_critical:  number;
}

export interface AdminAbuseMailboxSummary {
  org_id:  number;
  alias:   AdminAbuseAlias | null;
  brands:  AdminAbuseMailboxBrandSummary[];
  totals:  AdminAbuseMailboxTotals;
  unbound: { total: number; pending: number };
}

export interface AdminAbuseInboxMessage {
  id:                       string;
  org_id:                   number;
  brand_id:                 string | null;
  received_at:              string;
  forwarded_by_email:       string | null;
  inbound_alias:            string | null;
  original_from:            string | null;
  original_subject:         string | null;
  original_body_snippet:    string | null;
  attachment_count:         number;
  url_count:                number;
  classification:           string;
  classified_by:            string | null;
  classification_confidence: number | null;
  classification_reason:    string | null;
  ai_assessment:            string | null;
  ai_action:                string | null;
  severity:                 string;
  status:                   string;
  ack_sent_at:              string | null;
  determination_sent_at:    string | null;
}

export function useAdminAbuseMailboxSummary() {
  return useQuery({
    queryKey: ['admin-abuse-mailbox-summary'],
    queryFn: async () => {
      const res = await api.get<AdminAbuseMailboxSummary>('/api/admin/abuse-mailbox');
      return res.data ?? null;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useAdminAbuseMailboxMessages(brandId: string | null) {
  return useQuery({
    queryKey: ['admin-abuse-mailbox-messages', brandId],
    queryFn: async () => {
      const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : '';
      const res = await api.get<{ messages: AdminAbuseInboxMessage[] }>(
        `/api/admin/abuse-mailbox/messages${qs}`,
      );
      return res.data ?? { messages: [] };
    },
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}
