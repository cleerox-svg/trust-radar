# AVERROW DESIGN SYSTEM BRIEF
## Version 1.0 — March 2026

---

## 1. BRAND IDENTITY

### Name
**Averrow** — a fusion of "Avro" and "Arrow," inspired by the CF-105 Avro Arrow, Canada's legendary supersonic interceptor. The most advanced aircraft of its era, built to detect and neutralize threats crossing into Canadian airspace. Averrow carries that mission into the digital domain.

### Parent Company
LRX Enterprises Inc. (Canadian-incorporated)

### Domains
- **averrow.com** — primary (international)
- **averrow.ca** — Canadian market

### Contact Emails
- hello@averrow.com
- security@averrow.com
- sales@averrow.com

### Tagline Options
- "Threat Interceptor"
- "Canada's most advanced interceptor. Designed for AI-powered threats."
- "Nothing crosses into your airspace."

### Blog Author
Claude Leroux

---

## 2. BRAND NARRATIVE

The Avro Arrow (CF-105) wasn't just an airplane — it was an integrated defense system:

- **ASTRA** was the fire control system. It processed radar returns, identified threats, and calculated intercept solutions automatically.
- **Sparrow** missiles neutralized threats once ASTRA locked on.
- **Orenda Iroquois** engines provided raw Canadian-built power.
- **The delta wing** was the iconic shape — designed for speed, altitude, and coverage across vast distances.

The Arrow's entire job was: **detect incoming threats, classify them, intercept them, and neutralize them before they reach their target.**

Averrow does the same thing for brands on the internet. The platform defends digital airspace — detecting phishing kits, lookalike domains, brand impersonation, email spoofing, and credential harvesting before they reach their target.

### Competitive Differentiation
Doppler, Bolster, Netcraft — they present as dashboards with alert tables. Generic cybersecurity UI. Blue and dark mode. Averrow says **"we defend airspace."** The user is the pilot. The platform is the weapons system.

### What NOT to do
- Do not name competitors in any public materials
- Do not use generic cybersecurity aesthetics (purple gradients, neon green terminals, padlock icons)
- Do not go full military — the platform has range; Observatory is calm, ASTRA is aggressive
- Do not list specific feed names (PhishTank, URLhaus, OpenPhish) on public pages — use generic descriptions ("phishing URL databases," "malware feeds," "CT logs"). Feed names are secret sauce.

---

## 3. LOGO — DEEP ARROW

### Concept
The logo is a **delta wing "A"** — the Avro Arrow's most iconic shape. The delta doubles as the letter "A" through a negative-space fin cutout. Clean, bold, no orbital rings.

### Deep Arrow Gradient
- **Top vertex:** #6B1010 (Signal Red Deep)
- **Base:** #C83C3C (Signal Red)
- Direction: vertical, top-to-bottom
- Gradient ID in SVGs: `deep-arrow`

