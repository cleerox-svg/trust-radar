# Trust Radar v2 — Full Assessment & Phased Remediation Plan

## Executive Summary

After a thorough audit of the plan (`trust-radar-v2-plan.md`), prototypes (`prototypes/`), and actual implementation across all three packages (`frontend`, `trust-radar` worker, `imprsn8` worker), there are **significant gaps** between what was planned and what exists. The system has data flowing in from feeds, but the visualization, AI agents, and most tabs are non-functional due to missing components, broken DB schema, and an incomplete frontend-to-backend integration.

---

## Current State Assessment

### What IS Working
| Component | Status | Notes |
|-----------|--------|-------|
| Feed ingestion (trust-radar) | ✅ Partial | 8 feeds registered, cron runs every 5min, data IS coming in |
| Providers tab (trust-radar) | ✅ Partial | Backend endpoints work (except `/stats`), some data visible |
| Admin tab (imprsn8) | ✅ Working | User management, influencer admin functional |
| Authentication | ✅ Working | JWT-based auth on both workers |
| Threats page (imprsn8) | ✅ Working | Impersonation reports display correctly |
| Takedowns page (imprsn8) | ✅ Working | Kanban workflow functional |
| Monitored Accounts (imprsn8) | ✅ Working | Platform monitoring functional |

### What is NOT Working

#### 1. Observatory — No Arcs, Empty Data Fields
**Root Cause: The Observatory does not exist as a frontend component.**

The plan describes a full SOC-style Observatory with:
- Leaflet map with country-level heatmap
- Animated arc/particle system showing attack flows
- HUD overlay (scan line, corner brackets, clock)
- Stat bar (active threats, campaigns, brands, providers)
- Sidebar panels (top brands, providers, AI insights)

**What exists instead:** `Overview.tsx` — a per-influencer brand health dashboard (completely different purpose). The map libraries (`deck.gl`, `maplibre-gl`) are installed in `package.json` but **never imported or used anywhere**.

The backend endpoints DO exist:
- `GET /api/threats/geo-clusters` — returns country-level threat data ✅
- `GET /api/threats/attack-flows` — returns arc data (but with hardcoded US coordinates) ⚠️
- `GET /api/dashboard/overview` — returns stat counts ✅
- `GET /api/dashboard/top-brands` — returns brand rankings ✅
- `GET /api/insights/latest` — returns agent insights ✅

**But the frontend never calls them.** The frontend API client (`api.ts`) only knows about imprsn8 endpoints (`/api/threats`, `/api/accounts`, etc.), not trust-radar endpoints.

#### 2. AI Agents — Not Functioning
**Root Cause: Multiple environmental and schema issues.**

All 5 trust-radar agents (Sentinel, Analyst, Cartographer, Strategist, Observer) are **fully coded** with real logic, but:

| Issue | Impact | Fix |
|-------|--------|-----|
| `ANTHROPIC_API_KEY` likely not set as Cloudflare secret | Sentinel, Analyst, Cartographer, Observer fall back to rule-based (degraded) | `wrangler secret put ANTHROPIC_API_KEY` |
| Cron trigger gates Sentinel behind `totalNew > 0` | Sentinel only runs when feeds pull new items | By design, but if feeds stall, agents stall |
| `provider_threat_stats` table missing | Cartographer crashes when writing results | Add migration |
| `campaign_clusters` table missing | Strategist may crash when writing campaign data | Add migration |
| Agent outputs not reaching frontend | Frontend AgentsPanel fetches from imprsn8, not trust-radar | Need API bridge or unified client |

The 6 imprsn8 agents (Watchdog, Arbiter, Sentinel, Recon, Nexus, Veritas) are also fully coded but:
- `agent_definitions.schedule_mins` may not be populated → agents never trigger on schedule
- `LRX_API_KEY` not set → Nexus and Veritas skip AI-enhanced analysis

#### 3. Empty Tabs — Brands, Campaigns, Trends
**Root Cause: These pages don't exist in the frontend.**

