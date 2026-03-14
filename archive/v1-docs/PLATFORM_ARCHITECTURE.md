# imprsn8 Platform Architecture
## Dual-Service Brand Protection Platform

> **Version:** 2.0 — March 2026
> **Status:** Canonical reference document. All build plans, design specs, and roadmaps defer to this.

---

## 1. Brand Strategy

### Master Brand: imprsn8

imprsn8 is a brand protection platform. The name encodes the product mission:
- **Impression** — brand perception and identity are what we protect
- **Impersonate** — the primary threat vector we defend against
- **-ate** — active, doing something, not passive
- **8** — shorthand mark (I8), icon candidate (eye8), infinite vigilance

**Logo direction:** A stylized eye where the form resolves into the numeral 8. The "I" of I8
reads as both the letter and the eye shape. Works as app icon, favicon, and silhouette at
all sizes. Typography: Syne 800 weight for the wordmark. The mark alone should be
recognizable without the wordmark once brand equity is established.

**Domain:** `imprsn8.com` — single public-facing domain for the platform.

**Internal/API:** `api.lrx.io` — shared backend, not customer-facing. Stays as-is.

---

## 2. The Two Services

### Service 1 — imprsn8 Shield
*Corporate brand health monitoring & protection*

**Domain served:** `imprsn8.com/shield` or `shield.imprsn8.com`
**Previous name:** Trust Radar (lrxradar.com — redirect to Shield)
**Package:** `packages/shield/` (backend), `packages/frontend/shield/`

**Who it's for:**
Corporate security teams, brand risk officers, IT/SOC analysts, enterprise legal teams,
and marketing departments at companies that need to monitor their digital brand surface
for threats, impersonation, and infrastructure risk.

**What it does:**
- URL & domain trust scoring
- Threat intelligence aggregation (24+ feeds: ThreatFox, CISA KEV, VirusTotal, etc.)
- Lookalike domain & homoglyph detection
- Brand impersonation monitoring (corporate identity across the web)
- Dark web credential & data breach exposure
- Email authentication compliance (SPF/DKIM/DMARC)
- Investigation case management (LRX-XXXXX ticket IDs)
- Takedown orchestration with HITL gates
- Executive intelligence briefings (AI-generated, daily)
- AI agent suite: Triage, Threat Hunt, Campaign Correlator, TrustBot

**Design identity:**
- Deep navy base (`#0A0E1A`) + cyan-teal primary (`#06B6D4`)
- Geist + Geist Mono typography
- Feels: SOC terminal, cyber-intelligence, clinical, authoritative
- Contrast to Guard: darker, denser, data-forward

**Buyer vocabulary:**
CISA KEV, IOCs, threat intel, HITL, SOC, feeds, breach, ATO, DMARC, takedown

---

### Service 2 — imprsn8 Guard
*Social media monitoring & personal brand protection*

**Domain served:** `imprsn8.com` (root) and `imprsn8.com/guard`
**Previous name:** imprsn8 (core product)
**Package:** `packages/guard/` (backend), `packages/frontend/guard/`

**Who it's for:**
Influencers, celebrities, public figures, talent agencies, publicists, and brand managers
who need to detect impersonation, monitor fake accounts, and protect personal brand
identity across social platforms.

**What it does:**
- OCI (Online Clone Indicator) scoring
- Fake account detection across 14+ social platforms
- Impression score & brand health analytics
- Deepfake and AI-generated content detection
- Variant watching (handle/username monitoring)
- Campaign tracking
- Automated takedown pipeline with HITL gates
- AI agent suite: SENTINEL, RECON, VERITAS, NEXUS, ARBITER, WATCHDOG, PHANTOM, CIPHER_ECHO
- Invitation-based onboarding

**Design identity:**
- Deep navy base (`#070726`) + purple/pink accents
- Inter + JetBrains Mono typography
- Feels: editorial intelligence, brand-forward, identity-protective, premium
- Contrast to Shield: warmer, more emotive, creator-native

**Buyer vocabulary:**
OCI, IOI, impression score, fake accounts, social platforms, DMCA, brand health, clone detection

---

## 3. Platform Information Architecture

### Public Site (`imprsn8.com`)

```
/                   Hero — "We protect what your brand stands for"
                    Explains both services, positions the brand
                    CTAs: "Protect your brand" → /shield
                          "Protect your identity" → /guard

/shield             imprsn8 Shield hero & feature breakdown
                    Corporate brand protection focus
                    CTA: Request access / Request briefing

/guard              imprsn8 Guard hero & feature breakdown
                    Influencer/personal brand focus
                    CTA: Get early access / Book demo

/about              Company, mission, LRX parent context
/pricing            Tiered plans for each service (or combined)
/blog               Intelligence briefings, brand protection content
```

