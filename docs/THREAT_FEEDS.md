# Threat Feed Integrations

Trust Radar ingests threat intelligence from 37+ external feeds across 4 categories: ingest, enrichment, social, and internal. This document covers the feed architecture, individual integrations, and operational patterns.

> **Last verified:** March 2026 — documented from source code in `packages/trust-radar/src/feeds/`

## Source Files

- **Feed modules:** `packages/trust-radar/src/feeds/`
- **Feed runner:** `packages/trust-radar/src/lib/feedRunner.ts`
- **Feed types:** `packages/trust-radar/src/feeds/types.ts`
- **Feed registry:** `packages/trust-radar/src/feeds/index.ts`
- **Scoring logic:** `packages/trust-radar/src/lib/threatScoring.ts`

## Feed Module Interface

Every feed implements the `FeedModule` interface:

```typescript
interface FeedModule {
  ingest(ctx: FeedContext): Promise<FeedResult>;
}

interface FeedResult {
  itemsFetched: number;
  itemsNew: number;
  itemsDuplicate: number;
  itemsError: number;
}
```

## Feed Ingestion Pipeline

1. **Cron trigger** — Worker `scheduled` handler fires on configured interval
2. **Feed selection** — `runAllFeeds()` reads `feed_configs` to determine which feeds are due
3. **Per-feed execution** — Each module's `ingest()` function is called
4. **IOC deduplication** — KV check (`dedup:{type}:{value}`, 24h TTL) + DB `INSERT OR IGNORE`
5. **Brand matching** — Rule-based detection links threats to monitored brands
6. **Scoring** — Confidence and severity via heuristics
7. **History logging** — Results in `feed_pull_history`
8. **Status update** — `feed_status` updated with health info

### Deduplication

Two-layer dedup prevents duplicates:

1. **KV cache** — `dedup:{iocType}:{iocValue}` with 24h TTL
2. **Database** — `INSERT OR IGNORE` using deterministic `threatId(source, iocType, iocValue)`

### Threat Classification Types

```
phishing | typosquatting | impersonation | malware_distribution |
credential_harvesting | c2 | c2_infrastructure | scanning |
malicious_ip | botnet | malicious_ssl
```

### Severity Levels

```
critical (highest) → high → medium → low → info
```

---

## Ingest Feeds (24 feeds)

These create new threat records in the `threats` table.

### Phishing Feeds

| Feed | File | Source | Auth | Per Run | Threat Type |
|------|------|--------|------|---------|-------------|
| **PhishTank** | `phishtank.ts` | data.phishtank.com | None | 2,000 URLs | phishing |
| **OpenPhish** | `openphish.ts` | Plaintext feed | None | 2,000 URLs | phishing |
| **PhishDestroy** | `phishdestroy.ts` | GitHub destroylist | None | 5,000 domains | phishing |

**PhishTank** — Community-verified phishing URLs. Confidence: 95 (verified), 70 (unverified). Includes content-type guard to reject JPEG captcha pages.

**OpenPhish** — Machine-detected phishing URLs from automated crawlers.

**PhishDestroy** — Curated phishing and scam domain blocklist from GitHub.

### Malware & C2 Feeds

| Feed | File | Source | Auth | Per Run | Threat Type |
|------|------|--------|------|---------|-------------|
| **URLhaus** | `urlhaus.ts` | abuse.ch | None | 1,000 URLs | malware_distribution |
| **ThreatFox** | `threatfox.ts` | abuse.ch API | `ABUSECH_AUTH_KEY` | 500 IOCs | c2, malware_distribution |
| **Feodo** | `feodo.ts` | abuse.ch | None | All IPs | malware_distribution |
| **MalwareBazaar** | `malwarebazaar.ts` | abuse.ch API | `ABUSECH_AUTH_KEY` | 100 samples | malware_distribution |
| **SSL Blacklist** | `sslbl.ts` | abuse.ch | None | 500 certs | c2, botnet, malicious_ssl |
| **C2 Tracker** | `c2tracker.ts` | GitHub montysecurity | None | 500 IPs | c2 |
| **C2IntelFeeds** | `c2intelfeeds.ts` | GitHub drb-ra | None | 300 items | c2_infrastructure |

