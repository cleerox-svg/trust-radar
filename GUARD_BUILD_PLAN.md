# imprsn8 Guard — Build Plan
### Social Media Monitoring & Personal Brand Protection Service

> **Version:** 1.0 — March 2026
> **Service:** imprsn8 Guard (the original imprsn8 core product)
> **Package:** `packages/imprsn8/` (backend) · `packages/frontend/imprsn8/` (frontend)
> **Domain:** `imprsn8.com` (root domain — Guard is the primary consumer-facing product)
> **Status:** Most mature service — in production polish phase
> **Reference:** [PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md) · [PLATFORM_DESIGN_BRIEF.md](./PLATFORM_DESIGN_BRIEF.md) Part A · [IMPRSN8_DESIGN_SPEC_V2.md](./IMPRSN8_DESIGN_SPEC_V2.md)

---

## Current State

Guard is the more mature of the two services. Use it as the reference implementation
when building Shield.

| Layer | Status | Notes |
|-------|--------|-------|
| **Backend** | Production-ready | 17 migrations, full handler set |
| **Database** | Complete | users, social_profiles, analyses, threats, takedowns, agents, feeds, campaigns, invites |
| **Auth** | Complete | JWT, RBAC (4 roles), invite tokens |
| **Admin** | Complete | Influencer mgmt, user table, platform stats, system health |
| **Frontend** | 11 pages — needs polish | Dashboard, Accounts, Threats, Takedowns, Agents, Brand Score, Settings, Admin |
| **Design** | Needs V2 spec applied | Current CSS pre-dates IMPRSN8_DESIGN_SPEC_V2 |
| **Agents** | 8 agents scaffolded | SENTINEL, RECON, VERITAS, NEXUS, ARBITER, WATCHDOG, PHANTOM, CIPHER_ECHO |
| **Feeds** | 0016 seeds defaults | Feed data model in place, ingestion logic needs build |
| **R2 Storage** | Configured | `imprsn8-assets` bucket for profile images |
| **Invites** | Complete | 0012 migration, invite token flow |
| **HITL** | Enforced | ARBITER gated, no autonomous takedown |

**DB Health bug:** The screenshot shows `Database Error — 0ms / SQLite version: unknown`.
This is the first fix in this plan (G-01).

---

## Build Objective

Polish Guard to production quality: fix the DB health check bug, apply the V2 design
spec fully, build out feed ingestion, complete agent execution, and build the public
Guard landing section at `imprsn8.com`.

Guard's mature patterns (admin, RBAC, invites, HITL) are the **reference implementation**
for Shield Phase 3 (backend API handlers).

---

## Phase 1 — Bug Fixes & Production Hardening
*Priority: Critical · Do these first*

### G-01 — Fix DB Health Check (The Screenshot Bug)
The admin Cloud Status page shows `Database (Cloudflare D1) — Error` with
`RESPONSE TIME: 0 ms` and `SQLITE VERSION: unknown`.

**Root cause investigation needed:**
- Check `packages/imprsn8/src/handlers/health.ts` — the health check handler
- The D1 query to get SQLite version is likely `SELECT sqlite_version()` — verify it's
  running against the correct binding
- `0 ms` response time with `unknown` version = the query is likely not executing at
  all (binding not found, or query result not being read correctly)
- Check `packages/imprsn8/wrangler.toml` — confirm `DB` binding is correctly set
- Check if `IMPRSN8_D1_DATABASE_ID` secret is set in the Cloudflare dashboard

**Fix tasks:**
- [ ] **G-01a** Read `packages/imprsn8/src/handlers/health.ts` and diagnose the failure
- [ ] **G-01b** Fix the health check query and response mapping
- [ ] **G-01c** Verify DB binding in wrangler.toml is `DB` (matching handler usage)
- [ ] **G-01d** Test locally with `wrangler dev`

### G-02 — Session Security
- [ ] **G-02** Idle timeout dialog (5 min warning → 10 min auto-logout)
- [ ] **G-02** Session event logging to `session_events` table
- [ ] **G-02** Admin force-logout (revoke JWT via KV blocklist)

### G-03 — Error Boundaries & Loading States
- [ ] **G-03** Add React error boundaries to all pages
- [ ] **G-03** Skeleton loading states for all data tables
- [ ] **G-03** Toast notifications for all async actions (currently inconsistent)

**Tasks:**
- [ ] **G-01** Fix DB health check bug
- [ ] **G-02** Session security (idle timeout, audit logging, admin revocation)
- [ ] **G-03** Error boundaries and loading states

---

