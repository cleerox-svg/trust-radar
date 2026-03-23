# AVERROW REBRAND BUILD PLAN
## Complete Public Site & Platform Redesign

**CRITICAL: Start a fresh Claude Code session for each phase. Do not combine phases. Long sessions cause context drift and re-execution of stale instructions.**

**Reference document:** `AVERROW_DESIGN_SYSTEM_BRIEF.md` in the repo root. Claude Code should read this file at the start of every session.

---

## OVERVIEW

### Scope
- 22 template files (~10,000 lines)
- 138 "Trust Radar" references in templates
- 27 references in handlers
- 2 separate CSS systems to unify
- 15+ public-facing pages
- Platform dashboard (Observatory, Brands, Contacts, etc.)

### Phase Summary
| Phase | What | Files | Effort |
|-------|------|-------|--------|
| 1 | Foundation — CSS variables, nav, footer, logo | shared.ts | Medium |
| 2 | Homepage — Complete rewrite | homepage.ts | Large |
| 3 | Corporate pages — Platform, Pricing, About, Contact | platform.ts, pricing.ts, about.ts, contact.ts, security.ts | Large |
| 4 | Blog & Legal — Blog index, posts, terms, privacy, changelog | blog*.ts, terms.ts, privacy.ts, changelog.ts | Medium |
| 5 | Scan experience — Public scan, results page | scan.ts, scan-result.ts, landing.ts | Medium |
| 6 | Platform dashboard — Observatory, social dashboard, heatmap | Multiple handlers + templates | Large |
| 7 | Vocabulary sweep + cleanup | All files | Medium |

---

## PHASE 1: FOUNDATION
### Goal: Replace the shared CSS system, navigation, and footer with Averrow identity

### Claude Code Prompt:
```
Read AVERROW_DESIGN_SYSTEM_BRIEF.md in the repo root first.

Edit packages/trust-radar/src/templates/shared.ts:

1. REPLACE all CSS variables with the Averrow color system:

LIGHT MODE:
  --bg-primary: #F8F7F5 (polar)
  --bg-secondary: #FFFFFF (white)
  --bg-tertiary: #FAFAF8 (linen)
  --bg-code: #F0EDE8
  --bg-elevated: #FFFFFF
  --text-primary: #1A1F2E (tarmac)
  --text-secondary: #8A8F9C (slate)
  --text-tertiary: #C8C2BA (tundra)
  --text-inverse: #F0EDE8
  --border: #E0DCD6 (haze)
  --border-strong: #C8C2BA (tundra)
  --accent: #C83C3C (signal red)
  --accent-hover: #A82E2E (red-600)
  --accent-light: #E87070 (red-200)
  --accent-bg: rgba(200, 60, 60, 0.08)
  --accent-bg-strong: rgba(200, 60, 60, 0.15)
  --green: #28A050
  --green-bg: rgba(40, 160, 80, 0.08)
  --red: #C83C3C
  --red-bg: rgba(200, 60, 60, 0.08)
  --amber: #E8923C
  --blue: #78A0C8

DARK MODE:
  --bg-primary: #080E18 (cockpit)
  --bg-secondary: #0E1A2B (instrument)
  --bg-tertiary: #142236 (console)
  --bg-code: #0C1420
  --bg-elevated: #1A2E48
  --text-primary: #F0EDE8 (parchment)
  --text-secondary: #78A0C8 (contrail blue — use at ~80% for general secondary text)
  --text-tertiary: #5A80A8 (blue-600)
  --text-inverse: #1A1F2E
  --border: rgba(120, 160, 200, 0.08)
  --border-strong: rgba(120, 160, 200, 0.15)

FONTS:
  --font-display: 'Plus Jakarta Sans', sans-serif
  --font-body: 'Plus Jakarta Sans', sans-serif (replace DM Sans)
  --font-mono: 'IBM Plex Mono', monospace

2. UPDATE the Google Fonts import to load Plus Jakarta Sans (300-800 weights) and IBM Plex Mono (400-700). Remove DM Sans and any other fonts.

3. REPLACE the nav SVG logo with the Averrow Orbital Lock SVG mark. The mark is a delta wing triangle with gradient fill (Signal Red to Contrail Blue), a negative-space "A" cutout, three animated orbital ellipses rotating around it, four orbital dots, and a glowing vertex at the top. It should animate with CSS transforms (rotate the ellipses). Simplify for nav size (~24px).

4. REPLACE nav brand text: "Trust Radar" → "AVERROW" in IBM Plex Mono, weight 700, letter-spacing 0.14em. Sub-text "by LRX Enterprises" → "THREAT INTERCEPTOR" in IBM Plex Mono, much smaller.

5. UPDATE nav links: Platform, Pricing, About, Security, Blog, Contact — these stay the same.

6. REPLACE footer: Update all references to Trust Radar → Averrow. Update contact email from hello@trustradar.ca to hello@averrow.com. Remove any Cloudflare/Anthropic/SOC2 badges. Replace "CA" with 🇨🇦 flag emoji. Blog author: Claude Leroux.

7. REPLACE any remaining "trustradar.ca" or "lrxradar.com" domain references with "averrow.com" throughout shared.ts.

Do NOT change any other template files in this phase. Only shared.ts.

Deploy and verify the nav/footer renders correctly on any page before proceeding.
```

