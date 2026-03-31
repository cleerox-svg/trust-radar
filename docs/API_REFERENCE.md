# API Reference

Complete reference for the Averrow (Trust Radar) API. All authenticated endpoints require a `Bearer` token in the `Authorization` header. Base URL: `https://averrow.com`

> **Last verified:** March 2026 — 340+ endpoints documented from source code in `packages/trust-radar/src/routes/`
>
> **Auth levels:** Public (no auth), User (`requireAuth`), Admin (`requireAdmin`), SuperAdmin (`requireSuperAdmin`)

---

## 1. Authentication (7 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/login` | Rate-limited | Initiate Google OAuth login flow |
| GET | `/api/auth/invite` | Rate-limited | OAuth login for invite signup |
| GET | `/api/auth/callback` | Rate-limited | OAuth callback handler |
| POST | `/api/auth/refresh` | Rate-limited | Refresh access token |
| POST | `/api/auth/logout` | User | Logout and clear session |
| GET | `/api/auth/me` | User | Get current user profile |
| GET | `/api/invites/:token` | Public | Validate invite token |

---

## 2. Public Endpoints (13 endpoints)

No authentication required.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/dashboard/stats` | Public dashboard statistics |
| GET | `/api/dashboard/sources` | Source mix data |
| GET | `/api/dashboard/trend` | Quality trend data |
| GET | `/api/heatmap` | Threat heatmap data |
| GET | `/api/observatory/nodes` | Observatory graph nodes |
| GET | `/api/observatory/arcs` | Observatory connection arcs |
| GET | `/api/observatory/live` | Live observatory data |
| GET | `/api/observatory/brand-arcs` | Brand-specific arcs |
| GET | `/api/observatory/stats` | Observatory statistics |
| GET | `/api/observatory/operations` | Observatory operations |
| GET | `/api/signals` | Threat signals feed |
| GET | `/api/stats/public` | Public platform stats (v2) |

---

## 3. Public API v1 (7 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/public/stats` | Platform statistics |
| GET | `/api/v1/public/geo` | Geographic threat distribution |
| GET | `/api/v1/public/feeds` | Feed status overview |
| POST | `/api/v1/public/assess` | Domain assessment |
| POST | `/api/v1/public/leads` | Lead capture |
| POST | `/api/v1/public/monitor` | Monitor request |
| GET | `/api/v1/public/email-security/:domain` | Public email security check |

---

## 4. Dashboard & Analytics (3 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/overview` | User | Dashboard overview stats |
| GET | `/api/dashboard/top-brands` | User | Top targeted brands |
| GET | `/api/dashboard/providers` | User | Provider intelligence |

---

## 5. Brands (32 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/brands` | User | List all brands |
| GET | `/api/brands/top-targeted` | User | Top targeted brands (with trends) |
| GET | `/api/brands/monitored` | User | Monitored brands |
| GET | `/api/brands/stats` | User | Brand statistics |
| POST | `/api/brands/monitor` | Admin | Add brand to monitoring |
| DELETE | `/api/brands/monitor/:id` | Admin | Remove from monitoring |
| GET | `/api/brands/:id` | User | Brand detail |
| GET | `/api/brands/:id/threats` | User | Brand's active threats |
| GET | `/api/brands/:id/threats/locations` | User | Threat geographic locations |
| GET | `/api/brands/:id/threats/timeline` | User | Threat timeline |
| GET | `/api/brands/:id/providers` | User | Hosting providers for brand threats |
| GET | `/api/brands/:id/campaigns` | User | Campaigns targeting brand |
| GET | `/api/brands/:id/analysis` | User | AI brand analysis report |
| POST | `/api/brands/:id/analysis` | User | Generate AI brand analysis |
| POST | `/api/brands/:id/deep-scan` | User | Trigger deep security scan |
| GET | `/api/brands/:id/report` | User | Brand threat report |
| POST | `/api/brands/:id/clean-false-positives` | User | Remove false positive threats |
| GET | `/api/brands/:id/safe-domains` | User | List safe/owned domains |
| POST | `/api/brands/:id/safe-domains` | User | Add safe domain |
| POST | `/api/brands/:id/safe-domains/bulk` | User | Bulk add safe domains |
| DELETE | `/api/brands/:id/safe-domains/:domainId` | User | Remove safe domain |
| GET | `/api/brands/:id/social-config` | User | Get social media config |
| PATCH | `/api/brands/:id/social-config` | User | Update social config |
| GET | `/api/brands/:id/social-profiles` | User | Get brand social profiles |
| PATCH | `/api/brands/:id/social-profiles/:profileId` | User | Classify social profile |
| POST | `/api/brands/:id/discover-social` | User | Auto-discover social profiles |
| POST | `/api/brands/:id/social-profiles/:profileId/assess` | User | Re-assess profile |
| POST | `/api/brands/:id/compute-score` | User | Recalculate trust score |
| GET | `/api/brand/:brandId/threat-assessment/history` | User | Threat assessment history |
| GET | `/api/brand/:brandId/threat-assessment` | User | Current threat assessment |

