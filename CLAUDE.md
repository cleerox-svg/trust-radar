# CLAUDE.md — Averrow Platform: Claude Code Standing Instructions

This file is read at the start of every Claude Code session. Follow all instructions here
before writing any code. These are non-negotiable standards for the Averrow platform.

---

## 1. Read These First (Every Session)

Before writing any code, read:
1. `AVERROW_MASTER_PLAN.md` — platform vision, agent architecture, build roadmap
2. `AVERROW_DESIGN_SYSTEM_BRIEF.md` — UI tokens, component patterns, color rules
3. `AVERROW_API_REFERENCE.md` — existing API routes (do not duplicate)

If the task touches the UI, also check:
```bash
grep -n "TODO\|FIXME\|HACK" packages/averrow-ui/src/ -r --include="*.tsx" | head -20
```

---

## 2. Repository Structure

```
/
├── packages/
│   ├── trust-radar/          ← Cloudflare Worker (backend)
│   │   ├── src/
│   │   │   ├── agents/       ← All agent files (sentinel, analyst, nexus, etc.)
│   │   │   ├── routes/       ← API route handlers
│   │   │   ├── index.ts      ← Worker entry point, fetch + scheduled handlers
│   │   │   └── orchestrator.ts ← Agent scheduling logic
│   │   └── wrangler.toml
│   └── averrow-ui/           ← React frontend (/v2)
│       ├── src/
│       │   ├── pages/        ← Page components
│       │   ├── components/   ← Shared components
│       │   │   └── brands/   ← StatCard, SocialDots, TrendBadge, Sparkline, etc.
│       │   ├── hooks/        ← TanStack Query hooks
│       │   └── lib/          ← Utilities (severityColor.ts, etc.)
│       └── tailwind.config.ts
├── CLAUDE.md                 ← This file
├── AVERROW_MASTER_PLAN.md    ← Platform master plan
├── AVERROW_DESIGN_SYSTEM_BRIEF.md
├── AVERROW_API_REFERENCE.md
└── PRODUCT_BOUNDARIES.md
```

---

## 3. The Old SPA — NEVER TOUCH

```
public/          ← OLD SPA — DO NOT MODIFY EVER
app.js           ← OLD SPA — DO NOT MODIFY EVER
styles.css       ← OLD SPA — DO NOT MODIFY EVER
```

The old SPA lives at the primary URL and is the demo fallback. It must remain
functional at all times. All UI work goes to `packages/averrow-ui/` only.

React /v2 is at `/v2` — do not make it the default until explicitly instructed.

---

## 4. Code Standards (Zero Exceptions)

### TypeScript
- `tsc --noEmit` must pass with zero errors before every commit
- No `any` types unless absolutely unavoidable — use `unknown` + type guard instead
- No `// @ts-ignore` — fix the actual type issue
- Double-cast pattern when needed: `value as unknown as TargetType`

### React / UI
- **Zero inline styles** — Tailwind classes only
- Exception: dynamic hex colors from `severityColor()` or `threatTypeColor()` via
  `style={{ color: severityColor(...) }}` — this is the only acceptable inline style
- Import `severityColor`, `severityOpacity`, `threatTypeColor` from `src/lib/severityColor.ts`
  — never redefine these functions anywhere else
- Use existing shared components — never rebuild what already exists:
  - `StatCard` — detail/metric card wrapper (all detail views)
  - `SocialDots` — platform indicator dots
  - `TrendBadge` — directional trend ▲/▼
  - `Sparkline` — 7-point inline SVG trend line
  - `BrandRow` — compact list row
  - `LiveFeedCard`, `PortfolioHealthCard`, `AttackVectorsCard` — sidebar cards

### Backend / Worker
- All agents must write to `agent_runs` on start AND completion
- All agents must emit to `agent_events` after completion
- Never hardcode secrets — use `env.SECRET_NAME`
- D1 queries: always use prepared statements, never string interpolation
- Batch size limits: ip-api.com = 100 IPs/request, 45 req/min max

---

## 5. Design System Quick Reference