---

## PHASE 2: HOMEPAGE
### Goal: Complete rewrite of the homepage with Averrow identity, hero, agent showcase, and scan input

### Claude Code Prompt:
```
Read AVERROW_DESIGN_SYSTEM_BRIEF.md in the repo root first.

Completely rewrite packages/trust-radar/src/templates/homepage.ts.

The homepage currently has its OWN style system (Chakra Petch font, blue primary, dark void background). It does NOT use shared.ts wrapPage(). Rewrite it to use the shared.ts wrapPage() function and inherit the Averrow CSS variables established in Phase 1. Remove all inline style definitions that duplicate or conflict with shared.ts.

STRUCTURE:

1. HERO SECTION
   - Background: subtle radial gradient using Signal Red at very low opacity on dark mode base
   - Tag line above title: IBM Plex Mono, 11px, Signal Red, letter-spacing 0.3em, uppercase: "THREAT INTERCEPTOR"
   - Main headline: Plus Jakarta Sans, 48px, weight 800: "Canada's most advanced interceptor." Line break. "Designed for AI‑powered threats."
   - Sub-headline: 18px, secondary text color, max-width 580px: Describe what Averrow does in one sentence — AI agents that continuously scan the internet's attack surface to detect brand impersonation, phishing, and domain abuse before it reaches your customers.
   - Scan input box: domain input + "LAUNCH SORTIE" button (was "SCAN"). Style with Signal Red button, instrument panel input field, border glow on focus.
   - Hint below: "Enter any domain — no signup required" in IBM Plex Mono, tiny, muted.

2. AGENT SQUADRON SECTION
   - Section label: "AGENT SQUADRON" in IBM Plex Mono, Signal Red
   - Title: "Six AI agents. One mission."
   - Grid of 6 agent cards: Sentinel, ASTRA, Observer, Navigator, Blackbox, Pathfinder
   - Each card shows: agent icon (use SVG inline — reference the icon descriptions from the design brief), agent name, role title, one-line description
   - Each card has the agent's assigned color as accent (left border or dot)
   - Cards use instrument/console background on dark, white on light

3. HOW IT WORKS SECTION  
   - Three steps in a row:
     Step 1: "Enter a domain" — launch a sortie against any domain
     Step 2: "Agents deploy" — six AI agents scan feeds, CT logs, DMARC, NRDs, and more
     Step 3: "Threats intercepted" — contacts classified, graded, and queued for takedown
   - Use numbered markers with Signal Red, Plus Jakarta Sans weight 700

4. CAPABILITIES OVERVIEW
   - Brief grid or feature list covering: Threat Feed Intelligence, Email Security Posture, Social Media Monitoring, Lookalike Domain Detection, Certificate Transparency, AI-Powered Narratives
   - Do NOT name specific feeds (no PhishTank, URLhaus, etc.) — use generic descriptions
   - Each capability gets a one-liner and an icon reference from the icon system

5. CTA SECTION
   - "Defend your airspace" headline
   - Two buttons: "Launch Free Scan" (primary, Signal Red) and "View Pricing" (secondary, outlined)

6. Keep the existing scan JavaScript functionality but update any "Trust Radar" references in the JS to "Averrow". Update API endpoint calls if they reference old domain names.

7. Keep the spider trap injection (generateSpiderTraps) but update the domain parameter from "trustradar.ca" to "averrow.com".

IMPORTANT: The homepage should feel premium, aerospace-inspired, and completely different from generic cybersecurity marketing sites. Use the cockpit dark palette as default with generous spacing, IBM Plex Mono for labels, Plus Jakarta Sans for headlines. Advanced CSS treatments — animated gradient borders on cards, subtle glow effects on hover, glassmorphism on the scan input. Do NOT use generic SaaS patterns (purple gradients, generic shield icons, stock-style sections).
```

