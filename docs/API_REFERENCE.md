# API Reference

Complete reference for the Averrow API. All authenticated endpoints require a `Bearer` token in the `Authorization` header. Base URL: `https://acerrow.com`

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/login` | — | Initiate Google OAuth login |
| GET | `/api/auth/invite` | — | Accept invite via token |
| GET | `/api/auth/callback` | — | OAuth callback handler |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/auth/logout` | Cookie | Logout and clear session |
| GET | `/api/auth/me` | User | Get current user info |

## Public Endpoints (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/heatmap` | Public threat heatmap data |
| GET | `/api/observatory/nodes` | Observatory graph nodes |
| GET | `/api/observatory/arcs` | Observatory graph arcs |
| GET | `/api/observatory/live` | Live observatory feed |
| GET | `/api/observatory/brand-arcs` | Brand-specific arcs |
| GET | `/api/observatory/stats` | Observatory statistics |
| POST | `/api/scan/public` | Public domain scan (rate-limited) |
| POST | `/api/scan/report` | Generate brand exposure report |
| POST | `/api/brand-scan/public` | Public brand exposure scan |
| GET | `/api/brand-scan/public/:id` | Get public scan results |
| GET | `/api/stats/public` | Public platform statistics |
| POST | `/api/contact` | Contact form submission |

## Public API v1

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/public/stats` | Platform statistics |
| GET | `/api/v1/public/geo` | Geographic threat distribution |
| GET | `/api/v1/public/feeds` | Feed status overview |
| POST | `/api/v1/public/assess` | Domain assessment |
| POST | `/api/v1/public/leads` | Lead capture |
| POST | `/api/v1/public/monitor` | Monitor request |
| GET | `/api/v1/public/email-security/:domain` | Public email security check |

## Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/overview` | User | Dashboard overview stats |
| GET | `/api/dashboard/top-brands` | User | Top targeted brands |
| GET | `/api/dashboard/providers` | User | Provider summary |
| GET | `/api/dashboard/stats` | User | Dashboard statistics |
| GET | `/api/dashboard/sources` | User | Threat source breakdown |
| GET | `/api/dashboard/trend` | User | Threat trend data |

## Brands

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/brands` | User | List all brands |
| GET | `/api/brands/top-targeted` | User | Top targeted brands (with trends) |
| GET | `/api/brands/monitored` | User | Monitored brands |
| GET | `/api/brands/stats` | User | Brand aggregate statistics |
| POST | `/api/brands/monitor` | User | Add brand to monitoring |
| DELETE | `/api/brands/monitor/:id` | User | Remove brand from monitoring |
| GET | `/api/brands/:id` | User | Get brand detail |
| GET | `/api/brands/:id/threats` | User | Brand's active threats |
| GET | `/api/brands/:id/threats/locations` | User | Threat geo locations |
| GET | `/api/brands/:id/threats/timeline` | User | Threat timeline |
| GET | `/api/brands/:id/providers` | User | Hosting providers for brand threats |
| GET | `/api/brands/:id/campaigns` | User | Campaigns targeting brand |
| GET | `/api/brands/:id/analysis` | User | Get AI brand analysis |
| POST | `/api/brands/:id/analysis` | User | Trigger AI brand analysis |
| POST | `/api/brands/:id/deep-scan` | User | Trigger deep scan |
| GET | `/api/brands/:id/report` | User | Generate brand report |
| POST | `/api/brands/:id/clean-false-positives` | User | Clean false positives |
| GET | `/api/brands/:id/safe-domains` | User | List safe/owned domains |
| POST | `/api/brands/:id/safe-domains` | User | Add safe domain |
| POST | `/api/brands/:id/safe-domains/bulk` | User | Bulk add safe domains |
| DELETE | `/api/brands/:id/safe-domains/:domainId` | User | Remove safe domain |

## Brand Profiles (DEPRECATED)

> These endpoints support the social monitoring system. They will be replaced when social data is unified with the core brand model.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/brand-profiles` | User | Create brand profile |
| GET | `/api/brand-profiles` | User | List brand profiles |
| GET | `/api/brand-profiles/:id` | User | Get brand profile |
| PATCH | `/api/brand-profiles/:id` | User | Update brand profile |
| DELETE | `/api/brand-profiles/:id` | User | Delete brand profile |
| POST | `/api/brand-profiles/:id/handles` | User | Update official handles |
| GET | `/api/brand-profiles/:id/handles` | User | Get official handles |

