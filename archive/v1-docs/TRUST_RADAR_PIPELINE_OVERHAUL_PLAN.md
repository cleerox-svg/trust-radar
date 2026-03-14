# Trust Radar — Ingestion & Agent Pipeline Overhaul

**Date:** March 13, 2026
**Repo:** `github.com/cleerox-svg/trust-radar`
**Companion to:** `TRUST_RADAR_COMMAND_CENTER_BUILD_PLAN.md`
**Execution:** Claude Code

---

## Audit Summary

The current pipeline has four structural problems:

1. **Agents are SQL wrappers, not intelligent analyzers.** None of the 11 registered agents use AI. The `AgentResult` interface has `model` and `tokensUsed` fields — every agent returns `null/0`. Triage is a lookup table. Executive Intel is `COUNT(*)` formatted as JSON. Campaign Correlator is a single `GROUP BY`. The platform claims AI-powered threat intelligence but delivers deterministic SQL aggregation.

2. **Feed ingestion has hard caps that waste available data.** Every feed uses arbitrary `.slice(0, N)` limits (200–500 items) regardless of how much data the source provides. PhishTank offers 10K+ entries per pull; we take 500. OTX pulses can have hundreds of indicators; we take 20 per pulse. Deduplication already protects against repeats, so these caps only limit intelligence coverage.

3. **Sequential feed execution wastes the 30-second Worker budget.** `runAllFeeds()` iterates all 24 feeds one at a time. With network latency per feed, Tier 5–6 feeds rarely execute before the Worker times out.

4. **No post-ingestion enrichment pipeline.** Raw IOCs go straight to the database with minimal context. No WHOIS age checks, no DNS validation, no open-port scanning, no SSL cert analysis. The only enrichment is GeoIP (ip-api.com batch lookup), which runs once after all feeds complete.

---

## Architecture: Current vs. Target

### Current Pipeline

```
CRON (*/5 min)
  → runAllFeeds() — sequential, one feed at a time
    → fetch → slice(0, 500) → dedupe → INSERT threat → next feed
  → enrichThreatsGeo() — batch GeoIP on IPs missing country_code
  → if newItems > 0:
      → triage agent (hardcoded severity bumps)
      → threat-hunt agent (GROUP BY shared IPs)
      → campaign-correlator (GROUP BY shared IPs, again)
      → impersonation-detector (20 hardcoded brand keywords)
      → hosting-provider-analysis (aggregate by ISP)
  → done
```

### Target Pipeline

```
CRON (*/5 min)
  → runAllFeeds() — parallel within each tier, smart pagination
    → Tier 1 feeds (all concurrent): fetch → dedupe → INSERT → track high-water marks
    → Tier 2 feeds (all concurrent): same
    → ... through Tier 6
  → Enrichment Chain (parallel per-threat):
    → GeoIP + ISP resolution (existing, optimized)
    → Shodan InternetDB (open ports, vulns per IP)
    → DNS validation (does domain resolve? MX/SPF/DMARC?)
    → WHOIS age check via RDAP (domain age < 30d = suspicious)
    → SSL cert age check (issued < 7d + brand keyword = high confidence phishing)
  → AI Analysis Pipeline:
    → Triage v2: Claude Haiku batch-analyzes new threats, assigns severity + reasoning
    → Impersonation Detector v2: fuzzy brand matching + Haiku edge-case analysis
    → Campaign Linker: Haiku identifies campaign narratives from clustered IOCs
    → Threat Narrator: Haiku generates human-readable threat descriptions
  → Event-Driven Triggers:
    → Critical threat → immediate alert + evidence snapshot
    → Brand match → notify brand owner + create investigation
    → 3+ threats from same IP in 1h → auto-escalate + correlate
  → done (push via Durable Object WebSocket to connected dashboards)
```

---

## Phase A — Parallel Feed Execution + Remove Caps

**Effort:** 1 day
**Risk:** Low
**Files:** `packages/trust-radar/src/lib/feedRunner.ts`

### A.1 Parallel Execution Within Tiers

Replace the sequential loop in `runAllFeeds()`:

**Current code** (line 278–295 of `feedRunner.ts`):
```typescript
for (const schedule of schedules.results) {
  const { run, reason } = await shouldRun(schedule, now);
  if (!run) { feedsSkipped++; continue; }
  const mod = feedModules[schedule.feed_name];
  if (!mod) { feedsSkipped++; continue; }
  const result = await runFeed(env, schedule, mod);
  feedsRun++;
  totalNew += result.itemsNew;
  if (result.error) feedsFailed++;
}
```

**Replace with:**
```typescript
// Group by tier
const byTier = new Map<number, typeof schedules.results>();
for (const s of schedules.results) {
  const tier = s.tier;
  if (!byTier.has(tier)) byTier.set(tier, []);
  byTier.get(tier)!.push(s);
}

// Execute tiers in order, feeds within each tier in parallel
const sortedTiers = [...byTier.keys()].sort((a, b) => a - b);

for (const tier of sortedTiers) {
  const tierFeeds = byTier.get(tier)!;
  const eligible = [];

  for (const schedule of tierFeeds) {
    const { run } = await shouldRun(schedule, now);
    if (!run) { feedsSkipped++; continue; }
    const mod = feedModules[schedule.feed_name];
    if (!mod) { feedsSkipped++; continue; }
    eligible.push({ schedule, mod });
  }

  if (eligible.length === 0) continue;

  // Run all feeds in this tier concurrently
  const results = await Promise.allSettled(
    eligible.map(({ schedule, mod }) => runFeed(env, schedule, mod))
  );

  for (const result of results) {
    feedsRun++;
    if (result.status === "fulfilled") {
      totalNew += result.value.itemsNew;
      if (result.value.error) feedsFailed++;
    } else {
      feedsFailed++;
    }
  }
}
```

### A.2 Increase Slice Caps

Update each feed module to increase or remove hard caps. The dedup layer (`INSERT OR IGNORE` + KV `isDuplicate`) already prevents duplicates, so larger batches are safe.

