# Platform Uplevel Plan — March 2026
### Trust Radar (lrx-radar.com) + imprsn8 (imprsn8.com)
### For Claude Code — Full Implementation Guide

> **How to use this file**: Hand this document to Claude Code and say:
> *"Read PLATFORM_UPLEVEL_PLAN_MARCH.md and implement each phase in order.
> Complete each phase fully before moving to the next."*

---

## EXECUTIVE SUMMARY

Two platforms. Two distinct identities. One shared FastAPI backend.

| Platform | Domain | Users | Aesthetic | Stack |
|---|---|---|---|---|
| Trust Radar | lrx-radar.com | Security teams, brand managers | Deep navy · electric cyan · signal green | CF Workers + D1 |
| imprsn8 | imprsn8.com | Creators, influencers, public figures | Black · gold · purple | CF Workers + D1 |
| LRX API | api.lrx.io | Internal only | — | FastAPI + Railway + PostgreSQL |

**Kill the product switcher.** These are separate products for separate buyers. Cross-link in footers only.

---

## PHASE 1 — TRUST RADAR HEATMAP (CRITICAL FIX)

### Root Cause Analysis

The global threat map shows city/continent text labels but no actual map canvas.

**Why:** Leaflet mounts an HTML5 `<canvas>` element to the `#map` container div. If that div has `height: auto`, `height: 0`, `height: 100%` without a sized parent, or no height declaration at all, the canvas renders at **zero pixels** and is completely invisible.

Text labels still appear because they are absolutely-positioned `<div>` elements injected by Leaflet — they do **not** depend on canvas rendering. This is exactly why you saw names but no map.

**Light mode secondary bug:** The dark-mode heat gradient (cyan → amber → red) is nearly invisible against CartoDB Positron light tiles. Plus the wrong tile layer is loaded in light mode (dark tiles on a light page).

### Fix 1A — Database Migration

**File:** `packages/trust-radar/migrations/0003_add_geolocation.sql`

```sql
-- Add geolocation columns to scans table
ALTER TABLE scans ADD COLUMN IF NOT EXISTS lat REAL;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS lng REAL;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS geo_city TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS geo_country TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS geo_country_code TEXT;

-- Index for heatmap queries
CREATE INDEX IF NOT EXISTS idx_scans_geo ON scans(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Aggregate stats table for homepage counter
CREATE TABLE IF NOT EXISTS threat_stats_hourly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hour_bucket TEXT NOT NULL,
  total_scans INTEGER DEFAULT 0,
  total_threats INTEGER DEFAULT 0,
  unique_countries INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Claude Code instruction:** Run this migration:
```bash
cd packages/trust-radar
wrangler d1 execute trust-radar-db --file=migrations/0003_add_geolocation.sql --local
wrangler d1 execute trust-radar-db --file=migrations/0003_add_geolocation.sql --remote
```

### Fix 1B — IP Geolocation in Scan Handler

**File:** `packages/trust-radar/src/handlers/scan.ts`

Find the existing scan handler and add geolocation resolution after the VirusTotal call:

```typescript
// ── ADD THIS FUNCTION to scan.ts ──────────────────────────────────────
interface GeoResult {
  lat: number;
  lng: number;
  city: string;
  country: string;
  countryCode: string;
}

async function resolveGeo(ip: string, env: Env): Promise<GeoResult | null> {
  // Skip private/loopback IPs
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }

  // Check D1 cache first — avoid re-hitting ip-api for known IPs
  const cached = await env.DB.prepare(
    'SELECT lat, lng, geo_city, geo_country, geo_country_code FROM scans WHERE ip_address = ? AND lat IS NOT NULL LIMIT 1'
  ).bind(ip).first<{ lat: number; lng: number; geo_city: string; geo_country: string; geo_country_code: string }>();

  if (cached) {
    return {
      lat: cached.lat,
      lng: cached.lng,
      city: cached.geo_city,
      country: cached.geo_country,
      countryCode: cached.geo_country_code,
    };
  }

  // ip-api.com — free tier, 45 req/min, no API key needed
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=lat,lon,city,country,countryCode,status`,
      { cf: { cacheTtl: 86400 } } // Cache at CF edge for 24h
    );
    const data = await res.json() as any;
    if (data.status !== 'success') return null;
    return {
      lat: data.lat,
      lng: data.lon,
      city: data.city,
      country: data.country,
      countryCode: data.countryCode,
    };
  } catch {
    return null;
  }
}

// ── IN YOUR EXISTING scan handler, ADD GEO RESOLUTION ─────────────────
// After computing trust score, before inserting into D1:
//
//   const clientIp = request.headers.get('CF-Connecting-IP') || 
//                    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || '';
//   const geo = await resolveGeo(clientIp, env);
//
// Then in your D1 insert, add these fields:
//   lat: geo?.lat ?? null,
//   lng: geo?.lng ?? null,
//   geo_city: geo?.city ?? null,
//   geo_country: geo?.country ?? null,
//   geo_country_code: geo?.countryCode ?? null,
```

### Fix 1C — Heatmap API Endpoint

**File:** `packages/trust-radar/src/handlers/heatmap.ts`

Create this new file:

```typescript
import { Env } from '../types';

export interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number; // 0–1, derived from (100 - trustScore) / 100
  city: string;
  country: string;
  type: 'phishing' | 'malware' | 'suspicious' | 'safe';
}

export interface HeatmapResponse {
  points: HeatPoint[];
  stats: {
    totalScans: number;
    totalThreats: number;
    uniqueCountries: number;
    lastUpdated: string;
  };
}

export async function handleHeatmap(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const hours = parseInt(url.searchParams.get('hours') || '24');
  const filter = url.searchParams.get('filter') || 'all'; // all | phishing | malware

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Aggregate by geo cell (round to 1 decimal for clustering)
  let whereClause = `WHERE created_at >= ? AND lat IS NOT NULL`;
  const params: any[] = [since];

  if (filter === 'phishing') {
    whereClause += ` AND verdict = 'phishing'`;
  } else if (filter === 'malware') {
    whereClause += ` AND verdict = 'malware'`;
  }

  const points = await env.DB.prepare(`
    SELECT
      ROUND(lat, 1) as lat,
      ROUND(lng, 1) as lng,
      geo_city as city,
      geo_country as country,
      AVG(CASE WHEN trust_score IS NOT NULL THEN (100.0 - trust_score) / 100.0 ELSE 0.5 END) as intensity,
      COUNT(*) as scan_count,
      MIN(verdict) as type
    FROM scans
    ${whereClause}
    GROUP BY ROUND(lat, 1), ROUND(lng, 1)
    ORDER BY intensity DESC
    LIMIT 500
  `).bind(...params).all<any>();

  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_scans,
      COUNT(CASE WHEN trust_score < 40 THEN 1 END) as total_threats,
      COUNT(DISTINCT geo_country_code) as unique_countries
    FROM scans
    WHERE created_at >= ?
  `).bind(since).first<any>();

  const response: HeatmapResponse = {
    points: (points.results || []).map(p => ({
      lat: p.lat,
      lng: p.lng,
      intensity: Math.min(Math.max(p.intensity, 0), 1),
      city: p.city || 'Unknown',
      country: p.country || 'Unknown',
      type: p.type || 'suspicious',
    })),
    stats: {
      totalScans: stats?.total_scans || 0,
      totalThreats: stats?.total_threats || 0,
      uniqueCountries: stats?.unique_countries || 0,
      lastUpdated: new Date().toISOString(),
    },
  };

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60', // Cache for 1 min
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

**Wire into router** in `packages/trust-radar/src/index.ts`:
```typescript
// Add to route handler:
if (path === '/api/heatmap' && method === 'GET') {
  return handleHeatmap(request, env);
}
```

### Fix 1D — THE MAP COMPONENT (Full Replacement)

**File:** `packages/trust-radar/src/templates/heatmap-component.ts`

