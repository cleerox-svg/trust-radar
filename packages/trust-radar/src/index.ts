import { Router } from "itty-router";
import { handleOptions, json } from "./lib/cors";
import { runAllFeeds } from "./lib/feedRunner";
import { feedModules } from "./feeds/index";
import { handleOAuthLogin, handleOAuthInviteLogin, handleOAuthCallback, handleRefreshToken, handleLogout, handleMe } from "./handlers/auth";
import { handleScan, handleScanHistory } from "./handlers/scan";
import { handleHeatmap } from "./handlers/heatmap";
import {
  handleObservatoryNodes, handleObservatoryArcs, handleObservatoryLive,
  handleObservatoryBrandArcs, handleObservatoryStats,
} from "./handlers/observatory";
import { renderHomepage, renderAssessResults } from "./templates/homepage";
import { handleScanPage } from "./handlers/scanPage";
import { handleStats, handleSourceMix, handleQualityTrend } from "./handlers/stats";
import { handleSignals, handleAlerts, handleAckAlert, handleIngestSignal } from "./handlers/signals";
import { handleAdminStats, handleAdminListUsers, handleAdminUpdateUser, handleAdminHealth, handleBackfillClassifications, handleBackfillGeo, handleBackfillSafeDomains, handleImportTranco, handleAdminListBrands, handleBulkMonitor, handleBulkDeleteBrands } from "./handlers/admin";
import {
  handleListFeeds, handleGetFeed, handleUpdateFeed, handleTriggerFeed,
  handleTriggerAll, handleTriggerTier, handleFeedStats, handleIngestionJobs,
  handleResetCircuit, handleFeedQuota,
} from "./handlers/feeds";
import {
  handleListAgents, handleGetAgent, handleTriggerAgent, handleTriggerAllAgents, handleAgentRuns,
  handleListApprovals, handleResolveApproval, handleTrustBotChat, handleAgentStats,
  handleAgentOutputs, handleAgentOutputsByName, handleAgentHealth,
  handleAgentApiUsage, handleAgentConfig,
} from "./handlers/agents";
import {
  handleListThreats, handleThreatStats, handleGetThreat, handleUpdateThreat,
  handleListBriefings, handleGetBriefing, handleListSocialIOCs, handleEnrichGeo,
  handleEnrichAll, handleDailySnapshots, handleGeoClusters, handleAttackFlows,
  handleRecentThreats,
} from "./handlers/threats";
import { handleCorrelations } from "./handlers/correlations";
import { handleGenerateBriefing, handleListBriefingHistory } from "./handlers/briefing";
import {
  handleListTickets, handleGetTicket, handleCreateTicket, handleUpdateTicket,
  handleAddEvidence,
  handleListErasures, handleCreateErasure, handleUpdateErasure, handleListCampaigns,
} from "./handlers/investigations";
import {
  handleListBreaches, handleListATOEvents, handleUpdateATOEvent,
  handleListEmailAuth, handleListCloudIncidents, handleTrustScoreHistory,
} from "./handlers/intel";
import { requireAuth, requireAdmin, requireSuperAdmin, isAuthContext } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";
import { applySecurityHeaders } from "./middleware/security";
import { handleExportScans, handleExportSignals, handleExportAlerts } from "./handlers/export";
import { handleProviderStats, handleListProviders, handleWorstProviders, handleImprovingProviders, handleGetProvider, handleProviderDrilldown, handleProviderBrands, handleProviderTimeline, handleProviderLocations } from "./handlers/providers";
import {
  handleBrandScan, handleBrandScanHistory, handlePublicBrandScan,
  handlePublicBrandScanResult,
  handleLeadCapture, handleListLeads, handleUpdateLead,
} from "./handlers/brandScan";
import { handleListSessionEvents, handleForceLogout } from "./handlers/sessions";
import { handleCreateInvite, handleListInvites, handleValidateInvite, handleRevokeInvite } from "./handlers/invites";
import { handleDashboardOverview, handleDashboardTopBrands, handleDashboardProviders } from "./handlers/dashboard";
import {
  handleListBrands, handleTopTargetedBrands, handleMonitoredBrands,
  handleAddMonitoredBrand, handleRemoveMonitoredBrand, handleGetBrand,
  handleBrandThreats, handleBrandThreatLocations, handleBrandThreatTimeline,
  handleBrandProviders, handleBrandCampaigns, handleBrandStats,
  handleGetBrandAnalysis, handleGenerateBrandAnalysis,
  handleBrandDeepScan,
  handleCleanFalsePositives,
} from "./handlers/brands";
import {
  handleListSafeDomains, handleAddSafeDomain, handleBulkAddSafeDomains, handleDeleteSafeDomain,
} from "./handlers/safeDomains";
import {
  handlePublicStats, handlePublicGeo, handlePublicAssess, handlePublicLeadCapture,
  handlePublicMonitor, handlePublicFeeds,
} from "./handlers/public";
import {
  handleListCampaignsV2, handleCampaignStats, handleGetCampaign,
  handleCampaignThreats, handleCampaignInfrastructure, handleCampaignBrands,
  handleCampaignTimeline,
} from "./handlers/campaigns";
import {
  handleTrendVolume, handleTrendBrands, handleTrendProviders,
  handleTrendTLDs, handleTrendTypes, handleTrendCompare,
} from "./handlers/trends";
import { handleLatestInsights } from "./handlers/insights";
import { handleBrandReport } from "./handlers/reports";
import {
  handleListNotificationsV2, handleMarkNotificationReadV2, handleMarkAllNotificationsReadV2,
  handleUnreadCount, handleGetPreferences, handleUpdatePreferences,
} from "./handlers/notifications";
import { handleListAuditLog, handleExportAuditLog } from "./handlers/audit";
import {
  handleGetEmailSecurity,
  handleScanBrandEmailSecurity,
  handleScanAllEmailSecurity,
  handlePublicEmailSecurity,
  handleEmailSecurityStats,
} from "./handlers/emailSecurity";
import {
  handleGetDmarcOverview,
  handleGetDmarcReports,
  handleGetDmarcStats,
  handleGetDmarcSources,
} from "./handlers/dmarcReports";
import { handleDmarcEmail } from "./dmarc-receiver";
import { handleSpamTrapEmail } from "./spam-trap";
import { serveHoneypotPage } from "./honeypot";
import {
  handleSpamTrapStats, handleSpamTrapCaptures, handleSpamTrapCapturesByBrand,
  handleSpamTrapSources, handleSpamTrapCampaigns, handleCreateSpamTrapCampaign,
  handleExecuteSpamTrapCampaign, handleUpdateSpamTrapCampaign,
  handleSpamTrapAddresses, handleInitialSeed, handleRunStrategist,
} from "./handlers/spamTrap";
import type { Env } from "./types";
export { ThreatPushHub } from "./durableObjects/ThreatPushHub";

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