| Feed | Current Cap | New Cap | Rationale |
|------|------------|---------|-----------|
| `phishtank.ts` | `slice(0, 500)` | `slice(0, 2000)` | Feed has 10K+ entries; dedup handles repeats |
| `threatfox.ts` | `slice(0, 500)` | `slice(0, 1500)` | API returns up to 1000/day by default |
| `virustotal.ts` (premium) | `slice(0, 200)` | `slice(0, 500)` | Premium search returns more |
| `otx.ts` pulses | `slice(0, 50)` | `slice(0, 100)` | More pulses = more coverage |
| `otx.ts` indicators/pulse | `slice(0, 20)` | `slice(0, 100)` | Critical — 20 indicators/pulse misses most IOCs |
| `certstream.ts` | `slice(0, 200)` | `slice(0, 500)` | crt.sh returns many results per keyword |
| `malbazaar.ts` | check current | `slice(0, 1000)` | Abuse.ch has high volume |
| `abuseipdb.ts` | check current | `slice(0, 1000)` | Blacklist endpoint returns top offenders |

### A.3 High-Water Mark Tracking

For feeds that support timestamp-based filtering, track the last-seen timestamp in KV so subsequent runs only fetch new data.

**Add to `feedRunner.ts`:**
```typescript
export async function getHighWaterMark(env: Env, feedName: string): Promise<string | null> {
  return env.CACHE.get(`hwm:${feedName}`);
}

export async function setHighWaterMark(env: Env, feedName: string, timestamp: string): Promise<void> {
  await env.CACHE.put(`hwm:${feedName}`, timestamp, { expirationTtl: 7 * 86400 }); // 7d TTL
}
```

**Update feeds that support it:**

- `threatfox.ts`: Change `{ query: "get_iocs", days: 1 }` to use the high-water mark timestamp, fetching only IOCs newer than the last successful pull
- `otx.ts`: Add `?modified_since={hwm}` parameter to the pulses endpoint
- `phishtank.ts`: Filter results by `submission_time` > high-water mark
- `certstream.ts`: Already rotates keywords; add timestamp filtering on results

---

## Phase B — Free Enrichment Chain

**Effort:** 2–3 days
**Risk:** Medium (new external API calls, rate limits to respect)
**Files:** New `packages/trust-radar/src/enrichment/` directory

### B.1 Architecture

Create a new `enrichment/` module that runs as a post-ingestion step. Each enricher is a function that takes a batch of threat IDs, queries the relevant free API, and updates the threat row with additional context.

**New file:** `packages/trust-radar/src/enrichment/types.ts`
```typescript
export interface EnrichmentContext {
  env: Env;
  threatIds: string[];
}

export interface EnrichmentResult {
  enriched: number;
  skipped: number;
  errors: number;
}

export interface EnrichmentModule {
  name: string;
  /** Which threat field must be present for this enricher to run */
  requires: "ip_address" | "domain" | "url";
  /** Max items per run (respect rate limits) */
  batchSize: number;
  enrich(ctx: EnrichmentContext): Promise<EnrichmentResult>;
}
```

**New file:** `packages/trust-radar/src/enrichment/index.ts`
```typescript
import { shodanInternetDB } from "./shodan";
import { rdapWhois } from "./rdap";
import { dnsValidation } from "./dns";
import { sslCertAge } from "./sslCert";

export const enrichmentModules: EnrichmentModule[] = [
  shodanInternetDB,  // IP → open ports, vulns, hostnames
  rdapWhois,         // domain → registration age, registrar
  dnsValidation,     // domain → resolves?, MX, SPF, DMARC
  sslCertAge,        // domain → cert issue date, issuer
];
```

### B.2 Shodan InternetDB (Free, No Key Required)

**New file:** `packages/trust-radar/src/enrichment/shodan.ts`

Shodan InternetDB (`https://internetdb.shodan.io/{ip}`) returns open ports, known vulns, hostnames, and CPEs for any IP — completely free, no API key, ~1 req/sec rate limit.

```typescript
export const shodanInternetDB: EnrichmentModule = {
  name: "shodan-internetdb",
  requires: "ip_address",
  batchSize: 50,  // conservative; 1 req/sec ≈ 50 in ~50s

  async enrich(ctx: EnrichmentContext): Promise<EnrichmentResult> {
    const threats = await ctx.env.DB.prepare(
      `SELECT id, ip_address FROM threats
       WHERE id IN (${ctx.threatIds.map(() => "?").join(",")})
         AND ip_address IS NOT NULL
         AND json_extract(metadata, '$.shodan_enriched') IS NULL`
    ).bind(...ctx.threatIds).all<{ id: string; ip_address: string }>();

    let enriched = 0, skipped = 0, errors = 0;

    for (const threat of threats.results) {
      try {
        // Check KV cache first (avoid re-querying same IP)
        const cacheKey = `shodan:${threat.ip_address}`;
        const cached = await ctx.env.CACHE.get(cacheKey);

        let data: ShodanResult;
        if (cached) {
          data = JSON.parse(cached);
          skipped++;
        } else {
          const res = await fetch(`https://internetdb.shodan.io/${threat.ip_address}`);
          if (res.status === 404) { skipped++; continue; } // IP not in Shodan
          if (!res.ok) { errors++; continue; }

          data = await res.json() as ShodanResult;
          await ctx.env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 }); // 24h cache

          // Rate limit: ~1 req/sec
          await new Promise(r => setTimeout(r, 1100));
        }

        // Determine if this IP has known vulnerabilities
        const hasVulns = (data.vulns?.length ?? 0) > 0;
        const hasOpenPorts = (data.ports?.length ?? 0) > 0;

        // Auto-escalate if IP has known CVEs
        let severityBump = false;
        if (hasVulns && data.vulns!.some(v => v.startsWith("CVE-"))) {
          severityBump = true;
        }

        await ctx.env.DB.prepare(
          `UPDATE threats SET
            metadata = json_set(COALESCE(metadata, '{}'),
              '$.shodan_enriched', 1,
              '$.shodan_ports', ?,
              '$.shodan_vulns', ?,
              '$.shodan_hostnames', ?,
              '$.shodan_cpes', ?
            ),
            severity = CASE
              WHEN ? = 1 AND severity IN ('low', 'medium') THEN 'high'
              ELSE severity
            END,
            tags = CASE
              WHEN ? > 0 THEN json_insert(COALESCE(tags, '[]'), '$[#]', 'has-cves')
              ELSE tags
            END,
            updated_at = datetime('now')
          WHERE id = ?`
        ).bind(
          JSON.stringify(data.ports ?? []),
          JSON.stringify(data.vulns ?? []),
          JSON.stringify(data.hostnames ?? []),
          JSON.stringify(data.cpes ?? []),
          severityBump ? 1 : 0,
          data.vulns?.length ?? 0,
          threat.id,
        ).run();

        enriched++;
      } catch { errors++; }
    }

    return { enriched, skipped, errors };
  },
};

