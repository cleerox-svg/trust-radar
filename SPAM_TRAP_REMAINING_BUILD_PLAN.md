# Spam Trap Seed Campaign — Remaining Build Plan (Final)

**Platform:** Trust Radar (`trustradar.ca` / `lrxradar.com`)
**Status:** Inbound pipeline is fully built. This plan covers the missing offensive, intelligence, and detection layers.

---

## Decisions (Locked In)

| Decision | Answer |
|---|---|
| Honeypot serving architecture | Single multi-domain Worker, route by hostname |
| Seeding pace | Moderate — 20-30 seeds/week once automation is live |
| Email body retention | Keep forever — full bodies retained for AI training data |
| AI phishing detection timing | Build in parallel from Step 2 — start collecting patterns immediately |

---

## What's Already Done (Do Not Rebuild)

- Email Worker with catch-all routing (DMARC handler + spam trap handler)
- `spam_trap_captures` table with full schema (auth results, IOCs, brand match, severity, geo)
- `seed_campaigns` + `seed_addresses` tables with catch stats
- `spam_trap_daily_stats` aggregation table
- Brand matching (5 methods, 60-90% confidence)
- Threat record creation from catches
- Multiple trap patterns: brand traps, spider, paste, honeypot, employee, generic
- D1, KV, Durable Objects, cron all configured
- Catch-all email configured on both `trustradar.ca` and `lrxradar.com`

---

## Step 1: Domain Config (Minutes)

Add `trustradar.ca` and `www.trustradar.ca` as custom domains in `wrangler.toml`. Does not affect existing `lrxradar.com` config. Required before honeypot sites can serve web traffic on the domain.

---

## Step 2: Manual Seed Batch + Detection Baseline (1-2 Hours)

Plant 8 manual seeds using existing tables. Simultaneously begin collecting pattern data for AI phishing detection.

**Seeds to plant:**

| Address | Domain | Channel | Placement |
|---|---|---|---|
| `info-cp01@trustradar.ca` | trustradar.ca | contact_page | Embed on /contact page in raw HTML |
| `admin-wh01@trustradar.ca` | trustradar.ca | whois | Register cheap .xyz domain with this contact |
| `support-fp01@trustradar.ca` | trustradar.ca | forum | Forum profile/signature |
| `billing-ps01@trustradar.ca` | trustradar.ca | paste | Paste site fake contact list |
| `sales-bd01@trustradar.ca` | trustradar.ca | directory | Free business directory submission |
| `ceo@lrxradar.com` | lrxradar.com | employee | Professional directory placement |
| `hr-hp01@trustradar.ca` | trustradar.ca | honeypot | Future honeypot site page |
| `dev-gp01@trustradar.ca` | trustradar.ca | github | GitHub repo README/issues |

**Detection baseline (parallel work):** Add a `phishing_pattern_signals` table to start fingerprinting catches from day one. Every inbound catch gets analyzed for AI-generation markers: unusual fluency consistency, template structure patterns, URL obfuscation techniques, header anomalies, sender infrastructure fingerprints. This data feeds the detection model later — the earlier we start collecting, the better the training set.

**Success criteria:** At least 1 catch within 2-4 weeks. Full pipeline validated end-to-end.

---

## Step 3: Honeypot Site Generator (1-2 Weeks)

### 3A. Throwaway Domains

Buy 3-5 cheap domains via Cloudflare Registrar (`.xyz`, `.online`, `.site` — under $2/yr each). Each looks like a real small business:

- `novaridge-consulting.xyz` (consulting firm)
- `clearpoint-dental.online` (dental practice)
- `pacificedge-logistics.site` (logistics company)
- `westfield-properties.xyz` (real estate)

DNS on Cloudflare. WHOIS contacts set to unique trap addresses (3 per domain: registrant, admin, tech = 9-15 WHOIS seeds across all domains).

### 3B. Multi-Domain Honeypot Worker

A single CF Worker that serves all honeypot domains. Architecture:

```
Request → Worker reads hostname → KV lookup → Serve matching site HTML
```

- Worker checks `request.headers.get('host')` to determine which site to serve
- Site HTML stored in KV keyed by hostname (e.g. `site:novaridge-consulting.xyz`)
- Single `wrangler.toml` with all honeypot domains listed as custom domains (or routes)
- Fallback: 404 for unknown hostnames

This keeps deployment simple — one Worker, one deploy, all domains.

### 3C. Haiku Site Generation

A Haiku agent generates realistic single-page business sites per domain. Each site includes:

- Business name, tagline, about section
- Contact page with trap addresses in raw HTML (`<a href="mailto:...">`) — NOT JS-rendered
- Staff directory with 3-5 fake names + email addresses
- `schema.org/LocalBusiness` JSON-LD structured data with email field
- `/sitemap.xml` for search engine indexing
- `<!-- HTML comments -->` containing additional trap addresses (some harvesters scrape comments)
- Varied structure per site — no single template pattern for harvesters to fingerprint

Generated HTML stored in KV. Regenerated periodically (monthly) to keep sites fresh.

### 3D. Detection Pattern Collection (Parallel)

As catches come in from honeypot seeds, the spam trap handler feeds the `phishing_pattern_signals` table. Start identifying:

