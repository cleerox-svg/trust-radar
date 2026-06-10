# Batch A — Core Intelligence Pages
# Generated: 2026-04-03
# Pages: Home, Observatory, Brands Hub, Brand Detail

---

## PAGE 1 — Home (/v2/)

### Story Assessment
**Should tell:** "Welcome back — here's an instant pulse on your threat landscape: what's urgent, what's trending, and where to go first."
**Currently tells:** On desktop, nothing — it immediately redirects to Observatory. On mobile, it shows a "SYSTEM ERROR" crash page with a "TRY AGAIN" button.
**Gap:** Desktop has no dedicated home/dashboard — the analyst lands in the map with zero context. Mobile is completely broken: the MobileCommandCenter component crashes (likely a data-shape error from mocked API), leaving the user staring at a red error screen. There is no executive summary anywhere — no "3 things that matter right now" moment.

### Visual Hierarchy
**Current (what eye sees first→last):**
1. Desktop: Observatory map (redirect — see Page 2)
2. Mobile: "SYSTEM ERROR" in red caps
3. Mobile: "Something went wrong loading this view" body text
4. Mobile: "TRY AGAIN" button

**Ideal:**
1. Greeting + threat pulse summary (e.g. "3 critical alerts, 2 new brands at risk")
2. Quick-stat tiles: brands monitored, active threats, pending takedowns, agent health
3. Latest intel feed: 3 most recent high-severity events
4. Quick-nav tiles to Observatory, Brands, Alerts

### Contrast & Legibility Issues
| Element | Issue | Severity |
|---------|-------|----------|
| Mobile error text | Red "SYSTEM ERROR" on dark bg is readable but the body text below it is low-contrast white/60 on #080C14 | MEDIUM |
| Mobile "TRY AGAIN" button | Outlined button with thin border is easy to miss as the primary recovery action | LOW |

### Component Assessment
| Data Being Shown | Current Component | Better Component | Reason |
|-----------------|-------------------|-----------------|--------|
| Landing experience | Redirect (desktop) / Crash (mobile) | Dashboard tile grid + stat cards + intel feed | A home page should orient the analyst before they drill into any view |
| Quick stats | None | StatCard tiles (reuse existing) | Platform already has StatCard — just wire it to summary API data |

### Available Actions
- Primary: None (desktop redirects; mobile crashes)
- Secondary: None
- Missing: Navigate to top priority item; view latest alerts; quick-scan brand health

### Density Assessment
Desktop: zero density (instant redirect). Mobile: zero useful content (error page). Both extremes are wrong — the home page should be the densest summary in the app.

### Mobile Assessment
**Completely broken.** MobileCommandCenter throws an unhandled error, rendering the ErrorBoundary fallback. The component expects tile data from multiple API hooks (observatory stats, alert stats, agent health, feed stats); the mock responses likely don't match the expected shape exactly, or a nested property access fails on null. This is the first thing a mobile user sees — it must be fixed.

### BIMI Surface Opportunities
- Home dashboard should show a "Brand Email Health" summary tile showing the distribution of BIMI grades across monitored brands (e.g. "12 A-grade, 8 B-grade, 3 failing").
- A "Brands needing attention" mini-list filtered by poor BIMI/DMARC status would give the analyst an instant action item.

### Quick Wins (highest impact, lowest effort)
1. **Fix MobileCommandCenter crash** — debug the data-shape mismatch causing the ErrorBoundary to trigger. This is the #1 mobile UX blocker.
2. **Add a desktop Home dashboard** instead of redirecting to Observatory — even a simple 2×3 grid of StatCard tiles (brands, threats, alerts, takedowns, agents, feeds) with a "Latest Intel" list below would dramatically improve first-load orientation.
3. **Add a "Good morning, [Name]" greeting** with a one-line threat pulse ("2 critical alerts since your last session") to make the platform feel personalized and aware.

---

## PAGE 2 — Observatory (/v2/observatory)

