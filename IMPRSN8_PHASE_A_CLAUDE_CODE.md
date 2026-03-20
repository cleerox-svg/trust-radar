# imprsn8 — Phase A: UI Rebuild & Audit
## Claude Code Instruction Document

---

## Context

`packages/imprsn8` is a Cloudflare Worker SPA inside the `cleerox-svg/trust-radar` monorepo. The backend is substantially complete — 35+ routes covering auth, influencers, threats, takedowns, agents, feeds, invites, compliance, campaigns, and socials are all wired in `src/index.ts`. The D1 database has 18 applied migrations.

**What broke:** The UI template layer (`src/templates/homepage.ts` and `src/templates/dashboard.ts`) was previously coupled to Trust Radar's design system and must be completely replaced. There may also be broken imports or stale references in handler files.

**Serving architecture (important):** The Worker has two parallel mechanisms:
- `/` and `/dashboard` → server-rendered TypeScript template functions (keep this pattern)
- All other non-API routes → `env.ASSETS.fetch` serving `public/index.html` as SPA fallback

The `public/index.html` file is the old broken UI remnant. It must be replaced with a clean redirect shell so any deep-linked URL (e.g. `/dashboard/influencer/123`) safely bounces to `/dashboard` rather than loading stale code.

**What this prompt does:**
1. Audits the full `src/` tree for broken imports, compile errors, and stale Trust Radar references
2. Replaces `public/index.html` with a clean redirect shell
3. Rebuilds the homepage template with imprsn8's new design identity
4. Rebuilds the dashboard template — full SPA with role-aware views (admin, staff, soc, influencer)
5. Verifies invite token logic is time-limited
6. Does NOT modify the router (`index.ts`), middleware, or migrations unless fixing a compile error. Handler files may only be modified for type fixes or to add the `auto_action_enabled` field to `handleUpdateProfile`.

---

## Step 1 — Audit

Run the following from `packages/imprsn8`:

```bash
npx tsc --noEmit 2>&1 | head -80
```

List all TypeScript errors. Then:

```bash
grep -r "trust-radar\|lrx-radar\|TrustRadar\|trustRadar\|lrxradar\|LRX_" src/ --include="*.ts"
```

List any stale cross-package references. Known items to flag:
- `src/lib/cors.ts` includes `lrxradar.com` origins in ALLOWED_ORIGINS
- `src/types.ts` has `LRX_API_URL` and `LRX_API_KEY` in the Env interface
- These are Trust Radar integration points — note them for future cleanup but do not modify in this phase

```bash
ls src/
ls src/handlers/
ls src/lib/
ls src/middleware/
ls src/templates/
```

Report the full directory tree of `src/`. Verify all required files exist (all handler files, lib files, middleware, templates, and types are already present in the codebase — no stubs should be needed).

**Required files (from router imports):**
- `src/handlers/auth.ts` — handleRegister, handleLogin, handleMe, handleUpdateProfile
- `src/handlers/admin.ts` — handleAdminListUsers, handleAdminUpdateUser
- `src/handlers/influencers.ts` — handleListInfluencers, handleGetInfluencer, handleCreateInfluencer, handleUpdateInfluencer
- `src/handlers/variants.ts` — handleListVariants, handleAddVariant, handleDeleteVariant
- `src/handlers/accounts.ts` — handleListAccounts, handleAddAccount, handleUpdateAccount, handleDeleteAccount
- `src/handlers/threats.ts` — handleListThreats, handleGetThreat, handleCreateThreat, handleUpdateThreat
- `src/handlers/takedowns.ts` — handleListTakedowns, handleCreateTakedown, handleUpdateTakedown
- `src/handlers/agents.ts` — handleListAgents, handleGetAgentRuns, handleTriggerAgent, runDueAgents
- `src/handlers/analysis.ts` — handleAnalyze, handleAnalysisHistory, handleScoreHistory
- `src/handlers/social.ts` — handleListSocials, handleAddSocial, handleDeleteSocial
- `src/handlers/campaigns.ts` — handleListCampaigns, handleCreateCampaign
- `src/handlers/stats.ts` — handleOverviewStats, handleAdminStats, handlePublicStats, handleBrandHealthScore
- `src/handlers/feeds.ts` — handleListFeeds, handleCreateFeed, handleUpdateFeed, handleDeleteFeed, handleTriggerFeed
- `src/handlers/invites.ts` — handleCreateInvite, handleListInvites, handleRevokeInvite, handleValidateInvite, handleDirectCreate
- `src/handlers/health.ts` — handleSystemHealth
- `src/handlers/compliance.ts` — handleListComplianceAudit, handleResolveComplianceItem
- `src/lib/cors.ts` — handleOptions, json
- `src/lib/feedRunner.ts` — runDueFeeds
- `src/middleware/auth.ts` — requireAuth, requireAdmin, isAuthContext
- `src/types.ts` — Env type and all domain interfaces
- `src/templates/homepage.ts` — renderImprsn8Homepage
- `src/templates/dashboard.ts` — renderImprsn8Dashboard

