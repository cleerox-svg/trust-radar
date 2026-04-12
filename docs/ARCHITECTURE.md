# Architecture

Averrow is a monorepo-based platform built on Cloudflare Workers, D1, and KV. This document covers the system architecture, routing, data layer, and frontend serving strategy.

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
│   │   ├── migrations/             → D1 SQL migrations (0001–0035+)
│   │   ├── public/                 → Static SPA assets (built frontend)
│   │   └── wrangler.toml           → Worker configuration
│   ├── imprsn8/            → Social brand protection Worker
│   │   ├── src/                    → imprsn8 Worker source
│   │   ├── migrations/             → imprsn8 D1 migrations
│   │   └── wrangler.toml
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

### D1 Sessions API (Read Replicas)

Read-heavy endpoints use the D1 Sessions API to route queries to read replicas, reducing latency and offloading the primary. The implementation lives in `packages/trust-radar/src/lib/db.ts`:

- `getDbContext(request)` — returns a session-aware DB handle from the incoming request's `x-d1-bookmark` header
- `getReadSession(env, ctx)` — returns a read-only session for cron/agent contexts without an HTTP request
- `attachBookmark(response, session)` — attaches the session bookmark to the response for client-side session continuity

Endpoints using read replicas: Dashboard overview, Brands list, Providers list/v2, Observatory (all 5 endpoints), Threats list, Operations list, Agents list.

Write operations (threat ingestion, agent runs, brand monitoring) always use the primary `env.DB` handle directly.

### OLAP Cube Tables

Three pre-aggregated cube tables accelerate UI queries that would otherwise require full `GROUP BY` scans on the 113K+ row `threats` table:

| Table | Primary Key | Purpose |
|-------|-------------|---------|
| `threat_cube_geo` | `(hour_bucket, lat_bucket, lng_bucket, country_code, threat_type, severity, source_feed)` | Geographic aggregates |
| `threat_cube_provider` | `(hour_bucket, hosting_provider_id, threat_type, severity, source_feed)` | Provider aggregates |
| `threat_cube_brand` | `(hour_bucket, target_brand_id, threat_type, severity, source_feed)` | Brand aggregates |

Each cube stores `threat_count` and `updated_at` per dimension combination per hour bucket. Cubes are maintained by:

1. **fast-tick cron** (every 5 min) — rebuilds current + previous hour via `INSERT OR REPLACE ... SELECT ... GROUP BY`
2. **cube-healer agent** (every 6 hours) — full 30-day bulk rebuild to fix retroactive enrichment drift
3. **admin cube-backfill** endpoint — manual backfill for new cubes or recovery

Cubes use `INSERT OR REPLACE` which is idempotent — overlapping rebuilds are safe.

### Pre-computed Columns

Key tables carry denormalized aggregate columns to avoid JOINs to `threats`:

- `brands.threat_count`, `brands.last_threat_seen` — maintained by feed ingestion and brand-match backfill
- `hosting_providers.active_threat_count`, `hosting_providers.total_threat_count`, `hosting_providers.trend_7d`, `hosting_providers.trend_30d` — maintained by provider stats refresh

### Schema Overview

Migrations are in `packages/trust-radar/migrations/` (88+ migration files). Key tables:

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
- `social_monitor_results` — Social monitoring scan results
- `social_monitor_schedule` — Social monitoring job scheduling
- `brand_profiles` — Brand profile definitions
- `lookalike_domains` — Detected lookalike/typosquat domains
- `ct_certificates` — Certificate Transparency log entries
- `threat_narratives` — AI-generated threat narrative summaries
- `contact_submissions` — Inbound contact form submissions
- `alerts` — Alert rules and delivery tracking
- `organizations` — Multi-tenant organization records
- `threat_cube_geo` — OLAP cube: hourly geo-aggregated threat counts
- `threat_cube_provider` — OLAP cube: hourly provider-aggregated threat counts
- `threat_cube_brand` — OLAP cube: hourly brand-aggregated threat counts

### Migration Naming

Migrations follow the pattern `XXXX_description.sql` with sequential numbering (0001 through 0088+).

## Caching: Cloudflare KV

KV namespace bound as `CACHE` is used for:

- **IOC deduplication** — `dedup:{type}:{value}` keys with 24-hour TTL prevent duplicate threat insertion during feed ingestion
- **Email security scan caching** — `email-sec:{domain}` keys cache scan results for 1 hour
- **Rate limiting** — Per-IP counters for API rate limiting
- **Honeypot site content** — `honeypot-site:{hostname}:{page}` stores generated honeypot HTML
- **Session invalidation** — Forced logout flags checked during auth
- **Page-load endpoint caching** — JSON responses for heavy page-load endpoints, pre-warmed by fast-tick cron every 5 minutes

