# TRUST RADAR — CLAUDE CODE EXECUTION GUIDE

## How to Get This Built
**Date:** March 21, 2026

---

## STEP 1: COMMIT PLAN DOCS TO REPO

Add these files to the repo root. Claude Code reads them at the start of each session.

```
trust-radar/
├── docs/
│   └── plans/
│       ├── UNIFIED_PLATFORM_PLAN.md          (master plan)
│       ├── CORPORATE_SITE_PLAN.md            (site architecture + pages)
│       ├── VISUAL_DESIGN_SPEC.md             (observatory watermark, advanced CSS, icons)
│       ├── BRAND_HANDLES_BACKEND.md          (brand management + backend assessment)
│       └── TODO_AUDIT.md                     (claims vs reality)
│
├── docs/
│   └── prototypes/
│       ├── corporate-site.html               (HTML prototype — design reference only)
│       └── corporate-site-full.jsx           (React prototype — design reference only)
```

The prototypes go in a separate folder marked as reference — Claude Code looks at them for design direction but doesn't deploy them. The actual site gets built as Worker-rendered HTML.

**Do this now:**
1. Download all 7 files from this conversation
2. Create the `docs/plans/` and `docs/prototypes/` directories
3. Commit and push to master

---

## STEP 2: BUILD IN FOCUSED SESSIONS

Each Claude Code session gets ONE job with ONE or TWO plan docs to read. Don't ask it to read everything at once.

### The Build Sequence

```
SESSION 1: Foundation fixes (30 min)
SESSION 2: Corporate site — landing page + nav + footer (1 hr)
SESSION 3: Corporate site — interior pages (1 hr)
SESSION 4: Free Brand Exposure Report — backend (1 hr)
SESSION 5: Free Brand Exposure Report — frontend (30 min)
SESSION 6: Legal pages + contact form (30 min)
SESSION 7: Social handle checking (1 hr)
SESSION 8: Lookalike domain generator (30 min)
```

---

## SESSION 1: FOUNDATION FIXES

**What it does:** Domain migration, scanner false positive fix, dead code cleanup.

**Prompt for Claude Code:**

```
Read docs/plans/TODO_AUDIT.md first, then check the current state of the codebase.

Do these three things:

1. DOMAIN MIGRATION: Update all hardcoded references from lrx-radar.com 
   to trustradar.ca — CSP headers, CORS origins, OAuth redirect URIs, 
   any fetch URLs. Check wrangler.toml custom domains are set.

2. SCANNER FIX: Check if the backfill-safe-domains route exists and is 
   deployed. If yes, document how to hit it. Check if migration 0017 
   exists in the migrations folder. Fix the CSP inline script/event 
   handler blocking issue.

3. CLEANUP: Find and remove any references to "OpenAI", "GPT-4o-mini", 
   "api.lrx.io", or the FastAPI packages/api service. Check if anything 
   still imports from packages/api. If nothing references it, note that 
   it can be removed. Do NOT remove packages/imprsn8 — it's an 
   independent product.

Commit each fix separately with descriptive messages.
```

---

## SESSION 2: CORPORATE SITE — LANDING PAGE

**What it does:** Builds the actual landing page as Worker-rendered HTML with the full design system.

**Prompt for Claude Code:**

