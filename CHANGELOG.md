# Changelog

All notable changes to the Averrow (Trust Radar) platform.

## March 2026 — Major Platform Expansion

### Feed System Expansion (6 → 37 feeds)

**New Ingest Feeds:**
- C2 Tracker (Cobalt Strike, Sliver, Brute Ratel, Metasploit, Posh C2, Havoc)
- C2IntelFeeds (30-day rolling C2 IPs and domains)
- Blocklist.de (community IP blocklist, ~20K IPs)
- CINS Army (honeypot-verified attacker IPs)
- Emerging Threats (Proofpoint compromised IPs)
- Spamhaus DROP/EDROP (hijacked network CIDR blocks)
- Tor Exit Nodes (reference table, no threat creation)
- Disposable Email Domains (~3,500 throwaway domains)
- NRD Hagezi (newly registered domains, 50K-180K/day)
- Typosquat Scanner (generated variants + DNS resolution)
- PhishDestroy (curated phishing domain blocklist)
- CISA KEV (known exploited vulnerabilities)
- Cloudflare Email Security (daily email threat summaries)

**New Enrichment Engines (3 → 9):**
- AbuseIPDB (IP abuse confidence scoring)
- GreyNoise (mass-scanner classification, RIOT detection)
- CIRCL Passive DNS (historical DNS correlation)
- SecLookup (domain/IP risk scoring)
- HIBP Stealer Logs (credential exposure monitoring)
- Spamhaus DBL (domain blocklist enrichment)

**New Social Intelligence Feeds:**
- Reddit (security subreddit monitoring)
- GitHub (code leak detection + advisory monitoring)
- Mastodon (4 instances: mastodon.social, infosec.exchange, ioc.exchange, hachyderm.io)
- Telegram (channel monitoring for credential leaks, phishing kits)

### Brand System Expansion (508 → 813 brands)

- 305 new brands added to monitoring
- Brand keyword matching with homoglyph detection
- Social profile discovery for all monitored brands
- Brand exposure scoring (composite of threat, email, social signals)
- Safe domain management per brand (bulk add/remove)
- Certificate Transparency monitoring per brand
- Lookalike domain generation and scanning

### Agent System Expansion (8 → 14 agents)

**New Agents:**
- **Flight Control** — Autonomous supervisor: backlog management, budget enforcement, parallel scaling (up to 3 instances per agent), stall recovery, CertStream health monitoring
- **NEXUS** — Pure SQL infrastructure correlation engine: ASN clustering, pivot detection (>80% activity drop), acceleration detection (>50% increase)
- **Watchdog** — Real-time social mention classifier via Claude Haiku, escalates HIGH/CRITICAL to threats table
- **Narrator** — Threat narrative generation connecting 2+ signal types (threats, email degradation, social impersonation, lookalike domains, CT certificates)
- **Curator** — Weekly data hygiene: email security scanning (500 brands), false-positive cleanup, social profile discovery
- **Sparrow** — Takedown automation: URL scanning, takedown request creation, evidence assembly, provider resolution, submission draft generation

**Enhanced Agents:**
- **Analyst** — Added 5-phase pipeline: brand matching, correlation escalation, enrichment validation, social intelligence, social mentions
- **Cartographer** — Added parallel scaling (up to 3 instances), RDAP registrar lookup, email security posture scanning, DMARC geo enrichment, provider threat stats aggregation
- **Observer** — Expanded context gathering: 15+ data sources including social impersonation, lookalike domains, CT certificates, spam trap captures, threat signals, brand assessments
- **Strategist** — Added Haiku-powered coordination detection across 5+ campaigns

### Spam Trap System (New)

- Seed address management with campaign tracking
- Email capture processing (SPF/DKIM/DMARC validation)
- Brand spoofing detection with confidence scoring
- Phishing pattern signals for AI training data
- Daily statistics aggregation
- Seed Strategist agent for automated campaign recommendations
- Honeypot site generation (lrxradar.com)

### Daily Briefing System (New)

- Observer generates intelligence briefings daily at 06:00 UTC
- Narrator produces threat narratives for active brands
- Email delivery via Resend at 12:00 UTC
- Briefing history and browsing via API

### Email Security Engine (New)

- DMARC/SPF/DKIM/MX posture scanning
- Grading system (A-F) with scoring algorithm
- DMARC aggregate report ingestion (inbound email worker)
- DMARC source IP geo enrichment
- Email security grade as input to brand exposure scoring
- Correlation: phishing + no DMARC = automatic severity escalation

### Social Intelligence (New)

- Social profile discovery and monitoring
- Platform coverage: Reddit, GitHub, Mastodon, Telegram
- Watchdog agent for AI-powered mention classification
- Threat types: impersonation, credential_leak, phishing_link, brand_abuse, code_leak, threat_actor_chatter, vulnerability_disclosure
- Social evidence integration with takedown system

### Multi-Tenant System (New)

- Organization management with SCIM-ready membership
- Plans: starter, pro, enterprise
- Per-org brand assignment with monitoring configuration
- API key management and webhook integration
- Org-scoped dashboards, alerts, and takedowns
- Role hierarchy: viewer < analyst < admin < owner

### Security Hardening

- CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy headers
- KV-based sliding window rate limiting (auth 10/min, scan 30/min, api 100/min)
- Forced logout via KV flags
- Audit logging to separate D1 database
- Honeypot pages (/team, /admin-portal, /internal-staff) for attacker detection
- JWT refresh token rotation

### Infrastructure Improvements

- CertStreamMonitor Durable Object (persistent CT log stream)
- ThreatPushHub Durable Object (WebSocket real-time push)
- CartographerBackfillWorkflow (durable multi-step enrichment)
- NexusWorkflow (durable ASN correlation)
- Cross-feed escalation (3+ sources = auto-critical)
- Budget management system (emergency/hard/soft/normal throttle levels)

### Corporate Site

- Server-rendered pages: landing, platform, about, pricing, security, blog, changelog, contact, privacy, terms
- 4 blog posts: email security, brand impersonation costs, AI threat narratives, lookalike domains
- Public assessment tool (`/assess`, `/scan`)
- Lead capture integration
- SEO: robots.txt, sitemap.xml

### Data Export

- CSV/JSON export for scans, signals, alerts
- STIX 2.1 bundle export per brand
- STIX indicators-only export
- Audit log export

### UI (React /v2)

- TanStack Query hooks for all API endpoints
- Severity color system (`severityColor`, `severityOpacity`, `threatTypeColor`)
- Shared components: StatCard, SocialDots, TrendBadge, Sparkline, BrandRow, LiveFeedCard
- Mobile bottom-sheet architecture
- Observatory globe visualization
