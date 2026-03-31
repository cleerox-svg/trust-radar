# Enrichment Pipeline

Trust Radar validates and enriches threats against 9 external intelligence engines. Enrichment runs as part of the feed ingestion cycle, adding metadata to existing threat records without creating new ones.

> **Last verified:** March 2026 — documented from source code in `packages/trust-radar/src/feeds/`

## Overview

Enrichment engines check threats against external reputation databases and update the `threats` table with validation results. Multiple positive hits trigger cross-feed escalation — when 3+ sources confirm a threat, it is automatically elevated to **critical** severity.

### Cross-Feed Escalation Rule

```
IF (surbl_listed OR vt_malicious >= 3 OR gsb_listed OR dbl_listed OR seclookup_risk >= 80)
   AND count_of_positive_sources >= 3
THEN severity = "critical"
```

---

## Engine Reference

### 1. VirusTotal

| Property | Value |
|----------|-------|
| **File** | `feeds/virustotal.ts` |
| **Source** | `https://www.virustotal.com/api/v3/domains/{domain}` |
| **Auth** | `VIRUSTOTAL_API_KEY` |
| **Rate Limit** | Free: 4 req/min, 500/day. Strategy: 10 domains per 30-min run = 480/day |
| **Targets** | High/critical severity threats only |
| **Budget Tracking** | KV: `vt_daily_calls_{YYYY-MM-DD}` |

**Enrichment Logic:**
- `>= 6` malicious engines → escalate to **critical**, confidence +20
- `>= 5` malicious engines → confidence +20
- `>= 3` malicious engines + SURBL hit → auto **critical**
- `< 5` malicious engines → confidence +10
- Columns updated: `vt_malicious_count`, `vt_reputation`, `vt_categories`

---

### 2. Google Safe Browsing

| Property | Value |
|----------|-------|
| **File** | `feeds/googleSafeBrowsing.ts` |
| **Source** | `https://safebrowsing.googleapis.com/v4/threatMatches:find` |
| **Auth** | `GOOGLE_SAFE_BROWSING_KEY` |
| **Rate Limit** | 100 URLs per run |
| **Targets** | Unchecked URLs/domains from last 7 days |

**Enrichment Logic:**
- `MALWARE` → severity **critical**
- `SOCIAL_ENGINEERING` → severity **high**
- `UNWANTED_SOFTWARE` / `PHA` → severity **medium**
- Cross-feed escalation: 3+ sources = auto **critical**
- Columns updated: `gsb_threat_type`, `gsb_checked_at`

---

### 3. SURBL

| Property | Value |
|----------|-------|
| **File** | `feeds/surbl.ts` |
| **Source** | Cloudflare DoH → `multi.surbl.org` |
| **Auth** | None (public DNS) |
| **Rate Limit** | 50 DNS lookups per run (Spamhaus fair use) |
| **Targets** | Unchecked domains from last 7 days |

**Enrichment Logic:**
- Bitmask decoding: `8` = phishing, `16` = malware, `64` = abused
- PH/MW → severity **high**, confidence +15
- ABUSE → severity **medium**, confidence +10
- SURBL + VT (`>= 3`) → auto **critical**
- Columns updated: `surbl_listed`, `surbl_type`, `surbl_checked_at`

---

### 4. Spamhaus DBL

| Property | Value |
|----------|-------|
| **File** | `feeds/spamhausDbl.ts` |
| **Source** | Cloudflare DoH → `dbl.spamhaus.org` |
| **Auth** | None (public DNS) |
| **Rate Limit** | 50 DNS lookups per run |
| **Targets** | Unchecked domains from last 7 days |

**Enrichment Logic:**
- Phishing/malware/botnet C2 → severity **high/critical**, confidence +15
- Spam domain → no severity escalation, confidence +5
- Columns updated: `dbl_listed`, `dbl_type`, `dbl_checked_at`

---

### 5. AbuseIPDB

| Property | Value |
|----------|-------|
| **File** | `feeds/abuseipdb.ts` |
| **Source** | `https://api.abuseipdb.com/api/v2/check` |
| **Auth** | `ABUSEIPDB_API_KEY` |
| **Rate Limit** | Free: 1,000/day. Strategy: 20 IPs per 30-min = 960/day max |
| **Targets** | IPs from last 7 days, prioritized: critical > high > medium |
| **Budget Tracking** | KV: `abuseipdb_daily_{YYYY-MM-DD}` |
| **Caching** | KV 24h TTL per IP |

**Enrichment Logic:**
- Abuse score `>= 80` → severity **critical**, confidence +20
- Abuse score `>= 50` → severity **high**, confidence +10
- Columns updated: `abuseipdb_score`, `abuseipdb_reports`, `abuseipdb_isp`, `abuseipdb_country`, `abuseipdb_checked_at`

