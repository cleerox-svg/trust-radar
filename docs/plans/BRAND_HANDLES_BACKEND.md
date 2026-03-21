# TRUST RADAR — BRAND HANDLE MANAGEMENT & BACKEND ASSESSMENT

## Claude Code Companion Document
**Version:** 1.1 (Revised)
**Date:** March 20, 2026
**Parent Company:** LRX Enterprises Inc. (Canadian-incorporated)

> **IMPORTANT:** imprsn8 is a fully independent product. Social brand monitoring for Trust Radar
> is built from scratch as new code. Do NOT copy, adapt, or reference imprsn8 source files.
> See Section 4 of the Unified Platform Plan for details.

---

## PART 1: BRAND HANDLE MANAGEMENT — INTEGRATION DEEP DIVE

### 1.1 The Core Concept

Brand Handle Management is the system that bridges "a company added their brand to Trust Radar" with "we're now actively monitoring their identity across the internet." It's the central registry that every other system queries: the email security engine checks the brand's domain, the social monitor checks the brand's handles, the threat feed scanner filters for the brand's keywords, and the AI agents reference the brand profile when generating assessments.

### 1.2 How It Integrates — Full Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    BRAND PROFILE (Central Registry)               │
│                                                                   │
│  brand_id: "bp_abc123"                                           │
│  domain: "acmecorp.com"                                          │
│  brand_name: "Acme Corp"                                         │
│  aliases: ["ACME", "Acme Corporation", "AcmeCorp"]               │
│  official_handles: {                                              │
│    twitter: "@acmecorp",                                         │
│    linkedin: "company/acmecorp",                                 │
│    instagram: "@acmecorp",                                       │
│    github: "acmecorp",                                           │
│    tiktok: null,        ← not claimed, monitor for squatting     │
│    youtube: null         ← not claimed, monitor for squatting    │
│  }                                                               │
│  keywords: ["acme", "acmecorp", "acme corp", "acme-corp"]        │
│  executive_names: ["Jane Smith (CEO)", "Bob Lee (CTO)"]          │
│  logo_hash: "sha256:abc..."  ← for future visual matching        │
│                                                                   │
└──────┬───────────┬────────────┬────────────┬─────────────────────┘
       │           │            │            │
       ▼           ▼            ▼            ▼
┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Email   │ │ Social   │ │ Threat   │ │ Lookalike    │
│ Security│ │ Monitor  │ │ Feed     │ │ Domain       │
│ Engine  │ │ Pipeline │ │ Scanner  │ │ Generator    │
│         │ │          │ │          │ │              │
│ Checks: │ │ Checks:  │ │ Checks:  │ │ Generates:   │
│ domain  │ │ handles  │ │ keywords │ │ permutations │
│ SPF     │ │ aliases  │ │ domain   │ │ of domain    │
│ DKIM    │ │ keywords │ │ in feeds │ │ and monitors │
│ DMARC   │ │ execs    │ │          │ │ registration │
│ MX      │ │ per plat │ │          │ │              │
└────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘
     │           │            │               │
     └───────────┴────────────┴───────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    Analyst Agent     │
              │                     │
              │ Receives ALL signals│
              │ from all systems    │
              │ for this brand_id   │
              │                     │
              │ Correlates:         │
              │ - email posture     │
              │ - social threats    │
              │ - feed matches      │
              │ - lookalike status  │
              │                     │
              │ Generates:          │
              │ - Brand Exposure    │
              │   Score             │
              │ - Threat Narratives │
              │ - Recommendations   │
              └─────────────────────┘
```

### 1.3 Brand Profile — Full Schema

```sql
-- D1 Migration: 0018_brand_profiles.sql

