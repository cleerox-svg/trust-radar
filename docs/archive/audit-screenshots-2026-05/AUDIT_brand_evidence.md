# AUDIT: Brand Detail Evidence Surface

**Date:** 2026-05-28
**Scope:** Verify whether the staff-side brand detail page (`/v2/brands/:brandId`) shows the underlying threat evidence, TTPs, and raw rows behind its aggregated metrics — or whether it is metrics-only.
**Method:** Static code review only (no DB queries, no UI screenshots taken in this audit).

---

## Brand detail surface map

**Route:** `/brands/:brandId`
**Renderer:** `packages/averrow-ops/src/features/brands/BrandDetail.tsx`, exported as `BrandDetailV3` (registered in `packages/averrow-ops/src/App.tsx:141`).

The page is composed of a **header strip** + **4 tabs**: `Surface`, `Risk`, `Signals`, `Workflow` (declared `BrandDetail.tsx:53-61`). The hooks called from the parent component (`BrandDetail.tsx:79-104`) fire the following endpoint set:

| Hook | Endpoint(s) | Tier |
|---|---|---|
| `useBrandFullDetail` essential | `GET /api/brands/:id`, `GET /api/brands/:id/threats?status=active&limit=50`, `GET /api/brands/:id/threats/locations` | first paint |
| `useBrandFullDetail` extended | `GET /api/brands/:id/providers`, `…/campaigns`, `…/threats/timeline?period=7d`, `…/analysis`, `…/safe-domains`, `GET /api/email-security/:id`, `…/social-profiles` | progressive |
| `useBrandTimeline` | `GET /api/brands/:id/threats/timeline?period=7d` (cache warm only — never rendered, see line 80 comment) |
| `useDarkWebMentions` | `GET /api/darkweb/mentions/:brandId` |
| `useAppStoreMonitor` | `GET /api/appstore/monitor/:brandId` |
| `useAlerts({ brand_id, status: 'new' })` | `GET /api/alerts?brand_id=...&status=new` |
| `useAlerts({ brand_id })` | `GET /api/alerts?brand_id=...` (all signals) |
| `useAdminTakedowns({ status: 'pending', limit: 200 })` | `GET /api/admin/takedowns?status=pending&limit=200` — **client-side filtered** to brand at `BrandDetail.tsx:118-121` |
| `useBrandDomains` | `GET /api/brands/:id/domains` |
| `useBrandFirmographics` | `GET /api/brands/:id/firmographics` |
| `useBrandScoreHistory` | `GET /api/brands/:id/score-history?days=30` |

### Tab: Surface (`BrandDetail.tsx:375-419`)

| Section | Endpoint | Renders rows or counts? |
|---|---|---|
| Owned-domain footprint (`DomainFootprintCard`) | `/api/brands/:id/domains` | **Rows** — `domain`, `domain_type` chip, `source` chip per row (`BrandDetail.tsx:1048-1068`). |
| Firmographics (`FirmographicBlock`) | `/api/brands/:id/firmographics` | Single record — revenue band, employee band, industry, ticker, parent company (`BrandDetail.tsx:1108-1121`). |
| Email Posture (`EmailPostureCard`) | `/api/email-security/:id` | **Posture badges** — SPF/DKIM/DMARC/MX/BIMI per protocol with raw policy hints (`HeroCards.tsx:175-215`). NOT historical scan rows. |
| Confirmed presence | from `…/social-profiles` + `…/appstore/monitor/:brandId` | **Counts only** — “Official social profiles: N”, “Official app listings: N”. |

### Tab: Risk (`BrandDetail.tsx:427-525`)

| Section | Endpoint | Renders rows or counts? |
|---|---|---|
| Brand Health ScoreCard | `/api/brands/:id/score-history` + brand object | Single integer + 30-day sparkline. |
| Brand Exposure ScoreCard | same | Single integer + 30-day sparkline. |
| Posture Quadrant | derived | SVG dot. |
| ExposureIndexCard | from threats array | Gauge + top-3 threat-type bars (counts). |
| ActiveThreatsCard (`HeroCards.tsx:127-169`) | from `threats` array | **Counts only** by severity (critical/high/medium/low). No rows. |
| EmailPostureCard | `/api/email-security/:id` | Badges (no row history). |
| SocialRiskCard | from `…/social-profiles` | Counts only (official / suspicious / impersonation). |
| Risk surface roll-up | derived | Four `RollupTile`s (counts of suspicious socials, suspicious apps, dark-web mentions, open alerts). |
| **TyposquatsSection** (`BrandDetail.tsx:533-625`) | filters from `…/threats` essential payload (status=active, threat_type='typosquatting') | **TABLE — actual rows.** Columns: Domain · Severity · Source · Hosting · First seen. Capped at 100. |

