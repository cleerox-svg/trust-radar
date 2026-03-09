# Trust Radar Platform — Complete Refactoring Plan

> **Objective:** Transform the current Trust Radar frontend and backend from a basic URL scanner into a full Trust Intelligence Platform matching the capabilities of radar-watch-guard, with a unique advanced UI inspired by IMPRSN8_DESIGN_SPEC_V2 principles.
>
> **Scope:** `packages/trust-radar` (backend) + `packages/frontend/radar` (frontend). imprsn8 is out of scope.

---

## Current State Assessment

### What exists today (trust-radar)
- **Backend:** Cloudflare Worker with D1 — basic URL scanning, signals, alerts, admin user management
- **Database:** 4 tables (users, scans, signals, signal_alerts) + domain_cache, api_keys
- **Frontend:** React SPA with ~12 pages — Dashboard, URL Scanner, History, Signals, Alerts, Entities, Trends, Geo Map, Knowledge Base, AI Advisor, Send Signals, Admin
- **UI:** Basic dark theme with cyan accent, minimal components, hand-drawn SVG icons

### What radar-watch-guard has (target capabilities)
- **30+ database tables** covering threats, intelligence feeds, investigations, agents, access control
- **24+ intelligence feed ingestion functions** (ThreatFox, CISA KEV, VirusTotal, etc.)
- **15+ AI agent edge functions** (Triage, Hunt, Campaign, Trust Monitor, Evidence, Takedown, etc.)
- **Rich frontend modules:** Threat Map, Brand Exposure, Correlation Matrix, Investigations, Takedowns, Daily Briefing, TrustBot chat, Cloud Status, Dark Web, ATO, Email Auth, Feed Analytics, Agent Hub, Admin with RBAC
- **Supabase backend** with RLS, Edge Functions, Realtime

### Gap Analysis
The trust-radar platform needs to go from ~6 core features to ~20+ modules, from 4 DB tables to 30+, and from 0 feeds/agents to 24+ feeds and 15+ agents. The UI needs to go from basic dark theme to "Editorial Intelligence" quality.

---

## Architecture Decision: Migration Path

Since trust-radar currently runs on **Cloudflare Workers + D1** and radar-watch-guard runs on **Supabase**, we need to decide our approach:

