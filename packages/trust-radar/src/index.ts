import { Router } from "itty-router";
import { handleOptions, json } from "./lib/cors";
import { handleRegister, handleLogin, handleMe } from "./handlers/auth";
import { handleScan, handleScanHistory } from "./handlers/scan";
import { handleStats, handleSourceMix, handleQualityTrend } from "./handlers/stats";
import { handleSignals, handleAlerts, handleAckAlert } from "./handlers/signals";
import { requireAuth, isAuthContext } from "./middleware/auth";
import type { Env } from "./types";

const router = Router();

// ─── CORS preflight ───────────────────────────────────────────
router.options("*", (request: Request) => handleOptions(request));

// ─── Health ───────────────────────────────────────────────────
router.get("/health", () =>
  Response.json({ status: "ok", service: "trust-radar", ts: Date.now() })
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

// ─── Scans ────────────────────────────────────────────────────
router.post("/api/scan", async (request: Request, env: Env) => {
  const authHeader = request.headers.get("Authorization");
  let userId: string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    const ctx = await requireAuth(request, env);
    if (isAuthContext(ctx)) userId = ctx.userId;
  }
  return handleScan(request, env, userId);
});

router.get("/api/scan/history", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleScanHistory(request, env, ctx.userId);
});

// ─── Dashboard Stats ──────────────────────────────────────────
router.get("/api/dashboard/stats", (request: Request, env: Env) =>
  handleStats(request, env)
);
router.get("/api/dashboard/sources", (request: Request, env: Env) =>
  handleSourceMix(request, env)
);
router.get("/api/dashboard/trend", (request: Request, env: Env) =>
  handleQualityTrend(request, env)
);

// ─── Signals ──────────────────────────────────────────────────
router.get("/api/signals", (request: Request, env: Env) =>
  handleSignals(request, env)
);

// ─── Alerts ───────────────────────────────────────────────────
router.get("/api/alerts", (request: Request, env: Env) =>
  handleAlerts(request, env)
);
router.post("/api/alerts/:id/ack", async (request: Request & { params: Record<string, string> }, env: Env) =>
  handleAckAlert(request, env, request.params["id"] ?? "")
);

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
        const origin = request.headers.get("Origin");
        return json({ success: false, error: "Internal server error" }, 500, origin);
      });
  },
};
