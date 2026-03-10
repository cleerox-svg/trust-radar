# imprsn8 Platform — Monorepo

**imprsn8** is a brand protection platform with two services, one shared backend, and a
single master brand.

> Strategic overview: [PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md)
> Service build plans: [SHIELD_BUILD_PLAN.md](./SHIELD_BUILD_PLAN.md) · [GUARD_BUILD_PLAN.md](./GUARD_BUILD_PLAN.md)
> Design system: [PLATFORM_DESIGN_BRIEF.md](./PLATFORM_DESIGN_BRIEF.md) · [IMPRSN8_DESIGN_SPEC_V2.md](./IMPRSN8_DESIGN_SPEC_V2.md)

---

## Services

| Service | Domain | Package | Description |
|---------|--------|---------|-------------|
| **imprsn8 Guard** | [imprsn8.com](https://imprsn8.com) | `packages/imprsn8/` | Social media monitoring & personal brand protection for influencers and public figures |
| **imprsn8 Shield** | [shield.imprsn8.com](https://shield.imprsn8.com) | `packages/trust-radar/` | Corporate brand health monitoring & threat intelligence |
| **LRX API** | api.lrx.io | `packages/api/` | Shared AI/backend services (internal) |

---

## Architecture

```
                   imprsn8.com
                   (Guard — social/influencer protection)
                        │
          ┌─────────────┴──────────────────┐
          │                                │
    imprsn8.com                   shield.imprsn8.com
    Guard SPA                     Shield SPA
    CF Worker + D1                CF Worker + D1
    imprsn8-db                    radar-db
          │                                │
          │       X-API-Key                │
          └──────────────┬─────────────────┘
                         ▼
                    api.lrx.io
                    FastAPI / Railway
                    PostgreSQL + OpenAI
                    (shared by both services)
```

---

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

# Individual services
cd packages/imprsn8    && pnpm dev    # Guard backend
cd packages/trust-radar && pnpm dev   # Shield backend
cd packages/api        && uvicorn app.main:app --reload

# Frontend
pnpm --filter @lrx/frontend dev:imprsn8   # Guard SPA
pnpm --filter @lrx/frontend dev:radar     # Shield SPA
```

### Database Setup (Cloudflare D1)

```bash
# Create databases (one-time)
cd packages/imprsn8     && pnpm db:create
cd packages/trust-radar && pnpm db:create

# Apply migrations locally
cd packages/imprsn8     && pnpm db:migrate:local
cd packages/trust-radar && pnpm db:migrate:local

# Apply migrations to production
cd packages/imprsn8     && pnpm db:migrate:prod
cd packages/trust-radar && pnpm db:migrate:prod
```

### Secrets Setup (Cloudflare Workers)

```bash
# Guard (imprsn8)
cd packages/imprsn8
wrangler secret put JWT_SECRET
wrangler secret put LRX_API_KEY

# Shield (trust-radar)
cd packages/trust-radar
wrangler secret put JWT_SECRET
wrangler secret put VIRUSTOTAL_API_KEY
wrangler secret put LRX_API_KEY
```

### Deploy

```bash
pnpm deploy:guard    # imprsn8 Guard only
pnpm deploy:shield   # imprsn8 Shield only
pnpm deploy:api      # LRX API only
pnpm deploy:all      # Everything

# Legacy aliases (still work)
pnpm deploy:imprsn8  # → same as deploy:guard
pnpm deploy:radar    # → same as deploy:shield
```

---

## GitHub Secrets Required

| Secret | Used By | Description |
|--------|---------|-------------|
| `CLOUDFLARE_API_TOKEN` | deploy-guard, deploy-shield | CF API token with Workers & D1 permissions |
| `CLOUDFLARE_ACCOUNT_ID` | deploy-guard, deploy-shield | Your Cloudflare account ID |
| `RAILWAY_TOKEN` | deploy-api | Railway project token |

---

## API Endpoints

### Guard — imprsn8 (`imprsn8.com`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
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
| `GET` | `/api/threats` | Bearer | IOI threat feed |
| `GET` | `/api/takedowns` | Bearer | Takedown pipeline |
| `GET` | `/api/agents` | Bearer (soc+) | Agent status |
| `POST` | `/api/agents/:id/run` | Bearer (soc+) | Trigger agent |
| `GET` | `/api/admin/users` | Bearer (admin) | User management |
| `POST` | `/api/invites` | Bearer (admin) | Create invite link |

### Shield — Trust Radar (`shield.imprsn8.com`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/auth/register` | — | Register |
| `POST` | `/api/auth/login` | — | Login |
| `GET` | `/api/auth/me` | Bearer | Current user |
| `POST` | `/api/scan` | Optional | Scan a URL |
| `GET` | `/api/scan/history` | Bearer | Scan history |
| `GET` | `/api/threats` | Bearer | Threat intelligence feed |
| `GET` | `/api/investigations` | Bearer | Case management |
| `GET` | `/api/feeds` | Bearer (analyst+) | Feed status |
| `GET` | `/api/agents` | Bearer (analyst+) | Agent status |
| `GET` | `/api/admin/users` | Bearer (admin) | User management |

### LRX API (`api.lrx.io`) — Internal

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/ai/enhance-bio` | X-API-Key | AI bio enhancement |
| `POST` | `/api/ai/scan-insight` | X-API-Key | AI scan explanation |
| `POST` | `/api/ai/impression-report` | X-API-Key | AI impression report |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI** | Radix UI + Tailwind CSS + Framer Motion |
| **Data** | TanStack Query |
| **Backend** | Cloudflare Workers (itty-router + Zod) |
| **Database** | Cloudflare D1 (SQLite, per service) |
| **Cache/Sessions** | Cloudflare KV |
| **Assets** | Cloudflare R2 (Guard profile images) |
| **Shared API** | FastAPI on Railway + PostgreSQL |
| **AI** | OpenAI GPT-4o-mini |
| **Build** | Turborepo + pnpm workspaces |
| **CI/CD** | GitHub Actions (path-filtered auto-deploy) |

---

## Monorepo Structure

```
packages/
├── imprsn8/           → Guard backend (Cloudflare Worker)
├── trust-radar/       → Shield backend (Cloudflare Worker)
├── frontend/
│   ├── imprsn8/       → Guard SPA
│   ├── radar/         → Shield SPA
│   └── package.json   → Shared frontend dependencies
└── api/               → LRX API (FastAPI)
```

> **Package rename note:** `packages/trust-radar` and `packages/frontend/radar` will be
> renamed to `packages/shield` and `packages/frontend/shield` in a future cleanup pass
> once all CI/CD references are updated. Both names are equivalent until then.

---

*imprsn8 platform — powered by LRX · March 2026*
