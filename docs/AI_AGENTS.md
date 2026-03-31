# AI Agents

Trust Radar uses a system of 14 AI agents powered by Claude Haiku via the Anthropic API. Agents are defined in `packages/trust-radar/src/agents/` and orchestrated by Flight Control with the agent runner in `packages/trust-radar/src/lib/agentRunner.ts`.

> **Last verified:** March 2026 — documented from source code

## Agent Infrastructure

### Agent Runner

The agent runner (`packages/trust-radar/src/lib/agentRunner.ts`) provides the execution framework:

```typescript
interface AgentModule {
  name: string;
  displayName: string;
  description: string;
  color: string;
  trigger: "scheduled" | "event" | "manual";
  requiresApproval: boolean;
  execute(ctx: AgentContext): Promise<AgentResult>;
}
```

### AI Client

All agents use Claude Haiku via the Anthropic API. The AI client (`packages/trust-radar/src/lib/haiku.ts`) provides:

- `inferBrand()` — Brand identification from domain/URL patterns
- `classifyThreat()` — Threat classification and severity scoring
- `generateInsight()` — Intelligence narrative generation
- `generateCampaignName()` — Campaign naming from infrastructure patterns
- `scoreProvider()` — Hosting provider reputation scoring
- `classifyWithHaiku()` — Social mention classification
- `checkCostGuard()` — API cost control for non-critical agents

### Budget Management

Flight Control enforces 4 budget levels:

| Level | Behavior |
|-------|----------|
| **Emergency** | All AI paused |
| **Hard** | Minimal AI (analyst/observer batches reduced) |
| **Soft** | Reduced batch sizes |
| **Normal** | Full operation |

Non-critical agents (Observer, Strategist, Seed Strategist, Prospector) check a cost guard before making API calls.

### Agent Registry

Agents are registered in `packages/trust-radar/src/agents/index.ts`:

sentinel, analyst, cartographer, strategist, observer, prospector, sparrow, nexus, flight_control, curator, watchdog + trustbot (via separate export)

---

## Agent Reference

### 1. Flight Control — Autonomous Supervisor

| Property | Value |
|----------|-------|
| **File** | `agents/flightControl.ts` |
| **Color** | `#00d4ff` |
| **Trigger** | Runs FIRST every cron tick |
| **AI Model** | None (pure orchestration) |

Flight Control is the meta-agent that supervises all other agents. It runs before any other agent on every cron cycle.

**Responsibilities:**
- **Backlog measurement** — Monitors 13 enrichment/processing backlogs
- **Agent health** — Detects stalled agents, tracks durations
- **Budget enforcement** — Throttles AI usage at emergency/hard/soft/normal levels
- **Parallel scaling** — Spawns additional agent instances based on backlog size
- **Stall recovery** — Auto-restarts hung agents
- **Curator trigger** — Kicks off weekly hygiene runs
- **CertStream health** — Monitors and restarts DO if needed

**Scaling Thresholds:**

| Agent | Low | Medium | High | Max Parallel |
|-------|-----|--------|------|-------------|
| Cartographer | 500 | 2,000 | 5,000 | 3 |
| Analyst | 50 | 200 | 500 | 3 |

**Stall Thresholds (minutes before restart):**

| Agent | Threshold |
|-------|-----------|
| Sentinel | 35 min |
| Cartographer | 75 min |
| Analyst | 35 min |
| Sparrow | 120 min |
| Nexus | 260 min |
| Observer | 1,500 min |

**Backlogs Tracked:** cartographer, analyst, totalUnlinked, totalNoGeo, surblUnchecked, vtUnchecked, gsbUnchecked, dblUnchecked, abuseipdbUnchecked, pdnsUnchecked, greynoiseUnchecked, seclookupUnchecked, watchdog

**Inputs:** threats, agent_runs, agent_outputs, brands, feed_status, Anthropic usage report (hourly via KV)
**Outputs:** agent_activity_log entries, agent_outputs (type: diagnostic), triggers other agents

---

### 2. Sentinel — Threat Classification

| Property | Value |
|----------|-------|
| **File** | `agents/sentinel.ts` |
| **Color** | `#C83C3C` |
| **Trigger** | Event-driven (on feed ingestion) |
| **AI Model** | Claude Haiku |

Classifies new threats, assigns confidence scores and severity levels.