---

## 6. Brand Profiles — DEPRECATED (7 endpoints)

> Will be replaced when social data is unified with core brand model.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/brand-profiles` | User | Create brand profile |
| GET | `/api/brand-profiles` | User | List brand profiles |
| GET | `/api/brand-profiles/:id` | User | Get brand profile |
| PATCH | `/api/brand-profiles/:id` | User | Update brand profile |
| DELETE | `/api/brand-profiles/:id` | User | Delete brand profile |
| POST | `/api/brand-profiles/:id/handles` | User | Update social handles |
| GET | `/api/brand-profiles/:id/handles` | User | Get social handles |

---

## 7. Social Monitoring (4 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/social/monitor` | User | Social monitoring overview |
| GET | `/api/social/monitor/:brandId` | User | Brand-specific monitoring |
| GET | `/api/social/alerts` | User | Active impersonation alerts |
| POST | `/api/social/scan/:brandId` | User | Trigger social scan |

---

## 8. Lookalike Domains (4 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/lookalikes/:brandId` | User | List lookalike domains |
| POST | `/api/lookalikes/:brandId/generate` | User | Generate domain permutations |
| PATCH | `/api/lookalikes/:id` | User | Update lookalike status |
| POST | `/api/lookalikes/:brandId/scan` | User | Scan lookalike domains |

---

## 9. Certificate Transparency (4 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ct/certificates/:brandId` | User | List CT certificates |
| GET | `/api/ct/certificates/:brandId/stats` | User | Certificate statistics |
| PATCH | `/api/ct/certificates/:id` | User | Update certificate entry |
| POST | `/api/ct/scan/:brandId` | User | Trigger CT scan |

---

## 10. Threat Narratives (4 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/narratives/:brandId` | User | List narratives for brand |
| GET | `/api/narratives/:brandId/:id` | User | Get narrative detail |
| POST | `/api/narratives/:brandId/generate` | User | Generate AI narrative |
| PATCH | `/api/narratives/:id` | User | Update narrative |

---

## 11. Threats (12 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/threats` | User | List threats (filterable: page, limit, severity, type, brand) |
| GET | `/api/threats/stats` | User | Threat statistics |
| GET | `/api/threats/recent` | User | Recently discovered threats |
| GET | `/api/threats/correlations` | User | Threat correlations |
| GET | `/api/threats/heatmap` | User | Threat heatmap (query: period, limit) |
| GET | `/api/threats/geo-clusters` | User | Geographic clusters |
| GET | `/api/threats/attack-flows` | User | Attack flow visualization |
| GET | `/api/threats/:id` | User | Threat detail |
| PATCH | `/api/threats/:id` | Admin | Update threat (severity, status) |
| GET | `/api/threat-feeds/stats` | User | Threat feed statistics |
| POST | `/api/threats/enrich-geo` | Admin | Enrich threats with geolocation |
| POST | `/api/threats/enrich-all` | Admin | Full enrichment run |

---