// ─── Auth (Google OAuth) ──────────────────────────────────────
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

// ─── Public Heatmap (unauthenticated) ────────────────────────
router.get("/api/heatmap", (request: Request, env: Env) => handleHeatmap(request, env));

// ─── Observatory (unauthenticated — public viz endpoints) ────
router.get("/api/observatory/nodes",      (request: Request, env: Env) => handleObservatoryNodes(request, env));
router.get("/api/observatory/arcs",       (request: Request, env: Env) => handleObservatoryArcs(request, env));
router.get("/api/observatory/live",       (request: Request, env: Env) => handleObservatoryLive(request, env));
router.get("/api/observatory/brand-arcs", (request: Request, env: Env) => handleObservatoryBrandArcs(request, env));
router.get("/api/observatory/stats",      (request: Request, env: Env) => handleObservatoryStats(request, env));

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
// ─── Dashboard v2 (Observatory) ──────────────────────────────
router.get("/api/dashboard/overview", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDashboardOverview(request, env);
});
router.get("/api/dashboard/top-brands", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDashboardTopBrands(request, env);
});
router.get("/api/dashboard/providers", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDashboardProviders(request, env);
});

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
  return handleAdminUpdateUser(request, env, request.params["id"] ?? "", ctx.userId, ctx.role);
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
  return handleCreateInvite(request, env, ctx.userId, ctx.role);
});
router.get("/api/admin/invites", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListInvites(request, env);
});
router.delete("/api/admin/invites/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleRevokeInvite(request, env, request.params["id"] ?? "", ctx.userId);
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
router.get("/api/feeds/quota", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleFeedQuota(request, env);
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
router.post("/api/feeds", async (request: Request, env: Env) => {
  const origin = request.headers.get("Origin");
  return json({ success: false, error: "Feed creation via API deferred to v2 admin module" }, 501, origin);
});
router.delete("/api/feeds/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const origin = request.headers.get("Origin");
  return json({ success: false, error: "Feed deletion via API deferred to v2 admin module" }, 501, origin);
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
router.get("/api/threats/correlations", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCorrelations(request, env);
});
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
router.get("/api/threats/geo-clusters", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGeoClusters(request, env);
});
router.get("/api/threats/attack-flows", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAttackFlows(request, env);
});
router.get("/api/threats/recent", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleRecentThreats(request, env);
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

// ─── Enrichment ──────────────────────────────────────────
router.post("/api/threats/enrich-geo", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleEnrichGeo(request, env);
});

