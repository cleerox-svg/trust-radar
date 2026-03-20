# Claude Code Prompt — Threat Intelligence Integration: Phase 1 & Phase 3

Paste this into Claude Code:

---

I'm adding external threat intelligence feeds and a brand threat correlation engine to Trust Radar. This covers two phases: Phase 1 integrates free external feeds into the pipeline cron, and Phase 3 builds a differentiation layer that combines our unique spam trap + DMARC + email security data with external signals to produce comprehensive brand threat reports.

## Context

The Trust Radar monorepo is at `packages/trust-radar/`. The Worker is in `src/index.ts` with a cron trigger running every 5 minutes. The existing pipeline already has steps for Geo Enrichment, Brand Matching, Email Security, AI Attribution, and Tranco. D1 is bound as `DB`, KV as `CACHE`. The Analyst and Observer agents already exist and run on Haiku.

Existing tables include: `threats`, `brands`, `email_security_scans`, `spam_trap_captures`, `seed_addresses`, `phishing_pattern_signals`, `spam_trap_daily_stats`. Read the existing migrations in `packages/trust-radar/migrations/` to confirm exact schemas before writing any SQL.

## PHASE 1: Free External Threat Intelligence Feeds

### 1A. New Module: `src/threat-feeds.ts`

Create a threat feed ingestion module with adapters for each free source. Each adapter follows the same pattern: fetch data, normalize to a common format, store/update in D1, and flag matches against monitored brands.

**Common normalized format:**

```typescript
interface ThreatSignal {
  source: string;           // 'hibp' | 'phishtank' | 'urlhaus' | 'abuseipdb' | 'emailrep'
  signal_type: string;      // 'credential_breach' | 'phishing_url' | 'malware_url' | 'ip_reputation' | 'email_reputation'
  indicator: string;        // The IOC: domain, URL, IP, email
  indicator_type: string;   // 'domain' | 'url' | 'ip' | 'email'
  severity: string;         // 'critical' | 'high' | 'medium' | 'low'
  details_json: string;     // Source-specific metadata as JSON string
  brand_match_id?: string;  // If this signal matches a monitored brand
  first_seen_at: string;    // When the source first reported it
  fetched_at: string;       // When we fetched it
}
```

**Feed adapters to build:**

#### 1. Have I Been Pwned — Pwned Passwords API (free, no key needed)

- Endpoint: `https://api.pwnedpasswords.com/range/{first5hashchars}` (k-anonymity model)
- This is NOT for the pipeline cron — it's an on-demand enrichment function
- Function: `checkPasswordExposure(password: string): Promise<number>` — returns the count of times the password has been seen in breaches
- Function: `checkEmailBreaches(email: string, apiKey?: string): Promise<BreachInfo[]>` — if we have an API key, check breaches for an email. Without a key, this is rate-limited to 1 req/second
- For now, implement the Pwned Passwords function only (free, no key). Leave the email/domain breach search as a stub that requires `HIBP_API_KEY` secret — we'll add the paid tier later
- Store breached password count as enrichment data, not as a standalone signal

#### 2. PhishTank via CIRCL Public API (free, no key needed)

PhishTank stopped accepting new API key registrations. Use the CIRCL public mirror instead — it ingests the hourly PhishTank dump and exposes it as a free REST API. Reference repo: https://github.com/Lookyloo/phishtank-lookup

- Base URL: `https://phishtankapi.circl.lu`
- Endpoints:
  - `GET /api/v1/urls/` — list all current phishing URLs (bulk, use sparingly)
  - `GET /api/v1/url/{url}` — check a specific URL
  - `GET /api/v1/urls_by_ip/{ip}` — phishing URLs hosted on a given IP
  - `GET /api/v1/urls_by_asn/{asn}` — phishing URLs by ASN
  - `GET /api/v1/urls_by_cc/{cc}` — phishing URLs by country code
  - `GET /api/v1/info` — instance metadata (last update time, entry count)
- No API key needed — completely free public instance
- Cron task: Fetch `/api/v1/info` first to check last update time. If dump has been refreshed since our last fetch, pull `/api/v1/urls/` and process. Throttle to once per hour max using KV timestamp key `feed:phishtank:last_fetch`
- For each entry: extract the URL domain, match against monitored brands in the `brands` table. Also match the `target` field if present (the brand being phished)
- On match: create a ThreatSignal with `signal_type: 'phishing_url'`, severity `high` for verified entries
- Also implement on-demand functions:
  - `checkPhishtankUrl(url: string): Promise<PhishtankEntry | null>` — check if a specific URL is in PhishTank
  - `checkPhishtankIp(ip: string): Promise<PhishtankEntry[]>` — check if an IP is hosting phishing pages (useful for enriching spam trap sender IPs)