## 12. Briefings (5 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/briefings` | User | List briefings |
| GET | `/api/briefings/latest` | User | Latest briefing |
| GET | `/api/briefings/history` | User | Briefing history |
| GET | `/api/briefings/:id` | User | Briefing detail |
| POST | `/api/briefings/generate` | User (5/60s) | Generate new briefing |

---

## 13. Campaigns (7 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/campaigns` | User | List threat campaigns |
| GET | `/api/campaigns/stats` | User | Campaign statistics |
| GET | `/api/campaigns/:id` | User | Campaign detail |
| GET | `/api/campaigns/:id/threats` | User | Campaign threats |
| GET | `/api/campaigns/:id/infrastructure` | User | Campaign infrastructure |
| GET | `/api/campaigns/:id/brands` | User | Targeted brands |
| GET | `/api/campaigns/:id/timeline` | User | Campaign timeline |

---

## 14. NEXUS Operations (4 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/operations/stats` | User | Operations statistics |
| GET | `/api/v1/operations` | User | List NEXUS operations |
| GET | `/api/v1/operations/:id/timeline` | User | Operation timeline |
| GET | `/api/v1/operations/:id/threats` | User | Operation threats |

---

## 15. Providers (13 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/providers` | User | List hosting providers |
| GET | `/api/providers/v2` | User | List providers (v2) |
| GET | `/api/providers/stats` | User | Provider statistics |
| GET | `/api/providers/intelligence` | User | Provider intelligence |
| GET | `/api/providers/clusters` | User | Provider clusters |
| GET | `/api/providers/worst` | User | Worst providers |
| GET | `/api/providers/improving` | User | Improving providers |
| GET | `/api/providers/:id` | User | Provider detail |
| GET | `/api/providers/:id/threats` | User | Provider's threats |
| GET | `/api/providers/:id/clusters` | User | Provider clusters |
| GET | `/api/providers/:id/brands` | User | Targeted brands |
| GET | `/api/providers/:id/timeline` | User | Provider timeline |
| GET | `/api/providers/:id/locations` | User | Provider locations |

---

## 16. Intelligence (7 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/breaches` | User | Breach records |
| GET | `/api/ato-events` | User | Account takeover events |
| PATCH | `/api/ato-events/:id` | Admin | Update ATO event |
| GET | `/api/email-auth` | User | Email authentication reports |
| GET | `/api/cloud-incidents` | User | Cloud security incidents |
| GET | `/api/trust-scores` | User | Trust score history |
| GET | `/api/social-iocs` | User | Social IOCs |

---

## 17. Feeds (15 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/feeds` | User | List all feeds |
| GET | `/api/feeds/overview` | User | Feeds overview dashboard |
| GET | `/api/feeds/stats` | User | Feed statistics |
| GET | `/api/feeds/aggregate-stats` | User | Aggregated stats |
| GET | `/api/feeds/jobs` | User | Ingestion job status |
| GET | `/api/feeds/quota` | User | Feed quota info |
| GET | `/api/feeds/:id` | User | Feed detail |
| GET | `/api/feeds/:id/history` | User | Feed pull history |
| PATCH | `/api/feeds/:id` | Admin | Update feed config |
| POST | `/api/feeds/:id/trigger` | Admin | Manual trigger |
| POST | `/api/feeds/:id/reset` | Admin | Reset circuit breaker |
| POST | `/api/feeds` | — | 501 (deferred) |
| DELETE | `/api/feeds/:id` | — | 501 (deferred) |
| POST | `/api/feeds/trigger-all` | Admin | Trigger all feeds |
| POST | `/api/feeds/trigger-tier/:tier` | Admin | Trigger feeds by tier |

---