router.post("/api/threats/enrich-all", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleEnrichAll(request, env);
});

router.post("/api/snapshots/generate", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDailySnapshots(request, env);
});

// ─── Briefings ─────────────────────────────────────────────
router.post("/api/briefings/generate", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGenerateBriefing(request, env, ctx.userId);
});
router.get("/api/briefings/history", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListBriefingHistory(request, env);
});
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
router.get("/api/campaigns/stats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCampaignStats(request, env);
});
router.get("/api/campaigns", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListCampaignsV2(request, env);
});
router.get("/api/campaigns/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetCampaign(request, env, request.params["id"] ?? "");
});
router.get("/api/campaigns/:id/threats", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCampaignThreats(request, env, request.params["id"] ?? "");
});
router.get("/api/campaigns/:id/infrastructure", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCampaignInfrastructure(request, env, request.params["id"] ?? "");
});
router.get("/api/campaigns/:id/brands", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCampaignBrands(request, env, request.params["id"] ?? "");
});
router.get("/api/campaigns/:id/timeline", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCampaignTimeline(request, env, request.params["id"] ?? "");
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

// ─── Hosting Provider Intelligence ────────────────────────
router.get("/api/providers/stats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleProviderStats(request, env);
});
router.get("/api/providers/worst", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleWorstProviders(request, env);
});
router.get("/api/providers/improving", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleImprovingProviders(request, env);
});
router.get("/api/providers", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListProviders(request, env);
});
router.get("/api/providers/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetProvider(request, env, request.params["id"] ?? "");
});
router.get("/api/providers/:id/threats", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleProviderDrilldown(request, env, request.params["id"] ?? "");
});
router.get("/api/providers/:id/brands", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleProviderBrands(request, env, request.params["id"] ?? "");
});
router.get("/api/providers/:id/timeline", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleProviderTimeline(request, env, request.params["id"] ?? "");
});
router.get("/api/providers/:id/locations", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleProviderLocations(request, env, request.params["id"] ?? "");
});

// ─── Brands ──────────────────────────────────────────────────
router.get("/api/brands", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListBrands(request, env);
});
router.get("/api/brands/top-targeted", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTopTargetedBrands(request, env);
});
router.get("/api/brands/monitored", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleMonitoredBrands(request, env);
});
router.get("/api/brands/stats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandStats(request, env);
});
router.post("/api/brands/monitor", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAddMonitoredBrand(request, env, ctx.userId);
});
router.delete("/api/brands/monitor/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleRemoveMonitoredBrand(request, env, request.params["id"] ?? "", ctx.userId);
});
router.get("/api/brands/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetBrand(request, env, request.params["id"] ?? "");
});
router.get("/api/brands/:id/threats", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandThreats(request, env, request.params["id"] ?? "");
});
router.get("/api/brands/:id/threats/locations", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandThreatLocations(request, env, request.params["id"] ?? "");
});
router.get("/api/brands/:id/threats/timeline", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandThreatTimeline(request, env, request.params["id"] ?? "");
});
router.get("/api/brands/:id/providers", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandProviders(request, env, request.params["id"] ?? "");
});
router.get("/api/brands/:id/campaigns", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandCampaigns(request, env, request.params["id"] ?? "");
});
router.get("/api/brands/:id/analysis", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetBrandAnalysis(request, env, request.params["id"] ?? "");
});
router.post("/api/brands/:id/analysis", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGenerateBrandAnalysis(request, env, request.params["id"] ?? "");
});

router.post("/api/brands/:id/deep-scan", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandDeepScan(request, env, request.params["id"] ?? "");
});

router.get("/api/brands/:id/report", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandReport(request, env, request.params["id"] ?? "");
});

router.post("/api/brands/:id/clean-false-positives", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCleanFalsePositives(request, env, request.params["id"] ?? "");
});

