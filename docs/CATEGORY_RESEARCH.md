# CATEGORY_RESEARCH.md — Averrow positioning + competitive landscape

## Status

Working draft. Built incrementally per the planning session 2026-04-30.
External research will be folded in as it lands (operator may
contribute findings from other AI platforms; vendor names omitted
throughout per project policy).

---

## 1. Problem statement

> How can companies determine their brand's exposure online?

Companies invest years building a brand — name, logo, domains,
likeness, customer trust. Online attackers exploit that brand to
phish customers, host malware on lookalike domains, run social
impersonation campaigns, sell counterfeit goods, leak credentials
on dark-web forums, and submit malicious app-store listings.

The questions a brand-protection operator actually needs answered:

- **Who** is impersonating, attacking, or diminishing the brand?
- **What** resources are being abused (domains, logos, names, social
  handles, employee identities)?
- **Where** is the abuse hosted (provider, jurisdiction)?
- **How** does the campaign tie to other attacks (same actor, same
  tooling, same pivot pattern)?
- **What's next** — what infrastructure are they prepping?

Most platforms answer the first half. Averrow's positioning is the
second half: tying signal to threat actors, tracking pivots,
fingerprinting MO + tooling, surfacing geopolitical and provider-
abuse context, and acting on it automatically.

---

## 2. Category baseline — table stakes

Every credible brand-protection / digital-risk-protection platform
in this category ships some combination of the following. These
are not differentiators — they're the price of entry.

### 2.1 Detection surfaces

- **Lookalike / typosquat domain monitoring** — registrar feeds,
  passive DNS, certificate transparency.
- **Phishing URL detection** — Google Safe Browsing, PhishTank,
  abuse.ch, OpenPhish, internal scanners.
- **Email authentication posture** — DMARC / SPF / DKIM / MX /
  BIMI / VMC scoring per monitored domain.
- **Social media impersonation** — fake accounts, profile
  imitation, trademark abuse on the major platforms.
- **App-store impersonation** — counterfeit apps on iOS / Google
  Play / third-party stores.
- **Dark-web mention monitoring** — breach exposure, credential
  dumps, forum chatter mentioning the brand or executives.
- **Mobile / SDK abuse** — rogue apps, sideloaded variants.

### 2.2 Operational pipeline

- **IOC enrichment** — IP geo, ASN, hosting-provider attribution,
  WHOIS, SSL cert details.
- **Threat scoring** — severity buckets, confidence scores.
- **Alert / notification system** — email, in-app, sometimes SMS
  or PagerDuty.
- **Takedown automation** — submission to registrars, hosting
  providers, social platforms, app stores.
- **Reporting / dashboards** — exposure trend, takedown SLA,
  brand-by-brand drilldown.
- **Multi-tenant org / RBAC** — for service providers and
  enterprises with sub-brands.

### 2.3 Intelligence layer

- **Threat-actor profiles** — named groups, TTPs, geographies.
- **Campaign correlation** — clustering threats that share IP /
  ASN / domain pattern.
- **Geopolitical event tagging** — campaigns linked to nation-
  state activity.
- **Industry sector benchmarking** — "how exposed are you vs your
  peers."

### 2.4 Onboarding (the friction every customer feels)

This is where every platform looks the same and every customer
groans. The standard onboarding:

- Customer manually enters every brand they want monitored.
- Customer uploads logo files, BIMI SVG, brand colors.
- Customer configures social handles per platform.
- Customer adds domains they own + variants they care about.
- Customer configures alert routing, severity thresholds, etc.
- Customer waits 24-72 hours for the platform to build a baseline.

By design this is sticky — once configured, switching costs are
high. By accident this is also the biggest competitive gap in
the category (covered in §3 + §8).

## 3. Where the category is weak

The baseline in §2 is well-served. Where the category collectively
falls short — and where Averrow's positioning bites:

### 3.1 Threat-actor attribution beyond "we saw a phish"

Most platforms surface a malicious URL with severity, source feed,
hosting provider, and a takedown button. Once takedown succeeds,
the row goes "resolved" and disappears from the dashboard. The
actual question — *who launched this and what else are they doing
right now* — is rarely surfaced, much less acted on.

Indicators that should bind a phish to an actor (and don't, in
most platforms):

- ASN reuse across campaigns weeks apart
- Registrar + name-server fingerprint
- TLS issuer + cert validity-window pattern
- Phish-kit fingerprints (HTML structure, asset hashes, login-form
  POST targets)
