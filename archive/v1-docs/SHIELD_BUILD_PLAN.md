# imprsn8 Shield — Build Plan
### Corporate Brand Health Monitoring & Protection Service

> **Version:** 1.0 — March 2026
> **Supersedes:** TRUST_RADAR_REFACTOR_PLAN.md (archived — content migrated here)
> **Service:** imprsn8 Shield (formerly Trust Radar)
> **Package:** `packages/trust-radar/` (backend) · `packages/frontend/radar/` (frontend)
> **Domain target:** `shield.imprsn8.com`
> **Previous domain:** `lrxradar.com` → redirect to shield.imprsn8.com (Phase 4)
> **Reference:** [PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md) · [PLATFORM_DESIGN_BRIEF.md](./PLATFORM_DESIGN_BRIEF.md) Part B

---

## Current State

| Layer | Status |
|-------|--------|
| **Backend** | Cloudflare Worker + D1 — basic URL scanning, signals, alerts, admin user mgmt |
| **Database** | 13 migrations — users, scans, signals, alerts, domain_cache, api_keys, admin, intel tables |
| **Frontend** | React SPA — 28 pages (many stubs), basic dark theme, limited components |
| **Design** | Navy/teal theme correct — component library needs depth |
| **Admin** | Basic — needs to match Guard's mature admin pattern |
| **Auth** | JWT working — RBAC partially implemented |
| **Feeds** | Scaffolding only — no live feed ingestion |
| **Agents** | Scaffolding only — no live agent execution |

---

## Build Objective

Transform imprsn8 Shield from a URL scanner with stubs into a **full corporate threat
intelligence and brand protection platform** — 20+ active modules, 24+ live intelligence
feeds, 10 AI agents, and a production-quality SOC-grade UI.

The design principles and component system are inspired by IMPRSN8_DESIGN_SPEC_V2 but
with Shield's distinct **cyber-intel teal/navy identity** — not Guard's purple/pink palette.

---

## Phase 1 — Foundation: Design System & UI Framework
*Priority: High · Estimated: Sessions 1–3*

### 1.1 Shield Design System
- CSS custom properties for all tokens (see PLATFORM_DESIGN_BRIEF.md §16)
- Tailwind config: `brand-cyan`, `brand-navy`, `surface-*` tokens
- 5-level surface elevation system (void → base → raised → overlay → float)
- Threat severity ladder tokens (shared with Guard)
- 4pt grid spacing system

**Files:**
- `packages/frontend/radar/src/index.css` — full design system overhaul
- `packages/frontend/radar/tailwind.config.js` — token-based theme

### 1.2 Core Component Library
Port and customise from Guard's mature component set:
- `Card` variants: base, elevated, featured, threat
- `Badge` / `ThreatBadge` — severity color system
- `Button` — primary (cyan), ghost, danger, icon
- `Dialog`, `Sheet`, `Tooltip`, `Tabs`, `Table`, `Select`, `Input`
- `ScoreRing` — teal accent, 900ms cubic-bezier arc animation
- `AgentCard` — Shield agent color scheme
- `StatusDot`, `Pulse` — animated status indicators
- `ThemeToggle` — dark/light

**Files:** `packages/frontend/radar/src/components/ui/`

### 1.3 Layout Architecture
- Sidebar: 4-category navigation (Mission Control / Investigate / Agents & Automation / Intelligence Feeds / Platform)
- AppShell: top bar with connection status, user info, theme toggle
- Mobile: drawer sidebar + backdrop blur, bottom tab bar (5 items max)
- URL-based tab state (`useSearchParams`)

### 1.4 Typography
Install Geist + Geist Mono + Clash Display fonts.

**Tasks:**
- [ ] **S-01** Install fonts, design tokens, Tailwind config
- [ ] **S-02** Build complete UI component library
- [ ] **S-03** Redesign sidebar and AppShell layout
- [ ] **S-04** ThemeProvider (dark/light)

---

## Phase 2 — Database Schema Expansion
*Priority: High · Estimated: Sessions 3–5*