## Social Monitoring

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/social/monitor` | User | Social monitoring overview (all brands) |
| GET | `/api/social/monitor/:brandId` | User | Brand-specific monitoring results |
| GET | `/api/social/alerts` | User | Active impersonation alerts |
| POST | `/api/social/scan/:brandId` | User | Trigger immediate social scan |

## Threats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/threats` | User | List threats (filterable) |
| GET | `/api/threats/stats` | User | Threat statistics |
| GET | `/api/threats/recent` | User | Recent threats |
| GET | `/api/threats/correlations` | User | Threat correlations |
| GET | `/api/threats/geo-clusters` | User | Geographic clusters |
| GET | `/api/threats/attack-flows` | User | Attack flow visualization |
| GET | `/api/threats/:id` | User | Get threat detail |
| PATCH | `/api/threats/:id` | User | Update threat status |
| POST | `/api/threats/enrich-geo` | Admin | Enrich threats with geo data |
| POST | `/api/threats/enrich-all` | Admin | Full enrichment run |

## Feeds

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/feeds` | User | List threat feeds |
| GET | `/api/feeds/stats` | User | Feed statistics |
| GET | `/api/feeds/jobs` | User | Recent feed jobs |
| GET | `/api/feeds/quota` | User | API quota status |
| GET | `/api/feeds/:id` | User | Get feed detail |
| PATCH | `/api/feeds/:id` | Admin | Update feed config |
| POST | `/api/feeds/:id/trigger` | Admin | Trigger single feed |
| POST | `/api/feeds/:id/reset` | Admin | Reset feed state |
| POST | `/api/feeds` | Admin | Create feed |
| DELETE | `/api/feeds/:id` | Admin | Delete feed |
| POST | `/api/feeds/trigger-all` | Admin | Trigger all feeds |
| POST | `/api/feeds/trigger-tier/:tier` | Admin | Trigger feeds by tier |

## AI Agents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents` | User | List all agents |
| GET | `/api/agents/stats` | User | Agent statistics |
| GET | `/api/agents/runs` | User | Recent agent runs |
| GET | `/api/agents/outputs` | User | Recent agent outputs |
| GET | `/api/agents/approvals` | User | Pending approvals |
| GET | `/api/agents/:name` | User | Get agent detail |
| GET | `/api/agents/:name/outputs` | User | Agent-specific outputs |
| GET | `/api/agents/:name/health` | User | Agent health status |
| POST | `/api/agents/trigger-all` | Admin | Trigger all agents |
| POST | `/api/agents/:name/trigger` | Admin | Trigger specific agent |
| POST | `/api/agents/approvals/:id/resolve` | Admin | Resolve approval |
| GET | `/api/admin/agents/api-usage` | Admin | AI API usage stats |
| GET | `/api/admin/agents/config` | Admin | Agent configuration |

## Trustbot

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/trustbot/chat` | User | Chat with threat intelligence copilot |

## Briefings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/briefings` | User | List briefings |
| GET | `/api/briefings/history` | User | Briefing history |
| GET | `/api/briefings/:id` | User | Get briefing detail |
| POST | `/api/briefings/generate` | Admin | Generate new briefing |

