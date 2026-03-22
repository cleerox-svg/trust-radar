// Trust Radar v2 — Auth Middleware (JWT + RBAC)

import { verifyJWT } from "../lib/jwt";
import { json } from "../lib/cors";
import type { Env, JWTPayload, UserRole } from "../types";

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  orgId: string | null;
  orgRole: string | null;
}

/**
 * Validates JWT access token and returns auth context.
 * Checks for forced logout via KV.
 */
export async function requireAuth(
  request: Request,
  env: Env,
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

  // Verify user still active in DB
  const user = await env.DB.prepare("SELECT status FROM users WHERE id = ?")
    .bind(payload.sub).first<{ status: string }>();

  if (!user || user.status !== "active") {
    return json({ success: false, error: "Account is not active" }, 403, origin);
  }

  // Update last_active timestamp (fire-and-forget)
  env.DB.prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?")
    .bind(payload.sub).run().catch(() => {});

  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    orgId: payload.org_id ?? null,
    orgRole: payload.org_role ?? null,
  };
}

/**
 * Role hierarchy: super_admin > admin > analyst > client
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  analyst: 2,
  client: 1,
};

/**
 * Require a minimum role level. Roles are hierarchical —
 * super_admin can access admin routes, admin can access analyst routes, etc.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  const minLevel = Math.min(...allowedRoles.map((r) => ROLE_HIERARCHY[r]));

  return async (request: Request, env: Env): Promise<AuthContext | Response> => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;

    const userLevel = ROLE_HIERARCHY[ctx.role] ?? 0;
    if (userLevel < minLevel) {
      return json({ success: false, error: "Forbidden: insufficient role" }, 403, request.headers.get("Origin"));
    }

    return ctx;
  };
}

/**
 * Shorthand: require admin or super_admin role.
 */
export async function requireAdmin(request: Request, env: Env): Promise<AuthContext | Response> {
  return requireRole("admin")(request, env);
}

/**
 * Shorthand: require super_admin role.
 */
export async function requireSuperAdmin(request: Request, env: Env): Promise<AuthContext | Response> {
  return requireRole("super_admin")(request, env);
}

export function isAuthContext(val: AuthContext | Response): val is AuthContext {
  return !(val instanceof Response);
}

/**
 * Verify authenticated user belongs to a specific org.
 * Superadmins bypass the check.
 */
export async function requireOrgMember(
  request: Request & { params?: Record<string, string> },
  env: Env,
  orgIdParam: string = "orgId",
): Promise<AuthContext | Response> {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;

  // Superadmins can access any org
  if (ctx.role === "super_admin") return ctx;

  const orgId = request.params?.[orgIdParam];
  if (!orgId) {
    return json({ success: false, error: "Missing organization ID" }, 400, request.headers.get("Origin"));
  }

  if (ctx.orgId !== orgId) {
    return json({ success: false, error: "Not a member of this organization" }, 403, request.headers.get("Origin"));
  }

  return ctx;
}

/**
 * Org role hierarchy: viewer < analyst < admin < owner
 */
const ORG_ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  analyst: 2,
  admin: 3,
  owner: 4,
};

/**
 * Require a minimum org role level. Superadmins bypass.
 */
export async function requireOrgRole(
  request: Request & { params?: Record<string, string> },
  env: Env,
  minRole: string,
): Promise<AuthContext | Response> {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;

  // Superadmins bypass org role check
  if (ctx.role === "super_admin") return ctx;

  const userLevel = ORG_ROLE_HIERARCHY[ctx.orgRole ?? ""] ?? 0;
  const requiredLevel = ORG_ROLE_HIERARCHY[minRole] ?? 0;
  if (userLevel < requiredLevel) {
    return json({ success: false, error: `Requires org role: ${minRole} or higher` }, 403, request.headers.get("Origin"));
  }

  return ctx;
}
