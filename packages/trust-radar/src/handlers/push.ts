/**
 * Push subscription HTTP handlers — user-facing.
 *
 * These integrate with the existing notifications system: when a user
 * subscribes here, the dispatcher in `lib/notifications.ts` will start
 * fanning out pushes to their device alongside the in-app rows it's
 * already writing.
 *
 * Endpoints:
 *   POST   /api/push/subscribe         — register a new device
 *   DELETE /api/push/subscribe/:id     — remove a device (user-initiated)
 *   GET    /api/push/vapid-public-key  — public key for the SPA's PushManager.subscribe call
 */

import { json } from "../lib/cors";
import type { Env } from "../types";

interface SubscribeBody {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  device_label?: string;
}

// POST /api/push/subscribe — auth required
export async function handleSubscribePush(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const body = await request.json() as SubscribeBody;
    if (!body.endpoint || !body.p256dh || !body.auth) {
      return json({ success: false, error: "endpoint, p256dh, and auth are required" }, 400, origin);
    }

    const userAgent = request.headers.get("User-Agent") ?? null;

    // ON CONFLICT(endpoint) DO UPDATE — same device subscribing again just
    // refreshes the keys (auth secret in particular can change on re-subscribe)
    // and re-binds to the current user (handles "user logs into a different
    // account on the same device" cleanly).
    await env.DB.prepare(`
      INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, device_label, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        device_label = excluded.device_label,
        user_agent = excluded.user_agent
    `).bind(
      crypto.randomUUID(),
      userId,
      body.endpoint,
      body.p256dh,
      body.auth,
      body.device_label ?? null,
      userAgent,
    ).run();

    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// DELETE /api/push/subscribe/:id — auth required (only the owner can revoke)
export async function handleUnsubscribePush(
  request: Request,
  env: Env,
  subscriptionId: string,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    await env.DB.prepare(
      `DELETE FROM push_subscriptions WHERE id = ? AND user_id = ?`,
    ).bind(subscriptionId, userId).run();
    return json({ success: true }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/push/vapid-public-key — public, no auth needed
// The SPA reads this at subscribe time to construct
//   navigator.serviceWorker.ready.pushManager.subscribe({ applicationServerKey: ... })
// The public key isn't a secret — it's what the push service uses to verify
// our VAPID JWT signatures.
export async function handleGetVapidPublicKey(
  request: Request,
  env: Env,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const row = await env.DB.prepare(
      `SELECT value FROM platform_config WHERE key = 'vapid_public_key'`,
    ).first<{ value: string }>();
    const enabled = await env.DB.prepare(
      `SELECT value FROM platform_config WHERE key = 'push_enabled'`,
    ).first<{ value: string }>();

    return json({
      success: true,
      data: {
        public_key: row?.value ?? '',
        push_enabled: enabled?.value === '1',
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}

// GET /api/push/subscriptions — auth required, list current user's devices
// (so PR 3b's UI can render a "remove device" list)
export async function handleListPushSubscriptions(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const rows = await env.DB.prepare(
      `SELECT id, device_label, user_agent, created_at, last_used_at
         FROM push_subscriptions WHERE user_id = ?
         ORDER BY created_at DESC`,
    ).bind(userId).all();
    return json({ success: true, data: rows.results }, 200, origin);
  } catch (err) {
    return json({ success: false, error: "An internal error occurred" }, 500, origin);
  }
}