### Colors
```
Afterburner:       #E5A832   Primary accent — CTAs, active states, nav highlights
Wing Blue:         #0A8AB5   Secondary accent, info states
Signal Red:        #C83C3C   Alerts, critical, logo
Signal Red Deep:   #6B1010   Logo gradient start (Deep Arrow: #6B1010 → #C83C3C)
Deep Space:        #080C14   Primary dark background
Instrument Panel:  #111827   Card/panel backgrounds
Instrument White:  #E8ECF1   Primary text on dark
Gauge Gray:        #8896AB   Secondary text

Orbital Teal:      #00d4ff   RESERVED — Observatory map beams + logo glow ONLY
Thrust:            #7aeaff   RESERVED — Observatory highlights only
Ring Glow:         #00b8d9   RESERVED — Observatory border accents only

Severity palette:
  Critical: #f87171    High: #fb923c    Medium: #fbbf24
  Low: #78A0C8         Clean: #4ade80
```

### Stat Card Pattern (all detail views)
```
Layout: detail-rows LEFT | vertical divider | big metric RIGHT
Left:   6px dot + label (text-[11px] text-white/60) + count (text-[11px] font-mono)
Right:  32px bold metric + 9px muted label below
Outer:  rounded-xl border border-white/10 bg-cockpit p-4
Title:  font-mono text-[9px] uppercase tracking-widest text-contrail/70
```

### Tailwind Custom Tokens (tailwind.config.ts)
```
New primary:    bg-afterburner, text-afterburner, border-afterburner-border
New secondary:  bg-wing-blue, text-wing-blue, border-wing-blue-border
New alert:      bg-signal-red, text-signal-red, border-signal-red-border
New neutrals:   bg-deep-space, bg-instrument-panel, bg-panel-highlight
New text:       text-instrument-white, text-gauge-gray
New glass:      .glass-card, .glass-sidebar, .glass-elevated, .glass-stat, .glass-input
Light theme:    bg-cloud, bg-warm-cream, text-ink, text-slate

Legacy (still available): bg-cockpit, text-contrail, bg-orbital-teal, etc.
```

---

## 6. Agent Architecture Rules

The platform uses an event-driven agent mesh. Follow these rules:

### Every agent must:
1. Log a row to `agent_runs` at start: `status = 'success'`, `completed_at = NULL`
2. Update `agent_runs` on completion with `completed_at` and `records_processed`
3. Emit to `agent_events` after completion so Flight Control can trigger downstream agents
4. Handle errors gracefully — catch all exceptions, log to `agent_runs.error_message`

### Agent trigger chain (do not break this):
```
Sentinel → [agent_events: feed_pulled] → Cartographer
Cartographer → [agent_events: threats_enriched] → Nexus
Nexus → [agent_events: cluster_detected] → Analyst + Observer (if high severity)
Nexus → [agent_events: pivot_detected] → Observer (immediate)
Analyst → [agent_events: scores_updated] → Pathfinder (if new high-value leads)
```

### AI usage rules:
- Haiku: classification, scoring, short summaries — high volume tasks
- Sonnet: threat actor narratives, cluster briefs — run sparingly
- NEVER use AI to do what SQL GROUP BY can do — correlation is SQL, narrative is AI
- All AI calls go through Cloudflare AI Gateway

### Cron schedule (wrangler.toml):
```
Sentinel:     every 30 min  ("*/30 * * * *")
Cartographer: every 15 min  ("*/15 * * * *") — also triggered by Sentinel
Nexus:        every 4 hours ("0 */4 * * *")  — also triggered by Cartographer
Analyst:      every 30 min  ("*/30 * * * *") — also triggered by Nexus
Observer:     daily at 00:00 ("0 0 * * *")   — also triggered by Nexus pivot events
```

---

## 7. API Conventions

- All public endpoints: `GET/POST /api/v1/...`
- All internal agent triggers: `POST /api/internal/agents/:name/run`
  - Gated by `Authorization: Bearer ${env.INTERNAL_SECRET}`
- All admin endpoints: `GET/POST /api/admin/...`
  - Require JWT with `role: admin`
- New endpoints must be added to `AVERROW_API_REFERENCE.md`
- Never duplicate an existing endpoint — check the reference first

### Standard response format:
```typescript
// Success
{ data: T, meta?: { total, page, limit } }

// Error
{ error: string, code?: string }
```

---

## 8. Database Rules