## Campaigns

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/campaigns` | User | List campaign clusters |
| GET | `/api/campaigns/stats` | User | Campaign statistics |
| GET | `/api/campaigns/:id` | User | Get campaign detail |
| GET | `/api/campaigns/:id/threats` | User | Campaign threats |
| GET | `/api/campaigns/:id/infrastructure` | User | Campaign infrastructure |
| GET | `/api/campaigns/:id/brands` | User | Brands targeted by campaign |
| GET | `/api/campaigns/:id/timeline` | User | Campaign timeline |

## Geopolitical Campaigns

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/campaigns/geo` | User | List geopolitical campaigns (optional `?status=active`) |
| GET | `/api/campaigns/geo/:slug` | User | Get geopolitical campaign by slug |
| GET | `/api/campaigns/geo/:slug/stats` | User | Live aggregate stats (total threats, 24h, 7d, brands, IPs, domains) |
| GET | `/api/campaigns/geo/:slug/threats` | User | Threats from adversary countries/ASNs (paginated) |
| GET | `/api/campaigns/geo/:slug/timeline` | User | Daily attack timeline with type breakdown |
| GET | `/api/campaigns/geo/:slug/brands` | User | Targeted brands heat map data |
| GET | `/api/campaigns/geo/:slug/asns` | User | ASN cluster analysis (marks known adversary ASNs) |
| GET | `/api/campaigns/geo/:slug/attack-types` | User | Attack type breakdown with severity counts |

## Providers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/providers` | User | List hosting providers |
| GET | `/api/providers/stats` | User | Provider statistics |
| GET | `/api/providers/worst` | User | Worst providers (most threats) |
| GET | `/api/providers/improving` | User | Improving providers |
| GET | `/api/providers/:id` | User | Get provider detail |
| GET | `/api/providers/:id/threats` | User | Provider's threats |
| GET | `/api/providers/:id/brands` | User | Brands affected by provider |
| GET | `/api/providers/:id/timeline` | User | Provider timeline |
| GET | `/api/providers/:id/locations` | User | Provider locations |

## Email Security

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/email-security/stats` | User | Email security statistics |
| GET | `/api/email-security/scan-all` | Admin | Scan all monitored brands |
| GET | `/api/email-security/:brandId` | User | Get brand email security posture |
| POST | `/api/email-security/scan/:brandId` | User | Trigger email security scan |

## DMARC Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dmarc-reports/overview` | User | DMARC overview |
| GET | `/api/dmarc-reports/:brandId` | User | Brand DMARC reports |
| GET | `/api/dmarc-reports/:brandId/stats` | User | Brand DMARC statistics |
| GET | `/api/dmarc-reports/:brandId/sources` | User | DMARC sending sources |

## Lookalike Domains

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/lookalikes/:brandId` | User | List lookalike domains |
| POST | `/api/lookalikes/:brandId/generate` | User | Generate domain permutations |
| POST | `/api/lookalikes/:brandId/scan` | User | Scan lookalike domains |
| PATCH | `/api/lookalikes/:id` | User | Update lookalike status |

## Certificate Transparency

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ct/certificates/:brandId` | User | List CT certificates |
| GET | `/api/ct/certificates/:brandId/stats` | User | CT statistics |
| POST | `/api/ct/scan/:brandId` | User | Trigger CT scan |
| PATCH | `/api/ct/certificates/:id` | User | Update certificate status |

## Threat Narratives

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/narratives/:brandId` | User | List narratives for brand |
| GET | `/api/narratives/:brandId/:id` | User | Get narrative detail |
| POST | `/api/narratives/:brandId/generate` | User | Generate AI narrative |
| PATCH | `/api/narratives/:id` | User | Update narrative |

## Threat Assessment

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/brand/:brandId/threat-assessment` | User | Brand threat assessment |
| GET | `/api/brand/:brandId/threat-assessment/history` | User | Assessment history |
| GET | `/api/threat-feeds/stats` | User | Threat feed statistics |

## Alerts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/alerts` | User | List alerts |
| GET | `/api/alerts/stats` | User | Alert statistics |
| GET | `/api/alerts/:id` | User | Get alert detail |
| PATCH | `/api/alerts/:id` | User | Update alert status |

## Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | User | List notifications |
| GET | `/api/notifications/unread-count` | User | Unread count |
| GET | `/api/notifications/preferences` | User | Notification preferences |
| PUT | `/api/notifications/preferences` | User | Update preferences |
| POST | `/api/notifications/:id/read` | User | Mark as read |
| POST | `/api/notifications/read-all` | User | Mark all as read |

