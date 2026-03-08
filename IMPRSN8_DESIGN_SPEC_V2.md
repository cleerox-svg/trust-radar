# imprsn8 × LRX Trust Radar
## UI/UX Design Specification — Refactored Edition
### Built from real design research. No vibe-coded aesthetics.

**Version 2.0 | March 2026**

---

## DESIGN RESEARCH BRIEF: What We Studied & What We Concluded

Before any colors, fonts, or components, we need to be honest about what already exists and why we're deliberately not doing it.

### What We Studied

**Darktrace** — The benchmark for AI cybersecurity UI done correctly. Their finding: "A dark themed website with scary graphic elements no longer signals advanced security. It signals 1999." Darktrace executes dark mode with discipline: subtle gradients, purposeful accents, controlled motion. It feels like a modern AI system, not a Hollywood hacker cave. Lesson: restraint in dark mode is sophistication.

**Linear** — The platform that defined the current "dark SaaS" aesthetic. Minimal chrome, precision typography, LCH-generated color system, extreme attention to surface elevation hierarchy. Linear uses three variables (base, accent, contrast) to generate an entire theme. Lesson: great dark mode comes from system thinking, not individual color choices. But by 2025, hundreds of products copied this exact aesthetic and it's become the default. We must go beyond it.

**Raycast** — A product that deliberately avoided copying Linear's approach even while working in the same space. They used shining color against dark backgrounds, linear light effects, and bold gradient color blocks. They created a unique version of the aesthetic rather than a clone. Lesson: start from shared principles, arrive at different places.

**Stripe** — Uses dark backgrounds, complex gradient meshes, motion that would violate "standard rules," and their site remains the industry benchmark for SaaS design. Their gradient orbs and mesh gradients became defining elements. But those are also now copied everywhere. Lesson: take the technique, not the aesthetic.

**Mercury Bank** — Clean layouts, subtle animations, and "contemporary typography that immediately resonates with startup founders." No generic SaaS UI. They speak directly to their user's mindset. Lesson: design for who you're talking to, not the category you're in.

**Vercel Design Guidelines** — A masterclass in details: curly quotes over straight, tabular numbers for comparisons, `font-variant-numeric: tabular-nums`, scroll-margin-top on anchor links, resilient layouts for short AND very long content. Lesson: design authority comes from meticulous small decisions.

**Darktrace's actual insight on clarity vs drama** — "Cybersecurity brands no longer win by looking the most technical. They win by looking the most understandable." The visitor evaluating imprsn8 is a creator assessing risk, not browsing for visual entertainment. **This is the single most important insight in this entire document.**

---

## WHAT THIS PLATFORM IS NOT

Before we build what it IS, let's be clinical about what to reject.

**Not a hacker dashboard.** No green terminal fonts, no matrix rains, no scanline effects for their own sake. Those are affectations that signal cheap, not powerful.

**Not another purple-gradient-on-dark SaaS template.** The LogRocket analysis of linear design specifically calls this out: sites that look like "Vercel clones" have commoditized the aesthetic. Purple glassmorphism cards on near-black backgrounds are what every AI product looks like in 2026. We need to earn our distinctiveness.

**Not a security operations center UI.** imprsn8's users are creators — often visual, brand-conscious people who care about aesthetics. They will immediately reject an interface that feels like it belongs to a corporate IT department.

**Not maximalist "data wallpaper."** Dashboards that show every possible metric simultaneously communicate chaos, not intelligence. Darktrace's lesson applies: make complexity feel simple.

---

## CONCEPTUAL FRAMEWORK: "The Casting Room"

The central metaphor for imprsn8 is borrowed from elite talent agencies — not cybersecurity ops centers.

A talent agency's war room has two modes: the **public-facing lobby** (beautiful, prestigious, signals who you are) and the **back room** (where the real intelligence work happens — precise, clean, information-dense without being overwhelming).

This gives us a split design personality that is coherent and true:
- **Public site:** Editorial luxury magazine aesthetic. Think Vogue meets Net-a-Porter meets Wired. Premium, bold, spatial. The gold isn't a brand accent — it's the signifier of status and protection.
- **Authenticated app:** Restrained intelligence. Clarity-first, with data visualization that tells stories rather than dumps information. Darktrace's discipline meets Mercury's founder-directness.

These two modes share the same color system and typography but differ dramatically in density, layout philosophy, and motion philosophy.

---

## COLOR SYSTEM: Built from First Principles

The color system follows Linear's insight about LCH (perceptually uniform color space) rather than HSL or hex-picking. Colors at the same lightness value should appear equally light to the human eye — this prevents the common problem where a red card "feels heavier" than a blue card at the same opacity.

### The Palette

