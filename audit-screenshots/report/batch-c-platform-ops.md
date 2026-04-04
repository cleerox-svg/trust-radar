# Batch C — Platform Operations Pages
# Generated: 2026-04-03
# Pages: Trends, Agents, Alerts, Leads, Feeds, Admin Dashboard, Spam Trap

---

## PAGE 13 — Trends / Platform Intelligence (/v2/trends)

### Story Assessment
**Should tell:** "Here is how the threat landscape against your brands has evolved — what's rising, what's falling, and where to focus next."
**Currently tells:** "Platform Intelligence — here are 5 intelligence sections, and every single one of them is empty." The page renders with a clear title "Platform Intelligence" and time period filter (7D / 30D / 90D — 30D selected by default). Below are 5 section cards: OBSERVER INTELLIGENCE BRIEFINGS ("No intelligence briefings available"), THREAT VOLUME ("No volume data"), BRAND RISK MOMENTUM ("No brand data"), PROVIDER MOMENTUM ("No provider data"), NEXUS ACTIVE CLUSTERS ("No active clusters"). Each section is a titled glass card with an appropriate empty-state message.
**Gap:** The page architecture is sound — 5 intelligence dimensions is the right scope. But with all sections empty, the analyst sees a dashboard of nothing. The bigger issue: even with data, this page lacks a "so what" conclusion. There's no AI-generated summary at the top saying "Threat volume is up 23% this week, driven by phishing against finance brands." The data sections would provide evidence; the conclusion should lead.

### Visual Hierarchy
**Current:**
1. "Platform Intelligence" title (bold, clear)
2. Time period filters (7D / 30D / 90D) — clean toggle buttons
3. Five empty section cards stacked vertically

**Ideal:**
1. AI-generated executive summary card ("This week: threat volume ↑23%, 2 new campaigns detected, Brand X exposure critical")
2. Threat Volume chart (time series — the most important trend)
3. Brand Risk Momentum (ranked list with trend arrows)
4. Provider Momentum + Nexus Clusters (side by side, lower priority)
5. Observer Briefings (expandable list, most recent first)

### Chart Assessment
- **Chart types in use:** None visible — all sections show empty-state text. From code analysis: Threat Volume uses a stacked area/bar chart (by threat type), Brand Risk Momentum uses a comparison table, Provider Momentum uses a bar chart, Nexus Clusters uses a list.
- **Data being visualized:** Threat counts over time by type, brand risk change week-over-week, provider threat volume ranking, Nexus cluster activity.
- **Most effective chart (when populated):** Threat Volume time series — it answers "are things getting better or worse?" which is the #1 trend question.
- **Least effective:** Provider Momentum as a standalone section — most analysts don't think in provider terms. Should be folded into Threat Volume as a drill-down dimension.
- **"So what" conclusion or CTA?** No — the page is data sections without interpretation. Missing an AI-generated summary.
- **Could this brief leadership?** Not in current state. With an executive summary card at the top and populated charts, yes — it could be the go-to page for weekly threat briefings.

### Mobile Assessment
Mobile renders cleanly — title "Platform Intelligence" with period toggles, then stacked section cards. Each section gets full width. The empty-state messages are readable. **When populated, this would be a good mobile experience** for quick trend checks. Missing: swipe between time periods.

### BIMI Surface Opportunities
- Add a "BRAND EMAIL SECURITY TREND" section showing how many brands improved/degraded their BIMI/DMARC posture over the selected period
- The executive summary should include: "5 brands still lack DMARC — unchanged from last week"

### Quick Wins
1. **Add an AI-generated executive summary card at the top** — one paragraph distilling the key trends. This turns raw data into actionable intelligence. Use Haiku for cost efficiency.
2. **Show skeleton loaders instead of "No data" text** — when the page is loading vs truly empty, the visual should differ. "No data" implies nothing exists; a skeleton implies it's coming.
3. **Add "Export as Briefing" button** — generate a PDF threat briefing from this page's data. This is the leadership briefing feature analysts would pay for.

---

## PAGE 14 — Agents / Flight Control (/v2/agents)

