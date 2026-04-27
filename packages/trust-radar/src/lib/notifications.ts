/**
 * Notification creation with rate limiting.
 *
 * Broadcasts to all users when userId is null.
 * Respects per-user notification preferences.
 *
 * The event list, dedup windows, and which events are user-toggleable all
 * live in `notification-events.ts` — that module is the single source of
 * truth. Add new events there, never here.
 */

import {
  NOTIFICATION_EVENT_DEDUP,
  NOTIFICATION_EVENTS,
  USER_TOGGLEABLE_EVENTS,
  type NotificationEventKey,
  type NotificationSeverity,
} from './notification-events';

// Re-exported for callers that already imported these names.
export type NotificationType = NotificationEventKey;
export type Severity = NotificationSeverity;

const KNOWN_EVENT_KEYS: ReadonlySet<NotificationEventKey> = new Set(
  NOTIFICATION_EVENTS.map((e) => e.key)
);

const USER_TOGGLEABLE_EVENT_KEYS: ReadonlySet<NotificationEventKey> = new Set(
  USER_TOGGLEABLE_EVENTS.map((e) => e.key)
);

interface CreateNotificationOpts {
  userId?: string | null;
  type: NotificationType;
  severity: Severity;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(db: D1Database, opts: CreateNotificationOpts): Promise<number> {
  // Defense-in-depth: if a caller passes an event key that isn't in the
  // registry (e.g. someone added a string literal in a new agent without
  // updating notification-events.ts), refuse rather than silently INSERT
  // a row the schema CHECK will reject.
  if (!KNOWN_EVENT_KEYS.has(opts.type)) {
    return 0;
  }

  const metadataJson = opts.metadata ? JSON.stringify(opts.metadata) : null;

  // Rate limit check — use metadata key for dedup (brand_id, campaign_id, feed_name, agent_id)
  const rateKey = getRateKey(opts);
  if (rateKey) {
    const window = NOTIFICATION_EVENT_DEDUP[opts.type];
    const existing = await db.prepare(
      `SELECT COUNT(*) as c FROM notifications
       WHERE type = ? AND created_at > datetime('now', ?)
       AND metadata LIKE ?`
    ).bind(opts.type, window, `%${rateKey}%`).first<{ c: number }>();
    if (existing && existing.c > 0) return 0;
  }

  // Get target users
  let userIds: string[];
  if (opts.userId) {
    userIds = [opts.userId];
  } else {
    const users = await db.prepare("SELECT id FROM users WHERE status = 'active'").all<{ id: string }>();
    userIds = users.results.map(u => u.id);
  }

  let created = 0;
  for (const uid of userIds) {
    // Only events with a column in `notification_preferences` get a per-user
    // opt-out check. System events (userToggleable: false) always send.
    if (USER_TOGGLEABLE_EVENT_KEYS.has(opts.type)) {
      const pref = await db.prepare(
        `SELECT ${opts.type} as enabled FROM notification_preferences WHERE user_id = ?`
      ).bind(uid).first<{ enabled: number }>();
      // Default to enabled if no preference row exists
      if (pref && !pref.enabled) continue;
    }

    await db.prepare(
      `INSERT INTO notifications (id, user_id, type, severity, title, message, link, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), uid, opts.type, opts.severity,
      opts.title, opts.message, opts.link ?? null, metadataJson,
    ).run();
    created++;
  }
  return created;
}

function getRateKey(opts: CreateNotificationOpts): string | null {
  if (!opts.metadata) return null;
  const m = opts.metadata;
  if (m.brand_id) return `"brand_id":"${m.brand_id}"`;
  if (m.campaign_id) return `"campaign_id":"${m.campaign_id}"`;
  if (m.feed_name) return `"feed_name":"${m.feed_name}"`;
  if (m.agent_id) return `"agent_id":"${m.agent_id}"`;
  return null;
}
