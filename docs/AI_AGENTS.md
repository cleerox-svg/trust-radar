# AI Agents

Trust Radar uses a mesh of 14 autonomous AI agents powered by Claude Haiku via the Anthropic API. Agents are defined as modules in `packages/trust-radar/src/agents/` and orchestrated by the agent runner in `packages/trust-radar/src/lib/agentRunner.ts`.

---

## Agent Infrastructure

### Agent Runner

The agent runner (`packages/trust-radar/src/lib/agentRunner.ts`) provides the execution framework. Each agent implements the `AgentModule` interface:

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

Every agent execution follows this lifecycle:

1. A row is logged to `agent_runs` at start (`status = 'success'`, `completed_at = NULL`)
2. The agent performs its work, writing to its target tables
3. On completion, `agent_runs` is updated with `completed_at` and `records_processed`
4. An event is emitted to `agent_events` so downstream agents can react
5. On error, the exception is caught and logged to `agent_runs.error_message`

### AI Client

All agents use Claude Haiku via the direct Anthropic API. The AI client is in `packages/trust-radar/src/lib/haiku.ts` and provides specialized functions:

- `inferBrand()` -- Brand identification from domain/URL patterns
- `classifyThreat()` -- Threat classification and severity scoring
- `generateInsight()` -- Intelligence narrative generation
- `generateCampaignName()` -- Campaign naming from infrastructure patterns
- `scoreProvider()` -- Hosting provider reputation scoring
- `classifyWithHaiku()` -- Social mention classification
- `assembleEvidence()` -- Takedown evidence assembly
- `checkCostGuard()` -- API cost control for non-critical agents

### Agent Registry

Agents are registered in `packages/trust-radar/src/agents/index.ts`. The registry maps agent names to modules for the scheduler and API. There are 11 agents in the main registry plus 3 additional agents (Trustbot, Narrator, and Seed Strategist) registered separately.

### Cost Guard

Non-critical agents (Observer, Strategist, Seed Strategist, Prospector) check a cost guard before making API calls. This prevents runaway Anthropic API costs by tracking daily token usage. Budget levels control system-wide AI access:

| Budget Level | Behavior |
|-------------|----------|
| **emergency** | All AI calls paused across every agent |
| **hard** | Minimal AI usage -- only critical classification |
| **soft** | Reduced batch sizes for all AI-using agents |
| **normal** | Full operation, all agents at standard throughput |

### Agent Trigger Chain

Agents communicate via the `agent_events` table. The canonical trigger chain is:

```
Sentinel --> [feed_pulled] --> Cartographer
Cartographer --> [threats_enriched] --> Nexus
Nexus --> [cluster_detected] --> Analyst + Observer (if high severity)
Nexus --> [pivot_detected] --> Observer (immediate)
Analyst --> [scores_updated] --> Pathfinder (if new high-value leads)
```

---

## Agent Reference

### 1. Flight Control -- Autonomous Supervisor

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/flightControl.ts` |
| **Color** | `#00d4ff` |
| **Trigger** | Runs FIRST on every cron tick |
| **AI Model** | None (pure orchestration) |
| **Cost Guard** | No |

Flight Control is the command layer of the agent mesh. It runs before any other agent on every cron tick and makes autonomous decisions about what needs to run, how many parallel instances to allow, and whether any agents are stalled.

**Backlog monitoring** -- Measures 13 independent backlogs to determine system pressure:

| Backlog | Description |
|---------|-------------|
| `cartographer` | Threats missing geo/ASN enrichment |
| `analyst` | Threats missing brand attribution |
| `totalUnlinked` | Threats with no cluster assignment |
| `totalNoGeo` | Threats with no geolocation data |
| `surblUnchecked` | Threats not yet checked against SURBL |
| `vtUnchecked` | Threats not yet checked against VirusTotal |
| `gsbUnchecked` | Threats not yet checked against Google Safe Browsing |
| `dblUnchecked` | Threats not yet checked against Spamhaus DBL |
| `abuseipdbUnchecked` | Threats not yet checked against AbuseIPDB |
| `pdnsUnchecked` | Threats not yet checked against passive DNS |
| `greynoiseUnchecked` | Threats not yet checked against GreyNoise |
| `seclookupUnchecked` | Threats not yet checked against SecurityTrails |
| `watchdog` | Unclassified social mentions |