interface ShodanResult {
  ip?: string;
  ports?: number[];
  vulns?: string[];
  hostnames?: string[];
  cpes?: string[];
  tags?: string[];
}
```

### B.3 RDAP/WHOIS Domain Age Check (Free, No Key)

**New file:** `packages/trust-radar/src/enrichment/rdap.ts`

RDAP is the official replacement for WHOIS. Query `https://rdap.org/domain/{domain}` — free, no key, no account. Returns registration date, registrar, and expiry.

```typescript
export const rdapWhois: EnrichmentModule = {
  name: "rdap-whois",
  requires: "domain",
  batchSize: 30,  // RDAP has no official rate limit but be respectful

  async enrich(ctx: EnrichmentContext): Promise<EnrichmentResult> {
    const threats = await ctx.env.DB.prepare(
      `SELECT id, domain FROM threats
       WHERE id IN (${ctx.threatIds.map(() => "?").join(",")})
         AND domain IS NOT NULL
         AND json_extract(metadata, '$.rdap_enriched') IS NULL`
    ).bind(...ctx.threatIds).all<{ id: string; domain: string }>();

    let enriched = 0, skipped = 0, errors = 0;

    for (const threat of threats.results) {
      try {
        // Extract registrable domain (strip subdomains)
        const parts = threat.domain.split(".");
        const regDomain = parts.length > 2 ? parts.slice(-2).join(".") : threat.domain;

        // Check KV cache
        const cacheKey = `rdap:${regDomain}`;
        const cached = await ctx.env.CACHE.get(cacheKey);
        let rdapData: RdapResult;

        if (cached) {
          rdapData = JSON.parse(cached);
        } else {
          const res = await fetch(`https://rdap.org/domain/${regDomain}`, {
            headers: { Accept: "application/rdap+json" },
          });
          if (!res.ok) { skipped++; continue; }

          const raw = await res.json() as any;
          rdapData = {
            registrar: raw.entities?.[0]?.vcardArray?.[1]?.find((v: any) => v[0] === "fn")?.[3] ?? null,
            registrationDate: raw.events?.find((e: any) => e.eventAction === "registration")?.eventDate ?? null,
            expirationDate: raw.events?.find((e: any) => e.eventAction === "expiration")?.eventDate ?? null,
            status: raw.status ?? [],
          };

          await ctx.env.CACHE.put(cacheKey, JSON.stringify(rdapData), { expirationTtl: 7 * 86400 }); // 7d
          await new Promise(r => setTimeout(r, 500)); // rate limit courtesy
        }

        // Calculate domain age in days
        let domainAgeDays: number | null = null;
        if (rdapData.registrationDate) {
          const regDate = new Date(rdapData.registrationDate);
          domainAgeDays = Math.floor((Date.now() - regDate.getTime()) / 86400000);
        }

        // Auto-escalate: domain < 30 days old with a threat indicator = suspicious
        const isNewlyRegistered = domainAgeDays !== null && domainAgeDays < 30;
        const isVeryNew = domainAgeDays !== null && domainAgeDays < 7;

        await ctx.env.DB.prepare(
          `UPDATE threats SET
            metadata = json_set(COALESCE(metadata, '{}'),
              '$.rdap_enriched', 1,
              '$.domain_registrar', ?,
              '$.domain_registered_at', ?,
              '$.domain_expires_at', ?,
              '$.domain_age_days', ?
            ),
            severity = CASE
              WHEN ? = 1 AND severity IN ('low', 'medium') THEN 'high'
              WHEN ? = 1 AND severity = 'high' THEN 'critical'
              ELSE severity
            END,
            confidence = CASE
              WHEN ? = 1 THEN MIN(confidence + 0.15, 0.99)
              ELSE confidence
            END,
            tags = CASE
              WHEN ? = 1 THEN json_insert(COALESCE(tags, '[]'), '$[#]', 'newly-registered')
              ELSE tags
            END,
            updated_at = datetime('now')
          WHERE id = ?`
        ).bind(
          rdapData.registrar,
          rdapData.registrationDate,
          rdapData.expirationDate,
          domainAgeDays,
          isVeryNew ? 1 : 0,    // very new → escalate severity
          isVeryNew ? 1 : 0,    // very new + already high → critical
          isNewlyRegistered ? 1 : 0,  // < 30d → boost confidence
          isNewlyRegistered ? 1 : 0,  // < 30d → tag
          threat.id,
        ).run();

        enriched++;
      } catch { errors++; }
    }

    return { enriched, skipped, errors };
  },
};

interface RdapResult {
  registrar: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  status: string[];
}
```

### B.4 DNS Validation (Free, Cloudflare DoH)

**New file:** `packages/trust-radar/src/enrichment/dns.ts`

Use Cloudflare's DNS-over-HTTPS (`https://cloudflare-dns.com/dns-query`) to check if domains actually resolve, and inspect MX/SPF/DMARC records. Free, unlimited, fast.

