# Trust Radar v2

**Threat Intelligence Observatory — Outside-In Brand Protection**

Trust Radar is an outside-in threat intelligence observatory. It watches the internet's attack surface continuously, ingests free and open data feeds, correlates signals with AI, and surfaces what matters — which brands are being hit, how, from where, and how that landscape is shifting over time.

> Full platform plan: [trust-radar-v2-plan.md](./trust-radar-v2-plan.md)
> UI prototypes: [prototypes/](./prototypes/)

---

## Status

v2 development in progress. See `trust-radar-v2-plan.md` for the full platform plan.

### v1 Archive

The previous version is preserved on `archive/v1-trust-radar` branch (when created) and tagged `v1.0-final`.

---

## Architecture

```
                    lrxradar.com
                    (Trust Radar v2 — Threat Intelligence Observatory)
                         │
           ┌─────────────┴──────────────────┐
           │                                │
     lrxradar.com                    api.lrx.io
     Trust Radar SPA                 FastAPI / Railway
     CF Worker + D1                  AI Orchestration
     trust-radar-v2                  Claude Haiku
           │                                │
           │       X-API-Key               │
           └──────────────┬────────────────┘
                          ▼
                   Cloudflare D1
                   trust-radar-v2 (primary)
                   trust-radar-v2-audit (audit log)
```

---

## Services

| Service | Domain | Package | Description |
|---------|--------|---------|-------------|
| **Trust Radar** | [lrxradar.com](https://lrxradar.com) | `packages/trust-radar/` | Threat intelligence observatory — feeds, enrichment, API |
| **Trust Radar UI** | [lrxradar.com](https://lrxradar.com) | `packages/frontend/radar/` | React SPA — Observatory HUD, Brands, Providers, Campaigns, Trends, Admin |
| **LRX API** | api.lrx.io | `packages/api/` | Shared AI/backend services (Claude Haiku orchestration) |
| **imprsn8 Guard** | [imprsn8.com](https://imprsn8.com) | `packages/imprsn8/` | Social media monitoring & personal brand protection (separate platform) |

---

## Prototype Files

These HTML files are the visual specification for each v2 view. Open and render each prototype to understand the exact layout, component structure, CSS class names, colors, typography, and interaction patterns.

| Prototype File | Covers |
|---------------|--------|
| `trust-radar-hud-v2.html` | Observatory HUD — main dashboard |
| `trust-radar-brands-tab.html` | Brands Hub + Brand Detail |
| `trust-radar-providers-tab.html` | Providers Hub + Provider Detail |
| `trust-radar-campaigns-tab.html` | Campaigns Hub + Campaign Detail |
| `trust-radar-trends-tab.html` | Trend Explorer |
| `trust-radar-agents-tab.html` | AI Agents View |
| `trust-radar-admin-dashboard.html` | Admin Dashboard |
| `trust-radar-admin-users.html` | Admin Users & Roles |
| `trust-radar-admin-feeds.html` | Admin Feed Management |
| `trust-radar-admin-leads.html` | Admin Lead Management |
| `trust-radar-login.html` | Login / Auth Screen |
| `trust-radar-public-site.html` | Public Website + Brand Assessment |

---

## Quick Start

### Prerequisites
- [pnpm](https://pnpm.io) >= 9
- [Node.js](https://nodejs.org) >= 20
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — `pnpm install -g wrangler`

### Install

```bash
pnpm install
```

### Local Development

```bash
# All packages in parallel
pnpm dev

# Individual services
cd packages/trust-radar && pnpm dev   # Trust Radar backend
cd packages/api        && uvicorn app.main:app --reload

# Frontend
pnpm --filter @lrx/frontend dev:radar     # Trust Radar SPA
```

### Database Setup (Cloudflare D1)

```bash
# Create v2 databases (one-time)
wrangler d1 create trust-radar-v2
wrangler d1 create trust-radar-v2-audit

# Apply migrations locally
cd packages/trust-radar && pnpm db:migrate:local

# Apply migrations to production
cd packages/trust-radar && pnpm db:migrate:prod
```

### Secrets Setup

```bash
cd packages/trust-radar
wrangler secret put JWT_SECRET
wrangler secret put VIRUSTOTAL_API_KEY
wrangler secret put LRX_API_KEY
```

---

## Build Sequence

See `trust-radar-v2-plan.md` Section 13 for the full ordered build sequence:

0. **Decommission v1 & Upload Prototypes** ← current
1. Database Schema
2. Feed Ingestion
3. Enrichment Pipeline
4. AI Analysis Integration
5. Authentication & Authorization
6. API Endpoints
7. UI Shell & Shared Components
8. Observatory HUD
9. Brands Tab
10. Providers Tab
11. Campaigns Tab
12. Trends Tab
13. AI Agents Tab
14-18. Admin views
19. Public Website & Brand Assessment
20. Hardening & Testing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI** | Tailwind CSS + Radix UI |
| **Data** | TanStack Query |
| **Backend** | Cloudflare Workers |
| **Database** | Cloudflare D1 (SQLite) |
| **Cache** | Cloudflare KV |
| **Storage** | Cloudflare R2 |
| **Real-time** | Cloudflare Durable Objects (WebSocket) |
| **AI** | Claude Haiku (via Railway FastAPI) |
| **DNS/CDN** | Cloudflare |
| **Build** | Turborepo + pnpm workspaces |
| **CI/CD** | GitHub Actions |

---

## Monorepo Structure

```
trust-radar/
├── trust-radar-v2-plan.md    → Single source of truth for v2
├── prototypes/               → HTML visual specifications (12 files)
├── packages/
│   ├── trust-radar/          → Trust Radar backend (Cloudflare Worker)
│   │   ├── src/
│   │   │   ├── handlers/     → API route handlers
│   │   │   ├── feeds/        → Feed ingestion modules
│   │   │   ├── enrichment/   → Enrichment pipeline
│   │   │   ├── agents/       → AI agent runners
│   │   │   ├── durableObjects/ → WebSocket push hub
│   │   │   ├── lib/          → Shared utilities
│   │   │   └── index.ts      → Worker entry point + router
│   │   ├── migrations/       → D1 migration files
│   │   └── wrangler.toml     → Cloudflare config
│   ├── frontend/
│   │   ├── radar/            → Trust Radar SPA (React)
│   │   └── imprsn8/          → imprsn8 Guard SPA (separate)
│   ├── imprsn8/              → imprsn8 Guard backend (separate)
│   └── api/                  → LRX shared API (FastAPI)
```

---

*Trust Radar v2 — powered by LRX · March 2026*
