import { Router } from "itty-router";
import { handleOptions, json } from "./lib/cors";
import { handleOAuthLogin, handleOAuthInviteLogin, handleOAuthCallback, handleRefreshToken, handleLogout, handleMe } from "./handlers/auth";
import { handleScan, handleScanHistory } from "./handlers/scan";
import { handleHeatmap } from "./handlers/heatmap";
import {
  handleObservatoryNodes, handleObservatoryArcs, handleObservatoryLive,
  handleObservatoryBrandArcs, handleObservatoryStats,
} from "./handlers/observatory";
import { renderHomepage, renderAssessResults } from "./templates/homepage";
import { renderLandingPage } from "./templates/landing";
import { renderScanPage } from "./templates/scan";
import { handleScanReport } from "./handlers/scanReport";
import { handleScanPage } from "./handlers/scanPage";
import { handleStats, handleSourceMix, handleQualityTrend, handlePublicStats as handlePublicStatsV2 } from "./handlers/stats";
import { handleHealthCheck } from "./handlers/health";
import { handleSignals, handleIngestSignal } from "./handlers/signals";
import { handleAdminStats, handleAdminListUsers, handleAdminUpdateUser, handleAdminHealth, handleBackfillClassifications, handleBackfillGeo, handleBackfillBrandMatch, handleBackfillSafeDomains, handleImportTranco, handleAdminListBrands, handleBulkMonitor, handleBulkDeleteBrands, handleBackfillAiAttribution } from "./handlers/admin";
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
  handleCreateBrand as handleCreateBrandProfile,
  handleListBrands as handleListBrandProfiles,
  handleGetBrand as handleGetBrandProfile,
  handleUpdateBrand as handleUpdateBrandProfile,
  handleDeleteBrand as handleDeleteBrandProfile,
  handleUpdateHandles as handleUpdateBrandHandles,
  handleGetHandles as handleGetBrandHandles,
} from "./handlers/brandProfiles";
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
  handleListAlerts, handleGetAlert, handleUpdateAlert, handleAlertStats,
} from "./handlers/alerts";
import {
  handleGetEmailSecurity,
  handleScanBrandEmailSecurity,
  handleScanAllEmailSecurity,
  handlePublicEmailSecurity,
  handleEmailSecurityStats,
} from "./handlers/emailSecurity";
import {
  handleGetThreatAssessment, handleGetThreatAssessmentHistory,
  handleThreatFeedStats,
} from "./handlers/threatAssessment";
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
import {
  handleListSalesLeads, handleGetSalesLead, handleUpdateSalesLead,
  handleApproveLead, handleSendLead, handleRespondLead,
  handleBookLead, handleConvertLead, handleDeclineLead,
  handleDeleteSalesLead, handleLeadActivity, handleSalesLeadStats,
} from "./handlers/salesLeads";
import type { Env } from "./types";
import { handleScheduled } from "./cron/orchestrator";
export { ThreatPushHub } from "./durableObjects/ThreatPushHub";