```
Read these files in order:
1. docs/plans/VISUAL_DESIGN_SPEC.md (read ALL of it — design system, 
   observatory watermark, card treatments, icon system)
2. docs/prototypes/corporate-site.html (design reference for layout, 
   colors, structure)
3. docs/plans/CORPORATE_SITE_PLAN.md (just the landing page section 
   and design system notes section)

Now build the Trust Radar landing page as Worker-rendered HTML served 
from packages/trust-radar.

Requirements:
- The Worker should serve HTML at the root path /
- Use the approved design system: Syne display, DM Sans body, IBM Plex 
  Mono for data. Teal/coral/green accent system. Light mode default 
  with dark toggle.
- Use Lucide icons (inline SVGs from the icon mapping in the visual spec)
- The hero section MUST include the Observatory watermark — a ghosted 
  rendering of the dashboard UI (7-day threat trend chart, score gauge, 
  stat cards) behind the headline text. Build it as real SVG/HTML at 
  low opacity, not an image.
- All cards use the advanced treatments from the visual spec (animated 
  top-edge gradient on hover, corner accent markers for elevated cards)
- All dividers use the animated gradient treatment
- Buttons use the shimmer hover effect
- Include: hero, trust bar (generic feed type badges — NOT feed names), 
  4-capability overview cards, how-it-works steps, pricing section 
  ($799/$1,999/Custom), CTA, footer
- Shared nav and footer as reusable functions
- Mobile responsive
- Do NOT name any specific threat feeds, AI providers, or competitors

The site is for LRX Enterprises Inc. The product is Trust Radar.
Pricing: Free scan, $799/mo Professional, $1,999/mo Business, 
Custom Enterprise (starting $4,999/mo).

Use Three.js from CDN for the hero radar animation if appropriate, 
or a high-quality SVG animation. Use d3 from CDN for any data 
visualizations. Prioritize visual quality — this needs to look like 
a real cybersecurity company, not a startup template.

Commit as: "feat(site): build corporate landing page with observatory watermark"
```

---

## SESSION 3: CORPORATE SITE — INTERIOR PAGES

**What it does:** Platform, About, Pricing, Security, Blog, Changelog, Contact pages.

**Prompt for Claude Code:**

```
Read these files:
1. docs/plans/CORPORATE_SITE_PLAN.md (all page specs)
2. docs/plans/VISUAL_DESIGN_SPEC.md (icon mapping + card treatments)
3. Look at the landing page you built in the last session for design 
   consistency

Build the remaining corporate site pages, all served by the same Worker:

/platform — Platform overview (4 capabilities with visual cards, 
            architecture flow diagram, integrations grid)
/about    — Company page (LRX Enterprises Inc. story, three principles: 
            Outside-In First / AI-Native / Radically Accessible, tech 
            stack, company facts, careers section)
/pricing  — Standalone pricing page (same tiers as landing, add 
            generalized competitor pricing comparison — "Incumbent 
            Entry $20K-$30K/yr" etc. Do NOT name specific competitors)
/security — Security practices, infrastructure security, compliance 
            roadmap (SOC 2 timeline), responsible disclosure policy 
            (security@trustradar.ca), data handling
/blog     — Blog index with 6 post cards (title, date, category, excerpt). 
            Posts don't need full content yet — just the index page.
/contact  — Contact form (name, email, company, interest dropdown, message) 
            + contact info sidebar (hello@, security@, sales@, careers@)
/changelog — Timeline with 8 release entries, color-coded badges

Every page must:
- Share the same nav and footer from the landing page
- Use the same design system (Syne, DM Sans, IBM Plex Mono, teal/coral/green)
- Use Lucide icons from the canonical mapping
- Use the card treatments from the visual spec
- Support light/dark theme toggle
- Be mobile responsive

The Worker router should match paths and render the appropriate page.
Add a 404 page for unmatched routes.

Commit as: "feat(site): add platform, about, pricing, security, blog, contact, changelog pages"
```

---

## SESSION 4: FREE BRAND EXPOSURE REPORT — BACKEND

**What it does:** Builds the /api/scan/report endpoint that powers the free scan tool.

**Prompt for Claude Code:**

