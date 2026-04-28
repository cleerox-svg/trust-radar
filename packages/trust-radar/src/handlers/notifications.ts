// TODO: Refactor to use handler-utils (Phase 6 continuation)
/**
 * Notification API handlers — per-user notification system.
 *
 * Uses the `notifications` table (per-user rows with read_at)
 * and `notification_preferences` table.
 *
 * Preference shape (event keys + channel keys + their defaults) is
 * derived from `lib/notification-events.ts` — the single source of
 * truth. Adding a new toggleable event there + a column to
 * `notification_preferences` automatically lights it up here.
 */

import { json } from "../lib/cors";
import type { Env } from "../types";
import {
  USER_TOGGLEABLE_EVENTS,
  NOTIFICATION_CHANNELS,
} from "@averrow/shared";

// Combined list of preference column names — events first, then channels.
// SQL columns in `notification_preferences` use these exact names.
const PREF_COLUMNS = [
  ...USER_TOGGLEABLE_EVENTS.map((e) => e.key),
  ...NOTIFICATION_CHANNELS.map((c) => c.key),
] as const;
type PrefColumn = (typeof PREF_COLUMNS)[number];

const PREF_DEFAULTS: Record<PrefColumn, boolean> = (() => {
  const out = {} as Record<PrefColumn, boolean>;
  for (const e of USER_TOGGLEABLE_EVENTS) out[e.key] = e.defaultEnabled;
  for (const c of NOTIFICATION_CHANNELS) out[c.key] = c.defaultEnabled;
  return out;
})();

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

/** Quiet-hours fields layered onto the existing flat-bool preferences.
 *  Added in PR 3a (migration 0106). Optional in the API payload — a request
 *  that doesn't include them leaves them unchanged. */
interface QuietHoursPayload {
  quiet_hours_start?: string | null;   // 'HH:MM' or null to clear
  quiet_hours_end?: string | null;
  quiet_hours_tz?: string | null;
  critical_breakthrough?: boolean;
}

interface PreferencesGetResponse extends Record<PrefColumn, boolean>, QuietHoursPayload {}

// GET /api/notifications/preferences
export async function handleGetPreferences(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const colsWithQuiet = `${PREF_COLUMNS.join(', ')}, quiet_hours_start, quiet_hours_end, quiet_hours_tz, critical_breakthrough`;
    const row = await env.DB.prepare(
      `SELECT ${colsWithQuiet} FROM notification_preferences WHERE user_id = ?`
    ).bind(userId).first<Record<PrefColumn, number | null> & {
      quiet_hours_start: string | null;
      quiet_hours_end: string | null;
      quiet_hours_tz: string | null;
      critical_breakthrough: number | null;
    }>();

    if (!row) {
      const defaults: PreferencesGetResponse = {
        ...PREF_DEFAULTS,
        quiet_hours_start: null,
        quiet_hours_end: null,
        quiet_hours_tz: null,
        critical_breakthrough: false,
      };
      return json({ success: true, data: defaults }, 200, origin);
    }

    const data = {} as PreferencesGetResponse;
    for (const col of PREF_COLUMNS) {
      data[col] = row[col] === null ? PREF_DEFAULTS[col] : !!row[col];
    }
    data.quiet_hours_start = row.quiet_hours_start;
    data.quiet_hours_end = row.quiet_hours_end;
    data.quiet_hours_tz = row.quiet_hours_tz;
    data.critical_breakthrough = !!row.critical_breakthrough;
    return json({ success: true, data }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// PUT /api/notifications/preferences
export async function handleUpdatePreferences(request: Request, env: Env, userId: string): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as Partial<Record<PrefColumn, boolean>> & QuietHoursPayload;

    // SQL columns + placeholders + UPDATE clauses are all derived from the
    // registry — no hand-maintained list to drift from the column set.
    // Column names come from the typed registry, so SQL injection is impossible.
    const colList = PREF_COLUMNS.join(', ');
    const placeholders = PREF_COLUMNS.map(() => '?').join(', ');
    const updateClauses = PREF_COLUMNS.map((c) => `${c} = excluded.${c}`).join(', ');

    const values = PREF_COLUMNS.map((c) => {
      const explicit = body[c];
      const value = explicit !== undefined ? explicit : PREF_DEFAULTS[c];
      return value ? 1 : 0;
    });

    // Step 1: upsert the flat-bool columns (existing behavior — unchanged
    // contract for the still-deployed UI).
    await env.DB.prepare(
      `INSERT INTO notification_preferences (user_id, ${colList})
       VALUES (?, ${placeholders})
       ON CONFLICT(user_id) DO UPDATE SET ${updateClauses}`
    ).bind(userId, ...values).run();

    // Step 2: if the body included quiet-hours fields, update them. Done as
    // a separate UPDATE so omitting these fields doesn't accidentally clear
    // them (additive contract — clients that don't know about quiet hours
    // continue to work exactly as before).
    const quietUpdates: string[] = [];
    const quietBindings: unknown[] = [];
    if ('quiet_hours_start' in body) {
      quietUpdates.push('quiet_hours_start = ?');
      quietBindings.push(body.quiet_hours_start ?? null);
    }
    if ('quiet_hours_end' in body) {
      quietUpdates.push('quiet_hours_end = ?');
      quietBindings.push(body.quiet_hours_end ?? null);
    }
    if ('quiet_hours_tz' in body) {
      quietUpdates.push('quiet_hours_tz = ?');
      quietBindings.push(body.quiet_hours_tz ?? null);
    }
    if ('critical_breakthrough' in body) {
      quietUpdates.push('critical_breakthrough = ?');
      quietBindings.push(body.critical_breakthrough ? 1 : 0);
    }
    if (quietUpdates.length > 0) {
      quietBindings.push(userId);
      await env.DB.prepare(
        `UPDATE notification_preferences SET ${quietUpdates.join(', ')} WHERE user_id = ?`
      ).bind(...quietBindings).run();
    }

    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}