### Authenticated Apps

```
shield.imprsn8.com  →  imprsn8 Shield app (or imprsn8.com/app/shield)
guard.imprsn8.com   →  imprsn8 Guard app  (or imprsn8.com/app/guard)
admin.lrx.io        →  Internal unified admin (ops only, never customer-facing)
api.lrx.io          →  Shared FastAPI backend
```

### Auth Flow (Shared, Phase 3)

```
imprsn8.com/login  →  Single login for both services
JWT payload: { userId, email, products: ["shield", "guard"], role }
→  Redirects to appropriate app based on entitlements
```

---

## 4. Monorepo Structure

### Current → Target Package Naming

| Current | Target | Notes |
|---------|--------|-------|
| `packages/trust-radar/` | `packages/shield/` | Backend Cloudflare Worker |
| `packages/imprsn8/` | `packages/guard/` | Backend Cloudflare Worker |
| `packages/frontend/radar/` | `packages/frontend/shield/` | React SPA |
| `packages/frontend/imprsn8/` | `packages/frontend/guard/` | React SPA |
| `packages/api/` | `packages/api/` | Shared FastAPI — no change |

### Target Structure

```
/home/user/trust-radar/           ← repo root (rename repo to imprsn8 eventually)
├── packages/
│   ├── shield/                   ← imprsn8 Shield backend (Cloudflare Worker)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── handlers/
│   │   │   ├── agents/
│   │   │   └── feeds/
│   │   ├── migrations/
│   │   └── wrangler.toml         ← routes: shield.imprsn8.com
│   │
│   ├── guard/                    ← imprsn8 Guard backend (Cloudflare Worker)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── handlers/
│   │   │   └── agents/
│   │   ├── migrations/
│   │   └── wrangler.toml         ← routes: imprsn8.com
│   │
│   ├── frontend/
│   │   ├── shield/               ← imprsn8 Shield SPA
│   │   ├── guard/                ← imprsn8 Guard SPA
│   │   └── package.json          ← shared deps
│   │
│   └── api/                      ← Shared FastAPI (api.lrx.io) — unchanged
│
├── PLATFORM_ARCHITECTURE.md      ← this document
├── SHIELD_BUILD_PLAN.md          ← Shield service roadmap
├── GUARD_BUILD_PLAN.md           ← Guard service roadmap
├── IMPRSN8_DESIGN_SPEC_V2.md     ← Guard design spec (canonical)
├── package.json                  ← root monorepo
└── turbo.json
```

---

## 5. Shared Infrastructure

### What is shared (now)

| Asset | Shared How |
|-------|-----------|
| React + Vite + Tailwind | Same version, same config pattern |
| Radix UI components | Same set, both frontends |
| TanStack Query | Same API client pattern |
| Framer Motion | Same animation primitives |
| itty-router + Zod | Same Worker routing pattern |
| JWT auth pattern | Same structure, separate secrets |
| `api.lrx.io` FastAPI | Both call for AI features |
| Turborepo + pnpm | Shared build orchestration |

### What stays separate (by design)

| Asset | Why Separate |
|-------|-------------|
| D1 databases | Data isolation, independent scaling |
| KV namespaces | Per-product session/cache |
| JWT secrets | Security — compromise of one doesn't affect the other |
| Design tokens | Different visual identity per service |
| Cloudflare Workers | Independent deploys, different cron schedules |
| AI agent names | SENTINEL/PHANTOM (Guard) vs. Triage/TrustBot (Shield) |

### Phase 3 Target — Shared Packages

```
packages/
  @lrx/ui/         ← unified component library (merge shield + guard components)
  @lrx/auth/       ← shared JWT issuer, RBAC middleware
  @lrx/types/      ← shared TypeScript types
```

---

## 6. Phased Roadmap

### Phase 1 — Documentation & Naming (Current session)
Establish the platform strategy in docs. No code changes yet.

- [x] PLATFORM_ARCHITECTURE.md (this document)
- [ ] SHIELD_BUILD_PLAN.md — Shield-branded version of the refactor plan
- [ ] GUARD_BUILD_PLAN.md — Guard service build plan
- [ ] Update PLATFORM_DESIGN_BRIEF.md — rebrand both services
- [ ] Update README.md — new platform overview
- [ ] Update root package.json scripts (deploy:shield, deploy:guard)

### Phase 2 — imprsn8 Guard: Production Polish (Sessions 2-5)
Guard is closer to complete. Get it production-ready first.