### Story Assessment
**Should tell:** "Here is every active threat against your brands, right now — globally mapped, severity-coded, instantly actionable."
**Currently tells:** "Here is a dark empty rectangle with some controls at the top and stats at the bottom." The map canvas is black/empty (no WebGL map tiles render in headless Chromium without a MapLibre style URL, and no threat data points are plotted from mocked empty arrays). The right panel shows section headers ("TOP TARGETED BRANDS", "AGENT INTELLIGENCE", "ACTIVE MONITORING", "LIVE FEED") but all sections are empty or show placeholder dashes. The bottom stat bar reads: 1,247 THREATS · 42 COUNTRIES · 8 ACTIVE CAMPAIGNS · 156 BRANDS — these numbers come from the mocked observatory/stats endpoint and are the *only* meaningful data visible.
**Gap:** The Observatory's entire value proposition depends on the map rendering with real threat data. Without it, the page is a hollow shell. Even with data, the right panel competes with the map for attention and the stat bar at the bottom is easily missed. The page needs a stronger "zero state" — when the map is loading or empty, show a summary card overlay instead of a black void.

### Visual Hierarchy
**Current:**
1. Black map void (dominates 70% of viewport — draws eye to nothing)
2. Mode tabs at top (GLOBAL / OPERATIONS / HEATMAP) — well-positioned
3. Right panel headers (barely visible — very low contrast text on dark bg)
4. Bottom stat bar (1,247 / 42 / 8 / 156) — small, pinned, easily overlooked

**Ideal:**
1. Map with threat clusters (the hero element — should glow with data)
2. Bottom stat bar pulled UP and made larger — "1,247 threats across 42 countries" should be the first thing read
3. Mode tabs (compact, secondary)
4. Right panel as a collapsible drawer — only open when analyst wants detail

### Contrast & Legibility Issues
| Element | Issue | Severity |
|---------|-------|----------|
| Right panel section headers ("TOP TARGETED BRANDS" etc.) | Extremely faint — appears to be text-white/30 or similar on #111827. Nearly invisible in screenshots | HIGH |
| Right panel brand list text | Sub-labels (domains, counts) are barely readable — likely text-contrail/40 range | HIGH |
| Bottom stat bar labels ("THREATS", "COUNTRIES" etc.) | Very small text (~9px) in muted gray below the numbers. Easy to miss entirely | MEDIUM |
| Severity legend dots (Critical/High/Medium/Low) | Legend text is small and low-contrast. The color dots themselves are clear but labels fade | MEDIUM |
| "LIVE" indicator badge | Green dot + "0 threats" label is tiny and positioned where the eye doesn't naturally go | LOW |
| Time display (top right, "14:35:48 UTC") | Useful for ops context but very small | LOW |

### Map Mode Assessment
- **GLOBAL mode:** Default view. Shows severity-colored dots on world map with arc lines between threat sources and target brands. With real data this would be the signature view. Currently: empty black canvas with legend dots visible in bottom-left.
- **HEATMAP mode:** Switches successfully (confirmed in interaction test). Shows density-based heat overlay. The tab bar changes to show HEATMAP as active with Afterburner amber highlight. A "POWER DENSITY: LOW" indicator appears with severity breakdown dots — good contextual chrome. Currently empty but the UI shell is solid.
- **OPERATIONS mode:** Switches successfully. Right panel changes to "ACTIVE OPERATIONS" header with "No active operations" empty state. Bottom stat bar updates label to "OPERATIONS MAP". The mode differentiation is clear. Good.
- **Time filter bar (24H/7D/30D/90D):** All four buttons visible and functional. 7D is default-selected (amber). Also has "All Sources", "Feeds", "Spam Trap" source filter buttons. Well-designed filter row — compact and scannable.

### Right Panel Assessment
- **Top Targeted Brands section:** Header barely visible. Shows "Brands" with a count. In empty state, just shows dashes. With real data, should show a ranked mini-list of brands by threat count. **Finding:** this panel should show brand BIMI grades as colored dots next to brand names.
- **Agent Intelligence section:** "AGENT INTELLIGENCE" header present. Empty in mock. Should show latest Observer/Analyst outputs.
- **Active Monitoring section:** Present but content unclear in dark screenshot.
- **Live Feed section:** Bottom of right panel. Should show real-time event ticker.
- **Is the right panel overwhelming the map?** No — the opposite problem. The panel is so faint and empty that it feels vestigial. It needs higher-contrast headers, skeleton loaders during loading, and clear empty-state messaging.