For any TypeScript errors in **existing** handler files, fix them minimally — type corrections only, no logic changes.

**Known type bug to fix:** In `src/handlers/invites.ts`, the `handleDirectCreate` function has `plan: "influencer" as "free"` — this incorrectly casts the role name as a plan tier. Change to `plan: "free"` (the actual plan value being used in the INSERT).

---

## Step 2 — Public Assets Cleanup

Create the `public/` directory if it doesn't exist, then add `index.html`:

```bash
mkdir -p public/
ls public/
cat public/index.html 2>/dev/null || echo "FILE MISSING"
```

**Regardless of what's there**, create (or replace) `public/index.html` with the following clean redirect shell. This file is served by `env.ASSETS` for any URL that doesn't match `/`, `/dashboard`, or `/api/*`. Its only job is to redirect to `/dashboard` so deep-linked URLs don't 404 or load stale code:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=/dashboard">
  <title>imprsn8</title>
  <style>
    body { background: #07070E; color: #F5F0E8; font-family: sans-serif;
           display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; }
  </style>
  <script>window.location.replace('/dashboard');</script>
</head>
<body>Redirecting…</body>
</html>
```

If any other files exist in `public/` (old JS bundles, CSS, etc.) that belong to the previous imprsn8 UI, delete them. The only file that should exist in `public/` is `index.html`.

---

## Step 3 — Invite Token Audit

Open `src/handlers/invites.ts` and `src/handlers/auth.ts`. Verify the following are all present (they should already be implemented — confirm, do not modify):

1. **Expiry on creation:** `handleCreateInvite` generates a cryptographically secure token (32 random bytes → 64-char hex) with a configurable `expires_at` timestamp (1-30 days, default 7 days). This is already implemented via `expires_days * 86_400_000`.

2. **Validation checks:** `handleValidateInvite` checks both `used_at` (rejects with 410 if already used) and `expires_at < now` (rejects with 410 if expired). Both checks are already present.

3. **Mark as used on registration:** `handleRegister` in `src/handlers/auth.ts` validates the invite token (checking `used_at` and `expires_at`), then after successful user creation marks it used via `UPDATE invite_tokens SET used_at = datetime('now'), used_by_user_id = ? WHERE id = ?`. This is already implemented.

**No changes should be needed.** If any of these checks are missing, add them. Do not change anything else in the invite handlers.

---

## Step 4 — Homepage Template

Replace `src/templates/homepage.ts` entirely with the following implementation.

The homepage is a **pure TypeScript function** that returns an HTML string. No React, no build step — it is server-rendered HTML served directly from the Worker.

```typescript
export function renderImprsn8Homepage(): string {
  return `<!-- full HTML string here — see design spec below -->`
}
```

### Homepage Design Spec

**Concept:** "You are the signal." — A dark, luxury intelligence platform landing page for creators. Not a SaaS landing page. Not a startup template. A bespoke platform that feels like it was built for A-list talent.

**Typography:**
- Display font: `Syne` (Google Fonts, weights 700 800) — geometric, futuristic
- Body font: `DM Sans` (Google Fonts, weights 300 400 500)
- Mono font: `DM Mono` (Google Fonts, weight 400 500) — for handles, IDs, stats

**Color palette (CSS variables):**
```css
--void:       #07070E;   /* base */
--surface:    #0D0D1B;   /* cards */
--surface-2:  #121224;   /* elevated */
--border:     #1E1E38;
--border-2:   #2A2A45;
--a1:         #8B5CF6;   /* violet — identity */
--a2:         #2DD4BF;   /* teal — safe/verified */
--a3:         #F59E0B;   /* gold — warning */
--threat:     #FF3B5C;   /* red — critical */
--text:       #F5F0E8;   /* champagne white */
--text-2:     #8B8BA7;   /* muted */
--text-mono:  #A8B2D8;   /* code/handles */
```

**Sections to include:**

1. **Nav** — `imprsn8` logo (Syne 800, aurora gradient text), nav links: Features / Pricing / Login, CTA button "Request Access" (aurora gradient bg)

2. **Hero** — Full-width dark section. Large Syne headline: "Your identity. Defended." Subheadline in DM Sans. Two CTAs: "Get Protected" (aurora gradient) and "See How It Works" (ghost). Below the headline: an animated stats ticker showing three numbers: `14,200+ threats neutralized` / `6 platforms monitored` / `99.2% detection accuracy` — numbers rendered in Syne with aurora gradient, labels in DM Mono.

3. **How It Works** — Three steps in a horizontal card row:
   - Step 1: "Map Your Identity" — We fingerprint your verified handles, bio, avatar, and brand signals across all platforms
   - Step 2: "Detect Imposters" — AI continuously scans for lookalike accounts using name variants, avatar matching, and behavioral signals
   - Step 3: "Neutralize Threats" — Automated takedown workflows with human oversight. Platform reports, DMCA notices, legal escalation.
   Each card has a step number in massive Syne text (opacity 0.08) as background decoration, an aurora-accented icon, and the text.

4. **Platform Coverage** — "We watch every platform." Four platform pills in a row: Instagram / TikTok / X (Twitter) / YouTube — each with a subtle icon glyph and "Monitored" label in DM Mono.

5. **For Who** — Three column cards: Influencers & Creators / Talent Agencies / Brand Teams. Each with a brief description. Cards have top border accent in aurora colors (violet / teal / gold respectively).

6. **CTA Section** — Dark panel with aurora gradient border. "Ready to protect your identity?" heading. Email input + "Request Access" button.

7. **Footer** — Logo, copyright, links: Privacy / Terms / Contact. `imprsn8.com` in DM Mono.

**Visual details:**
- Body background: `#07070E`
- Fixed ambient orbs using `::before`/`::after` pseudo-elements on body: large radial gradients in violet and teal at very low opacity (0.05-0.07) at top-left and bottom-right corners
- Subtle grain texture overlay using SVG filter noise on body
- All section transitions: no sharp edges, sections blend into void background
- Card hover states: slight border highlight + `translateY(-2px)`
- Nav: `position: sticky`, background `rgba(7,7,14,0.85)` with `backdrop-filter: blur(12px)`