### Story Assessment
**Should tell:** "Here are your AI agents — their health, their last activity, their outputs, and their budgets. Mission control for the intelligence engine."
**Currently tells:** "AI Agent Operations — LIVE indicator. MONITOR / HISTORY / CONFIG tabs. 0/0 agents operational, 0 jobs in 24h, 0 outputs in 24h, 0 errors in 24h. SQUADRON STATUS: No agents available." The MONITOR tab renders correctly with stat cards and a "SQUADRON STATUS" section header. The page has a green "LIVE" indicator in the top-right suggesting real-time status. The HISTORY tab crashes with SYSTEM ERROR (another ErrorBoundary victim). CONFIG tab was not captured separately.
**Gap:** The "mission control" metaphor is strong — "SQUADRON STATUS", "AI Agent Operations", the LIVE indicator all contribute to the right feeling. But with 0 agents visible, the squadron is grounded. The stat cards show 0/0/0/0 which communicates "nothing is running" but doesn't explain why or what should be running. Missing: a list of expected agents with their current status (even if idle/offline).

### Visual Hierarchy
**Current:**
1. "AI Agent Operations" title with LIVE indicator (good — sets the real-time context)
2. Tab bar: MONITOR / HISTORY / CONFIG (clear, well-positioned)
3. Four stat cards (0/0 AGENTS OPERATIONAL / 0 JOBS / 0 OUTPUTS / 0 ERRORS) — the zeros are prominent
4. "SQUADRON STATUS" section — empty, "No agents available"

**Ideal:**
1. Title + LIVE indicator (keep)
2. Overall health summary: "8 of 11 agents healthy, 2 idle, 1 error" with colored indicator
3. Agent grid — cards showing each agent's name, status, last run, output count
4. Budget summary — spend-to-date vs monthly limit
5. Tab bar for HISTORY / CONFIG below the main view

### Agent Cards Assessment
- **How many agent cards visible?** 0 — "No agents available" with mocked empty data
- **Information shown per card:** Cannot assess
- **Health status immediately readable?** The stat cards show 0/0 AGENTS OPERATIONAL with green/red coloring on the "0" numbers (green for first 0, amber for the zeros below) — the color coding system exists but has nothing to display
- **Agents clearly named?** Cannot assess from screenshots — code analysis shows: Sentinel, Cartographer, Nexus, Analyst, Observer, AI Detector, Sparrow, Flight Control, Pathfinder, Watchdog, Prospector
- **Agents grouped logically?** Cannot assess

### MONITOR Tab Assessment
- **Mission control or log dump?** The shell is mission-control-flavored (SQUADRON STATUS, LIVE indicator, stat cards). With actual agent cards populated, this would feel like mission control. Currently feels like an empty control room.
- **Real-time feel?** LIVE indicator exists (green dot + "LIVE" text). Stat cards have "(24H)" time windows. The 30-second refetch interval (from code) means data would update frequently. Good.
- **BudgetManager visible?** Not visible in the MONITOR tab screenshots. The budget data exists in the `useBudgetStatus` and `useBudgetBreakdown` hooks but doesn't appear to surface on the default MONITOR view. The $0 bug cannot be confirmed or denied from screenshots.

### HISTORY Tab Assessment
- **SYSTEM ERROR** — the HISTORY tab crashes. The `useAgentRuns` hook likely fails on the mocked data shape. This is a new ErrorBoundary crash to add to the tally.

### CONFIG Tab Assessment
- Not captured in screenshots. From code: shows agent schedule configuration and API usage stats. Cannot assess visually.

### Mobile Assessment
Mobile Agents page renders the title "AI Agent Operations" with green LIVE indicator, MONITOR/HISTORY/CONFIG tabs, and stat cards stacked in 2×2 grid (0/0 AGENTS OPERATIONAL, 0 JOBS, 0 OUTPUTS, 0 ERRORS). "SQUADRON STATUS" header below. "No agents available" empty state. **Clean mobile layout** — the tab bar works well on mobile, and the stat cards are readable.

### BIMI Surface Opportunities
- The Observer agent's daily briefing should include BIMI grade changes: "Brand X's DMARC record was removed — email security grade dropped from A to C"
- Show agent outputs related to email security in a filtered view: "BIMI-related intelligence"

### Quick Wins
1. **Fix HISTORY tab crash** — another ErrorBoundary failure. Debug the data-shape mismatch in `useAgentRuns`. This is the 5th page confirmed to crash.
2. **Show expected agent roster even when offline** — list all 11 agents by name with status "OFFLINE" or "NO DATA" instead of "No agents available." An empty squadron roster is worse than one showing grounded planes.
3. **Surface BudgetManager on MONITOR tab** — add a budget summary card showing monthly spend vs limit. This is critical operational data for platform admins.

---

## PAGE 15 — Alerts (/v2/alerts)

