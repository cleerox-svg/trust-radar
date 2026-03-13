# Trust Radar v2 — Platform Plan

**Document type:** Strategic & Technical Blueprint  
**Date:** March 13, 2026  
**Status:** Fresh start — foundational plan

---

## 1. Core Identity

Trust Radar is an **outside-in threat intelligence observatory**. It does not wait for a client. It watches the internet's attack surface continuously, ingests free and open data feeds, correlates signals with AI, and surfaces what matters — which brands are being hit, how, from where, and how that landscape is shifting over time.

The value proposition is inverted from traditional brand protection (Bolster, Netcraft, etc.):

- **They** wait for a brand to hire them, then start monitoring.
- **We** already know who's getting hit, have the intelligence mapped, and arrive with a remediation-ready posture before the brand even knows they need us.

This is the gap. Nobody is doing comprehensive outside-in reconnaissance at this scale with AI-driven correlation and trend analysis.

---

## 2. What We're Keeping

These are proven, paid-for, and working. No reason to rebuild them.

| Layer | Technology | Notes |
|-------|-----------|-------|
| Compute | Cloudflare Workers | Edge-first, low latency, scales to zero |
| Database | Cloudflare D1 (SQLite) | Primary data store, structured queries |
| Storage | Cloudflare R2 | Raw feed snapshots, evidence archives |
| DNS/CDN | Cloudflare | Already configured for lrxradar.com |
| Intelligence | Cloudflare Radar + Intel APIs | Free domain rankings, URL scanner, passive DNS, ASN intel |
| Backend API | FastAPI on Railway | Trust scoring engine, AI orchestration |
| AI | Claude Haiku | Analysis, classification, correlation |

Everything above this line stays. Everything below is new.

---

## 3. Data Ingestion Layer

The platform lives or dies on its feeds. We start with free, high-quality, publicly available sources and build outward.

### Phase 1 — Free Feeds (MVP)

**Certificate Transparency Logs**  
This is the single richest free source for catching impersonation and typosquatting in near real-time. Every SSL certificate issued gets logged publicly. We watch for certificates that look like known brands — misspellings, homoglyphs, lookalike domains.

- Source: Google CT API, crt.sh
- Signal: New certs for domains resembling top brands
- Volume: High — needs filtering pipeline
- Update frequency: Streaming / polling every 5 minutes

**PhishTank**  
Community-verified phishing URLs. Already classified, already vetted.

- Source: PhishTank API (free tier)
- Signal: Confirmed phishing pages, target brand, URL, status
- Update frequency: Hourly batches

**URLhaus (abuse.ch)**  
Malware distribution URLs. Overlaps with phishing infrastructure and reveals hosting patterns.

- Source: abuse.ch API
- Signal: Malicious URLs, hosting provider, first seen, status
- Update frequency: Every 5 minutes

**OpenPhish**  
Automated phishing intelligence feed. Complements PhishTank with different detection methodology.

- Source: OpenPhish community feed
- Signal: Phishing URLs with target brand identification
- Update frequency: Every 12 hours

**WHOIS / RDAP**  
Registration data for suspicious domains. Reveals registrar patterns, creation dates, registrant info (where available).

- Source: RDAP protocol (replacing WHOIS)
- Signal: Domain age, registrar, nameservers, registration patterns
- Update frequency: On-demand enrichment for flagged domains

**DNS Passive Observation**  
Resolve flagged domains to IPs, map IP to hosting provider (ASN), track IP reuse across campaigns.

- Source: DNS resolution + IP-to-ASN mapping (free via Team Cymru, IPinfo lite)
- Signal: Hosting provider identification, IP clustering
- Update frequency: On-demand enrichment

### Phase 2 — Provider & Platform Intelligence Feeds (Post-MVP)

This is where Trust Radar gets unfair advantages. Major infrastructure providers publish threat data — some free, some freemium — that most brand protection tools ignore because they're built to watch one brand, not the ecosystem.

**Cloudflare (our own infrastructure provider — home field advantage)**

We're already on Cloudflare. Several of their intelligence APIs are available to account holders:

*Cloudflare Radar API (free, CC BY-NC 4.0 license)*
- Domain popularity rankings: Top 1M domains updated weekly, ordered and bucketed. Useful for identifying when a brand drops or when a suspicious domain suddenly gains traffic rank.
- Email security summaries: Aggregate data on DMARC, SPF, DKIM validation rates, spam/spoof/malicious classification distributions across Cloudflare's email traffic. Sector-level trend data for how email auth is performing globally.
- Attack trends: DDoS attack data by industry, geography, protocol. Shows which sectors are under heaviest attack pressure.
- ASN intelligence: Traffic data per autonomous system — useful for correlating with our hosting provider tracking.
- API endpoint: `api.cloudflare.com/client/v4/radar/` — free with API token.

*Cloudflare URL Scanner (free with account)*
- Submit any URL for analysis. Returns: maliciousness verdict, technologies detected (via Wappalyzer), redirect chain, page screenshot hashes, DOM structure hash, SSL details, hosting ASN, and Radar popularity rank.
- DOM structure hash and screenshot hash enable searching for sites with similar layouts — powerful for detecting phishing kit reuse across different domains.
- API endpoint: `api.cloudflare.com/client/v4/accounts/{id}/urlscanner/`

*Cloudflare Security Center Intel APIs (free with account)*
- Domain intelligence: category, risk score, associated IPs
- Passive DNS: historical domain-to-IP resolution data
- ASN overview: owner, country, type
- Domain history: changes over time
- API endpoint: `api.cloudflare.com/client/v4/accounts/{id}/intel/`

*Cloudflare DDoS Botnet Threat Feed (free for service providers)*
- Lists IPs within a given ASN that participated in HTTP DDoS attacks as observed by Cloudflare. Over 600 organizations already signed up. Useful for identifying compromised infrastructure and cross-referencing with our hosting provider data.

*Cloudforce One (paid — future consideration)*
- Finished threat intelligence via STIX/TAXII feeds. Brand and phishing protection. On-demand threat research. Worth evaluating once revenue is flowing.

**Google / VirusTotal (free tier)**

- Free community API: lookup any file hash, domain, IP, or URL against 70+ antivirus engines and threat feeds. Rate-limited but functional for on-demand enrichment.
- Passive DNS resolutions, WHOIS data, historical SSL certificates, and community comments on any domain or IP.
- Google Threat Intelligence (GTI) extends VirusTotal with Mandiant research and Google's own telemetry. Paid tiers add IoC streams and YARA-based livehunt — valuable for Phase 3 when budget allows.
- Particularly useful for: validating suspicious domains our CT log scanner flags, enriching threats with multi-vendor verdicts, and tracking phishing kit infrastructure via SSL cert history.

**Spamhaus (free DNS blocklists + paid advanced feeds)**

