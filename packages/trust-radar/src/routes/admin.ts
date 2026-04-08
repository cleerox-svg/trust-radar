import { Router } from "itty-router";
import type { RouterType, IRequest } from "itty-router";
import type { Env } from "../types";
import { requireAdmin, requireSuperAdmin, isAuthContext } from "../middleware/auth";
import { json } from "../lib/cors";
import {
  handleAdminStats, handleAdminListUsers, handleAdminUpdateUser, handleAdminHealth, handleSystemHealth,
  handleBackfillClassifications, handleBackfillGeo, handleBackfillDomainGeo, handleBackfillBrandMatch,
  handleBackfillSafeDomains, handleImportTranco, handleAdminListBrands,
  handleBulkMonitor, handleBulkDeleteBrands, handleBackfillAiAttribution,
  handleBackfillSocialConfig, handleBackfillSaasTechniques,
} from "../handlers/admin";
import { handleListSessionEvents, handleForceLogout } from "../handlers/sessions";
import { handleCreateInvite, handleListInvites, handleRevokeInvite } from "../handlers/invites";
import {
  handleCreateOrg, handleListOrgs, handleGetOrg, handleUpdateOrg,
  handleSearchBrands,
} from "../handlers/organizations";
import {
  handleAdminListTakedowns, handleAdminUpdateTakedown,
} from "../handlers/takedowns";
import { handleListLeads, handleUpdateLead } from "../handlers/brandScan";
import {
  handleListSalesLeads, handleGetSalesLead, handleUpdateSalesLead,
  handleApproveLead, handleSendLead, handleRespondLead,
  handleBookLead, handleConvertLead, handleDeclineLead,
  handleDeleteSalesLead, handleLeadActivity, handleSalesLeadStats,
} from "../handlers/salesLeads";
import { handleListAuditLog, handleExportAuditLog } from "../handlers/audit";
import { handleEnrichGeo, handleEnrichAll, handleDailySnapshots } from "../handlers/threats";
import { handleBudgetStatus, handleBudgetBreakdown, handleBudgetConfigPatch } from "../handlers/budget";

