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
export { CertStreamMonitor } from "./durableObjects/CertStreamMonitor";
export { CartographerBackfillWorkflow } from "./workflows/cartographerBackfill";
export { NexusWorkflow } from "./workflows/nexusRun";

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

      // ─── Internal agent trigger endpoints ─────────────────────────
      if (url.pathname.startsWith('/api/internal/agents/') && request.method === 'POST') {
        const internalSecret = (env as unknown as Record<string, unknown>).INTERNAL_SECRET as string | undefined;
        const authHeader = request.headers.get('Authorization');
        if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
          return new Response('Unauthorized', { status: 401 });
        }

        if (url.pathname === '/api/internal/agents/cartographer/run') {
          const { agentModules } = await import('./agents/index');
          const { executeAgent } = await import('./lib/agentRunner');
          const mod = agentModules["cartographer"];
          if (mod) ctx.waitUntil(executeAgent(env, mod, { trigger: 'manual' }, "api", "event"));
          return Response.json({ triggered: true, agent: 'cartographer' });
        }

        if (url.pathname === '/api/internal/agents/nexus/run') {
          const { agentModules } = await import('./agents/index');
          const { executeAgent } = await import('./lib/agentRunner');
          const mod = agentModules["nexus"];
          if (mod) ctx.waitUntil(executeAgent(env, mod, {}, "api", "event"));
          return Response.json({ triggered: true, agent: 'nexus' });
        }

        if (url.pathname === '/api/internal/agents/cartographer/backfill') {
          const { agentModules } = await import('./agents/index');
          const { executeAgent } = await import('./lib/agentRunner');
          const mod = agentModules["cartographer"];
          if (mod) {
            const batches = 10;
            ctx.waitUntil((async () => {
              for (let i = 0; i < batches; i++) {
                await executeAgent(env, mod, { trigger: 'backfill', batch: i + 1 }, "api", "event");
                if (i < batches - 1) await new Promise(r => setTimeout(r, 2000));
              }
            })());
          }
          return Response.json({ triggered: true, agent: 'cartographer', batches: 10 });
        }

        // Durable backfill workflow — replaces fragile batch endpoint
        if (url.pathname === '/api/internal/agents/cartographer/backfill-workflow') {
          const instance = await env.CARTOGRAPHER_BACKFILL.create({
            params: { batchSize: 500, startOffset: 0 }
          });
          return Response.json({
            instanceId: instance.id,
            message: 'Backfill workflow started',
          });
        }

        // NEXUS durable workflow — on-demand correlation run
        if (url.pathname === '/api/internal/agents/nexus/workflow') {
          const id = crypto.randomUUID();
          const instance = await env.NEXUS_RUN.create({ id, params: {} });
          return Response.json({ triggered: true, instanceId: instance.id });
        }
      }

      // Get workflow status (GET, still requires auth)
      if (url.pathname.startsWith('/api/internal/agents/cartographer/backfill-workflow/')
          && request.method === 'GET') {
        const internalSecret = (env as unknown as Record<string, unknown>).INTERNAL_SECRET as string | undefined;
        const authHeader = request.headers.get('Authorization');
        if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
          return new Response('Unauthorized', { status: 401 });
        }
        const instanceId = url.pathname.split('/').pop()!;
        const instance = await env.CARTOGRAPHER_BACKFILL.get(instanceId);
        const status = await instance.status();
        return Response.json(status);
      }

      // NEXUS workflow status (GET, requires auth)
      if (url.pathname.startsWith('/api/internal/agents/nexus/workflow/')
          && request.method === 'GET') {
        const internalSecret = (env as unknown as Record<string, unknown>).INTERNAL_SECRET as string | undefined;
        const authHeader = request.headers.get('Authorization');
        if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
          return new Response('Unauthorized', { status: 401 });
        }
        const instanceId = url.pathname.split('/').pop()!;
        const instance = await env.NEXUS_RUN.get(instanceId);
        const status = await instance.status();
        return Response.json(status);
      }

      // ─── CertStream Durable Object endpoints ────────────────────
      if (url.pathname === '/api/certstream/stats' && request.method === 'GET') {
        const csId = env.CERTSTREAM_MONITOR.idFromName('certstream-primary');
        const csStub = env.CERTSTREAM_MONITOR.get(csId);
        return csStub.fetch(new Request('https://internal/stats'));
      }

      if (url.pathname === '/api/certstream/reload-brands' && request.method === 'POST') {
        const csId = env.CERTSTREAM_MONITOR.idFromName('certstream-primary');
        const csStub = env.CERTSTREAM_MONITOR.get(csId);
        return csStub.fetch(new Request('https://internal/reload-brands'));
      }

      // Flight Control health snapshot endpoint
      if (url.pathname === '/api/v1/agents/health' && request.method === 'GET') {
        const snapshot = await env.DB.prepare(`
          SELECT details, created_at
          FROM agent_outputs
          WHERE agent_id = 'flight_control' AND type = 'diagnostic'
          ORDER BY created_at DESC
          LIMIT 1
        `).first<{ details: string; created_at: string }>();

        if (!snapshot) {
          return Response.json({ status: 'no_data', message: 'Flight Control has not run yet' });
        }

        const parsed = JSON.parse(snapshot.details) as Record<string, unknown>;
        return Response.json({
          ...parsed,
          snapshot_age_seconds: Math.round(
            (Date.now() - new Date(snapshot.created_at + 'Z').getTime()) / 1000
          ),
        });
      }

      // Agent outputs endpoint (ticker feed)
      if (url.pathname === '/api/v1/agents/outputs' && request.method === 'GET') {
        const limit = Math.min(50, parseInt(url.searchParams.get('limit') ?? '10'));
        const severityParam = url.searchParams.get('severity');
        const allowed = ['critical', 'high', 'medium', 'low', 'info'];
        const severities = severityParam
          ? severityParam.split(',').map(s => s.trim()).filter(s => allowed.includes(s))
          : ['critical', 'high'];

        const placeholders = severities.map(() => '?').join(',');
        const rows = await env.DB.prepare(`
          SELECT agent_id, type, summary, severity, created_at
          FROM agent_outputs
          WHERE severity IN (${placeholders})
            AND summary IS NOT NULL
            AND LENGTH(summary) > 10
            AND created_at >= datetime('now', '-24 hours')
          ORDER BY created_at DESC
          LIMIT ?
        `).bind(...severities, limit).all();

        return Response.json({ success: true, data: rows.results });
      }

      // Agent activity log endpoint
      if (url.pathname === '/api/v1/agents/activity' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') ?? '50');
        const agentId = url.searchParams.get('agent_id');

        const query = agentId
          ? `SELECT * FROM agent_activity_log WHERE agent_id = ?
             ORDER BY created_at DESC LIMIT ?`
          : `SELECT * FROM agent_activity_log
             ORDER BY created_at DESC LIMIT ?`;

        const params = agentId ? [agentId, limit] : [limit];
        const result = await env.DB.prepare(query).bind(...params).all();
        return Response.json({ data: result.results });
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