- Domain Blocklist (DBL): free via DNSBL queries. Domains with poor reputation — phishing, malware, spam, fraud. Proactive detection based on domain behavior heuristics, often catching threats before they're seen in the wild.
- DROP (Don't Route Or Peer): free text files of IP ranges controlled by spammers/cybercriminals. Direct input for our hosting provider reputation scoring.
- Exploits Blocklist (XBL): IPs of hijacked/compromised devices. Cross-reference with our threat infrastructure data.
- Advanced Threat Feeds (paid): enriched DBL with metadata (registrar, creation date, threat type, associated IPs, Spamhaus domain score), passive DNS with 2B+ records/day. Strong Phase 3 candidate for deep infrastructure mapping.

**AlienVault OTX (Open Threat Exchange — free)**

- One of the largest open threat intelligence communities. Crowdsourced IoCs: malware signatures, IP reputation, phishing domains, botnet activity.
- Structured "pulses" that group related indicators into named campaigns with context.
- API access for automated ingestion. Good supplementary feed for threat validation and campaign correlation.

**Cisco Talos (free intelligence)**

- Publicly available security advisories, malware analysis reports, and threat intelligence on active campaigns.
- IP and domain reputation lookups. Useful as a secondary validation source alongside VirusTotal.

**SANS DShield / Internet Storm Center (free)**

- Top 20 attacking IPs, top target ports, global attack trend summaries.
- Honeypot-derived data showing real-time scanning and attack patterns.
- Useful for identifying infrastructure that's actively probing the internet — cross-reference with our hosting provider data.

**GreyNoise (free community API)**

- Identifies IPs that are mass-scanning the internet (benign scanners vs. malicious). Helps separate noise from targeted attacks in our data.
- Free API: 50 lookups/day. Useful for enrichment of flagged IPs.

**Hunt.io (API with free tier)**

- Active C2 (command and control) server feeds. Real-time data on servers controlling botnets and malware.
- SSL certificate intelligence: newly discovered hostnames, recently issued certs. Complements our CT log monitoring.

**Akamai (free research data)**

- Daily domain ranking data from Akamai Cloud — independent ranking to cross-reference against Cloudflare Radar rankings.
- Security research publications on botnets, attack trends, and threat actor activity.

### Phase 3 — Premium & Specialized Feeds (Revenue-Funded)

- Cloudforce One STIX/TAXII feeds (Cloudflare's premium tier)
- Spamhaus Advanced Threat Feeds (enriched DBL, passive DNS, eXBL)
- Google Threat Intelligence paid tier (IoC streams, YARA livehunt, Mandiant research)
- DomainTools Iris (deep domain intelligence, connected infrastructure mapping)
- Newly Registered Domains (NRD) commercial feeds
- Social media monitoring (platform APIs where available)
- Dark web paste site monitoring
- BGP anomaly feeds (RIPE RIS, BGPStream)

### Feed Ingestion Architecture

```
Phase 1 (MVP)                      Phase 2 (Provider Intel)
─────────────                      ────────────────────────
[CT Logs] ──────┐                  [CF Radar] ────────┐
[PhishTank] ────┤                  [CF URL Scanner] ──┤
[URLhaus] ──────┤──→ [Ingest  ]    [CF Intel APIs] ───┤──→ [Enrichment]
[OpenPhish] ────┤    [Worker  ]    [VirusTotal] ──────┤    [Worker   ]
[WHOIS/RDAP] ───┘    [        ]    [Spamhaus DBL] ────┤    [         ]
                     │             [AlienVault OTX] ──┘    │
                     ▼                                     ▼
              [Normalize]                           [Cross-Reference]
                     │                                     │
                     ▼                                     ▼
              [D1: raw_signals] ←────────────── [D1: enriched_threats]
```

Phase 1 feeds go through the Ingest Worker: fetch, normalize, deduplicate, store. Phase 2 provider feeds are primarily used for enrichment — when a threat is flagged, we query Cloudflare's intel APIs, VirusTotal, and Spamhaus to add verdicts, reputation data, passive DNS history, and multi-vendor validation. Some Phase 2 feeds (like Cloudflare Radar domain rankings and Spamhaus DBL) also run on scheduled polling to maintain standing datasets we can query locally.

---

## 4. Data Model

### Core Tables

**brands**  
The targets. We build this list organically from what the feeds tell us, not from a client roster.

- `id`, `name`, `canonical_domain`, `sector`, `first_seen`, `threat_count`, `last_threat_seen`
- Auto-populated: When feeds identify a target brand, we either match to existing or create new
- Sector classification: AI-assigned (finance, tech, retail, healthcare, government, crypto, etc.)

**threats**  
Individual attack instances. One row per malicious URL/domain observed.

- `id`, `source_feed`, `threat_type`, `malicious_url`, `malicious_domain`, `target_brand_id`
- `hosting_provider_id`, `ip_address`, `asn`, `registrar`
- `first_seen`, `last_seen`, `status` (active/down/remediated)
- `confidence_score` (AI-assigned, 0-100)
- `campaign_id` (nullable — assigned by correlation engine)

**hosting_providers**  
Infrastructure operators. The "where" of attacks.

- `id`, `name`, `asn`, `country`
- `active_threat_count`, `total_threat_count`
- `trend_7d`, `trend_30d`, `trend_90d` (threat count deltas)
- `avg_response_time` (how fast they take down reported content)
- `reputation_score` (computed weekly)

**campaigns**  
Correlated groups of threats that share infrastructure, timing, or methodology.

- `id`, `name` (AI-generated descriptor), `first_seen`, `last_seen`
- `threat_count`, `brand_count`, `provider_count`
- `attack_pattern` (phishing kit fingerprint, template similarity, etc.)
- `status` (active/dormant/disrupted)

**daily_snapshots**  
Aggregated daily stats for trend analysis. One row per brand per day, one per provider per day.

- `date`, `entity_type` (brand/provider), `entity_id`
- `new_threats`, `active_threats`, `remediated_threats`
- `dominant_threat_type`, `dominant_hosting_provider`

**feed_status**  
Operational health tracking for each data source.

- `feed_name`, `last_successful_pull`, `last_failure`, `records_ingested_today`, `health_status`

---

## 5. AI Analysis Engine

This is where Trust Radar stops being a feed aggregator and starts being an intelligence platform. Claude Haiku handles all analysis via the FastAPI backend on Railway.

### Analysis Jobs

**Threat Classification**  
Every incoming signal gets classified: phishing, typosquatting, brand impersonation, malware distribution, credential harvesting. Haiku reads the URL structure, domain name, cert details, and any available page content to assign type and confidence.

**Brand Matching**  
When a feed doesn't explicitly name the target brand, Haiku infers it. Domain `paypa1-secure-login.com` → PayPal. `arnazon-delivery-update.net` → Amazon. Fuzzy matching plus contextual analysis.

**Campaign Correlation**  
The high-value analysis. Haiku looks across recent threats and identifies clusters:

- Same IP range or hosting provider
- Same domain registration pattern (registrar, timing, nameserver)
- Same phishing kit or page template
- Same target brand set
- Temporal clustering (burst of registrations in a 24-hour window)

When a cluster is identified, it becomes a campaign. Campaigns get named, tracked, and monitored for evolution.

**Hosting Provider Scoring**  
Weekly batch job. For each hosting provider:

- How many active threats are they hosting right now?
- What's the trend vs. last week, last month, last quarter?
- How fast do they respond to abuse reports (where we can measure)?
- Are attackers migrating toward or away from this provider?

This produces the "Provider Reputation Index" — a ranked view of which infrastructure operators are the worst (and best) actors in the ecosystem.

**Insight Generation**  
Daily and weekly synthesis. Haiku reviews the accumulated data and produces narrative intelligence:

- "Attackers targeting financial brands shifted 23% of infrastructure from Provider X to Provider Y this week"
- "New campaign detected: 47 domains registered in 6 hours targeting three crypto exchanges, all hosted on ASN 12345"
- "Brand X saw a 340% increase in typosquatting attempts this month, concentrated on .xyz and .top TLDs"

These aren't canned alerts. They're analytical observations that a human analyst would make if they had time to stare at all the data.

---

## 6. Platform UI — Implementation Specification

This section is the implementation guide for Claude Code. Every view, component, and interaction is specified here. Nothing is hardcoded — all data comes from the API Worker, all rendering is dynamic, and all components consume data via typed interfaces.

### 6.1 Design System

**Typography (Google Fonts, CDN-loaded, no build step)**

- Chakra Petch: Display font. Logo, stat values, section headers, the UTC clock, nav labels. Geometric, angular, reads like instrumentation.
- Outfit: Body font. Readable text, descriptions, insight narratives, table content. Clean modern sans-serif.
- IBM Plex Mono: Data font. ASN numbers, timestamps, percentages, threat counts, IP addresses, domain names. Anything that is a measurement or identifier.

**Color System (CSS custom properties, defined once in :root)**

| Token | Hex | Usage |
|-------|-----|-------|
| `--blue-primary` | #00d4ff | Primary accent. Borders, active states, the pulse of "the system is alive" |
| `--blue-border` | rgba(0,212,255,0.15) | Default border on panels, cards, dividers |
| `--blue-border-bright` | rgba(0,212,255,0.35) | Hover/focus border state |
| `--threat-critical` | #ff3b5c | Critical severity. Highest threat counts, active attacks |
| `--threat-high` | #ff6b35 | High severity. Significant but not critical |
| `--threat-medium` | #ffb627 | Medium severity. Moderate activity |
| `--threat-low` | #00d4ff | Low/new. Emerging threats, low volume |
| `--positive` | #00e5a0 | Improving trends, successful remediations, healthy feeds |
| `--negative` | #ff3b5c | Worsening trends, failed feeds, alerts |
| `--bg-void` | #040810 | Deepest background (map area, body) |
| `--bg-surface` | #0a1020 | Sidebar, topbar, panel backgrounds |
| `--bg-panel` | #0d1528 | Card/panel fill |
| `--bg-elevated` | #111d35 | Hover states, active nav items |
| `--text-primary` | #e8edf5 | Primary text |
| `--text-secondary` | #7a8ba8 | Labels, secondary info |
| `--text-tertiary` | #4a5a73 | Muted, hints, timestamps |

All colors are consumed via `var()` references. Dark mode is the default and only mode for the Observatory. Light mode is reserved for client-facing views (Phase 3).

**Component Conventions**

- All panels: `background: var(--bg-surface)`, `border: 1px solid var(--blue-border)`, `border-radius: 6px`
- Glass overlay panels (on map): `background: rgba(10,16,32,0.9)`, `backdrop-filter: blur(16px)`
- Panel headers: Chakra Petch, 10-11px, uppercase, letter-spacing 1.5px, with a 3px-wide cyan accent bar before the text
- All stat values: Chakra Petch, bold, 16-20px
- All data values: IBM Plex Mono, 11-13px
- Transitions: 150ms for hovers, 200ms for border/color changes
- No gradients on surfaces. No drop shadows. Flat with border hierarchy.

### 6.2 Observatory (Main Dashboard)

**Prototype file:** `prototypes/trust-radar-hud-v2.html`

**Layout: CSS Grid**

```
grid-template-rows: 52px 1fr
grid-template-columns: 1fr 372px
```

Topbar spans both columns. Map takes the left cell. Sidebar takes the right cell. Map fills 100% of its container with Leaflet.

**Topbar**

- Logo: "TRUST RADAR" in Chakra Petch, 16px, with animated pulsing dot icon
- Nav pills: Observatory (default active), Brands, Providers, Campaigns, Trends, Agents. Each is a route.
- Right side: Feed health status (green dot + "N feeds active"), LIVE tag with pulsing border, user avatar circle with initials and role indicator

All nav state is URL-driven. Clicking a pill changes the route and swaps the main content area. Sidebar adapts to the active view.

**The Map — Leaflet.js + CartoDB Dark Tiles + Dynamic Data**

Stack: Leaflet 1.9.4, leaflet.heat 0.2.0, CartoDB dark_all basemap tiles. All CDN-loaded.

```
Map initialization:
- L.map with zoomControl: false (custom controls), attributionControl: false
- Tile layer: https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
- Default view: [25, 10], zoom 2.5
- Custom zoom buttons overlaid on map (glass style)
```

**CRITICAL: All map data is fetched from the API, never hardcoded.**

The API Worker exposes these endpoints for map data:

`GET /api/v1/threats/geo-clusters`
Returns: Array of `{ lat, lng, country, country_code, threat_count, brands_targeted, top_threat_type, provider_count, intensity }` — one entry per country with active threats. Intensity is pre-calculated (0-1) based on threat_count relative to the global max.

`GET /api/v1/threats/attack-flows`
Returns: Array of `{ origin_country, origin_lat, origin_lng, target_country, target_lat, target_lng, volume, threat_type, threat_count }` — one entry per active origin→target attack corridor. Volume is normalized 1-10.

`GET /api/v1/dashboard/stats`
Returns: `{ active_threats, threats_24h, brands_tracked, brands_new, providers_tracked, providers_delta, active_campaigns, campaigns_new, feed_health: { active, degraded, down } }`

`GET /api/v1/dashboard/top-brands?period=24h&limit=10`
Returns: Array of `{ brand_id, name, sector, threat_count, trend_pct }`

`GET /api/v1/dashboard/providers?sort=worst&limit=5`
Returns: Array of `{ provider_id, name, asn, threat_count, trend_7d_pct, status: 'bad'|'degrading'|'improving' }`

`GET /api/v1/dashboard/providers?sort=improving&limit=3`
Same shape, filtered to improving providers.

`GET /api/v1/insights/latest?limit=5`
Returns: Array of `{ id, agent_name, severity, summary_text, created_at, related_brand_ids, related_campaign_id }`

**Map Layers (rendered in this order, bottom to top)**

1. CartoDB dark tiles (base)
2. Heatmap layer (`L.heatLayer`) — generated from geo-cluster data. Each cluster spawns scattered points for realistic heat. Gradient: `{ 0.0: '#040810', 0.2: '#003366', 0.4: '#005f7a', 0.5: '#0091b3', 0.6: '#00d4ff', 0.75: '#ffb627', 0.85: '#ff6b35', 1.0: '#ff3b5c' }`
3. Attack flow arcs (canvas overlay) — see Arc System below
4. Threat cluster markers (`L.circleMarker`) — outer ring (low opacity, sized by threat_count) + inner core (high opacity). Color by intensity tier.

**Arc System — Canvas Overlay for Attack Flows**

This is a custom `L.Layer` extension that renders on an HTML canvas positioned over the Leaflet map. It does NOT use any Leaflet polyline or SVG — pure canvas for 60fps performance.

Each attack flow from the API gets rendered as:

- A Bezier curve from origin to target. Control point offset perpendicular to the midpoint, curvature scaled by distance (max 120px).
- Base stroke: flow color at 15% opacity, width = volume * 0.22
- Inner stroke: flow color at 35% opacity, width = base * 0.5
- Arrowhead at the destination (target brand country): two angled lines from the tip, length scaled by volume.
- Diamond marker at origin (where the attack comes from)
- Crosshair marker at target (where the brand lives)

**Directional Particles**

Each arc has `ceil(volume * 0.8)` continuously looping particles, plus burst particles fired on live events.

Particle rendering (per frame):
1. Outer glow: circle at particle position, color at 15% opacity, radius = size + 3
2. Core: circle at particle position, color at 85% opacity, radius = size
3. Bright center: white circle at 70% opacity, radius = size * 0.4
4. Trail: short Bezier segment behind the particle, gradient from transparent to 50% color

Particles travel from origin (t=0) to target (t=1) at varying speeds. On reaching t>1.05, they reset to t=-0.05 for seamless looping.

Burst particles (fired on live events): 3 particles, faster speed (0.008-0.012), larger size, die after one traversal (no loop).

**Color encoding for arcs:**

- volume >= 8: `#ff3b5c` (critical — red)
- volume >= 5: `#ff6b35` (high — orange)
- volume >= 3: `#ffb627` (medium — amber)
- volume < 3: `#00d4ff` (low — cyan)

The canvas redraws on every `requestAnimationFrame`. It calls `_reset()` on map move/zoom/resize to reposition. All lat/lng→pixel conversions happen via `map.latLngToContainerPoint()` each frame so arcs track correctly during pan/zoom.

**HUD Overlay Elements (absolute positioned on map container)**

- Corner brackets: 2px cyan borders on each corner (32px × 32px), pure CSS
- Scan line: 1px horizontal line sweeping top to bottom (10s cycle), CSS animation
- UTC clock: top-right, IBM Plex Mono 20px, updates every second via `setInterval`
- Severity legend: bottom-right, shows color dots with labels for threat volume tiers + arc origin/target symbols
- Country tooltip: top-left, appears on marker hover, shows country name + threat count + brands + type + providers. Hidden by default, toggled via `.visible` class.

**Bottom Stat Bar (glass overlay on map)**

Four stat chips spanning the bottom of the map. Each chip:
- Icon (colored background square with symbol)
- Value (Chakra Petch, 18px, bold) + Label (Outfit, 10px, secondary)
- Trend badge (mono, 10px, red bg for up / green bg for down)

All four chips consume data from `/api/v1/dashboard/stats`. Values refresh on a polling interval (30 seconds) or via WebSocket push in future.

**Sidebar (right, 372px)**

Three panels stacked vertically, each consuming a different API endpoint:

Panel 1 — "Top targeted brands": Fetch from `/dashboard/top-brands`. Render as a ranked list. Each row: rank number, brand icon (initials, colored by severity tier), brand name + sector, threat count + "threats" label. Click → navigate to Brand Detail view.

Panel 2 — "Worst hosting providers" + "Improving": Fetch from `/dashboard/providers?sort=worst` and `?sort=improving`. Worst providers have red/orange status dots. Improving have green dots. Separated by a labeled divider line. Each row: status dot, provider name + ASN, threat count + trend percentage. Click → navigate to Provider Detail view.

Panel 3 — "Agent intelligence": Fetch from `/insights/latest`. Each insight card: agent name (Strategist, Cartographer, etc.), timestamp, narrative text with bold highlights, severity badge (critical/high/medium/info). Click → navigate to insight detail or related campaign/brand.

**Live Updates**

The map spawns simulated threat events — but in production this is driven by real data:

`GET /api/v1/threats/recent?since={timestamp}&limit=10`
Returns new threats since the last poll. Each new threat triggers:
1. A cyan `L.circleMarker` flash at the threat's lat/lng that expands and fades (12 frames)
2. If the threat matches an existing attack flow corridor, a burst of 3 particles fires on that arc
3. The stat bar threat count increments
4. The sidebar brand/provider lists re-sort if rankings changed

Polling interval: 15 seconds for MVP. WebSocket upgrade in Phase 2.

### 6.3 Brands Hub

**Prototype file:** `prototypes/trust-radar-brands-tab.html` (includes Brand Detail)

Route: `/brands`

The Brands tab is a dynamic intelligence hub, not a static list. It has three sub-tabs that organize brands by context: what's under heaviest fire right now (auto-generated), what we're proactively watching (admin-curated), and the full catalog.

**Sub-tab navigation:**

Three tabs below the main nav, rendered dynamically:

- **Top Targeted** (default) — Auto-populated from feed data. Ranked by threat count. This tab IS the intelligence — it tells you at a glance which brands are under the heaviest attack right now. The list re-ranks as new threats come in.
- **Monitored** — Admin-curated watchlist of brands to proactively track. These can be brands already in the threat data OR brands added proactively before any attacks are detected. This is the precursor to paid client onboarding — you're pre-watching brands before they know they need you.
- **All Brands** — The full searchable, filterable catalog of every brand Trust Radar has ever seen in its feeds.

**API endpoints:**

- `GET /api/v1/brands/top-targeted?period=24h&limit=20` — ranked by active threat count in period. Returns: `{ brands: [{ brand_id, name, sector, canonical_domain, threat_count, trend_pct, top_threat_type, rising: boolean }] }`
- `GET /api/v1/brands/monitored` — all monitored brands for the current user's tenant (or all if internal). Returns: `{ brands: [{ brand_id, name, sector, canonical_domain, threat_count, status: 'active'|'clean'|'new', monitored_since, added_by }] }`
- `GET /api/v1/brands?search=&sector=&sort=threat_count&limit=50&offset=0` — full catalog with search, sector filter, sort, pagination
- `POST /api/v1/brands/monitor` — add a brand to the monitored list. Body: `{ domain, name (optional), sector (optional) }`. If the domain isn't already tracked, the system creates a new brand record and queues it for proactive scanning.
- `DELETE /api/v1/brands/monitor/:brand_id` — remove from monitored list (doesn't delete the brand, just stops proactive monitoring)

**Top Targeted layout:**

A ranked grid of brand cards. Each card shows:

- Rank badge (1, 2, 3... with special gold/silver/bronze treatment for top 3)
- Brand icon (initials, colored by threat severity tier)
- Brand name and sector
- Threat count (large, prominently displayed)
- Sparkline showing 7-day trend (inline mini chart)
- Trend indicator: percentage up/down with arrow
- "Rising" badge: if threat count increased >30% in the last 24h, a pulsing badge flags it
- Top threat type pill (phishing, typosquat, etc.)

Cards are clickable → navigates to Brand Detail view (`/brands/:brand_id`).

The top of the page shows aggregate metrics:
- Total brands being targeted (across all feeds)
- New brands detected this week
- Fastest-rising brand (biggest 24h spike)
- Most common threat type across all brands

Period selector: 24h / 7d / 30d changes the ranking window.

**Monitored layout:**

A curated list with a different feel — less ranked competition, more operational watchlist.

Top action bar:
- "Add Brand" button (opens modal) — Admin+ only
- Search within monitored list
- Filter by status: All / Active Threats / Clean / Newly Added

Each monitored brand row shows:
- Brand icon and name
- Domain
- Sector (AI-assigned if not manually set)
- Threat count (0 if clean — which is good news, that's the point of proactive monitoring)
- Status badge: "Active Threats" (red), "Clean" (green — no threats detected), "New" (cyan — recently added, initial scan pending)
- Monitored since date
- Added by (which admin)
- Actions: View Detail, Remove from Monitoring

**"Add Brand" modal:**

- Domain input (required): The canonical domain to monitor (e.g., `acmecorp.com`)
- Brand name (optional): If not provided, the system infers it from the domain
- Sector (optional): Dropdown or AI-assigned after initial scan
- Notes (optional): Why this brand is being monitored ("Prospect", "Competitor", "Client request")

On submit:
1. System validates the domain is a real registerable domain
2. Checks if the brand already exists in the database — if yes, just adds to monitored list
3. If new: creates a brand record, runs an immediate Brand Assessment scan (same engine as the public tool), and queues the domain for CT log monitoring + feed matching
4. The brand appears immediately in the Monitored tab with "New" status
5. Within minutes, the initial assessment populates threat_count and trust_score

This is how proactive monitoring works — the admin adds a brand BEFORE it's attacked, and Trust Radar starts watching CT logs for lookalike domains, checking feeds for any existing threats, and running the assessment engine to establish a baseline. If/when attacks appear, the brand card flips from "Clean" to "Active Threats" and the alert rules fire.

**All Brands layout:**

Full-width table view:
- Search bar (searches name and domain)
- Sector filter dropdown
- Sort by: Threat Count, Name, First Seen, Last Activity
- Columns: Brand (icon + name + domain), Sector, Threat Count, Trend (7d), Top Threat Type, First Seen, Last Activity, Monitored (star icon — filled if monitored, empty if not, clickable to toggle)

Pagination: 50 per page.

The star toggle on each row lets an admin quickly add/remove brands from the Monitored list without leaving the table — a fast bulk-curation workflow.

**Data model additions:**

**monitored_brands**

- `brand_id` (references brands.id)
- `tenant_id` (nullable — null = internal monitoring)
- `added_by` (references users.id)
- `added_at`
- `notes` (text)
- `status` (enum: `active`, `clean`, `new`, `removed`)
- `removed_at` (nullable)

This is separate from `tenant_brands` (Section 18) — `monitored_brands` is the internal watchlist; `tenant_brands` is the client relationship. A brand can be monitored without being a client's brand, and vice versa.

### 6.4 Brand Detail View

Route: `/brands/:brand_id`

Accessed by clicking any brand card (Top Targeted), brand row (Monitored or All Brands), or brand reference anywhere in the platform. The detail view renders inside the Brands tab — it does not navigate to a separate page. A "Back to Brands" breadcrumb returns to the hub with the previously active sub-tab preserved.

**CRITICAL: No brand data is hardcoded anywhere in the UI.**

Every brand name, domain, sector, threat count, threat URL, provider name, campaign name, timeline data point, and map coordinate comes from the API. The UI is a rendering engine — it receives typed JSON and renders components. When Claude Code implements this:

- Brand metadata: fetched via `GET /api/v1/brands/:id`
- Threats table rows: fetched via `GET /api/v1/brands/:id/threats?status=active&limit=15&offset=0`
- Map markers: fetched via `GET /api/v1/brands/:id/threats/locations` (returns `[{ lat, lng, country, count }]`)
- Provider bars: fetched via `GET /api/v1/brands/:id/providers` (returns `[{ name, asn, count, pct, trend }]`)
- Campaign cards: fetched via `GET /api/v1/brands/:id/campaigns` (returns `[{ id, name, threat_count, brand_count, first_seen, status }]`)
- Timeline chart: fetched via `GET /api/v1/brands/:id/threats/timeline?period=30d` (returns `{ labels: [...], values: [...] }`)

If the API returns an empty array for any section, the UI shows an empty state ("No active threats detected" / "No campaigns associated") — never a broken layout.

The same component code renders for PayPal, for Coinbase, for a brand with zero threats, and for a brand just added to monitoring. No conditional logic references specific brand names.

**API endpoints:**

- `GET /api/v1/brands/:id` — brand metadata (name, sector, canonical_domain, first_seen, threat_count, trend_pct, trust_score, trust_grade)
- `GET /api/v1/brands/:id/threats?status=active&type=all&limit=15&offset=0` — paginated active threats with type filter
- `GET /api/v1/brands/:id/threats/locations` — geo-aggregated threat locations for mini map
- `GET /api/v1/brands/:id/threats/timeline?period=30d` — daily threat counts for charting
- `GET /api/v1/brands/:id/providers` — providers hosting threats against this brand, with counts and percentages
- `GET /api/v1/brands/:id/campaigns` — campaigns targeting this brand

**Layout:**

- Top: Brand header (name, sector, domain, first tracked date, four stat blocks: threat count, trend, provider count, campaign count). Trust Score ring gauge on the right.
- Content grid (two columns):
  - Left (wide): Active Threats table — sortable, filterable by type, paginated. Columns: malicious URL, threat type pill, hosting provider + ASN, first seen, status badge, evidence indicator.
  - Right (360px): Mini map (Leaflet, CartoDB dark tiles, showing only this brand's threat locations as sized/colored markers). Below: Provider breakdown (horizontal bars with percentage fill, colored by severity). Below: Active Campaigns (cards with threat count, brand count, first seen).
- Bottom (full-width): Threat Timeline — Chart.js line chart, period selector (7d/30d/90d/1y).

### 6.5 Providers Hub

**Prototype file:** `prototypes/trust-radar-providers-tab.html` (includes Provider Detail)

Route: `/providers`

The Providers tab is the infrastructure intelligence view — which hosting providers are enabling attacks and how the landscape is shifting. Like the Brands Hub, it uses dynamic sub-tabs.

**Sub-tab navigation:**

- **Worst Actors** (default) — Ranked by active threat count, filtered to providers with upward or flat trends. These are the infrastructure operators currently hosting the most attack infrastructure.
- **Improving** — Providers whose threat counts are decreasing. Either they're responding to abuse reports faster, or attackers are migrating away. This is positive signal — and it's intelligence nobody else tracks.
- **All Providers** — Full searchable catalog of every hosting provider Trust Radar has mapped.

**CRITICAL: No provider data is hardcoded. All provider names, ASNs, countries, threat counts, trends, and associated brands come from the API.**

**API endpoints:**

- `GET /api/v1/providers/worst?period=7d&limit=20` — ranked by threat count, upward/flat trend. Returns: `[{ provider_id, name, asn, country, threat_count, trend_7d_pct, trend_30d_pct, top_brand_targeted, reputation_score, avg_response_time_hours }]`
- `GET /api/v1/providers/improving?period=7d&limit=10` — providers with decreasing threat counts. Same shape.
- `GET /api/v1/providers?search=&country=&sort=threat_count&limit=50&offset=0` — full catalog
- `GET /api/v1/providers/stats` — aggregate: `{ total_tracked, worst_this_week, most_improved, avg_response_time }`

**Worst Actors layout:**

Ranked cards (same grid pattern as Brands Top Targeted). Each card:
- Rank badge with severity coloring
- Provider name, ASN badge, country flag/code
- Threat count (large) with severity color
- 7-day sparkline + trend percentage
- Reputation score gauge (0-100, lower is worse)
- Top targeted brand through this provider
- Average abuse response time (if available)

**Improving layout:**

Cards with green-tinted styling. Each shows:
- Provider name, ASN, country
- Threat count with downward trend (green)
- Improvement delta ("−34% this week")
- Sparkline trending downward
- Reputation score (improving)

**All Providers table:**

Columns: Provider Name, ASN, Country, Active Threats, 7d Trend, 30d Trend, Reputation Score, Avg Response Time, Top Brand Targeted

### 6.6 Provider Detail View

Route: `/providers/:provider_id`

Accessed by clicking any provider card or row. Renders inside the Providers tab with "Back to Providers" navigation.

**CRITICAL: No provider data is hardcoded. Same dynamic rendering principle as Brand Detail.**

**API endpoints:**

- `GET /api/v1/providers/:id` — metadata (name, ASN, country, threat_count, trend_7d_pct, trend_30d_pct, reputation_score, avg_response_time_hours)
- `GET /api/v1/providers/:id/threats?limit=15&offset=0` — threats hosted by this provider, paginated
- `GET /api/v1/providers/:id/brands` — brands being attacked via this provider: `[{ brand_id, name, sector, threat_count, pct }]`
- `GET /api/v1/providers/:id/timeline?period=90d` — daily threat counts for charting
- `GET /api/v1/providers/:id/locations` — geo-aggregated locations of threats hosted

**Layout:**

- Top: Provider header — name, ASN badge, country, four stat blocks (active threats, 7d trend, 30d trend, avg response time). Reputation Score gauge (0-100, circular, color: red for low scores, green for high).
- Content grid (two columns):
  - Left (wide): Threats table — same columns as Brand Detail (malicious URL, type, target brand, first seen, status, evidence). Sortable, filterable, paginated.
  - Right (360px): Mini map showing where this provider's hosted threats are targeting. Below: Brand breakdown (horizontal bars — which brands are being attacked via this provider, with counts and percentages). Below: AI assessment card (Cartographer's latest insight about this provider).
- Bottom (full-width): Trend Timeline — Chart.js with 7d, 30d, and 90d lines overlaid for trend comparison. This is the view that answers "is this provider getting better or worse over time?"

### 6.7 Campaigns Hub & Campaign Detail

**Prototype file:** `prototypes/trust-radar-campaigns-tab.html` (includes Campaign Detail)

Route: `/campaigns` (hub), `/campaigns/:campaign_id` (detail)

Campaigns are correlated clusters of threats that share infrastructure, timing, or methodology. This is the highest-value intelligence Trust Radar produces — it reveals the threat actor's playbook, not just individual attacks.

**CRITICAL: No campaign data is hardcoded. Campaign names, threat counts, infrastructure details, and AI assessments all come from the API.**

**Hub sub-tabs:**

- **Active** (default) — Campaigns currently in progress (new threats still appearing)
- **Dormant** — Campaigns with no new activity in 7+ days but not fully remediated
- **Disrupted** — Campaigns where all associated threats are down/remediated

**Hub API endpoints:**

- `GET /api/v1/campaigns?status=active&limit=20` — active campaigns ranked by threat count
- `GET /api/v1/campaigns?status=dormant&limit=20`
- `GET /api/v1/campaigns?status=disrupted&limit=20`
- `GET /api/v1/campaigns/stats` — `{ active_count, dormant_count, disrupted_count, total_threats_in_campaigns, brands_affected }`

**Hub layout:**

Campaign cards (larger than brand/provider cards — campaigns have more context). Each card:
- Campaign name (AI-generated descriptor)
- Status badge (Active with pulsing dot / Dormant / Disrupted with checkmark)
- Threat count, brand count, provider count
- First seen / last activity dates
- Severity assessment (Critical / High / Medium) based on AI analysis
- Top targeted brands (up to 3 icons)
- Top infrastructure (providers/ASNs involved)
- Activity sparkline (7-day threat volume)

**Detail API endpoints:**

- `GET /api/v1/campaigns/:id` — metadata: name, description, status, first_seen, last_seen, severity, ai_assessment
- `GET /api/v1/campaigns/:id/threats?limit=15&offset=0` — associated threats, paginated
- `GET /api/v1/campaigns/:id/infrastructure` — `{ domains: [...], ips: [...], providers: [...], registrars: [...] }` — the full infra footprint
- `GET /api/v1/campaigns/:id/brands` — targeted brands with per-brand threat counts
- `GET /api/v1/campaigns/:id/timeline?period=30d` — campaign activity over time

**Detail layout:**

- Top: Campaign header — name, status badge, severity, first/last seen, threat/brand/provider counts
- AI Assessment panel (full-width) — Strategist's analysis: campaign description, sophistication level (Automated/Semi-automated/Manual), likely actor profile, attack methodology, shared indicators
- Content grid (two columns):
  - Left: Infrastructure map — a visual showing the relationships between domains, IPs, and providers. Rendered as a force-directed graph or structured tree using SVG/Canvas. Domains link to IPs, IPs link to providers. Shared infrastructure is highlighted.
  - Right top: Targeted Brands — list with per-brand threat counts and percentage bars
  - Right bottom: Infrastructure stats — registrar breakdown, TLD distribution, IP range clustering
- Below: Threats table — same columns as Brand Detail but with both target brand and provider columns
- Bottom: Activity Timeline — Chart.js showing daily threat volume with markers for key events (first seen, peak, last activity)

### 6.8 Trend Explorer

**Prototype file:** `prototypes/trust-radar-trends-tab.html`

Route: `/trends`

The time-series analysis view. This is where the week-over-week, month-over-month story lives. Every chart is dynamic — the user selects what to look at, and the data loads from the API.

**CRITICAL: No trend data is hardcoded. All chart data comes from API endpoints with parameterized queries.**

**API endpoints:**

- `GET /api/v1/trends/brands?period=90d&metric=threat_count&limit=10` — top brands by selected metric over time. Returns: `{ labels: [...dates], series: [{ name, values: [...] }] }`
- `GET /api/v1/trends/providers?period=90d&metric=threat_count&limit=10` — same shape for providers
- `GET /api/v1/trends/tlds?period=90d` — TLD distribution over time: `{ labels: [...dates], series: [{ tld, values: [...] }] }`
- `GET /api/v1/trends/types?period=90d` — threat type distribution over time
- `GET /api/v1/trends/volume?period=90d` — total threat volume over time (single series)
- `GET /api/v1/trends/compare?entities=brand:id1,provider:id2&period=90d` — overlay any two entities

**Layout:**

The Trend Explorer is a full-width analytics workspace with a control bar at top and charts below.

**Control bar:**
- Dimension selector (pills): Brands, Providers, TLDs, Threat Types, Volume
- Period selector: 7d, 30d, 90d, 1y
- Compare mode toggle: when enabled, shows two entity selectors for overlay comparison

**Chart area (adapts based on selected dimension):**

- Brands: Multi-line chart — top 10 brands by threat count, each a different colored line. Legend below with toggle to show/hide individual brands.
- Providers: Multi-line chart — top 10 providers, same style. Color-coded by whether they're improving (green tint) or worsening (red tint).
- TLDs: Stacked area chart — shows the proportion of threats by TLD over time (.com, .xyz, .top, .shop, etc.). Reveals when attackers pivot to new TLDs.
- Threat Types: Stacked area chart — phishing, typosquatting, impersonation, credential harvesting proportions over time.
- Volume: Single line chart with fill — total threat volume. Overlay markers for significant events (new campaign detected, major provider takedown, etc.).

**Compare mode:**
Two dropdown selectors: entity type (brand/provider) and entity name. Draws both as overlaid lines on the same chart for direct comparison. Example: "Compare PayPal threats vs Coinbase threats over 90 days."

**Headline insights (above charts):**
Four summary cards generated from the trend data:
- Biggest increase: which entity saw the largest percentage growth in the selected period
- Biggest decrease: most improved
- Emerging trend: AI-detected pattern ("crypto brands overtaking finance as primary targets")
- Volume change: total threat volume vs previous period

### 6.9 AI Agents View

**Prototype file:** `prototypes/trust-radar-agents-tab.html`

Route: `/agents`

The AI Agents are the intelligence workforce. They're not a hidden backend process — they're visible, named entities that analysts interact with. This view shows each agent's health, recent output, workload, and operational status. It's accessible from the main nav (added as a sixth pill: Observatory | Brands | Providers | Campaigns | Trends | **Agents**).

**Why this is analyst-facing, not admin-only:**

Analysts need to know: Is the Sentinel actively scanning? When did the Strategist last detect a campaign? Is the Observer's weekly trend report ready? Agent health directly affects the quality of intelligence the analyst is consuming. If an agent is degraded, the analyst should know their data may be incomplete.

Admin handles agent *configuration* (schedules, thresholds, API keys for Haiku). This view handles agent *visibility*.

**API endpoints:**

- `GET /api/v1/agents` — all agents with current status. Returns: `[{ agent_id, name, display_name, description, status: 'active'|'idle'|'degraded'|'error', last_run_at, last_output_at, jobs_24h, outputs_24h, avg_duration_ms, error_count_24h, next_scheduled_run }]`
- `GET /api/v1/agents/:id/outputs?limit=10` — recent outputs for a specific agent. Returns: `[{ id, agent_id, type: 'insight'|'classification'|'correlation'|'score'|'trend_report', summary, severity, created_at, related_entities }]`
- `GET /api/v1/agents/:id/health?period=24h` — performance metrics over time. Returns: `{ runs: [...], errors: [...], avg_duration_trend: [...] }`

**The five agents and their roles:**

| Agent | Display Name | Function | Run Frequency | Output Type |
|-------|-------------|----------|--------------|-------------|
| sentinel | Sentinel | Certificate & domain surveillance | Every 5 min (with CT log ingest) | New threat classifications |
| analyst | Analyst | Threat classification & brand matching | Every 15 min (on new signals) | Classified threats with confidence scores |
| cartographer | Cartographer | Infrastructure mapping & provider scoring | Every 6 hours + weekly deep scan | Provider reputation updates, infrastructure insights |
| strategist | Strategist | Campaign correlation & clustering | Every 6 hours | New campaign detections, campaign updates |
| observer | Observer | Trend analysis & intelligence synthesis | Daily + weekly | Daily summaries, weekly trend reports, narrative insights |

**Layout:**

Top row — five agent cards in a horizontal row, one per agent. Each card shows:
- Agent name (display name in Chakra Petch)
- One-line description of what it does
- Status indicator: green pulsing dot (active/running right now), blue dot (idle/waiting for next run), amber dot (degraded/slow), red dot (error/failed last run)
- Last output: relative time ("3m ago", "2h ago")
- 24h stats: jobs completed, outputs generated, errors
- A mini activity bar (24 segments representing each hour, shaded by activity level)

Click any agent card → expands into a detail panel below showing:

**Agent Output Feed:**
A chronological list of the agent's recent outputs. Each output shows:
- Output type badge (insight, classification, correlation, score, trend_report)
- Summary text (the actual intelligence produced)
- Severity if applicable
- Related entities (linked brands, providers, campaigns)
- Timestamp

**Agent Health Chart:**
A 24-hour timeline (Chart.js) showing:
- Run durations over time (bar chart — tall bars = slow runs, short = fast)
- Error overlay (red dots where failures occurred)
- Output count overlay (line showing outputs per hour)

**Agent Data Model:**

**agent_runs**
- `id`, `agent_id`, `started_at`, `completed_at`, `duration_ms`
- `status` (success/partial/failed), `error_message`
- `records_processed`, `outputs_generated`

**agent_outputs**
- `id`, `agent_id`, `type`, `summary`, `severity`
- `details` (JSON — the full output payload)
- `related_brand_ids` (JSON array), `related_campaign_id`, `related_provider_ids` (JSON array)
- `created_at`

These tables also power the "Agent intelligence" sidebar panel on the Observatory (Section 6.2) and the AI Assessment cards on Brand/Provider/Campaign detail views. The agents write to `agent_outputs`, and every view that shows AI insights reads from it.

---

## 7. Admin Module

The Admin Module is a separate view area accessible only to Super Admin and Admin roles. It is the control plane for the platform — user management, feed operations, lead management, and system health.

Route prefix: `/admin/*`
Access: RBAC middleware rejects any request to `/admin/*` from Analyst or Client roles.

### 7.1 Admin Navigation

The Admin Module has its own nav within the topbar (replacing the Observatory/Brands/Providers/Campaigns/Trends/Agents pills when in admin context):

- Dashboard (admin home — system overview)
- Users & Roles
- Feeds
- Leads
- API Keys
- Agent Config
- Audit Log

A "Back to Observatory" link is always visible to return to the main platform.

### 7.2 Admin Dashboard

**Prototype file:** `prototypes/trust-radar-admin-dashboard.html`

Route: `/admin`

The admin home shows system health at a glance. Not threat intelligence — operational health.

**API endpoints:**

- `GET /api/v1/admin/system-health` — overall health metrics
- `GET /api/v1/admin/feed-summary` — all feeds with last pull, record count, health
- `GET /api/v1/admin/user-summary` — user counts by role, active sessions
- `GET /api/v1/admin/lead-summary` — lead pipeline counts by status

**Layout:**

Top row — four metric cards:
- Total users (by role breakdown)
- Active feeds (healthy / degraded / down)
- Leads in pipeline (new / contacted / qualified)
- AI analysis jobs (last 24h: completed / failed / queued)

Middle row — two panels:
- Feed health timeline (Chart.js — stacked area showing records ingested per feed over 24h)
- Recent system events (last 20 audit log entries, filtered to system-level events: feed failures, auth failures, config changes)

Bottom row:
- Quick actions: "Invite User", "Force Feed Pull", "Generate AI Insights", "View Audit Log"

### 7.3 User & Role Management

**Prototype file:** `prototypes/trust-radar-admin-users.html`

Route: `/admin/users`

**API endpoints:**

- `GET /api/v1/admin/users?status=active&role=all&limit=50&offset=0` — paginated user list
- `GET /api/v1/admin/users/:id` — user detail
- `PATCH /api/v1/admin/users/:id` — update role, status
- `DELETE /api/v1/admin/users/:id` — deactivate (soft delete, never hard delete)
- `POST /api/v1/admin/invitations` — create invitation
- `GET /api/v1/admin/invitations?status=pending` — list pending invitations
- `DELETE /api/v1/admin/invitations/:id` — revoke invitation
- `GET /api/v1/admin/users/:id/sessions` — active sessions for a user
- `DELETE /api/v1/admin/users/:id/sessions` — revoke all sessions (force re-auth)

**Users Table**

Columns: Avatar (initials), Name, Email, Role (pill badge), Status (active/suspended), Last Login (relative time), Last Active, Actions (dropdown: Edit Role, Suspend, Revoke Sessions, View Audit Trail)

Filters: Role dropdown (All, Super Admin, Admin, Analyst, Client), Status dropdown (Active, Suspended, Deactivated)

Search: By name or email

**Role editing rules enforced in UI AND API:**

- Super Admin can change anyone's role
- Admin can only change Analyst roles
- Nobody can change their own role
- Role changes require a confirmation modal: "Change [name] from [current] to [new]? This takes effect immediately."
- Every role change is audit-logged

**User Detail Slide-Out Panel**

Clicking a user opens a right panel (overlays sidebar) showing:
- Profile info (name, email, Google avatar, role, status)
- Account history (created_at, invited_by, last_login, login_count)
- Active sessions (device, IP, last active, with individual revoke buttons)
- Recent activity (last 20 audit log entries for this user)
- Actions: Change Role, Suspend/Reactivate, Revoke All Sessions

**Invitation Management**

Sub-tab or section within Users view.

"Invite User" button opens a modal:
- Email input (required, validated for business email)
- Role selector (dropdown, only shows roles the current user can assign)
- "Send Invitation" button

Pending invitations table:
- Email, Role, Invited By, Sent At, Expires At, Status (pending/expired/revoked)
- Actions: Revoke, Resend (creates new token, invalidates old)

### 7.4 Feed Management

**Prototype file:** `prototypes/trust-radar-admin-feeds.html`

Route: `/admin/feeds`

This is the operational control center for all data ingestion. Two views: monitoring (what's happening now) and configuration (how feeds are set up).

**API endpoints:**

- `GET /api/v1/admin/feeds` — all feeds with status, config, and recent metrics
- `GET /api/v1/admin/feeds/:feed_name/history?period=7d` — per-feed ingestion history
- `GET /api/v1/admin/feeds/:feed_name/errors?limit=20` — recent errors
- `POST /api/v1/admin/feeds/:feed_name/trigger` — force an immediate pull (Super Admin only)
- `PATCH /api/v1/admin/feeds/:feed_name/config` — update feed config
- `POST /api/v1/admin/feeds/:feed_name/toggle` — enable/disable a feed

**Feed Monitoring Panel (default view)**

Table of all feeds with real-time status:

| Column | Source | Description |
|--------|--------|-------------|
| Feed Name | Static config | Human-readable name (e.g., "Certificate Transparency Logs") |
| Status | Computed | Healthy (green) / Degraded (yellow) / Down (red) / Disabled (gray) |
| Last Successful Pull | `feed_status.last_successful_pull` | Relative time ("3m ago", "2h ago") |
| Last Failure | `feed_status.last_failure` | Relative time or "—" if none |
| Records Today | `feed_status.records_ingested_today` | Number with sparkline trend |
| Records Total | Computed | Lifetime ingested count |
| Avg Pull Duration | Computed from history | "1.2s", "4.8s" |
| Schedule | Config | "Every 5 min", "Hourly", "Daily" |
| Actions | — | Trigger Now, View Errors, Configure, Enable/Disable |

Status logic:
- Healthy: last pull succeeded and was within 2× the scheduled interval
- Degraded: last pull succeeded but took >3× normal duration, OR error rate >5% in last hour
- Down: last 3+ consecutive pulls failed, OR no successful pull in >4× scheduled interval
- Disabled: manually turned off

**Feed Detail Panel (click into a feed)**

- Header: Feed name, source URL/API, status badge, enable/disable toggle
- Ingestion chart (Chart.js): Records ingested per hour over last 7 days. Line chart with fill. Overlay showing errors as red dots.
- Recent pulls table: Last 50 pull attempts. Columns: Timestamp, Duration, Records Ingested, Records Rejected, Status, Error (if any)
- Error log: Last 20 errors with full error messages. Expandable rows for stack trace/details.
- Configuration: Editable fields (see Config below)

**Feed Configuration (edit mode within feed detail)**

Each feed has configuration that can be edited by Super Admin:

- `schedule_cron`: Cron expression for pull frequency
- `source_url`: API endpoint or data source URL
- `api_key`: API key/token (masked in UI, only settable, never readable after set)
- `rate_limit`: Max requests per minute to the source
- `batch_size`: Max records per pull
- `retry_count`: How many retries on failure before marking as down
- `retry_delay_seconds`: Backoff between retries
- `enabled`: Boolean toggle
- `filters`: JSON — feed-specific filter config (e.g., which TLDs to watch for CT logs)
- `normalization_rules`: JSON — field mapping from feed-specific format to common schema

Config changes are audit-logged. Saving shows a diff: "You are changing schedule from `*/5 * * * *` to `*/10 * * * *`. This will reduce pull frequency by half."

**Feed Health Aggregate View**

Above the table, a row of summary cards:
- Total feeds: N active / N total
- Records ingested (24h): total count with trend vs yesterday
- Error rate (24h): percentage with trend
- Avg pull latency: across all feeds with trend

And a timeline chart showing all feeds stacked (each feed a different shade) to see total ingestion volume over time.

### 7.5 Lead Management

**Prototype file:** `prototypes/trust-radar-admin-leads.html`

Route: `/admin/leads`

Manages leads generated by the public Brand Assessment tool.

**API endpoints:**

- `GET /api/v1/admin/leads?status=all&limit=50&offset=0` — paginated lead list
- `GET /api/v1/admin/leads/:id` — lead detail with associated assessment
- `PATCH /api/v1/admin/leads/:id` — update status, assignment, notes, follow-up date
- `GET /api/v1/admin/leads/stats` — pipeline counts by status

**Lead Pipeline Board**

Two views (toggleable):

1. **Kanban view**: Columns for each status (New → Contacted → Qualified → Proposal Sent → Converted → Closed Lost). Lead cards draggable between columns. Each card: company name, contact name, trust score badge, domain, time since creation.

2. **Table view**: Sortable columns: Company, Contact, Email, Domain, Trust Score, Grade, Status (pill), Assigned To, Created, Follow-Up Date. Filters: Status, Assigned To, Grade (A-F), Date Range.

**Lead Detail Panel**

- Contact info: Name, email, company, phone, domain
- Assessment results: Trust Score, Grade, summary text, scan date
- Full report button: "View Full Assessment" opens the detailed report that sales would present
- Status selector: dropdown to change pipeline stage
- Assigned to: dropdown of Admin and Super Admin users
- Notes: Rich text area for internal notes (append-only with timestamps)
- Follow-up date: date picker, triggers reminder
- Activity log: All changes to this lead (status changes, notes added, assignment changes)

**Lead Notifications**

When a new lead is created (via the public assessment tool):
- Email notification to all Admins and Super Admins (configurable)
- Badge count on the "Leads" nav item in admin
- Optional: webhook to Slack/Discord (Phase 2)

### 7.6 Audit Log Viewer

Route: `/admin/audit`

Read-only view of the append-only audit log (stored in separate D1 database).

**API endpoints:**

- `GET /api/v1/admin/audit?limit=50&offset=0` — paginated audit entries
- Filters: `user_id`, `action`, `resource_type`, `outcome`, `date_from`, `date_to`

**Layout:**

Table with columns: Timestamp, User (name + avatar), Action, Resource Type, Resource ID, Outcome (success/failure/denied badge), IP Address.

Filters bar: User dropdown, Action type dropdown (login, role_change, invitation, feed_config, data_export, etc.), Outcome dropdown, Date range picker.

Click a row to expand and show the `details` JSON — the before/after state of whatever changed.

Export button: Download filtered audit log as CSV (Admin+ only, itself audit-logged).

### 7.7 Admin Data Model Additions

**feed_configs** (extends feed_status table from Section 4)

- `feed_name` (primary key)
- `display_name`, `description`
- `source_url`, `api_key_encrypted`
- `schedule_cron`, `rate_limit`, `batch_size`
- `retry_count`, `retry_delay_seconds`
- `enabled` (boolean)
- `filters` (JSON), `normalization_rules` (JSON)
- `created_at`, `updated_at`, `updated_by`

**feed_pull_history**

- `id`, `feed_name`, `started_at`, `completed_at`, `duration_ms`
- `records_ingested`, `records_rejected`, `status` (success/partial/failed)
- `error_message` (nullable)

**system_notifications** (for admin alerts)

- `id`, `type` (new_lead, feed_down, feed_recovered, security_alert)
- `title`, `body`, `severity`
- `created_at`, `read_by` (JSON array of user IDs who have seen it)

### 7.8 API Key Management

Route: `/admin/api-keys`

Manages API keys for external integrations (SIEM, TAXII subscribers, partner feeds). Added to admin nav as a sixth item.

**API endpoints:**

- `GET /api/v1/admin/api-keys` — list all keys (key_hash is never returned, only metadata)
- `POST /api/v1/admin/api-keys` — create new key (returns raw key ONCE in response)
- `PATCH /api/v1/admin/api-keys/:id` — update name, permissions, rate limit, enabled status
- `DELETE /api/v1/admin/api-keys/:id` — revoke key (soft delete, audit-logged)

**Key creation flow:**

1. Admin clicks "Create API Key"
2. Modal: Name (required), Permissions (multi-select: TAXII read, Threat export, Webhook push, Full API), Rate limit (dropdown: 10/60/100/unlimited req/min), Expiry (optional date or "never")
3. On create: system generates a 48-byte random key, displays it ONCE in a copy-able modal with a warning: "This key will not be shown again. Copy it now."
4. Only the SHA-256 hash is stored in D1

**Key table columns:** Name, Permissions (pill badges), Rate Limit, Created By, Created At, Last Used, Status (active/revoked), Actions (Edit, Revoke)

### 7.9 Agent Configuration

Route: `/admin/agent-config`

The analyst-facing Agents view (Section 6.9) shows what agents are doing. This admin view controls HOW they do it — schedules, thresholds, AI model parameters, and the Anthropic API key.

**API endpoints:**

- `GET /api/v1/admin/agents/config` — all agent configs
- `PATCH /api/v1/admin/agents/:agent_id/config` — update config (Super Admin only)
- `POST /api/v1/admin/agents/:agent_id/trigger` — force immediate run (Super Admin only)
- `GET /api/v1/admin/agents/api-usage` — Haiku API token usage and cost tracking

**Layout:**

Table of agents with editable configuration:

| Column | Description |
|--------|-------------|
| Agent Name | Display name (read-only) |
| Status | Active / Paused toggle |
| Schedule | Cron expression (editable) |
| Last Run | Timestamp + duration |
| Success Rate (24h) | Percentage |
| Outputs (24h) | Count |
| Actions | Trigger Now, Edit Config, View Logs |

**Per-agent config panel (click "Edit Config"):**

- **Schedule**: Cron expression with human-readable preview ("Every 15 minutes", "Daily at 6:00 UTC")
- **Confidence threshold**: Minimum confidence score for outputs to be published (0-100 slider). Below threshold = logged but not surfaced to analysts.
- **Brand priority list**: Which brands this agent should prioritize (affects processing order, not exclusion)
- **Max tokens per run**: Haiku API token budget per execution
- **Retry on failure**: Number of retries, backoff delay
- **Enabled**: Master on/off toggle

**Haiku API Usage panel:**

- Total tokens used (24h / 7d / 30d)
- Estimated cost (based on Haiku pricing)
- Per-agent token breakdown
- Usage trend chart
- Alert threshold: notify if daily spend exceeds $X

This is where the Anthropic API key is configured. It's stored as a Cloudflare Workers secret (not in D1). The admin UI shows "API Key: Configured ✓" or "API Key: Not set ⚠" — never displays the actual key. A "Rotate Key" button lets Super Admin replace it.

---

## 8. Remediation Engine (Ready, Not Active)

Trust Radar doesn't remediate by default — it doesn't have a client mandate. But the system is designed so that when a brand engages, remediation can activate immediately with zero ramp-up.

### What "Remediation Ready" Means

For every active threat, Trust Radar has already identified:

- The hosting provider and their abuse contact
- The domain registrar
- The SSL certificate authority
- The relevant abuse reporting mechanisms

When a brand says "go," we can:

1. Generate and submit abuse reports to hosting providers
2. Submit takedown requests to registrars
3. Report to certificate authorities for cert revocation
4. Track remediation status (submitted → acknowledged → actioned → confirmed down)

This is a future revenue trigger, not an MVP feature. But the data model supports it from day one.

---

## 9. Public Website & Brand Assessment

**Prototype file:** `prototypes/trust-radar-public-site.html`

The public site at lrxradar.com serves two purposes: establish Trust Radar as a credible AI-powered threat intelligence platform, and convert visitors into qualified leads through a free Brand Assessment tool.

### Messaging: AI Agents, Not AI Features

The site doesn't say "we use AI." Every security vendor says that. Trust Radar's messaging centers on what the AI actually does — autonomous agents that operate continuously without human prompting.

**What we communicate:**

Trust Radar deploys specialized AI agents, each with a distinct mission. These aren't chatbots or copilots. They're autonomous intelligence operatives that run 24/7, ingesting data, correlating signals, and surfacing threats that human analysts would take weeks to piece together.

**Agent roster (public-facing descriptions):**

**Sentinel** — Certificate & Domain Surveillance Agent. Monitors certificate transparency logs and newly registered domains in real time. Detects typosquatting, homoglyph attacks, and lookalike domains the moment they appear. Doesn't wait for a report — it's already watching.

**Analyst** — Threat Classification Agent. Examines every suspicious signal and determines what it is: phishing page, credential harvester, brand impersonation, malware distribution. Reads URL structure, domain patterns, hosting fingerprints, and page content to classify with confidence scoring.

**Cartographer** — Infrastructure Mapping Agent. Maps the attack ecosystem. Traces every threat to its hosting provider, IP range, ASN, and registrar. Builds a living atlas of which infrastructure operators are enabling attacks and how that landscape shifts over time.

**Strategist** — Campaign Correlation Agent. Sees what individual threat alerts miss — patterns. Clusters related attacks into coordinated campaigns by identifying shared infrastructure, registration timing, phishing kit templates, and target brand overlap. Reveals the threat actor's playbook.

**Observer** — Trend Intelligence Agent. Watches the long game. Tracks week-over-week, month-over-month, quarter-over-quarter shifts in targeting, infrastructure, and methodology. Produces narrative intelligence about where the threat landscape is heading, not just where it is.

These agents map directly to the actual analysis jobs running in the backend (Section 5). The naming and framing makes the capability tangible and memorable for a non-technical audience visiting the site.

**Why "agents" matters for positioning:**

Most brand protection vendors describe their AI as a feature ("AI-powered detection"). Trust Radar frames AI as the workforce — agents that are always running, always learning, always watching. This positions the platform closer to a managed intelligence service than a software tool, which justifies premium pricing and creates stickiness.

### Brand Assessment Tool (Lead Generation Engine)

This is the front door. A company enters their primary domain and receives a trust score — fast, free, and just detailed enough to be alarming without telling them how to fix it.

**The User Experience**

1. Visitor lands on lrxradar.com
2. Prominent CTA: "How exposed is your brand? Enter your domain for a free assessment."
3. Visitor enters their primary domain (e.g., `acmecorp.com`)
4. Brief loading state with agent activity animation — "Agents scanning..." (15–30 seconds)
5. Results page: Trust Score, letter grade, high-level risk summary
6. Full details locked behind a lead capture form

**What the Assessment Actually Does**

The assessment runs two categories of checks — standard domain health (available to anyone with the right tools) and threat intelligence (powered by the data Trust Radar is already ingesting). The combination is the moat. Anyone can check DNS records. Nobody else is cross-referencing that with a live feed of who's being impersonated right now.

**Standard Domain Health Checks (real-time, on-demand):**

- DNS configuration: MX records, SPF, DKIM, DMARC presence and policy strength
- SSL/TLS: certificate validity, chain completeness, protocol version, HSTS status
- Email authentication: SPF alignment, DMARC enforcement mode (none/quarantine/reject)
- Domain age and registrar reputation
- Nameserver configuration and redundancy
- HTTP security headers (CSP, X-Frame-Options, etc.)
- Open ports / basic exposure scan (common ports only, non-intrusive)
- Subdomain enumeration via public sources (CT logs, DNS records)

**Threat Intelligence Overlay (from Trust Radar's ingested data):**

- Active impersonation count: How many lookalike/typosquat domains exist targeting this brand right now
- Active phishing pages: Any confirmed phishing URLs targeting this brand in current feeds
- Hosting provider exposure: Where threats against this brand are being hosted
- Campaign association: Is this brand part of an active coordinated attack campaign
- Historical trend: Is threat activity against this brand increasing or decreasing
- Comparison to sector peers: How does this brand's threat exposure compare to others in the same industry

**The Trust Score**

Composite score from 0–100 with a corresponding letter grade:

| Score | Grade | Label |
|-------|-------|-------|
| 90–100 | A | Excellent — Strong posture, minimal exposure |
| 80–89 | B | Good — Solid fundamentals, some gaps |
| 70–79 | C | Fair — Notable weaknesses, moderate exposure |
| 50–69 | D | Poor — Significant vulnerabilities, active threats likely |
| 0–49 | F | Critical — Severe exposure, immediate attention needed |

**Score weighting (internal, not shown to user):**

- Email authentication (SPF/DKIM/DMARC): 25%
- SSL/TLS & security headers: 15%
- DNS configuration health: 10%
- Active impersonation/typosquat count: 20%
- Active phishing threats: 15%
- Threat trend direction: 10%
- Campaign association: 5%

The weighting ensures that even a company with perfect domain hygiene still scores poorly if they're being actively targeted — because that's the insight they can't get elsewhere.

**What the Visitor Sees (Free Tier)**

The results page shows:

- The Trust Score number and letter grade (prominently displayed)
- A one-sentence summary: "Your brand has [X] active impersonation threats and your email authentication is [strong/weak/missing]."
- Three to four high-level risk indicators shown as red/yellow/green (e.g., "Email Auth: Weak", "Active Threats: 12 detected", "SSL: Valid")
- No specific URLs, no domain names of attackers, no remediation guidance, no detailed breakdown

This is deliberately incomplete. Enough to make the problem real. Not enough to act on.

**The Lead Gate**

Below the summary: "Want the full report? Our team will walk you through every finding and a remediation plan."

Lead capture form:
- Name
- Business email (reject freemail — gmail, yahoo, etc.)
- Company name
- Phone (optional)
- "Request Full Report" button

On submit:
- Lead is created in the platform backend
- Sales team is notified (email + internal dashboard alert)
- The full detailed assessment is already generated and waiting — no delay when sales follows up

**What the Sales Team Gets (Full Report)**

The backend generates the complete analysis at scan time, not when the lead converts. This means:

- Every specific lookalike/typosquat domain detected, with registration date and status
- Every phishing URL, with hosting provider and current up/down status
- Full DNS/email auth breakdown with specific misconfigurations identified
- SSL/TLS detailed findings
- Security header analysis
- Campaign context if the brand is part of a coordinated attack
- Peer comparison within their sector
- Recommended remediation priorities (AI-generated)
- Estimated remediation timeline and Trust Radar service proposal

The sales team walks the prospect through this report on a call. The contrast between the sparse free summary and the rich full report is the conversion mechanism.

### Brand Assessment Data Model

**assessments**

- `id` (UUID)
- `domain` — the domain that was scanned
- `requested_at`, `completed_at`
- `trust_score` (0–100)
- `grade` (A/B/C/D/F)
- `summary_text` — the brief public-facing summary
- `full_report` (JSON) — complete detailed analysis, never exposed publicly
- `domain_health_results` (JSON) — raw results from standard checks
- `threat_intel_results` (JSON) — results from platform data overlay
- `score_breakdown` (JSON) — per-category scores and weights
- `ip_address` — requestor IP (for rate limiting and abuse detection)
- `lead_id` (nullable — populated when visitor converts)

**leads**

- `id` (UUID)
- `assessment_id` (references assessments)
- `name`, `email`, `company`, `phone`
- `created_at`
- `status` (enum: new, contacted, qualified, proposal_sent, converted, closed_lost)
- `assigned_to` (references users.id — which sales/admin user owns this lead)
- `notes` (text — internal notes from sales interactions)
- `follow_up_at` (datetime — next scheduled touchpoint)

**assessment_history**

- `domain`, `assessment_id`, `trust_score`, `grade`, `scanned_at`
- Tracks repeat scans of the same domain over time
- Enables: "Your score changed from C to D since we last checked" in follow-up outreach

### Rate Limiting the Assessment

The assessment tool is public and will attract abuse — competitors scraping, bots, researchers bulk-scanning.

- 3 scans per IP per 24 hours (unauthenticated)
- CAPTCHA or Cloudflare Turnstile challenge before scan execution
- Scan queue with priority (organic visitors prioritized over suspicious patterns)
- Blocklist for known scanner/bot IPs
- Domain validation: must be a registerable domain, not an IP, not a subdomain
- Results cached for 24 hours — repeat scans of the same domain within the window return cached results

### Public Site Structure

- **Hero section**: Headline about AI agents watching the threat landscape. Domain input for Brand Assessment prominently placed.
- **Agent showcase**: Visual cards or animation introducing each agent (Sentinel, Analyst, Cartographer, Strategist, Observer) with one-line descriptions of what they do.
- **How it works**: Three-step visual — "Enter your domain → Agents scan → Get your score"
- **Trust Score example**: Anonymized sample report showing the score, grade, and summary format so visitors know what to expect before scanning.
- **Platform capabilities**: Brief overview of the full platform for companies that want ongoing monitoring (links to "Request a Demo" form).
- **Footer**: Company info, privacy policy, terms of service, security posture statement.

The site is lightweight — a single Cloudflare Worker serving static HTML with the assessment form as the interactive element. No SPA framework needed for the public site.

---

## 10. Technical Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       CLOUDFLARE EDGE                            │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Feed Ingest  │  │  API Worker  │  │  UI Worker   │           │
│  │   Worker     │  │  (REST API)  │  │  (Dashboard) │           │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘           │
│         │                 │                                      │
│  ┌──────────────┐  ┌──────┴───────┐                              │
│  │ Public Site  │  │  Assessment  │                              │
│  │   Worker     │──│   Engine     │                              │
│  │ (lrx-radar)  │  │  (Scan API)  │                              │
│  └──────────────┘  └──────┬───────┘                              │
│                           │                                      │
│         ┌─────────────────┴──────────────────┐                   │
│         ▼                                    ▼                   │
│  ┌──────────────────────────────┐   ┌──────────────┐            │
│  │       Cloudflare D1          │   │ Cloudflare   │            │
│  │    (Structured Data)         │   │ R2 (Blobs)   │            │
│  └──────────────────────────────┘   └──────────────┘            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                         │
                         │ AI Analysis Requests
                         ▼
              ┌──────────────────────┐
              │   Railway (FastAPI)  │
              │   AI Orchestration   │
              │   Claude Haiku API   │
              └──────────────────────┘
```

### Worker Breakdown

**Feed Ingest Worker** — Runs on Cron Triggers (Cloudflare scheduled events). Each feed has its own cron schedule. Fetches, normalizes, deduplicates, writes to D1.

**API Worker** — REST API serving the dashboard frontend and any future external consumers. Reads from D1, handles auth, exposes query endpoints for brands, threats, providers, campaigns, trends, leads.

**UI Worker** — Serves the authenticated dashboard application. Static assets from R2 or inline. TypeScript/lightweight framework.

**Public Site Worker** — Serves the public-facing lrxradar.com landing page. Static HTML, no auth required. Contains the Brand Assessment form and results display.

**Assessment Engine** — Triggered by the Public Site Worker when a scan is requested. Runs domain health checks (DNS, SSL, email auth, headers), queries D1 for threat intelligence overlay, calls Railway/Haiku for score synthesis and summary generation, writes results to D1, returns score to the public results page. Rate-limited and Turnstile-protected.

### Cron Schedule

| Feed | Frequency | Cron Expression |
|------|-----------|----------------|
| CT Logs | Every 5 min | `*/5 * * * *` |
| PhishTank | Hourly | `0 * * * *` |
| URLhaus | Every 5 min | `*/5 * * * *` |
| OpenPhish | Every 12 hours | `0 */12 * * *` |
| AI Analysis (classification) | Every 15 min | `*/15 * * * *` |
| AI Analysis (correlation) | Every 6 hours | `0 */6 * * *` |
| AI Analysis (provider scoring) | Weekly | `0 0 * * 0` |
| AI Insights (daily summary) | Daily | `0 6 * * *` |
| Daily Snapshots | Daily | `0 0 * * *` |

---

## 11. Authentication, RBAC & Platform Security

**Prototype file:** `prototypes/trust-radar-login.html`

A platform that indexes attack infrastructure will be targeted by the people behind that infrastructure. Security is not a feature — it's a survival requirement. Every design decision here assumes adversarial users will eventually probe the system.

### Authentication: Passwordless via OAuth 2.0

No passwords. No password database. No password reset flows. No credential stuffing surface.

**Primary method: Sign in with Google (OAuth 2.0 / OpenID Connect)**

- All human authentication flows through Google's identity provider
- We never store or handle passwords — Google owns that risk
- We receive a signed ID token (JWT) containing the user's email, name, and Google subject ID
- The Google subject ID (`sub` claim) becomes our internal identity anchor, not the email address (emails can change, `sub` is permanent)
- Tokens are validated server-side on every request — never trusted from the client alone

**Why Google OAuth specifically:**

- Passwordless eliminates the #1 attack vector (credential compromise)
- Google accounts typically have strong MFA already enabled
- No custom auth infrastructure to maintain, patch, or get wrong
- Reduces our attack surface to token validation logic only
- Future expansion: add Microsoft Entra ID, GitHub OAuth for broader org support

**Session Management**

Sessions are short-lived JWTs issued by our API Worker after Google OAuth validation succeeds:

- Access token: 15-minute expiry, stored in memory only (never localStorage)
- Refresh token: 7-day expiry, stored as HttpOnly/Secure/SameSite=Strict cookie
- Refresh rotation: every refresh issues a new refresh token and invalidates the old one
- Absolute session limit: 30 days regardless of refresh activity — forces re-authentication
- All tokens are signed with a secret rotated monthly, stored in Cloudflare Workers secrets

**Token Validation (every request)**

The API Worker validates on every inbound request — no exceptions:

1. Extract access token from Authorization header
2. Verify JWT signature against current signing key
3. Check expiry, issuer, audience claims
4. Look up user in D1 by `google_sub` — confirm account exists and is active
5. Load role and permissions from the user record
6. Reject with 401 if any step fails — no partial access, no fallbacks

### Role-Based Access Control (RBAC)

Four roles, strictly hierarchical. Every API endpoint and UI route checks role before executing.

**Role: Super Admin**

- The platform owner. Initially just you.
- Full system access with no restrictions
- Can manage all users, roles, and invitations
- Can access system configuration, API keys, secrets
- Can trigger manual feed runs, force AI analysis
- Can view and manage audit logs
- Can activate/deactivate the remediation engine
- Can delete data (with audit trail)

**Role: Admin**

- Trusted operators. Senior analysts or partners you bring in.
- Full read access to all threat data, brands, providers, campaigns
- Can create and manage Analyst accounts
- Can configure alert thresholds and notification rules
- Can export data and generate reports
- Can initiate remediation actions (when engine is active)
- Cannot manage other Admins or Super Admins
- Cannot access system configuration or secrets
- Cannot delete data

**Role: Analyst**

- Day-to-day users. Researchers, junior analysts, client-facing staff.
- Full read access to threat data, brands, providers, campaigns
- Can create saved views, filters, and watchlists
- Can add notes and tags to threats and campaigns
- Can generate reports within their scope
- Cannot manage any users
- Cannot initiate remediation actions
- Cannot export bulk data
- Cannot access system configuration

**Role: Client (Future — Phase 3)**

- External brand representatives given scoped access to their own data.
- Can only see threats, campaigns, and intelligence related to their brand(s)
- Cannot see other brands' data, provider rankings, or ecosystem-wide trends
- Can view remediation status for their threats
- Can approve/request remediation actions
- Cannot manage any users or system settings

### RBAC Data Model

**users**

- `id` (UUID)
- `google_sub` (unique — Google subject ID, the true identity key)
- `email` (from Google, for display and notifications — not used for auth)
- `name` (from Google)
- `role` (enum: super_admin, admin, analyst, client)
- `status` (enum: active, suspended, deactivated)
- `invited_by` (references users.id — who granted access)
- `created_at`, `last_login`, `last_active`

**user_brand_scopes** (for Client role)

- `user_id`, `brand_id` — which brands a client user can see
- Analysts and above have implicit access to all brands

**invitations**

- `id` (UUID)
- `email` — the exact email address the invite is issued to
- `role` — the role being granted
- `token_hash` — SHA-256 hash of the invite token (raw token is never stored)
- `invited_by` (references users.id)
- `created_at`, `expires_at`, `accepted_at`
- `status` (enum: pending, accepted, expired, revoked)
- Invitation-only registration. No public signup. No self-service account creation.
- Invitations expire after 72 hours
- Only Super Admin can invite Admins. Admins can invite Analysts. Super Admin can invite any role.

**sessions**

- `id`, `user_id`, `refresh_token_hash`, `issued_at`, `expires_at`, `revoked_at`
- `ip_address`, `user_agent` (for audit and anomaly detection)
- Tracks all active sessions per user
- Enables "revoke all sessions" for compromised accounts

### Invitation Flow (No Public Registration)

Trust Radar is invite-only. There is no signup page. Access is granted by existing users with appropriate permissions.

**Token Generation**

When an Admin or Super Admin creates an invitation, the system generates a cryptographically secure invite token:

- Token: 48-byte random value, generated via `crypto.getRandomValues()` on the Worker edge
- Encoded as URL-safe base64 for use in links
- Only the SHA-256 hash of the token is stored in D1 — the raw token exists only in the invite link
- This means even if the database is compromised, stored hashes cannot be reversed into working invite links

**The Invite Link**

The recipient receives an email containing a single link:

```
https://lrxradar.com/invite?token=<base64_token>
```

- The link is the only way to create an account — there is no other registration path
- Each link is single-use and bound to the specific email address
- Link expires after 72 hours from creation
- Link can be manually revoked by the inviter before use

**Acceptance Flow**

1. Admin/Super Admin enters an email address and selects a role
2. System generates a secure token, stores the hash, and sends the invite email with the token link
3. Recipient clicks the link → API Worker validates the token hash against D1
4. If token is valid (exists, not expired, not revoked, not already used) → redirect to Google OAuth
5. After Google auth, system matches the Google account email to the invitation email
6. If match: account created with assigned role, invitation marked as accepted, session issued
7. If no match (different Google account than invited email): rejected, invitation remains available for retry with the correct account
8. On successful acceptance, the token is permanently consumed — the link is dead

**Security Properties of This Flow**

- Token is unguessable (48 bytes of entropy = 384 bits)
- Token cannot be reconstructed from the database (only hash stored)
- Token is bound to a specific email — possessing the link alone isn't enough, you must also control the matching Google account
- Token is time-limited — a forgotten invite link becomes inert after 72 hours
- Token is single-use — even if intercepted after use, it's already consumed
- The inviter can see pending invitations and revoke any that look suspicious

### API Security Hardening

**Rate Limiting**

- Authentication endpoints: 5 requests per minute per IP
- API read endpoints: 100 requests per minute per user
- API write endpoints: 20 requests per minute per user
- Feed ingestion (internal): exempt from user rate limits, has its own circuit breakers
- Rate limit state stored in Cloudflare Workers KV (low latency, edge-distributed)

**Request Validation**

- All inputs validated and sanitized at the API Worker edge before touching D1
- Parameterized queries only — no string interpolation in SQL, ever
- Request size limits enforced (1MB max body)
- Content-Type enforcement — reject unexpected media types

**CORS Policy**

- Strict origin allowlist: only `lrxradar.com` and configured subdomains
- No wildcard origins
- Credentials mode enabled only for known origins
- Preflight caching: 1 hour

**Security Headers (on every response)**

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Audit Log

Every significant action gets logged. Non-negotiable. The audit log is append-only — no user, including Super Admin, can delete or modify entries.

**audit_log**

- `id`, `timestamp`, `user_id`, `action`, `resource_type`, `resource_id`
- `details` (JSON — what changed, before/after where applicable)
- `ip_address`, `user_agent`
- `outcome` (success/failure/denied)

**Logged actions include:**

- All authentication events (login, logout, token refresh, failed attempts)
- All role changes and user management actions
- All invitation creation, acceptance, expiry, and revocation (including inviter, target email, role, and token status)
- All failed invitation attempts (expired link, email mismatch, already consumed)
- All data modifications (threat status changes, notes, tags)
- All data exports
- All remediation actions
- All configuration changes
- All failed authorization checks (user tried to access something above their role)

Audit log is stored in a separate D1 database from operational data. Even if the primary database is compromised, the audit trail is isolated.

### Threat Model & Defense Posture

**Attack: Credential compromise**  
Defense: No passwords exist. OAuth delegates auth to Google. Attacker would need to compromise the user's Google account (which has its own MFA).

**Attack: Session hijacking**  
Defense: Short-lived access tokens (15 min), HttpOnly/Secure cookies, refresh rotation, IP+UA tracking for anomaly detection.

**Attack: Invitation abuse / link interception**  
Defense: Invite tokens are 384-bit random values — unguessable by brute force. Only the hash is stored in D1, so a database breach doesn't expose working links. Tokens are bound to a specific email address and require Google OAuth with that matching account — possessing the link alone is not enough. Tokens are time-limited (72h), single-use, and revocable by the inviter.

**Attack: Privilege escalation**  
Defense: Role checked on every request at the API layer. Role enum is server-side — never trust client-provided role claims. Role changes require Super Admin and are audit-logged.

**Attack: Data exfiltration by insider**  
Defense: Bulk export restricted to Admin+. All exports audit-logged with user, timestamp, and scope. Analyst role has no bulk export capability.

**Attack: API abuse / scraping**  
Defense: Rate limiting per user and per IP. No public API endpoints — all require valid session. Request validation rejects malformed input before it reaches business logic.

**Attack: Feed poisoning (compromised upstream data)**  
Defense: Feeds are treated as untrusted input. All feed data is sanitized on ingestion. AI classification provides a second layer of validation. Anomaly detection on feed volume (sudden 10x spike triggers alert, not blind ingestion).

**Attack: Infrastructure targeting (DDoS, etc.)**  
Defense: Cloudflare sits in front of everything. Workers have built-in DDoS protection. No origin servers are publicly exposed. Railway backend is only accessible via Worker-to-Railway authenticated calls.

**Attack: Brand Assessment abuse (reconnaissance / competitive scraping)**  
Defense: Cloudflare Turnstile challenge before every scan. 3 scans per IP per 24 hours. 24-hour result caching per domain prevents repeat resource consumption. Domain input validation rejects IPs, subdomains, and malformed input. Full detailed reports are never exposed through the public endpoint — only the score, grade, and brief summary. Scan activity is logged and monitored for bulk patterns.

**Attack: Lead form spam / poisoning**  
Defense: Business email validation rejects freemail providers (gmail, yahoo, hotmail, etc.). Turnstile challenge carries through from the scan step. Rate limiting on form submissions. Honeypot fields for basic bot detection. Lead data is internal-only and never influences platform operations — poisoned leads waste sales time but don't compromise the system.

---

## 12. MVP Scope

What ships first. The minimum viable observatory.

### MVP Includes

1. **Two feeds ingesting**: CT Logs + PhishTank (highest signal, easiest integration)
2. **Brand auto-detection**: AI classifies target brand from domain/URL patterns
3. **Basic threat table**: View all ingested threats, filter by brand, type, provider, date
4. **Brand rankings**: Top 20 most targeted brands, updated daily
5. **Provider identification**: IP-to-ASN mapping for every threat, basic provider ranking
6. **Daily AI summary**: One narrative insight report per day
7. **Feed health monitoring**: Can we see if ingestion is working
8. **Auth**: Google OAuth (Sign in with Google), invite-only, RBAC with Super Admin + Analyst roles
9. **Observatory dashboard**: Leaflet map with heatmap + animated attack flow arcs + sidebar intel panels — all API-driven, zero hardcoded data (Section 6.2)
10. **Brand & Provider detail views**: Drill-down from observatory into specific entities (Sections 6.3, 6.4)
11. **Admin Module — Users & Roles**: User table, invite flow, role management, session management (Section 7.3)
12. **Admin Module — Feed Management**: Feed monitoring table with status/health, error logs, manual trigger, config editing (Section 7.4)
13. **Admin Module — Lead Management**: Kanban + table views, lead detail with assessment data, assignment, notes (Section 7.5)
14. **Admin Module — Agent Config**: Per-agent schedules, thresholds, Haiku API usage tracking (Section 7.9)
15. **Admin Module — Audit Log**: Read-only viewer with filters, expandable detail rows (Section 7.6)
16. **Campaigns Hub + Detail**: Active/Dormant/Disrupted tabs, AI assessment, infrastructure graph, threats (Section 6.7)
17. **Trend Explorer**: Multi-dimension charts, period selector, compare mode, AI trend insights (Section 6.8)
18. **AI Agents View**: Agent status cards, output feeds, health charts — analyst-facing (Section 6.9)
19. **Public website**: Landing page with AI agent messaging, platform positioning
20. **Brand Assessment tool**: Domain scan, Trust Score (0–100 / A–F), brief summary, lead gate
21. **API Worker endpoints**: All dashboard, admin, and assessment endpoints specified in Sections 6 and 7
22. **Client-side router**: SPA routing, shared component library, API client module (Section 24)

### MVP Does Not Include

- Evidence capture and preservation (Phase 2 — Section 20)
- Custom alert rules and watchlists (Phase 2 — Section 19)
- Multi-tenant architecture and client onboarding (Phase 2 — Section 18)
- Mobile/PWA experience (Phase 2 — Section 21)
- Scheduled PDF reports (Phase 2 — Section 22)
- STIX/TAXII export and SIEM integration (Phase 3 — Section 16)
- Remediation engine (Phase 3)
- Stripe billing integration (Phase 3)
- Additional feeds beyond CT + PhishTank (Phase 2)
- Client role with scoped brand access (Phase 2 — part of multi-tenant)
- Notification center and push notifications (Phase 2)
- Paid provider feeds: Mimecast, Proofpoint, etc. (Phase 3 — Section 16.3)
- WebSocket live updates — MVP uses polling (Phase 2 upgrade)
- Light mode (Phase 3, for client-facing views)
- API documentation portal (Phase 3)

### MVP Cost Target

| Service | Estimated Monthly |
|---------|------------------|
| Cloudflare Workers (free tier) | $0 |
| Cloudflare D1 (free tier, 5GB) | $0 |
| Cloudflare R2 (free tier, 10GB) | $0 |
| Railway (FastAPI + Haiku calls) | $5–10 |
| Claude Haiku API usage | $5–10 |
| **Total** | **$10–20/month** |

---

## 13. Build Sequence

Ordered by dependency — each step requires the previous steps to be complete. No week estimates. Move as fast as execution allows.

### Step 0: Decommission v1 & Upload Prototype Files

**This must happen before ANY v2 code is written.** Follow the full procedure in Section 15.

1. Archive v1 to `archive/v1-trust-radar` branch
2. Tag `v1.0-final`
3. Clear v1 files from `main`
4. Delete old D1 databases containing stale v1 data (Section 15.3)
5. Create fresh D1 databases: `trust-radar-v2` and `trust-radar-v2-audit` (Section 15.3)
6. Update `wrangler.toml` with new database bindings
7. Upload `trust-radar-v2-plan.md` to the repo root — this is the single source of truth
8. Upload all HTML prototype files to `trust-radar/prototypes/` in the repo:

| Prototype File | Covers |
|---------------|--------|
| `trust-radar-hud-v2.html` | Observatory HUD — Section 6.2 |
| `trust-radar-brands-tab.html` | Brands Hub + Brand Detail — Sections 6.3, 6.4 |
| `trust-radar-providers-tab.html` | Providers Hub + Provider Detail — Sections 6.5, 6.6 |
| `trust-radar-campaigns-tab.html` | Campaigns Hub + Campaign Detail — Section 6.7 |
| `trust-radar-trends-tab.html` | Trend Explorer — Section 6.8 |
| `trust-radar-agents-tab.html` | AI Agents View — Section 6.9 |
| `trust-radar-admin-dashboard.html` | Admin Dashboard — Section 7.2 |
| `trust-radar-admin-users.html` | Admin Users & Roles — Section 7.3 |
| `trust-radar-admin-feeds.html` | Admin Feed Management — Section 7.4 |
| `trust-radar-admin-leads.html` | Admin Lead Management — Section 7.5 |
| `trust-radar-login.html` | Login / Auth Screen — Section 11 |
| `trust-radar-public-site.html` | Public Website + Brand Assessment — Section 9 |

These files are the visual specification. Claude Code should open and render each prototype to understand the exact layout, component structure, CSS class names, colors, typography, and interaction patterns before building the production version. The prototypes use simulated data — production code fetches from the API endpoints specified in each section.

**IMPORTANT for Claude Code:** When building any view, ALWAYS open the corresponding prototype file first. The class names, CSS variables, component hierarchy, and visual behavior in the prototype ARE the specification. Match them.

### Step 1: Database Schema
- Create D1 databases: `trust-radar-v2` (primary) and `trust-radar-v2-audit` (audit log)
- Write migration files for all core tables: brands, threats, hosting_providers, campaigns, daily_snapshots, feed_status
- Write migration files for auth tables: users, invitations, sessions
- Write migration files for admin tables: feed_configs, feed_pull_history, agent_runs, agent_outputs, system_notifications
- Write migration files for assessment tables: assessments, leads, assessment_history
- Write migration files for monitored_brands
- Write audit_log table in the separate audit D1
- Run all migrations against staging environment

### Step 2: Feed Ingestion
- Feed Ingest Worker: CT Log polling (Google CT API / crt.sh) + normalization to common schema
- Feed Ingest Worker: PhishTank API polling + normalization
- Raw signal deduplication logic (hash-based on URL + domain)
- Feed health status tracking (last_successful_pull, records_ingested_today, health_status)
- Feed config table seeded with CT Logs + PhishTank defaults
- Cron Trigger bindings in wrangler.toml

### Step 3: Enrichment Pipeline
- DNS resolution enrichment (domain → IP → ASN → hosting provider)
- WHOIS/RDAP enrichment for flagged domains
- Cloudflare Intel API enrichment (domain intelligence, passive DNS)
- IP-to-ASN mapping via Team Cymru / IPinfo
- Brand auto-detection: write normalized brand records from feed data
- Daily snapshot aggregation job (cron: daily)

### Step 4: AI Analysis Integration
- Haiku integration via Railway FastAPI: threat classification pipeline
- Haiku integration: brand matching/inference for feeds that don't identify targets
- Haiku integration: daily insight generation (agent_outputs table)
- Haiku integration: provider reputation scoring (weekly batch)
- Agent run tracking: write to agent_runs on every execution
- Agent output tracking: write to agent_outputs with related entity links

### Step 5: Authentication & Authorization
- Google OAuth flow: redirect → Google → callback → token exchange
- JWT session management: 15-min access token, 7-day refresh with rotation
- RBAC middleware: extract user from JWT, load role, check permissions on every request
- Invitation system: token generation (48-byte), SHA-256 hash storage, email delivery, acceptance flow
- Audit log middleware: log every auth event, role change, config change to audit D1
- Super Admin bootstrap seed script: `scripts/seed-super-admin.sql` — generates the first user record so the platform owner can log in (full instructions in Section 25.2, Step 8). Claude Code MUST generate this script as part of the auth build.

### Step 6: API Endpoints (all endpoints before any UI)
- Dashboard: `/dashboard/stats`, `/dashboard/top-brands`, `/dashboard/providers`
- Threats: `/threats/geo-clusters`, `/threats/attack-flows`, `/threats/recent`
- Brands: `/brands/top-targeted`, `/brands/monitored`, `/brands`, `/brands/:id`, `/brands/:id/threats`, `/brands/:id/threats/locations`, `/brands/:id/threats/timeline`, `/brands/:id/providers`, `/brands/:id/campaigns`
- Brand monitoring: `POST /brands/monitor`, `DELETE /brands/monitor/:id`
- Providers: `/providers/worst`, `/providers/improving`, `/providers`, `/providers/:id`, `/providers/:id/threats`, `/providers/:id/brands`, `/providers/:id/timeline`, `/providers/:id/locations`
- Campaigns: `/campaigns?status=active|dormant|disrupted`, `/campaigns/stats`, `/campaigns/:id`, `/campaigns/:id/threats`, `/campaigns/:id/infrastructure`, `/campaigns/:id/brands`, `/campaigns/:id/timeline`
- Trends: `/trends/brands`, `/trends/providers`, `/trends/tlds`, `/trends/types`, `/trends/volume`, `/trends/compare`
- Agents: `/agents`, `/agents/:id/outputs`, `/agents/:id/health`
- Insights: `/insights/latest`
- Admin: `/admin/system-health`, `/admin/feed-summary`, `/admin/user-summary`, `/admin/lead-summary`
- Admin Users: `/admin/users`, `/admin/users/:id`, `/admin/invitations`
- Admin Feeds: `/admin/feeds`, `/admin/feeds/:feed_name/history`, `/admin/feeds/:feed_name/errors`, `/admin/feeds/:feed_name/trigger`, `/admin/feeds/:feed_name/config`
- Admin Leads: `/admin/leads`, `/admin/leads/:id`, `/admin/leads/stats`
- Admin Agents: `/admin/agents/config`, `/admin/agents/:id/config`, `/admin/agents/:id/trigger`, `/admin/agents/api-usage`
- Admin API Keys: `/admin/api-keys`
- Admin Audit: `/admin/audit`
- Assessment: `/assess` (public, POST), `/assess/:id/results` (public, GET)
- All endpoints return typed JSON, validated by RBAC middleware

### Step 7: UI Shell & Shared Components
- UI Worker: serves SPA shell (index.html) for all non-API routes
- Client-side router: History API routing with route matching (Section 24.1)
- API client module: shared fetch wrapper with auth token handling (Section 24.3)
- Shared component library (Section 24.2): Topbar (with 6 analyst pills + admin mode), Panel, DataTable (sortable/filterable/paginated), StatCard, StatusBadge, ThreatTypePill, Sparkline SVG, BarRow, FilterPills, PeriodSelector, Modal, EmptyState, Toast notifications
- CSS: single file with all custom properties from Section 6.1
- Login screen: Google OAuth redirect button, callback handler, session establishment

### Step 8: Observatory
- Leaflet map with CartoDB dark_all tiles, L.heatLayer from `/threats/geo-clusters`
- Canvas arc overlay (custom L.Layer) from `/threats/attack-flows` — Bezier curves, directional particles, arrowheads, origin diamonds, target crosshairs
- Cluster markers (L.circleMarker) sized and colored by intensity
- HUD chrome: corner brackets, scan line, UTC clock, severity legend with arc symbols
- Stat bar: four glass chips consuming `/dashboard/stats`
- Sidebar: top brands panel from `/dashboard/top-brands`, worst/improving providers from `/dashboard/providers`, agent insights from `/insights/latest`
- Live polling: 15s interval on `/threats/recent`, flash new threats, burst arc particles
- All clickable: brands → Brands Detail, providers → Provider Detail, insights → related entities

### Step 9: Brands Tab
- Brands Hub with three sub-tabs: Top Targeted (ranked cards with sparklines), Monitored (curated list with status badges), All Brands (searchable table with star toggle)
- Add Brand modal: domain input, validation, `POST /brands/monitor`
- Brand Detail: header with Trust Score ring, threats table, mini Leaflet map, provider breakdown bars, campaign cards, Chart.js timeline
- In-tab navigation: click brand → detail, back button → hub (preserves sub-tab)
- All data from API, zero hardcoded brands

### Step 10: Providers Tab
- Providers Hub: Worst Actors (ranked cards with reputation gauge), Improving (green-tinted cards), All Providers (table)
- Provider Detail: header with reputation ring, threats table (with Target Brand column), brand breakdown bars, mini map, AI assessment card from Cartographer, multi-period trend overlay chart (current 30d + previous 30d + 60-90d)
- Same in-tab navigation pattern as Brands

### Step 11: Campaigns Tab
- Campaigns Hub: Active/Dormant/Disrupted sub-tabs, large cards with severity, AI description, brand icons, sparklines
- Campaign Detail: Strategist AI assessment panel (purple-tinted, methodology + actor profile), infrastructure canvas graph (domains → IPs → providers), threats table, brand breakdown, infrastructure stats, activity timeline
- Empty states for Dormant/Disrupted when no campaigns exist

### Step 12: Trends Tab
- Control bar: dimension selector (Brands/Providers/TLDs/Threat Types/Volume), period selector, compare mode toggle
- Chart rendering: multi-line for Brands/Providers, stacked area for TLDs/Types, single fill for Volume
- Compare mode: two entity selectors, overlay chart
- Interactive legend: click to toggle series visibility
- Headline insight cards: auto-computed biggest increase/decrease/volume change
- AI trend insight from Observer (per-dimension narrative)

### Step 13: AI Agents Tab
- Five agent status cards: icon, name, status dot (active/idle/degraded/error), role description, 24h stats (jobs/outputs/errors), last output time, 24-segment activity bar
- Click card → expand detail panel: output feed (chronological list with type/severity/entities) + health chart (24h bar chart of run durations + error overlay) + performance metrics
- Agent colors consistent with all other views (Sentinel=cyan, Analyst=green, Cartographer=amber, Strategist=red, Observer=purple)

### Step 14: Admin Dashboard
- Admin topbar with amber accent, admin-specific nav pills, "Back to Observatory" link
- Four metric cards: Users, Feeds, Leads, AI Analysis — with colored progress bars
- Quick actions: Invite User, Force Feed Pull, Run AI Analysis, View Audit Log
- Two-column: Feed ingestion stacked area chart + system events timeline
- Bottom row: Lead pipeline horizontal bar + AI agent health summary

### Step 15: Admin — Users & Roles
- User table: avatar, name, email, role pill, status, last login, actions dropdown
- Filters: role, status. Search by name/email
- User detail slide-out: profile, account history, active sessions (with revoke), recent audit entries
- Role editing: confirmation modal, enforced rules (can't change own role, Admin can't promote to Admin)
- Invitation create modal: email, role, send. Business email validation.
- Pending invitations table: email, role, sent, expires, status, revoke/resend actions
- Session management: view all sessions for a user, revoke individual or all

### Step 16: Admin — Feed Management
- Feed monitoring table: name, status indicator (healthy/degraded/down/disabled), last pull, last failure, records today, avg duration, schedule, actions
- Feed detail panel: ingestion chart (records/hour over 7d), pull history table (last 50), error log (last 20 expandable), config editor
- Config editing: cron schedule, source URL, rate limit, batch size, retry settings, filters JSON — with diff preview before save
- Manual trigger button (Super Admin only), enable/disable toggle
- Feed health aggregate: total feeds, records 24h, error rate, avg latency

### Step 17: Admin — Lead Management
- Kanban view: drag-and-drop columns (New → Contacted → Qualified → Proposal → Converted → Closed Lost)
- Table view: sortable columns, filters (status, assigned to, grade, date range), search
- Lead detail panel: contact info, assessment results (Trust Score, grade, summary), full report viewer, status selector, assigned to dropdown, notes (append-only with timestamps), follow-up date picker, activity log
- New lead notifications: email to admins on creation

### Step 18: Admin — API Keys & Agent Config & Audit Log
- API Keys: table (name, permissions pills, rate limit, created by, last used, status), create modal (name, permissions multi-select, rate limit, expiry), key shown once on creation, revoke action
- Agent Config: per-agent table (status toggle, schedule, last run, success rate), edit panel (cron, confidence threshold, brand priority, max tokens, retries), Haiku API usage panel (tokens/cost by agent, trend chart), trigger immediate run
- Audit Log Viewer: paginated table (timestamp, user, action, resource, outcome), filters (user, action type, outcome, date range), click to expand detail JSON (before/after state), CSV export button

### Step 19: Public Website & Brand Assessment
- Public Site Worker: static landing page on lrxradar.com
- Hero section: AI-powered threat intelligence messaging, domain input CTA
- Agent showcase: five agent cards with names and one-line descriptions
- How it works: three-step visual (Enter domain → Agents scan → Get score)
- Sample Trust Score display
- Brand Assessment engine: DNS/MX/SPF/DKIM/DMARC checks, SSL/TLS validation, security headers scan
- Threat intelligence overlay: query platform D1 for impersonation/phishing counts against scanned domain
- Trust Score algorithm: weighted composite (Section 9), 0-100 with A-F grade
- Results page: score, grade, brief summary, 3-4 risk indicators (no detail)
- Lead gate: business email form (reject freemail), lead creation in D1, full report stored in background
- Cloudflare Turnstile bot protection, rate limiting (3 scans/IP/24h), result caching

### Step 20: Hardening & Testing
- Security headers on all responses (HSTS, CSP, X-Frame-Options, etc.)
- Rate limiting on auth endpoints (5/min/IP), API read (100/min/user), API write (20/min/user)
- CORS lockdown to lrxradar.com only
- Feed anomaly detection: volume spike alerting
- Input validation and parameterized queries audit
- End-to-end testing: auth flow → feed ingestion → map rendering → admin operations → assessment → lead capture
- Staging environment smoke test
- Production deployment

### Post-MVP: Enhancement Steps (build when ready, in any order)

**Evidence Capture**
- Evidence Worker: screenshot capture, HTML archive, WHOIS/DNS/SSL snapshots
- Evidence queue with priority tiers, R2 storage, chain-of-custody metadata
- Evidence viewer UI, download bundle

**Custom Alerts & Watchlists**
- Watchlist data model and UI, inline matching during ingestion
- Alert rules engine with condition types and action delivery
- Notification center with bell icon and push notifications

**Multi-Tenant & Client Onboarding**
- Tenant model, brand scoping, isolation middleware
- Lead-to-client conversion flow, onboarding dashboard
- MSSP portfolio view, plan tier feature gates

**Mobile & PWA**
- PWA manifest, Service Worker, responsive layout
- Mobile Observatory with bottom sheets, tablet hybrid layout
- Web Push notifications

**Provider Feed Expansion**
- Cloudflare Radar/URL Scanner/Intel APIs
- VirusTotal, Spamhaus, AlienVault OTX, GreyNoise, Hunt.io
- URLhaus, OpenPhish additional feeds

**Reporting**
- PDF generation pipeline (Puppeteer on Railway)
- Brand Threat Report and Executive Summary templates
- Scheduled delivery via email

**Revenue Infrastructure**
- Stripe billing integration
- STIX/TAXII 2.1 server endpoint
- Webhook push system for SIEM integration
- Paid provider feeds (Mimecast, Proofpoint, Recorded Future, DomainTools)
- Remediation engine activation
- API documentation portal
- White-label reports for MSSP

---

## 14. What Makes This Different

The competitive gap Trust Radar exploits:

**Bolster, Netcraft, etc.** — Reactive. Client-dependent. They monitor what they're told to monitor. They don't see the ecosystem. They don't track infrastructure trends. They can't tell you that the hosting provider you took down a phishing site on last week is actually improving while a different provider is becoming the new haven.

**Trust Radar** — Proactive. Ecosystem-aware. We see the whole board. We know which brands are being hit before they do. We know which hosting providers are the worst actors and how that's changing. We can spot campaign-level coordination that single-brand tools miss entirely. And when a brand wants protection, we're not starting from scratch — we've been watching their threat landscape since before they called.

The outside-in model means our intelligence gets better with time regardless of client count. Every feed we ingest, every correlation we make, every trend we track adds to a growing intelligence picture that no single-brand-focused tool can replicate.

**The provider feed advantage** — By pulling from Cloudflare's own Radar and Intel APIs, Google/VirusTotal, Spamhaus, AlienVault OTX, and others, Trust Radar cross-references every threat against multiple independent intelligence sources. A single phishing domain flagged by CT logs gets validated against VirusTotal's 70+ engines, checked against Spamhaus' domain blocklist, enriched with Cloudflare's passive DNS history, and contextualized with AlienVault campaign data. No single feed tells the whole story. The synthesis is the product.

---

## 15. v1 Decommission & Archive Plan

The existing Trust Radar codebase in the `github.com/cleerox-svg/trust-radar` monorepo must be cleanly archived before v2 development begins. Claude Code will be working in this repo — if v1 code remains in the active tree, it will influence generation, create naming collisions, and pull in deprecated patterns.

### 15.1 What Exists Now

The current repo contains:
- A single-file Cloudflare Worker (`trust-radar/src/worker.js`) embedding the full SPA — HTML, CSS, JS, API routes, D1 schema, and Leaflet map all inline
- `wrangler.toml` with route bindings for `lrxradar.com`
- D1 database bindings with existing schema (scans, entities, trust scores, alerts, dead letter queue)
- The imprsn8 companion worker (`imprsn8/src/worker.js`) with its own embedded SPA
- `PLATFORM_DESIGN_BRIEF.md` and other planning documents
- `setup.py` self-extraction bootstrap script

### 15.2 Archive Procedure

**Step 1: Create archive branch**

```
git checkout main
git checkout -b archive/v1-trust-radar
git push origin archive/v1-trust-radar
```

This preserves the entire v1 codebase on a named branch that can be referenced but won't interfere with `main`.

**Step 2: Tag the last v1 commit**

```
git tag v1.0-final -m "Final state of Trust Radar v1 before v2 overhaul"
git push origin v1.0-final
```

**Step 3: Clear the working tree on main**

```
git checkout main
```

Remove the following from the active tree:
- `trust-radar/src/worker.js` (the monolith SPA worker)
- `trust-radar/src/` directory entirely
- Any v1-specific config, seed data, or test files
- Old design documents (`PLATFORM_DESIGN_BRIEF.md`, earlier design specs)

Keep:
- `trust-radar/wrangler.toml` (will be modified for v2 but the structure is useful)
- `trust-radar/` directory itself (v2 builds here)
- Repo-level files (`.gitignore`, `README.md` — to be rewritten for v2)
- The imprsn8 directory (separate platform, not part of this overhaul)

**Step 4: Clean README**

Replace `README.md` with a v2 header:

```markdown
# Trust Radar v2

Threat Intelligence Observatory — Outside-In Brand Protection

## Status
v2 development in progress. See trust-radar-v2-plan.md for the full platform plan.

## v1 Archive
The previous version is preserved on `archive/v1-trust-radar` branch and tagged `v1.0-final`.
```

**Step 5: Commit the clean slate**

```
git add -A
git commit -m "Clean slate for Trust Radar v2 — v1 archived to archive/v1-trust-radar branch"
git push origin main
```

**Step 6: Upload the v2 plan**

Copy `trust-radar-v2-plan.md` into the repo root. This becomes the single source of truth that Claude Code references for all implementation decisions.

### 15.3 D1 Database Cleanup & Fresh Start

The existing D1 database contains stale v1 data (scans, entities, trust_scores, alerts, dead_letter_queue). This data is incompatible with v2 and must not carry over.

**Step 1: List existing D1 databases**

```
wrangler d1 list
```

Note the database names and IDs from v1.

**Step 2: Delete old D1 databases**

```
wrangler d1 delete trust-radar-db        # or whatever the v1 database name is
wrangler d1 delete trust-radar-db-audit   # if a separate audit DB existed
```

If `wrangler d1 delete` prompts for confirmation, confirm. All v1 data is lost — this is intentional. The v1 code is preserved on the archive branch if you ever need to reference the old schema.

If you cannot delete (e.g., name conflicts or permissions), you can leave the old databases unbound — just don't reference them in the v2 `wrangler.toml`.

**Step 3: Create fresh D1 databases for v2**

```
wrangler d1 create trust-radar-v2
wrangler d1 create trust-radar-v2-audit
```

Record both database IDs from the output. They go into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "trust-radar-v2"
database_id = "<paste-id-here>"

[[d1_databases]]
binding = "AUDIT_DB"
database_name = "trust-radar-v2-audit"
database_id = "<paste-id-here>"
```

**Step 4: Verify clean state**

```
wrangler d1 list
```

You should see only the two new v2 databases. No tables exist yet — the v2 migration scripts (Step 1 of the build sequence) will create the schema.

### 15.4 Instructions for Claude Code

When starting v2 development, the prompt to Claude Code should include:

```
IMPORTANT: This is a clean v2 build. Do NOT reference, import, or inherit any
patterns from the v1 codebase (archived on archive/v1-trust-radar branch).

The v2 plan is in trust-radar-v2-plan.md at the repo root. This is the single
source of truth for all architecture, data model, API, and UI decisions.

Key differences from v1:
- v1 was a single embedded SPA in one worker.js file
- v2 uses separate Workers: Feed Ingest, API, UI, Public Site, Assessment Engine
- v1 had inline D1 schema. v2 uses migration files.
- v1 had no auth. v2 has Google OAuth + JWT + RBAC.
- v1 map data was simulated. v2 map data comes from API endpoints, never hardcoded.
- v1 used a flat signal/entity model. v2 uses threats/brands/providers/campaigns.

Do NOT:
- Copy CSS patterns, color variables, or font choices from v1
- Reuse v1 API route naming conventions
- Reference v1 D1 table names or column names
- Import any v1 JavaScript functions or utilities
```

### 15.5 DNS & Deployment

`lrxradar.com` is already pointed at Cloudflare. The v2 workers will bind to the same routes. During the transition:

1. Deploy v2 to a staging subdomain first (`staging.lrxradar.com`) using a Cloudflare Workers staging environment
2. Test end-to-end: auth flow, feed ingestion, map rendering, admin module
3. When ready, swap the production routes in `wrangler.toml` to point at v2 workers
4. The old v1 worker is automatically replaced — Cloudflare Workers are immutable per deployment

---

## 16. Integration Architecture

Trust Radar is designed to both consume and export threat intelligence. These integration hooks are designed into the data model and API now, even though most won't be activated until Phase 2 or Phase 3. The goal: no schema migrations or API rewrites when it's time to plug in.

### 16.1 Outbound: STIX/TAXII Export (Trust Radar as a Feed Provider)

Trust Radar's ultimate positioning isn't just a dashboard — it's an intelligence source that enterprise security teams can plug into their existing stack. STIX (Structured Threat Information eXpression) is the data format. TAXII (Trusted Automated eXchange of Intelligence Information) is the transport protocol. Together they're the industry standard for sharing threat intelligence with SIEMs, TIPs, and SOC tools.

**What we export as STIX 2.1 objects:**

| Trust Radar Entity | STIX Object Type | Key Properties |
|-------------------|-----------------|----------------|
| Threat | `indicator` | Pattern (domain, URL, IP), labels, confidence, valid_from/valid_until |
| Brand (as target) | `identity` | Name, sector, identity_class: "organization" |
| Campaign | `campaign` | Name, description, first_seen, last_seen, objective |
| Hosting Provider | `infrastructure` | Name, type: "hosting", infrastructure_types |
| AI Insight | `note` | Content, object_refs (linked entities), authors |
| Threat→Brand link | `relationship` | type: "targets", source_ref→target_ref |
| Threat→Provider link | `relationship` | type: "hosted-on", source_ref→target_ref |
| Campaign→Threat link | `relationship` | type: "consists-of" |

**TAXII 2.1 Server endpoint (Phase 2):**

```
GET  /taxii2/                          → Discovery (server info)
GET  /taxii2/collections/              → List available collections
GET  /taxii2/collections/{id}/objects/ → Get STIX objects (with filters)
```

Collections we expose:
- `trust-radar-threats` — all active threat indicators
- `trust-radar-campaigns` — active campaigns with related objects
- `trust-radar-providers` — infrastructure objects for hosting providers
- `trust-radar-daily` — daily intelligence bundle (insights + new threats)

Authentication: API key-based, issued per subscriber through the Admin Module. Rate-limited per key.

**Simpler export formats (also Phase 2):**

- CSV export: threats table with all fields, filterable by date/brand/provider/type
- JSON bulk export: full threat + enrichment data as a downloadable JSON bundle
- IoC-only export: flat list of malicious domains/URLs/IPs for firewall blocklists

These are available through both the Admin UI (download button) and the API (`GET /api/v1/export/threats?format=csv&since=...`).

### 16.2 Outbound: SIEM Integration Hooks

Enterprise customers will want to pipe Trust Radar intelligence directly into their SIEM (Splunk, Microsoft Sentinel, IBM QRadar, Elastic Security, Chronicle). The STIX/TAXII endpoint covers the standard path, but we also design for direct integrations:

**Webhook Push (Phase 2)**

Instead of polling, subscribers can register a webhook URL. Trust Radar pushes events in near real-time:

```
POST /api/v1/webhooks
{
  "url": "https://customer-siem.example.com/ingest",
  "events": ["new_threat", "campaign_detected", "provider_alert", "daily_insight"],
  "format": "stix21" | "json" | "cef",
  "secret": "hmac-signing-secret"
}
```

Each push includes an HMAC signature header for verification. Retry logic: 3 attempts with exponential backoff. Dead webhook detection: disable after 10 consecutive failures, notify admin.

**Supported push formats:**

- `stix21`: STIX 2.1 bundle (for TIPs and TAXII-compatible systems)
- `json`: Trust Radar native JSON (for custom integrations)
- `cef`: Common Event Format (for ArcSight, QRadar, and legacy SIEMs)

**Syslog forwarding (Phase 3):**

For on-premise SIEMs that ingest via syslog: a lightweight forwarder that reads from the webhook push and writes CEF-formatted messages to a syslog endpoint. Runs as a Docker container the customer deploys in their environment.

**Webhook data model:**

```
webhooks
- id, subscriber_user_id, url, events (JSON array), format
- secret_hash, enabled, created_at
- last_delivery_at, last_status_code, consecutive_failures
```

### 16.3 Inbound: Paid Provider Feed Hooks

The feed ingestion architecture (Section 3) is designed so adding a new feed is a config change + a normalization function, not an architectural change. The following paid providers are anticipated for Phase 3 and their integration patterns are documented now:

**Mimecast (Email Security)**

- Integration type: REST API pull
- Data available: Targeted threat protection logs, URL protection events, impersonation attempts detected in email
- Relevance: Mimecast sees phishing and impersonation attempts at the email layer — a different vantage point from our domain/CT log monitoring. Cross-referencing their detections with ours reveals campaigns that span both email and web infrastructure.
- Auth: OAuth 2.0 (application-level), API key + secret
- Feed config: `source_url`, `client_id`, `client_secret`, `tenant_id`, polling interval
- Normalization: Map Mimecast threat types → Trust Radar threat types, extract target brand from email headers/content

**Proofpoint (Email Security)**

- Integration type: REST API pull (Proofpoint TAP — Targeted Attack Protection)
- Data available: Blocked/permitted clicks on malicious URLs, message-level threat data, threat families, campaign IDs
- Relevance: Proofpoint's TAP data includes the actual URLs users are clicking in phishing emails — these map directly to our threat table. Their campaign clustering can validate or complement our Strategist agent's correlation.
- Auth: API key (service principal), basic auth
- Feed config: `source_url`, `api_key`, `api_secret`, polling interval
- Normalization: Map TAP threat classifications → Trust Radar types, extract domains from clicked URLs

**Recorded Future / Mandiant / CrowdStrike (Commercial TI)**

- Integration type: STIX/TAXII pull or REST API
- Data available: Curated IoC feeds, actor profiles, malware intelligence, vulnerability data
- Relevance: High-confidence, analyst-curated intelligence that supplements our automated feeds. Particularly valuable for campaign attribution and actor profiling.
- Feed config: Standard TAXII client config (API root URL, collection ID, API key)
- Normalization: STIX objects map relatively directly to our data model

**DomainTools Iris (Domain Intelligence)**

- Integration type: REST API
- Data available: Deep domain intelligence — connected infrastructure mapping, domain risk scoring, registrant history, hosting history
- Relevance: The enrichment gold standard for domain investigation. When our CT log scanner flags a suspicious domain, DomainTools can tell us every other domain registered by the same entity.
- Auth: API key
- Feed config: On-demand enrichment (not scheduled polling), rate limited

**All paid feeds use the same ingestion architecture:**

Each gets a `feed_configs` entry in D1 (Section 7.4). The Feed Ingest Worker has a modular design where each feed has:
1. A fetch function (handles auth, pagination, rate limiting)
2. A normalization function (maps provider-specific schema → common Trust Radar schema)
3. Error handling and retry logic (configurable per feed)

Adding a new provider = writing the fetch + normalize functions and adding a feed_configs row. No changes to the Worker core, database schema, or API layer.

### 16.4 Inbound: Customer Data Import

When a brand becomes a paying client (Phase 3), they may want to import their own data:

- Historical abuse reports they've filed
- Internal brand monitoring data from their own tools
- Domain watchlists (specific domains they want tracked)
- Employee-reported phishing URLs

**Import API (Phase 3):**

```
POST /api/v1/import/threats
Authorization: Bearer <client_token>
Content-Type: application/json

{
  "source": "client_import",
  "brand_id": "...",
  "threats": [
    { "malicious_url": "...", "threat_type": "phishing", "first_seen": "...", "notes": "..." }
  ]
}
```

Client-imported data is tagged with `source_feed: 'client_import'` and the client's `user_id`. It enters the same enrichment pipeline as feed-sourced data but is scoped to the client's brand(s) in their view.

### 16.5 API Keys for External Consumers

For any outbound integration (STIX/TAXII, webhooks, CSV export, REST API), external consumers authenticate via API keys — not OAuth sessions.

**api_keys (data model)**

```
- id (UUID)
- key_hash (SHA-256 — raw key shown once on creation, never stored)
- name (human-readable label: "Splunk Production", "MSSP Partner Feed")
- user_id (which admin created it)
- permissions (JSON: which collections/endpoints this key can access)
- rate_limit (requests per minute)
- enabled (boolean)
- created_at, last_used_at, expires_at (nullable)
```

API keys are created and managed in the Admin Module under a new "API Keys" sub-section (added to Section 7). Each key has scoped permissions — a SIEM integration key might only access `/taxii2/` endpoints, while a partner key might access `/export/` endpoints.

All API key usage is audit-logged.

---

## 17. Operational Concerns

### 17.1 Environments

Two environments, both on Cloudflare:

- **Staging** (`staging.lrxradar.com`): Separate D1 databases, separate Workers, same codebase. Used for testing before production deployment. Seeded with synthetic data.
- **Production** (`lrxradar.com`): Live data, real feeds, real users.

`wrangler.toml` uses environment sections:

```toml
[env.staging]
name = "trust-radar-staging"
vars = { ENVIRONMENT = "staging", CORS_ORIGINS = "https://staging.lrxradar.com" }

[env.production]
name = "trust-radar-production"
vars = { ENVIRONMENT = "production", CORS_ORIGINS = "https://lrxradar.com" }
```

### 17.2 Deployment Strategy

Deployments via `wrangler deploy` (can be run from Codespaces or CI). Process:

1. Push to `main` branch
2. Deploy to staging: `wrangler deploy --env staging`
3. Smoke test: auth flow, feed pull, map render, admin access
4. Deploy to production: `wrangler deploy --env production`
5. Post-deploy verification: check feed health, confirm live data flowing

Future (Phase 2): GitHub Actions CI/CD pipeline — auto-deploy to staging on PR merge, manual promotion to production.

### 17.3 Backup & Data Recovery

**D1 databases:**
- Cloudflare D1 provides automatic point-in-time recovery (30-day retention on paid plan, best-effort on free)
- Nightly export: a scheduled Worker job exports critical tables (brands, threats, campaigns, users, feed_configs) as JSON to R2 storage
- R2 lifecycle policy: keep daily backups for 90 days, weekly for 1 year

**Audit log database:**
- Same backup schedule as primary, stored in a separate R2 bucket
- Audit data is append-only and never modified, so backups are always complete

**Recovery procedure:**
- D1 point-in-time restore for database corruption or accidental deletion
- R2 JSON import for full reconstruction if needed
- Documented in a runbook stored in the repo (`docs/disaster-recovery.md`)

### 17.4 Data Retention Policy

Not all data should live forever. Storage costs scale, query performance degrades, and some data has diminishing intelligence value over time.

| Data Type | Retention | After Expiry |
|-----------|-----------|-------------|
| Active threats | Indefinite while active | Moves to archive on status change |
| Archived threats | 2 years | Deleted (summary stats preserved in daily_snapshots) |
| Daily snapshots | 5 years | Aggregated to monthly, originals deleted |
| Feed pull history | 90 days | Deleted |
| Audit log | 3 years | Archived to R2 cold storage |
| Assessments (full report) | 1 year | Summary preserved, detail JSON deleted |
| Leads | Indefinite (active), 2 years (closed) | Anonymized after retention |
| Sessions | 30 days after expiry | Deleted |
| Invitations | 90 days after expiry/acceptance | Deleted |

A scheduled Worker job runs weekly to enforce retention. All deletions are audit-logged.

### 17.5 Monitoring & Alerting

Trust Radar monitors its own health — not just the threat landscape.

**What we monitor:**

- Feed health: per-feed success rate, latency, record counts (from feed_pull_history)
- API Worker: response times, error rates (Cloudflare Analytics)
- D1 database: query latency, storage usage
- Auth: failed login rate, unusual session patterns
- Assessment engine: scan queue depth, scan failures
- AI analysis: Haiku API response times, token usage, job failures

**Alert channels (Phase 2):**

- Email to Super Admin on: feed down >15 minutes, auth brute force detected, D1 approaching storage limit
- Webhook to Slack/Discord: same alerts plus daily health summary
- In-platform: Admin dashboard shows system events, red indicators on degraded feeds

### 17.6 Error Handling Strategy

Every Worker follows the same error handling contract:

- External API calls (feeds, Haiku, enrichment): try/catch with retry. Log error to `feed_pull_history` or a general error table. Never let one feed failure cascade to others.
- User-facing API endpoints: return structured error JSON `{ error: true, code: "ERR_...", message: "..." }` with appropriate HTTP status codes. Never expose stack traces or internal state.
- D1 writes: wrap in transactions where supported. If a batch insert partially fails, log which records failed and why, continue with the rest.
- Auth failures: return 401 with generic message. Log the specifics (IP, attempted user, failure reason) to audit log. Never reveal whether a user exists or not.

### 17.7 API Versioning

All API endpoints are versioned from day one: `/api/v1/...`

When breaking changes are needed (Phase 2+), we add `/api/v2/` endpoints while keeping v1 operational for a deprecation period. This matters most for external integrations (SIEM, TAXII subscribers, API key consumers) that can't be updated on our timeline.

### 17.8 Privacy & Compliance Considerations

Trust Radar processes publicly available data (CT logs, phishing feeds, DNS records) — not personal data. However:

- **Lead data** (from Brand Assessment) contains business contact information. Stored in D1 with access restricted to Admin+ roles. Covered by a privacy policy on the public site.
- **User data** (Google OAuth profile) is minimal: email, name, Google sub ID. No passwords stored. No unnecessary profile data collected.
- **IP addresses** are logged in audit trail and sessions — legitimate security interest.
- **GDPR consideration**: if Trust Radar serves EU clients (Phase 3), lead data and user data need a lawful basis (legitimate interest for security, consent for marketing). Data retention policy (Section 17.4) supports right-to-erasure requests.
- **No PII in threat data**: malicious URLs, domains, and IPs are not personal data. Registrant data from WHOIS may include names — this is already public information, but we don't display it prominently and we comply with RDAP redaction policies.

---

## 18. Client Onboarding & Multi-Tenant Architecture

Trust Radar sells to two audiences simultaneously: brands directly and MSSPs/resellers who manage multiple brands. The multi-tenant model must support both from day one — retrofitting tenant isolation later is an architectural rewrite.

### 18.1 Tenant Model

A **tenant** is a paying entity. A tenant can be a single brand or an MSSP that manages many brands.

**tenants**

- `id` (UUID)
- `name` — company name ("Acme Corp" or "SecureOps MSSP")
- `type` (enum: `brand`, `mssp`, `internal`) — internal = Trust Radar's own operational view
- `plan` (enum: `starter`, `professional`, `enterprise`, `mssp`) — drives feature gates
- `status` (enum: `trial`, `active`, `suspended`, `churned`)
- `primary_contact_user_id` — references users.id
- `billing_email`
- `created_at`, `trial_expires_at`, `activated_at`
- `settings` (JSON) — tenant-specific config: notification preferences, branding, report frequency

**tenant_brands** (which brands a tenant owns/manages)

- `tenant_id`, `brand_id`
- `relationship` (enum: `owner`, `managed`) — owner = it's their brand; managed = MSSP is watching it for them
- `added_at`, `added_by`

**User-to-tenant binding:**

The existing `users` table gets a new column: `tenant_id` (nullable — null = internal Trust Radar staff with global access). Every user belongs to exactly one tenant. The RBAC system is extended:

| Role | Tenant Type | See What |
|------|-------------|----------|
| Super Admin | internal | Everything — all tenants, all data, all admin |
| Admin | internal | Everything — operational access |
| Analyst | internal | All threat data — no admin functions |
| Tenant Admin | brand or mssp | Only their tenant's brands and associated threats |
| Tenant Analyst | brand or mssp | Only their tenant's brands, read-only |
| Tenant Viewer | brand or mssp | Dashboard only, no drill-down, no exports |

**Data isolation enforcement:**

Every API query that returns threat data includes a tenant filter. This is enforced at the API middleware layer, not in individual endpoint handlers — so forgetting to filter in one endpoint doesn't leak data.

```
Middleware logic:
1. Extract user from JWT
2. Look up user.tenant_id
3. If tenant_id is null (internal): no filter applied — sees all data
4. If tenant_id exists: look up tenant_brands for this tenant
5. Inject brand_id filter into every downstream query
6. Endpoints that return provider/campaign data: filter to only show
   providers/campaigns that have threats against this tenant's brands
```

An MSSP with 20 managed brands sees threat data across all 20, but nothing outside those 20. They can switch context between brands or see an aggregate view.

### 18.2 Lead-to-Client Conversion Flow

This is what happens after the sales call succeeds and a lead becomes a paying client.

**Step 1: Sales marks lead as "Converted" in Admin**

The lead status changes to `converted`. The admin is prompted to create a tenant.

**Step 2: Tenant provisioning**

A "Provision Client" flow in the Admin Module:

- Pre-fills company name and domain from the lead/assessment data
- Admin selects tenant type (brand or mssp) and plan tier
- System creates the tenant record
- System matches or creates the brand record (from the assessed domain)
- System links the brand to the tenant via `tenant_brands`
- System generates an invitation for the client's primary contact (email from lead data)
- System copies the full assessment report into the client's accessible data

**Step 3: Client receives invitation**

Standard invite flow (Section 11) — token link via email, Google OAuth, account created with `tenant_admin` role scoped to their tenant.

**Step 4: Client onboarding dashboard**

First-login experience for new tenant users:

- Welcome screen with their Trust Score and grade prominently displayed
- "Here's what we already know" — summary of active threats against their brand
- Quick tour overlay (3-4 steps showing the key views)
- Prompt to add additional domains or brand variants to monitor
- Prompt to invite team members (Tenant Admin can invite Tenant Analysts and Viewers)

**Step 5: Ongoing monitoring begins**

The client's brand was already being tracked by Trust Radar before they signed up — that's the whole point. On conversion, nothing changes in the data pipeline. The brand just gets a `tenant_brands` entry that makes its data visible to the client's users.

### 18.3 MSSP Partner Model

MSSPs are a force multiplier — one MSSP sale can mean 10-50 brands onboarded.

**MSSP-specific features:**

- **Brand portfolio view**: Aggregate dashboard showing all managed brands ranked by risk, with a heat bar showing relative exposure. Click into any brand for the standard brand detail view.
- **Client report generation**: Generate per-brand PDF reports branded with the MSSP's own logo (white-label option on enterprise/mssp plan).
- **Sub-user management**: MSSP's Tenant Admin can create Tenant Analysts scoped to specific brands within the portfolio (e.g., analyst A sees brands 1-5, analyst B sees brands 6-10).
- **Consolidated billing**: Single invoice for all managed brands, with per-brand line items.

**MSSP data model addition:**

```
tenant_user_brand_scopes (optional per-user brand filtering within an MSSP)
- user_id, brand_id
- If no rows exist for a user: they see all tenant brands (default for Tenant Admin)
- If rows exist: they see only the specified brands (for scoped Tenant Analysts)
```

### 18.4 Plan Tiers & Feature Gates

Not all features are available to all plans. The feature gate is a simple permissions map checked at the API layer.

| Feature | Starter | Professional | Enterprise | MSSP |
|---------|---------|-------------|-----------|------|
| Brand Assessment score | Yes | Yes | Yes | Yes |
| Observatory view (own brands) | Yes | Yes | Yes | Yes (all managed) |
| Active threat count | 100 max | Unlimited | Unlimited | Unlimited |
| Brand detail drill-down | Basic | Full | Full | Full |
| Provider analysis | No | Yes | Yes | Yes |
| Campaign view | No | No | Yes | Yes |
| Trend Explorer | No | Limited (30d) | Full | Full |
| STIX/TAXII export | No | No | Yes | Yes |
| Webhook integrations | No | 1 | Unlimited | Unlimited |
| API keys | 0 | 1 | 5 | 10 |
| Custom alert rules | 3 | 10 | Unlimited | Unlimited |
| Watchlists | 1 | 5 | Unlimited | Unlimited per brand |
| Scheduled reports | No | Weekly | Daily + custom | Per-brand |
| Evidence archive access | No | 30 days | 1 year | 1 year |
| Remediation (when available) | No | No | Yes | Yes |
| White-label reports | No | No | No | Yes |
| Users per tenant | 2 | 5 | 25 | 50 |
| Managed brands | 1 | 1 | 1 | Up to 50 |

Feature gates are stored as a `plan_features` config (JSON in D1 or hardcoded map in the API Worker). The API checks `user.tenant.plan` against the feature map before executing gated endpoints.

### 18.5 Billing Integration (Phase 3)

Trust Radar doesn't build a billing system — it integrates with Stripe.

- Stripe Customer mapped to tenant
- Stripe Subscription mapped to plan tier
- Stripe webhooks for: subscription created, payment succeeded, payment failed, subscription cancelled
- On payment failure: tenant status → `suspended` after grace period (7 days). Suspended tenants can log in but see a "payment required" banner and can't access new data.
- On cancellation: tenant status → `churned` after subscription end date. Data retained for 90 days, then deleted per retention policy.
- MSSP billing: metered per managed brand count, reconciled monthly

Data model addition:

```
tenant_billing
- tenant_id, stripe_customer_id, stripe_subscription_id
- plan, billing_cycle (monthly/annual), mrr (monthly recurring revenue)
- last_payment_at, next_payment_at, status
```

This is Phase 3 — MVP clients are manually provisioned. But the tenant model supports it from day one.

---

## 19. Custom Alert Rules & Watchlists

The platform generates intelligence, but users need to define what matters to them specifically. Alert rules and watchlists are the personalization layer.

### 19.1 Watchlists

A watchlist is a user-defined list of specific domains, keywords, or patterns to monitor beyond what the automated feeds catch.

**watchlists**

- `id` (UUID)
- `tenant_id`, `created_by` (user_id)
- `name` — human-readable ("Competitor domains", "Known bad registrars", "CEO name variants")
- `type` (enum: `domain`, `keyword`, `registrar`, `asn`, `ip_range`)
- `items` (JSON array) — the actual watchlist entries
- `match_mode` (enum: `exact`, `contains`, `regex`) — how items are matched against incoming data
- `enabled`, `created_at`, `updated_at`

**Examples:**

- Domain watchlist: `["paypa1.com", "paypal-secure.net", "paypal-*.xyz"]` with `contains` matching
- Keyword watchlist: `["paypal", "pay-pal", "pаypal"]` (note: includes homoglyph variants) matched against CT log common names and phishing URL paths
- Registrar watchlist: `["Tucows", "Namecheap"]` — alert when new threats use these registrars
- ASN watchlist: `["AS22612", "AS16276"]` — monitor specific hosting providers

**How watchlists integrate with the pipeline:**

The Feed Ingest Worker, after normalizing each signal, runs it against all active watchlists:

1. Query active watchlists from D1 (cached in Worker memory, refreshed every 5 minutes)
2. For each incoming signal, check against each watchlist's items using the specified match_mode
3. On match: tag the threat with `watchlist_match: [watchlist_id, ...]` and trigger any associated alert rules

This is lightweight — the watchlist check happens inline during ingestion, not as a separate batch job. For regex matching, patterns are pre-compiled and cached.

**Watchlist UI (in platform, accessible to Analyst+ and Tenant users):**

- "Watchlists" tab in the nav (or sub-tab under Brands)
- Create/edit modal: name, type selector, items list (textarea, one per line), match mode
- Watchlist detail: shows recent matches with links to the matched threats
- Per-plan limits enforced (see Section 18.4)

### 19.2 Alert Rules

An alert rule defines: "When X happens, notify me via Y."

**alert_rules**

- `id` (UUID)
- `tenant_id`, `created_by` (user_id)
- `name` — "PayPal critical threat spike", "New campaign targeting us"
- `enabled`, `created_at`, `updated_at`

**Conditions (JSON — what triggers the alert):**

```json
{
  "type": "threshold",
  "metric": "threat_count",
  "entity_type": "brand",
  "entity_id": "brand-uuid-here",
  "operator": ">=",
  "value": 50,
  "window": "24h"
}
```

Supported condition types:

| Type | Description | Example |
|------|-------------|---------|
| `threshold` | Metric exceeds value in time window | "PayPal threats >= 50 in 24h" |
| `new_campaign` | A new campaign is detected targeting a specific brand or any tenant brand | "New campaign targets any of our brands" |
| `watchlist_match` | A watchlist entry matches an incoming signal | "Domain watchlist 'competitors' got a hit" |
| `provider_shift` | A hosting provider's threat trend changes direction | "OVH trend flipped from improving to degrading" |
| `new_impersonation` | A new typosquat or lookalike domain is detected for a brand | "New domain resembling our brand appeared in CT logs" |
| `severity_escalation` | A threat's confidence score or severity increases | "Any threat upgraded to critical" |
| `feed_down` | A data feed goes unhealthy (for admins) | "CT Log feed is down" |

**Actions (JSON array — what happens when triggered):**

```json
[
  { "type": "email", "recipients": ["user-uuid-1", "user-uuid-2"] },
  { "type": "webhook", "url": "https://hooks.slack.com/...", "format": "json" },
  { "type": "in_platform", "priority": "high" }
]
```

Supported action types:

- `email`: Send alert email to specified users (must be within the same tenant)
- `webhook`: POST to a URL with alert payload (uses the same webhook signing as Section 16.2)
- `in_platform`: Creates a notification in the platform's notification center (see 19.3)
- `sms` (Phase 3): SMS via Twilio or similar for critical-only alerts

**Alert evaluation:**

A scheduled Worker job runs every 5 minutes:

1. Load all active alert rules
2. For each rule, evaluate the condition against current data
3. If condition met and rule hasn't fired within its cooldown period (default: 1 hour, configurable): trigger the actions
4. Log the alert firing to `alert_history`

**alert_history**

- `id`, `rule_id`, `fired_at`, `condition_snapshot` (JSON — the data that triggered it)
- `actions_taken` (JSON — which actions succeeded/failed)
- `acknowledged_by` (nullable user_id), `acknowledged_at`

**Alert Rules UI:**

- "Alerts" section in nav (or sub-tab accessible to all roles)
- Rule builder: step-by-step form — pick condition type, configure parameters, add actions
- Alert history: table showing recent firings with acknowledge button
- Per-plan limits enforced

### 19.3 Notification Center

An in-platform notification system for real-time awareness.

**notifications**

- `id`, `user_id` (recipient), `tenant_id`
- `type` (enum: `alert`, `system`, `insight`, `lead`)
- `title`, `body`, `severity` (critical/high/medium/info)
- `related_entity_type`, `related_entity_id` — what this notification links to
- `read_at` (nullable), `created_at`

**UI:**

- Bell icon in the topbar with unread count badge
- Dropdown panel showing recent notifications, grouped by today/yesterday/older
- Each notification is clickable — navigates to the related entity (threat, brand, campaign, alert rule)
- "Mark all read" button
- Notifications page (`/notifications`) with full history and filters

**Push to mobile (Phase 2+):**

- Service Worker + Web Push API for browser notifications (works on mobile browsers)
- Progressive Web App (PWA) manifest so the platform can be "installed" on mobile home screen

---

## 20. Evidence Capture & Preservation

When a phishing site or impersonation domain is discovered, the evidence has a half-life. Sites go down, WHOIS records change, pages get modified. Evidence captured at discovery time is what holds up in abuse reports, legal proceedings, and client proof-of-value presentations.

### 20.1 What Gets Captured

For every threat that crosses a confidence threshold (configurable, default ≥ 60), the Evidence Worker captures:

**Screenshot** — Full-page screenshot of the malicious URL as rendered in a headless browser.
- Tool: Cloudflare Browser Rendering API (available to Workers) or Puppeteer on Railway
- Stored as PNG in R2
- Multiple viewport sizes: desktop (1440px) and mobile (375px)

**HTML Archive** — The complete page source of the malicious URL at time of discovery.
- Raw HTML saved to R2
- Inline CSS and JS included (not just the HTML skeleton)
- This preserves the phishing kit's visual presentation even after the site goes down

**WHOIS/RDAP Snapshot** — Domain registration data at time of discovery.
- Registrar, creation date, nameservers, registrant info (where available)
- Stored as JSON in the threat record's `evidence` field

**DNS Snapshot** — Full DNS record set for the domain at time of discovery.
- A, AAAA, MX, NS, TXT, CNAME records
- Stored as JSON

**SSL Certificate Details** — The certificate chain for the domain.
- Issuer, subject, SANs, validity dates, fingerprint
- Stored as JSON

**HTTP Headers** — Response headers from the malicious URL.
- Server, X-Powered-By, redirects, cookies
- Useful for fingerprinting phishing kits

### 20.2 Evidence Data Model

**threat_evidence**

- `threat_id` (references threats.id)
- `captured_at` (timestamp)
- `screenshot_desktop_key` (R2 object key)
- `screenshot_mobile_key` (R2 object key)
- `html_archive_key` (R2 object key)
- `whois_snapshot` (JSON)
- `dns_snapshot` (JSON)
- `ssl_snapshot` (JSON)
- `http_headers` (JSON)
- `capture_status` (enum: `pending`, `complete`, `partial`, `failed`)
- `failure_reason` (nullable — why capture failed, e.g., "site already down")

Evidence is linked to the threat, not duplicated. If a threat is observed across multiple feeds, there's one evidence capture.

### 20.3 Evidence Worker

A dedicated Worker (or Railway background job) that processes the evidence capture queue.

**Flow:**

1. Feed Ingest Worker writes a new threat to D1 with `confidence_score >= 60`
2. It also writes a row to `evidence_queue`: `{ threat_id, malicious_url, priority }`
3. Evidence Worker polls the queue every 30 seconds
4. For each queued item, it attempts all captures in parallel
5. Results are written to `threat_evidence`
6. Queue item is marked complete or failed with reason
7. Failed captures retry up to 3 times over 1 hour (sites may come online intermittently)

**Priority tiers:**

- Critical/high confidence threats: captured within 2 minutes
- Medium confidence: captured within 15 minutes
- Low confidence: captured within 1 hour
- Watchlist matches: captured immediately regardless of confidence

### 20.4 Evidence Viewer (in platform)

Accessible from the threat detail view — click any threat to see its evidence package.

**Layout:**

- Screenshot gallery: Desktop and mobile side by side, zoomable, with timestamp
- HTML archive: "View preserved page" button opens the archived HTML in a sandboxed iframe (CSP locked down — no external requests, no scripts execute)
- Technical details: Tabs for WHOIS, DNS, SSL, HTTP headers — each rendered as a formatted table
- Evidence timeline: If a threat has been re-captured (e.g., the page changed), show each capture as a point on a timeline so you can see how the phishing site evolved
- Download package: "Download Evidence Bundle" button creates a ZIP containing all captures, timestamps, and a chain-of-custody metadata file (for legal use)

**Chain-of-custody metadata file (included in download):**

```json
{
  "platform": "Trust Radar",
  "version": "2.0",
  "threat_id": "...",
  "malicious_url": "...",
  "captured_at": "2026-03-13T14:32:08Z",
  "capture_method": "Cloudflare Browser Rendering / automated headless capture",
  "integrity": {
    "screenshot_sha256": "...",
    "html_sha256": "...",
    "metadata_sha256": "..."
  },
  "feed_source": "PhishTank",
  "first_seen": "...",
  "target_brand": "PayPal",
  "hosting_provider": "Namecheap",
  "ip_address": "...",
  "asn": "AS22612"
}
```

SHA-256 hashes of all evidence files are computed at capture time and stored in the metadata. This allows anyone to verify that evidence files haven't been tampered with since capture.

### 20.5 Evidence Retention

Evidence files in R2 follow the data retention policy (Section 17.4) but with extended retention for client-associated threats:

- Internal (no client): 90 days, then deleted
- Client brand threats (Starter/Professional): 30 days / 1 year per plan
- Client brand threats (Enterprise/MSSP): 1 year
- Evidence associated with active remediation cases: retained until remediation is closed + 1 year

### 20.6 Evidence in Abuse Reports & Remediation

When the remediation engine (Section 8) is activated for a client, the evidence package is automatically attached to abuse reports:

- Screenshot + archived URL included in hosting provider abuse emails
- WHOIS snapshot referenced in registrar takedown requests
- SSL details included in CA revocation requests
- Chain-of-custody file demonstrates automated, timestamped, tamper-evident capture — strengthens the report's credibility

---

## 21. Mobile Experience

Trust Radar requires a full mobile experience — not a responsive afterthought. Analysts in the field, executives checking threat status, MSSP operators managing client portfolios — all need to access the platform from their phones.

### 21.1 Approach: Progressive Web App (PWA)

Trust Radar ships as a PWA, not a native app. This avoids app store overhead while providing near-native mobile functionality:

- **Installable**: Add to home screen on iOS and Android. Launches without browser chrome.
- **Offline-capable** (Phase 2): Service Worker caches the app shell. Offline mode shows last-fetched data with a "stale data" indicator.
- **Push notifications**: Web Push API for alert delivery (see Section 19.3).
- **Single codebase**: Same Cloudflare Worker serves desktop and mobile — responsive layout, not a separate app.

PWA manifest and Service Worker registration added to the UI Worker.

### 21.2 Mobile Layout Strategy

The desktop layout (map + sidebar) doesn't scale down — it has to transform.

**Mobile breakpoint: < 768px**

The layout becomes a single-column stack with a bottom tab bar for navigation:

```
┌──────────────────────┐
│ Topbar (compact)     │  Logo + notification bell + avatar
├──────────────────────┤
│                      │
│  Active View         │  Full-width, scrollable
│  (Map / Brands /     │
│   Providers / etc.)  │
│                      │
├──────────────────────┤
│ ● ● ● ● ●           │  Bottom tab bar (5 icons)
└──────────────────────┘
```

**Bottom tab bar icons:**

1. Observatory (map icon) — default view
2. Brands (shield icon) — brand list
3. Alerts (bell icon) — notification center + alert rules
4. Intel (brain icon) — AI insights feed
5. More (menu icon) — providers, campaigns, trends, admin (if role permits)

### 21.3 Mobile Observatory (Map View)

The Leaflet map works well on mobile touch — pinch-to-zoom and pan are native. But the HUD chrome needs adaptation:

- **No sidebar**: The sidebar panels (brands, providers, insights) become swipeable bottom sheets. Swipe up from the bottom to reveal the intel panels. Swipe between them horizontally.
- **Stat bar**: Collapses to 2 chips visible (threats + campaigns), with horizontal scroll to see the rest.
- **HUD corners and scan line**: Hidden on mobile (too small to register visually).
- **Country tooltip**: Appears as a bottom sheet on marker tap instead of a floating panel.
- **Arc system**: Simplified on mobile — fewer particles, thinner arcs. Canvas rendering is heavier on mobile GPUs. Particle count reduced by 60% below 768px viewport width.

### 21.4 Mobile-Specific Interactions

- **Pull to refresh**: On all list views, pull down to re-fetch data
- **Haptic feedback**: On alert arrival and threat count increment (if device supports)
- **Swipe actions on list items**: Swipe right on a brand → quick view. Swipe left on an alert → acknowledge.
- **Long press on map marker**: Opens the full threat detail instead of tooltip
- **Share sheet**: Any threat, insight, or evidence screenshot can be shared via the native share sheet (useful for quick Slack/email sharing in the field)

### 21.5 Mobile Admin

The Admin Module is available on mobile but with a simplified layout:

- User management: List view with tap-to-expand detail (no side panel)
- Feed monitoring: Status cards in a vertical stack, tap for detail
- Leads: Table view only (Kanban doesn't work on narrow screens), with status pill selector for filtering
- Audit log: Simplified list, tap to expand details
- Invite users: Full modal flow works on mobile

### 21.6 Tablet Experience (768px — 1024px)

Tablet gets a hybrid layout:

- Map takes 65% width, sidebar takes 35%
- Bottom tab bar is hidden — full topbar nav is used
- Sidebar panels are collapsible
- This layout is ideal for sales demos and client presentations

---

## 22. Reporting & Scheduled Exports

Enterprise clients and MSSPs expect regular deliverables, not just a dashboard login.

### 22.1 Report Types

**Brand Threat Report (automated, scheduled)**

A per-brand summary covering a defined period. Includes:
- Trust Score and grade (if assessment exists)
- Active threat count and trend
- New threats discovered in period
- Top threat types breakdown
- Hosting provider distribution
- Campaign associations
- Key AI insights relevant to this brand
- Evidence screenshots for top threats (thumbnails with links)

Format: PDF, generated server-side. Branded with Trust Radar logo (or MSSP white-label logo on MSSP plan).

Schedule: Weekly (Professional), Daily + custom (Enterprise/MSSP).

**Executive Summary (automated, scheduled)**

For internal Trust Radar use or MSSP portfolio overview:
- Top 10 most targeted brands
- Provider reputation changes
- New campaigns detected
- Trend highlights
- Feed health summary

Format: PDF. Schedule: Weekly.

**On-Demand Assessment Report**

The full Brand Assessment report generated for sales use (already spec'd in Section 9). Can be regenerated on demand with fresh data.

### 22.2 Report Generation Pipeline

Reports are generated by a scheduled Railway job (not a Worker — PDF generation is CPU-heavy):

1. Cron trigger fires (nightly for daily reports, Sunday for weekly)
2. Job queries the API for all tenants with active report schedules
3. For each tenant+brand combination, fetch the relevant data via internal API calls
4. Render the report using a template engine (Puppeteer rendering HTML→PDF)
5. Store the PDF in R2 under `reports/{tenant_id}/{brand_id}/{date}.pdf`
6. Send email notification to tenant users with a secure download link
7. Log the report generation to audit trail

**report_schedules**

- `id`, `tenant_id`, `brand_id` (nullable — null = executive summary covering all brands)
- `frequency` (enum: `daily`, `weekly`, `monthly`)
- `day_of_week` (for weekly), `day_of_month` (for monthly)
- `recipients` (JSON array of user_ids)
- `template` (enum: `brand_threat`, `executive_summary`, `assessment`)
- `enabled`, `created_at`

**generated_reports**

- `id`, `schedule_id`, `tenant_id`, `brand_id`
- `period_start`, `period_end`
- `r2_key` — path to the PDF in R2
- `generated_at`, `emailed_at`

### 22.3 CSV & Bulk Export

For users who need raw data:

- Threat export: CSV with all fields, filterable by date/brand/provider/type
- IoC export: flat list of malicious domains/URLs/IPs (for firewall blocklist import)
- Campaign export: all campaign data with associated threats

Available via Admin UI download button and API endpoint (`GET /api/v1/export/...`). All exports are audit-logged and subject to plan-tier limits.

---

## 23. Platform Analytics & Documentation

### 23.1 Business Metrics Dashboard (Admin)

Trust Radar as a business needs to understand its own performance. A "Business" tab in the Admin Module:

- Assessments: scans per day/week, conversion rate (scan→lead), top scanned industries
- Leads: pipeline velocity (avg time in each stage), conversion rate (lead→client), revenue per lead
- Clients: active tenant count, MRR, churn rate, brands under management
- Platform engagement: DAU/WAU, avg session duration, most-used views, mobile vs desktop split
- Feed ROI: which feeds produce the most high-confidence threats, cost per enriched threat

Data sourced from existing tables (assessments, leads, tenants, audit_log) via aggregate queries. No new data collection needed — just views over existing data.

### 23.2 API Documentation

External consumers (SIEM integrations, MSSP partners, automation scripts) need published docs.

**Approach: Auto-generated OpenAPI spec**

The API Worker defines routes with typed schemas. An OpenAPI 3.1 spec is generated from these definitions and served at `/api/docs`.

- Interactive documentation (Swagger UI or Redoc) hosted at `lrxradar.com/docs`
- Authentication guide with API key creation walkthrough
- STIX/TAXII integration guide with examples for Splunk, Sentinel, and QRadar
- Webhook setup guide with payload examples and verification code samples
- Rate limit documentation per endpoint and per plan tier

Phase 2 delivery — MVP has internal documentation in the repo only.

### 23.3 In-Platform Help

A lightweight help system accessible from any view:

- `?` icon in the topbar opens a help panel
- Context-sensitive: shows help content relevant to the current view
- Search across help articles
- Links to full documentation for technical topics
- "Contact Support" → opens email to internal team (or ticketing system in Phase 3)

Help content stored as Markdown files in the repo, rendered in the UI. No external CMS dependency.

---

## 24. Implementation Wiring Guide for Claude Code

This section tells Claude Code exactly how to connect all the pieces. Without this, the tabs get built as isolated islands. This is the integration blueprint.

### 24.1 Application Architecture

Trust Radar is a single-page application served by a Cloudflare Worker. It uses client-side routing — the URL changes but the page never reloads. Every nav pill switch, every drill-down, every back button is a route change handled in JavaScript.

**Routing system:**

```
/                       → Observatory (Leaflet map + HUD + sidebar)
/brands                 → Brands Hub (Top Targeted / Monitored / All)
/brands/:brand_id       → Brand Detail (threats, map, providers, campaigns, timeline)
/providers              → Providers Hub (Worst / Improving / All)
/providers/:provider_id → Provider Detail (threats, brands, map, AI assessment, timeline)
/campaigns              → Campaigns Hub (Active / Dormant / Disrupted)
/campaigns/:campaign_id → Campaign Detail (AI assessment, infra map, threats, timeline)
/trends                 → Trend Explorer (dimension selector, charts, compare mode)
/agents                 → AI Agents (status cards, output feeds, health charts)
/admin                  → Admin Dashboard
/admin/users            → User & Role Management
/admin/feeds            → Feed Management
/admin/leads            → Lead Management
/admin/api-keys         → API Key Management
/admin/agent-config     → Agent Configuration
/admin/audit            → Audit Log Viewer
```

**Router implementation:**

Use a lightweight client-side router (no framework needed — Cloudflare Workers can't run React SSR). Options:
1. Hash-based routing (`#/brands/123`) — simplest, works everywhere, no server config needed
2. History API routing (`/brands/123`) — cleaner URLs, requires the Worker to serve `index.html` for all routes

Recommended: History API routing. The UI Worker catches all `GET` requests to non-API paths and returns the SPA shell. The client-side router reads `window.location.pathname` and renders the appropriate view.

```javascript
// Simplified router pattern
const routes = {
  '/': renderObservatory,
  '/brands': renderBrandsHub,
  '/brands/:id': renderBrandDetail,
  '/providers': renderProvidersHub,
  '/providers/:id': renderProviderDetail,
  '/campaigns': renderCampaignsHub,
  '/campaigns/:id': renderCampaignDetail,
  '/trends': renderTrends,
  '/agents': renderAgents,
  '/admin': renderAdminDashboard,
  // ...etc
};

function navigate(path) {
  history.pushState(null, '', path);
  const match = matchRoute(path);
  match.handler(match.params);
}

window.addEventListener('popstate', () => {
  const match = matchRoute(location.pathname);
  match.handler(match.params);
});
```

### 24.2 Shared Component Library

These components are used across multiple views. Build them ONCE and import everywhere:

**Topbar** — Logo, nav pills (highlight active based on current route), feed status, live tag, user avatar. The avatar shows user initials + a dropdown menu (Profile, Admin if role permits, Logout).

**Panel** — The `.panel` container with `.phead` (title + badge) and body. Used in every detail view, every sidebar, every admin section.

**Data Table** — Sortable, filterable, paginated table component. Takes column definitions and data rows as input. Used in: Brand threats, Provider threats, Campaign threats, All Brands, All Providers, Admin Users, Admin Feeds, Admin Leads, Admin Audit Log. Build it ONCE.

**Stat Card** — The aggregate metric card (value + label + sub). Used in: Observatory stat bar, Brands/Providers/Campaigns aggregate rows, Admin dashboard, Trend Explorer insights.

**Status Badge** — `active`/`down`/`monitoring`/`clean`/`new`/`degraded`/`error` badges. Used everywhere.

**Threat Type Pill** — `phishing`/`typosquat`/`impersonation`/`credential` colored pills. Used in every threats table and brand/campaign cards.

**Sparkline SVG** — Inline mini chart generated from a data array. Used in brand cards, provider cards, campaign cards.

**Bar Chart Row** — Horizontal bar with label, track, fill, and count. Used in brand provider breakdown, provider brand breakdown, campaign brand breakdown.

**Filter Pills** — Toggleable pill buttons for filtering. Used in every threats table and trend controls.

**Period Selector** — 7d/30d/90d/1y pills. Used in Brand/Provider/Campaign detail timelines and Trend Explorer.

**Modal** — Overlay modal with form. Used in Add Brand, Invite User, Create API Key, and various admin actions.

**Empty State** — "No data" message for any section that could be empty.

**Toast / Notification** — Brief feedback messages for actions (invite sent, brand added, config saved).

### 24.3 API Client

A single `api.js` module that handles all communication with the API Worker:

```javascript
const API_BASE = '/api/v1';

async function api(path, options = {}) {
  const token = getAccessToken(); // from session storage
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
  if (res.status === 401) {
    // Token expired — attempt refresh
    const refreshed = await refreshToken();
    if (refreshed) return api(path, options); // retry
    redirectToLogin();
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

Every view calls `api()` to fetch data. No view constructs its own fetch headers or handles auth.

### 24.4 Build Order

Claude Code should build in this order — each step depends on the previous:

**Phase 1: Foundation (must be first)**
1. D1 schema migration files — all tables from Sections 4, 6.9, 7.7
2. API Worker — auth middleware, RBAC middleware, base route handler
3. Google OAuth flow — token exchange, session creation, refresh rotation
4. API client module (`api.js`) — shared fetch wrapper with auth

**Phase 2: Data Pipeline**
5. Feed Ingest Worker — CT Log + PhishTank fetch, normalize, deduplicate, store
6. Enrichment pipeline — DNS resolution, IP-to-ASN mapping, WHOIS/RDAP
7. AI analysis jobs — Haiku integration for classification, brand matching

**Phase 3: API Endpoints (all endpoints before any UI)**
8. Dashboard endpoints (`/dashboard/*`)
9. Brand endpoints (`/brands/*`)
10. Provider endpoints (`/providers/*`)
11. Campaign endpoints (`/campaigns/*`)
12. Trend endpoints (`/trends/*`)
13. Agent endpoints (`/agents/*`)
14. Insight endpoints (`/insights/*`)
15. Admin endpoints (`/admin/*`)

**Phase 4: UI Shell**
16. UI Worker — serves SPA shell, client-side router, shared component library
17. Topbar, navigation, layout grid

**Phase 5: Views (order matches nav)**
18. Observatory (Leaflet map, heatmap, arc system, sidebar, stat bar)
19. Brands Hub + Brand Detail
20. Providers Hub + Provider Detail
21. Campaigns Hub + Campaign Detail
22. Trend Explorer
23. AI Agents view

**Phase 6: Admin**
24. Admin Dashboard
25. Users & Roles + Invitation system
26. Feed Management
27. Lead Management
28. API Key Management
29. Agent Configuration
30. Audit Log Viewer

**Phase 7: Public Site**
31. Public website Worker (landing page, agent showcase)
32. Brand Assessment engine
33. Lead capture form

### 24.5 State Management

No framework state manager needed. Simple patterns:

- **Current route state**: Managed by the router. Current path + params.
- **Auth state**: Access token in memory (never localStorage), refresh token as HttpOnly cookie.
- **View state**: Each view manages its own state (current sub-tab, filter selections, sort order, pagination offset). State is reset when navigating away.
- **Shared state**: Feed health status and notification count — polled on a 30-second interval, available to any view that needs it.

### 24.6 CSS Architecture

One CSS file. All views share the same CSS variables, typography classes, and component styles. No per-view CSS files.

The CSS custom properties defined in `:root` (Section 6.1) are the single source of truth for all colors, fonts, and spacing. If the design needs to change, changing the variables updates everything.

Class naming convention: Short, descriptive, no BEM. Keep it readable. The prototype HTML files use the exact class names Claude Code should use — don't rename them.

---

## 25. Manual Prerequisites & External Account Setup

These are the things that cannot be automated by Claude Code. You (the platform owner) must complete these steps manually, and some must be done BEFORE Claude Code starts building.

### 25.1 Before Development Starts

**REQUIRED — Block development without these:**

1. **Cloudflare Account** (you already have this)
   - Verify `lrxradar.com` is configured in Cloudflare DNS
   - Ensure Workers and D1 are available on your plan (free tier works)
   - No action needed if already set up

2. **Create D1 Databases**
   ```
   wrangler d1 create trust-radar-v2
   wrangler d1 create trust-radar-v2-audit
   ```
   Record the database IDs — they go in `wrangler.toml`

3. **Google Cloud Console — OAuth Client Setup**
   - Go to https://console.cloud.google.com/
   - Create a new project (or use existing): "Trust Radar"
   - Navigate to APIs & Services → Credentials
   - Create OAuth 2.0 Client ID:
     - Application type: Web application
     - Authorized JavaScript origins: `https://lrxradar.com`, `https://staging.lrxradar.com`
     - Authorized redirect URIs: `https://lrxradar.com/auth/callback`, `https://staging.lrxradar.com/auth/callback`
   - Copy the **Client ID** and **Client Secret**
   - These get stored as Cloudflare Workers secrets:
     ```
     wrangler secret put GOOGLE_CLIENT_ID
     wrangler secret put GOOGLE_CLIENT_SECRET
     ```

4. **Anthropic API Key (for Claude Haiku)**
   - Go to https://console.anthropic.com/
   - Create an API key with access to Claude Haiku
   - Store as Workers secret:
     ```
     wrangler secret put ANTHROPIC_API_KEY
     ```
   - Estimated usage: $5-10/month for MVP analysis volume

5. **JWT Signing Secret**
   - Generate a random 64-character hex string:
     ```
     openssl rand -hex 32
     ```
   - Store as Workers secret:
     ```
     wrangler secret put JWT_SECRET
     ```

6. **Invitation Email Delivery**
   - For MVP: Use a transactional email service. Options:
     - **Resend** (https://resend.com) — free tier: 100 emails/day. Simple API.
     - **Postmark** — free tier: 100 emails/month.
     - **SendGrid** — free tier: 100 emails/day.
   - Create an account, get an API key, store as:
     ```
     wrangler secret put EMAIL_API_KEY
     wrangler secret put EMAIL_FROM_ADDRESS  (e.g., noreply@lrxradar.com)
     ```
   - Configure DNS: Add SPF, DKIM, and DMARC records for `lrxradar.com` so emails don't land in spam. The email provider will give you the specific DNS records to add.

### 25.2 Before First Deployment

7. **Cloudflare Workers Secrets Summary**
   All secrets that must be set before the platform works:
   ```
   GOOGLE_CLIENT_ID       — from Google Cloud Console
   GOOGLE_CLIENT_SECRET   — from Google Cloud Console
   ANTHROPIC_API_KEY      — from Anthropic Console
   JWT_SECRET             — self-generated random hex
   EMAIL_API_KEY          — from email provider (Resend/Postmark/SendGrid)
   EMAIL_FROM_ADDRESS     — your sending email address
   ```
   Set each with: `wrangler secret put <NAME>` and paste the value when prompted.

8. **Create Your Super Admin Account**

   The very first user (you) needs to be bootstrapped manually since there's no invitation system sender yet. This is a one-time setup.

   **Step A: Get your Google `sub` claim**

   Your Google account has a unique, permanent identifier called the `sub` claim. This is what Trust Radar uses as your identity (not your email, which can change).

   To find your `sub`:
   - Go to https://accounts.google.com/.well-known/openid-configuration
   - Or use the Google OAuth Playground: https://developers.google.com/oauthplayground/
   - Authorize with the Google account you'll use for Trust Radar
   - Request the `openid` scope and decode the ID token — the `sub` field is your unique ID
   - It looks like a long numeric string: `104837261940283746591`

   Alternatively, after deploying the platform, the OAuth callback handler will receive the `sub` in the ID token. Claude Code should add a temporary debug log that prints the `sub` on first login attempt, so you can capture it from the Worker logs.

   **Step B: Run the seed script**

   Claude Code must generate a seed script (`scripts/seed-super-admin.js`) as part of the deployment. The script inserts your user record directly into D1:

   ```javascript
   // scripts/seed-super-admin.js
   // Run once: wrangler d1 execute trust-radar-v2 --command "SQL HERE"
   // Or use this script with wrangler d1 execute --file

   INSERT INTO users (
     id, google_sub, email, name, role, status, created_at, updated_at
   ) VALUES (
     'usr_00000000_superadmin',
     'YOUR_GOOGLE_SUB_CLAIM_HERE',   -- Replace with your actual sub
     'your-email@lrxradar.com',       -- Replace with your Google email
     'Your Name',                      -- Replace with your name
     'super_admin',
     'active',
     datetime('now'),
     datetime('now')
   );
   ```

   Run it:
   ```
   wrangler d1 execute trust-radar-v2 --file scripts/seed-super-admin.sql
   ```

   **Step C: First login**

   - Navigate to `https://lrxradar.com/login`
   - Click "Continue with Google"
   - Authenticate with the same Google account whose `sub` you used in the seed
   - The auth middleware matches your Google `sub` to the user record → session created
   - You're now logged in as Super Admin
   - Navigate to Admin → Users → Invite User to add everyone else

   **IMPORTANT:** After your first successful login, delete the seed script from the repo or move it to a `scripts/one-time/` directory. It contains your `sub` claim and should not remain in active code.

9. **Cloudflare Turnstile Setup** (for Brand Assessment bot protection)
   - Go to Cloudflare Dashboard → Turnstile
   - Create a new widget for `lrxradar.com`
   - Copy the Site Key and Secret Key
   ```
   wrangler secret put TURNSTILE_SITE_KEY
   wrangler secret put TURNSTILE_SECRET_KEY
   ```

### 25.3 External API Keys (Phase 2 — Not Needed for MVP)

These are for provider feed integrations. Not needed at launch but good to know what's coming:

| Service | What You Need | Where to Get It | Estimated Cost |
|---------|--------------|-----------------|----------------|
| Cloudflare Radar API | API token (you already have a CF account) | CF Dashboard → API Tokens | Free |
| Cloudflare URL Scanner | Same CF API token with URL Scanner permission | CF Dashboard → API Tokens | Free |
| VirusTotal | Community API key | virustotal.com → Sign up → API key | Free (rate limited) |
| Spamhaus | Account for DNSBL queries | spamhaus.org | Free for non-commercial |
| AlienVault OTX | API key | otx.alienvault.com → Sign up | Free |
| GreyNoise | Community API key | greynoise.io → Sign up | Free (50 lookups/day) |
| PhishTank | API key | phishtank.org → Sign up | Free |

### 25.4 Ongoing Manual Tasks

Things you'll need to do periodically after launch:

- **Rotate JWT secret**: Monthly. Generate new secret, update Workers secret, deploy. Active sessions will be invalidated (users re-auth via Google).
- **Rotate Anthropic API key**: If compromised or per security policy. Update Workers secret, deploy.
- **Monitor Cloudflare billing**: If you exceed free tier limits on Workers, D1, or R2, Cloudflare will notify you. Upgrade plan if needed.
- **Review audit log**: Weekly spot-check of admin actions, failed auth attempts, unusual patterns.
- **Review feed health**: Daily glance at Admin → Feeds to ensure all feeds are pulling successfully.
- **Manage invitations**: Invite new team members, revoke access for departing staff.
- **Domain renewal**: Ensure `lrxradar.com` doesn't expire. Set auto-renew.

### 25.5 Cost Summary (MVP)

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Cloudflare Workers | $0 | Free tier: 100K requests/day |
| Cloudflare D1 | $0 | Free tier: 5GB, 5M reads/day |
| Cloudflare R2 | $0 | Free tier: 10GB storage |
| Railway (FastAPI) | $5 | Starter plan |
| Anthropic API (Haiku) | $5–10 | ~2M tokens/month estimated |
| Email service (Resend) | $0 | Free tier: 100 emails/day |
| Domain renewal | ~$12/year | Already owned |
| **Total** | **$10–15/month** | |

---

*This document is the foundation. Everything builds from here.*