Phishing, impersonation, credential-harvesting, and every other non-typosquatting threat type has **no row-level rendering on the Risk tab** — they only contribute to severity counts on `ActiveThreatsCard`.

### Tab: Signals (`BrandDetail.tsx:254-337`)

| Section | Endpoint | Renders rows or counts? |
|---|---|---|
| Filter chips | derived from `/api/alerts?brand_id=...` | Status + severity facet counts. |
| Alert list | same | **Rows.** Each `AlertRow` (`BrandDetail.tsx:1215-1233`) renders `alert.title || alert.alert_type`, `alert_type`, `severity`, `status` badge. **It does NOT render `saas_technique_name`, `saas_technique_phase_label`, threat URL, IP, hosting provider, or any enrichment field** — even though the `Alert` type in `useAlerts.ts:27-31` includes `saas_technique_*` columns and the backend at `handlers/alerts.ts:96` LEFT JOINs `saas_techniques`. |

### Tab: Workflow (`BrandDetail.tsx:678-803`)

| Section | Endpoint | Renders rows or counts? |
|---|---|---|
| Top strip | derived | Four count tiles. |
| Provider escalations | grouped client-side | Provider name + open count + breached badge. |
| Open takedowns (`TakedownRow` `BrandDetail.tsx:1171-1213`) | `/api/admin/takedowns?status=pending&limit=200` (client-filtered to brand) | **Rows** — `target_value`, `target_type`, `provider_name`, `provider_method`, `severity`, age. Capped at 8. **NO underlying `takedown_evidence` rows** — only `evidence_count` is returned by the backend (`handlers/takedowns.ts:422`), and the count is not even rendered here. |
| Open alerts | from `/api/alerts?...&status=new` | Rows via the same minimal `AlertRow`. Capped at 8. |

---

## Backend handler shapes (what the API actually returns)

All in `packages/trust-radar/src/handlers/brands.ts`:

### `handleGetBrand` (lines 759-790)
- `SELECT *` from `brands` (via `db/brands.ts:16` `getBrandById`).
- Plus a stats aggregate: `total_threats, active_threats, phishing, typosquatting, impersonation, credential, countries, provider_count` — all `SUM(CASE WHEN ...)` over `threats WHERE target_brand_id = ?`.
- Plus `top_providers`: `provider_id, COUNT(*)` GROUP BY hosting_provider_id (top 10).
- **No individual rows from any other table.**

### `handleBrandThreats` (lines 928-962) — the single biggest finding
Columns selected:
```
id, threat_type, severity, status, malicious_domain, malicious_url,
ip_address, country_code, hosting_provider_id, campaign_id,
source_feed, confidence_score, first_seen, last_seen, created_at
```
- **NO JOINs.** No `saas_techniques`, no `threat_actors`, no `threat_attributions`, no `brands`, no `hosting_providers`, no `infrastructure_clusters`, no `campaigns`.
- **NO enrichment columns:** `vt_checked`, `vt_malicious`, `gsb_checked`, `gsb_flagged`, `seclookup_risk_score`, `abuseipdb_score`, `greynoise_classification`, `asn`, `registrar`, `registration_date`, `lat`, `lng`, `cluster_id`, `saas_technique_id` are all present on the `threats` table (compare with `handlers/threats.ts:80-101` which DOES select them) but are **not returned for brand-scoped queries.**
- Default `limit=50` is applied; the parent hook calls with `limit=50` and only the first 50 active threats land in the page state.

### `handleBrandThreatLocations` (lines 965-987)
Returns `country_code, COUNT(*), AVG(lat), AVG(lng)` GROUP BY country. **Counts + centroid — not threat rows.**

### `handleBrandThreatTimeline` (lines 990-1033)
Returns time buckets + counts per `phishing/typosquatting/impersonation`. No rows.

### `handleBrandProviders` (lines 1036-1056)
Returns `provider_id, name, threat_count, active_count` GROUP BY provider. No rows.

### `handleBrandCampaigns` (lines 1059-1076)
Returns `c.id, c.name, c.status, c.threat_count, c.first_seen, c.last_seen` from `campaigns` JOIN `threats`. **Campaign metadata only — does not return the threats inside each campaign.**

### `handleGetBrandAnalysis` (lines 1079-1103)
Returns the cached JSON in `brands.threat_analysis`. AI-generated narrative blob; not row data.

