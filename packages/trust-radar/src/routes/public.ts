import { Router } from "itty-router";
import type { RouterType, IRequest } from "itty-router";
import type { Env } from "../types";
import { rateLimit } from "../middleware/rateLimit";
import { json } from "../lib/cors";
import { renderHomepage, renderAssessResults } from "../templates/homepage";
import { renderScanPage } from "../templates/scan";
import { renderPlatformPage } from "../templates/platform";
import { renderAboutPage } from "../templates/about";
import { renderPricingPage } from "../templates/pricing";
import { renderSecurityPage } from "../templates/security";
import { renderBlogPage } from "../templates/blog";
import { renderBlogPost1 } from "../templates/blog-post-1";
import { renderBlogPost2 } from "../templates/blog-post-2";
import { renderBlogPost3 } from "../templates/blog-post-3";
import { renderBlogPost4 } from "../templates/blog-post-4";
import { renderChangelogPage } from "../templates/changelog";
import { renderContactPage } from "../templates/contact";
import { renderNotFoundPage } from "../templates/not-found";
import { renderPrivacyPage } from "../templates/privacy";
import { renderTermsPage } from "../templates/terms";
import { handleContactSubmission } from "../handlers/contact";
import { handleScanPage } from "../handlers/scanPage";
import { handlePublicBrandScan } from "../handlers/brandScan";
import {
  handlePublicStats, handlePublicGeo, handlePublicAssess, handlePublicLeadCapture,
  handlePublicMonitor, handlePublicFeeds,
} from "../handlers/public";
import { handlePublicStats as handlePublicStatsV2 } from "../handlers/stats";
import { handlePublicEmailSecurity } from "../handlers/emailSecurity";

const htmlPage = (render: () => string) => () =>
  new Response(render(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });

export function registerPublicRoutes(router: RouterType<IRequest>): void {
  // ─── Homepage ────────────────────────────────────────────────────
  router.get("/", () =>
    new Response(renderHomepage(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    })
  );

  // ─── Public Assessment ───────────────────────────────────────────
  router.post("/assess", async (request: Request, env: Env) => {
    const limited = await rateLimit(request, env, "scan");
    if (limited) return limited;
    try {
      const ct = request.headers.get("Content-Type") ?? "";
      let domain: string | undefined;
      if (ct.includes("application/x-www-form-urlencoded")) {
        const form = await request.formData();
        domain = (form.get("domain") as string)?.toLowerCase().trim();
      } else {
        const body = await request.json() as { domain?: string };
        domain = body.domain?.toLowerCase().trim();
      }
      domain = domain?.replace(/^https?:\/\//, "").split("/")[0];
      if (!domain || !domain.includes(".")) {
        return Response.redirect(new URL("/", request.url).toString(), 302);
      }
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
      const row = await env.DB.prepare(
        "SELECT id FROM brand_scans WHERE domain = ? ORDER BY created_at DESC LIMIT 1"
      ).bind(domain).first<{ id: string }>();
      const id = row?.id ?? "unknown";
      return Response.redirect(new URL(`/assess/${id}/results`, request.url).toString(), 303);
    } catch {
      return Response.redirect(new URL("/", request.url).toString(), 302);
    }
  });

  router.get("/assess/:id/results", (request: Request & { params: Record<string, string> }) =>
    new Response(renderAssessResults(request.params["id"] ?? ""), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );

  // ─── Redirect ────────────────────────────────────────────────────
  router.get("/dashboard/social", () => Response.redirect("/social", 301));

  // ─── Corporate Site Pages ─────────────────────────────────────────
  router.get("/platform", htmlPage(renderPlatformPage));
  router.get("/about", htmlPage(renderAboutPage));
  router.get("/pricing", htmlPage(renderPricingPage));
  router.get("/security", htmlPage(renderSecurityPage));
  router.get("/blog", htmlPage(renderBlogPage));
  router.get("/blog/email-security-posture-brand-defense", htmlPage(renderBlogPost1));
  router.get("/blog/cost-brand-impersonation-mid-market", htmlPage(renderBlogPost2));
  router.get("/blog/ai-powered-threat-narratives", htmlPage(renderBlogPost3));
  router.get("/blog/lookalike-domains-threat-hiding", htmlPage(renderBlogPost4));
  router.get("/changelog", htmlPage(renderChangelogPage));
  router.get("/contact", htmlPage(renderContactPage));
  router.get("/privacy", htmlPage(renderPrivacyPage));
  router.get("/terms", htmlPage(renderTermsPage));

  // ─── Contact Form Submission ─────────────────────────────────────
  router.post("/api/contact", async (request: Request, env: Env) => {
    return handleContactSubmission(request, env);
  });

  // ─── Public Brand Exposure Scan Page ─────────────────────────────
  router.get("/scan", () =>
    new Response(renderScanPage(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );

  router.get("/scan/:id", (request: Request & { params: Record<string, string> }, env: Env) =>
    handleScanPage(request, env, request.params["id"] ?? "")
  );

  // ─── WebSocket — ThreatPushHub Durable Object ─────────────────────
  router.get("/ws/threats", async (request: Request, env: Env) => {
    const id = env.THREAT_PUSH_HUB.idFromName("global");
    const hub = env.THREAT_PUSH_HUB.get(id);
    return hub.fetch(request);
  });

  // ─── Public API endpoints (no auth) ──────────────────────────────
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

  // ─── React app — serve v2/index.html for all /v2/* routes ────────
  router.get("/v2/*", async (request: Request, env: Env) => {
    const url = new URL(request.url);
    // Try to serve the exact file (JS, CSS, assets)
    const assetResponse = await env.ASSETS.fetch(new Request(new URL(url.pathname, request.url).toString()));
    if (assetResponse.ok && !url.pathname.endsWith('/') && url.pathname.includes('.')) {
      return assetResponse;
    }
    // Otherwise serve v2/index.html for client-side routing
    return env.ASSETS.fetch(new Request(new URL("/v2/index.html", request.url).toString()));
  });

  // ─── Static assets fallback (SPA) ────────────────────────────────
  router.all("*", async (request: Request, env: Env) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return json({ success: false, error: "Not found" }, 404, request.headers.get("Origin"));
    }
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }
    const spaFallback = await env.ASSETS.fetch(new Request(new URL("/dashboard.html", request.url).toString()));
    if (spaFallback.status !== 404) return spaFallback;
    return new Response(renderNotFoundPage(), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  });
}
