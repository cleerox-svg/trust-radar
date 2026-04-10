/**
 * Notification creation with rate limiting.
 *
 * Broadcasts to all users when userId is null.
 * Respects per-user notification preferences.
 */

type NotificationType = 'brand_threat' | 'campaign_escalation' | 'feed_health' | 'intelligence_digest' | 'agent_milestone' | 'email_security_change' | 'spam_trap_capture' | 'spam_trap_campaign' | 'circuit_breaker_tripped';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface CreateNotificationOpts {
  userId?: string | null;
  type: NotificationType;
  severity: Severity;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

// Rate limit windows per type
const RATE_LIMITS: Record<NotificationType, string> = {
  brand_threat: '-1 hour',
  campaign_escalation: '-6 hours',
  feed_health: '-1 hour',
  intelligence_digest: '-24 hours',
  agent_milestone: '-1 hour',
  email_security_change: '-6 hours',
  spam_trap_capture: '-1 hour',
  spam_trap_campaign: '-6 hours',
  circuit_breaker_tripped: '-1 hour',
};

export async function createNotification(db: D1Database, opts: CreateNotificationOpts): Promise<number> {
  const metadataJson = opts.metadata ? JSON.stringify(opts.metadata) : null;

  // Rate limit check — use metadata key for dedup (brand_id, campaign_id, feed_name)
  const rateKey = getRateKey(opts);
  if (rateKey) {
    const window = RATE_LIMITS[opts.type];
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
    // Check user preference
    const pref = await db.prepare(
      `SELECT ${opts.type} as enabled FROM notification_preferences WHERE user_id = ?`
    ).bind(uid).first<{ enabled: number }>();
    // Default to enabled if no preference row exists
    if (pref && !pref.enabled) continue;

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
