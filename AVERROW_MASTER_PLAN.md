# AVERROW — Master Platform Plan
**Last updated:** March 27, 2026  
**Status:** Active development — React migration in progress, old SPA preserved for demos  
**Repo:** github.com/cleerox-svg/trust-radar  
**Worker:** trust-radar | **DB:** trust-radar-v2 (D1)

---

## Table of Contents
1. [Vision & Positioning](#vision)
2. [Current State](#current-state)
3. [Agent Architecture](#agents)
4. [Data & Schema](#data)
5. [Build Roadmap](#roadmap)
6. [Data Sources](#feeds)
7. [AI Strategy](#ai)
8. [UI/React Migration](#ui)
9. [Tenant Framework](#tenants)
10. [Competitive Position](#competitive)
11. [API Reference Index](#api)

---

## 1. Vision & Positioning {#vision}

### The Core Insight
Every other platform asks: *"What threats are targeting this brand?"*

Averrow asks: *"Who is doing this, how do they operate, where do they move, and how do we get ahead of them?"*

This is not brand protection. This is **threat actor intelligence** — what Recorded Future charges $100K+/year for, delivered at mid-market pricing through AI agents doing the analytical heavy lifting.

**The shift: threats are evidence. Patterns are the product.**

### The Real Victims
In most brand impersonation attacks, the brand is the bait — the customer is the victim. Averrow's mission is to protect both: brands from reputational destruction (a tarnished brand cannot be rebuilt), and their customers from fraud, credential theft, and financial harm.

### ROI to Customers
- Replaces 2-3 security analyst headcount ($150K–$300K/yr savings)
- Quantifiable: "X threats detected, Y analyst-hours replaced, Z takedowns completed"
- Protects brand equity — the most irreplaceable asset any company owns
- Protects customers — tangible, demonstrable, auditable

### Competitive Gap
| Platform | Infrastructure Correlation | Threat Actor Profiling | AI Attack Detection | Mid-Market Price |
|----------|---------------------------|----------------------|--------------------|--------------------|
| Bolster | ✗ | ✗ | Partial | ✗ |
| Netcraft | ✗ | ✗ | ✗ | ✓ |
| ZeroFox | ✗ | Partial | ✗ | ✗ |
| Recorded Future | ✓ | ✓ | Partial | ✗ ($100K+) |
| DomainTools | ✓ | ✗ | ✗ | Partial |
| **Averrow** | **✓ (Nexus)** | **✓ (roadmap)** | **✓ (roadmap)** | **✓** |

---

## 2. Current State {#current-state}

### Data (as of March 27, 2026)
- **52,628 threats** ingested — March 14–27 (13 days)
- **717 unique hosting providers / 792 ASNs**
- **166 campaigns** detected (98% of threats have no campaign linkage yet)
- **74% of threats have no geo data** — Observatory severely impacted
- **74% have no hosting_provider_id** — Providers module data thin
- **114 countries** represented in data

### Critical Gap: Cartographer Not Running
Cartographer (geo-enrichment agent) last ran 3 days ago. This is why:
- Observatory shows sparse, US-centric data (CDN anycast IPs, not attacker IPs)
- Provider cards show 0.0% trends (NaN%)
- 39,189 threats are unplotted

**Fixing Cartographer is the highest-leverage action available.**

### Agent Run Status (last 24h)
| Agent | Runs | Avg Duration | Status |
|-------|------|-------------|--------|
| Sentinel | 35 | 547ms | ✓ Healthy |
| Analyst | 35 | 52s | ✓ Running, but working blind |
| Observer | 1 | 12s | ✓ Daily only |
| Prospector | 3 | — | ⚠ Partial failures |
| Sparrow | 2 | — | ⚠ 1 failure |
| Cartographer | 0 | — | ✗ Not running |
| Nexus | — | — | ✗ Does not exist yet |
| Flight Control | — | — | ✗ Does not exist yet |

### React Migration Status
- **Old SPA:** Live at primary URL — **DO NOT TOUCH — demo safety**
- **React /v2:** All core views built, parity audit in progress
- **Brand Detail:** 4-card stat grid ✓, ASTRA briefing ✓, field mapping fixed ✓
- **Brands Hub:** 3-view system (List/Heatmap/Swimlane) ✓, live feed sidebar ✓
- **Providers:** Needs redesign (see roadmap)
- **Campaigns:** Detail is placeholder
- **Admin pages:** Several missing (users, feeds, api-keys, audit, organizations)
- **Observatory:** React version exists but sidebar panels incomplete

---

## 3. Agent Architecture {#agents}

### Vision: From Siloed Analysts to Intelligence Mesh

**Current (bad):** Agents run on cron independently, don't communicate, report to own tables.

**Target (good):** Event-driven, self-coordinating mesh with a supervisor that manages load, budget, and priorities.

```
                    ┌─────────────────────┐
                    │   FLIGHT CONTROL     │  Durable Object
                    │   (Supervisor)       │  Never sleeps
                    │   - Queue monitoring │  Event-driven
                    │   - Worker scaling   │  Token budgeting
                    │   - Budget enforcing │  Health reporting
                    └──────────┬──────────┘
                               │ triggers
        ┌──────────────────────┼──────────────────────┐
        ↓                      ↓                      ↓
   ┌─────────┐          ┌──────────┐          ┌────────────┐
   │SENTINEL │  ──────► │CARTOGRAPH│  ──────► │   NEXUS    │
   │Feed Pull│  events  │ Geo Enri.│  events  │ Correlate  │
   └─────────┘          └──────────┘          └─────┬──────┘
                                                     │
                         ┌───────────────────────────┤
                         ↓                           ↓
                   ┌──────────┐               ┌──────────────┐
                   │ ANALYST  │               │ AI DETECTOR  │
                   │ Scoring  │               │ Synthetic    │
                   └─────┬────┘               └──────┬───────┘
                         │                           │
              ┌──────────┴───────────────────────────┘
              ↓              ↓              ↓
        ┌──────────┐  ┌──────────┐  ┌──────────────┐
        │ OBSERVER │  │ SPARROW  │  │  PATHFINDER  │
        │Narrative │  │Takedowns │  │    Leads     │
        └──────────┘  └──────────┘  └──────────────┘
```

### Agent Specifications

#### FLIGHT CONTROL (New — Durable Object)
**Purpose:** Orchestration supervisor — the platform never sleeps, never backlogs  
**Trigger:** Continuous — Durable Object alarm loop  
**Responsibilities:**
- Listens for `agent_events` table inserts
- On Sentinel completion → immediately triggers Cartographer with batch IDs
- On Cartographer completion → triggers Nexus
- On Nexus cluster detection → triggers Analyst, Observer (if high severity), Sparrow
- Monitors queue depth per agent — if backlog > 500 records, spawns parallel worker
- Enforces Haiku token budget: hard cap per hour, graceful throttle, fallback to Sonnet
- Routes to Gemini/GPT-4o for on-demand deep analysis
- Exposes health metrics to `/api/v1/agents/health` endpoint
- Never uses cron — runs via Durable Object alarm rescheduling itself

#### SENTINEL (Enhance existing)
**Purpose:** Feed ingestion  
**Current:** Cron-based, working  
**Changes needed:**
- After each feed pull, write to `agent_events` with batch IDs
- Let Flight Control trigger downstream agents
- Add new feeds: Abuse.ch ThreatFox, Feodo Tracker, PhishTank, URLScan.io

#### CARTOGRAPHER (Emergency fix + expand)
**Purpose:** Geo-enrichment of raw threats  
**Current:** Running every 3 days, missing 74% of threats — BROKEN  
**Target:** Runs within minutes of each Sentinel batch via Flight Control trigger  
**Enrichment pipeline per threat:**
1. IP → ip-api.com batch (45 req/min free) → lat/lng/ASN/country
2. Domain → RDAP → registrar + registration date
3. ASN → hosting_providers table match/upsert
4. Write enriched fields back to `threats` table
5. Emit `threats_enriched` event to Flight Control

#### NEXUS (New — Infrastructure Correlation)
**Purpose:** The intelligence engine — finds patterns humans can't see  
**Trigger:** After each Cartographer enrichment batch  
**SQL correlation (no AI cost):**
- Cluster by shared IP /24 subnet → same operation
- Cluster by ASN + temporal window (48h) + threat type
- Cluster by campaign co-occurrence (ASNs appearing in 3+ campaigns together)
- Pivot detection: ASN drops >80% activity in 72h = infrastructure pivot
- Cross-brand targeting: same cluster → 3+ brands = coordinated attack
**AI layer (Sonnet — run sparingly):**
- Name the cluster from ASN/country/type data
- Write threat actor brief (behavior, motivation, sophistication)
- Assess AI-generation probability from cluster velocity/size
**Outputs:**
- `infrastructure_clusters` table
- `agent_outputs` with `related_provider_ids` populated (currently always empty)
- Pivot alerts → Observer immediate brief
- High-confidence clusters → Sparrow for batch takedown

#### AI ATTACK DETECTOR (New)
**Purpose:** Detect AI-generated attacks — "smell your own"  
**Trigger:** After Nexus, on new spam trap captures  
**Detection signals:**
- Cluster size >20 campaigns + single ASN = AI-scale operation
- Domain registration velocity: >10 domains, same registrar, same day = AI batch
- Spam trap email body: Haiku prompt for AI-generated content detection
- Content uniformity across campaign URLs: AI templating signature
- Temporal clustering: AI campaigns launch in bulk, not trickle
- Brand voice mimicry quality: linguistic signatures in email bodies
**Output per threat/campaign:**
- `ai_generated_probability` (0–100)
- `ai_classification`: `AI_TEMPLATED` | `AI_PERSONALIZED` | `AI_DEEPFAKE` | `HUMAN_OPERATED` | `UNKNOWN`
**Flows into:** Analyst scoring, Observer briefs, UI badges on threat cards

#### ANALYST (Enhance existing)
**Purpose:** Brand risk scoring  
**Current:** Scores in isolation, 52s avg run, working but blind  
**Changes:**
- Read Nexus cluster data before scoring
- Factor in: cluster count targeting this brand, AI generation probability, cross-brand coordination flag
- Set "COORDINATED ATTACK" flag when 2+ clusters from different ASNs target same brand
- Populate `related_provider_ids` in `agent_outputs` (column exists, never used)
- Run faster by skipping brands with no new threats since last run

#### OBSERVER (Enhance existing)
**Purpose:** Narrative briefings  
**Current:** Daily only  
**Changes:**
- Add event trigger: Nexus high-confidence cluster → immediate Observer run
- New briefing section: "Infrastructure Shifts" — ASNs that went active/silent this week
- New briefing type: "Threat Actor Brief" (not just daily summary)
- Write to `agent_outputs` type `trend_report` with cluster context

#### SPARROW (Enhance existing)
**Purpose:** Takedown coordination  
**Current:** Single-domain submissions  
**Changes:**
- Read from Nexus cluster: bundle all malicious URLs on one ASN → one provider submission
- Use `provider_abuse_contacts` table for submission routing
- Track response time → update `provider_abuse_contacts.avg_response_days`
- Build provider responsiveness score from real data over time

#### PATHFINDER (Enhance existing)
**Purpose:** Sales lead generation  
**Changes:**
- Use Nexus cluster data: "this cluster is targeting DocuSign — DocuSign doesn't know yet"
- Generate prospect pitches based on active threat intelligence, not just domain scanning
- Prioritize leads where AI-generated attacks detected (harder to defend without a platform)

---

## 4. Data & Schema {#data}

### New Tables Required

#### agent_events (Migration 0018)
```sql
CREATE TABLE agent_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  -- 'feed_pulled'|'threats_enriched'|'cluster_detected'|'pivot_detected'|'backlog_alert'|'budget_warning'
  source_agent TEXT NOT NULL,
  target_agent TEXT,           -- null = broadcast to Flight Control
  payload_json TEXT,           -- batch IDs, threat IDs, cluster IDs
  priority INTEGER DEFAULT 5,  -- 1=critical, 5=normal, 10=low
  created_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed'))
);
CREATE INDEX idx_agent_events_status ON agent_events(status, priority, created_at);
```

#### infrastructure_clusters (Migration 0019)
```sql
CREATE TABLE infrastructure_clusters (
  id TEXT PRIMARY KEY,
  cluster_name TEXT,
  asns TEXT NOT NULL,              -- JSON array
  ip_ranges TEXT,                  -- JSON array of CIDR ranges
  countries TEXT,                  -- JSON array of country codes
  campaign_ids TEXT,               -- JSON array
  brand_ids TEXT,                  -- JSON array of targeted brand IDs
  attack_types TEXT,               -- JSON array
  hosting_provider_ids TEXT,       -- JSON array
  threat_count INTEGER DEFAULT 0,
  confidence_score INTEGER,        -- 0-100
  ai_generated_probability INTEGER, -- 0-100
  ai_classification TEXT,
  pivot_from_cluster_id TEXT,      -- if this cluster is a pivot from another
  first_detected TEXT DEFAULT (datetime('now')),
  last_updated TEXT DEFAULT (datetime('now')),
  last_seen TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','dormant','disrupted')),
  agent_notes TEXT,
  nexus_brief TEXT,                -- Sonnet-generated threat actor narrative
  FOREIGN KEY (pivot_from_cluster_id) REFERENCES infrastructure_clusters(id)
);
CREATE INDEX idx_clusters_status ON infrastructure_clusters(status, last_seen);
```

#### provider_abuse_contacts (Migration 0020)
```sql
CREATE TABLE provider_abuse_contacts (
  id TEXT PRIMARY KEY,
  asn TEXT NOT NULL UNIQUE,
  provider_name TEXT NOT NULL,
  abuse_email TEXT,
  abuse_url TEXT,
  api_endpoint TEXT,
  api_type TEXT, -- 'google_safe_browsing'|'netcraft'|'cloudflare'|'manual'
  avg_response_days REAL,
  total_submissions INTEGER DEFAULT 0,
  successful_takedowns INTEGER DEFAULT 0,
  last_submission TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
-- Seed data for major providers in migration
```

#### Threats table additions (Migration 0021)
```sql
ALTER TABLE threats ADD COLUMN ai_generated_probability INTEGER;
ALTER TABLE threats ADD COLUMN ai_classification TEXT;
ALTER TABLE threats ADD COLUMN cluster_id TEXT REFERENCES infrastructure_clusters(id);
ALTER TABLE threats ADD COLUMN registrar TEXT;
ALTER TABLE threats ADD COLUMN registration_date TEXT;
ALTER TABLE threats ADD COLUMN enriched_at TEXT;
```

#### Hosting providers table additions (Migration 0022)
```sql
ALTER TABLE hosting_providers ADD COLUMN abuse_contact_id TEXT 
  REFERENCES provider_abuse_contacts(id);
ALTER TABLE hosting_providers ADD COLUMN pivot_detected_at TEXT;
ALTER TABLE hosting_providers ADD COLUMN is_bulletproof INTEGER DEFAULT 0;
ALTER TABLE hosting_providers ADD COLUMN last_enriched TEXT;
```

### Key Data Relationships
```
threat_signals → [Sentinel] → threats
threats → [Cartographer] → threats (enriched: lat/lng/ASN/provider)
threats → [Nexus] → infrastructure_clusters
infrastructure_clusters → [Analyst] → agent_outputs (brand scores)
infrastructure_clusters → [Sparrow] → takedown_requests (batched)
infrastructure_clusters → [Observer] → agent_outputs (threat actor briefs)
infrastructure_clusters → Observatory UI (cluster overlay)
infrastructure_clusters → Providers UI (operations per provider)
```

---

## 5. Build Roadmap {#roadmap}

### Phase 1 — Fix the Foundation (Week 1-2)
**Goal:** Observatory transforms, backlogs disappear, correlation engine live

- [ ] **Migration 0018–0022:** agent_events, infrastructure_clusters, provider_abuse_contacts, threats additions, hosting_providers additions
- [ ] **Cartographer fix:** Event-driven, ip-api.com batch enrichment, RDAP registrar lookup, runs within minutes of Sentinel
- [ ] **Flight Control v1:** Durable Object, agent_events polling, downstream triggering, basic health endpoint
- [ ] **NEXUS v1:** SQL-only correlation (no AI cost), writes infrastructure_clusters, emits pivot alerts
- [ ] **Fix NaN% trends:** Populate hosting_providers.trend_7d/30d nightly from threats table
- [ ] **Add feeds:** Abuse.ch ThreatFox, Feodo Tracker C2, PhishTank
- [ ] **React:** Keep /v2 in sync, old SPA untouched for demo safety

### Phase 2 — Intelligence Layer (Week 3-4)
**Goal:** AI detection live, all agents interconnected, Observatory showing real corridors

- [ ] **NEXUS v2:** Sonnet narrative generation for clusters
- [ ] **AI Attack Detector v1:** Cluster velocity heuristics + Haiku spam trap analysis
- [ ] **Enhanced Analyst:** Reads Nexus before scoring, sets COORDINATED_ATTACK flag
- [ ] **Event-driven Observer:** Immediate briefs on high-confidence clusters + pivots
- [ ] **Observatory redesign:** Cluster overlay, pivot layer, timeline scrubber, provider coloring
- [ ] **Providers Hub redesign:** Infrastructure Intel module — ASN timeline, cluster sidebar
- [ ] **Provider Detail:** 4-card stat pattern + ASN timeline + takedown history
- [ ] **HIBP integration:** Breach monitoring per brand domain ($4/mo)

### Phase 3 — Platform Expansion (Month 2)
**Goal:** Enterprise-grade data layer, tenant contribution model, SIEM export

- [ ] **Sparrow cluster takedowns:** Bundle by ASN, use provider_abuse_contacts, track response rates
- [ ] **SIEM/IOC export:** STIX 2.0 format, webhook push, CSV export
- [ ] **Tenant data contribution:** Orgs connect email security platform → feeds into global graph
- [ ] **Social media expansion:** Twitter/X API, Reddit monitoring, expanded PhishTank
- [ ] **Dark web monitoring:** Flare.io or DarkOwl integration (evaluate cost vs data quality)
- [ ] **VirusTotal community:** URL verdicts, file hash lookups
- [ ] **URLScan.io:** Page content for AI detection and brand impersonation analysis
- [ ] **React cutover:** Phase 8 — make /v2 the default, retire old SPA (only after demo cycle complete)

### Phase 4 — Offensive Intelligence (Month 3+)
**Goal:** Threat actor profiling, predictive targeting, customer ROI dashboard

- [ ] **Threat actor profiles:** Persistent actors built from cluster fingerprints across time
- [ ] **TTP cataloguing:** Tactics/Techniques/Procedures per threat actor
- [ ] **Predictive targeting:** "Based on this actor's pattern, these brands are next"
- [ ] **Customer ROI dashboard:** Analyst-hours replaced, takedowns completed, brand risk trend
- [ ] **Pathfinder intelligence:** Use Nexus clusters to generate prospect pitches with live threat data
- [ ] **Attribution scoring:** Confidence levels for threat actor identification

---

## 6. Data Sources {#feeds}

### Current Feeds (Active)
- OpenPhish, PhishTank, URLhaus, cert.pl — phishing/malware
- CT logs (certificate transparency) — domain discovery
- Spam trap email capture (catch-all on averrow.com + averrow.ca)

### Immediate Additions (Free)
| Source | Data | Priority |
|--------|------|----------|
| ip-api.com batch | IP → geo/ASN (45 req/min) | CRITICAL — fixes Observatory |
| RDAP | Domain registrar + registration date | High |
| Abuse.ch ThreatFox | IOCs (IPs, domains, URLs, hashes) | High |
| Abuse.ch Feodo Tracker | Active C2 botnet infrastructure | High |
| Abuse.ch SSLBL | Malicious SSL certificates | Medium |
| PhishTank API | Community phishing reports | High |
| URLScan.io | Page content + verdicts | Medium |
| SURBL | Domain reputation | Medium |

### Low Cost, High Value
| Source | Cost | Data |
|--------|------|------|
| HaveIBeenPwned | $4/mo | Breach data per brand domain |
| VirusTotal Community | Free (4 req/min) | File hash + URL verdicts |
| Twitter/X API v2 | $100/mo | Brand mention monitoring, impersonation handles |

### Strategic (Revenue-Funded)
| Source | Est. Cost | Data |
|--------|-----------|------|
| Flare.io or DarkOwl | $500–2K/mo | Dark web credential markets, breach forums |
| DomainTools Iris | $1K+/mo | Domain registration patterns, registrant pivoting |
| Telegram feed | Variable | Threat actor coordination channels |
| Meta Content Library | Free (approval req'd) | Facebook/Instagram brand impersonation |
| SpyCloud | $5K+/yr | Full credential exposure data |
| Recorded Future | $100K+/yr | Threat actor attribution (long-term) |

### Social Media Feeds (Priority)
- Twitter/X: real-time brand mentions, impersonation handle detection
- Reddit: fake brand subreddits, scam posts
- Phishtank: community phishing (already partial — expand)
- Meta Content Library: Facebook/Instagram brand impersonation
- LinkedIn API: professional network impersonation

---

## 7. AI Strategy {#ai}

### Model Routing
| Task | Model | Rationale |
|------|-------|-----------|
| Threat classification | Claude Haiku | High volume, simple labels, cheap |
| Cluster naming | Claude Haiku | Fast, good enough |
| Threat actor briefs | Claude Sonnet | Quality matters, less frequent |
| AI-generated content detection | Haiku + heuristics | Heuristics do 80%, AI handles edge cases |
| On-demand deep analysis | Gemini Pro / GPT-4o | User-triggered, billed per-use |
| Dark web content analysis | Claude Sonnet | Nuanced, unstructured text |
| Observatory narrative | Claude Sonnet | Cluster stories, less frequent |

### The Core Rule
**SQL does correlation. AI does narrative. Never pay AI to do what GROUP BY can do in 50ms.**

### Cloudflare AI Gateway
- Single control plane for all AI providers
- Per-agent spend tracking
- Hard budget caps per hour (never runaway costs)
- Fallback routing: Haiku throttled → route to Gemini Flash
- Audit log of all AI calls
- Cache repeated prompts (cluster naming for same ASN = cache hit)

### Token Budget Management (Flight Control's job)
- Haiku: X tokens/hour hard cap (configurable per agent)
- Soft throttle at 80% of cap: slow down, batch requests
- Hard throttle at 100%: queue work, resume next hour
- Never fail silently — always write to agent_events that throttling occurred
- Observer + Analyst get priority budget; Nexus naming is deferrable

---

## 8. UI / React Migration {#ui}

### Migration Rules (Non-Negotiable)
- Old SPA: **NEVER TOUCH** — live at primary URL, demo-ready at all times
- React /v2: all new UI work goes here
- Cutover (Phase 8): only after demo cycle complete and full parity confirmed

### Design System Tokens
```
Signal Red:     #C83C3C  — Critical, CTAs, danger
Contrail Blue:  #78A0C8  — Labels, info, low severity
Cockpit:        #080E18  — Primary background
Polar:          #F8F7F5  — Primary text

Orbital Teal:   #00d4ff  — Active states, selected, CTAs only (not general accent)
Wing Blue:      #0a8ab5  — Secondary accents, hover states
Thrust:         #7aeaff  — Highlights, selected states
Ring Glow:      #00b8d9  — Border accents

Severity:
  Critical: #f87171   High: #fb923c   Medium: #fbbf24   Low: #78A0C8   Clean: #4ade80
```

### Stat Card Pattern (All Detail Views)
- Layout: detail-rows left | vertical divider | big metric right
- Left: 6px dot + label + right-aligned count, colored if >0, white/30 if 0
- Right: 32px bold metric + 9px muted label
- Wrapper: `rounded-xl border border-white/10 bg-cockpit p-4`
- Apply to: Brand Detail ✓, Provider Detail (todo), Campaign Detail (todo)

### Shared Components Built
- `StatCard` — detail/metric card wrapper
- `SocialDots` — platform indicator dots with classification colors
- `TrendBadge` — ▲/▼ directional trend
- `Sparkline` — 7-point inline SVG
- `BrandRow` — compact list row
- `LiveFeedCard` — polling threat feed sidebar
- `PortfolioHealthCard` — SVG donut breakdown
- `AttackVectorsCard` — horizontal bar chart
- `severityColor()` — shared lib, never duplicate

### View Audit Status
| View | Old SPA | React /v2 | Status |
|------|---------|-----------|--------|
| Observatory | ✓ | Partial | Sidebar panels incomplete |
| Brands Hub | ✓ | ✓ | Complete — 3-view system |
| Brand Detail | ✓ | ✓ | Complete — stat cards, ASTRA, social |
| Providers Hub | ✓ | Needs redesign | Infrastructure Intel redesign pending |
| Provider Detail | ✓ | Basic | Needs stat card pattern |
| Campaigns | ✓ | Placeholder | Campaign Detail is stub |
| Trends | ✓ | ✓ | Basic |
| Admin Dashboard | ✓ | Basic | Missing user stats, session count |
| Admin Users | ✓ | ✗ | Not built |
| Admin Feeds | ✓ | ✗ | Not built |
| Admin API Keys | ✓ | ✗ | Not built |
| Admin Audit | ✓ | ✗ | Not built |
| Admin Organizations | ✓ | ✗ | Not built |
| Spam Trap | ✓ | Partial | Missing capture drill-down |
| Leads | ✓ | Partial | Missing action buttons, detail |

---

## 9. Tenant Framework {#tenants}

### What Each Organization Gets
- Their own brand set monitored
- Global threat landscape filtered to "threats targeting your brands"
- Private cluster view: Nexus findings specific to their brands
- Takedown workflow with their legal team as approvers
- SIEM export: STIX 2.0 IOC feed via webhook/API
- **Data contribution option:** connect email security platform → feeds into global graph
- **Spam trap contribution:** their spam trap data feeds into global corpus (opt-in, anonymized)

### The Data Flywheel
More customers → more private data contributed → better Nexus correlation → better product → more customers

### Organization Data Contribution
When a customer connects their email security platform (Proofpoint, Mimecast, etc.):
- Their inbound phishing data feeds INTO Averrow's global threat graph
- They get credit: "Your data contributed to detecting X new threat campaigns this month"
- Platform gets: real-world email bodies, attacker infrastructure validation, brand-specific targeting data
- All anonymized and aggregated at the global level

### SIEM/IOC Export (Required for Enterprise)
- STIX 2.0 format (industry standard)
- Webhook push on new high-severity threats (HMAC-SHA256 signing already built)
- REST API: `GET /api/v1/organizations/:id/ioc-feed?since=&severity=&format=stix|csv|json`
- This is table stakes for enterprise security teams — required for SOC integration

---

## 10. Competitive Position {#competitive}

### What Sets Averrow Apart

1. **Infrastructure → Actor correlation** (Nexus): No mid-market platform connects hosting provider behavior to threat actor identification

2. **AI-generated attack detection**: Industry blind spot — most platforms built before AI-generated attacks were common. Averrow designed for it.

3. **Tenant data contribution flywheel**: Every customer makes the platform smarter. Network effects that Bolster/Netcraft don't have.

4. **Predictive targeting**: "Your brand will be hit next" — not "your brand is being hit now." This is the jump from reactive to proactive.

5. **Autonomous agent mesh**: Platform scales intelligence automatically without headcount. One analyst with Averrow = 3 analysts without it.

6. **Mid-market pricing**: Recorded Future-level intelligence at 1/50th the cost.

### Design for Acquisition
Built for strategic acquirer positioning (50x ARR target per T10 Ventures framework):
- Natural acquirers: Palo Alto, CrowdStrike, Proofpoint, Mimecast, Abnormal Security
- Acquisition thesis: "Buy the threat actor intelligence layer + mid-market customer base"
- Technical moat: Nexus correlation engine + tenant data flywheel = defensible

---

## 11. API Reference Index {#api}

### Existing Endpoints (240+ routes — see AVERROW_API_REFERENCE.md)

### New Endpoints Required (Phase 1-2)

#### Infrastructure / Nexus
```
GET  /api/v1/providers/timeline          — ASN daily threat series (for chart)
GET  /api/v1/providers/clusters          — All infrastructure clusters
GET  /api/v1/providers/:id/operations    — Clusters using this provider/ASN
GET  /api/v1/clusters/:id                — Single cluster detail
GET  /api/v1/clusters/:id/threats        — All threats in this cluster
GET  /api/v1/clusters/:id/brands         — Brands targeted by this cluster
POST /api/v1/clusters/:id/takedown       — Initiate cluster-level takedown
```

#### Flight Control / Agent Health
```
GET  /api/v1/agents/health               — All agent status + queue depths
GET  /api/v1/agents/events               — Recent agent_events log
POST /api/v1/agents/:id/trigger          — Manual trigger (admin only)
GET  /api/v1/agents/budget               — Current AI token usage vs caps
```

#### AI Detection
```
GET  /api/v1/threats/:id/ai-analysis     — AI generation assessment for threat
GET  /api/v1/campaigns/:id/ai-score      — AI generation probability for campaign
```

#### IOC Export / SIEM
```
GET  /api/v1/organizations/:id/ioc-feed  — STIX 2.0 / CSV / JSON IOC export
GET  /api/v1/organizations/:id/stix      — Pure STIX 2.0 bundle
POST /api/v1/organizations/:id/webhooks  — Configure IOC push webhook
```

#### Observatory (Enhanced)
```
GET  /api/v1/observatory/clusters        — Nexus clusters for map overlay
GET  /api/v1/observatory/pivots          — Recent ASN pivot events
GET  /api/v1/observatory/timeline        — Threat volume by day for scrubber
```

#### Provider Abuse
```
GET  /api/v1/providers/:id/abuse-contact — Provider abuse contact info
POST /api/v1/providers/:id/submit        — Submit cluster takedown to provider
GET  /api/v1/providers/:id/submissions   — Takedown submission history + response rates
```

---

## Document Maintenance

This document must be updated every time:
- A new agent is built or modified
- A new migration is run
- A new API endpoint is added
- A UI view reaches parity or is completed
- A new data feed is integrated
- A strategic decision changes the platform direction

**Owner:** Claude Leroux  
**Update cadence:** End of each Claude Code build session  
**Related docs:** AVERROW_DESIGN_SYSTEM_BRIEF.md, AVERROW_API_REFERENCE.md, PRODUCT_BOUNDARIES.md
