# Architecture

Trust Radar is a monorepo-based platform built on Cloudflare Workers, D1, and KV. This document covers the system architecture, routing, data layer, and frontend serving strategy.

## Monorepo Structure

The repository uses Turborepo with pnpm workspaces. Configuration lives in `turbo.json` and `pnpm-workspace.yaml` at the root.

```
trust-radar/
├── packages/
│   ├── trust-radar/        → Primary Cloudflare Worker (API + SPA)
│   │   ├── src/
│   │   │   ├── index.ts            → Router + Worker entry point
│   │   │   ├── agents/             → AI agent modules (8 agents)
│   │   │   ├── feeds/              → Threat feed ingestion modules (17 feeds)
│   │   │   ├── handlers/           → Route handler functions
│   │   │   ├── lib/                → Shared utilities (JWT, CORS, DNS, etc.)
│   │   │   ├── middleware/         → Auth, rate limiting, security headers
│   │   │   ├── templates/          → Server-rendered HTML (landing, scan results)
│   │   │   ├── durableObjects/     → ThreatPushHub (WebSocket push)
│   │   │   ├── enrichment/         → Geo-IP, WHOIS enrichment
│   │   │   ├── seeders/            → Spam trap seed address generators
│   │   │   ├── email-security.ts   → Email security posture engine
│   │   │   ├── threat-feeds.ts     → Legacy threat feed adapters
│   │   │   ├── brand-threat-correlator.ts → Brand-threat matching
│   │   │   ├── dmarc-receiver.ts   → DMARC report email handler
│   │   │   ├── spam-trap.ts        → Spam trap email handler
│   │   │   ├── honeypot.ts         → Honeypot page server
│   │   │   └── types.ts            → Shared TypeScript types
│   │   ├── migrations/             → D1 SQL migrations (0001-0029)
│   │   ├── public/                 → Static SPA assets (built frontend)
│   │   └── wrangler.toml           → Worker configuration
│   ├── imprsn8/            → Social brand protection Worker
│   │   ├── src/                    → imprsn8 Worker source
│   │   ├── migrations/             → imprsn8 D1 migrations
│   │   └── wrangler.toml
│   ├── frontend/           → React/TypeScript SPA
│   │   └── src/                    → Frontend application source
│   └── api/                → FastAPI backend (Railway)
│       └── app/                    → Python API application
├── prototypes/             → UI design specifications (HTML mockups)
├── docs/                   → Platform documentation
├── .github/workflows/      → CI/CD pipelines
├── turbo.json              → Turborepo task configuration
└── package.json            → Root workspace configuration
```

## Cloudflare Workers Architecture

### Entry Point

The main Worker is defined in `packages/trust-radar/src/index.ts`. It exports a standard Workers `fetch` handler along with a `scheduled` handler for cron-triggered feed ingestion.

### Router

The Worker uses [itty-router](https://github.com/kwhitley/itty-router) for HTTP routing. The router is instantiated at module scope and routes are registered declaratively:

```typescript
const router = Router();
router.options("*", handleOptions);           // CORS preflight
router.get("/health", handleHealthCheck);     // Health check
router.get("/api/auth/login", handleOAuthLogin); // Auth routes
// ... 100+ route registrations
```

Routes are organized into sections by feature area: Auth, Scans, Threats, Brands, Feeds, Agents, Email Security, Admin, etc.

### Request Flow

1. Incoming request hits the Worker `fetch` handler
2. Hostname-based routing checks for honeypot domains first
3. The itty-router matches the request path and method
4. Middleware runs (auth, rate limiting) as inline checks
5. Handler function executes and returns a JSON response
6. Security headers are applied via `applySecurityHeaders()`
7. If no API route matches, the request falls through to SPA asset serving

### Authentication

Authentication uses JWT tokens issued via Google OAuth. Three auth levels exist:

- `requireAuth` — Any authenticated user
- `requireAdmin` — Admin role required
- `requireSuperAdmin` — Super-admin role required

Auth middleware is in `packages/trust-radar/src/middleware/auth.ts`. JWT verification uses `packages/trust-radar/src/lib/jwt.ts`.

### Rate Limiting

Rate limiting uses KV-based counters, implemented in `packages/trust-radar/src/middleware/rateLimit.ts`. Different rate limit buckets exist for `auth`, `scan`, and general API usage.

## Database: Cloudflare D1

Trust Radar uses two D1 databases:

| Binding | Database | Purpose |
|---------|----------|---------|
| `DB` | `trust-radar-v2` | Primary data (threats, brands, feeds, users, agents) |
| `AUDIT_DB` | `trust-radar-v2-audit` | Audit log (admin actions, session events) |

### Schema Overview

Migrations are in `packages/trust-radar/migrations/` (29 migration files). Key tables:

- `threats` — Core threat intelligence records (URL, domain, IP, severity, source)
- `brands` — Monitored brands with canonical domains and threat counts
- `feed_configs` / `feed_status` — Feed ingestion configuration and health
- `users` / `sessions` — User accounts and active sessions
- `agent_outputs` / `agent_runs` — AI agent execution logs
- `campaigns` — Correlated threat campaigns
- `hosting_providers` — Provider reputation tracking
- `email_security_scans` — Email security posture scan results
- `spam_trap_captures` — Spam trap catch records
- `notifications` — User notification queue
- `sales_leads` — Prospector-generated sales leads

### Migration Naming

Migrations follow the pattern `XXXX_description.sql` with sequential numbering (0001 through 0029).

## Caching: Cloudflare KV

KV namespace bound as `CACHE` is used for:

- **IOC deduplication** — `dedup:{type}:{value}` keys with 24-hour TTL prevent duplicate threat insertion during feed ingestion
- **Email security scan caching** — `email-sec:{domain}` keys cache scan results for 1 hour
- **Rate limiting** — Per-IP counters for API rate limiting
- **Honeypot site content** — `honeypot-site:{hostname}:{page}` stores generated honeypot HTML
- **Session invalidation** — Forced logout flags checked during auth

## SPA Frontend Serving

The Worker serves the frontend SPA using Cloudflare Workers Static Assets:

```toml
# wrangler.toml
[assets]
directory = "./public"
binding = "ASSETS"
serve_directly = false
not_found_handling = "single-page-application"
```

The `serve_directly = false` setting means all requests pass through the Worker first, enabling API routing. The `not_found_handling = "single-page-application"` setting returns `index.html` for any path not matching an API route or static file, supporting client-side routing.

## Durable Objects

The `ThreatPushHub` Durable Object (`packages/trust-radar/src/durableObjects/ThreatPushHub.ts`) manages WebSocket connections for real-time threat push notifications. When new threats are ingested, the feed runner broadcasts events to all connected browser sessions.

## Cron Triggers

The Worker has a cron trigger configured at `*/5 * * * *` (every 5 minutes). The `scheduled` handler in `index.ts` runs the feed ingestion pipeline via `runAllFeeds()`, which:

1. Reads `feed_configs` from D1 to determine which feeds are due
2. Executes each feed module's `ingest()` function
3. Records results in `feed_pull_history`
4. Updates `feed_status` with health information

## Email Handling

The Worker receives inbound emails for two purposes:

- **DMARC reports** — Processed by `packages/trust-radar/src/dmarc-receiver.ts`
- **Spam trap captures** — Processed by `packages/trust-radar/src/spam-trap.ts`

## Environments

Three environments are configured in `wrangler.toml`:

| Environment | Domain | Purpose |
|-------------|--------|---------|
| Production | `trustradar.ca` | Live platform |
| Staging | `staging.trustradar.ca` | Pre-production testing |
| Dev | Local | Local development with wrangler dev |