### Story Assessment
**Should tell:** "Here are all alerts requiring your attention — prioritized by severity, grouped by brand, instantly triageable."
**Currently tells:** "SYSTEM ERROR. Something went wrong loading this view. Please try again." The Alerts page crashes on both desktop and mobile — identical SYSTEM ERROR pattern. This is now the **4th critical page** to crash (after Home/mobile, Threats, Admin Dashboard). Alerts is the primary triage interface for a security analyst — if they can't see alerts, they can't do their job.
**Gap:** Complete failure. Cannot assess any UX, table design, triage workflow, or actions because nothing renders.

### Visual Hierarchy
**Current:**
1. "SYSTEM ERROR" in Signal Red
2. Body text explanation
3. "TRY AGAIN" button

**Ideal:**
1. Unread/critical count hero: "7 unread alerts (2 CRITICAL)"
2. Severity filter tabs with count badges
3. Alert table with severity stripe, brand name, alert type, age, status
4. Bulk action bar (acknowledge selected, escalate selected)

### Triage Assessment
Cannot assess — page crashes. From code analysis, the Alerts component uses `useAlerts` and `useAlertStats` hooks. The `useAlerts` hook returns `{alerts: Alert[], total: number}` — the component likely crashes when accessing nested properties of the stats object.

From code, the following triage features SHOULD exist:
- Filter by severity, status, alert type, brand, search term
- Acknowledge single alert via PATCH
- Bulk acknowledge via POST
- Bulk takedown via POST
- Alert stats showing total/new/acknowledged/resolved/dismissed + severity breakdown

### Alert → Action Connection
Cannot assess visually. From code: alerts have `brand_id`, `source_id`, and `source_type` fields — suggesting they should link to brands and source threats.

### Mobile Assessment
Mobile also crashes with SYSTEM ERROR. Cross-platform failure.

### BIMI Surface Opportunities
- Alert types should include: "BIMI record removed", "DMARC policy downgraded", "VMC certificate expiring", "New brand lacking DMARC detected"
- These BIMI-specific alerts would be high-value for brands focused on email security posture

### Quick Wins
1. **Fix the crash (CRITICAL)** — this is the analyst's primary triage interface. Debug the data-shape error and add null guards. Priority equal to Threats page fix.
2. **Add "unread" count badge to Alerts nav item** — the sidebar "Alerts" link should show a red badge with unread count. The `useUnreadCount` hook already exists and returns `{count: number}`.
3. **Add severity-colored left border to alert rows** — critical=red, high=orange, medium=amber, low=blue. Instant visual triage.

---

## PAGE 16 — Leads / Lead Management (/v2/leads)

### Story Assessment
**Should tell:** "These are brands the AI has identified as needing Averrow — here's why each one was surfaced, and here's how to reach them."
**Currently tells:** "Lead Management — KANBAN / SALES PIPELINE / ENRICH LEADS views. Pipeline stages: NEW (0), RESEARCHED (0), DRAFTED (0), APPROVED (0), SENT (0). No leads." The page renders a proper kanban board with 5 pipeline columns. Three view mode tabs at top: KANBAN (selected, red/amber), SALES PIPELINE, ENRICH LEADS. Each column has a header with stage name and count badge. The NEW column shows an empty card with "No leads" text. The structure communicates a clear sales workflow.
**Gap:** The page is clearly a sales CRM tool, not an analyst intelligence view — which is correct for its purpose. But it doesn't communicate *why* or *how* leads are generated. There's no "Powered by AI" indicator, no explanation that the Pathfinder/Prospector agents automatically identify brands at risk, and no connection to the threat intelligence that makes each lead valuable. The kanban columns are generic sales stages (New → Researched → Drafted → Approved → Sent) — they need more intelligence context.

### Visual Hierarchy
**Current:**
1. "Lead Management" title (bold)
2. View mode tabs (KANBAN / SALES PIPELINE / ENRICH LEADS)
3. Five kanban columns with stage headers and count badges
4. Empty column cards

**Ideal:**
1. Title with "AI-Powered" subtitle: "Brands identified by Pathfinder as needing threat protection"
2. Pipeline summary bar: "12 new leads, 5 in outreach, $45K projected pipeline"
3. Kanban columns with enriched lead cards (brand name, domain, threat signal preview, contact info)
4. "ENRICH LEADS" as a prominent CTA — run the AI to discover more prospects