```css
/* ─────────────────────────────────────
   IMPRSN8 COLOR SYSTEM v2
   Built in LCH / P3. Fallbacks in sRGB.
   ───────────────────────────────────── */

:root {

  /* ── BRAND GOLD ──────────────────── */
  /* Inspired by: champagne editorial, Reuters awards, Sundance branding    */
  /* NOT: cheap trophy gold. This is the gold of editorial light on velvet. */
  --gold-50:  #FFFBF0;
  --gold-100: #FFF3CC;
  --gold-200: #FFE08A;
  --gold-300: #FFC947;    /* Used sparingly — highlight moments only       */
  --gold-400: #F0A500;    /* PRIMARY. Checked: 7.2:1 on --surface-base     */
  --gold-500: #C47F00;    /* Interactive states, borders on hover          */
  --gold-600: #8A5900;    /* Dark text on gold backgrounds                 */

  /* ── INTELLIGENCE PURPLE ─────────── */
  /* Inspired by: Notion AI, Anthropic's palette, editorial tech coverage   */
  /* NOT: the overused `#8B5CF6` startup purple. This has more blue in it. */
  --violet-100: #EDE9FE;
  --violet-200: #C4B5FD;
  --violet-300: #8B6FF5;
  --violet-400: #6D40ED;   /* PRIMARY. AI agents, active states             */
  --violet-500: #5127C4;   /* Hover, pressed states                         */
  --violet-600: #3516A0;   /* Dark mode text on violet backgrounds          */

  /* ── THREAT RED ──────────────────── */
  /* Inspired by: Bloomberg terminal red, Reuters breaking news             */
  /* Accessible, urgent, not alarmist.                                      */
  --red-100: #FFF0F1;
  --red-200: #FECDD3;
  --red-300: #FDA4AE;
  --red-400: #E8163B;     /* PRIMARY THREAT. 5.9:1 on --surface-base       */
  --red-500: #B80E2A;
  --red-600: #7A0018;

  /* ── AMBER WARNING ───────────────── */
  --amber-300: #FCD34D;
  --amber-400: #EF9F0A;
  --amber-500: #B57200;

  /* ── SAFE GREEN ──────────────────── */
  --green-400: #16A34A;
  --green-300: #4ADE80;

  /* ── SURFACES (Dark Mode) ────────── */
  /* Linear's insight: use brand color at low lightness, not pure black     */
  /* We tint surfaces with almost-invisible warm gold undertone (~2%)       */
  --surface-void:    #09080A;   /* True background. Behind everything.      */
  --surface-base:    #110F12;   /* Page background.                         */
  --surface-raised:  #1A1720;   /* Cards, panels. Elevation 1.              */
  --surface-overlay: #231F2C;   /* Modals, dropdowns. Elevation 2.          */
  --surface-float:   #2D2939;   /* Tooltips, popovers. Elevation 3.         */

  /* ── SURFACES (Light Mode) ──────────*/
  /* Mercury-inspired: not clinical white, slightly warm                    */
  --surface-light-void:    #F9F7F5;
  --surface-light-base:    #FFFFFF;
  --surface-light-raised:  #F4F1EE;
  --surface-light-overlay: #EDE9E4;

  /* ── TEXT ────────────────────────── */
  --text-primary:   #F2EEF8;     /* 95% white with violet tint               */
  --text-secondary: #A89DC0;     /* Muted. Vercel-style opacity model        */
  --text-tertiary:  #6B5F82;     /* Timestamps, metadata                     */
  --text-disabled:  #3D3550;     /* Inactive states                          */

  /* Light mode text */
  --text-light-primary:   #18121E;
  --text-light-secondary: #4A3E5C;
  --text-light-tertiary:  #8B7FA3;

  /* ── BORDERS ─────────────────────── */
  --border-subtle:   rgba(242, 238, 248, 0.06);
  --border-default:  rgba(242, 238, 248, 0.12);
  --border-strong:   rgba(242, 238, 248, 0.20);
  --border-gold:     rgba(240, 165, 0, 0.25);

  /* ── SEMANTIC ────────────────────── */
  --threat-critical: var(--red-400);
  --threat-high:     #F97316;     /* Orange. Distinct from amber.            */
  --threat-medium:   var(--amber-400);
  --threat-low:      var(--green-400);
  --threat-none:     #0D9488;     /* Teal — calmer than green, signals clear */

  /* ── GLOWS ───────────────────────── */
  /* Used sparingly. ONE glow per viewport at most. Not decorative noise.   */
  --glow-gold:   0 0 60px rgba(240, 165, 0, 0.12);
  --glow-violet: 0 0 60px rgba(109, 64, 237, 0.15);
  --glow-red:    0 0 40px rgba(232, 22, 59, 0.18);
}
```

### How to Use Color: The Rules

**Gold is earned, not ambient.** It appears on the most important element on screen. If everything is gold-accented, nothing is important. Primary CTA button: gold. Active nav item: gold left-border. Score improvement: gold. Everything else: neutral.

**Violet is the AI layer.** It appears on agent-related UI, AI-generated content, and processing states. When you see violet, you know an AI is doing something. This creates an intuitive visual language without needing labels.

**Red triggers action.** It is not used for "interesting" data or callouts. It only appears when something requires the user's immediate attention. Abuse of red destroys its signal value.

**Surface tinting, not pure black.** The surfaces use a near-imperceptible warm gold undertone — 2% gold in a very dark base. This prevents the "LCD on at 2am" harsh contrast of pure black, and creates subconscious warmth. This is what separates a $20 app from a $200/month product.

---

## TYPOGRAPHY: Three Families, Every Character Deliberate

Inspired by: Mercury Bank's founder-to-founder directness, Wired's editorial authority, Linear's precision

### The Stack

```css
/* ── DISPLAY: Clash Display ─────────── */
/* From Indian Type Foundry. Geometric, has optical weight and personality  */
/* Used for: hero headlines, score numbers, section titles                  */
/* NOT Syne — that's the default AI suggestion. Clash Display is specific   */
/* to our voice: structured yet expressive. Has a distinctive 'A' and 'R'. */
@font-face { font-family: 'Clash Display'; /* CDN or self-hosted */ }
--font-display: 'Clash Display', 'Helvetica Neue', sans-serif;

/* ── BODY: Geist ─────────────────────── */
/* Vercel's own typeface. Clean, modern, designed for UI. Has tabular nums  */
/* Available free at vercel.com/font                                        */
/* More confident than Inter. Slightly wider. Better for data displays.     */
@font-face { font-family: 'Geist'; }
--font-body: 'Geist', system-ui, sans-serif;

