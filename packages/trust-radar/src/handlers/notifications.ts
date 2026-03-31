// TODO: Refactor to use handler-utils (Phase 6 continuation)
/**
 * Notification API handlers — per-user notification system.
 *
 * Uses the `notifications` table (per-user rows with read_at)
 * and `notification_preferences` table.
 */

import { json } from "../lib/cors";
import type { Env } from "../types";

// GET /api/notifications
export async function handleListNotificationsV2(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "50", 10));
    const unreadOnly = url.searchParams.get("unread") === "true";

    let sql = `SELECT id, type, severity, title, message, link, read_at, created_at, metadata
               FROM notifications WHERE user_id = ?`;
    const params: unknown[] = [userId];
    if (unreadOnly) {
      sql += ` AND read_at IS NULL`;
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await env.DB.prepare(sql).bind(...params).all();

    // Get unread count
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_at IS NULL`
    ).bind(userId).first<{ c: number }>();

    return json({ success: true, data: rows.results, unread_count: countRow?.c ?? 0 }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// POST /api/notifications/:id/read
export async function handleMarkNotificationReadV2(request: Request, env: Env, notificationId: string, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    await env.DB.prepare(
      `UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL`
    ).bind(notificationId, userId).run();
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// POST /api/notifications/read-all
export async function handleMarkAllNotificationsReadV2(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const result = await env.DB.prepare(
      `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`
    ).bind(userId).run();
    return json({ success: true, data: { marked: result.meta.changes } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/notifications/unread-count
export async function handleUnreadCount(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL`
    ).bind(userId).first<{ count: number }>();
    return json({ success: true, count: row?.count ?? 0 }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/notifications/preferences
export async function handleGetPreferences(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const row = await env.DB.prepare(
      `SELECT * FROM notification_preferences WHERE user_id = ?`
    ).bind(userId).first();

    const defaults = {
      brand_threat: true,
      campaign_escalation: true,
      feed_health: true,
      intelligence_digest: true,
      agent_milestone: true,
      browser_notifications: false,
      push_notifications: false,
    };

    if (!row) return json({ success: true, data: defaults }, 200, origin);

    return json({
      success: true,
      data: {
        brand_threat: !!row.brand_threat,
        campaign_escalation: !!row.campaign_escalation,
        feed_health: !!row.feed_health,
        intelligence_digest: !!row.intelligence_digest,
        agent_milestone: !!row.agent_milestone,
        browser_notifications: !!row.browser_notifications,
        push_notifications: !!row.push_notifications,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// PUT /api/notifications/preferences
export async function handleUpdatePreferences(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as Record<string, boolean>;
    const fields = [
      'brand_threat', 'campaign_escalation', 'feed_health',
      'intelligence_digest', 'agent_milestone',
      'browser_notifications', 'push_notifications',
    ];

    // Upsert
    await env.DB.prepare(
      `INSERT INTO notification_preferences (user_id, brand_threat, campaign_escalation, feed_health, intelligence_digest, agent_milestone, browser_notifications, push_notifications)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         brand_threat = excluded.brand_threat,
         campaign_escalation = excluded.campaign_escalation,
         feed_health = excluded.feed_health,
         intelligence_digest = excluded.intelligence_digest,
         agent_milestone = excluded.agent_milestone,
         browser_notifications = excluded.browser_notifications,
         push_notifications = excluded.push_notifications`
    ).bind(
      userId,
      body.brand_threat !== undefined ? (body.brand_threat ? 1 : 0) : 1,
      body.campaign_escalation !== undefined ? (body.campaign_escalation ? 1 : 0) : 1,
      body.feed_health !== undefined ? (body.feed_health ? 1 : 0) : 1,
      body.intelligence_digest !== undefined ? (body.intelligence_digest ? 1 : 0) : 1,
      body.agent_milestone !== undefined ? (body.agent_milestone ? 1 : 0) : 1,
      body.browser_notifications !== undefined ? (body.browser_notifications ? 1 : 0) : 0,
      body.push_notifications !== undefined ? (body.push_notifications ? 1 : 0) : 0,
    ).run();

    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}
