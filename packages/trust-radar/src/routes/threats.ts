import { Router } from "itty-router";
import type { RouterType, IRequest } from "itty-router";
import type { Env } from "../types";
import { requireAuth, requireAdmin, isAuthContext } from "../middleware/auth";
import {
  handleListThreats, handleThreatStats, handleGetThreat, handleUpdateThreat,
  handleListBriefings, handleGetBriefing, handleListSocialIOCs, handleEnrichGeo,
  handleEnrichAll, handleDailySnapshots, handleGeoClusters, handleAttackFlows,
  handleRecentThreats,
} from "../handlers/threats";
import { handleCorrelations } from "../handlers/correlations";
import { handleGenerateBriefing, handleListBriefingHistory } from "../handlers/briefing";
import {
  handleListCampaignsV2, handleCampaignStats, handleGetCampaign,
  handleCampaignThreats, handleCampaignInfrastructure, handleCampaignBrands,
  handleCampaignTimeline,
} from "../handlers/campaigns";
import {
  handleListBreaches, handleListATOEvents, handleUpdateATOEvent,
  handleListEmailAuth, handleListCloudIncidents, handleTrustScoreHistory,
} from "../handlers/intel";
import {
  handleProviderStats, handleListProviders, handleWorstProviders, handleImprovingProviders,
  handleGetProvider, handleProviderDrilldown, handleProviderBrands,
  handleProviderTimeline, handleProviderLocations,
  handleProviderIntelligence, handleListProvidersV2, handleListClusters, handleProviderClusters,
} from "../handlers/providers";
import { handleThreatFeedStats } from "../handlers/threatAssessment";

export function registerThreatRoutes(router: RouterType<IRequest>): void {
  // ─── Threats ──────────────────────────────────────────────────────
  router.get("/api/threats/correlations", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleCorrelations(request, env);
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
  router.get("/api/threats", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleListThreats(request, env);
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

  // ─── Threat Feed Stats ────────────────────────────────────────────
  router.get("/api/threat-feeds/stats", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleThreatFeedStats(request, env);
  });

  // ─── Briefings ────────────────────────────────────────────────────
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

  // ─── Social IOCs ──────────────────────────────────────────────────
  router.get("/api/social-iocs", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleListSocialIOCs(request, env);
  });

  // ─── Campaign Clusters ────────────────────────────────────────────
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

  // ─── Intel: Breach Checks ─────────────────────────────────────────
  router.get("/api/breaches", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleListBreaches(request, env);
  });

  // ─── Intel: Account Takeover ──────────────────────────────────────
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

  // ─── Intel: Email Auth Reports ────────────────────────────────────
  router.get("/api/email-auth", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleListEmailAuth(request, env);
  });

  // ─── Intel: Cloud Incidents ───────────────────────────────────────
  router.get("/api/cloud-incidents", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleListCloudIncidents(request, env);
  });

  // ─── Trust Score History ──────────────────────────────────────────
  router.get("/api/trust-scores", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleTrustScoreHistory(request, env);
  });

  // ─── Hosting Provider Intelligence ───────────────────────────────
  router.get("/api/providers/intelligence", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleProviderIntelligence(request, env);
  });
  router.get("/api/providers/v2", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleListProvidersV2(request, env);
  });
  router.get("/api/providers/clusters", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleListClusters(request, env);
  });
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
  router.get("/api/providers/:id/clusters", async (request: Request & { params: Record<string, string> }, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleProviderClusters(request, env, request.params["id"] ?? "");
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
}
