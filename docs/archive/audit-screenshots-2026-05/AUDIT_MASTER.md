# Platform Audit — Trust Radar / Averrow
*Generated 2026-05-28 via DB queries + live UI walk + code scan*

This is a written summary of what I found across three threads:
1. Brand pages — do they show the actual threat evidence / TTPs?
2. Hidden data — what are we ingesting but not surfacing?
3. Stubs — what looks real in the UI but isn't wired up?

Companion docs (cited inline):
- `AUDIT_brand_evidence.md` (deep dive into brand detail handlers)
- `AUDIT_dark_data.md` (table-by-table dark data verdict)
- `AUDIT_stubs.md` (stubs / placeholders)

Screenshots in `audit-screenshots/01-*.png` ... `23-*.png`.

---

## Headline: your fears are correct, with specifics

### 1. Brand pages don't show the threat evidence

**Hard proof — Amazon (`brand_amazon_com`, monitored tier):**
- Database has **1,196 threats** for Amazon:
  - phishing high: 495
  - typosquatting high: 439, medium: 119
  - malware_distribution high: 63, critical: 10
  - credential_harvesting high: 35
  - c2 critical: 11, high: 9
- **Brand page → "Signals" tab shows: `0 total`** (screenshot `03-brand-amazon-signals.png`).
- **Brand page → "Risk" tab → Typosquats section says: *"No active typosquatting threats attributed to this brand."*** even though 558 typosquatting threats exist for Amazon in the threats table (screenshot `04-brand-amazon-risk.png`).
- The Risk tab "Active Threats" tile shows *counts only* (3 critical / 43 high / 4 medium) — no rows, no domains, no IPs, no source feed, no actor.

**Root cause (in code):**
- The Signals tab reads from `alerts` (whose `brand_id='brand_amazon_com'` count is **0**). It does not read from `threats`. The threats with brand attribution never become alerts because the alert pipeline only creates alerts for a narrow subset of signal types (impersonation, app-store, social) — not for the bulk feed-driven phishing/malware/c2 indicators.
- `handleBrandThreats` (`packages/trust-radar/src/handlers/brands.ts:928-962`) is the brand-scoped threats endpoint. It selects 14 base columns from `threats` and **does ZERO joins**. Compare with the global `/api/threats` handler (`handlers/threats.ts:80-101`) which LEFT JOINs `saas_techniques`, `threat_actors`, `threat_actor_infrastructure`, `brands`, `hosting_providers` and returns the full IP-reputation column set (vt_malicious, gsb_flagged, abuseipdb_score, seclookup_risk_score, greynoise_classification, asn, registrar, registration_date). **None of that reaches the brand page.**
- Only one threat table renders rows on the brand page — `TyposquatsSection` (BrandDetail.tsx:533-625) — and it client-filters `threat_type='typosquatting' AND status='active'` from the 50-row default. All other threat types only contribute to severity COUNTS in `ActiveThreatsCard`.

**TTPs / MITRE on brand pages: nothing.**
- `saas_techniques` table holds MITRE T-codes in `mitre_ttps` JSON.
- Joined by `/api/threats` and `/api/alerts`, rendered on `ThreatActors.tsx`, `GeopoliticalCampaignDashboard.tsx`, `Alerts.tsx`, `Threats.tsx`.
- **Never joined or rendered on the brand page.**
- The brand-page `AlertRow` only renders `title`, `alert_type`, `severity`, `status` — the `saas_technique_id/name/phase/phase_label` fields are dropped at the handler.

**Evidence (Sparrow-collected): also dropped.**
- `takedown_evidence` has 1,525 rows. The brand handler exposes them as a scalar `evidence_count`, and the brand-page `TakedownRow` doesn't even render that scalar. The actual evidence URLs/HTML/screenshots are invisible from the brand surface.

---

### 2. Massive ingested-but-invisible data lakes

The DB has 124 tables. Here's the volume vs. surface coverage of the biggest ones:

| Table | Row count | Surfaced where | Coverage |
|---|---|---|---|
| `agent_outputs` | **219,849** | Ticker (10-20 at a time) | ~5% read |
| `email_security_scans` | **192,834** | Only latest scan per brand | ~1% used (95% of paid-for data is dark) |
| `brand_score_snapshots` | **63,203** | Single-brand sparkline | No portfolio trend, no improvers leaderboard |
| `threats` | **464,080** | Global Threats page (full table) | ~25 of 50 columns rendered |
| `infrastructure_clusters` | **9,900** | Campaigns page | OK but not joined to brand surface |
| `honeypot_visits` | **13,963** | Spam Trap admin page | Well-surfaced for SOC, hidden from brand owners |
| `social_mentions` | **1,602** | Two count badges only | ~99% dark (page reads `social_profiles` instead) |
| `threat_attributions` | **554** | Threat Actors page | OK but counts not back-linked to brands |
| `threat_narratives` | **55** | None | 100% dark — `/api/narratives/:brandId` exists, no React hook calls it |