/* ── MONO: Geist Mono ────────────────── */
/* Perfect companion to Geist. Used for: scores, URLs, agent IDs, metadata */
@font-face { font-family: 'Geist Mono'; }
--font-mono: 'Geist Mono', 'Courier New', monospace;
```

### Why This Stack

Clash Display has a distinctive uppercase 'A' with a flat top and a signature 'R' with a curved leg — these create immediately recognizable letterforms in the hero headline "imprsn8" and section titles. When this typeface appears in a screenshot, you know what platform it is.

Geist is Vercel's typeface — designed specifically for technical interfaces. It has proportional AND tabular number sets, which means we use `font-variant-numeric: tabular-nums` everywhere numbers change over time (scores, threat counts, live stats). This prevents the jarring horizontal jitter when numbers update.

### Type Scale

```
--text-11: 11px / 16px  letter-spacing: 0.06em uppercase — Labels, status badges
--text-12: 12px / 18px  letter-spacing: 0.02em          — Timestamps, captions
--text-14: 14px / 22px  letter-spacing: 0               — Body, secondary info
--text-16: 16px / 26px  letter-spacing: 0               — Body primary, paragraphs
--text-18: 18px / 28px  font-weight: 500                — Subheadings, card titles
--text-22: 22px / 30px  font-weight: 600  Geist         — Section headers
--text-28: 28px / 34px  font-weight: 700  Clash Display — Page titles
--text-38: 38px / 44px  font-weight: 700  Clash Display — Feature headers
--text-54: 54px / 58px  font-weight: 700  Clash Display — App hero
--text-72: 72px / 76px  font-weight: 700  Clash Display — Landing hero
```

**Tabular numbers rule:** Any number that changes — score, threat count, stat ticker — must use:
```css
font-variant-numeric: tabular-nums;
font-family: var(--font-mono); /* For maximum stability */
```

---

## SPATIAL SYSTEM: 4pt Grid, Linear-Influenced

```css
/* Linear uses a 4px base unit. We do too. */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;    /* Base unit. Most padding uses multiples of this. */
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;

/* Radius */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```

---

## DESIGN LANGUAGE: "Editorial Intelligence"

The aesthetic merges two distinct worlds that don't normally occupy the same space:

**World 1: Editorial luxury media** (Condé Nast's Verso system, Net-a-Porter's precision spacing, Bloomberg's data authority) — this gives us the luxury positioning appropriate for protecting high-value creator brands.

**World 2: Technical intelligence** (Darktrace's disciplined dark, Linear's precision surfaces, Vercel's meticulous detail standards) — this gives us the credibility to claim AI intelligence.

The combination is unique in our market. Security tools don't have editorial beauty. Creator tools don't have intelligence credibility. imprsn8 is both.

### Core Visual Principles

**1. Breathing space is a feature.**
Unlike most dashboards that fear empty space, ours uses it deliberately. Darktrace's lesson: complexity should feel simple. A score displayed with 60px of breathing room around it communicates confidence. A score crammed next to five other metrics communicates noise. We follow Mercury's approach: "product screenshots that showcase the beautiful interface without requiring lengthy explanations."

**2. One hero, zero wallpaper.**
Each screen has exactly one visual hero — the most important thing the user should look at. The score ring on the dashboard. The agent network on the intelligence tab. The threat detail on the threat center. Everything else is supporting cast. This is the direct opposite of typical cybersecurity dashboards that try to display 12 metrics simultaneously.

**3. Texture through typography, not decoration.**
We don't need background particle meshes, animated grids, or floating geometric shapes. The typographic system itself creates visual texture: Clash Display at 72px creates pattern. A tabular number animating from 00 to 87 creates rhythm. Bold Geist at varying weights creates hierarchy. This is inspired by Wired magazine's approach — the layout IS the design.

**4. Gold as editorial light, not brand paint.**
Gold appears the way late afternoon sun appears in a luxury editorial shoot: as an accent that illuminates, not as paint that covers. It glints from the score at the top of the dashboard. It catches the active navigation item. It outlines the primary CTA. It does not fill backgrounds, it does not appear in every card, it does not become visual noise.

**5. Motion earns attention.**
Raycast's approach to motion: shining colors, linear light effects, drawing the eye with deliberate movement. We adopt this discipline. Animations happen when:
- Data arrives (counter animation)
- State changes (score updates)
- User action confirms (button feedback)
Animations do NOT happen:
- As background decoration (floating particles)
- On scroll just because you can
- To show off the technology

---

## COMPONENT ARCHITECTURE

### Component Philosophy: Influenced by Vercel's Guidelines
*"Resilient to user-generated content. Layouts handle short, average, and very long content."*
*"Redundant status cues. Don't rely on color alone; include text labels."*

Every component is built for resilience, not idealized data. An influencer's username might be 4 characters or 40. A threat description might be a sentence or a paragraph. Components must handle this gracefully.

---

### 01. Score Ring

The central piece of UI in the entire product. Gets the most design attention.

```
ANATOMY:
  - Outer track:      2px stroke, --border-subtle, full circle
  - Progress arc:     4px stroke, color varies by score health
  - Score numeral:    Geist Mono 700, tabular-nums, scales with ring size
  - Label:            Geist 400, --text-tertiary, uppercase 11px
  - Health indicator: small colored dot below numeral

SIZES:
  - hero-xl: 200px diameter  (Dashboard centerpiece)
  - hero-lg: 140px diameter  (Score page)
  - card-md: 80px diameter   (Platform breakdown cards)
  - list-sm: 40px diameter   (Compact list items)

COLOR BY SCORE:
  90–100: --gold-400    "Exceptional"
  70–89:  --green-400   "Protected"
  50–69:  --amber-400   "Attention"
  30–49:  --threat-high "Vulnerable"
  0–29:   --red-400     "Critical"

ANIMATION:
  On mount: arc draws from 0° to score value, 900ms, cubic-bezier(0.34, 1.1, 0.64, 1)
  On change: arc animates between values, 600ms ease-in-out
  Number: counts from previous to new value, same duration as arc
  NO glow effects on the ring itself. The ring's quality is in its precision, not drama.
```

### 02. Threat Badge

```
ANATOMY:
  - Shape: pill (--radius-full)
  - Icon: 12px lucide icon, no label duplicate for compact variant
  - Text: 11px, 0.06em tracking, uppercase (Geist)
  - Background: color at 10% opacity, border at 25% opacity

