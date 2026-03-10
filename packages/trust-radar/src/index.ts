import { Router } from "itty-router";
import { handleOptions, json } from "./lib/cors";
import { runAllFeeds } from "./lib/feedRunner";
import { feedModules } from "./feeds/index";
import { handleRegister, handleLogin, handleMe } from "./handlers/auth";
import { handleScan, handleScanHistory } from "./handlers/scan";
import { handleStats, handleSourceMix, handleQualityTrend } from "./handlers/stats";
import { handleSignals, handleAlerts, handleAckAlert, handleIngestSignal } from "./handlers/signals";
import { handleAdminStats, handleAdminListUsers, handleAdminUpdateUser, handleAdminHealth } from "./handlers/admin";
import {
  handleListFeeds, handleGetFeed, handleUpdateFeed, handleTriggerFeed,
  handleTriggerAll, handleTriggerTier, handleFeedStats, handleIngestionJobs,
  handleResetCircuit,
} from "./handlers/feeds";
import {
  handleListAgents, handleGetAgent, handleTriggerAgent, handleAgentRuns,
  handleListApprovals, handleResolveApproval, handleTrustBotChat, handleAgentStats,
} from "./handlers/agents";
import {
  handleListThreats, handleThreatStats, handleGetThreat, handleUpdateThreat,
  handleListBriefings, handleGetBriefing, handleListSocialIOCs, handleEnrichGeo,
} from "./handlers/threats";
import {
  handleListTickets, handleGetTicket, handleCreateTicket, handleUpdateTicket,
  handleAddEvidence,
  handleListErasures, handleCreateErasure, handleUpdateErasure, handleListCampaigns,
} from "./handlers/investigations";
import {
  handleListBreaches, handleListATOEvents, handleUpdateATOEvent,
  handleListEmailAuth, handleListCloudIncidents, handleTrustScoreHistory,
} from "./handlers/intel";
import { requireAuth, requireAdmin, isAuthContext } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";
import { applySecurityHeaders } from "./middleware/security";
import { handleExportScans, handleExportSignals, handleExportAlerts } from "./handlers/export";
import { handleListSessionEvents, handleForceLogout } from "./handlers/sessions";
import { handleCreateInvite, handleListInvites, handleValidateInvite, handleRevokeInvite } from "./handlers/invites";
import type { Env } from "./types";

const router = Router();

// ─── CORS preflight ───────────────────────────────────────────
router.options("*", (request: Request) => handleOptions(request));

// ─── Health / diagnostics ─────────────────────────────────────
router.get("/health", (_request: Request, env: Env) =>
  Response.json({
    status: "ok",
    service: "trust-radar",
    ts: Date.now(),
    bindings: {
      DB: !!env.DB,
      CACHE: !!env.CACHE,
      JWT_SECRET: !!env.JWT_SECRET,
      VIRUSTOTAL_API_KEY: !!env.VIRUSTOTAL_API_KEY,
    },
  })
);

// ─── Auth ─────────────────────────────────────────────────────
router.post("/api/auth/register", async (request: Request, env: Env) => {
  const limited = await rateLimit(request, env, "auth");
  if (limited) return limited;
  return handleRegister(request, env);
});
router.post("/api/auth/login", async (request: Request, env: Env) => {
  const limited = await rateLimit(request, env, "auth");
  if (limited) return limited;
  return handleLogin(request, env);
});
router.get("/api/auth/me", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleMe(request, env, ctx.userId);
});

// ─── Public Scan (unauthenticated, rate-limited) ─────────────
router.post("/api/scan/public", async (request: Request, env: Env) => {
  const limited = await rateLimit(request, env, "scan");
  if (limited) return limited;
  return handleScan(request, env);
});

// ─── Scans ────────────────────────────────────────────────────
router.post("/api/scan", async (request: Request, env: Env) => {
  const limited = await rateLimit(request, env, "scan");
  if (limited) return limited;
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

router.post("/api/signals", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleIngestSignal(request, env, ctx.userId);
});

// ─── Alerts ───────────────────────────────────────────────────
router.get("/api/alerts", (request: Request, env: Env) =>
  handleAlerts(request, env)
);
router.post("/api/alerts/:id/ack", async (request: Request & { params: Record<string, string> }, env: Env) =>
  handleAckAlert(request, env, request.params["id"] ?? "")
);

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
router.get("/api/admin/health", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAdminHealth(request, env);
});

// ─── Session Events (admin) ─────────────────────────────────
router.get("/api/admin/sessions", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListSessionEvents(request, env);
});
router.post("/api/admin/users/:id/force-logout", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleForceLogout(request, env, request.params["id"] ?? "", ctx.userId);
});

// ─── Invites ────────────────────────────────────────────────
router.get("/api/invites/:token", async (request: Request & { params: Record<string, string> }, env: Env) => {
  return handleValidateInvite(request, env, request.params["token"] ?? "");
});
router.post("/api/admin/invites", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCreateInvite(request, env, ctx.userId);
});
router.get("/api/admin/invites", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListInvites(request, env);
});
router.delete("/api/admin/invites/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleRevokeInvite(request, env, request.params["id"] ?? "");
});