### Component Assessment
| Data Being Shown | Current Component | Better Component | Reason |
|-----------------|-------------------|-----------------|--------|
| Threat locations | deck.gl ScatterplotLayer + ArcLayer | Same (correct choice) | deck.gl is the right tool for this scale |
| Top targeted brands | Text list in right panel | Mini BrandRow cards with sparkline + threat count | More information density per row |
| Stat summary | Bottom pinned bar with 4 numbers | Floating glass card overlay on map | Would be more visible and feel more premium |
| Empty/loading state | Black void | Animated "Scanning..." overlay with pulsing rings | The empty map is the worst possible first impression |

### Available Actions
- Primary: Switch map modes (GLOBAL/OPERATIONS/HEATMAP) — clear and obvious
- Secondary: Change time window (24H/7D/30D/90D), filter by source
- Missing: Click-to-drill on a threat cluster → should open a threat detail drawer. Click a brand in the right panel → should navigate to Brand Detail. Export current view as report.

### Mobile Assessment
Mobile Observatory shows mode tabs (GLOBAL/OPERATIONS/HEATMAP), filter bar ("7D · Severity · All Sources"), severity legend, and bottom stat bar. The map area is empty (same WebGL issue). Bottom shows "LIVE 0 threats" and tab bar with "TOP BRANDS / INTEL / LIVE FEED" — this is a smart mobile adaptation that replaces the right panel with bottom tabs. **Good mobile architecture**, just needs real data to shine. The stat bar at very bottom ("GLOBAL THREAT MAP 1,247 THREATS 42 COUNTRIES") is well-positioned on mobile.

### BIMI Surface Opportunities
- Right panel "Top Targeted Brands" list should show BIMI grade as a colored letter badge (A/B/C/D/F) next to each brand name
- When clicking a threat cluster that targets a specific brand, the detail card should show that brand's email security posture
- Consider a "Brand Email Health" mode for the map that color-codes brand HQ locations by BIMI grade instead of threat severity

### Quick Wins
1. **Add an empty-state overlay** — when the map has 0 rendered threats, show a centered glass card with "No threats in view for this time window" + the stat summary, instead of a black void
2. **Increase right panel header contrast** — change section headers from ~white/30 to text-contrail/70 or text-gauge-gray minimum. The panel is invisible right now
3. **Enlarge bottom stat bar** — increase number font size from ~14px to ~20px and label size from ~9px to ~11px. These are the Observatory's key metrics and they're being whispered

---

## PAGE 3 — Brands Hub (/v2/brands)

### Story Assessment
**Should tell:** "Here are all the brands I protect — their health at a glance, sortable by risk, instantly drillable."
**Currently tells:** "You're tracking 156 brands. 4 are new this week. Here are 2 of them ranked by threat count." The page does communicate the core story reasonably well. The stat cards at top (TOTAL TRACKED: 156, NEW THIS WEEK: 4, FASTEST RISING, TOP ATTACK) give immediate portfolio context. The brand list below shows names, domains, threat counts, and trend badges. The right sidebar has a "Portfolio Health" donut chart breaking down severity distribution. This is the strongest page in Batch A — it has clear structure and tells a coherent story.
**Gap:** Two of the four stat cards show dashes ("—") for FASTEST RISING and TOP ATTACK — these are key insights that should never be empty in a production environment. The portfolio health donut is good but small and tucked in the right sidebar. The brand list is functional but lacks visual richness — no sparklines visible, no email security grades in the list, no BIMI status.

### Critical Bug
**Brand row click does NOT navigate to Brand Detail — stays on /v2/brands.** Confirmed in Phase 2 interaction testing (INT-03). Clicking "Acme Corp" text did not change the URL. The row appears to have no `<a>` tag or click handler that triggers navigation. **UX impact:** The rows have a subtle hover state and right-arrow chevrons (">") suggesting they're clickable, so the user expectation is set but not fulfilled. This is the primary navigation path to Brand Detail and it's completely broken. Severity: **CRITICAL**.

### Visual Hierarchy
**Current:**
1. Page title "Brands" (large, bold — good)
2. Stat cards row (TOTAL TRACKED: 156 in large amber text — strong)
3. Search bar + filter controls
4. Brand list rows (Acme Corp 42, BetaCo 18)
5. Right sidebar: Portfolio Health donut + severity breakdown

**Ideal:**
1. Stat cards (keep — they work)
2. Portfolio Health donut (promote from sidebar to inline, larger)
3. Brand list with richer row data (sparkline, BIMI grade, email grade)
4. Search/filter (secondary, compact)