```typescript
export const dnsValidation: EnrichmentModule = {
  name: "dns-validation",
  requires: "domain",
  batchSize: 100,  // DNS queries are fast

  async enrich(ctx: EnrichmentContext): Promise<EnrichmentResult> {
    const threats = await ctx.env.DB.prepare(
      `SELECT id, domain FROM threats
       WHERE id IN (${ctx.threatIds.map(() => "?").join(",")})
         AND domain IS NOT NULL
         AND json_extract(metadata, '$.dns_enriched') IS NULL`
    ).bind(...ctx.threatIds).all<{ id: string; domain: string }>();

    let enriched = 0, skipped = 0, errors = 0;

    for (const threat of threats.results) {
      try {
        const domain = threat.domain;

        // Parallel DNS queries: A record, MX, TXT (for SPF/DMARC)
        const [aResult, mxResult, txtResult] = await Promise.allSettled([
          dohQuery(domain, "A"),
          dohQuery(domain, "MX"),
          dohQuery(domain, "TXT"),
        ]);

        const hasARecord = aResult.status === "fulfilled" && aResult.value.Answer?.length > 0;
        const hasMX = mxResult.status === "fulfilled" && mxResult.value.Answer?.length > 0;

        // Extract SPF and DMARC from TXT records
        const txtRecords = txtResult.status === "fulfilled"
          ? (txtResult.value.Answer ?? []).map((a: any) => a.data).join(" ")
          : "";
        const hasSPF = txtRecords.includes("v=spf1");
        const hasDMARC = txtRecords.includes("v=DMARC1");

        // Phishing indicator: domain resolves but has no MX, no SPF, no DMARC
        const lacksEmailAuth = hasARecord && !hasMX && !hasSPF && !hasDMARC;

        await ctx.env.DB.prepare(
          `UPDATE threats SET
            metadata = json_set(COALESCE(metadata, '{}'),
              '$.dns_enriched', 1,
              '$.dns_resolves', ?,
              '$.dns_has_mx', ?,
              '$.dns_has_spf', ?,
              '$.dns_has_dmarc', ?
            ),
            confidence = CASE
              WHEN ? = 1 THEN MIN(confidence + 0.1, 0.99)
              ELSE confidence
            END,
            tags = CASE
              WHEN ? = 1 THEN json_insert(COALESCE(tags, '[]'), '$[#]', 'no-email-auth')
              ELSE tags
            END,
            updated_at = datetime('now')
          WHERE id = ?`
        ).bind(
          hasARecord ? 1 : 0,
          hasMX ? 1 : 0,
          hasSPF ? 1 : 0,
          hasDMARC ? 1 : 0,
          lacksEmailAuth ? 1 : 0,
          lacksEmailAuth ? 1 : 0,
          threat.id,
        ).run();

        enriched++;
      } catch { errors++; }
    }

    return { enriched, skipped, errors };
  },
};

async function dohQuery(domain: string, type: string): Promise<any> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
    { headers: { Accept: "application/dns-json" } }
  );
  if (!res.ok) throw new Error(`DoH ${res.status}`);
  return res.json();
}
```

### B.5 Wire Enrichment Chain into Feed Runner

**File:** `packages/trust-radar/src/lib/feedRunner.ts`

After `enrichThreatsGeo()` runs, add the enrichment chain:

```typescript
// In runAllFeeds(), after the GeoIP enrichment block (line ~298):

// Phase 2: Run enrichment chain on newly ingested threats
if (totalNew > 0) {
  try {
    const { enrichmentModules } = await import("../enrichment/index");
    const { runEnrichmentChain } = await import("../enrichment/runner");
    const enrichResult = await runEnrichmentChain(env, enrichmentModules);
    console.log(`[enrich] chain complete: ${JSON.stringify(enrichResult)}`);
  } catch (err) {
    console.error("[enrich] chain error:", err);
  }
}
```

**New file:** `packages/trust-radar/src/enrichment/runner.ts`
```typescript
import type { Env } from "../types";
import type { EnrichmentModule, EnrichmentResult } from "./types";

export async function runEnrichmentChain(
  env: Env,
  modules: EnrichmentModule[],
): Promise<Record<string, EnrichmentResult>> {
  const results: Record<string, EnrichmentResult> = {};

  // Get recently ingested threat IDs (last 10 minutes, not yet enriched)
  const recentThreats = await env.DB.prepare(
    `SELECT id, ip_address, domain FROM threats
     WHERE created_at >= datetime('now', '-10 minutes')
     ORDER BY created_at DESC LIMIT 200`
  ).all<{ id: string; ip_address: string | null; domain: string | null }>();

  const allIds = recentThreats.results.map(t => t.id);
  if (allIds.length === 0) return results;

  // Run each enrichment module
  for (const mod of modules) {
    try {
      // Filter to threats that have the required field
      const eligible = recentThreats.results
        .filter(t => t[mod.requires] !== null)
        .map(t => t.id)
        .slice(0, mod.batchSize);

      if (eligible.length === 0) {
        results[mod.name] = { enriched: 0, skipped: 0, errors: 0 };
        continue;
      }

      results[mod.name] = await mod.enrich({ env, threatIds: eligible });
      console.log(`[enrich] ${mod.name}: enriched=${results[mod.name].enriched}`);
    } catch (err) {
      console.error(`[enrich] ${mod.name} failed:`, err);
      results[mod.name] = { enriched: 0, skipped: 0, errors: 1 };
    }
  }

  return results;
}
```

---

## Phase C — AI-Powered Agents (Claude Haiku)

**Effort:** 3–4 days
**Risk:** Medium (API costs, prompt engineering, latency)
**Files:** Rewrite 4 agents, new AI utility module

### C.1 AI Utility Module

**New file:** `packages/trust-radar/src/lib/ai.ts`

Centralized function for calling Claude Haiku from the Worker. Uses the LRX API key already in the env, or calls Anthropic directly.

```typescript
import type { Env } from "../types";

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiResponse {
  content: string;
  model: string;
  tokensUsed: number;
}

/**
 * Call Claude Haiku for threat analysis.
 * Routes through the LRX API Gateway if available,
 * falls back to direct Anthropic API.
 */
export async function callHaiku(
  env: Env,
  systemPrompt: string,
  messages: AiMessage[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<AiResponse> {
  const maxTokens = options?.maxTokens ?? 1024;
  const temperature = options?.temperature ?? 0.3;

  // Direct Anthropic API call (requires ANTHROPIC_API_KEY in env)
  const apiKey = (env as any).ANTHROPIC_API_KEY ?? env.LRX_API_KEY;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Haiku API ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
    model: string;
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    content: data.content.map(c => c.text).join(""),
    model: data.model,
    tokensUsed: data.usage.input_tokens + data.usage.output_tokens,
  };
}
```

**Update `Env` type:**

**File:** `packages/trust-radar/src/types.ts`
```typescript
export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  VIRUSTOTAL_API_KEY: string;
  ANTHROPIC_API_KEY: string;  // NEW — for Claude Haiku calls
  LRX_API_URL: string;
  LRX_API_KEY: string;
  ENVIRONMENT: string;
}
```