---

## Step 5 — Dashboard Template

Replace `src/templates/dashboard.ts` entirely.

The dashboard is a **full SPA** served as a single HTML string from the Worker. All UI logic is vanilla TypeScript/JavaScript embedded in a `<script>` tag. The frontend fetches data from the existing API routes.

```typescript
export function renderImprsn8Dashboard(): string {
  return `<!-- full HTML SPA string -->`
}
```

### Dashboard Architecture

The SPA:
1. On load: calls `GET /api/auth/me` with Bearer token from `localStorage.getItem('imprsn8_token')`
2. If 401: redirects to `/` (homepage) with `?login=1` query param which triggers the login modal
3. On success: reads `user.role` and renders the appropriate view
4. Role views: `admin` and `staff` see the **Roster view** by default. `soc` sees the **Signals view** by default. `influencer` sees their **Profile view**.

### Login Flow (on homepage)

When `?login=1` is in the URL OR user clicks "Login":
- Show a centered modal overlay on the homepage
- Fields: Email, Password
- On submit: `POST /api/auth/login` → store token → redirect to `/dashboard`
- Link: "Have an invite code? Register here" → shows register modal
- Register modal: checks `?invite=TOKEN` URL param if present (pre-fills invite field), fields: Name / Email / Password / Invite Code

### Dashboard Layout

Same sidebar + main layout as the UI concept. Use identical CSS variables and fonts.