### `handleBrandDomains` (lines 796-821)
Returns rows from `brand_domains` table — owned-domain footprint. This IS proper row data and IS rendered.

### `handleBrandFirmographics` (lines 827-843)
Returns single row from `brand_firmographics`. IS rendered.

### `handleBrandScoreHistory` (lines 907-925)
Returns rows from `brand_score_snapshots`. Rendered as a sparkline only — the 30 daily score rows are not displayed in tabular form.

---

## What's joined / what isn't (table)

| Table | Has `brand_id` / `target_brand_id`? | Joined to brand detail surface? | Notes |
|---|---|---|---|
| `threats` (464K rows) | yes (`target_brand_id`) | yes, via `/api/brands/:id/threats` | But returned columns are stripped to 14 base columns. No enrichment/IP-rep/MITRE/actor/cluster joins. Only typosquatting rows are rendered as a table; everything else collapses to severity counts. |
| `brand_domains` | yes (`brand_id`) | yes — Surface tab | Rows rendered. |
| `brand_firmographics` | yes (`brand_id`) | yes — Surface tab | Single row rendered. |
| `brand_score_snapshots` (63K rows) | yes (`brand_id`) | yes — sparkline only | 30 daily rows reduced to a single line. |
| `email_security_scans` (192K rows) | yes (`brand_id`) | partially — single `MAX(id)` row via `/api/email-security/:id` | No scan history list. The 192K rows are mostly invisible per brand. |
| `social_profiles` | yes (`brand_id`) | yes — counts + classification chips | Rows exist; rendered as counts in v3 IA. (v2 had a richer per-profile list.) |
| `app_store_listings` | yes (`brand_id`) | yes — counts only on Surface/Risk | The list itself is deferred to the v2 `?tab=apps` deep-link. v3 IA doesn't surface rows in-place. |
| `dark_web_mentions` (51 rows) | yes (`brand_id`) | counts only on Risk roll-up | Rows are fetched via `useDarkWebMentions` but only `.length` is shown via the `RollupTile`. No mention table on this page. |
| `lookalike_domains` (120 rows) | yes (`brand_id`) | **NO** | Not queried by any brand detail endpoint. The only reference in `handlers/brands.ts` is at line 1775 inside `handleReassessSocialProfile` (a social-profile AI context query, not the brand page). Brand page never shows lookalikes. |
| `infrastructure_clusters` (9,900 rows) | yes (`brand_ids` JSON, `nexus.ts:97`) | **NO** | Brand page never joins clusters even though NEXUS attributes brands per cluster. Operators see clusters only on `/operations` and `/v2/admin`. |
| `campaigns` (2,968 rows) | indirectly via `threats.campaign_id` | metadata only | `/api/brands/:id/campaigns` returns campaign rows but not the threats they contain. The brand page doesn't even render this — `campaigns` is in `extended` but unused on every v3 tab. |
| `threat_attributions` (554 rows) | indirectly via `threats.id` | **NO** | Joined on `/api/threats` and `/api/alerts` (see `handlers/threats.ts:96`, `handlers/alerts.ts:96`) but brand handler doesn't join. The brand will never show "this threat was attributed to actor X by OTX". |
| `threat_actor_targets` | yes (`brand_id`) | **NO** | Brand page never queries which threat actors target this brand, even though the table exists specifically for that link. Available only on `/threat-actors` page. |
| `threat_actors` (60 rows) | indirectly | **NO** | Same as above. |
| `threat_narratives` (55 rows) | yes (`brand_id`) | **NO** | `/api/narratives/:brandId` endpoint exists (`routes/brands.ts:435`), no hook calls it from BrandDetail.tsx. The 55 AI-generated narratives are produced per brand but never shown on the brand page. |
| `saas_techniques` reference table | no (joined via `threats.saas_technique_id`) | **NO** | Although `/api/threats` and `/api/alerts` LEFT JOIN `saas_techniques` to surface technique name/phase/MITRE codes, `/api/brands/:id/threats` does not. The MITRE mapping is invisible per-brand. |
| `social_mentions` (1,602 rows) | yes (`brand_id`) | **NO** (different from `social_profiles`) | The `social_mentions` table is not consumed by any brand-detail endpoint. Surfaced only on `/social` and in `briefing.ts`. |
| `agent_outputs` (219K rows) | indirectly — most rows are platform-level | **NO** | The brand page does call `/api/brands/:id/analysis` which renders cached JSON in `brands.threat_analysis` (set by the brand-analysis agent), but the broader `agent_outputs` pool (Observer briefings, Nexus reports, Strategist summaries) that mention a brand are never joined or filtered to the brand. |
| `takedown_requests` (1,413 rows) | yes (`brand_id`) | yes — Workflow tab | Rows rendered. Capped at 8. |
| `takedown_evidence` (1,525 rows) | indirectly via `takedown_id` | **NO row-level surfacing** | Backend returns `evidence_count` as a scalar (`handlers/takedowns.ts:422`); the brand page doesn't even render that count. The evidence pieces collected by Sparrow (screenshots, WHOIS, abuse-report bodies) are not shown alongside the takedown row. |
| `honeypot_visits` (13,963 rows) | **NO `brand_id` column** (`migrations/0060_honeypot_visits.sql`) | n/a | Cannot be brand-scoped; it's traffic to the LRX honeypot pages, not per-customer-brand. Out of scope for this concern. |