Create this file. It exports an HTML string to be injected into the dashboard template:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// TRUST RADAR — GLOBAL THREAT HEATMAP COMPONENT
//
// BUG FIXES DOCUMENTED HERE:
//
// BUG 1 (CRITICAL): Map canvas renders at 0px height — invisible
//   Root cause: #map div had no explicit height declaration.
//   Leaflet requires a real pixel height at mount time.
//   Fix: #map { height: 520px; width: 100%; display: block; }
//   NEVER use height: auto or height: 100% without a sized parent.
//
// BUG 2 (LIGHT MODE): Heat blobs invisible on CartoDB Positron tiles
//   Root cause: cyan/amber/red gradient has near-zero contrast on white.
//   Fix: swap gradient in light mode → cobalt/burnt-orange/deep-red.
//   Also: reduce blur (28→22) and raise minOpacity (0.05→0.25).
//
// BUG 3 (LIGHT MODE): Dark tile layer active on light-mode page
//   Root cause: tile layer not swapped when theme changes.
//   Fix: setTheme() calls applyTileLayer() + applyHeatLayer() together.
// ─────────────────────────────────────────────────────────────────────────────

export const HEATMAP_CSS = `
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<style>
  /* ── CRITICAL HEIGHT FIX ──────────────────────────────────────────────── */
  /* height MUST be explicit pixels. Never auto or % without sized parent.   */
  #threat-map {
    height: 520px;
    width: 100%;
    display: block;  /* Prevent inline/flex collapse to 0 */
    z-index: 1;
    border-radius: 0 0 8px 8px;
  }

  .map-wrap { position: relative; }

  /* ── LEAFLET CONTROLS — DARK MODE ────────────────────────────────────── */
  [data-theme="dark"] .leaflet-control-zoom a {
    background: #0F1628;
    color: #E2E8F0;
    border-color: rgba(0,245,255,0.15);
  }
  [data-theme="dark"] .leaflet-control-zoom a:hover {
    background: #1A2340;
  }
  [data-theme="dark"] .leaflet-control-attribution {
    background: rgba(10,14,26,0.75);
    color: #64748B;
    font-size: 10px;
  }

  /* ── LEAFLET CONTROLS — LIGHT MODE ──────────────────────────────────── */
  [data-theme="light"] .leaflet-control-zoom a {
    background: #ffffff;
    color: #0F1628;
    border-color: #CBD5E1;
  }
  [data-theme="light"] .leaflet-control-zoom a:hover {
    background: #F1F5F9;
  }
  [data-theme="light"] .leaflet-control-attribution {
    background: rgba(255,255,255,0.85);
    color: #64748B;
    font-size: 10px;
  }

  /* ── TOOLTIPS ─────────────────────────────────────────────────────────── */
  .leaflet-tooltip-threat {
    background: var(--surface, #0F1628) !important;
    border: 1px solid var(--border, rgba(0,245,255,0.15)) !important;
    color: var(--text, #E2E8F0) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 11px !important;
    border-radius: 5px !important;
    padding: 6px 10px !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important;
  }

  /* ── MAP OVERLAY BADGE ───────────────────────────────────────────────── */
  .map-live-badge {
    position: absolute;
    top: 14px; left: 14px;
    z-index: 500;
    background: var(--surface, #0F1628);
    border: 1px solid var(--border, rgba(0,245,255,0.15));
    border-radius: 6px;
    padding: 8px 14px;
    pointer-events: none;
    backdrop-filter: blur(8px);
  }
  .map-live-badge .count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 700;
    color: var(--cyan, #00F5FF);
    line-height: 1;
  }
  .map-live-badge .label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--subtext, #64748B);
    margin-top: 2px;
    letter-spacing: 0.5px;
  }
  [data-theme="light"] .map-live-badge .count {
    color: #0066CC;
  }

  /* ── MODE TOGGLE ─────────────────────────────────────────────────────── */
  .map-mode-toggle {
    display: flex;
    background: var(--surface, #0F1628);
    border: 1px solid var(--border, rgba(0,245,255,0.15));
    border-radius: 6px;
    padding: 3px;
    gap: 2px;
  }
  .map-mode-btn {
    padding: 5px 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    background: transparent;
    color: var(--subtext, #64748B);
    transition: all 0.2s;
  }
  .map-mode-btn.active {
    background: var(--surface2, #1A2340);
    color: var(--text, #E2E8F0);
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }

  /* ── LEGEND BAR ──────────────────────────────────────────────────────── */
  .heat-legend-bar {
    height: 8px;
    border-radius: 4px;
    width: 100%;
  }
  [data-theme="dark"] .heat-legend-bar {
    background: linear-gradient(to right, #00f5ff, #f59e0b, #ef4444);
  }
  [data-theme="light"] .heat-legend-bar {
    background: linear-gradient(to right, #1a56db, #c05621, #991b1b);
  }
</style>
`;

export const HEATMAP_HTML = `
<div class="map-wrap">
  <div id="threat-map"></div>
  <div class="map-live-badge">
    <div class="count" id="hm-threat-count">—</div>
    <div class="label">threats · 24h</div>
  </div>
</div>
`;