CREATE TABLE brand_profiles (
  id TEXT PRIMARY KEY DEFAULT ('bp_' || lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL REFERENCES users(id),

  -- Core identity
  domain TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  aliases TEXT DEFAULT '[]',           -- JSON array: ["ACME", "Acme Corp"]

  -- Social handles (JSON object — null means "not claimed, monitor for squatting")
  official_handles TEXT DEFAULT '{}',
  -- Example: {
  --   "twitter": "@acmecorp",
  --   "instagram": "@acmecorp",
  --   "linkedin": "company/acmecorp",
  --   "tiktok": null,
  --   "youtube": null,
  --   "github": "acmecorp",
  --   "facebook": "AcmeCorp"
  -- }

  -- Brand keywords for threat feed matching and social search
  brand_keywords TEXT DEFAULT '[]',    -- JSON array: auto-generated + user-added
  -- Auto-generated from domain and brand_name:
  --   domain without TLD: "acmecorp"
  --   brand name variations: "acme corp", "acme-corp"
  --   domain itself: "acmecorp.com"
  -- User can add custom keywords like product names

  -- Executive monitoring (optional, for Protect+ tiers)
  executive_names TEXT DEFAULT '[]',   -- JSON array: ["Jane Smith", "Bob Lee"]

  -- Visual identity (future: logo matching)
  logo_url TEXT,
  logo_hash TEXT,                      -- perceptual hash for visual similarity matching

  -- Subscription tier determines monitoring depth
  monitoring_tier TEXT DEFAULT 'scan', -- scan | professional | business | enterprise

  -- Operational state
  status TEXT DEFAULT 'active',        -- active | paused | archived
  last_full_scan TEXT,                 -- timestamp of last complete assessment
  next_scheduled_scan TEXT,            -- when the next cron run should assess this brand

  -- Scoring
  exposure_score REAL,                 -- composite 0-100 Brand Exposure Score
  email_grade TEXT,                    -- A+ through F
  social_risk_score REAL,             -- 0-100 social impersonation risk
  domain_risk_score REAL,             -- 0-100 lookalike domain risk
  threat_feed_score REAL,             -- 0-100 threat feed activity

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for cron lookups
CREATE INDEX idx_brand_profiles_next_scan
  ON brand_profiles(next_scheduled_scan)
  WHERE status = 'active';

-- Index for user lookups
CREATE INDEX idx_brand_profiles_user
  ON brand_profiles(user_id);

-- Unique constraint: one brand per domain per user
CREATE UNIQUE INDEX idx_brand_profiles_user_domain
  ON brand_profiles(user_id, domain);
```

### 1.4 Brand Onboarding Flow — What Happens When a User Adds a Brand

```
User hits POST /api/brands with:
{
  "domain": "acmecorp.com",
  "brand_name": "Acme Corp",
  "official_handles": {
    "twitter": "@acmecorp",
    "linkedin": "company/acmecorp"
  }
}

┌─────────────────────────────────────────────────────────┐
│ STEP 1: Validate & Create Brand Profile                  │
│                                                          │
│ - Validate domain format                                 │
│ - Check user hasn't exceeded brand limit for their tier  │
│ - Auto-generate keywords from domain + brand_name        │
│ - Create brand_profiles row                              │
│ - Return brand_id to user                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 2: Initial Scan (synchronous, returns with create) │
│                                                          │
│ Run in parallel (Promise.all):                           │
│   a) Email Security Scan → grade + details               │
│   b) Social Handle Check → per-platform status           │
│   c) Threat Feed Check → any existing matches            │
│   d) Lookalike Domain Gen → top 20 permutations checked  │
│                                                          │
│ Takes ~3-8 seconds depending on DNS/API latency          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 3: AI Assessment (async, runs after initial scan)   │
│                                                          │
│ Analyst Agent receives:                                   │
│   - All scan results from Step 2                         │
│   - Brand profile context                                │
│   - Historical data (if domain was previously scanned)   │
│                                                          │
│ Generates:                                               │
│   - Brand Exposure Score (composite)                     │
│   - Written assessment                                   │
│   - Priority recommendations                             │
│                                                          │
│ Updates brand_profiles row with scores                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ STEP 4: Schedule Monitoring (for paid tiers)             │
│                                                          │
│ Create social_monitor_schedule rows:                      │
│   - One row per platform                                  │
│   - check_interval based on tier:                         │
│     Professional: 24 hours                                │
│     Business: 6 hours                                     │
│     Enterprise: 1 hour                                    │
│                                                          │
│ Brand is now in the cron rotation                         │
└─────────────────────────────────────────────────────────┘
```

### 1.5 Handle Management — CRUD Operations

```typescript
// POST /api/brands/:id/handles
// Add or update handles for a brand
// Body: { platform: "tiktok", handle: "@acmecorp" }
//
// This does TWO things:
// 1. Updates the official_handles JSON in brand_profiles
// 2. Triggers an immediate social check for that platform
//    (verifies the handle exists and is likely owned by the brand)

// DELETE /api/brands/:id/handles/:platform
// Marks a handle as "not ours" — tells the monitor to treat
// any account using this handle on this platform as potential
// impersonation rather than official

// GET /api/brands/:id/handles
// Returns current handle status per platform:
// {
//   "twitter": {
//     "handle": "@acmecorp",
//     "status": "verified_official",  // we confirmed it exists and looks legit
//     "last_checked": "2026-03-20T...",
//     "followers": 12400,
//     "verified_badge": true
//   },
//   "instagram": {
//     "handle": null,                 // not claimed
//     "status": "unclaimed",
//     "squatting_risk": "high",       // someone else has @acmecorp
//     "squatter_account": "https://instagram.com/acmecorp",
//     "squatter_signals": {
//       "name_match": true,
//       "uses_brand_keywords": false,
//       "low_follower_count": true,
//       "account_age_days": 30
//     }
//   },
//   "tiktok": {
//     "handle": "@acme_corp",
//     "status": "suspicious",         // handle exists but signals don't match
//     "impersonation_score": 0.72,
//     "alert_id": "sma_xyz789"
//   }
// }
```

### 1.6 How Social Monitor Uses Brand Handles

The social monitoring cron runs on a schedule and uses brand profiles as its input:

```typescript
// Pseudocode for social monitoring cron

