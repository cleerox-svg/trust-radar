# Trust Radar

**AI-Powered Brand Threat Intelligence**

See your brand the way attackers do. Trust Radar monitors the internet for brand impersonation, phishing infrastructure, email security vulnerabilities, and social media abuse — delivering actionable intelligence, not just alerts.

> Built by [LRX Enterprise Inc.](https://trustradar.ca) · Canadian-incorporated

## What It Does

- **Brand Exposure Scoring** — Composite trust score (0-100) combining email security, active threats, DNS hygiene, certificate transparency, and phishing activity
- **AI Threat Intelligence** — Analyst and Observer agents correlate signals and generate human-readable threat narratives
- **Email Security Posture** — Outside-in SPF/DKIM/DMARC analysis with report card grading (A+ through F)
- **Social Brand Monitoring** — Detect impersonation accounts, fake profiles, and brand abuse across 6+ platforms
- **Threat Feed Integration** — PhishTank, URLhaus, OpenPhish, Certificate Transparency logs
- **Free Brand Exposure Report** — One-click domain scan with shareable results

## Architecture

```
Monorepo (Turborepo + pnpm)
├── packages/
│   ├── trust-radar/    → Cloudflare Worker (TypeScript) + D1
│   ├── imprsn8/        → Social brand protection Worker + D1
│   └── api/            → Shared backend (FastAPI/Railway)
├── prototypes/         → UI design specifications (HTML)
└── docs/               → Platform documentation
```

## AI Agents

| Agent | Role | Trigger |
|-------|------|---------|
| **Analyst** | Evaluates threats, correlates signals, generates assessments | New threat detection, on-demand |
| **Observer** | Daily intelligence briefings, trend monitoring | Daily cron |
| **Strategist** | Strategic threat landscape analysis | On-demand |
| **Cartographer** | Maps threat infrastructure and relationships | On-demand |
| **Prospector** | Identifies high-value sales prospects | Weekly cron |
| **Sentinel** | Real-time threat monitoring and alerting | Continuous |
| **Trustbot** | Automated trust scoring and validation | On scan |
| **Seed Strategist** | Spam trap seeding strategy | On-demand |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| AI | Claude Haiku (direct Anthropic API) |
| DNS | Cloudflare DoH |
| Monorepo | Turborepo + pnpm |
| CI/CD | GitHub Actions (path-filtered) |

## Development

```bash
# Prerequisites: Node.js 20+, pnpm
pnpm install
pnpm dev           # Start all workers locally
pnpm typecheck     # Type check all packages
pnpm build         # Build all packages
```

## Database

Trust Radar uses Cloudflare D1 (SQLite at the edge). Migrations are in `packages/trust-radar/migrations/`.

```bash
# Run migrations locally
npx wrangler d1 execute trust-radar-v2 --local --file=migrations/XXXX_name.sql

# Run migrations in production
npx wrangler d1 execute trust-radar-v2 --file=migrations/XXXX_name.sql
```

## Deploy

Deployment is automated via GitHub Actions on push to `master`:
- `packages/trust-radar/**` → deploys to Cloudflare Workers
- `packages/imprsn8/**` → deploys to Cloudflare Workers
- `packages/api/**` → deploys to Railway

## Environment

Copy `.env.example` and fill in the required secrets. See `packages/trust-radar/wrangler.toml` for Worker bindings.

## Pricing

| Tier | Price | Brands |
|------|-------|--------|
| Scan | Free | One-time report |
| Professional | $299/mo | 1 brand |
| Business | $799/mo | Up to 10 |
| Enterprise | Custom | Unlimited |

## Roadmap

See [TRUST_RADAR_UNIFIED_PLATFORM_PLAN.md](./TRUST_RADAR_UNIFIED_PLATFORM_PLAN.md) for the full roadmap.

## License

Proprietary — © 2026 LRX Enterprise Inc. All rights reserved.