**Breakdown of `agent_outputs`** (this is the biggest goldmine):
- 106,500 `cartographer:score` rows — cube-level scoring telemetry, never charted
- **29,765 `cartographer:insight` rows** — AI-generated insights, only ~10 reach the ticker
- 28,110 `analyst:classification` rows — phishing-vs-malicious decisions, never shown
- 3,320 `strategist:correlation` rows — cross-feed correlation snippets, never shown
- 2,087 `analyst:insight` rows — never shown
- 631 `curator:hygiene_report` rows — never shown
- ~46,000 diagnostic rows — operational telemetry, read only by internal diagnostics endpoint

**Specifically dark columns on the threats table** (from the dark-data audit):
- All secondary Spamhaus DBL fields (`dbl_*`)
- Secondary GreyNoise fields (`greynoise_noise`, `greynoise_riot`)
- `seclookup_threat_type`
- `brand_match_method` (which match algorithm matched the brand — useful for analysts)
- `is_private_ip`
- `technique` + `named_threat_id` (new in migration 0205 — never wired to UI)
- `dns_exhausted_at`, `enrichment_attempts`, `attempted_resolve_at` (audit trail)
- `confidence_score` (used only as sort key, never rendered as a value)

**Specifically dark endpoints (built, no UI hook):**
- `GET /api/narratives/:brandId` — Narrator AI brand narratives (`routes/brands.ts:435`)
- `GET /api/cloud-incidents` — cloud provider incident ingestion (`routes/threats.ts:339`)

---

### 3. Stubs / empty features / brokenness

#### Tables that exist (and have UI surface) but are empty

| Table | Rows | UI page that pretends it works |
|---|---:|---|
| `ct_certificates` | 0 | Certificate Transparency — feed silent |
| `passive_dns_records` | 0 | Wired into agents, never populated |
| `breach_checks` | 0 | Breach feature claimed in CLAUDE.md |
| `ato_events` | 0 | Account Takeover events — nav slot exists |
| `stealer_log_results` | 0 | Stealer logs feature |
| `dmarc_reports` / `dmarc_report_records` | 0 / 0 | DMARC reporting — page exists in trends |
| `phishing_pattern_signals` | 0 | Pattern-detector pipeline empty |
| `brand_threat_assessments` | 0 | Brand-level assessments empty (handler exists) |
| `threat_signals` | 0 | Generic signal table empty |
| `takedown_submissions` | 0 | While takedown_requests=1413 and takedown_evidence=1525 |
| `url_scan_results` | 4 | URLScan integration practically dormant |

#### Live-UI broken or misleading states observed via Playwright

| Surface | Observed in the UI | What the DB actually has |
|---|---|---|
| `/v2/brands/brand_amazon_com` → Signals tab | "0 total · No signals for this brand yet." | 1,196 threats |
| `/v2/brands/brand_amazon_com` → Risk → Typosquats | "No active typosquatting threats attributed" | 558 typosquatting threats |
| `/v2/alerts` (default) | "Showing 0 of 0 alerts" | 3,653 status='new', 3,265 false_positive — default filter buries everything |
| `/v2/dark-web` | "No mentions ingested yet" | 51 mentions exist; all classified false_positive — wording is wrong, should say "No confirmed mentions" |
| `/v2/admin/takedowns` → modal | "No content available." (Takedown Request modal stub) | Real takedowns + evidence exist; modal body never reads them |
| `/v2/threats?brand_id=brand_amazon_com` | filter is silently ignored — shows global threats, not Amazon's | per-brand filtering on the global threats page is unwired |
| `/v2/threat-actors` → "Targeted Brands: 0 in crosshairs" | 0 brands | 554 threat_attributions exist; back-link aggregation isn't computed |
| `/v2/campaigns` | 5 cards all show "AS13335 malware_distribution cluster" with slightly different counts | clusters look duplicated/un-deduped (likely a 24h rebuild artifact, not a stub, but visually broken) |

#### Retired agents still implicitly surfaced

Per CLAUDE.md §6, these 11 agents were demoted to `status: 'retired'` on 2026-05-14 (PR-P) but their files + API routes remain:
`admin_classify`, `brand_analysis`, `brand_deep_scan`, `brand_report`, `geo_campaign_assessment`, `honeypot_generator`, `public_trust_check`, `qualified_report`, `scan_report`, `social_ai_assessor`, `url_scan`. Several of these are still referenced by buttons in the UI (e.g. "AI DEEP SCAN" CTA on the brand page Risk tab — `brand_deep_scan` is the agent it expects to dispatch). The CTAs presumably 404/no-op.