### Sales Intelligence Assessment
Per lead card (when populated):
- **Brand name and domain?** Cannot assess — no leads visible
- **Why the AI flagged them?** Not visible at card level — should show: "42 active threats detected, no DMARC, competitor to existing client"
- **Contact information?** From code: `company_*`, `target_*`, `outreach_*` fields exist — contact data is in the model
- **Suggested outreach approach?** From code: `pitch_angle` and `findings_summary` fields exist — the AI generates a pitch
- **Current pipeline status?** Yes — the kanban columns show this
- **Threat data preview?** From code: `threat_count_30d`, `phishing_urls_active`, `email_security_grade`, `composite_risk_score` — rich data exists but can't see it rendered

### AI Agent Presence
**Not clear.** There's no "AI" badge, no "Generated by Pathfinder" attribution, no indication that these leads are intelligence-driven rather than manually entered. The "ENRICH LEADS" tab hints at AI involvement but doesn't explain it. **Recommendation:** Add "Discovered by AI" badge to each lead card and an explanation header: "Pathfinder scans platform threat data to identify brands that need Averrow's protection."

### Conversion Workflow
The kanban stages (NEW → RESEARCHED → DRAFTED → APPROVED → SENT) imply a workflow: AI finds lead → human researches → draft outreach → approve → send. From code, the `useEnrichLead` mutation triggers Pathfinder enrichment and `useUpdateLead` moves leads through stages. **The workflow exists in code but its visibility depends on populated lead cards.** Missing: "Generate Outreach Email" button, "Schedule Demo" CTA, "Convert to Tenant" action at the end of the pipeline.

### Page Purpose Clarity
**This page should be admin/sales-only.** It's clearly distinct from analyst-facing pages — the kanban board, pipeline language, and outreach workflow don't belong in a security analyst's daily workflow. The sidebar currently shows it under "RESPONSE" alongside Alerts and Takedowns — it should be under a "SALES" or "GROWTH" section, or behind a role gate.

### Mobile Assessment
Mobile renders title "Lead Management" with KANBAN/SALES PIPELINE/ENRICH LEADS tabs. The kanban columns are side-scrollable — NEW (0) is visible with "No leads" empty card, and RESEARCHED column is partially visible at the right edge. **Functional but cramped** — a kanban board isn't ideal for mobile. The SALES PIPELINE tab (likely a table/list view) would be more mobile-friendly.

### BIMI Surface Opportunities
- **Leads with poor BIMI/email security are better prospects** — this should be a primary lead-scoring signal. A brand with 42 active threats AND no DMARC is a much hotter lead than one with threats but good email security.
- Add "Email Security: F" badge to lead cards as a selling point: "This brand's email is completely unprotected."
- The AI pitch angle should auto-include BIMI as a value proposition when the target brand lacks it.

### Quick Wins
1. **Add "Discovered by AI" attribution** — header text and per-card badge explaining that Pathfinder/Prospector identified these leads from platform threat data.
2. **Move Leads under an admin/sales nav section** — it doesn't belong alongside Alerts and Takedowns in the analyst's RESPONSE section.
3. **Add pipeline value summary** — show total leads, conversion rate, and projected revenue at the top. Turn the kanban from a task board into a revenue pipeline.

---

## PAGE 17 — Feeds (/v2/feeds)

### Story Assessment
**Should tell:** "Here is every data feed powering Averrow's intelligence — their health, last run, and what they contribute."
**Currently tells:** "Feeds — 0 feed configurations · Threat intelligence ingestion. ACTIVE: 0 (green), TOTAL INGESTED: 0 (amber), NEEDS ATTENTION: 0 (red), DISABLED: 0. Feed health: 0 healthy, 0 warning, 0 disabled." The page renders cleanly with a title, subtitle, 4 stat cards, and a feed health summary bar showing colored dots (green healthy, amber warning, gray disabled). A refresh icon button is visible in the top-right. Below the stats: an empty feed list area with column headers barely visible.
**Gap:** The stat cards and health bar communicate the right information architecture — ACTIVE/INGESTED/ATTENTION/DISABLED is a good 4-metric summary. The feed health bar with green/amber/gray dots is an excellent at-a-glance health indicator. But with 0 feeds, the page is an empty dashboard. The subtitle "Threat intelligence ingestion" is helpful context. Missing: feed grouping by type, per-feed last-run timestamp, and error details for feeds needing attention.

### Visual Hierarchy
**Current:**
1. "Feeds" title with subtitle (clear)
2. Refresh icon button (top-right — good for manual refresh)
3. Four stat cards in 2×2 grid (0/0/0/0)
4. Feed health bar (0 healthy / 0 warning / 0 disabled) with colored dots
5. Empty feed list below

