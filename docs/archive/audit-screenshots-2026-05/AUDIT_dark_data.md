# Dark Data Audit — Averrow / Trust-Radar

Date: 2026-05-28
Scope: read sites for every high-volume table → API route → React hook → page
that renders the data. "Dark data" = ingested but not surfaced to the user on
any customer-facing or admin-facing page that an operator would actually look
at (diagnostics endpoints + agent internals do NOT count as a surface).

The pattern that recurs throughout this audit:
- **Counts** are surfaced everywhere (Daily Briefing, AdminDashboard).
- **Individual rows** are surfaced almost nowhere — the platform writes
  detailed records and then renders aggregates.
- The two biggest violators are **agent_outputs** (the AI "intelligence
  feed") and **threats** (50% of enrichment columns never reach the UI).

---

## Table-by-table dark-data verdict

| Table | Row count | Read sites (in Worker) | Customer-facing pages that show it | Dark-data verdict |
|---|--:|--:|---|---|
| `threats` | 464,080 | ~50+ (the whole platform reads it) | Threats list (`features/threats/Threats.tsx`), BrandDetail Threats tab, Observatory map, Campaigns, ProviderDetail, Operations, scan reports, tenant pages | **NO** at the row level — but ~25/50 columns are dark (see column audit) |
| `email_security_scans` | 192,834 | 3 read sites (`handlers/emailSecurity.ts:28`, `:333`, `handlers/reports.ts:163`) | AdminDashboard `EmailSecuritySection` (totals + grade dist), BrandDetail `EmailPostureCard` (one card showing latest scan), Brands page `useEmailSecurityAggregate` (grade summary) | **PARTIAL** — only the *latest* scan per brand is ever surfaced. ~99% of the table is historical scans that no UI charts/trends over time. See goldmine §. |
| `agent_outputs` | 219,849 | 11 read sites incl. diagnostics, briefing, agents-by-name, spamTrap strategy, public homepage Observer summary | Home `LatestIntel` (5 rows from `/api/insights/latest`), Agents detail page (last 20 per agent), AdminDashboard daily briefing card, SpamTrap Strategy tab (seed_strategist last 5) | **YES (heaviest violator)** — see goldmine §. The vast majority are `type='diagnostic'` rows read ONLY by `handlers/diagnostics.ts` to compute internal-only metrics. |
| `brand_score_snapshots` | 63,203 | 1 read site (`handlers/brands.ts:916`) | BrandDetail Risk tab via `useBrandScoreHistory` (single brand sparkline) | **PARTIAL** — per-brand history works; no cross-brand portfolio trend, no "improving / declining" leaderboard, no exposure-vs-health quadrant historical view |
| `honeypot_visits` | 13,963 | 5 read sites (briefing + spamTrap stats) | SpamTrap admin page `HoneypotNetworkPanel`, DailyBriefingWidget honeypot card | **NO** — both pages surface count + recent-bots + suspicious-humans. (Admin-only, but it's the natural audience for honeypot data.) |
| `infrastructure_clusters` | 9,900 | 12+ read sites (operations, intel, observatory, providers, admin, trends) | Observatory map (cluster markers + side panel), Campaigns list/detail, AttributionBacklog admin page, ProviderDetail clusters tab | **NO** — well surfaced |
| `campaigns` | 2,968 | 14+ read sites | Campaigns list page + CampaignDetail (full page per campaign), BrandDetail campaigns chip, Observatory operations panel, Home stat tiles, Trends | **NO** — well surfaced |
| `social_mentions` | 1,602 | 2 read sites (`handlers/briefing.ts:315-316`, `lib/dark-web-reconciler.ts:224`) | DailyBriefingWidget shows `social_total` + `social_new` counts only. The Social page (`/api/social/monitor`) queries `social_profiles`, NOT `social_mentions`. | **YES** — 1,602 individual mention rows ingested, only two count badges surfaced. No list view, no per-brand mention feed, no triage workflow |
| `takedown_evidence` | 1,525 | 4 read sites | Takedowns detail page via `useTakedownEvidence` (`/api/admin/sparrow/evidence/:id`) | **NO** — surfaced when you click into a takedown |
| `takedown_requests` | 1,413 | 9 read sites | Takedowns page (list + detail), BrandAdminDashboard, tenantTakedowns | **NO** — fully surfaced |
| `threat_attributions` | 554 | 5 read sites (`handlers/threatActors.ts:92,125,254,364`; `tenantThreatActorModule.ts:90`) | ThreatActorDetail page Sources tab + AttributionBacklog admin page | **NO** — surfaced on threat actor pages |
| `news_articles` | 110 | 1 read site (`handlers/threatActors.ts:394`) | ThreatActorDetail "News Mentions" section (when actor has matching JSON-extracted names) | **PARTIAL** — only shown when actor name matches `extracted_actors` JSON. No standalone news feed, no per-brand news, no time-sorted view of the 110 articles |
| `threat_actors` | 60 | many | ThreatActors list + ThreatActorDetail + BrandDetail, etc. | **NO** — fully surfaced |
| `threat_narratives` | 55 | 4 read sites in `handlers/narratives.ts` (only) | **NONE.** Routes are bound under `/api/narratives/:brandId(*)` in `routes/brands.ts:420-435`, but `grep -r "useNarratives\|/api/narratives" packages/averrow-ops/src/` returns ZERO. No React hook calls this endpoint. | **YES — 100% dark.** 55 AI-generated brand threat narratives written by Narrator agent + manual generation endpoint, never rendered |
| `dark_web_mentions` | 51 | 12+ read sites | DarkWeb page (list + overview), BrandDetail darkweb section, DailyBriefingWidget | **NO** — well surfaced |
| `incidents` (platform incidents) | 15 | many (lib/incidents.ts + lib/incident-recovery.ts) | `/status` public page, `/admin/incidents`, AdminDashboard | **NO** — surfaced |
| `cloud_incidents` (3rd-party outages) | unknown | 3 read sites in `handlers/intel.ts:178,195,198` | API endpoint `/api/cloud-incidents` exists (`routes/threats.ts:339`). `grep -r "useCloudIncidents\|cloud-incidents" packages/averrow-ops/src/` returns ZERO. | **YES — 100% dark.** Endpoint built, no hook, no page |

---

## threats column-level coverage

Schema source: `packages/trust-radar/migrations/0001_core_tables.sql:55-79`
(base), `0013_new_feeds_and_threat_types.sql:27-58` (recreation with new
threat_type enum), plus ~25 `ALTER TABLE threats ADD COLUMN ...` migrations
between 0051 and 0209.

Threats list API SELECT: `packages/trust-radar/src/handlers/threats.ts:73-100`
(35 columns selected). Per-row evidence rendering:
`packages/shared/src/threats-table/ThreatsTable.tsx:69-145`.

### Surfaced columns (rendered somewhere)

| Column | Where rendered |
|---|---|
| `id` | Threats table row keys, deep links |
| `source_feed` | ThreatsTable evidence panel, filter dropdown |
| `threat_type` | Threats table 'type' column |
| `malicious_url` | ThreatsTable expanded row, BrandDetail |
| `malicious_domain` | Threats table 'target' column |
| `target_brand_id` | Threats table 'brand' column (joined to brand_name) |
| `hosting_provider_id` | ThreatsTable expanded panel (joined to provider) |
| `ip_address` | ThreatsTable expanded row, Observatory map |
| `asn` | ThreatsTable expanded row, joined to threat_actor_infrastructure |
| `country_code` | Observatory map, Threats filter |
| `lat`/`lng` | Observatory globe |
| `registrar` | ThreatsTable evidence `KV k="Registrar"` (line 134) |
| `first_seen` / `last_seen` | Threats table 'last_seen' column |
| `status` | Threats table 'status' column |
| `confidence_score` | Sort key only — never displayed as a value in the threats UI (Operations + AttributionBacklog DO display it for clusters/operations) |
| `campaign_id` | Linked from CampaignDetail page |
| `severity` | Threats table 'severity' column |
| `created_at` | (sort) |
| `vt_checked`, `vt_malicious`, `vt_reputation` | ThreatsTable evidence chip + KV row |
| `gsb_checked`, `gsb_flagged`, `gsb_threat_type` | ThreatsTable evidence chip + KV row |
| `surbl_checked`, `surbl_listed` | ThreatsTable evidence chip + KV row |
| `greynoise_checked`, `greynoise_classification` | ThreatsTable evidence chip + KV row |
| `seclookup_checked`, `seclookup_risk_score` | ThreatsTable expanded KV row |
| `abuseipdb_checked`, `abuseipdb_score`, `abuseipdb_reports` | ThreatsTable expanded KV row |
| `saas_technique_id` (+ joined fields) | Threats table 'technique' column |
| `cluster_id` | ThreatsTable expanded `KV k="Cluster"` |
| `registration_date` | ThreatsTable evidence `KV k="Registered"` (only when row expanded) |
| `ioc_value` | Used as search target (`malicious_domain LIKE ? OR ... OR ioc_value LIKE ?`) but never displayed |

### Dark columns (ingested, never shown)

These are columns where the data is being written by feed/enrichment code but
no frontend SELECT or rendering site exists.

| Column | Migration that added it | Why it's dark |
|---|---|---|
| `surbl_type` | 0051 | Pulled out of `t.surbl_type` text — not in SELECT (threats.ts:79 only takes `surbl_checked`, `surbl_listed`) |
| `dbl_checked`, `dbl_listed`, `dbl_type` | 0052 | NOT in the SELECT at threats.ts:73-128 at all. Spamhaus DBL enrichment is being written, never read |
| `greynoise_noise`, `greynoise_riot` | 0058 | Not in SELECT — only `greynoise_classification` is taken |
| `seclookup_threat_type` | 0058 | Not in SELECT — only `seclookup_risk_score` |
| `brand_match_method` | 0079 | Not in SELECT anywhere in handlers/threats.ts; written by enrichment to record HOW a brand was matched (exact/fuzzy/regex) — never shown to operator |
| `attempted_resolve_at` | 0082 | DNS-backfill operational state, not surfaced |
| `enrichment_attempts` | 0110 | Counter; FC reads it for backlog calc; no UI |
| `is_private_ip` | 0175 | Used in WHERE clauses for cube building / private-IP exclusion. Not displayed; operator can't tell "this was excluded because is_private_ip=1" |
| `technique` | 0205 | Added with `named_threat_id` — index created, not yet in any SELECT or UI. The `'technique'` column in the threats table ALWAYS renders `saas_technique_name`, not this new finer-grained TTP column |
| `named_threat_id` | 0205 | Same as above — index created, dark |
| `dns_exhausted_at` | 0209 | Sentinel column for DNS-give-up logic — operator can't filter or see "we gave up on this domain" |
| `confidence_score` | 0001 | The Haiku classifier writes a 0-100 score, but the Threats list only USES it for sorting (handlers/threats.ts:31 — `confidence: "t.confidence_score"`); no rendered column, no histogram, no badge. Operations/clusters DO display confidence_score (Observatory.tsx:669, Campaigns.tsx:225) — but for individual threats it's wasted |
| `ioc_value` | 0001 | Searchable but invisible. Operators can't see the normalized IOC |

**~13 of ~50 threats columns are dark** (~25%). The largest unused
categories: secondary fields of Spamhaus DBL, secondary GreyNoise fields,
the brand-match-method audit trail, and the two new 0205 technique
attribution columns.

---

## Specific goldmines

### 1. `agent_outputs` — 219,849 rows

Schema source: `migrations/0003_admin_tables.sql:57-72` (initial) +
`0009_fix_agent_output_type_check.sql` + `0061_fix_agent_check_constraints.sql`
(allowed types: insight, classification, correlation, score, trend_report,
diagnostic, weekly_intel, hygiene_report).

NOTE on schema: there's a SECOND column `output_type` introduced in
`src/db/agent-runs.ts:106-128` (batchInsertOutputs) which writes to a
`(id, agent_id, run_id, output_type, content_json, brand_id, threat_id,
campaign_id, created_at)` shape. Most legacy writers still use the
original `(type, summary, severity, details, ...)` columns. The `insights`
handler aliases `ao.type AS output_type` (handlers/insights.ts:16) — these
two columns are essentially the same field renamed.

**Suggested query:**
```sql
SELECT type AS output_type, agent_id, COUNT(*) AS n
FROM agent_outputs
GROUP BY type, agent_id
ORDER BY n DESC;
```

**Write sites (where these 219K rows come from):**
- `lib/agentRunner.ts:434` — generic agent-run final output
- `lib/enrichment.ts:93,171` — enrichment summary outputs
- `lib/feedDiagnostic.ts:38` — feed diagnostic summaries
- `lib/feedRunner.ts:592` — sentinel diagnostic per feed pull
- `feeds/cloudflare_scanner.ts:84,94,129,162,175,274` — 7 distinct diagnostic write paths
- `feeds/torExitNodes.ts`, `feeds/spamhausDrop.ts`, `feeds/cins_army.ts`, `feeds/cisa_kev.ts`, `feeds/cloudflare_email.ts`
- `agents/analyst.ts:273`, `agents/observer.ts:940`, `agents/strategist.ts:653`, `agents/seed-strategist.ts:229,246`
- `handlers/admin.ts:2060` — admin manual writes
- `index.ts:750` — sentinel diagnostic
- `db/agent-runs.ts:117` — the new batchInsertOutputs path

**Read sites that are user-facing UI:**

| Read site | API | Frontend hook | Page | Output_types surfaced |
|---|---|---|---|---|
| `handlers/insights.ts:18-22` | `/api/insights/latest` | `useLatestInsights` → `home/sections/LatestIntel.tsx` | Home page "Latest Intel" section (5 rows) | only `type IN ('insight', 'correlation')` |
| `handlers/agents.ts:672-677` | `/api/agents/outputs` | `useAgents` | Agents list page | all types, limit 20 |
| `handlers/agents.ts:692-696` | `/api/agents/outputs/:name` | `useAgentOutputs(name)` | Agent detail page | all types, last 20 per agent |
| `handlers/agents.ts:538-542` | `/api/agents/:name` (bundled) | `useAgent(name)` | Agent detail page | last 20 outputs |
| `handlers/agents.ts:182, 102, 129` | `/api/agents` stats | useAgents | Agents list | counts only |
| `handlers/spamTrap.ts:609-614` | `/api/spam-trap/insights` | `useSpamTrapInsights` | SpamTrap Strategy tab | only `agent_id='seed_strategist'`, last 5 |
| `handlers/briefing.ts:293-` | `/api/daily-briefing` | `useDailyBriefing` | DailyBriefingWidget | observer summary only |
| `handlers/public.ts:47` | `/api/v1/public/stats` | (public homepage) | apex `/` page | `agent_id='observer'` summary only |
| `handlers/admin.ts:393` | admin diagnostics | useAdminCustomerModules | admin "agent freshness" | timestamp only |
| `handlers/cartographer-health.ts:136` | `/api/internal/cartographer-health` | n/a — internal | NONE | n/a |
| `handlers/diagnostics.ts:48,409,421,442,460,...` | `/api/internal/platform-diagnostics` | n/a — internal | NONE (CLI/script only) | bulk reading of `type='diagnostic'` for ops telemetry |
| `handlers/trends.ts:200` | `/api/trends/intelligence-briefings` | `useIntelligenceBriefings` | Trends page Executive Summary | observer briefings |

**Verdict:**
- The vast majority of the 219K rows are `type='diagnostic'` rows written by feed runners + Navigator dns-backfill ticks. They are read **only** by `handlers/diagnostics.ts` to compute internal observability metrics. **They never reach a customer page.** If you `SELECT COUNT(*) WHERE type='diagnostic'` you'd likely see ~80-90% of the table.
- `type='insight'` and `type='correlation'` rows ARE surfaced on home/LatestIntel and agent detail pages — these are the "good" outputs that produced UI value.
- `type='classification'` and `type='score'` rows: written by Analyst (analyst.ts:273) and others but only `INSERT`ed, never SELECTed by any user-facing handler. **Pure dark intelligence.**
- `type='weekly_intel'`, `type='hygiene_report'` (allowed by the v3 constraint) — no UI consumer found.
- `details` JSON column on most rows is a huge payload (full reasoning, evidence arrays). Even on the rows that ARE rendered, the UI generally shows only `summary` + `severity`. The deep evidence in `details` rarely surfaces.

### 2. `email_security_scans` — 192,834 rows

Schema source: `migrations/0020_email_security_posture.sql:5-43`. Each row is
a full DMARC/SPF/DKIM/MX/BIMI scan with raw record text + score + grade.

**Read sites:**
- `handlers/emailSecurity.ts:28-32` — fetches **latest scan per brand** for `/api/email-security/:brandId`
- `handlers/emailSecurity.ts:333-338` — DMARC policy distribution across `MAX(id) GROUP BY brand_id` (latest only)
- `handlers/reports.ts:163` — single latest per brand for qualified reports

**Frontend surfaces:**
- BrandDetail `EmailPostureCard` (BrandDetail.tsx:397, 472) — shows latest scan only
- AdminDashboard `EmailSecuritySection` (AdminDashboard.tsx:272) — grade distribution
- Brands list `useEmailSecurityAggregate` → grade rollup card

**Verdict — partial dark data:**
- Only the **latest** scan per brand is ever surfaced (`SELECT MAX(id) FROM email_security_scans GROUP BY brand_id` is the canonical pattern). With ~9,652 brands and 192,834 scans, that means ~20 historical scans per brand are written and never read.
- **No "email security posture over time" trend** — no sparkline of DMARC enforcement % across the brand portfolio over the last 30 days.
- **No "brands that just dropped a grade"** alerts surfaced as a feed — only inline notifications via `emitBIMIAlerts` (one-shot per change).
- **No per-domain DMARC failure tracker** — `dmarc_raw`, `spf_raw`, `dkim_raw` fields are stored but never displayed.
- **No "DMARC quarantine→reject migration"** view — the scan history would show exactly when each brand moved from p=none to p=quarantine to p=reject, but nothing computes that trajectory.

This is a textbook trend goldmine: hourly scans of ~10K brands for months,
zero historical view.

### 3. `honeypot_visits` — 13,963 rows

Schema source: `migrations/0060_honeypot_visits.sql`. Columns: `page,
visitor_ip, user_agent, referer, country, city, asn, is_bot, bot_name,
visited_at`.

**Read sites:**
- `handlers/spamTrap.ts:406,410,415,422,429` — overall total + 24h + per-page + recent crawlers + unique bots
- `handlers/briefing.ts:388-441` — 4 aggregates for daily briefing widget

**Frontend surfaces:**
- SpamTrap admin page `HoneypotNetworkPanel` (features/spam-trap/components/HoneypotNetworkPanel.tsx:486-565)
- DailyBriefingWidget honeypot card (components/DailyBriefingWidget.tsx:633-680)

**Verdict — well surfaced for the use case.**

The data is shown by:
- Total visits + bot/human split
- Per-page breakdown
- Recent crawlers (bot names)
- Suspicious humans

What's **missing but possible** (these specific dimensions are stored in
columns but never grouped/displayed):
- No country/ASN map of who's hitting honeypots
- No per-brand attribution — honeypots are global, not pinned to brands (this is by design, but a per-brand "honeypots seeded by your tier" surface would close the loop)
- No threat-actor cross-correlation — `visitor_ip` could be joined to `threats.ip_address` to ask "is this honeypot visitor also in our threat feed?" → no surface does that

### 4. `brand_score_snapshots` — 63,203 rows

Schema source: `migrations/0157_brand_scores.sql:46-57`. One row per
(brand_id, snapshot_day) with health/exposure scores + inputs JSON.

**Read sites:**
- `handlers/brands.ts:907-920` — single brand's last 30 (or N up to 180) days

**Frontend surface:**
- BrandDetail Risk tab via `useBrandScoreHistory(id, 30)` → renders score
  history sparkline (BrandDetail.tsx:104)

**Verdict — partial dark data.**

What works: single-brand sparkline.

What's dark with 63K snapshots across 9,652 brands (~6-7 days × 9.6K brands):
- **No portfolio-wide trend** — no "average exposure across all brands over time" chart on AdminDashboard or Trends
- **No "biggest improvers"** ranked list — `RESTRUCTURE_SPEC.md` references this as planned for /brands-v3 Intel tab but the SQL just hits the cached `brands.brand_exposure_score` (current value) not the historical delta
- **No "biggest declines"** — same gap
- **No quadrant historical animation** — health vs exposure is rendered as a single dot per brand (current state), not the trajectory
- **`health_inputs_json` and `exposure_inputs_json` are NEVER read** by any handler. The audit trail of which sub-factor moved a score on a given day is fully invisible

The migration comment explicitly calls out that splitting health/exposure is
"a platform differentiator — no major DRP vendor publishes a two-axis
decomposition" — but the historical timeline of that decomposition exists
only in dark data.

---

## Top 5 biggest "ingested-but-invisible" data lakes

Ranked by rows of intelligence that exist but no customer-facing page renders.

1. **`agent_outputs` `type='diagnostic'` rows** — most of 219,849 rows. Written by 14+ feed/agent paths, read by ONE internal diagnostics endpoint that has no React hook. Likely 150,000-180,000 rows of pure dark telemetry.
2. **`email_security_scans` historical rows** — ~183,000 historical scans (192,834 total − 9,652 "latest per brand" actually surfaced). Each row is a complete DMARC/SPF/DKIM scan; only the most recent is ever rendered.
3. **`brand_score_snapshots` portfolio history** — 63,203 daily snapshots. Used only for single-brand sparkline. The cross-brand timeline + inputs JSON are dark.
4. **`agent_outputs` `type='classification' / 'score'` rows** — written by Analyst's per-threat scoring; no handler SELECTs them with these types. Estimate in low thousands. Pure waste of Haiku tokens unless displayed.
5. **`social_mentions` — 1,602 rows, surfaced as TWO COUNT BADGES.** The Social page queries `social_profiles` (the "is this a verified handle" registry), not `social_mentions` (the actual mention feed). No list view, no triage, no per-brand mention timeline.

Honorable mentions (smaller tables but 100% dark):
- **`threat_narratives` (55 rows, 100% dark)** — Narrator agent writes brand-specific threat narratives with attack_stage + confidence + recommendations; API endpoints exist (`/api/narratives/:brandId`, `routes/brands.ts:420-435`); zero React hooks call them.
- **`cloud_incidents` (unknown count, 100% dark)** — endpoint `/api/cloud-incidents` (`routes/threats.ts:339`) returns 3rd-party outage data; no hook.
- **`news_articles` (110 rows, partial)** — only surfaced when actor name matches the JSON-extracted `actors` array. There's no standalone news feed or per-brand news view.

---

## Recommended surface additions

In rough order of leverage (intel-already-paid-for vs. UI work required).

1. **Brand Email Security Trend chart on AdminDashboard.** ~183K historical
   scans go to waste because only the latest is shown. Add a 30/90-day
   line chart for portfolio-wide DMARC enforcement % + average grade. SQL
   exists; only a chart on the existing `EmailSecuritySection` and one
   handler that doesn't `GROUP BY brand_id` are needed. Single biggest
   leverage win.

2. **Surface `threat_narratives` on BrandDetail or wire it into LatestIntel.**
   55 AI narratives exist with `severity`, `confidence`, `attack_stage`,
   `recommendations` — all dark. Either:
   - Add a `useNarratives(brandId)` hook + a "Narratives" section on BrandDetail, OR
   - Extend `/api/insights/latest` to include `threat_narratives` rows alongside `agent_outputs`.
   Cheapest possible: the API is already built (`handlers/narratives.ts`).

3. **`social_mentions` list view on the Brands page or a dedicated Social
   surface.** 1,602 mention rows ingested, two count badges shown. Wire a
   `/api/social/mentions` endpoint (doesn't exist) or extend the existing
   `handleSocialOverview` to include recent mentions per brand. Right now
   the page reads `social_profiles`, leaving the actual evidence corpus
   invisible.

4. **Cross-brand brand-score-snapshot leaderboards.** "Biggest improvers
   this week" + "Biggest declines" cards on the Brands page. `brand_score_snapshots`
   already has the time series; the handler just needs a window-function-style
   `(latest - 7-days-ago) AS delta` join. Currently the comment in
   migration 0157 ("Lets BrandDetail Risk tab render score sparklines and
   supports the /brands-v3 Intel tab's improving brands surface") confirms
   this is half-built — only the BrandDetail half shipped.

5. **Threats list — show `confidence_score` as a column or a
   confidence-bucket filter.** Today `confidence_score` is used only as a
   sort key (`handlers/threats.ts:31`). Operators have no way to see WHY
   the Haiku classifier was sure (or unsure) about a particular threat.
   Adding a confidence badge to the threats table + a `confidence_min`
   filter parameter unlocks ~half the value of the per-threat Haiku spend.
   Also surface `named_threat_id` (the catalogued attack-family pointer
   added in migration 0205) — currently dark on every threat row.

6. **Honeypot ↔ Threats join surface.** Honeypot `visitor_ip` could be
   joined to `threats.ip_address` to show "X% of honeypot visitors are also
   in our threat feed" → high-value KPI for the platform's claim of
   threat-actor correlation. SQL would be a single `JOIN`; no new
   ingestion needed.