- AI-generated content markers (fluency, structure, vocabulary patterns)
- Phishing page construction patterns (URL structures, redirect chains, hosting fingerprints)
- Sender infrastructure clustering (shared IPs, ASNs, mail server configs across campaigns)
- Brand impersonation techniques (how attackers mimic specific brands)

This runs passively — no separate model needed yet, just structured data collection.

---

## Step 4: Seed Distribution Agent (1-2 Weeks)

Automated CF Worker on a cron (runs every 3-4 days) that places ~20-30 seeds per week across channels.

### 4A. Channel Modules (Build Sequentially)

**Priority order based on expected yield:**

1. **Paste sites** — Generate fake "leaked contact lists" with trap addresses mixed into plausible filler. Harvesters scrape paste sites aggressively. Highest expected velocity.
2. **Business directories** — Submit honeypot businesses to free directories (Yelp, Yellow Pages, industry directories). Slow burn, steady yield.
3. **Forum profiles** — Accounts on high-traffic forums with trap emails in profile fields/signatures. Medium yield.
4. **GitHub** — Repos with trap emails in READMEs/issues. GitHub is heavily crawled. Worth testing.

Build and measure one channel at a time before adding the next.

### 4B. Persona Generation (Haiku-Powered)

Each seed batch gets fresh personas:
- Realistic names (varied demographics)
- Role-appropriate titles (CEO, Office Manager, Head of Sales, Billing Dept)
- Business-appropriate email formats (`firstname@domain`, `role@domain`)
- Consistent persona across all channels for a given "business"
- Stored as metadata in `seed_addresses`

### 4C. Pacing & Anti-Detection

- **Target pace:** 20-30 new seeds/week, spread across channels
- Stagger placements over 3-4 days (not all at once)
- Rotate throwaway domains every 3-6 months
- Vary honeypot site HTML per regeneration cycle
- Mix trap addresses into realistic datasets (90% filler, 10% trap)
- Never reuse domain naming patterns

---

## Step 5: Yield Analytics + AI Feedback Loop (After 4+ Weeks of Data)

### 5A. Yield Analytics Cron (Weekly)

Scheduled Worker that aggregates and scores:
- Catches per seed, per channel, per domain, per campaign
- Catch rate (catches/seed/week)
- Time-to-first-catch per channel
- Phishing vs bulk spam ratio
- Unique sender/IP count
- Dead seeds (placed > 6 weeks, zero catches)

Results written to `seed_channel_analytics` table or extended into `spam_trap_daily_stats`.

### 5B. Orchestrator Agent (Haiku, Weekly Cron)

Reads analytics, outputs a `seed_campaign_plan` to D1:

- **Amplify winners:** High catch-rate channels get more seeds. High-yield persona roles (e.g. `billing@`) get prioritized. Best-performing TLD patterns get more domains.
- **Prune losers:** Dead seeds after 6 weeks → mark inactive. Consistently low-yield channels → reduce or drop.
- **Novelty injection:** 1-2 new experimental channels/strategies per cycle. Tracked separately to measure against baseline.
- **Output:** JSON plan specifying seed count, channel allocation, domain targets, persona types. Distribution agent reads and executes.

### 5C. Platform Integration

- **Analyst agent:** Cross-references caught sender domains against threat database. Auto-escalate if phishing domain impersonates a monitored brand.
- **Observer daily briefing:** Includes trap stats — new catches, phishing attempts, top sender domains, channel performance summary.
- **Email Security Engine correlation:** Domain sends spam to traps AND has F/D-grade posture → strong escalation signal.
- **Threat feed:** High-confidence phishing domains from traps → entries in the threat intelligence pipeline.

### 5D. AI Phishing Detection Model (Built on Pattern Data from Steps 2-4)

By this point, `phishing_pattern_signals` has 4-6 weeks of structured catch data. Build the detection layer:

- Classify incoming catches as human-crafted vs AI-generated based on collected pattern signals
- Identify AI-crafted phishing page patterns (template reuse, URL generation patterns, hosting clusters)
- Detect AI-driven attack campaign patterns (coordination signals, timing patterns, infrastructure reuse)
- Surface to users: "Trust Radar detects AI-generated threats that traditional signature-based tools miss"

---

## Execution Timeline

```
Step 1: Domain config              → Now (minutes)
Step 2: Manual seeds + detection   → Now (1-2 hours)
        table
Step 3: Honeypot generator         → Next (1-2 weeks)
        + pattern collection
Step 4: Distribution agent         → After Step 3 (1-2 weeks)
Step 5: Feedback loop +            → After 4+ weeks of catch data
        AI detection model

Total: ~6-8 weeks to full autonomous operation
```

Steps 1-2 require minimal new code. Step 3 is the first significant build. Detection pattern collection runs passively from Step 2 onward, compounding data the entire time.

---

## Cost Impact

- Throwaway domains: ~$2/yr each × 5 = $10/yr
- Honeypot Worker: free tier (low traffic)
- KV storage for site HTML: negligible
- Haiku agent calls: pennies per generation
- Email body storage (forever retention): D1 row size grows over time — monitor quarterly, consider R2 offload for bodies if D1 hits limits
- **Total additional cost: under $2/month on top of existing ~$22/month budget**