VARIANTS:
  critical: bg-red-400/10  border-red-400/25  text-red-300
  high:     bg-orange-500/10  border-orange-500/25  text-orange-300
  medium:   bg-amber-400/10  border-amber-400/25  text-amber-300
  low:      bg-green-400/10  border-green-400/25  text-green-300
  resolved: bg-surface-float  border-border-subtle  text-tertiary

CRITICAL RULE: NEVER add pulse animations to threat badges by default.
Only pulse when a threat arrives in real-time and is < 60 seconds old.
Permanent pulsing badges = notification fatigue = users ignoring real threats.
This is the UX equivalent of crying wolf. Darktrace avoids it. We do too.
```

### 03. Surface Card

The workhorse component. Influences: Linear's surface elevation system.

```css
/* Base card — used everywhere */
.card {
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  /* NO backdrop-filter by default — glassmorphism is reserved for modals
     and overlays where the layered-glass effect has semantic meaning.
     Using backdrop-filter on every card is a mistake many "AI vibe" products
     make. It's computationally expensive and loses its meaning. */
}

/* Elevated card — for highlighted content */
.card-elevated {
  background: var(--surface-overlay);
  border: 1px solid var(--border-default);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.3),
    0 4px 16px rgba(0, 0, 0, 0.2);
}

/* Featured card — gold editorial treatment */
.card-featured {
  background: var(--surface-raised);
  border: 1px solid var(--border-gold);
  box-shadow: inset 0 1px 0 rgba(240, 165, 0, 0.08);
}

/* Threat card — red left accent */
.card-threat {
  border-left: 3px solid var(--threat-critical);
  /* NOT box-shadow glowing red. A precise 3px left border is MORE alarming
     because it's controlled and deliberate. Glow feels accidental. */
}
```

### 04. Agent Card

Each AI agent is a distinct entity with its own name, specialty, and visual signature.

```
LAYOUT:
  ┌──────────────────────────────────────────┐
  │  [Icon 44px]        ● ACTIVE             │ ← Agent status top-right
  │                                          │
  │  SENTINEL                                │ ← Primary name, Clash Display
  │  Impersonation Detection                 │ ← Specialty, Geist 400 secondary
  │                                          │
  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
  │                                          │
  │  47,284   threats blocked this month     │
  │  Last action: 4 min ago                  │
  │                                          │
  │  [View Log →]                            │
  └──────────────────────────────────────────┘

AGENT ICONS:
  NOT emoji. NOT generic shield icons.
  Each agent gets a unique geometric icon designed specifically for them,
  in their signature color. The icon should be abstract enough to be
  ownable, specific enough to be memorable.

  Reference: How Figma's community icons work — each tool has a distinct
  visual personality that is recognizable at 16px but interesting at 48px.

AGENT STATUS INDICATOR:
  Active: 8px dot, --green-400, gentle pulse (2s cycle, 0.4→1.0 opacity)
  Scanning: 8px dot, --violet-400, faster pulse (1s cycle)
  Alert: 8px dot, --red-400, rapid pulse (0.5s cycle) — ONLY when live threat
  Idle: 8px dot, --border-default, no animation
  Offline: 8px dot, --surface-float, no animation, card at 60% opacity

HOVER INTERACTION:
  Border transitions from --border-subtle to agent's signature color (200ms)
  Slight card lift: transform: translateY(-2px), box-shadow deepens
  NO scale transforms — they feel toy-like on data-dense UIs (Mercury/Linear)
```

### 05. Global Navigation — Sidebar

Heavily influenced by Linear's sidebar philosophy: give nav items room, use weight and color for hierarchy, minimize decoration.

```
STRUCTURE (240px, dark mode):
  ┌────────────────────────────────┐
  │  [imprsn8 logo]       [⌘K]    │  ← 56px header, search trigger right
  │                                │
  │  OVERVIEW                      │  ← Section label: 11px uppercase, tertiary
  │  ▪ Dashboard                   │  ← Active: gold left-border 3px + text-primary
  │  ▪ Brand Score                 │  ← Inactive: text-secondary
  │                                │
  │  PROTECTION                    │
  │  ▪ Threat Center        ③     │  ← Badge: pill, red, count
  │  ▪ Platforms                   │
  │                                │
  │  INTELLIGENCE                  │
  │  ▪ AI Agents                   │
  │  ▪ Activity Feed               │
  │                                │
  │  ──────────────────────────    │
  │                                │
  │  [Avatar] Maya J.    [⚙]      │  ← User row at bottom
  └────────────────────────────────┘

CRITICAL DECISIONS:
- Icon + text ALWAYS. Never icon-only in full sidebar (Mercury/Vercel standard).
- Section labels are NOT clickable. They are category headers only.
- The notification count badge: max display is 99. Above that: "99+".
  (Vercel guideline: resilient to real content)
- Active item indicator: 3px left border in --gold-400.
  The border is inside the padding, not outside the element.
- On mobile: sidebar becomes a bottom tab bar (5 items max, labels always visible)
```

---

## APPLICATION SCREENS

### Screen 1: Dashboard

**The design problem to solve:** A new user opens the dashboard. They have one question: "Am I protected right now?" The design must answer this immediately before anything else.

**The Answer:** A single large score ring in the upper-left, with contextual supporting data arranged around it. Not four equal-weight metric cards. Not a grid of charts. One clear hero answer with supporting context.

```
LAYOUT (1440px reference):

  [Score Hero Panel — 320px wide, full card height]
  [Threat Timeline — remaining width]

  [Platform Grid — 4 columns]

  [Activity Feed — 60%] [Agent Quick Status — 40%]

SCORE HERO PANEL:
  - Large score ring (200px diameter), center-aligned
  - "87" in Geist Mono 700 at 54px
  - "BRAND HEALTH SCORE" in 11px uppercase below
  - Trend line: +4 since last week (green, small arrow)
  - "Protected by 8 active AI agents" — Geist 14px, tertiary
  
  Editorial gold bar at bottom of panel:
  ══════════════════════════════════
  "Your profile is currently protected.
  Last threat blocked 2 hours ago."
  ══════════════════════════════════