### Contrast & Legibility Issues
| Element | Issue | Severity |
|---------|-------|----------|
| Brand domain text (e.g. "acme.com") | Appears in muted gray (~text-contrail/50) — readable but could be stronger | LOW |
| Threat trend percentage ("▼NaN%") | Shows "NaN%" which is a data bug — the trend calculation returns NaN for mocked data. In production this would show a real percentage but the NaN is a visible defect | HIGH |
| Stat card labels ("TOTAL TRACKED", "NEW THIS WEEK") | Mono uppercase 9px text — readable but tight | LOW |
| "FASTEST RISING" and "TOP ATTACK" stat values | Show "—" dashes — indistinguishable from empty/loading state. Needs proper empty-state text | MEDIUM |
| View mode tabs (not visible in current screenshot) | LIST/MAP/LANES tabs exist in code but may not be rendering visibly — unclear from screenshot | MEDIUM |

### Table Assessment
- **Columns visible:** Rank number, Brand initial avatar, Brand name + domain, Threat type badge (e.g. "phishing", "typosquatting"), Threat count (amber number), Trend badge (▼NaN%), Right chevron (">")
- **Most valuable columns:** Brand name, threat count, trend direction, threat type
- **Could be removed/collapsed:** Rank number (implied by sort order)
- **Risk/health score column?** No — there's an Exposure Score in the data model but it's not shown in the list. **Should be added.**
- **Severity/threat count column?** Yes — threat count is shown in amber
- **Should BIMI grade appear as a column?** Yes — as a colored letter badge (A+/A/B/C/D/F) between threat count and trend
- **Sort controls visible?** Filter tabs visible ("ALL", "Monitored", "Critical") — good for filtering. Column-header sort not visible.
- **Filter controls:** Search box (confirmed working), view tabs (ALL/Monitored/Critical), sector filter (code shows dropdown exists)

### Search Assessment
- Search box visible and functional: **Yes** (confirmed in Phase 2). Placeholder reads "Search brands or domains..."
- Responsiveness: When "Google" was typed, the list filtered immediately (debounced) — showed "No results found" since mock data doesn't include Google. Search appears fast.
- Should search by: name, domain, sector — appears to cover name/domain already.

### Component Assessment
Is a table the right component for Brands Hub, or would cards/tiles tell a richer story?

**The list/table is the right choice for the primary view** — analysts need to scan 100+ brands quickly, and a list with sort/filter is the most efficient pattern for that. However, the LIST view should be enriched: each row should show a mini sparkline (7-day threat trend), the email security grade, and a severity dot. The existing VIEW MODE selector (LIST/MAP/LANES) is a smart addition — MAP could show brand HQ locations with threat density, LANES could show a kanban by severity. **Keep the list as default but enrich the rows.**

### Actions Assessment
- **Primary:** Click brand row to drill into detail — **BROKEN** (see Critical Bug above)
- **Secondary:** Search, filter by tab (All/Monitored/Critical), add brand (button visible in top-right as "MONITOR NEW")
- **Missing:** Bulk actions (select multiple → export, bulk takedown request), sort by column header, export brand list as CSV

### Mobile Assessment
Mobile Brands Hub is **well-designed**. Shows stat cards as a 2×2 grid at top (TOTAL TRACKED: 156, NEW THIS WEEK: 4, FASTEST RISING, TOP ATTACK). Below that, a "PORTFOLIO HEALTH" section with donut chart and severity breakdown. Then search bar, filter tabs (ALL/Monitored/Critical), and brand rows (rank, avatar initial, name, domain, threat type badge, count, trend). The layout stacks cleanly. **One issue:** the "▼NaN%" trend text appears in red on mobile too — the NaN bug is cross-platform.

### BIMI Surface Opportunities
- **Column in brand list:** Add BIMI/email grade as a colored letter badge in each row (between threat count and trend)
- **Filter by BIMI status:** Add a filter tab "Email Risk" that surfaces brands with failing DMARC/BIMI
- **Portfolio Health donut:** Add an "Email Health" variant showing BIMI grade distribution across the portfolio
- **Stat card:** Replace one of the "—" cards (FASTEST RISING or TOP ATTACK) with "WORST EMAIL POSTURE" showing the brand with the lowest BIMI grade