- Database: `trust-radar-v2` (D1, SQLite)
- Never DROP or ALTER existing columns without explicit instruction
- Always add new columns with `ALTER TABLE ... ADD COLUMN` (not recreating tables)
- New migrations go in `src/migrations/` and must be documented in AVERROW_MASTER_PLAN.md
- Migration naming: `NNNN_description.sql` (e.g. `0023_add_actor_profiles.sql`)
- Always use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE` for upserts — never
  run SELECT then INSERT — race conditions in concurrent workers

### Key tables quick reference:
```
threats              — Core threat intelligence (52K+ rows)
hosting_providers    — ASN/provider enrichment
infrastructure_clusters — Nexus correlation output
agent_events         — Inter-agent event queue
agent_runs           — Agent execution log
agent_outputs        — AI-generated insights
campaigns            — Threat campaign groupings
brands               — Brand registry
organizations        — Multi-tenant org layer
```

---

## 9. PR and Merge Workflow

### After every commit:
```bash
# 1. Build check
cd packages/averrow-ui && npm run build
cd ../trust-radar && tsc --noEmit

# 2. Push and open PR
git push origin HEAD
gh pr create --title "feat: [description]" --body "[what changed and why]"

# 3. Enable auto-merge immediately
gh pr merge --auto --squash $(gh pr list --head $(git branch --show-current) --json number -q '.[0].number')
```

### Auto-merge is required on every PR
Do not wait for manual merge approval. Enable auto-merge immediately after PR creation.
CI acts as the gate — if build passes, it merges automatically.

### Commit message format:
```
feat(scope): description       ← new feature
fix(scope): description        ← bug fix
refactor(scope): description   ← code cleanup, no behavior change
chore(scope): description      ← build, deps, config
docs(scope): description       ← documentation only
```

Examples:
```
feat(nexus): infrastructure cluster correlation, pivot detection
fix(cartographer): increase batch size to 500, fix cron timing
refactor(brands-hub): extract BrandRow to shared component
```

---

## 10. What NOT to Build Without Explicit Instruction

- Do not add new npm packages without checking if existing ones cover the need
- Do not add new API endpoints for data that can be derived client-side
- Do not add loading skeletons to views that already have them
- Do not refactor working code during a bug fix session — one thing at a time
- Do not modify the old SPA files under any circumstances
- Do not push directly to `main` — always use feature branches + PR + auto-merge
- Do not use `console.log` in production code — use the agent_runs error logging pattern
- Do not create duplicate utility functions — check `src/lib/` first

---

## 11. Session Checklist (Before Marking Complete)

Before ending any session, verify:

- [ ] `tsc --noEmit` passes in both packages with zero errors
- [ ] `npm run build` succeeds in averrow-ui
- [ ] No inline styles added (except dynamic severity colors)
- [ ] No old SPA files touched
- [ ] New API endpoints added to AVERROW_API_REFERENCE.md
- [ ] New agent logic follows agent_runs + agent_events pattern
- [ ] AVERROW_DESIGN_SYSTEM_BRIEF.md updated if new UI patterns were locked in
- [ ] AVERROW_MASTER_PLAN.md updated if architecture changed
- [ ] PR opened and auto-merge enabled
- [ ] Commit message follows `type(scope): description` format

---

## 12. Platform Context (Read This Once)

Averrow is a **threat actor intelligence platform** — not just brand protection.

The goal is to identify WHO is conducting attacks, HOW they operate, WHERE they move
infrastructure, and get ahead of them. Threats are evidence. Patterns are the product.

**The customer ROI story:**
- Replaces 2-3 security analyst headcount
- Protects brand equity (irreplaceable once damaged)
- Protects customers (the real victims of impersonation attacks)
- Quantifiable: analyst-hours replaced, takedowns completed, breach exposure prevented

**The competitive gap:**
No mid-market platform connects infrastructure correlation → brand protection →
threat actor profiling → predictive intelligence at this price point.

**Key agents and their purpose:**
- Sentinel: feed ingestion (eyes)
- Cartographer: geo/ASN enrichment (location)
- Nexus: infrastructure correlation (brain)
- AI Detector: synthetic attack detection (instinct)
- Analyst: brand risk scoring (judgment)
- Observer: narrative briefings (voice)
- Sparrow: takedown execution (action)
- Flight Control: supervision + orchestration (command)

**The rule:** SQL does correlation. AI does narrative.
Never pay AI tokens to do what GROUP BY can do in 50ms.
