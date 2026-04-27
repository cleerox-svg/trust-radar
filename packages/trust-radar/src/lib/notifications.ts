/**
 * Notification creation with rate limiting + push delivery.
 *
 * Three-layer gate (per FarmTrack pattern):
 *   1. Platform (`platform_config.push_enabled` + VAPID configured)
 *   2. Per-user pref:
 *        - userToggleable event flag in `notification_preferences` (e.g. brand_threat)
 *        - global channel flag for push (`push_notifications`)
 *   3. Quiet hours (`notification_preferences.quiet_hours_*`) —
 *        suppress PUSH only; in-app row always writes.
 *        Critical-severity events break through quiet hours when
 *        `critical_breakthrough = 1`.
 *
 * The event list, dedup windows, and which events are user-toggleable all
 * live in `notification-events.ts` — that module is the single source of
 * truth. Add new events there, never here.
 *
 * Signature change in PR 3a: the first arg is now `Env` (not `D1Database`)
 * so we can also reach the VAPID secret + read platform_config. Callers
 * are updated in lock-step. The function still writes the same in-app
 * `notifications` row it always did; push delivery is a NEW side effect
 * that fires after the in-app insert succeeds.
 */

import type { Env } from '../types';
import {
  NOTIFICATION_EVENT_DEDUP,
  NOTIFICATION_EVENTS,
  USER_TOGGLEABLE_EVENTS,
  type NotificationEventKey,
  type NotificationSeverity,
} from './notification-events';
import { dispatchPush, isInQuietHours, type QuietHoursPrefs } from './push';

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

interface UserPrefRow {
  // Per-event toggles. `null` when row doesn't exist (defaults-if-absent).
  brand_threat?: number | null;
  campaign_escalation?: number | null;
  feed_health?: number | null;
  intelligence_digest?: number | null;
  agent_milestone?: number | null;
  // Global channel + DND
  push_notifications?: number | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  quiet_hours_tz?: string | null;
  critical_breakthrough?: number | null;
}

export async function createNotification(env: Env, opts: CreateNotificationOpts): Promise<number> {
  // Defense-in-depth: refuse unknown event keys before we hit the SQL CHECK.
  if (!KNOWN_EVENT_KEYS.has(opts.type)) {
    return 0;
  }

  const db = env.DB;
  const metadataJson = opts.metadata ? JSON.stringify(opts.metadata) : null;

  // ─── Rate limit / dedup (unchanged from PR 2) ─────────────────────────
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

  // ─── Resolve target users ─────────────────────────────────────────────
  let userIds: string[];
  if (opts.userId) {
    userIds = [opts.userId];
  } else {
    const users = await db.prepare("SELECT id FROM users WHERE status = 'active'").all<{ id: string }>();
    userIds = users.results.map(u => u.id);
  }

  let created = 0;
  for (const uid of userIds) {
    // Pull every pref we might need in one query (event flag + push + DND).
    const pref = await db.prepare(
      `SELECT brand_threat, campaign_escalation, feed_health,
              intelligence_digest, agent_milestone,
              push_notifications,
              quiet_hours_start, quiet_hours_end, quiet_hours_tz,
              critical_breakthrough
         FROM notification_preferences WHERE user_id = ?`,
    ).bind(uid).first<UserPrefRow>();

    // ── Gate 2a: per-event opt-out (only for user-toggleable events) ──
    if (USER_TOGGLEABLE_EVENT_KEYS.has(opts.type) && pref) {
      const eventEnabled = pref[opts.type as keyof UserPrefRow];
      if (eventEnabled === 0) continue;
    }

    // ── Write the in-app row (always — DND doesn't suppress in-app) ──
    const notificationId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO notifications (id, user_id, type, severity, title, message, link, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      notificationId, uid, opts.type, opts.severity,
      opts.title, opts.message, opts.link ?? null, metadataJson,
    ).run();
    created++;

    // ── Push delivery — best-effort, never fails the in-app write ──
    // Inline await is fine: dispatchPush parallelizes per-device sends
    // and each one has a 5s timeout (see lib/push.ts).
    if (await shouldSendPush(opts, pref)) {
      dispatchPush(env, uid, {
        title: opts.title,
        body: opts.message,
        url: opts.link,
        tag: `${opts.type}-${notificationId}`,
        notificationId,
        severity: opts.severity,
        type: opts.type,
      }).catch(() => { /* swallow — in-app row is the source of truth */ });
    }
  }
  return created;
}

/** Gate 2b + Gate 3: should we attempt push delivery for this event/user? */
async function shouldSendPush(
  opts: CreateNotificationOpts,
  pref: UserPrefRow | null,
): Promise<boolean> {
  if (!pref) return false;                       // no row = defaults (push off)
  if (pref.push_notifications !== 1) return false; // explicit user opt-in required

  const quiet: QuietHoursPrefs = {
    start: pref.quiet_hours_start ?? null,
    end: pref.quiet_hours_end ?? null,
    tz: pref.quiet_hours_tz ?? null,
    criticalBreakthrough: pref.critical_breakthrough === 1,
  };
  if (isInQuietHours(quiet)) {
    // Critical events with breakthrough enabled punch through DND.
    if (opts.severity === 'critical' && quiet.criticalBreakthrough) return true;
    return false;
  }
  return true;
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
