# Claude Code Prompt — Sales AI Agent (Prospector)

Paste this into Claude Code:

---

I'm building a new AI agent called "Prospector" for Trust Radar — a sales intelligence agent that mines platform data to identify companies that would benefit from our threat intelligence, researches their security leadership, and generates personalized outreach drafts. This is the fifth agent alongside Analyst, Observer, Strategist, and Infrastructure Mapper.

The Trust Radar monorepo is at `packages/trust-radar/`. Before writing any code, READ the existing agent implementations to understand the patterns used — look at how the Analyst, Observer, and Strategist agents are structured in `src/`. Match the same patterns for Haiku API calls, cron scheduling, D1 queries, and output storage.

Also READ the existing migrations in `packages/trust-radar/migrations/` to confirm table schemas for: `brands`, `email_security_scans`, `threat_signals`, `spam_trap_captures`, `brand_threat_assessments`, `phishing_pattern_signals`, `threats`, `org_brands`. The Prospector reads from all of these.

---

## Part 1: Database Migration

Create a new migration (next number in sequence) with:

### sales_leads table

```sql
CREATE TABLE IF NOT EXISTS sales_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  prospect_score REAL NOT NULL,
  score_breakdown_json TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  
  -- Company research
  company_name TEXT,
  company_domain TEXT,
  company_industry TEXT,
  company_size TEXT,
  company_revenue_range TEXT,
  company_hq TEXT,
  research_json TEXT,
  researched_at TEXT,
  
  -- Security leader target
  target_name TEXT,
  target_title TEXT,
  target_linkedin TEXT,
  target_email TEXT,
  
  -- Platform findings snapshot
  email_security_grade TEXT,
  threat_count_30d INTEGER,
  phishing_urls_active INTEGER,
  trap_catches_30d INTEGER,
  composite_risk_score REAL,
  pitch_angle TEXT,
  findings_summary TEXT,
  
  -- Outreach
  outreach_variant_1 TEXT,
  outreach_variant_2 TEXT,
  outreach_selected TEXT,
  outreach_sent_at TEXT,
  outreach_channel TEXT,
  
  -- Follow-up tracking
  response_received_at TEXT,
  response_sentiment TEXT,
  meeting_booked_at TEXT,
  follow_up_count INTEGER DEFAULT 0,
  next_follow_up_at TEXT,
  
  -- Meta
  identified_by TEXT DEFAULT 'prospector_agent',
  reviewed_by INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

CREATE INDEX idx_leads_status ON sales_leads(status);
CREATE INDEX idx_leads_score ON sales_leads(prospect_score);
CREATE INDEX idx_leads_brand ON sales_leads(brand_id);
CREATE INDEX idx_leads_created ON sales_leads(created_at);
```

### lead_activity_log table

```sql
CREATE TABLE IF NOT EXISTS lead_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  details_json TEXT,
  performed_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES sales_leads(id)
);

CREATE INDEX idx_lead_activity_lead ON lead_activity_log(lead_id);
```

---

## Part 2: Prospector Agent — `src/prospector-agent.ts`

Create a new module implementing the three-stage pipeline. Follow the same agent code patterns used by the existing agents.

### Stage 1: Prospect Identification

Function: `identifyProspects(db: D1Database): Promise<ProspectCandidate[]>`

This function queries across platform tables to score every brand as a potential sales lead.

**Scoring logic:**

```typescript
interface ProspectCandidate {
  brand_id: number;
  brand_name: string;
  brand_domain: string;
  prospect_score: number;
  score_breakdown: Record<string, number>;
  email_security_grade: string | null;
  threat_count_30d: number;
  phishing_urls_active: number;
  trap_catches_30d: number;
  composite_risk_score: number | null;
  pitch_angle: string;
  findings_summary: string;
}

// Scoring weights:
const SCORING = {
  email_grade_f_or_d: 30,        // email_security_scans grade F or D
  email_grade_c: 15,             // email_security_scans grade C
  dmarc_none_or_missing: 20,     // DMARC policy 'none' or no DMARC record
  active_phishing_urls: 25,      // threat_signals with signal_type='phishing_url' and brand match (last 30d)
  spam_trap_catches: 20,         // spam_trap_captures with brand match (last 30d)
  high_risk_score: 15,           // brand_threat_assessments composite_risk_score > 60
  ai_phishing_detected: 10,      // phishing_pattern_signals with ai_generated_probability > 0.7
  tranco_top_10k: 10,            // brands with tranco_rank <= 10000
  multiple_campaigns: 15,        // 3+ distinct threats targeting brand (last 30d)
  recent_risk_spike: 10,         // risk score increased 20+ points from previous assessment
};
```