**URLhaus** — Active malware distribution URLs. CSV parsing with status tracking (online/down affects severity).

**ThreatFox** — Diverse IOCs (domains, URLs, IPs, hashes) with confidence-to-severity mapping.

**Feodo** — Botnet C2 server IPs from Feodo Tracker. Severity: high, confidence: 90.

**MalwareBazaar** — Recent malware samples filtered to those with delivery URLs.

**SSL Blacklist** — Malicious SSL certificate SHA1 hashes + associated IPs. Classifies by reason string.

**C2 Tracker** — C2 IPs across 6 frameworks: Cobalt Strike, Sliver, Brute Ratel, Metasploit, Posh C2, Havoc. Severity: critical, confidence: 95.

**C2IntelFeeds** — C2 IPs and domains with 30-day rolling windows. Severity: critical, confidence: 90.

### IP Blocklist Feeds

| Feed | File | Source | Auth | Per Run | Threat Type |
|------|------|--------|------|---------|-------------|
| **Blocklist.de** | `blocklistde.ts` | blocklist.de | None | 500 new IPs | malicious_ip |
| **CINS Army** | `cins_army.ts` | cinsscore.com | None | 200 sampled | malicious_ip |
| **DShield** | `dshield.ts` | SANS ISC API | None | Top 100 | scanning |
| **Emerging Threats** | `emergingThreats.ts` | Proofpoint rules | None | 500 IPs | malicious_ip |
| **Spamhaus DROP** | `spamhausDrop.ts` | Spamhaus | None | All CIDRs | malicious_ip |
| **Tor Exit Nodes** | `torExitNodes.ts` | torproject.org | None | All nodes | Reference only |

**Blocklist.de** — Community IP blocklist (~20K IPs). KV dedup cache with 24h TTL. Updated every 12 hours.

**CINS Army** — Honeypot-verified attacker IPs. Random samples 200 from full list daily.

**DShield** — Top 100 attacking IPs from SANS ISC honeypots. Dual mode: enriches existing IPs (confidence boost to 85+) and creates new scanning records.

**Emerging Threats** — Proofpoint-curated compromised IPs. Severity: medium, confidence: 75.

**Spamhaus DROP** — Hijacked network CIDR blocks. Cross-references existing threat IPs within DROP ranges. Severity: high, confidence: 98.

**Tor Exit Nodes** — Maintains `tor_exit_nodes` reference table. Tags existing threats from Tor but does NOT create threat records (legitimate infrastructure).

### Domain & Certificate Feeds

| Feed | File | Source | Auth | Per Run | Threat Type |
|------|------|--------|------|---------|-------------|
| **CertStream** | `certstream.ts` | crt.sh REST API | None | Rotating keywords | typosquatting, phishing |
| **NRD Hagezi** | `nrd_hagezi.ts` | whoisds.com | None | All NRDs | typosquatting |
| **Typosquat Scanner** | `typosquat_scanner.ts` | Generated + CF DoH | None | 500 DNS checks | typosquatting |
| **Disposable Email** | `disposableEmail.ts` | GitHub blocklist | None | ~3,500 domains | Reference only |

**CertStream** — Queries crt.sh for recently-issued certificates matching brand keywords. Rotates through keywords every 15-minute window. Includes homoglyph variant detection and phishing pattern scoring.

**NRD Hagezi** — Newly registered domains (50K-180K per day). ZIP extraction, brand matching with homoglyph detection. Stores in `nrd_references` table.

**Typosquat Scanner** — Generates domain variants (6 types: omission, swap, duplication, substitution, TLD variants, combosquatting) and checks DNS via Cloudflare DoH. 5 brands per run, ~7-day full cycle.

**Disposable Email** — Loads ~3,500 throwaway email domains into reference table. Exports `isDisposableEmail()` for cross-referencing. Weekly reload.

### Intelligence Feeds

