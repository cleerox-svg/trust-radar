# CLAUDE.md — Averrow Platform: Claude Code Standing Instructions

This file is read at the start of every Claude Code session.
Follow all instructions here before writing any code. These are non-negotiable.

---

## 1. Read These First (Every Session)

Before writing any code, read:
1. `RESTRUCTURE_SPEC.md` — target architecture, component specs, migration sequence
2. `AVERROW_UI_STANDARD.md` — design system quick reference
3. `docs/API_REFERENCE.md` — all API routes (do not duplicate)

If the task touches agents or backend:
4. `docs/AI_AGENTS.md` — agent architecture and rules

```bash
# Always check for TODOs before starting
grep -rn "TODO\|FIXME\|HACK" packages/averrow-ui/src/ --include="*.tsx" | head -20
```

---

## 2. Repository Structure

```
/
├── packages/
│   ├── trust-radar/              ← Cloudflare Worker (backend) — internal name kept
│   │   ├── src/
│   │   │   ├── agents/           ← All agent files
│   │   │   ├── routes/           ← API route handlers
│   │   │   ├── handlers/         ← Route handler functions
│   │   │   ├── feeds/            ← Threat feed modules
│   │   │   ├── lib/              ← Shared utilities
│   │   │   └── index.ts          ← Worker entry point
│   │   └── wrangler.toml
│   └── averrow-ui/               ← React frontend (the live platform)
│       ├── src/
│       │   ├── design-system/    ← [RESTRUCTURE TARGET] tokens + primitives
│       │   ├── features/         ← [RESTRUCTURE TARGET] domain-driven features
│       │   ├── layouts/          ← Shell, Sidebar, TopBar, MobileNav
│       │   ├── mobile/           ← Mobile-specific views (CommandCenter only)
│       │   ├── pages/            ← Migrating to features/ during restructure
│       │   ├── components/       ← Migrating to features/ or design-system/
│       │   ├── hooks/            ← TanStack Query hooks
│       │   └── lib/              ← api.ts, auth.tsx, time.ts, cn.ts
│       └── tailwind.config.ts
├── docs/
│   ├── API_REFERENCE.md          ← All API routes — update when adding endpoints
│   ├── ARCHITECTURE.md           ← System architecture
│   ├── AI_AGENTS.md              ← Agent specifications
│   ├── archive/                  ← Superseded documents
│   └── ...
├── CLAUDE.md                     ← This file
├── RESTRUCTURE_SPEC.md           ← Architecture source of truth ← READ THIS
├── AVERROW_UI_STANDARD.md        ← Component quick reference
└── AVERROW_MASTER_PLAN.md        ← Platform vision + roadmap
```

---

## 3. Current Platform State

**React /v2 IS the live platform.**
- `averrow.com` → serves React /v2 by default (session-aware routing)
- `averrow.com/legacy` → old SPA escape hatch
- `/v2` is not in URLs — React Router `basename="/v2"` handles it internally

**NEVER MODIFY — frozen forever:**
```
public/          ← OLD SPA — DO NOT TOUCH
app.js           ← OLD SPA — DO NOT TOUCH
styles.css       ← OLD SPA — DO NOT TOUCH
```

**Restructure in progress:** Sessions R1–R10 per `RESTRUCTURE_SPEC.md`.
Check the spec to see which sessions are complete before starting work.

---

## 4. Code Standards (Zero Exceptions)

### TypeScript
- `npx tsc --noEmit` must pass before every commit
- No `any` types — use `unknown` + type guard
- No `// @ts-ignore` — fix the actual type issue

### React / UI

**The platform is undergoing a full restructure (R1–R10 per RESTRUCTURE_SPEC.md).**

**For sessions working on new/restructured files:**
- Import components from `@/design-system/components`
- Use CSS custom properties: `var(--amber)`, `var(--text-primary)`, `var(--sev-critical)` etc.
- Never use old tokens in new code: no `glass-card`, `bg-cockpit`, `text-parchment`, `text-contrail`

**For sessions NOT yet migrating a file:**
- Leave existing old tokens in place — do not mix systems in one file
- Old files stay old until their designated restructure session

**Components — always use shared components, never rebuild inline:**
During restructure, check `RESTRUCTURE_SPEC.md` for the current component locations.
After restructure: everything imports from `@/design-system/components`.