**Parallel scaling** -- Dynamically adjusts agent concurrency based on backlog size:

| Agent | Max Parallel | Low Threshold | Medium Threshold | High Threshold |
|-------|-------------|---------------|-----------------|----------------|
| Cartographer | 3 | 500 | 2,000 | 5,000 |
| Analyst | 3 | 50 | 200 | 500 |

**Stall recovery** -- Detects agents that have been running too long and triggers recovery:

| Agent | Stall Threshold |
|-------|----------------|
| Sentinel | 35 minutes |
| Cartographer | 75 minutes |
| Nexus | 260 minutes |
| Analyst | 35 minutes |
| Observer | 1,500 minutes |
| Sparrow | 120 minutes |

**Additional responsibilities:**
- CertStream health check (ensures certificate transparency monitoring is active)
- Curator weekly trigger (schedules data hygiene runs)
- Budget enforcement (applies cost guard levels across the system)

**Inputs:** `agent_runs` (execution history), all backlog source tables
**Outputs:** Agent scheduling decisions, stall recovery actions, scaling adjustments

---

### 2. Sentinel -- Threat Classification

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/sentinel.ts` |
| **Color** | `#C83C3C` |
| **Trigger** | Event-driven (on feed ingestion) |
| **AI Model** | Claude Haiku |
| **Cost Guard** | No |

The Sentinel is the first agent to process newly ingested threats. It classifies each threat, assigns confidence scores and severity levels, and detects advanced persistent threat (APT) patterns.

**Core functions:**

- `classifyThreat()` -- AI-powered threat classification using Claude Haiku. Determines threat type, severity, and confidence score from domain/URL patterns and contextual signals.
- `detectHomoglyphs()` -- Identifies Unicode/visual lookalike characters in domains (Cyrillic 'a' for Latin 'a', '0' for 'o', etc.) that indicate impersonation attempts.
- `detectBrandSquatting()` -- Detects domains containing brand keywords with suspicious prefixes/suffixes (e.g., `paypal-verify.com`, `amazon-login.net`).
- `ruleBasedClassify()` -- Fallback classification engine when Haiku is unavailable or for clear-cut cases that do not require AI.

**Social monitoring integration:** Sentinel also performs AI assessment of HIGH and CRITICAL social monitoring results from the `social_monitor_results` table, escalating confirmed threats.

**Reads:** `threats` (unclassified), `monitored_brands`, `social_profiles`, `social_monitor_results`
**Writes:** `threats` (confidence_score, severity, threat_type), `agent_outputs`, `agent_events`

---

### 3. Analyst -- Brand Attribution & Correlation

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/analyst.ts` |
| **Color** | `#E8923C` |
| **Trigger** | Scheduled -- every 15 minutes |
| **AI Model** | Claude Haiku |
| **Cost Guard** | No |
| **Dependencies** | Cartographer, Sentinel |

The Analyst handles brand attribution for threats that rule-based detection missed, runs correlation escalation, and integrates social intelligence signals.

**5-phase pipeline:**

1. **Brand matching** -- Uses Claude Haiku via `inferBrand()` to determine which brand is being targeted from domain/URL patterns. Loads the top 100 known brands for context and filters against the `safe_domains` allowlist.
2. **Correlation escalation** -- Cross-references threats with existing clusters and campaigns to escalate severity when coordinated targeting is detected.
3. **Enrichment validation** -- Validates that enrichment data from Cartographer is consistent and flags anomalies.
4. **Social intelligence** -- Integrates social profile data and social monitoring results into brand risk assessments.
5. **Social mentions** -- Processes social mention signals from the `social_mentions` table to augment brand threat scoring.