- **AI classification** — Haiku-based threat type and severity assignment
- **Homoglyph detection** — Unicode/visual lookalike characters (Cyrillic 'a', '0' for 'o')
- **Brand squatting** — Domains containing brand keywords
- **APT pattern detection** — Advanced persistent threat indicators
- **Social assessment** — AI scoring of HIGH/CRITICAL social monitoring results
- **Fallback** — Rule-based classification when Haiku unavailable

**Inputs:** Unclassified threats, monitored_brands, social_profiles, social_monitor_results
**Outputs:** Updated threats (severity, confidence_score, threat_type), agent_outputs, agent_events

---

### 3. Analyst — Brand Attribution & Correlation

| Property | Value |
|----------|-------|
| **File** | `agents/analyst.ts` |
| **Color** | `#E8923C` |
| **Trigger** | Scheduled — every 15 minutes |
| **AI Model** | Claude Haiku (`inferBrand()`) |
| **Batch Size** | Up to 30 threats/run (scalable by Flight Control) |

Five-phase pipeline for brand attribution and threat correlation:

1. **Brand matching** — Haiku inference of target brand from domain/URL (top 100 brands context)
2. **Correlation escalation** — Phishing + no DMARC, AI-generated phishing patterns
3. **Enrichment validation** — Cross-check SURBL/VT/GSB/DBL/GreyNoise/SecLookup hits
4. **Social intelligence** — Social platform signal correlation
5. **Social mentions** — Reddit, Telegram, GitHub, Mastodon mention intelligence

**Inputs:** Threats (unmatched), brands (top 100), safe_domains, brand_threat_assessments, social_mentions
**Outputs:** Updated threats (target_brand_id, severity), new brands, agent_outputs, brand_exposure_score

---

### 4. Cartographer — Infrastructure Mapping

| Property | Value |
|----------|-------|
| **File** | `agents/cartographer.ts` |
| **Color** | `#5A80A8` |
| **Trigger** | Scheduled — every 15 minutes |
| **AI Model** | Claude Haiku (`scoreProvider()`) |
| **Parallel** | Up to 3 instances via Flight Control |

Seven-stage enrichment pipeline:

1. **ip-api.com batch** — Up to 5 batches of 500 IPs for geolocation
2. **RDAP registrar lookup** — Up to 10 per run
3. **ipinfo.io fallback** — Secondary geo enrichment
4. **Haiku provider scoring** — AI reputation assessment with risk factors
5. **Email security scans** — 50 brands per run (oldest first)
6. **DMARC source IP geo** — Up to 10 per run
7. **Provider threat stats** — Today/7d/30d/all-time aggregation

**Inputs:** Unenriched threats, hosting_providers, brands, dmarc_report_records
**Outputs:** Enriched threats (lat, lng, country_code, asn, hosting_provider_id, registrar, enriched_at), hosting_providers, email_security_scans, provider_threat_stats

---

### 5. NEXUS — Infrastructure Correlation Engine

| Property | Value |
|----------|-------|
| **File** | `agents/nexus.ts` |
| **Color** | `#00d4ff` |
| **Trigger** | Scheduled — every 4 hours |
| **AI Model** | None (pure SQL correlation) |

SQL-only threat clustering by infrastructure patterns. No AI tokens consumed.

- **ASN correlation** — Groups threats by ASN and threat_type
- **Pivot detection** — Activity dropped >80% in 7 days
- **Acceleration detection** — Activity increased >50% vs prior week
- **Confidence scoring** — Based on campaigns x brands x threat counts

**Inputs:** threats, hosting_providers
**Outputs:** infrastructure_clusters, hosting_providers (trend_7d, trend_30d), threats (cluster_id), agent_events (pivot alerts → Observer)

---

### 6. Observer — Daily Intelligence Synthesis

| Property | Value |
|----------|-------|
| **File** | `agents/observer.ts` |
| **Color** | `#78A0C8` |
| **Trigger** | Daily |
| **AI Model** | Claude Haiku (`generateInsight()`) |
| **Cost Guard** | Yes (non-critical) |

Synthesizes 15+ data sources into 3-5 professional intelligence briefing items:

- Threat landscape (24h trends vs previous day)
- Enrichment validation confirmations (SURBL/VT/GSB/DBL/GreyNoise/SecLookup)
- Top targeted brands and providers
- Threat type distribution and campaign activity
- Email security posture (grades, at-risk brands)
- Social impersonation findings
- Lookalike domain and CT certificate activity
- Spam trap network metrics
- Threat feed signals and brand threat assessments
- Social media mentions intelligence

