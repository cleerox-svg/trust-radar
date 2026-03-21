# Trust Radar v2

Threat Intelligence Observatory — Outside-In Brand Protection

## Status
v2 development in progress. See `trust-radar-v2-plan.md` for the full platform plan.

## v1 Archive
The previous version is preserved on `archive/v1-trust-radar` branch and tagged `v1.0-final`.

---

## Architecture

```
                lrxradar.com
                (Trust Radar v2)
                     │
       ┌─────────────┴──────────────────┐
       │                                │
 lrxradar.com                    api.lrx.io
 CF Worker + D1                  FastAPI / Railway
 UI SPA + API                    AI Orchestration
 trust-radar-v2                  Claude Haiku
       │                                │
       └──────────────┬────────────────┘
                      ▼
               Cloudflare D1
               trust-radar-v2 (primary)
               trust-radar-v2-audit (audit log)
```

## Services

| Service | Domain | Package | Description |
|---------|--------|---------|-------------|
| **Trust Radar** | lrxradar.com | `packages/trust-radar/` | Worker: API + vanilla JS SPA (Observatory, Brands, Providers, Campaigns, Trends, Agents, Admin) |
| **LRX API** | api.lrx.io | `packages/api/` | Shared AI/backend services (Claude Haiku orchestration) |
| **imprsn8 Guard** | imprsn8.com | `packages/imprsn8/` | Social media monitoring & personal brand protection (separate platform) |

## Prototype Files

HTML prototypes in `prototypes/` are the visual specification. See `trust-radar-v2-plan.md` Section 6 for full implementation details.

## Quick Start

```bash
pnpm install
cd packages/trust-radar && pnpm dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla JS SPA (no framework — Chakra Petch, Outfit, IBM Plex Mono) |
| **Maps** | Leaflet 1.9.4 + CartoDB dark tiles + leaflet.heat |
| **Charts** | Chart.js 4.x |
| **Backend** | Cloudflare Workers (TypeScript) |
| **Database** | Cloudflare D1 (SQLite) |
| **Storage** | Cloudflare R2 |
| **AI** | Claude Haiku (direct Anthropic API) |
| **DNS/CDN** | Cloudflare |

---

*Trust Radar v2 — powered by LRX*