**Batch processing:** Up to 30 threats per run by default, scalable by Flight Control up to 500 under high backlog pressure.

**Reads:** `threats` (unmatched), `brands` (top 100), `safe_domains`, `brand_threat_assessments`, `social_mentions`
**Writes:** `threats` (target_brand_id, severity), `brands` (new entries), `agent_outputs`

---

### 4. Cartographer -- Infrastructure Mapping

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/cartographer.ts` |
| **Color** | `#5A80A8` |
| **Trigger** | Scheduled -- every 15 minutes |
| **AI Model** | Claude Haiku |
| **Cost Guard** | No |

The Cartographer enriches raw threat data with geographic, network, and hosting infrastructure information. It is the primary enrichment agent and runs a multi-stage pipeline on every execution.

**Enrichment pipeline:**

| Stage | Description | Volume |
|-------|-------------|--------|
| IP geolocation | Batch lookups via ip-api.com | 5 batches of 500 IPs |
| RDAP registrar | Domain registrar lookups | 10 domains per run |
| ipinfo.io fallback | Secondary geo source when ip-api fails | As needed |
| Haiku scoring | AI-powered hosting provider reputation via `scoreProvider()` | Top providers |
| Email security | DMARC/SPF/DKIM scanning for monitored brands | 50 brands per run |
| DMARC geo | Geographic distribution of email authentication | Per-brand analysis |
| Provider stats | Aggregate provider threat statistics | All active providers |

**Parallel execution:** Flight Control can run up to 3 Cartographer instances simultaneously when the enrichment backlog exceeds 2,000 threats.

**Reads:** `threats` (unenriched), `hosting_providers`, `brands`
**Writes:** `threats` (lat, lng, country_code, asn, hosting_provider_id, registrar, enriched_at), `hosting_providers`, `email_security_scans`, `provider_threat_stats`

---

### 5. Nexus -- Infrastructure Correlation

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/nexus.ts` |
| **Color** | `#00d4ff` |
| **Trigger** | Scheduled -- every 4 hours |
| **AI Model** | None (pure SQL) |
| **Cost Guard** | No |
| **Dependencies** | Analyst, Cartographer |

Nexus is the correlation brain of Trust Radar. It uses SQL-only clustering (no AI) to identify infrastructure relationships between threats, following the platform rule: "SQL does correlation. AI does narrative."

**Clustering method:** Groups threats by shared ASN and threat type, identifying coordinated infrastructure usage patterns.

**Detection capabilities:**

- **Pivot detection** -- Identifies threat actors migrating infrastructure when a provider's threat volume drops by more than 80%, indicating a takedown or voluntary move. Emits `pivot_detected` events to trigger Observer for immediate narrative generation.
- **Acceleration detection** -- Flags providers experiencing more than 50% increase in threat volume, indicating a new campaign ramping up.

**Reads:** `threats` (enriched), `hosting_providers`, `infrastructure_clusters`
**Writes:** `infrastructure_clusters`, `hosting_providers` (trend data), `threats` (cluster_id), `agent_events` (pivot and cluster events)

---

### 6. Observer -- Daily Intelligence

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/observer.ts` |
| **Color** | `#78A0C8` |
| **Trigger** | Daily |
| **AI Model** | Claude Haiku |
| **Cost Guard** | Yes |

The Observer synthesizes the entire platform's data from the last 24 hours into human-readable intelligence briefings. It has the broadest read scope of any agent, gathering context from virtually every table.

**Data sources consumed:**

- 24-hour threat summary (volume, severity distribution, new threat types)
- Brand targeting patterns and brand threat assessments
- Hosting provider trends and reputation changes
- Campaign activity and infrastructure clusters
- Agent outputs from all other agents
- Email security scan results
- Social profiles and social monitoring results
- Lookalike domain detections
- Certificate Transparency (CT) certificate findings
- Spam trap captures
- Threat signals
- Social mentions