**Ideal:**
1. Feed health summary as hero: "31 of 34 feeds active · 2 need attention · 1 disabled"
2. Stat cards (keep — ACTIVE/INGESTED/ATTENTION/DISABLED is the right breakdown)
3. Feed list grouped by type with status badges per row
4. "Feeds needing attention" section pinned at top of list with red highlight

### Feed Health Assessment
- **Total feed count visible?** "0 feed configurations" — shows 0 with mocked data. In production should show "34 feed configurations."
- **Health status per feed:** Stat cards distinguish ACTIVE (green), NEEDS ATTENTION (red), DISABLED (gray). The health bar adds healthy/warning/disabled dots. Good multi-level health indication.
- **Last-run timestamp per feed:** Not visible in empty state — would be a column in the feed list.
- **GreyNoise/SecLookup 0-enrichment:** Cannot assess — no feed rows visible.
- **Empty state quality:** Better than most pages — shows meaningful stat cards with 0 values and a health bar, rather than crashing. The "0 feed configurations" subtitle text is honest.

### Feed Grouping Assessment
Cannot assess from empty state. **Recommendation:** Group feeds by type (Threat Intel / DNS / Social / Email / Spam / News) with collapsible sections. 34 feeds in a flat list would be hard to scan.

### Actions Per Feed
From code analysis:
- **Enable/disable toggle:** Not visible but `useFeeds` returns `enabled` field per feed
- **Force run now:** Not visible — would be valuable for debugging
- **View logs:** Feed history exists (`useFeedHistory`) — shows pull records
- **Configure:** Not visible — API keys and schedules are in the data model

### Infrastructure vs Intelligence Feel
**Leans toward infrastructure monitoring** — the stat cards, health bar, and refresh button create an ops-dashboard feel. This is correct for this page. It should feel like monitoring critical infrastructure because feeds ARE the data pipeline. The subtitle "Threat intelligence ingestion" reinforces this.

### Mobile Assessment
Mobile renders cleanly. "Feeds" title with subtitle. Stat cards in 2×2 grid — ACTIVE FEEDS (0, green), TOTAL INGESTED (0, amber), NEEDS ATTENTION (0, red), DISABLED (0, gray). Feed health bar below: "0 healthy · 0 warning · 0 disabled". **Good mobile layout** — compact and scannable.

### BIMI Surface Opportunities
- A future "BIMI Monitor" feed could scan BIMI/DMARC/VMC records for all tracked brands on a schedule. Flag it as a planned feed type on this page.
- Show which feeds contribute to email security intelligence in a "Feed → Intelligence" mapping.

### Quick Wins
1. **Group feeds by type** — when populated, organize 34 feeds into collapsible sections by category. A flat list of 34 items is too long to scan.
2. **Pin "Needs Attention" feeds at top** — any feed with errors or 0 enrichments should be visually promoted above healthy feeds with a red/amber highlight.
3. **Add "Force Run" button per feed** — one-click manual trigger for debugging. Engineers will use this constantly.

---

## PAGE 18 — Admin Dashboard (/v2/admin)

### Story Assessment
**Should tell:** "Platform health at a glance — tenants, billing, agent status, feed health, and everything a super admin needs to keep Averrow running."
**Currently tells:** "SYSTEM ERROR. Something went wrong loading this view. Please try again." The Admin Dashboard crashes on both desktop and mobile. This is now the **5th critical page** to crash via ErrorBoundary (joining Home/mobile, Threats, Alerts, and Agents HISTORY tab). The Admin Dashboard uses `useDashboardStats`, `useSystemHealth`, `useBudgetStatus`, and `useBudgetBreakdown` hooks — any of these returning unexpected shapes would crash the component.
**Gap:** Complete failure for the super admin's primary operational view. Cannot assess layout, stats, or admin features.

### Admin Sub-Pages Assessment (from interaction screenshots)

**Admin Takedowns (/v2/admin/takedowns)** — RENDERS SUCCESSFULLY
- Title: "Takedowns" with a refresh icon
- Stat cards: TOTAL PENDING (0), [middle card with 0], COMPLETED/MONITORING (0 with green/amber badges)
- Filter tabs: ALL / DRAFT / PENDING / SUBMITTED / RESOLVED / ESCALATED / REJECTED / PR — comprehensive status pipeline
- Table columns visible: SOURCE, BRAND, TARGET, STATUS, SEVERITY, DATES, PR — good column selection
- "PRIORITY ZONE" section visible at bottom — likely pins high-severity takedowns
- **Assessment:** Well-structured takedown management. The status pipeline (7 stages) is thorough. The PRIORITY ZONE concept is smart — surfaces what needs immediate attention. Good page.

