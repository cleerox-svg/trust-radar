# Architecture

Trust Radar is a threat actor intelligence platform built on Cloudflare Workers. This document covers the complete system architecture, data layer, and operational patterns.

> **Last verified:** March 2026 — documented from source code

## Monorepo Structure

```
trust-radar/
├── packages/
│   ├── trust-radar/        → Primary Cloudflare Worker (API + SPA)
│   │   ├── src/
│   │   │   ├── index.ts            → Worker entry point (fetch + scheduled + email)
│   │   │   ├── agents/             → 14 AI agent modules
│   │   │   ├── feeds/              → 37+ threat feed modules
│   │   │   ├── routes/             → 15 route files (340+ endpoints)
│   │   │   ├── handlers/           → Route handler functions
│   │   │   ├── lib/                → Shared utilities (JWT, CORS, DNS, haiku, etc.)
│   │   │   ├── middleware/         → Auth, rate limiting, security headers
│   │   │   ├── templates/          → Server-rendered HTML pages
│   │   │   ├── durableObjects/     → ThreatPushHub, CertStreamMonitor
│   │   │   ├── workflows/          → CartographerBackfill, NexusWorkflow
│   │   │   ├── cron/               → Orchestrator (job scheduling)
│   │   │   ├── enrichment/         → Geo-IP, WHOIS enrichment
│   │   │   ├── seeders/            → Spam trap seed address generators
│   │   │   ├── email-security.ts   → Email posture engine
│   │   │   ├── dmarc-receiver.ts   → DMARC report handler
│   │   │   ├── spam-trap.ts        → Spam trap email handler
│   │   │   ├── honeypot.ts         → Honeypot page server
│   │   │   └── types.ts            → Shared TypeScript types
│   │   ├── migrations/             → D1 SQL migrations (0001–0046+)
│   │   ├── migrations-audit/       → Audit DB migrations
│   │   ├── public/                 → Static SPA assets
│   │   └── wrangler.toml           → Worker configuration
│   ├── averrow-ui/         → React frontend (/v2)
│   │   ├── src/
│   │   │   ├── pages/              → Page components
│   │   │   ├── components/         → Shared components
│   │   │   ├── hooks/              → TanStack Query hooks
│   │   │   └── lib/                → Utilities
│   │   └── tailwind.config.ts
│   └── imprsn8/            → Social brand protection Worker (separate product)
├── docs/                   → Platform documentation
├── .github/workflows/      → CI/CD pipelines
└── turbo.json              → Turborepo configuration
```

## System Data Flow

```
                    ┌──────────────────────────────────────────────┐
                    │              INGEST LAYER                     │
                    │                                              │
                    │  24 Ingest Feeds    4 Social Feeds           │
                    │  CertStream DO      Typosquat Scanner        │
                    │  Spam Trap Email    DMARC Email              │
                    └──────────────────┬───────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────────────┐
                    │            CLASSIFICATION LAYER               │
                    │                                              │
                    │  Sentinel → threat type, severity, confidence │
                    │  Analyst  → brand attribution, exposure score │
                    │  Watchdog → social mention classification     │
                    └──────────────────┬───────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────────────┐
                    │            ENRICHMENT LAYER                   │
                    │                                              │
                    │  Cartographer → geo, ASN, registrar, provider │
                    │  9 engines: VT, GSB, SURBL, DBL, AbuseIPDB,  │
                    │  GreyNoise, SecLookup, CIRCL PDNS, HIBP      │
                    │  CF URL Scanner → verdict collection          │
                    └──────────────────┬───────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────────────┐
                    │           CORRELATION LAYER                   │
                    │                                              │
                    │  NEXUS      → ASN clustering, pivot detection │
                    │  Strategist → campaign identification         │
                    │  Narrator   → multi-signal narratives         │
                    └──────────────────┬───────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────────────────┐
                    │            ACTION LAYER                       │
                    │                                              │
                    │  Observer   → daily intelligence briefings    │
                    │  Sparrow    → takedown automation             │
                    │  Prospector → sales lead generation           │
                    │  Alerts     → notifications, email            │
                    └──────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┴───────────────────────────┐
                    │         FLIGHT CONTROL (supervisor)           │
                    │  Backlog monitoring │ Budget enforcement       │
                    │  Parallel scaling   │ Stall recovery          │
                    └──────────────────────────────────────────────┘
```

