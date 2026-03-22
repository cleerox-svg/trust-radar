/**
 * Social Brand Monitoring Dashboard
 * Served at /dashboard/social (authenticated)
 */
export function renderSocialDashboard(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Social Monitoring — Trust Radar</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
/* ─── Section 8.1 Design Tokens ──────────────────────────────── */
:root {
  --bg-primary: #fafbfc; --bg-secondary: #ffffff; --bg-tertiary: #f1f5f9;
  --text-primary: #0f172a; --text-secondary: #475569; --text-tertiary: #94a3b8;
  --border-light: #e2e8f0; --border-strong: #cbd5e1;
  --accent: #0891b2; --accent-hover: #0e7490;
  --teal: #14b8a6; --teal-light: #ccfbf1; --teal-dark: #0f3d38;
  --green: #10b981; --amber: #f59e0b; --coral: #f97316; --red: #ef4444;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.12);
  --drawer-width: 420px;
}
[data-theme="dark"] {
  --bg-primary: #0b1120; --bg-secondary: #111827; --bg-tertiary: #1a2332;
  --text-primary: #f1f5f9; --text-secondary: #94a3b8; --text-tertiary: #64748b;
  --border-light: #1e293b; --border-strong: #334155;
  --teal-light: #0f3d38; --teal-dark: #ccfbf1;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.2); --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.4);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DM Sans', sans-serif; background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; }
h1, h2, h3 { font-family: 'Plus Jakarta Sans', sans-serif; }
.mono { font-family: 'IBM Plex Mono', monospace; }

/* ─── Sticky Summary Bar ─────────────────────────────────────── */
.summary-bar { position: sticky; top: 0; z-index: 200; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--border-light); padding: 0.75rem 2rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
[data-theme="dark"] .summary-bar { background: rgba(11,17,32,0.85); }
.summary-stats { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; }
.summary-stat { text-align: center; }
.summary-stat-value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.25rem; font-weight: 800; line-height: 1; }
.summary-stat-label { font-size: 0.65rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.15rem; }
.summary-actions { display: flex; gap: 0.75rem; align-items: center; }

/* ─── Layout ─────────────────────────────────────────────────── */
.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
select.brand-select { font-family: 'DM Sans', sans-serif; font-size: 0.875rem; padding: 0.5rem 1rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; }

/* ─── Buttons ────────────────────────────────────────────────── */
.btn { font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 500; padding: 0.5rem 1rem; border-radius: var(--radius-sm); border: none; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-outline { background: transparent; border: 1px solid var(--border-strong); color: var(--text-primary); }
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }
.btn-sm { font-size: 0.75rem; padding: 0.35rem 0.75rem; }
.btn-danger { background: var(--red); color: #fff; }
.btn-success { background: var(--green); color: #fff; }
.theme-toggle { background: none; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 0.4rem 0.6rem; cursor: pointer; font-size: 1rem; color: var(--text-secondary); }

/* ─── Platform Pills (animated, with threat-pulse) ───────────── */
.platform-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; margin-bottom: 2rem; }
.platform-card { background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; text-align: center; position: relative; cursor: pointer; transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
.platform-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.platform-card.status-clean { border-left: 3px solid var(--green); }
.platform-card.status-warning { border-left: 3px solid var(--amber); }
.platform-card.status-danger { border-left: 3px solid var(--red); }
.platform-card.status-unclaimed { border-left: 3px solid var(--text-tertiary); }
.platform-card.status-danger::after { content: ''; position: absolute; inset: -2px; border-radius: var(--radius-md); border: 2px solid var(--red); opacity: 0; animation: threat-pulse 2s ease-in-out infinite; pointer-events: none; }
@keyframes threat-pulse { 0%, 100% { opacity: 0; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.02); } }
.platform-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
.platform-name { font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem; }
.platform-handle { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; }
.platform-status { font-size: 0.7rem; color: var(--text-tertiary); }
.issue-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: var(--red); color: #fff; font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 999px; }

/* ─── Section Headers ────────────────────────────────────────── */
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.section-header h2 { font-size: 1.1rem; font-weight: 700; }
.section-header .count { font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; color: var(--text-tertiary); }

/* ─── Alert Cards (staggered entry) ──────────────────────────── */
.alert-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem; }
.alert-card { background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; display: flex; gap: 1rem; align-items: flex-start; cursor: pointer; opacity: 0; transform: translateY(12px); animation: card-enter 0.3s ease-out forwards; transition: box-shadow 0.15s; }
.alert-card:hover { box-shadow: var(--shadow-md); }
@keyframes card-enter { to { opacity: 1; transform: translateY(0); } }
.alert-card.severity-CRITICAL { border-left: 3px solid var(--red); }
.alert-card.severity-HIGH { border-left: 3px solid var(--coral); }
.alert-card.severity-MEDIUM { border-left: 3px solid var(--amber); }
.alert-card.severity-LOW { border-left: 3px solid var(--green); }
.alert-info { flex: 1; }
.alert-name { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem; }
.alert-meta { font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 0.5rem; display: flex; gap: 1rem; flex-wrap: wrap; }
.alert-signals { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem; }
.signal-tag { font-size: 0.68rem; padding: 0.2rem 0.5rem; border-radius: 999px; background: var(--bg-tertiary); color: var(--text-secondary); }
.alert-actions { display: flex; gap: 0.5rem; }
.severity-badge { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: var(--radius-sm); }
.severity-badge.CRITICAL { background: #fef2f2; color: var(--red); }
.severity-badge.HIGH { background: #fff7ed; color: var(--coral); }
.severity-badge.MEDIUM { background: #fffbeb; color: var(--amber); }
.severity-badge.LOW { background: #ecfdf5; color: var(--green); }
[data-theme="dark"] .severity-badge.CRITICAL { background: #1c1017; }
[data-theme="dark"] .severity-badge.HIGH { background: #1c1510; }
[data-theme="dark"] .severity-badge.MEDIUM { background: #1c1a10; }
[data-theme="dark"] .severity-badge.LOW { background: #0f1c17; }

/* ─── SVG Arc Gauge ──────────────────────────────────────────── */
.arc-gauge { display: inline-block; position: relative; }
.arc-gauge svg { transform: rotate(-90deg); }
.arc-gauge-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; font-weight: 600; }

/* ─── Score Bar ──────────────────────────────────────────────── */
.score-bar { width: 100%; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden; margin: 0.4rem 0; }
.score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease-out; }

/* ─── Sentinel AI Assessment Block ───────────────────────────── */
.ai-assessment { border: 1px solid var(--teal); border-radius: var(--radius-md); padding: 1rem; margin-top: 0.75rem; background: var(--teal-light); }
[data-theme="dark"] .ai-assessment { background: var(--teal-dark); border-color: var(--teal); }
.ai-assessment-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.ai-assessment-label { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.78rem; font-weight: 700; color: var(--teal); }
.ai-assessment-text { font-size: 0.82rem; color: var(--text-primary); line-height: 1.5; margin-bottom: 0.5rem; }
.ai-action-pill { display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 0.68rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.03em; }
.ai-action-pill.monitor { background: var(--bg-tertiary); color: var(--text-secondary); }
.ai-action-pill.report { background: #fffbeb; color: var(--amber); }
.ai-action-pill.legal_notice { background: #fff7ed; color: var(--coral); }
.ai-action-pill.dismiss { background: var(--bg-tertiary); color: var(--text-tertiary); opacity: 0.7; }
[data-theme="dark"] .ai-action-pill.report { background: #1c1a10; }
[data-theme="dark"] .ai-action-pill.legal_notice { background: #1c1510; }
.ai-evidence-area { width: 100%; min-height: 80px; margin-top: 0.5rem; padding: 0.75rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: var(--radius-sm); color: var(--text-primary); resize: vertical; line-height: 1.5; }
.ai-evidence-copy { margin-top: 0.35rem; font-size: 0.7rem; color: var(--accent); cursor: pointer; text-decoration: underline; }

/* ─── Slide-in Drawer ────────────────────────────────────────── */
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 500; opacity: 0; pointer-events: none; transition: opacity 0.25s; }
.drawer-overlay.open { opacity: 1; pointer-events: auto; }
.drawer { position: fixed; top: 0; right: 0; bottom: 0; width: var(--drawer-width); max-width: 100vw; background: var(--bg-secondary); z-index: 501; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: var(--shadow-lg); overflow-y: auto; display: flex; flex-direction: column; }
.drawer.open { transform: translateX(0); }
.drawer-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.drawer-header h3 { font-size: 1rem; font-weight: 700; }
.drawer-close { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-secondary); padding: 0.25rem; }
.drawer-body { padding: 1.5rem; flex: 1; overflow-y: auto; }
.drawer-handle { display: none; }

/* ─── Handle Table ───────────────────────────────────────────── */
.handle-table { width: 100%; border-collapse: collapse; background: var(--bg-secondary); border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-light); }
.handle-table th { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); text-align: left; padding: 0.75rem 1rem; background: var(--bg-tertiary); border-bottom: 1px solid var(--border-light); }
.handle-table td { font-size: 0.85rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-light); }
.handle-table tr:last-child td { border-bottom: none; }
.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.4rem; vertical-align: middle; }
.status-dot.verified { background: var(--green); }
.status-dot.unclaimed { background: var(--text-tertiary); }
.status-dot.squatted { background: var(--red); }

/* ─── Skeleton Loading ───────────────────────────────────────── */
.skeleton { background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%); background-size: 200% 100%; animation: skeleton-shimmer 1.5s ease-in-out infinite; border-radius: var(--radius-sm); }
@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skeleton-card { height: 120px; border-radius: var(--radius-md); }
.skeleton-row { height: 48px; margin-bottom: 0.5rem; }
.skeleton-text { height: 14px; width: 60%; margin-bottom: 0.5rem; }

/* ─── Empty & Loading States ─────────────────────────────────── */
.empty-state { text-align: center; padding: 3rem; color: var(--text-tertiary); }
.empty-state h3 { font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-secondary); }
.loading { text-align: center; padding: 2rem; color: var(--text-tertiary); }
.spinner { display: inline-block; width: 24px; height: 24px; border: 2px solid var(--border-light); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Responsive: bottom sheet on mobile ─────────────────────── */
@media (max-width: 1024px) { .platform-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 640px) {
  .platform-grid { grid-template-columns: repeat(2, 1fr); }
  .container { padding: 1rem; }
  .summary-bar { padding: 0.5rem 1rem; flex-wrap: wrap; }
  .summary-stats { gap: 1rem; }
  .alert-card { flex-direction: column; }
  /* Drawer becomes bottom sheet */
  .drawer { top: auto; right: 0; left: 0; bottom: 0; width: 100%; max-height: 85vh; border-radius: var(--radius-lg) var(--radius-lg) 0 0; transform: translateY(100%); }
  .drawer.open { transform: translateY(0); }
  .drawer-handle { display: block; width: 36px; height: 4px; background: var(--border-strong); border-radius: 2px; margin: 0.5rem auto; flex-shrink: 0; }
}
@media (min-width: 641px) and (max-width: 768px) {
  .platform-grid { grid-template-columns: repeat(3, 1fr); }
  .container { padding: 1rem; }
  .alert-card { flex-direction: column; }
}
</style>
</head>
<body>

<!-- Sticky Summary Bar -->
<div class="summary-bar">
  <div style="display:flex;align-items:center;gap:1rem;">
    <a href="/dashboard" style="color:var(--text-secondary);text-decoration:none;font-size:0.85rem;">← Dashboard</a>
    <h1 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.15rem;font-weight:700;">Social Monitoring</h1>
  </div>
  <div class="summary-stats" id="summaryStats">
    <div class="summary-stat"><div class="summary-stat-value" id="statPlatforms">—</div><div class="summary-stat-label">Platforms</div></div>
    <div class="summary-stat"><div class="summary-stat-value" id="statAlerts" style="color:var(--coral)">—</div><div class="summary-stat-label">Alerts</div></div>
    <div class="summary-stat"><div class="summary-stat-value" id="statRisk">—</div><div class="summary-stat-label">Risk</div></div>
  </div>
  <div class="summary-actions">
    <select class="brand-select" id="brandSelector">
      <option value="">Loading brands...</option>
    </select>
    <button class="btn btn-primary btn-sm" id="scanBtn" onclick="triggerScan()">Scan Now</button>
    <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
      <span id="theme-icon">☀</span>
    </button>
  </div>
</div>

<div class="container">
  <!-- Platform Status Grid -->
  <div class="section-header">
    <h2>Platform Status</h2>
    <span class="count" id="lastChecked">—</span>
  </div>
  <div class="platform-grid" id="platformGrid">
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
    <div class="skeleton skeleton-card"></div>
  </div>

  <!-- Impersonation Alerts -->
  <div class="section-header">
    <h2>Impersonation Alerts</h2>
    <span class="count" id="alertCount">—</span>
  </div>
  <div class="alert-list" id="alertList">
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
    <div class="skeleton skeleton-row"></div>
  </div>

  <!-- Handle Reservation Status -->
  <div class="section-header">
    <h2>Handle Status</h2>
  </div>
  <table class="handle-table" id="handleTable">
    <thead>
      <tr>
        <th>Platform</th>
        <th>Official Handle</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="handleBody">
      <tr><td colspan="4"><div class="skeleton skeleton-row"></div></td></tr>
    </tbody>
  </table>
</div>

<!-- Drawer overlay -->
<div class="drawer-overlay" id="drawerOverlay" onclick="closeDrawer()"></div>

<!-- Slide-in Drawer (bottom sheet on mobile) -->
<div class="drawer" id="drawer">
  <div class="drawer-handle"></div>
  <div class="drawer-header">
    <h3 id="drawerTitle">Finding Detail</h3>
    <button class="drawer-close" onclick="closeDrawer()" aria-label="Close">&times;</button>
  </div>
  <div class="drawer-body" id="drawerBody">
    <!-- populated by JS when an alert card is clicked -->
  </div>
</div>

<script>
const PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'github', 'youtube'];
const PLATFORM_ICONS = { twitter: '\\u{1D54F}', linkedin: 'in', instagram: '\\ud83d\\udcf7', tiktok: '\\u266A', github: '\\u2328', youtube: '\\u25B6' };
const ACTION_LABELS = { monitor: 'Monitor', report: 'Report', legal_notice: 'Legal Notice', dismiss: 'Dismiss' };
const TOKEN = localStorage.getItem('token') || '';
let currentBrandId = '';
let refreshTimer = null;
let cachedAlerts = [];

function headers() { return { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }; }

async function apiFetch(path) {
  try {
    const res = await fetch(path, { headers: headers() });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch { return null; }
}

function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ─── SVG Arc Gauge ────────────────────────────────────────── */
function arcGauge(pct, size, color) {
  const r = (size - 6) / 2, c = Math.PI * 2 * r;
  const offset = c - (c * Math.min(pct, 100) / 100);
  return '<div class="arc-gauge" style="width:' + size + 'px;height:' + size + 'px">' +
    '<svg width="' + size + '" height="' + size + '">' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="var(--bg-tertiary)" stroke-width="4"/>' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + offset + '" style="transition:stroke-dashoffset 0.8s ease-out"/>' +
    '</svg>' +
    '<div class="arc-gauge-label">' + Math.round(pct) + '%</div></div>';
}

/* ─── Theme Toggle ─────────────────────────────────────────── */
function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  document.getElementById('theme-icon').textContent = t === 'dark' ? '\\u263E' : '\\u2600';
}

/* ─── Drawer open/close + touch swipe ──────────────────────── */
function openDrawer(alertData) {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const body = document.getElementById('drawerBody');
  const title = document.getElementById('drawerTitle');

  title.textContent = alertData.suspicious_account_name || alertData.handle_checked || 'Finding Detail';

  const score = Math.round((alertData.impersonation_score || 0) * 100);
  const barColor = score > 80 ? 'var(--red)' : score > 50 ? 'var(--coral)' : score > 30 ? 'var(--amber)' : 'var(--green)';
  const signals = (() => { try { return JSON.parse(alertData.impersonation_signals || '[]'); } catch { return []; } })();

  let html = '<div style="margin-bottom:1rem;">' +
    '<span class="severity-badge ' + (alertData.severity || 'LOW') + '">' + (alertData.severity || 'LOW') + '</span>' +
    ' <span style="color:var(--text-secondary);font-size:0.8rem;">' + (alertData.platform || '') + '</span>' +
    (alertData.suspicious_account_url ? ' <a href="' + escHtml(alertData.suspicious_account_url) + '" target="_blank" rel="noopener" style="color:var(--accent);font-size:0.8rem;">View Profile</a>' : '') +
    '</div>';

  html += '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">' +
    arcGauge(score, 56, barColor) +
    '<div><div class="mono" style="font-size:0.85rem;font-weight:600;">' + score + '% impersonation</div>' +
    '<div style="font-size:0.75rem;color:var(--text-tertiary);">Confidence score</div></div></div>';

  if (signals.length) {
    html += '<div style="margin-bottom:1rem;">' +
      signals.map(function(s) { return '<span class="signal-tag">' + escHtml(String(s)) + '</span>'; }).join(' ') + '</div>';
  }

  html += '<div style="display:flex;gap:0.5rem;margin-bottom:1.25rem;">' +
    '<button class="btn btn-outline btn-sm" onclick="updateAlert(\\'' + alertData.id + '\\',\\'investigating\\')">Investigate</button>' +
    '<button class="btn btn-outline btn-sm" onclick="updateAlert(\\'' + alertData.id + '\\',\\'false_positive\\')">False Positive</button>' +
    '<button class="btn btn-success btn-sm" onclick="updateAlert(\\'' + alertData.id + '\\',\\'resolved\\')">Resolve</button>' +
    '</div>';

  // AI Assessment block
  if (alertData.ai_assessment) {
    html += '<div class="ai-assessment">' +
      '<div class="ai-assessment-header">' +
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--teal)" stroke-width="1.5"/><path d="M8 4v4.5M8 11h.01" stroke="var(--teal)" stroke-width="1.5" stroke-linecap="round"/></svg>' +
        '<span class="ai-assessment-label">Sentinel Assessment</span>' +
      '</div>' +
      '<div class="ai-assessment-text">' + escHtml(alertData.ai_assessment) + '</div>';

    if (alertData.ai_action) {
      html += '<span class="ai-action-pill ' + escHtml(alertData.ai_action) + '">' + escHtml(ACTION_LABELS[alertData.ai_action] || alertData.ai_action) + '</span>';
    }

    if (alertData.ai_confidence != null) {
      html += ' <span class="mono" style="font-size:0.7rem;color:var(--text-tertiary);">AI confidence: ' + Math.round(alertData.ai_confidence * 100) + '%</span>';
    }

    if (alertData.ai_evidence_draft && (alertData.ai_action === 'report' || alertData.ai_action === 'legal_notice')) {
      html += '<textarea class="ai-evidence-area" id="evidenceDraft" readonly>' + escHtml(alertData.ai_evidence_draft) + '</textarea>' +
        '<div class="ai-evidence-copy" onclick="copyEvidence()">Copy to clipboard</div>';
    }

    html += '</div>';
  }

  body.innerHTML = html;
  drawer.classList.add('open');
  overlay.classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
}

function copyEvidence() {
  const ta = document.getElementById('evidenceDraft');
  if (ta) { navigator.clipboard.writeText(ta.value).catch(function() {}); }
}

// Touch swipe down to dismiss drawer (mobile bottom sheet)
(function() {
  var startY = 0, dragging = false;
  var drawer = null;
  document.addEventListener('touchstart', function(e) {
    drawer = document.getElementById('drawer');
    if (!drawer || !drawer.classList.contains('open')) return;
    var handle = drawer.querySelector('.drawer-handle');
    if (!handle) return;
    var rect = handle.getBoundingClientRect();
    if (e.touches[0].clientY >= rect.top - 20 && e.touches[0].clientY <= rect.bottom + 20) {
      startY = e.touches[0].clientY; dragging = true;
    }
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!dragging || !drawer) return;
    var dy = e.touches[0].clientY - startY;
    if (dy > 0) drawer.style.transform = 'translateY(' + dy + 'px)';
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    if (!dragging || !drawer) return;
    dragging = false;
    var dy = (e.changedTouches[0]?.clientY || 0) - startY;
    if (dy > 80) { closeDrawer(); }
    drawer.style.transform = '';
  });
})();

/* ─── Data loading ─────────────────────────────────────────── */
async function loadBrands() {
  const data = await apiFetch('/api/brand-profiles');
  const sel = document.getElementById('brandSelector');
  sel.innerHTML = '';
  if (!data || !data.length) {
    sel.innerHTML = '<option value="">No brands configured</option>';
    return;
  }
  data.forEach(function(b) {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.brand_name + ' (' + b.domain + ')';
    sel.appendChild(opt);
  });
  currentBrandId = data[0].id;
  sel.addEventListener('change', function() { currentBrandId = sel.value; loadAll(); });
  loadAll();
}

async function loadAll() {
  if (!currentBrandId) return;
  loadPlatforms();
  loadAlerts();
  loadHandles();
}

async function loadPlatforms() {
  const data = await apiFetch('/api/social/monitor/' + currentBrandId);
  const grid = document.getElementById('platformGrid');
  if (!data) {
    grid.innerHTML = '<div class="empty-state"><h3>No monitoring data</h3><p>Run a scan to start monitoring.</p></div>';
    document.getElementById('statPlatforms').textContent = '0';
    return;
  }
  const results = data.results || data;
  const byPlatform = {};
  PLATFORMS.forEach(function(p) { byPlatform[p] = { issues: 0, handle: '\\u2014', lastChecked: null, status: 'unclaimed' }; });

  var totalIssues = 0;
  if (Array.isArray(results)) {
    results.forEach(function(r) {
      if (!byPlatform[r.platform]) return;
      if (r.severity === 'HIGH' || r.severity === 'CRITICAL') { byPlatform[r.platform].issues++; totalIssues++; }
      if (r.handle_checked) byPlatform[r.platform].handle = r.handle_checked;
      if (r.created_at) byPlatform[r.platform].lastChecked = r.created_at;
      if (r.handle_owner_matches_brand) byPlatform[r.platform].status = 'clean';
      else if (r.impersonation_score > 0.5) byPlatform[r.platform].status = 'danger';
      else if (r.handle_available === 0) byPlatform[r.platform].status = 'warning';
    });
  }

  var cleanCount = PLATFORMS.filter(function(p) { return byPlatform[p].status === 'clean'; }).length;
  document.getElementById('statPlatforms').textContent = cleanCount + '/' + PLATFORMS.length;

  grid.innerHTML = PLATFORMS.map(function(p) {
    const d = byPlatform[p];
    const statusClass = d.issues > 0 ? 'danger' : d.status;
    const badge = d.issues > 0 ? '<span class="issue-badge">' + d.issues + '</span>' : '';
    const checked = d.lastChecked ? new Date(d.lastChecked).toLocaleDateString() : 'Never';
    return '<div class="platform-card status-' + statusClass + '">' + badge +
      '<div class="platform-icon">' + (PLATFORM_ICONS[p] || '\\u25CF') + '</div>' +
      '<div class="platform-name">' + p.charAt(0).toUpperCase() + p.slice(1) + '</div>' +
      '<div class="platform-handle mono">' + escHtml(d.handle) + '</div>' +
      '<div class="platform-status">Checked: ' + checked + '</div></div>';
  }).join('');

  const latest = results.filter(function(r) { return r.created_at; }).sort(function(a, b) { return b.created_at.localeCompare(a.created_at); })[0];
  document.getElementById('lastChecked').textContent = latest ? 'Last scan: ' + new Date(latest.created_at).toLocaleString() : '';
}

async function loadAlerts() {
  const data = await apiFetch('/api/social/monitor/' + currentBrandId + '?status=open');
  const list = document.getElementById('alertList');
  const results = data ? (data.results || []) : [];
  cachedAlerts = results;
  var alertCount = results.length;
  document.getElementById('alertCount').textContent = alertCount + ' active';
  document.getElementById('statAlerts').textContent = String(alertCount);

  // Compute risk from max impersonation score
  var maxScore = 0;
  results.forEach(function(r) { if (r.impersonation_score > maxScore) maxScore = r.impersonation_score; });
  var riskPct = Math.round(maxScore * 100);
  var riskColor = riskPct > 80 ? 'var(--red)' : riskPct > 50 ? 'var(--coral)' : riskPct > 30 ? 'var(--amber)' : 'var(--green)';
  document.getElementById('statRisk').innerHTML = arcGauge(riskPct, 40, riskColor);

  if (!results.length) {
    list.innerHTML = '<div class="empty-state"><h3>No active alerts</h3><p>No impersonation detected. Looking good!</p></div>';
    return;
  }

  list.innerHTML = results.map(function(a, idx) {
    const signals = (function() { try { return JSON.parse(a.impersonation_signals || '[]'); } catch(e) { return []; } })();
    const score = Math.round((a.impersonation_score || 0) * 100);
    const barColor = score > 80 ? 'var(--red)' : score > 50 ? 'var(--coral)' : score > 30 ? 'var(--amber)' : 'var(--green)';
    const delay = idx * 60;
    let cardHtml = '<div class="alert-card severity-' + (a.severity || 'LOW') + '" style="animation-delay:' + delay + 'ms" onclick="openDrawer(cachedAlerts[' + idx + '])">' +
      '<div class="alert-info">' +
        '<div class="alert-name">' + escHtml(a.suspicious_account_name || a.handle_checked || 'Unknown') + '</div>' +
        '<div class="alert-meta">' +
          '<span class="severity-badge ' + (a.severity || 'LOW') + '">' + (a.severity || 'LOW') + '</span>' +
          '<span>' + (a.platform || '\\u2014') + '</span>' +
          (a.suspicious_account_url ? '<a href="' + escHtml(a.suspicious_account_url) + '" target="_blank" rel="noopener" style="color:var(--accent)" onclick="event.stopPropagation()">View Profile</a>' : '') +
        '</div>' +
        '<div style="margin-bottom:0.5rem;"><span class="mono" style="font-size:0.75rem;">Impersonation: ' + score + '%</span>' +
          '<div class="score-bar"><div class="score-bar-fill" style="width:' + score + '%;background:' + barColor + '"></div></div></div>' +
        '<div class="alert-signals">' + signals.map(function(s) { return '<span class="signal-tag">' + escHtml(String(s)) + '</span>'; }).join('') + '</div>';

    // Inline AI assessment preview
    if (a.ai_assessment) {
      cardHtml += '<div class="ai-assessment" style="margin-top:0.5rem;padding:0.65rem 0.75rem;">' +
        '<div class="ai-assessment-header"><span class="ai-assessment-label">Sentinel Assessment</span></div>' +
        '<div class="ai-assessment-text" style="font-size:0.78rem;margin-bottom:0.25rem;">' + escHtml(a.ai_assessment.length > 140 ? a.ai_assessment.slice(0, 140) + '...' : a.ai_assessment) + '</div>';
      if (a.ai_action) {
        cardHtml += '<span class="ai-action-pill ' + escHtml(a.ai_action) + '">' + escHtml(ACTION_LABELS[a.ai_action] || a.ai_action) + '</span>';
      }
      cardHtml += '</div>';
    }

    cardHtml += '</div></div>';
    return cardHtml;
  }).join('');
}

async function loadHandles() {
  const data = await apiFetch('/api/brand-profiles/' + currentBrandId + '/handles');
  const tbody = document.getElementById('handleBody');
  if (!data) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No handle data</td></tr>';
    return;
  }
  const handles = typeof data === 'object' && !Array.isArray(data) ? data : {};
  tbody.innerHTML = PLATFORMS.map(function(p) {
    const h = handles[p];
    const handle = h?.handle || '\\u2014';
    const status = h?.status || (h?.handle ? 'verified' : 'unclaimed');
    const dotClass = status === 'verified' ? 'verified' : status === 'squatted' ? 'squatted' : 'unclaimed';
    const action = status === 'unclaimed' ? 'Register handle' : status === 'squatted' ? 'Investigate' : 'Verified';
    return '<tr><td>' + p.charAt(0).toUpperCase() + p.slice(1) + '</td>' +
      '<td class="mono">' + escHtml(handle) + '</td>' +
      '<td><span class="status-dot ' + dotClass + '"></span>' + status + '</td>' +
      '<td>' + (status !== 'verified' ? '<button class="btn btn-outline btn-sm">' + action + '</button>' : '<span style="color:var(--green)">\\u2713</span>') + '</td></tr>';
  }).join('');
}

async function updateAlert(id, status) {
  await fetch('/api/social/monitor/' + id, { method: 'PATCH', headers: headers(), body: JSON.stringify({ status: status }) });
  closeDrawer();
  loadAlerts();
}

async function triggerScan() {
  if (!currentBrandId) return;
  const btn = document.getElementById('scanBtn');
  btn.textContent = 'Scanning...';
  btn.disabled = true;
  await fetch('/api/social/scan/' + currentBrandId, { method: 'POST', headers: headers() });
  btn.textContent = 'Scan Now';
  btn.disabled = false;
  loadAll();
}

// Keyboard: Escape closes drawer
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeDrawer(); });

// Init
(function() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-icon').textContent = saved === 'dark' ? '\\u263E' : '\\u2600';
  if (TOKEN) { loadBrands(); } else {
    document.querySelector('.container').innerHTML = '<div class="empty-state"><h3>Authentication required</h3><p><a href="/login" style="color:var(--accent)">Sign in</a> to view social monitoring.</p></div>';
  }
  refreshTimer = setInterval(function() { if (currentBrandId) loadAll(); }, 60000);
})();
</script>
</body>
</html>`;
}