**Admin Organizations (/v2/admin/organizations)** — RENDERS SUCCESSFULLY
- Title: "Organizations" with subtitle "Manage all organizations on the platform"
- "CREATE NEW ORGANIZATION" button — prominent, Afterburner amber
- Empty state: "No organizations yet. Create your first organization to get started." + "CREATE ORGANIZATION" button
- **Assessment:** Clean, clear, purpose-driven. The dual CTA (header button + empty-state button) ensures discoverability. The "Manage all organizations" subtitle sets context. Good empty state messaging.

**Admin Users / Team (/v2/admin/users)** — RENDERS SUCCESSFULLY
- Shows "LRX Enterprises" with "ENTERPRISE" badge — the organization name is prominent
- Tab bar: Branding / Members / Brands / Invites / API Keys / Integrations / SSO / Settings — **8 tabs!**
- Stats visible: "0 / 100" (brands used / max) and "0 / 50" (members used / max) — quota display
- "AUTHORIZED PLAN" section visible with plan details
- **Assessment:** This is actually the Organization management page, not a user list. The 8-tab interface is comprehensive but potentially overwhelming. The quota display (0/100 brands, 0/50 members) is useful. The tab labels cover all multi-tenant management needs. However, 8 tabs is a lot — consider grouping into fewer tabs with sub-sections.

**Admin Audit Log (/v2/admin/audit)** — CRASHES (SYSTEM ERROR)
- Another ErrorBoundary victim. The `useAuditLog` hook returns `{entries: AuditEntry[], total: number}` — component likely crashes on the data shape.

### Admin vs Analyst Differentiation
**Partially differentiated.** The sidebar shows admin pages under "PLATFORM" section (Dashboard, Team, Organizations, Audit Log) which is visually separated from INTELLIGENCE and RESPONSE sections. The "Dashboard" label is highlighted in the sidebar when on admin pages. However, there's no "ADMIN" badge, no different color scheme, no role indicator in the header. An analyst and admin see the same chrome — the only difference is which nav items are visible. **Recommendation:** Add a subtle "SUPER ADMIN" role badge next to the user avatar in the top-right, and consider a different accent color for admin sections (e.g., Wing Blue instead of Afterburner Amber).

### Mobile Assessment
Mobile Admin Dashboard crashes with SYSTEM ERROR — same as desktop. Admin Takedowns, Organizations, and Users pages were not captured on mobile in Phase 1 screenshots.

### BIMI Surface Opportunities
- Admin dashboard should show platform-wide BIMI grade distribution: "128 brands at A-grade, 15 at B, 8 at C, 5 failing"
- Admin should see which tenants/organizations have the worst email security posture across their brand portfolios

### Quick Wins
1. **Fix Admin Dashboard crash (CRITICAL)** — the super admin's primary view must not crash. Add null guards to all stat hooks.
2. **Fix Audit Log crash** — security audit logging must be accessible. This is a compliance requirement.
3. **Reduce Team page tabs from 8 to 4** — consolidate: "Team" (Members + Invites), "Brands" (Brands), "Integrations" (API Keys + Integrations + SSO), "Settings" (Branding + Settings). 8 tabs is cognitive overload.

---

## PAGE 20 — Spam Trap (/v2/admin/spam-trap)

### Story Assessment
**Should tell:** "Here is your honeypot intelligence network — who's probing your trap domains, where they're coming from, and what emails they're harvesting for AI phishing detection."
**Currently tells:** "Spam Trap — THREAT ACTOR INTELLIGENCE · HONEYPOT NETWORK · HONEYPOT ACTIVE. Seeds deployed: 0, Domains: 0, Captures: 0, Catch rate: —." The page renders with three top-level tabs (THREAT ACTOR INTELLIGENCE / HONEYPOT NETWORK / HONEYPOT ACTIVE) and a green "HONEYPOT ACTIVE" status indicator. Below: 4 stat cards (SEEDS DEPLOYED: 0, DOMAINS: 0, CAPTURES: 0, CATCH RATE: —). Then a "HONEYPOT NETWORK" section with sub-tabs (NETWORK / SOURCES / ACTIVITY), a search field ("Search address, domain, or channel..."), and a table with columns: ADDRESS / CHANNEL / LOCATION / CATCHES / STATUS. Empty state: "No seed addresses deployed."
**Gap:** The page architecture is sophisticated — three intelligence dimensions (Threat Actor Intelligence, Honeypot Network, Honeypot Activity) is the right conceptual model. The sub-tabs within HONEYPOT NETWORK (Network / Sources / Activity) provide focused drill-downs. But the concept is not self-explanatory. A first-time user would ask: "What is a spam trap? What are seeds? Why is there a honeypot?" There's no onboarding/explanation text.