- Cache bulk results in KV: `feed:phishtank:entries` with 1-hour TTL
- Be respectful of the public instance — do NOT hammer it. One bulk fetch per hour is plenty

#### 3. URLhaus (free, no key needed for read)

- Endpoint: `https://urlhaus-api.abuse.ch/v1/urls/recent/` (JSON, recent URLs)
- Also: `https://urlhaus-api.abuse.ch/v1/host/` for querying by domain/host
- Cron task: Fetch recent malware URLs every 30 minutes (use KV timestamp to throttle)
- For each URL: extract the host domain, check against monitored brands
- On match: create ThreatSignal with `signal_type: 'malware_url'`
- Also implement an on-demand function: `checkUrlhaus(domain: string): Promise<UrlhausResult[]>` for the scan pipeline to call when assessing a domain
- KV cache key: `feed:urlhaus:last_fetch` for throttling

#### 4. AbuseIPDB (free tier: 1000 checks/day)

- Endpoint: `https://api.abuseipdb.com/api/v2/check?ipAddress={ip}`
- Requires API key — store as `ABUSEIPDB_API_KEY` secret
- This is an on-demand enrichment, NOT a bulk feed — call it when processing spam trap catches or scanning threats
- Function: `checkIpReputation(ip: string): Promise<AbuseIPDBResult>` returning confidence score, abuse reports count, ISP, country
- Cache results in KV with 24-hour TTL: `abuseipdb:{ip}`
- Rate limit: track daily usage in KV key `abuseipdb:daily_count` with midnight TTL reset
- If no API key configured, skip silently

#### 5. EmailRep.io (free tier: 200 lookups/day)

- Endpoint: `https://emailrep.io/{email}`
- No API key needed for basic lookups (limited rate)
- Function: `checkEmailReputation(email: string): Promise<EmailRepResult>` returning reputation, suspicious flag, breach count, malicious activity flag
- Call this when processing spam trap catch senders — if a sender has bad EmailRep, boost the threat score
- Cache in KV with 12-hour TTL: `emailrep:{email_hash}`
- Rate limit tracking: `emailrep:daily_count`

### 1B. New D1 Table: `threat_signals`

Create a migration for storing normalized external signals:

```sql
CREATE TABLE IF NOT EXISTS threat_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  indicator TEXT NOT NULL,
  indicator_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  details_json TEXT,
  brand_match_id INTEGER,
  threat_match_id INTEGER,
  first_seen_at TEXT,
  fetched_at TEXT DEFAULT (datetime('now')),
  is_processed INTEGER DEFAULT 0,
  processed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (brand_match_id) REFERENCES brands(id),
  FOREIGN KEY (threat_match_id) REFERENCES threats(id)
);

CREATE INDEX idx_signals_source ON threat_signals(source);
CREATE INDEX idx_signals_indicator ON threat_signals(indicator);
CREATE INDEX idx_signals_brand ON threat_signals(brand_match_id);
CREATE INDEX idx_signals_type ON threat_signals(signal_type);
CREATE INDEX idx_signals_severity ON threat_signals(severity);
CREATE INDEX idx_signals_processed ON threat_signals(is_processed);
```

### 1C. Pipeline Integration

Add a new pipeline step to the existing cron in `src/index.ts`. This step runs AFTER the existing steps (Geo, Brand Matching, Email Security, AI Attribution, Tranco):

**Step: Threat Feed Sync (runs every 30 minutes, not every 5-minute cron)**

Use a KV timestamp key `pipeline:feed_sync:last_run` to throttle — only run if 30+ minutes have passed since last run.

1. Fetch PhishTank data via CIRCL API (if 1+ hour since last fetch — check `/api/v1/info` first)
2. Fetch URLhaus recent URLs (if 30+ minutes since last fetch)
3. For each fetched item, check against all monitored brand domains in the `brands` table
4. On match: insert into `threat_signals`, link to brand
5. For any NEW critical/high signals with brand matches, queue for Analyst agent processing

**Enrichment integration (on-demand, not cron):**

When the scan pipeline processes a new domain/URL:
- Call `checkUrlhaus(domain)` to see if the domain is distributing malware
- Add result to the scan response and threat record