## Cloudflare Workers Architecture

### Entry Point

The main Worker (`packages/trust-radar/src/index.ts`) exports three handlers:

- **`fetch`** — HTTP request router (340+ endpoints)
- **`scheduled`** — Cron-triggered orchestrator
- **`email`** — Inbound email handler (DMARC + spam trap)

Plus Durable Object and Workflow class exports:
- `ThreatPushHub`, `CertStreamMonitor`
- `CartographerBackfillWorkflow`, `NexusWorkflow`

### Router

Uses [itty-router](https://github.com/kwhitley/itty-router). Routes are organized into 15 modules:

```typescript
registerAuthRoutes(router)           // /api/auth/*
registerScanRoutes(router)           // /api/scan/*
registerDashboardRoutes(router)      // /api/dashboard/*, /api/observatory/*
registerBrandRoutes(router)          // /api/brands/*, /api/social/*, /api/lookalikes/*
registerThreatRoutes(router)         // /api/threats/*, /api/campaigns/*, /api/providers/*
registerInvestigationRoutes(router)  // /api/tickets/*, /api/erasures/*
registerFeedRoutes(router)           // /api/feeds/*
registerExportRoutes(router)         // /api/export/*
registerAgentRoutes(router)          // /api/agents/*, /api/trustbot/*
registerSpamTrapRoutes(router)       // /api/spam-trap/*
registerSparrowRoutes(router)        // /api/admin/sparrow/*
registerEmailSecurityRoutes(router)  // /api/email-security/*, /api/dmarc-reports/*
registerTenantRoutes(router)         // /api/orgs/*
registerAdminRoutes(router)          // /api/admin/*
registerPublicRoutes(router)         // / (must be last — SPA fallback)
```

### Request Flow

1. Request hits Worker `fetch` handler
2. Hostname check — honeypot domains (lrxradar.com) routed to honeypot server
3. itty-router matches path and method
4. Middleware executes (auth, rate limiting)
5. Handler returns JSON response
6. Security headers applied (`applySecurityHeaders()`)
7. Unmatched paths fall through to SPA asset serving

### Authentication

Google OAuth with JWT tokens. Four auth levels:

| Level | Middleware | Description |
|-------|-----------|-------------|
| Public | — | No auth required |
| User | `requireAuth` | Any authenticated user |
| Admin | `requireAdmin` | Admin or super_admin role |
| Super Admin | `requireSuperAdmin` | Super_admin role only |

Organization-scoped auth: `requireOrgMember`, `requireOrgRole` (viewer < analyst < admin < owner)

### Rate Limiting

KV-based sliding window rate limiter:

| Bucket | Limit |
|--------|-------|
| auth | 10 req/min |
| scan | 30 req/min |
| scan_report | 5 req/hr |
| api | 100 req/min |
| brands | 10 req/hr |

### Security Headers

Applied via `applySecurityHeaders()`: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, X-XSS-Protection.

---

## Database: Cloudflare D1

### Databases

| Binding | Database | Purpose |
|---------|----------|---------|
| `DB` | `trust-radar-v2` | Primary data (67 tables) |
| `AUDIT_DB` | `trust-radar-v2-audit` | Audit trail (1 table) |

### Table Reference (67 tables)

#### Core Threat Intelligence
| Table | Purpose |
|-------|---------|
| `threats` | Main threat records — URL, domain, IP, severity, source, enrichment data |
| `brands` | Monitored brand registry — name, domain, sector, keywords, aliases |
| `hosting_providers` | Infrastructure — ASN, reputation score, threat trends |
| `campaigns` | Coordinated attack patterns — name, threat/brand/provider counts |
| `infrastructure_clusters` | NEXUS correlation output — ASN groups, confidence scores |
| `daily_snapshots` | Time-series metrics per entity |

#### Feed Management
| Table | Purpose |
|-------|---------|
| `feed_configs` | Feed configuration (URL, schedule, rate limits) |
| `feed_status` | Health monitoring (healthy/degraded/down/disabled) |
| `feed_pull_history` | Execution logs per pull |

#### Authentication & Authorization
| Table | Purpose |
|-------|---------|
| `users` | Platform users (role: super_admin/admin/analyst/client) |
| `user_brand_scopes` | Client-role visibility constraints |
| `invitations` | User invite workflow |
| `sessions` | JWT session tracking |

#### Agent System
| Table | Purpose |
|-------|---------|
| `agent_runs` | Execution logs (status, duration, records processed) |
| `agent_outputs` | Intelligence outputs (insight/classification/correlation/score) |
| `agent_activity_log` | Detailed execution events |
| `agent_events` | Inter-agent communication queue |
| `agent_tokens` | Per-agent auth tokens |

#### Public Assessment & Leads
| Table | Purpose |
|-------|---------|
| `assessments` | Trust score assessments (grade A-F) |
| `assessment_history` | Historical scanning records |
| `leads` | Sales pipeline (new → converted) |
| `sales_leads` | Prospector-generated leads with AI enrichment |
| `contact_submissions` | Contact form entries |

#### Email Security
| Table | Purpose |
|-------|---------|
| `email_security_scans` | DMARC/SPF/DKIM/MX results per brand |
| `dmarc_reports` | Aggregate DMARC reports |
| `dmarc_report_records` | Individual DMARC records with geo |

#### Spam Trap System
| Table | Purpose |
|-------|---------|
| `spam_trap_captures` | Every captured email (headers, auth, geo, brand) |
| `seed_campaigns` | Trap seeding campaigns |
| `seed_addresses` | Individual trap addresses |
| `spam_trap_daily_stats` | Daily aggregated metrics |
| `phishing_pattern_signals` | AI training data for phishing detection |

#### Social Intelligence
| Table | Purpose |
|-------|---------|
| `social_profiles` | Discovered social accounts per brand |
| `social_mentions` | Platform mentions (Reddit, GitHub, Mastodon, Telegram) |
| `social_monitor_results` | Social monitoring scan results |

#### Threat Intelligence
| Table | Purpose |
|-------|---------|
| `threat_signals` | Temporal indicators (spike/pattern/anomaly) |
| `threat_narratives` | AI-generated narrative summaries |
| `brand_threat_assessments` | Per-brand risk scores |

#### Lookalike & Certificate Transparency
| Table | Purpose |
|-------|---------|
| `lookalike_domains` | Detected typosquat/lookalike domains |
| `ct_certificates` | CT log certificate entries |

#### Multi-Tenancy
| Table | Purpose |
|-------|---------|
| `organizations` | Tenant orgs (plan: starter/pro/enterprise) |
| `org_members` | SCIM-ready membership |
| `org_brands` | Org-to-brand mapping |
| `org_api_keys` | Per-org API keys |
| `org_integrations` | Third-party integrations |

#### Takedown System
| Table | Purpose |
|-------|---------|
| `takedown_requests` | Takedown requests with status tracking |
| `takedown_evidence` | Evidence packages |
| `takedown_providers` | Provider abuse contacts |

#### Enrichment Data
| Table | Purpose |
|-------|---------|
| `url_scan_results` | Cloudflare URL Scanner verdicts |
| `passive_dns_records` | CIRCL PDNS historical DNS |
| `stealer_log_results` | HIBP credential exposure |
| `provider_threat_stats` | Provider stats (today/7d/30d/all-time) |

#### Reference Tables
| Table | Purpose |
|-------|---------|
| `brand_safe_domains` | Per-brand safe domain allowlist |
| `monitored_brands` | Active monitoring status |
| `disposable_email_domains` | Throwaway email domain blocklist |
| `tor_exit_nodes` | Tor exit node reference |
| `nrd_references` | Newly registered domain reference |

#### UI & Notifications
| Table | Purpose |
|-------|---------|
| `notifications` | Per-user notifications |
| `notification_preferences` | Notification settings |
| `system_notifications` | Platform-wide alerts |
| `alerts` | Alert tracking |

#### Audit (Separate Database)
| Table | Purpose |
|-------|---------|
| `audit_log` | Append-only trail (action, resource, outcome, IP) |

---

## Caching: Cloudflare KV

Namespace bound as `CACHE`:

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `dedup:{type}:{value}` | IOC deduplication | 24h |
| `rl:{bucket}:{id}:{window}` | Rate limit counters | 2x window |
| `honeypot-site:{host}:{page}` | Honeypot HTML cache | 24h |
| `forced_logout:{user_id}` | Session invalidation | — |
| `cron_last_run` | Cron status snapshot | 2h |
| `vt_daily_calls_{date}` | VirusTotal budget | 24h |
| `abuseipdb_daily_{date}` | AbuseIPDB budget | 24h |
| `greynoise_daily_{date}` | GreyNoise budget | 24h |
| `seclookup_monthly_{y}_{m}` | SecLookup budget | 31d |
| `email-sec:{domain}` | Email security cache | 1h |

---

## Durable Objects

### ThreatPushHub

Real-time WebSocket push for threat notifications.

- `GET /ws/threats` → WebSocket upgrade
- `POST /ws/threats/broadcast` → Internal broadcast
- `GET /ws/threats/stats` → Connection count

### CertStreamMonitor

Persistent Certificate Transparency stream monitor.

- **30-second alarm cycle:** flush pending matches, check connection health, reconnect if stale (60s no data)
- **Brand matching:** loads keywords, domains, aliases from brands table
- **DGA filtering:** rejects high-entropy domains
- **Phishing scoring:** suspicious TLDs, keywords, hyphens, homoglyphs

Endpoints: `/api/certstream/stats`, `/api/certstream/reload-brands`

---

## Cloudflare Workflows

### CartographerBackfillWorkflow

Durable multi-step geo enrichment backfill:

1. Count unenriched threats (WHERE enriched_at IS NULL)
2. Batch fetch threats (500 per batch)
3. Enrich via ip-api.com
4. Upsert hosting_providers by ASN
5. Update threats with enriched data
6. Log progress every 10 batches

Retry: 3 retries, 10s delay, exponential backoff, 5min timeout per step.

### NexusWorkflow

ASN-based threat correlation and clustering:

1. Count existing clusters
2. ASN correlation (group by ASN + threat_type)
3. Detect pivots (>80% drop) and acceleration (>50% increase)
4. Write infrastructure_clusters
5. Update hosting_provider trends
6. Create agent_events for Observer

---

## Cron Orchestrator

Configured at `*/15 * * * *` (every 15 minutes). The orchestrator (`src/cron/orchestrator.ts`) runs jobs by schedule:

| Schedule | Job | Handler |
|----------|-----|---------|
| Every tick | Flight Control | Supervisor, backlogs, budgets |
| Every 5 min | CT Monitor | CertStream DO ping |
| Every 30 min | Feed Scan | Ingest + enrichment + social |
| Every hour (:15) | Lookalike Check | Domain detection |
| Every 6h | Social Monitoring | Discovery + monitor + AI assess |
| Daily 06:00 | Observer Briefing | Intelligence synthesis |
| Daily 06:00 | Threat Narratives | AI narrative generation |
| Daily 12:00 | Briefing Email | Resend delivery |

Pre-cron: Flight Control runs first, CertStream DO pinged, agent events consumed.

---

## Email Handling

The Worker receives inbound emails routed to two handlers:

- **DMARC reports** — `dmarc-receiver.ts` parses aggregate XML reports
- **Spam trap captures** — `spam-trap.ts` processes captured phishing/spam with full header analysis

---

## Environments & Domains

| Domain | Purpose |
|--------|---------|
| `averrow.com` / `www.averrow.com` | Primary production |
| `averrow.ca` / `www.averrow.ca` | Production (Canadian) |
| `trustradar.ca` / `www.trustradar.ca` | Legacy |
| `lrxradar.com` / `www.lrxradar.com` | Honeypot |

Worker compatibility: `nodejs_compat`, date `2024-12-01`.
