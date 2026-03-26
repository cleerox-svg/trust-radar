import { Router } from "itty-router";
import { handleOptions } from "./lib/cors";
import { applySecurityHeaders } from "./middleware/security";
import { handleDmarcEmail } from "./dmarc-receiver";
import type { EmailMessage } from "./dmarc-receiver";
import { handleSpamTrapEmail } from "./spam-trap";
import { serveHoneypotPage } from "./honeypot";
import { serveLrxRadarPage } from "./templates/honeypot-lrx";
import type { Env } from "./types";
import { handleScheduled } from "./cron/orchestrator";

// ─── Route modules ──────────────────────────────────────────────────
import { registerPublicRoutes } from "./routes/public";
import { registerAuthRoutes } from "./routes/auth";
import { registerScanRoutes } from "./routes/scan";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerBrandRoutes } from "./routes/brands";
import { registerThreatRoutes } from "./routes/threats";
import { registerInvestigationRoutes } from "./routes/investigations";
import { registerAdminRoutes } from "./routes/admin";
import { registerTenantRoutes } from "./routes/tenant";
import { registerAgentRoutes } from "./routes/agents";
import { registerSpamTrapRoutes } from "./routes/spam-trap";
import { registerEmailSecurityRoutes } from "./routes/email-security";
import { registerFeedRoutes } from "./routes/feeds";
import { registerExportRoutes } from "./routes/export";
import { registerSparrowRoutes } from "./routes/sparrow";

export { ThreatPushHub } from "./durableObjects/ThreatPushHub";

// ─── Honeypot Domain Server ─────────────────────────────────────────
async function serveHoneypotDomain(url: URL, env: Env): Promise<Response> {
  const hostname = url.hostname;
  const path = url.pathname;

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

// ─── Router setup ────────────────────────────────────────────────────
const router = Router();

// CORS preflight
router.options("*", (request: Request) => handleOptions(request));

// Register all route modules
registerAuthRoutes(router);
registerScanRoutes(router);
registerDashboardRoutes(router);
registerBrandRoutes(router);
registerThreatRoutes(router);
registerInvestigationRoutes(router);
registerFeedRoutes(router);
registerExportRoutes(router);
registerAgentRoutes(router);
registerSpamTrapRoutes(router);
registerSparrowRoutes(router);
registerEmailSecurityRoutes(router);
registerTenantRoutes(router);
registerAdminRoutes(router);
// Public routes + SPA fallback must be last
registerPublicRoutes(router);

// ─── Worker export ───────────────────────────────────────────────────
export default {
  scheduled: handleScheduled,

  async email(message: { from: string; to: string; headers: Headers; raw: ReadableStream<Uint8Array>; rawSize: number; setReject(r: string): void; forward(to: string, headers?: Headers): Promise<void> }, env: Env, ctx: ExecutionContext): Promise<void> {
    // Accept ALL emails — never reject/bounce (Google/Microsoft stop sending on bounces)
    const to = message.to;

    if (to === "dmarc_rua@averrow.com" || to === "dmarc_rua@trustradar.ca") {
      ctx.waitUntil(handleDmarcEmail(message, env));
      return;
    }

    ctx.waitUntil(handleSpamTrapEmail(message as unknown as EmailMessage, env));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      // www → non-www redirect for averrow.com
      if (url.hostname === "www.averrow.com" && !url.pathname.startsWith("/api/")) {
        return Response.redirect(`https://averrow.com${url.pathname}${url.search}`, 301);
      }
      // averrow.ca → averrow.com redirect
      if ((url.hostname === "averrow.ca" || url.hostname === "www.averrow.ca") && !url.pathname.startsWith("/api/")) {
        return Response.redirect(`https://averrow.com${url.pathname}${url.search}`, 301);
      }
      // Legacy trustradar.ca → averrow.com 301 redirect
      if ((url.hostname === "trustradar.ca" || url.hostname === "www.trustradar.ca") && !url.pathname.startsWith("/api/")) {
        return Response.redirect(`https://averrow.com${url.pathname}${url.search}`, 301);
      }
      // www.lrxradar.com → lrxradar.com redirect
      if (url.hostname === "www.lrxradar.com" && !url.pathname.startsWith("/api/")) {
        return Response.redirect(`https://lrxradar.com${url.pathname}${url.search}`, 301);
      }

      // Honeypot domain routing — serve KV-stored sites for throwaway domains
      const knownDomains = ["averrow.com", "www.averrow.com", "averrow.ca", "www.averrow.ca", "trustradar.ca", "www.trustradar.ca", "lrxradar.com", "www.lrxradar.com"];
      if (!knownDomains.includes(url.hostname)) {
        const honeypotDomains = await env.CACHE.get("honeypot:domains").then(
          v => v ? JSON.parse(v) as string[] : [],
        ).catch(() => [] as string[]);
        if (honeypotDomains.includes(url.hostname)) {
          return applySecurityHeaders(await serveHoneypotDomain(url, env));
        }
      }

      // lrxradar.com serves as a full honeypot site
      if (url.hostname === "lrxradar.com") {
        return applySecurityHeaders(serveLrxRadarPage(url.pathname));
      }

      // Honeypot pages on averrow.com — only /team and /careers
      if (["averrow.com", "www.averrow.com"].includes(url.hostname)) {
        const honeypotPages = ["/team", "/careers"];
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
