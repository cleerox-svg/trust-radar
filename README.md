# Averrow

**Threat Actor Intelligence Platform**

See your brand the way attackers do. Averrow monitors the internet for brand impersonation, phishing infrastructure, email security vulnerabilities, and social media abuse — then correlates signals to identify who is attacking, how they operate, and where they'll move next.

> Built by [LRX Enterprises Inc.](https://averrow.com) | Canadian-incorporated, globally deployed

## What It Does

- **Threat Actor Profiling** — Correlate shared infrastructure, registrars, and hosting patterns to identify the operators behind attacks, not just the attacks themselves
- **AI Threat Intelligence** — 8+ AI agents powered by Claude Haiku that classify threats, attribute brands, cluster campaigns, and generate human-readable briefings
- **Brand Exposure Scoring** — Composite risk score combining email security, active threats, domain lookalikes, social impersonation, and phishing activity
- **Email Security Posture** — Outside-in SPF/DKIM/DMARC analysis with report card grading (A+ through F)
- **Social Brand Monitoring** — Detect impersonation accounts, handle squatting, and brand abuse across Twitter/X, LinkedIn, Instagram, TikTok, GitHub, and YouTube
- **Threat Feed Integration** — 25+ feeds including PhishTank, URLhaus, OpenPhish, ThreatFox, Certificate Transparency logs, Cloudflare Radar, NRD feeds, CISA KEV, and more
- **Lookalike Domain Detection** — Automated permutation generation and DNS monitoring for typosquatting, homoglyph, and combosquatting attacks
- **Spam Trap Network** — Honeypot-based phishing email capture and AI analysis
- **OLAP Cubes** — Pre-aggregated hourly cubes for geographic, provider, and brand threat analytics
- **Free Brand Exposure Report** — One-click public domain scan at [averrow.com](https://averrow.com)

## Architecture

```
trust-radar/
├── packages/
│   ├── trust-radar/   → Cloudflare Worker (TypeScript) + D1 + KV + Durable Objects
│   ├── averrow-ui/    → React frontend (Vite + TanStack Router)
│   └── imprsn8/       → Independent social brand protection Worker + D1
├── prototypes/         → UI design specifications (HTML)
└── docs/               → Platform documentation
```

Averrow runs entirely on Cloudflare's edge network. There is no traditional backend server.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Compute | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite at the edge, read replicas via Sessions API) |
| Cache | Cloudflare KV (dedup, rate limiting, page-load caching) |
| Real-time | Durable Objects (WebSocket push via ThreatPushHub) |
| Workflows | Cloudflare Workflows (Cartographer, NEXUS — durable execution) |
| AI | Claude Haiku via Cloudflare AI Gateway |
| DNS | Cloudflare DoH for DNS lookups |
| Frontend | React + Vite + TanStack Router + Tailwind CSS |
| Monorepo | Turborepo + pnpm |
| CI/CD | GitHub Actions (path-filtered auto-deploy) |

## AI Agents

| Agent | Role | Schedule |
|-------|------|----------|
| **Flight Control** | Autonomous supervisor — load, budget, priority management | Every cron tick |
| **Sentinel** | Threat classification, homoglyph/brand squatting detection | After feed ingestion |
| **Cartographer** | Geo enrichment, hosting provider scoring (Workflow) | Every cron tick |
| **Analyst** | AI brand attribution for unlinked threats | Every cron tick |
| **NEXUS** | Infrastructure clustering and campaign detection (Workflow) | Every 4 hours |
| **Strategist** | Campaign correlation from shared infrastructure | Every 6 hours |
| **Sparrow** | Automated takedown request generation | Every 6 hours |
| **Observer** | Daily intelligence briefings and trend analysis | Daily |
| **Pathfinder** | Sales intelligence and lead generation | Weekly (KV-throttled) |
| **Seed Strategist** | Spam trap seeding strategy | Daily |

## Cron Triggers

| Schedule | Handler | Purpose |
|----------|---------|---------|
| `*/5 * * * *` | navigator | DNS resolution, OLAP cube refresh, KV cache pre-warming |
| `7 * * * *` | orchestrator | Feed ingestion, agent dispatch, Workflow triggers |
| `12 */6 * * *` | cube-healer | 30-day bulk cube rebuild (drift remediation) |

## Development

```bash
pnpm install
pnpm dev            # Start worker locally via wrangler dev
pnpm typecheck      # Type check all packages
pnpm test           # Run test suite
```

### Database Migrations

88+ migration files in `packages/trust-radar/migrations/`.

```bash
# Run locally
npx wrangler d1 execute trust-radar-v2 --local --file=migrations/XXXX_name.sql

# Run in production
npx wrangler d1 execute trust-radar-v2 --file=migrations/XXXX_name.sql
```

### Deploy

Automated via GitHub Actions on push to `master`. Path-filtered: only deploys when files in the relevant package change.

```bash
# Manual deploy
cd packages/trust-radar && npx wrangler deploy
```

## Domains

| Domain | Purpose |
|--------|---------|
| `averrow.com` | Production (primary) |
| `averrow.ca` | Canadian market (301 → averrow.com) |
| `trustradar.ca` | Legacy domain (301 → averrow.com) |
| `staging.averrow.com` | Staging |

## Pricing

| Tier | Price | Brands |
|------|-------|--------|
| Free | — | One-time report |
| Professional | $1,499/mo | 1 brand |
| Business | $3,999/mo | Up to 10 brands |
| Enterprise | Custom | Custom |

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

Report security vulnerabilities to [security@averrow.com](mailto:security@averrow.com).

## License

Proprietary — LRX Enterprises Inc. All rights reserved.
