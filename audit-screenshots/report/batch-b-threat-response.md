# Batch B — Threat & Response Pages
# Generated: 2026-04-03
# Pages: Threats, Providers, Provider Detail, Campaigns, Geo Campaign, Threat Actors, Threat Actor Detail

---

## PAGE 5 — Threats (/v2/threats)

### Story Assessment
**Should tell:** "Here is every detected threat against your brands — prioritized by severity, filterable by type, instantly actionable."
**Currently tells:** "SYSTEM ERROR. Something went wrong loading this view. Please try again." The entire page crashes on both desktop and mobile. The ErrorBoundary catches an unhandled exception — identical pattern to MobileCommandCenter on Home. No threat data, no table, no filters — just a red error heading and a TRY AGAIN button on a dark void.
**Gap:** This is a **CRITICAL** bug. The Threats page is arguably the most important operational view in the platform — it's where analysts spend most of their time triaging and responding. It renders nothing. The crash is likely caused by the Threats component (which uses `useOperations` hook) receiving mocked data that doesn't match the expected shape, or a null-access error on nested properties.

### Visual Hierarchy
**Current:**
1. "SYSTEM ERROR" in red uppercase (Signal Red) — center of viewport
2. "Something went wrong loading this view. Please try again." — muted body text
3. "TRY AGAIN" — outlined button, thin border

**Ideal:**
1. Summary stat bar: total threats, critical count, new-today count
2. Severity filter tabs (Critical / High / Medium / Low / All)
3. Threat table with severity-colored left border per row
4. Inline action buttons per row (Dismiss, Escalate, Takedown)

### Threat Table Assessment
- **Columns visible:** None — page crashes before rendering
- **Severity color system:** Cannot assess
- **Empty state quality:** The "SYSTEM ERROR" with "TRY AGAIN" does NOT differentiate between "the page crashed" and "there are no threats." An analyst seeing this would think the system is broken, not that the data is empty. **This is the worst possible UX for a security platform** — it undermines trust in the tool itself.
- **Missing columns:** (from code analysis) The Threats page uses the Operations model: cluster_name, ASNs, countries, threat_count, status, confidence_score. It should show: severity, threat type, target brand, source URL/IP, detected timestamp, current status, and action buttons.
- **Inline actions per row:** Cannot assess — page doesn't render
- **Filter/sort controls:** Cannot assess

### Page Relationship
Threats should connect to:
- **Brand Detail** — click brand name in threat row → navigate to that brand's detail page
- **Threat Actor Detail** — if threat is attributed, click actor name → navigate to profile
- **Campaigns** — if threat is part of a campaign, show campaign badge → click to navigate
- **Takedowns** — "Request Takedown" button per row → create takedown request
None of these connections can be assessed because the page crashes.

### Mobile Assessment
Mobile also shows "SYSTEM ERROR" — identical crash. The entire Threats experience is broken cross-platform.

### BIMI Surface Opportunities
- Threats targeting brands with no DMARC/BIMI should be auto-flagged as higher priority (email-based attacks are more effective when the brand has no email authentication)
- Add a "BIMI Status" column or badge showing whether the targeted brand has email protection
- Filter by "Email-vulnerable brands" — show only threats against brands with poor BIMI scores

### Quick Wins
1. **Fix the crash (CRITICAL)** — debug the data-shape error in the Threats/Operations component. Add defensive null checks on all nested property accesses. This page must never crash.
2. **Add a proper empty state** — when there are genuinely 0 threats, show "No active threats detected — all monitored brands are clean" with a green checkmark. Never show "SYSTEM ERROR" for an empty dataset.
3. **Add severity filter tabs above the table** — Critical / High / Medium / Low / All with count badges. This is the primary triage workflow.

---

## PAGE 6 — Providers (/v2/providers)

### Story Assessment
**Should tell:** "Here is every hosting provider and ASN serving threat infrastructure against your brands — ranked by abuse volume, clustered by behavior, with pivot detection showing when actors move."
**Currently tells:** "Infrastructure Intelligence — you're tracking 45 providers across 12 clusters, with 3 actively hosting threats, 1 accelerating, and 7 detected pivots." The page communicates its story reasonably well through four stat cards that use operational intelligence language: PROVIDERS TRACKED (45 total, 12 clusters), ACTIVE OPERATIONS (3 with threats), ACCELERATING (1 with 7d trend > 30d average), PIVOTS DETECTED (7 infra moved, silent after >50 threats/30d). Below the stats: a "CLUSTER INTELLIGENCE" section header and an empty provider table area with "No providers found" message.
**Gap:** The stat cards tell a compelling story but the empty table below undermines it. The 45 providers and 12 clusters described in the stats should populate a sortable table. The page title "Infrastructure Intelligence" is strong — it positions this as an intelligence view, not just a data dump. However, the relationship between providers and brand protection isn't immediately obvious. An analyst new to the platform would ask: "Why do I care about hosting providers?"