---

## PHASE 3: CORPORATE PAGES
### Goal: Update Platform, Pricing, About, Contact, and Security pages

### Claude Code Prompt:
```
Read AVERROW_DESIGN_SYSTEM_BRIEF.md in the repo root first.

Update the following template files. All use shared.ts wrapPage() and should inherit the Averrow CSS variables from Phase 1.

### packages/trust-radar/src/templates/platform.ts
Rewrite the platform overview page:
- Hero: "The Averrow Platform" headline. Subtitle: "AI-powered brand threat intelligence. Six agents defending your digital airspace."
- Replace all "Trust Radar" → "Averrow"
- Update capability sections to use Averrow vocabulary:
  - "Threat Feed Scanning" → "Radar Sweep — Continuous Threat Detection"
  - "Email Security" → "Email Security Posture Engine"
  - "Social Monitoring" → "Social Airspace Monitoring"
  - "AI Agents" → "Agent Squadron"
  - Reference agents by new names: Sentinel, ASTRA, Observer, Navigator, Blackbox, Pathfinder
- Update the agent cards to use new names, colors, and descriptions from the design brief
- Narrative block examples should reference "Blackbox" not "Narrator"
- Feature checkmarks should use Signal Red or All Clear green

### packages/trust-radar/src/templates/pricing.ts
- Replace all "Trust Radar" → "Averrow"
- Tiers: Free ($0, 1 scan), Professional ($799/mo, 1 brand), Business ($1,999/mo, 10 brands), Enterprise (starting $4,999/mo, custom)
- Do NOT name competitors
- Highlight "Designed for AI-powered threats" messaging
- CTA buttons in Signal Red

### packages/trust-radar/src/templates/about.ts
- Replace "Trust Radar" → "Averrow" throughout
- Update the brand story to reference the Avro Arrow heritage:
  "In 1958, Canada built the most advanced interceptor in the world — the Avro Arrow. Averrow carries that legacy into the digital domain. We detect, classify, and neutralize threats crossing into your brand's airspace before they reach their target."
- Parent company: LRX Enterprises Inc. 🇨🇦
- Remove any Careers/Partners links

### packages/trust-radar/src/templates/contact.ts
- Replace "Trust Radar" → "Averrow"
- Contact emails: hello@averrow.com, security@averrow.com, sales@averrow.com
- Remove any auto-generated email references

### packages/trust-radar/src/templates/security.ts
- Replace "Trust Radar" → "Averrow" throughout
- Update any infrastructure references if needed
- Keep technical security content accurate
```

---

## PHASE 4: BLOG & LEGAL
### Goal: Update blog, terms, privacy, changelog