| Plan Tab | Prototype File | Frontend Page | Status |
|----------|---------------|---------------|--------|
| Observatory | `trust-radar-hud-v2.html` | None | **NOT BUILT** |
| Brands Hub | `trust-radar-brands-tab.html` | None (old `Dashboard.tsx` uses wrong APIs) | **NOT BUILT** |
| Providers Hub | `trust-radar-providers-tab.html` | None (but backend works) | **NOT BUILT** |
| Campaigns Hub | `trust-radar-campaigns-tab.html` | None | **NOT BUILT** (backend also broken) |
| Trends | `trust-radar-trends-tab.html` | None | **NOT BUILT** (backend works) |
| Agents | `trust-radar-agents-tab.html` | `AgentsPanel.tsx` | **PARTIAL** (shows imprsn8 agents, not trust-radar) |
| Admin | `trust-radar-admin-dashboard.html` | `AdminPage.tsx` | **PARTIAL** (imprsn8 admin only) |

#### 4. Frontend-Backend Disconnect
**Critical Architecture Issue:**

The frontend SPA (`imprsn8/`) talks to the **imprsn8 worker** at `/api/*`. The **trust-radar worker** (which has all the threat intelligence, brands, providers, campaigns, trends, observatory data) lives at `lrxradar.com` and is **never called by the frontend**.

The `PlatformSwitcher.tsx` component shows both platforms but just links to `lrxradar.com` — it doesn't integrate the APIs.

#### 5. Database Schema Gaps

**Missing tables in trust-radar D1:**
```sql
-- campaign_clusters: Referenced by campaigns.ts, brands.ts
-- provider_threat_stats: Referenced by providers.ts, cartographer agent
```

**Missing/empty columns:**
- `threats.geo_lat`, `threats.geo_lng` — may not be populated by feeds
- `threats.target_brand_id` — only populated when Analyst agent runs successfully
- `threats.campaign_id` — only populated when Strategist agent runs successfully
- `threats.hosting_provider_id` — only populated during enrichment

#### 6. Attack Flows — Hardcoded Coordinates
In `threats.ts:handleAttackFlows()`, target coordinates are **hardcoded to random US locations**:
```javascript
target_lat: 37.7749 + (Math.random() - 0.5) * 10,
target_lng: -98.5795 + (Math.random() - 0.5) * 30,
```
This means arcs always point to the US regardless of actual target.

---

## Phased Remediation Plan

### Phase 0: Environment & Schema Fixes (Prerequisites)
**Effort: Small — Blocking everything else**

- [ ] **0.1** Set `ANTHROPIC_API_KEY` as Cloudflare secret on trust-radar worker
- [ ] **0.2** Set `ANTHROPIC_API_KEY` (or `LRX_API_KEY`) on imprsn8 worker if needed
- [ ] **0.3** Create missing `campaign_clusters` table migration
- [ ] **0.4** Create missing `provider_threat_stats` table migration
- [ ] **0.5** Run all pending D1 migrations on both databases
- [ ] **0.6** Verify `agent_definitions` table has `schedule_mins` values populated
- [ ] **0.7** Verify `feed_configs` table has all 8 feeds configured and enabled
- [ ] **0.8** Verify feeds are actually pulling data (check `feed_pull_history`)

**Questions for you:**
1. Do you have an Anthropic API key set up? If not, you'll need one for Claude Haiku analysis.
2. Are the D1 databases provisioned on Cloudflare? Have migrations been run?
3. Is `lrxradar.com` deployed and reachable? Can you hit `/health`?

---

### Phase 1: Fix Backend Data Pipeline (Make agents work)
**Effort: Medium — Gets data flowing correctly**

- [ ] **1.1** Fix `handleAttackFlows` — use actual brand/threat geo coordinates instead of hardcoded US
- [ ] **1.2** Fix campaigns handler — use `campaigns` table (which exists) instead of `campaign_clusters`
- [ ] **1.3** Fix provider stats handler — add fallback to aggregate from `threats` table when `provider_threat_stats` is empty
- [ ] **1.4** Verify Sentinel agent classifies threats correctly (test with manual trigger)
- [ ] **1.5** Verify Analyst agent matches brands (test with manual trigger)
- [ ] **1.6** Verify Cartographer enriches geo data and scores providers
- [ ] **1.7** Verify Strategist creates campaign clusters
- [ ] **1.8** Verify Observer generates daily insights
- [ ] **1.9** Add seed data for testing if databases are empty (sample threats, brands, providers)