**Output:** Uses Claude Haiku via `generateInsight()` to produce 3-5 professional intelligence briefing items. Briefings are stored as `agent_outputs` (type: `insight`) and surfaced in the HUD and insights panel. Creates user notifications for critical findings.

**Reads:** ALL major tables (broadest read scope in the system)
**Writes:** `agent_outputs` (type: insight), `notifications`

---

### 7. Strategist -- Campaign Correlation

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/strategist.ts` |
| **Color** | `#8A8F9C` |
| **Trigger** | Scheduled -- every 6 hours |
| **AI Model** | Claude Haiku |
| **Cost Guard** | Yes |

The Strategist identifies coordinated threat campaigns by correlating shared infrastructure across multiple dimensions.

**Correlation methods:**

- **IP clustering** -- Groups threats sharing the same IP address (3+ threats threshold)
- **ASN clustering** -- Groups threats hosted on the same autonomous system
- **Registrar clustering** -- Identifies bulk domain registrations from the same registrar in temporal proximity
- **Coordination detection** -- AI-powered analysis to identify operational coordination patterns across clusters

**Campaign naming:** When clusters are found, Claude Haiku via `generateCampaignName()` generates descriptive campaign names based on the infrastructure fingerprint (e.g., "Cloudflare-hosted PayPal credential harvest").

**Reads:** Uncampaigned active threats with shared infrastructure indicators
**Writes:** `campaigns`, `threats` (campaign_id), `infrastructure_clusters`, `agent_outputs`, `notifications`

---

### 8. Prospector -- Sales Intelligence

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/prospector.ts` |
| **Color** | `#28A050` |
| **Trigger** | Weekly (lead creation), every run (enrichment) |
| **AI Model** | Claude Haiku |
| **Cost Guard** | Yes |

The Prospector identifies high-value sales prospects from platform data and generates personalized outreach materials.

**Lead scoring formula** -- Brands are scored across multiple weighted dimensions:

| Signal | Description |
|--------|-------------|
| Email grade | DMARC/SPF/DKIM posture score |
| DMARC status | Specific DMARC policy analysis |
| Phishing volume | Active phishing URLs targeting the brand |
| Spam trap catches | Brand-specific spam trap capture count |
| Risk score | Composite brand risk assessment |
| AI phishing detection | AI-classified phishing threat count |
| Tranco rank | Website popularity (higher rank = higher value target) |
| Campaign count | Number of active campaigns targeting the brand |
| Social signals | Social media impersonation/abuse indicators |

**AI enrichment pipeline** -- 3 Haiku calls per lead:

1. **Summary** -- Company overview, security posture assessment, and key risk factors
2. **Outreach** -- Personalized email drafts with two subject/body variants
3. **Research** -- Identification of security leadership contacts and decision makers

**Reads:** `brands`, `email_security_scans`, `threats`, `spam_trap_captures`, `campaigns`, `social_mentions`
**Writes:** `sales_leads`, `agent_outputs`

---

### 9. Sparrow -- Takedown Agent

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/sparrow.ts` |
| **Color** | `#28A050` |
| **Trigger** | Scheduled -- every 6 hours |
| **AI Model** | Claude Haiku |
| **Cost Guard** | No |

Sparrow is the action agent -- it executes takedown workflows against confirmed threats. It operates in 5 phases per run.

**Execution phases:**

| Phase | Description | Volume |
|-------|-------------|--------|
| **A -- Scan captures** | Takes URL screenshots/captures for evidence preservation | 20 per run |
| **B -- Takedowns from URLs** | Initiates takedown requests for confirmed malicious URLs | 10 per run |
| **C -- Takedowns from impersonations** | Initiates takedowns for social media impersonation profiles | 10 per run |
| **D -- Evidence assembly** | Uses Haiku via `assembleEvidence()` to compile takedown evidence packages | 3 per run |
| **E -- Provider resolution** | Resolves hosting/registrar contacts and generates takedown notice drafts | As needed |

