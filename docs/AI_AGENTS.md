# AI Agents

Trust Radar uses a system of 8 AI agents plus 2 infrastructure agents powered by Claude Haiku via the Anthropic API. Agents are defined as modules in `packages/trust-radar/src/agents/` and orchestrated by the agent runner in `packages/trust-radar/src/lib/agentRunner.ts`.

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

### AI Client

All agents use Claude Haiku via the direct Anthropic API. The AI client is in `packages/trust-radar/src/lib/haiku.ts` and provides specialized functions:

- `inferBrand()` — Brand identification from domain/URL patterns
- `classifyThreat()` — Threat classification and severity scoring
- `generateInsight()` — Intelligence narrative generation
- `generateCampaignName()` — Campaign naming from infrastructure patterns
- `scoreProvider()` — Hosting provider reputation scoring
- `checkCostGuard()` — API cost control for non-critical agents

### Agent Registry

Agents are registered in `packages/trust-radar/src/agents/index.ts`. The registry maps agent names to modules for the scheduler and API.

### Cost Guard

Non-critical agents (Observer, Strategist, Seed Strategist) check a cost guard before making API calls. This prevents runaway Anthropic API costs by tracking daily token usage.

---

## Agent Reference

### Sentinel

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/sentinel.ts` |
| **Trigger** | Every feed ingestion event (continuous) |
| **Purpose** | Classify new threats, assign confidence scores and severity |

The Sentinel runs on every feed ingestion cycle. It processes newly ingested threats that lack classification:

- **AI classification** — Sends threat domain/URL to Claude Haiku for threat type classification and severity assignment
- **Homoglyph detection** — Detects Unicode/visual lookalike characters in domains (Cyrillic 'a', '0' for 'o', etc.)
- **Brand squatting detection** — Identifies domains containing brand keywords (e.g., `paypal-verify.com`)
- **Confidence scoring** — Assigns 0-100 confidence scores based on source quality and threat type
- **Fallback** — Uses rule-based classification when Haiku is unavailable

**Inputs:** Unclassified threats from the `threats` table
**Outputs:** Updated threat records with `severity`, `confidence_score`, and `threat_type`

---

### Analyst

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/analyst.ts` |
| **Trigger** | Scheduled — every 15 minutes |
| **Purpose** | Brand attribution for threats that rule-based detection missed |

The Analyst processes threats that have no `target_brand_id` assigned. It uses Claude Haiku to infer which brand is being targeted from domain and URL patterns, supplementing the rule-based detection in `packages/trust-radar/src/lib/brandDetect.ts`.

- Loads the top 100 known brands for context
- Filters against the safe domain allowlist (`packages/trust-radar/src/lib/safeDomains.ts`)
- Runs brand-threat correlation via `packages/trust-radar/src/brand-threat-correlator.ts`
- Processes up to 30 unattributed threats per run

**Inputs:** Threats with `target_brand_id IS NULL` and a non-null `malicious_domain`
**Outputs:** Updated `target_brand_id` on threat records; `agent_outputs` entries

---

### Observer

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/observer.ts` |
| **Trigger** | Scheduled — daily |
| **Purpose** | Generate intelligence briefings from trend analysis |

The Observer synthesizes threat data from the last 24 hours into human-readable intelligence briefings. It gathers:

- Threat volume and severity distribution
- Top targeted brands (with IDs for dashboard linking)
- Top hosting providers
- Recent agent outputs from other agents
- Feed health status

This context is sent to Claude Haiku, which generates 3-5 professional intelligence briefing items. Briefings are stored as `agent_outputs` and surfaced in the HUD and insights panel. Creates user notifications for critical findings.

**Inputs:** Aggregated threat statistics, brand targeting patterns, provider data
**Outputs:** Intelligence briefing entries in `agent_outputs`; user notifications

---

### Strategist

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/strategist.ts` |
| **Trigger** | Scheduled — every 6 hours |
| **Purpose** | Campaign correlation and clustering |

The Strategist identifies coordinated threat campaigns by correlating shared infrastructure:

- **IP clustering** — Groups threats sharing the same IP address (3+ threats threshold)
- **ASN clustering** — Groups threats from the same autonomous system
- **Registrar clustering** — Identifies bulk domain registrations
- **Timing analysis** — Detects threats registered in close temporal proximity

When clusters are found, Claude Haiku generates descriptive campaign names. New campaigns are created in the `campaigns` table, and threats are linked via `campaign_id`.

**Inputs:** Uncampaigned active threats with shared infrastructure indicators
**Outputs:** New/updated `campaigns` records; linked threats; `agent_outputs` entries

---

### Cartographer

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/cartographer.ts` |
| **Trigger** | Scheduled — every 6 hours |
| **Purpose** | Infrastructure mapping and hosting provider reputation scoring |

The Cartographer operates in two phases:

1. **Geo enrichment** — Enriches threats missing geographic data (IP geolocation via `packages/trust-radar/src/lib/geoip.ts`)
2. **Provider scoring** — Uses Claude Haiku to score the top 50 hosting providers based on threat volume, response times, and trends

Also runs email security scans for monitored brands via `packages/trust-radar/src/email-security.ts`.

**Inputs:** Threats missing `country_code`; hosting providers with `total_threat_count > 0`
**Outputs:** Enriched threat records; provider reputation scores; `agent_outputs` entries

---

### Prospector

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/prospector.ts` |
| **Trigger** | Scheduled — weekly |
| **Purpose** | Sales intelligence and lead generation |

The Prospector implements a three-stage pipeline:

1. **Prospect identification** — Scores brands from platform data (threat count, email security grade, phishing URLs, spam trap catches) to identify high-value sales prospects
2. **Company research** — Uses Claude Haiku to research the company and identify security leadership contacts
3. **Outreach generation** — Generates personalized outreach email drafts with two subject/body variants