async function socialMonitorCron(env: Env) {
  // 1. Get all brands due for social check
  const brands = await env.DB.prepare(`
    SELECT bp.*, sms.platform, sms.last_checked
    FROM brand_profiles bp
    JOIN social_monitor_schedule sms ON sms.brand_id = bp.id
    WHERE bp.status = 'active'
      AND sms.enabled = 1
      AND (sms.next_check IS NULL OR sms.next_check <= datetime('now'))
    ORDER BY sms.next_check ASC
    LIMIT 50  -- process in batches
  `).all();

  for (const brand of brands) {
    const handles = JSON.parse(brand.official_handles);
    const keywords = JSON.parse(brand.brand_keywords);
    const platform = brand.platform;

    // 2. For each platform, run checks
    const results = await checkPlatform(platform, {
      officialHandle: handles[platform],  // may be null (unclaimed)
      brandName: brand.brand_name,
      keywords: keywords,
      aliases: JSON.parse(brand.aliases),
    });

    // 3. For each finding, assess with AI
    for (const finding of results.findings) {
      if (finding.impersonation_score > 0.5) {
        // Run through Analyst agent for confirmation
        const assessment = await analystAgent.assessSocialFinding({
          brand: brand,
          finding: finding,
          existingThreats: await getExistingThreats(brand.id),
        });

        // 4. Store result
        await env.DB.prepare(`
          INSERT INTO social_monitor_results (
            id, brand_id, platform, check_type,
            suspicious_account_url, suspicious_account_name,
            impersonation_score, impersonation_signals,
            ai_assessment, severity, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
        `).bind(
          generateId('smr'),
          brand.id,
          platform,
          'impersonation_scan',
          finding.account_url,
          finding.account_name,
          assessment.confidence_score,
          JSON.stringify(assessment.signals),
          assessment.narrative,
          assessment.severity,
        ).run();

        // 5. Alert if high severity
        if (['HIGH', 'CRITICAL'].includes(assessment.severity)) {
          await sendAlert(brand.user_id, {
            type: 'social_impersonation',
            brand_id: brand.id,
            platform: platform,
            severity: assessment.severity,
            summary: assessment.narrative,
          });
        }
      }
    }

    // 6. Update schedule
    const interval = getIntervalForTier(brand.monitoring_tier);
    await env.DB.prepare(`
      UPDATE social_monitor_schedule
      SET last_checked = datetime('now'),
          next_check = datetime('now', '+${interval} hours')
      WHERE brand_id = ? AND platform = ?
    `).bind(brand.id, platform).run();
  }
}
```

### 1.7 Platform-Specific Check Implementations

Each platform requires different techniques since public APIs vary:

```typescript
interface PlatformChecker {
  checkHandleExists(handle: string): Promise<HandleCheckResult>;
  searchForBrand(keywords: string[]): Promise<BrandSearchResult[]>;
  getAccountMetadata(handle: string): Promise<AccountMetadata | null>;
}

// TWITTER/X
// - Check handle via nitter.net or public profile page (no API key needed)
// - Search for brand keywords in display names
// - Check verified status

// LINKEDIN
// - Check company page: linkedin.com/company/{slug}
// - Harder to enumerate — focus on exact match checking
// - Check if company page claims the monitored domain

// INSTAGRAM
// - Check profile: instagram.com/{handle}/ returns 200 vs 404
// - Profile page metadata extraction (name, bio, follower count)
// - No search without API — focus on handle checking + permutations

// TIKTOK
// - Check profile: tiktok.com/@{handle}
// - Bio and display name extraction from public page
// - Similar handle permutation checking

// GITHUB
// - Full API available without auth (rate limited)
// - Check user: api.github.com/users/{handle}
// - Check org: api.github.com/orgs/{handle}
// - Repo search for brand-named repos (SDK impersonation)