- Hosting-provider hop sequence over time
- Time-of-day / day-of-week signing patterns
- Telegram / Discord channel mentions of the same kit

Result: the same actor hits the same brand under a new domain a
week later, and the platform treats it as an unrelated event.

### 3.2 Pivot tracking when infrastructure moves

Threat actors rotate hosting providers, ASNs, registrars, and TLDs
constantly — often in response to takedowns. The category mostly
treats each new domain as a fresh detection. The pivot itself —
the fact that the actor *moved from provider A to provider B
within 48 hours of takedown* — is signal that other platforms
don't capture, score, or surface.

This matters because:

- Repeat pivots identify abuse-tolerant providers (a shaming /
  reporting opportunity)
- Pivot velocity is a leading indicator of actor sophistication
- Pivot patterns help predict the *next* infrastructure they'll
  use

### 3.3 MO + tooling fingerprinting

Beyond IOCs, the *how* of an attack — what kit, what automation,
what AI-generated content patterns — is barely tracked in the
category. Examples:

- Was the phish generated by an LLM (typical sentence rhythm,
  specific failure modes)?
- Is the kit one of the publicly-traded phishing-as-a-service
  bundles, or a custom build?
- Are the lookalike domains generated algorithmically (typo
  permutations) or hand-picked?
- Does the campaign use bulk-registered domains with sequential
  patterns?

Surfacing this lets defenders adapt detection rules for the
*style* of attack, not just the IOC list.

### 3.4 Cross-tenant / cross-brand pattern detection

Most platforms operate per-tenant in isolation. If three customers
in the same sector get hit by the same kit on the same day, no
single platform tells either of them *"this is part of a sector-
wide campaign — here are the other affected brands and the shared
infrastructure."* Multi-tenant platforms have the data to do this;
they don't surface it because the legal / privacy / contractual
implications are tricky.

### 3.5 Geopolitical context binding

Categorizing campaigns by adversary country / nation-state
cluster / sanctions implications is rare. Most platforms surface
"hosted in Russia" as a country tag and stop there. The richer
read — "this actor was active during X conflict, pivoted to Y
infrastructure during Z event, matches TTPs of group W" — is
expensive to maintain and most vendors don't.

### 3.6 Hosting-provider abuse scorecards

Some providers consistently host abuse, ignore takedown requests,
and re-register suspended customers. The category has hosting-
provider tags but rarely converts that into a *scorecard* the
operator can use to:

- Prioritize takedown channels (skip slow / unresponsive
  providers)
- Lobby providers with evidence
- Inform contract / partner decisions

### 3.7 AI-generated content detection

Phishing pages, lure emails, and fake social profiles are
increasingly LLM-generated. The category is largely still using
pre-AI heuristics (keyword matching, brand-asset comparison).
Detection rules that account for AI-generation artifacts (token
distribution, repeated phrasing patterns, generic structure) are
rare.

### 3.8 Onboarding friction

Per §2.4, every platform asks the customer to manually configure
their brand inventory before any monitoring starts. This is the
single biggest "I'm not in love with this product yet" moment in
the entire category. A platform that auto-builds the inventory
from a single domain (via DNS, BIMI, social discovery, app-store
search, dark-web mention scan) starts every customer relationship
ahead of competitors.

### 3.9 Action loop closure

Most platforms produce signals + dashboards and require humans to
take action. The category claims "automated takedowns" but
typically means "we file the abuse form for you" — humans still
review, prioritize, follow up, and close. Closing the loop —
takedown → measure → re-detect on pivot → re-takedown → escalate
provider → adjust detection rules — without operator involvement
is rare.

## 4. Common positioning angles in the space

When everyone ships the same baseline (§2), positioning is how
vendors signal their angle. The recurring patterns in this space:

### 4.1 "We monitor more places"

Surface count as the differentiator: "X surface web sources, Y
dark-web forums, Z app stores, W social platforms." Customer
appeal: completeness anxiety. Weakness: more sources without
better correlation = more noise. Doesn't answer "now what."

### 4.2 "We take down faster"

SLA-driven. "Average X-hour takedown." Customer appeal: clear
metric, easy procurement spreadsheet entry. Weakness: SLA is
median, tail is what hurts; takedowns are largely a function of
the host's responsiveness, not the platform's.

### 4.3 "We have analyst-led intelligence"

Human-in-the-loop curation. "Our research team profiles every
threat." Customer appeal: bespoke / premium feel. Weakness:
doesn't scale, and analysts mostly produce reports that get
filed and forgotten — not action loops.

