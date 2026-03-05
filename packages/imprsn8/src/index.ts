import { Router } from "itty-router";
import { handleOptions, json } from "./lib/cors";
import { handleRegister, handleLogin, handleMe, handleUpdateProfile } from "./handlers/auth";
import { handleAnalyze, handleAnalysisHistory, handleScoreHistory } from "./handlers/analysis";
import { handleListSocials, handleAddSocial, handleDeleteSocial } from "./handlers/social";
import { requireAuth, isAuthContext } from "./middleware/auth";
import type { Env } from "./types";

const router = Router();

// ─── CORS preflight ───────────────────────────────────────────
router.options("*", (request: Request) => handleOptions(request));

// ─── Health ───────────────────────────────────────────────────
router.get("/health", () =>
  Response.json({ status: "ok", service: "imprsn8", ts: Date.now() })
);

// ─── Auth ─────────────────────────────────────────────────────
router.post("/api/auth/register", (request: Request, env: Env) =>
  handleRegister(request, env)
);
router.post("/api/auth/login", (request: Request, env: Env) =>
  handleLogin(request, env)
);
router.get("/api/auth/me", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleMe(request, env, ctx.userId);
});
router.patch("/api/profile", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateProfile(request, env, ctx.userId);
});

// ─── Analysis ─────────────────────────────────────────────────
router.post("/api/analyze", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAnalyze(request, env, ctx.userId);
});
router.get("/api/analyses", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAnalysisHistory(request, env, ctx.userId);
});
router.get("/api/score/history", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleScoreHistory(request, env, ctx.userId);
});

// ─── Social Profiles ──────────────────────────────────────────
router.get("/api/social", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListSocials(request, env, ctx.userId);
});
router.post("/api/social", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAddSocial(request, env, ctx.userId);
});
router.delete("/api/social/:platform", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDeleteSocial(request, env, ctx.userId, request.params["platform"] ?? "");
});

// ─── Static assets fallback (SPA) ────────────────────────────
router.all("*", (request: Request, env: Env) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    return json({ success: false, error: "Not found" }, 404, request.headers.get("Origin"));
  }
  return env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString()));
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router
      .fetch(request, env, ctx)
      .catch((err: unknown) => {
        console.error("Unhandled error:", err);
        return json(
          { success: false, error: "Internal server error" },
          500,
          request.headers.get("Origin")
        );
      });
  },
};
