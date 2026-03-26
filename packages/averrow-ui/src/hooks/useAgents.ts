import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Agent {
  agent_id: string;
  name: string;
  display_name: string;
  description: string;
  color: string;
  status: string;
  schedule: string;
  jobs_24h: number;
  outputs_24h: number;
  error_count_24h: number;
  activity: number[];
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_duration_ms: number | null;
  last_run_error: string | null;
  last_output_at: string | null;
  avg_duration_ms: number | null;
}

export interface AgentConfig {
  [key: string]: {
    schedule_label?: string;
    schedule?: string;
  };
}

export interface ApiUsage {
  tokens_24h: number;
  tokens_7d: number;
  tokens_30d: number;
  calls_today: number;
  daily_limit: number;
  estimated_cost_24h: string;
  estimated_cost_7d: string;
  estimated_cost_30d: string;
  agent_cost_30d: string;
  agent_calls_30d: number;
  ondemand_cost_30d: string;
  ondemand_calls_30d: number;
  api_key_configured: boolean;
}

export interface DashboardStats {
  total_brands: number;
  monitored_brands: number;
  total_threats: number;
  active_threats: number;
  threats_24h: number;
  total_users: number;
  total_orgs: number;
  agents_operational: number;
  agents_total: number;
  feeds_healthy: number;
  feeds_total: number;
  takedowns_pending: number;
  leads_new: number;
  spam_captures_24h: number;
}

export interface PipelineStatus {
  name: string;
  pending: number;
  status: string;
  schedule: string;
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get<Agent[]>('/api/agents');
      return res.data || [];
    },
    refetchInterval: 30_000,
  });
}

export function useAgentConfig() {
  return useQuery({
    queryKey: ['agent-config'],
    queryFn: async () => {
      const res = await api.get<AgentConfig>('/api/admin/agents/config');
      return res.data || {};
    },
  });
}

export function useApiUsage() {
  return useQuery({
    queryKey: ['api-usage'],
    queryFn: async () => {
      const res = await api.get<ApiUsage>('/api/admin/agents/api-usage');
      return res.data || null;
    },
    refetchInterval: 60_000,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/api/admin/dashboard');
      return res.data || null;
    },
    refetchInterval: 60_000,
  });
}

export function usePipelineStatus() {
  return useQuery({
    queryKey: ['pipeline-status'],
    queryFn: async () => {
      const res = await api.get<PipelineStatus[]>('/api/admin/pipeline');
      return res.data || [];
    },
    refetchInterval: 30_000,
  });
}

export function useTriggerAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (agentId: string) => {
      const res = await api.post(`/api/agents/${agentId}/trigger`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useAgentDetail(agentName: string) {
  return useQuery({
    queryKey: ['agent-detail', agentName],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>(`/api/agents/${agentName}`);
      return res.data || null;
    },
    enabled: !!agentName,
  });
}

export function useAgentHealth(agentName: string) {
  return useQuery({
    queryKey: ['agent-health', agentName],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>(`/api/agents/${agentName}/health`);
      return res.data || null;
    },
    enabled: !!agentName,
  });
}
