# TRUST RADAR — UNIFIED PLATFORM PLAN

## Claude Code Master Instruction Document

**Version:** 1.1 (Revised)
**Date:** March 20, 2026
**Parent Company:** LRX Enterprise Inc. (Canadian-incorporated)
**Domain:** trustradar.ca (migrating from lrx-radar.com)
**Repo:** github.com/cleerox-svg/trust-radar
**Branch:** master

---

## TABLE OF CONTENTS

1. [Platform Identity & Positioning](#1-platform-identity--positioning)
2. [Public Site Redesign](#2-public-site-redesign)
3. [Repository Documentation Overhaul](#3-repository-documentation-overhaul)
4. [Social Brand Monitoring (New Build — Independent of imprsn8)](#4-social-brand-monitoring--new-build)
5. [Feature Roadmap — Consolidated](#5-feature-roadmap--consolidated)
6. [Architecture Reference](#6-architecture-reference)
7. [Design System](#7-design-system)
8. [Execution Order](#8-execution-order)

---

## 1. PLATFORM IDENTITY & POSITIONING

### What Trust Radar Is

Trust Radar is an **AI-powered brand threat intelligence platform** that provides outside-in brand protection monitoring for companies that can't afford a full SOC or six-figure enterprise security contracts.

### Tagline Options (pick one during implementation)

- "AI-Powered Brand Threat Intelligence"
- "See Your Brand the Way Attackers Do"
- "Brand Protection Intelligence. AI-Powered. SOC-Free."
- "The Brand Threat Radar for the Rest of Us"

### Core Value Proposition

> Trust Radar continuously monitors the internet for brand impersonation, phishing infrastructure, email security vulnerabilities, and social media abuse targeting your organization — powered by AI agents that analyze threats and deliver actionable intelligence, not just alerts.

### Competitive Positioning

Trust Radar is NOT:
- An enterprise DRP platform (BrandShield, ZeroFox, Bolster = $30K-$150K+/yr)
- A marketplace counterfeit tool (Red Points, MarqVision)
- A generic domain monitoring service

Trust Radar IS:
- AI-native brand protection for mid-market companies, startups, and lean security teams
- Outside-in threat intelligence that combines email security posture, domain impersonation, threat feeds, and social media monitoring into a single trust score
- Radically affordable (~$22/month infrastructure) vs. competitors
- The first platform designed to detect AI-generated phishing and impersonation at this price tier

### Target Customers

1. **Primary:** Companies with 50-500 employees that have a brand worth protecting but no dedicated security team
2. **Secondary:** Managed Security Service Providers (MSSPs) looking for a brand protection add-on
3. **Tertiary:** Security-conscious founders/CTOs who want visibility into their brand's attack surface

---

## 2. PUBLIC SITE REDESIGN

### 2.1 Current State

The current Worker serves API endpoints and a basic SPA. The README describes it as "URL & domain trust scoring" which undersells the platform significantly.

### 2.2 Target State — Public Site Structure

The public-facing site at `trustradar.ca` should serve as BOTH the product marketing site AND the application dashboard (authenticated routes). This is a single Cloudflare Worker SPA.

#### Page Structure

```
trustradar.ca/                          → Landing page (public)
trustradar.ca/scan                      → Free Brand Exposure Report (public)
trustradar.ca/features                  → Feature breakdown (public)
trustradar.ca/pricing                   → Pricing tiers (public)
trustradar.ca/docs                      → API docs / integration guide (public)
trustradar.ca/login                     → Auth (public)
trustradar.ca/register                  → Auth (public)
trustradar.ca/dashboard                 → Main dashboard (authenticated)
trustradar.ca/dashboard/threats         → Threat feed (authenticated)
trustradar.ca/dashboard/email-security  → Email security posture (authenticated)
trustradar.ca/dashboard/social          → Social brand monitoring (authenticated)
trustradar.ca/dashboard/reports         → AI-generated threat narratives (authenticated)
trustradar.ca/dashboard/settings        → Account settings (authenticated)
```

### 2.3 Landing Page — Detailed Specification

The landing page is the single most important page. It must communicate what Trust Radar does, why it's different, and drive visitors to the free scan tool.

#### Hero Section

```
Layout: Full viewport height, dark background
Headline: "See Your Brand the Way Attackers Do"
Subhead: "AI-powered brand threat intelligence that monitors for impersonation,
          phishing infrastructure, email vulnerabilities, and social media abuse —
          so you don't need a SOC to protect your brand."
CTA Primary: "Scan Your Brand — Free" → links to /scan
CTA Secondary: "See How It Works" → smooth scroll to features

Visual: Animated radar sweep visualization (CSS/canvas)
        - Dark navy/black background
        - Cyan/electric blue radar sweep
        - Threat dots appearing on the radar as it sweeps
        - Subtle grid lines underneath
```

#### Social Proof Bar (below hero)

```
"Monitoring threats across [X] domains | [Y] threats detected this month | [Z] AI assessments generated"
Pull these numbers from actual D1 stats via an API endpoint.
```

#### Feature Sections (3-4 blocks, scrolling)

**Block 1: Brand Exposure Score**
```
Headline: "One Score. Complete Picture."
Body: Trust Radar combines email security posture, active impersonation threats,
      DNS hygiene, certificate transparency anomalies, and known phishing activity
      into a single Brand Exposure Score — like a credit score for your brand's
      attack surface.
Visual: Animated score gauge (0-100) with color gradient
        Score breakdown showing component ratings
```

**Block 2: AI Threat Intelligence**
```
Headline: "AI Agents That Think Like Analysts"
Body: Our Analyst and Observer AI agents don't just flag alerts — they correlate
      signals across threat feeds, reason about attack patterns, and generate
      human-readable threat narratives. Get intelligence briefs, not alert fatigue.
Visual: Example threat narrative card (mocked or real)
        Show the agent's reasoning chain visually
```

**Block 3: Email Security Posture**
```
Headline: "Your Email Config Is Your Front Door"
Body: Trust Radar performs deep outside-in analysis of SPF, DKIM, and DMARC
      configuration — the email authentication controls that determine whether
      attackers can impersonate your domain. We grade your posture and track it
      over time.
Visual: Example email security report card (A through F grading)
        Before/after showing improvement
```

**Block 4: Social Brand Monitoring** (NEW)
```
Headline: "Your Brand on Every Platform. Monitored."
Body: Track unauthorized use of your brand name, logo, and executive identities
      across social platforms. Detect impersonation accounts, fake profiles, and
      brand abuse before they reach your customers.
Visual: Social platform icons with monitoring status indicators
        Example impersonation detection alert
```

#### How It Works Section

```
3-step horizontal layout:
1. "Add Your Brand" — Enter your domain, brand name, social handles
2. "We Monitor 24/7" — AI agents scan threat feeds, CT logs, email config, social platforms
3. "Get Intelligence" — Receive threat narratives, not just alerts. Act on what matters.
```

#### Pricing Section

```
Tier 1: "Scan" — Free
  - One-time Brand Exposure Report
  - Email security posture grade
  - Domain impersonation check
  - Social handle scan
  - AI threat assessment
  - Shareable report link
  - No account required

Tier 2: "Professional" — $299/month
  - Everything in Scan
  - Continuous monitoring (1 brand/domain)
  - 24/7 monitoring
  - Daily AI threat briefings
  - Email security tracking over time
  - Social brand monitoring (6 platforms)
  - Credential exposure alerts (HIBP)
  - Lookalike domain monitoring
  - Threat feed integration
  - Email + in-app alerts

Tier 3: "Business" — $799/month
  - Everything in Professional
  - Up to 10 brands/domains
  - Certificate Transparency monitoring
  - AI threat narratives with full reasoning
  - Executive name monitoring
  - STIX 2.1 export for SIEM integration
  - API access + webhooks
  - Priority support

Tier 4: "Enterprise" — Custom
  - Everything in Business
  - Unlimited brands
  - Multi-tenant / MSSP support
  - SSO (SAML/OIDC)
  - SIEM integration
  - Custom AI agent tuning
  - Dedicated account team
  - SLA guarantee
```

#### Footer

```
Columns: Platform | Company | Resources | Legal
Platform: Threat Detection | Email Security | Social Monitoring | AI Agents | Free Scan
Company: About | Blog | Careers | Contact | Press
Resources: Documentation | API Reference | Status Page | Changelog | Security
Legal: Privacy Policy | Terms of Service | Data Processing | Responsible Disclosure
Brand: "Trust Radar · AI-Powered Brand Threat Intelligence"
Bottom: "© 2026 LRX Enterprise Inc. All rights reserved."
Badges: Cloudflare | Anthropic | SOC 2 (Planned)
```

### 2.4 Free Brand Exposure Report (/scan)

This is the viral acquisition loop. It must work without authentication and deliver immediate value.

#### Input

```
Single input field: "Enter a domain to scan"
Example placeholder: "yourcompany.com"
Button: "Generate Report"
Optional: Brand name, social handles (expandable "Add more context" section)
```

#### Report Output (generated on-page, no download required)

The report should render as a beautiful, shareable single-page result. Include:

```
┌─────────────────────────────────────────────────┐
│  BRAND EXPOSURE REPORT                          │
│  yourcompany.com                                │
│  Generated March 20, 2026                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  BRAND EXPOSURE SCORE: 72/100   [█████████░░░]  │
│  Risk Level: MODERATE                           │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  EMAIL SECURITY POSTURE          Grade: B       │
│  ├─ SPF: ✓ Valid (strict)                       │
│  ├─ DKIM: ⚠ Partial (1 of 3 selectors)         │
│  ├─ DMARC: ✓ Reject policy                     │
│  └─ MX Provider: Google Workspace               │
│                                                 │
│  DOMAIN IMPERSONATION RISK       Score: 6/10    │
│  ├─ Similar domains found: 3                    │
│  ├─ Active threats: 1                           │
│  └─ Parked lookalikes: 2                        │
│                                                 │
│  THREAT FEED MATCHES             Hits: 2        │
│  ├─ PhishTank: 1 active entry                   │
│  ├─ URLhaus: 0                                  │
│  └─ OpenPhish: 1 historical                     │
│                                                 │
│  SOCIAL PRESENCE CHECK           Issues: 1      │
│  ├─ Unregistered handles found on 2 platforms   │
│  └─ Potential impersonation: 1 account flagged  │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  AI ASSESSMENT (by Trust Radar Analyst)          │
│                                                 │
│  "yourcompany.com has a moderately secure email  │
│   posture but incomplete DKIM coverage across    │
│   selectors leaves a gap that sophisticated      │
│   attackers could exploit. The single active      │
│   PhishTank entry targeting this domain suggests │
│   it has already been targeted. Recommend         │
│   immediate DKIM selector expansion and           │
│   monitoring activation."                         │
│                                                 │
│  [Monitor This Brand — $49/mo]  [Share Report]  │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Technical Implementation

```
POST /api/scan/report (public, rate-limited)
  Input: { domain: string, brand_name?: string, social_handles?: string[] }
  Process:
    1. Email security scan (SPF/DKIM/DMARC/MX lookup via DoH)
    2. Threat feed check (existing pipeline — PhishTank, URLhaus, OpenPhish)
    3. Lookalike domain generation (dnstwist-style permutations, check registration)
    4. Social handle availability check (username enumeration on major platforms)
    5. AI assessment via Analyst agent (Claude Haiku)
  Output: BrandExposureReport object
  Cache: Cache results in KV for 24 hours per domain
  Rate limit: 5 scans per IP per hour (unauthenticated), unlimited for authenticated
```

### 2.5 Dashboard (Authenticated)

The dashboard is the ongoing monitoring interface. Refer to existing `TRUST_RADAR_COMMAND_CENTER_BUILD_PLAN.md` for the HUD layout spec. Key additions:

#### Dashboard Home

```
- Brand Exposure Score (large, center) with trend sparkline
- Threat activity timeline (last 7 days)
- AI briefing card (latest Observer daily briefing)
- Quick stats: Active threats | Email grade | Social issues | Domains monitored
```

#### Threats View

```
- Filterable threat feed (source, severity, type, date)
- Each threat card shows: domain/URL, source feed, severity, first seen, AI assessment
- Bulk actions: Mark resolved, escalate, export
- Map visualization for threat infrastructure (if geo data available)
```

#### Email Security View

```
- Current grade with breakdown (SPF/DKIM/DMARC/MX)
- Historical grade chart (trend over time)
- Recommendations panel (AI-generated, specific to their config)
- Raw record viewer (show actual DNS records)
```

#### Social Monitoring View (NEW)

```
- Platform grid: Each monitored platform shows status
- Impersonation alerts with evidence screenshots
- Brand mention sentiment (if API access available)
- Handle reservation status (which platforms have your brand name, which don't)
```

---

## 3. REPOSITORY DOCUMENTATION OVERHAUL

### 3.1 README.md — Complete Rewrite

Replace the current developer-focused README with a product-focused document that also serves developers.

```markdown
# Trust Radar

**AI-Powered Brand Threat Intelligence**

Trust Radar is an outside-in brand protection monitoring platform that uses AI agents to detect impersonation, phishing infrastructure, email security vulnerabilities, and social media abuse targeting organizations.

Built on Cloudflare Workers for edge-native performance at radically low operational cost.

## What It Does

- **Brand Exposure Scoring** — Composite trust score combining email security posture, active threats, domain hygiene, and social media presence
- **AI Threat Analysis** — Claude Haiku-powered Analyst and Observer agents that correlate signals and generate human-readable threat narratives
- **Email Security Posture Engine** — Outside-in SPF/DKIM/DMARC assessment with grading and historical tracking
- **Threat Feed Integration** — Aggregates PhishTank, URLhaus, OpenPhish, and Certificate Transparency logs
- **Social Brand Monitoring** — Detects impersonation accounts and unauthorized brand usage across platforms
- **Lookalike Domain Detection** — Generates and monitors domain permutations (typosquats, homoglyphs, TLD variants)
- **Daily AI Briefings** — Observer agent delivers daily intelligence summaries

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    trustradar.ca                       │
│              Cloudflare Worker (TypeScript)            │
│         ┌──────────┬───────────┬──────────┐          │
│         │  Public   │  Auth'd   │  API     │          │
│         │  Site     │  Dashboard│  Routes  │          │
│         └────┬─────┴─────┬─────┴────┬─────┘          │
│              │           │          │                 │
│         ┌────▼───────────▼──────────▼─────┐          │
│         │         Cloudflare D1            │          │
│         │   (threats, scans, users, etc)   │          │
│         └──────────────────────────────────┘          │
│         ┌──────────────┐  ┌────────────────┐          │
│         │ Cloudflare KV │  │ Durable Objects│          │
│         │ (cache/rate)  │  │ (WebSocket/RT) │          │
│         └──────────────┘  └────────────────┘          │
└──────────────────────────────────────────────────────┘
          │                          │
    ┌─────▼──────┐           ┌──────▼───────┐
    │ AI Agents  │           │ Threat Feeds │
    │ (Haiku)    │           │ (Cron/30min) │
    │ Analyst    │           │ PhishTank    │
    │ Observer   │           │ URLhaus      │
    │ Sales*     │           │ OpenPhish    │
    └────────────┘           │ CT Logs      │
                             └──────────────┘
```

## AI Agents

| Agent | Role | Trigger |
|-------|------|---------|
| **Analyst** | Evaluates individual brand threats, correlates signals, generates threat assessments and narratives | On new threat detection, on-demand scan |
| **Observer** | Generates daily intelligence briefings, tracks trends, monitors email security changes | Daily cron |
| **Sales** (planned) | Identifies high-value prospects from platform data, generates personalized outreach | Weekly cron |

## Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Cloudflare Workers (TypeScript) | Edge compute, zero cold starts |
| Database | Cloudflare D1 (SQLite) | Persistent storage |
| Cache | Cloudflare KV | Rate limiting, scan caching |
| Real-time | Durable Objects | WebSocket push (planned) |
| AI | Claude Haiku (Anthropic) | Agent reasoning and analysis |
| DNS Lookups | Cloudflare DoH | SPF/DKIM/DMARC/MX resolution |
| Monorepo | Turborepo + pnpm workspaces | Build orchestration |
| CI/CD | GitHub Actions | Path-filtered auto-deploy |

## Development

### Prerequisites

- [pnpm](https://pnpm.io) ≥ 9
- [Node.js](https://nodejs.org) ≥ 20
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Quick Start

```bash
pnpm install
cd packages/trust-radar && pnpm dev
```

### Database

```bash
# Local
pnpm db:migrate:local

# Production
pnpm db:migrate:prod
```

### Deploy

```bash
pnpm deploy:radar
```

### Environment & Secrets

See `.env.example` for required variables. Set Worker secrets via:

```bash
wrangler secret put JWT_SECRET
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put VIRUSTOTAL_API_KEY
```

## API Reference

See [/docs](https://trustradar.ca/docs) for the full API reference.

### Key Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/scan/report` | Optional | Generate Brand Exposure Report |
| `GET` | `/api/threats` | Bearer | List active threats |
| `GET` | `/api/email-security/:domain` | Bearer | Email security posture |
| `GET` | `/api/social/monitor` | Bearer | Social monitoring status |
| `GET` | `/api/briefing/latest` | Bearer | Latest AI briefing |
| `POST` | `/api/brands` | Bearer | Add monitored brand |

## Roadmap

- [x] Core scanning pipeline
- [x] Email security posture engine
- [x] AI agent framework (Analyst + Observer)
- [x] Threat feed integration (PhishTank, URLhaus, OpenPhish)
- [ ] Public Brand Exposure Report (free scan tool)
- [ ] Social brand monitoring
- [ ] Certificate Transparency log monitoring
- [ ] Lookalike domain generation + continuous monitoring
- [ ] STIX 2.1 export
- [ ] AI threat narratives
- [ ] Spam trap network + DMARC report receiver
- [ ] AI-generated phishing detection
- [ ] Multi-tenant architecture
- [ ] SIEM/webhook integrations

## License

Proprietary. All rights reserved.
```

### 3.2 PLATFORM_DESIGN_BRIEF.md — Update

Update the existing design brief to reflect:
- New positioning language ("AI-Powered Brand Threat Intelligence")
- Social brand monitoring as a core feature
- The free Brand Exposure Report as the primary acquisition tool
- Remove references to "LRX" branding — everything is "Trust Radar"
- Remove any references to imprsn8 from Trust Radar-facing docs

### 3.3 New Documentation Files to Create

```
docs/
├── ARCHITECTURE.md              → Detailed technical architecture
├── AI_AGENTS.md                 → Agent design, prompts, behavior specs
├── EMAIL_SECURITY_ENGINE.md     → Email posture engine documentation
├── SOCIAL_MONITORING.md         → Social brand monitoring spec (NEW)
├── THREAT_FEEDS.md              → Feed integration details
├── API_REFERENCE.md             → Full endpoint documentation
├── DEPLOYMENT.md                → Deployment procedures
└── CONTRIBUTING.md              → Contribution guidelines
```

### 3.4 Files to Remove or Archive

- Remove any references to "OpenAI GPT-4o-mini" in the stack — the platform uses Claude Haiku
- Archive or move `packages/api` (FastAPI/Railway) references if no longer in use
- Remove imprsn8 from the root README — it should be documented separately or in its own section
- Clean up the `PLATFORM_DESIGN_BRIEF.md` to align with new positioning

---

## 4. SOCIAL BRAND MONITORING — NEW BUILD

### 4.1 Relationship to imprsn8

**CRITICAL: imprsn8 remains a fully independent product.** It is NOT being merged, migrated, or deprecated. The two products share the monorepo and Cloudflare infrastructure but nothing else:

```
┌──────────────────────────────────────────────────────────┐
│ SHARED (monorepo infrastructure only):                    │
│   Turborepo, pnpm workspaces, GitHub Actions,            │
│   Cloudflare account, .github/workflows                  │
├──────────────────────────────────────────────────────────┤
│ NOT SHARED (completely independent):                      │
│   Code, D1 databases, users, auth, KV namespaces,        │
│   domains, business logic, pricing, branding             │
└──────────────────────────────────────────────────────────┘

imprsn8 (imprsn8.com)                Trust Radar (trustradar.ca)
├── Audience: Creators/influencers   ├── Audience: Companies/brands
├── Purpose: Improve personal brand  ├── Purpose: Detect brand threats
├── "How strong is your brand?"      ├── "Is someone impersonating you?"
├── Worker + D1 (separate)           ├── Worker + D1 (separate)
└── Remains independent              └── Social monitoring = NEW CODE
```

Social media monitoring for Trust Radar is **built from scratch** as a corporate brand protection feature. It is not adapted from imprsn8. The concept is similar (checking social platforms) but the intent, data model, scoring, and actions are entirely different. Claude Code should NOT reference, copy from, or depend on any imprsn8 source files.

### 4.2 What Trust Radar Needs for Corporate Brand Monitoring

| Aspect | imprsn8 (stays independent) | Trust Radar (new build) |
|--------|----------------------------|------------------------|
| Entity | Individual person | Company/brand |
| Goal | Improve personal brand score | Detect impersonation & abuse |
| Profiles | User's own profiles | Brand's official + unauthorized profiles |
| Analysis | "How good is your bio?" | "Is this account impersonating the brand?" |
| Scoring | Impression quality score | Impersonation risk score |
| Action | Recommendations to improve | Alert + evidence for takedown |

### 4.3 Social Brand Monitoring — Feature Specification

#### Data Model

```sql
-- New tables in Trust Radar D1

-- Monitored brands (already partially exists as part of scan targets)
CREATE TABLE brand_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  domain TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  -- Official social handles
  official_handles TEXT, -- JSON: {"twitter": "@brand", "linkedin": "company/brand", ...}
  -- Brand assets for visual matching
  logo_url TEXT,
  brand_keywords TEXT, -- JSON array of brand terms to monitor
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Social platform monitoring results
CREATE TABLE social_monitor_results (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brand_profiles(id),
  platform TEXT NOT NULL, -- twitter, linkedin, instagram, tiktok, facebook, github, youtube
  check_type TEXT NOT NULL, -- 'handle_check' | 'impersonation_scan' | 'mention_scan'
  -- Handle availability
  handle_checked TEXT,
  handle_available INTEGER, -- 0 = taken, 1 = available, NULL = not checked
  handle_owner_matches_brand INTEGER, -- 0 = no (potential squatter), 1 = yes (official)
  -- Impersonation detection
  suspicious_account_url TEXT,
  suspicious_account_name TEXT,
  impersonation_score REAL, -- 0.0 to 1.0 confidence
  impersonation_signals TEXT, -- JSON array of detected signals
  -- AI assessment
  ai_assessment TEXT,
  severity TEXT, -- LOW | MEDIUM | HIGH | CRITICAL
  -- Status
  status TEXT DEFAULT 'open', -- open | investigating | resolved | false_positive
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Social monitoring schedule
CREATE TABLE social_monitor_schedule (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brand_profiles(id),
  platform TEXT NOT NULL,
  last_checked TEXT,
  next_check TEXT,
  check_interval_hours INTEGER DEFAULT 24,
  enabled INTEGER DEFAULT 1
);
```

#### Social Monitoring Pipeline

```
┌─────────────────────────────────────────────┐
│            Social Monitor Cron               │
│         (runs every 6 hours)                 │
└─────────────┬───────────────────────────────┘
              │
    ┌─────────▼──────────┐
    │  For each brand:    │
    │  1. Handle Check    │──→ Check if brand handles exist on each platform
    │  2. Impersonation   │──→ Search for accounts using brand name/logo
    │  3. Mention Scan    │──→ Check for brand mentions in suspicious context
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  AI Assessment      │
    │  (Analyst Agent)    │──→ Evaluate each finding for impersonation risk
    │                     │    Score confidence, identify signals, recommend action
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  Store + Alert      │
    │  - Save to D1       │
    │  - Notify if HIGH+  │
    └────────────────────┘
```

#### Platform-Specific Checks

Each platform requires a different approach since APIs vary. For MVP, use public web checks:

**Twitter/X:**
- Check if `twitter.com/{brand_handle}` exists
- Search for accounts with brand name in display name
- Look for verified status mismatch (brand name but not verified)

**LinkedIn:**
- Check company page existence at `linkedin.com/company/{brand}`
- Search for company pages with similar names

**Instagram:**
- Check if `instagram.com/{brand_handle}` exists
- Username enumeration for close variants

**TikTok:**
- Check `tiktok.com/@{brand_handle}`
- Search for accounts using brand name

**GitHub:**
- Check `github.com/{brand}` and `github.com/orgs/{brand}`
- Look for repos impersonating brand tools/SDKs

**YouTube:**
- Channel name search for brand impersonation

#### Impersonation Signals (for AI Assessment)

The Analyst agent should evaluate found accounts against these signals:

```typescript
interface ImpersonationSignals {
  name_similarity: number;        // Levenshtein distance to brand name
  uses_brand_logo: boolean;       // Visual similarity check (future: image comparison)
  uses_brand_keywords: boolean;   // Bio/description contains brand terms
  account_age_days: number;       // Newer accounts are more suspicious
  follower_count: number;         // Very low followers + brand name = suspicious
  posts_about_brand: boolean;     // Content references the brand
  links_to_brand_domain: boolean; // Links to official domain (less suspicious) or phishing domain
  verified: boolean;              // Verified accounts are less likely impersonators
  location_mismatch: boolean;     // Account location doesn't match brand HQ
}
```

### 4.4 Implementation Strategy

Social brand monitoring is built as **new code** within the Trust Radar Worker. No code is copied or adapted from imprsn8.

1. **Create** D1 migration for `brand_profiles`, `social_monitor_results`, `social_monitor_schedule` tables
2. **Build** brand profile CRUD endpoints (`/api/brands`, `/api/brands/:id/handles`)
3. **Build** platform-specific checkers (new implementations for each platform)
4. **Build** impersonation signal detection and scoring
5. **Wire** Analyst agent integration for social threat assessment
6. **Create** social monitoring cron (6-hour interval for Professional, 1-hour for Enterprise)
7. **Wire** into the unified alerts pipeline

### 4.5 API Endpoints (New for Trust Radar)

```
POST   /api/brands                          → Create monitored brand
GET    /api/brands                          → List monitored brands
PATCH  /api/brands/:id                      → Update brand (handles, keywords)
DELETE /api/brands/:id                      → Remove brand

GET    /api/social/monitor                  → Social monitoring overview (all brands)
GET    /api/social/monitor/:brand_id        → Social monitoring for specific brand
GET    /api/social/alerts                   → Active impersonation alerts
PATCH  /api/social/alerts/:id               → Update alert status (resolve, false_positive)
POST   /api/social/scan/:brand_id           → Trigger immediate social scan
GET    /api/social/platforms/:brand_id      → Platform-by-platform status
```

---

## 5. FEATURE ROADMAP — CONSOLIDATED

This section consolidates all existing plan documents and queued work into a single prioritized roadmap.

### Phase 0: Foundation Fixes (CURRENT — Do First)

These are blocking issues from existing plans that must be resolved before new features.

#### 0a. Domain Migration (trustradar.ca)
- [ ] Run code migration: CSP headers, OAuth redirect URI, CORS origins → trustradar.ca
- [ ] Update Google Cloud Console OAuth credentials
- [ ] Set up `lrxradar.com → trustradar.ca` 301 redirects
- [ ] Update all hardcoded domain references in codebase
- [ ] Verify custom domain is active on the Worker
- **Reference:** Domain migration Claude Code prompt (already prepared)

#### 0b. CF Scanner False Positive Fix
- [ ] Confirm `backfill-safe-domains` route is live, then hit the endpoint
- [ ] Run migration 0017 SQL in D1 Console
- [ ] Clean false positives on Apple, Google, Amazon, Microsoft, and other major domains
- [ ] Fix CSP inline script/event handler blocking issue
- **Reference:** Known fix sequence from scanner pipeline work

#### 0c. Stack Cleanup
- [ ] Remove "OpenAI GPT-4o-mini" references — replace with "Claude Haiku (Anthropic)"
- [ ] Remove or archive FastAPI/Railway references if packages/api is deprecated
- [ ] Clean up any stale Alembic/Python migration files

### Phase 1: Public Identity & Free Scan Tool (HIGH PRIORITY)

This is the highest-impact work. Gets Trust Radar positioned correctly and creates the organic acquisition loop.

#### 1a. Repository Documentation Overhaul
- [ ] Rewrite README.md (see Section 3.1)
- [ ] Update PLATFORM_DESIGN_BRIEF.md
- [ ] Create docs/ directory with architecture, agent, and API documentation
- [ ] Remove imprsn8 from Trust Radar-facing docs

#### 1b. Landing Page Build
- [ ] Implement hero section with radar sweep animation
- [ ] Build feature sections (4 blocks)
- [ ] Build pricing section
- [ ] Implement "How It Works" section
- [ ] Build footer with proper links
- [ ] Mobile responsive throughout
- **Design system:** JetBrains Mono / Inter, navy/cyan palette (see Section 7)
- **Anti-patterns:** No generic gradients, no stock imagery, no startup template aesthetics

#### 1c. Free Brand Exposure Report (/scan)
- [ ] Build public scan input page
- [ ] Implement `/api/scan/report` endpoint:
  - Email security scan (existing engine)
  - Threat feed check (existing pipeline)
  - Lookalike domain generation (NEW — dnstwist-style permutations via Worker)
  - Social handle availability check (NEW — basic username enumeration)
  - AI assessment via Analyst agent (existing agent, new prompt template)
- [ ] Build report output page (shareable, beautiful single-page result)
- [ ] Add KV caching for scan results (24hr per domain)
- [ ] Rate limiting (5/hr unauthenticated, unlimited authenticated)
- [ ] "Share Report" functionality (shareable URL with scan ID)

#### 1d. Stats API for Social Proof
- [ ] Create `/api/stats/public` endpoint returning aggregate platform stats
- [ ] Wire into landing page social proof bar

### Phase 2: Email Security Engine Improvements (QUEUED)

From existing EMAIL_SIGNAL_DATA_STRATEGY.md and previous plans:

#### 2a. DKIM Selector Expansion
- [ ] Add enterprise selectors: proofpoint, s1024, s2048, sc1, pphosted, pps, mimecast20190104, mc1, pps
- [ ] Scoring adjustment: partial DKIM credit when MX records indicate known enterprise email security providers

#### 2b. Platform Integration
- [ ] Public domain submission calls email security scan in parallel with threat assessment
- [ ] Analyst agent factors `email_security_grade` into brand risk (F/D grade + active phishing = escalate to CRITICAL)
- [ ] Observer daily briefing includes email security stats
- [ ] Notifications for grade changes
- **Reference:** Claude Code prompts already prepared for these

### Phase 3: Social Brand Monitoring (NEW BUILD)

#### 3a. Data Model & Migration
- [ ] Create D1 migration for `brand_profiles`, `social_monitor_results`, `social_monitor_schedule` tables
- [ ] Implement brand profile CRUD endpoints

#### 3b. Social Monitoring Pipeline
- [ ] Implement platform-specific handle checking (Twitter, LinkedIn, Instagram, TikTok, GitHub, YouTube)
- [ ] Implement username permutation generation (similar to lookalike domains but for handles)
- [ ] Implement impersonation signal detection
- [ ] Wire Analyst agent for social threat assessment
- [ ] Create social monitoring cron (6-hour interval)

#### 3c. Social Monitoring UI
- [ ] Platform status grid view
- [ ] Impersonation alert cards
- [ ] Handle reservation status
- [ ] Alert management (resolve, false_positive)

### Phase 4: Advanced Threat Detection

#### 4a. Certificate Transparency Monitoring
- [ ] Integrate CT log polling (crt.sh API or Certstream)
- [ ] Match new certificates against monitored brand names
- [ ] Alert on suspicious certificate issuances
- [ ] Wire into Analyst agent for assessment

#### 4b. Lookalike Domain Continuous Monitoring
- [ ] Generate permutations on brand registration (typosquat, homoglyph, TLD variants)
- [ ] Store permutations in D1
- [ ] Periodic checks: DNS resolution, WHOIS lookup, hosting content check
- [ ] Analyst agent evaluates each active lookalike

#### 4c. STIX 2.1 Export
- [ ] Implement STIX 2.1 serialization for threat data
- [ ] Export endpoint: `GET /api/export/stix?brand_id=X&format=json`
- [ ] Bundle format for SIEM consumption

### Phase 5: AI Threat Narratives

#### 5a. Threat Narrative Generation
- [ ] Design narrative prompt template for Analyst agent
- [ ] Generate narratives that connect multiple signals into coherent attack stories
- [ ] Store narratives in D1 linked to threat clusters
- [ ] Render in dashboard Reports view

#### 5b. Observer Briefing Enhancement
- [ ] Include social monitoring data in daily briefings
- [ ] Include email security changes
- [ ] Include new CT log findings
- [ ] Include lookalike domain status changes

### Phase 6: Spam Trap & DMARC (EXISTING PLAN — PAUSED)

From existing decisions (locked):
- [ ] Single multi-domain Worker for honeypots (route by hostname)
- [ ] Moderate seeding pace (20-30/week)
- [ ] Keep email bodies forever for AI training
- [ ] Build AI phishing detection in parallel from Step 2
- [ ] Contact page trap implementation
- **Reference:** Claude Code prompt ready for Steps 1-2

### Phase 7: Revenue & Intelligence

#### 7a. Threat Intel Integration
- [ ] HIBP domain search with stealer log access (~$30-50/month)
- [ ] Telegram channel monitoring for public credential dump channels

#### 7b. Analyst Agent Enhancement
- [ ] Receive raw individual `threat_signals` rows alongside aggregated BrandThreatAssessment
- [ ] Reason about specific feed details (e.g., "sender IP hosts 3 PhishTank phishing pages")

#### 7c. Sales AI Agent
- [ ] Mine platform data for high-value prospects (low trust scores, active attacks, poor email security)
- [ ] Research company/CISO/security team
- [ ] Generate personalized outreach
- [ ] Cross-agent collaboration with Analyst + Observer
- [ ] Leads table in platform
- **Reference:** SALES_AGENT_ARCHITECTURE.md

### Phase 8: Multi-Tenant & Enterprise (EXISTING PLAN)

From TRUST_RADAR_TENANT_ARCHITECTURE.md:
- Phase A: Tenant model + invite onboarding
- Phase B: Dashboard + HITL
- Phase C: Takedowns + monitoring rules
- Phase D: Team + webhooks/SIEM
- Phase E: SSO (SAML/OIDC)
- Phase F: Self-serve signup
- Data isolation via org_id in JWT
- Future: MCP server (after Phase B), SCIM provisioning (after Phase E)

### Phase 9: AI-Generated Threat Detection (DIFFERENTIATOR)

- [ ] Train on spam trap email corpus
- [ ] Detect AI-generated email content patterns
- [ ] Detect AI-crafted phishing page characteristics
- [ ] Detect AI-driven attack pattern evolution
- [ ] Position publicly: "Trust Radar detects AI-generated threats that traditional signature-based tools miss"

---

## 6. ARCHITECTURE REFERENCE

### Current Architecture (as-built)

```
Monorepo (Turborepo + pnpm)
├── packages/
│   ├── trust-radar/         → Cloudflare Worker (TypeScript) + D1
│   │   ├── src/
│   │   │   ├── routes/      → API route handlers
│   │   │   ├── agents/      → AI agent definitions (Analyst, Observer)
│   │   │   ├── scanners/    → CF Scanner pipeline, email security engine
│   │   │   ├── feeds/       → Threat feed integrations
│   │   │   ├── middleware/   → Auth, rate limiting, CORS
│   │   │   └── ui/          → SPA frontend (HTML/CSS/JS served by Worker)
│   │   ├── migrations/      → D1 SQL migrations
│   │   └── wrangler.toml    → Worker configuration
│   │
│   ├── imprsn8/             → Cloudflare Worker (TypeScript) + D1
│   │   └── (separate product — personal brand intelligence)
│   │
│   └── api/                 → FastAPI on Railway (may be deprecated)
│
├── .github/workflows/       → GitHub Actions (path-filtered deploys)
├── turbo.json               → Turborepo config
├── pnpm-workspace.yaml      → Workspace definition
└── package.json             → Root scripts
```

### Target Architecture (after this plan)

```
Monorepo (Turborepo + pnpm)
├── packages/
│   ├── trust-radar/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── scan.ts          → Brand Exposure Report endpoint
│   │   │   │   ├── threats.ts       → Threat feed endpoints
│   │   │   │   ├── email-security.ts → Email posture endpoints
│   │   │   │   ├── social.ts        → Social monitoring endpoints (NEW)
│   │   │   │   ├── brands.ts        → Brand management endpoints (NEW)
│   │   │   │   ├── briefing.ts      → AI briefing endpoints
│   │   │   │   ├── export.ts        → STIX export endpoints (NEW)
│   │   │   │   └── stats.ts         → Public stats endpoint (NEW)
│   │   │   │
│   │   │   ├── agents/
│   │   │   │   ├── analyst.ts       → Threat analysis agent
│   │   │   │   ├── observer.ts      → Daily briefing agent
│   │   │   │   └── sales.ts         → Sales prospecting agent (planned)
│   │   │   │
│   │   │   ├── scanners/
│   │   │   │   ├── cf-scanner.ts    → Cloudflare threat scanner
│   │   │   │   ├── email-security.ts → Email posture engine
│   │   │   │   ├── social-monitor.ts → Social platform monitoring (NEW)
│   │   │   │   ├── ct-monitor.ts    → Certificate Transparency monitor (planned)
│   │   │   │   └── lookalike.ts     → Domain permutation generator (NEW)
│   │   │   │
│   │   │   ├── feeds/
│   │   │   │   ├── phishtank.ts
│   │   │   │   ├── urlhaus.ts
│   │   │   │   ├── openphish.ts
│   │   │   │   └── certstream.ts    → CT log feed (planned)
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── cors.ts
│   │   │   │
│   │   │   ├── ui/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── landing.ts       → Public landing page
│   │   │   │   │   ├── scan.ts          → Free scan tool
│   │   │   │   │   ├── features.ts      → Feature breakdown
│   │   │   │   │   ├── pricing.ts       → Pricing page
│   │   │   │   │   ├── login.ts         → Auth pages
│   │   │   │   │   └── dashboard/
│   │   │   │   │       ├── home.ts
│   │   │   │   │       ├── threats.ts
│   │   │   │   │       ├── email.ts
│   │   │   │   │       ├── social.ts    → Social monitoring view (NEW)
│   │   │   │   │       ├── reports.ts
│   │   │   │   │       └── settings.ts
│   │   │   │   │
│   │   │   │   ├── components/
│   │   │   │   │   ├── radar-animation.ts
│   │   │   │   │   ├── score-gauge.ts
│   │   │   │   │   ├── threat-card.ts
│   │   │   │   │   ├── email-report.ts
│   │   │   │   │   ├── social-grid.ts   (NEW)
│   │   │   │   │   └── narrative-card.ts
│   │   │   │   │
│   │   │   │   └── styles/
│   │   │   │       └── design-system.css
│   │   │   │
│   │   │   └── lib/
│   │   │       ├── scoring.ts       → Brand Exposure Score computation
│   │   │       ├── dns.ts           → DoH utilities
│   │   │       ├── dnstwist.ts      → Domain permutation generator (NEW)
│   │   │       ├── social-check.ts  → Platform username checks (NEW)
│   │   │       └── stix.ts          → STIX 2.1 serializer (planned)
│   │   │
│   │   ├── migrations/
│   │   │   ├── ...existing...
│   │   │   ├── 0018_brand_profiles.sql         (NEW)
│   │   │   ├── 0019_social_monitor.sql          (NEW)
│   │   │   └── 0020_social_monitor_schedule.sql (NEW)
│   │   │
│   │   └── wrangler.toml
│   │
│   └── imprsn8/              → INDEPENDENT PRODUCT (personal brand — do not touch)
│
├── docs/                      → NEW documentation directory
│   ├── ARCHITECTURE.md
│   ├── AI_AGENTS.md
│   ├── EMAIL_SECURITY_ENGINE.md
│   ├── SOCIAL_MONITORING.md
│   ├── THREAT_FEEDS.md
│   ├── API_REFERENCE.md
│   ├── DEPLOYMENT.md
│   └── CONTRIBUTING.md
│
├── .github/workflows/
├── README.md                  → REWRITTEN (product-focused)
├── PLATFORM_DESIGN_BRIEF.md   → UPDATED
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 7. DESIGN SYSTEM

### Trust Radar Visual Identity

**APPROVED DESIGN DIRECTION (March 20, 2026):**
- Light mode default with dark mode toggle
- Typography: Syne (display), DM Sans (body), IBM Plex Mono (data/code)
- Accent system: Teal primary, Coral secondary, Green success
- Corporate site for LRX Enterprise Inc.

```css
/* Trust Radar Design Tokens — APPROVED */
/* Light mode is default. Dark mode via [data-theme="dark"] */

:root {
  /* Typography */
  --tr-font-display: 'Syne', sans-serif;
  --tr-font-body: 'DM Sans', sans-serif;
  --tr-font-mono: 'IBM Plex Mono', monospace;

  /* Accent colors (consistent across themes) */
  --tr-accent: #0891b2;             /* Teal — primary action */
  --tr-accent-hover: #0e7490;
  --tr-accent-light: #06b6d4;
  --tr-accent-bg: rgba(8, 145, 178, 0.08);
  --tr-coral: #f97316;              /* Coral — secondary/warnings */
  --tr-coral-bg: rgba(249, 115, 22, 0.08);
  --tr-green: #10b981;              /* Green — success/safe */
  --tr-green-bg: rgba(16, 185, 129, 0.08);
  --tr-red: #ef4444;                /* Red — danger/critical */
  --tr-red-bg: rgba(239, 68, 68, 0.08);
  --tr-amber: #f59e0b;              /* Amber — caution */

  /* Radius */
  --tr-radius-sm: 6px;
  --tr-radius-md: 10px;
  --tr-radius-lg: 16px;
  --tr-radius-xl: 24px;
}

/* LIGHT THEME (default) */
[data-theme="light"] {
  --tr-bg-primary: #fafbfc;
  --tr-bg-secondary: #ffffff;
  --tr-bg-tertiary: #f1f5f9;
  --tr-bg-elevated: #ffffff;
  --tr-text-primary: #0f172a;
  --tr-text-secondary: #475569;
  --tr-text-tertiary: #94a3b8;
  --tr-border: #e2e8f0;
  --tr-border-strong: #cbd5e1;
  --tr-shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --tr-shadow-md: 0 4px 16px rgba(0,0,0,0.06);
  --tr-shadow-lg: 0 12px 40px rgba(0,0,0,0.08);
  --tr-shadow-glow: 0 0 40px rgba(8,145,178,0.12);
  --tr-nav-bg: rgba(250,251,252,0.85);
}

/* DARK THEME (toggle) */
[data-theme="dark"] {
  --tr-bg-primary: #0b1120;
  --tr-bg-secondary: #111827;
  --tr-bg-tertiary: #1a2332;
  --tr-bg-elevated: #1e293b;
  --tr-text-primary: #f1f5f9;
  --tr-text-secondary: #94a3b8;
  --tr-text-tertiary: #64748b;
  --tr-border: #1e293b;
  --tr-border-strong: #334155;
  --tr-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --tr-shadow-md: 0 4px 16px rgba(0,0,0,0.3);
  --tr-shadow-lg: 0 12px 40px rgba(0,0,0,0.4);
  --tr-shadow-glow: 0 0 60px rgba(8,145,178,0.15);
  --tr-nav-bg: rgba(11,17,32,0.85);
}
```

### Anti-Patterns Checklist

DO NOT:
- [ ] Use purple-to-blue gradient backgrounds
- [ ] Use Inter, Roboto, Arial, Space Grotesk, or other overused AI-output fonts
- [ ] Use rounded, bubbly UI elements (this is threat intelligence, not a todo app)
- [ ] Use stock photography or generic illustrations
- [ ] Use emoji in navigation or headers
- [ ] Use "hero with phone mockup" layout
- [ ] Use testimonial carousels with stock photos
- [ ] Use three-equal-column pricing table with checkmark lists
- [ ] Make text too dark/low-contrast on colored backgrounds

DO:
- [ ] Default to light mode (professional, accessible, corporate)
- [ ] Provide a proper dark mode toggle (stored in localStorage)
- [ ] Use Syne for headlines and display type — bold, geometric, distinctive
- [ ] Use DM Sans for body text — clean, readable, professional
- [ ] Use IBM Plex Mono for data, scores, code, and technical labels
- [ ] Use teal/coral/green accent system — each capability gets its own color
- [ ] Use SVG radar sweep as a brand motif (animated, not static)
- [ ] Use floating info cards around illustrations for context
- [ ] Use data visualization as decoration (not just in dashboards)
- [ ] Use severity colors consistently (green → amber → coral → red)
- [ ] Use subtle radial gradients in hero backgrounds for depth
- [ ] Keep text legible — secondary text should be #475569 (light) / #94a3b8 (dark), never darker

---

## 8. EXECUTION ORDER

### For Claude Code — Execute in This Order

```
STEP 1: Foundation Fixes
  └─ Phase 0a: Domain migration (trustradar.ca)
  └─ Phase 0b: CF Scanner false positive fix
  └─ Phase 0c: Stack cleanup (references, dead code)

STEP 2: Documentation
  └─ Phase 3.1: Rewrite README.md
  └─ Phase 3.2: Update PLATFORM_DESIGN_BRIEF.md
  └─ Phase 3.3: Create docs/ directory with all spec docs
  └─ Phase 3.4: Clean up stale references

STEP 3: Landing Page
  └─ Phase 1b: Build complete landing page
  └─ Phase 1d: Stats API for social proof

STEP 4: Free Brand Exposure Report
  └─ Phase 1c: Build scan page + report generation
  └─ Wire email security engine into report
  └─ Wire threat feed check into report
  └─ Build lookalike domain generator
  └─ Build social handle checker
  └─ Build report rendering page

STEP 5: Social Brand Monitoring
  └─ Phase 3a: D1 migrations for social monitoring tables
  └─ Phase 3b: Social monitoring pipeline (NEW CODE — not from imprsn8)
  └─ Phase 3c: Social monitoring UI in dashboard

STEP 6: Email Security Improvements
  └─ Phase 2a: DKIM selector expansion
  └─ Phase 2b: Platform integration

STEP 7: Advanced Detection
  └─ Phase 4a: CT monitoring
  └─ Phase 4b: Lookalike domain continuous monitoring
  └─ Phase 4c: STIX 2.1 export

STEP 8: AI Narratives
  └─ Phase 5a: Threat narrative generation
  └─ Phase 5b: Observer briefing enhancement

STEP 9+: Later phases (spam trap, multi-tenant, AI detection, sales agent)
```

### Claude Code Session Strategy

Given mobile-first workflow, each step should be a self-contained Claude Code session that:
1. Reads this plan document first
2. Checks current codebase state
3. Implements one complete step
4. Tests locally (where possible)
5. Commits with descriptive message
6. Deploys if the step is deployment-ready

### Commit Message Convention

```
feat(site): implement landing page with radar animation
feat(scan): add free Brand Exposure Report endpoint
feat(social): add social brand monitoring pipeline
feat(docs): rewrite README with product positioning
fix(scanner): resolve false positive issue with safe domains
chore(cleanup): remove OpenAI references, update to Claude Haiku
```

---

## APPENDIX A: Existing Plan Documents (Cross-Reference)

These existing documents in the repo should be considered supplementary to this unified plan:

| Document | Status | Relation to This Plan |
|----------|--------|----------------------|
| `TRUST_RADAR_BRAND_HANDLES_AND_BACKEND_ASSESSMENT.md` | **Active** | Brand handle integration spec + backend overlap audit |
| `trustradar-corporate-site.html` | **Active — Approved** | Corporate site prototype (light/dark, LRX Enterprise) |
| `PLATFORM_DESIGN_BRIEF.md` | Needs update | Section 7 supersedes design tokens |
| `TRUST_RADAR_COMMAND_CENTER_BUILD_PLAN.md` | Active | Dashboard specs (Phase 1b dashboard) |
| `TRUST_RADAR_PIPELINE_OVERHAUL_PLAN.md` | Active | Feed integrations (Phase 4) |
| `EMAIL_SIGNAL_DATA_STRATEGY.md` | Active | Email engine roadmap (Phase 2) |
| `TRUST_RADAR_TENANT_ARCHITECTURE.md` | Queued | Multi-tenant (Phase 8) |
| `SALES_AGENT_ARCHITECTURE.md` | Queued | Sales agent (Phase 7c) |
| `PLATFORM_UPLEVEL_PLAN_MARCH.md` | Partially superseded | Dashboard specs, some still relevant |

---

## APPENDIX B: Pricing Model Rationale

**REVISED (March 20, 2026)** — Previous $49/$149 pricing was too low given feed subscription costs.

| Tier | Price | Cost Basis | Margin Notes |
|------|-------|-----------|-------------|
| Scan (Free) | $0 | ~$0.002/scan (Haiku API call + DNS lookups). Budget 1000 free scans/month = ~$2 | Acquisition tool |
| Professional | $299/mo | HIBP API ($30-50/mo) + social monitoring API access ($20-40/mo) + AI inference (~$15-25/mo per brand) + infrastructure (~$5/mo) = ~$70-120/mo per customer | ~60-75% margin |
| Business | $799/mo | Up to 10 brands. Feed costs shared across brands. AI inference scales (~$50-80/mo). CT monitoring + STIX export = minimal marginal cost | ~75-85% margin |
| Enterprise | Custom (min $2,000/mo) | Multi-tenant overhead, SSO, SLA, dedicated support, custom agent tuning | ~80%+ margin |

**Feed subscription costs that drive the pricing floor:**
- HIBP domain search + stealer log access: ~$30-50/month
- Social media monitoring API access (varies by platform): ~$20-100/month
- Future: Telegram channel monitoring, additional threat feeds: ~$20-50/month
- Total feed baseline: ~$70-200/month before any AI inference costs

**Why $299/mo Professional (not $49):**
At $49/month, a single customer's feed subscription costs would consume the entire revenue. $299/month provides sustainable margin even with growing feed costs while remaining radically cheaper than every competitor in the space.

Competitor pricing for reference:
- BrandShield: ~$36K-$100K+/year ($3K-$8K/mo)
- ZeroFox: ~$30K-$80K+/year ($2.5K-$6.7K/mo)
- Bolster: ~$24K-$60K+/year ($2K-$5K/mo)
- Red Points: ~$20K-$50K+/year ($1.7K-$4.2K/mo)

Trust Radar at $299-$799/month is 3-10x cheaper than the cheapest enterprise competitor while delivering comparable intelligence via AI agents instead of human analyst teams.

---

## APPENDIX C: Domain Permutation Algorithm (for Lookalike Detection)

```typescript
// Implement in packages/trust-radar/src/lib/dnstwist.ts
// Based on dnstwist methodology, adapted for Cloudflare Worker runtime

interface DomainPermutation {
  domain: string;
  type: 'typosquat' | 'homoglyph' | 'tld_swap' | 'hyphenation' | 'vowel_swap' | 'bit_flip' | 'subdomain';
  registered: boolean;      // checked via DNS resolution
  resolves_to?: string;     // IP if registered
  has_mx?: boolean;         // Has mail servers (suggests email capability)
  has_web?: boolean;        // Responds on port 80/443
}

function generatePermutations(domain: string): string[] {
  const [name, tld] = splitDomain(domain);
  const permutations: string[] = [];

  // 1. Character omission: "trustradar" → "trustadar", "trsradar", etc.
  for (let i = 0; i < name.length; i++) {
    permutations.push(name.slice(0, i) + name.slice(i + 1) + '.' + tld);
  }

  // 2. Adjacent character swap: "trustradar" → "rtusradar", "tursradar", etc.
  for (let i = 0; i < name.length - 1; i++) {
    const arr = name.split('');
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    permutations.push(arr.join('') + '.' + tld);
  }

  // 3. Adjacent character replacement (QWERTY proximity)
  const qwerty: Record<string, string[]> = {
    'a': ['q', 'w', 's', 'z'], 'b': ['v', 'g', 'h', 'n'],
    'c': ['x', 'd', 'f', 'v'], 'd': ['s', 'e', 'r', 'f', 'c', 'x'],
    // ... full QWERTY map
  };

  // 4. Homoglyph substitution
  const homoglyphs: Record<string, string[]> = {
    'a': ['à', 'á', 'â', 'ã', 'ä', 'å', 'ɑ', 'а'],
    'e': ['è', 'é', 'ê', 'ë', 'ē', 'е'],
    'i': ['ì', 'í', 'î', 'ï', 'ı', 'і'],
    'o': ['ò', 'ó', 'ô', 'õ', 'ö', 'о', '0'],
    'l': ['1', '|', 'ℓ', 'ⅼ'],
    // ... full homoglyph map
  };

  // 5. TLD swap: .com → .net, .org, .co, .ca, .io, .app, etc.
  const tlds = ['com', 'net', 'org', 'co', 'ca', 'io', 'app', 'dev', 'xyz', 'info', 'biz'];

  // 6. Hyphenation: "trustradar" → "trust-radar", "trust-radar.com"

  // 7. Subdomain tricks: "trust.radar.com", "trustradar.login.com"

  // 8. Keyword additions: "trustradar-login", "trustradar-support", "trustradar-secure"
  const keywords = ['login', 'secure', 'support', 'portal', 'account', 'verify', 'auth'];

  return [...new Set(permutations)]; // deduplicate
}

// Check registration via Cloudflare DoH
async function checkDomainRegistration(domain: string): Promise<boolean> {
  const resp = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
    { headers: { 'Accept': 'application/dns-json' } }
  );
  const data = await resp.json();
  return data.Answer && data.Answer.length > 0;
}
```

---

*End of Unified Platform Plan. This document should be committed to the repository root and referenced by all Claude Code sessions working on Trust Radar.*