export const HEATMAP_SCRIPTS = `
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
// ── Leaflet.heat — inlined (MIT, Leaflet/Leaflet.heat) ─────────────────────
// Inlined to avoid CDN dependency; paste full minified source from:
// https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js
// [paste minified leaflet-heat.js here]
</script>
<script>
(function() {
  // ── TILE LAYER CONFIGS ───────────────────────────────────────────────────
  // Dark mode: CartoDB Dark Matter — designed for high-contrast data viz
  // Light mode: CartoDB Positron — clean, minimal, good contrast base
  //
  // GRADIENT RULES:
  // Dark tiles: use bright/neon hues (cyan, amber, red) — they pop on dark
  // Light tiles: use deep/saturated hues (cobalt, burnt-orange, deep-red)
  //              Bright neon becomes invisible against near-white tile base.
  //              NEVER reuse the dark gradient in light mode.
  //
  const TILE_CONFIGS = {
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      gradient: { 0.15: '#00f5ff', 0.45: '#f59e0b', 0.75: '#ef4444', 1.0: '#ff0000' },
      minOpacity: 0.07,
      blur: 28,
      radius: 38,
    },
    light: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      // Deep cobalt (replaces cyan), burnt orange (replaces amber),
      // deep red (replaces bright red) — all readable on white/beige tiles
      gradient: { 0.15: '#1a56db', 0.45: '#c05621', 0.75: '#991b1b', 1.0: '#7f1d1d' },
      minOpacity: 0.25, // Higher floor — low-risk blobs need more opacity on light
      blur: 22,          // Less blur — sharper blobs, better contrast on light base
      radius: 38,
    },
  };

  let map, tileLayer, heatLayer;
  let currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  let currentFilter = 'all';
  let heatData = [];

  // ── INITIALIZE MAP ────────────────────────────────────────────────────────
  function initMap() {
    // Must be called AFTER DOMContentLoaded — container must have real height
    map = L.map('threat-map', {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
      preferCanvas: true,
    }).setView([25, 15], 2);

    applyTileLayer(currentTheme);
    loadHeatData();
  }

  // ── TILE LAYER SWAP ───────────────────────────────────────────────────────
  function applyTileLayer(theme) {
    if (tileLayer) tileLayer.remove();
    tileLayer = L.tileLayer(TILE_CONFIGS[theme].url, {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '© OpenStreetMap © CartoDB',
    }).addTo(map);
  }

  // ── HEAT LAYER SWAP ───────────────────────────────────────────────────────
  function applyHeatLayer(theme, data) {
    const cfg = TILE_CONFIGS[theme];
    if (heatLayer) heatLayer.remove();
    if (!data || data.length === 0) return;

    heatLayer = L.heatLayer(data.map(p => [p.lat, p.lng, p.intensity]), {
      radius: cfg.radius,
      blur: cfg.blur,
      maxZoom: 6,
      max: 1.0,
      minOpacity: cfg.minOpacity,
      gradient: cfg.gradient,
    }).addTo(map);
  }

  // ── FETCH REAL DATA FROM API ──────────────────────────────────────────────
  async function loadHeatData() {
    try {
      const params = new URLSearchParams({ hours: '24', filter: currentFilter });
      const res = await fetch('/api/heatmap?' + params);
      const json = await res.json();
      heatData = json.points || [];

      // Update badge counter
      const el = document.getElementById('hm-threat-count');
      if (el) el.textContent = (json.stats?.totalThreats || 0).toLocaleString();

      // Add hotspot markers with tooltips
      addMarkers(heatData.slice(0, 20));

      applyHeatLayer(currentTheme, heatData);
    } catch (err) {
      console.error('Heatmap data load failed:', err);
    }
  }

  // ── HOTSPOT MARKERS ───────────────────────────────────────────────────────
  function addMarkers(points) {
    points.forEach(p => {
      const score = Math.round((1 - p.intensity) * 100);
      const color = score < 30 ? '#ef4444' : score < 60 ? '#f59e0b' : '#22c55e';
      L.circleMarker([p.lat, p.lng], {
        radius: 4,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1.5,
      })
      .bindTooltip(
        '<strong>' + p.city + ', ' + p.country + '</strong><br/>' +
        'Trust score: <strong style="color:' + color + '">' + score + '</strong>',
        { className: 'leaflet-tooltip-threat', sticky: true, direction: 'top' }
      )
      .addTo(map);
    });
  }

  // ── PUBLIC API — call from theme switcher ─────────────────────────────────
  window.heatmapSetTheme = function(theme) {
    currentTheme = theme;
    applyTileLayer(theme);
    applyHeatLayer(theme, heatData);
    setTimeout(() => map.invalidateSize(), 50); // Reflow safety
  };

  window.heatmapSetFilter = function(filter) {
    currentFilter = filter;
    loadHeatData();
  };

  // ── BOOT ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', initMap);

  // Refresh every 60 seconds
  setInterval(loadHeatData, 60000);
})();
</script>
`;
```

---

## PHASE 2 — TRUST RADAR HOMEPAGE

### 2A — Public Homepage Structure

**File:** `packages/trust-radar/src/templates/homepage.ts`

The homepage needs these sections in order:
1. Nav bar (logo + Login + Sign Up CTAs)
2. Hero — scan input bar, live on page load, no account required
3. Live result panel — renders inline below the input
4. Global threat map section (full width)
5. How It Works — 3 columns
6. Pricing strip
7. Footer

**Claude Code: Create `packages/trust-radar/src/templates/homepage.ts`**

```typescript
export function renderHomepage(): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Trust Radar — Know Before You Click</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  ${HEATMAP_CSS}
  <style>
    :root {
      --cyan:    #00F5FF;
      --amber:   #F59E0B;
      --red:     #EF4444;
      --green:   #22C55E;
      --navy:    #0A0E1A;
      --surface: #0F1628;
      --surface2: #1A2340;
      --border:  rgba(0,245,255,0.12);
      --text:    #E2E8F0;
      --subtext: #64748B;
    }
    [data-theme="light"] {
      --navy:    #F0F4F8;
      --surface: #FFFFFF;
      --surface2: #E2E8F0;
      --border:  rgba(15,30,80,0.12);
      --text:    #0F1628;
      --subtext: #475569;
      --cyan:    #0066CC;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: var(--navy); color: var(--text); font-family: 'Inter', sans-serif; }

    /* ── NAV ── */
    nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 32px; height: 60px;
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
      background: var(--navy);
      backdrop-filter: blur(12px);
    }
    .nav-logo {
      font-family: 'JetBrains Mono', monospace;
      font-size: 17px; font-weight: 700;
      color: var(--text);
    }
    .nav-logo span { color: var(--cyan); }
    .nav-actions { display: flex; gap: 10px; align-items: center; }
    .btn-ghost {
      padding: 7px 14px; border-radius: 6px;
      border: 1px solid var(--border);
      background: transparent; color: var(--text);
      font-family: 'Inter', sans-serif; font-size: 13px;
      cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
      transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: var(--cyan); color: var(--cyan); }
    .btn-primary {
      padding: 7px 16px; border-radius: 6px;
      border: none; background: var(--cyan);
      color: #0A0E1A;
      font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
      transition: all 0.15s;
    }
    .btn-primary:hover { opacity: 0.88; }

    /* ── HERO ── */
    .hero {
      max-width: 760px; margin: 0 auto;
      padding: 80px 24px 60px;
      text-align: center;
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 4px 12px; border-radius: 20px;
      border: 1px solid var(--border);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; letter-spacing: 1px;
      color: var(--cyan); text-transform: uppercase;
      margin-bottom: 28px;
    }
    .hero h1 {
      font-family: 'JetBrains Mono', monospace;
      font-size: clamp(32px, 5vw, 52px);
      font-weight: 700; line-height: 1.1;
      letter-spacing: -1px;
      margin-bottom: 18px;
    }
    .hero p {
      font-size: 17px; color: var(--subtext);
      line-height: 1.65; margin-bottom: 36px;
    }

    /* ── SCAN BAR ── */
    .scan-bar {
      display: flex; gap: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      max-width: 600px; margin: 0 auto 12px;
      transition: border-color 0.2s;
    }
    .scan-bar:focus-within { border-color: var(--cyan); }
    .scan-bar input {
      flex: 1; padding: 14px 18px;
      background: transparent;
      border: none; outline: none;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
    }
    .scan-bar input::placeholder { color: var(--subtext); }
    .scan-bar button {
      padding: 14px 22px;
      background: var(--cyan);
      border: none; cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px; font-weight: 700;
      color: #0A0E1A;
      letter-spacing: 0.5px;
      transition: opacity 0.15s;
    }
    .scan-bar button:hover { opacity: 0.88; }
    .scan-hint {
      font-size: 12px; color: var(--subtext);
      font-family: 'JetBrains Mono', monospace;
    }

    /* ── INLINE SCAN RESULT ── */
    #scan-result {
      max-width: 600px; margin: 20px auto 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px 24px;
      display: none;
      text-align: left;
    }
    #scan-result.visible { display: block; animation: slide-in 0.3s ease; }
    @keyframes slide-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .result-score-row {
      display: flex; align-items: center; gap: 16px; margin-bottom: 16px;
    }
    .score-ring {
      width: 72px; height: 72px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 22px; font-weight: 700;
      border: 3px solid;
      flex-shrink: 0;
    }
    .score-ring.safe   { border-color: #22c55e; color: #22c55e; }
    .score-ring.warn   { border-color: #f59e0b; color: #f59e0b; }
    .score-ring.danger { border-color: #ef4444; color: #ef4444; }
    .result-verdict { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .result-domain  { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--subtext); }
    .result-signals {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .signal-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: var(--subtext);
    }
    .signal-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .signal-dot.pass { background: #22c55e; }
    .signal-dot.warn { background: #f59e0b; }
    .signal-dot.fail { background: #ef4444; }

    /* ── MAP SECTION ── */
    .map-section {
      max-width: 1280px; margin: 0 auto;
      padding: 0 24px 48px;
    }
    .section-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; letter-spacing: 2px;
      text-transform: uppercase; color: var(--subtext);
      margin-bottom: 8px;
    }
    .section-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 22px; font-weight: 700;
      margin-bottom: 20px; color: var(--text);
    }
    .map-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .map-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid var(--border);
      flex-wrap: wrap; gap: 8px;
    }
    .live-indicator {
      display: flex; align-items: center; gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; letter-spacing: 1px;
      text-transform: uppercase; color: var(--text);
    }
    .live-dot {
      width: 7px; height: 7px; background: var(--red);
      border-radius: 50%;
      animation: blink 1.5s ease-in-out infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .filter-tabs { display: flex; gap: 6px; }
    .filter-tab {
      padding: 4px 10px; border-radius: 4px;
      border: 1px solid var(--border);
      background: transparent; cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; text-transform: uppercase;
      color: var(--subtext); transition: all 0.2s;
    }
    .filter-tab:hover { color: var(--text); border-color: var(--cyan); }
    .filter-tab.active {
      background: rgba(0,245,255,0.08);
      color: var(--cyan); border-color: var(--cyan);
    }

    /* ── HOW IT WORKS ── */
    .how-section {
      max-width: 960px; margin: 0 auto;
      padding: 48px 24px;
      text-align: center;
    }
    .how-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 24px; margin-top: 36px;
    }
    @media (max-width: 640px) { .how-grid { grid-template-columns: 1fr; } }
    .how-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 28px 22px;
      text-align: left;
    }
    .how-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 32px; font-weight: 700;
      color: var(--cyan); opacity: 0.3;
      margin-bottom: 12px;
    }
    .how-title {
      font-size: 15px; font-weight: 600;
      margin-bottom: 8px; color: var(--text);
    }
    .how-body { font-size: 13px; color: var(--subtext); line-height: 1.6; }

    /* ── PRICING ── */
    .pricing-strip {
      background: var(--surface);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      padding: 48px 24px;
    }
    .pricing-grid {
      max-width: 720px; margin: 0 auto;
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 560px) { .pricing-grid { grid-template-columns: 1fr; } }
    .pricing-card {
      background: var(--navy);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 24px;
    }
    .pricing-card.featured { border-color: var(--cyan); }
    .pricing-tier {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; letter-spacing: 1.5px;
      text-transform: uppercase; color: var(--subtext);
      margin-bottom: 8px;
    }
    .pricing-price {
      font-family: 'JetBrains Mono', monospace;
      font-size: 32px; font-weight: 700;
      color: var(--text); margin-bottom: 4px;
    }
    .pricing-price span { font-size: 14px; color: var(--subtext); }
    .pricing-features { margin: 16px 0; }
    .pricing-feature {
      font-size: 13px; color: var(--subtext);
      padding: 4px 0;
      display: flex; gap: 8px; align-items: flex-start;
    }
    .pricing-feature::before { content: '✓'; color: var(--green); flex-shrink: 0; }
  </style>
</head>
<body>

<nav>
  <div class="nav-logo">Trust<span>Radar</span></div>
  <div class="nav-actions">
    <a href="/login" class="btn-ghost">Log in</a>
    <a href="/register" class="btn-primary">Get Started Free</a>
    <div class="map-mode-toggle">
      <button class="map-mode-btn active" id="btn-dark" onclick="setPageTheme('dark')">Dark</button>
      <button class="map-mode-btn" id="btn-light" onclick="setPageTheme('light')">Light</button>
    </div>
  </div>
</nav>

<section class="hero">
  <div class="hero-badge">
    <div class="live-dot"></div>
    Real-time threat intelligence
  </div>
  <h1>Know Before<br/>You Click.</h1>
  <p>Real-time trust scoring for URLs, domains, and digital identities.<br/>
  Powered by AI. No account required to try.</p>

  <div class="scan-bar">
    <input type="text" id="scan-input" placeholder="paste any URL — e.g. https://suspicious-site.xyz"
           onkeydown="if(event.key==='Enter') runScan()"/>
    <button onclick="runScan()">SCAN →</button>
  </div>
  <div class="scan-hint">Free · No signup required · Results in &lt;2s</div>

  <div id="scan-result"></div>
</section>

<section class="map-section">
  <div class="section-label">Live Intelligence</div>
  <div class="section-title">Global Threat Activity</div>
  <div class="map-card">
    <div class="map-toolbar">
      <div class="live-indicator">
        <div class="live-dot"></div>
        <span id="map-counter">Loading...</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <div class="filter-tabs">
          <button class="filter-tab active" onclick="setMapFilter('all',this)">All</button>
          <button class="filter-tab" onclick="setMapFilter('phishing',this)">Phishing</button>
          <button class="filter-tab" onclick="setMapFilter('malware',this)">Malware</button>
        </div>
      </div>
    </div>
    ${HEATMAP_HTML}
  </div>
</section>

<section class="how-section">
  <div class="section-label">How It Works</div>
  <div class="section-title">Three steps to a trust verdict</div>
  <div class="how-grid">
    <div class="how-card">
      <div class="how-num">01</div>
      <div class="how-title">Paste Any URL</div>
      <div class="how-body">Drop in any link — a phishing attempt, a suspicious email redirect, or a domain you've never seen before.</div>
    </div>
    <div class="how-card">
      <div class="how-num">02</div>
      <div class="how-title">AI Agents Analyze</div>
      <div class="how-body">Five specialized agents check domain age, SSL cert, redirect chains, VirusTotal hits, and registrar reputation — simultaneously.</div>
    </div>
    <div class="how-card">
      <div class="how-num">03</div>
      <div class="how-title">Verdict in Seconds</div>
      <div class="how-body">Get a trust score 0–100, a plain-English explanation, and actionable signal breakdown. Share the report with one click.</div>
    </div>
  </div>
</section>

<section class="pricing-strip">
  <div style="text-align:center;margin-bottom:32px;">
    <div class="section-label">Pricing</div>
    <div class="section-title">Start free. Scale when ready.</div>
  </div>
  <div class="pricing-grid">
    <div class="pricing-card">
      <div class="pricing-tier">Free</div>
      <div class="pricing-price">$0 <span>/ month</span></div>
      <div class="pricing-features">
        <div class="pricing-feature">10 scans per day</div>
        <div class="pricing-feature">Basic trust score</div>
        <div class="pricing-feature">Scan history (7 days)</div>
        <div class="pricing-feature">Global threat map</div>
      </div>
      <a href="/register" class="btn-ghost" style="width:100%;justify-content:center;">Start Free</a>
    </div>
    <div class="pricing-card featured">
      <div class="pricing-tier" style="color:var(--cyan)">Pro</div>
      <div class="pricing-price">$12 <span>/ month</span></div>
      <div class="pricing-features">
        <div class="pricing-feature">Unlimited scans</div>
        <div class="pricing-feature">Full signal breakdown</div>
        <div class="pricing-feature">AI scan insights</div>
        <div class="pricing-feature">API access</div>
        <div class="pricing-feature">Team dashboard</div>
        <div class="pricing-feature">History forever</div>
      </div>
      <a href="/register?plan=pro" class="btn-primary" style="width:100%;justify-content:center;">Start Pro Trial</a>
    </div>
  </div>
</section>

${HEATMAP_SCRIPTS}
<script>
// ── INLINE SCAN DEMO ─────────────────────────────────────────────────────
async function runScan() {
  const input = document.getElementById('scan-input');
  const result = document.getElementById('scan-result');
  const url = input.value.trim();
  if (!url) return;

  result.className = 'visible';
  result.innerHTML = '<div style="text-align:center;padding:20px;font-family:JetBrains Mono,monospace;color:var(--subtext)">Scanning...</div>';

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    const score = data.trust_score ?? data.score ?? 50;
    const cls = score >= 70 ? 'safe' : score >= 40 ? 'warn' : 'danger';
    const verdict = score >= 70 ? '✓ Appears Safe' : score >= 40 ? '⚠ Suspicious' : '✗ High Risk';

    result.innerHTML = \`
      <div class="result-score-row">
        <div class="score-ring \${cls}">\${score}</div>
        <div>
          <div class="result-verdict">\${verdict}</div>
          <div class="result-domain">\${url.replace(/^https?:\\/\\//, '').split('/')[0]}</div>
        </div>
      </div>
      <div class="result-signals">
        \${renderSignals(data.signals || [])}
      </div>
    \`;
  } catch {
    result.innerHTML = '<div style="color:var(--red);font-size:13px;">Scan failed — check the URL and try again.</div>';
  }
}

function renderSignals(signals) {
  const defaults = [
    { label: 'Domain age', status: 'pass' },
    { label: 'SSL certificate', status: 'pass' },
    { label: 'Redirect chain', status: 'warn' },
    { label: 'VirusTotal', status: 'pass' },
  ];
  const items = signals.length ? signals : defaults;
  return items.map(s => \`
    <div class="signal-row">
      <div class="signal-dot \${s.status}"></div>
      \${s.label}
    </div>
  \`).join('');
}

// ── PAGE THEME ────────────────────────────────────────────────────────────
function setPageTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('btn-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('btn-light').classList.toggle('active', theme === 'light');
  if (typeof window.heatmapSetTheme === 'function') {
    window.heatmapSetTheme(theme);
  }
}

function setMapFilter(filter, btn) {
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (typeof window.heatmapSetFilter === 'function') {
    window.heatmapSetFilter(filter);
  }
}

// ── MAP COUNTER ───────────────────────────────────────────────────────────
async function updateMapCounter() {
  try {
    const res = await fetch('/api/heatmap?hours=24');
    const data = await res.json();
    const el = document.getElementById('map-counter');
    if (el && data.stats) {
      el.textContent = data.stats.totalThreats.toLocaleString()
        + ' threats detected across '
        + data.stats.uniqueCountries + ' countries · last 24h';
    }
  } catch {}
}
updateMapCounter();
</script>
</body></html>`;
}
```

---

## PHASE 3 — TRUST RADAR DASHBOARD UPLEVEL

### 3A — Scan Result Page (Enhanced)

**File:** `packages/trust-radar/src/templates/scan-result.ts`

The current scan result likely shows just a trust score number. Replace with:

```typescript
export function renderScanResult(scan: ScanRecord, aiInsight?: string): string {
  const score = scan.trust_score;
  const cls = score >= 70 ? 'safe' : score >= 40 ? 'warn' : 'danger';
  const verdict = score >= 70 ? 'Appears Safe' : score >= 40 ? 'Suspicious' : 'High Risk';
  const verdictColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  // Signal rows — derive from scan data
  const signals = [
    {
      label: 'Domain Age',
      value: scan.domain_age_days ? `${scan.domain_age_days} days` : 'Unknown',
      status: !scan.domain_age_days ? 'warn' : scan.domain_age_days < 90 ? 'fail' : 'pass',
      detail: scan.domain_age_days && scan.domain_age_days < 90 ? 'New domains are higher risk' : '',
    },
    {
      label: 'SSL Certificate',
      value: scan.ssl_valid ? 'Valid' : 'Invalid or missing',
      status: scan.ssl_valid ? 'pass' : 'fail',
      detail: scan.ssl_issuer || '',
    },
    {
      label: 'Redirect Chain',
      value: scan.redirect_count ? `${scan.redirect_count} redirect(s)` : 'None',
      status: !scan.redirect_count ? 'pass' : scan.redirect_count > 3 ? 'fail' : 'warn',
      detail: scan.final_url && scan.final_url !== scan.url ? `Final: ${scan.final_url}` : '',
    },
    {
      label: 'VirusTotal',
      value: scan.vt_detections ? `${scan.vt_detections} detections` : 'Clean',
      status: !scan.vt_detections ? 'pass' : scan.vt_detections > 5 ? 'fail' : 'warn',
      detail: scan.vt_detections ? `Flagged by ${scan.vt_detections} engines` : '',
    },
    {
      label: 'Registrar Reputation',
      value: scan.registrar || 'Unknown',
      status: scan.registrar_risk || 'pass',
      detail: '',
    },
    {
      label: 'IP Geolocation',
      value: scan.geo_city ? `${scan.geo_city}, ${scan.geo_country}` : 'Unknown',
      status: 'info',
      detail: '',
    },
  ];

  return `
  <div class="scan-result-card">
    <div class="sr-header">
      <div class="sr-score-ring sr-${cls}">
        <span class="sr-score-num">${score}</span>
        <span class="sr-score-label">/ 100</span>
      </div>
      <div class="sr-meta">
        <div class="sr-verdict" style="color:${verdictColor}">${verdict}</div>
        <div class="sr-url">${scan.url}</div>
        <div class="sr-scanned">Scanned ${new Date(scan.created_at).toLocaleString()}</div>
      </div>
      <div class="sr-actions">
        <button onclick="window.open('/scan/${scan.id}/share','_blank')" class="btn-ghost">Share Report</button>
      </div>
    </div>

    ${aiInsight ? `
    <div class="sr-ai-insight">
      <div class="sr-ai-label">🤖 AI Insight</div>
      <div class="sr-ai-text">${aiInsight}</div>
    </div>` : ''}

    <div class="sr-signals">
      <div class="sr-signals-title">Signal Breakdown</div>
      <div class="sr-signals-grid">
        ${signals.map(s => `
        <div class="sr-signal-row sr-signal-${s.status}">
          <div class="sr-signal-dot sr-dot-${s.status}"></div>
          <div class="sr-signal-label">${s.label}</div>
          <div class="sr-signal-value">${s.value}</div>
          ${s.detail ? `<div class="sr-signal-detail">${s.detail}</div>` : ''}
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}
```

### 3B — AI Scan Insight Integration

**File:** `packages/trust-radar/src/handlers/scan.ts` (addition)

```typescript
// After running the scan, if user is authenticated, fetch AI insight
async function getAIInsight(scanData: ScanRecord, env: Env): Promise<string | null> {
  try {
    const res = await fetch('https://api.lrx.io/api/ai/scan-insight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.LRX_API_KEY,
      },
      body: JSON.stringify({
        url: scanData.url,
        trust_score: scanData.trust_score,
        signals: {
          domain_age_days: scanData.domain_age_days,
          ssl_valid: scanData.ssl_valid,
          redirect_count: scanData.redirect_count,
          vt_detections: scanData.vt_detections,
          registrar: scanData.registrar,
          geo_country: scanData.geo_country,
        },
      }),
    });
    const data = await res.json() as any;
    return data.insight || null;
  } catch {
    return null;
  }
}
```

---

## PHASE 4 — IMPRSN8 HOMEPAGE

### Design Identity
- **Colors:** Black (#0A0A0A) · Gold (#D4AF37) · Purple (#7C3AED) · Red (#EF4444)
- **Typography:** Clash Display (headers — via CDN) + Geist (body)
- **Aesthetic:** Editorial intelligence. Agency-grade. Theatrical.
- **NO switcher to Trust Radar** — separate products, footer cross-link only

### 4A — Homepage

**File:** `packages/imprsn8/src/templates/homepage.ts`

```typescript
export function renderImprsn8Homepage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>imprsn8 — Your Digital Impression Score</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <!-- Clash Display via CDN -->
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"/>
  <!-- Geist -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.0.0/dist/fonts/geist-sans/style.css"/>
  <style>
    :root {
      --black:   #0A0A0A;
      --surface: #111111;
      --surface2: #1A1A1A;
      --border:  rgba(212,175,55,0.15);
      --gold:    #D4AF37;
      --purple:  #7C3AED;
      --red:     #EF4444;
      --green:   #22C55E;
      --text:    #F5F5F5;
      --subtext: #71717A;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: var(--black);
      color: var(--text);
      font-family: 'Geist Sans', 'Inter', sans-serif;
    }

    /* ── NAV ── */
    nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 40px; height: 64px;
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
      background: rgba(10,10,10,0.9);
      backdrop-filter: blur(16px);
    }
    .imprsn8-logo {
      font-family: 'Clash Display', sans-serif;
      font-size: 20px; font-weight: 700;
      letter-spacing: -0.5px;
      color: var(--text);
    }
    .imprsn8-logo span { color: var(--gold); }

    /* ── HERO ── */
    .hero {
      min-height: 90vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 80px 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 600px 400px at 50% 60%,
          rgba(124,58,237,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 400px 300px at 70% 30%,
          rgba(212,175,55,0.08) 0%, transparent 60%);
      pointer-events: none;
    }
    .hero-eyebrow {
      font-family: 'Clash Display', sans-serif;
      font-size: 11px; letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--gold); opacity: 0.8;
      margin-bottom: 24px;
    }
    .hero h1 {
      font-family: 'Clash Display', sans-serif;
      font-size: clamp(42px, 7vw, 80px);
      font-weight: 700; line-height: 1.05;
      letter-spacing: -2px;
      margin-bottom: 24px;
      max-width: 800px;
    }
    .hero h1 em {
      font-style: normal;
      background: linear-gradient(135deg, var(--gold), #f7d97c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub {
      font-size: 18px; color: var(--subtext);
      line-height: 1.65; max-width: 560px;
      margin-bottom: 40px;
    }
    .hero-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn-gold {
      padding: 14px 28px; border-radius: 8px;
      border: none; background: var(--gold);
      color: #0A0A0A;
      font-family: 'Clash Display', sans-serif;
      font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      transition: all 0.15s;
    }
    .btn-gold:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .btn-outline-gold {
      padding: 14px 28px; border-radius: 8px;
      border: 1px solid rgba(212,175,55,0.4);
      background: transparent; color: var(--gold);
      font-family: 'Clash Display', sans-serif;
      font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      transition: all 0.2s;
    }
    .btn-outline-gold:hover { border-color: var(--gold); background: rgba(212,175,55,0.06); }

    /* ── SCORE DEMO WIDGET ── */
    .score-demo {
      margin-top: 60px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px 36px;
      max-width: 480px;
      width: 100%;
      position: relative;
    }
    .score-demo-label {
      font-family: 'Clash Display', sans-serif;
      font-size: 11px; letter-spacing: 2px;
      text-transform: uppercase; color: var(--subtext);
      margin-bottom: 20px;
    }
    .score-ring-large {
      width: 120px; height: 120px;
      border-radius: 50%;
      border: 4px solid var(--gold);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      margin: 0 auto 20px;
      position: relative;
    }
    .score-ring-large::before {
      content: '';
      position: absolute; inset: -8px;
      border-radius: 50%;
      background: conic-gradient(var(--gold) 0deg 273deg, rgba(212,175,55,0.1) 273deg 360deg);
      z-index: -1;
      filter: blur(2px);
    }
    .score-num-large {
      font-family: 'Clash Display', sans-serif;
      font-size: 38px; font-weight: 700; color: var(--gold); line-height: 1;
    }
    .score-sub-large { font-size: 11px; color: var(--subtext); }
    .score-components {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .score-comp {
      background: var(--surface2);
      border-radius: 8px; padding: 10px 12px;
    }
    .score-comp-label { font-size: 11px; color: var(--subtext); margin-bottom: 4px; }
    .score-comp-val {
      font-family: 'Clash Display', sans-serif;
      font-size: 18px; font-weight: 600;
    }

    /* ── FEATURE SECTIONS ── */
    .features { padding: 80px 24px; max-width: 1100px; margin: 0 auto; }
    .feature-row {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 60px; align-items: center; margin-bottom: 100px;
    }
    .feature-row.reverse { direction: rtl; }
    .feature-row.reverse > * { direction: ltr; }
    @media (max-width: 768px) {
      .feature-row, .feature-row.reverse { grid-template-columns: 1fr; direction: ltr; }
    }
    .feature-eyebrow {
      font-family: 'Clash Display', sans-serif;
      font-size: 10px; letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--gold); margin-bottom: 16px;
    }
    .feature-title {
      font-family: 'Clash Display', sans-serif;
      font-size: clamp(26px, 3vw, 36px);
      font-weight: 700; line-height: 1.15;
      letter-spacing: -0.5px; margin-bottom: 16px;
    }
    .feature-body {
      font-size: 15px; color: var(--subtext);
      line-height: 1.7; margin-bottom: 24px;
    }
    .feature-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 28px;
      min-height: 260px;
      display: flex; flex-direction: column;
      justify-content: space-between;
    }

    /* ── WAR ROOM TEASER (agent animation) ── */
    .agent-row {
      display: flex; flex-direction: column; gap: 10px;
    }
    .agent-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface2);
      border-radius: 8px; padding: 10px 14px;
      border: 1px solid transparent;
      transition: border-color 0.3s;
    }
    .agent-card.scanning { border-color: var(--purple); }
    .agent-card.done     { border-color: rgba(34,197,94,0.3); }
    .agent-icon { font-size: 18px; }
    .agent-name { flex: 1; font-size: 13px; color: var(--text); }
    .agent-status {
      font-size: 11px;
      font-family: 'Geist Sans', monospace;
    }
    .agent-status.scanning { color: var(--purple); animation: pulse-text 1s ease-in-out infinite; }
    .agent-status.done     { color: var(--green); }
    .agent-status.idle     { color: var(--subtext); }
    @keyframes pulse-text { 0%,100%{opacity:1} 50%{opacity:0.4} }

    /* ── FOOTER ── */
    footer {
      border-top: 1px solid var(--border);
      padding: 40px;
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 16px;
    }
    footer .brand {
      font-family: 'Clash Display', sans-serif;
      font-size: 16px; font-weight: 700; color: var(--text);
    }
    footer .brand span { color: var(--gold); }
    footer .footer-links { display: flex; gap: 20px; }
    footer .footer-links a {
      font-size: 13px; color: var(--subtext);
      text-decoration: none; transition: color 0.2s;
    }
    footer .footer-links a:hover { color: var(--text); }
    .also-by {
      font-size: 12px; color: var(--subtext);
    }
    .also-by a { color: var(--gold); text-decoration: none; }
    .also-by a:hover { text-decoration: underline; }
  </style>