**Sidebar nav items by role:**

> **Note:** The codebase defines `UserRole = "influencer" | "staff" | "soc" | "admin"` in `src/types.ts`. All role checks in the SPA must use these exact values from the `user.role` field returned by `GET /api/auth/me`.

`admin`:
- ⬡ Roster
- ◈ Signals (badge: unread count)
- ◉ Operations (badge: draft/submitted HITL count)
- ⊡ Influencers
- ⊞ Staff
- ⊕ Invites
- ◷ Scan History
- ⊘ Reports
- ⊙ Settings

`staff`:
- ⬡ My Roster
- ◈ Signals (badge)
- ◉ Operations (badge)
- ◷ Scan History
- ⊘ Reports

`soc` (Security Operations Center analyst):
- ◈ Signals (badge: unread count)
- ◉ Operations (badge)
- ⊡ Threats
- ◷ Scan History
- ⊘ Compliance

`influencer`:
- ◈ My Threats
- ◉ Actions
- ⊡ My Accounts
- ⊙ Settings

### Views to implement:

**1. Roster View** (`admin` + `staff` default)

Fetches: `GET /api/overview` + `GET /api/influencers`

Layout:
- 4 stat cards: Protected Identities / Active Threats / HITL Queue / Resolved This Month
- Active scan bar (if any scan job is running — poll `GET /api/agents/runs` every 30s)
- Tab bar: All Clients / At Risk / Pending Action / Monitoring
- Influencer dossier cards (see design below)
- Right column: Live Signal Feed (`GET /api/threats?limit=10&sort=recent`) + Operations Queue (`GET /api/takedowns?status=draft`)

**Influencer Dossier Card design:**
- Avatar with animated ring (threat-ring for CRITICAL, slow-spin aurora for safe)
- Display name (Syne 600) + primary handle (DM Mono)
- Platform status chips: TT / IG / YT / X — each with a colored dot (red=critical threats, amber=high, teal=clear)
- Risk score (Syne 800, color-coded) + tier pill (CRITICAL/HIGH/MEDIUM/LOW/CLEAR)
- Threat count summary
- Clicking opens the influencer detail panel (slide-in from right or navigate to detail view)

**2. Influencer Detail View**

Fetches: `GET /api/influencers/:id` + `GET /api/threats?influencer_id=:id` + `GET /api/accounts?influencer_id=:id` + `GET /api/takedowns?influencer_id=:id`

Sections:
- Header: name, handles, avatar, risk score ring, last scan time
- Tab bar: Threats / Accounts / Actions / History
- Threats tab: filterable list by platform + tier, each threat shows handle, platform, risk score, AI reasoning snippet, status pill, action button
- Accounts tab: verified accounts grid with platform, handle, follower count, last verified date. "+ Add Account" button calls `POST /api/accounts`
- Actions tab: takedown pipeline — draft / submitted / resolved columns (kanban-style)
- History tab: scan job timeline

**3. Signals View**

Fetches: `GET /api/threats?status=new&sort=score_desc`

Full-width feed of threat signals. Each row:
- Left severity bar (color by tier)
- Handle + platform pill
- AI reasoning excerpt
- Risk score badge
- Time ago
- Action buttons: "Review" / "Dismiss" / "Act Now"
- Filter bar: All / CRITICAL / HIGH / MEDIUM + platform filter chips

**4. Operations View (HITL Queue)**

Fetches: `GET /api/takedowns?status=draft` (also show `status=submitted` items)

> **Note:** The `TakedownStatus` type uses `"draft" | "submitted" | "acknowledged" | "in_review" | "resolved" | "rejected"`. There is no "pending" status. The HITL queue should show `draft` (awaiting first approval) and `submitted` (awaiting platform response) items.

Each operation card:
- Icon by action type (report 🚩 / dmca ⚖️ / legal 📋)
- Influencer name + threat handle
- Action description
- "Approve" (teal) / "Reject" (red) buttons → `PATCH /api/takedowns/:id`
- For DMCA: "Review Draft" expands the generated notice text inline before approving

**5. Influencer Profile View** (`influencer` role default)

Fetches: `GET /api/auth/me` + `GET /api/threats` (scoped to their influencer_id via backend) + `GET /api/accounts`