| Feed | File | Source | Auth | Per Run | Type |
|------|------|--------|------|---------|------|
| **OTX AlienVault** | `otx_alienvault.ts` | AlienVault API | `OTX_API_KEY` | 200 indicators | phishing, c2, malware |
| **CISA KEV** | `cisa_kev.ts` | CISA JSON feed | None | Top 50 CVEs | Intelligence |
| **Cloudflare Email** | `cloudflare_email.ts` | CF Radar API | `CF_API_TOKEN` | 4 endpoints | Intelligence |

**OTX AlienVault** — Recent pulse data with domains, URLs, IPs tagged by threat type. Uses 24h lookback filter.

**CISA KEV** — Top 50 recently known exploited vulnerabilities. Tracks ransomware campaign usage. Stored as `agent_output` insights for Observer.

**Cloudflare Email** — Daily email threat summaries (spam %, spoof %, malicious %). Stored in KV for Trends tab.

### Cloudflare Scanning

| Feed | File | Source | Auth | Per Run | Type |
|------|------|--------|------|---------|------|
| **CF URL Scanner** | `cloudflare_scanner.ts` | CF URL Scanner API | `CF_ACCOUNT_ID`, `CF_API_TOKEN` | 50 submit + 100 collect | Enrichment |

**Cloudflare URL Scanner** — Two-phase operation: submits unscanned URLs (prioritized: brand-matched > phishing > typosquat > C2) then collects verdicts. Auto-remediation marks clean URLs as "remediated".

---

## Enrichment Feeds (9 feeds)

These add metadata to existing threats without creating new records. See [ENRICHMENT_PIPELINE.md](./ENRICHMENT_PIPELINE.md) for detailed documentation.

| Feed | File | Auth | Rate Limit | Targets |
|------|------|------|------------|---------|
| **VirusTotal** | `virustotal.ts` | `VIRUSTOTAL_API_KEY` | 4 req/min, 500/day | High/critical domains |
| **Google Safe Browsing** | `googleSafeBrowsing.ts` | `GOOGLE_SAFE_BROWSING_KEY` | 100 URLs/run | Unchecked URLs (7d) |
| **SURBL** | `surbl.ts` | None (DNS) | 50 lookups/run | Unchecked domains (7d) |
| **Spamhaus DBL** | `spamhausDbl.ts` | None (DNS) | 50 lookups/run | Unchecked domains (7d) |
| **AbuseIPDB** | `abuseipdb.ts` | `ABUSEIPDB_API_KEY` | 1,000/day | IPs (7d), by severity |
| **GreyNoise** | `greynoise.ts` | `GREYNOISE_API_KEY` | 50/day | High/critical IPs |
| **CIRCL Passive DNS** | `circlPassiveDns.ts` | `CIRCL_PDNS_USER/PASS` | 10/2hr run | High/critical domains |
| **SecLookup** | `seclookup.ts` | `SECLOOKUP_API_KEY` | 1M/month | Unchecked domains/IPs |
| **HIBP Stealer Logs** | `hibp.ts` | `HIBP_API_KEY` | 1 req/1.5s | Monitored brand domains |

---

## Social Feeds (4 feeds)

These monitor social platforms for brand mentions and store results in `social_mentions`.

| Feed | File | Auth | Per Run | Delay |
|------|------|------|---------|-------|
| **Reddit** | `reddit.ts` | `REDDIT_CLIENT_ID/SECRET` | 10 brands, 50 API calls | 1s between calls |
| **GitHub** | `github.ts` | `GITHUB_FEED_TOKEN` | 10 brands, 25 searches | 3s between calls |
| **Mastodon** | `mastodon.ts` | None (public) | 10 brands, 80 API calls | 1.5s between calls |
| **Telegram** | `telegram.ts` | `TELEGRAM_BOT_TOKEN` (opt) | 4 channels | Per message |

**Reddit** — Monitors security subreddits (cybersecurity, netsec, phishing, Scams, hacking) plus general search. OAuth2 with 55-min token caching. Brand rotation via KV offset counter.

**GitHub** — Code leak detection (credentials, API keys, configs) and security advisory monitoring. Two search types per brand: domain references + credential patterns.

