import { Router } from "itty-router";
import { handleOptions, json } from "./lib/cors";
import { handleRegister, handleLogin, handleMe, handleUpdateProfile } from "./handlers/auth";
import { handleAdminListUsers, handleAdminUpdateUser } from "./handlers/admin";
import { handleListInfluencers, handleGetInfluencer, handleCreateInfluencer, handleUpdateInfluencer } from "./handlers/influencers";
import { handleListVariants, handleAddVariant, handleDeleteVariant } from "./handlers/variants";
import { handleListAccounts, handleAddAccount, handleUpdateAccount, handleDeleteAccount } from "./handlers/accounts";
import { handleListThreats, handleGetThreat, handleCreateThreat, handleUpdateThreat } from "./handlers/threats";
import { handleListTakedowns, handleCreateTakedown, handleUpdateTakedown } from "./handlers/takedowns";
import { handleListAgents, handleGetAgentRuns, handleTriggerAgent } from "./handlers/agents";
import { handleAnalyze, handleAnalysisHistory, handleScoreHistory } from "./handlers/analysis";
import { handleListSocials, handleAddSocial, handleDeleteSocial } from "./handlers/social";
import { handleListCampaigns, handleCreateCampaign } from "./handlers/campaigns";
import { handleOverviewStats, handleAdminStats } from "./handlers/stats";
import { requireAuth, requireAdmin, isAuthContext } from "./middleware/auth";
import type { Env } from "./types";

const router = Router();

// ─── CORS preflight ───────────────────────────────────────────
router.options("*", (request: Request) => handleOptions(request));

// ─── Health ───────────────────────────────────────────────────
router.get("/health", () =>
  Response.json({ status: "ok", service: "imprsn8", ts: Date.now() })
);

// ─── Auth ─────────────────────────────────────────────────────
router.post("/api/auth/register", (request: Request, env: Env) => handleRegister(request, env));
router.post("/api/auth/login", (request: Request, env: Env) => handleLogin(request, env));
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

// ─── Overview Stats ───────────────────────────────────────────
router.get("/api/overview", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  const user = await env.DB.prepare("SELECT role, assigned_influencer_id FROM users WHERE id = ?").bind(ctx.userId).first<{ role: string; assigned_influencer_id: string | null }>();
  return handleOverviewStats(request, env, user?.role ?? "influencer", user?.assigned_influencer_id ?? null);
});

// ─── Influencer Profiles ──────────────────────────────────────
router.get("/api/influencers", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListInfluencers(request, env);
});
router.get("/api/influencers/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetInfluencer(request, env, request.params["id"] ?? "");
});
router.post("/api/influencers", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCreateInfluencer(request, env);
});
router.patch("/api/influencers/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateInfluencer(request, env, request.params["id"] ?? "");
});
router.get("/api/influencers/:id/variants", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListVariants(request, env, request.params["id"] ?? "");
});
router.post("/api/influencers/:id/variants", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAddVariant(request, env, request.params["id"] ?? "");
});
router.delete("/api/influencers/:id/variants/:variantId", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDeleteVariant(request, env, request.params["id"] ?? "", request.params["variantId"] ?? "");
});

// ─── Monitored Accounts ───────────────────────────────────────
router.get("/api/accounts", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  const user = await env.DB.prepare("SELECT role, assigned_influencer_id FROM users WHERE id = ?").bind(ctx.userId).first<{ role: string; assigned_influencer_id: string | null }>();
  return handleListAccounts(request, env, ctx.userId, user?.role ?? "influencer", user?.assigned_influencer_id ?? null);
});
router.post("/api/accounts", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAddAccount(request, env);
});
router.patch("/api/accounts/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateAccount(request, env, request.params["id"] ?? "");
});
router.delete("/api/accounts/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDeleteAccount(request, env, request.params["id"] ?? "");
});

// ─── Threats (IOI Feed) ───────────────────────────────────────
router.get("/api/threats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  const user = await env.DB.prepare("SELECT role, assigned_influencer_id FROM users WHERE id = ?").bind(ctx.userId).first<{ role: string; assigned_influencer_id: string | null }>();
  return handleListThreats(request, env, user?.role ?? "influencer", user?.assigned_influencer_id ?? null);
});
router.get("/api/threats/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetThreat(request, env, request.params["id"] ?? "");
});
router.post("/api/threats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCreateThreat(request, env);
});
router.patch("/api/threats/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(ctx.userId).first<{ role: string }>();
  return handleUpdateThreat(request, env, request.params["id"] ?? "", user?.role ?? "influencer");
});