## 18. AI Agents (15 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents` | User | List available agents |
| GET | `/api/agents/stats` | User | Agent statistics |
| GET | `/api/agents/runs` | User | Agent execution runs |
| GET | `/api/agents/token-usage` | User | Token consumption stats |
| GET | `/api/agents/outputs` | User | Agent outputs |
| GET | `/api/agents/approvals` | User | Pending approvals |
| GET | `/api/agents/:name` | User | Agent detail |
| GET | `/api/agents/:name/outputs` | User | Agent-specific outputs |
| GET | `/api/agents/:name/health` | User | Agent health status |
| POST | `/api/agents/trigger-all` | Admin | Trigger all agents |
| POST | `/api/agents/:name/trigger` | Admin | Trigger specific agent |
| POST | `/api/agents/approvals/:id/resolve` | Admin | Resolve approval |
| GET | `/api/admin/agents/api-usage` | User | AI API usage metrics |
| GET | `/api/admin/agents/config` | User | Agent configuration |
| POST | `/api/trustbot/chat` | User | Chat with TrustBot copilot |

---

## 19. Email Security (4 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/email-security/stats` | User | Email security statistics |
| GET | `/api/email-security/scan-all` | Admin | Scan all monitored brands |
| GET | `/api/email-security/:brandId` | User | Brand email security posture |
| POST | `/api/email-security/scan/:brandId` | User | Trigger email security scan |

---

## 20. DMARC Reports (4 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dmarc-reports/overview` | Admin | DMARC overview |
| GET | `/api/dmarc-reports/:brandId` | User | Brand DMARC reports |
| GET | `/api/dmarc-reports/:brandId/stats` | User | DMARC statistics |
| GET | `/api/dmarc-reports/:brandId/sources` | User | DMARC spoofing sources |

---

## 21. Alerts (6 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/alerts` | User | List alerts |
| GET | `/api/alerts/stats` | User | Alert statistics |
| GET | `/api/alerts/:id` | User | Alert detail |
| PATCH | `/api/alerts/:id` | User | Update alert |
| POST | `/api/alerts/bulk-acknowledge` | User | Bulk acknowledge |
| POST | `/api/alerts/bulk-takedown` | User | Create takedowns from alerts |

---

## 22. Notifications (6 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | User | List notifications |
| POST | `/api/notifications/:id/read` | User | Mark as read |
| POST | `/api/notifications/read-all` | User | Mark all as read |
| GET | `/api/notifications/unread-count` | User | Unread count |
| GET | `/api/notifications/preferences` | User | Notification preferences |
| PUT | `/api/notifications/preferences` | User | Update preferences |

---

## 23. Trends (10 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/trends/volume` | User | Threat volume over time |
| GET | `/api/trends/brands` | User | Brand targeting trends |
| GET | `/api/trends/providers` | User | Provider trends |
| GET | `/api/trends/tlds` | User | TLD trends |
| GET | `/api/trends/types` | User | Threat type breakdown |
| GET | `/api/trends/compare` | User | Compare trend periods |
| GET | `/api/trends/intelligence` | User | Observer intelligence insights |
| GET | `/api/trends/threat-volume` | User | Threat volume by type |
| GET | `/api/trends/brand-momentum` | User | Brand threat momentum |
| GET | `/api/trends/provider-momentum` | User | Provider activity momentum |
| GET | `/api/trends/nexus-active` | User | Active NEXUS operations |

---

## 24. Signals & Insights (3 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/signals` | Public | Threat signals feed |
| POST | `/api/signals` | User | Ingest custom signal |
| GET | `/api/insights/latest` | User | Latest AI insights |

---

## 25. Scans (10 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/scan` | Rate-limited | Authenticated domain scan |
| POST | `/api/scan/public` | Rate-limited | Public domain scan |
| POST | `/api/scan/report` | Rate-limited | Generate scan report |
| GET | `/api/scan/history` | User | Scan history |
| POST | `/api/brand-scan` | User | Brand exposure scan |
| GET | `/api/brand-scan/history` | User | Brand scan history |
| POST | `/api/brand-scan/public` | Rate-limited | Public brand scan |
| GET | `/api/brand-scan/public/:id` | Public | Get public scan result |
| POST | `/api/leads` | Rate-limited | Lead capture |
| POST | `/api/snapshots/generate` | Admin | Generate threat snapshots |

---

