// ─────────────────────────────────────────────────────────────────────────────
// TRUST RADAR — GLOBAL THREAT HEATMAP COMPONENT
//
// BUG FIXES DOCUMENTED HERE:
//
// BUG 1 (CRITICAL): Map canvas renders at 0px height — invisible
//   Root cause: #map div had no explicit height declaration.
//   Leaflet requires a real pixel height at mount time.
//   Fix: #threat-map { height: 520px; width: 100%; display: block; }
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
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
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
  var TILE_CONFIGS = {
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      gradient: { 0.15: '#00f5ff', 0.45: '#f59e0b', 0.75: '#ef4444', 1.0: '#ff0000' },
      minOpacity: 0.07,
      blur: 28,
      radius: 38
    },
    light: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      // Deep cobalt (replaces cyan), burnt orange (replaces amber),
      // deep red (replaces bright red) — all readable on white/beige tiles
      gradient: { 0.15: '#1a56db', 0.45: '#c05621', 0.75: '#991b1b', 1.0: '#7f1d1d' },
      minOpacity: 0.25, // Higher floor — low-risk blobs need more opacity on light
      blur: 22,          // Less blur — sharper blobs, better contrast on light base
      radius: 38
    }
  };

  var map, tileLayer, heatLayer;
  var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  var currentFilter = 'all';
  var heatData = [];

  // ── INITIALIZE MAP ────────────────────────────────────────────────────────
  function initMap() {
    // Must be called AFTER DOMContentLoaded — container must have real height
    map = L.map('threat-map', {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
      preferCanvas: true
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
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
  }

  // ── HEAT LAYER SWAP ───────────────────────────────────────────────────────
  function applyHeatLayer(theme, data) {
    var cfg = TILE_CONFIGS[theme];
    if (heatLayer) heatLayer.remove();
    if (!data || data.length === 0) return;

    heatLayer = L.heatLayer(data.map(function(p) { return [p.lat, p.lng, p.intensity]; }), {
      radius: cfg.radius,
      blur: cfg.blur,
      maxZoom: 6,
      max: 1.0,
      minOpacity: cfg.minOpacity,
      gradient: cfg.gradient
    }).addTo(map);
  }

  // ── FETCH REAL DATA FROM API ──────────────────────────────────────────────
  async function loadHeatData() {
    try {
      var params = new URLSearchParams({ hours: '24', filter: currentFilter });
      var res = await fetch('/api/heatmap?' + params);
      var json = await res.json();
      var payload = json.data || json;
      heatData = payload.points || [];

      // Update badge counter
      var el = document.getElementById('hm-threat-count');
      if (el) el.textContent = ((payload.stats && payload.stats.totalThreats) || 0).toLocaleString();

      // Add hotspot markers with tooltips
      addMarkers(heatData.slice(0, 20));

      applyHeatLayer(currentTheme, heatData);
    } catch (err) {
      console.error('Heatmap data load failed:', err);
    }
  }

  // ── HOTSPOT MARKERS ───────────────────────────────────────────────────────
  function addMarkers(points) {
    points.forEach(function(p) {
      var score = Math.round((1 - p.intensity) * 100);
      var color = score < 30 ? '#ef4444' : score < 60 ? '#f59e0b' : '#22c55e';
      L.circleMarker([p.lat, p.lng], {
        radius: 4,
        color: color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1.5
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
    setTimeout(function() { map.invalidateSize(); }, 50); // Reflow safety
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