// ─── Brand Safe Domains (Known/Owned Allowlist) ─────────────
router.get("/api/brands/:id/safe-domains", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListSafeDomains(request, env, request.params["id"] ?? "");
});
router.post("/api/brands/:id/safe-domains", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAddSafeDomain(request, env, request.params["id"] ?? "", ctx.userId);
});
router.post("/api/brands/:id/safe-domains/bulk", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBulkAddSafeDomains(request, env, request.params["id"] ?? "", ctx.userId);
});
router.delete("/api/brands/:id/safe-domains/:domainId", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDeleteSafeDomain(request, env, request.params["id"] ?? "", request.params["domainId"] ?? "");
});

// ─── Brand Exposure Engine ──────────────────────────────────
router.post("/api/brand-scan", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandScan(request, env, ctx.userId);
});
router.get("/api/brand-scan/history", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBrandScanHistory(request, env);
});
// Public brand scan (no auth, rate-limited)
router.post("/api/brand-scan/public", async (request: Request, env: Env) => {
  const limited = await rateLimit(request, env, "scan");
  if (limited) return limited;
  return handlePublicBrandScan(request, env);
});
// Public brand scan result lookup (no auth)
router.get("/api/brand-scan/public/:id", (request: Request & { params: Record<string, string> }, env: Env) =>
  handlePublicBrandScanResult(request, env, request.params["id"] ?? "")
);
// Lead capture (no auth, rate-limited)
router.post("/api/leads", async (request: Request, env: Env) => {
  const limited = await rateLimit(request, env, "auth");
  if (limited) return limited;
  return handleLeadCapture(request, env);
});
// Admin leads management
router.get("/api/admin/leads", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListLeads(request, env);
});
router.patch("/api/admin/leads/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateLead(request, env, request.params["id"] ?? "");
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
router.get("/api/admin/agents/api-usage", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAgentApiUsage(request, env);
});
router.get("/api/admin/agents/config", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAgentConfig(request, env);
});
router.get("/api/agents/runs", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAgentRuns(request, env);
});
router.get("/api/agents/outputs", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAgentOutputs(request, env);
});
router.get("/api/agents/approvals", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListApprovals(request, env);
});
router.get("/api/agents/:name/outputs", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAgentOutputsByName(request, env, request.params["name"] ?? "");
});
router.get("/api/agents/:name/health", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAgentHealth(request, env, request.params["name"] ?? "");
});
router.get("/api/agents/:name", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetAgent(request, env, request.params["name"] ?? "");
});
router.post("/api/agents/trigger-all", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTriggerAllAgents(request, env, ctx.userId);
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

// ─── Trends ──────────────────────────────────────────────────
router.get("/api/trends/volume", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTrendVolume(request, env);
});
router.get("/api/trends/brands", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTrendBrands(request, env);
});
router.get("/api/trends/providers", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTrendProviders(request, env);
});
router.get("/api/trends/tlds", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTrendTLDs(request, env);
});
router.get("/api/trends/types", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTrendTypes(request, env);
});
router.get("/api/trends/compare", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleTrendCompare(request, env);
});

// ─── Insights ────────────────────────────────────────────────
router.get("/api/insights/latest", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleLatestInsights(request, env);
});

// ─── Notifications ───────────────────────────────────────────
router.get("/api/notifications", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListNotificationsV2(request, env, ctx.userId);
});
router.post("/api/notifications/:id/read", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleMarkNotificationReadV2(request, env, request.params["id"] ?? "", ctx.userId);
});
router.post("/api/notifications/read-all", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleMarkAllNotificationsReadV2(request, env, ctx.userId);
});
router.get("/api/notifications/unread-count", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUnreadCount(request, env, ctx.userId);
});
router.get("/api/notifications/preferences", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetPreferences(request, env, ctx.userId);
});
router.put("/api/notifications/preferences", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdatePreferences(request, env, ctx.userId);
});

// ─── Admin: Audit Log ────────────────────────────────────────
router.get("/api/admin/audit", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListAuditLog(request, env);
});
router.get("/api/admin/audit/export", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleExportAuditLog(request, env);
});