**Reads:** `threats` (confirmed), `takedown_requests`, `social_profiles`
**Writes:** `takedown_requests`, `takedown_evidence`, `url_scan_results`, `social_profiles`

---

### 10. Watchdog -- Social Mention Classifier

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/watchdog.ts` |
| **Color** | `#FF4500` |
| **Trigger** | Event-driven (Flight Control triggers when backlog exceeds 200) |
| **AI Model** | Claude Haiku |
| **Cost Guard** | No |

The Watchdog classifies social media mentions in real time, separating genuine threats from benign brand mentions.

**Batch size:** 50 unclassified mentions per run.

**Classification taxonomy:**

| Threat Type | Description |
|-------------|-------------|
| `impersonation` | Fake accounts posing as the brand |
| `credential_leak` | Exposed credentials mentioning the brand |
| `phishing_link` | Social posts containing phishing URLs |
| `brand_abuse` | Unauthorized brand usage |
| `code_leak` | Source code or API key exposure |
| `threat_actor_chatter` | Underground discussion about targeting the brand |
| `vulnerability_disclosure` | Public vulnerability information |
| `benign` | Legitimate brand mention, no threat |

**Escalation:** HIGH and CRITICAL classifications are automatically escalated to the `threats` table for processing by the main agent pipeline.

**Fallback:** Uses heuristic pattern matching via `classifyWithHaiku()` fallback when AI is unavailable.

**Reads:** `social_mentions` (unclassified)
**Writes:** `social_mentions` (classification), `threats` (escalated items)

---

### 11. Narrator -- Threat Narrative Generation

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/narrator.ts` |
| **Color** | N/A |
| **Trigger** | On-demand (called by other agents) |
| **AI Model** | Claude Haiku (up to 2,048 tokens) |
| **Cost Guard** | No |

The Narrator generates rich threat narratives that connect multiple signal types into a coherent story. It is not a scheduled agent -- other agents invoke it when they detect multi-signal threats that warrant a narrative explanation.

**Signal type requirements:** Requires 2 or more distinct signal types to generate a narrative:

| Signal Type | Source |
|-------------|--------|
| `threats` | Core threat intelligence data |
| `email_degradation` | Email security posture changes |
| `social_impersonation` | Social media impersonation detections |
| `lookalike_domains` | Visually similar domain registrations |
| `ct_certificates` | Certificate Transparency log matches |

**Confidence scoring:**

| Signal Count | Confidence |
|-------------|------------|
| 4+ signals | 85% |
| 3 signals | 70% |
| 2 signals | 55% |

**Alert creation:** Automatically creates alerts for narratives classified as HIGH or CRITICAL severity.

**Reads:** Multiple signal tables depending on the narrative context
**Writes:** `agent_outputs` (threat narratives), alerts

---

### 12. Seed Strategist -- Trap Strategy

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/seed-strategist.ts` |
| **Color** | `#F59E0B` |
| **Trigger** | Daily at 6am UTC |
| **AI Model** | Claude Haiku |
| **Cost Guard** | Yes |

The Seed Strategist optimizes spam trap coverage by analyzing performance data and recommending new seeding strategies.

**Analysis scope:**
- 7-day trap capture metrics segmented by channel (generic, brand, spider, paste, honeypot)
- Brands with high threat counts but zero trap catches (coverage gaps)
- Existing campaign performance and seed address activity

**Automated actions:**
- Creates new seeding campaigns based on AI recommendations
- Generates seed email addresses for identified coverage gaps
- Auto-retires inactive seed addresses that have not captured anything