// YOUTUBE
// - Channel search via public RSS/data API
// - Check for channels using brand name
// - Harder without API key — may need YouTube Data API v3 (free tier)
```

### 1.8 Handle Permutation Generation

Just like lookalike domains, we generate handle permutations to check:

```typescript
function generateHandlePermutations(handle: string): string[] {
  // Remove @ prefix if present
  const base = handle.replace('@', '');
  const permutations: Set<string> = new Set();

  // 1. Separator variations
  //    acmecorp → acme_corp, acme.corp, acme-corp
  //    Split on camelCase, common word boundaries
  const words = splitBrandWords(base); // ["acme", "corp"]
  if (words.length > 1) {
    permutations.add(words.join('_'));
    permutations.add(words.join('.'));
    permutations.add(words.join('-'));
    permutations.add(words.join('')); // already the original
  }

  // 2. Suffix variations
  //    acmecorp → acmecorp_official, acmecorpofficial,
  //    acmecorp_hq, acmecorphq, theacmecorp
  const suffixes = ['official', 'hq', 'inc', 'co', 'app', 'io', 'team', 'real'];
  const prefixes = ['the', 'real', 'official', 'get', 'try'];

  for (const suffix of suffixes) {
    permutations.add(`${base}_${suffix}`);
    permutations.add(`${base}${suffix}`);
  }
  for (const prefix of prefixes) {
    permutations.add(`${prefix}${base}`);
    permutations.add(`${prefix}_${base}`);
  }

  // 3. Character substitution
  //    acmecorp → acmec0rp, acmecorp1
  permutations.add(base.replace('o', '0'));
  permutations.add(base.replace('l', '1'));
  permutations.add(base.replace('e', '3'));
  permutations.add(base + '1');

  // 4. Truncation
  //    acmecorp → acme, acmeco
  if (base.length > 6) {
    permutations.add(base.slice(0, -1));
    permutations.add(base.slice(0, -2));
  }

  permutations.delete(base); // don't include the original
  return [...permutations];
}
```

---

## PART 2: BACKEND SOC PLATFORM & ADMIN ASSESSMENT

### 2.1 Methodology

This assessment maps every backend system, identifies overlapping functionality, dead code, and architectural debt, then recommends consolidation paths. The goal: reduce surface area, eliminate duplication, and create a clean backend that Claude Code can work with efficiently.

### 2.2 Current Backend Systems Inventory

Based on the repo structure, memory context, and plan documents, here's what exists:

```
┌──────────────────────────────────────────────────────────────────┐
│                     SYSTEM INVENTORY                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  A. TRUST RADAR WORKER (packages/trust-radar)                    │
│     ├── Auth system (JWT, register, login, /me)                  │
│     ├── Scan engine (URL/domain trust scoring)                   │
│     ├── Email Security Posture Engine                             │
│     │   ├── SPF checker                                          │
│     │   ├── DKIM checker (multi-selector)                        │
│     │   ├── DMARC checker                                        │
│     │   ├── MX resolver                                          │
│     │   └── Grade computation                                    │
│     ├── CF Scanner Pipeline                                       │
│     │   ├── 30-min cron                                          │
│     │   ├── Threat feed ingestion                                │
│     │   ├── Safe domains allowlist                               │
│     │   └── Eligible threat pool management                      │
│     ├── Threat Feed Integrations                                  │
│     │   ├── Phishing DBs                                            │
│     │   ├── Malware Feeds                                              │
│     │   └── Threat URLs                                            │
│     ├── AI Agents                                                │
│     │   ├── Analyst (threat assessment)                          │
│     │   └── Observer (daily briefing)                            │
│     ├── UI/SPA (served by Worker)                                │
│     │   ├── Landing/marketing pages                              │
│     │   ├── Auth pages                                           │
│     │   └── Dashboard                                            │
│     ├── D1 Database                                               │
│     │   ├── users                                                │
│     │   ├── scans / scan_history                                 │
│     │   ├── threats / threat_signals                             │
│     │   ├── email_security_*                                     │
│     │   └── 17+ migrations                                       │
│     └── KV Namespace(s) (caching, rate limiting)                 │
│                                                                   │
│  B. IMPRSN8 WORKER (packages/imprsn8)                            │
│     ├── Auth system (JWT, register, login, /me)   ← INDEPENDENT  │
│     ├── Profile management                                       │
│     ├── Social profile CRUD                        ← INDEPENDENT  │
│     │   ├── Add/remove social profiles per platform              │
│     │   └── Platform-specific data storage                       │
│     ├── Bio/content analysis (AI)                                │
│     ├── Impression scoring                                       │
│     ├── Score trend tracking                       ← INDEPENDENT  │
│     ├── Analysis history                           ← INDEPENDENT  │
│     ├── D1 Database (separate from Trust Radar)                  │
│     └── R2 Bucket (avatar storage)                               │
│     NOTE: imprsn8 is a FULLY INDEPENDENT product.                │
│     Do NOT copy, adapt, or reference its source files.           │
│     Social monitoring for Trust Radar = NEW CODE.                │
│                                                                   │
│  C. SHARED API (packages/api) — FastAPI on Railway               │
│     ├── AI bio enhancement                           ← OVERLAP?  │
│     ├── AI scan insight                              ← OVERLAP   │
│     ├── AI impression report                         ← OVERLAP   │
│     ├── PostgreSQL database                          ← OVERLAP   │
│     └── Status: LIKELY DEPRECATED                                │
│         (AI calls now go directly to AI provider API               │
│          from Workers, making FastAPI middleman                   │
│          unnecessary)                                            │
│                                                                   │
│  D. INFRASTRUCTURE                                                │
│     ├── GitHub Actions (path-filtered deploys)                   │
│     ├── Cloudflare Workers (2 workers)                           │
│     ├── Cloudflare D1 (2 databases)                              │
│     ├── Cloudflare KV (namespaces)                               │
│     ├── Cloudflare R2 (imprsn8 avatars)                          │
│     ├── Railway (FastAPI hosting)                    ← CANDIDATE │
│     └── Railway PostgreSQL                           ← CANDIDATE │
│                                                                   │
│  E. PLAN DOCUMENTS (scattered)                                    │
│     ├── PLATFORM_DESIGN_BRIEF.md                                 │
│     ├── TRUST_RADAR_COMMAND_CENTER_BUILD_PLAN.md                 │
│     ├── TRUST_RADAR_PIPELINE_OVERHAUL_PLAN.md                    │
│     ├── EMAIL_SIGNAL_DATA_STRATEGY.md                            │
│     ├── TRUST_RADAR_TENANT_ARCHITECTURE.md                       │
│     ├── SALES_AGENT_ARCHITECTURE.md                              │
│     ├── PLATFORM_UPLEVEL_PLAN_MARCH.md                           │
│     └── (this new unified plan)                                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Overlap & Duplication Analysis

