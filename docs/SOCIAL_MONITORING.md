# Social Brand Monitoring

> **Status: Planned -- Phase 3**
>
> This feature is under active design. The imprsn8 Worker (`packages/imprsn8/`) provides the foundation, but full social monitoring is not yet implemented. This document describes the planned architecture.

## Overview

Social Brand Monitoring will detect impersonation accounts, fake profiles, and brand abuse across social media platforms. It complements the existing threat intelligence pipeline (which focuses on phishing infrastructure and email security) by adding social media as a signal source.

## Planned Platforms

| Platform | Check Type | Signal Source |
|----------|-----------|---------------|
| **Twitter/X** | Handle squatting, impersonation accounts | API + scraping |
| **LinkedIn** | Fake company pages, employee impersonation | API |
| **Instagram** | Brand name squatting, fake verified accounts | API |
| **TikTok** | Brand impersonation, fake promotions | API |
| **GitHub** | Repository typosquatting, fake organizations | API |
| **YouTube** | Channel impersonation, fake brand channels | API |

## Handle Permutation Generation

The system will generate candidate impersonation handles from a brand's canonical name. Permutation strategies include:

- **Typosquatting** — Character transposition, omission, insertion (`paypa1`, `paypall`, `paypl`)
- **Homoglyphs** — Unicode lookalike substitution (Cyrillic 'a' for Latin 'a')
- **Prefix/suffix** — Common additions (`official_`, `_support`, `_help`, `real_`)
- **Separator variants** — Dots, underscores, hyphens (`pay.pal`, `pay_pal`)
- **TLD abuse** — Domain-like handles (`paypal.com.support`)
- **Keyword combinations** — Brand + action words (`paypal_verify`, `paypal_login`)

## Impersonation Signal Detection

Each social profile found will be evaluated against multiple impersonation signals:

### Profile Signals

- **Name match** — Display name matches or closely resembles the brand
- **Bio content** — Bio contains brand keywords, official-looking language
- **Profile image** — Visual similarity to official brand assets (planned)
- **Verification status** — Unverified account claiming to be official
- **Account age** — Recently created accounts are higher risk
- **Follower ratio** — Low follower count relative to claimed brand stature

### Activity Signals

- **Content patterns** — Posts about giveaways, contests, "customer support"
- **Link patterns** — Links to phishing domains or URL shorteners
- **Engagement patterns** — Replies to brand mentions offering "help"
- **DM solicitation** — Requesting users move to DMs for "support"

### Scoring

Each profile will receive an impersonation confidence score (0-100) based on weighted signal combination. Thresholds:

- **80-100** — High confidence impersonation, auto-alert
- **50-79** — Moderate confidence, human review required
- **20-49** — Low confidence, monitoring only
- **0-19** — Likely legitimate

## Monitoring Pipeline

### Planned Architecture

```
1. Brand Registration
   └─> Generate handle permutations for all platforms

2. Discovery Scan (scheduled)
   └─> Check each platform for matching handles
   └─> Evaluate impersonation signals
   └─> Score each profile

3. Alert Generation
   └─> High-confidence matches generate alerts
   └─> Medium-confidence matches queued for review

4. Continuous Monitoring
   └─> Track profile changes (name, bio, links)
   └─> Detect new impersonation accounts
   └─> Monitor takedown status

5. Reporting
   └─> Social monitoring feeds into Brand Exposure Score
   └─> Platform-specific impersonation reports
```

### Integration Points

- **Brand Exposure Score** — Social impersonation count will factor into the composite trust score
- **Threat Intelligence** — Social IOCs (malicious links from fake profiles) feed into the threat pipeline
- **AI Agents** — The Analyst agent will correlate social impersonation with phishing campaigns
- **Notifications** — New impersonation detections trigger user notifications

## imprsn8 Worker

The `packages/imprsn8/` Worker is the foundation for social brand monitoring. It has its own:

- Cloudflare Worker with D1 database
- Separate deployment pipeline (`.github/workflows/deploy-imprsn8.yml`)
- Independent wrangler configuration

Current imprsn8 capabilities are being integrated into the Trust Radar platform as part of the Phase 3 unification effort. See `TRUST_RADAR_UNIFIED_PLATFORM_PLAN.md` for the full roadmap.

## API Endpoints (Planned)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/social/monitors` | User | List social monitoring configs |
| POST | `/api/social/monitors` | Admin | Add brand to social monitoring |
| GET | `/api/social/monitors/:brandId` | User | Get monitoring status for brand |
| GET | `/api/social/detections` | User | List impersonation detections |
| GET | `/api/social/detections/:id` | User | Get detection detail |
| POST | `/api/social/detections/:id/dismiss` | Admin | Dismiss false positive |
| POST | `/api/social/detections/:id/takedown` | Admin | Initiate takedown request |
| GET | `/api/social/stats` | User | Social monitoring statistics |