### Construction
- Core shape: Equilateral triangle pointing upward (the delta wing silhouette)
- Gradient fill: Deep Arrow (#6B1010 → #C83C3C), top to bottom
- Negative space "A" crossbar/fin cut from the lower third of the delta
- Background: always rendered on a dark container (#080E18 or #040810)

### Size Behavior
| Size | Treatment |
|------|-----------|
| 512px (PWA) | Full delta on #040810 circle, fin cutout visible |
| 192px (PWA) | Same as 512px |
| 32px (favicon) | Delta on #080E18 rounded rect (rx=6), fin cutout |
| 16px | Simplified — no fine details, bold strokes |

### Minimum Sizes
- Mark alone: 16px minimum
- Mark + wordmark lockup: 120px minimum width

### Logo + Wordmark Lockup
Horizontal layout: Logo mark → gap → stacked wordmark
- **AVERROW** in IBM Plex Mono, weight 700, letter-spacing 0.14em, uppercase
- **THREAT INTERCEPTOR** in IBM Plex Mono, weight 400, ~40% smaller than name, letter-spacing 0.2em+, uppercase

### Background Adaptations
- On dark (#080E18): Deep Arrow gradient delta, dark background cutout — **primary treatment**
- On light (#F8F7F5): Logo always sits inside a dark container (#080E18 pill/circle) — never directly on light
- On Signal Red (#C83C3C): White delta, red cutout
- Never render the logo directly on a light background without a dark container

---

## 4. COLOR SYSTEM

All colors serve the Dark App (platform) and Light Public (landing/login) themes. The primary accent is **Afterburner Amber (#E5A832)** — warm, confident, aerospace-grade. Signal Red is reserved for alerts and the logo. Orbital Teal (#00d4ff) is **reserved exclusively** for Observatory map beams and logo glow — never for UI chrome.

### Dark Theme Token Table (Platform App)

| Token | Tailwind Class | Hex | Usage |
|-------|---------------|-----|-------|
| Deep Space | `bg-deep-space` | #080C14 | Base background |
| Instrument Panel | `bg-instrument-panel` | #111827 | Card backgrounds, panels |
| Panel Highlight | `bg-panel-highlight` | #1A2234 | Elevated cards, hover states |
| Instrument Edge | `border-instrument-edge` | #2A3548 | Borders, dividers |
| Instrument White | `text-instrument-white` | #E8ECF1 | Primary text |
| Gauge Gray | `text-gauge-gray` | #8896AB | Secondary text, labels |
| Afterburner | `text-afterburner` | #E5A832 | **Primary accent — CTAs, active states, nav highlights** |
| Afterburner Hover | `hover:bg-afterburner-hover` | #D49A28 | Hover/pressed states |
| Afterburner Muted | `bg-afterburner-muted` | rgba(229,168,50,0.12) | Subtle accent backgrounds |
| Afterburner Border | `border-afterburner-border` | rgba(229,168,50,0.3) | Accent borders |
| Wing Blue | `text-wing-blue` | #0A8AB5 | Secondary accent, info states |
| Wing Blue Muted | `bg-wing-blue-muted` | rgba(10,138,181,0.12) | Subtle info backgrounds |
| Wing Blue Border | `border-wing-blue-border` | rgba(10,138,181,0.3) | Info borders |
| Signal Red | `text-signal-red` | #C83C3C | Alerts, critical, logo |
| Signal Red Deep | `bg-signal-red-deep` | #6B1010 | Deep red tint, logo gradient start |

### Light Theme Token Table (Public Site)

| Token | Tailwind Class | Hex | Usage |
|-------|---------------|-----|-------|
| Cloud | `bg-cloud` | #F8F7F5 | Base background |
| Warm Cream | `bg-warm-cream` | #F0EDE8 | Card backgrounds |
| Warm Border | `border-warm-border` | #E2DDD5 | Borders, dividers |
| Ink | `text-ink` | #1A1F2E | Primary text |
| Slate | `text-slate` | #5A6170 | Secondary text |
| Amber Deep | `text-amber-deep` | #C88B1E | Primary accent (light mode equivalent of Afterburner) |
| Blue Deep | `text-blue-deep` | #0878A0 | Secondary accent (light mode equivalent of Wing Blue) |
| Red Deep | `text-red-deep` | #B53030 | Alert accent (light mode equivalent of Signal Red) |
| Clearance | `text-clearance` | #34D399 | Success, positive states |
| Caution | `text-caution` | #FBBF24 | Warning states |

### Status Colors

| Token | Tailwind Class | Hex | Usage |
|-------|---------------|-----|-------|
| Clearance | `text-clearance` | #34D399 | Success, resolved, clean |
| Caution | `text-caution` | #FBBF24 | Warning, medium severity |
| Signal Red | `text-signal-red` | #C83C3C | Critical, danger, alert |

### Reserved Colors

| Token | Hex | Rule |
|-------|-----|------|
| Orbital Teal | #00d4ff | **ONLY** for Observatory map beams and logo glow — NEVER for UI chrome, nav highlights, buttons, or general accents |
| Thrust | #7aeaff | Reserved for Observatory highlights only |
| Ring Glow | #00b8d9 | Reserved for Observatory border accents only |

**Tailwind tokens for reserved colors:** `orbital-teal`, `thrust`, `ring-glow` — these exist in config but should only be used in Observatory map components.

### Legacy Tokens (Preserved for Compatibility)

These tokens remain in `tailwind.config.ts` to avoid breaking existing components. New code should use the new tokens above.

| Token | Hex | Migrating To |
|-------|-----|-------------|
| cockpit | #080E18 | deep-space |
| instrument | #0C1525 | instrument-panel |
| console | #142236 | panel-highlight |
| bulkhead | #1A2E48 | instrument-edge |
| parchment | #F0EDE8 | instrument-white |
| contrail | #78A0C8 | gauge-gray / wing-blue |
| accent | #C83C3C | signal-red |

### Severity Scale

| Level | Hex | Usage |
|-------|-----|-------|
| CRITICAL | #C83C3C | Immediate action required |
| HIGH | #E8923C | Escalated, needs attention |
| MEDIUM | #DCAA32 | Monitor closely |
| LOW | #78A0C8 | Informational |
| CLEAR | #28A050 | No threat detected |

### Defense Grade Scale

| Grade | Color |
|-------|-------|
| A+ / A | #28A050 (green-500) |
| B+ / B | #78A0C8 (blue-500) |
| C+ / C | #DCAA32 (medium severity gold) |
| D | #E8923C (amber-500) |
| F | #C83C3C (red-500) |

### Severity Palette (UI)

| Level | Color | Hex | Usage |
|-------|-------|-----|-------|
| Critical | Red | #f87171 | Critical threats, FAIL badges, missing records |
| High | Amber | #fb923c | High severity, elevated risk |
| Medium | Yellow | #fbbf24 | Medium severity, warnings |
| Low | Contrail | #78A0C8 | Low severity, info |
| Clean | Green | #4ade80 | PASS badges, clean status, official profiles |

### Color Rules

- **Primary accent is Afterburner Amber** — use for CTAs, active nav, selected states, focus rings
- **Signal Red is for alerts and the logo only** — not a general-purpose accent
- **Orbital Teal is reserved** — Observatory map beams and logo glow ONLY
- Never use generic blue/purple gradients or neon glow effects
- Never use only red — always use the full severity palette
- Muted states: append `/50` or `/30` opacity (e.g. `text-gauge-gray/50`)
- Zero counts always render in `white/30` — never colored
- Background badges: `color-900/40` bg + `color-400` text + `color-500/30` border

---

## 4B. GLASS SYSTEM

All cards, panels, and inputs use glassmorphism utilities defined in `@layer utilities` in `index.css`. These classes use the new design system tokens.

### Glass Utility Classes

| Class | Usage | Key Properties |
|-------|-------|---------------|
| `.glass-card` | Standard card container | `bg-instrument-panel/60`, `backdrop-blur-xl`, `border-instrument-edge/50`, `rounded-xl` |
| `.glass-sidebar` | Sidebar/nav panels | `bg-deep-space/85`, `backdrop-blur-2xl`, `border-r border-instrument-edge/40` |
| `.glass-elevated` | Elevated/modal cards | `bg-panel-highlight/80`, `backdrop-blur-xl`, `border-instrument-edge/60`, `rounded-xl` |
| `.glass-stat` | Stat/metric cards | `bg-instrument-panel/50`, `backdrop-blur-md`, `border-afterburner-border`, `rounded-xl` |
| `.glass-input` | Form inputs | `bg-deep-space/50`, `backdrop-blur-sm`, `border-instrument-edge/60`, `rounded-lg` |

### CSS Details

```css
/* Standard card */
.glass-card {
  @apply bg-instrument-panel/60 backdrop-blur-xl
         border border-instrument-edge/50 rounded-xl shadow-lg;
  box-shadow: 0 4px 24px rgba(0,0,0,0.2),
              inset 0 1px 0 rgba(255,255,255,0.05);
}

/* Sidebar */
.glass-sidebar {
  @apply bg-deep-space/85 backdrop-blur-2xl
         border-r border-instrument-edge/40;
}

/* Elevated / modal */
.glass-elevated {
  @apply bg-panel-highlight/80 backdrop-blur-xl
         border border-instrument-edge/60 rounded-xl;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3),
              inset 0 1px 0 rgba(255,255,255,0.06);
}

/* Stat card (amber-bordered) */
.glass-stat {
  @apply bg-instrument-panel/50 backdrop-blur-md
         border border-afterburner-border rounded-xl;
  box-shadow: 0 0 20px rgba(229,168,50,0.05),
              inset 0 1px 0 rgba(255,255,255,0.04);
}

/* Input field */
.glass-input {
  @apply bg-deep-space/50 backdrop-blur-sm
         border border-instrument-edge/60 rounded-lg text-instrument-white;
}
.glass-input:focus {
  @apply border-afterburner/50 ring-2 ring-afterburner/10;
}
```

### Mobile Fallback
On devices that don't support `backdrop-filter`, the glass classes gracefully degrade to their solid `bg-` color at the specified opacity. No special fallback code is needed — the background color provides sufficient contrast on its own.

### Usage Examples

```tsx
{/* Standard card */}
<div className="glass-card p-6">
  <h3 className="text-instrument-white">Card Title</h3>
  <p className="text-gauge-gray">Card content</p>
</div>

{/* Stat metric card */}
<div className="glass-stat p-4">
  <span className="text-afterburner text-3xl font-bold">2,847</span>
  <span className="text-gauge-gray text-xs">ACTIVE CONTACTS</span>
</div>

{/* Input */}
<input className="glass-input px-3 py-2 w-full" placeholder="Search..." />
```

---

## 4B. STAT CARD PATTERN

All detail view header rows use a 4-column StatCard grid. Each card:

- **Outer:** `rounded-xl border border-white/10 bg-cockpit p-4`
- **Title:** `font-mono text-[9px] uppercase tracking-widest text-contrail/70 mb-3`
- **Layout:** `flex items-center gap-3`
- **Left:** `flex-1 min-w-0` — breakdown rows (dots + counts, bars, or table)
- **Divider:** `border-l border-white/10 pl-3`
- **Right:** `flex flex-col items-center gap-1` — 32px bold metric + 9px muted label

### Row variants

- **Dot rows:** 6px circle + 10px label + right-aligned count. Color if >0, `white/30` if 0.
- **Mini bars:** 2px height, colored by type, width proportional to max value.
- **Primary metric:** `text-[32px] font-bold leading-none` colored by severity tier.
- **Metric label:** `text-[9px] text-white/50 uppercase` below metric.

### Applies to

Brand Detail, Provider Detail, Campaign Detail, and all future detail views.

---

## 5. TYPOGRAPHY

### Font Stack
- **Display / Headlines:** Plus Jakarta Sans (weights: 600, 700, 800)
- **Monospace / Data / Labels:** IBM Plex Mono (weights: 400, 500, 600, 700)
- **Fallback:** system-ui, sans-serif

### Usage Rules
- **Page titles:** Plus Jakarta Sans, 20-28px, weight 700-800, Tarmac/Parchment
- **Section labels:** IBM Plex Mono, 10px, weight 600, Signal Red (#C83C3C), letter-spacing 0.2em, uppercase
- **Table headers:** IBM Plex Mono, 9-10px, weight 600, secondary text color, letter-spacing 0.1em, uppercase
- **Body text in tables:** Plus Jakarta Sans 12-13px for names, IBM Plex Mono 10-11px for data
- **Stat card values:** Plus Jakarta Sans, 22-28px, weight 800
- **Stat card labels:** IBM Plex Mono, 8-9px, weight 500, letter-spacing 0.1em, uppercase
- **Status badges:** IBM Plex Mono, 9px, weight 600, letter-spacing 0.06-0.08em, uppercase
- **Navigation items:** IBM Plex Mono, 10-11px, letter-spacing 0.06em, uppercase
- **Wordmark:** IBM Plex Mono, weight 700, letter-spacing 0.14em, uppercase

### Google Fonts Import
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
```

---

## 6. PLATFORM VOCABULARY

The platform uses aerospace/defense-derived terminology. This vocabulary should be used consistently across UI, documentation, and marketing.

| Generic Term | Averrow Term | Context |
|---|---|---|
| Dashboard / Home | **Observatory** | The main strategic view — where you observe everything |
| Alert / Finding | **Contact** | Military term for a detected object on radar |
| Brand monitoring | **Airspace defense** | Protecting the perimeter around a brand |
| On-demand scan | **Sortie** | A single mission / scanning run |
| Takedown request | **Sparrow** | The neutralization action (named after the Arrow's missile) |
| Threat feed | **Radar sweep** | Continuous scanning across data sources |
| Agent outputs | **Intercept reports** | What the agents produce |
| Alert count badge | **Active contacts** | e.g. "5 ACTIVE CONTACTS" |
| Threat list | **Contacts** | Threats that have crossed into defended airspace |
| Takedown actions | **Intercepts** | Neutralization tracking |

### What stays as-is
- **Observatory** — the main view. Calm, strategic, watchful.
- **Brands** — the assets being defended. Shown as tactical diamond markers.
- **Email Posture** — clear enough, no translation needed.
- **Briefings** — Observer intel reports.
- **Webhooks** — technical term, keep it.
- **Settings** — universal.

---

## 7. AI AGENT SQUADRON

Each agent has a unique name, color, icon, and role within the intercept chain.

| Agent | Color | Hex | Role | Description |
|-------|-------|-----|------|-------------|
| **Sentinel** | Signal Red | #C83C3C | Threat Detection | Continuous radar sweep across all feeds. The first to detect contacts crossing into airspace. Animated radar icon with sweep arm and contact dots. |
| **ASTRA** | Warning Amber | #E8923C | Fire Control | Named after the Arrow's fire control system. Classifies, scores, and prioritizes threat severity. Targeting diamond with crosshair and center lock. |
| **Observer** | Contrail Blue | #78A0C8 | Strategic Intel | The eye in the sky. Daily briefings, macro trend analysis, weekly summaries. Stylized eye icon with iris rings. |
| **Navigator** | Blue 600 | #5A80A8 | Geo Mapping | Plots threat origins, enriches IP infrastructure, maps attack geography. Globe wireframe with pin and compass. |
| **Blackbox** | Slate | #8A8F9C | Flight Recorder | Captures threat event history and timelines as narrative. Scroll icon with EKG waveform, REC indicator, timestamp markers. |
| **Pathfinder** | All Clear Green | #28A050 | Target Acquisition | Identifies high-value prospects from platform data, researches companies, generates personalized outreach. Delta path with waypoint dots. |

### Agent Status States
| State | Color | Label |
|-------|-------|-------|
| Active/Scanning | Agent's own color, pulsing dot | SCANNING / ANALYZING / ENRICHING |
| Standby | 30% opacity of agent color | STANDBY |

---

## 8. ICON SYSTEM

17 custom SVG icons across three categories. All use the delta wing visual language.

### Agent Icons (6)
- **Sentinel:** Animated radar sweep with concentric rings and contact dots
- **ASTRA:** Targeting diamond with crosshair lines and center lock dot
- **Observer:** Stylized eye with iris rings, pupil, and scan lines
- **Navigator:** Globe wireframe with latitude lines, map pin, and compass arrow
- **Blackbox:** Scroll/flight recorder with red EKG waveform, timestamp markers, REC dot
- **Pathfinder:** Upward delta path with waypoint dots, dashed route, and target ring

### Navigation Icons (6)
- **Airspace:** Concentric defense rings with delta at center and threat dots on perimeter
- **Brands:** Tactical diamond marker inside dashed defense perimeter with beacon and status nodes
- **Contacts:** Warning triangle with inner triangle and exclamation mark
- **Intercepts:** Convergent trajectory lines meeting at impact burst point
- **Email Posture:** Envelope with shield overlay and lock icon
- **Briefings:** Document with fold, text lines, and red "INTEL" classification stamp

### Tool Icons (5)
- **Scan / Sortie:** Targeting brackets with scan line and magnifying glass
- **Takedown / Sparrow:** Solid delta arrow striking through a broken target ring with impact burst lines
- **Notifications:** Bell with clapper and numbered alert dot
- **Webhooks:** Connection nodes with lightning bolt and dashed lines
- **Settings:** Gear with aerospace spoke pattern

### Icon Rendering Rules
- Default size: 28-32px in cards, 24px in nav strips
- Always render as inline SVG (not img tags) for color theming
- Each icon accepts `size` and `color` props
- On dark backgrounds: push stroke opacity to 0.7-1.0 and fill opacity to 0.8-1.0
- On light backgrounds: reduce slightly to 0.5-0.8 range
- Animated icons (Sentinel radar sweep) should use requestAnimationFrame or setInterval at 30fps

---

## 9. UI COMPONENTS

### Navigation Bar
- Background: cockpit (#080E18) in dark, polar (#F8F7F5) in light
- Logo mark + wordmark left-aligned
- Nav items: IBM Plex Mono, 10px, uppercase, letter-spacing 0.06em
- Active item: parchment/tarmac text with 2px Signal Red bottom border
- Inactive items: contrail blue at 40% (dark) or slate (light)
- Right side: UTC timestamp + active contacts badge (pulsing red dot + count)

### Stat Cards
- 4-column grid
- Background: console (#142236) dark / polar (#F8F7F5) light
- Label: IBM Plex Mono, 8-9px, secondary text, uppercase, letter-spacing 0.1em
- Value: Plus Jakarta Sans, 22-28px, weight 800
- Alert values use Signal Red; normal values use primary text color
- Subtle border: bulkhead-opacity dark / haze-opacity light

### Data Tables
- Header row: slightly elevated background (avionics/linen)
- Row borders: 1px at very low opacity
- Brand names: Plus Jakarta Sans, 13px, weight 600
- Domain/data: IBM Plex Mono, 10-11px
- Grade chips: colored background at 15% opacity, colored border at 30%, IBM Plex Mono weight 700
- Threat counts: colored by severity threshold (>10 = red, >0 = amber, 0 = green)
- Status badges: uppercase, IBM Plex Mono 9px, colored bg/border/text per status

### Contact/Threat Rows
- Left border: 3px colored by severity (critical=red, high=amber, medium=blue)
- Severity dot: 6-7px circle, matching severity color, critical gets box-shadow glow
- ID: IBM Plex Mono, muted secondary text
- Type: IBM Plex Mono, weight 600, primary text
- Target: Plus Jakarta Sans, weight 600
- Vector badge: IBM Plex Mono 9px, blue tint background/border
- Age: right-aligned, muted

### Buttons
| Type | Background | Text | Border |
|------|-----------|------|--------|
| Primary | red-500 | parchment/white | none |
| Secondary | transparent | red-500 | red-500 at 40% |
| Tertiary | console/polar | contrail/tarmac | bulkhead/haze |
| Success/Resolve | green-500 | white | none |
| Destructive | red-800 | parchment | none |

All buttons: IBM Plex Mono, 10px, weight 600, letter-spacing 0.06em, uppercase, border-radius 4-6px, padding 8px 16-18px.

### Agent Status Cards (Sidebar)
- Background: console (#142236) dark
- Left-colored dot: agent's assigned color, pulsing if active
- Name: IBM Plex Mono, 10-11px, weight 700
- Status label: IBM Plex Mono, 8-9px, agent's color if active, 30% if standby
- Role + last run: IBM Plex Mono, 9px, muted secondary

---

## 10. DUAL THEME SYSTEM

The platform uses two distinct themes for two distinct contexts. These are NOT a toggle — they are applied by route/context.

### Dark Theme — Platform App (Observatory, Brands, Agents, etc.)
- Base: deep-space (#080C14)
- Cards/panels: instrument-panel (#111827) — use `.glass-card` utility
- Elevated: panel-highlight (#1A2234) — use `.glass-elevated` utility
- Primary text: instrument-white (#E8ECF1)
- Secondary text: gauge-gray (#8896AB)
- Borders: instrument-edge (#2A3548) at various opacities
- Primary accent: afterburner (#E5A832) — CTAs, active states, nav highlights
- Secondary accent: wing-blue (#0A8AB5) — info, links, secondary actions
- Alert: signal-red (#C83C3C) — critical threats, danger states

### Light Theme — Public Site (landing, pricing, about, login)
- Base: cloud (#F8F7F5)
- Cards: warm-cream (#F0EDE8)
- Borders: warm-border (#E2DDD5)
- Primary text: ink (#1A1F2E)
- Secondary text: slate (#5A6170)
- Primary accent: amber-deep (#C88B1E)
- Secondary accent: blue-deep (#0878A0)
- Alert: red-deep (#B53030)

### Token Mapping Between Themes

| Role | Dark Token | Light Token |
|------|-----------|-------------|
| Background | deep-space (#080C14) | cloud (#F8F7F5) |
| Card bg | instrument-panel (#111827) | warm-cream (#F0EDE8) |
| Border | instrument-edge (#2A3548) | warm-border (#E2DDD5) |
| Primary text | instrument-white (#E8ECF1) | ink (#1A1F2E) |
| Secondary text | gauge-gray (#8896AB) | slate (#5A6170) |
| Primary accent | afterburner (#E5A832) | amber-deep (#C88B1E) |
| Secondary accent | wing-blue (#0A8AB5) | blue-deep (#0878A0) |
| Alert | signal-red (#C83C3C) | red-deep (#B53030) |

### Logo Treatment
- **Dark theme:** Deep Arrow gradient on dark background — standard treatment
- **Light theme:** Logo always enclosed in a dark container (dark pill or circle on light background) — never render the gradient delta directly on light

---

## 11. PRICING TIERS

| Tier | Price | Brands | Notes |
|------|-------|--------|-------|
| Free | $0 | 1 scan | Public domain submission |
| Professional | $799/mo | 1 brand | Full monitoring + agents |
| Business | $1,999/mo | 10 brands | Multi-brand + team |
| Enterprise | Starting $4,999/mo | Custom | SSO, SIEM, dedicated support |

Priced at 1/2 to 2/3 of incumbent brand protection platforms ($20K-$150K/yr). Do NOT name competitors in public materials.

---

## 12. ANTI-PATTERNS

Things that should NEVER appear in Averrow UI or marketing:

- Generic cybersecurity purple/neon green color schemes
- Padlock icons, generic shield icons
- Stock photography of hooded hackers
- "Powered by" badges for infrastructure providers (Cloudflare, Anthropic, etc.)
- Specific threat feed names on public pages
- The word "Trust Radar" in any public-facing context (internal codebase only)
- Rounded, bubbly, SaaS-aesthetic UI components
- Excessive emoji in professional contexts
- Auto-generated contact emails
- "Careers" or "Partners" links unless those programs exist
- SOC2 badges unless certified

---

## 13. CORPORATE SITE NOTES

- Light mode default with dark toggle
- Hero section: watermark/ghosted image of Observatory dashboard showing 7-day threat trend — real product UI visible behind headline, slightly obscured
- All boxes, lines, borders: advanced CSS treatments (animated gradients, glow effects, glassmorphism)
- Consistent icon system between platform dashboard and public site
- Use advanced packages (Three.js, d3, etc.) for standout hero graphics
- Replace "CA" references with 🇨🇦 flag emoji
- Contact emails: hello@, security@, sales@averrow.com (not auto-generated)

---

## 14. CODEBASE NOTES

- Internal codebase retains `trust-radar` naming for now
- Repository: github.com/cleerox-svg/trust-radar
- Monorepo: packages/trust-radar (Cloudflare Worker + D1)
- Agent renaming in code can happen incrementally — public UI labels should use new names immediately
- Always start fresh Claude Code sessions between major build phases to avoid context drift
- The platform runs on Cloudflare Workers (TypeScript), D1/SQLite, and Claude Haiku for AI agents

---

## 15. SHARED BRAND COMPONENTS

### SocialDots — `components/brands/SocialDots.tsx`

Renders a row of 8px colored dots representing a brand's social platform presence.

**Props:**
- `profiles: { platform: string; classification?: string }[] | null` — social profiles
- `maxDots?: number` — max visible dots (default 6), overflow shows "+N"
- `className?: string`

**Platform colors:**
| Platform | Color |
|----------|-------|
| Twitter/X | #1DA1F2 |
| LinkedIn | #0A66C2 |
| Facebook | #1877F2 |
| Instagram | #E1306C |
| YouTube | #FF0000 |
| TikTok | #00d4ff (orbital-teal) |
| Reddit | #FF4500 |

**Classification overrides:**
- IMPERSONATION → #f87171 (critical red)
- SUSPICIOUS → #fbbf24 (medium yellow)
- OFFICIAL → platform color above
- No data → 3 placeholder dots at `bg-white/10`

Tooltip on hover shows "Platform — Classification".

### TrendBadge — `components/brands/TrendBadge.tsx`

Displays a directional trend indicator.

**Props:**
- `trend: number | null`
- `className?: string`

**Color rules:**
- Positive (threats increasing): `▲ {n}%` in `text-red-400`
- Negative (threats decreasing): `▼ {n}%` in `text-green-400`
- Zero or null: `—` in `text-white/30`

### Sparkline — `components/brands/Sparkline.tsx`

Inline SVG polyline chart for threat history. No external libraries.

**Props:**
- `data: number[]` — 7 data points typical
- `color?: string` — overrides auto-tier color
- `width?: number` (default 120)
- `height?: number` (default 28)
- `className?: string`

**Color by threat tier (auto):**
| Max value | Color |
|-----------|-------|
| ≥ 200 | #f87171 (critical) |
| ≥ 100 | #fb923c (high) |
| ≥ 50 | #fbbf24 (medium) |
| < 50 | #78A0C8 (contrail) |

strokeWidth 1.5, fill none, strokeLinecap round. Gracefully handles all-zero data (flat line).

### Brand Card Layout

Standard card used in Top Targeted and Monitored tabs:

```
┌─────────────────────────────────────┐
│ [1] favicon  Brand Name    [GRADE]  │  rank badge + favicon + name + grade/status
│              domain.com             │  domain in mono text-[11px] text-white/40
│ ─────────────────────────────────── │
│ [●●●●] social dots                  │  SocialDots component
│ [███████░░] sparkline               │  inline SVG sparkline, full width
│ 2,322          ▲ 12.4%  [phishing] │  threat count + TrendBadge + type pill
│ active threats                      │
└─────────────────────────────────────┘
```

Card wrapper: `rounded-xl border border-white/10 bg-cockpit p-4 hover:border-white/20 transition-colors cursor-pointer`

### Design Notes

- **Afterburner Amber (#E5A832)** is the primary accent for: selected pill states, active borders, interactive CTAs, and stat card highlight metrics
- **orbital-teal (#00d4ff)** is **reserved** for Observatory map beams and logo glow only — not for general UI chrome
- All components exported from `components/brands/index.ts` for reuse across views
- All color decisions reference `AVERROW_DESIGN_SYSTEM_BRIEF.md` as the single source of truth

### Brands Hub — Three-View System

The Brands page supports three views toggled via a persistent (localStorage) selector: **List**, **Heatmap**, and **Swimlane**.

**Heatmap View:**
- Brands sorted by `threat_count` descending (hottest top-left)
- Cell color from `severityColor()`, opacity driven by `severityOpacity(count, max)`
- Dynamic column count: <20 brands → 5 cols, <50 → 8, <100 → 10, else 12
- Legend bar (Critical/High/Medium/Low/Clean) + search input
- Summary bar: critical brands, clean brands, total threats, brands shown
- Hover tooltips with brand name, threat count, email grade

**Swimlane View:**
- Grouped by sector: Financial Services, Technology, Cryptocurrency, Healthcare, Retail, Government, Media, Other
- Only non-empty sectors rendered; unrecognized sectors fall into "Other"
- Pill width proportional to threat count: `48 + (count / maxInSector) * 152px`, min 56px, max 200px
- Pill color from `severityColor()`, opacity 0.82
- Max 7 visible pills per lane; overflow shows "+N more" pill
- Hover tooltips with brand name, domain, email grade, threat count

**Shared:**
- Both views use the shared `filteredBrands` array — no separate data fetch
- `severityColor()` and `severityOpacity()` always imported from `lib/severityColor.ts` — never redefined
- Empty state shown when no brands match filters

---

## 16. MOBILE UX PATTERN — Command Center + Drill + Bottom Sheet

### Mobile Navigation Architecture
- Entry point: Command Center (6-tile dashboard at /v2/ on mobile)
- Navigation: Tap tile → drill into page → DrillHeader with back button → return to Command Center
- Each drilled page: Hero stats area (always visible) + BottomSheet (expandable data list)
- Desktop layouts are NEVER modified by mobile changes — use `useMobile()` hook to branch

### Shared Mobile Components (`src/components/mobile/`)

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `useMobile` | Single source of truth for mobile detection | Returns `boolean` (isMobile) |
| `DrillHeader` | Back nav + page title + optional badge | `title`, `badge?`, `onBack` |
| `MobileBottomSheet` | 3-state expandable panel (peek/half/full) | `peekHeight`, `halfHeight`, `fullHeight`, `headerLeft`, `headerRight`, `children` |
| `HeroStatGrid` | 2x2 or 3-col stat card grid | `stats[]`, `cols?` |
| `MobileFilterChips` | Compact horizontal filter pills | `filters[]` |

### Mobile Page Template

Every mobile page MUST follow this structure:
1. `DrillHeader` (back to Command Center)
2. Hero area: `HeroStatGrid` + any page-specific summary (donut, trend chart, status bar)
3. `MobileBottomSheet`: `headerLeft` (section title) + `headerRight` (`MobileFilterChips`) + scrollable list rows
4. No infinite scroll pages — data lives inside the BottomSheet

### Rules
- ALL mobile detection uses `useMobile()` hook — no other `window.innerWidth` checks
- ALL mobile pages use `DrillHeader` + `MobileBottomSheet` — no exceptions
- Tailwind only — zero inline styles (except dynamic severity colors via `style={{ color }}`)
- Sheet default state: `'half'` for data-heavy pages, `'peek'` for visualization-heavy pages (Observatory)
- Filter chips use `MobileFilterChips` component — never standalone pill JSX
- Brand/item rows inside BottomSheet follow consistent layout: rank + icon + name/subtitle + right-aligned metric + chevron

---

*This document is the single source of truth for all Averrow platform design decisions. When in doubt, reference this brief.*