```
┌──────────────────────────────────────────────────────────────────┐
│                    OVERLAP MAP                                    │
│  NOTE: imprsn8 is INDEPENDENT. Overlaps are acceptable —         │
│  these are two separate products that happen to share a monorepo.│
├──────────────┬───────────────┬───────────────┬───────────────────┤
│ Capability   │ Trust Radar   │ imprsn8       │ API (FastAPI)     │
├──────────────┼───────────────┼───────────────┼───────────────────┤
│ Auth/JWT     │ ✓ Full        │ ✓ Full        │ ✕ Uses API keys   │
│              │ PRIMARY       │ INDEPENDENT   │                   │
├──────────────┼───────────────┼───────────────┼───────────────────┤
│ User mgmt   │ ✓ users table │ ✓ users table │ ✕ No users        │
│              │ PRIMARY       │ INDEPENDENT   │                   │
├──────────────┼───────────────┼───────────────┼───────────────────┤
│ AI calls     │ ✓ Direct to   │ ? Via API?    │ ✓ AI providers   │
│ (inference)  │ AI provider API │               │ LIKELY OBSOLETE   │
├──────────────┼───────────────┼───────────────┼───────────────────┤
│ Social       │ ✕ Not yet     │ ✓ Full CRUD   │ ✕                 │
│ profiles     │ (NEW BUILD)   │ INDEPENDENT   │                   │
├──────────────┼───────────────┼───────────────┼───────────────────┤
│ Scoring      │ ✓ Trust score │ ✓ Impression  │ ✕                 │
│ engine       │               │ score         │                   │
│              │ DIFFERENT     │ DIFFERENT     │                   │
│              │ PURPOSE       │ PURPOSE       │                   │
├──────────────┼───────────────┼───────────────┼───────────────────┤
│ Analysis     │ ✓ Threat      │ ✓ Bio/content │ ✓ scan-insight    │
│ pipeline     │ assessment    │ analysis      │ OBSOLETE          │
├──────────────┼───────────────┼───────────────┼───────────────────┤
│ History/     │ ✓ scan_history│ ✓ analyses    │ ✕                 │
│ tracking     │               │ score_history │                   │
│              │ PRIMARY       │ INDEPENDENT   │                   │
├──────────────┼───────────────┼───────────────┼───────────────────┤
│ Database     │ D1 (SQLite)   │ D1 (SQLite)   │ PostgreSQL        │
│              │ PRIMARY       │ SEPARATE      │ LIKELY UNUSED     │
├──────────────┼───────────────┼───────────────┼───────────────────┤
│ Hosting      │ CF Worker     │ CF Worker     │ Railway           │
│              │ PRIMARY       │ SEPARATE      │ LIKELY UNUSED     │
└──────────────┴───────────────┴───────────────┴───────────────────┘
```

### 2.4 Specific Redundancies & Recommended Actions

#### ITEM 1: Auth System — INTENTIONAL SEPARATION (No Action Needed)

**Observation:** Two JWT auth implementations in two separate Workers with two separate user tables.

**Decision:** This is correct and intentional. imprsn8 and Trust Radar are independent products with independent user bases. They share no users, no data, and no auth state.