// ─── Backfill Endpoints (one-time catch-up) ──────────────────
router.post("/api/admin/backfill-classifications", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBackfillClassifications(request, env);
});
router.post("/api/admin/backfill-geo", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBackfillGeo(request, env);
});
router.post("/api/admin/backfill-safe-domains", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBackfillSafeDomains(request, env);
});
router.post("/api/admin/import-tranco", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleImportTranco(request, env);
});
router.get("/api/admin/brands", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAdminListBrands(request, env);
});
router.post("/api/admin/brands/bulk-monitor", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBulkMonitor(request, env, ctx.userId);
});
router.post("/api/admin/brands/bulk-delete", async (request: Request, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBulkDeleteBrands(request, env, ctx.userId);
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

// ─── Spam Trap ────────────────────────────────────────────────
router.get("/api/spam-trap/stats", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleSpamTrapStats(request, env);
});
router.get("/api/spam-trap/captures", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleSpamTrapCaptures(request, env);
});
router.get("/api/spam-trap/captures/brand/:brandId", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleSpamTrapCapturesByBrand(request, env, request.params["brandId"] ?? "");
});
router.get("/api/spam-trap/sources", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleSpamTrapSources(request, env);
});
router.get("/api/spam-trap/campaigns", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleSpamTrapCampaigns(request, env);
});
router.post("/api/spam-trap/campaigns", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCreateSpamTrapCampaign(request, env);
});
router.post("/api/spam-trap/campaigns/:id/execute", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleExecuteSpamTrapCampaign(request, env, request.params["id"] ?? "");
});
router.put("/api/spam-trap/campaigns/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateSpamTrapCampaign(request, env, request.params["id"] ?? "");
});
router.get("/api/spam-trap/addresses", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleSpamTrapAddresses(request, env);
});
router.post("/api/spam-trap/seed/initial", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleInitialSeed(request, env);
});
router.post("/api/spam-trap/strategist/run", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleRunStrategist(request, env);
});

// ─── Public Homepage ──────────────────────────────────────────
router.get("/", () =>
  new Response(renderHomepage(), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  })
);

// ─── Public Assessment (POST /assess triggers brand scan, redirects to results) ──
router.post("/assess", async (request: Request, env: Env) => {
  const limited = await rateLimit(request, env, "scan");
  if (limited) return limited;
  try {
    // Accept form-encoded or JSON
    const ct = request.headers.get("Content-Type") ?? "";
    let domain: string | undefined;
    if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      domain = (form.get("domain") as string)?.toLowerCase().trim();
    } else {
      const body = await request.json() as { domain?: string };
      domain = body.domain?.toLowerCase().trim();
    }
    // Strip protocol/path if user pasted a URL
    domain = domain?.replace(/^https?:\/\//, "").split("/")[0];
    if (!domain || !domain.includes(".")) {
      return Response.redirect(new URL("/", request.url).toString(), 302);
    }
    // Run the brand scan internally
    const scanRequest = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": request.headers.get("Origin") ?? "" },
      body: JSON.stringify({ domain }),
    });
    const scanRes = await handlePublicBrandScan(scanRequest, env);
    const scanData = await scanRes.json() as { success: boolean; data?: { domain: string; trustScore: number } };
    if (!scanData.success) {
      return Response.redirect(new URL("/", request.url).toString(), 302);
    }
    // Find the scan ID (most recent for this domain)
    const row = await env.DB.prepare(
      "SELECT id FROM brand_scans WHERE domain = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(domain).first<{ id: string }>();
    const id = row?.id ?? "unknown";
    return Response.redirect(new URL(`/assess/${id}/results`, request.url).toString(), 303);
  } catch {
    return Response.redirect(new URL("/", request.url).toString(), 302);
  }
});

// ─── Public Assessment Results Page ────────────────────────────
router.get("/assess/:id/results", (request: Request & { params: Record<string, string> }) =>
  new Response(renderAssessResults(request.params["id"] ?? ""), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
);

// ─── Public Scan Result Page (legacy) ─────────────────────────
router.get("/scan/:id", (request: Request & { params: Record<string, string> }, env: Env) =>
  handleScanPage(request, env, request.params["id"] ?? "")
);

// ─── WebSocket — ThreatPushHub Durable Object ─────────────────
router.get("/ws/threats", async (request: Request, env: Env) => {
  // Optional: require auth header for WS upgrade
  // For now, open WebSocket (protected by origin/CORS in production)
  const id = env.THREAT_PUSH_HUB.idFromName("global");
  const hub = env.THREAT_PUSH_HUB.get(id);
  return hub.fetch(request);
});

// ─── Email Security Posture ───────────────────────────────────
router.get("/api/email-security/stats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleEmailSecurityStats(request, env);
});
router.get("/api/email-security/scan-all", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleScanAllEmailSecurity(request, env);
});
router.get("/api/email-security/:brandId", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetEmailSecurity(request, env, request.params["brandId"] ?? "");
});
router.post("/api/email-security/scan/:brandId", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleScanBrandEmailSecurity(request, env, request.params["brandId"] ?? "");
});