**Questions for you:**
4. Should campaigns use the existing `campaigns` table or do you want a separate `campaign_clusters` table? The Strategist agent writes to `campaigns` but the handler reads from `campaign_clusters`.
5. Do you have sample/seed data, or should we generate synthetic test data?

---

### Phase 2: Unified API Client (Connect frontend to trust-radar)
**Effort: Medium — Bridges the two systems**

- [ ] **2.1** Create a `trustRadarApi.ts` client in frontend that calls the trust-radar worker
- [ ] **2.2** Add environment config for trust-radar API base URL (e.g., `https://lrxradar.com/api`)
- [ ] **2.3** Handle CORS between imprsn8.com frontend and lrxradar.com backend
- [ ] **2.4** Add trust-radar API methods: dashboard, threats, brands, providers, campaigns, trends, agents, insights
- [ ] **2.5** Add authentication bridging (share JWT or add trust-radar auth)

**Questions for you:**
6. Should the frontend call trust-radar directly (CORS), or should imprsn8 proxy requests to trust-radar?
7. Should both workers share the same auth system, or should trust-radar have its own login?

---

### Phase 3: Observatory View (The big visual piece)
**Effort: Large — Core feature from the plan**

- [ ] **3.1** Create `Observatory.tsx` page component
- [ ] **3.2** Implement Leaflet/MapLibre map with dark base tiles
- [ ] **3.3** Add heatmap layer showing country-level threat density (from `/api/threats/geo-clusters`)
- [ ] **3.4** Add arc/particle system for attack flows (from `/api/threats/attack-flows`)
- [ ] **3.5** Add HUD overlay — scan line animation, corner brackets, clock
- [ ] **3.6** Add stat bar — active threats, campaigns, brands, providers, feed health
- [ ] **3.7** Add sidebar panels — top brands, top providers, AI insights
- [ ] **3.8** Add real-time polling (30s interval) for live updates
- [ ] **3.9** Add route `/observatory` and make it the default authenticated view
- [ ] **3.10** Mobile adaptation — bottom sheets instead of sidebar, reduced particles

**Questions for you:**
8. The prototype (`trust-radar-hud-v2.html`) — should we match it exactly, or is it just a reference?
9. Leaflet or MapLibre/deck.gl? Both are installed. deck.gl is more performant for large datasets.
10. Should Observatory replace the current Overview page, or coexist as a separate tab?

---

### Phase 4: Brands Hub & Detail (New pages)
**Effort: Medium**

- [ ] **4.1** Create `BrandsHub.tsx` — Top Targeted, Monitored, All Brands sub-views
- [ ] **4.2** Create `BrandDetail.tsx` — Trust score, threats table, mini map, provider breakdown
- [ ] **4.3** Wire to trust-radar API: `/api/brands`, `/api/brands/:id`, `/api/brands/:id/threats`
- [ ] **4.4** Add brand sparkline charts (threat count over time)
- [ ] **4.5** Add routes `/brands` and `/brands/:id`

---

### Phase 5: Campaigns Hub & Detail (New pages + backend fix)
**Effort: Medium**

- [ ] **5.1** Fix all campaign handler queries to use `campaigns` table (not `campaign_clusters`)
- [ ] **5.2** Create `CampaignsHub.tsx` — Active, Dormant, Disrupted sub-views
- [ ] **5.3** Create `CampaignDetail.tsx` — Infrastructure map, timeline, threat breakdown
- [ ] **5.4** Wire to trust-radar API: `/api/campaigns`, `/api/campaigns/:id`
- [ ] **5.5** Add routes `/campaigns` and `/campaigns/:id`

---

### Phase 6: Providers Hub & Detail (New pages)
**Effort: Medium**

- [ ] **6.1** Create `ProvidersHub.tsx` — Worst, Improving, All Providers sub-views
- [ ] **6.2** Create `ProviderDetail.tsx` — Threats hosted, brands impersonated, ASN intel, reputation
- [ ] **6.3** Wire to trust-radar API: `/api/providers`, `/api/providers/:id`
- [ ] **6.4** Add routes `/providers` and `/providers/:id`

---

### Phase 7: Trends Explorer (New page)
**Effort: Medium**

