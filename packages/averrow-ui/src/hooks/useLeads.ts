import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SalesLead {
  id: string;
  status: string;
  prospect_score: number;
  pitch_angle: string | null;
  outreach_variant_1: string | null;
  outreach_variant_2: string | null;
  outreach_selected: string | null;
  outreach_channel: string | null;
  target_name: string | null;
  target_title: string | null;
  target_email: string | null;
  target_linkedin: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  outreach_sent_at: string | null;
  response_received_at: string | null;
  response_sentiment: string | null;
  meeting_booked_at: string | null;
}

interface LeadStats {
  pipeline: {
    total: number;
    new_count: number;
    researched_count: number;
    drafted_count: number;
    approved_count: number;
    sent_count: number;
    responded_count: number;
    meeting_count: number;
    converted_count: number;
    declined_count: number;
  };
  weekly: {
    identified_7d: number;
    sent_7d: number;
    responded_7d: number;
  };
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
      const res = await api.get<{ leads: SalesLead[]; total: number; stats: Record<string, number> }>(`/api/admin/sales-leads?${params}`);
      // The list endpoint returns { leads, total, stats } nested in data
      const data = res.data;
      return { data: data?.leads || [], total: data?.total || 0 };
    },
  });
}

export function useLeadStats() {
  return useQuery({
    queryKey: ['lead-stats'],
    queryFn: async () => {
      const res = await api.get<LeadStats>('/api/admin/sales-leads/stats');
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