</head>
<body>

<nav>
  <div class="imprsn8-logo">imprsn<span>8</span></div>
  <div style="display:flex;gap:10px;align-items:center;">
    <a href="/login" style="color:var(--subtext);text-decoration:none;font-size:14px;">Log in</a>
    <a href="/register" class="btn-gold">Get Started</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-eyebrow">AI-Powered Brand Intelligence</div>
  <h1>Your Online Presence<br/>Has a <em>Score.</em></h1>
  <p class="hero-sub">
    imprsn8 monitors your digital identity across the web —
    catching fakes, flagging threats, and amplifying your authentic brand.
  </p>
  <div class="hero-cta-row">
    <a href="/register" class="btn-gold">Analyze My Profile →</a>
    <a href="#how-it-works" class="btn-outline-gold">See How It Works</a>
  </div>

  <!-- SCORE DEMO WIDGET -->
  <div class="score-demo">
    <div class="score-demo-label">Your Impression Score</div>
    <div class="score-ring-large">
      <div class="score-num-large" id="demo-score">76</div>
      <div class="score-sub-large">/ 100</div>
    </div>
    <div class="score-components">
      <div class="score-comp">
        <div class="score-comp-label">Authenticity</div>
        <div class="score-comp-val" style="color:var(--purple)">88</div>
      </div>
      <div class="score-comp">
        <div class="score-comp-label">Reach Quality</div>
        <div class="score-comp-val" style="color:var(--gold)">71</div>
      </div>
      <div class="score-comp">
        <div class="score-comp-label">Threat Exposure</div>
        <div class="score-comp-val" style="color:var(--red)">Low</div>
      </div>
      <div class="score-comp">
        <div class="score-comp-label">Sentiment</div>
        <div class="score-comp-val" style="color:var(--green)">82</div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section class="features" id="how-it-works">

  <!-- Feature 1: Impersonation Detection -->
  <div class="feature-row">
    <div>
      <div class="feature-eyebrow">Protection</div>
      <h2 class="feature-title">We found 3 accounts pretending to be you.</h2>
      <p class="feature-body">
        Our impersonation agent scans every major platform continuously —
        detecting fake accounts that use your name, likeness, or brand
        before they damage your reputation or deceive your audience.
      </p>
      <a href="/register" class="btn-gold">Start Monitoring</a>
    </div>
    <div class="feature-card">
      <div style="font-family:'Clash Display',sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--subtext);margin-bottom:16px;">Detected This Week</div>
      ${['@yourname_official · Instagram · 12.4K followers', '@yourname.real · TikTok · 3.1K followers', 'yourname-verified.com · Phishing site'].map((item, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;margin-bottom:8px;border-left:3px solid var(--red);">
        <div style="font-size:18px;">⚠️</div>
        <div style="font-size:12px;color:var(--text);">${item}</div>
      </div>`).join('')}
    </div>
  </div>

  <!-- Feature 2: Agent Simulation / War Room -->
  <div class="feature-row reverse">
    <div>
      <div class="feature-eyebrow">Intelligence</div>
      <h2 class="feature-title">Five AI agents scanning for you, simultaneously.</h2>
      <p class="feature-body">
        Every analysis runs a coordinated sweep across impersonation, phishing,
        brand reputation, dark web mentions, and sentiment — giving you a
        complete picture in under 30 seconds.
      </p>
      <a href="/register" class="btn-outline-gold">Try an Analysis</a>
    </div>
    <div class="feature-card">
      <div style="font-family:'Clash Display',sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--subtext);margin-bottom:16px;">Live Analysis</div>
      <div class="agent-row" id="agent-demo">
        <div class="agent-card done">
          <div class="agent-icon">🔍</div>
          <div class="agent-name">Impersonation Agent</div>
          <div class="agent-status done">✓ Complete — 3 found</div>
        </div>
        <div class="agent-card scanning">
          <div class="agent-icon">🎭</div>
          <div class="agent-name">Phishing Agent</div>
          <div class="agent-status scanning">Scanning...</div>
        </div>
        <div class="agent-card">
          <div class="agent-icon">📰</div>
          <div class="agent-name">Brand Reputation Agent</div>
          <div class="agent-status idle">Queued</div>
        </div>
        <div class="agent-card">
          <div class="agent-icon">🌑</div>
          <div class="agent-name">Dark Web Agent</div>
          <div class="agent-status idle">Queued</div>
        </div>
        <div class="agent-card">
          <div class="agent-icon">📊</div>
          <div class="agent-name">Sentiment Agent</div>
          <div class="agent-status idle">Queued</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Feature 3: Reports -->
  <div class="feature-row">
    <div>
      <div class="feature-eyebrow">Intelligence Reports</div>
      <h2 class="feature-title">Your monthly brand briefing, written by AI.</h2>
      <p class="feature-body">
        Every month, imprsn8 compiles everything it found into a formatted
        intelligence report — score movements, threat summaries, media mentions,
        and recommendations. Download as PDF. Share with your team.
      </p>
      <a href="/register" class="btn-gold">Get Your First Report</a>
    </div>
    <div class="feature-card" style="justify-content:flex-start;gap:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-family:'Clash Display',sans-serif;font-size:18px;font-weight:600;">March 2026 Report</div>
          <div style="font-size:12px;color:var(--subtext);margin-top:4px;">Generated March 1 · PDF · 12 pages</div>
        </div>
        <div style="background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.3);border-radius:6px;padding:4px 10px;font-size:11px;color:var(--gold);">↑ +4 pts</div>
      </div>
      <div style="height:1px;background:var(--border);"></div>
      <div style="font-size:13px;color:var(--subtext);line-height:1.7;">
        Your Impression Score improved by 4 points this month following the
        successful removal of 2 phishing domains. One new impersonation account
        was detected on Instagram and flagged for reporting. Sentiment trending positive
        across 47 media mentions.
      </div>
    </div>
  </div>

</section>

<!-- FOOTER -->
<footer>
  <div>
    <div class="brand">imprsn<span>8</span></div>
    <div class="also-by" style="margin-top:6px;">
      Also by LRX: <a href="https://lrx-radar.com">Trust Radar →</a>
    </div>
  </div>
  <div class="footer-links">
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="mailto:hello@imprsn8.com">Contact</a>
  </div>
</footer>

<script>
// ── AGENT DEMO ANIMATION ────────────────────────────────────────────────
(function() {
  const states = [
    ['done','scanning','idle','idle','idle'],
    ['done','done','scanning','idle','idle'],
    ['done','done','done','scanning','idle'],
    ['done','done','done','done','scanning'],
    ['done','done','done','done','done'],
  ];
  const labels = [
    null,
    '✓ Complete — 0 threats',
    '✓ Complete — 2 mentions',
    '✓ Complete — 1 reference',
    '✓ Complete — Positive',
  ];
  let step = 0;
  const cards = document.querySelectorAll('.agent-card');
  const statuses = document.querySelectorAll('.agent-status');

  function advance() {
    if (step >= states.length) return;
    const s = states[step];
    cards.forEach((c, i) => {
      c.className = 'agent-card ' + (s[i] !== 'idle' ? s[i] : '');
      statuses[i].className = 'agent-status ' + s[i];
      if (s[i] === 'scanning') statuses[i].textContent = 'Scanning...';
      else if (s[i] === 'done' && labels[i]) statuses[i].textContent = labels[i];
      else if (s[i] === 'idle') statuses[i].textContent = 'Queued';
    });
    step++;
    if (step < states.length) setTimeout(advance, 1400);
    else setTimeout(() => { step = 0; advance(); }, 3000);
  }
  setTimeout(advance, 1200);
})();
</script>

</body></html>`;
}
```

---

## PHASE 5 — IMPRSN8 DASHBOARD UPLEVEL

### 5A — Overview Dashboard

**File:** `packages/imprsn8/src/templates/dashboard.ts`

```typescript
// Dashboard sections to build — implement in this order:

// 1. SIDEBAR NAV
//    Items: Overview · Analyze · Social Profiles · Threat Feed · Reports · Settings
//    Active state: gold left border + gold text
//    Collapsed on mobile: bottom nav bar

// 2. OVERVIEW PAGE
//    - Large Impression Score ring (120px, animated fill on load via CSS conic-gradient)
//    - Four component scores: Authenticity (purple) · Reach Quality (gold) ·
//      Threat Exposure (red) · Sentiment (green)
//    - Alert banner if threats: "⚠️ 2 new impersonation accounts detected"
//    - Recent analyses feed (last 5)

// 3. ANALYZE PAGE — "War Room"
//    - Step 1: Connected social profiles (Twitter/X, Instagram, LinkedIn, TikTok)
//      Each shown as a card: connected = gold border + checkmark, unconnected = ghost
//    - Step 2: "Run Analysis" button triggers animated War Room:
//      5 agent cards animate sequentially (scanning → done)
//      Progress bar at top: 0% → 100% as agents complete
//    - Step 3: Results panel slides in:
//      Score delta ("↑ +4 pts since last week"), AI narrative, signal list
//    Wire to: POST /api/analyze → show real results, fall back to demo if loading

// 4. SOCIAL PROFILES PAGE
//    - Cards per platform: Platform name · Icon · Follower count · Engagement rate ·
//      Authenticity score · Last scanned timestamp
//    - Add new: dropdown of platforms → POST /api/social
//    - Remove: DELETE /api/social/:platform

// 5. REPORTS PAGE
//    - List: date · score at time · delta · download PDF button
//    - Click to open full report view
//    Wire to: GET /api/score/history for trend data

// 6. SCORE HISTORY (sub-page of Reports or Overview)
//    - Line chart: GET /api/score/history
//    - Milestone markers on the line
//    Use: Chart.js or a simple SVG sparkline
```

### 5B — Impression Score Ring Component (CSS)

```css
/* Use in imprsn8 dashboard — animated on load */
.impression-ring {
  width: 140px; height: 140px;
  border-radius: 50%;
  position: relative;
  display: flex; align-items: center; justify-content: center;
  flex-direction: column;
}

.impression-ring::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    var(--gold) 0deg calc(var(--score-deg, 0deg)),
    rgba(212,175,55,0.12) calc(var(--score-deg, 0deg)) 360deg
  );
  transition: --score-deg 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.impression-ring::after {
  content: '';
  position: absolute; inset: 10px;
  border-radius: 50%;
  background: var(--surface);
}

.ring-value {
  position: relative; z-index: 1;
  font-family: 'Clash Display', sans-serif;
  font-size: 40px; font-weight: 700;
  color: var(--gold); line-height: 1;
}
.ring-label {
  position: relative; z-index: 1;
  font-size: 11px; color: var(--subtext);
}
```

```javascript
// Animate ring fill on load
function animateScoreRing(score) {
  const deg = Math.round((score / 100) * 360);
  const ring = document.querySelector('.impression-ring');
  // CSS custom property trick — requires @property registration or JS fallback:
  requestAnimationFrame(() => {
    ring.style.setProperty('--score-deg', deg + 'deg');
    // Animate the number
    let v = 0;
    const step = Math.ceil(score / 60);
    const t = setInterval(() => {
      v = Math.min(v + step, score);
      document.querySelector('.ring-value').textContent = v;
      if (v >= score) clearInterval(t);
    }, 16);
  });
}
```

---

## PHASE 6 — FASTAPI BACKEND ADDITIONS

**File:** `packages/api/app/routers/geo.py` (new)

```python
from fastapi import APIRouter, Depends
from app.database import get_db
import httpx
import json
from functools import lru_cache

router = APIRouter(prefix="/api/geo", tags=["geo"])

@lru_cache(maxsize=10000)
async def get_ip_location(ip: str) -> dict | None:
    """
    Resolve IP to lat/lng. Cached in memory (LRU 10k entries).
    Uses ip-api.com free tier: 45 req/min, no API key.
    """
    if not ip or ip in ('127.0.0.1', 'localhost'):
        return None
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"http://ip-api.com/json/{ip}",
                params={"fields": "lat,lon,city,country,countryCode,status"},
                timeout=3.0,
            )
            data = r.json()
            if data.get("status") != "success":
                return None
            return {
                "lat": data["lat"],
                "lng": data["lon"],
                "city": data["city"],
                "country": data["country"],
                "country_code": data["countryCode"],
            }
    except Exception:
        return None