### Clarity Assessment
Does the page make clear what a "Provider" is and why an analyst should care?
**Partially.** The title "Infrastructure Intelligence" and subtitle context helps. The stat cards use meaningful labels: "Infrastructure nodes", "Providers with active threats", "7d trend > 30d average", "Silent after >50 threats/30d". These describe threat-actor infrastructure behavior. But there's no one-liner explanation like "Hosting providers and ASNs used by threat actors targeting your brands" — an analyst must infer the connection. **Recommendation:** Add a subtitle under "Infrastructure Intelligence" that reads: "Hosting providers and ASNs serving threat infrastructure against your monitored brands."

### Visual Hierarchy
**Current:**
1. Page title "Infrastructure Intelligence" (large, bold — strong)
2. Four stat cards in a row (45 / 3 / 1 / 7) — clear and scannable
3. "CLUSTER INTELLIGENCE" section header — faint, mono uppercase
4. Empty table area / "No providers found"

**Ideal:**
1. Stat cards (keep — they work well)
2. Provider table sorted by active threats descending — with reputation score, ASN, country flag, threat count, trend sparkline
3. Cluster visualization (network graph showing ASN relationships) — below table as an advanced view

### Page Relationship
- **Providers → Threats:** Should show which threats are hosted on each provider's infrastructure. The Provider Detail page has a "THREATS HOSTED" table — good connection.
- **Providers → Threat Actors:** Should show which threat actors use this provider's ASNs. Not visible at list level.
- **Providers → Brand Detail:** Should link to brands whose typosquat/phishing domains are hosted here. Not visible.
- **Providers → Campaigns:** Should show which campaigns use this provider cluster. Not visible.
The connections exist conceptually but aren't surfaced at the list level. Provider rows should show "Used by: [Actor Name]" and "Targeting: [Brand Name]" inline.

### Mobile Assessment
Mobile "Infrastructure Intelligence" renders well. Stat cards stack to single column — each card gets full width with clear title, supporting text, large number, and sub-label. PROVIDERS TRACKED (45), ACTIVE OPERATIONS (3), ACCELERATING (1), PIVOTS DETECTED (7) all read clearly. Below: "CLUSTER INTELLIGENCE" section header visible. **Mobile is well-structured** — the single-column card stack is the right pattern for this data density.

### BIMI Surface Opportunities
- Providers hosting domains that spoof brands with no BIMI/DMARC should be flagged as "Email-attack infrastructure" — the absence of email authentication on the target brand makes these providers higher priority.
- Add a column showing "Email spoofing domains hosted" count per provider.

### Quick Wins
1. **Add a one-line subtitle** explaining what providers are: "Hosting providers and ASNs serving threat infrastructure against your monitored brands."
2. **Show provider reputation as a color-coded score** in each row (red <30, amber 30-60, green >60) so analysts can instantly see which providers are bulletproof hosting.
3. **Add "Used by" and "Targeting" columns** to the provider table showing linked threat actors and targeted brands — this is the missing connective tissue between infrastructure and brand protection.

---

## PAGE 7 — Provider Detail (/v2/providers/:providerId)

### Story Assessment
**Should tell:** "This is HostGator (AS1234, US) — here's their threat footprint: 15 active threats across 8 brands, 72-hour average abuse response time, and a 45/100 reputation score. Here are the threats they're hosting and the actors using them."
**Currently tells:** Almost exactly that. The Provider Detail page is one of the better-structured pages in the app. It shows the provider name "HostGator" with an AS1234 badge (wing-blue) and US country tag. Below: 5 stat cards in a 2×2+1 grid: ACTIVE THREATS (15, amber), TOTAL THREATS (120, amber), BRANDS TARGETED (8, green), AVG RESPONSE (72h, amber), REPUTATION (45, amber). Below that: "THREATS HOSTED" section with threat type filter tabs (All / Phishing / Typosquatting / Impersonation / Credential Harvesting / Networking) and a table with columns: MALICIOUS URL/IP, TYPE, TARGET BRAND, FIRST SEEN, STATUS. Currently shows "No threats found" in empty state.
**Gap:** The page structure is solid but the data presentation is information-forward, not action-forward. An analyst looking at a bulletproof hosting provider with 15 active threats and a 45/100 reputation needs to see: "What can I do about this?" The page has no action buttons — no "Report Abuse", no "Block ASN Range", no "Link to Threat Actor", no "Export IOCs."