**Action for Claude Code:**
```
- Trust Radar auth: Keep as-is, it's the primary product
- imprsn8 auth: DO NOT TOUCH — separate product, separate team concern
- Do NOT try to create a shared auth service
- Do NOT reference imprsn8 auth code when building Trust Radar features
```

#### REDUNDANCY 2: FastAPI/Railway (HIGH — Deprecate)

**Problem:** The `packages/api` FastAPI service was originally a shared backend for AI inference (enhance-bio, scan-insight, impression-report). Both Workers now call the AI provider directly, making FastAPI a dead middleman that adds latency and hosting cost.

**Assessment checklist for Claude Code:**
```
1. Check if any Worker code still references api.lrx.io or the FastAPI endpoints
2. Check if the Railway PostgreSQL has data that hasn't been migrated to D1
3. Check GitHub Actions for deploy-api workflow

IF no active references exist:
  - Remove packages/api directory
  - Remove deploy-api GitHub Action
  - Remove Railway references from README
  - Cancel Railway service (saves ~$5-10/month)

IF references still exist:
  - Migrate those calls to direct AI provider API calls from Workers
  - THEN remove packages/api
```

#### REDUNDANCY 3: AI Inference Patterns (MEDIUM — Consolidate)

**Problem:** AI calls are likely scattered across multiple files with slightly different patterns (different prompts, different response parsing, different error handling).

**Recommendation:** Create a unified AI client utility:

```typescript
// packages/trust-radar/src/lib/ai-client.ts

interface AIClientConfig {
  apiKey: string;
  model: string;  // 'configured-via-env'
  maxRetries: number;
}

interface AgentCall {
  agent: 'analyst' | 'observer' | 'sales';
  task: string;
  context: Record<string, any>;
  responseFormat?: 'text' | 'json';
}

class TrustRadarAI {
  constructor(private config: AIClientConfig) {}

  async call(params: AgentCall): Promise<AgentResponse> {
    const systemPrompt = this.getAgentSystemPrompt(params.agent);
    const userPrompt = this.buildPrompt(params.task, params.context);

    // Unified retry logic, error handling, token tracking
    // Single place to add response caching, cost tracking, etc.
  }

  private getAgentSystemPrompt(agent: string): string {
    // Centralized agent prompt management
    // Makes it easy to tune all agents from one place
  }
}
```

**Action for Claude Code:**
```
1. Audit all files that import/call AI provider API
2. Extract common patterns into ai-client.ts
3. Refactor existing callers to use the unified client
4. Add token usage tracking (for cost monitoring)
```

#### ITEM 4: Score Computation — NEW BUILD for Trust Radar

**Observation:** Trust Radar needs a Brand Exposure Score. imprsn8 has an impression score. These are completely different systems for completely different purposes.

**Recommendation:** Build Trust Radar's scoring from scratch. Do NOT reference imprsn8's scoring implementation. The utility below is for Trust Radar only:

```typescript
// packages/trust-radar/src/lib/scoring.ts

interface ScoreComponent {
  name: string;
  value: number;     // 0-100
  weight: number;    // 0-1, must sum to 1
  grade?: string;    // A+ through F
}

function computeCompositeScore(components: ScoreComponent[]): {
  score: number;
  grade: string;
  breakdown: ScoreComponent[];
} {
  // Weighted average
  const score = components.reduce(
    (sum, c) => sum + (c.value * c.weight), 0
  );

  // Grade thresholds
  const grade = scoreToGrade(score);

  return { score, grade, breakdown: components };
}

function scoreToGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 45) return 'D';
  if (score >= 40) return 'D-';
  return 'F';
}
```

#### REDUNDANCY 5: Plan Documents (HIGH — Consolidate)

**Problem:** 7+ plan documents scattered across the repo root, some partially superseded, some still active, with overlapping or contradictory specs. Claude Code sessions start by reading one plan doc and may miss context from others.

**Recommendation:** The TRUST_RADAR_UNIFIED_PLATFORM_PLAN.md created in the companion document IS the consolidation. All other plan docs should be:

```
1. Archived to docs/archive/ directory
2. Each archived doc gets a header noting:
   "ARCHIVED — Superseded by TRUST_RADAR_UNIFIED_PLATFORM_PLAN.md
    Retained for reference. Do not use as build instructions."
3. The unified plan becomes the SINGLE source of truth
4. Future updates go into the unified plan, not new documents
```

### 2.5 Backend Improvement Recommendations

#### IMPROVEMENT 1: Cron Job Consolidation

**Current state:** Multiple crons may be running independently:
- CF Scanner (30-min)
- Observer daily briefing
- (Planned) Social monitor (6-hour)
- (Planned) CT log monitor
- (Planned) Lookalike domain checker

**Problem:** Each cron adds to Worker invocation costs and may have race conditions or overlapping work.

**Recommendation:** Single orchestrator cron pattern:

```typescript
// Single scheduled handler in the Worker
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const minute = new Date().getMinutes();
    const hour = new Date().getHours();

    // Every 30 minutes: threat feed scan
    if (minute === 0 || minute === 30) {
      ctx.waitUntil(runThreatFeedScan(env));
    }

    // Every 6 hours: social monitoring
    if (minute === 0 && hour % 6 === 0) {
      ctx.waitUntil(runSocialMonitor(env));
    }

    // Daily at 06:00 UTC: Observer briefing
    if (minute === 0 && hour === 6) {
      ctx.waitUntil(runObserverBriefing(env));
    }

    // Every hour: lookalike domain checks (batch)
    if (minute === 15) {
      ctx.waitUntil(runLookalikeDomainCheck(env));
    }

    // Every 5 minutes: CT log polling (lightweight)
    if (minute % 5 === 0) {
      ctx.waitUntil(runCTLogPoll(env));
    }
  }
};
```

#### IMPROVEMENT 2: Event-Driven Alert Pipeline

**Current state:** Alerts are likely generated inline during scanning and may not have a unified delivery mechanism.

**Recommendation:** Create an alerts table and unified notification pipeline:

```sql
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brand_profiles(id),
  user_id TEXT NOT NULL REFERENCES users(id),

  -- Alert classification
  alert_type TEXT NOT NULL,
  -- 'social_impersonation' | 'phishing_detected' | 'email_grade_change'
  -- 'lookalike_domain_active' | 'ct_certificate_issued' | 'threat_feed_match'

  severity TEXT NOT NULL,  -- LOW | MEDIUM | HIGH | CRITICAL
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,            -- JSON with alert-specific data

  -- Source linking
  source_type TEXT,        -- 'social_monitor_result' | 'threat_signal' | etc
  source_id TEXT,

  -- AI enrichment
  ai_assessment TEXT,
  ai_recommendations TEXT, -- JSON array of recommended actions

  -- State
  status TEXT DEFAULT 'new',  -- new | acknowledged | investigating | resolved | false_positive
  acknowledged_at TEXT,
  resolved_at TEXT,
  resolution_notes TEXT,

  -- Notification tracking
  email_sent INTEGER DEFAULT 0,
  webhook_sent INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_alerts_user_status ON alerts(user_id, status);
CREATE INDEX idx_alerts_brand ON alerts(brand_id);
CREATE INDEX idx_alerts_severity ON alerts(severity) WHERE status = 'new';
```

#### IMPROVEMENT 3: API Rate Limiting & Abuse Prevention

**Current state:** Rate limiting exists but may not be comprehensive across all public endpoints.

**Recommendation:** Unified rate limiter using KV:

```typescript
// Centralized rate limiter
async function rateLimit(env: Env, key: string, limits: {
  perMinute?: number;
  perHour?: number;
  perDay?: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  // Uses KV with expiring keys
  // Key format: "rl:{scope}:{identifier}:{window}"
  // Example: "rl:scan:1.2.3.4:hour"
}

// Apply per-endpoint:
// POST /api/scan/report (public): 5/hour per IP, 50/day per IP
// POST /api/brands (auth'd): 10/hour per user
// GET  /api/threats (auth'd): 100/min per user
// POST /api/social/scan (auth'd): 5/hour per brand
```

#### IMPROVEMENT 4: Observability & Health

**Current state:** Health check endpoint exists but likely no structured logging or monitoring.

**Recommendation:** Add lightweight observability:

```typescript
// Structured logging helper
function log(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, any>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  }));
  // Cloudflare Workers logs are available via wrangler tail
  // and Cloudflare dashboard → Workers → Logs
}

// Health endpoint enhancement
// GET /health should return:
{
  "status": "healthy",
  "version": "1.2.3",       // from package.json
  "database": "connected",   // D1 ping
  "last_scan_cron": "2026-03-20T12:30:00Z",
  "brands_monitored": 47,
  "threats_active": 23,
  "ai_agent_status": "operational"
}
```

### 2.6 Recommended Execution Sequence for Backend Cleanup

