import { verifyJWT } from "../lib/jwt";
import { json } from "../lib/cors";
import type { Env, JWTPayload } from "../types";

export interface AuthContext {
  userId: string;
  email: string;
  plan: string;
}

export async function requireAuth(
  request: Request,
  env: Env
): Promise<AuthContext | Response> {
  const authHeader = request.headers.get("Authorization");
  const origin = request.headers.get("Origin");

  if (!authHeader?.startsWith("Bearer ")) {
    return json({ success: false, error: "Missing or invalid Authorization header" }, 401, origin);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);

  if (!payload) {
    return json({ success: false, error: "Invalid or expired token" }, 401, origin);
  }

  // Check for forced logout (admin-initiated session invalidation)
  const forcedAt = await env.CACHE.get(`forced_logout:${payload.sub}`);
  if (forcedAt && payload.iat <= parseInt(forcedAt, 10)) {
    return json({ success: false, error: "Session invalidated by administrator" }, 401, origin);
  }

  return { userId: payload.sub, email: payload.email, plan: payload.plan ?? "free" };
}

export async function requireAdmin(request: Request, env: Env): Promise<AuthContext | Response> {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;

  const row = await env.DB.prepare("SELECT is_admin FROM users WHERE id = ?")
    .bind(ctx.userId).first<{ is_admin: number }>();

  if (!row?.is_admin) {
    return json({ success: false, error: "Forbidden" }, 403, request.headers.get("Origin"));
  }
  return ctx;
}

export function isAuthContext(val: AuthContext | Response): val is AuthContext {
  return !(val instanceof Response);
}
