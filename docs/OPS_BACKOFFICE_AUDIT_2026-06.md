# Averrow Back-Office (averrow-ops) — UX & Capability Audit (2026-06)

> Companion to `TENANT_ANALYST_UX_RESEARCH_2026-06.md`. That doc audited the
> **customer** surface (averrow-tenant). This one audits the **staff
> back-office** (averrow-ops, the React /v2 SOC console, ~49 routes) and its
> backing Worker endpoints — **interleaved per domain** so UI and API findings
> reinforce each other.

---

## 1. Purpose & method

Same proven method as the tenant audit: a **competitor benchmark**, a **gap
table with severity**, and a **phased roadmap** — but run in **domain
batches** (a few cohesive pages at a time) because the surface is ~3× the
tenant's. Goals, in the user's words:

- Find **missing key features** vs competitor SOC / threat-intel platforms.
- Check the **UI is logical**: every list → entity → evidence → action
  drill-down works, with no dead-ends or orphaned surfaces.
- **Consolidate / simplify without losing features** (e.g. parallel v2/v3
  surfaces).
- Confirm **access logic** (RBAC) is coherent per page.

**Per-page rubric (the lens).** Each page scored on:
`purpose clarity · drill-down depth · redundancy · missing capability ·
access/RBAC logic · actionability`.

**Batch order** (chosen 2026-06): entity/pivot first, then working queues,
automation, big-picture, admin cluster.

| Batch | Pages | Status |
|---|---|---|
| **1 — Entity/pivot** | Brands, Providers, Threat Actors, Campaigns | 🔄 in progress |
| 2 — Working queues | Threats, Alerts, Intelligence | ⏳ |
| 3 — Automation | Agents, Approvals, Architect | ⏳ |
| 4 — Big-picture | Observatory, Trends | ⏳ |
| 5 — Admin cluster | Users, Orgs, Pricing, Incidents, Takedowns, Audit, Push | ⏳ |

**Cadence:** audit a batch → ship 1–2 consolidation/feature slices behind
draft PRs → next batch.

---

## 2. Competitor benchmark — what a staff threat-intel console is expected to do

Reference set for the *staff* (SOC/analyst) surface — distinct from the
tenant's brand-protection benchmark: **Recorded Future** (Intelligence Graph /
Intelligence Cards), **ZeroFox**, **Group-IB**, **Doppel** (Threat Graph),
**Microsoft Defender TI**, **Censys**, **Intel 471**, **Silobreaker**,
**Spamhaus**.

### 2.1 Entity/pivot domain — the expected-capability set

The repeated finding across vendors: **the entity is the unit of
investigation, and entities form a connected, pivotable graph** — not isolated
list rows.

| # | Expected capability | Source / precedent |
|---|---|---|
| E1 | **Entity "card" as investigation unit** — a bundled view of an entity (brand/provider/actor/campaign) that is the *starting point for triage and provides pivot points*. | RF **Intelligence Cards** |
| E2 | **Entity pivoting / link analysis** — pivot across IP ↔ domain ↔ provider ↔ actor ↔ campaign to uncover relationships; the graph is connected with **no dead-ends**. | RF **Intelligence Graph**, ThreatBook pivoting |
| E3 | **Threat-actor profile** with the standard spine: aliases, attribution/country, motivation, active-since, **targeted industries/geos (victimology)**, **MITRE ATT&CK TTPs**, malware/tools, associated campaigns, **recent-activity timeline**, linked IOCs. | Intel 471, SOCRadar, Google TI/VirusTotal actor cards, Silobreaker (MITRE) |
| E4 | **Hosting-provider / ASN reputation scoring** — a reputation/risk score per provider+ASN, **bulletproof-hosting signal**, abuse-contact + abuse correlation, trend over time. | MS Defender TI reputation, Censys, Spamhaus, ASwatch |
| E5 | **Campaign clustering + graph** — related infra/domains/profiles grouped into a coordinated **campaign**, shown as an **interactive graph** that exposes attacker infrastructure and drives bulk action. | **Doppel Threat Graph**, **ZeroFox** automated clustering |
| E6 | **Cross-entity consistency** — list views share search/filter/sort conventions; detail views share a notes/timeline/activity affordance so an analyst's muscle memory transfers between entity types. | General TIP UX (Cyware, Silobreaker) |

> _Inventory map (§3) and the Batch-1 gap table (§4) are populated from the
> in-flight recon and land in the next pass._

### 2.2 Sources

- [Recorded Future — Intelligence Graph](https://www.recordedfuture.com/platform/intelligence-graph) · [Threat Intelligence product](https://www.recordedfuture.com/products/threat-intelligence) · [What is Threat Intelligence](https://www.recordedfuture.com/threat-intelligence-101/what-is-threat-intelligence)
- [ThreatBook — Pivoting Analysis](https://docs.threatbook.io/guide/pivoting-analysis)
- [Intel 471 — Threat Actor Profiling & Modeling](https://www.intel471.com/use-cases/threat-actor-profiling-modeling) · [SOCRadar Threat Actor DB](https://socradar.io/free-tools/threat-actor) · [Google TI / VirusTotal — Threat Actors card](https://gtidocs.virustotal.com/docs/threat-actors-card)
- [Silobreaker — MITRE ATT&CK TTP detections](https://www.businesswire.com/news/home/20240304148696/en/Silobreaker-Integrates-MITRE-ATTCK%C2%AE-TTP-Detections-Into-Its-Threat-Intelligence-Platform)
- [Microsoft Defender TI — reputation scoring](https://learn.microsoft.com/en-us/defender/threat-intelligence/reputation-scoring) · [Censys — tracking bulletproof hosting](https://censys.com/blog/hiding-in-plain-sight-tracking-bulletproof-hosting-and-abused-rdp-infrastructure/) · [Spamhaus — anatomy of bulletproof hosting](https://www.spamhaus.org/resource-hub/bulletproof-hosting/the-anatomy-of-bulletproof-hosting-past-present-future-/) · [ASwatch (SIGCOMM 2015)](https://conferences.sigcomm.org/sigcomm/2015/pdf/papers/p625.pdf)
- [Doppel — Platform / Threat Graph](https://www.doppel.com/platform) · [ZeroFox — brand protection](https://www.zerofox.com/solutions/protection/brand-protection/)

---

## 3. Inventory & redundancy map

_Pending — populated from the full-surface recon pass._

---

## 4. Batch 1 — Entity/pivot gap analysis

_Pending — populated from the entity/pivot deep recon._