## 26. Investigations (8 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tickets` | User | List investigation tickets |
| GET | `/api/tickets/:id` | User | Ticket detail |
| POST | `/api/tickets` | User | Create investigation |
| PATCH | `/api/tickets/:id` | User | Update ticket |
| POST | `/api/tickets/:id/evidence` | User | Attach evidence |
| GET | `/api/erasures` | User | List erasure requests |
| POST | `/api/erasures` | Admin | Create erasure request |
| PATCH | `/api/erasures/:id` | Admin | Update erasure status |

---

## 27. Spam Trap (14 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/spam-trap/stats` | Admin | Spam trap statistics |
| GET | `/api/spam-trap/captures` | Admin | List email captures |
| GET | `/api/spam-trap/captures/brand/:brandId` | User | Brand-specific captures |
| GET | `/api/spam-trap/captures/:id` | Admin | Capture detail |
| GET | `/api/spam-trap/sources` | Admin | Email source analysis |
| GET | `/api/spam-trap/campaigns` | Admin | Seeding campaigns |
| POST | `/api/spam-trap/campaigns` | Admin | Create campaign |
| POST | `/api/spam-trap/campaigns/:id/execute` | Admin | Execute campaign |
| PUT | `/api/spam-trap/campaigns/:id` | Admin | Update campaign |
| GET | `/api/spam-trap/seeding-sources` | Admin | Seeding source list |
| GET | `/api/spam-trap/addresses` | Admin | Trap addresses |
| POST | `/api/spam-trap/seed/initial` | Admin | Initial seeding run |
| POST | `/api/spam-trap/strategist/run` | Admin | Run strategist agent |
| POST | `/api/spam-trap/reparse-auth` | Admin | Re-parse auth headers |

---

## 28. Sparrow / Takedowns (9 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/sparrow/scan-capture/:id` | Admin | Scan captured content |
| POST | `/api/admin/sparrow/scan-batch` | Admin | Batch scan |
| GET | `/api/admin/sparrow/results/:captureId` | Admin | Scan results |
| GET | `/api/admin/sparrow/malicious` | Admin | Malicious content list |
| GET | `/api/admin/sparrow/providers` | Admin | Hosting providers |
| POST | `/api/admin/sparrow/assemble-evidence/:takedownId` | Admin | Assemble evidence |
| GET | `/api/admin/sparrow/evidence/:takedownId` | Admin | Get evidence |
| GET | `/api/admin/sparrow/resolve-provider/:domain` | Admin | Resolve provider |
| POST | `/api/admin/sparrow/generate-draft/:takedownId` | Admin | Generate takedown draft |

---

## 29. Data Export (5 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/export/scans` | User | Export scan history |
| GET | `/api/export/signals` | User | Export signals |
| GET | `/api/export/alerts` | User | Export alerts |
| GET | `/api/export/stix/:brandId` | User | STIX 2.1 bundle export |
| GET | `/api/export/stix/:brandId/indicators` | User | STIX indicators only |

---