**Reads:** `spam_trap_captures`, `brands`, `campaigns`, seed address tables
**Writes:** `campaigns`, seed addresses, `agent_outputs`

---

### 13. Curator -- Data Quality

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/curator.ts` |
| **Color** | `#4ADE80` |
| **Trigger** | Weekly (triggered by Flight Control) |
| **AI Model** | None (algorithmic) |
| **Cost Guard** | No |

The Curator maintains data quality across the platform through three automated hygiene tasks.

**Tasks:**

| Task | Description | Volume |
|------|-------------|--------|
| **Email security scanning** | Refreshes email security posture data for monitored brands | 500 brands per run |
| **False-positive cleanup** | Identifies and removes threats flagged as false positives based on resolution patterns and safe domain lists | All flagged threats |
| **Social profile discovery** | Discovers new social media profiles for monitored brands to expand monitoring coverage | 50 brands per run |

**Reads:** `brands`, `threats`, `email_security_scans`, `social_profiles`, `safe_domains`
**Writes:** `email_security_scans`, `threats` (false-positive removals), `social_profiles`

---

### 14. Trustbot -- Interactive Copilot

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/trustbot.ts` |
| **Color** | `#60A5FA` |
| **Trigger** | Manual -- via `/api/trustbot/chat` |
| **AI Model** | None (response formatting, context gathering) |
| **Cost Guard** | No |

Trustbot is the interactive intelligence copilot for Trust Radar users. It is not a scheduled agent -- it runs on demand via the chat API endpoint and provides conversational access to platform data.

**Context-aware querying:** Based on query keywords, Trustbot automatically gathers relevant context before responding:

| Query Pattern | Context Gathered |
|--------------|-----------------|
| "threat", "overview", "status" | Threat statistics, severity distribution, recent activity |
| Domain pattern (e.g., `example.com`) | Domain-specific threat lookup, enrichment data, campaign links |
| IP address pattern | IP geolocation, hosting provider, associated threats |
| "brand" | Brand registry data, threat assessments, monitoring status |
| "feed", "source" | Feed schedule health, ingestion statistics |
| "agent", "run" | Agent execution history and status from `agent_runs` |

**Reads:** `threats`, `feed_schedules`, `agent_runs`
**Writes:** None (read-only agent)

---

## Agent Scheduling Summary

| Agent | Frequency | AI Model | Cost Guard |
|-------|-----------|----------|------------|
| Flight Control | Every cron tick (runs first) | None | No |
| Sentinel | Event-driven (feed ingestion) | Haiku | No |
| Analyst | Every 15 min | Haiku | No |
| Cartographer | Every 15 min | Haiku | No |
| Nexus | Every 4 hours | None | No |
| Strategist | Every 6 hours | Haiku | Yes |
| Sparrow | Every 6 hours | Haiku | No |
| Observer | Daily | Haiku | Yes |
| Seed Strategist | Daily at 6am UTC | Haiku | Yes |
| Curator | Weekly | None | No |
| Watchdog | Event-driven (backlog > 200) | Haiku | No |
| Prospector | Weekly | Haiku | Yes |
| Narrator | On-demand | Haiku | No |
| Trustbot | On-demand | None | No |

---

## Cron Schedule Reference

Defined in `packages/trust-radar/wrangler.toml`:

```
Sentinel:       */30 * * * *     (every 30 min)
Cartographer:   */15 * * * *     (every 15 min, also triggered by Sentinel)
Nexus:          0 */4 * * *      (every 4 hours, also triggered by Cartographer)
Analyst:        */30 * * * *     (every 30 min, also triggered by Nexus)
Observer:       0 0 * * *        (daily at midnight, also triggered by Nexus pivots)
Seed Strategist: 0 6 * * *      (daily at 6am UTC)
```

Flight Control runs first on every cron tick. Strategist, Sparrow, Curator, Watchdog, Narrator, Prospector, and Trustbot are triggered by Flight Control decisions or external events rather than fixed cron entries.