### Claude Code Prompt:
```
Read AVERROW_DESIGN_SYSTEM_BRIEF.md in the repo root first.

### packages/trust-radar/src/templates/blog.ts
- Replace "Trust Radar" → "Averrow" in index page
- Blog author: Claude Leroux
- Update any blog card descriptions that reference old branding

### packages/trust-radar/src/templates/blog-post-1.ts through blog-post-4.ts
- Replace all "Trust Radar" → "Averrow" in each post
- Replace old agent names: if "Analyst" appears → "ASTRA", if "Cartographer" → "Navigator", if "Narrator" → "Blackbox", if "Prospector" → "Pathfinder"
- Replace "Observatory" in any public-facing marketing context (it stays for the platform dashboard but marketing copy may need updating)
- Replace domain references: trustradar.ca → averrow.com
- Keep the content and technical accuracy intact

### packages/trust-radar/src/templates/changelog.ts
- Replace "Trust Radar" → "Averrow"
- Update any version notes that reference old branding

### packages/trust-radar/src/templates/terms.ts
- Replace "Trust Radar" → "Averrow"
- Replace "trustradar.ca" → "averrow.com"
- Update company references: LRX Enterprises Inc. operating as Averrow

### packages/trust-radar/src/templates/privacy.ts
- Same as terms — replace all brand and domain references
```

---

## PHASE 5: SCAN EXPERIENCE
### Goal: Update the public scan page, results page, and landing page

### Claude Code Prompt:
```
Read AVERROW_DESIGN_SYSTEM_BRIEF.md in the repo root first.

### packages/trust-radar/src/templates/scan.ts (933 lines)
This is the public scan page with its own extensive styling.
- Replace all "Trust Radar" → "Averrow"
- Update the scan button text: "Scan" → "Launch Sortie" or "Scan Domain"
- Update the page title and meta description
- Align color system with Averrow variables (this file may have its own inline styles — unify with shared.ts where possible)
- Replace domain references

### packages/trust-radar/src/templates/scan-result.ts (317 lines)
- Replace "Trust Radar" → "Averrow"
- Update "Trust Score" language if present → "Defense Score" or "Threat Assessment"
- Update grade colors to match Averrow defense grade scale (A+=green, B+=blue, C=gold, D=amber, F=red)

### packages/trust-radar/src/templates/landing.ts (2,260 lines — LARGEST FILE)
This is the biggest template. Approach carefully:
- Replace all "Trust Radar" → "Averrow" 
- Replace domain references: trustradar.ca → averrow.com
- Update any agent name references to new names
- Update color references if this file has its own inline styles
- Do NOT restructure the layout — just rebrand text, colors, and references
- If this file has duplicate CSS variable definitions, align them with shared.ts

### packages/trust-radar/src/templates/not-found.ts (602 lines)
- Replace "Trust Radar" → "Averrow"
- Update styling to match Averrow palette

### packages/trust-radar/src/templates/honeypot-lrx.ts (322 lines)
- Update domain references
- This is a trap page — update branding but keep functionality intact
```

---

## PHASE 6: PLATFORM DASHBOARD
### Goal: Update the logged-in platform experience

### Claude Code Prompt:
```
Read AVERROW_DESIGN_SYSTEM_BRIEF.md in the repo root first.

This phase updates the authenticated platform pages and handler-rendered HTML.

### packages/trust-radar/src/templates/social-dashboard.ts (598 lines)
- Replace "Trust Radar" → "Averrow"
- Update any agent references to new names
- Align color tokens with Averrow palette

### packages/trust-radar/src/templates/heatmap-component.ts (920 lines)
- Replace "Trust Radar" → "Averrow"
- Update color values to use Averrow palette tokens
- This is a data visualization component — keep the structure, update the skin

### packages/trust-radar/src/handlers/observatory.ts
- This renders the main Observatory view
- Replace any "Trust Radar" branding in rendered HTML
- Update agent names in any UI labels: Analyst → ASTRA, Cartographer → Navigator, Narrator → Blackbox, Prospector → Pathfinder
- Keep "Observatory" as the page name (confirmed in design brief)

### Scan all handlers for rendered HTML:
Run: grep -rn "Trust Radar\|trustradar\|trust-radar" packages/trust-radar/src/handlers/ --include="*.ts"
Replace all brand references in any HTML strings returned by handlers.

### Update handler-rendered agent references:
Run: grep -rn "Analyst\|Cartographer\|Narrator\|Prospector" packages/trust-radar/src/handlers/ --include="*.ts"
For any that appear in UI labels or HTML output (not internal logic), update to new names.
NOTE: Internal agent IDs in code (like agent_id = 'analyst') should stay as-is for now to avoid breaking the pipeline. Only update display labels.
```