**Set the secret:**
```bash
cd packages/trust-radar
wrangler secret put ANTHROPIC_API_KEY
# Paste your Anthropic API key
```

### C.2 Triage Agent v2 — AI-Powered Severity Assessment

**File:** `packages/trust-radar/src/agents/triage.ts` — full rewrite

```typescript
import type { AgentModule, AgentContext, AgentResult } from "../lib/agentRunner";
import { callHaiku } from "../lib/ai";

const TRIAGE_SYSTEM_PROMPT = `You are a senior threat intelligence analyst at a Security Operations Center.
You receive batches of newly ingested threat indicators (IOCs) and must assess each one.

For each threat, provide:
1. severity: critical | high | medium | low (based on threat type, source reliability, IOC context)
2. confidence: 0.0-1.0 (how certain you are this is a real threat)
3. reasoning: one sentence explaining your assessment
4. tags: additional classification tags (e.g., "apt", "commodity-malware", "credential-phishing")
5. recommended_action: investigate | monitor | auto-resolve | escalate

Consider:
- C2/botnet IPs are almost always critical
- Phishing domains targeting financial/identity brands are high
- Newly registered domains (< 30 days) with brand keywords are high confidence
- IOCs from curated feeds (CISA KEV, ThreatFox, Feodo) are high confidence
- Social media IOCs (TweetFeed, Mastodon) need verification — moderate confidence
- Reputation-only IPs (blocklists) without specific threat context are medium/low

Respond ONLY with a JSON array. No markdown, no preamble.
[{"id": "...", "severity": "...", "confidence": 0.0, "reasoning": "...", "tags": [...], "recommended_action": "..."}]`;

export const triageAgent: AgentModule = {
  name: "triage",
  displayName: "Triage",
  description: "AI-powered threat severity assessment and prioritization",
  color: "#3B82F6",
  trigger: "event",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const limit = (ctx.input.limit as number) ?? 50;

    // Fetch un-triaged threats
    const threats = await ctx.env.DB.prepare(
      `SELECT id, type, title, severity, confidence, source, ioc_type, ioc_value,
              domain, ip_address, country_code,
              json_extract(metadata, '$.domain_age_days') as domain_age_days,
              json_extract(metadata, '$.shodan_vulns') as shodan_vulns,
              json_extract(metadata, '$.dns_resolves') as dns_resolves,
              json_extract(metadata, '$.dns_has_spf') as dns_has_spf
       FROM threats
       WHERE status = 'new'
       ORDER BY created_at DESC LIMIT ?`
    ).bind(limit).all();

    if (threats.results.length === 0) {
      return { itemsProcessed: 0, itemsCreated: 0, itemsUpdated: 0, output: { message: "No new threats to triage" } };
    }

    // Batch threats into groups of 20 for Haiku (keeps context window small)
    const BATCH_SIZE = 20;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalTokens = 0;

    for (let i = 0; i < threats.results.length; i += BATCH_SIZE) {
      const batch = threats.results.slice(i, i + BATCH_SIZE);

      // Format batch for Haiku
      const threatSummaries = batch.map((t: any) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        current_severity: t.severity,
        source: t.source,
        ioc_type: t.ioc_type,
        ioc_value: t.ioc_value,
        domain: t.domain,
        ip_address: t.ip_address,
        country: t.country_code,
        domain_age_days: t.domain_age_days,
        has_cves: t.shodan_vulns ? JSON.parse(t.shodan_vulns).length > 0 : false,
        dns_resolves: t.dns_resolves === 1,
        has_spf: t.dns_has_spf === 1,
      }));

      try {
        const response = await callHaiku(ctx.env, TRIAGE_SYSTEM_PROMPT, [
          { role: "user", content: JSON.stringify(threatSummaries) },
        ], { maxTokens: 2048, temperature: 0.2 });

        totalTokens += response.tokensUsed;

        // Parse Haiku's response
        const assessments = JSON.parse(
          response.content.replace(/```json|```/g, "").trim()
        ) as Array<{
          id: string;
          severity: string;
          confidence: number;
          reasoning: string;
          tags: string[];
          recommended_action: string;
        }>;

        // Apply assessments to database
        for (const assessment of assessments) {
          try {
            await ctx.env.DB.prepare(
              `UPDATE threats SET
                severity = ?,
                confidence = ?,
                status = 'triaged',
                tags = json_set(COALESCE(tags, '[]'), '$[#]', ?),
                metadata = json_set(COALESCE(metadata, '{}'),
                  '$.ai_triage_reasoning', ?,
                  '$.ai_recommended_action', ?,
                  '$.ai_triaged_at', datetime('now')
                ),
                updated_at = datetime('now')
              WHERE id = ? AND status = 'new'`
            ).bind(
              assessment.severity,
              assessment.confidence,
              assessment.tags.join(","),
              assessment.reasoning,
              assessment.recommended_action,
              assessment.id,
            ).run();
            totalUpdated++;
          } catch { /* skip individual failures */ }
        }

        totalProcessed += batch.length;
      } catch (err) {
        console.error(`[triage-v2] Haiku batch failed:`, err);
        // Fall back to the old heuristic triage for this batch
        totalProcessed += batch.length;
      }
    }

    return {
      itemsProcessed: totalProcessed,
      itemsCreated: 0,
      itemsUpdated: totalUpdated,
      output: {
        threatsAnalyzed: totalProcessed,
        threatsUpdated: totalUpdated,
        aiModel: "claude-haiku-4-5",
      },
      model: "claude-haiku-4-5",
      tokensUsed: totalTokens,
    };
  },
};
```

**Cost estimate:** 50 threats × ~200 tokens input each = ~10K input tokens per run. At $0.80/MTok input for Haiku 4.5, that's $0.008 per run. At 288 runs/day (every 5 min), that's ~$2.30/month. Well within the budget.

### C.3 Impersonation Detector v2 — Dynamic Brand Registry + AI

**File:** `packages/trust-radar/src/agents/impersonationDetector.ts` — full rewrite

**New migration:** `packages/trust-radar/migrations/0019_monitored_brands.sql`