**Mastodon** — Monitors 4 instances (mastodon.social, infosec.exchange, ioc.exchange, hachyderm.io). Searches brand names plus scans local timelines on security instances.

**Telegram** — Monitors channels for credential leaks, phishing kits, carding, ransomware. Two modes: Bot API (preferred) or web preview fallback. Default channels: breaborat, daborat, phlocker, cyberthreatintel.

---

## Authentication Requirements

| Environment Variable | Feeds Using It |
|---------------------|----------------|
| `ABUSECH_AUTH_KEY` | ThreatFox, MalwareBazaar |
| `VIRUSTOTAL_API_KEY` | VirusTotal |
| `GOOGLE_SAFE_BROWSING_KEY` | Google Safe Browsing |
| `ABUSEIPDB_API_KEY` | AbuseIPDB |
| `GREYNOISE_API_KEY` | GreyNoise |
| `SECLOOKUP_API_KEY` | SecLookup |
| `CIRCL_PDNS_USER` / `CIRCL_PDNS_PASS` | CIRCL Passive DNS |
| `HIBP_API_KEY` | HIBP Stealer Logs |
| `OTX_API_KEY` | OTX AlienVault |
| `CF_ACCOUNT_ID` / `CF_API_TOKEN` | Cloudflare Scanner, Cloudflare Email |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Reddit |
| `GITHUB_FEED_TOKEN` | GitHub |
| `TELEGRAM_BOT_TOKEN` | Telegram (optional) |

All secrets are stored as Cloudflare Worker secrets via `wrangler secret put`. Feeds gracefully degrade when optional secrets are missing.

---

## Rate Limit Management

| Strategy | Feeds |
|----------|-------|
| **KV daily counters** | VirusTotal (`vt_daily_calls_{date}`), AbuseIPDB (`abuseipdb_daily_{date}`), GreyNoise (`greynoise_daily_{date}`) |
| **KV monthly counters** | SecLookup (`seclookup_monthly_{year}_{month}`) |
| **Time delays** | Reddit (1s), GitHub (3s), Mastodon (1.5s), HIBP (1.5s) |
| **Batch limits** | All feeds cap items per run (see tables above) |
| **KV dedup cache** | Blocklist.de, Disposable Email (24h TTL) |

---

## Circuit Breaker Pattern

The feed runner implements a circuit breaker tracked in `feed_status`:

| State | Behavior |
|-------|----------|
| **Closed** (normal) | Feed runs normally |
| **Open** (tripped) | Feed skipped after repeated failures |
| **Half-open** | One test request after cooldown |

- Consecutive failures increment a counter
- After threshold (3-5 failures), circuit opens
- Admin can reset via `POST /api/feeds/:id/reset`

---

## Feed API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/feeds` | User | List all feeds with status |
| GET | `/api/feeds/overview` | User | Feeds overview dashboard |
| GET | `/api/feeds/stats` | User | Feed statistics |
| GET | `/api/feeds/aggregate-stats` | User | Aggregated stats |
| GET | `/api/feeds/jobs` | User | Recent jobs |
| GET | `/api/feeds/quota` | User | Quota usage |
| GET | `/api/feeds/:id` | User | Feed detail |
| GET | `/api/feeds/:id/history` | User | Pull history |
| PATCH | `/api/feeds/:id` | Admin | Update config |
| POST | `/api/feeds/:id/trigger` | Admin | Manual trigger |
| POST | `/api/feeds/:id/reset` | Admin | Reset circuit breaker |
| POST | `/api/feeds/trigger-all` | Admin | Trigger all feeds |
| POST | `/api/feeds/trigger-tier/:tier` | Admin | Trigger by tier |

---

## Archived Feeds

Legacy feed modules in `packages/trust-radar/src/feeds/_archive/` are no longer active but preserved for reference:

abuseipdb, bgpstream, blocklist_de, cf_radar, cisa_kev, cloud_status, disposableemails, greynoise, ipqs, ipsum, malbazaar, mastodon_ioc, otx, ransomwatch, safebrowsing, sans_isc, spamhaus, sslbl, tor_exits, tweetfeed, virustotal