---

## PHASE 7: VOCABULARY SWEEP + CLEANUP
### Goal: Final pass to catch every remaining reference

### Claude Code Prompt:
```
Read AVERROW_DESIGN_SYSTEM_BRIEF.md in the repo root first.

Final cleanup pass across the entire codebase.

1. SEARCH AND REPORT all remaining references:
   grep -rn "Trust Radar" packages/trust-radar/src/ --include="*.ts"
   grep -rn "trustradar" packages/trust-radar/src/ --include="*.ts"
   grep -rn "trust-radar" packages/trust-radar/src/ --include="*.ts" (skip package.json, wrangler.toml — these stay internal)
   grep -rn "lrx-radar\|lrxradar" packages/trust-radar/src/ --include="*.ts"

2. Replace all remaining "Trust Radar" → "Averrow" in any user-facing strings (HTML, meta tags, page titles, error messages, email subjects).

3. Replace all remaining "trustradar.ca" → "averrow.com" in user-facing URLs and email addresses.

4. Do NOT change:
   - package.json package names (stay as trust-radar internally)
   - wrangler.toml worker names
   - D1 database names
   - GitHub repo name
   - Internal agent IDs (sentinel, analyst, observer, cartographer, narrator, prospector) — these are pipeline identifiers
   - Any import paths or file names

5. VERIFY: Check that the Google Fonts import matches the design brief (Plus Jakarta Sans + IBM Plex Mono only, no DM Sans, no Chakra Petch, no Outfit, no Syne).

6. VERIFY: Check that no specific feed names appear on public pages:
   grep -rn "PhishTank\|URLhaus\|OpenPhish\|PhishStats" packages/trust-radar/src/templates/ --include="*.ts"
   If found in public-facing HTML, replace with generic descriptions.

7. VERIFY: Check that contact emails are updated:
   grep -rn "hello@\|security@\|sales@" packages/trust-radar/src/templates/ --include="*.ts"
   All should point to @averrow.com or @averrow.ca

8. VERIFY: No Cloudflare/Anthropic/SOC2 badges remain in footer or anywhere public-facing.

9. Deploy and do a full visual walkthrough of every public page:
   /, /platform, /pricing, /about, /security, /blog, /blog/*, /changelog, /contact, /privacy, /terms, /scan

Report any issues found.
```

---

## POST-REBRAND TASKS

After all 7 phases are complete:

### DNS / Domain
- Add averrow.com and averrow.ca as custom domains on the Cloudflare Worker
- Set up 301 redirects: trustradar.ca → averrow.com, lrxradar.com → averrow.com
- Update Google Cloud Console OAuth redirect URIs
- Update CSP, CORS origins to include new domains

### Email
- Set up catch-all email on averrow.com (or averrow.ca)
- Update DMARC RUA address if using dmarc_rua@trustradar.ca → dmarc_rua@averrow.com

### External References
- Update GitHub repo description/README (keep repo name as trust-radar)
- Update any external links or integrations

### Google Search Console
- Verify averrow.com
- Submit sitemap
- Monitor for indexing

---

## TIMELINE ESTIMATE

| Phase | Sessions | Time |
|-------|----------|------|
| Phase 1: Foundation | 1 session | 30 min |
| Phase 2: Homepage | 1 session | 60 min |
| Phase 3: Corporate pages | 1-2 sessions | 60-90 min |
| Phase 4: Blog & Legal | 1 session | 30-45 min |
| Phase 5: Scan experience | 1-2 sessions | 45-60 min |
| Phase 6: Platform dashboard | 1-2 sessions | 45-60 min |
| Phase 7: Vocabulary sweep | 1 session | 20-30 min |
| Post-rebrand DNS/email | Manual | 30 min |
| **Total** | **7-10 sessions** | **~5-6 hours** |

---

*Each phase prompt is self-contained. Copy-paste the prompt into a fresh Claude Code session. Always instruct Claude Code to read AVERROW_DESIGN_SYSTEM_BRIEF.md first.*