// ─── DMARC Report endpoints ───────────────────────────────────
// overview must be registered before :brandId to avoid route collision
router.get("/api/dmarc-reports/overview", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetDmarcOverview(request, env);
});
router.get("/api/dmarc-reports/:brandId/stats", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetDmarcStats(request, env, request.params["brandId"] ?? "");
});
router.get("/api/dmarc-reports/:brandId/sources", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetDmarcSources(request, env, request.params["brandId"] ?? "");
});
router.get("/api/dmarc-reports/:brandId", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetDmarcReports(request, env, request.params["brandId"] ?? "");
});

// ─── Public API endpoints (no auth) ─────────────────────────
router.get("/api/v1/public/stats", (request: Request, env: Env) => handlePublicStats(request, env));
router.get("/api/v1/public/geo", (request: Request, env: Env) => handlePublicGeo(request, env));
router.get("/api/v1/public/feeds", (request: Request, env: Env) => handlePublicFeeds(request, env));
router.post("/api/v1/public/assess", (request: Request, env: Env) => handlePublicAssess(request, env));
router.post("/api/v1/public/leads", (request: Request, env: Env) => handlePublicLeadCapture(request, env));
router.post("/api/v1/public/monitor", (request: Request, env: Env) => handlePublicMonitor(request, env));
router.get("/api/v1/public/email-security/:domain", async (request: Request & { params: Record<string, string> }, env: Env) =>
  handlePublicEmailSecurity(request, env, request.params["domain"] ?? "")
);