```
Read docs/plans/UNIFIED_PLATFORM_PLAN.md — Section 2.4 (Free Brand 
Exposure Report) and Section 1 (Platform Philosophy, both modes).
Also read docs/plans/TODO_AUDIT.md to see what's built vs not.

Build the Brand Exposure Report API endpoint:

POST /api/scan/report
Input: { domain: string, brand_name?: string }
Rate limit: 5 per hour per IP (unauthenticated), unlimited for 
authenticated users

The endpoint should run these checks IN PARALLEL (Promise.all):

1. EMAIL SECURITY SCAN — Use the existing email security posture 
   engine (it's already built). Call it with the submitted domain.
   Return SPF/DKIM/DMARC/MX results + overall grade.

2. THREAT FEED CHECK — Use the existing threat feed scanning pipeline. 
   Check if the domain appears in any connected feeds. Return match 
   count and severity.

3. LOOKALIKE DOMAIN CHECK — NEW CODE. Build a domain permutation 
   generator in src/lib/dnstwist.ts:
   - Character omission
   - Adjacent character swap  
   - TLD swap (.com → .net, .org, .co, .ca, .io)
   - Hyphenation (trustradar → trust-radar)
   - Keyword additions (-login, -support, -secure)
   Generate top 20 permutations, check registration via Cloudflare 
   DoH (dns-query?name=X&type=A). Return which are registered.

4. SOCIAL HANDLE CHECK — NEW CODE. Build basic platform checking 
   in src/lib/social-check.ts:
   - Extract handle from domain (remove TLD)
   - Check if the handle exists on GitHub (api.github.com/users/{handle})
   - Other platforms: just generate the URL for now, mark as 
     "check_available" (full checking comes later)
   Return per-platform status.

5. AI ASSESSMENT — Call the Analyst agent with all results from 
   steps 1-4. Use a new prompt template that asks it to generate 
   a brief assessment paragraph (3-4 sentences) covering the most 
   significant findings and top recommendation.

COMPOSITE SCORE: Compute a Brand Exposure Score (0-100) using:
- Email security: 30% weight
- Domain threats: 25% weight  
- Threat feed matches: 25% weight
- Social presence: 20% weight

Build the scoring utility in src/lib/scoring.ts.

Cache results in KV for 24 hours per domain.

Return a BrandExposureReport JSON object with all results.

Commit as: "feat(scan): build Brand Exposure Report API endpoint"
```

---

## SESSION 5: FREE BRAND EXPOSURE REPORT — FRONTEND

**What it does:** Builds the /scan page UI that calls the report endpoint.

**Prompt for Claude Code:**

```
Read docs/plans/VISUAL_DESIGN_SPEC.md for card treatments and score 
gauge specs. Look at the scan report mockup in 
docs/prototypes/corporate-site.html for layout reference.

Build the /scan page served by the Worker:

1. INPUT STATE:
   - Clean page with single domain input field
   - Placeholder: "yourcompany.com"
   - "Generate Report" button
   - Optional expandable section for brand name

2. LOADING STATE:
   - Scanning animation: radar sweep + progress indicators
   - Show each scan stage transitioning:
     ● Email security scan... ✓
     ● Threat feed check... ✓
     ● Lookalike domain scan... (scanning)
     ● Social handle check... (queued)
     ● AI assessment... (queued)

3. RESULT STATE:
   - Brand Exposure Score gauge (circular, animated fill, grade-aware 
     color from visual spec)
   - 4 result cards in a grid:
     - Email Security (grade + SPF/DKIM/DMARC items)
     - Domain Threats (lookalike count + active/parked)
     - Threat Feed Matches (hit count by category)
     - Social Presence (per-platform status)
   - AI Assessment block (purple left border, agent label, narrative text)
   - CTAs: "Monitor This Brand — $799/mo" and "Share Report"

Use the card treatments, score gauge, and severity colors from the 
visual spec. The page calls POST /api/scan/report via fetch().

Commit as: "feat(scan): build Brand Exposure Report page UI"
```

---

## SESSION 6: LEGAL PAGES + CONTACT FORM

**What it does:** Privacy policy, terms of service, working contact form.

**Prompt for Claude Code:**

```
Build three pages:

1. /privacy — Privacy Policy for Trust Radar by LRX Enterprises Inc.
   Canadian company, PIPEDA compliance. Cover: data collected (account, 
   scan data, monitoring data), how used (service delivery, intelligence, 
   improvement), retention periods, third-party processors (Cloudflare, 
   AI provider — don't name specific AI provider), user rights (access, 
   deletion, export), contact privacy@trustradar.ca. 
   Write in clear, readable language — not wall-of-legalese.

2. /terms — Terms of Service. Cover: service description, account 
   responsibilities, acceptable use, IP, limitation of liability, 
   subscription terms, termination, Canadian governing law.

3. /contact — Make the existing contact form functional. On submit, 
   store the submission in D1 (create a contact_submissions table) 
   and return a success message. Add a D1 migration for the table.

Use the content page template (constrained 720px width, clean layout).
Same nav/footer/theme as all other pages.

Commit as: "feat(site): add privacy policy, terms of service, working contact form"
```