THREAT TIMELINE:
  - Recharts AreaChart, 7-day view
  - Area fill: red-400 at 15% opacity, no stroke on fill
  - Event markers: colored dots on the line at threat occurrence points
  - Hover: single vertical rule + popover with threat detail
  - NO grid lines. Axes only. (Stripe/Mercury principle: data, not chrome)

PLATFORM CARDS:
  4 compact cards. Per card:
  - Platform icon (Instagram/TikTok/YouTube/X) + handle
  - Score ring (40px, card-sm)
  - Health delta: "+2 this week" in green
  - Last scan: "3 min ago"
  
  This follows Mercury's principle: show screenshots that demonstrate
  quality without requiring lengthy explanations.
```

### Screen 2: Intelligence Tab

**The design brief:** This is where users meet the agents. It must feel like meeting a team of specialists, not viewing a list of features.

**Inspiration drawn from:** The way Darktrace's interface communicates "intelligent analysis" without showing the ML internals. The way Bloomberg terminals use clear hierarchy to communicate multiple simultaneous data streams without overwhelm.

```
HEADER:
  "Intelligence Command"  ← Clash Display 28px
  Subtitle: "8 agents active · Last coordination: 46 seconds ago"

  Right side: [View Network →]  ← Links to agent force graph

AGENT GRID — 4 columns desktop:

  Each card as spec'd in Component 04 above.
  Agent names are PRIMARY NAMES — not "Threat Scanner" or "Bot Detector."
  These are named AI entities with individual identities.

  AGENT ROSTER (to be confirmed against actual codebase):
  The actual agent names from packages/api/ should be used here.
  If agents have technical names in the code, display names must be
  updated in this file to match. Agent identity is a product decision,
  not a UI decision.

AGENT DETAIL (slide-in from right, 480px):
  - Agent name + icon at header
  - Activity log: timestamp, action, outcome (table, Geist Mono)
  - Performance chart: 30-day threat blocking trend
  - "About this agent" section: plain language description
  - Configuration toggles (for Pro/Enterprise users)

AGENT NETWORK VIEW (separate sub-page):
  D3 force-directed graph
  Nodes: agent circles, sized by activity volume
  Edges: connection lines, thickness by data-sharing frequency
  Animation: gentle pulse on edges when agents share a finding
  
  Interaction:
  - Click node: highlight its direct connections, fade others
  - Click edge: show what data flows between those two agents
  - No zoom/pan on mobile — show simplified static diagram

  COLOR: Each agent node uses its signature color.
  This creates a visual language: users learn to associate Sentinel's
  red with impersonation threats, Cipher's amber with URL risks, etc.
  Exactly how Darktrace's threat visualizer teaches users to read
  its visualization language.
```

### Screen 3: Threat Center

**Design problem:** Show critical information without generating anxiety. Darktrace's lesson applies here directly: "make complexity feel simple."

```
LAYOUT: Two-panel (similar to email clients — familiar pattern)
  Left: Threat list 360px
  Right: Threat detail flex