## Phase 2 — Design System: Apply V2 Spec
*Priority: High · Estimated: Sessions 2–4*

The current Guard frontend was built before IMPRSN8_DESIGN_SPEC_V2.md was written.
The V2 spec (55KB, detailed) represents the target visual quality. Apply it.

### 2.1 Audit current vs. V2 spec
- Compare current `index.css` tokens against V2 color system
- Identify components that don't match V2 spec
- Surface/elevation system: does current CSS use the 5-level model?

### 2.2 Typography upgrade
Current: Inter + JetBrains Mono. V2 adds Syne for the wordmark.
- Verify Syne 800 is loaded for logo/brand use only
- Confirm JetBrains Mono is applied to: scores, IDs, handles, timestamps, all `.mono`
- Confirm Inter weights 300–700 are loaded (not just 400/600)

### 2.3 Component audit and upgrade
Review each component against V2 spec and upgrade:
- `ScoreRing` — verify 900ms cubic-bezier arc animation
- `AgentCard` — verify agent color coding matches V2 spec
- `ThreatBadge` / `SeverityBadge` — verify severity ladder colors
- All cards — verify surface elevation consistency
- Buttons — verify `.btn-primary`, `.btn-gold`, `.btn-ghost`, `.btn-danger` classes

### 2.4 Page-by-page V2 polish
Apply "one hero per screen" principle from V2 spec:
- [ ] **G-04** Dashboard — hero metric + agent heartbeat grid
- [ ] **G-05** Threats (IOI Feed) — OCI ring animation, threat card hover states
- [ ] **G-06** Takedowns — Kanban board visual polish, pipeline stepper
- [ ] **G-07** Agents Panel — category groupings, run history tab
- [ ] **G-08** Brand Score — score ring animation, trend chart upgrade
- [ ] **G-09** Monitored Accounts — platform filter bar, risk ring consistency
- [ ] **G-10** Settings — tab URL state, save confirmation animation
- [ ] **G-11** Admin Console — full 4-tab polish

**Tasks:**
- [ ] **G-04–G-11** Apply V2 design spec to all 8 authenticated pages

---

## Phase 3 — Feed Ingestion: Build Out Live Data
*Priority: High · Estimated: Sessions 4–6*

The data model for feeds is in place (migration 0011, seeded in 0016). The ingestion
logic needs to be built.

### Guard-specific feeds (social platform monitoring)

**Platform scraping feeds (legal, public data):**
- Instagram public profile search
- TikTok username search API
- X (Twitter) account search
- YouTube channel search
- Facebook page search (public)
- LinkedIn profile search (public)

**Threat intelligence (supplement Shield feeds — deduped):**
- DMCA abuse reports feed
- Platform Trust & Safety report status
- Known scammer handle databases

### Feed runner for Guard
Guard's cron is `*/30 * * * *` (every 30 min). Feed runner should:
1. Pull active feeds from `data_feeds` table
2. For each influencer's monitored handles, run variant search
3. Score matches with OCI algorithm
4. Insert new threats to `threats` table
5. Log to `feed_ingestions`

**Tasks:**
- [x] **G-12** Build feed runner infrastructure (coordinator, dedup, logging)
- [x] **G-13** Implement social platform search feeds
- [ ] **G-14** Implement DMCA/Trust & Safety status feeds
- [x] **G-15** Build Feed Analytics UI — live counts, last pull timestamps, error logs

---

## Phase 4 — Agent Execution: Activate the 8 Agents
*Priority: High · Estimated: Sessions 6–8*

All 8 agents are seeded in migrations but execution logic is scaffolding only.

### Agent activation plan

| Agent | Codename | Current | Target |
|-------|----------|---------|--------|
| Identity Monitor | SENTINEL | Scaffolded | Calls platform feeds, scores new handles |
| Scam Link Detector | RECON | Scaffolded | Scans threat URLs through api.lrx.io |
| Likeness Validator | VERITAS | Scaffolded | Avatar + bio similarity scoring |
| Attribution Engine | NEXUS | Scaffolded | Cluster threats by IP/infra |
| Takedown Authoriser | ARBITER | Scaffolded | HITL queue management |
| Compliance Guardian | WATCHDOG | Scaffolded | Audit HITL compliance, log gaps |
| Voice Clone Detector | PHANTOM | Coming Soon | Flag for future build |
| Cipher Echo | CIPHER_ECHO | Scaffolded | (0017 migration — review purpose) |

