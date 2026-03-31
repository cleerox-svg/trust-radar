# Deployment

Trust Radar deploys to Cloudflare Workers via GitHub Actions on push to `master`. The platform runs entirely on Cloudflare's edge network.

> **Last verified:** March 2026

## Architecture

```
GitHub Actions (CI/CD)
├── ci.yml              → TypeCheck trust-radar and imprsn8 Workers (on PR + push)
├── deploy-radar.yml    → Cloudflare Workers (trust-radar) — on push to master
└── deploy-imprsn8.yml  → Cloudflare Workers (imprsn8) — on push to master
```

## Infrastructure Stack

| Service | Purpose | Binding |
|---------|---------|---------|
| **Cloudflare Workers** | Application runtime | — |
| **D1** (SQLite) | Primary database (67 tables) | `DB` |
| **D1** (SQLite) | Audit database | `AUDIT_DB` |
| **KV** | Rate limiting, caching, dedup | `CACHE` |
| **Durable Objects** | WebSocket push, CertStream monitor | `THREAT_PUSH_HUB`, `CERTSTREAM_MONITOR` |
| **Workflows** | Durable multi-step enrichment | `CARTOGRAPHER_BACKFILL`, `NEXUS_RUN` |
| **Static Assets** | Frontend SPA files | `ASSETS` |
| **Email Workers** | DMARC reports, spam trap captures | — |
| **Resend** | Outbound briefing emails | `RESEND_API_KEY` |
| **Google OAuth** | Authentication | `GOOGLE_CLIENT_ID/SECRET` |

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (workspace manager)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Cloudflare account with Workers, D1, KV, and Durable Objects access

## Environment Variables & Secrets

### Required Secrets

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy token (CI/CD) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (CI/CD) |
| `JWT_SECRET` | JWT signing secret |
| `ANTHROPIC_API_KEY` | Claude Haiku API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `RESEND_API_KEY` | Email delivery (daily briefings) |
| `INTERNAL_SECRET` | Internal agent API auth |

### Optional Secrets (Feed Authentication)

| Variable | Feeds |
|----------|-------|
| `VIRUSTOTAL_API_KEY` | VirusTotal enrichment |
| `GOOGLE_SAFE_BROWSING_KEY` | Google Safe Browsing |
| `ABUSEIPDB_API_KEY` | AbuseIPDB enrichment |
| `GREYNOISE_API_KEY` | GreyNoise enrichment |
| `SECLOOKUP_API_KEY` | SecLookup enrichment |
| `OTX_API_KEY` | OTX AlienVault feed |
| `ABUSECH_AUTH_KEY` | ThreatFox, MalwareBazaar |
| `CF_ACCOUNT_ID` / `CF_API_TOKEN` | Cloudflare Scanner, Email Radar |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Reddit social feed |
| `GITHUB_FEED_TOKEN` | GitHub social feed |
| `TELEGRAM_BOT_TOKEN` | Telegram social feed |
| `CIRCL_PDNS_USER` / `CIRCL_PDNS_PASS` | CIRCL Passive DNS |
| `HIBP_API_KEY` | HIBP Stealer Logs |
| `ANTHROPIC_ADMIN_KEY` | Budget verification (optional) |

Set secrets via: `npx wrangler secret put SECRET_NAME`

## Local Development

```bash
pnpm install
pnpm dev                    # Start all workers locally (Miniflare)
pnpm typecheck              # Type check all packages
```

Local dev uses Miniflare with local D1 SQLite databases.

## Database Migrations

Migrations are SQL files in `packages/trust-radar/migrations/` (46+ files):

```bash
# Run locally
npx wrangler d1 execute trust-radar-v2 --local --file=migrations/XXXX_description.sql

# Run in production
npx wrangler d1 execute trust-radar-v2 --file=migrations/XXXX_description.sql

# Audit DB migrations
npx wrangler d1 execute trust-radar-v2-audit --file=migrations-audit/XXXX_description.sql
```

Migrations are also run automatically by the deploy workflow.

### Migration Naming

```
XXXX_description.sql    (e.g., 0046_add_stealer_logs.sql)
```

Sequential numbering, always `ALTER TABLE ... ADD COLUMN` for existing tables.

## Manual Deploy

```bash
cd packages/trust-radar
npx wrangler deploy              # Deploy to production
npx wrangler deploy --env staging    # Deploy to staging
```

## CI/CD Pipeline

### ci.yml (on every PR and push to master)
1. TypeCheck trust-radar Worker (`tsc --noEmit`)
2. TypeCheck imprsn8 Worker (`tsc --noEmit`)

### deploy-radar.yml (on push to master, paths: `packages/trust-radar/**`)
1. Type check
2. Run D1 migrations (both DB and AUDIT_DB)
3. Deploy via `wrangler deploy`

### deploy-imprsn8.yml (on push to master, paths: `packages/imprsn8/**`)
1. Type check
2. Deploy via `wrangler deploy`

## Cron Configuration

Configured in `wrangler.toml`:

```toml
[triggers]
crons = ["*/15 * * * *"]
```

The cron orchestrator (`src/cron/orchestrator.ts`) routes jobs by time:

| Schedule | Job | Description |
|----------|-----|-------------|
| Every cron tick | Flight Control | Supervisor: backlogs, budgets, scaling |
| Every 5 min | CertStream monitor | Certificate Transparency log monitoring |
| Every 30 min | Threat feed scan | Ingest + enrichment + social feeds |
| Every hour (:15) | Lookalike check | Lookalike domain detection |
| Every 6h | Social monitoring | Discovery + monitoring + AI assessment |
| Daily 06:00 UTC | Observer briefing | Intelligence synthesis |
| Daily 06:00 UTC | Threat narratives | AI narrative generation |
| Daily 12:00 UTC | Briefing email | Email daily briefing via Resend |

## D1 Databases

| Binding | Database | Tables | Purpose |
|---------|----------|--------|---------|
| `DB` | `trust-radar-v2` | 67 | Primary data |
| `AUDIT_DB` | `trust-radar-v2-audit` | 1 | Audit trail |

## KV Namespaces

| Binding | Purpose |
|---------|---------|
| `CACHE` | Rate limiting, IOC dedup, honeypot pages, feed counters, cron status, email security cache |

## Durable Objects

| Binding | Class | Purpose |
|---------|-------|---------|
| `THREAT_PUSH_HUB` | `ThreatPushHub` | WebSocket real-time push |
| `CERTSTREAM_MONITOR` | `CertStreamMonitor` | CT log monitoring (30s alarm cycle) |

## Workflows

| Binding | Class | Purpose |
|---------|-------|---------|
| `CARTOGRAPHER_BACKFILL` | `CartographerBackfillWorkflow` | Multi-step geo enrichment |
| `NEXUS_RUN` | `NexusWorkflow` | ASN correlation and clustering |

## Domains

| Domain | Purpose |
|--------|---------|
| `averrow.com` | Primary production |
| `www.averrow.com` | Primary production |
| `averrow.ca` | Production (Canadian) |
| `www.averrow.ca` | Production (Canadian) |
| `trustradar.ca` | Legacy (redirects to averrow.com) |
| `www.trustradar.ca` | Legacy |
| `lrxradar.com` | Honeypot site |
| `www.lrxradar.com` | Honeypot site |

## Rollback

Cloudflare Workers supports instant rollback:

```bash
npx wrangler rollback
```

Or via the Cloudflare dashboard under Workers > Deployments.