- [ ] Fix DB health check error (screenshots show 0ms / unknown SQLite version)
- [ ] Lift imprsn8 Guard's admin framework to full completion
- [ ] Session security: idle timeout, revocation, audit logging
- [ ] Invite flow QA — test end-to-end
- [ ] Guard public landing page (/guard) — hero, OCI explainer, features
- [ ] Guard design system audit vs. IMPRSN8_DESIGN_SPEC_V2

### Phase 3 — imprsn8 Shield: Core Build (Sessions 5-15)
Execute SHIELD_BUILD_PLAN.md in full. Parallel to Guard being live.

- [ ] DB schema expansion (12 new migration files)
- [ ] Intelligence feed system (Tier 1-3 feeds)
- [ ] AI agent framework
- [ ] All 28 frontend pages rebuilt to Shield spec
- [ ] Shield public landing page (/shield)

### Phase 4 — Unified Public Site (Sessions 15-18)
Build the imprsn8.com root experience that encompasses both services.

- [ ] Root landing page redesign — dual-service positioning
- [ ] /shield and /guard sub-pages
- [ ] Shared navigation component linking both
- [ ] SEO strategy — separate meta per service section

### Phase 5 — Shared Auth (Sessions 18-20)
Single sign-on across both services.

- [ ] `packages/auth/` — shared Cloudflare Worker JWT issuer
- [ ] Product entitlements in JWT payload
- [ ] Single login at imprsn8.com/login
- [ ] Product switcher inside both apps

### Phase 6 — Unified Admin (Sessions 20-22)
Internal-only ops console.

- [ ] `packages/frontend/admin/` — new React app
- [ ] Queries both Shield and Guard APIs
- [ ] Deploys to admin.lrx.io (never public-facing)
- [ ] Branded as "LRX Operations Console"

### Phase 7 — Shared UI Package (Sessions 22+)
Consolidate overlapping components.

- [ ] Extract `@lrx/ui` from both frontends
- [ ] Merge duplicate components (AgentCard, ScoreRing, Pulse, ThemeToggle)
- [ ] Both apps import from shared package
- [ ] Design token system: base tokens + service-specific overrides

---

## 7. Deployment Architecture

```
                    imprsn8.com (Cloudflare Pages)
                    ┌──────────────────────────────┐
                    │  Public marketing site        │
                    │  /shield  /guard  /about       │
                    └────────────┬─────────────────┘
                                 │
          ┌──────────────────────┴──────────────────────┐
          ▼                                             ▼
shield.imprsn8.com                           imprsn8.com (Guard app)
imprsn8 Shield SPA                           imprsn8 Guard SPA
(Cloudflare Worker + D1)                     (Cloudflare Worker + D1)
    radar-db                                     imprsn8-db
    CACHE KV                                     SESSIONS KV
          │                                             │
          │           X-API-Key                        │
          └──────────────┬──────────────────────────────┘
                         ▼
                   api.lrx.io
                   FastAPI / Railway
                   PostgreSQL + OpenAI
                   (shared by both services)
```

---

## 8. Key Decisions Log

| Decision | Rationale |
|----------|-----------|
| imprsn8 as master brand | Strong name, built-in meaning, excellent logo potential |
| Two named services (Shield/Guard) | Corporate buyers need Shield to stand on its own; Guard is the social-native product |
| Single domain (imprsn8.com) | One brand to build, one domain to market |
| Separate D1 databases | Data isolation; compromise of one DB doesn't affect the other |
| Keep api.lrx.io internal | LRX is the corporate entity, not a consumer brand |
| imprsn8 Guard as primary product | Guard is more mature (17 migrations, invite system, R2, full RBAC) |
| Shield as second product | More feature surface (28 pages) but admin less mature — build on Guard patterns |
| Shared FastAPI backend | AI features shared, avoid duplication, single OpenAI key management |
| No chicklet portal | A link farm adds no value; shared auth is the right unification mechanism |

---

## 9. Naming Reference

| Concept | Name |
|---------|------|
| Master brand | imprsn8 |
| Corporate service | imprsn8 Shield |
| Social/influencer service | imprsn8 Guard |
| Parent company | LRX (internal only) |
| Shared API | LRX API / api.lrx.io |
| Internal admin | LRX Operations Console / admin.lrx.io |
| Logo shorthand | I8 (spoken: "eye-eight" or "i-eight") |
| Brand tagline candidate | "We protect what your brand stands for" |
| Shield tagline candidate | "Corporate threat intelligence, redefined" |
| Guard tagline candidate | "Your identity. Defended." |

---

*Document owner: LRX / imprsn8 platform team*
*Last updated: March 2026*
*Next review: After Phase 2 completion*