### 2.1 Core Threat Intelligence Tables
```sql
threats                   -- Primary threat DB (phishing, malware, impersonation)
threat_news               -- CVE advisories and vulnerability data
threat_briefings          -- AI-generated intel briefings
social_iocs               -- Community-sourced IOCs
breach_checks             -- Email/domain breach exposure
ato_events                -- Account takeover detection
tor_exit_nodes            -- Tor exit node IPs
spam_trap_hits            -- Honeypot captures
email_auth_reports        -- SPF/DKIM/DMARC
cloud_incidents           -- CSP/SaaS outage tracking
attack_metrics            -- Aggregated attack stats
```

### 2.2 Investigation & Response Tables
```sql
investigation_tickets     -- LRX-XXXXX case management
erasure_actions           -- Takedown tracking
evidence_captures         -- Forensic evidence
campaign_clusters         -- Grouped threat campaigns
abuse_mailbox             -- Phishing email triage
```

### 2.3 Agent & Automation Tables
```sql
agent_runs                -- Execution logs
agent_approvals           -- HITL approval queue
feed_ingestions           -- Feed run result logging
feed_schedules            -- Feed config (24 feeds)
ingestion_jobs            -- Batch job tracking
```

### 2.4 Access Control Tables
```sql
profiles                  -- Extended user profiles
user_roles                -- Role assignments
access_groups             -- Named permission groups
user_group_assignments    -- User-to-group mappings
group_module_permissions  -- Module access per group
session_events            -- Login/logout audit trail
scan_leads                -- Landing page form submissions
trust_score_history       -- Brand trust score over time
```

**Tasks:**
- [ ] **S-05** Migrations: threat intelligence tables (0014–0016)
- [ ] **S-06** Migrations: investigation & response tables (0017–0018)
- [ ] **S-07** Migrations: agent & automation tables (0019–0020)
- [ ] **S-08** Migrations: access control tables (0021–0023)

---

## Phase 3 — Backend API Handlers
*Priority: High · Estimated: Sessions 5–8*

### 3.1 Threat Intelligence API
- `GET/POST /api/threats` — list, create, update threats
- `GET /api/threats/:id` — threat detail with full metadata
- `GET /api/breach-checks` — email/domain breach exposure
- `GET /api/ato-events` — account takeover events
- `GET /api/email-auth` — SPF/DKIM/DMARC reports
- `GET /api/cloud-status` — CSP/SaaS status

### 3.2 Investigation API
- `GET/POST /api/investigations` — list, create tickets
- `PATCH /api/investigations/:id` — update status, analyst notes
- `POST /api/investigations/:id/evidence` — attach evidence
- `GET/POST /api/takedowns` — list, create takedown requests
- `PATCH /api/takedowns/:id/authorise` — HITL authorisation (analyst+ only)

### 3.3 Agent API
- `GET /api/agents` — list agents with status
- `POST /api/agents/:id/run` — manual trigger
- `GET /api/agents/runs` — run history
- `GET /api/agents/approvals` — HITL queue
- `PATCH /api/agents/approvals/:id` — approve/reject

### 3.4 Feed Management API
- `GET /api/feeds` — list all feeds with status
- `POST /api/feeds/:id/run` — manual trigger
- `PATCH /api/feeds/:id` — update config, enable/disable
- `GET /api/feeds/ingestions` — ingestion log

### 3.5 Access Control API
- `GET/POST /api/users` — user management (admin only)
- `PATCH /api/users/:id/role` — role assignment
- `GET /api/sessions` — session audit log
- `POST /api/invites` — generate invite link (matching Guard pattern)