## Trends

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/trends/volume` | User | Threat volume over time |
| GET | `/api/trends/types` | User | Threat type breakdown |
| GET | `/api/trends/brands` | User | Brand trend data |
| GET | `/api/trends/providers` | User | Provider trends |
| GET | `/api/trends/tlds` | User | TLD trends |
| GET | `/api/trends/compare` | User | Compare periods |
| GET | `/api/trends/intelligence` | User | Observer intelligence insights |
| GET | `/api/trends/threat-volume` | User | Threat volume by type over time window |
| GET | `/api/trends/brand-momentum` | User | Brand threat momentum (week-over-week) |
| GET | `/api/trends/provider-momentum` | User | Hosting provider momentum (7d/30d) |
| GET | `/api/trends/nexus-active` | User | Active accelerating Nexus clusters |

## Insights

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/insights/latest` | User | Latest AI insights |

## Signals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/signals` | User | List signals |
| POST | `/api/signals` | Admin | Create signal |

## Scans

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/scan` | User | Trigger scan |
| GET | `/api/scan/history` | User | Scan history |
| POST | `/api/brand-scan` | User | Brand exposure scan |
| GET | `/api/brand-scan/history` | User | Brand scan history |
| POST | `/api/snapshots/generate` | Admin | Generate threat snapshot |

## Investigations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tickets` | User | List investigation tickets |
| GET | `/api/tickets/:id` | User | Get ticket detail |
| POST | `/api/tickets` | User | Create ticket |
| PATCH | `/api/tickets/:id` | User | Update ticket |
| POST | `/api/tickets/:id/evidence` | User | Attach evidence |
| GET | `/api/erasures` | User | List erasure/takedown requests |
| POST | `/api/erasures` | User | Create erasure request |
| PATCH | `/api/erasures/:id` | User | Update erasure status |

## Intel

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/breaches` | User | Breach check data |
| GET | `/api/ato-events` | User | Account takeover events |
| PATCH | `/api/ato-events/:id` | User | Update ATO event |
| GET | `/api/email-auth` | User | Email auth reports |
| GET | `/api/cloud-incidents` | User | Cloud security incidents |
| GET | `/api/trust-scores` | User | Trust score history |
| GET | `/api/social-iocs` | User | Social IOCs |

## Spam Trap

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/spam-trap/stats` | User | Spam trap statistics |
| GET | `/api/spam-trap/captures` | User | Captured phishing emails |
| GET | `/api/spam-trap/captures/brand/:brandId` | User | Brand-specific captures |
| GET | `/api/spam-trap/sources` | User | Spam sources |
| GET | `/api/spam-trap/campaigns` | User | Seed campaigns |
| POST | `/api/spam-trap/campaigns` | Admin | Create seed campaign |
| POST | `/api/spam-trap/campaigns/:id/execute` | Admin | Execute seed campaign |
| PUT | `/api/spam-trap/campaigns/:id` | Admin | Update seed campaign |
| GET | `/api/spam-trap/addresses` | User | Trap addresses |
| POST | `/api/spam-trap/seed/initial` | Admin | Initial trap seeding |
| POST | `/api/spam-trap/strategist/run` | Admin | Run seed strategist |