When the spam trap handler processes a new catch:
- Call `checkIpReputation(senderIP)` via AbuseIPDB (if key configured)
- Call `checkPhishtankIp(senderIP)` via CIRCL API to see if the sender IP hosts phishing pages
- Call `checkEmailReputation(senderEmail)` via EmailRep
- Store enrichment results in `spam_trap_captures` as additional metadata or in a linked `threat_signals` row

### 1D. Admin Stats Update

Update the `handleAdminStats()` function (or wherever pipeline status is computed for the Agents dashboard) to include threat feed stats:
- Total signals collected (count of `threat_signals`)
- Signals with brand matches
- Signals by source
- Last sync timestamp per feed

---

## PHASE 3: Brand Threat Correlation Engine

This is the differentiation layer — combining our unique first-party data (spam trap catches, DMARC reports, email security scans) with external signals to produce comprehensive brand threat assessments that no single external feed can provide.

### 3A. New Module: `src/brand-threat-correlator.ts`

Create a correlation engine that aggregates all threat signals for a monitored brand into a unified risk assessment.

**Function: `correlateBrandThreats(brandId: number): Promise<BrandThreatAssessment>`**

This function queries across ALL data sources for a given brand and produces a composite assessment:

```typescript
interface BrandThreatAssessment {
  brand_id: number;
  brand_name: string;
  brand_domain: string;
  
  // Overall risk
  composite_risk_score: number;      // 0-100
  risk_level: string;                // 'critical' | 'high' | 'medium' | 'low' | 'minimal'
  risk_factors: string[];            // Human-readable list of why
  
  // Email security posture (from email_security_scans)
  email_security_grade: string;      // A-F
  has_dmarc: boolean;
  has_spf: boolean;
  has_dkim: boolean;
  dmarc_policy: string;             // none | quarantine | reject
  
  // Spam trap signals (from spam_trap_captures)
  trap_catches_30d: number;          // Catches impersonating this brand in last 30 days
  trap_phishing_catches_30d: number;
  trap_unique_senders_30d: number;
  trap_unique_ips_30d: number;
  latest_trap_catch: string | null;
  
  // Phishing pattern signals (from phishing_pattern_signals)
  ai_generated_phishing_detected: boolean;
  ai_phishing_count_30d: number;
  common_impersonation_techniques: string[];
  
  // External signals (from threat_signals)
  phishtank_active_urls: number;     // Active PhishTank URLs targeting this brand
  urlhaus_malware_urls: number;      // URLhaus URLs on brand's infrastructure
  credential_breaches: number;       // Known breaches involving brand's domain
  
  // DMARC report signals (from dmarc_reports when available)
  dmarc_failures_30d: number;
  unauthorized_senders_30d: number;
  
  // Composite narratives for the Analyst agent
  threat_summary: string;            // AI-generated summary
  recommended_actions: string[];
  
  assessed_at: string;
}
```

**Correlation logic:**

1. Query `email_security_scans` for the brand's latest scan
2. Query `spam_trap_captures` for catches where `brand_matched` = this brand (last 30 days)
3. Query `phishing_pattern_signals` joined to captures for AI detection markers
4. Query `threat_signals` for external signals matched to this brand
5. Query DMARC report tables (if data exists) for authentication failures
6. Compute composite risk score using weighted factors:
   - Email security grade F or D = +30 points
   - Email security grade C = +15 points
   - DMARC policy 'none' or missing = +20 points
   - Active phishing URLs (PhishTank) = +15 per URL, capped at +30
   - Spam trap catches in last 30 days: 1-5 = +10, 6-20 = +20, 20+ = +30
   - AI-generated phishing detected = +15
   - Credential breaches in last 90 days = +10 per breach, capped at +20
   - Malware URLs on brand infrastructure (URLhaus) = +20
7. Generate `risk_factors` array listing the contributing signals in plain English
8. Risk levels: 0-20 = minimal, 21-40 = low, 41-60 = medium, 61-80 = high, 81-100 = critical

### 3B. New D1 Table: `brand_threat_assessments`

Store assessment snapshots for trend tracking:

```sql
CREATE TABLE IF NOT EXISTS brand_threat_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  composite_risk_score REAL NOT NULL,
  risk_level TEXT NOT NULL,
  risk_factors_json TEXT,
  email_security_grade TEXT,
  trap_catches_30d INTEGER DEFAULT 0,
  trap_phishing_catches_30d INTEGER DEFAULT 0,
  ai_phishing_detected INTEGER DEFAULT 0,
  phishtank_active_urls INTEGER DEFAULT 0,
  urlhaus_malware_urls INTEGER DEFAULT 0,
  credential_breaches INTEGER DEFAULT 0,
  dmarc_failures_30d INTEGER DEFAULT 0,
  threat_summary TEXT,
  recommended_actions_json TEXT,
  assessed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

CREATE INDEX idx_assessments_brand ON brand_threat_assessments(brand_id);
CREATE INDEX idx_assessments_risk ON brand_threat_assessments(risk_level);
CREATE INDEX idx_assessments_date ON brand_threat_assessments(assessed_at);
CREATE INDEX idx_assessments_score ON brand_threat_assessments(composite_risk_score);
```

### 3C. Analyst Agent Integration

Update the Analyst agent's system prompt and input data to include the brand threat assessment. When the Analyst processes threats:

1. After standard threat analysis, call `correlateBrandThreats(brandId)` for the affected brand
2. Include the assessment in the Analyst's context so it can make informed escalation decisions
3. Escalation rules (add to Analyst logic):
   - If `email_security_grade` is F/D AND `trap_catches_30d` > 0 → escalate to CRITICAL
   - If `ai_generated_phishing_detected` is true → flag as "AI-Generated Threat Detected"
   - If `phishtank_active_urls` > 0 AND `dmarc_policy` is 'none' → escalate: "Brand is actively being phished with no DMARC protection"
   - If composite risk score jumps 20+ points from last assessment → trigger alert: "Risk score spike detected"

### 3D. Observer Agent Integration

Update the Observer agent's daily briefing to include:

1. **Threat feed summary:** New signals collected in last 24h by source, brand matches found
2. **High-risk brands:** Any brand with composite_risk_score > 60 or risk level change
3. **Spam trap stats:** New catches, phishing attempts, top sender domains, channel performance
4. **Email security alerts:** Brands with F-grade posture + active threats
5. **AI phishing detection:** Count of AI-generated phishing attempts detected, patterns identified
6. **Correlation highlights:** The most interesting signal combinations (e.g. "Brand X appeared in PhishTank today AND we caught phishing emails impersonating them in our traps AND their DMARC is set to 'none'")

### 3E. Assessment Cron

Add a daily cron task (or extend the existing cron with a daily gate) that:

1. Runs `correlateBrandThreats()` for all monitored brands (or at minimum, brands with any recent activity)
2. Stores snapshots in `brand_threat_assessments`
3. Compares to previous assessment — flags significant score changes
4. Queues high-risk brands for Analyst review
5. Feeds summary data to Observer for daily briefing

Use KV throttle key `pipeline:assessments:last_run` — only run once per 24 hours.

### 3F. API Endpoint

Add an endpoint for retrieving brand threat assessments:

```
GET /api/brand/:brandId/threat-assessment
Authorization: Bearer {token}
```

Returns the latest `BrandThreatAssessment` for the brand. If the latest assessment is older than 24 hours, trigger a fresh assessment before returning.

Also add:

```
GET /api/brand/:brandId/threat-assessment/history
Authorization: Bearer {token}
```

Returns the last 30 assessments for trend visualization.

---

## Implementation Notes

- All new files go in `packages/trust-radar/src/`
- Follow existing code patterns for D1 queries, KV caching, Haiku agent calls
- All migrations go in `packages/trust-radar/migrations/` as the next numbers in sequence
- External API calls must have timeout handling (5 second timeout) and graceful failure — if a feed is down, skip it and log, don't block the pipeline
- All feed fetches must respect rate limits — use KV counters for daily-limited APIs
- Check existing secrets in wrangler.toml for the API key pattern used — new secrets needed: `ABUSEIPDB_API_KEY` (optional — if not configured, AbuseIPDB enrichment is skipped silently). PhishTank via CIRCL and URLhaus need no API keys.
- The brand matching logic for external feeds should reuse the same brand matching functions already used elsewhere in the codebase — find them and reuse, don't duplicate

## Output

Show me:
1. The new `src/threat-feeds.ts` module (full file)
2. The new `src/brand-threat-correlator.ts` module (full file)
3. Changes to `src/index.ts` for pipeline integration and new cron steps
4. Changes to Analyst and Observer agent prompts/inputs (show the diffs)
5. The migration SQL file(s)
6. The new API endpoint code
7. Any KV key patterns used (for documentation)
8. Do NOT deploy — I will review first

---