### Data Layout Assessment
- **Data sections shown:** Provider header (name, ASN, country) → 5 stat cards → Threat type filter tabs → Threats table. Clean, logical flow.
- **Intelligence profile or data dump?** Leans toward intelligence profile — the stat cards tell a story (reputation + response time contextualize the raw threat count). The threat type tabs allow targeted analysis. Good.
- **Most important fact for an analyst:** The REPUTATION score (45/100) combined with AVG RESPONSE (72h). Together these tell the analyst: "This provider is mediocre at responding to abuse — expect slow takedowns." This insight should be more prominent.
- **Actions that make sense here:** Report abuse (generate email to provider's abuse contact), export threat IOCs for this provider, link threats to known threat actors, flag as bulletproof hosting, view related clusters/ASNs.

### Mobile Assessment
Mobile Provider Detail renders cleanly. "HostGator" name with AS1234 badge and US tag at top. Stat cards stack to single column — all 5 cards are fully readable with large numbers (15, 120, 8, 72h, 45). "THREATS HOSTED" section below with filter tabs that wrap nicely. Table headers (MALICIOUS URL/IP, TYPE, TARGET BRAND, FIRST SEEN, STATUS) are visible with "No threats found" empty state. **Good mobile layout** — the progressive disclosure from stats to threats works well on small screens.

### Quick Wins
1. **Add a "Report Abuse" action button** in the header — auto-generates an abuse report email to the provider's registered abuse contact (already stored as `provider_abuse_contact` in the data model).
2. **Make reputation score a visual gauge** — replace the plain "45" number with a colored progress bar or ring (red zone = bulletproof, green = responsive). The number alone doesn't communicate severity.
3. **Add a "Linked Threat Actors" section** below the threats table — show which known threat actors use this provider's infrastructure. This connects the infrastructure view to the threat actor intelligence view.

---

## PAGE 8 — Campaigns / Threat Operations (/v2/campaigns)

### Story Assessment
**Should tell:** "Here are the coordinated attack campaigns targeting your brands — each one a connected story of threat actor + method + targeted brands, ranked by severity and activity."
**Currently tells:** "Threat Operations — 3 active clusters, 5 campaigns tracked, 8 brands targeted, and... [object Object] threat types." The page header "Threat Operations" is strong. The stat cards communicate scale well: ACTIVE OPERATIONS (3 clusters, 1 accelerating, 12 total clusters), CAMPAIGNS TRACKED (5 active), BRANDS TARGETED (8 distinct, in red for urgency). But the 4th card — THREAT TYPES — renders **"[object Object]"** in large amber text instead of actual data. This is a serialization bug: an object is being rendered directly instead of its string value.
**Gap:** Below the stat cards, there are two sections: "NEXUS CORRELATED OPERATIONS" (empty, showing "No Nexus-correlated operations detected") and "ACTIVE CAMPAIGNS" (empty, with filter tabs for ALL/PHISHING/MALWARE and a "THREAT GRID" toggle). The page has good bones — the dual-section layout separating AI-correlated clusters from tracked campaigns is architecturally sound. But with no data populated, the analyst sees two empty containers. The page also doesn't explain the difference between an "Operation" (Nexus-correlated cluster) and a "Campaign" (human-defined grouping).

### Campaign vs Geo Campaign Clarity
**Not clear at all from the list level.** The sidebar nav shows "Operations" (not "Campaigns"), and the page title is "Threat Operations." Geo Campaigns live at `/campaigns/geo/:slug` but there's no visible link or section on this page pointing to them. An analyst would have to know the URL directly or navigate via a threat actor page. **Recommendation:** Add a "GEOPOLITICAL CAMPAIGNS" section to this page showing active geo campaigns with country flags and status badges, clearly differentiated from the infrastructure-level operations.

### Visual Hierarchy
**Current:**
1. "Threat Operations" title (bold, clear)
2. Stat cards row (3 / 5 / 8 / [object Object]) — the bug draws immediate attention for the wrong reason
3. "NEXUS CORRELATED OPERATIONS" section — empty
4. "ACTIVE CAMPAIGNS" section — empty with filter tabs

**Ideal:**
1. Stat cards (fix the [object Object] bug, keep the rest)
2. Active campaigns table/cards with severity, brand count, actor attribution, status
3. Geopolitical campaigns section with country flags and escalation levels
4. Nexus clusters section (collapsed by default — advanced view)

### Campaign Card/Row Assessment
- **Information per campaign:** Cannot fully assess — the table is empty. The filter tabs (ALL/PHISHING/MALWARE) and "THREAT GRID" toggle suggest a rich view exists. The "No campaigns match current filters" empty state text is appropriate.
- **Narrative per campaign:** Not visible at list level.
- **Campaign timeline/status:** Not visible in current state.

### Mobile Assessment
Mobile "Threat Operations" renders stat cards stacked in single column — ACTIVE OPERATIONS (3), CAMPAIGNS TRACKED (5), BRANDS TARGETED (8) all clear and readable. The 4th card shows **"[object Object]"** in large amber text — the serialization bug is equally visible on mobile. Below: "NEXUS CORRELATED OPERATIONS" section header visible. **The [object Object] bug is cross-platform.**

### BIMI Surface Opportunities
- Campaign detail should show email spoofing as an attack vector when relevant, and link to BIMI status of targeted brands
- Campaigns targeting brands with no DMARC/BIMI should have an "EMAIL VULNERABILITY" warning badge

### Quick Wins
1. **Fix the [object Object] bug (CRITICAL)** — the THREAT TYPES stat card is rendering a JavaScript object directly. It should call `.toString()`, `.join(', ')`, or render the object's string properties. Likely `threat_types` is returned as an object/map instead of a string.
2. **Add a "Geopolitical Campaigns" section** to this page — show geo campaigns with country flags, status, and "View Dashboard" links. Currently geo campaigns are completely hidden from the main campaigns view.
3. **Add campaign narrative preview** to each campaign row — one-line summary like "Phishing campaign targeting 3 finance brands via bulletproof hosting in AS12345" — so analysts can understand the story without drilling in.

---

## PAGE 9 — Geo Campaign Detail (/v2/campaigns/geo/:slug)

### Story Assessment
**Should tell:** "This is a coordinated nation-state attack campaign — here is who is behind it, what they're doing, which brands are being targeted, and what you should do about it."
**Currently tells:** "IRGC Retaliation — IRGC-linked infrastructure targeting Western financial institutions. Active since Jan 1, 2024 (823 days). 150 total threats, 12 in the last 24 hours, 5 brands targeted, 34 unique IPs. You can generate an AI-powered intelligence assessment." This is **the strongest page in the entire app.** The hero card is well-designed: campaign name "IRGC Retaliation" with ACTIVE badge (green), GEOPOLITICAL CAMPAIGN label, active-since date with day count, and a one-line description. Below: three navigation tabs (ADVERSARY / TARGETS / KNOWN ASNS) for structured drill-down. Then: AI Intelligence Assessment card with "RUN ASSESSMENT" button. Then: 4 stat cards (TOTAL THREATS 150 with Critical 3 / High 15 breakdown, LAST 24 HOURS 12 new, BRANDS TARGETED 5, INFRASTRUCTURE 34 unique IPs with Domains 28 sub-detail).
**Gap:** The page structure is excellent but several data sections are empty: "No events targeting this campaign found", "No targeting data available", "No ASN data". The AI Assessment section has the button but no pre-generated content — the analyst must click "RUN ASSESSMENT" to get anything. The page should pre-generate an assessment on campaign creation and show it by default, with a "Refresh Assessment" option for updates.

### Hero Assessment
The hero card is the first thing the eye sees and it's the most important element — **correct.** It shows: ACTIVE badge (green pill), "GEOPOLITICAL CAMPAIGN" label (muted), campaign name "IRGC Retaliation" (large, bold), description ("IRGC-linked infrastructure targeting Western financial institutions"), and "Active since Jan 1, 2024 · 823 days" on the right. The hero communicates identity, scope, and duration immediately. **This is premium-quality design.** The only improvement: add a threat level indicator (e.g. "THREAT LEVEL: CRITICAL" in Signal Red) to convey urgency.

### Geopolitical Context Clarity
The IRGC interaction test screenshot shows the campaign name clearly attributes to Iran ("IRGC-linked infrastructure"). The ADVERSARY / TARGETS / KNOWN ASNS tabs structure the intelligence by dimension. However: **there's no Iranian flag icon**, no explicit "Iran" or "IR" country badge, and no IRGC logo/graphic. The attribution relies entirely on the text description. **Recommendation:** Add a country flag (🇮🇷) next to the campaign name and an "ATTRIBUTED TO: Iran / IRGC" badge in the hero card for instant visual attribution.

### AI Assessment Output (INT-07c screenshot)
The AI Assessment section shows:
- "AI INTELLIGENCE ASSESSMENT" section header
- "RUN ASSESSMENT" button (amber/Afterburner, prominent)
- Explanatory text: "Generate an AI-powered intelligence assessment of this campaign using current platform threat data."
- After clicking: The INT-07c screenshot appears identical to INT-07b — suggesting the AI assessment didn't render new visible content (the mock API returned empty data). In production, this would show a Sonnet-generated narrative.

**Assessment of the pattern (from code):** The AI assessment renders as `assessment` text — likely a multi-paragraph narrative. The question is whether it renders as formatted intelligence brief or raw text.
- **Premium or raw dump?** Cannot fully assess from mocked data, but the section has a dedicated card wrapper with clear header — suggesting formatted output.
- **Confidence level / caveat?** Shows "tokens_used" and "generated_at" metadata — should also show confidence level and data sources.
- **CISO-briefing quality?** The pattern is right (dedicated section, prominent button, contextual data). To be CISO-quality: needs section headers within the assessment (Situation, Attribution, Recommended Actions), severity indicators, and a "Share with team" export option.

### Threat Actor → Campaign → Brand Chain
- **Who is attacking?** ADVERSARY tab exists — but shows "No data" in mocked state. Should show: IRGC, threat actor profiles, attribution confidence.
- **How?** The campaign description says "IRGC-linked infrastructure targeting Western financial institutions" — the "how" is implied but not structured. Should show TTPs (tactics, techniques, procedures) as tagged badges.
- **Which brands?** TARGETS tab exists — but empty. Should show brand names with their threat count from this campaign.
- **What to do?** No action section visible. Should have: "Alert targeted brands", "Request bulk takedown", "Export IOC list", "Brief security team."
The chain exists architecturally (tabs) but isn't populated. When populated, this would be excellent.

### BIMI Integration
- **Critical opportunity:** If IRGC actors are spoofing brand email via domains without DMARC, the campaign page should flag this explicitly: "3 of 5 targeted brands have no BIMI/DMARC — email spoofing attacks against these brands will reach inboxes."
- Add a "EMAIL VULNERABILITY" section showing which targeted brands lack email authentication.
- The AI Assessment should automatically include BIMI status in its analysis: "Brand X is especially vulnerable to this campaign because it lacks DMARC enforcement."

### Actions Assessment
- **AI Assessment:** Visible and working (button present). Excellent feature.
- **Launch takedown from campaign:** Not visible — should be a "Bulk Takedown" button for all threats in this campaign.
- **Export intel report:** Not visible — should be a "Export as PDF/STIX" button.
- **Share/alert team:** Not visible — should be a "Brief Team" or "Send Alert" button.

### Mobile Assessment
Mobile Geo Campaign is well-structured. Hero card renders cleanly with campaign name, status badge, description, and date. Tabs (ADVERSARY / TARGETS / KNOWN ASNS) are visible as horizontal scrollable pills. AI Assessment section with "RUN ASSESSMENT" button is prominent. Stat cards stack single-column (150 threats, 12 last 24h, 5 brands, 34 IPs). **Good mobile experience** — the hero card is especially effective on mobile because it fills the viewport width.

### Quick Wins
1. **Pre-generate AI assessments** — don't make analysts click a button for the first assessment. Generate on campaign creation and show by default. Add "Refresh" for updates.
2. **Add country flag + attribution badge to hero** — "🇮🇷 Iran / IRGC" badge next to campaign name for instant visual attribution.
3. **Add action buttons** — "Export IOCs", "Bulk Takedown", "Brief Team" — analysts need to act on this intelligence, not just read it.

---

## PAGE 10 — Threat Actors (/v2/threat-actors)

### Story Assessment
**Should tell:** "Here are the known adversaries targeting your brands — nation-state groups, criminal organizations, attribution confidence, and current activity level."
**Currently tells:** "Threat Actors — state-sponsored and organized threat actor profiles. You're tracking 12 actors (8 active) across 45 infrastructure indicators, targeting 20 brands. Filter by origin: All / IR / RU / CN / KP." The page header includes a helpful subtitle: "State-sponsored and organized threat actor profiles — infrastructure, TTPs, and targeted brands." The stat cards communicate scale well. The country flag filter row (ALL, 🇮🇷 IR, 🇷🇺 RU, 🇨🇳 CN, 🇰🇵 KP) is **excellent** — it instantly communicates the geopolitical scope and allows one-click filtering by nation-state adversary. Below the filters: "No threat actors found for this filter" empty state.
**Gap:** The stat cards and filters are strong but the actor list is empty (mocked data returns empty array). The 4th stat card "BY ATTRIBUTION" shows "0 GROUPS" — this contradicts the "12 TOTAL" in the first card, suggesting the attribution grouping logic has a data issue. The page needs the actual actor cards/rows to assess list-level information density.

### Nation-State Attribution Clarity
- **Country flags visible?** **Yes — excellent.** The origin filter row shows actual flag emojis (🇮🇷 🇷🇺 🇨🇳 🇰🇵) with ISO country codes. This is one of the strongest UI elements in the app — instant geopolitical context.
- **Attribution confidence shown?** Not at the list level (list is empty). The stat card shows "Active 8" but not confidence levels.
- **Activity level shown?** "Active 8" in the TRACKED ACTORS card — but not per-actor in the list.

### Visual Hierarchy
**Current:**
1. Page title "Threat Actors" with subtitle (strong)
2. Four stat cards (12 tracked / 45 infra / 20 brands / 0 attribution) — good density
3. Country flag filter row (ALL / IR / RU / CN / KP) — visually striking
4. Empty actor list

**Ideal:**
1. Stat cards (keep)
2. Country flag filter (keep — this is premium UX)
3. Actor cards showing: name, flag, attribution type, status badge, TTP tags, brand count, threat count, last-active date
4. Heatmap or network visualization (advanced view toggle)

### Actor Card/Row Assessment
Cannot fully assess — the list is empty with mocked data. From code analysis, each actor row should show: name, aliases, attribution type, country, status, TTPs, target sectors, campaign count, infrastructure count, and activity dates. **Recommendation for each actor card:** Show name + flag + status badge in header row. Below: TTP tags as pills, "Targeting X brands" count, "Using Y infrastructure nodes" count, last-seen date.

### Mobile Assessment
Mobile Threat Actors page is well-structured. Title and subtitle readable. Stat cards stack to single column — all 4 cards clear (12 total, 45 infra, 20 brands, 0 attribution). The country flag filter row renders as horizontal scrollable pills: ALL (selected, amber), 🇮🇷 IR, 🇷🇺 RU, 🇨🇳 CN, 🇰🇵 KP. "No threat actors found for this filter" empty state below. **The flag filter is especially effective on mobile** — large touch targets with clear visual differentiation.

### BIMI Surface Opportunities
- Actors known for email phishing (TTP tag) should trigger a check: "Are the brands they target protected by BIMI?" Show a warning if targeted brands lack email authentication.
- Add a "Targeted brand email status" summary to each actor card: "3 of 5 targeted brands have no DMARC."

### Quick Wins
1. **Fix "BY ATTRIBUTION" stat card** showing 0 — this should group the 12 actors by attribution type (state-sponsored, criminal, hacktivist) and show the count. The data exists but the aggregation logic isn't working.
2. **Add TTP tags to actor cards** — when populated, show phishing/malware/C2/typosquatting as colored pill badges per actor row. This is the most valuable at-a-glance intelligence for an analyst.
3. **Add "last active" date to each actor row** — recency is critical for prioritization. A threat actor last seen 2 hours ago vs 2 months ago changes the response urgency completely.

---

## PAGE 11 — Threat Actor Detail (/v2/threat-actors/:actorId)

### Story Assessment
**Should tell:** "This is the complete intelligence profile of APT-Phantom — their attribution, their tactics, their infrastructure, the brands they're targeting, and their campaign history."
**Currently tells:** "APT-Phantom 🇷🇺 ACTIVE — Advanced persistent threat group. Attribution: state-sponsored, Country: RU. Target sectors: Unknown (?). Infrastructure: 0 tracked. Linked threats: 42." The page shows a clear header with actor name, Russian flag, and ACTIVE status badge (green). Four stat cards provide structured intelligence: ATTRIBUTION (state-sponsored, Country RU — with large red "state-sponsored" text), TARGET SECTORS (Unknown, "?" — data issue), INFRASTRUCTURE (0 tracked ASNs/IPs/Domains), LINKED THREATS (42 threats from known ASNs).
**Gap:** The page communicates identity and attribution well but is missing the operational intelligence that would make it actionable: no TTPs shown, no campaign links, no targeted brands list, no infrastructure details, no timeline of activity. The "?" in Target Sectors is a data rendering issue. The large red "state-sponsored" text in the ATTRIBUTION card is visually aggressive — it reads more like an alarm than an intelligence label.

### Intelligence Profile Completeness
**The 4 stat cards are:**
1. **ATTRIBUTION** — Shows "state-sponsored" as attribution type and "Country RU" with the country code. The word "state-sponsored" renders in large Signal Red text — very prominent. Good data, slightly too alarming visually.
2. **TARGET SECTORS** — Shows "Unknown" with a "?" as the count and "SECTORS" label. This is a data gap — the mock data includes `target_sectors: ['finance', 'tech']` but the rendering shows "Unknown". Likely a data-shape mismatch.
3. **INFRASTRUCTURE** — Shows "Tracked ASNs/IPs/Domains" with "0" and "TRACKED" label. In a real scenario this would show the count of known infrastructure indicators — a critical intelligence metric.
4. **LINKED THREATS** — Shows "From known ASNs" with "42" and "THREATS" label. This connects the actor to actual threat detections — excellent.

**Ideal stat cards for a threat actor profile:**
- Attribution confidence % → **missing** (only shows type, not confidence)
- Total threats attributed → **present** (42)
- Brands targeted count → **missing** (should be prominent)
- Active campaigns count → **missing** (critical for operational context)
- Infrastructure indicators → **present** (0 — but exists)
- First seen / last active → **missing** (no temporal context)

### Visual Hierarchy
**Current (scroll sequence):**
1. **Above fold:** Header (name "APT-Phantom", 🇷🇺 flag, ACTIVE badge, description), then 4 stat cards in 2×2 grid
2. **Scrolled:** Nothing below — the page ends after the stat cards with mocked data

**Ideal:**
1. Header with name, flag, status, one-line description (keep — works well)
2. Stat cards row (expand to include brands targeted, campaigns, first/last seen)
3. TTP section — tagged badges showing tactics, techniques, procedures
4. Targeted Brands table — brands this actor targets, with threat count per brand
5. Active Campaigns list — campaigns attributed to this actor
6. Infrastructure table — known ASNs, IP ranges, domains
7. Activity Timeline — chronological view of detected activity

### Threat Actor → Campaign → Brand Connection
- **Active campaigns?** Not visible from this page.
- **Brands they're targeting?** Not visible — "Target Sectors" card shows sectors but not specific brands.
- **Infrastructure (domains, ASNs, providers)?** Card shows count (0) but no detail table.
- **TTPs?** The data model includes `ttps: ['phishing', 'malware']` but TTPs are not rendered anywhere on the page.
**All four key connections are missing from the detail view.** This is the biggest gap in the Threat Actor intelligence profile.

### Actions Assessment
- **Monitor/watchlist this actor:** Not visible — should be a "Watch Actor" toggle button in the header.
- **Export to SIEM/STIX:** Not visible — should be an "Export" button for STIX2 IOC bundle.
- **Link to related campaigns:** Not visible — no campaign section.
- **Alert when new activity detected:** Not visible — should be a "Set Alert" button that creates an alert rule.
**Zero actions available.** The page is read-only intelligence with no way to act on it.

### Mobile Assessment
Mobile Threat Actor Detail renders clearly. Header shows "APT-Phantom" in bold with 🇷🇺 flag and green ACTIVE badge. "Advanced persistent threat group." description below. Stat cards stack to single column — ATTRIBUTION card shows "state-sponsored" in large red text with "Country RU" sub-text, TARGET SECTORS shows "Unknown / ?", INFRASTRUCTURE shows "0 TRACKED", LINKED THREATS shows "42 THREATS". **The red "state-sponsored" text is especially dominant on mobile** — it takes up significant vertical space. The "← Back to Threat Actors" breadcrumb is present at top.

### BIMI Surface Opportunities
- If APT-Phantom uses email phishing as a TTP, show BIMI status of their targeted brands: "APT-Phantom targets 5 brands — 2 have no DMARC protection, making email spoofing attacks more effective."
- Add a "EMAIL ATTACK SURFACE" section showing which targeted brands are vulnerable to email-based attacks from this actor.

### Quick Wins
1. **Add TTP tags section** — render `ttps` array as colored pill badges below the description. This is the single most important missing element — it tells the analyst HOW this actor attacks.
2. **Add "Targeted Brands" section** — table showing brand names, threat count per brand from this actor, and BIMI status. This connects the actor to the brand health story.
3. **Add action buttons to header** — "Watch Actor" toggle, "Export IOCs", "Set Alert". The page currently has zero actionable affordances.

---

## NOTE — Campaign Detail (regular, /v2/campaigns/:campaignId)

The regular campaign detail page (non-geo) shows only: "Campaign Alpha" heading + "Detail view coming soon" placeholder text in a glass card. This is a **stub page** — the feature has not been built yet. The geo campaign detail page is fully implemented; the regular campaign detail is not. This should be noted as an incomplete feature, not a bug.

---

## BATCH B SUMMARY

### New Cross-Page Issues (not already confirmed in Batch A)
1. **ErrorBoundary crashes on data-shape mismatches** — The Threats page (desktop + mobile) crashes with "SYSTEM ERROR" identically to the MobileCommandCenter. This pattern now affects 3 critical views: Home/mobile, Threats/desktop, Threats/mobile. The ErrorBoundary fallback is a dead-end — it doesn't tell the analyst what failed or provide a useful alternative. The root cause is insufficient null-safety in components receiving API data.
2. **[object Object] serialization bugs** — The Campaigns page THREAT TYPES stat card renders a raw JavaScript object as "[object Object]" in large amber text. This suggests `.toString()` is being called on an object/map instead of extracting string properties. A similar pattern may exist elsewhere — any stat card rendering API data should guard against object types.
3. **Read-only intelligence pages with zero actions** — Threat Actor Detail and Provider Detail are informational but not actionable. There are no "Watch", "Export", "Alert", or "Takedown" buttons. An analyst can read the intelligence but can't act on it without leaving the page.
4. **Missing cross-page connections** — Threat Actor pages don't link to their Campaigns, Campaign pages don't link to Geo Campaigns, Provider pages don't link to Threat Actors using them. The data model supports these relationships but the UI doesn't surface them.
5. **Regular Campaign Detail is a stub** — "/v2/campaigns/:campaignId" shows "Detail view coming soon." This is an incomplete feature while Geo Campaign Detail is fully built.

### Page Relationship Assessment

| From | To | Connection | Present? |
|------|----|------------|---------|
| Threats | Brand Detail | Click brand name in threat row | **Cannot assess** — page crashes |
| Threats | Threat Actor Detail | Click actor attribution | **Cannot assess** — page crashes |
| Threat Actor | Campaign | See their active campaigns | **No** — no campaign section on actor detail |
| Campaign | Geo Campaign | Escalate to geopolitical view | **No** — geo campaigns not linked from campaigns page |
| Geo Campaign | Brand Detail | See targeted brands | **Partially** — TARGETS tab exists but empty with mock data |
| Provider | Threats | See threats using this provider | **Yes** — "THREATS HOSTED" table on provider detail |
| Provider | Threat Actor | See actors using this provider | **No** — no actor section on provider detail |
| Threat Actor | Targeted Brands | See brands they attack | **No** — only shows sector, not specific brands |
| Geo Campaign | Threat Actor | See adversary profiles | **Partially** — ADVERSARY tab exists but empty with mock data |

**Assessment:** 2 of 9 key connections are present, 2 are partially present (tabs exist but unpopulated), 5 are completely missing. The intelligence graph is disconnected — an analyst must manually navigate between related pages instead of following linked intelligence.

### Geo Campaign AI Assessment Quality
**Rating: 7/10** (potential — cannot see actual output with mocked data)
- The pattern is right: dedicated section, prominent button, contextual framing
- What would make it CISO-briefing quality (10/10):
  - Structured sections: Situation Overview, Attribution Assessment, Attack Vectors, Targeted Assets, Recommended Actions
  - Confidence indicators per claim (HIGH/MEDIUM/LOW)
  - Source attribution (which feeds/agents contributed to this assessment)
  - Executive summary callout box at the top
  - "Share as PDF" and "Email to stakeholders" export options
  - Automatic regeneration on significant new data (not just on-demand)

### Top 5 Highest-Impact Fixes for These Pages
1. **Fix Threats page crash (CRITICAL)** — The Threats page is the primary analyst workflow and it renders nothing but an error. Debug the data-shape mismatch, add null guards, and ensure the page renders a proper empty state when there's no data.
2. **Fix [object Object] bug on Campaigns page** — The THREAT TYPES stat card serializes a JavaScript object as display text. Guard all stat card values against non-string types.
3. **Add cross-page navigation links** — Connect Threat Actors → Campaigns, Campaigns → Geo Campaigns, Providers → Threat Actors. The intelligence graph must be navigable. Each entity page should show related entities with clickable links.
4. **Add action buttons to detail pages** — Threat Actor Detail and Provider Detail need "Watch", "Export IOCs", "Set Alert" buttons. Intelligence without action is just reading.
5. **Build regular Campaign Detail page** — Currently a stub ("coming soon"). Should mirror the structure of Geo Campaign Detail: hero card, stat cards, threat list, linked actors/brands, timeline.