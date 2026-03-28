import { Router } from "itty-router";
import type { RouterType, IRequest } from "itty-router";
import type { Env } from "../types";
import { requireAuth, requireAdmin, isAuthContext } from "../middleware/auth";
import { handleStats, handleSourceMix, handleQualityTrend } from "../handlers/stats";
import { handleHeatmap } from "../handlers/heatmap";
import {
  handleObservatoryNodes, handleObservatoryArcs, handleObservatoryLive,
  handleObservatoryBrandArcs, handleObservatoryStats, handleObservatoryOperations,
} from "../handlers/observatory";
import { handleDashboardOverview, handleDashboardTopBrands, handleDashboardProviders } from "../handlers/dashboard";
import { handleSignals, handleIngestSignal } from "../handlers/signals";
import { handleListAlerts, handleGetAlert, handleUpdateAlert, handleAlertStats, handleBulkAcknowledge, handleBulkTakedown } from "../handlers/alerts";
import {
  handleListNotificationsV2, handleMarkNotificationReadV2, handleMarkAllNotificationsReadV2,
  handleUnreadCount, handleGetPreferences, handleUpdatePreferences,
} from "../handlers/notifications";
import { handleLatestInsights } from "../handlers/insights";
import {
  handleTrendVolume, handleTrendBrands, handleTrendProviders,
  handleTrendTLDs, handleTrendTypes, handleTrendCompare,
} from "../handlers/trends";

export function registerDashboardRoutes(router: RouterType<IRequest>): void {
  // ─── Dashboard Stats (v1) ─────────────────────────────────────────
  router.get("/api/dashboard/stats", (request: Request, env: Env) => handleStats(request, env));
  router.get("/api/dashboard/sources", (request: Request, env: Env) => handleSourceMix(request, env));
  router.get("/api/dashboard/trend", (request: Request, env: Env) => handleQualityTrend(request, env));

  // ─── Dashboard v2 (Observatory) ───────────────────────────────────
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

  // ─── Public Heatmap ───────────────────────────────────────────────
  router.get("/api/heatmap", (request: Request, env: Env) => handleHeatmap(request, env));

  // ─── Observatory (unauthenticated) ────────────────────────────────
  router.get("/api/observatory/nodes",      (request: Request, env: Env) => handleObservatoryNodes(request, env));
  router.get("/api/observatory/arcs",       (request: Request, env: Env) => handleObservatoryArcs(request, env));
  router.get("/api/observatory/live",       (request: Request, env: Env) => handleObservatoryLive(request, env));
  router.get("/api/observatory/brand-arcs", (request: Request, env: Env) => handleObservatoryBrandArcs(request, env));
  router.get("/api/observatory/stats",      (request: Request, env: Env) => handleObservatoryStats(request, env));
  router.get("/api/observatory/operations", (request: Request, env: Env) => handleObservatoryOperations(request, env));

  // ─── Signals ──────────────────────────────────────────────────────
  router.get("/api/signals", (request: Request, env: Env) => handleSignals(request, env));
  router.post("/api/signals", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleIngestSignal(request, env, ctx.userId);
  });

  // ─── Alerts ───────────────────────────────────────────────────────
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
  router.post("/api/alerts/bulk-acknowledge", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBulkAcknowledge(request, env, ctx.userId);
  });
  router.post("/api/alerts/bulk-takedown", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBulkTakedown(request, env, ctx.userId);
  });

  // ─── Notifications ────────────────────────────────────────────────
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

  // ─── Insights ─────────────────────────────────────────────────────
  router.get("/api/insights/latest", async (request: Request, env: Env) => {
    const ctx = await requireAuth(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleLatestInsights(request, env);
  });

  // ─── Trends ───────────────────────────────────────────────────────
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
}
