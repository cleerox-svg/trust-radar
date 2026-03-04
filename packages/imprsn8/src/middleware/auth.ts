import { verifyJWT } from "../lib/jwt";
import { json } from "../lib/cors";
import type { Env, JWTPayload } from "../types";

export interface AuthContext {
  userId: string;
  email: string;
  plan: string;
}

export async function requireAuth(request: Request, env: Env): Promise<AuthContext | Response> {
  const authHeader = request.headers.get("Authorization");
  const origin = request.headers.get("Origin");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ success: false, error: "Unauthorized" }, 401, origin);
  }
  const payload = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
  if (!payload) return json({ success: false, error: "Invalid or expired token" }, 401, origin);
  return { userId: payload.sub, email: payload.email, plan: payload.plan };
}

export function isAuthContext(val: AuthContext | Response): val is AuthContext {
  return !(val instanceof Response);
}