### 4.4 "We're enterprise / managed service"

White-glove. "We onboard you, we manage your tenant, we deliver
weekly reports." Customer appeal: low operational burden.
Weakness: the value is the service relationship, not the
platform; the platform itself can be mediocre and the service
masks it.

### 4.5 "We integrate with your SIEM / SOAR"

Integration count + API quality as the differentiator. Customer
appeal: works with existing security stack. Weakness: integration
shifts the work to the customer's analysts; the platform doesn't
think harder.

### 4.6 "We use AI" (the post-2023 baseline angle)

Almost universal now. Vendors badge existing classification /
clustering / summarization with "AI-powered." Customer appeal:
modern, future-proof. Weakness: what specifically the AI does is
usually opaque and rarely changes outcomes. Mostly LLM-summarized
dashboards.

### 4.7 "We're affordable / SMB-friendly"

Price-led. Customer appeal: covers a market segment the
enterprise vendors won't touch profitably. Weakness: race-to-
the-bottom; data quality often suffers; AI usage gets capped to
control unit economics.

### 4.8 "We're vertical-specialized"

"We focus on financial services / government / healthcare brands."
Customer appeal: speaks the customer's language, knows their
threats. Weakness: scope limits TAM; the threat actors don't
respect the vertical boundary.

### 4.9 "We do takedowns AS the service"

Pure takedown shop, often white-labeled inside other vendors.
Customer appeal: simple SOW. Weakness: not a platform play;
detection is bought elsewhere or scraped.

---

### Where Averrow's positioning fits

Averrow combines angles that are usually mutually exclusive:

- **Auto-onboarded** (kills §2.4 friction → competes with managed-
  service angle on convenience without the headcount)
- **Threat-actor first** (§3.1, §3.2 — pivots, MO, kits — replaces
  the "more sources" angle with "deeper signal")
- **Action-loop closed** (§3.9 — auto-takedown → re-detect on
  pivot → re-takedown → escalate → adjust rules without the
  operator)
- **AI applied to correlation, not just summarization** (§3.3,
  §3.4, §3.5 — what the §4.6 angle promises but rarely delivers)

This combination is the genuine differentiator. §8 expands.

## 5. Customer pain points with existing platforms

Common operator complaints about platforms in this space. These
inform what Averrow should make obviously different.

### 5.1 Onboarding takes weeks, not minutes

Manual brand inventory entry, asset uploads, social handle config,
domain verification, contract / DPA reviews. Customer is paying
during the gap. By the time the platform is "live" the operator
has already lost confidence.

### 5.2 Alert fatigue with no clear "what to do"

Dashboards full of low-severity rows. No reason text. No
recommended action. Operator triage is "is this worth caring
about" first, "what do I do about it" second. Both questions
should be pre-answered.

### 5.3 Takedown follow-through is uneven

Submission is automated but hosting providers respond at very
different speeds. Some take 30 minutes, some take 3 weeks, some
never respond. The platform shows "submitted" status forever; the
operator has no way to see SLA-by-provider data when negotiating
or escalating.

### 5.4 The same threat actor keeps coming back and the platform doesn't notice

Takedown closes the row. Two days later the same actor is back on
a new domain, same hosting provider class, same kit. The
platform's dashboard treats this as fresh detections — the
operator's incident-response team is the only memory.

### 5.5 No prediction, only reaction

The platform tells the operator about threats that already exist.
It rarely tells them about infrastructure being prepared. Lookalike
domain registered Tuesday → no IP, no content, no signal → it
gets flagged Friday only after the phish goes live. The
prep-window opportunity is missed.

### 5.6 Reports designed for the buyer, not the user

Monthly executive reports with green / yellow / red dials. Useful
for the security director's QBR. Useless for the analyst trying
to figure out which campaign to focus on this morning.

### 5.7 Dashboard-as-product, not action-as-product

The platform produces views. Action requires the operator's
team. Customers paying for "automated brand protection" frequently
discover that "automated" means "we send the email when the
phish appears" — not "we run the workflow to closure."

### 5.8 AI is opaque

"AI-powered" appears on the website, in the sales deck, and on
the dashboard banner. What the AI actually does, when it ran,
what it concluded, what tokens it cost, why it picked one
threat over another — none of that is exposed. Trust is asked
for, not earned.

### 5.9 Multi-brand / multi-tenant gets complex fast

