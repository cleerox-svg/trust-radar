/**
 * Notification event registry — SINGLE SOURCE OF TRUTH.
 *
 * Every event the platform can fire must appear here. The dispatcher
 * (`src/lib/notifications.ts`), the preference handlers
 * (`src/handlers/notifications.ts`), and the UI matrix
 * (`packages/averrow-ui/src/features/settings/NotificationPreferences.tsx`)
 * all derive their event list, dedup windows, default state, and labels
 * from this module.
 *
 * Adding a new event:
 *   1. Append a `NotificationEventDef` here.
 *   2. If `userToggleable: true`, add a matching column to
 *      `notification_preferences` (a follow-up migration).
 *   3. Add the event key to the `notifications.type` CHECK constraint
 *      (also a migration — SQLite requires table recreation to alter
 *      a CHECK).
 *   4. The UI matrix and the handler defaults pick it up automatically.
 *
 * NOTE: This file is duplicated at
 *   packages/averrow-ui/src/lib/notification-events.ts
 * because the monorepo doesn't yet have a shared package. Keep the two
 * copies byte-identical — diffs WILL drift the dispatcher and the UI.
 * A future PR can extract this to `packages/shared/`.
 */

export type NotificationEventKey =
  | 'brand_threat'
  | 'campaign_escalation'
  | 'feed_health'
  | 'intelligence_digest'
  | 'agent_milestone'
  | 'email_security_change'
  | 'circuit_breaker_tripped';

export type NotificationChannelKey = 'browser_notifications' | 'push_notifications';

export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface NotificationEventDef {
  /** DB column name in notification_preferences (when userToggleable) and value of notifications.type. */
  key: NotificationEventKey;
  /** Human-facing title in the preferences matrix. */
  label: string;
  /** Subtitle / explanation in the preferences matrix. */
  description: string;
  /**
   * Rate-limit window passed verbatim to SQLite `datetime('now', ?)`.
   * Format: `'-N <unit>'` where unit is `hour`, `hours`, `day`, `days`, etc.
   */
  dedupWindow: string;
  /** Default state when the user has no row in `notification_preferences`. */
  defaultEnabled: boolean;
  /**
   * When false, the event is system-fired and not exposed in the user-facing
   * preferences matrix. The dispatcher still rate-limits and writes the row.
   */
  userToggleable: boolean;
}

export const NOTIFICATION_EVENTS: readonly NotificationEventDef[] = [
  {
    key: 'brand_threat',
    label: 'Brand Threats',
    description: 'New threats targeting your monitored brands',
    dedupWindow: '-1 hour',
    defaultEnabled: true,
    userToggleable: true,
  },
  {
    key: 'campaign_escalation',
    label: 'Campaign Escalations',
    description: 'When campaigns escalate in severity',
    dedupWindow: '-6 hours',
    defaultEnabled: true,
    userToggleable: true,
  },
  {
    key: 'feed_health',
    label: 'Feed Health Alerts',
    description: 'Feed degradation and health warnings',
    dedupWindow: '-1 hour',
    defaultEnabled: true,
    userToggleable: true,
  },
  {
    key: 'intelligence_digest',
    label: 'Intelligence Digests',
    description: 'Daily and weekly intelligence summaries',
    dedupWindow: '-24 hours',
    defaultEnabled: true,
    userToggleable: true,
  },
  {
    key: 'agent_milestone',
    label: 'Agent Milestones',
    description: 'Agent completion and milestone events',
    dedupWindow: '-1 hour',
    defaultEnabled: true,
    userToggleable: true,
  },

  // ─── System events (not user-toggleable) ────────────────────────────
  // These fire from the dispatcher but don't have rows in the
  // `notification_preferences` table.
  //
  // FIXME(pr-3): both events also fail the schema CHECK constraint in
  // migrations/0018_notifications.sql, which only allows the five
  // user-toggleable events above. INSERTs for these types throw and are
  // caught by callers' try/catch — meaning these system notifications are
  // silently dropped in production today. PR 3 (notification matrix
  // migration) will recreate the `notifications` table with the full
  // event list and resolve this gap.
  {
    key: 'email_security_change',
    label: 'Email Security Change',
    description: 'DMARC / SPF / DKIM grade change for a monitored brand',
    dedupWindow: '-6 hours',
    defaultEnabled: true,
    userToggleable: false,
  },
  {
    key: 'circuit_breaker_tripped',
    label: 'Agent Auto-Paused',
    description: 'An agent was auto-paused after consecutive failures',
    dedupWindow: '-1 hour',
    defaultEnabled: true,
    userToggleable: false,
  },
] as const;

/** Convenience: derived map of event_key → dedup window. Replaces the
 *  hand-maintained RATE_LIMITS object in `src/lib/notifications.ts`. */
export const NOTIFICATION_EVENT_DEDUP: Record<NotificationEventKey, string> = Object.fromEntries(
  NOTIFICATION_EVENTS.map((e) => [e.key, e.dedupWindow])
) as Record<NotificationEventKey, string>;

/** Convenience: events the UI matrix renders + the preference handlers
 *  read/write columns for. Filters out system events. */
export const USER_TOGGLEABLE_EVENTS: readonly NotificationEventDef[] =
  NOTIFICATION_EVENTS.filter((e) => e.userToggleable);

// ─── Channels (push delivery preferences) ─────────────────────────────

export interface NotificationChannelDef {
  key: NotificationChannelKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const NOTIFICATION_CHANNELS: readonly NotificationChannelDef[] = [
  {
    key: 'browser_notifications',
    label: 'Browser Notifications',
    description: 'Show desktop notifications when the page is open',
    defaultEnabled: false,
  },
  {
    key: 'push_notifications',
    label: 'Push Notifications',
    description: 'Mobile push notifications (PWA must be installed)',
    defaultEnabled: false,
  },
] as const;
