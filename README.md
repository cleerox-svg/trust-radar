# LRX Platform Monorepo

Monorepo for the LRX platform — two products, one shared backend.

| Package | Domain | Runtime | Description |
|---|---|---|---|
| `packages/trust-radar` | [lrx-radar.com](https://lrx-radar.com) | Cloudflare Worker + D1 | URL & domain trust scoring |
| `packages/imprsn8` | [imprsn8.com](https://imprsn8.com) | Cloudflare Worker + D1 | Digital impression & personal brand scoring |
| `packages/api` | api.lrx.io | FastAPI on Railway | Shared AI/backend services |

## Architecture

```
                ┌─────────────────┐      ┌──────────────────┐
User ──HTTPS──▶ │  Trust Radar    │      │    imprsn8        │
                │ CF Worker + D1  │      │  CF Worker + D1   │
                └────────┬────────┘      └────────┬──────────┘
                         │  X-API-Key              │  X-API-Key
                         └──────────┬──────────────┘
                                    ▼
                          ┌─────────────────┐
                          │   LRX API        │
                          │ FastAPI/Railway   │
                          │  PostgreSQL + AI  │
                          └─────────────────┘
```

## Quick Start

### Prerequisites
- [pnpm](https://pnpm.io) ≥ 9
- [Node.js](https://nodejs.org) ≥ 20
- [Python](https://python.org) ≥ 3.12
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — `pnpm install -g wrangler`
- [Railway CLI](https://docs.railway.app/develop/cli) — `npm install -g @railway/cli`

### Install

```bash
pnpm install
```

### Local Development

```bash
# All packages in parallel
pnpm dev

# Individual packages
cd packages/trust-radar && pnpm dev
cd packages/imprsn8    && pnpm dev
cd packages/api        && uvicorn app.main:app --reload
```

### Database Setup (Cloudflare D1)

```bash
# Create databases (one-time)
cd packages/trust-radar && pnpm db:create
cd packages/imprsn8    && pnpm db:create

# Apply migrations locally
cd packages/trust-radar && pnpm db:migrate:local
cd packages/imprsn8    && pnpm db:migrate:local

# Apply migrations to production
cd packages/trust-radar && pnpm db:migrate:prod
cd packages/imprsn8    && pnpm db:migrate:prod
```

### Secrets Setup (Cloudflare Workers)

```bash
# Trust Radar
cd packages/trust-radar
wrangler secret put JWT_SECRET
wrangler secret put VIRUSTOTAL_API_KEY
wrangler secret put LRX_API_KEY

# imprsn8
cd packages/imprsn8
wrangler secret put JWT_SECRET
wrangler secret put LRX_API_KEY
```

### Deploy

```bash
pnpm deploy:radar    # Trust Radar only
pnpm deploy:imprsn8  # imprsn8 only
pnpm deploy:api      # FastAPI only
pnpm deploy:all      # Everything
```

## GitHub Secrets Required

Set these in your repository settings → Secrets and variables → Actions:

| Secret | Used By | Description |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | deploy-radar, deploy-imprsn8 | CF API token with Workers & D1 permissions |
| `CLOUDFLARE_ACCOUNT_ID` | deploy-radar, deploy-imprsn8 | Your Cloudflare account ID |
| `RAILWAY_TOKEN` | deploy-api | Railway project token |

## API Endpoints

### Trust Radar (`lrx-radar.com`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/auth/register` | — | Register |
| `POST` | `/api/auth/login` | — | Login |
| `GET` | `/api/auth/me` | Bearer | Current user |
| `POST` | `/api/scan` | Optional | Scan a URL |
| `GET` | `/api/scan/history` | Bearer | Scan history |

### imprsn8 (`imprsn8.com`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/auth/register` | — | Register |
| `POST` | `/api/auth/login` | — | Login |
| `GET` | `/api/auth/me` | Bearer | Current user |
| `PATCH` | `/api/profile` | Bearer | Update profile |
| `POST` | `/api/analyze` | Bearer | Analyze bio/content/profile |
| `GET` | `/api/analyses` | Bearer | Analysis history |
| `GET` | `/api/score/history` | Bearer | Score trend data |
| `GET` | `/api/social` | Bearer | List social profiles |
| `POST` | `/api/social` | Bearer | Add social profile |
| `DELETE` | `/api/social/:platform` | Bearer | Remove social profile |

### LRX API (`api.lrx.io`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/ai/enhance-bio` | X-API-Key | AI bio enhancement |
| `POST` | `/api/ai/scan-insight` | X-API-Key | AI scan explanation |
| `POST` | `/api/ai/impression-report` | X-API-Key | AI impression report |

## Stack

- **Cloudflare Workers** — edge compute, zero cold starts
- **Cloudflare D1** — SQLite at the edge, per-product
- **Cloudflare KV** — session/cache storage
- **Cloudflare R2** — asset storage (imprsn8 avatars)
- **FastAPI** — Python async API on Railway
- **PostgreSQL** — Railway-provisioned database
- **OpenAI GPT-4o-mini** — AI features
- **Turborepo** — monorepo build orchestration
- **pnpm workspaces** — package management
- **GitHub Actions** — path-filtered auto-deploy