---

## SESSION 7: SOCIAL HANDLE CHECKING

**What it does:** Builds the social platform checking pipeline.

**Prompt for Claude Code:**

```
Read docs/plans/BRAND_HANDLES_BACKEND.md — Section 1 (brand handle 
management) and the platform-specific check implementations section.

Build the social monitoring foundation:

1. D1 MIGRATIONS: Create brand_profiles, social_monitor_results, and 
   social_monitor_schedule tables. Use the schemas from the plan doc.

2. BRAND CRUD: POST/GET/PATCH/DELETE /api/brands endpoints. On brand 
   creation, auto-generate keywords from domain + brand_name.

3. PLATFORM CHECKERS (src/scanners/social-monitor.ts):
   - GitHub: Use api.github.com/users/{handle} and /orgs/{handle}
   - For Twitter, Instagram, TikTok, LinkedIn, YouTube: Build the 
     checker interface but start with URL-based existence checking 
     (check if profile URL returns 200 vs 404 via fetch)
   
4. HANDLE PERMUTATION GENERATOR (src/lib/handle-permutations.ts):
   - Separator variations (acmecorp → acme_corp, acme.corp)
   - Suffix/prefix (acmecorp_official, theacmecorp)
   - Character substitution (acmec0rp)

5. Wire the social check into the Brand Exposure Report endpoint 
   so /api/scan/report returns social handle status.

This is NEW CODE — do NOT reference or copy from packages/imprsn8.

Commit as: "feat(social): add brand profiles, platform checkers, handle permutations"
```

---

## SESSION 8: LOOKALIKE DOMAIN GENERATOR

**What it does:** If not already built in Session 4, completes the domain permutation generator.

**Prompt for Claude Code:**

```
Check if src/lib/dnstwist.ts exists from the scan report session. 
If not, build it now.

Build a comprehensive domain permutation generator:

1. Character omission: remove each character one at a time
2. Adjacent character swap: swap each pair of adjacent characters
3. Adjacent character replacement: QWERTY keyboard proximity
4. Homoglyph substitution: a→à/á/â, o→0/ò, l→1/|, etc.
5. TLD swap: .com → .net, .org, .co, .ca, .io, .app, .dev, .xyz
6. Hyphenation: insert hyphens at word boundaries
7. Keyword additions: -login, -support, -secure, -portal, -verify
8. Subdomain tricks: trust.radar.com style

For each permutation, check:
- DNS A record (via Cloudflare DoH) — is it registered?
- DNS MX record — does it have mail servers?

Return results sorted by risk (registered + has MX > registered > unregistered).

Rate limit the DoH checks to avoid abuse (batch in groups of 10 
with 100ms delay between batches).

Commit as: "feat(domains): build comprehensive lookalike domain generator"
```

---

## TIPS FOR EACH SESSION

1. **Start fresh** — each Claude Code session should begin by reading the specified docs
2. **One commit per session** — don't try to do two sessions in one
3. **Test before committing** — ask Claude Code to verify the Worker builds with `pnpm build` or `wrangler dev`
4. **Deploy after sessions 1-3** — the corporate site can go live before the scan tool works
5. **The prototypes are REFERENCE** — Claude Code should look at them for design direction but build from scratch in the Worker

---

## DEPLOYMENT CHECKPOINTS

```
After Session 1:  Deploy to verify domain migration works
After Session 3:  Deploy corporate site (all marketing pages live)
After Session 5:  Deploy free scan tool (major launch moment)
After Session 6:  Deploy legal pages (compliance requirement)
After Session 7:  Deploy social checking (enriches scan reports)
```

---

*Keep this file in docs/plans/ so you can reference session prompts from mobile.*