## Data Export

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/export/scans` | User | Export scan data |
| GET | `/api/export/signals` | User | Export signals |
| GET | `/api/export/alerts` | User | Export alerts |
| GET | `/api/export/stix/:brandId` | User | STIX bundle export |
| GET | `/api/export/stix/:brandId/indicators` | User | STIX indicators only |

## Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/stats` | Admin | Platform statistics |
| GET | `/api/admin/health` | Admin | System health |
| GET | `/api/admin/users` | Admin | List users |
| PATCH | `/api/admin/users/:id` | Admin | Update user |
| GET | `/api/admin/sessions` | Admin | Active sessions |
| POST | `/api/admin/users/:id/force-logout` | Admin | Force logout user |
| GET | `/api/admin/invites` | Admin | List invites |
| POST | `/api/admin/invites` | Admin | Create invite |
| DELETE | `/api/admin/invites/:id` | Admin | Revoke invite |
| GET | `/api/admin/audit` | Admin | Audit log |
| GET | `/api/admin/audit/export` | Admin | Export audit log |
| GET | `/api/admin/brands` | Admin | List all brands (admin) |
| POST | `/api/admin/brands/bulk-monitor` | Admin | Bulk add brands |
| POST | `/api/admin/brands/bulk-delete` | Admin | Bulk delete brands |
| GET | `/api/admin/sales-leads` | Admin | List sales leads |
| GET | `/api/admin/sales-leads/stats` | Admin | Lead statistics |
| GET | `/api/admin/sales-leads/:id` | Admin | Get lead detail |
| PATCH | `/api/admin/sales-leads/:id` | Admin | Update lead |
| POST | `/api/admin/sales-leads/:id/approve` | Admin | Approve lead |
| POST | `/api/admin/sales-leads/:id/send` | Admin | Send outreach |
| POST | `/api/admin/sales-leads/:id/respond` | Admin | Record response |
| POST | `/api/admin/sales-leads/:id/book` | Admin | Book demo |
| POST | `/api/admin/sales-leads/:id/convert` | Admin | Convert to customer |
| POST | `/api/admin/sales-leads/:id/decline` | Admin | Decline lead |
| DELETE | `/api/admin/sales-leads/:id` | Admin | Delete lead |
| GET | `/api/admin/sales-leads/:id/activity` | Admin | Lead activity log |
| POST | `/api/admin/backfill-classifications` | SuperAdmin | Backfill threat classifications |
| POST | `/api/admin/backfill-saas-techniques` | Admin | Backfill SaaS attack technique classification (PushSecurity taxonomy) |
| POST | `/api/admin/backfill-geo` | SuperAdmin | Backfill geo enrichment |
| POST | `/api/admin/backfill-domain-geo` | Admin | Resolve malicious domains → IP → geo + hosting provider (Cloudflare DoH, 500/call) |
| POST | `/api/admin/backfill-brand-match` | SuperAdmin | Backfill brand matching |
| POST | `/api/admin/backfill-brand-enrichment` | Admin | Populate brand logo_url, website_url, hq_lat/lng/country via Clearbit + DNS + ipapi (50/call) |
| POST | `/api/admin/backfill-safe-domains` | SuperAdmin | Backfill safe domains |
| POST | `/api/admin/backfill-ai-attribution` | SuperAdmin | Backfill AI attribution |
| POST | `/api/admin/import-tranco` | SuperAdmin | Import Tranco top sites |
| POST | `/api/admin/honeypot/generate` | SuperAdmin | Generate honeypot sites |

## WebSocket

| Path | Auth | Description |
|------|------|-------------|
| `/ws/threats` | User | Real-time threat push (Durable Object) |

## Corporate Site Pages

These are server-rendered HTML pages (not API endpoints):

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/platform` | Platform overview |
| `/about` | About page |
| `/pricing` | Pricing page |
| `/security` | Security page |
| `/blog` | Blog index |
| `/blog/email-security-posture-brand-defense` | Blog post |
| `/blog/cost-brand-impersonation-mid-market` | Blog post |
| `/blog/ai-powered-threat-narratives` | Blog post |
| `/blog/lookalike-domains-threat-hiding` | Blog post |
| `/changelog` | Changelog |
| `/contact` | Contact page |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/scan` | Public scan page |
| `/scan/:id` | Scan result page |
| `/assess` | Brand assessment (POST) |
| `/assess/:id/results` | Assessment results |

## Response Format

All API endpoints return JSON in this format:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Rate Limiting

Public endpoints are rate-limited using KV-based counters:

| Endpoint Type | Limit |
|--------------|-------|
| Auth endpoints | 10 req/min |
| Public scans | 5 req/min |
| General API | 60 req/min |

Rate limit headers are included in responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