- [ ] **7.1** Create `TrendsExplorer.tsx` — Dimension selector, time range, chart types
- [ ] **7.2** Add compare mode (overlay two dimensions)
- [ ] **7.3** Wire to trust-radar API: `/api/trends/*`
- [ ] **7.4** Add CSV export
- [ ] **7.5** Add route `/trends`

---

### Phase 8: Navigation Overhaul
**Effort: Small-Medium**

- [ ] **8.1** Add top nav pill system: Observatory, Brands, Providers, Campaigns, Trends, Agents
- [ ] **8.2** Integrate PlatformSwitcher to toggle between imprsn8 and trust-radar views
- [ ] **8.3** Update Sidebar/SectionNav to match the plan's navigation structure
- [ ] **8.4** Add trust-radar agent panel (separate from imprsn8 agents) or unify both

---

### Phase 9: Agent Dashboard Unification
**Effort: Small**

- [ ] **9.1** Show trust-radar agents (Sentinel, Analyst, Cartographer, Strategist, Observer) in AgentsPanel
- [ ] **9.2** Show imprsn8 agents (Watchdog, Arbiter, Sentinel, Recon, Nexus, Veritas) in AgentsPanel
- [ ] **9.3** Add agent health metrics (processing rate, latency, error rate)
- [ ] **9.4** Add agent toggle on/off
- [ ] **9.5** Show recent agent outputs with confidence scores

---

### Phase 10: Admin Dashboard Enhancement
**Effort: Small**

- [ ] **10.1** Add Feed Management panel (from `trust-radar-admin-feeds.html` prototype)
- [ ] **10.2** Add Leads Kanban (from `trust-radar-admin-leads.html` prototype)
- [ ] **10.3** Add API Keys management
- [ ] **10.4** Add Agent Configuration panel
- [ ] **10.5** Add Audit Log viewer

---

## Things You Need To Do (Action Items)

### Immediate (Before any code work)
1. **Confirm Cloudflare D1 databases are provisioned** — Both `trust-radar-v2` and `imprsn8-db`
2. **Run pending migrations** — `wrangler d1 migrations apply trust-radar-v2` (both local and remote)
3. **Set API secrets:**
   ```bash
   cd packages/trust-radar
   wrangler secret put ANTHROPIC_API_KEY    # Your sk-ant-... key
   wrangler secret put JWT_SECRET           # Random 32-char string

   cd ../imprsn8
   wrangler secret put ANTHROPIC_API_KEY    # Same or different key
   wrangler secret put JWT_SECRET           # Random 32-char string
   ```
4. **Deploy both workers** and verify `/health` endpoints respond
5. **Check feed data** — Hit `https://lrxradar.com/api/feeds` to see if feeds are pulling

### Decision Points Needed
6. **Frontend architecture** — Should we build trust-radar views into the existing imprsn8 React app, or create a separate SPA for lrxradar.com?
7. **API communication** — Direct CORS calls to lrxradar.com, or proxy through imprsn8?
8. **Auth unification** — Single login for both platforms, or separate?
9. **Prototype fidelity** — Match HTML prototypes pixel-for-pixel, or use them as inspiration with the existing Tailwind/Radix UI system?
10. **Priority order** — Which phase matters most to you? Observatory visual? Getting agents producing data? Or getting all tabs populated?

---

## Effort Estimates by Phase

| Phase | Description | Complexity | Dependencies |
|-------|-------------|-----------|--------------|
| 0 | Environment & Schema | Small | None |
| 1 | Backend Data Pipeline | Medium | Phase 0 |
| 2 | Unified API Client | Medium | Phase 0 |
| 3 | Observatory View | **Large** | Phase 1, 2 |
| 4 | Brands Hub | Medium | Phase 2 |
| 5 | Campaigns Hub | Medium | Phase 1, 2 |
| 6 | Providers Hub | Medium | Phase 2 |
| 7 | Trends Explorer | Medium | Phase 2 |
| 8 | Navigation Overhaul | Small-Med | Phase 3-7 |
| 9 | Agent Dashboard | Small | Phase 1, 2 |
| 10 | Admin Enhancement | Small | Phase 2 |

**Critical Path:** Phase 0 → Phase 1 → Phase 2 → Phase 3 (Observatory)

Everything else can be parallelized after Phase 2 is complete.