// ─── Static assets fallback (SPA) ────────────────────────────
// serve_directly=false means ALL requests hit the Worker, so we must
// serve static assets here. Try the exact path first; if Assets returns
// 404, fall back to index.html for SPA client-side routing.
router.all("*", async (request: Request, env: Env) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    return json({ success: false, error: "Not found" }, 404, request.headers.get("Origin"));
  }
  // Try serving the exact static asset (JS, CSS, images, etc.)
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }
  // SPA fallback — serve index.html for client-side routes
  return env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString()));
});

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // GUARANTEED diagnostic — runs before anything else
    try {
      const needsGeo = await env.DB.prepare('SELECT COUNT(*) as c FROM threats WHERE ip_address IS NOT NULL AND lat IS NULL').first<{ c: number }>();
      await env.DB.prepare(
        "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
      ).bind('diag_cron_' + Date.now(), 'CRON RUN: needs_geo=' + (needsGeo?.c ?? 0)).run();
    } catch (e) { console.error("[cron] diagnostic write failed:", e); }

    // Geo enrichment — runs independently, NOT chained to feeds
    let geoResult: { enriched: number; total: number; skippedPrivate: number; skippedNoResult: number; errors: string[] } | null = null;
    try {
      const { enrichThreatsGeo } = await import("./lib/geoip");
      geoResult = await enrichThreatsGeo(env.DB, env.CACHE);
    } catch (e) {
      console.error("[cron] geo enrichment error:", e);
    }

    // Post-geo diagnostic with detailed stats
    try {
      const afterGeo = await env.DB.prepare('SELECT COUNT(*) as c FROM threats WHERE ip_address IS NOT NULL AND lat IS NULL').first<{ c: number }>();
      const { getGeoUsage } = await import("./lib/geoip");
      let kvUsage = -1;
      try { kvUsage = await getGeoUsage(env.CACHE); } catch { /* ok */ }
      const g = geoResult;
      const summary = g
        ? `GEO ENRICHMENT DONE: enriched=${g.enriched}, private=${g.skippedPrivate}, no_result=${g.skippedNoResult}, errors=${g.errors.length}, needs_geo=${afterGeo?.c ?? '?'}, kv_usage=${kvUsage}`
        : `GEO ENRICHMENT FAILED: needs_geo=${afterGeo?.c ?? '?'}, kv_usage=${kvUsage}`;
      await env.DB.prepare(
        "INSERT INTO agent_outputs (id, agent_id, type, summary, severity, details, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, 'info', ?, datetime('now'))"
      ).bind(
        'diag_geo_' + Date.now(),
        summary,
        g?.errors.length ? JSON.stringify(g.errors) : null,
      ).run();
    } catch (e) { /* ignore */ }

    // CF Scanner diagnostic — check config and env vars
    try {
      const cfConfig = await env.DB.prepare(
        "SELECT feed_name, enabled, schedule_cron FROM feed_configs WHERE feed_name = 'cloudflare_scanner'"
      ).first<{ feed_name: string; enabled: number; schedule_cron: string }>();
      const cfStatus = await env.DB.prepare(
        "SELECT health_status, last_successful_pull, last_failure FROM feed_status WHERE feed_name = 'cloudflare_scanner'"
      ).first<{ health_status: string; last_successful_pull: string | null; last_failure: string | null }>();
      const cfDiag = [
        `config=${cfConfig ? `found(enabled=${cfConfig.enabled},cron=${cfConfig.schedule_cron})` : 'MISSING'}`,
        `status=${cfStatus ? `${cfStatus.health_status}(last_ok=${cfStatus.last_successful_pull || 'never'},last_fail=${cfStatus.last_failure || 'never'})` : 'MISSING'}`,
        `module=${feedModules['cloudflare_scanner'] ? 'registered' : 'NOT_REGISTERED'}`,
        `account_id=${env.CF_ACCOUNT_ID ? 'set' : 'MISSING'}`,
        `api_token=${env.CF_API_TOKEN ? 'set' : 'MISSING'}`,
      ].join(', ');
      await env.DB.prepare(
        "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
      ).bind('diag_cf_' + Date.now(), 'CF SCANNER: ' + cfDiag).run();
    } catch (e) { console.error("[cron] cf diagnostic error:", e); }

    console.log("[cron] === CRON TRIGGERED ===", new Date().toISOString());
    console.log("[cron] feedModules registered:", Object.keys(feedModules).join(", "));
    ctx.waitUntil(
      runAllFeeds(env, feedModules)
        .then(async (r) => {
          console.log(`[cron] feeds: ${r.feedsRun} run, ${r.totalNew} new items, ${r.feedsFailed} failed, ${r.feedsSkipped} skipped`);

          // Run enrichment pipeline after ingestion
          try {
            const { runEnrichmentPipeline } = await import("./lib/enrichment");
            const enrichResult = await runEnrichmentPipeline(env);
            console.log(`[cron] enrichment: dns=${enrichResult.dnsResolved}, geo=${enrichResult.geoEnriched}, whois=${enrichResult.whoisEnriched}, brands=${enrichResult.brandsMatched}, ranks=${enrichResult.domainRanksChecked}`);
          } catch (err) {
            console.error("[cron] enrichment error:", err);
          }

          // Auto-trigger v2 AI agents after ingestion + enrichment
          try {
            const { agentModules: allAgents } = await import("./agents/index");
            const { executeAgent } = await import("./lib/agentRunner");

            // Event-triggered agents (run on every ingestion with new data)
            if (r.totalNew > 0) {
              const mod = allAgents["sentinel"];
              if (mod) {
                const result = await executeAgent(env, mod, { newItems: r.totalNew }, "cron", "event");
                console.log(`[cron] agent sentinel: ${result.status}${result.result ? `, processed=${result.result.itemsProcessed}` : ""}`);
              }
            }

            // Scheduled agents (run based on time — every Nth invocation)
            const now = new Date();
            const hour = now.getUTCHours();
            const minute = now.getUTCMinutes();

            // Analyst trigger diagnostics
            const analystApiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
            const analystKeySource = env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : env.LRX_API_KEY ? "LRX_API_KEY" : "NONE";
            const analystShouldRun = minute % 15 < 5;
            console.log(`[cron] analyst check: minute=${minute}, minute%15=${minute % 15}, shouldRun=${analystShouldRun}, apiKey=${analystKeySource}:${analystApiKey ? "truthy(" + analystApiKey.slice(0, 10) + "...)" : "FALSY"}`);

            // Analyst runs every 15 minutes
            if (analystShouldRun) {
              const mod = allAgents["analyst"];
              if (mod) {
                console.log(`[cron] analyst: TRIGGERING (module found)`);
                const result = await executeAgent(env, mod, {}, "cron", "scheduled");
                console.log(`[cron] agent analyst: ${result.status}${result.result ? `, processed=${result.result.itemsProcessed}, updated=${result.result.itemsUpdated}` : ""}`);
              } else {
                console.error(`[cron] analyst: module NOT found in allAgents — keys: ${Object.keys(allAgents).join(", ")}`);
              }
            }

            // Strategist + Cartographer run every 6 hours (0, 6, 12, 18)
            if (hour % 6 === 0 && minute < 5) {
              for (const name of ["strategist", "cartographer"] as const) {
                const mod = allAgents[name];
                if (mod) {
                  const result = await executeAgent(env, mod, {}, "cron", "scheduled");
                  console.log(`[cron] agent ${name}: ${result.status}`);
                }
              }
            }

            // Observer runs daily at midnight UTC
            if (hour === 0 && minute < 5) {
              const mod = allAgents["observer"];
              if (mod) {
                const result = await executeAgent(env, mod, {}, "cron", "scheduled");
                console.log(`[cron] agent observer: ${result.status}`);
              }
            }

            // Seed Strategist runs daily at 6am UTC
            if (hour === 6 && minute < 5) {
              try {
                const { seedStrategistAgent } = await import("./agents/seed-strategist");
                const result = await executeAgent(env, seedStrategistAgent, {}, "cron", "scheduled");
                console.log(`[cron] agent seed_strategist: ${result.status}`);
              } catch (ssErr) {
                console.error("[cron] seed strategist error:", ssErr);
              }
            }

            // Daily snapshots — run at midnight UTC, or if none exist yet (bootstrap)
            try {
              const { generateDailySnapshots } = await import("./lib/snapshots");
              const today = new Date().toISOString().slice(0, 10);
              const hasSnapshotToday = await env.DB.prepare(
                "SELECT COUNT(*) as n FROM daily_snapshots WHERE date = ?"
              ).bind(today).first<{ n: number }>();

              if (hour === 0 && minute < 5 || (hasSnapshotToday?.n ?? 0) === 0) {
                console.log(`[cron] generating daily snapshots (hour=${hour}, existing=${hasSnapshotToday?.n ?? 0})`);
                const snapResult = await generateDailySnapshots(env.DB, today);
                console.log(`[cron] snapshots: brands=${snapResult.brandSnapshots}, providers=${snapResult.providerSnapshots}`);
              }
            } catch (err) {
              console.error("[cron] snapshot error:", err);
            }
          } catch (err) {
            console.error("[cron] agent auto-trigger error:", err);
          }
        })
        .catch((err) => console.error("[cron] feed runner error:", err))
    );
  },

  async email(message: { from: string; to: string; headers: Headers; raw: ReadableStream<Uint8Array>; rawSize: number; setReject(r: string): void; forward(to: string, headers?: Headers): Promise<void> }, env: Env, ctx: ExecutionContext): Promise<void> {
    // Accept ALL emails — never reject/bounce (Google/Microsoft stop sending on bounces)
    const to = message.to;

    // Route DMARC reports to existing handler
    if (to === "dmarc_rua@trustradar.ca") {
      ctx.waitUntil(handleDmarcEmail(message, env));
      return;
    }

    // Everything else goes to spam trap
    ctx.waitUntil(handleSpamTrapEmail(message as any, env));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Honeypot pages only serve from lrxradar.com
      const url = new URL(request.url);
      if (url.hostname === "lrxradar.com") {
        const honeypotPages = ["/contact", "/team", "/careers", "/about"];
        if (honeypotPages.includes(url.pathname)) {
          return applySecurityHeaders(serveHoneypotPage(url.pathname.slice(1)));
        }
        // Default: redirect to trustradar.ca
        if (!url.pathname.startsWith("/api/") && url.pathname !== "/health") {
          return Response.redirect("https://trustradar.ca", 301);
        }
      }

      const response = await router.fetch(request, env, ctx);
      return applySecurityHeaders(response);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("Unhandled worker error:", err);
      try {
        await env.DB.prepare(
          "INSERT INTO agent_outputs (id, agent_id, type, summary, created_at) VALUES (?, 'sentinel', 'diagnostic', ?, datetime('now'))"
        ).bind(
          'err-' + Date.now(),
          'WORKER ERROR: ' + err.message + ' | ' + (err.stack?.substring(0, 300) ?? '')
        ).run();
      } catch { /* DB write failed — don't mask the original error */ }
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
