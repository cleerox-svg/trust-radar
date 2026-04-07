# AVERROW CODE REVIEW & REFACTOR PLAN
## Post-Demo Phase — Efficiency, Standards, Scalability

**Principle:** All fixes must be proper, efficient, and scalable. No bandaids. Solve it right the first time.

---

## CODEBASE OVERVIEW

| Area | Files | Lines | Status |
|------|-------|-------|--------|
| Server (TypeScript) | 177 | 46,109 | Functional but bloated |
| SPA (app.js) | 1 | 9,245 | Monolithic, inline styles |
| SPA (styles.css) | 1 | 3,592 | !important overrides |
| Migrations | 44 | ~2,000 | Accumulating |
| **Total** | **~180** | **~59,000** | |

---

## PHASE 1: DELETE DEAD CODE (Day 1)

### 1.1 Remove deprecated files
- `templates/landing.ts` (2,260 lines) — old Trust Radar homepage, no longer routed
- Any unused imports in `index.ts` referencing landing.ts
- Search for other dead code: `grep -rn "function.*{" src/ --include="*.ts" | wc -l` then cross-reference what's actually imported

### 1.2 Remove temporary/debug endpoints
- `/api/admin/pathfinder-debug` — already removed ✓
- `/api/spam-trap/reparse-auth` — keep (useful maintenance tool)
- Audit all routes in index.ts: are any unused or duplicated?

### 1.3 Remove console.log statements
```bash
grep -rn "console\.log\|console\.error\|console\.warn" src/ --include="*.ts" | grep -v node_modules
```
Keep error logging in catch blocks. Remove debug/development logs.

**Estimated savings: ~2,500 lines**

---

## PHASE 2: SPLIT index.ts (Day 1-2)

### Problem
`index.ts` is 1,979 lines — a god file with every route definition, all imports, middleware setup, email handler, cron handler, and utility functions.

### Solution — Route module pattern
Split into:
```
src/
  index.ts              (~200 lines — app setup, middleware, cron)
  routes/
    public.ts           (public pages — /, /platform, /pricing, etc.)
    auth.ts             (OAuth routes — /api/auth/*)
    scan.ts             (scan routes — /api/scan/*)
    brands.ts           (brand routes — /api/brands/*)
    admin.ts            (admin routes — /api/admin/*)
    tenant.ts           (tenant routes — /api/orgs/*)
    agents.ts           (agent routes — /api/agents/*)
    spam-trap.ts        (spam trap routes — /api/spam-trap/*)
    takedowns.ts        (takedown routes)
    email-security.ts   (email security routes)
    export.ts           (export/report routes)
```

Each route file exports a function that registers routes on the router:
```typescript
export function registerBrandRoutes(router: Router, env: Env) {
  router.get("/api/brands", ...);
  router.get("/api/brands/:id", ...);
  // etc
}
```

index.ts becomes:
```typescript
import { registerPublicRoutes } from "./routes/public";
import { registerBrandRoutes } from "./routes/brands";
// etc

registerPublicRoutes(router);
registerBrandRoutes(router);
// etc
```

---

## PHASE 3: CONSOLIDATE DATABASE QUERIES (Day 2-3)

### Problem
Same queries are written inline in multiple handlers. No query layer.

### Solution — Data access layer
Create `src/db/` with typed query functions:
```
src/db/
  brands.ts        (getBrandById, listBrands, getBrandThreats, etc.)
  threats.ts       (getThreatsByBrand, getThreatsByProvider, etc.)
  email-security.ts (getEmailScan, listScans, etc.)
  spam-trap.ts     (getCapture, listCaptures, etc.)
  sales-leads.ts   (getLead, listLeads, createLead, etc.)
  agent-runs.ts    (createRun, updateRun, getLatestRun, etc.)
```

Each function:
- Takes `env: Env` + typed parameters
- Returns typed results
- Contains the SQL in one place
- Handles errors consistently

Example:
```typescript
// src/db/brands.ts
export async function getBrandById(env: Env, id: string): Promise<Brand | null> {
  return env.DB.prepare("SELECT * FROM brands WHERE id = ?")
    .bind(id)
    .first<Brand>();
}

export async function getBrandWithThreats(env: Env, id: string, days: number = 30): Promise<BrandWithThreats> {
  const brand = await getBrandById(env, id);
  const threats = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM threats WHERE target_brand_id = ? AND created_at > datetime('now', ? || ' days')"
  ).bind(id, -days).first<{c: number}>();
  return { ...brand, recentThreats: threats?.c ?? 0 };
}
```

### Audit first
```bash
grep -rn "env\.DB\.prepare" src/ --include="*.ts" | wc -l
```
Count total inline queries. Group by table. Identify duplicates.

---

## PHASE 4: TYPE SAFETY (Day 3-4)

### Problem
Types are scattered, some are `any`, some are inline.

### Solution
Create `src/types/` with comprehensive type definitions:
```
src/types/
  brand.ts         (Brand, BrandWithScores, BrandDetail)
  threat.ts        (Threat, ThreatSignal, Campaign)
  email.ts         (EmailSecurityScan, DmarcReport)
  agent.ts         (AgentRun, AgentOutput, AgentConfig)
  lead.ts          (SalesLead, LeadScoring)
  organization.ts  (Organization, OrgBrand, OrgMember)
  takedown.ts      (TakedownRequest, TakedownStatus)
  spam-trap.ts     (SpamTrapCapture, SeedAddress)
  api.ts           (ApiResponse, PaginatedResponse, ErrorResponse)
```