**Recommended:** Keep Cloudflare Workers + D1 for the trust-radar backend (it's already deployed at lrxradar.com) but port the Supabase Edge Function logic into Cloudflare Worker handlers + scheduled workers (via Cron Triggers). This avoids a full infrastructure migration while gaining all the functionality.

---

## Phase 1: Foundation — Design System & UI Framework (Sessions 1-3)

### 1.1 Trust Radar Design System
Create a unique design system inspired by IMPRSN8_DESIGN_SPEC_V2 but distinctly Trust Radar:
- **Color palette:** Deep navy/teal base (not purple) — `#0A0E1A` base, cyan-teal primary (`#06B6D4`), amber alerts, red threats
- **Typography:** Geist (body) + Geist Mono (data) + Clash Display (headlines) — same quality fonts from the design spec
- **Surface system:** 5-level elevation (void → base → raised → overlay → float) with subtle teal undertone
- **4pt grid spacing** system from the design spec
- **Component library:** Port shadcn/ui components from radar-watch-guard, customize with Trust Radar theme
- **Score Ring component** — adapted from IMPRSN8 spec with teal/cyan color scoring

**Files to create/modify:**
- `packages/frontend/radar/src/index.css` — Complete design system overhaul
- `packages/frontend/radar/tailwind.config.js` — Token-based theme configuration
- `packages/frontend/radar/src/components/ui/` — shadcn/ui component library (card, badge, button, dialog, tabs, table, sheet, tooltip, etc.)

### 1.2 Layout Architecture
- **Sidebar redesign** — Match radar-watch-guard's 4-category navigation (Mission Control, Investigate, Agents & Automation, Intelligence Feeds, Platform)
- **AppShell** — Top bar with connected status, user info, theme toggle
- **Mobile responsive** — Drawer sidebar with backdrop blur, bottom tab bar consideration
- **URL-based tab state** — `useSearchParams` for sub-tab navigation

### 1.3 Theme System
- Dark mode (default) + Light mode toggle
- CSS custom properties for all tokens
- ThemeProvider context component

---

## Phase 2: Database Schema Expansion (Sessions 3-5)

### 2.1 Core Threat Intelligence Tables
Port from radar-watch-guard's schema to D1 SQL:

```
threats                    — Primary threat database (phishing, malware, impersonation)
threat_news                — CVE advisories and vulnerability data
threat_briefings           — AI-generated intelligence briefings
social_iocs                — Community-sourced IOCs from social media
breach_checks              — Email/domain breach exposure
ato_events                 — Account takeover detection
tor_exit_nodes             — Tor exit node IPs
spam_trap_hits             — Honeypot email captures
email_auth_reports         — SPF/DKIM/DMARC reports
cloud_incidents            — CSP/SaaS outage tracking
attack_metrics             — Aggregated attack statistics
```

### 2.2 Investigation & Response Tables
```
investigation_tickets      — Case management with LRX-XXXXX IDs
erasure_actions            — Takedown tracking
evidence_captures          — Forensic evidence
campaign_clusters          — Grouped threat campaigns
abuse_mailbox              — Phishing email triage
```

### 2.3 Agent & Automation Tables
```
agent_runs                 — AI agent execution logs
agent_approvals            — HITL approval queue
feed_ingestions            — Feed run result logging
feed_schedules             — Feed configuration (24 feeds)
ingestion_jobs             — Batch job tracking
```

### 2.4 Access Control Tables
```
profiles                   — Extended user profiles
user_roles                 — Role assignments (admin, analyst, customer)
access_groups              — Named permission groups
user_group_assignments     — User-to-group mappings
group_module_permissions   — Module access per group
session_events             — Login/logout audit trail
scan_leads                 — Landing page form submissions
trust_score_history        — Brand trust score tracking
```

**Estimated migrations:** 0004 through 0015 (~12 new migration files)

---

## Phase 3: Intelligence Feed System (Sessions 5-8)

### 3.1 Feed Ingestion Infrastructure
Build the feed ingestion system as Cloudflare Worker Cron Triggers:

**Tier 1 — Core Threat Intelligence (every 15-30 min):**
- ThreatFox (abuse.ch) — IOCs
- Feodo Tracker (abuse.ch) — Botnet C2
- PhishTank Community — Phishing URLs

**Tier 2 — Vulnerability & Malware (every 30 min - 6 hrs):**
- CISA KEV — Known Exploited Vulnerabilities
- SSL Blocklist (abuse.ch) — Malicious SSL certs
- MalBazaar (abuse.ch) — Malware hashes

**Tier 3 — Situational Awareness (hourly - 6 hrs):**
- SANS ISC — Top attacking IPs
- Ransomwatch — Ransomware leak sites
- Tor Exit Nodes — Active exit nodes
- IPsum — Reputation-scored IPs
- Spamhaus DROP — Don't Route lists
- Blocklist.de — Attack source IPs

**Tier 4 — Social/Community (every 30 min):**
- TweetFeed — IOCs from X/Twitter
- Mastodon — IOCs from fediverse

**Tier 5 — API-Gated (rate-limited):**
- AbuseIPDB — IP reputation
- VirusTotal — URL/file analysis
- IPQualityScore — Fraud scoring

**Tier 6 — Infrastructure Monitoring (15 min - 1 hr):**
- CertStream — New SSL registrations
- Google Safe Browsing — Malicious URLs
- Cloud Status — CSP/SaaS outages
- Cloudflare Radar — DDoS/outages
- BGPStream — BGP anomalies
- GreyNoise — Internet noise IPs
- OTX Pulses — AlienVault community

### 3.2 Feed Coordinator
Central orchestrator that dispatches feeds with tiered priority, circuit-breaker logic, and deduplication.

### 3.3 Feed Management UI
- Feed schedule dashboard (enable/disable, intervals, status)
- Feed analytics (pull counts, threats found, error tracking)
- Manual trigger buttons
- API key configuration

**Files to create:**
- `packages/trust-radar/src/handlers/feeds.ts`
- `packages/trust-radar/src/lib/feedRunner.ts`
- `packages/trust-radar/src/feeds/` — Individual feed ingestion modules (24 files)
- `packages/frontend/radar/src/pages/FeedAnalyticsPage.tsx`

---

## Phase 4: AI Agent System (Sessions 8-11)

### 4.1 Trust Radar Agent Framework
Build the AI agent execution framework:

**Trust Radar Agents:**
| Agent | Function | Trigger |
|-------|----------|---------|
| **Triage** | Auto-score and prioritize threats | Always On |
| **Threat Hunt** | Correlate across feeds, find campaigns | Every 6 hours |
| **Impersonation Detector** | Lookalike domains, homoglyphs | Event-driven |
| **Takedown Orchestrator** | Draft abuse notices | On demand (HITL) |
| **Evidence Preservation** | Forensic snapshots | Auto on critical |
| **Abuse Mailbox** | Email report triage | Always On |
| **Campaign Correlator** | Cluster threats by infrastructure | Every 6 hours |
| **Trust Score Monitor** | Brand trust scoring | Continuous |
| **Executive Intel** | C-suite briefings | Daily |
| **TrustBot/Copilot** | Interactive AI chat | User-initiated |

### 4.2 Agent Command Center UI
- Agent grid with status, recent runs, metrics
- HITL approval queue
- Run history with execution logs
- Manual trigger buttons
- Agent detail slide-in panel

### 4.3 TrustBot Chat Interface
- Streaming AI chat with database context injection
- Markdown-formatted responses
- Context: threats, advisories, ATO events, IOCs, breach data

**Files to create:**
- `packages/trust-radar/src/handlers/agents.ts`
- `packages/trust-radar/src/lib/agentRunner.ts`
- `packages/trust-radar/src/agents/` — Individual agent modules
- `packages/frontend/radar/src/pages/AgentHubPage.tsx`
- `packages/frontend/radar/src/pages/TrustBotPage.tsx`

---

## Phase 5: Core Dashboard Modules (Sessions 11-15)

### 5.1 Mission Control
- **Threat Map** — Interactive world map with severity-coded markers (react-simple-maps)
- **Brand Exposure Engine** — Attack surface overview, brand risk scoring
- **Critical Alerts** — Real-time high-severity feed with investigation ticket creation
- **Daily Briefing** — AI-generated threat briefing with streaming SSE, PDF export

### 5.2 Investigation Module
- **Signal Correlation** — Cross-reference panel across all data sources
- **Investigations** — Case management with LRX-XXXXX ticket IDs, status workflow
- **Takedown & Response** — Erasure orchestrator with provider tracking

### 5.3 Intelligence Feed Views
- **Social Intel** — Community IOCs with confidence scoring
- **Dark Web Monitor** — Breach/credential exposure
- **Account Takeover** — Suspicious login detection
- **Email Authentication** — SPF/DKIM/DMARC compliance
- **Cloud Status** — CSP/SaaS/Social platform status monitoring
- **Feed Analytics** — Dual-view KPI dashboard

### 5.4 Platform/Admin
- **Knowledge Base** — Searchable documentation
- **Admin Panel** — User management, RBAC, feed schedules, session audit
- **Leads Management** — Landing page form submissions

**Files to create/refactor:**
- Complete refactor of existing pages + 10+ new page components
- Shared UI components (ThreatBadge, ScoreRing, StatusDot, AgentCard, etc.)

---

## Phase 6: Landing Page & Public Features (Sessions 15-17)

### 6.1 Public Landing Page Redesign
Applying IMPRSN8_DESIGN_SPEC_V2 principles with Trust Radar identity:
- **Hero with Trust Score Scanner** — Live domain scanner on landing page
- **Live statistics ticker** — Real threat counts from database
- **Animated Threat Heatmap** — World map visualization
- **AI Agents showcase** — 10 Trust Guardian cards
- **How It Works** — 4-step visual flow (Measure → Monitor → Defend → Report)
- **HITL section** — "AI Proposes. Humans Decide."
- **Lead capture** — Request Briefing / Request Access forms

### 6.2 Public Domain Scanner
Standalone `/scanner` page for unauthenticated trust score assessment.

---

## Phase 7: Authentication & RBAC Enhancement (Sessions 17-18)

### 7.1 Role System
- 4 roles: admin, analyst, customer, influencer
- Role-based sidebar filtering
- Route guards with role checks
- Group-based access control (GBAC) for fine-grained module permissions

### 7.2 Session Security
- Idle timeout with warning dialog
- Session revocation (admin force-logout)
- Session event logging (login/logout audit trail)
- Invitation-based onboarding flow

---

## Phase 8: Advanced UI/UX Polish (Sessions 18-20)

### 8.1 Design Polish (from IMPRSN8_DESIGN_SPEC_V2)
- Score Ring component with arc animation (900ms cubic-bezier)
- Agent cards with signature colors, hover interactions, status indicators
- Threat badges with severity color system (no permanent pulse)
- Surface card variants (base, elevated, featured, threat)
- Micro-interactions on hover states (translateY, border transitions)
- Recharts data visualizations (area charts, no grid lines — Stripe/Mercury style)
- "One hero per screen" principle
- Tabular numbers (`font-variant-numeric: tabular-nums`) on all changing values
- Custom scrollbar styling

### 8.2 Interactive Features
- Agent Network visualization (D3 force graph)
- Threat simulation on landing page
- Correlation matrix visualization
- Brand risk radar/spider charts

### 8.3 Mobile Optimization
- Bottom tab bar on mobile (5 items max)
- Touch-friendly targets (44px minimum)
- Horizontal swipeable card stacks
- Smooth sidebar drawer with backdrop blur

---

## Task Breakdown (Pickup-Friendly Todo List)

### Foundation
- [ ] **TASK 01:** Install shadcn/ui, Geist fonts, Clash Display, Framer Motion, Recharts, react-simple-maps, TanStack Query
- [ ] **TASK 02:** Create Trust Radar design system (CSS custom properties, Tailwind tokens, color palette, typography scale)
- [ ] **TASK 03:** Build core UI component library (Card, Badge, Button, Dialog, Tabs, Table, Sheet, Tooltip, Input, Select, etc.)
- [ ] **TASK 04:** Build ThemeProvider (dark/light toggle) and theme system
- [ ] **TASK 05:** Redesign Sidebar with 4-category nav structure matching radar-watch-guard

### Database
- [ ] **TASK 06:** Create threat intelligence schema migrations (threats, threat_news, social_iocs, breach_checks, etc.)
- [ ] **TASK 07:** Create investigation & response schema migrations (investigation_tickets, erasure_actions, evidence_captures, campaign_clusters)
- [ ] **TASK 08:** Create agent & automation schema migrations (agent_runs, agent_approvals, feed_schedules, feed_ingestions)
- [ ] **TASK 09:** Create access control schema migrations (user_roles, access_groups, group_module_permissions, session_events)

### Backend API
- [ ] **TASK 10:** Build threat intelligence API handlers (CRUD for threats, threat_news, social_iocs, breach_checks, ATO, email auth)
- [ ] **TASK 11:** Build investigation API handlers (tickets, erasure actions, evidence, campaigns)
- [ ] **TASK 12:** Build agent API handlers (runs, approvals, manual triggers)
- [ ] **TASK 13:** Build feed management API handlers (schedules, ingestion logs, manual trigger)
- [ ] **TASK 14:** Build access control API handlers (roles, groups, permissions, session events)

### Intelligence Feeds
- [ ] **TASK 15:** Build feed runner infrastructure (coordinator, scheduler, circuit-breaker, dedup)
- [ ] **TASK 16:** Implement Tier 1 feeds (ThreatFox, Feodo, PhishTank)
- [ ] **TASK 17:** Implement Tier 2 feeds (CISA KEV, SSL Blocklist, MalBazaar)
- [ ] **TASK 18:** Implement Tier 3 feeds (SANS ISC, Ransomwatch, Tor Exits, IPsum, Spamhaus, Blocklist.de)
- [ ] **TASK 19:** Implement Tier 4-5 feeds (TweetFeed, Mastodon, AbuseIPDB, VirusTotal, IPQS)
- [ ] **TASK 20:** Implement Tier 6 feeds (CertStream, Google Safe Browsing, Cloud Status, Cloudflare Radar, BGPStream, GreyNoise, OTX)

### AI Agents
- [ ] **TASK 21:** Build agent runner framework (execution engine, logging, status tracking)
- [ ] **TASK 22:** Implement core agents (Triage, Threat Hunt, Campaign Correlator)
- [ ] **TASK 23:** Implement response agents (Takedown Orchestrator, Evidence Preservation, Abuse Mailbox)
- [ ] **TASK 24:** Implement monitoring agents (Trust Score Monitor, Impersonation Detector)
- [ ] **TASK 25:** Build TrustBot/Copilot (streaming AI chat with database context)
- [ ] **TASK 26:** Build Executive Intel agent (daily briefing generation)

### Frontend — Mission Control
- [ ] **TASK 27:** Build Threat Map page (interactive world map with real threat data)
- [ ] **TASK 28:** Build Brand Exposure Engine page (attack surface overview, risk scoring)
- [ ] **TASK 29:** Build Critical Alerts page (real-time severity feed, ticket creation)
- [ ] **TASK 30:** Build Daily Briefing page (AI briefing with streaming SSE, history, PDF export)

### Frontend — Investigation
- [ ] **TASK 31:** Build Signal Correlation page (cross-reference panel, correlation matrix)
- [ ] **TASK 32:** Build Investigations page (case management, LRX ticket IDs, status workflow)
- [ ] **TASK 33:** Build Takedown & Response page (erasure orchestrator, provider tracking)

### Frontend — Agents
- [ ] **TASK 34:** Build Agent Hub page (command center, status grid, HITL approval queue)
- [ ] **TASK 35:** Build TrustBot chat page (streaming chat UI with markdown rendering)

### Frontend — Intelligence Feeds
- [ ] **TASK 36:** Build Social Intel page (community IOCs, confidence scoring)
- [ ] **TASK 37:** Build Dark Web Monitor page (breach/credential exposure)
- [ ] **TASK 38:** Build Account Takeover page (suspicious login events)
- [ ] **TASK 39:** Build Email Authentication page (SPF/DKIM/DMARC compliance)
- [ ] **TASK 40:** Build Cloud Status page (CSP/SaaS/Social platform monitoring)
- [ ] **TASK 41:** Build Feed Analytics dashboard (dual-view KPIs)

### Frontend — Platform
- [ ] **TASK 42:** Build enhanced Admin Panel (users, roles, groups, permissions, feeds, sessions)
- [ ] **TASK 43:** Build Knowledge Base page (searchable docs, categorized articles)
- [ ] **TASK 44:** Build Leads Management page (form submissions from landing page)

### Landing Page
- [ ] **TASK 45:** Redesign public landing page (hero scanner, live stats, threat map, agents showcase, HITL section, lead capture)
- [ ] **TASK 46:** Build public domain scanner page

### Auth & Security
- [ ] **TASK 47:** Implement RBAC system (4 roles, route guards, sidebar filtering)
- [ ] **TASK 48:** Implement session security (idle timeout, revocation, audit logging)
- [ ] **TASK 49:** Build invitation flow (analyst + customer onboarding)

### Polish
- [ ] **TASK 50:** Advanced UI components (ScoreRing with animation, AgentCard with status, ThreatBadge)
- [ ] **TASK 51:** Data visualizations (Recharts area charts, D3 agent network graph)
- [ ] **TASK 52:** Mobile optimization (bottom tabs, touch targets, responsive layouts)
- [ ] **TASK 53:** Performance optimization (TanStack Query caching, lazy loading, code splitting)

---

## Color Specification — Trust Radar Unique Identity

```css
:root {
  /* ── BRAND TEAL/CYAN ────────────── */
  --cyan-50:  #ECFEFF;
  --cyan-100: #CFFAFE;
  --cyan-200: #A5F3FC;
  --cyan-300: #67E8F9;
  --cyan-400: #22D3EE;    /* PRIMARY ACCENT */
  --cyan-500: #06B6D4;    /* Interactive states */
  --cyan-600: #0891B2;

  /* ── INTELLIGENCE BLUE ──────────── */
  --blue-400: #60A5FA;
  --blue-500: #3B82F6;

  /* ── SURFACES (Dark Mode) ───────── */
  --surface-void:    #060A12;   /* Deepest background */
  --surface-base:    #0A0E1A;   /* Page background — navy with teal undertone */
  --surface-raised:  #111827;   /* Cards, panels */
  --surface-overlay: #1E293B;   /* Modals, dropdowns */
  --surface-float:   #334155;   /* Tooltips, popovers */

  /* ── THREAT SEVERITY ────────────── */
  --threat-critical: #EF4444;
  --threat-high:     #F97316;
  --threat-medium:   #EAB308;
  --threat-low:      #22C55E;

  /* ── TEXT ────────────────────────── */
  --text-primary:   #F1F5F9;
  --text-secondary: #94A3B8;
  --text-tertiary:  #64748B;

  /* ── BORDERS ────────────────────── */
  --border-subtle:   rgba(148, 163, 184, 0.08);
  --border-default:  rgba(148, 163, 184, 0.15);
  --border-cyan:     rgba(34, 211, 238, 0.25);
}
```

This gives Trust Radar a distinctly different identity from imprsn8's purple/gold theme — it's a **cyber-intelligence teal/navy** that signals security operations rather than creator protection.

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI** | shadcn/ui + Tailwind CSS + Framer Motion |
| **Charts** | Recharts + react-simple-maps + D3 (agent network) |
| **Data** | TanStack Query (React Query) |
| **Backend** | Cloudflare Workers (itty-router) |
| **Database** | Cloudflare D1 (SQLite) |
| **Cache** | Cloudflare KV |
| **AI** | OpenAI GPT-4o-mini via LRX API (packages/api) |
| **Fonts** | Geist + Geist Mono + Clash Display |
| **Deploy** | Cloudflare Pages + Workers |

---

*Document created: March 2026 · Trust Radar Refactoring Plan v1.0*