// ─── Takedowns ────────────────────────────────────────────────
router.get("/api/takedowns", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  const user = await env.DB.prepare("SELECT role, assigned_influencer_id FROM users WHERE id = ?").bind(ctx.userId).first<{ role: string; assigned_influencer_id: string | null }>();
  return handleListTakedowns(request, env, user?.role ?? "influencer", user?.assigned_influencer_id ?? null);
});
router.post("/api/takedowns", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(ctx.userId).first<{ role: string }>();
  return handleCreateTakedown(request, env, ctx.userId, user?.role ?? "influencer");
});
router.patch("/api/takedowns/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(ctx.userId).first<{ role: string }>();
  return handleUpdateTakedown(request, env, request.params["id"] ?? "", ctx.userId, user?.role ?? "influencer");
});

// ─── Agents ───────────────────────────────────────────────────
router.get("/api/agents", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListAgents(request, env);
});
router.get("/api/agents/runs", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetAgentRuns(request, env);
});
router.post("/api/agents/:id/trigger", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTriggerAgent(request, env, request.params["id"] ?? "", ctx.userId);
});

// ─── Analyses ─────────────────────────────────────────────────
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
router.get("/api/analyses/score-history", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleScoreHistory(request, env, ctx.userId);
});

// ─── Social Profiles ──────────────────────────────────────────
router.get("/api/socials", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListSocials(request, env, ctx.userId);
});
router.post("/api/socials", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAddSocial(request, env, ctx.userId);
});
router.delete("/api/socials/:platform", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDeleteSocial(request, env, ctx.userId, request.params["platform"] ?? "");
});

// ─── Campaigns ────────────────────────────────────────────────
router.get("/api/campaigns", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListCampaigns(request, env, ctx.userId);
});
router.post("/api/campaigns", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCreateCampaign(request, env, ctx.userId);
});

// ─── Admin ────────────────────────────────────────────────────
router.get("/api/admin/stats", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAdminStats(request, env);
});
router.get("/api/admin/users", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAdminListUsers(request, env);
});
router.patch("/api/admin/users/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAdminUpdateUser(request, env, request.params["id"] ?? "");
});

// ─── SPA fallback ─────────────────────────────────────────────
router.all("*", (request: Request, env: Env) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    return json({ success: false, error: "Not found" }, 404, request.headers.get("Origin"));
  }
  return env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString()));
});

// ─── Debug / health ───────────────────────────────────────────────────────
router.get("/api/debug", async (request: Request, env: Env) => {
  const origin = request.headers.get("Origin");
  const checks: Record<string, unknown> = {};

  // 1. DB binding
  if (!env.DB) {
    return json({ success: false, error: "D1 binding (DB) is missing — check wrangler.toml and IMPRSN8_D1_DATABASE_ID secret" }, 500, origin);
  }
  checks["db_binding"] = "ok";

  // 2. Basic DB query
  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    checks["db_query"] = row?.ok === 1 ? "ok" : "unexpected result";
  } catch (e) {
    checks["db_query"] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3. Users table exists
  try {
    await env.DB.prepare("SELECT COUNT(*) FROM users").first();
    checks["users_table"] = "ok";
  } catch (e) {
    checks["users_table"] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 4. Check for impression_score column (migration 0008)
  try {
    await env.DB.prepare("SELECT impression_score FROM users LIMIT 1").first();
    checks["col_impression_score"] = "ok";
  } catch (e) {
    checks["col_impression_score"] = `MISSING: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 5. Check for role column (migration 0004)
  try {
    await env.DB.prepare("SELECT role FROM users LIMIT 1").first();
    checks["col_role"] = "ok";
  } catch (e) {
    checks["col_role"] = `MISSING: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 6. JWT_SECRET present
  checks["jwt_secret"] = env.JWT_SECRET ? `set (${env.JWT_SECRET.length} chars)` : "MISSING";

  return json({ success: true, data: checks }, 200, origin);
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router
      .fetch(request, env, ctx)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[imprsn8] Unhandled error:", msg, err);
        return json(
          { success: false, error: msg },   // real error — visible in Network tab
          500,
          request.headers.get("Origin")
        );
      });
  },
};