### Quick Wins
1. **Fix brand row click routing (CRITICAL)** — add `onClick={() => navigate(`/brands/${brand.id}`)}` or wrap rows in `<Link>`. This is the most broken interaction in the entire app.
2. **Fix NaN% trend badge** — the trend calculation divides by zero or receives null. Add a guard: if trend is NaN or null, show "—" or "NEW" instead of "▼NaN%".
3. **Add email security grade to brand list rows** — the data exists (email_security_grade field), just render it as a colored letter badge in each row. Instant BIMI visibility.

---

## PAGE 4 — Brand Detail (/v2/brands/:brandId)

### Story Assessment
**Should tell:** "This is the complete health portrait of Acme Corp — their threat exposure, email security posture, active threats, and what to do about them."
**Currently tells:** "Acme Corp is a Technology brand at acme.com. It has a 65 exposure score (Medium), a B+ email grade, and some threats — but you'll need to squint to read the details." The page does present the right information architecture: brand header with sector/status badges, then a 2×2 grid of stat cards (Exposure Index, Active Threats, Email Posture, Social Risk), then threat breakdown and AI analysis sections below. The bones are good. But the execution has significant contrast and density problems.
**Gap:** The page tries to show everything at once without clear prioritization. The Exposure Index gauge (65, Medium) is the hero metric but it competes with three other stat cards for attention. The Email Posture card shows SPF/DKIM/DMARC/MX with red "MISSING" badges — this is high-value security data but it's crammed into a small card. The AI Threat Analysis section and threat table below the fold are nearly invisible in the dark theme. Most critically: **0 tabs visible** means there's no way to navigate between Overview/Threats/Email/Social sub-views — the page is one long scroll with no wayfinding.

### Visual Hierarchy
**Current (scroll sequence):**
1. **Above fold:** Brand name "Acme Corp" with TECHNOLOGY badge and ACTIVE status. Below: 2×2 stat card grid — Exposure Index (65, yellow gauge), Active Threats (severity breakdown), Email Posture (B+ grade with SPF/DKIM/DMARC status), Social Risk (counts by classification). Below cards: "THREAT BREAKDOWN" section header and "AI THREAT ANALYSIS" button row.
2. **400px scroll:** Same content — the page doesn't extend much beyond the fold with mocked empty data. The threat table ("THREAT TIMELINE") appears but is empty.
3. **900px scroll:** Same view — page content ends shortly after the stat cards when threat data is empty.
4. **Bottom:** Empty space — no footer, no "back to top", no related brands.

**Ideal scroll sequence:**
1. **Hero:** Brand name + exposure score gauge (LARGE, centered) + email grade badge + one-line AI summary
2. **Stat cards:** Active Threats (severity breakdown) + Email Posture (expanded with BIMI) + Social Risk
3. **Threat timeline chart** (7-day area chart)
4. **Tabbed sections:** Threats table | Typosquats | Email Security Deep Dive | Social Profiles | Intelligence History

### ExposureGauge Assessment
- **Visible and rendering?** Yes — shows as a circular ring/arc with "65" in the center and "MEDIUM" label below in yellow/amber.
- **Animated SVG ring — does it look premium or basic?** From the screenshot it appears as a clean circular progress indicator with the ring partially filled in amber/yellow. It reads as functional and clear. Not overly flashy but not cheap either — **solid mid-tier quality**. Could be elevated with a subtle glow effect or gradient on the ring.
- **Score immediately readable?** Yes — the "65" number is prominent inside the ring. Good.
- **Color coding clear?** Yes — amber for "Medium" is correct per the design system. Would need to verify critical (red), high (orange), low (blue), clean (green) render correctly.
- **What data feeds this score?** Not immediately clear from the UI — the label says "EXPOSURE INDEX" with "No threats detected" sub-text (contradicting the 65 score with mocked data). The data model shows it's `exposure_score` — should clarify what inputs feed it (threat count, severity distribution, threat velocity, email posture).

