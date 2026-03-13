# Trust Radar — Command Center Build Plan

**Date:** March 13, 2026
**Repo:** `github.com/cleerox-svg/trust-radar`
**Branch target:** `feature/command-center`

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Dashboard layout | Full-viewport HUD — map fills screen, panels float/dock (Palantir/Darktrace style) |
| KPI cards & charts | Move to `/feed-analytics` (existing page) |
| Map technology | deck.gl + MapLibre GL JS (free, CARTO Dark Matter tiles, no API key) |
| Navigation | Merge Dashboard + Threat Map into single "Dashboard" nav item; remove `/threat-map` route |
| Correlation matrix | All three views (type×type, source×source, country×type), toggleable via tabs |
| Real-time updates | WebSocket push via Cloudflare Durable Objects (priority feature) |
| Color scheme | Option B — Electric blue (#3B82F6) primary, cyan (#22D3EE) secondary |

---

## Phase 1 — Color System Migration

**Effort:** Small (CSS + Tailwind config changes)
**Risk:** Low — cosmetic only, no logic changes
**Files touched:** 3

### 1.1 Update CSS Variables

**File:** `packages/frontend/radar/src/index.css`

Replace the brand color hierarchy. Electric blue becomes the primary interactive/accent color. Cyan demotes to secondary for status indicators and subtle accents.

```css
/* ── NEW: Primary Blue ─────────────────────────────────── */
--blue-50:  #EFF6FF;
--blue-100: #DBEAFE;
--blue-200: #BFDBFE;
--blue-300: #93C5FD;
--blue-400: #60A5FA;    /* Interactive states / hover */
--blue-500: #3B82F6;    /* PRIMARY ACCENT */
--blue-600: #2563EB;    /* Strong / pressed */
--blue-700: #1D4ED8;
--blue-rgb: 59 130 246;

/* ── SECONDARY: Cyan/Teal (demoted) ────────────────────── */
--cyan-400: #22D3EE;    /* Secondary accent, status indicators */
--cyan-500: #06B6D4;    /* Dimmed secondary */
--cyan-rgb: 34 211 238;
```

Update dark mode surfaces — slightly cooler/bluer undertone:

```css
--surface-void:    #050A14;   /* was #060A12 */
--surface-base:    #0B1120;   /* was #0A0E1A */
--surface-raised:  #111827;   /* unchanged */
--surface-overlay: #1E293B;   /* unchanged */
--surface-float:   #334155;   /* unchanged */
```

Update glow values:

```css
--glow-blue: 0 0 60px rgba(59, 130, 246, 0.15);  /* primary glow */
--glow-cyan: 0 0 40px rgba(34, 211, 238, 0.08);   /* secondary, subtler */
```

Update border accent:

```css
--border-accent: rgba(59, 130, 246, 0.25);  /* was --border-cyan */
--border-cyan:   rgba(34, 211, 238, 0.15);  /* demoted, subtler */
```

### 1.2 Update Tailwind Config

**File:** `packages/frontend/radar/tailwind.config.js`

Swap the color hierarchy so `blue` is the dominant ramp:

```js
colors: {
  /* Primary — Electric Blue */
  blue: {
    50:  "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",    // Interactive / hover
    500: "#3B82F6",    // PRIMARY ACCENT
    600: "#2563EB",    // Strong / pressed
    700: "#1D4ED8",
    DEFAULT: "#3B82F6",
  },
  /* Secondary — Cyan (demoted) */
  cyan: {
    300: "#67E8F9",
    400: "#22D3EE",    // Secondary accent
    500: "#06B6D4",    // Dimmed
    DEFAULT: "#22D3EE",
  },
  // ... threat, status, surface colors unchanged
}
```

Update shadow glows:

```js
boxShadow: {
  "glow-blue":  "0 0 60px rgba(59, 130, 246, 0.15)",
  "glow-cyan":  "0 0 40px rgba(34, 211, 238, 0.08)",
  "glow-red":   "0 0 40px rgba(239, 68, 68, 0.18)",
  "card-raised": "0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)",
}
```

### 1.3 Find-and-Replace Across Frontend Components

**Scope:** All `.tsx` files in `packages/frontend/radar/src/`

This is a systematic replacement. Everywhere `cyan-400` or `cyan-500` is used as a primary interactive color, replace with `blue-500` or `blue-400`. Keep `cyan` only where it's used for secondary/status purposes.

Key replacements:

| Pattern | Replacement | Context |
|---------|-------------|---------|
| `text-cyan-400` (links, accents) | `text-blue-400` | Navigation links, "View Hub" links, action labels |
| `text-cyan-300` (hover states) | `text-blue-300` | Link hover states |
| `hover:text-cyan-300` | `hover:text-blue-300` | Interactive hover |
| `bg-cyan-500/15` | `bg-blue-500/15` | Badge backgrounds (plan badge in header) |
| `text-cyan-400` (in badges) | `text-blue-400` | Badge text |
| `border-cyan-500/50` | `border-blue-500/50` | Hover borders on cards |
| `bg-cyan-400` (chart fills) | `bg-blue-400` | Progress bars, bar fills |
| `border-cyan-400` (loading) | `border-blue-400` | Spinner borders |
| `border-cyan-500` | `border-blue-500` | Active nav indicators |

**Do NOT replace:**
- `--threat-none: #06B6D4` — keep as-is (semantic)
- `status.scheduled: "#06B6D4"` — keep as-is (semantic)
- Agent status indicators using cyan for "cool" states
- Any cyan used in the `ThreatMapWidget.tsx` severity color maps (those will be updated in Phase 3 with the deck.gl migration)

### 1.4 Update CorrelationMatrix Colors

**File:** `packages/frontend/radar/src/components/ui/CorrelationMatrix.tsx`

Replace cyan with blue in the `getColor` function:

```typescript
function getColor(value: number): string {
  if (value >= 0.7) return "rgba(59, 130, 246, 0.8)";   // strong positive — blue
  if (value >= 0.4) return "rgba(59, 130, 246, 0.45)";  // moderate positive
  if (value >= 0.1) return "rgba(59, 130, 246, 0.15)";  // weak positive
  if (value > -0.1) return "rgba(255, 255, 255, 0.04)";  // neutral
  if (value > -0.4) return "rgba(239, 68, 68, 0.15)";   // weak negative
  if (value > -0.7) return "rgba(239, 68, 68, 0.45)";   // moderate negative
  return "rgba(239, 68, 68, 0.8)";                       // strong negative — red
}
```

---

## Phase 2 — Live Correlation Matrix + Backend Endpoint

**Effort:** Medium
**Risk:** Medium — new backend endpoint, SQL aggregation
**Files touched:** 4 (1 backend handler, 1 backend route, 1 frontend API, 1 frontend component)

### 2.1 New Backend Endpoint: `/api/threats/correlations`

**File:** `packages/trust-radar/src/handlers/threats.ts` (add new function)

Create `handleThreatCorrelations` that accepts a query param `view` = `type` | `source` | `country` and `window` = `7d` | `30d` | `90d`.

#### View: type × type (threat type co-occurrence by shared infrastructure)

```sql
-- Count how often two threat types share the same IP address within the window
SELECT
  t1.type AS type_a,
  t2.type AS type_b,
  COUNT(DISTINCT t1.ip_address) AS shared_ips,
  COUNT(DISTINCT t1.domain) AS shared_domains
FROM threats t1
JOIN threats t2
  ON (t1.ip_address = t2.ip_address OR t1.domain = t2.domain)
  AND t1.type < t2.type
  AND t1.id != t2.id
WHERE t1.created_at >= datetime('now', ? || ' days')
  AND (t1.ip_address IS NOT NULL OR t1.domain IS NOT NULL)
GROUP BY t1.type, t2.type
ORDER BY shared_ips DESC
```

Normalize results into a -1 to 1 matrix using Jaccard similarity:
- For each pair (A, B): `correlation = shared_count / (count_A + count_B - shared_count)`
- Diagonal = 1.0 (self-correlation)

#### View: source × source (feed agreement/overlap)

```sql
-- Count how often two feeds flag the same IOC
SELECT
  t1.source AS source_a,
  t2.source AS source_b,
  COUNT(*) AS overlap_count
FROM threats t1
JOIN threats t2
  ON t1.ioc_value = t2.ioc_value
  AND t1.source < t2.source
  AND t1.id != t2.id
WHERE t1.created_at >= datetime('now', ? || ' days')
  AND t1.ioc_value IS NOT NULL
GROUP BY t1.source, t2.source
ORDER BY overlap_count DESC
```

#### View: country × type (geographic attack patterns)

```sql
SELECT
  country_code,
  type,
  COUNT(*) AS count
FROM threats
WHERE created_at >= datetime('now', ? || ' days')
  AND country_code IS NOT NULL
GROUP BY country_code, type
ORDER BY count DESC
```

Normalize per-country into a percentage matrix (each country row sums to 1.0).

#### Response shape

```typescript
interface CorrelationResponse {
  view: "type" | "source" | "country";
  window: string;
  labels: string[];       // row/column labels
  matrix: number[][];     // correlation values -1 to 1 (or 0 to 1 for country view)
  sample_size: number;    // total threat rows in window (for confidence display)
  computed_at: string;    // ISO timestamp
}
```

#### Caching strategy

D1 JOINs on large tables can be slow. Use KV caching:
- Cache key: `correlations:${view}:${window}`
- TTL: 1 hour
- On request: check KV first, compute only if miss or expired
- Return `computed_at` so frontend can show freshness

### 2.2 Register the Route

**File:** `packages/trust-radar/src/index.ts`

Add route matching for `GET /api/threats/correlations`:

```typescript
if (path === "/api/threats/correlations" && method === "GET") {
  return handleThreatCorrelations(request, env);
}
```

### 2.3 Frontend API Client

**File:** `packages/frontend/radar/src/lib/api.ts`

Add to the `threats` object:

```typescript
correlations: (view: "type" | "source" | "country" = "type", window: string = "7d") =>
  api<{
    view: string;
    window: string;
    labels: string[];
    matrix: number[][];
    sample_size: number;
    computed_at: string;
  }>(`/threats/correlations?view=${view}&window=${window}`),
```

### 2.4 Update CorrelationMatrix Component

**File:** `packages/frontend/radar/src/components/ui/CorrelationMatrix.tsx`

Add tabbed view switching and live data fetching:

```typescript
interface Props {
  className?: string;
}

// Remove old labels/matrix props — component now fetches its own data
export function CorrelationMatrix({ className }: Props) {
  const [view, setView] = useState<"type" | "source" | "country">("type");
  const [window, setWindow] = useState("7d");

  const { data, isLoading } = useQuery({
    queryKey: ["threat-correlations", view, window],
    queryFn: () => threats.correlations(view, window),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });

  // ... tab UI for view switching
  // ... window selector (7d / 30d / 90d)
  // ... existing matrix rendering using data.labels and data.matrix
  // ... confidence indicator based on data.sample_size
  // ... "Last computed: {timeAgo(data.computed_at)}" footer
}
```

Tab labels:
- `type` → "Threat types"
- `source` → "Feed overlap"
- `country` → "Geo patterns"

---

## Phase 3 — Dashboard Restructure + deck.gl Map Migration

**Effort:** Large — this is the biggest phase
**Risk:** High — new dependencies, full component rewrite, layout restructure
**Files touched:** ~10

### 3.1 Install Dependencies

```bash
cd packages/frontend
pnpm add deck.gl @deck.gl/react @deck.gl/layers @deck.gl/geo-layers @deck.gl/core react-map-gl maplibre-gl
```

Note: `react-simple-maps` can remain installed (used by imprsn8 frontend) but will no longer be imported by the radar frontend.

### 3.2 Create New Map Component

**New file:** `packages/frontend/radar/src/components/ThreatMapGL.tsx`

This replaces `ThreatMapWidget.tsx` (1,367 lines) with a deck.gl-powered version (~600-800 lines).

#### Map setup

```typescript
import { DeckGL } from "@deck.gl/react";
import { ArcLayer, ScatterplotLayer } from "@deck.gl/layers";
import { GeoJsonLayer } from "@deck.gl/geo-layers";
import { PostProcessEffect } from "@deck.gl/core";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const INITIAL_VIEW = {
  longitude: 10,
  latitude: 20,
  zoom: 1.5,
  pitch: 0,
  bearing: 0,
};
```

#### Data layers

Reuse all existing data transformation logic from `ThreatMapWidget.tsx`:
- `COUNTRY_NAMES`, `ALPHA2_TO_NUMERIC`, `ALPHA2_COORDS`, `TARGET_COORDS` — copy directly
- `APT_ORIGIN_FALLBACK` — copy directly
- `SEV_COLORS`, `ATTACK_TYPE_COLORS` — update to use blue for non-threat colors

**GeoJsonLayer** — country boundaries with choropleth fill:

```typescript
new GeoJsonLayer({
  id: "countries",
  data: GEO_URL,
  filled: true,
  stroked: true,
  getFillColor: (feature) => {
    const count = countryThreatMap[feature.id] || 0;
    if (count === 0) return [11, 17, 32, 40];        // base navy, translucent
    if (count < 5)  return [59, 130, 246, 60];        // blue-500, low
    if (count < 20) return [59, 130, 246, 100];       // blue-500, medium
    return [37, 99, 235, 140];                         // blue-600, high
  },
  getLineColor: [30, 41, 59, 80],                     // surface-overlay
  lineWidthMinPixels: 0.5,
  pickable: true,
  onClick: (info) => handleCountryClick(info),
})
```

**ArcLayer** — animated attack arcs:

```typescript
new ArcLayer({
  id: "attack-arcs",
  data: arcData,
  getSourcePosition: (d) => d.source,
  getTargetPosition: (d) => d.target,
  getSourceColor: (d) => severityToRGB(d.severity),
  getTargetColor: (d) => [59, 130, 246, 200],         // blue destination
  getWidth: (d) => d.severity === "critical" ? 3 : d.severity === "high" ? 2 : 1,
  getTilt: 15,
  greatCircle: true,
  numSegments: 50,
  // Animation via deck.gl transitions
  transitions: {
    getSourcePosition: 1000,
    getTargetPosition: 1000,
  },
})
```

**ScatterplotLayer** — pulsing hotspots:

```typescript
new ScatterplotLayer({
  id: "hotspots",
  data: hotspotData,
  getPosition: (d) => [d.lng, d.lat],
  getFillColor: (d) => severityToRGB(d.severity),
  getRadius: (d) => Math.max(8, Math.sqrt(d.count) * 3),
  radiusScale: 1,
  radiusMinPixels: 4,
  radiusMaxPixels: 40,
  opacity: 0.7,
  pickable: true,
  // Animated pulse via time-varying radiusScale
})
```

#### Bloom / glow post-processing

```typescript
import { brightnessContrast } from "@deck.gl/core";

const postProcessEffects = [
  new PostProcessEffect(brightnessContrast, {
    brightness: 0.05,
    contrast: 0.1,
  }),
];
```

For true bloom, a custom WebGL shader can be added as a follow-up. The ArcLayer with bright colors on a dark CARTO basemap already produces a compelling glow effect due to the contrast.

#### Component structure

```typescript
export function ThreatMapGL() {
  // Reuse existing data fetching
  const { data: stats } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });

  // Existing state: viewMode, aggMode, selectedCountry, zoom
  // New: viewState for deck.gl camera control

  const layers = useMemo(() => [
    countryLayer,
    arcLayer,
    hotspotLayer,
  ], [stats, viewMode, aggMode]);

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW}
      controller={true}
      layers={layers}
      effects={postProcessEffects}
      style={{ position: "absolute", inset: 0 }}
    >
      <Map mapStyle={MAP_STYLE} />
    </DeckGL>
  );
}
```

### 3.3 Create the HUD Dashboard Layout

**New file:** `packages/frontend/radar/src/pages/CommandCenter.tsx`

This replaces both `Dashboard.tsx` and `ThreatMapPage.tsx`.

#### Layout structure

```
Full viewport (100vh - 48px header)
├── Mission Control Ribbon (absolute, top: 0, z-10)
│   └── LIVE pulse │ Threats: 847 │ Critical: 12 │ Countries: 23 │ Agents: 5
├── ThreatMapGL (absolute, fills entire viewport)
├── Left Dock Panel (absolute, left: 0, collapsible)
│   └── Live Threat Feed (scrolling list of recent threats)
├── Right Dock Panel (absolute, right: 0, collapsible)
│   └── CorrelationMatrix (tabbed: type/source/country)
└── Map Controls (absolute, bottom-right)
    └── Zoom +/-, View toggle, Fullscreen
```

#### Mission Control Ribbon

```typescript
function MissionControlRibbon() {
  const { data: stats } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });
  const ts = stats?.summary ?? {};

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10
                    flex items-center gap-4 px-4 py-1.5 rounded-lg
                    bg-[--surface-void]/80 backdrop-blur-sm
                    border border-blue-500/15 text-xs font-mono">
      <div className="flex items-center gap-1.5">
        <Pulse color="green" size="sm" />
        <span className="text-green-400 font-semibold">LIVE</span>
      </div>
      <RibbonMetric label="Threats" value={ts.total ?? 0} color="text-blue-400" />
      <RibbonMetric label="Critical" value={ts.critical ?? 0}
        color={(ts.critical ?? 0) > 0 ? "text-threat-critical" : "text-green-400"} />
      <RibbonMetric label="Countries" value={stats?.dailyStats?.countriesActive ?? 0} color="text-blue-400" />
      <RibbonMetric label="Agents" value="5 active" color="text-green-400" />
    </div>
  );
}
```

#### Dock Panels

Both panels use semi-transparent backgrounds (`bg-[--surface-void]/75 backdrop-blur-sm`) with a collapse toggle button. On mobile (< 768px), they render as bottom sheets with drag-to-expand.

```typescript
// Left panel: Live Threat Feed
function LeftDock({ collapsed, onToggle }) {
  const { data: stats } = useQuery({ queryKey: ["threat-stats"], queryFn: threats.stats });

  return (
    <div className={cn(
      "absolute left-3 top-14 bottom-16 z-10 w-[280px] rounded-lg overflow-hidden",
      "bg-[--surface-void]/80 backdrop-blur-sm border border-[--border-subtle]",
      "transition-transform duration-200",
      collapsed && "-translate-x-[calc(100%+12px)]"
    )}>
      <div className="p-3 border-b border-[--border-subtle] flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Live threat feed</span>
        <button onClick={onToggle}>
          <PanelLeft className="w-3.5 h-3.5 text-[--text-tertiary]" />
        </button>
      </div>
      <div className="overflow-y-auto max-h-full p-2 space-y-1">
        {(stats?.recentThreats ?? []).map((t) => (
          <ThreatFeedItem key={t.id} threat={t} />
        ))}
      </div>
    </div>
  );
}

// Right panel: Correlation Matrix
function RightDock({ collapsed, onToggle }) {
  return (
    <div className={cn(
      "absolute right-3 top-14 bottom-16 z-10 w-[320px] rounded-lg overflow-hidden",
      "bg-[--surface-void]/80 backdrop-blur-sm border border-[--border-subtle]",
      "transition-transform duration-200",
      collapsed && "translate-x-[calc(100%+12px)]"
    )}>
      <div className="p-3 border-b border-[--border-subtle] flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Correlation matrix</span>
        <button onClick={onToggle}>
          <PanelRight className="w-3.5 h-3.5 text-[--text-tertiary]" />
        </button>
      </div>
      <div className="p-3">
        <CorrelationMatrix />
      </div>
    </div>
  );
}
```

#### Full CommandCenter component

```typescript
export default function CommandCenter() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div className="relative w-full h-full">
      {/* Map fills entire viewport */}
      <ThreatMapGL />

      {/* Floating HUD elements */}
      <MissionControlRibbon />
      <LeftDock collapsed={leftCollapsed} onToggle={() => setLeftCollapsed(!leftCollapsed)} />
      <RightDock collapsed={rightCollapsed} onToggle={() => setRightCollapsed(!rightCollapsed)} />

      {/* Map controls (zoom, view toggle) — bottom right */}
      <MapControls />
    </div>
  );
}
```

### 3.4 Update MainLayout for Full-Viewport Dashboard

**File:** `packages/frontend/radar/src/App.tsx`

The `MainLayout` component needs to detect the `/dashboard` route and render without padding, without `SectionNav`, and with `overflow: hidden` so the map fills the viewport.

```typescript
function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isCommandCenter = location.pathname === "/dashboard";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--surface-base)" }}>
      <IdleTimeoutDialog onLogout={handleIdleLogout} />

      {/* Header — always visible */}
      <header className="h-12 flex items-center justify-between px-4 shrink-0 sticky top-0 z-20"
        style={{ background: "var(--surface-void)", borderBottom: "1px solid var(--border-subtle)" }}>
        {/* ... existing header content ... */}
      </header>

      {/* Section nav — hidden on command center */}
      {!isCommandCenter && <SectionNav />}

      {/* Main content */}
      <main
        id="main-content"
        className={cn(
          "flex-1",
          isCommandCenter
            ? "overflow-hidden relative"                    // full viewport, no scroll
            : "overflow-auto p-4 sm:p-6 pb-20"             // normal padded layout
        )}
        role="main"
      >
        {children}
      </main>

      {/* Bottom bar — always visible but transparent on command center */}
      <BottomBar className={isCommandCenter ? "bg-transparent border-transparent" : undefined} />

      <TrustBotWidget />
    </div>
  );
}
```

### 3.5 Update Routing

**File:** `packages/frontend/radar/src/App.tsx`

```typescript
// Replace these two routes:
// <Route path="/dashboard"  element={<Dashboard />} />
// <Route path="/threat-map" element={<ThreatMapPage />} />

// With:
<Route path="/dashboard" element={<CommandCenter />} />
<Route path="/threat-map" element={<Navigate to="/dashboard" replace />} />

// Also update the catch-all:
<Route path="*" element={<Navigate to="/dashboard" replace />} />
```

### 3.6 Update Navigation

**File:** `packages/frontend/radar/src/components/Sidebar.tsx`

Remove the "Threat Map" nav item from the MISSION CONTROL section:

```typescript
{
  title: "MISSION CONTROL",
  items: [
    { path: "/dashboard",      label: "Dashboard",       icon: <I d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    // REMOVED: { path: "/threat-map", ... }
    { path: "/brand-exposure", label: "Brand Exposure",  icon: /* ... */ },
    { path: "/alerts",         label: "Critical Alerts", icon: /* ... */, alertBadge: true },
    { path: "/briefing",       label: "Daily Briefing",  icon: /* ... */ },
  ],
},
```

Also update `BottomBar.tsx` if it has a separate Threat Map tab.

### 3.7 Migrate Deprecated KPIs to Feed Analytics

**File:** `packages/frontend/radar/src/pages/FeedAnalyticsPage.tsx`

Add a new section at the top of FeedAnalyticsPage that contains the migrated dashboard widgets:
- Trust Score ring (from `ScoreRing` component)
- Signal Volume & Quality area chart
- Source Mix bar chart + breakdown
- Agent Status grid
- Threat Severity horizontal bars
- Quick Actions grid

These can be wrapped in a collapsible "Platform Overview" accordion to keep the page clean.

### 3.8 Files to Archive (Not Delete)

Keep these files but they're no longer actively routed:
- `packages/frontend/radar/src/pages/Dashboard.tsx` → renamed to `Dashboard.legacy.tsx`
- `packages/frontend/radar/src/pages/ThreatMapPage.tsx` → renamed to `ThreatMapPage.legacy.tsx`
- `packages/frontend/radar/src/components/ThreatMapWidget.tsx` → renamed to `ThreatMapWidget.legacy.tsx`

The legacy files serve as reference for data transformation logic during the deck.gl migration.

---

## Phase 4 — WebSocket Real-Time Push

**Effort:** Medium-Large
**Risk:** Medium — new Cloudflare Durable Object, new client infrastructure
**Files touched:** ~6

### 4.1 Architecture

```
Feed Runner (CRON trigger)
  → writes threats to D1
  → POSTs notification to Durable Object: /internal/notify

Durable Object: ThreatPushHub
  → maintains WebSocket connections from dashboard clients
  → on notification: broadcasts { type: "new_threats", count, latest_id } to all connected clients

Frontend (CommandCenter)
  → connects WebSocket on mount
  → on "new_threats" message: invalidates react-query cache for threat-stats
  → map, feed, ribbon, correlation matrix all refresh automatically
```

### 4.2 Durable Object: ThreatPushHub

**New file:** `packages/trust-radar/src/durableObjects/ThreatPushHub.ts`

```typescript
export class ThreatPushHub {
  private sessions: Set<WebSocket> = new Set();
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal: feed runner notifies of new threats
    if (url.pathname === "/notify" && request.method === "POST") {
      const body = await request.json() as { count: number; latest_id: string };
      this.broadcast(JSON.stringify({
        type: "new_threats",
        count: body.count,
        latest_id: body.latest_id,
        timestamp: new Date().toISOString(),
      }));
      return new Response("OK", { status: 200 });
    }

    // Client: WebSocket upgrade
    if (url.pathname === "/ws") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.state.acceptWebSocket(server);
      this.sessions.add(server);

      server.addEventListener("close", () => {
        this.sessions.delete(server);
      });

      server.addEventListener("error", () => {
        this.sessions.delete(server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not Found", { status: 404 });
  }

  private broadcast(message: string) {
    for (const ws of this.sessions) {
      try {
        ws.send(message);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }
}
```

### 4.3 Register Durable Object Binding

**File:** `packages/trust-radar/wrangler.toml`

```toml
[durable_objects]
bindings = [
  { name = "THREAT_PUSH_HUB", class_name = "ThreatPushHub" }
]

[[migrations]]
tag = "v1"
new_classes = ["ThreatPushHub"]
```

### 4.4 Wire Feed Runner to Notify

**File:** `packages/trust-radar/src/lib/feedRunner.ts`

After each successful feed ingestion that creates new threats, POST to the Durable Object:

```typescript
// At the end of processFeed(), after inserting new threats:
if (newThreatsCount > 0) {
  try {
    const hubId = env.THREAT_PUSH_HUB.idFromName("global");
    const hub = env.THREAT_PUSH_HUB.get(hubId);
    await hub.fetch(new Request("https://internal/notify", {
      method: "POST",
      body: JSON.stringify({ count: newThreatsCount, latest_id: latestId }),
    }));
  } catch (e) {
    console.error("Failed to notify push hub:", e);
    // Non-fatal: feeds still work without push
  }
}
```

### 4.5 Expose WebSocket Route

**File:** `packages/trust-radar/src/index.ts`

Add a route that upgrades to WebSocket and forwards to the Durable Object:

```typescript
if (path === "/ws/threats" && request.headers.get("Upgrade") === "websocket") {
  const hubId = env.THREAT_PUSH_HUB.idFromName("global");
  const hub = env.THREAT_PUSH_HUB.get(hubId);
  return hub.fetch(new Request(new URL("/ws", request.url), {
    headers: request.headers,
  }));
}
```

### 4.6 Frontend WebSocket Hook

**New file:** `packages/frontend/radar/src/lib/useThreatPush.ts`

```typescript
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useThreatPush() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/threats`);

      ws.onopen = () => {
        console.log("[ThreatPush] Connected");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "new_threats") {
            // Invalidate all threat-related queries — map, feed, stats, correlations
            queryClient.invalidateQueries({ queryKey: ["threat-stats"] });
            queryClient.invalidateQueries({ queryKey: ["threat-correlations"] });
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        console.log("[ThreatPush] Disconnected, reconnecting in 5s...");
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [queryClient]);
}
```

### 4.7 Activate in CommandCenter

**File:** `packages/frontend/radar/src/pages/CommandCenter.tsx`

```typescript
export default function CommandCenter() {
  useThreatPush(); // activates WebSocket on mount

  // ... rest of component
}
```

---

## Phase Summary & Execution Order

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|-------------|
| **1** | Color system migration (blue primary, cyan secondary) | 1-2 days | None |
| **2** | Live correlation matrix + backend endpoint | 2-3 days | Phase 1 (for colors) |
| **3** | Dashboard restructure + deck.gl map migration | 4-6 days | Phase 1 (colors), Phase 2 (correlation component) |
| **4** | WebSocket real-time push | 2-3 days | Phase 3 (CommandCenter component to host the hook) |

**Total estimated effort:** 9-14 days

### Recommended execution:

1. Start Phase 1 immediately — low risk, unblocks everything
2. Phase 2 can run in parallel with Phase 3 prep (installing deps, scaffolding)
3. Phase 3 is the critical path — do the layout restructure first (3.3-3.6), then the deck.gl map component (3.2)
4. Phase 4 last — it layers on top of the working CommandCenter

### New Dependencies

| Package | Size (gzipped) | Purpose |
|---------|---------------|---------|
| `deck.gl` | ~180KB | WebGL visualization framework |
| `@deck.gl/react` | ~10KB | React bindings |
| `@deck.gl/layers` | ~50KB | ArcLayer, ScatterplotLayer |
| `@deck.gl/geo-layers` | ~30KB | GeoJsonLayer |
| `@deck.gl/core` | ~100KB | PostProcessEffect |
| `react-map-gl` | ~60KB | React wrapper for MapLibre |
| `maplibre-gl` | ~200KB | Open-source map renderer |

**Total bundle impact:** ~630KB gzipped (but tree-shaken — actual impact depends on which layers are imported)

### External Services

| Service | Cost | Purpose |
|---------|------|---------|
| CARTO Dark Matter tiles | Free (no key) | Dark basemap for MapLibre |
| Cloudflare Durable Objects | Free tier: 100K requests/day | WebSocket push hub |

### Cost Impact on $10-15/month MVP Target

- CARTO tiles: $0
- Durable Objects: $0 (free tier sufficient for early scale)
- No change to Railway or D1 costs
- **Total cost impact: $0**

---

## Files Created / Modified Summary

### New Files
- `packages/frontend/radar/src/components/ThreatMapGL.tsx` — deck.gl map
- `packages/frontend/radar/src/pages/CommandCenter.tsx` — HUD dashboard
- `packages/frontend/radar/src/lib/useThreatPush.ts` — WebSocket hook
- `packages/trust-radar/src/durableObjects/ThreatPushHub.ts` — push hub

### Modified Files
- `packages/frontend/radar/src/index.css` — color variables
- `packages/frontend/radar/tailwind.config.js` — color palette
- `packages/frontend/radar/src/components/ui/CorrelationMatrix.tsx` — live data + tabs
- `packages/frontend/radar/src/lib/api.ts` — correlation endpoint
- `packages/frontend/radar/src/App.tsx` — routing + layout bypass
- `packages/frontend/radar/src/components/Sidebar.tsx` — nav consolidation
- `packages/frontend/radar/src/components/BottomBar.tsx` — nav consolidation
- `packages/frontend/radar/src/pages/FeedAnalyticsPage.tsx` — migrated KPIs
- `packages/trust-radar/src/handlers/threats.ts` — correlation endpoint
- `packages/trust-radar/src/index.ts` — route + WebSocket
- `packages/trust-radar/src/lib/feedRunner.ts` — push notification
- `packages/trust-radar/wrangler.toml` — Durable Object binding

### Archived Files (renamed, not deleted)
- `Dashboard.tsx` → `Dashboard.legacy.tsx`
- `ThreatMapPage.tsx` → `ThreatMapPage.legacy.tsx`
- `ThreatMapWidget.tsx` → `ThreatMapWidget.legacy.tsx`
