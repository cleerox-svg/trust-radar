import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Notification {
  id: string;
  type: 'brand_threat' | 'campaign_escalation' | 'feed_health' | 'intelligence_digest' | 'agent_milestone';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
  metadata: string | null;
}

interface UnreadCountResponse {
  unread_count: number;
}

interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
  total: number;
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get<UnreadCountResponse>('/api/notifications/unread-count');
      return res.data?.unread_count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const res = await api.get<NotificationsResponse>('/api/notifications?limit=20');
      return res.data;
    },
    enabled,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post('/api/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