// ─── Honeypot Domain Server ─────────────────────────────────
async function serveHoneypotDomain(url: URL, env: Env): Promise<Response> {
  const hostname = url.hostname;
  const path = url.pathname;

  // Route mapping: / → index, /contact → contact, /team → team
  const pageMap: Record<string, string> = {
    "/": "index", "/contact": "contact", "/team": "team", "/about": "team",
    "/robots.txt": "robots", "/sitemap.xml": "sitemap",
  };
  const page = pageMap[path];
  if (!page) return new Response("Not Found", { status: 404 });

  const kvKey = `honeypot-site:${hostname}:${page}`;
  const content = await env.CACHE.get(kvKey);
  if (!content) return new Response("Not Found", { status: 404 });

  const contentType = page === "sitemap"
    ? "application/xml"
    : page === "robots"
      ? "text/plain"
      : "text/html";

  return new Response(content, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

const router = Router();

// ─── CORS preflight ───────────────────────────────────────────
router.options("*", (request: Request) => handleOptions(request));

// ─── Health / diagnostics ─────────────────────────────────────
router.get("/health", (request: Request, env: Env) => handleHealthCheck(request, env));

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

// ─── Brand Exposure Report (public, rate-limited) ─────────────
router.post("/api/scan/report", async (request: Request, env: Env) => {
  const limited = await rateLimit(request, env, "scan_report");
  if (limited) return limited;
  return handleScanReport(request, env);
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

// ─── Alerts (unified pipeline) ───────────────────────────────
router.get("/api/alerts/stats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleAlertStats(request, env, ctx.userId);
});
router.get("/api/alerts/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetAlert(request, env, request.params["id"] ?? "");
});
router.patch("/api/alerts/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateAlert(request, env, request.params["id"] ?? "");
});
router.get("/api/alerts", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListAlerts(request, env, ctx.userId);
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

// ─── Brand Profiles (Social Monitoring) ─────────────────────
router.post("/api/brand-profiles", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleCreateBrandProfile(request, env, ctx.userId);
});
router.get("/api/brand-profiles", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListBrandProfiles(request, env, ctx.userId);
});
router.get("/api/brand-profiles/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetBrandProfile(request, env, request.params["id"] ?? "", ctx.userId);
});
router.patch("/api/brand-profiles/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateBrandProfile(request, env, request.params["id"] ?? "", ctx.userId);
});
router.delete("/api/brand-profiles/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDeleteBrandProfile(request, env, request.params["id"] ?? "", ctx.userId);
});
router.post("/api/brand-profiles/:id/handles", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateBrandHandles(request, env, request.params["id"] ?? "", ctx.userId);
});
router.get("/api/brand-profiles/:id/handles", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetBrandHandles(request, env, request.params["id"] ?? "", ctx.userId);
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

// ─── Sales Leads (Prospector) ─────────────────────────────
router.get("/api/admin/sales-leads", async (request: Request, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleListSalesLeads(request, env);
});
router.get("/api/admin/sales-leads/stats", async (request: Request, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleSalesLeadStats(request, env);
});
router.get("/api/admin/sales-leads/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetSalesLead(request, env, request.params["id"] ?? "");
});
router.patch("/api/admin/sales-leads/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleUpdateSalesLead(request, env, request.params["id"] ?? "");
});
router.post("/api/admin/sales-leads/:id/approve", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleApproveLead(request, env, request.params["id"] ?? "");
});
router.post("/api/admin/sales-leads/:id/send", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleSendLead(request, env, request.params["id"] ?? "");
});
router.post("/api/admin/sales-leads/:id/respond", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleRespondLead(request, env, request.params["id"] ?? "");
});
router.post("/api/admin/sales-leads/:id/book", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBookLead(request, env, request.params["id"] ?? "");
});
router.post("/api/admin/sales-leads/:id/convert", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleConvertLead(request, env, request.params["id"] ?? "");
});
router.post("/api/admin/sales-leads/:id/decline", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDeclineLead(request, env, request.params["id"] ?? "");
});
router.delete("/api/admin/sales-leads/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleDeleteSalesLead(request, env, request.params["id"] ?? "");
});
router.get("/api/admin/sales-leads/:id/activity", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireSuperAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleLeadActivity(request, env, request.params["id"] ?? "");
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
router.post("/api/admin/backfill-brand-match", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBackfillBrandMatch(request, env);
});
router.post("/api/admin/backfill-safe-domains", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBackfillSafeDomains(request, env);
});
router.post("/api/admin/backfill-ai-attribution", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleBackfillAiAttribution(request, env);
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

// ─── Honeypot Site Generator ─────────────────────────────────
router.post("/api/admin/honeypot/generate", async (request: Request, env: Env) => {
  const ctx = await requireAdmin(request, env);
  if (!isAuthContext(ctx)) return ctx;

  const body = await request.json() as {
    hostname: string;
    businessName: string;
    businessType: string;
    city: string;
    seedCount?: number;
  };

  if (!body.hostname || !body.businessName || !body.businessType || !body.city) {
    return Response.json({ success: false, error: "Missing required fields: hostname, businessName, businessType, city" }, { status: 400 });
  }

  const seedCount = body.seedCount || 5;

  try {
    const { generateTrapAddresses, generateTeamMembers, generateHoneypotSite } = await import("./honeypot-generator");

    // Generate trap addresses
    const traps = generateTrapAddresses(body.hostname, seedCount);
    const trapAddresses = traps.map(t => ({
      address: t.address,
      role: t.role,
    }));

    // Generate team members using a subset of trap addresses
    const teamMembers = generateTeamMembers(body.hostname, trapAddresses, Math.min(seedCount, 5));

    // Generate site HTML via Haiku
    const site = await generateHoneypotSite(env, {
      hostname: body.hostname,
      businessName: body.businessName,
      businessType: body.businessType,
      city: body.city,
      trapAddresses,
      teamMembers,
    });

    // Store pages in KV
    await Promise.all([
      env.CACHE.put(`honeypot-site:${body.hostname}:index`, site.index, { expirationTtl: 86400 * 365 }),
      env.CACHE.put(`honeypot-site:${body.hostname}:contact`, site.contact, { expirationTtl: 86400 * 365 }),
      env.CACHE.put(`honeypot-site:${body.hostname}:team`, site.team, { expirationTtl: 86400 * 365 }),
      env.CACHE.put(`honeypot-site:${body.hostname}:sitemap`, site.sitemap, { expirationTtl: 86400 * 365 }),
      env.CACHE.put(`honeypot-site:${body.hostname}:robots`, site.robots, { expirationTtl: 86400 * 365 }),
    ]);

    // Add hostname to honeypot domains list
    const existingDomains = await env.CACHE.get("honeypot:domains").then(
      v => v ? JSON.parse(v) as string[] : [],
    ).catch(() => [] as string[]);
    if (!existingDomains.includes(body.hostname)) {
      existingDomains.push(body.hostname);
      await env.CACHE.put("honeypot:domains", JSON.stringify(existingDomains), { expirationTtl: 86400 * 365 });
    }

    // Create seed campaign
    const campaignId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO seed_campaigns (id, name, channel, status, addresses_seeded, created_at)
       VALUES (?, ?, 'honeypot', 'active', ?, datetime('now'))`
    ).bind(campaignId, `Honeypot: ${body.hostname}`, seedCount).run();

    // Insert seed addresses
    for (const trap of traps) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO seed_addresses (address, domain, channel, campaign_id, is_active, seeded_at, total_catches)
         VALUES (?, ?, 'honeypot', ?, 1, datetime('now'), 0)`
      ).bind(trap.address, body.hostname, campaignId).run();
    }

    // Audit log
    try {
      await env.AUDIT_DB.prepare(
        `INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, outcome, details, ip_address, timestamp)
         VALUES (?, ?, 'honeypot_generate', 'honeypot', ?, 'success', ?, ?, datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        ctx.userId,
        body.hostname,
        JSON.stringify({ seedCount, businessName: body.businessName }),
        request.headers.get("CF-Connecting-IP") || "unknown",
      ).run();
    } catch { /* non-fatal */ }

    return Response.json({
      success: true,
      data: {
        hostname: body.hostname,
        pages: ["index", "contact", "team", "sitemap", "robots"],
        seedAddresses: traps.map(t => t.address),
        campaignId,
        teamMembers: teamMembers.map(m => ({ name: m.name, title: m.title, email: m.email })),
      },
    });
  } catch (err) {
    console.error("[honeypot-generate] error:", err);
    return Response.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
});

// ─── Public Landing Page (corporate site) ────────────────────
router.get("/", () =>
  new Response(renderLandingPage(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
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

// ─── Public Brand Exposure Scan Page ──────────────────────────
router.get("/scan", () =>
  new Response(renderScanPage(), {
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

// ─── Threat Assessment ────────────────────────────────────────
router.get("/api/brand/:brandId/threat-assessment/history", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetThreatAssessmentHistory(request, env, request.params["brandId"] ?? "");
});
router.get("/api/brand/:brandId/threat-assessment", async (request: Request & { params: Record<string, string> }, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleGetThreatAssessment(request, env, request.params["brandId"] ?? "");
});
router.get("/api/threat-feeds/stats", async (request: Request, env: Env) => {
  const ctx = await requireAuth(request, env);
  if (!isAuthContext(ctx)) return ctx;
  return handleThreatFeedStats(request, env);
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
router.get("/api/stats/public", (request: Request, env: Env) => handlePublicStatsV2(request, env));

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
  scheduled: handleScheduled,

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
      const url = new URL(request.url);

      // Canonical-host redirect: www → non-www (preserves path + query).
      // Skip API routes so OAuth callbacks are never intercepted.
      if (
        (url.hostname === "www.trustradar.ca" || url.hostname === "www.lrxradar.com") &&
        !url.pathname.startsWith("/api/")
      ) {
        const canonical = url.hostname === "www.trustradar.ca" ? "trustradar.ca" : "trustradar.ca";
        return Response.redirect(`https://${canonical}${url.pathname}${url.search}`, 301);
      }

      // Honeypot domain routing — serve KV-stored sites for throwaway domains
      // For each honeypot domain, add to wrangler.toml:
      //   { pattern = "example-business.xyz", custom_domain = true },
      const knownDomains = ["lrxradar.com", "www.lrxradar.com", "trustradar.ca", "www.trustradar.ca"];
      if (!knownDomains.includes(url.hostname)) {
        const honeypotDomains = await env.CACHE.get("honeypot:domains").then(
          v => v ? JSON.parse(v) as string[] : [],
        ).catch(() => [] as string[]);
        if (honeypotDomains.includes(url.hostname)) {
          return applySecurityHeaders(await serveHoneypotDomain(url, env));
        }
      }

      // Honeypot pages serve from lrxradar.com and trustradar.ca
      if (["lrxradar.com", "www.lrxradar.com", "trustradar.ca", "www.trustradar.ca"].includes(url.hostname)) {
        const honeypotPages = ["/contact", "/team", "/careers", "/about"];
        if (honeypotPages.includes(url.pathname)) {
          const serveDomain = url.hostname.replace(/^www\./, "");
          return applySecurityHeaders(serveHoneypotPage(url.pathname.slice(1), serveDomain));
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