---

## TTPs status

**MITRE ATT&CK + SaaS technique mapping exists in the data layer**: migration `0065_saas_techniques.sql` defines a reference table with `mitre_ttps` (T-codes), `phase`, `phase_label`, `severity`, populated by 6 phases (recon / initial_access / persistence / credential_access / lateral_movement / exfiltration). `threats.saas_technique_id` is the FK.

**Where TTPs ARE rendered in averrow-ops:**
- `features/threat-actors/ThreatActors.tsx:432, 461` — per-actor TTP pills + SaaS technique pills derived from actor TTPs (`HIGH_SIGNAL_TTPS = ['T1566', 'T1486', 'T1498', 'T1195', 'T1078', 'T1040']`).
- `features/campaigns/GeopoliticalCampaignDashboard.tsx:744` — “MITRE ATT&CK TTPs” section.
- `features/alerts/Alerts.tsx:248-259` — each alert row renders `saas_technique_name · saas_technique_phase_label` when present.
- `features/threats/Threats.tsx:31-35` — saas_technique columns in type, rendered in the threats table.
- Client helper: `lib/saas-techniques.ts` (full taxonomy + `matchingTechniquesForActorTTPs()` helper).

**Where TTPs are NOT rendered:**
- The brand detail page. The `Alert` type in `hooks/useAlerts.ts:27-31` ships `saas_technique_id/name/phase/phase_label/severity` fields, but `BrandDetail.tsx`'s `AlertRow` (lines 1215-1233) renders only `title`, `alert_type`, `severity`, `status` — the technique fields are dropped on the floor.
- The brand threats endpoint (`handleBrandThreats`) does not select `saas_technique_id` at all, so technique data isn't even in the payload.
- The brand page has no MITRE/T-code badge, no technique label, no kill-chain phase indicator anywhere.

The mapping exists. It is just not joined into any brand-scoped query.

---

## Verdict

**The user's concern is correct.** The brand detail page is overwhelmingly metrics-first. The only row-level evidence rendered on the brand page is:

1. Owned-domain footprint (`brand_domains` table) — Surface tab.
2. Typosquatting threats only — Risk tab, capped at 100 rows, with 5 columns (no enrichment, no MITRE, no actor).
3. Open alerts — minimal 4-field rendering (title, type, severity, status) — no technique, no underlying threat, no enrichment.
4. Open takedowns — 6-field rendering (target, type, provider, method, severity, age) — no underlying evidence rows.
5. A daily 30-row score history reduced to a 28px sparkline.

**Everything else collapses to a count, a gauge, or a sparkline.** Phishing/impersonation/credential-harvesting threats are not listed as rows; they exist only as bars on `ActiveThreatsCard`. The IP reputation enrichment (VirusTotal, Google Safe Browsing, AbuseIPDB, GreyNoise, SecLookup) that lives on each `threats` row is not selected by the brand-scoped endpoint and therefore cannot reach the page. SaaS/MITRE technique attribution exists per-threat but is dropped by `handleBrandThreats`. Threat actor attribution (`threat_attributions`, `threat_actor_targets`, `threat_actors`), AI-generated brand narratives (`threat_narratives` — 55 rows produced specifically per brand), infrastructure clusters (`infrastructure_clusters.brand_ids`), `lookalike_domains`, `social_mentions`, and `takedown_evidence` are all populated server-side and have brand linkage — and none of them are joined into any brand-detail endpoint. The result is that the brand page truthfully reports “6 critical threats / 3 dark-web mentions / 2 suspicious apps” but cannot answer the natural follow-up: “which threats? which mentions? which apps? attributed to whom? using which technique? hosted where? with what reputation score?”

The data is in the DB. The brand-detail endpoint is the bottleneck.