**Frozen components — never refactor these:**
- `ThreatMap.tsx` — WebGL canvas, untouchable
- `ExposureGauge.tsx` — custom SVG, untouchable
- `PortfolioHealthCard.tsx` — SVG donut, untouchable
- `Sparkline.tsx`, `ActivitySparkline.tsx` — SVG sparklines, untouchable
- `EventTicker.tsx` — scrolling ticker, untouchable

### Backend / Worker
- All agents must write to `agent_runs` on start AND completion
- All agents must emit to `agent_events` after completion
- Never hardcode secrets — use `env.SECRET_NAME`
- D1 queries: always use prepared statements, never string interpolation
- New endpoints must be added to `docs/API_REFERENCE.md`

---

## 5. Design System Quick Reference

### CSS Custom Properties (defined in design-system/tokens.css after R1)

```css
/* Backgrounds */
--bg-page:      #060A14
--bg-card:      rgba(22,30,48,0.85)
--bg-sidebar:   rgba(10,16,30,0.96)

/* Primary accents */
--amber:        #E5A832    /* primary — CTAs, active states, nav */
--amber-dim:    #B8821F    /* gradient pair */
--red:          #C83C3C    /* alerts, critical, logo */
--red-dim:      #8B1A1A    /* gradient pair */
--blue:         #0A8AB5    /* info, infrastructure */
--blue-dim:     #065A78
--green:        #3CB878    /* healthy, operational */
--green-dim:    #1A6B3C

/* Text */
--text-primary:   rgba(255,255,255,0.92)
--text-secondary: rgba(255,255,255,0.60)
--text-tertiary:  rgba(255,255,255,0.40)
--text-muted:     rgba(255,255,255,0.25)

/* Severity */
--sev-critical:        #f87171
--sev-critical-bg:     rgba(239,68,68,0.10)
--sev-critical-border: rgba(239,68,68,0.30)
--sev-high:            #fb923c
--sev-high-bg:         rgba(249,115,22,0.08)
--sev-medium:          #fbbf24
--sev-medium-bg:       rgba(229,168,50,0.08)
--sev-low:             #60a5fa
--sev-low-bg:          rgba(59,130,246,0.07)

/* RESERVED — Observatory WebGL only */
--orbital-teal: #00d4ff
```

### Light Theme
`[data-theme="light"]` overrides all `--bg-*` and `--text-*` vars.
Accent colors and severity colors stay the same in light mode.
Set via `document.documentElement.setAttribute('data-theme', 'light')`.
Stored in `localStorage` via `useTheme()` hook.

### Component Usage (after R2+)
```typescript
import {
  Card, Button, Badge, Avatar, StatCard,
  DataRow, FilterBar, Tabs, PageHeader, StatGrid,
  Input, Select, Modal, EmptyState
} from '@/design-system/components';

// Card variants
<Card />                              // base glass
<Card variant="elevated" />           // modals, panels
<Card variant="active" />             // live data, amber glow
<Card variant="critical" />           // alerts, red glow
<Card variant="active" accent="#0A8AB5" />  // custom accent

// Button variants
<Button />                            // primary amber gradient
<Button variant="secondary" />        // glass dark
<Button variant="danger" />           // red gradient
<Button variant="ghost" />            // transparent

// Badge — unified severity + status
<Badge severity="critical" />
<Badge severity="high" />
<Badge status="active" pulse />

// Avatar
<Avatar name="Acme Corp" color="var(--red)" />
<Avatar name="Google" faviconUrl="https://..." severity="critical" />
```

---

## 6. Agent Architecture Rules

### Every agent must:
1. Log a row to `agent_runs` at start
2. Update `agent_runs` on completion with `completed_at` and `records_processed`
3. Emit to `agent_events` after completion
4. Handle errors — catch all exceptions, log to `agent_runs.error_message`

### Agent trigger chain:
```
Sentinel      → [feed_pulled]        → Cartographer
Cartographer  → [threats_enriched]   → Nexus
Nexus         → [cluster_detected]   → Analyst + Observer (high severity)
Nexus         → [pivot_detected]     → Observer (immediate)
Analyst       → [scores_updated]     → Pathfinder (new high-value leads)
```

### AI usage rules:
- **Haiku:** classification, scoring, short summaries — high volume
- **Sonnet:** threat actor narratives, cluster briefs — sparingly
- **NEVER** use AI for what SQL `GROUP BY` can do in 50ms
- All AI calls go through Cloudflare AI Gateway