export function registerAdminRoutes(router: RouterType<IRequest>): void {
  // ─── Admin Stats & Health ─────────────────────────────────────────
  router.get("/api/admin/stats", async (request: Request, env: Env) => {
    const ctx = await requireAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleAdminStats(request, env);
  });
  router.get("/api/admin/health", async (request: Request, env: Env) => {
    const ctx = await requireAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleAdminHealth(request, env);
  });
  router.get("/api/admin/system-health", async (request: Request, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleSystemHealth(request, env);
  });

  // ─── Admin Users ──────────────────────────────────────────────────
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

  // ─── Session Events ───────────────────────────────────────────────
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

  // ─── Invites ──────────────────────────────────────────────────────
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

  // ─── Organizations (superadmin) ───────────────────────────────────
  router.post("/api/admin/organizations", async (request: Request, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleCreateOrg(request, env, ctx.userId);
  });
  router.get("/api/admin/organizations", async (request: Request, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleListOrgs(request, env);
  });
  router.get("/api/admin/organizations/:orgId", async (request: Request & { params: Record<string, string> }, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleGetOrg(request, env, request.params["orgId"] ?? "");
  });
  router.patch("/api/admin/organizations/:orgId", async (request: Request & { params: Record<string, string> }, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleUpdateOrg(request, env, request.params["orgId"] ?? "");
  });
  router.get("/api/admin/brands/search", async (request: Request, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleSearchBrands(request, env);
  });

  // ─── Takedown Queue (superadmin) ─────────────────────────────────
  router.get("/api/admin/takedowns", async (request: Request, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleAdminListTakedowns(request, env);
  });
  router.patch("/api/admin/takedowns/:id", async (request: Request & { params: Record<string, string> }, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleAdminUpdateTakedown(request, env, request.params["id"] ?? "", ctx);
  });

  // ─── Leads Management ─────────────────────────────────────────────
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

  // ─── Sales Leads (Prospector) ─────────────────────────────────────
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

  // ─── Pathfinder AI Enrichment ─────────────────────────────────────
  router.post("/api/admin/pathfinder-enrich", async (request: Request, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    const { enrichLeadWithAI } = await import("../agents/prospector");
    const result = await enrichLeadWithAI(env);
    return json({ success: true, data: result });
  });

  // ─── Audit Log ────────────────────────────────────────────────────
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

  // ─── Backfill Endpoints ───────────────────────────────────────────
  router.post("/api/admin/backfill-classifications", async (request: Request, env: Env) => {
    const ctx = await requireAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBackfillClassifications(request, env);
  });
  router.post("/api/admin/backfill-saas-techniques", async (request: Request, env: Env) => {
    const ctx = await requireAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBackfillSaasTechniques(request, env);
  });
  router.post("/api/admin/backfill-geo", async (request: Request, env: Env) => {
    const ctx = await requireAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBackfillGeo(request, env);
  });
  router.post("/api/admin/backfill-domain-geo", async (request: Request, env: Env) => {
    const ctx = await requireAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBackfillDomainGeo(request, env);
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
  router.post("/api/admin/backfill-social-config", async (request: Request, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBackfillSocialConfig(request, env);
  });

  // ─── Brand Administration ─────────────────────────────────────────
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

  // ─── Social Discovery Batch ───────────────────────────────────────
  router.post("/api/admin/discover-social-batch", async (request: Request, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    try {
      const body = await request.json().catch(() => ({})) as { limit?: number };
      const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);
      const { runSocialDiscoveryBatch } = await import("../scanners/social-monitor");
      const result = await runSocialDiscoveryBatch(env, limit);
      return json({ success: true, data: result });
    } catch (err) {
      return json({ success: false, error: "An internal error occurred" }, 500);
    }
  });

  // ─── AI Budget Management ─────────────────────────────────────────
  router.get("/api/admin/budget/status", async (request: Request, env: Env) => {
    const ctx = await requireAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBudgetStatus(request, env);
  });
  router.get("/api/admin/budget/breakdown", async (request: Request, env: Env) => {
    const ctx = await requireAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBudgetBreakdown(request, env);
  });
  router.patch("/api/admin/budget/config", async (request: Request, env: Env) => {
    const ctx = await requireSuperAdmin(request, env);
    if (!isAuthContext(ctx)) return ctx;
    return handleBudgetConfigPatch(request, env);
  });

  // ─── Enrichment Utilities ─────────────────────────────────────────
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

  // ─── Honeypot Site Generator ──────────────────────────────────────
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
      const { generateTrapAddresses, generateTeamMembers, generateHoneypotSite } = await import("../honeypot-generator");

      const traps = generateTrapAddresses(body.hostname, seedCount);
      const trapAddresses = traps.map(t => ({ address: t.address, role: t.role }));
      const teamMembers = generateTeamMembers(body.hostname, trapAddresses, Math.min(seedCount, 5));

      const site = await generateHoneypotSite(env, {
        hostname: body.hostname,
        businessName: body.businessName,
        businessType: body.businessType,
        city: body.city,
        trapAddresses,
        teamMembers,
      });

      await Promise.all([
        env.CACHE.put(`honeypot-site:${body.hostname}:index`, site.index, { expirationTtl: 86400 * 365 }),
        env.CACHE.put(`honeypot-site:${body.hostname}:contact`, site.contact, { expirationTtl: 86400 * 365 }),
        env.CACHE.put(`honeypot-site:${body.hostname}:team`, site.team, { expirationTtl: 86400 * 365 }),
        env.CACHE.put(`honeypot-site:${body.hostname}:sitemap`, site.sitemap, { expirationTtl: 86400 * 365 }),
        env.CACHE.put(`honeypot-site:${body.hostname}:robots`, site.robots, { expirationTtl: 86400 * 365 }),
      ]);

      const existingDomains = await env.CACHE.get("honeypot:domains").then(
        v => v ? JSON.parse(v) as string[] : [],
      ).catch(() => [] as string[]);
      if (!existingDomains.includes(body.hostname)) {
        existingDomains.push(body.hostname);
        await env.CACHE.put("honeypot:domains", JSON.stringify(existingDomains), { expirationTtl: 86400 * 365 });
      }

      const campaignId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO seed_campaigns (id, name, channel, status, addresses_seeded, created_at)
         VALUES (?, ?, 'honeypot', 'active', ?, datetime('now'))`
      ).bind(campaignId, `Honeypot: ${body.hostname}`, seedCount).run();

      for (const trap of traps) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO seed_addresses (address, domain, channel, campaign_id, is_active, seeded_at, total_catches)
           VALUES (?, ?, 'honeypot', ?, 1, datetime('now'), 0)`
        ).bind(trap.address, body.hostname, campaignId).run();
      }

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
      return Response.json({ success: false, error: "An internal error occurred" }, { status: 500 });
    }
  });
}
