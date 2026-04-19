# Deployment

Trust Radar deploys to Cloudflare Workers via GitHub Actions on push to `master`.

## Architecture

```
GitHub Actions (CI/CD)
├── deploy-radar.yml    → Cloudflare Workers (trust-radar)
├── deploy-imprsn8.yml  → Cloudflare Workers (imprsn8)
└── ci.yml              → TypeCheck trust-radar and imprsn8 Workers
```

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (workspace manager)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Cloudflare account with Workers, D1, and KV access

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy token | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `ANTHROPIC_API_KEY` | Claude Haiku API key | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |

See `packages/trust-radar/wrangler.toml` for Worker bindings (D1, KV, R2).

## Local Development

```bash
pnpm install
pnpm dev                    # Start all workers locally (Miniflare)
pnpm typecheck              # Type check all packages
```

Local dev uses Miniflare (Wrangler's local runtime) with local D1 SQLite databases.

## Database Migrations

Migrations are SQL files in `packages/trust-radar/migrations/`:

```bash
# Run locally
npx wrangler d1 execute trust-radar-v2 --local --file=migrations/0030_social_monitoring.sql

# Run in production
npx wrangler d1 execute trust-radar-v2 --file=migrations/0030_social_monitoring.sql

# Also run audit DB migrations when applicable
npx wrangler d1 execute trust-radar-v2-audit --file=migrations/XXXX_audit.sql
```

Migrations are also run automatically by the deploy workflow.

## Manual Deploy

```bash
cd packages/trust-radar
npx wrangler deploy          # Deploy to production
npx wrangler deploy --env staging  # Deploy to staging
```

## CI/CD Pipeline

### ci.yml (on every PR and push to master)
1. TypeCheck trust-radar and imprsn8 Workers

> **Note:** The `deploy-api.yml` workflow (FastAPI/Railway) has been removed — all compute runs on Cloudflare Workers.

### deploy-radar.yml (on push to master, paths: `packages/trust-radar/**`)
1. Type check
2. Run D1 migrations (both DB and AUDIT_DB)
3. Deploy via `wrangler deploy`

### Cron Triggers

Configured in `wrangler.toml`:
```toml
[triggers]
crons = ["*/5 * * * *", "*/15 * * * *", "12 */6 * * *"]
```

Three cron schedules:

| Schedule | Handler | Purpose |
|----------|---------|---------|
| `*/5 * * * *` | navigator | DNS resolution, OLAP cube refresh, KV cache pre-warming |
| `*/15 * * * *` | orchestrator | Feed scans, agent scheduling, Workflow dispatch |
| `12 */6 * * *` | cube-healer | 30-day bulk cube rebuild (drift remediation) |

The orchestrator (`src/cron/orchestrator.ts`) routes jobs by time:
- Every 15 min: Threat feed scan (Sentinel) + Cartographer (via Workflow)
- Every 30 min: Analyst brand attribution (via ctx.waitUntil)
- Every 4 hours: NEXUS clustering (via Workflow)
- Every 6 hours: Strategist campaign correlation (via ctx.waitUntil)
- Daily 06:00 UTC: Observer briefing
- Weekly: Prospector sales intelligence

### Cloudflare Workflows

Heavy agents run as durable Workflows (not inline in cron):
- `CartographerBackfillWorkflow` — enrichment with retry/checkpointing
- `NexusWorkflow` — clustering with durable execution

Configured in `wrangler.toml` under `[[workflows]]`.

## KV Namespaces

| Binding | Purpose |
|---------|---------|
| `CACHE` | Rate limiting, scan result caching, cron status, page-load endpoint caching (300s TTL, pre-warmed by Navigator) |
| `SESSIONS` | Session storage |

## D1 Databases

| Binding | Purpose |
|---------|---------|
| `DB` | Primary database (users, brands, threats, scans) |
| `AUDIT_DB` | Audit log (data mutations) |

Read-heavy endpoints use the D1 Sessions API to route queries to read replicas. The implementation is in `src/lib/db.ts`. Write operations always use the primary `env.DB` handle.

## Domains

| Domain | Environment |
|--------|-------------|
| `averrow.com` | Production (primary) |
| `averrow.ca` | Canadian market (301 → averrow.com) |
| `trustradar.ca` | Legacy domain (301 → averrow.com) |
| `staging.averrow.com` | Staging |
| `staging.trustradar.ca` | Staging (legacy, 301 → staging.averrow.com) |

## Rollback

Cloudflare Workers supports instant rollback via the dashboard or:
```bash
npx wrangler rollback
```