Service providers and large enterprises with sub-brands hit
hierarchy limits, RBAC limits, billing-attribution limits, alert-
routing limits. The platform was designed for one brand × one
team and bolted on multi-tenancy.

### 5.10 Switching cost is the moat, not value

The brand inventory, takedown evidence library, and integration
configuration become the lock-in. Customers stay because moving
costs are high, not because the platform earns daily love.

---

These pain points cluster into three classes that Averrow should
address head-on:

1. **Time-to-value** (5.1) — auto-onboard.
2. **Decision quality** (5.2, 5.6, 5.8) — every alert ships with
   reason + recommended action; AI work is exposed and traceable.
3. **Loop closure** (5.3, 5.4, 5.5, 5.7) — actor memory, pivot
   tracking, prep-window detection, takedown-to-closure
   automation.

## 6. AI in the category — claims vs reality

Almost every platform now claims to be "AI-powered." The reality
is more uneven. The recurring patterns:

### 6.1 What "AI" usually means in marketing copy

- **Classification**: is this URL a phish (binary or scored)?
- **Clustering**: group similar threats together
- **Summarization**: turn raw events into prose for the dashboard
- **Image similarity**: logo / favicon match scoring

These are real — but they were happening before LLMs, often with
classical ML. The post-2023 rebrand mostly involves swapping
existing models for LLM-based ones and putting "AI" on the label.

### 6.2 What's rarely shipped despite the claim

- **Cross-event narrative**: tying a phish, a typosquat, a social
  imitation, and a dark-web mention into one campaign-actor story
- **Predictive infrastructure detection**: spotting prep before
  the attack (cluster of newly-registered domains on the same ASN
  before content goes live)
- **AI-generated-content fingerprinting**: detecting when the
  attacker used an LLM to write the lure
- **MO inference**: figuring out the *style* of the attacker —
  how they pick infrastructure, how they sequence pivots, what
  tooling they prefer
- **Action recommendations grounded in the platform's actual
  data**: "for THIS threat actor, takedown via THIS channel
  worked X% of the time last quarter"

### 6.3 The opacity problem

When the platform says "AI flagged this as critical," operators
typically can't see:

- Which model was used
- What context was passed in
- What the model returned (often only a final score is stored)
- How much it cost
- How confident the model was

Trust depends on observability. The category collectively under-
invests in making AI work auditable.

### 6.4 Cost discipline is rare

LLM calls scale with volume. A platform with 100K daily threats
that runs every threat through Sonnet is spending ~thousands of
dollars per day. Most platforms either:

- Cap AI to severity tiers (cheap but biased toward critical)
- Cap AI to a sample (random gaps in coverage)
- Run cheaper models everywhere (lose quality)
- Eat the cost and pass it to the customer's bill

Few platforms expose budget state, throttle gracefully, or let
the customer trade cost for fidelity.

### 6.5 Where AI actually changes outcomes (vs decoration)

The high-leverage applications — the ones that move the needle
on operator outcomes — are not the dashboard banners:

- **Multi-signal correlation across 24-72h windows** (per-brand
  narrative): turns 50 separate dashboard rows into one "this
  is what's happening to your brand right now" paragraph
- **Predictive cluster scoring**: "infrastructure setup pattern
  matches a campaign that hit you 6 months ago — strike window
  predicted"
- **Action selection**: which takedown channel to use, ranked
  by historical success on this provider × actor pair
- **AI-generated content detection**: did the attacker use an LLM
  to write this?
- **Per-brand template-rendering**: AI writes the alert reason +
  recommended action grounded in the specific row, not a generic
  string

### 6.6 What Averrow does today