Remove all `as Record<string, unknown>` casts in handlers — use proper request body types.

---

## PHASE 5: SPA REFACTOR — app.js (Day 4-7)

### Problem
9,245 lines in one file. 1,050 inline styles. Each view is a self-contained function with its own HTML template literals.

### Phase 5A: Extract CSS (Day 4-5)
Define a component class library in styles.css:
```css
/* Layout */
.page-header { }
.content-grid { }
.two-col { }

/* Cards */
.card { }
.card-header { }
.card-body { }
.stat-card { }
.metric-card { }

/* Tables */
.data-table { }
.data-table th { }
.data-table td { }

/* Badges */
.badge { }
.badge-critical { }
.badge-high { }
.badge-medium { }
.badge-low { }
.badge-success { }

/* Buttons */
.btn-primary { }
.btn-secondary { }
.btn-ghost { }
.btn-danger { }

/* Forms */
.input { }
.select { }
.textarea { }

/* Filters */
.pill-group { }
.pill { }
.pill-active { }
```

Then systematically replace inline styles view by view.

### Phase 5B: Split into modules (Day 5-7)
If build tooling allows, split app.js into modules:
```
public/
  app.js            (router, auth, shared components — ~1,000 lines)
  views/
    observatory.js  (map view)
    brands.js       (brand hub + detail)
    providers.js    (provider hub + detail)
    campaigns.js    (campaign hub + detail)
    agents.js       (agent operations + detail)
    admin.js        (admin dashboard, users, feeds, audit)
    spam-trap.js    (spam trap command center)
    takedowns.js    (takedown views)
    tenant.js       (tenant views)
    leads.js        (lead management)
```

NOTE: Since this is a Cloudflare Worker serving static files, module splitting may require a bundler step or using ES modules with import maps. Evaluate whether the complexity is worth it vs just having well-organized sections in one file.

### Phase 5C: Remove !important overrides (Day 7)
Once inline styles are replaced with classes, remove all !important declarations from styles.css. These were a temporary bridge.

---

## PHASE 6: HANDLER CONSOLIDATION (Day 7-8)

### Problem
Some handlers are large with repetitive patterns (brands.ts = 1,424 lines, admin.ts = 1,208 lines).

### Solution
Extract shared patterns:
```typescript
// src/lib/handler-utils.ts
export function paginated(query: string, countQuery: string, bindings: any[]) {
  // Standard pagination logic used by 15+ endpoints
}

export function withOrgAccess(handler: Function) {
  // Wraps handler with org membership verification
}

export function withAdminAccess(handler: Function) {
  // Wraps handler with admin role check
}
```

---

## PHASE 7: AGENT PIPELINE OPTIMIZATION (Day 8-9)

### Audit
- How many D1 queries does each agent make per run?
- Are there N+1 query patterns? (loop → query per item)
- Can queries be batched?

### Specific improvements
- Sentinel: batch insert threat signals instead of one-at-a-time
- ASTRA: batch brand assessments
- Navigator: batch geo enrichment lookups
- Pathfinder: already optimized with Promise.all ✓

### Cron scheduling
- Review cron intervals — are any agents running too frequently?
- Add jitter to prevent all agents hitting D1 simultaneously

---

## PHASE 8: PERFORMANCE AUDIT (Day 9-10)

### D1 Query Performance
```sql
-- Find missing indexes
SELECT * FROM sqlite_master WHERE type='index' ORDER BY name;
```
Cross-reference with common query WHERE clauses. Add indexes where needed.

### Worker Bundle Size
Current: 1,546 KiB (304 KiB gzipped)
Target: under 1,000 KiB
- Tree-shake unused imports
- Remove dead code (Phase 1)
- Evaluate if any large dependencies can be replaced

### Response Times
- Add timing to critical endpoints
- Identify slow queries
- Add caching (KV) for expensive reads that don't change often (brand list, feed status)

---

## EXECUTION ORDER

| Phase | What | Days | Impact |
|-------|------|------|--------|
| 1 | Delete dead code | 1 | Quick wins, smaller bundle |
| 2 | Split index.ts | 1-2 | Maintainability |
| 3 | Data access layer | 2-3 | No more duplicate queries |
| 4 | Type safety | 1-2 | Developer experience |
| 5A | SPA CSS extraction | 2 | Remove !important hacks |
| 5B | SPA module split | 2-3 | Maintainability |
| 6 | Handler consolidation | 1-2 | Less repetition |
| 7 | Agent optimization | 1-2 | Performance |
| 8 | Performance audit | 1-2 | Speed + efficiency |
| **Total** | | **~12-18 days** | |

---

## CODING STANDARDS (enforce going forward)

1. **No inline styles in app.js** — use CSS classes
2. **No inline SQL** — use db/ layer functions
3. **No untyped responses** — every API response is typed
4. **No god files** — max 500 lines per file, split at 300
5. **Every query has an index** — if WHERE clause, there's an index
6. **Error handling** — every async has try/catch, errors are typed
7. **Naming** — camelCase functions, PascalCase types, SCREAMING_SNAKE constants
8. **One responsibility per function** — if it does two things, split it
