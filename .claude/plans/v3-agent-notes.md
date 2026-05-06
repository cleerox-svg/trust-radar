# Firmographic Provider Evaluation — Trust Radar Brand Tiering

**Use case:** Append `employee_count_est`, `revenue_range`, `market_cap_usd`, `funding_stage`, industry sub-class to ~10K brands by domain key. Volume: 10K bulk + ~100/day. Cost-discipline-first. EU customers in scope (GDPR matters).

## Provider Comparison

| Provider | Domain key? | Self-serve API? | Free tier | List price (relevant tier) | Effective $/lookup at our volume | Latency | Refresh | GDPR posture | Mid-market US/EU completeness |
|---|---|---|---|---|---|---|---|---|---|
| **Clearbit / Breeze Intelligence** | Yes (legacy) | No (HubSpot-gated post-2024) | None | $75/mo min, 1K credits = $150/mo; HubSpot sub required | n/a — no longer standalone API | n/a | Monthly+ | HubSpot DPA, EU OK | Was best-in-class; coverage frozen since acquisition |
| **Apollo.io** | Yes | Yes | 60 credits/mo free | Pro $79/seat/mo (4K credits/mo); overage $0.20/credit min 250 | ~$0.20/lookup post-included | <500ms | Continuous (LinkedIn-scraped) | EU DPA, ToS-grey on LinkedIn | Strong on US SMB/mid-market; weaker on EU + revenue/funding |
| **Crunchbase API** | Partial (org name preferred, domain supported) | Enterprise only for API | None (free tier removed 2025) | Enterprise API custom; ~$50K/yr+ | ~$5+/lookup at 10K | <500ms | Crowdsourced, weeks-to-months | EU customers served; clean provenance | Best for funding/market_cap; weaker on headcount accuracy |
| **ZoomInfo** | Yes | Enterprise only | None | $25K-$100K+/yr; credits variable | ~$2.50-$10/lookup | <300ms | Continuous, telephone-verified | EU compliant, but EU coverage is the weak spot | Best US mid-market completeness; mediocre EU |
| **RocketReach** | Yes (Company Lookup API) | Yes (Ultimate $207/mo or $2,099/yr for API) | 5 lookups/mo | Ultimate 10K lookups/mo at $2,099/yr | ~$0.21/lookup | ~500ms-1s | Quarterly-ish | EU DPA, smaller footprint | Decent firmographics; revenue/funding shallow |
| **People Data Labs (PDL)** | Yes (Company Enrichment API) | Yes | Free dev tier (~100 credits) | Pro $98/mo (1K co-lookups); annual ~$0.20-$0.28/credit; volume → $0.10-$0.15 | **~$0.10-$0.20/lookup** at 10K + 100/day annual | 200-400ms | Quarterly snapshot, monthly delta | GDPR, CCPA, SOC2, ISO27001; opt-out portal; 2019 breach is historical | Strong mid-market; ~50M company profiles; EU coverage decent |
| **Coresignal** | Yes | Yes | 14-day trial, 200 credits | Self-serve from $49/mo; commercial API $500-$5K/mo; bulk dataset ~$1K | ~$0.05-$0.15/lookup at 10K (committed) | 300-500ms | Weekly-monthly (LinkedIn-derived) | EU-based (Lithuania); GDPR-native | Very strong headcount/industry; thinner on revenue/funding |
| **BuiltWith** | Yes (Domain API) | Yes | Free single lookup | Domain API ~$295-$995/mo plans | ~$0.03-$0.10/lookup but tech only | <500ms | Weekly recrawl | EU OK (passive web data) | Tech stack only — NOT firmographic on its own |
| **Lusha** | Limited (people-first) | API on Scale tier only | 50 credits/mo | Scale = sales-only; median ~$15K/yr | ~$1.50+/lookup | <500ms | Quarterly | EU DPA, has had EU regulator scrutiny | Weak company-side (people-focused) |
| **6sense / Demandbase** | Yes (account-level) | Enterprise only, bundled with ABM | None | $50K-$200K+/yr | ~$5-$20/lookup if used purely for firmographics | <500ms | Continuous | EU compliant | Overkill — firmographics are bundled, not the product |

## Top 2 Recommendation

### #1 — People Data Labs (primary)
- Self-serve API, domain-keyed Company Enrichment endpoint, returns all five required fields (`employee_count`, `inferred_revenue`, `market_cap`, `funding_total/stage`, NAICS+SIC+industry sub-class).
- At our ~13K-lookup year-one budget (10K bulk + ~36K refresh): annual commit gets us to ~$0.15/credit ≈ **~$2K-$3K/yr** total. Within cost-discipline.
- GDPR/CCPA/SOC2/ISO27001, public privacy/opt-out portal — defensible for EU customers.
- Continuous deltas + quarterly full snapshots — fine for re-enrichment cadence.

### #2 — Coresignal (secondary / fallback)
- EU-incorporated (Lithuania), GDPR-native — strong story for EU customers.
- Self-serve API from $49/mo; commercial tier per-credit cheapest at scale.
- Best headcount accuracy in the field (LinkedIn-derived). Use as fallback when PDL returns no `employee_count` or stale data, and to cross-validate.
- Weakness: revenue/funding fields are thinner — hydrate those from PDL.

### Why not the others
- **Clearbit:** dead as a standalone API. HubSpot-gated. Disqualified.
- **ZoomInfo / 6sense / Demandbase / Crunchbase Enterprise:** all $50K+/yr floors. Violates cost discipline by 10-25x.
- **Apollo:** workable at ~$0.20/lookup but LinkedIn-ToS exposure and weaker EU coverage make it a backup at best.
- **RocketReach / Lusha:** people-data-first; firmographic depth is a side product.
- **BuiltWith:** keep as a third-tier signal for tech-stack tagging (not a replacement) — useful for "weak email security" detection (DMARC/SPF, MX provider) which is exactly your stated use case. Worth a ~$295/mo Domain API line item just for that signal.

### Suggested architecture
1. PDL Company Enrichment by domain → primary fields.
2. If PDL `employee_count` null OR `dataset_version > 90d`: fall back to Coresignal.
3. BuiltWith Domain API in parallel for tech/email-security signals (separate column set).
4. Cache enrichment in `brands.firmographic_*` columns; re-enrich quarterly via cron with a `last_enriched_at < now - 90d` selector. KV-cache lookup keys to avoid duplicate spend on aliased domains.

**Estimated all-in annual cost:** PDL ~$2.5K + Coresignal fallback ~$1.2K + BuiltWith ~$3.5K = **~$7K/yr** for full coverage of 10K brands with quarterly refresh.

## Sources
- Clearbit/Breeze: marketbetter.ai, cognism.com, cleanlist.ai
- Apollo: docs.apollo.io, enrich.so
- PDL: support.peopledatalabs.com, peopledatalabs.com/pricing/person, syncgtm.com
- Coresignal: coresignal.com/pricing, syncgtm.com
- ZoomInfo: enrich.so, cleanlist.ai
- RocketReach: docs.rocketreach.co, cognism.com, landbase.com
- BuiltWith: api.builtwith.com, kb.builtwith.com
- Crunchbase: dev.to/agenthustler, vendr.com
- Lusha: lusha.com/pricing, cleanlist.ai, vendr.com
- 6sense/Demandbase: warmly.ai, vendr.com
- PDL GDPR: docs.peopledatalabs.com/docs/data-sources, privacy.peopledatalabs.com