(Concrete — to feed §7's code-level map.)

- **Haiku for classification** (cheap, high volume) — sentinel,
  cartographer
- **Sonnet for narrative** (rare, high-leverage) — narrator,
  observer briefing
- **Cluster detection** — NEXUS algorithm, AI assists with
  naming + correlation context
- **Reason text + recommended action** — currently static
  templates per `intel_*` family (Q5 v1); AI narrator agent for
  digest envelopes is shipped
- **Cost guard + budget rollups** — AI work pauses when the
  monthly budget hits soft / hard / emergency thresholds. Visible
  in the platform-diagnostics endpoint.
- **Per-agent cost attribution** — every Haiku / Sonnet call is
  tagged to the agent that made it; budget ledger is queryable.

The cost-guard + observability piece is genuinely different from
the §6.3 / §6.4 norm in this space.

## 7. Averrow capabilities — code-level map

What Averrow actually has, grouped by the category dimensions
in §2 + §3. This is the inventory feeding §8's differentiator
selection. All references are to `packages/trust-radar/src/`.

### 7.1 Detection surfaces

| Capability | How | Code |
|---|---|---|
| Phishing / malicious URL detection | Multi-feed ingestion: PhishTank, OpenPhish, abuse.ch, URLHaus, ThreatFox, OTX, CINS, SecLookup, GreyNoise, AbuseIPDB, Spamhaus DBL, GSB, VirusTotal | `feeds/*.ts` (40 feeds) |
| Lookalike / typosquat | `lookalike-scanner` agent — DNS/HTTP/MX + Haiku AI assessment of newly-registered candidates | `agents/lookalike-scanner.ts` |
| Certificate Transparency monitoring | CertStream Durable Object — live CT log subscription with brand-keyword matching | `lib/certstream.ts` |
| Social impersonation | `social_monitor` (Twitter/LinkedIn/Instagram/TikTok/GitHub/YouTube) + `social_discovery` (auto-find brand handles) + `social_ai_assessor` Haiku classifier | `agents/social*.ts` |
| App-store impersonation | `app_store_monitor` — iOS today, Google Play + 3rd-party planned | `agents/appStoreMonitor.ts` |
| Dark-web monitoring | `dark_web_monitor` — Pastebin today; Telegram / HIBP / Flare planned | `agents/darkWebMonitor.ts` |
| Email auth posture | DMARC / SPF / DKIM / MX / BIMI / VMC scoring per brand | `email-security.ts`, cartographer Phase 3 |
| Spam trap captures | Honeypot email addresses planted into harvester channels (secret-sauce, not surfaced) | `auto-seeder`, `spam-trap.ts` |
| Honeypot generation | `honeypot-generator` — renders complete trap websites (index + contact + team pages) | `agents/honeypot-generator.ts` |

### 7.2 Operational pipeline

| Capability | How | Code |
|---|---|---|
| IOC enrichment | Cartographer (geo / ASN / hosting provider, multi-phase) + Enricher (DNS, brand, sector) | `agents/cartographer.ts`, `cron/enricher.ts` |
| Threat scoring | Sentinel + Analyst + Strategist sequence | `agents/sentinel.ts`, `agents/analyst.ts`, `agents/strategist.ts` |
| Brand matching | Analyst — Haiku-powered brand-vs-domain matching | `agents/analyst.ts` |
| Auto-takedown | Sparrow scans URLs → auto-creates takedowns → Evidence Assembler builds provider-ready abuse reports → resolves providers | `agents/sparrow.ts`, `agents/evidence-assembler.ts` |
| Notifications | 4-state inbox, per-channel severity floors, group_key dedup, push action buttons, AI digest envelope | `lib/notifications.ts`, `agents/notification_narrator.ts` |
| Multi-tenant | Org / brand / user model with RBAC, audience routing, per-brand subscriptions | `migrations/0027_organizations*.sql`, `notification_subscriptions` |
| Reporting / dashboards | Observatory (real-time threat globe), Brand Detail, Operations, Threat Actors, Intelligence views | `packages/averrow-ui/src/features/*` |
| Auto-onboard | One-domain → tenant ready: DNS / BIMI / social discovery / app-store search / dark-web baseline auto-built. (Architecturally present; UX polish pending.) | brand-enricher + social_discovery + lookalike-scanner pipeline |

### 7.3 Intelligence layer

| Capability | How | Code |
|---|---|---|
| Threat-actor profiles | `threat_actors` + `threat_actor_infrastructure` + `threat_actor_targets` tables; per-actor pages | `migrations/0063_threat_actors*.sql`, `handlers/threatActors.ts` |
| Campaign correlation | Strategist clusters threats by IP / ASN / subnet / temporal pattern → campaigns | `agents/strategist.ts` |
| Cluster detection | NEXUS — infrastructure correlation engine, scores accelerating clusters | `agents/nexus.ts` |
| Geopolitical campaign assessment | `geo_campaign_assessment` — 4-paragraph executive intel assessment of active geopolitical cyber campaign (Haiku, 1024-token prose) | `agents/geo-campaign-assessment.ts` |
| Trend analysis | Observer — daily / weekly intelligence synthesis with multi-signal narrative | `agents/observer.ts` |
| Per-brand narrative | Narrator — multi-signal correlation per brand (≥2 signal types) → coherent attack story → high-severity also creates alerts | `agents/narrator.ts` |
| Sector trend digests | Observer weekly intel + `intel_sector_trend` notification | `agents/observer.ts`, intel_templates |
| Predictive alerts | NEXUS accelerating cluster + brand confidence ≥70 → `intel_predictive` per affected brand | intel_templates + nexus emit |
| Chat copilot | Trustbot — interactive AI threat intelligence Q&A | `agents/trustbot.ts` |

### 7.4 Self-supervision (the genuinely-different layer)

| Capability | How | Code |
|---|---|---|
| Autonomous supervisor | Flight Control — every-tick tracking of agent health, backlogs, budget, feed status; auto-recovers stalled agents; auto-scales cartographer/analyst | `agents/flightControl.ts` |
| Cost guard | BudgetManager — soft / hard / emergency throttle thresholds against monthly token cap; per-agent + per-tier limits | `lib/budgetManager.ts` |
| Per-agent attribution | Every Haiku / Sonnet call tagged to the agent that made it; budget ledger queryable | `lib/budget-ledger.ts`, agent_runs.cost_usd |
| Circuit breaker | Per-agent consecutive-failure auto-pause + manual unpause; FC observes + reports | `lib/agentRunner.ts` circuit logic |
| Self-monitoring notifications | platform_* family — d1_budget, kv_budget, agent_stalled, feed_at_risk, cron_missed, briefing_silent, ai_spend_burst, etc. | `lib/platform-templates.ts` |
| Diagnostics endpoint | `/api/internal/platform-diagnostics` — full health snapshot: feeds, agents, D1 budget, AI spend, briefing pipeline, cron health, recent platform alerts, FC tick timings | `handlers/diagnostics.ts` |

### 7.5 Operations + scaling

| Capability | How | Code |
|---|---|---|
| Hourly orchestrator cron | Dispatches agent mesh (FC, Sentinel, Cartographer, Analyst, Strategist, Observer, NEXUS, etc.) | `cron/orchestrator.ts` |
| Sub-hourly Navigator | Every-5-min cache pre-warming + cube refresh + DNS resolution + light enrichment | `cron/navigator.ts` |
| OLAP cubes | threat_cube_geo / threat_cube_provider / threat_cube_brand — pre-aggregated for sub-50ms reads | `lib/cube-builder.ts` |
| Pre-computed columns | brands.threat_count, hosting_providers.active_threat_count, trend_7d/30d — avoid GROUP BY on hot paths | various |
| Read replicas | D1 Sessions API — read-heavy handlers route through `getReadSession` | `lib/db.ts` |
| KV cache pre-warm | 24 endpoints warmed every 5 min by Navigator | `cron/navigator.ts` |
| Workflows (durable) | NEXUS + Cartographer backfill run as Cloudflare Workflows (no CPU ceiling) | `wrangler.toml`, `workflows/*.ts` |

### 7.6 Notable absences (gaps in our own implementation)

Honest gaps to call out — these set the v3 / re-engineering
candidates in §9:

- **MO + tooling fingerprinting** (§3.3) — no kit-fingerprint
  detector yet
- **AI-generated content detection** (§3.7) — no LLM-output
  heuristic on phish lures yet
- **Hosting-provider abuse scorecard** (§3.6) — provider tagged
  per row, but no aggregated scorecard surface
- **Pivot tracking surface** (§3.2) — clusters detect
  acceleration; pivot pattern analysis (provider A → B in N hours
  after takedown) is not yet a first-class concept
- **Cross-tenant pattern surface** (§3.4) — `intel_cross_brand_pattern`
  type exists in registry but emit not wired
- **Threat-actor pivot surface** (§3.1) — `intel_threat_actor_surface`
  type exists; emit needs an INSERT path into
  threat_actor_infrastructure that the Sentinel update path
  doesn't yet provide
- **Action-loop closure** (§3.9) — Sparrow + evidence_assembler
  ship; the re-detection loop on pivot + automatic re-takedown is
  partially wired (NEXUS detects acceleration; auto-resubmit not
  fully closed)

These absences aren't disqualifiers — they're the strategic
build-list. §9 frames whether they're incremental or v3-shaped.

## 8. Genuine differentiators — Better / Quicker / Intelligently / Clever / Aggressive

*(Stub.)*

## 9. Strategic implications

*(Stub — incremental enhancement vs Averrow v3 rewrite.)*

## 10. Appendix — open research tasks

*(Stub.)*