**Tasks:**
- [ ] **S-09** Build threat intelligence API handlers
- [ ] **S-10** Build investigation & takedown API handlers
- [ ] **S-11** Build agent API handlers
- [ ] **S-12** Build feed management API handlers
- [ ] **S-13** Build access control & RBAC API handlers (mirror Guard's mature pattern)

---

## Phase 4 — Intelligence Feed System
*Priority: High · Estimated: Sessions 8–12*

### 4.1 Feed Runner Infrastructure
- Feed coordinator (dispatch, scheduling, circuit-breaker, dedup)
- Cron trigger at `*/5 * * * *` (existing) — route by feed tier
- Rate limiting per API-gated feed
- Error logging → `feed_ingestions` table

### 4.2 Tier 1 — Core Threat Intel (every 15–30 min)
- [ ] **S-14** ThreatFox (abuse.ch) — IOCs
- [ ] **S-15** Feodo Tracker (abuse.ch) — Botnet C2
- [ ] **S-16** PhishTank Community — Phishing URLs

### 4.3 Tier 2 — Vulnerability & Malware (30 min – 6h)
- [ ] **S-17** CISA KEV — Known Exploited Vulnerabilities
- [ ] **S-18** SSL Blocklist (abuse.ch) — Malicious SSL certs
- [ ] **S-19** MalBazaar — Malware hashes

### 4.4 Tier 3 — Situational Awareness (hourly – 6h)
- [ ] **S-20** SANS ISC + Ransomwatch + Tor Exits + IPsum + Spamhaus DROP + Blocklist.de

### 4.5 Tier 4-5 — Social & API-Gated
- [ ] **S-21** TweetFeed · Mastodon · AbuseIPDB · VirusTotal · IPQS

### 4.6 Tier 6 — Infrastructure
- [ ] **S-22** CertStream · Google Safe Browsing · Cloud Status · Cloudflare Radar · BGPStream · GreyNoise · OTX

---

## Phase 5 — AI Agent System
*Priority: High · Estimated: Sessions 12–16*

### 5.1 Agent Framework
Agent execution engine: async Worker handlers triggered by cron or manual POST.
Logs to `agent_runs`. HITL items → `agent_approvals` queue.

### 5.2 Core Agents
- [ ] **S-23** TRIAGE — auto-score and prioritise new threats
- [ ] **S-24** HUNT — threat campaign correlation (every 6h)
- [ ] **S-25** GHOST — lookalike domain & homoglyph detection
- [ ] **S-26** NEXUS — cluster threats by infrastructure
- [ ] **S-27** PULSE — brand trust score monitoring + trend alerts

### 5.3 Response Agents
- [ ] **S-28** ARBITER — draft abuse notices (HITL-gated)
- [ ] **S-29** VAULT — forensic screenshot snapshots
- [ ] **S-30** INTAKE — abuse mailbox email triage

### 5.4 Reporting Agents
- [ ] **S-31** BRIEF — daily executive intelligence briefing (calls api.lrx.io)
- [ ] **S-32** BOT (TrustBot) — streaming AI chat with DB context, markdown rendering

---

## Phase 6 — Frontend Module Rebuild
*Priority: High · Estimated: Sessions 16–22*

All 28 existing pages need UI rebuilt with the Phase 1 component library and Shield design
tokens. Several are stubs and need full implementation.

### Mission Control
- [ ] **S-33** Dashboard — 4-metric strip, threat map, critical alerts, agent heartbeat
- [ ] **S-34** Threat Map — react-simple-maps, severity markers, click-to-investigate
- [ ] **S-35** Brand Exposure — attack surface overview, domain risk scoring
- [ ] **S-36** Daily Briefing — streaming SSE, history list, PDF export

### Investigate
- [ ] **S-37** Signal Correlation — cross-reference panel, correlation matrix
- [ ] **S-38** Investigations — LRX-XXXXX ticket management, status workflow
- [ ] **S-39** Takedown & Response — erasure orchestrator, provider tracking, HITL
- [ ] **S-40** Dark Web Monitor — breach/credential exposure view
- [ ] **S-41** Account Takeover — suspicious login events
- [ ] **S-42** Email Authentication — SPF/DKIM/DMARC compliance dashboard

### Agents & Automation
- [ ] **S-43** Agent Hub — command centre, status grid, HITL approval queue
- [ ] **S-44** TrustBot — streaming chat UI, markdown, DB context toggle
- [ ] **S-45** Feed Analytics — dual-view KPI dashboard (feed health + threat counts)

### Intelligence Feeds
- [ ] **S-46** Social Intel — community IOCs, confidence scoring
- [ ] **S-47** Cloud Status — CSP/SaaS/Social platform monitoring

### Platform
- [ ] **S-48** Admin Panel — users, roles, groups, feed schedules, session audit
- [ ] **S-49** Knowledge Base — searchable docs, category filter

---

## Phase 7 — Landing Page & Public Presence
*Priority: Medium · Estimated: Sessions 22–24*

### 7.1 Shield Public Page (`imprsn8.com/shield`)
- **Hero:** "Corporate threat intelligence, redefined" + live domain scanner
- **Live stats:** Threats detected · Feeds active · Domains monitored · Takedowns filed
- **Animated threat heatmap** — world map, live feed
- **Agent showcase** — 10 Shield Guardian cards (TRIAGE, HUNT, GHOST, etc.)
- **How It Works** — 4-step: Measure → Monitor → Defend → Report
- **HITL section** — "AI proposes. Analysts decide."
- **Lead capture** — Request Briefing form (→ `scan_leads` table)

### 7.2 Public Domain Scanner
Standalone `/scanner` at `shield.imprsn8.com/scanner` — unauthenticated trust score.

**Tasks:**
- [ ] **S-50** Build Shield public landing section (`imprsn8.com/shield`)
- [ ] **S-51** Build public domain scanner

---

## Phase 8 — Auth & Session Security
*Priority: Medium · Estimated: Sessions 24–25*

- [ ] **S-52** RBAC: 3 roles (admin, analyst, customer), route guards, sidebar filtering
- [ ] **S-53** Session security: idle timeout, force-logout, audit logging
- [ ] **S-54** Invitation flow — mirror Guard's invite token system
- [ ] **S-55** Redirect `lrxradar.com` → `shield.imprsn8.com`

---

## Phase 9 — Advanced UI Polish
*Priority: Medium · Estimated: Sessions 25–27*

- [ ] **S-56** ScoreRing with arc animation (900ms cubic-bezier)
- [ ] **S-57** D3 agent network force graph
- [ ] **S-58** Recharts area charts (no grid lines — Stripe/Mercury style)
- [ ] **S-59** Correlation matrix visualisation
- [ ] **S-60** Mobile optimisation — bottom tabs, touch targets, swipeable cards

---

## Task Summary

| Phase | Tasks | Key output |
|-------|-------|-----------|
| 1 — Design System | S-01 → S-04 | Component library, design tokens, layout |
| 2 — Database | S-05 → S-08 | 12 new migration files, 30+ tables |
| 3 — Backend API | S-09 → S-13 | All API handlers complete |
| 4 — Feeds | S-14 → S-22 | 24 live intelligence feeds |
| 5 — Agents | S-23 → S-32 | 10 live AI agents |
| 6 — Frontend | S-33 → S-49 | All 28 pages production-quality |
| 7 — Landing | S-50 → S-51 | Public Shield page + scanner |
| 8 — Auth | S-52 → S-55 | Full RBAC, sessions, redirect |
| 9 — Polish | S-56 → S-60 | Visualisations, mobile, animations |

**Total tasks: 60**

---

## Design Tokens Quick Reference

```css
/* Shield identity — different from Guard's purple */
--primary:    #22D3EE;   /* cyan-400 — all interactive elements */
--base:       #0A0E1A;   /* navy — page background */
--card:       #111827;   /* raised surface */
--font-body:  'Geist', sans-serif;
--font-mono:  'Geist Mono', monospace;
--font-display: 'Clash Display', sans-serif;
```

**Contrast check:** Guard uses `#8b5cf6` (violet-500) as primary. Shield uses `#22D3EE`
(cyan-400). They are visually distinct enough to immediately signal "different service"
to a user switching between them.

---

*Document: SHIELD_BUILD_PLAN.md · Version 1.0 · March 2026*
*Part of the imprsn8 platform — see PLATFORM_ARCHITECTURE.md for context*