### SecurityShield Assessment (SPF/DKIM/DMARC)
- **Visible?** Yes — the "EMAIL POSTURE" stat card shows SPF, DKIM, DMARC, and MX rows with status badges.
- **Pass/fail/warn status clear at a glance?** Partially. The mobile screenshot shows red "MISSING" badges for SPF, DKIM, MX and "NONE" for DMARC in a dark pill. The red badges are attention-grabbing. However, the text is quite small (~10px) and the card is one of four competing for space.
- **Current grade displayed?** Yes — "B+" is shown large at the bottom of the card with "GRADE" label. Clear and prominent within the card.
- **Where should BIMI + VMC be added?** Add two more rows below DMARC: "BIMI" with status badge (PUBLISHED/MISSING/INVALID) and "VMC" with status badge (VERIFIED/NONE). The card already has the vertical row pattern — just extend it.
- **Premium or basic?** Currently reads as a basic checklist. To feel premium: add a shield/lock icon header, use a progress bar showing "3 of 6 protocols configured", and add a "View Full Report" expand action.

### Tabs Assessment
- **0 tabs visible with mocked data.** Code analysis reveals the page does NOT use a tab component — it's a single long-scroll layout. This is a significant information architecture issue for a page with this much potential content.
- **Suggested tabs:**
  - **Overview** (default) — Exposure gauge, stat cards, AI summary, threat timeline chart
  - **Threats** — Full threat table with severity filters, sortable columns
  - **Typosquats** — Lookalike domains detected for this brand
  - **Email Security** — Full BIMI/DMARC/SPF/DKIM deep dive with raw DNS records
  - **Social** — Social profile monitoring, impersonation detection
  - **Intelligence** — AI-generated threat narratives, historical briefings
  - **History** — Timeline of all events, detections, takedowns for this brand

### Content Sections Assessment
- **Brand Header (above fold):** Good — name, sector badge (TECHNOLOGY in wing-blue), status badge (ACTIVE in green), domain, "Back to Brands" breadcrumb. Missing: logo/favicon (placeholder gray box visible), last-scanned timestamp.
- **Stat Card Grid (above fold):** 4 cards in a 2×2 grid. Each card has a clear title, key metric, and supporting details. Good component usage. But all four cards compete equally for attention — the Exposure Index should be visually dominant.
- **AI Threat Analysis button row:** Shows "AI DEEP SCAN" button (red/amber), "CLEAN FALSE POSITIVES" button, and an "EMERGENCY" badge. The AI Deep Scan CTA is strong and well-positioned. "Clean False Positives" is a useful action. The "EMERGENCY" label is unexplained — unclear what it triggers.
- **Threat Timeline (below fold):** Empty with mocked data. Area chart component exists in code with period selector (24h/7d/30d/90d). Good when populated.
- **Threats Table (below fold):** "THREAT TIMELINE" section header visible but table is empty. Needs skeleton/empty state: "No active threats detected — last scan: [timestamp]".

### Actions Assessment
- **What can an analyst DO?** AI Deep Scan, Clean False Positives, Scan Social Profiles, Discover New Profiles, Add Safe Domain, Classify Social Profiles, toggle monitoring. Good action density.
- **Primary action visible?** "AI DEEP SCAN" button is prominent in red/amber — yes, this is clear.
- **Launch takedown from here?** Not directly visible — should be accessible from individual threat rows in the threats table.
- **Run AI assessment?** Yes — "AI DEEP SCAN" button.
- **View related threat actors?** Not visible — should be linked from threat rows or have a "Related Threat Actors" section.

### Mobile Assessment
Mobile Brand Detail is **well-structured**. The 2×2 stat card grid stacks to a single column on mobile, with each card getting full width. The Exposure Index gauge renders cleanly with "65 MEDIUM" clearly readable. The Email Posture card with SPF/DKIM/DMARC/MX badges is fully visible and the red "MISSING" badges are attention-grabbing. The Social Risk card shows impersonation/suspicious/official counts. "THREAT BREAKDOWN" and "AI THREAT ANALYSIS" sections appear below. **The mobile layout actually tells a clearer story than desktop** because the forced single-column stacking creates a natural reading order. Only issue: "Back to Brands" link at top is small and easy to miss.

### BIMI Integration Recommendation
Where specifically BIMI should appear in Brand Detail:

