import { json } from "../lib/cors";
import type { Env } from "../types";

// ─── Session event logging ────────────────────────────────────────

export async function logSessionEvent(
  env: Env,
  userId: string,
  eventType: string,
  request: Request,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? null;
    const ua = request.headers.get("User-Agent") ?? null;
    const country = request.headers.get("CF-IPCountry") ?? null;

    await env.DB.prepare(
      `INSERT INTO session_events (id, user_id, event_type, ip_address, user_agent, country_code, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
      .bind(id, userId, eventType, ip, ua, country, JSON.stringify(metadata))
      .run();
  } catch (err) {
    console.error("[session-event] failed to log:", err);
  }
}

// ─── Admin: list session events ───────────────────────────────────

export async function handleListSessionEvents(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const eventType = url.searchParams.get("event_type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let sql = `SELECT se.*, u.email FROM session_events se LEFT JOIN users u ON u.id = se.user_id WHERE 1=1`;
  const params: unknown[] = [];

  if (userId) {
    sql += ` AND se.user_id = ?`;
    params.push(userId);
  }
  if (eventType) {
    sql += ` AND se.event_type = ?`;
    params.push(eventType);
  }

  sql += ` ORDER BY se.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(sql).bind(...params).all();

  const countSql = userId
    ? `SELECT COUNT(*) as total FROM session_events WHERE user_id = ?`
    : `SELECT COUNT(*) as total FROM session_events`;
  const countRow = userId
    ? await env.DB.prepare(countSql).bind(userId).first<{ total: number }>()
    : await env.DB.prepare(countSql).first<{ total: number }>();

  return json({ success: true, data: results, total: countRow?.total ?? 0 }, 200, origin);
}

// ─── Admin: force-logout a user ───────────────────────────────────
// We store a "forced_logout_at" timestamp in KV. The auth middleware
// checks this to reject tokens issued before the forced-logout time.

export async function handleForceLogout(
  request: Request,
  env: Env,
  targetUserId: string,
  adminUserId: string,
): Promise<Response> {
  const origin = request.headers.get("Origin");

  const user = await env.DB.prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(targetUserId)
    .first<{ id: string; email: string }>();

  if (!user) {
    return json({ success: false, error: "User not found" }, 404, origin);
  }

  // Store forced-logout timestamp in KV (TTL = 7 days to match JWT expiry)
  const now = Math.floor(Date.now() / 1000);
  await env.CACHE.put(`forced_logout:${targetUserId}`, String(now), { expirationTtl: 604800 });

  // Log the event
  await logSessionEvent(env, targetUserId, "forced_logout", request, {
    forced_by: adminUserId,
  });

  return json({ success: true, data: { message: `User ${user.email} sessions invalidated` } }, 200, origin);
}