---

### 6. GreyNoise

| Property | Value |
|----------|-------|
| **File** | `feeds/greynoise.ts` |
| **Source** | `https://api.greynoise.io/v3/community/{ip}` |
| **Auth** | `GREYNOISE_API_KEY` |
| **Rate Limit** | Community: 50/day. Strategy: 8 IPs per run x 6 runs = 48/day |
| **Targets** | High/critical severity IPs only |
| **Budget Tracking** | KV: `greynoise_daily_{YYYY-MM-DD}` |

**Enrichment Logic:**
- **RIOT** (known service) → `likely_false_positive`, severity **low**
- **Benign** scanner → downgrade medium to **low**
- **Malicious** scanner → confirm severity, confidence +10
- **Unknown/targeted** → potential directed attack (no escalation)
- Columns updated: `greynoise_classification`, `greynoise_noise`, `greynoise_riot`, `greynoise_checked_at`

---

### 7. CIRCL Passive DNS

| Property | Value |
|----------|-------|
| **File** | `feeds/circlPassiveDns.ts` |
| **Source** | `https://www.circl.lu/pdns/query/{domain}` |
| **Auth** | `CIRCL_PDNS_USER`, `CIRCL_PDNS_PASS` |
| **Rate Limit** | 10 domains per 2-hour run (conservative) |
| **Targets** | High/critical severity domains from last 7 days |
| **Status** | **DISABLED** by default (requires CIRCL credentials) |

**Enrichment Logic:**
- Stores historical DNS records (A, AAAA, MX) in `passive_dns_records`
- Detects shared hosting across threats (infrastructure correlation)
- Columns updated: `pdns_correlations`, `pdns_checked_at`

---

### 8. SecLookup

| Property | Value |
|----------|-------|
| **File** | `feeds/seclookup.ts` |
| **Source** | `https://api.seclookup.com/v1/{domain\|ip}` |
| **Auth** | `SECLOOKUP_API_KEY` |
| **Rate Limit** | Free: 1M/month (~33K/day). Strategy: 100 per run |
| **Targets** | Unchecked domains/IPs from last 7 days, all severity levels |
| **Budget Tracking** | KV: `seclookup_monthly_{year}_{month}` |

**Enrichment Logic:**
- Risk score `>= 80` → confidence +15
- Risk score `< 20` → tagged `seclookup_low_risk`
- Cross-feed escalation: 3+ sources = auto **critical**
- Columns updated: `seclookup_risk_score`, `seclookup_threat_type`, `seclookup_checked_at`

---

### 9. HIBP Stealer Logs

| Property | Value |
|----------|-------|
| **File** | `feeds/hibp.ts` |
| **Source** | `https://haveibeenpwned.com/api/v3/stealerlogsearchresult/{domain}` |
| **Auth** | `HIBP_API_KEY` (Pro subscription — paid) |
| **Rate Limit** | 1 request per 1.5 seconds |
| **Targets** | Monitored brand domains, skip if checked in last 7 days |
| **Status** | **DISABLED** by default (Pro subscription required) |

**Enrichment Logic:**
- Stores credential exposure count and latest exposure date in `stealer_log_results`
- Checks monitored brand domains for credential exposure
- Does not directly update `threats` table

---

## Enrichment Backlog Tracking

Flight Control monitors 8 enrichment backlogs every cron tick:

| Backlog Metric | Description |
|----------------|-------------|
| `surblUnchecked` | Domains not yet checked by SURBL |
| `vtUnchecked` | Domains not yet checked by VirusTotal |
| `gsbUnchecked` | URLs not yet checked by Google Safe Browsing |
| `dblUnchecked` | Domains not yet checked by Spamhaus DBL |
| `abuseipdbUnchecked` | IPs not yet checked by AbuseIPDB |
| `pdnsUnchecked` | Domains not yet checked by Passive DNS |
| `greynoiseUnchecked` | IPs not yet checked by GreyNoise |
| `seclookupUnchecked` | Domains/IPs not yet checked by SecLookup |

---

## Cost Summary

| Engine | Tier | Daily Budget | Monthly Cost |
|--------|------|-------------|--------------|
| VirusTotal | Free | 500 lookups | $0 |
| Google Safe Browsing | Free | Unlimited (batch) | $0 |
| SURBL | Free (DNS) | ~2,400 lookups | $0 |
| Spamhaus DBL | Free (DNS) | ~2,400 lookups | $0 |
| AbuseIPDB | Free | 1,000 lookups | $0 |
| GreyNoise | Community | 50 lookups | $0 |
| SecLookup | Free | ~33,000 lookups | $0 |
| CIRCL PDNS | Free (registration) | ~120 lookups | $0 |
| HIBP | Pro (paid) | N/A | ~$40/mo |