- **SecurityShield / Email Posture card:** Add "BIMI" row with PUBLISHED/MISSING/INVALID badge below DMARC. Add "VMC" row with VERIFIED/NONE badge below BIMI. Update the grade calculation to factor in BIMI status (having BIMI+VMC should boost grade by one letter; missing should cap at B+).
- **Email security grade breakdown:** Expand the B+ grade into a breakdown tooltip or expandable section: "SPF ✓ DKIM ✗ DMARC ✗ BIMI ✗ VMC ✗ → B+". Show what grade they'd achieve with full implementation.
- **BIMI record raw data:** Add to the suggested "Email Security" tab — show the actual DNS TXT record for `default._bimi.[domain]`, the SVG logo URL, and VMC certificate details.
- **VMC status:** In the Email Posture card, show VMC as a premium indicator — "VMC Verified ✓" with a gold badge if present, since VMC requires a registered trademark and paid certificate.

### Quick Wins
1. **Add tabs for section navigation** — even just "Overview | Threats | Email | Social" would dramatically improve the page's usability for brands with lots of data. Use a sticky tab bar below the header.
2. **Make Exposure Index gauge visually dominant** — increase its size by 30%, add a subtle glow/shadow, and reduce the other three stat cards to 70% width. The exposure score should be THE number on this page.
3. **Add BIMI + VMC rows to Email Posture card** — the card already has the row pattern (SPF/DKIM/DMARC/MX). Adding two more rows is ~10 lines of code and immediately surfaces BIMI monitoring data.

---

## BATCH A SUMMARY

### Cross-Page Issues (appear on 2+ pages in this batch)
1. **Low-contrast text throughout** — Section headers, sub-labels, and secondary text are consistently too faint across Observatory (right panel headers), Brands Hub (domain text, stat card labels), and Brand Detail (section headers below fold). The dark theme needs a contrast pass — minimum text-contrail/60 for secondary text, text-instrument-white for primary.
2. **Empty states are either blank voids or error screens** — Observatory shows a black rectangle, Home/mobile shows "SYSTEM ERROR", Brands Hub stat cards show "—" dashes. None of these communicate "the system is working but has no data for this view." Every page needs intentional empty-state design with helpful messaging.
3. **BIMI/email security data is buried** — The email_security_grade field exists in the data model and renders in Brand Detail's Email Posture card, but it's invisible in the Brands Hub list, Observatory right panel, and Home page. Email security posture should surface on every page that shows brand information.
4. **NaN/null data handling** — Trend badges show "▼NaN%" on Brands Hub (both desktop and mobile). The Exposure Index shows "No threats detected" despite having a 65 score. Data guard clauses are missing throughout.

### Critical Bugs Confirmed
1. **Brand row click not routing to detail page** — Brands Hub list rows do not navigate to `/brands/:id`. This breaks the primary drill-down flow in the app.
2. **MobileCommandCenter crash on Home** — Mobile users see "SYSTEM ERROR" instead of the command center dashboard. The ErrorBoundary catches an unhandled exception in the MobileCommandCenter component.
3. **NaN% in trend badges** — Trend percentage calculation returns NaN when historical data is missing or null. Renders as literal "▼NaN%" text in red — looks like a broken app.

### Biggest Story Gaps
1. **No executive summary anywhere** — There is no single page where an analyst can see "here's the state of everything I care about in 5 seconds." The Home page redirects to a map (desktop) or crashes (mobile). The platform needs a dashboard that answers: How many brands am I protecting? How many active threats? What's urgent right now?
2. **BIMI monitoring is invisible** — Despite being a key feature being added, BIMI grade data doesn't surface in any list view, summary card, or filter. The only place it appears is inside the Brand Detail Email Posture card — and even there, BIMI and VMC rows are missing. Every brand-facing view should show email security posture.

### Top 5 Highest-Impact Fixes for These 4 Pages
1. **Fix brand row click routing** — This is the #1 UX blocker. The entire brands → brand detail navigation path is broken. ~5 lines of code to fix.
2. **Fix MobileCommandCenter crash** — Mobile home page is a red error screen. Debug the data-shape issue and add defensive null checks. Every mobile session starts here.
3. **Add Observatory empty-state overlay** — Replace the black void with a glass card showing threat stats + "Scanning for threats..." message. First impressions matter and the Observatory is the flagship view.
4. **Contrast pass on secondary text** — Increase all text-white/30 and text-contrail/40 instances to text-contrail/60+ minimum. This affects readability across Observatory right panel, Brands Hub details, and Brand Detail sections.
5. **Surface BIMI grade in Brands Hub list** — Add email_security_grade as a colored badge column in the brand list rows. The data already exists; this is purely a rendering addition that immediately makes BIMI monitoring visible at the portfolio level.