**Implementation approach:**

The most efficient way to do this is with a series of D1 queries that compute scores, NOT by loading all brands into memory and scoring one by one. Build it as:

1. Query brands with their latest `email_security_scans` grade
2. Query `threat_signals` counts per brand (last 30 days)
3. Query `spam_trap_captures` counts per brand (last 30 days)
4. Query `brand_threat_assessments` for latest risk scores
5. Query `phishing_pattern_signals` for AI detection flags
6. Join/aggregate these into prospect scores in TypeScript

**Filtering rules:**
- Exclude brands that appear in `org_brands` (already customers/tenants)
- Exclude brands already in `sales_leads` with status IN ('sent', 'responded', 'meeting_booked', 'converted', 'declined')
- Exclude brands in `sales_leads` where `created_at` > 90 days ago (don't re-prospect recently contacted)
- Only include brands with prospect_score >= 50
- Return top 20 by score, descending

**Pitch angle determination:**
- If email_grade_f_or_d AND active_phishing: pitch = 'urgent_exposure'
- If active_phishing AND trap_catches: pitch = 'active_attack'
- If email_grade_f_or_d AND dmarc_none: pitch = 'email_security'
- If ai_phishing_detected: pitch = 'ai_threat'
- If multiple_campaigns: pitch = 'campaign_targeting'
- Default: pitch = 'brand_protection'

**Findings summary generation:**
For each prospect, build a 2-3 sentence summary of what the platform found. This is plain text that will be used in the outreach generation. Example:
"Trust Radar detected 4 active phishing URLs impersonating Acme Corp and caught 7 spoofed emails in our spam traps over the past 30 days. Acme Corp's email security grade is D with DMARC set to 'none', leaving their domain unprotected against spoofing."

Generate this summary using Haiku — pass the raw data points and let Haiku write a concise, factual summary. Use the same Haiku API call pattern as the other agents.

### Stage 2: Company & CISO Research

Function: `researchProspect(candidate: ProspectCandidate, env: Env): Promise<ProspectResearch>`

For each prospect from Stage 1, use Haiku with web search tool to research the company and identify the security leader.

```typescript
interface ProspectResearch {
  company_name: string;
  company_domain: string;
  company_industry: string | null;
  company_size: string | null;        // 'startup' | 'smb' | 'mid-market' | 'enterprise'
  company_revenue_range: string | null;
  company_hq: string | null;
  
  target_name: string | null;
  target_title: string | null;
  target_linkedin: string | null;
  target_email: string | null;       // Only if publicly available
  
  security_maturity: string | null;  // 'low' | 'medium' | 'high'
  compliance_frameworks: string[];   // ['SOC2', 'ISO27001', 'HIPAA', etc.]
  recent_security_news: string | null;
  hiring_security: boolean;          // Are they posting security job openings?
  
  research_confidence: string;       // 'high' | 'medium' | 'low'
  raw_research: string;              // Full Haiku response for reference
}
```

**Haiku research prompt:**

```
You are a sales intelligence researcher for Trust Radar, a brand threat 
intelligence platform that detects phishing, brand impersonation, and 
email security vulnerabilities.

Research this company to build a sales prospect profile:

Company: {company_name}
Domain: {company_domain}
Industry hint: Based on our threat data, this company appears to operate in 
{inferred_industry_from_brand_data}

Find and return as JSON:
1. company_industry: Their primary industry
2. company_size: "startup" (<50), "smb" (50-500), "mid-market" (500-5000), "enterprise" (5000+)
3. company_revenue_range: Approximate annual revenue bracket if findable
4. company_hq: Headquarters city/country
5. target_name: Name of their CISO, VP Security, Head of Security, or Director of InfoSec
6. target_title: Their exact title
7. target_linkedin: LinkedIn profile URL if findable
8. target_email: Work email ONLY if publicly listed (e.g. on company security page, press releases)
9. security_maturity: "high" if they have SOC2/ISO27001/bug bounty, "medium" if they have a security page, "low" if no visible security program
10. compliance_frameworks: Array of frameworks they likely comply with based on industry
11. recent_security_news: Any breaches, incidents, or security announcements in the last 12 months (one sentence summary or null)
12. hiring_security: true if they have open security job postings

IMPORTANT RULES:
- Only include information you can verify from search results
- If you cannot find a field, return null — do NOT fabricate
- For target identification, prioritize: CISO > VP Security > Head of InfoSec > Director of Security
- Do not include personal contact info that isn't publicly available
- Return ONLY valid JSON, no markdown, no explanation
```

**Important:** Use the Anthropic API with web search tool enabled — check how the existing agents make Haiku calls and whether web search is available. The research stage MUST have web search to be useful. If the current agent pattern doesn't support web search in Haiku calls, implement it using the `tools` parameter with `web_search_20250305`.

**Rate limiting:** Process max 5 prospects per agent run to avoid hammering the Haiku API. The weekly cron will process 5 new prospects each run — if there are 20 qualified, it takes 4 weeks to research them all. This is fine for a weekly cadence.

**Caching:** Store research results in `sales_leads.research_json`. If a lead already has `researched_at` within the last 90 days, skip re-research.

### Stage 3: Outreach Generation

Function: `generateOutreach(lead: SalesLead, research: ProspectResearch, env: Env): Promise<OutreachDrafts>`

For each researched prospect, generate two outreach email variants.

```typescript
interface OutreachDrafts {
  variant_1: string;  // "Intelligence briefing" angle
  variant_2: string;  // "Peer benchmark" angle
}
```

**Haiku outreach prompt:**

```
You are drafting outreach emails from Trust Radar to a security leader.

RECIPIENT:
Name: {target_name}
Title: {target_title}
Company: {company_name}
Industry: {company_industry}
Size: {company_size}

TRUST RADAR FINDINGS (share at HIGH LEVEL only — do not reveal specific URLs, IPs, or detailed IOCs):
{findings_summary}

Email security grade: {email_security_grade}
Active phishing URLs detected: {phishing_urls_active}
Spam trap catches (brand impersonation): {trap_catches_30d}
Overall risk score: {composite_risk_score}/100

CONTEXT:
{recent_security_news_if_any}
{compliance_frameworks_if_any}

Generate TWO email variants as JSON:

{
  "variant_1_subject": "...",
  "variant_1_body": "...",
  "variant_2_subject": "...",
  "variant_2_body": "..."
}

VARIANT 1 — "Intelligence briefing" angle:
- Lead with a specific finding that would concern a CISO
- Frame as sharing intelligence, not selling
- Offer a 15-minute threat briefing
- Under 150 words body

VARIANT 2 — "Peer benchmark" angle:
- Compare their security posture to industry peers
- Reference specific gaps (email security grade, DMARC)
- Offer a free assessment report
- Under 150 words body

RULES FOR BOTH:
- Professional, direct tone — CISOs have zero patience for fluff
- No buzzwords: no "revolutionary", "cutting-edge", "game-changing", "leverage"
- No exclamation marks
- Reference exactly ONE specific finding to hook interest
- Do NOT reveal exact phishing URLs, IP addresses, or detailed IOCs
- Include a clear call to action (15-min call or briefing)
- Sign off as "Trust Radar Threat Intelligence Team"
- Return ONLY valid JSON, no markdown
```

---

## Part 3: Cron Integration

### Weekly Prospector Run

Add the Prospector to the existing cron in `src/index.ts`. Use a KV throttle key `prospector:last_run` — only run once per 7 days.

**Pipeline sequence per run:**

```typescript
async function runProspectorAgent(env: Env): Promise<void> {
  // Check throttle
  const lastRun = await env.CACHE.get('prospector:last_run');
  if (lastRun && Date.now() - parseInt(lastRun) < 7 * 24 * 60 * 60 * 1000) return;
  
  // Stage 1: Identify top prospects
  const candidates = await identifyProspects(env.DB);
  
  // Stage 2 & 3: Research and generate outreach for top 5
  // (Process 5 per run to manage API costs)
  const toProcess = candidates
    .filter(c => !existingLeadRecent(c.brand_id))  // Skip already-processed
    .slice(0, 5);
  
  for (const candidate of toProcess) {
    // Insert lead row (status: 'new')
    const leadId = await insertLead(env.DB, candidate);
    await logActivity(env.DB, leadId, 'identified', candidate.score_breakdown);
    
    // Research
    const research = await researchProspect(candidate, env);
    await updateLeadResearch(env.DB, leadId, research);
    await logActivity(env.DB, leadId, 'researched', { confidence: research.research_confidence });
    
    // Generate outreach (only if research found a target)
    if (research.target_name) {
      const outreach = await generateOutreach(
        await getLeadById(env.DB, leadId),
        research,
        env
      );
      await updateLeadOutreach(env.DB, leadId, outreach);
      await logActivity(env.DB, leadId, 'outreach_generated', { variants: 2 });
      
      // Update status
      await updateLeadStatus(env.DB, leadId, 'outreach_drafted');
    } else {
      // No target found — mark as researched only
      await updateLeadStatus(env.DB, leadId, 'researched');
    }
  }
  
  // Update throttle
  await env.CACHE.put('prospector:last_run', Date.now().toString());
}
```

### Prospector Agent Card

Add the Prospector to the Agents dashboard (same pattern as the existing agent cards). It should show:
- Name: "Prospector"
- Subtitle: "Sales Intelligence & Lead Generation"
- Job count, output count, error count
- Last output timestamp
- Activity progress bar

Check how the existing agents register their stats and output counts, and follow the same pattern.

---

## Part 4: Admin API Endpoints

### Leads management

```
GET    /api/admin/leads                       — List all leads (paginated, filterable by status/score)
GET    /api/admin/leads/:id                   — Lead detail (full profile + research + outreach)
PATCH  /api/admin/leads/:id                   — Update lead (edit outreach, change status, add notes)
POST   /api/admin/leads/:id/approve           — Approve outreach (sets status to 'approved')
POST   /api/admin/leads/:id/send              — Mark as sent (sets status to 'sent', records sent_at)
POST   /api/admin/leads/:id/respond           — Log response (sets response_sentiment, response timestamp)
POST   /api/admin/leads/:id/book              — Log meeting booked
POST   /api/admin/leads/:id/convert           — Mark as converted
POST   /api/admin/leads/:id/decline           — Mark as declined (prevents re-prospecting)
DELETE /api/admin/leads/:id                   — Discard lead
GET    /api/admin/leads/:id/activity          — Activity log for a lead
GET    /api/admin/leads/stats                 — Pipeline stats (count by status, weekly identified/sent/replied)
```

All endpoints require superadmin auth (same as existing admin endpoints).

### Leads dashboard page

Add a LEADS page in the admin UI. Check if there's already a LEADS sub-tab in the admin section — if so, extend it. If it's a placeholder, replace it.

The page should show:
1. **Pipeline summary bar** at the top: count per status (New, Researched, Drafted, Sent, Replied, Meeting, Converted)
2. **Lead cards** — each card shows: company name, domain, prospect score, pitch angle, target name/title, status, key findings (email grade, threat count, trap catches), and action buttons based on status
3. **Filters:** status, score range, pitch angle, date range
4. **Sort:** by score (default), by date, by status

**Lead detail view** (click a card to expand or navigate):
- Full prospect profile
- Score breakdown with weights
- Research summary (company intel, security leader, maturity)
- Platform findings (email security, threats, trap catches)
- Both outreach variants — editable text fields
- Activity timeline
- Notes field
- Action buttons: Approve, Send, Log Response, Book Meeting, Convert, Decline, Discard

Style it consistent with the existing admin pages — dark theme, same card patterns, same button styles.

---

## Part 5: Prospector in Agent Stats

Update the `handleAdminStats()` function (or wherever agent data is aggregated for the dashboard) to include Prospector stats:
- Total leads identified (all time)
- Leads identified this week
- Leads with outreach drafted
- Leads sent
- Response rate (responded / sent)
- Conversion rate (converted / sent)

Also update the Agents page to show the Prospector card alongside the existing agents.

---

## Implementation Notes

- Follow existing agent code patterns exactly — same Haiku API call structure, same error handling, same output logging
- The Prospector's web search in Stage 2 uses the Anthropic API's `tools` parameter with `web_search_20250305` tool type — check if the existing agents already use this or if it needs to be added
- All Haiku prompts should request JSON output — parse responses with try/catch and fallback gracefully if JSON is malformed
- Each stage should log its outputs (for the agent activity bar on the dashboard)
- KV keys used: `prospector:last_run` (throttle), potentially `prospector:candidates_cache` if you want to cache Stage 1 results
- Rate limit: max 5 prospects processed per run, max 20 identified per run
- The Prospector NEVER sends emails — it only drafts. Sending is a manual human action via the admin UI

## Output

Show me:
1. The migration SQL file
2. The full `src/prospector-agent.ts` module
3. Changes to `src/index.ts` for cron integration
4. The admin API endpoint code for leads management
5. The admin UI code for the Leads page
6. Changes to agent stats/dashboard for Prospector card
7. Do NOT deploy — I will review first

---