### Visual Hierarchy
**Current:**
1. "Spam Trap" title with three tab labels and green status indicator (sets context)
2. Four stat cards (0 / 0 / 0 / —)
3. "HONEYPOT NETWORK" section with sub-tabs
4. Search field and table (empty)

**Ideal:**
1. Title with one-line explanation: "Honeypot domains and seeded email addresses that capture threat actor reconnaissance"
2. Active honeypot status hero: "3 domains active, 101 seeds deployed, 160+ captures"
3. Stat cards (keep — SEEDS/DOMAINS/CAPTURES/CATCH RATE is the right breakdown)
4. Capture activity map or timeline as the primary visualization
5. Network/Sources/Activity detail tabs below

### Honeypot Intelligence Assessment
- **Visit count visible?** Not directly — the "CAPTURES" card shows 0 (mocked). In production would show 160+ captures.
- **Seed count visible?** SEEDS DEPLOYED card — shows 0. Production: 101.
- **Geographic distribution?** Not visible — no map component on this page. Should show a heatmap of capture source locations.
- **Email capture workflow clear?** Partially — the NETWORK tab shows seed addresses with ADDRESS / CHANNEL / LOCATION / CATCHES / STATUS columns, implying a workflow where seeds are deployed → emails arrive → captures recorded. But the *how* is not explained.
- **Seeding workflow (how to add new seeds)?** Not visible from screenshots — no "Add Seed" or "Deploy New Address" button visible.

### Concept Clarity
**No.** The page assumes the user understands spam trap / honeypot terminology. There's no explanation text like: "Spam traps are hidden email addresses seeded across the internet. When they receive email, it proves the sender is scraping or buying lists — a strong phishing signal." First-time users need this context. **Recommendation:** Add a collapsible "How it works" section at the top with a 3-step diagram: 1. Seeds deployed → 2. Threat actors discover seeds → 3. Emails captured and analyzed.

### Intelligence Value Clarity
**Not clear.** The connection between spam trap captures and the rest of the platform (threat detection, brand protection, AI training) is not explained. A spam trap capture should surface in the Threats page, contribute to threat actor attribution, and train the AI Detector. None of these connections are visible.

### Mobile Assessment
Mobile renders well. "Spam Trap" title with tabs, stat cards stacked (SEEDS DEPLOYED: 0, DOMAINS: 0, CAPTURES: 0, CATCH RATE: —). HONEYPOT NETWORK section with sub-tabs (NETWORK / SOURCES / ACTIVITY). Search field readable. Table columns visible. "No seed addresses deployed" empty state. **Functional mobile layout.** The tab navigation works well for this multi-dimensional view.

### BIMI Surface Opportunities
- Spam trap emails targeting brands with no BIMI = highest confidence phishing signal. Flag this cross-reference prominently.
- Add a "BIMI SPOOFING DETECTED" alert when a trap captures an email impersonating a brand that lacks BIMI protection.
- The catch rate metric could be segmented by "targeting BIMI-protected brands" vs "targeting unprotected brands" — showing the effectiveness of BIMI as a defense.

### Quick Wins
1. **Add concept explanation text** — one paragraph at the top: "Spam traps are hidden email addresses. When threat actors discover and email them, it proves phishing or list-scraping activity." This costs nothing and removes the knowledge barrier.
2. **Add "Deploy New Seed" CTA button** — visible in the NETWORK tab. Admin needs to be able to add new honeypot addresses from this page.
3. **Add a capture activity timeline** — instead of only a table, show a time series chart of captures over the last 30 days. This tells the story: "Honeypot activity is increasing/decreasing."

---

## BATCH C SUMMARY

### New Cross-Page Issues (not already confirmed in Batches A or B)
1. **ErrorBoundary epidemic reaches 7 pages** — Adding to the 3 already confirmed (Home/mobile, Threats, [object Object]), Batch C finds 4 more crashes: Alerts (desktop+mobile), Admin Dashboard (desktop+mobile), Agents HISTORY tab, Admin Audit Log. That's **7 pages or views** that render nothing but "SYSTEM ERROR." The root cause is consistent: components access nested properties on API responses without null guards.
2. **No AI attribution on AI-powered features** — The Leads page (powered by Pathfinder/Prospector agents), Trends page (Observer briefings), and Agents page (Flight Control) don't visibly communicate that AI is doing the work. The platform's AI agents are its differentiator but they're invisible to the user.
3. **Concept explanations missing on specialized pages** — Spam Trap, Infrastructure Intelligence (Providers), and Leads all serve specialized functions that aren't self-explanatory. None have onboarding text or "how it works" explanations.
4. **Admin role not visually differentiated** — Admin pages use the same chrome, color scheme, and layout as analyst pages. No role badge, no color shift, no "Admin Mode" indicator.

