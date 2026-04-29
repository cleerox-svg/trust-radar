import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NotificationEventKey, NotificationSeverity } from '@averrow/shared';

export type NotificationState = 'unread' | 'read' | 'snoozed' | 'done';
export type NotificationAudience = 'tenant' | 'super_admin' | 'team' | 'all';

export interface Notification {
  id: string;
  // N3: tenant-scoping fields surfaced from the row
  brand_id: string | null;
  org_id: string | null;
  audience: NotificationAudience;
  // System events appear in the feed too (email_security_change,
  // circuit_breaker_tripped) — widen to NotificationEventKey from
  // the shared registry instead of the old user-toggleable subset.
  type: NotificationEventKey;
  severity: NotificationSeverity;
  title: string;
  message: string;
  // Static templates (Q5) — surface in UI as "why" + "what to do".
  reason_text: string | null;
  recommended_action: string | null;
  link: string | null;
  // State machine (Q1)
  state: NotificationState;
  read_at: string | null;
  snoozed_until: string | null;
  done_at: string | null;
  // Grouping
  group_key: string | null;
  created_at: string;
  updated_at: string;
  metadata: string | null;
}

export type NotificationStateFilter = 'inbox' | 'snoozed' | 'done' | 'all';

export interface NotificationFeedFilters {
  /** Notification type — matches a key in @averrow/shared/notification-events. */
  type?: NotificationEventKey;
  severity?: NotificationSeverity;
  q?: string;
  /** ISO timestamp. Returns rows STRICTLY OLDER than this. */
  cursor?: string;
  /**
   * State filter for the triage inbox. 'inbox' (default) hides done +
   * unexpired snoozed rows. 'snoozed' shows only currently-snoozed.
   * 'done' shows only done. 'all' shows everything regardless of state.
   */
  state?: NotificationStateFilter;
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get('/api/notifications/unread-count') as unknown as { count: number };
      return res.count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const res = await api.get('/api/notifications?limit=20') as unknown as {
        data: Notification[];
        unread_count: number;
      };
      return {
        notifications: res.data ?? [],
        unread_count: res.unread_count ?? 0,
      };
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

// N3 — snooze a single notification until an ISO-8601 timestamp.
// The row stays in the DB but is hidden from the inbox until
// `until <= now`. UI surfaces this in N4.
export function useSnoozeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, until }: { id: string; until: string }) => {
      await api.post(`/api/notifications/${id}/snooze`, { until });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// N3 — mark a notification done (Linear-style fourth state).
// Done rows are hidden from the inbox but stay queryable from
// the archive page.
export function useMarkDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/notifications/${id}/done`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Used by /v2/notifications archive page. Distinct from
// useNotifications() (bell preview) because:
//   - This one supports filters + search + cursor pagination.
//   - It deduplicates the queryKey by filter so navigating between
//     filter combinations doesn't blow away the previous list.
//   - keepPreviousData prevents the list from flashing empty
//     between paginated fetches.
export interface NotificationFeedPage {
  notifications: Notification[];
  unread_count: number;
  next_cursor: string | null;
}

export function useNotificationsArchive(filters: NotificationFeedFilters = {}) {
  return useQuery({
    queryKey: ['notifications', 'archive', filters],
    queryFn: async (): Promise<NotificationFeedPage> => {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (filters.type) params.set('type', filters.type);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.q) params.set('q', filters.q);
      if (filters.cursor) params.set('cursor', filters.cursor);
      if (filters.state) params.set('state', filters.state);
      const res = await api.get(`/api/notifications?${params.toString()}`) as unknown as {
        data: Notification[];
        unread_count: number;
        next_cursor: string | null;
      };
      return {
        notifications: res.data ?? [],
        unread_count: res.unread_count ?? 0,
        next_cursor: res.next_cursor ?? null,
      };
    },
    placeholderData: keepPreviousData,
  });
}