### Cron schedule (wrangler.toml):
```
fast-tick:    */5 * * * *    (every 5 min — DNS backfill, cube refresh, cache warming)
orchestrator: 7 * * * *     (hourly at :07 — feeds, agent dispatch, Workflows)
cube-healer:  12 */6 * * *  (every 6 hours at :12 — 30-day bulk cube rebuild)
```

### Agent dispatch (inside orchestrator hourly tick):
All agents below are dispatched from `runThreatFeedScan()` inside the orchestrator.
Time gates use `event.scheduledTime` (minute=7 for the `7 * * * *` cron).

```
Always (no gate):     Flight Control, CertStream health, Enricher, agent_events consumer
Feed ingestion:       inside runThreatFeedScan (minute gate must match :07)
Sentinel:             after feed ingestion if totalNew > 0 (inline await)
Cartographer:         after Sentinel OR as fallback (dispatched as Workflow)
Analyst:              minute % 15 < 5 window (ctx.waitUntil)
Strategist:           hour % 6 === 0, minute [5,10) (ctx.waitUntil)
NEXUS:                hour % 4 === 0, minute === 0 (dispatched as Workflow)
Sparrow:              hour % 6 === 0, minute [15,20) (ctx.waitUntil)
Observer:             hour === 0, minute < 5 (inline await)
Pathfinder:           hour === 3, minute < 5 (inline await)
CT monitor:           minute % 5 === 0 (inline await, in handleScheduled)
Lookalike check:      minute === 15 (inline await, in handleScheduled)
Social discovery:     minute === 0, hour % 6 === 0 (in handleScheduled)
```

**⚠️ KNOWN BUG:** The orchestrator was shifted from `:00` to `:07` in Wave 1A but
the minute gates inside were NOT updated. `runThreatFeedScan()` is gated by
`minute === 0 || minute === 30` which is never true when minute=7. This means
feed ingestion and ALL agents inside that function are dead. Only Flight Control,
CertStream, Enricher, and agent_events processing actually fire. Fix is tracked.

**Parity-checker:** Removed in Wave 6. No longer runs anywhere. Do not reference.

### Execution patterns:
- **Workflow dispatch:** Cartographer and NEXUS run as Cloudflare Workflows (durable, no CPU ceiling)
- **ctx.waitUntil:** Analyst, Strategist, Sparrow run in parallel without blocking the cron mesh
- **Inline await:** Observer, Pathfinder run sequentially (quiet times, fast execution)

---

## 7. API Conventions

- User endpoints: `/api/...` (JWT Bearer auth)
- Admin endpoints: `/api/admin/...` (JWT + admin role)
- Internal agent triggers: `/api/internal/agents/:name/run` (INTERNAL_SECRET header)
- **Every new endpoint must be added to `docs/API_REFERENCE.md`**
- Never duplicate an existing endpoint — check the reference first

### Standard response format:
```typescript
// Success
{ success: true, data: T, total?: number }

// Error
{ success: false, error: string }
```

---

## 8. Database Rules

