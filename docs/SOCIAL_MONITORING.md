# Social Brand Monitoring

> **Status: Implemented — Integration Overhaul Pending**
>
> Social monitoring is live with handle checking, permutation scanning, and
> impersonation scoring across 6 platforms. A 5-phase integration plan
> (see `docs/plans/`) will unify social data with the core brand model.

## Current Implementation

### What Works Today

- **Handle availability checking** — HEAD requests to 6 platforms to verify if a brand's handles are registered
- **Permutation scanning** — Generates typosquatting, prefix/suffix, and separator variants of brand names; checks each across platforms
- **Impersonation scoring** — Algorithmic scoring based on name similarity (Levenshtein), keyword presence, handle permutation match, verification status
- **Alert generation** — HIGH/CRITICAL impersonation detections create alerts
- **Cron scheduling** — Batch monitoring runs every 6 hours for brands with configured schedules
- **On-demand scanning** — Manual scan trigger per brand via API
- **SPA integration** — Social Monitor view in the authenticated dashboard (`/social`) with brand coverage, active alerts, and add-brand tabs

### Supported Platforms

| Platform | URL Pattern | Check Method |
|----------|------------|--------------|
| Twitter/X | `x.com/{handle}` | HEAD request |
| LinkedIn | `linkedin.com/company/{handle}` | HEAD request |
| Instagram | `instagram.com/{handle}/` | HEAD request |
| TikTok | `tiktok.com/@{handle}` | HEAD request |
| GitHub | `github.com/{handle}` | HEAD request |
| YouTube | `youtube.com/@{handle}` | HEAD request |

### Architecture

```
Brand added with official_handles
│
├─→ Generate handle permutations (typosquatting, prefix/suffix, separators)
│
├─→ Check each permutation × platform via HEAD request
│
├─→ Score impersonation risk (algorithmic: Levenshtein + signals)
│
└─→ Create alerts for HIGH/CRITICAL detections
```

### Key Files

| File | Purpose |
|------|---------|
| `src/scanners/social-monitor.ts` | Main scanner — single-brand and batch monitoring |
| `src/scanners/impersonation-scorer.ts` | Algorithmic impersonation risk scoring |
| `src/lib/social-check.ts` | Platform availability checking (HEAD requests) |
| `src/lib/handle-permutations.ts` | Handle variant generation |
| `src/handlers/socialMonitor.ts` | API handlers for social monitoring endpoints |
| `src/handlers/brandProfiles.ts` | Brand profile CRUD (DEPRECATED — see integration plan) |
| `src/agents/sentinel.ts` | AI assessment of HIGH/CRITICAL social findings |
| `migrations/0030_social_monitoring.sql` | DB schema for brand_profiles, social_monitor_results, social_monitor_schedule |
| `migrations/0035_social_ai_assessment.sql` | AI assessment columns (ai_confidence, ai_action, ai_evidence_draft) |

### Known Limitations (Pre-Integration)

1. **Disconnected data model** — Social monitoring uses `brand_profiles` table (separate from core `brands` table). No cross-referencing with threat intel, campaigns, or AI agents.
2. **No website scraping** — Social handles must be manually entered. No auto-discovery from brand websites.
3. **No profile content analysis** — Only checks if handles exist (HEAD request). Cannot see display names, bios, follower counts, or profile images.
4. **Limited agent integration** — Sentinel performs AI assessment on HIGH/CRITICAL findings. Other agents (Analyst, Prospector, Observer) have minimal or no awareness of social data.

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/social/monitor` | User | Social monitoring overview (all brands) |
| GET | `/api/social/monitor/:brandId` | User | Brand-specific monitoring results |
| GET | `/api/social/alerts` | User | Active impersonation alerts |
| POST | `/api/social/scan/:brandId` | User | Trigger immediate social scan |

### Brand Profile Endpoints (DEPRECATED)

These endpoints will be replaced when social monitoring is unified with the core brand model.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/brand-profiles` | User | Create brand profile |
| GET | `/api/brand-profiles` | User | List brand profiles |
| GET | `/api/brand-profiles/:id` | User | Get brand profile |
| PATCH | `/api/brand-profiles/:id` | User | Update brand profile |
| DELETE | `/api/brand-profiles/:id` | User | Delete brand profile |
| POST | `/api/brand-profiles/:id/handles` | User | Update official handles |
| GET | `/api/brand-profiles/:id/handles` | User | Get official handles |
