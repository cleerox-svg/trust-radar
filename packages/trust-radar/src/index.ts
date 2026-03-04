import { Router, error, json as ittyJson } from "itty-router";
import { handleOptions, json, corsHeaders } from "./lib/cors";
import { handleRegister, handleLogin, handleMe } from "./handlers/auth";
import { handleScan, handleScanHistory } from "./handlers/scan";
import { requireAuth, isAuthContext } from "./middleware/auth";
import type { Env } from "./types";

const router = Router();

// ─── CORS preflight ───────────────────────────────────────────
router.options("*", ({ request }: { request: Request }) => handleOptions(request));

// ─── Health ───────────────────────────────────────────────────
router.get("/health", () =>
  Response.json({ status: "ok", service: "trust-radar", ts: Date.now() })
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

// ─── Scans ────────────────────────────────────────────────────
router.post("/api/scan", async ({ request, env }: { request: Request; env: Env }) => {
  // Optional auth — anonymous scans allowed (rate-limited by IP in future)
  const authHeader = request.headers.get("Authorization");
  let userId: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    const ctx = await requireAuth(request, env);
    if (isAuthContext(ctx)) {
      userId = ctx.userId;
    }
  }

  return handleScan(request, env, userId);
});

router.get("/api/scan/history", async ({ request, env }: { request: Request; env: Env }) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleScanHistory(request, env, ctx.userId);
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
        const origin = request.headers.get("Origin");
        return json({ success: false, error: "Internal server error" }, 500, origin);
      });
  },
};
