# imprsn8 — Platform Design Brief
### Complete Feature, UX & Design System Reference
*Version 1.0 — March 2026*

---

## Table of Contents

1. [What This Platform Does](#1-what-this-platform-does)
2. [Who Uses It — User Roles](#2-who-uses-it--user-roles)
3. [Full Page & Feature Inventory](#3-full-page--feature-inventory)
4. [Design System — Colors](#4-design-system--colors)
5. [Design System — Typography](#5-design-system--typography)
6. [Design System — Component Classes](#6-design-system--component-classes)
7. [Current Visual Style Description](#7-current-visual-style-description)
8. [Navigation & Layout Architecture](#8-navigation--layout-architecture)
9. [AI Agents — The Intelligence Layer](#9-ai-agents--the-intelligence-layer)
10. [Data Feeds — The Input Layer](#10-data-feeds--the-input-layer)
11. [Key Data Types & Domain Vocabulary](#11-key-data-types--domain-vocabulary)
12. [Design Improvement Opportunities](#12-design-improvement-opportunities)

---

## 1. What This Platform Does

**imprsn8** is a real-time **brand protection and digital identity threat intelligence platform** built for influencers, public figures, and content creators.

The core problem it solves: famous people (YouTubers, TikTokers, athletes, musicians, etc.) are constantly being impersonated online — fake accounts steal their name, avatar, and bio across Instagram, TikTok, X, YouTube, and a dozen other platforms to scam their fans, sell counterfeit merchandise, or damage their reputation. Finding and removing these fakes is a full-time job. imprsn8 automates it.

### Core capabilities (in plain language):

| Capability | What it does |
|---|---|
| **24/7 automated scanning** | AI agents continuously monitor social platforms for suspicious accounts |
| **Threat intelligence feed** | Surfaces every potential impersonator with a similarity score and severity rating |
| **OCI scoring** | "Online Clone Indicator" — a 0–100 score measuring how closely a suspect account mimics the real person (avatar match, bio copy, handle similarity, posting cadence) |
| **Automated takedown pipeline** | One-click preparation of DMCA notices, platform Trust & Safety reports, trademark claims — tracked from draft to resolved |
| **Impression Score** | An AI-generated 0–100 brand health score across Clarity, Impact, Consistency, and Professionalism — for the influencer's own accounts |
| **Human-in-the-loop gates** | No takedown is filed without a SOC Analyst's explicit approval — all AI recommendations require human sign-off |
| **Multi-platform coverage** | Monitors 14+ platforms: TikTok, Instagram, X, YouTube, Facebook, LinkedIn, Twitch, Threads, Snapchat, Pinterest, Bluesky, Reddit, GitHub, Mastodon |

---

## 2. Who Uses It — User Roles

The platform has four roles with strictly enforced access boundaries:

### `influencer` — The Protected Person
- Views their own brand score and impression analytics
- Sees threats and takedown status related to their profile only
- Cannot see or modify other influencers' data
- Landing page after login: simplified Overview + Brand Score

### `staff` — The Influencer's Team
- Read-only access to the assigned influencer's dashboard
- Can view threats, takedowns, monitored accounts
- Cannot create reports, trigger agents, or modify data

### `soc` — SOC Analyst
- Full access to all influencer data (across all managed clients)
- Creates and reviews impersonation reports
- **The only role that can authorise takedowns** (human-in-the-loop)
- Can manually trigger AI agents and view all run history
- Manages monitored accounts and handle variants

### `admin` — Platform Operator
- Everything a SOC analyst can do, plus:
- Access to Admin Console (user management, influencer creation)
- System health dashboard (DB stats, agent uptime)
- Can create invite links and direct-create user accounts
- Manages data feed credentials and pull schedules

---

## 3. Full Page & Feature Inventory

### PUBLIC — Home Page (`/`)

The marketing landing page. Dark with purple/pink gradient accents.

**Sections:**
1. **Hero** — Headline "Protect your digital identity before it's stolen", CTA buttons
2. **Live stats strip** — Animated counters: Influencers Protected · Accounts Monitored · Threats Detected · Takedowns Filed
3. **Score preview** — Animated mini circular progress rings (Clarity 88, Impact 74, Consistency 92, Professional 81)
4. **Threat types grid** — 4 cards: Fake accounts, Username squatting, Bio impersonation, Content theft
5. **Feature grid (2-col)** — AI-Powered Threat Detection · Impression Score · Automated Takedowns · Multi-Platform Coverage
6. **How it works** — 3-step process with visual connecting line
7. **Final CTA** — "Your identity deserves a guardian"

---

### AUTH — Login & Register (`/login`, `/register`)

Standard email + password forms. Register supports invite tokens (pre-filled email, pre-linked influencer profile). After auth, token stored in `localStorage.imprsn8_token`.

---

### OVERVIEW — Command Center (`/dashboard`)

The first page after login. Renders two very different views based on role:

**Influencer/Staff view** (simplified):
- Protection status banner (green if active, red if paused)
- Accounts Monitored count
- Active Threats count
- Recent impersonators list

**SOC/Admin view** (full command center):
1. **4-column metric strip:**
   - ACCOUNTS MONITORED (purple number)
   - ACTIVE THREATS (red number, pulsing dot if > 0)
   - PENDING TAKEDOWNS (orange number)
   - AGENT UPTIME (green percentage)

2. **Active Threats section** — Top 5 recent threats with:
   - Platform icon · Suspect handle · Threat type · Severity badge · Status badge · Time ago

3. **Agent Heartbeat grid** — 6-column grid showing each agent's status:
   - Animated pulse dot (green = running, red = failed, grey = idle)
   - Agent name (SENTINEL, RECON, etc.)
   - Human-readable codename (e.g., "Scam Link Detector")
   - Last run timestamp

4. **Activity Timeline** — Scrollable vertical feed:
   - Color-coded dot per event type (purple = agent run, red = threat, orange = takedown)
   - Event title + severity badge
   - Detail text + influencer name
   - Relative timestamp (e.g., "14m ago")

---

### MONITORED ACCOUNTS (`/accounts`)

Manages the list of social media profiles being watched for each influencer.

**Features:**
- **Platform filter bar** — All · TikTok · Instagram · X · YouTube · Facebook · LinkedIn · Twitch · Threads · Bluesky · Reddit (with counts)
- **Risk filter** — All · Legitimate · Suspicious · Imposter · Unscored
- **Influencer switcher** (SOC/Admin) — Scopes view to one influencer
- **Account cards (3-col grid):**
  - 52px risk score ring (0–100, colour shifts red → yellow → green)
  - Handle + verified checkmark if known legitimate
  - Platform icon
  - Follower count
  - Risk category badge (Legitimate / Suspicious / Imposter / Unscored)
  - Last scanned timestamp
  - External link + delete actions

**Add Account Modal:**
- Influencer picker (if not scoped)
- Platform dropdown (14 platforms)
- Handle input
- Profile URL (optional)
- Verified flag checkbox

**Handle Variant Watchlist** (shown when influencer selected):
- Displays typosquat variant handles being monitored
- Variant types: homoglyph, separator, suffix, prefix, swap, other
- Add variant form: platform + variant type + original handle + variant handle

---

### THREATS FOUND — IOI Feed (`/threats`)

The threat intelligence inbox. "IOI" = Indicator of Impersonation.

**List View:**
- Severity filter tabs: ALL · CRITICAL · HIGH · MEDIUM · PENDING REVIEW
- Threat cards (clickable):
  - 52px OCI similarity score ring (0–100)
  - Suspect handle + platform icon
  - Threat type label + detection timestamp
  - Severity badge (Critical / High / Medium / Low) + Status badge
  - ⚡ icon if "new" or "investigating"
- "Report Threat" button (SOC/Admin) — opens manual report modal

**Threat Detail View (clicking a card):**
1. Back button + title "Threat Report" + severity badge + status badge
2. **HITL notice** — Lock icon warning that autonomous submission is restricted
3. **Two-column grid:**
   - Left: Threat Account Card
     - Red header bar "⚠ THREAT ACCOUNT"
     - Suspect avatar placeholder + handle + platform
     - Stats grid: Platform · Followers · Detected By · Detected timestamp
   - Right: OCI Similarity Score Card
     - 96px ring with score percentage
     - Confidence label (High / Likely / Possible)
4. **Similarity breakdown** (4 metrics with progress bars):
   - Bio Copy · Avatar Match · Posting Cadence · Handle Distance
5. **AI Analysis** — Markdown text block with AI-generated threat assessment
6. **Analyst Assessment** — Textarea for SOC analyst notes (editable)
7. **Action buttons:**
   - Primary: 🚩 Initiate Takedown
   - Secondary: 👁 Monitor Account · ✓ Mark Safe
   - Tertiary: Investigating · Copy ID · Dismiss

**Report Threat Modal** (manual submission):
- Influencer selector
- Platform + suspect handle
- Threat type dropdown (Full Clone / Handle Squat / Bio Copy / Avatar Copy / Scam Campaign / Deepfake / Voice Clone / Other)
- Severity selector (Critical / High / Medium / Low)
- Suspect profile URL + similarity score
- AI analysis textarea (for pasting AI-generated assessment)

---

### TAKEDOWNS — Pipeline (`/takedowns`)

Manages the lifecycle of formal takedown requests from draft to resolved.

**Two view modes:** Kanban (default) · List

**Takedown types:** DMCA · Impersonation · Trademark · Platform ToS · Court Order

**Pipeline stages (5 steps):**
```
Draft → Submitted → Acknowledged → In Review → Done
```

**Kanban View:**
- 5 vertical columns, one per stage
- Column header with item count badge
- Cards per stage:
  - Suspect handle (bold)
  - Platform icon + takedown type badge
  - Influencer name
  - Submission timestamp
  - Evidence item count with checkmark icon
  - If "Done": RESOLVED (green) or REJECTED (red) outcome badge

**List View:**
- Active section (non-done) + Completed section
- Table-style rows with all key fields inline

**Takedown Detail View:**
1. Header with back button + title + type badge + status badge
2. **Visual pipeline stepper** — horizontal numbered steps (1–5), completed steps turn green with checkmark
3. **HITL Checkpoint Banner** — Lock icon + "No submission until SOC Analyst sign-off" warning
4. **Two-column grid:**
   - Package Details Card: Target Account · Platform · Report Type · Case Ref · Filed timestamp · Filed By
   - Evidence Bundle Card: List of evidence items (screenshot, video, URL log, bio copy, other)
5. **Analyst Assessment textarea** — Required notes before authorising
6. **Action Zone:**
   - If SOC/Admin + not done: "Authorise & Submit Takedown" button (yellow flag) + "Dismiss" button
   - Confirmation stage: Red warning "CONFIRM — this action is irreversible" with final submit button
   - If resolved: ✅ success state. If dismissed: ❌ dismissed state.

---

### INTELLIGENCE — Agents Panel (`/agents`)

The AI operations centre. SOC/Admin only.

**Three tabs:**
1. **Intelligence** — Agent list grouped by category
2. **Data Sources** — Feed management
3. **Recent Runs** — Run history across all agents

**Intelligence tab:**
- ARBITER HITL notice banner (red, permanent) — "No submission until SOC Analyst sign-off"
- Agents grouped by category:
  - **DETECT** (blue) — RECON (Scam Link Detector), SENTINEL (Identity Monitor)
  - **MONITOR** (green) — WATCHDOG (Compliance Guardian)
  - **RESPOND** (red) — ARBITER (Takedown Authoriser)
  - **ANALYZE** (gold) — VERITAS (Likeness Validator), NEXUS (Attribution Engine)
- Each agent card shows:
  - Active/inactive status checkbox
  - Coloured icon box (unique colour per agent)
  - Codename + technical name badge (SENTINEL, RECON, etc.)
  - Schedule badge (Realtime / Every N hours)
  - HITL badge (ARBITER only)
  - Description
  - Tech stack tags (Firecrawl, Lovable AI, etc.)
  - Last run time · Threats found today · Runs today
  - ▶ Run button (if SOC/Admin)
- "Voice Clone Detector" — Coming Soon placeholder card

**Data Sources tab:**
- Feed cards showing:
  - Platform icon + name + tier badge (Free / Paid / Enterprise)
  - Status indicator (idle / running / success / error)
  - Last pulled timestamp + threats found count
  - Pull interval setting
  - ▶ Run · ✏ Edit · ⚡ Pause/Resume · 🗑 Delete actions
- "Add Data Source" button opens 2-step modal:
  - Step 1: Platform picker (grouped by tier, with search)
  - Step 2: Config form (name, API key, API secret, settings fields, pull interval)
- Edit modal: pre-populates all fields, masked credential display

**Recent Runs tab:**
- Chronological list of all agent runs
- Each run: Agent icon + codename + technical name badge + status badge + items processed + threats flagged + timestamp

---

### BRAND SCORE (`/brand`)

Influencer-focused view. The personal analytics dashboard.

**Features:**
1. **Overall Impression Score** — Large gradient number (0–100) with heading
2. **Analyze form** (left panel, 2/3 width):
   - Type selector: Bio / Content / Profile / Portfolio
   - Textarea for content input
   - Submit button → runs AI analysis
   - Latest result card: total score + breakdown grid (Clarity · Professionalism · Consistency · Impact, each 0–100)
   - Strengths list (green) + Suggestions list (purple)
   - Score trend chart (line chart, last 30 days)
   - History table (recent analyses)
3. **Right sidebar** (1/3 width):
   - Profile card: avatar · display name · bio (with inline edit)
   - Social profiles list (add form: platform + handle)
   - Campaigns list (add form: name + description + status)

---

### SETTINGS (`/settings`)

Three tabs (URL-based, swipe-back aware):

**Profile tab:**
- Display name · Username · Bio fields
- Save button (shows ✓ confirmed state for 2.5s)

**Access Management tab** (shows user list if admin):
- User rows: email · role badge · joined date
- "Manage Users" button → navigates to `/admin?tab=influencers`

**Knowledge Base tab:**
- Searchable KB article list with category filter
- Articles cover: Setup · OCI Detection · Takedowns · AI Agents · Threat Intel · Access Management · Integrations

---

### ADMIN CONSOLE (`/admin`)

Platform operator view. Admin only. Four tabs (URL-based):

**Influencers tab:**
- Table of all influencer profiles: name · handle · tier · monitored accounts count · active threats · pending takedowns
- Row actions: Edit name/handle/tier · Invite user (opens InviteInfluencerModal) · Delete
- Create Influencer form (inline): display name · handle · tier selector

**Users tab:**
- Table of all user accounts: email · display name · role · plan · linked influencer
- Inline role editor (dropdown)
- Inline plan editor (dropdown: free / pro / enterprise)
- Toggle is_admin flag (checkbox)
- Delete user button

**Platform Stats tab:**
- Breakdown of DB row counts by table
- Platform distribution: threats per platform, accounts per platform

**System Health tab:**
- DB table stats (row counts for all tables)
- Cloudflare D1 storage note

---

## 4. Design System — Colors

The color system uses CSS custom properties stored as **RGB channel triplets** (not hex), so Tailwind's opacity modifiers (`/10`, `/20`, `/50`, etc.) work on every color token.

### Dark Mode (Default) — `:root`

```css
/* Surfaces */
--surface-bg:            7   7  26   /* #070726  — deepest background */
--surface-card:         15  15  30   /* #0f0f1e  — card surface */
--surface-border:       30  27  75   /* #1e1b4b  — default border */
--surface-border-bright:45  42 106   /* #2d2a6a  — hover/active border */
--surface-navy:         13  13  43   /* #0d0d2b  — inset/nested surface */

/* Accent — purple/pink brand palette */
--accent:              139  92 246   /* #8b5cf6  — primary purple (Violet 500) */
--accent-dim:          124  58 237   /* #7c3aed  — deeper purple (Violet 600) */
--accent-muted:         76  29 149   /* #4c1d95  — very dark purple (Violet 900) */
--accent-light:        167 139 250   /* #a78bfa  — lighter violet (Violet 400) */
--accent-pink:         236  72 153   /* #ec4899  — brand pink (Pink 500) */

/* Text */
--text-muted:          148 163 184   /* slate-400 */
```

### Light Mode — `html.light`

```css
--surface-bg:          245 244 255   /* #f5f4ff  — soft lavender-white */
--surface-card:        255 255 255   /* pure white */
--surface-border:      228 224 248   /* #e4e0f8 */
--surface-border-bright:196 190 245  /* #c4bef5 */
--surface-navy:        237 233 254   /* #ede9fe */

--accent:              124  58 237   /* #7c3aed — darker on light bg for contrast */
--accent-dim:          109  40 217   /* #6d28d9 */
--accent-muted:        237 233 254   /* #ede9fe — inverted for chip backgrounds */
--accent-light:        139  92 246   /* #8b5cf6 */
--accent-pink:         219  39 119   /* #db2777 — darker pink for contrast */

--text-muted:          107  99 160   /* #6b63a0 muted purple-grey */
```

### Tailwind Color Tokens

| Token | Maps to | Usage |
|-------|---------|-------|
| `brand-bg` | `--surface-bg` | Page backgrounds |
| `brand-card` | `--surface-card` | Card surfaces |
| `brand-border` | `--surface-border` | Default borders |
| `brand-purple` | `--accent` | Primary CTA, icons, highlights |
| `brand-pink` | `--accent-pink` | Gradient partner to purple |
| `brand-muted` | `--text-muted` | Secondary / placeholder text |
| `soc-bg` | same as `brand-bg` | SOC panel backgrounds |
| `soc-card` | same as `brand-card` | SOC card surfaces |
| `soc-border` | same as `brand-border` | SOC borders |
| `soc-border-bright` | `--surface-border-bright` | Hover/focus borders |
| `soc-navy` | `--surface-navy` | Nested inset areas |
| `gold` | `--accent` | Used on CTA buttons and score rings (same as purple) |
| `gold-light` | `--accent-light` | Lighter highlights |
| `purple-light` | `--accent-light` | Alias for accent-light |

### Semantic / Status Colors (fixed, no theming)

```
threat-critical  #FF3B3B   Bright red    — Critical severity threats
threat-high      #FF8C00   Orange        — High severity threats
threat-medium    #F5C518   Yellow/amber  — Medium severity threats
threat-low       #4CAF50   Green         — Low severity threats

status-live      #22C55E   Green         — Active/running/success states
status-idle      #64748B   Grey-blue     — Inactive/idle states
status-error     #EF4444   Red           — Error states
status-scheduled #3B82F6   Blue          — Scheduled/pending states
```

### Agent Color Coding

Each AI agent has a unique color used for its icon box, text, and badges:

```
SENTINEL   text-blue-400   / bg-blue-500/10      — Identity Watcher
RECON      text-purple-400 / bg-purple/10        — Threat Scanner
VERITAS    text-gold        / bg-gold/10          — Likeness Validator
NEXUS      text-orange-400 / bg-orange-500/10    — Attribution Engine
ARBITER    text-threat-critical / bg-threat-critical/10 — Takedown Authoriser
WATCHDOG   text-status-live / bg-status-live/10  — Compliance Guardian
PHANTOM    text-slate-400  / bg-slate-500/10     — Voice Clone Detector (coming soon)
```

---

## 5. Design System — Typography

### Font Families

| Family | Weights | Purpose | Class |
|--------|---------|---------|-------|
| **Inter** | 300, 400, 500, 600, 700 | Body text, UI labels, inputs | (default) |
| **JetBrains Mono** | 400, 500, 700 | Scores, IDs, handles, code, timestamps | `.mono`, `font-mono` |
| **Syne** | 700, 800 | Logo / brand wordmark only | `.syne` |

### Type Scale (used in practice)

```
text-[9px]   — Micro labels (tier badges, tracking codes, metadata)
text-[10px]  — Form labels, table headers, secondary meta
text-[11px]  — Section headers (UPPERCASE, tracking-widest)
text-xs      — 12px  Body secondary, card descriptions
text-sm      — 14px  Body primary, card titles, button text
text-base    — 16px  Page sub-headings
text-xl      — 20px  Page headings, agent names
text-3xl     — 30px  Large metric numbers
text-5xl+    — Hero headings (landing page)
```

### Text Color Convention

```
text-slate-100  #f1f5f9   — Primary headings, key values
text-slate-200  #e2e8f0   — Secondary headings
text-slate-300  #cbd5e1   — Body text, descriptions
text-slate-400  #94a3b8   — Meta text, secondary labels (boosted from 500 in dark mode)
text-slate-500  #64748b   — Tertiary / placeholder text (boosted from 600 in dark mode)
text-slate-600  #475569   — Decorative / lowest priority labels
```

---

## 6. Design System — Component Classes

All defined in `src/index.css` as `@layer components`.

### Cards

```css
.card          /* Brand card — bg-brand-card, purple/25 border, purple glow shadow */
.soc-card      /* SOC card — bg-brand-card, standard border, no glow */
.soc-card-hover /* soc-card + hover:-translate-y-0.5 + hover:border-brand-purple/40 */
```

### Inputs

```css
.input         /* Purple focus ring — bg-brand-bg, border-brand-purple/20 */
.soc-input     /* SOC style — bg-brand-bg, border-brand-border (same look, different intent) */
.soc-select    /* soc-input + cursor-pointer */
```

### Buttons

```css
.btn-primary   /* Purple→Pink gradient, white text, purple glow shadow, scale-95 on active */
.btn-gold      /* Identical to btn-primary (same gradient) */
.btn-purple    /* Solid brand-purple fill, white text */
.btn-ghost     /* Bordered, hover highlights in brand-purple */
.btn-danger    /* Red border/text, red bg on hover */
.btn-icon      /* Small square: p-2, border, hover-purple */
```

### Severity Badges

```css
.badge-critical   /* bg-threat-critical/15, text-threat-critical, red border */
.badge-high       /* bg-threat-high/15, text-threat-high, orange border */
.badge-medium     /* bg-threat-medium/15, text-threat-medium, yellow border */
.badge-low        /* bg-threat-low/15, text-threat-low, green border */
```

### Status Badges

```css
.badge-new        /* bg-brand-purple/20, text-brand-purple — new items */
.badge-draft      /* bg-slate-700/40, text-slate-400 — draft state */
.badge-submitted  /* bg-blue-500/20, text-blue-400 — submitted */
.badge-resolved   /* bg-status-live/15, text-status-live — done/resolved */
.badge-dismissed  /* bg-slate-700/20, text-slate-500 — dismissed */
```

### Text Effects

```css
.gradient-text    /* bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text */
.gold-text        /* alias for gradient-text */
.purple-text      /* alias for gradient-text */
.mono             /* font-family: JetBrains Mono */
.syne             /* font-family: Syne */
```

### Animations

```css
animate-pulse-dot   /* 2s cubic-bezier pulse — pulsing status dots */
animate-ping-slow   /* 3s ping — outer ring on live status */
animate-fade-in     /* 0.3s opacity 0→1 — page/section entry */
animate-slide-in    /* 0.25s opacity 0→1 + translateX(-8px → 0) — list items */
animate-spin        /* (Tailwind built-in) — loading spinners */
```

### Custom Scrollbar (webkit)

```css
Width: 5px
Track: bg-soc-card (dark surface)
Thumb: bg-soc-border (dark border color)
Thumb hover: brand-purple/40
```

---

## 7. Current Visual Style Description

The current aesthetic is **"Dark SOC Terminal / Cyber Intel Dashboard"** — think threat intelligence platforms, security operations centres, Bloomberg terminal.

### Core aesthetic traits:

- **Very dark backgrounds** — near-black with a subtle navy-purple tint (#070726). Not pure black.
- **Contained card grid** — content is broken into `.soc-card` boxes with subtle #1e1b4b borders. Clean, boxy layout.
- **Purple/pink gradient** as the sole brand accent — used for primary buttons, ring fill, gradient headlines, and score highlights. No other brand hues.
- **Monospaced numbers and IDs** — all scores, handles, case refs, timestamps render in JetBrains Mono.
- **Tight micro-typography** — 9–11px labels in all-caps with `tracking-widest` for data field labels.
- **Lucide icon set** — all UI icons are from `lucide-react`. Consistent line weight throughout.
- **Minimal motion** — fade-in on page entry, spin on loaders, pulse on live status dots. No elaborate transitions.
- **Inline state changes** — success/error messages appear inline within cards/forms, not as toast popups (though a new inline toast was added to FeedsView).
- **Status dots with concentric rings** — the `Pulse` component renders a small coloured dot with an optional animated outer ring for live states.
- **SVG ring scores** — circular progress rings are hand-drawn SVG `<circle>` elements with `stroke-dashoffset` animation. Used for OCI score, brand score, and risk ratings.
- **Severity colour ladder** — Red → Orange → Yellow → Green maps to Critical → High → Medium → Low. Consistent across badges, rings, and text.

### Current known weaknesses:
- Cards are uniform and boxy — limited visual hierarchy between primary and secondary content
- The landing page feels disconnected from the app interior (different glow orb aesthetic)
- Agent icon boxes use generic Lucide icons — not distinctive enough as brand avatars
- No micro-interactions on hover states (no elevation shadows, no colour transitions on card content)
- Mobile layout is functional but not optimised — cards stack vertically with no reflow for small screens
- The "GUARDING" sidebar footer is clever but the sidebar as a whole is quite narrow and sparse

---

## 8. Navigation & Layout Architecture

### Route Structure

```
/                    → Home (public landing page)
/login               → Login form
/register            → Register form (supports ?invite=TOKEN)

[Authenticated shell — AppShell component]
  /dashboard         → Overview (command centre)
  /accounts          → Monitored Accounts
  /threats           → Threats Found (IOI Feed)
  /takedowns         → Takedown Pipeline
  /agents            → Intelligence Panel (SOC/Admin only)
  /brand             → Brand Score Dashboard (influencer only)
  /settings          → Settings (profile, access, KB)
  /admin             → Admin Console (admin only)
```

### AppShell Layout (authenticated)

```
┌──────────────────────────────────────────────────────────┐
│  Sidebar (240px fixed, or drawer on mobile)              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Logo + tagline                                     │  │
│  │ Influencer switcher (SOC/Admin only)               │  │
│  │ ─────────────────────────────────────────────────  │  │
│  │ Overview          [icon]                           │  │
│  │ Monitored         [icon]                           │  │
│  │ Threats Found     [icon]  [count badge]            │  │
│  │ Takedowns         [icon]                           │  │
│  │ Intelligence      [icon]  (SOC/Admin)              │  │
│  │ Brand Score       [icon]  (Influencer)             │  │
│  │ Admin Console     [icon]  (Admin)                  │  │
│  │ ─────────────────────────────────────────────────  │  │
│  │ Settings          [icon]                           │  │
│  │ Theme toggle                                       │  │
│  │ Sign out                                           │  │
│  │ ─────────────────────────────────────────────────  │  │
│  │ ● GUARDING · SOC ACTIVE · [live clock]             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Main content area (flex-1, overflow-y-auto)             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Mobile top bar (hamburger + logo + theme toggle)   │  │
│  │ ─────────────────────────────────────────────────  │  │
│  │ Page content (p-6, max-w-6xl mx-auto on admin)     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### URL-based State Management

All major tabs use `useSearchParams` with `replace: false` so browser history is maintained and mobile swipe-back navigates within pages:

- `/agents?tab=intelligence|sources|runs`
- `/agents?tab=intelligence&agent=<id>` — agent detail
- `/settings?tab=profile|access|knowledge`
- `/admin?tab=influencers|users|breakdown|health`

---

## 9. AI Agents — The Intelligence Layer

Eight agents operate across four categories. Each has a unique name, codename, colour, icon, and role.

| Agent Name | Codename (DB) | Category | Colour | Icon | Function |
|---|---|---|---|---|---|
| **SENTINEL** | Identity Monitor | monitor | Blue | 👁 Eye | Watches known accounts 24/7, detects unexpected changes |
| **RECON** | Scam Link Detector | detect | Purple | 🔍 Search | Scans platforms for new impersonator accounts |
| **VERITAS** | Likeness Validator | analyze | Gold/Purple | ✓ CheckCircle | Scores OCI similarity with multimodal vision AI |
| **NEXUS** | Attribution Engine | analyze | Orange | ⎇ GitMerge | Correlates accounts, builds attribution graphs between actors |
| **ARBITER** | Takedown Authoriser | respond | Red | ⚖ Scale | Prepares takedown packages — **cannot submit without human sign-off** |
| **WATCHDOG** | Compliance Guardian | monitor | Green | 🛡 ShieldAlert | Enforces approved TTP boundaries and legal compliance |
| **PHANTOM** | Voice Clone Detector | detect | Grey | 🎤 Mic | Audio/video deepfake detection *(coming soon)* |
| **manual** | Manual Run | — | Grey | ▶ Play | Represents manually-triggered runs in the runs log |

### ARBITER HITL Gate
ARBITER is the only agent that touches the takedown pipeline. It is **permanently restricted** from filing any takedown without a credentialled SOC Analyst explicitly authorising the request. This restriction is enforced at the API level and displayed prominently throughout the UI (red banner, lock icon). It cannot be overridden by any agent, process, or API call.

---

## 10. Data Feeds — The Input Layer

Data feeds are the ingestion pipeline — they pull data from social platforms on a schedule and feed it to the AI agents.

### Tier Structure

**FREE TIER** (0 monthly cost)
- YouTube Data API v3 · 10k units/day
- Twitch Helix API · 800 req/min
- Reddit Public JSON · 60 req/min
- Bluesky AT Protocol · public endpoint
- TikTok Research API *(config only, pull not yet implemented)*
- Mastodon v2 Search · 300 req/5min
- GitHub Search API · 60–5000 req/hr
- RSS/Atom feed polling · unlimited

**LOW COST ($) TIER**
- X/Twitter Basic v2 · $100/mo · 10k posts/month
- Instagram Graph API · Meta business account required
- Apify Scrapers · actor marketplace · $5–50/mo
- DataForSEO · SERP + social · $50+/mo

**PAID ($$+) TIER**
- X/Twitter Pro · $5000/mo · full firehose access
- Brandwatch · enterprise media monitoring
- Meltwater · enterprise media + news
- Proxycurl · LinkedIn profile enrichment · $49+/mo
- Mention.com · real-time brand alerts · $41+/mo

### Feed Configuration

Each feed has:
- **Name** — user-defined label (e.g., "YouTube Monitor")
- **API credentials** — API key and/or secret (stored masked, `****xxxx` display)
- **Settings fields** — platform-specific config (search terms, account lists, etc.)
- **Pull interval** — minimum varies by platform (5 min to 60 min)
- **Status tracking** — idle / running / success / error, with last error message
- **Performance** — pull count, threats found total, last pulled timestamp

---

## 11. Key Data Types & Domain Vocabulary

### Core Vocabulary

| Term | Meaning |
|---|---|
| **OCI** | Online Clone Indicator — the system's name for an impersonation threat |
| **IOI** | Indicator of Impersonation — a specific threat report/record in the system |
| **Similarity Score** | 0–100 number quantifying how closely a suspect account mimics the real person |
| **Impression Score** | 0–100 AI brand health score for the influencer's own accounts |
| **HITL** | Human In The Loop — the mandatory human review gate before any takedown is filed |
| **SOC** | Security Operations Centre — the analyst team managing threats |
| **Codename** | Human-readable agent name (e.g., "Scam Link Detector") vs technical name (RECON) |
| **Handle variant** | A typosquat variation of the influencer's username being monitored |
| **Attribution** | Linking multiple impersonator accounts to the same threat actor |

### Platform Enum (14 platforms)
`tiktok` · `instagram` · `x` · `youtube` · `facebook` · `linkedin` · `twitch` · `threads` · `snapchat` · `pinterest` · `bluesky` · `reddit` · `github` · `mastodon`

### Threat Types
`full_clone` · `handle_squat` · `bio_copy` · `avatar_copy` · `scam_campaign` · `deepfake_media` · `unofficial_clips` · `voice_clone` · `other`

### Threat Severity
`critical` (red) · `high` (orange) · `medium` (yellow) · `low` (green)

### Threat Status Lifecycle
`new` → `investigating` → `confirmed` → `actioning` → `resolved` / `dismissed`

### Takedown Status Lifecycle
`draft` → `submitted` → `acknowledged` → `in_review` → `resolved` / `rejected`

### Takedown Types
`dmca` · `impersonation` · `trademark` · `platform_tos` · `court_order`

### Analysis Breakdown (Brand Score)
Each analysis returns four sub-scores (0–100):
- **Clarity** — how clear and understandable the content is
- **Professionalism** — tone and quality of presentation
- **Consistency** — how consistent with the influencer's established brand
- **Impact** — predicted audience engagement and effectiveness

---

## 12. Design Improvement Opportunities

This section is meant to seed ideas for a redesign consultation. These are intentional gaps and directions to explore — not bugs.

### Visual Identity

- **The landing page and the app feel like two different products.** The public page has floating glow orbs and large gradient text. The app interior is tight dark cards with no atmospheric depth. A redesign should make the transition seamless — the glow and brand energy should continue into the dashboard.
- **Agent avatars are generic.** Each AI agent currently uses a small Lucide icon in a coloured box. These agents deserve distinctive branded avatars or illustrated icons — they are the product's signature feature.
- **The sidebar is functional but anonymous.** It has no visual personality beyond the logo. It could carry more of the brand — glassmorphism, gradient border, or a more architectural treatment.

### Layout & Hierarchy

- **Cards are too uniform.** Primary content (active threats, current takedown status) and secondary content (metadata, timestamps) compete visually. Stronger hierarchy through size, weight, and whitespace would help.
- **The Overview page (command centre) is data-dense but flat.** It could benefit from a hero stat widget, a dramatic active-threats module, or a live activity river rather than a plain list.
- **Takedown pipeline as a Kanban feels underutilised.** The columns are narrow and the cards are minimal. A wider, more expansive Kanban with richer cards (showing more context per stage) would feel more satisfying to use.

### Mobile Experience

- **The 3-column account card grid collapses to 1 column on mobile** — this creates very long scrolling lists. A horizontal swipeable card stack or a tighter 2-column layout with reduced info would be better.
- **The sidebar drawer works but feels abrupt.** Smooth slide + backdrop blur would improve it.
- **The Intelligence agent list has limited touch targets.** The ▶ Run button is 32px. Should be at least 44px on mobile.

### Interaction & Feedback

- **Almost no micro-interactions.** Hovering a threat card, clicking a severity badge, or completing a takedown could have subtle scale/glow responses.
- **The takedown confirmation flow is plain text.** Given it's an irreversible action, it deserves a more dramatic, intentional UI — perhaps a modal overlay with a typewritten confirmation, a countdown, or a visual "firing" animation.
- **Success states are brief.** After adding a feed or saving settings, there's a 3s toast. A more persistent "last saved" indicator (like Notion's "Saved X seconds ago") would reduce anxiety.

### Data Visualisation

- **The score trend chart (Brand Score) is minimal.** A more expressive chart with annotations, reference lines (industry average, personal best), and a gradient fill would be more compelling.
- **The OCI similarity breakdown (4 metrics with progress bars) is functional but plain.** A radar/spider chart showing bio_copy vs avatar_match vs posting_cadence vs handle_distance would be more visually communicative.
- **The Agent Heartbeat on Overview is a simple text grid.** Visualising this as an orbital diagram, a network map, or an animated grid of agent "cells" would feel more alive.

### Theming

- **Light mode exists but shares the same purple/navy palette.** On light backgrounds, the dark card surfaces and bright threat colours (especially #FF3B3B) can feel aggressive. A warmer, more neutral light theme (cream whites, muted purples) could be explored.
- **"Dark purple navy" is the only dark theme.** A true black OLED theme (pure #000000 background) or a green-on-black "hacker terminal" theme could be offered as alternatives.

---

*This document covers 100% of the current platform's implemented features, design tokens, and component system. Use it to brief a designer or AI assistant for redesign proposals.*