### Platform Architecture Observations

**Does the Admin section feel sufficiently separated from the Analyst section?**
Partially. The sidebar groups admin pages under "PLATFORM" which is distinct from "INTELLIGENCE" and "RESPONSE." But the visual treatment is identical — same dark theme, same amber accents, no admin badge. A super admin toggling between analyst work and admin work has no visual context cue.

**Is the role hierarchy communicated through the UI?**
No. The sidebar shows all nav items that the current role can access, but there's no visual indicator of what role the user has. The "ENTERPRISE" badge on the Team page and the org name "LRX Enterprises" are the only hints. There should be a role badge in the header.

**Are Feeds and Agents too technical for a security analyst?**
Yes, somewhat. Feeds shows "feed configurations" and "threat intelligence ingestion" — meaningful to an engineer but jargon to an analyst. Agents uses "SQUADRON STATUS" and "JOBS (24H)" — the military metaphor helps but the operational metrics (jobs, outputs, errors) are engineering concepts. **Recommendation:** Feeds and Agents should default to a simplified "health" view for analysts, with a "detailed" toggle for admins/engineers.

**Is there a logical information architecture across the full nav?**
The sidebar groups are logical: INTELLIGENCE (Observatory, Brands, Providers, Operations, Threat Actors, Intelligence), RESPONSE (Takedowns, Alerts, Spam Trap, Leads), PLATFORM (Agents, Feeds, Dashboard, Team, Organizations, Audit Log). The grouping makes sense. However, "Leads" in RESPONSE is a misfit — it's a sales tool, not a security response. And "Dashboard" under PLATFORM is confusing — it's the admin dashboard but shares a name with the analyst home.

### Agent Intelligence Assessment

**Does the platform feel AI-powered or AI-bolted-on?**
Currently feels bolted-on. The AI agents are the engine of the platform (Sentinel feeds data, Nexus correlates, Analyst scores, Observer narrates) but the analyst-facing UI rarely mentions them. The only visible AI touchpoints are: Geo Campaign "RUN ASSESSMENT" button, Brand Detail "AI DEEP SCAN" button, and the Agents page itself. The Observatory, Brands Hub, Threats, and Alerts pages show data *produced by* agents but don't credit them. **The AI should be visible throughout** — "Last analyzed by Analyst agent 2 hours ago" timestamps, "Nexus confidence: 87%" labels, "Observer briefing available" badges.

**Is the connection between agent outputs and analyst views clear?**
No. An analyst looking at the Observatory doesn't know that the right panel comes from Observer, the threat data comes from Sentinel, and the clusters come from Nexus. The Agents page is the only place that shows agent activity — but it's a separate page, not integrated into the views the agents power. **Recommendation:** Add subtle "Powered by [Agent Name]" attribution to each page section that consumes agent output.

### Top 5 Highest-Impact Fixes for These Pages
1. **Fix the ErrorBoundary epidemic (CRITICAL)** — 7 pages/views crash. Implement a global defensive pattern: wrap all API hook data access in null-safe accessors. Consider a `safeProp(obj, 'path.to.field', defaultValue)` utility. This is the single biggest quality issue in the entire app.
2. **Fix Alerts page crash specifically (CRITICAL)** — Alerts is the analyst's primary triage interface. It must never crash. Priority should be: Alerts → Threats → Admin Dashboard → Audit Log → Agents HISTORY.
3. **Add AI attribution throughout** — "Powered by Observer", "Analyzed by Nexus", "Scored by Analyst" labels on page sections. This makes the AI visible and justifies the platform's premium positioning.
4. **Add concept explanations to specialized pages** — Spam Trap, Feeds, Infrastructure Intelligence, and Leads all need one-line descriptions for first-time users. Zero engineering effort, maximum clarity improvement.
5. **Add executive summary to Trends page** — AI-generated paragraph at the top of Platform Intelligence distilling the key trends. This turns a data dashboard into a briefing tool that analysts can forward to leadership.