### KV Cache Strategy (Page-Load Endpoints)

All high-traffic page-load endpoints check KV before querying D1. Cache keys encode query parameters for proper invalidation. TTLs are tuned per endpoint:

| Cache Key Pattern | TTL | Endpoint |
|-------------------|-----|----------|
| `observatory_nodes:{period}:{source}` | 300s | Observatory nodes |
| `observatory_arcs:{period}:{source}` | 300s | Observatory arcs |
| `observatory_stats:{period}:{source}` | 300s | Observatory stats |
| `observatory_live:{source}:{limit}` | 120s | Observatory live feed |
| `observatory_operations:{status}:{limit}` | 300s | Observatory operations |
| `dashboard_overview` | 300s | Dashboard overview |
| `agents_list` | 300s | Agents list |
| `operations_list:{status}:{limit}:{offset}` | 300s | Operations list |
| `operations_stats` | 300s | Operations stats |
| `providers_v2:{params...}` | 300s | Providers v2 list |
| `providers_intelligence` | 300s | Provider intelligence |

### Cache Pre-Warming (fast-tick)

The fast-tick cron (every 5 minutes) pre-warms KV caches by calling handler functions with synthetic requests. This ensures users never hit a cold cache on the most critical pages:

- **Phase A** (always): Observatory nodes, arcs, stats, live, operations (5 endpoints)
- **Phase B** (if CPU budget allows): Dashboard overview, Agents list, Operations list, Operations stats

## SPA Frontend Serving

The Worker serves the frontend SPA using Cloudflare Workers Static Assets:

```toml
# wrangler.toml
[assets]
directory = "./public"
binding = "ASSETS"
not_found_handling = "404-page"
```

All requests pass through the Worker first, enabling API routing. The `not_found_handling = "404-page"` setting returns a 404 for any path not matching an API route or static file.

## Durable Objects

The `ThreatPushHub` Durable Object (`packages/trust-radar/src/durableObjects/ThreatPushHub.ts`) manages WebSocket connections for real-time threat push notifications. When new threats are ingested, the feed runner broadcasts events to all connected browser sessions.

## Cron Triggers

The Worker has multiple cron triggers configured in `wrangler.toml`:

| Cron | Handler | Purpose |
|------|---------|---------|
| `*/5 * * * *` | `fast-tick` | OLAP cube refresh (current + prev hour for geo, provider, brand), KV cache pre-warming, parity checks |
| `*/15 * * * *` | `orchestrator` | Threat feed scan, Cartographer enrichment (dispatched as Workflow), agent scheduling |
| `12 */6 * * *` | `cube-healer` | Full 30-day bulk rebuild of all 3 cube tables to fix retroactive drift |

### Orchestrator (`src/cron/orchestrator.ts`)

Routes jobs by time of day:
- Every 15 min: Threat feed scan (Sentinel)
- Every 15 min: Cartographer enrichment (dispatched as `CartographerBackfillWorkflow`)
- Every 4 hours: NEXUS clustering (dispatched as `NexusWorkflow`)
- Every 30 min: Analyst brand attribution (via `ctx.waitUntil`)
- Every 6 hours: Strategist campaign correlation (via `ctx.waitUntil`)
- Daily: Observer briefings, Pathfinder lead generation
- Weekly: Prospector sales intelligence

### fast-tick (`src/cron/fast-tick.ts`)

Runs every 5 minutes with 4 phases:
1. **Cube refresh** — Rebuilds current + previous hour for `threat_cube_geo`, `threat_cube_provider`, `threat_cube_brand` (6 builds total)
2. **Parity check** — Validates cube accuracy against raw threats (sampled)
3. **Stats refresh** — Updates `hosting_providers` pre-computed columns
4. **Cache pre-warming** — Calls handler functions to populate KV for Observatory, Dashboard, Agents, Operations

### Cloudflare Workflows

Heavy agents are dispatched as durable Workflows to avoid blocking the cron mesh:

- `CartographerBackfillWorkflow` — Multi-step enrichment with retry and checkpointing
- `NexusWorkflow` — Clustering analysis with durable execution context

Workflows run in their own execution context with no CPU time ceiling, unlike cron which shares the 30s Worker limit.

## Email Handling

The Worker receives inbound emails for two purposes:

- **DMARC reports** — Processed by `packages/trust-radar/src/dmarc-receiver.ts`
- **Spam trap captures** — Processed by `packages/trust-radar/src/spam-trap.ts`

## Environments

Three environments are configured in `wrangler.toml`:

| Environment | Domain | Purpose |
|-------------|--------|---------|
| Production | `averrow.com` | Live platform |
| Staging | `staging.averrow.com` | Pre-production testing |
| Dev | Local | Local development with wrangler dev |
