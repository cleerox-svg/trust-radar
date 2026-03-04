import { Router } from "itty-router";
import { handleOptions, json } from "./lib/cors";
import { handleRegister, handleLogin, handleMe, handleUpdateProfile } from "./handlers/auth";
import { handleAnalyze, handleAnalysisHistory, handleScoreHistory } from "./handlers/analysis";
import { handleListSocials, handleAddSocial, handleDeleteSocial } from "./handlers/social";
import { requireAuth, isAuthContext } from "./middleware/auth";
import type { Env } from "./types";

const router = Router();

// ─── CORS preflight ───────────────────────────────────────────
router.options("*", ({ request }: { request: Request }) => handleOptions(request));

// ─── Health ───────────────────────────────────────────────────
router.get("/health", () =>
  Response.json({ status: "ok", service: "imprsn8", ts: Date.now() })
);

// ─── Auth ─────────────────────────────────────────────────────
router.post("/api/auth/register", async ({ request, env }: { request: Request; env: Env }) =>
  handleRegister(request, env)
);
router.post("/api/auth/login", async ({ request, env }: { request: Request; env: Env }) =>
  handleLogin(request, env)
);
router.get("/api/auth/me", async ({ request, env }: { request: Request; env: Env }) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleMe(request, env, ctx.userId);
});
router.patch("/api/profile", async ({ request, env }: { request: Request; env: Env }) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateProfile(request, env, ctx.userId);
});

// ─── Analysis ─────────────────────────────────────────────────
router.post("/api/analyze", async ({ request, env }: { request: Request; env: Env }) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAnalyze(request, env, ctx.userId);
});
router.get("/api/analyses", async ({ request, env }: { request: Request; env: Env }) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAnalysisHistory(request, env, ctx.userId);
});
router.get("/api/score/history", async ({ request, env }: { request: Request; env: Env }) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleScoreHistory(request, env, ctx.userId);
});

// ─── Social Profiles ──────────────────────────────────────────
router.get("/api/social", async ({ request, env }: { request: Request; env: Env }) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListSocials(request, env, ctx.userId);
});
router.post("/api/social", async ({ request, env }: { request: Request; env: Env }) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAddSocial(request, env, ctx.userId);
});
router.delete("/api/social/:platform", async ({ request, env, params }: { request: Request; env: Env; params: Record<string, string> }) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDeleteSocial(request, env, ctx.userId, params["platform"] ?? "");
});

// ─── 404 ─────────────────────────────────────────────────────
router.all("*", ({ request }: { request: Request }) =>
  json({ success: false, error: "Not found" }, 404, request.headers.get("Origin"))
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router
      .handle({ request, env, ctx })
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