```sql
CREATE TABLE IF NOT EXISTS monitored_brands (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,              -- "PayPal", "Amazon", "Nike"
  domains       TEXT NOT NULL DEFAULT '[]', -- JSON: ["paypal.com", "paypal.co.uk"]
  keywords      TEXT NOT NULL DEFAULT '[]', -- JSON: ["paypal", "paypa1", "pay-pal"]
  logo_hash     TEXT,                       -- perceptual hash for visual similarity (future)
  owner_id      TEXT,                       -- FK to users.id (who registered this brand)
  tier          TEXT DEFAULT 'community',   -- community | pro | enterprise
  is_verified   INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brands_name ON monitored_brands(name);
CREATE INDEX IF NOT EXISTS idx_brands_owner ON monitored_brands(owner_id);

-- Seed with common brands (community tier, no owner)
INSERT OR IGNORE INTO monitored_brands (id, name, domains, keywords, is_verified) VALUES
  ('brand-01', 'PayPal', '["paypal.com"]', '["paypal","paypa1","pay-pal","paypai"]', 1),
  ('brand-02', 'Apple', '["apple.com","icloud.com"]', '["apple","app1e","appie","icloud"]', 1),
  ('brand-03', 'Google', '["google.com","gmail.com"]', '["google","g00gle","gogle","gmail"]', 1),
  ('brand-04', 'Microsoft', '["microsoft.com","outlook.com","live.com"]', '["microsoft","micros0ft","msft","outlook"]', 1),
  ('brand-05', 'Amazon', '["amazon.com","aws.amazon.com"]', '["amazon","amaz0n","arnazon","arnazon"]', 1),
  ('brand-06', 'Netflix', '["netflix.com"]', '["netflix","netf1ix","netfIix"]', 1),
  ('brand-07', 'Facebook', '["facebook.com","meta.com"]', '["facebook","faceb00k","fb","meta"]', 1),
  ('brand-08', 'Instagram', '["instagram.com"]', '["instagram","instagran","1nstagram"]', 1),
  ('brand-09', 'LinkedIn', '["linkedin.com"]', '["linkedin","linked1n","linkdin"]', 1),
  ('brand-10', 'Chase', '["chase.com"]', '["chase","chas3"]', 1),
  ('brand-11', 'Bank of America', '["bankofamerica.com"]', '["bankofamerica","bank0famerica","bofa"]', 1),
  ('brand-12', 'Wells Fargo', '["wellsfargo.com"]', '["wellsfargo","wells-fargo","we11sfargo"]', 1),
  ('brand-13', 'Coinbase', '["coinbase.com"]', '["coinbase","c0inbase","coinbas3"]', 1),
  ('brand-14', 'Binance', '["binance.com"]', '["binance","b1nance","binanc3"]', 1),
  ('brand-15', 'Stripe', '["stripe.com"]', '["stripe","str1pe"]', 1),
  ('brand-16', 'Shopify', '["shopify.com"]', '["shopify","shop1fy"]', 1),
  ('brand-17', 'DHL', '["dhl.com"]', '["dhl","dh1"]', 1),
  ('brand-18', 'FedEx', '["fedex.com"]', '["fedex","fed3x","f3dex"]', 1),
  ('brand-19', 'USPS', '["usps.com"]', '["usps","uspS","us-ps"]', 1),
  ('brand-20', 'Zoom', '["zoom.us"]', '["zoom","z00m","zo0m"]', 1),
  ('brand-21', 'Slack', '["slack.com"]', '["slack","s1ack"]', 1),
  ('brand-22', 'GitHub', '["github.com"]', '["github","g1thub","githuh"]', 1),
  ('brand-23', 'Dropbox', '["dropbox.com"]', '["dropbox","dr0pbox","dropb0x"]', 1),
  ('brand-24', 'Adobe', '["adobe.com"]', '["adobe","ad0be"]', 1),
  ('brand-25', 'Cloudflare', '["cloudflare.com"]', '["cloudflare","c1oudflare","cloudfiare"]', 1),
  ('brand-26', 'Nike', '["nike.com"]', '["nike","n1ke","nik3"]', 1),
  ('brand-27', 'Walmart', '["walmart.com"]', '["walmart","wa1mart","walmrt"]', 1),
  ('brand-28', 'Target', '["target.com"]', '["target","targ3t"]', 1),
  ('brand-29', 'IRS', '["irs.gov"]', '["irs","1rs"]', 1),
  ('brand-30', 'HMRC', '["hmrc.gov.uk"]', '["hmrc","hrnrc"]', 1);
```

The rewritten agent:

1. Loads all brands from `monitored_brands` table (not hardcoded)
2. Computes Levenshtein distance between each domain and brand keywords
3. For edge cases (distance 1–3, ambiguous), sends to Claude Haiku for final judgment
4. Tags matched threats with `impersonation:{brand_name}` and the matched brand ID
5. Creates an investigation record for high-confidence brand matches

The Levenshtein function and Haiku call follow the same pattern as the triage agent — batch ambiguous cases, parse JSON response, update threats.

### C.4 Executive Intel v2 — AI-Generated Natural Language Briefings

**File:** `packages/trust-radar/src/agents/executiveIntel.ts` — full rewrite

Instead of formatting SQL results as JSON, this version:

1. Gathers the same statistical data (threat counts, top types, critical highlights)
2. Sends the structured data to Claude Haiku with a briefing-generation prompt
3. Haiku produces a natural language executive summary with trend analysis, risk assessment, and recommended actions
4. Stores the generated briefing text in `threat_briefings.body`

System prompt for briefing generation:
```
You are a senior threat intelligence analyst writing a daily briefing for C-suite executives.
Given the following threat data from the last {N} hours, write a concise 3-paragraph executive briefing.

Paragraph 1: Situation overview — total threats, severity distribution, risk posture.
Paragraph 2: Key developments — notable campaigns, new threat actors, brand impersonation attempts.
Paragraph 3: Recommended actions — what leadership should be aware of, any decisions needed.

Tone: Professional, direct, no jargon. Write for a CEO who has 2 minutes.
```

### C.5 New Agent: Threat Narrator

**New file:** `packages/trust-radar/src/agents/threatNarrator.ts`

This agent runs after triage and produces human-readable descriptions for threats that currently have generic titles like "ThreatFox: emotet — 185.220.x.x" or "PhishTank: evil-paypal.com".