// ─── Feeds ──────────────────────────────────────────────────
router.get("/api/feeds", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListFeeds(request, env);
});
router.get("/api/feeds/stats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleFeedStats(request, env);
});
router.get("/api/feeds/jobs", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleIngestionJobs(request, env);
});
router.get("/api/feeds/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetFeed(request, env, request.params["id"] ?? "");
});
router.patch("/api/feeds/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateFeed(request, env, request.params["id"] ?? "");
});
router.post("/api/feeds/:id/trigger", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTriggerFeed(request, env, request.params["id"] ?? "");
});
router.post("/api/feeds/:id/reset", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleResetCircuit(request, env, request.params["id"] ?? "");
});
router.post("/api/feeds/trigger-all", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTriggerAll(request, env);
});
router.post("/api/feeds/trigger-tier/:tier", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTriggerTier(request, env, request.params["tier"] ?? "");
});

// ─── Threats ───────────────────────────────────────────────
router.get("/api/threats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListThreats(request, env);
});
router.get("/api/threats/stats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleThreatStats(request, env);
});
router.get("/api/threats/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetThreat(request, env, request.params["id"] ?? "");
});
router.patch("/api/threats/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateThreat(request, env, request.params["id"] ?? "");
});

// ─── GeoIP Enrichment ─────────────────────────────────────
router.post("/api/threats/enrich-geo", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleEnrichGeo(request, env);
});

// ─── Briefings ─────────────────────────────────────────────
router.get("/api/briefings", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListBriefings(request, env);
});
router.get("/api/briefings/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetBriefing(request, env, request.params["id"] ?? "");
});

// ─── Social IOCs ───────────────────────────────────────────
router.get("/api/social-iocs", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListSocialIOCs(request, env);
});

// ─── Investigations ────────────────────────────────────────
router.get("/api/tickets", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListTickets(request, env);
});
router.get("/api/tickets/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetTicket(request, env, request.params["id"] ?? "");
});
router.post("/api/tickets", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCreateTicket(request, env, ctx.userId);
});
router.patch("/api/tickets/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateTicket(request, env, request.params["id"] ?? "");
});

// ─── Evidence Attachment ────────────────────────────────────
router.post("/api/tickets/:id/evidence", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAddEvidence(request, env, request.params["id"] ?? "", ctx.userId);
});

// ─── Erasure Actions (Takedowns) ───────────────────────────
router.get("/api/erasures", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListErasures(request, env);
});
router.post("/api/erasures", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCreateErasure(request, env, ctx.userId);
});
router.patch("/api/erasures/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateErasure(request, env, request.params["id"] ?? "");
});

// ─── Campaign Clusters ─────────────────────────────────────
router.get("/api/campaigns", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListCampaigns(request, env);
});

// ─── Intel: Breach Checks ──────────────────────────────────
router.get("/api/breaches", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListBreaches(request, env);
});

// ─── Intel: Account Takeover ───────────────────────────────
router.get("/api/ato-events", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListATOEvents(request, env);
});
router.patch("/api/ato-events/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateATOEvent(request, env, request.params["id"] ?? "");
});

// ─── Intel: Email Auth Reports ─────────────────────────────
router.get("/api/email-auth", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListEmailAuth(request, env);
});

// ─── Intel: Cloud Incidents ────────────────────────────────
router.get("/api/cloud-incidents", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListCloudIncidents(request, env);
});

// ─── Trust Score History ───────────────────────────────────
router.get("/api/trust-scores", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTrustScoreHistory(request, env);
});

// ─── Agents ────────────────────────────────────────────────
router.get("/api/agents", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListAgents(request, env);
});
router.get("/api/agents/stats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAgentStats(request, env);
});
router.get("/api/agents/runs", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAgentRuns(request, env);
});
router.get("/api/agents/approvals", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListApprovals(request, env);
});
router.get("/api/agents/:name", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetAgent(request, env, request.params["name"] ?? "");
});
router.post("/api/agents/:name/trigger", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTriggerAgent(request, env, request.params["name"] ?? "", ctx.userId);
});
router.post("/api/agents/approvals/:id/resolve", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleResolveApproval(request, env, request.params["id"] ?? "", ctx.userId);
});
router.post("/api/trustbot/chat", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTrustBotChat(request, env, ctx.userId);
});

// ─── Data Export ─────────────────────────────────────────────
router.get("/api/export/scans", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleExportScans(request, env, ctx.userId);
});
router.get("/api/export/signals", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleExportSignals(request, env);
});
router.get("/api/export/alerts", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleExportAlerts(request, env);
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
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runAllFeeds(env, feedModules)
        .then((r) => console.log(`[cron] feeds: ${r.feedsRun} run, ${r.totalNew} new items, ${r.feedsFailed} failed`))
        .catch((err) => console.error("[cron] feed runner error:", err))
    );
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const response = await router
      .fetch(request, env, ctx)
      .catch((err: unknown) => {
        console.error("Unhandled error:", err);
        const origin = request.headers.get("Origin");
        const message = err instanceof Error ? err.message : String(err);
        return json({ success: false, error: "Internal server error", detail: message }, 500, origin);
      });

    // Apply security headers to all responses
    return applySecurityHeaders(response);
  },
};