## 30. Organizations / Tenants (36 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/orgs/:orgId` | User | Organization detail |
| GET | `/api/orgs/:orgId/members` | User | List members |
| POST | `/api/orgs/:orgId/invite` | User | Invite user |
| DELETE | `/api/orgs/:orgId/members/:userId` | User | Remove member |
| PATCH | `/api/orgs/:orgId/members/:userId` | User | Update member role |
| POST | `/api/orgs/:orgId/brands` | User | Assign brand to org |
| DELETE | `/api/orgs/:orgId/brands/:brandId` | User | Unassign brand |
| GET | `/api/orgs/:orgId/brands` | User | List org brands |
| GET | `/api/orgs/:orgId/invites` | User | List pending invites |
| DELETE | `/api/orgs/:orgId/invites/:inviteId` | User | Revoke invite |
| GET | `/api/orgs/:orgId/api-keys` | User | List API keys |
| POST | `/api/orgs/:orgId/api-keys` | User | Create API key |
| DELETE | `/api/orgs/:orgId/api-keys/:keyId` | User | Revoke API key |
| GET | `/api/orgs/:orgId/integrations` | User | List integrations |
| POST | `/api/orgs/:orgId/integrations` | User | Create integration |
| PATCH | `/api/orgs/:orgId/integrations/:integrationId` | User | Update integration |
| DELETE | `/api/orgs/:orgId/integrations/:integrationId` | User | Delete integration |
| POST | `/api/orgs/:orgId/integrations/:integrationId/test` | User | Test integration |
| GET | `/api/orgs/:orgId/webhook` | User | Get webhook config |
| PATCH | `/api/orgs/:orgId/webhook` | User | Update webhook |
| POST | `/api/orgs/:orgId/webhook/regenerate-secret` | User | Regenerate secret |
| POST | `/api/orgs/:orgId/webhook/test` | User | Send test webhook |
| GET | `/api/orgs/:orgId/dashboard` | User | Tenant dashboard |
| GET | `/api/orgs/:orgId/alerts` | User | Org alerts |
| PATCH | `/api/orgs/:orgId/alerts/:alertId` | User | Update alert |
| GET | `/api/orgs/:orgId/brands/:brandId/detail` | User | Brand detail |
| GET | `/api/orgs/:orgId/brands/:brandId/threats` | User | Brand threats |
| GET | `/api/orgs/:orgId/brands/:brandId/social-profiles` | User | Brand social profiles |
| POST | `/api/orgs/:orgId/takedowns` | User | Create takedown |
| GET | `/api/orgs/:orgId/takedowns` | User | List takedowns |
| GET | `/api/orgs/:orgId/takedowns/:id` | User | Takedown detail |
| PATCH | `/api/orgs/:orgId/takedowns/:id` | User | Update takedown |
| GET | `/api/orgs/:orgId/brands/:brandId/monitoring-config` | User | Monitoring config |
| PATCH | `/api/orgs/:orgId/brands/:brandId/monitoring-config` | User | Update monitoring config |

---

## 31. Admin (48 endpoints)

### User & Session Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/stats` | Admin | Platform statistics |
| GET | `/api/admin/health` | Admin | System health |
| GET | `/api/admin/system-health` | SuperAdmin | Detailed system health |
| GET | `/api/admin/users` | Admin | List users |
| PATCH | `/api/admin/users/:id` | Admin | Update user |
| GET | `/api/admin/sessions` | Admin | Active sessions |
| POST | `/api/admin/users/:id/force-logout` | Admin | Force logout |
| POST | `/api/admin/invites` | Admin | Create invite |
| GET | `/api/admin/invites` | Admin | List invites |
| DELETE | `/api/admin/invites/:id` | Admin | Revoke invite |

### Organization Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/organizations` | SuperAdmin | Create organization |
| GET | `/api/admin/organizations` | SuperAdmin | List organizations |
| GET | `/api/admin/organizations/:orgId` | SuperAdmin | Organization detail |
| PATCH | `/api/admin/organizations/:orgId` | SuperAdmin | Update organization |

### Takedown Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/takedowns` | SuperAdmin | List takedowns |
| PATCH | `/api/admin/takedowns/:id` | SuperAdmin | Update takedown |

### Lead Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/leads` | Admin | List leads |
| PATCH | `/api/admin/leads/:id` | Admin | Update lead |

### Sales Pipeline

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/sales-leads` | SuperAdmin | List sales leads |
| GET | `/api/admin/sales-leads/stats` | SuperAdmin | Lead statistics |
| GET | `/api/admin/sales-leads/:id` | SuperAdmin | Lead detail |
| PATCH | `/api/admin/sales-leads/:id` | SuperAdmin | Update lead |
| POST | `/api/admin/sales-leads/:id/approve` | SuperAdmin | Approve lead |
| POST | `/api/admin/sales-leads/:id/send` | SuperAdmin | Send outreach |
| POST | `/api/admin/sales-leads/:id/respond` | SuperAdmin | Record response |
| POST | `/api/admin/sales-leads/:id/book` | SuperAdmin | Book appointment |
| POST | `/api/admin/sales-leads/:id/convert` | SuperAdmin | Convert to customer |
| POST | `/api/admin/sales-leads/:id/decline` | SuperAdmin | Decline lead |
| DELETE | `/api/admin/sales-leads/:id` | SuperAdmin | Delete lead |
| GET | `/api/admin/sales-leads/:id/activity` | SuperAdmin | Activity history |
| POST | `/api/admin/pathfinder-enrich` | SuperAdmin | AI lead enrichment |

### Audit

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/audit` | Admin | Audit log |
| GET | `/api/admin/audit/export` | Admin | Export audit log |