**Inputs:** All tables (aggregated 24h data)
**Outputs:** agent_outputs (type: insight), notifications for critical findings

---

### 7. Strategist — Campaign Correlation

| Property | Value |
|----------|-------|
| **File** | `agents/strategist.ts` |
| **Color** | `#8A8F9C` |
| **Trigger** | Every 6 hours |
| **AI Model** | Claude Haiku (`generateCampaignName()`, coordination detection) |
| **Cost Guard** | Yes (non-critical) |

Identifies coordinated threat campaigns via infrastructure and timing:

- **IP clustering** — 3+ threats on same IP
- **Registrar clustering** — 5+ threats via same registrar (7d window)
- **Coordination detection** — Haiku analysis of 5+ campaigns for linked activity
- **Campaign lifecycle** — Created → active → dormant (30+ days inactive)

**Inputs:** Threats (IP, registrar), campaigns, brands, hosting_providers
**Outputs:** campaigns (new/updated), threats (campaign_id), infrastructure_clusters, agent_outputs, notifications

---

### 8. Prospector — Sales Intelligence

| Property | Value |
|----------|-------|
| **File** | `agents/prospector.ts` |
| **Color** | `#28A050` |
| **Trigger** | Weekly (lead creation), every run (enrichment) |
| **AI Model** | Claude Haiku (3 calls per lead enrichment) |

Two-phase pipeline:

**Phase 1 — Identify & Create** (no AI, rule-based scoring):

| Signal | Points |
|--------|--------|
| Email security grade F/D | +30 |
| Active phishing URLs | +25 |
| DMARC none/missing | +20 |
| Spam trap catches | +20 |
| High risk score | +15 |
| Multiple campaigns | +15 |
| Social impersonation | +15 |
| Tranco top 10k | +10 |
| AI-generated phishing | +10 |
| Recent risk spike | +10 |

**Phase 2 — Enrich** (one lead per run, 3 Haiku calls):
1. Detailed findings summary (256 tokens)
2. Outreach email variants (1,024 tokens)
3. Company research via web search (1,024 tokens)

**Inputs:** Brands, email_security_scans, threats, threat_signals, spam_trap_captures, brand_threat_assessments, social intelligence
**Outputs:** sales_leads, agent_outputs

---

### 9. Sparrow — Takedown Agent

| Property | Value |
|----------|-------|
| **File** | `agents/sparrow.ts` |
| **Color** | `#28A050` |
| **Trigger** | Every 6 hours |
| **AI Model** | Claude Haiku (via `assembleEvidence()`) |

Five execution phases:

| Phase | Action | Per Run |
|-------|--------|---------|
| A | Scan unprocessed spam trap captures | 20 |
| B | Create takedowns from malicious URLs | 10 |
| C | Create takedowns from impersonation profiles | 10 |
| D | Evidence assembly for unenriched takedowns | 3 |
| E | Resolve providers & generate submission drafts | Variable |

Also: Phase D2 attaches social evidence to existing drafts.

**Inputs:** spam_trap_captures, url_scan_results, social_profiles, social_mentions, takedown_requests, takedown_providers
**Outputs:** takedown_requests, takedown_evidence, url_scan_results (takedown_id), social_profiles (evidence)

---

### 10. Watchdog — Social Mention Classifier

| Property | Value |
|----------|-------|
| **File** | `agents/watchdog.ts` |
| **Color** | `#FF4500` |
| **Trigger** | Event-driven (Flight Control, when backlog > 200) |
| **AI Model** | Claude Haiku (`classifyWithHaiku()`) |
| **Batch Size** | 50 unclassified mentions per run |

Classifies social mentions into threat types:

`impersonation` | `credential_leak` | `phishing_link` | `brand_abuse` | `code_leak` | `threat_actor_chatter` | `vulnerability_disclosure` | `benign`

- HIGH/CRITICAL mentions escalated to `threats` table
- Benign with 90%+ confidence marked as false positives
- Fallback heuristic patterns when no API key

**Inputs:** social_mentions (status='new'), brands (aliases, keywords, executives)
**Outputs:** Updated social_mentions, new threats (for escalated), agent_outputs

---

### 11. Narrator — Threat Narrative Generation

| Property | Value |
|----------|-------|
| **File** | `agents/narrator.ts` |
| **Trigger** | On-demand (called by other agents) |
| **AI Model** | Claude Haiku (up to 2,048 tokens) |

Generates multi-signal threat narratives. Requires 2+ signal types:

| Signal Type | Source |
|-------------|--------|
| threats | Active threats (7d) |
| email_degradation | D/F security grades |
| social_impersonation | Impersonation profiles |
| lookalike_domains | Registered lookalikes |
| ct_certificates | Suspicious certificates |

**Confidence scoring:** 4 signals = 85%, 3 = 70%, 2 = 55%

**Output structure:** Title, multi-paragraph narrative, executive summary, attack stage, 3-5 recommendations. Creates alerts for HIGH/CRITICAL severity.

**Inputs:** threats, brands, social_monitor_results, lookalike_domains, ct_certificates
**Outputs:** threat_narratives, alerts (HIGH/CRITICAL)

---

### 12. Seed Strategist — Trap Strategy

| Property | Value |
|----------|-------|
| **File** | `agents/seed-strategist.ts` |
| **Color** | `#F59E0B` |
| **Trigger** | Daily at 6am UTC |
| **AI Model** | Claude Haiku |
| **Cost Guard** | Yes (non-critical) |

Analyzes spam trap performance and identifies coverage gaps:

- 7-day capture metrics by channel (generic, brand, spider, paste, honeypot)
- Identifies brands with high threat counts but no trap catches
- Haiku generates seeding recommendations (3-5 actions)
- Auto-creates campaigns and seed addresses
- Auto-retires inactive addresses

**Inputs:** spam_trap_captures, brands, seed_campaigns, seed_addresses
**Outputs:** seed_campaigns, seed_addresses, agent_outputs

---

### 13. Curator — Data Quality

| Property | Value |
|----------|-------|
| **File** | `agents/curator.ts` |
| **Color** | `#4ADE80` |
| **Trigger** | Weekly (Flight Control triggers) |
| **AI Model** | None (algorithmic) |

Three maintenance tasks:

1. **Email security scanning** — 500 brands without grades
2. **False-positive cleanup** — Remove threats targeting known-safe infrastructure (apple.com, googleapis.com, amazon.com, microsoft.com, cloudflare.com, etc.)
3. **Social profile discovery** — 50 high-threat brands with stale profile data

**Inputs:** brands, threats, social_profiles
**Outputs:** Updated brands (email grades), threats (false_positive), social_profiles (new), agent_outputs (hygiene_report)

---

### 14. Trustbot — Interactive Copilot

| Property | Value |
|----------|-------|
| **File** | `agents/trustbot.ts` |
| **Color** | `#60A5FA` |
| **Trigger** | Manual — via `/api/trustbot/chat` |
| **AI Model** | None (context gathering + formatting) |

Interactive Q&A for threat intelligence. Auto-gathers context based on query keywords:

| Keywords | Context Gathered |
|----------|-----------------|
| "threat", "overview", "status" | 24h threat stats |
| Domain pattern | IOC lookup |
| IP address | IP lookup |
| "brand" | Brand information |
| "feed" | Feed health status |
| "agent" | Recent agent runs |

**Inputs:** User query + auto-gathered DB context
**Outputs:** Formatted response (not persisted)

---

## Agent Scheduling Summary

| Agent | Frequency | AI Model | Cost Guard | Parallel |
|-------|-----------|----------|------------|----------|
| Flight Control | Every cron tick (first) | None | No | No |
| Sentinel | Event-driven | Haiku | No | No |
| Analyst | Every 15 min | Haiku | No | Up to 3 |
| Cartographer | Every 15 min | Haiku | No | Up to 3 |
| Nexus | Every 4 hours | None | No | No |
| Strategist | Every 6 hours | Haiku | Yes | No |
| Sparrow | Every 6 hours | Haiku | No | No |
| Observer | Daily | Haiku | Yes | No |
| Seed Strategist | Daily 6am | Haiku | Yes | No |
| Curator | Weekly | None | No | No |
| Watchdog | Event-driven | Haiku | No | No |
| Prospector | Weekly | Haiku | No | No |
| Narrator | On-demand | Haiku | No | No |
| Trustbot | On-demand | None | No | No |

## Agent Trigger Chain

```
Feed Ingestion → Sentinel (classification)
Sentinel → Analyst (brand matching)
Analyst → Cartographer (enrichment)
Cartographer → Nexus (correlation)
Nexus → Observer (pivot alerts)
Nexus → Strategist (campaign patterns)
Sparrow ← url_scan_results, social_profiles (takedowns)
Watchdog ← social_mentions (classification)
Narrator ← multiple signal types (narratives)
Flight Control → all agents (supervision, scaling, recovery)
```
