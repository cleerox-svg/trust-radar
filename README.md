# Trust Radar

**AI-Powered Brand Threat Intelligence**

See your brand the way attackers do. Trust Radar monitors the internet for brand impersonation, phishing infrastructure, email security vulnerabilities, and social media abuse — delivering actionable intelligence through AI-powered agents.

> Built by [LRX Enterprises Inc.](https://trustradar.ca) 🇨🇦

## What It Does

- **Brand Exposure Scoring** — Composite risk score combining email security, active threats, domain lookalikes, social impersonation, and phishing activity
- **AI Threat Intelligence** — 8 AI agents powered by Claude Haiku correlate signals and generate human-readable threat narratives and daily briefings
- **Email Security Posture** — Outside-in SPF/DKIM/DMARC analysis with report card grading (A+ through F)
- **Social Brand Monitoring** — Detect impersonation accounts, handle squatting, and brand abuse across Twitter/X, LinkedIn, Instagram, TikTok, GitHub, and YouTube
- **Threat Feed Integration** — PhishTank, URLhaus, OpenPhish, Certificate Transparency logs, Cloudflare Radar, NRD feeds
- **Lookalike Domain Detection** — Automated permutation generation and DNS monitoring for typosquatting, homoglyph, and combosquatting attacks
- **Spam Trap Network** — Honeypot-based phishing email capture and AI analysis
- **Free Brand Exposure Report** — One-click public domain scan at trustradar.ca

## Architecture

```
trust-radar/
├── packages/
│   ├── trust-radar/  → Cloudflare Worker (TypeScript) + D1 + KV
│   └── imprsn8/      → Independent social brand protection Worker + D1
├── prototypes/        → UI design specifications (HTML)
└── docs/              → Platform documentation
```

Trust Radar runs entirely on Cloudflare's edge network. There is no traditional backend server.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Compute | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite at the edge) |
| Cache | Cloudflare KV |
| Real-time | Durable Objects (WebSocket push) |
| AI | Claude Haiku (Anthropic API) |
| DNS | Cloudflare DoH for DNS lookups |
| Monorepo | Turborepo + pnpm |
| CI/CD | GitHub Actions (path-filtered auto-deploy) |

## AI Agents

| Agent | Role | Schedule |
|-------|------|----------|
| **Sentinel** | Threat classification, homoglyph/brand squatting detection | Every feed cycle |
| **Analyst** | AI brand attribution for unlinked threats | Every 15 min |
| **Observer** | Daily intelligence briefings and trend analysis | Daily |
| **Strategist** | Campaign clustering from shared infrastructure | Every 6 hours |
| **Cartographer** | Geo enrichment and hosting provider scoring | Every 6 hours |
| **Prospector** | Sales intelligence and lead generation | Weekly |
| **Trustbot** | Interactive threat intelligence copilot | On demand |
| **Seed Strategist** | Spam trap seeding strategy | Daily |

## Development

```bash
pnpm install
pnpm dev            # Start worker locally via wrangler dev
pnpm typecheck      # Type check all packages
```

### Database Migrations

```bash
# Run locally
npx wrangler d1 execute trust-radar-v2 --local --file=migrations/XXXX_name.sql

# Run in production
npx wrangler d1 execute trust-radar-v2 --file=migrations/XXXX_name.sql
```

Migrations are in `packages/trust-radar/migrations/` (35+ files, sequential).

### Deploy

Automated via GitHub Actions on push to `master`. Path-filtered: only deploys when files in the relevant package change.

```bash
# Manual deploy
cd packages/trust-radar && npx wrangler deploy
```

## Domains

| Domain | Purpose |
|--------|---------|
| trustradar.ca | Production |
| www.trustradar.ca | Production (alias) |
| staging.trustradar.ca | Staging |

## Pricing

| Tier | Price | Brands | Scan |
|------|-------|--------|------|
| Free | — | — | One-time report |
| Professional | $799/mo | 1 brand | — |
| Business | $1,999/mo | Up to 10 brands | — |
| Enterprise | Starting $4,999/mo | Custom | — |

## Documentation

See `docs/` for detailed documentation:

- [API Reference](docs/API_REFERENCE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [AI Agents](docs/AI_AGENTS.md)
- [Threat Feeds](docs/THREAT_FEEDS.md)
- [Email Security Engine](docs/EMAIL_SECURITY_ENGINE.md)
- [Social Monitoring](docs/SOCIAL_MONITORING.md)
- [Deployment](docs/DEPLOYMENT.md)

## Security

Report security vulnerabilities to [security@trustradar.ca](mailto:security@trustradar.ca).

## License

Proprietary — © 2026 LRX Enterprises Inc. All rights reserved.
