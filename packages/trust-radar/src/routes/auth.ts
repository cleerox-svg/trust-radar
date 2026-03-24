import { Router } from "itty-router";
import type { RouterType, IRequest } from "itty-router";
import type { Env } from "../types";
import { requireAuth, isAuthContext } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { handleOAuthLogin, handleOAuthInviteLogin, handleOAuthCallback, handleRefreshToken, handleLogout, handleMe } from "../handlers/auth";
import { handleValidateInvite } from "../handlers/invites";

export function registerAuthRoutes(router: RouterType<IRequest>): void {
  router.get("/api/auth/login", async (request: Request, env: Env) => {
    const limited = await rateLimit(request, env, "auth");
    if (limited) return limited;
    return handleOAuthLogin(request, env);
  });

  router.get("/api/auth/invite", async (request: Request, env: Env) => {
    const limited = await rateLimit(request, env, "auth");
    if (limited) return limited;
    return handleOAuthInviteLogin(request, env);
  });

  router.get("/api/auth/callback", async (request: Request, env: Env) => {
    const limited = await rateLimit(request, env, "auth");
    if (limited) return limited;
    return handleOAuthCallback(request, env);
  });

  router.post("/api/auth/refresh", async (request: Request, env: Env) => {
    const limited = await rateLimit(request, env, "auth");
    if (limited) return limited;
    return handleRefreshToken(request, env);
  });

  router.post("/api/auth/logout", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleLogout(request, env, ctx.userId);
  });

  router.get("/api/auth/me", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleMe(request, env, ctx.userId);
  });

  // Invite token validation (public — no auth required)
  router.get("/api/invites/:token", async (request: Request & { params: Record<string, string> }, env: Env) => {
    return handleValidateInvite(request, env, request.params["token"] ?? "");
  });
}