For each recently triaged threat, Haiku generates:
- A clear 1-sentence summary suitable for a non-technical reader
- A 2-sentence technical analysis for analysts
- Recommended investigation steps

This dramatically improves the quality of the Live Threat Feed in the Command Center and the Daily Briefing.

---

## Phase D — New Free Feed Integrations

**Effort:** 2 days
**Risk:** Low
**Files:** New files in `packages/trust-radar/src/feeds/`

### D.1 URLhaus (abuse.ch) — Malware Distribution URLs

**New file:** `packages/trust-radar/src/feeds/urlhaus.ts`

- Endpoint: `https://urlhaus-api.abuse.ch/v1/urls/recent/limit/1000/`
- Free, no key, returns up to 1000 recent malware distribution URLs
- Provides: URL, threat type (malware_download, etc.), tags, reporter
- Map to threat type `malware`, IOC type `url`

### D.2 OpenPhish — Phishing URLs (Community Feed)

**New file:** `packages/trust-radar/src/feeds/openphish.ts`

- Endpoint: `https://openphish.com/feed.txt`
- Free, no key, plain text list of active phishing URLs
- Updated every few hours
- Map to threat type `phishing`, IOC type `url`

### D.3 Shodan InternetDB (as a feed, not just enrichment)

**New file:** `packages/trust-radar/src/feeds/shodan_internetdb.ts`

Rather than just enriching existing IPs, this feed proactively checks high-severity threat IPs from the database against Shodan InternetDB to discover open ports and vulnerabilities. Runs as a Tier 6 feed.

### D.4 Disposable Email Domains

**New file:** `packages/trust-radar/src/feeds/disposable_emails.ts`

- Endpoint: `https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf`
- Free, no key, maintained community list
- Useful for: flagging threats where the registrant email uses a disposable domain (from RDAP enrichment)
- Store as a reference list in KV, not as individual threats

### D.5 Register New Feeds in Index and Seed Migration

**File:** `packages/trust-radar/src/feeds/index.ts` — add imports

**New migration:** `packages/trust-radar/migrations/0020_new_feeds.sql`

```sql
INSERT OR IGNORE INTO feed_schedules (id, feed_name, display_name, tier, category, url, interval_mins, parser, requires_key) VALUES
  ('feed-25', 'urlhaus',          'URLhaus (abuse.ch)',    1, 'threat',     'https://urlhaus-api.abuse.ch/v1/urls/recent/limit/1000/', 15, 'json', 0),
  ('feed-26', 'openphish',        'OpenPhish Community',   2, 'threat',     'https://openphish.com/feed.txt',                          60, 'text', 0),
  ('feed-27', 'shodan_internetdb', 'Shodan InternetDB',    6, 'enrichment', 'https://internetdb.shodan.io/',                            360, 'json', 0),
  ('feed-28', 'disposable_emails', 'Disposable Emails',    6, 'reference',  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf', 1440, 'text', 0);
```

---

## Phase E — Event-Driven Agent Triggers

**Effort:** 1–2 days
**Risk:** Low
**Files:** `packages/trust-radar/src/lib/feedRunner.ts`, new `packages/trust-radar/src/lib/eventTriggers.ts`

### E.1 Event Flag System

Instead of complex event buses, use KV flags that the CRON tick checks:

**New file:** `packages/trust-radar/src/lib/eventTriggers.ts`

```typescript
import type { Env } from "../types";

export interface EventFlag {
  type: "critical_threat" | "brand_match" | "ip_cluster" | "new_campaign";
  threatId?: string;
  brandId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Queue an event for the next CRON tick to process */
export async function queueEvent(env: Env, event: EventFlag): Promise<void> {
  const key = `event:${event.type}:${Date.now()}`;
  await env.CACHE.put(key, JSON.stringify(event), { expirationTtl: 3600 }); // 1h TTL
}

/** Drain all pending events of a given type */
export async function drainEvents(env: Env, type: string): Promise<EventFlag[]> {
  const list = await env.CACHE.list({ prefix: `event:${type}:` });
  const events: EventFlag[] = [];

  for (const key of list.keys) {
    const val = await env.CACHE.get(key.name);
    if (val) {
      events.push(JSON.parse(val));
      await env.CACHE.delete(key.name);
    }
  }

  return events;
}
```

### E.2 Trigger Events During Ingestion

**File:** `packages/trust-radar/src/lib/feedRunner.ts`

In `insertThreat()`, after the INSERT, check for trigger conditions:

```typescript
export async function insertThreat(db: D1Database, threat: ThreatRow, env?: Env): Promise<void> {
  await db.prepare(/* existing INSERT */).bind(/* ... */).run();

  // Event triggers (non-blocking)
  if (env) {
    try {
      if (threat.severity === "critical") {
        await queueEvent(env, {
          type: "critical_threat",
          threatId: threat.id,
          createdAt: new Date().toISOString(),
        });
      }
      // Brand match detection is handled by the impersonation-detector agent
    } catch { /* non-fatal */ }
  }
}
```

**Note:** This requires passing `env` through to `insertThreat`. Currently only `db` is passed. Update the signature and all call sites to pass the full `env`.

### E.3 Process Events in CRON

**File:** `packages/trust-radar/src/index.ts`

After agents run, drain and process events:

