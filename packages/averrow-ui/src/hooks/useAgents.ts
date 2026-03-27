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
  users: {
    total: number;
    super_admins: number;
    admins: number;
    analysts: number;
    clients: number;
    active: number;
  };
  threats: {
    total: number;
    active: number;
  };
  sessions: {
    active: number;
  };
  agent_backlogs: {
    sentinel: number;
    analyst: number;
    cartographer: number;
    strategist: number;
    observer_last_run: string | null;
  };
  ai_attribution_pending: number;
  tranco_brand_count: number;
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
      const res = await api.get<DashboardStats>('/api/admin/stats');
      return res.data || null;
    },
    refetchInterval: 60_000,
  });
}

export function usePipelineStatus(agents: Agent[] | undefined) {
  return useQuery({
    queryKey: ['pipeline-status', agents?.map(a => `${a.name}:${a.status}`).join(',')],
    queryFn: async () => {
      // Derive pipeline data from agent backlogs — /api/admin/pipeline does not exist
      if (!agents) return [];
      return agents.map((a) => ({
        name: a.display_name,
        pending: a.jobs_24h,
        status: a.status === 'error' ? 'error' : a.status === 'degraded' ? 'degraded' : 'healthy',
        schedule: a.schedule,
      })) as PipelineStatus[];
    },
    enabled: !!agents,
  });
}

export function useTriggerAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (agentId: string) => {
      const res = await api.post(`/api/agents/${agentId}/trigger`);
      return res.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export interface AgentRun {
  id: string;
  agent_id: string;
  status: string;
  records_processed: number;
  outputs_generated: number;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface AgentOutput {
  id: string;
  agent_id: string;
  type: string;
  summary: string;
  severity: string;
  details: string | null;
  related_brand_ids: string | null;
  related_campaign_id: string | null;
  related_provider_ids: string | null;
  created_at: string;
}

export interface AgentDetailResponse {
  agent: {
    name: string;
    displayName: string;
    description: string;
    color: string;
    trigger: string;
    requiresApproval: boolean;
  };
  runs: AgentRun[];
  outputs: AgentOutput[];
  stats: {
    total_runs: number;
    successes: number;
    failures: number;
    total_processed: number;
    total_outputs: number;
    avg_duration_ms: number | null;
  } | null;
}

export interface AgentHealthResponse {
  runs: number[];
  errors: number[];
  outputs: number[];
}

export function useAgentDetail(agentName: string) {
  return useQuery({
    queryKey: ['agent-detail', agentName],
    queryFn: async () => {
      const res = await api.get<AgentDetailResponse>(`/api/agents/${agentName}`);
      return res.data || null;
    },
    enabled: !!agentName,
    refetchInterval: 30_000,
  });
}

export function useAgentHealth(agentName: string) {
  return useQuery({
    queryKey: ['agent-health', agentName],
    queryFn: async () => {
      const res = await api.get<AgentHealthResponse>(`/api/agents/${agentName}/health`);
      return res.data || null;
    },
    enabled: !!agentName,
    refetchInterval: 30_000,
  });
}

export function useAgentOutputsByName(agentName: string) {
  return useQuery({
    queryKey: ['agent-outputs', agentName],
    queryFn: async () => {
      const res = await api.get<AgentOutput[]>(`/api/agents/${agentName}/outputs?limit=5`);
      return res.data || [];
    },
    enabled: !!agentName,
  });
}
