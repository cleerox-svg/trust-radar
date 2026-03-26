import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SalesLead {
  id: number;
  brand_id: string;
  company_name: string | null;
  company_domain: string | null;
  prospect_score: number;
  pitch_angle: string | null;
  email_security_grade: string | null;
  threat_count_30d: number | null;
  status: string;
  findings_summary: string | null;
  outreach_variant_1: string | null;
  outreach_variant_2: string | null;
  ai_enriched: number;
  created_at: string;
}

interface LeadStats {
  new: number;
  researched: number;
  drafted: number;
  approved: number;
  sent: number;
  replied: number;
  meeting: number;
  converted: number;
  declined: number;
  response_rate: number;
  conversion_rate: number;
}

export type { SalesLead, LeadStats };

export function useLeads(options?: { status?: string; pitch_angle?: string }) {
  const { status, pitch_angle } = options || {};
  return useQuery({
    queryKey: ['leads', status, pitch_angle],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (pitch_angle) params.set('pitch_angle', pitch_angle);
      const res = await api.get<SalesLead[]>(`/api/admin/leads?${params}`);
      return res;
    },
  });
}

export function useLeadStats() {
  return useQuery({
    queryKey: ['lead-stats'],
    queryFn: async () => {
      const res = await api.get<LeadStats>('/api/admin/leads/stats');
      return res.data || null;
    },
  });
}

export function useEnrichLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.post('/api/admin/pathfinder-enrich');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