Layout (single column, no roster):
- Header: their name, avatar, "Your Identity Score" ring (brand health score)
- **Auto-Action toggle**: "Let my team handle everything" — calls `PATCH /api/profile` with `{ auto_action_enabled: true/false }`. When ON: shows "Your staff manager reviews all actions." When OFF: shows "You review actions before they're submitted."
  > **Requires handler change:** `handleUpdateProfile` in `src/handlers/auth.ts` currently only accepts `display_name`, `bio`, `username`. Add `auto_action_enabled: z.boolean().optional()` to its `UpdateSchema` and persist it to the users table. A migration to add the `auto_action_enabled` column may also be needed.
- Threat summary: counts by tier with aurora-colored progress bars
- Recent threats list (simplified — handle, platform, risk score, status)
- "Mark Safe" button on each threat → `PATCH /api/threats/:id` with `{ status: "dismissed" }`
- My Accounts section: list of their verified accounts + "+ Add Account" button
- If no staff manager assigned: show a soft callout "Connect with a talent manager to unlock full protection and automated takedowns."

**6. Invites View** (`admin` only)

Fetches: `GET /api/admin/invites`

Table: Token (DM Mono, truncated) / Role / Intended For / Created / Expires / Status (active/expired/used) / Revoke button

"+ Create Invite" button → modal:
- Fields: Role (select: staff / influencer) / Intended for (name/email, optional note) / Assign to Influencer (select — required, as invites are always linked to an influencer profile)
- On create: calls `POST /api/admin/invites` → shows the generated invite URL to copy: `https://imprsn8.com/register?invite=TOKEN`
- Token expires per admin-configured duration (1-30 days, default 7 days — enforced server-side via `expires_days` param)

---

## Step 6 — Build Verification

After all changes:

```bash
cd packages/imprsn8
npx tsc --noEmit
```

Zero errors required.

```bash
pnpm dev
```

Confirm Worker starts on port 4001. Hit:
- `http://localhost:4001/` → homepage renders (200, text/html)
- `http://localhost:4001/dashboard` → dashboard SPA renders (200, text/html)
- `http://localhost:4001/health` → `{ status: "ok", service: "imprsn8" }`
- `http://localhost:4001/api/debug` → all checks report status (DB checks may fail locally without secrets, that's expected)

---

## Step 7 — Deploy Check

```bash
pnpm deploy:imprsn8
```

Confirm deploy succeeds. Do not verify live domain — just confirm Wrangler reports a successful upload.

---

## Constraints

- **DO NOT** modify `src/index.ts` (the router) except to fix a TypeScript compile error
- **DO NOT** modify any migration files (a new migration may be added for `auto_action_enabled` column if needed)
- **DO NOT** change the `wrangler.toml`
- **DO NOT** add new npm dependencies without noting them — the project uses `itty-router` and standard Web APIs
- **DO NOT** connect any UI logic to Trust Radar routes or Trust Radar domain
- All new UI code uses vanilla JS in `<script>` tags — no React, no Vite, no bundler
- All fonts loaded from Google Fonts CDN in the HTML `<head>`
- All colors and typography must match the design spec in Steps 4 and 5 exactly — this is a distinct product with its own identity, not a reskin of Trust Radar
- All role values in the SPA must use the actual `UserRole` type: `"influencer" | "staff" | "soc" | "admin"` — do not use `super_admin` or `talent_manager`

---

## Summary of Deliverables

| File | Action |
|---|---|
| `public/index.html` | Create directory if needed, add redirect shell, delete any other public/ files |
| `src/templates/homepage.ts` | Full replacement |
| `src/templates/dashboard.ts` | Full replacement |
| `src/handlers/auth.ts` | Add `auto_action_enabled` to `handleUpdateProfile` schema |
| `src/handlers/invites.ts` | Fix `signJWT` type bug (`plan: "influencer"` → `plan: "free"`) |
| `src/handlers/*.ts` (existing, compile errors) | Minimal type fixes only |
| `src/handlers/invites.ts` | Verify expiry + used_at logic (already implemented — no changes expected) |
| `migrations/` | Add migration for `auto_action_enabled` column if needed |
| All other files | Read-only — no modifications |