- Primary DB: `trust-radar-v2` (D1, SQLite) — internal name kept intentionally
- Audit DB: `trust-radar-v2-audit`
- **Never DROP or ALTER existing columns** without explicit instruction
- New columns: `ALTER TABLE ... ADD COLUMN` only
- New migrations: `migrations/NNNN_description.sql`
- Always use prepared statements — never string interpolation
- Use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE` — never SELECT then INSERT

### D1 Sessions API (Read Replicas)
- Read-heavy handlers use `getDbContext(request)` from `src/lib/db.ts` to route to read replicas
- Cron/agent contexts use `getReadSession(env, ctx)` for read-only sessions
- **Write operations always use `env.DB` directly** — never write through a read session
- Attach bookmarks to responses via `attachBookmark(response, session)` for session continuity

### OLAP Cubes — query cubes, not raw threats
- **threat_cube_geo** — geographic aggregates by hour (country, threat_type, severity, source_feed)
- **threat_cube_provider** — provider aggregates by hour (hosting_provider_id, threat_type, severity, source_feed)
- **threat_cube_brand** — brand aggregates by hour (target_brand_id, threat_type, severity, source_feed)
- For aggregate counts (by country, provider, brand, severity, type) **always query cubes instead of raw threats table**
- Cubes are rebuilt every 5 min (current + prev hour) by fast-tick, and full 30-day rebuild every 6 hours by cube-healer
- Cube builder: `src/lib/cube-builder.ts` — `buildGeoCubeForHour()`, `buildProviderCubeForHour()`, `buildBrandCubeForHour()`

### Pre-computed columns — use them, don't re-derive
- `brands.threat_count`, `brands.last_threat_seen` — use instead of `COUNT(*) FROM threats WHERE target_brand_id = ?`
- `hosting_providers.active_threat_count`, `hosting_providers.total_threat_count` — use instead of JOIN to threats
- `hosting_providers.trend_7d`, `hosting_providers.trend_30d` — use instead of 14-day window GROUP BY

### KV Cache on page-load endpoints
- Check `env.CACHE.get(cacheKey)` before querying D1 on any page-load GET endpoint
- Store results with `env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 })`
- fast-tick pre-warms caches every 5 min so users rarely hit cold cache
- Cache keys must encode all query parameters for correctness

### Key tables:
```
brands                    ← Brand registry (9,652+ brands)
brand_profiles            ← User-created brand profiles
threats                   ← Core threat intelligence (113K+ rows)
threat_cube_geo           ← OLAP cube: hourly geo aggregates
threat_cube_provider      ← OLAP cube: hourly provider aggregates
threat_cube_brand         ← OLAP cube: hourly brand aggregates
hosting_providers         ← Provider registry with pre-computed threat counts
lookalike_domains         ← Typosquat scanner results
alerts                    ← Platform alerts
agent_runs                ← Agent execution log
agent_events              ← Inter-agent event queue
agent_outputs             ← AI-generated insights
campaigns                 ← Threat campaign groupings
infrastructure_clusters   ← NEXUS operation clusters
organizations             ← Multi-tenant org layer
org_members               ← Org membership + roles
```

---

## 9. PR and Merge Workflow

```bash
# After every session:
cd packages/averrow-ui && npx tsc --noEmit
git add -A
git commit -m "type(scope): description"
git push origin HEAD
```

Commit format:
```
feat(scope):      new feature
fix(scope):       bug fix
refactor(scope):  cleanup, no behavior change
docs(scope):      documentation only
chore(scope):     build, deps, config
```

Examples:
```
feat(brands): add favicon support to DimensionalAvatar
fix(sidebar): exact active state matching on all NavLinks
refactor(restructure-r2): rebuild Card + Button + Badge to CSS vars
docs(claude): update standing instructions for restructure
```

---

## 10. What NOT to Build Without Explicit Instruction

- New npm packages without checking if existing ones cover the need
- New API endpoints for data derivable client-side
- Loading skeletons on views that already have them
- Refactoring working code during a bug fix session — one thing at a time
- Anything in `public/`, `app.js`, `styles.css` — frozen forever
- Old design tokens (`glass-card`, `bg-cockpit`, `text-parchment`) in new files
- Duplicate utility functions — check `src/lib/` first
- `console.log` in production — use `agent_runs` error logging

---

## 11. Session Checklist (Before Marking Complete)

- [ ] `npx tsc --noEmit` passes in `packages/averrow-ui`
- [ ] No old SPA files touched (`public/`, `app.js`, `styles.css`)
- [ ] New API endpoints added to `docs/API_REFERENCE.md`
- [ ] New agent logic follows `agent_runs` + `agent_events` pattern
- [ ] `RESTRUCTURE_SPEC.md` updated if architecture decisions were made
- [ ] Commit message follows `type(scope): description` format
- [ ] Pushed to feature branch (not master directly)
- [ ] When docs reference files, verified the files exist at the stated path
- [ ] When a task assumes current-state behavior, verified it in code (grep for the function, check cron schedule against wrangler.toml, confirm the agent actually runs)

---

## 12. Platform Context

Averrow is a **threat actor intelligence platform** — not just brand protection.

The goal: identify WHO is conducting attacks, HOW they operate, WHERE they move
infrastructure, and get ahead of them. Threats are evidence. Patterns are the product.

**Customer ROI:**
- Replaces 2–3 security analyst headcount
- Protects brand equity (irreplaceable once damaged)
- Protects customers (the real victims of impersonation attacks)
- Quantifiable: analyst-hours replaced, takedowns completed, exposure prevented

**The rule:** SQL does correlation. AI does narrative.
Never pay AI tokens to do what `GROUP BY` can do in 50ms.

**Pricing:** Free | Professional $1,499/mo | Business $3,999/mo | Enterprise
**Positioning:** Global (not Canada-first). Avro Arrow heritage on About page only.
**Parent company:** LRX Enterprises Inc. (Canadian-incorporated)
**Domains:** averrow.com (primary), averrow.ca (Canadian market)
