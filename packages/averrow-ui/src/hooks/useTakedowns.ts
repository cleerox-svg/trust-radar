import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Takedown {
  id: string;
  brand_id: string;
  brand_name?: string;
  target_type: string;
  target_value: string;
  target_platform: string | null;
  target_url: string | null;
  evidence_summary: string;
  evidence_detail: string | null;
  provider_name: string | null;
  provider_abuse_contact: string | null;
  status: string;
  severity: string;
  priority_score: number;
  requested_by: string | null;
  source_type: string | null;
  created_at: string;
  updated_at: string;
}

interface TakedownEvidence {
  id: string;
  takedown_id: string;
  evidence_type: string;
  title: string;
  content_text: string | null;
  metadata_json: string | null;
  created_at: string;
}

export type { Takedown, TakedownEvidence };

export function useAdminTakedowns(options?: { status?: string; severity?: string }) {
  const { status, severity } = options || {};
  return useQuery({
    queryKey: ['admin-takedowns', status, severity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (severity) params.set('severity', severity);
      const res = await api.get<Takedown[]>(`/api/admin/takedowns?${params}`);
      return res.data ?? [];
    },
    refetchInterval: 30_000,
  });
}

export function useTakedownEvidence(takedownId: string | null) {
  return useQuery({
    queryKey: ['takedown-evidence', takedownId],
    queryFn: async () => {
      const res = await api.get<TakedownEvidence[]>(`/api/admin/sparrow/evidence/${takedownId}`);
      return res.data || [];
    },
    enabled: !!takedownId,
  });
}

export function useUpdateTakedown() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return api.patch(`/api/admin/takedowns/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-takedowns'] });
    },
  });
}