```
BACKEND STEP 1: Audit & Remove Dead Code
  └─ Check if packages/api is still referenced
  └─ Check for any OpenAI imports/references
  └─ Check for any lrx-radar.com / api.lrx.io hardcoded URLs
  └─ Remove dead code and references
  └─ Commit: "chore: remove deprecated FastAPI service and dead references"

BACKEND STEP 2: Create Unified AI Client
  └─ Create src/lib/ai-client.ts
  └─ Audit all AI provider API call sites
  └─ Refactor to use unified client
  └─ Add token usage tracking
  └─ Commit: "refactor: consolidate AI inference into unified client"

BACKEND STEP 3: Create Brand Profiles System
  └─ D1 migration for brand_profiles table
  └─ Brand CRUD endpoints
  └─ Auto-keyword generation from domain + brand_name
  └─ Scoring utilities (scoring.ts)
  └─ Commit: "feat(brands): add brand profile management system"

BACKEND STEP 4: Create Alerts Pipeline
  └─ D1 migration for alerts table
  └─ Unified alert creation utility
  └─ Alert endpoints (list, acknowledge, resolve)
  └─ Email notification integration
  └─ Commit: "feat(alerts): add unified alert pipeline"

BACKEND STEP 5: Social Monitoring Integration
  └─ D1 migrations for social monitoring tables
  └─ Platform checker implementations
  └─ Handle permutation generator
  └─ Cron integration
  └─ Analyst agent social assessment prompt
  └─ Wire into alerts pipeline
  └─ Commit: "feat(social): add social brand monitoring pipeline"

BACKEND STEP 6: Cron Consolidation
  └─ Merge all crons into single scheduled handler
  └─ Add health tracking for each cron job
  └─ Test timing doesn't cause conflicts
  └─ Commit: "refactor: consolidate cron jobs into single orchestrator"

BACKEND STEP 7: Observability
  └─ Structured logging helper
  └─ Enhanced /health endpoint
  └─ Rate limiter improvements
  └─ Commit: "feat: add observability and rate limiting"
```

### 2.7 Architecture After Cleanup

```
packages/trust-radar/src/
├── index.ts                    ← Main Worker entry (fetch + scheduled)
├── router.ts                   ← Route definitions
│
├── routes/
│   ├── auth.ts                 ← Register, login, /me
│   ├── brands.ts               ← Brand profile CRUD + handle management
│   ├── scan.ts                 ← Brand Exposure Report (public + auth'd)
│   ├── threats.ts              ← Threat feed browsing
│   ├── email-security.ts       ← Email posture endpoints
│   ├── social.ts               ← Social monitoring endpoints
│   ├── alerts.ts               ← Alert management
│   ├── briefing.ts             ← AI briefing endpoints
│   ├── stats.ts                ← Public stats (social proof)
│   ├── export.ts               ← STIX 2.1 export (future)
│   └── health.ts               ← Enhanced health check
│
├── agents/
│   ├── analyst.ts              ← Threat analysis agent
│   ├── observer.ts             ← Daily briefing agent
│   └── prompts/                ← Agent prompt templates
│       ├── analyst-threat.ts
│       ├── analyst-social.ts
│       ├── analyst-email.ts
│       ├── analyst-report.ts
│       └── observer-daily.ts
│
├── scanners/
│   ├── email-security.ts       ← SPF/DKIM/DMARC/MX engine
│   ├── threat-feeds.ts         ← Feed aggregation
│   ├── social-monitor.ts       ← Platform checking pipeline
│   ├── lookalike-domains.ts    ← Domain permutation + monitoring
│   └── ct-monitor.ts           ← Certificate Transparency (future)
│
├── feeds/
│   ├── phishtank.ts
│   ├── urlhaus.ts
│   ├── openphish.ts
│   └── certstream.ts           ← (future)
│
├── lib/
│   ├── ai-client.ts            ← Unified AI provider API client
│   ├── scoring.ts              ← Composite score computation
│   ├── dns.ts                  ← DoH utilities
│   ├── dnstwist.ts             ← Domain permutation generator
│   ├── social-check.ts         ← Platform username checkers
│   ├── handle-permutations.ts  ← Handle permutation generator
│   ├── alerts.ts               ← Alert creation + notification
│   ├── rate-limit.ts           ← KV-based rate limiter
│   ├── logger.ts               ← Structured logging
│   └── stix.ts                 ← STIX 2.1 serializer (future)
│
├── middleware/
│   ├── auth.ts                 ← JWT validation
│   ├── rate-limit.ts           ← Rate limit middleware
│   └── cors.ts                 ← CORS headers
│
├── cron/
│   ├── orchestrator.ts         ← Single scheduled handler
│   ├── threat-feed-scan.ts     ← 30-min feed scan logic
│   ├── social-monitor.ts       ← 6-hour social check logic
│   ├── observer-briefing.ts    ← Daily briefing logic
│   ├── lookalike-check.ts      ← Hourly domain check logic
│   └── ct-poll.ts              ← 5-min CT log poll (future)
│
├── ui/
│   ├── pages/                  ← HTML page generators
│   ├── components/             ← Reusable UI components
│   └── styles/                 ← CSS design system
│
└── types/
    ├── brand.ts                ← Brand profile types
    ├── social.ts               ← Social monitoring types
    ├── threat.ts               ← Threat/alert types
    ├── email.ts                ← Email security types
    └── agent.ts                ← AI agent types
```

---

*This document should be committed alongside TRUST_RADAR_UNIFIED_PLATFORM_PLAN.md
and referenced by Claude Code sessions working on backend improvements.*