Processes up to 5 prospects per run. Results are stored in the `sales_leads` table with pipeline status tracking (identified, researched, drafted, approved, sent, responded, booked, converted, declined).

**Inputs:** Brand data with threat metrics, email security scores
**Outputs:** `sales_leads` records with research and outreach drafts

---

### Trustbot

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/trustbot.ts` |
| **Trigger** | Manual — on user request via `/api/trustbot/chat` |
| **Purpose** | Interactive AI threat intelligence copilot |

Trustbot is a conversational agent that answers questions about threats, IOCs, and platform status. It is not a scheduled agent -- it runs on demand via the chat API endpoint.

Based on query keywords, Trustbot automatically gathers relevant context:

- Threat statistics (when query mentions "threat", "overview", "status")
- Domain lookups (when query contains a domain pattern)
- IP lookups (when query contains an IP address)
- Brand information (when query mentions "brand")

Context is sent to Claude Haiku along with the user's question for a contextual response.

**Inputs:** User query string + auto-gathered DB context
**Outputs:** AI-generated response with supporting data

---

### Seed Strategist

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/seed-strategist.ts` |
| **Trigger** | Scheduled — daily at 6am UTC |
| **Purpose** | Spam trap seeding strategy and coverage optimization |

The Seed Strategist analyzes spam trap performance and identifies coverage gaps:

- Gathers 7-day trap capture metrics (by channel: generic, brand, spider, paste, honeypot)
- Identifies brands with high threat counts but no trap catches
- Uses Claude Haiku to recommend new seeding campaigns
- Auto-creates campaigns and seed addresses based on AI recommendations

**Inputs:** Spam trap capture statistics; brand threat data; existing campaign performance
**Outputs:** New seeding campaigns; seed addresses; `agent_outputs` entries

---

### Cube Healer

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/cube-healer.ts` |
| **Trigger** | Scheduled — every 6 hours (`12 */6 * * *`) |
| **Purpose** | Retroactive drift remediation for OLAP cube tables |

The Cube Healer performs a full 30-day bulk rebuild of all three OLAP cube tables (`threat_cube_geo`, `threat_cube_provider`, `threat_cube_brand`) via `INSERT OR REPLACE ... SELECT ... GROUP BY`. This bounds drift from Cartographer's retroactive enrichment to ≤6 hours.

- **Scope** — Excludes the current partial hour (Navigator's territory). The previous hour overlap is intentional and safe because `INSERT OR REPLACE` is idempotent.
- **Status semantics** — All cubes succeed → `success`; some fail → `partial`; first cube throws → `failed`
- **agent_runs lifecycle** — Inserts a `partial` row at start (crash-safe), updates to final status on completion

**Inputs:** Raw `threats` table (30-day window, active status)
**Outputs:** Rebuilt rows in `threat_cube_geo`, `threat_cube_provider`, `threat_cube_brand`

---

### Parity Checker

| Property | Value |
|----------|-------|
| **File** | `packages/trust-radar/src/agents/parity-checker.ts` |
| **Trigger** | Called by Navigator cron (every 5 minutes) |
| **Purpose** | Validate OLAP cube accuracy against raw threats table |

The Parity Checker compares cube row counts against raw `threats` aggregates for the same time window. It reports drift percentage and logs results to `agent_runs`. If drift exceeds thresholds, the cube-healer's next run will correct it.

**Inputs:** `threat_cube_geo`, `threat_cube_provider` row counts vs raw threats aggregates
**Outputs:** Drift percentages logged to `agent_runs`

---

## Agent Scheduling Summary

| Agent | Frequency | Cost Guard | Approval Required |
|-------|-----------|------------|-------------------|
| Sentinel | Every 5 min (with feeds) | No | No |
| Analyst | Every 15 min | No | No |
| Observer | Daily | Yes | No |
| Strategist | Every 6 hours | Yes | No |
| Cartographer | Every 6 hours | No | No |
| Prospector | Weekly | No | No |
| Trustbot | On demand | No | No |
| Seed Strategist | Daily | Yes | No |
| Nexus | Every 4 hours | No | No |
| Cube Healer | Every 6 hours | No | No |
| Parity Checker | Every 5 min (via Navigator) | No | No |
| Navigator | Every 5 min cron | No | No |

---

## Infrastructure Agents

In addition to the AI-powered agents above, two infrastructure agents maintain the OLAP cube layer:

### Navigator (`src/cron/navigator.ts`)

Runs every 5 minutes on its own cron. Independent of Flight Control's dispatch —
FC monitors Navigator's health but does not manage it. Previously known as
`fast_tick`; historical `agent_runs` rows use `agent_id='fast_tick'` and new
runs write `agent_id='navigator'`. Not an AI agent — pure SQL. Responsibilities:

1. **DNS resolution** (primary mission) — resolve malicious domains to IP
   addresses so Cartographer can geo-enrich them (200 domains / 8s batch)
2. Drain stale pending `agent_events` (housekeeping)
3. Rebuild current + previous hour for all 3 cube tables (6 cube builds)
4. Pre-warm KV caches for Observatory, Dashboard, Agents, Operations pages

Navigator finds the path (IP addresses); Cartographer maps the terrain (lat/lng,
country, provider).

### Cloudflare Workflows

Heavy agents are dispatched as durable Workflows instead of running inline in the cron handler:
- **CartographerBackfillWorkflow** — dispatched by orchestrator for Cartographer enrichment
- **NexusWorkflow** — dispatched by orchestrator for NEXUS clustering

This prevents long-running agents from blocking the cron mesh or hitting the 30s Worker CPU limit.
