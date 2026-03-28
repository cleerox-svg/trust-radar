import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface FeedOverview {
  feed_name: string;
  display_name: string;
  description: string | null;
  source_url: string | null;
  enabled: number;
  schedule_cron: string;
  batch_size: number | null;
  rate_limit: number | null;
  filter_config: string | null;
  retry_max: number | null;
  retry_delay_ms: number | null;
  total_pulls: number;
  total_ingested: number;
  total_rejected: number;
  successes: number;
  errors: number;
  last_run: string | null;
  last_completed: string | null;
}

export interface FeedPullRecord {
  id: number;
  feed_name: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  records_ingested: number;
  records_rejected: number;
  status: string;
  error_message: string | null;
}

export interface FeedAggregateStats {
  active: number;
  disabled: number;
  total_ingested: number;
}

export function useFeeds() {
  return useQuery({
    queryKey: ['feeds-overview'],
    queryFn: async () => {
      const res = await api.get<FeedOverview[]>('/api/feeds/overview');
      return res.data ?? [];
    },
  });
}

export function useFeedStats() {
  return useQuery({
    queryKey: ['feeds-aggregate-stats'],
    queryFn: async () => {
      const res = await api.get<FeedAggregateStats>('/api/feeds/aggregate-stats');
      return res.data ?? { active: 0, disabled: 0, total_ingested: 0 };
    },
  });
}

export function useFeedHistory(feedName: string | null, limit = 20) {
  return useQuery({
    queryKey: ['feed-history', feedName, limit],
    queryFn: async () => {
      const res = await api.get<FeedPullRecord[]>(`/api/feeds/${feedName}/history?limit=${limit}`);
      return res.data ?? [];
    },
    enabled: !!feedName,
  });
}