```typescript
// After auto-trigger agents block:
try {
  const { drainEvents } = await import("./lib/eventTriggers");

  // Process critical threat events → create investigations
  const criticalEvents = await drainEvents(env, "critical_threat");
  if (criticalEvents.length > 0) {
    console.log(`[events] ${criticalEvents.length} critical threat events`);
    // Auto-create investigation for critical threats
    for (const evt of criticalEvents.slice(0, 10)) {
      if (evt.threatId) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO investigations (id, title, status, severity, created_by, created_at)
           SELECT ?, 'Auto: ' || title, 'open', 'critical', 'system', datetime('now')
           FROM threats WHERE id = ?`
        ).bind(crypto.randomUUID(), evt.threatId).run();
      }
    }
  }
} catch (err) {
  console.error("[events] processing error:", err);
}
```

---

## Updated CRON Pipeline (Complete)

After all phases, the CRON handler in `index.ts` becomes:

```typescript
async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil(
    runAllFeeds(env, feedModules)             // Phase A: parallel, no caps
      .then(async (r) => {
        console.log(`[cron] feeds: ${r.feedsRun} run, ${r.totalNew} new, ${r.feedsFailed} failed`);

        if (r.totalNew > 0) {
          // Phase B: Enrichment chain (GeoIP + Shodan + RDAP + DNS)
          const { enrichmentModules } = await import("./enrichment/index");
          const { runEnrichmentChain } = await import("./enrichment/runner");
          await runEnrichmentChain(env, enrichmentModules);

          // Phase C: AI-powered agents
          const { agentModules } = await import("./agents/index");
          const { executeAgent } = await import("./lib/agentRunner");
          const autoAgents = [
            "triage",                    // C.2: Haiku severity assessment
            "impersonation-detector",    // C.3: brand registry + fuzzy match + Haiku
            "threat-hunt",               // existing: cross-source correlation
            "campaign-correlator",       // existing: IP/domain clustering
            "hosting-provider-analysis", // existing: ISP aggregation
            "threat-narrator",           // C.5: Haiku human-readable descriptions
          ] as const;

          for (const name of autoAgents) {
            const mod = agentModules[name];
            if (mod) {
              const result = await executeAgent(env, mod, { newItems: r.totalNew }, "cron", "event");
              console.log(`[cron] agent ${name}: ${result.status}`);
            }
          }
        }

        // Phase E: Process event flags
        const { drainEvents } = await import("./lib/eventTriggers");
        const criticals = await drainEvents(env, "critical_threat");
        // ... create investigations for critical threats
      })
      .catch(err => console.error("[cron] pipeline error:", err))
  );
}
```

---

## Execution Order

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|-------------|
| **A** | Parallel feeds + remove slice caps + high-water marks | 1 day | None |
| **B** | Enrichment chain (Shodan, RDAP, DNS, SSL) | 2–3 days | Phase A (needs threats in DB) |
| **C** | AI agents (Triage v2, Impersonation v2, Narrator, Executive Intel v2) | 3–4 days | Phase B (enrichment data improves AI accuracy) |
| **D** | New free feeds (URLhaus, OpenPhish, Shodan feed, disposable emails) | 2 days | Phase A (parallel execution) |
| **E** | Event-driven triggers | 1–2 days | Phase C (agents produce events) |

**Total: 9–12 days** (can partially overlap with Command Center build plan)

---

## Cost Impact

| Item | Monthly Cost |
|------|-------------|
| Claude Haiku 4.5 (triage, ~288 runs/day × 10K tokens) | ~$2.50 |
| Claude Haiku 4.5 (impersonation, ~288 runs/day × 5K tokens) | ~$1.25 |
| Claude Haiku 4.5 (narrator, ~288 runs/day × 8K tokens) | ~$2.00 |
| Claude Haiku 4.5 (executive intel, 1 run/day × 15K tokens) | ~$0.01 |
| Shodan InternetDB | $0 (free) |
| RDAP/WHOIS | $0 (free protocol) |
| Cloudflare DoH DNS | $0 (free, unlimited) |
| URLhaus / OpenPhish / crt.sh | $0 (free feeds) |
| **Total additional cost** | **~$5.75/month** |

Combined with the existing $10–15/month for Railway + Cloudflare Workers + D1, the total platform cost stays under $22/month — still extremely lean for a production SOC platform with real AI analysis.

---

## New Secrets Required

```bash
cd packages/trust-radar
wrangler secret put ANTHROPIC_API_KEY
# Required for Claude Haiku agent calls
```

No other new secrets needed — all new enrichment APIs (Shodan InternetDB, RDAP, Cloudflare DoH) are free and keyless.

---

## New Files Summary

### Created
- `packages/trust-radar/src/lib/ai.ts` — Claude Haiku utility
- `packages/trust-radar/src/lib/eventTriggers.ts` — KV-based event queue
- `packages/trust-radar/src/enrichment/types.ts` — enrichment interfaces
- `packages/trust-radar/src/enrichment/index.ts` — enrichment module registry
- `packages/trust-radar/src/enrichment/runner.ts` — enrichment chain orchestrator
- `packages/trust-radar/src/enrichment/shodan.ts` — Shodan InternetDB enricher
- `packages/trust-radar/src/enrichment/rdap.ts` — RDAP/WHOIS domain age enricher
- `packages/trust-radar/src/enrichment/dns.ts` — DNS validation enricher
- `packages/trust-radar/src/feeds/urlhaus.ts` — URLhaus feed
- `packages/trust-radar/src/feeds/openphish.ts` — OpenPhish feed
- `packages/trust-radar/src/feeds/shodan_internetdb.ts` — Shodan InternetDB feed
- `packages/trust-radar/src/feeds/disposable_emails.ts` — disposable email list
- `packages/trust-radar/src/agents/threatNarrator.ts` — AI threat description agent
- `packages/trust-radar/migrations/0019_monitored_brands.sql` — brand registry table
- `packages/trust-radar/migrations/0020_new_feeds.sql` — new feed schedules

### Modified
- `packages/trust-radar/src/types.ts` — add `ANTHROPIC_API_KEY` to Env
- `packages/trust-radar/src/lib/feedRunner.ts` — parallel execution, remove caps, high-water marks, pass env to insertThreat
- `packages/trust-radar/src/feeds/index.ts` — register new feeds
- `packages/trust-radar/src/feeds/phishtank.ts` — increase cap
- `packages/trust-radar/src/feeds/threatfox.ts` — increase cap
- `packages/trust-radar/src/feeds/virustotal.ts` — increase cap
- `packages/trust-radar/src/feeds/otx.ts` — increase cap dramatically
- `packages/trust-radar/src/feeds/certstream.ts` — increase cap
- `packages/trust-radar/src/agents/index.ts` — register threat-narrator
- `packages/trust-radar/src/agents/triage.ts` — full rewrite (AI-powered)
- `packages/trust-radar/src/agents/impersonationDetector.ts` — full rewrite (brand registry + AI)
- `packages/trust-radar/src/agents/executiveIntel.ts` — full rewrite (AI briefings)
- `packages/trust-radar/src/index.ts` — updated CRON pipeline