### Backfill Operations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/backfill-classifications` | Admin | Backfill classifications |
| POST | `/api/admin/backfill-geo` | Admin | Backfill geo data |
| POST | `/api/admin/backfill-brand-match` | Admin | Backfill brand matching |
| POST | `/api/admin/backfill-safe-domains` | Admin | Backfill safe domains |
| POST | `/api/admin/backfill-ai-attribution` | Admin | Backfill AI attribution |
| POST | `/api/admin/import-tranco` | Admin | Import Tranco top sites |
| POST | `/api/admin/backfill-social-config` | SuperAdmin | Backfill social config |

### Brand Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/brands` | Admin | List all brands |
| POST | `/api/admin/brands/bulk-monitor` | Admin | Bulk add monitoring |
| POST | `/api/admin/brands/bulk-delete` | SuperAdmin | Bulk delete brands |
| POST | `/api/admin/discover-social-batch` | SuperAdmin | Social discovery batch |

### Budget Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/budget/status` | Admin | AI budget status |
| GET | `/api/admin/budget/breakdown` | Admin | Budget breakdown |
| PATCH | `/api/admin/budget/config` | SuperAdmin | Update budget config |

### Honeypot

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/honeypot/generate` | Admin | Generate honeypot site |

---

## 32. WebSocket (1 endpoint)

| Path | Auth | Description |
|------|------|-------------|
| `/ws/threats` | Public | Real-time threat push (Durable Object) |

---

## 33. Corporate Site Pages (28 pages)

Server-rendered HTML pages (not API endpoints):

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/legacy` | Legacy interface |
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
| `/scan` | Public scan tool |
| `/scan/:id` | Scan result page |
| POST `/assess` | Brand assessment form |
| `/assess/:id/results` | Assessment results |
| `/team` | Honeypot page |
| `/admin-portal` | Honeypot page |
| `/internal-staff` | Honeypot page |
| `/robots.txt` | Robots.txt |
| `/sitemap.xml` | Sitemap |
| POST `/api/contact` | Contact form submission |
| `/v2/*` | React app (client-side routing) |

---

## Response Format

### Success

```json
{
  "data": { ... },
  "meta": { "total": 100, "page": 1, "limit": 25 }
}
```

### Error

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## Rate Limiting

KV-based sliding window counters:

| Bucket | Limit | Endpoints |
|--------|-------|-----------|
| `auth` | 10 req/min | Auth endpoints |
| `scan` | 30 req/min | Public scans |
| `scan_report` | 5 req/hr | Report generation |
| `api` | 100 req/min | General API |
| `brands` | 10 req/hr | Brand operations |
| `briefings` | 5 req/60s | Briefing generation |

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Endpoint Count Summary

| Section | Count |
|---------|-------|
| Authentication | 7 |
| Public | 13 |
| Public API v1 | 7 |
| Dashboard | 3 |
| Brands | 32 |
| Brand Profiles (deprecated) | 7 |
| Social Monitoring | 4 |
| Lookalike Domains | 4 |
| Certificate Transparency | 4 |
| Threat Narratives | 4 |
| Threats | 12 |
| Briefings | 5 |
| Campaigns | 7 |
| NEXUS Operations | 4 |
| Providers | 13 |
| Intelligence | 7 |
| Feeds | 15 |
| AI Agents | 15 |
| Email Security | 4 |
| DMARC Reports | 4 |
| Alerts | 6 |
| Notifications | 6 |
| Trends | 11 |
| Signals & Insights | 3 |
| Scans | 10 |
| Investigations | 8 |
| Spam Trap | 14 |
| Sparrow / Takedowns | 9 |
| Data Export | 5 |
| Organizations / Tenants | 34 |
| Admin | 48 |
| WebSocket | 1 |
| **Total API Endpoints** | **343** |