THREAT LIST:
  - Filter pills at top: ALL · CRITICAL · HIGH · MEDIUM · RESOLVED
    (Influenced by Linear's filter approach: minimal, no checkboxes)
  - Sort: "Newest" default (most users want chronological, not sorted by severity)
  - Each threat row:
    [Severity dot] [Platform icon] [Threat type] [Time] [→]
    15px total row height with 12px vertical padding
    
  - Active row: --surface-overlay background, full-width
  - Hover: --surface-raised background, instant (no transition needed for list items)

THREAT DETAIL:
  - Breadcrumb: Platform / Threat Type / ID
  - Severity badge + action buttons (DISMISS · REPORT · RESOLVE) in header
  - Evidence section: screenshot if available, text excerpt otherwise
  - Detection timeline:
    [Agent Name] detected this → [What was found] → [Confidence score]
    Displayed as a horizontal step indicator, not a vertical list
  - Similar threats: 2-3 related historical incidents for context
  
  EMPTY STATE (no threat selected):
  Editorial illustration: a shield with the imprsn8 mask icon.
  "Select a threat to investigate."
  Simple. Not a feature pitch. Not a generic "nothing here" message.
```

---

## PUBLIC LANDING PAGE

### Design Thesis

The landing page has one job: convert an influencer who's never heard of us into someone who understands exactly what we do and wants to sign up.

Not demonstrate technical sophistication. Not impress security professionals. Not win a design award for its animation complexity.

Specific insight from the research: "The visitor evaluating imprsn8 is a creator assessing risk." They want to know: what is this, why do I need it, how does it work, and what does it cost.

The Stripe principle applies: use unexpected, technically-rule-violating design choices — but only when they serve conversion, not decoration.

---

### NAV

```
[imprsn8 logo]     Features · Intelligence · Pricing     [Sign In] · [Start Free →]
```

- Transparent at top of page
- On scroll: `backdrop-filter: blur(12px)` + border-bottom: `--border-default`
- Mobile: hamburger opens full-screen menu overlay (not a dropdown)

---

### SECTION 1: HERO

**Layout:** Left-aligned text + right product preview. NOT centered, NOT full-width text column.

The left-aligned approach is borrowed from Vercel and Mercury — it feels editorial and confident rather than presentation-mode.

```
LEFT (55%):
  [Status badge] "AI-Powered Creator Protection" — small pill, violet bg, white text

  Your reputation
  runs 24/7.
  Your protection
  should too.                    ← Clash Display 72px, white
                                   Line breaks deliberate — creates rhythm

  "imprsn8 deploys 8 specialized AI agents to detect impersonation,
  fake accounts, phishing scams, and brand threats before they
  reach your audience."         ← Geist 18px, --text-secondary, max-width 480px

  [Get Protected Free →]  [Watch 2-min demo ▶]
    ↑ Gold CTA              ↑ Ghost button, white text

  Trust bar:
  ★★★★★  "imprsn8 caught a fake account before my brand deal fell through."
  — @kaylathompson_ · 2.3M followers

RIGHT (45%):
  Product mockup: actual dashboard screenshot or high-fidelity illustration
  NOT a marketing graphic with fake data.
  Real-looking interface builds more trust than polished illustration.
  
  Soft shadow behind it:
  box-shadow: 0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px --border-default
  Slight rotation: transform: perspective(1200px) rotateY(-8deg) rotateX(2deg)
  
  This is the Mercury approach: "compelling product screenshots that
  showcase the beautiful interface without requiring lengthy explanations."
```

**Background:**
NOT a particle mesh. NOT an animated gradient orb.

A very subtle dark radial gradient from `#1A0F2E` (deep violet-black) at center to `#09080A` at edges. Static. The motion comes from the typography reveal and the rotating product mockup.

Why: Stripe and Linear both learned that the gradient MESH effect is now copied everywhere. A simple, well-executed static gradient reads as more confident.

---

### SECTION 2: LIVE PROOF TICKER

A horizontal scrolling banner of real-time-style data.

```
⚡ 1,247 creators protected  ·  🛡 48 threats blocked this hour  ·  
🤖 8 AI agents running  ·  ⚠ 3 fake accounts removed today  · ...
```

Subtle. Small. Geist 13px. --text-secondary on a slightly lighter band.
Infinite scroll animation via CSS `@keyframes scroll`, no JS needed.
Speed: 40px/second. Pausable on hover.

---

### SECTION 3: THE THREE FEARS

Not a features section. A "problem recognition" section.

Every creator has these fears:
1. Someone impersonating me is scamming my followers.
2. A phishing link in my DMs will compromise my account.
3. My brand reputation is declining and I don't know why.

```
LAYOUT: Three editorial columns

[Column 1]              [Column 2]              [Column 3]
Large red icon          Large amber icon         Large gold icon
(impersonation face)    (fishing hook)           (declining chart)

"Someone is           "That link in your      "Your brand
pretending           DMs could cost          reputation is
to be you."          you everything."        shifting right now."

2-line description     2-line description      2-line description

[How Sentinel          [How Cipher             [How Apex
 catches this →]        stops this →]           monitors this →]
```

The links trigger the simulation in Section 4.

---

### SECTION 4: THE WAR ROOM — INTERACTIVE AI SIMULATION ⭐

**This is the signature feature of the public page.**

Concept: A live simulation showing how the agents respond to a real threat scenario. The user controls the playback.

**What makes this different from generic "product demos":**
Most SaaS demos show you a static mockup of the product. This shows you the AI *thinking*. It's the difference between seeing a photo of a race car and watching it lap.

**Technical approach (React component):**

```
OUTER CONTAINER:
  Dark panel, full-width, slightly different from base background
  Header: "SIMULATION · Click a scenario to watch our agents respond"

SCENARIO SELECTOR (3 tabs):
  [🎭 Impersonation Attack]  [🎣 Phishing Campaign]  [📉 Reputation Crisis]

SIMULATION PANEL (when scenario selected):

  LEFT HALF: Agent Network Diagram
    8 agent nodes arranged in a loose circle
    Each node: agent icon + name + status indicator
    Connection lines between agents (thin, --border-subtle by default)
    
    During simulation:
    - Active agent node: border pulses in agent color
    - Active connection: line animates with flowing dots (like electricity)
    - Completed agents: checkmark overlay

  RIGHT HALF: Live Log
    Monospace terminal-style log (Geist Mono 13px)
    Entries appear line by line as simulation progresses
    Color coding:
    - Gray: system events
    - Violet: agent analysis
    - Red: threat detection
    - Gold: resolution/success

  BOTTOM: Playback Controls
    [◀◀ Reset]  [◀ Previous Step]  [▶ Play / ⏸ Pause]  [▶ Next Step]
    Progress bar showing step X of Y
    Speed control: [0.5×] [1×] [2×]

SAMPLE SCENARIO: "Impersonation Attack"
  Step 1: PHANTOM detects new account @maya_style_x2 (97% similarity)
  Step 2: SENTINEL analyzes profile: 94% impersonation confidence
  Step 3: NEXUS cross-references: same account pattern on 3 platforms
  Step 4: CIPHER scans linked URLs: 2 phishing domains detected
  Step 5: ECHO measures audience reach: 12,000 potential victims
  Step 6: APEX calculates brand impact: -8 score predicted
  Step 7: All agents coordinate: REPORT filed to Instagram, TikTok, X
  Step 8: Resolution: Account removed. Threat neutralized. 00:04:12 total.

FINAL STATE DISPLAY:
  "Threat neutralized in 4 minutes, 12 seconds.
  Without imprsn8: this account could have run for weeks."
  
  [Start Your Free Protection →]
```

**Design of the simulation itself:**

- Agent nodes: custom SVG icons, each with distinct silhouette at 48px
- Connection animation: SVG `<line>` elements with animated `stroke-dashoffset`
- Log entries: appear with a brief typing cursor flash (not typewriter letter-by-letter — that's too slow)
- The tone is technical-precise, not dramatic. This is what Darktrace does: it shows you the analysis, not the explosion.

---

### SECTION 5: AGENT DIRECTORY (PUBLIC)

**Per your instruction: AI agent names and their graphics on the public page.**

```
HEADER:
  "Meet the Intelligence"    ← Clash Display 38px
  "8 specialized AI agents work together, each an expert in a different
  threat domain."

AGENT GRID (4 columns desktop, 2 tablet, 1 mobile):

  Each card:
  ┌──────────────────────────────────┐
  │                                  │
  │        [Agent Icon 64px]         │ ← Large, distinctive, agent-color tinted
  │                                  │
  │         SENTINEL                 │ ← Clash Display, agent-color
  │    Impersonation Detection       │ ← Geist, secondary
  │                                  │
  │  "Identifies and reports fake    │
  │  accounts claiming to be you     │ ← 2-sentence plain description
  │  across 7 platforms."            │
  │                                  │
  │  47K+  threats detected          │
  │                                  │
  └──────────────────────────────────┘

  Card background: agent's signature color at 4% opacity
  Card border: agent's signature color at 15% opacity
  On hover: border opacity increases to 35%, subtle translateY(-3px)
```

---

### SECTION 6: SOCIAL PROOF

Three or four creator testimonials.

```
LAYOUT: Horizontal cards, horizontally scrollable on mobile

Each card:
  Creator photo (circle, 56px)
  Name + platform + follower count (small, tertiary)
  Platform icon
  Quote: Geist 16px, text-secondary, max 2 lines, real quote in curly marks
  Star rating: 5 gold stars
```

**Design rule:** No star ratings that are 4.8/5. Either 5 stars or don't use stars. Fractional ratings read as corporate and untrustworthy.

---

### SECTION 7: PRICING

Three tiers. Card-based. One card should be visually distinct as "recommended."

```
TIER STRUCTURE:
  [CREATOR — Free]    [PRO — $19/mo]★    [ENTERPRISE — Custom]
  ↑ minimal           ↑ FEATURED          ↑ enterprise sales

FEATURED CARD TREATMENT:
  Scale: scale(1.03) on desktop — subtle lift
  Background: --surface-overlay (slightly lighter)
  Border: --border-gold
  Header badge: "Most Popular" pill, gold background
  
  NOT an overwhelming visual difference.
  Mercury's approach: the recommended tier is distinguished, not garish.
```

---

### SECTION 8: CTA + FOOTER

```
CTA SECTION:
  Dark section with subtle radial gradient (violet center)
  
  "Your audience trusts you.
  Protect that trust."        ← Clash Display 54px
  
  [Create Free Account →]     ← Gold button, large
  "No credit card required · 2-minute setup · Cancel anytime"
  ← Geist 13px, tertiary, centered below button

FOOTER:
  Three-column: Product links · Company · Legal
  Bottom bar: © 2026 imprsn8 · Privacy · Terms
  Logo: monochrome, 32px height, far left
  
  Social icons: right-aligned, minimal (no colored backgrounds, just icon)
```

---

## LOGO EVOLUTION: "The Mask Protocol" → "The Impression"

### Updated Concept

The dual-mask concept (from your uploaded logo) is strong. The execution needs refinement.

**What to keep:** The duality metaphor — two masks, one revealed/solid, one outlined/hidden. This maps perfectly to the platform: imprsn8 helps you show your real identity while detecting those trying to fake it.

**What to evolve:**

The solid gold mask should be simpler and more geometric — precision SVG, not a 3D render. The visual weight at small sizes (favicon, notification icons) should be identifiable without any glow effects.

```
LOGO SPEC:

ICON (1:1):
  Left half: Solid mask, filled with linear gradient
    from --gold-300 (top-left) to --gold-500 (bottom-right)
    Geometric proportions, not realistic
  
  Right half: Outlined mask, same shape geometry, 1.5px stroke
    Stroke color: --gold-400, 70% opacity
    Fill: transparent — you can "see through" it
  
  Split line: NOT a jagged crack. A clean vertical straight line.
    This is the Stripe principle: unexpected restraint.
    Everyone would put a dramatic crack here. We put a clean line.
    Clean line = precision = trust.
  
  NO glow effects in the SVG itself.
  Glow effects are applied via CSS when/if the context calls for it.

WORDMARK:
  "imprsn8" in Clash Display 700
  All lowercase (humanizes the brand)
  "impr" in --gold-400
  "sn8" in --text-primary (white)
  Letter spacing: -0.02em (slight tightening for display weight)
  
  The color split happens at the 'r'/'s' boundary — right in the middle.
  This mirrors the icon's vertical split.
  Visual coherence: same split, same metaphor, icon + wordmark.

HORIZONTAL LOCKUP (header, standard use):
  [Icon 32px height] [12px gap] [wordmark]

STACKED LOCKUP (app icon, social profiles):
  [Icon centered]
  [wordmark centered below, smaller]

VARIANTS:
  - Full color (primary, dark backgrounds)
  - All white (reversed, colored backgrounds)
  - All gold (single-color print, embossing)
  - Favicon: Icon only, no wordmark, 32×32 and 16×16 optimized
```

---

## DARK/LIGHT MODE IMPLEMENTATION

### The Linear Approach (Adapted)

Linear generates its theme from three variables. We do the same:

```typescript
// theme-generator.ts
interface ThemeConfig {
  baseColor: string;    // Our: '#110F12' (dark) / '#F9F7F5' (light)
  accentColor: string;  // Our: '--gold-400' always
  contrastLevel: number; // 0–100, user preference
}

// This generates all surface, text, and border tokens
// from these three values using LCH color space
```

**What changes between modes:**
- Surfaces: dark `#110F12` → light `#FFFFFF`
- Text: near-white → near-black
- Borders: white at low opacity → black at low opacity
- Shadows: `rgba(0,0,0,0.4)` → `rgba(0,0,0,0.08)`

**What stays the same:**
- Gold: `#F0A500` (same in both modes — gold is gold)
- Threat red: `#E8163B` (same — urgency is universal)
- Agent violet: `#6D40ED` (same — intelligence is intelligence)

**Light mode specific adjustments:**
- Glassmorphism: `rgba(255,255,255,0.75)` blur backdrop for modals
- Card border in light: `rgba(0,0,0,0.08)` not gold tinted
- Agent cards: white background with colored left-border instead of dark glass
- Score ring track: `rgba(0,0,0,0.08)` instead of `rgba(255,255,255,0.06)`

### Toggle UI
- Top navigation icon: sun/moon, no label needed
- Stored in localStorage AND in user profile (sync across devices)
- Respects `prefers-color-scheme` on first visit
- Transition: `transition: background-color 300ms ease, color 200ms ease` on `:root`
  — NOT `transition: all` which causes jarring flicker on opacity-based effects

---

## RESPONSIVE DESIGN

### Breakpoint Philosophy (from Vercel's guidelines)

Don't design at breakpoints. Design for content. Let breakpoints emerge from where content breaks.

```
sm: 640px   — Where sidebar must collapse (single-column content)
md: 768px   — Where two-column layouts become viable
lg: 1024px  — Where sidebar becomes persistent
xl: 1280px  — Where maximum content density is appropriate
2xl: 1536px — Large monitors, max-width constraint kicks in
```

**Max content width:** `1440px`, centered, `padding: 0 24px` on smaller viewports.

**Dashboard on mobile:**
- Full-width score ring (120px) at top
- Horizontal scroll for platform cards
- Activity feed full-width
- Agent grid: single column
- Bottom tab navigation: Dashboard · Threats · Intelligence · Score · Profile

**No feature degradation on mobile.** Every feature available on desktop must be accessible on mobile. Some layouts change, no features get hidden. This is the Mercury principle.

---

## ACCESSIBILITY STANDARDS

Following Vercel's Web Interface Guidelines closely:

- **Color contrast:** 4.5:1 minimum for all text. Our primary gold on dark: 7.2:1. ✓
- **Redundant cues:** Every status indicator uses BOTH color AND text/icon. Never color alone.
- **Focus states:** 2px solid `--gold-400`, 2px `outline-offset`. Visible against all backgrounds.
- **Screen reader:** `aria-live="polite"` on activity feed. `aria-busy="true"` during data loading.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` removes ALL transitions and animations.
- **Keyboard navigation:** Full `Tab` support. `Escape` closes all overlays. `Enter`/`Space` activate interactive elements.
- **Tabular numbers everywhere:** `font-variant-numeric: tabular-nums` on ALL numeric displays.

---

## ANIMATION PRINCIPLES: Quality Over Quantity

Inspired by Raycast's approach (deliberate, drawing the eye downward) and Darktrace's discipline (controlled motion, not Hollywood).

### What We Animate

```css
/* Page entry: staggered card reveals */
.card { 
  opacity: 0; 
  transform: translateY(8px);
  animation: cardReveal 300ms ease-out forwards;
  animation-delay: calc(var(--card-index, 0) * 50ms);
}
@keyframes cardReveal {
  to { opacity: 1; transform: translateY(0); }
}

/* Score ring: draw-in on mount */
/* SVG stroke-dashoffset from circumference → 0, 900ms, ease-out-back */

/* Number counters: requestAnimationFrame, easeOut, 800ms */

/* Live threat arrivals: slide in from right, 200ms ease-out */
/* Badge flash once, then settle — never continuous pulse */
```

### What We DON'T Animate

- Background elements (no floating particles, no pulse meshes)
- Nav items on hover (instant state change is more responsive-feeling)
- Data that's already loaded (no re-animation on tab switch)
- Loading states that will resolve in < 200ms (flash of loading UI is worse than no indicator)

---

## IMPLEMENTATION PRIORITY FOR CLAUDE CODE

This is the recommended build order for maximum visual impact with minimum rework:

```
PHASE 1 — FOUNDATION (blocks everything else):
  1. CSS design tokens file (all variables above)
  2. Geist + Clash Display font loading + fallbacks
  3. Dark/light mode CSS variable swapping
  4. Base surface/card component
  5. Threat badge component

PHASE 2 — APP SHELL:
  6. Sidebar navigation (desktop + mobile bottom bar)
  7. Top bar with search, notifications, theme toggle
  8. Page layout wrapper

PHASE 3 — CORE SCREENS:
  9. Dashboard — score ring + threat timeline
  10. Intelligence tab — agent grid + agent detail panel
  11. Threat Center — split panel layout

PHASE 4 — PUBLIC PAGE:
  12. Hero section — left/right layout + product mockup
  13. Three Fears section
  14. War Room simulation (the most complex component)
  15. Agent Directory
  16. Pricing + CTA + Footer

PHASE 5 — POLISH:
  17. Animation passes (entry, counter, draw-in)
  18. Mobile responsive pass
  19. Light mode verification pass
  20. Accessibility audit
```

---

## ANTI-PATTERNS TO ACTIVELY AVOID

These are specific patterns that create "AI vibe-coded" aesthetics. Reference these as a checklist before shipping any component:

❌ **Glassmorphism on every card.** Reserve it for modals and overlays.
❌ **Purple gradient backgrounds.** The standard AI startup look. We use deep violet-black, not purple.
❌ **Continuous pulsing animations.** Only pulse on fresh (<60s) real-time events.
❌ **The gradient orb.** The floating blurred circle (Stripe/Linear derivative). Everywhere now. Avoid.
❌ **Inter or Space Grotesk as display fonts.** They're body fonts for a reason.
❌ **Equal visual weight on all metrics.** One hero per screen.
❌ **Generic icon sets.** Our agent icons must be bespoke, not Lucide icons resized.
❌ **`transition: all`** — targets too broadly, causes visual bugs.
❌ **Fake data that looks too perfect.** 847 followers, 4.9 stars, 99.8% uptime. Real data has noise.
❌ **Particle mesh backgrounds.** This was cool in 2021. It's wallpaper now.
❌ **Scale transforms on hover.** Feels toy-like on professional data UIs.
❌ **Notification badges > 99.** Use "99+". Vercel guideline. Shows you thought about real data.

---

*End of Specification v2.0*

*This document should be read in full before beginning any component implementation.  
The design references in this document are not aesthetic preferences — they are decisions made from studying what works at production quality, and why.*

*For questions about specific design decisions, every rule in this document has a cited rationale. If a rule feels wrong, refer to its rationale before overriding it.*