@router.get("/resolve/{ip}")
async def resolve_ip(ip: str):
    result = await get_ip_location(ip)
    if not result:
        return {"error": "Could not resolve IP"}
    return result
```

**File:** `packages/api/app/routers/stats.py` (new)

```python
from fastapi import APIRouter, Depends
from app.database import get_db
from sqlalchemy import text

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/global")
async def global_stats(hours: int = 24, db=Depends(get_db)):
    """
    Returns aggregate stats for the Trust Radar homepage counter.
    Called by the frontend every 60s to update the live badge.
    """
    result = await db.execute(text("""
        SELECT
            COUNT(*) as total_scans,
            COUNT(CASE WHEN trust_score < 40 THEN 1 END) as total_threats,
            COUNT(DISTINCT geo_country_code) as unique_countries,
            MAX(created_at) as last_scan
        FROM scans
        WHERE created_at >= NOW() - INTERVAL ':hours hours'
    """), {"hours": hours})
    row = result.fetchone()
    return {
        "total_scans": row.total_scans,
        "total_threats": row.total_threats,
        "unique_countries": row.unique_countries,
        "last_scan": str(row.last_scan),
        "period_hours": hours,
    }
```

**Register new routers in** `packages/api/app/main.py`:
```python
from app.routers import geo, stats
app.include_router(geo.router)
app.include_router(stats.router)
```

---

## IMPLEMENTATION ORDER FOR CLAUDE CODE

Execute these phases in strict order. Complete and test each before moving on.

### Phase 1 — Heatmap Fix (Start here — biggest visible win)
```
1. Run migration: packages/trust-radar/migrations/0003_add_geolocation.sql
2. Create: packages/trust-radar/src/handlers/heatmap.ts
3. Create: packages/trust-radar/src/templates/heatmap-component.ts
4. Patch: packages/trust-radar/src/handlers/scan.ts — add resolveGeo() + geo columns to insert
5. Patch: packages/trust-radar/src/index.ts — add /api/heatmap route
6. Patch: wherever the dashboard template is — replace old map HTML with HEATMAP_HTML + HEATMAP_CSS + HEATMAP_SCRIPTS
7. TEST: wrangler dev, verify map renders in both dark and light mode
```

### Phase 2 — Trust Radar Homepage
```
1. Create: packages/trust-radar/src/templates/homepage.ts
2. Add route: GET / → renderHomepage() for unauthenticated visitors
3. Ensure /api/scan accepts unauthenticated POST (already does per README)
4. TEST: homepage loads, scan bar works, map renders
```

### Phase 3 — Trust Radar Dashboard
```
1. Create: packages/trust-radar/src/templates/scan-result.ts
2. Wire AI insight: add getAIInsight() call after scan, store in scan record
3. Uplevel history page: add search/filter, trend sparkline
4. TEST: scan result page shows signal breakdown + AI insight
```

### Phase 4 — imprsn8 Homepage
```
1. Create: packages/imprsn8/src/templates/homepage.ts
2. Add route: GET / → renderImprsn8Homepage() for unauthenticated visitors
3. Verify agent animation runs in browser
4. TEST: homepage, scroll through all feature sections
```

### Phase 5 — imprsn8 Dashboard
```
1. Build sidebar nav component
2. Build overview dashboard (score ring + component scores + alerts)
3. Build War Room analyze flow (agent cards + animation + results)
4. Build social profiles page (wire to /api/social endpoints)
5. Build reports page (wire to /api/score/history)
6. TEST: full authenticated flow end to end
```

### Phase 6 — Backend
```
1. Create: packages/api/app/routers/geo.py
2. Create: packages/api/app/routers/stats.py
3. Register both in main.py
4. Deploy API: pnpm deploy:api
5. TEST: GET /api/geo/resolve/8.8.8.8 returns lat/lng
```

### Final Deployment
```
pnpm deploy:all
```

---

## KEY DESIGN RULES — NEVER VIOLATE

### Trust Radar
- Dark: `#0A0E1A` bg · `#00F5FF` cyan · `#EF4444` red · `#22C55E` green
- Light: CartoDB Positron tiles · cobalt `#1a56db` replaces cyan in heat gradient
- Font: JetBrains Mono (data/scores) + Inter (prose)
- Heat map height: **always explicit px** — never auto/100% without sized parent
- Light mode heat: `minOpacity: 0.25`, `blur: 22`, deep gradient (not neon)

### imprsn8
- Always dark background: `#0A0A0A`
- Gold `#D4AF37` = brand primary. Purple `#7C3AED` = AI/intelligence. Red = threats only.
- Font: Clash Display (headers) + Geist Sans (body)
- Never show a "switch to Trust Radar" in the main nav — footer cross-link only
- Agent animation: never skip it — it's the core UX demonstration

### Both platforms
- No glassmorphism (hard rule from v2 design spec)
- No Inter as the primary display font
- No purple gradients on white backgrounds
- Disciplined surface elevation: `--navy` < `--surface` < `--surface2`
- CTAs always have a clear primary (filled) vs secondary (outlined/ghost) hierarchy

---

*Plan compiled: March 2026 · Trust Radar + imprsn8 Platform Uplevel*
*Source of truth for Claude Code implementation — read this file before writing any code*