**Tasks:**
- [x] **G-16** Build agent execution framework (runner, logging to agent_runs, status tracking)
- [x] **G-17** Activate SENTINEL — handle monitoring + OCI scoring
- [x] **G-18** Activate RECON — scam link detection via api.lrx.io (+ LRX URL scanning in NEXUS)
- [x] **G-19** Activate VERITAS — avatar + bio similarity
- [x] **G-20** Activate NEXUS — threat clustering (domain, handle-prefix, cross-influencer)
- [x] **G-21** Activate ARBITER — HITL queue UI + approval flow
- [x] **G-22** Activate WATCHDOG — compliance audit logging (stale threats, stale takedowns, agent overdue)

---

## Phase 5 — Public Landing: Guard Section
*Priority: Medium · Estimated: Sessions 8–10*

### 5.1 Redesign Guard public homepage (`imprsn8.com/`)

The current homepage exists but needs to accommodate dual-service context. The root `/`
should explain both Guard and Shield while making Guard the default/primary narrative.

**Revised homepage sections:**
1. **Hero** — "Protect what your brand stands for" (covers both services)
   - Two CTAs: "Protect your identity" (Guard) · "Protect your brand" (Shield)
   - Animated I8 logo mark
2. **Live stats strip** — Influencers Protected · Accounts Monitored · Threats Detected · Takedowns Filed
3. **Guard feature showcase** — OCI explainer, platform coverage, HITL model
4. **Shield teaser** — "For enterprise brand protection" → `/shield`
5. **Score preview** — Animated OCI ring demonstration
6. **Threat types** — Fake accounts · Username squatting · Bio copy · Content theft
7. **How it works** — 3 steps with visual connector
8. **Final CTA** — "Your identity deserves a guardian"

### 5.2 Guard sub-page (`imprsn8.com/guard`)
Dedicated deep-dive for Guard service with full feature breakdown.

**Tasks:**
- [ ] **G-23** Redesign root homepage — dual-service hero + Guard primary narrative
- [ ] **G-24** Build `/guard` deep-dive page

---

## Phase 6 — Performance & Infrastructure
*Priority: Low · Estimated: Sessions 10–11*

- [ ] **G-25** TanStack Query: cache tuning, background refetch, stale time config
- [ ] **G-26** Code splitting — lazy load all routes
- [ ] **G-27** Image optimisation — R2 profile assets with Cloudflare Image Resizing
- [ ] **G-28** Mobile — bottom tab bar (5 items), touch targets 44px, swipeable cards

---

## Task Summary

| Phase | Tasks | Key output |
|-------|-------|-----------|
| 1 — Fixes | G-01 → G-03 | DB bug fixed, session security, error states |
| 2 — Design V2 | G-04 → G-11 | All pages match IMPRSN8_DESIGN_SPEC_V2 |
| 3 — Feeds | G-12 → G-15 | Live social platform monitoring feeds |
| 4 — Agents | G-16 → G-22 | All 7 agents executing (PHANTOM deferred) |
| 5 — Landing | G-23 → G-24 | Public homepage + /guard page |
| 6 — Perf | G-25 → G-28 | Performance, mobile, R2 images |

**Total tasks: 28**

---

## Guard as Reference Implementation for Shield

When building Shield, use these Guard files as the pattern to follow:

| Shield needs | Use Guard's file as reference |
|---|---|
| Admin handler | `packages/imprsn8/src/handlers/admin.ts` |
| Auth middleware | `packages/imprsn8/src/middleware/auth.ts` |
| Invite system | `packages/imprsn8/src/handlers/invites.ts` |
| HITL takedown | `packages/imprsn8/src/handlers/takedowns.ts` |
| Agent runner | `packages/imprsn8/src/handlers/agents.ts` (once built) |
| Feed runner | `packages/imprsn8/src/handlers/feeds.ts` (once built) |
| RBAC pattern | `packages/imprsn8/migrations/0003_admin.sql` + `0009_backfill_user_profile_columns.sql` |
| Invite tokens | `packages/imprsn8/migrations/0012_invite_tokens.sql` |

---

## Immediate Next Actions (Start Here)

1. **G-01a** — Read `packages/imprsn8/src/handlers/health.ts` → diagnose DB health bug
2. **G-01b** — Fix the bug, test, commit
3. **G-04** — Begin Design V2 audit (compare `index.css` to IMPRSN8_DESIGN_SPEC_V2.md)
4. **S-01** — In parallel or next session: begin Shield design system (uses same Vite/Tailwind pattern)

---

*Document: GUARD_BUILD_PLAN.md · Version 1.0 · March 2026*
*Part of the imprsn8 platform — see PLATFORM_ARCHITECTURE.md for context*