---

## What this means in plain English

- **The brand pages today are essentially a marketing veneer.** They show a tier badge, an email-security grade, a couple of risk scores, and counts — they do not show the threat rows that justify the scores. A customer cannot click "show me the 43 high-severity threats this week" and see them on their own brand page; they have to leave and go to the global Threats page.
- **The platform IS producing the data — we're just not letting customers see it.** 250K threats are brand-attributed. 29,765 Cartographer insights and 2,087 Analyst insights sit in `agent_outputs` and only the last ~10 reach the ticker. 192K email-security scans accumulate; only the latest one per brand is rendered.
- **The "Signals" tab is a UX misnomer.** It reads from the `alerts` table, which is the auto-triaged subset for a few signal families (impersonation / app store / social). It is not a feed of all threats per brand. Customers reasonably assume "Signals" = "everything bad we've found about my brand" → it's not.
- **Several features look real and are not.** Dark Web says "No mentions ingested yet" while the table has 51 rows. CT log feed is empty. ATO events are empty. DMARC reports are empty. Breach checks are empty. URL scan results have 4 rows total. Stealer log results are empty. These are all things the marketing surface implies we do.
- **Trademarks works only for 3 brands.** `trademark_findings` = 305, but only 3 brands have `trademark_assets` populated. The feature is real but not seeded for the catalog.

---

## Highest-leverage fixes (ranked by effort vs. customer impact)

1. **Add a "Threats" tab to BrandDetail that renders the threat rows.** Reuse the existing `ThreatsTable` component from the global Threats page, pass `brand_id` as a filter, and fix the handler (`handleBrandThreats` in `handlers/brands.ts:928`) to perform the same joins as `/api/threats`. Single biggest customer-perceived gap. ~1-2 days.

2. **Wire `saas_techniques` into the brand surface.** The data is there, joined, indexed (`idx_saas_techniques_phase`, `idx_threats_saas_technique`). Add a MITRE phase column on the new Threats tab + a TTP-distribution chip-cloud on the brand header. ~1 day.

3. **Fix `/v2/alerts` default filter.** Right now the page mounts with a filter set that excludes all 6,926 rows. Either widen the default filter or surface a "0 alerts visible — adjust filters" hint. ~30 min.

4. **Replace the brand-page Signals tab with a unified "Threat Intelligence" feed** that union-queries `threats` + `alerts` + `social_mentions` + `dark_web_mentions` + `app_store_listings` per brand, with status/severity/source filters. This is the page customers think they're getting. ~3-4 days.

5. **Surface `threat_narratives` (Narrator agent output) on the brand page.** Endpoint built, never hooked. ~1 hour to add a hook + render in a "Brand Story" panel.

6. **Email-security portfolio trend chart** using the 183K historical scans. The hourly cron is paying for this data; we render the latest. A "DMARC enforcement trend" / "grade movers (last 7d)" surface would be ~2 days. Customers buying email-security observability would actually see what they're paying for.

7. **Fix the misleading empty states.** Dark Web "No mentions ingested yet" → "No confirmed mentions" or "All recent mentions were classified false positive". Takedowns modal "No content available." → render the actual takedown payload from `takedown_evidence`. Brand Risk Typosquats "No active typosquatting threats attributed" — this fires because the section requires `domain LIKE '%' || brand.canonical_domain || '%'` AND `status='active'` AND `target_brand_id=?`; loosen the join.

8. **Cull stub UI for empty features.** ATO, CT Certificates, DMARC reports, breach checks, stealer logs, passive DNS, phishing patterns, URL scans, threat_signals — either light them up (pick 1-2 and actually finish them) or hide them from nav until they have data.

9. **Brand-score history portfolio view.** 63K snapshots, single-brand sparkline only. Add `/v2/brands?sort=improving` / `/v2/brands?sort=declining` using the snapshot deltas. ~1 day.

10. **Audit the campaign deduplication.** The /v2/campaigns top-5 panel shows 5 nearly-identical "AS13335 malware_distribution cluster" cards. NEXUS is producing duplicate clusters per run. Either dedupe in `buildArcsCubeForHour` or display latest-per-cluster-id.

---

## Bottom line for the user

> The data is there. The pipeline is there. The agents are firing.
> The brand-detail page is the wall between the customer and the platform's actual output — and it currently lets through almost none of it.

If you fix one thing first: **add a Threats tab to the brand page** that mirrors the global Threats table, scoped by `brand_id`, with TTP joins. That single change converts every claim of "we have 1,196 threats targeting Amazon" from invisible into clickable evidence — which is exactly the gap you sensed.
