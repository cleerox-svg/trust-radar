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
:root {
  --bg-primary: #fafbfc; --bg-secondary: #ffffff; --bg-tertiary: #f1f5f9;
  --text-primary: #0f172a; --text-secondary: #475569; --text-tertiary: #94a3b8;
  --border-light: #e2e8f0; --border-strong: #cbd5e1;
  --accent: #0891b2; --accent-hover: #0e7490;
  --green: #10b981; --amber: #f59e0b; --coral: #f97316; --red: #ef4444;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
}
[data-theme="dark"] {
  --bg-primary: #0b1120; --bg-secondary: #111827; --bg-tertiary: #1a2332;
  --text-primary: #f1f5f9; --text-secondary: #94a3b8; --text-tertiary: #64748b;
  --border-light: #1e293b; --border-strong: #334155;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DM Sans', sans-serif; background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; }
h1, h2, h3 { font-family: 'Plus Jakarta Sans', sans-serif; }
.mono { font-family: 'IBM Plex Mono', monospace; }

/* Layout */
.top-bar { background: var(--bg-secondary); border-bottom: 1px solid var(--border-light); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
.top-bar h1 { font-size: 1.25rem; font-weight: 700; }
.top-bar-actions { display: flex; gap: 0.75rem; align-items: center; }
.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

/* Brand Selector */
select.brand-select { font-family: 'DM Sans', sans-serif; font-size: 0.875rem; padding: 0.5rem 1rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; }

/* Buttons */
.btn { font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 500; padding: 0.5rem 1rem; border-radius: var(--radius-sm); border: none; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-outline { background: transparent; border: 1px solid var(--border-strong); color: var(--text-primary); }
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }
.btn-sm { font-size: 0.75rem; padding: 0.35rem 0.75rem; }
.btn-danger { background: var(--red); color: #fff; }
.btn-success { background: var(--green); color: #fff; }

/* Theme Toggle */
.theme-toggle { background: none; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 0.4rem 0.6rem; cursor: pointer; font-size: 1rem; color: var(--text-secondary); }

/* Platform Grid */
.platform-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; margin-bottom: 2rem; }
.platform-card { background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; text-align: center; transition: border-color 0.2s; position: relative; }
.platform-card:hover { border-color: var(--accent); }
.platform-card.status-clean { border-left: 3px solid var(--green); }
.platform-card.status-warning { border-left: 3px solid var(--amber); }
.platform-card.status-danger { border-left: 3px solid var(--red); }
.platform-card.status-unclaimed { border-left: 3px solid var(--text-tertiary); }
.platform-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
.platform-name { font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem; }
.platform-handle { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; }
.platform-status { font-size: 0.7rem; color: var(--text-tertiary); }
.issue-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: var(--red); color: #fff; font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 999px; }

/* Section Headers */
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.section-header h2 { font-size: 1.1rem; font-weight: 700; }
.section-header .count { font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; color: var(--text-tertiary); }

/* Alert Cards */
.alert-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem; }
.alert-card { background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1.25rem; display: flex; gap: 1rem; align-items: flex-start; }
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

/* Score Bar */
.score-bar { width: 100%; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden; margin: 0.4rem 0; }
.score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }

/* Handle Table */
.handle-table { width: 100%; border-collapse: collapse; background: var(--bg-secondary); border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-light); }
.handle-table th { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); text-align: left; padding: 0.75rem 1rem; background: var(--bg-tertiary); border-bottom: 1px solid var(--border-light); }
.handle-table td { font-size: 0.85rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-light); }
.handle-table tr:last-child td { border-bottom: none; }
.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.4rem; vertical-align: middle; }
.status-dot.verified { background: var(--green); }
.status-dot.unclaimed { background: var(--text-tertiary); }
.status-dot.squatted { background: var(--red); }

/* Empty State */
.empty-state { text-align: center; padding: 3rem; color: var(--text-tertiary); }
.empty-state h3 { font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-secondary); }

/* Loading */
.loading { text-align: center; padding: 2rem; color: var(--text-tertiary); }
.spinner { display: inline-block; width: 24px; height: 24px; border: 2px solid var(--border-light); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Responsive */
@media (max-width: 1024px) { .platform-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 768px) {
  .platform-grid { grid-template-columns: repeat(2, 1fr); }
  .container { padding: 1rem; }
  .alert-card { flex-direction: column; }
}
</style>
</head>
<body>

<div class="top-bar">
  <div style="display:flex;align-items:center;gap:1rem;">
    <a href="/dashboard" style="color:var(--text-secondary);text-decoration:none;font-size:0.85rem;">← Dashboard</a>
    <h1>Social Brand Monitoring</h1>
  </div>
  <div class="top-bar-actions">
    <select class="brand-select" id="brandSelector">
      <option value="">Loading brands...</option>
    </select>
    <button class="btn btn-primary btn-sm" onclick="triggerScan()">Scan Now</button>
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
    <div class="loading"><div class="spinner"></div><br>Loading platforms...</div>
  </div>

  <!-- Impersonation Alerts -->
  <div class="section-header">
    <h2>Impersonation Alerts</h2>
    <span class="count" id="alertCount">—</span>
  </div>
  <div class="alert-list" id="alertList">
    <div class="loading"><div class="spinner"></div><br>Loading alerts...</div>
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
      <tr><td colspan="4" class="loading"><div class="spinner"></div> Loading...</td></tr>
    </tbody>
  </table>
</div>

<script>
const PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'github', 'youtube'];
const PLATFORM_ICONS = { twitter: '𝕏', linkedin: 'in', instagram: '📷', tiktok: '♪', github: '⌨', youtube: '▶' };
const TOKEN = localStorage.getItem('token') || '';
let currentBrandId = '';
let refreshTimer = null;

function headers() { return { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }; }

async function apiFetch(path) {
  try {
    const res = await fetch(path, { headers: headers() });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch { return null; }
}

async function loadBrands() {
  const data = await apiFetch('/api/brand-profiles');
  const sel = document.getElementById('brandSelector');
  sel.innerHTML = '';
  if (!data || !data.length) {
    sel.innerHTML = '<option value="">No brands configured</option>';
    return;
  }
  data.forEach((b, i) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.brand_name + ' (' + b.domain + ')';
    sel.appendChild(opt);
  });
  currentBrandId = data[0].id;
  sel.addEventListener('change', () => { currentBrandId = sel.value; loadAll(); });
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
    return;
  }
  const results = data.results || data;
  const byPlatform = {};
  PLATFORMS.forEach(p => byPlatform[p] = { issues: 0, handle: '—', lastChecked: null, status: 'unclaimed' });

  if (Array.isArray(results)) {
    results.forEach(r => {
      if (!byPlatform[r.platform]) return;
      if (r.severity === 'HIGH' || r.severity === 'CRITICAL') byPlatform[r.platform].issues++;
      if (r.handle_checked) byPlatform[r.platform].handle = r.handle_checked;
      if (r.created_at) byPlatform[r.platform].lastChecked = r.created_at;
      if (r.handle_owner_matches_brand) byPlatform[r.platform].status = 'clean';
      else if (r.impersonation_score > 0.5) byPlatform[r.platform].status = 'danger';
      else if (r.handle_available === 0) byPlatform[r.platform].status = 'warning';
    });
  }

  grid.innerHTML = PLATFORMS.map(p => {
    const d = byPlatform[p];
    const statusClass = d.issues > 0 ? 'danger' : d.status;
    const badge = d.issues > 0 ? '<span class="issue-badge">' + d.issues + '</span>' : '';
    const checked = d.lastChecked ? new Date(d.lastChecked).toLocaleDateString() : 'Never';
    return '<div class="platform-card status-' + statusClass + '">' + badge +
      '<div class="platform-icon">' + (PLATFORM_ICONS[p] || '●') + '</div>' +
      '<div class="platform-name">' + p.charAt(0).toUpperCase() + p.slice(1) + '</div>' +
      '<div class="platform-handle mono">' + escHtml(d.handle) + '</div>' +
      '<div class="platform-status">Checked: ' + checked + '</div></div>';
  }).join('');

  const latest = results.filter(r => r.created_at).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  document.getElementById('lastChecked').textContent = latest ? 'Last scan: ' + new Date(latest.created_at).toLocaleString() : '';
}

async function loadAlerts() {
  const data = await apiFetch('/api/social/alerts');
  const list = document.getElementById('alertList');
  const alerts = Array.isArray(data) ? data : (data?.alerts || []);
  document.getElementById('alertCount').textContent = alerts.length + ' active';

  if (!alerts.length) {
    list.innerHTML = '<div class="empty-state"><h3>No active alerts</h3><p>No impersonation detected. Looking good!</p></div>';
    return;
  }

  list.innerHTML = alerts.map(a => {
    const signals = (() => { try { return JSON.parse(a.impersonation_signals || '[]'); } catch { return []; } })();
    const score = Math.round((a.impersonation_score || 0) * 100);
    const barColor = score > 80 ? 'var(--red)' : score > 50 ? 'var(--coral)' : score > 30 ? 'var(--amber)' : 'var(--green)';
    return '<div class="alert-card severity-' + (a.severity || 'LOW') + '">' +
      '<div class="alert-info">' +
        '<div class="alert-name">' + escHtml(a.suspicious_account_name || a.handle_checked || 'Unknown') + '</div>' +
        '<div class="alert-meta">' +
          '<span class="severity-badge ' + (a.severity || 'LOW') + '">' + (a.severity || 'LOW') + '</span>' +
          '<span>' + (a.platform || '—') + '</span>' +
          (a.suspicious_account_url ? '<a href="' + escHtml(a.suspicious_account_url) + '" target="_blank" style="color:var(--accent)">View Profile →</a>' : '') +
        '</div>' +
        '<div style="margin-bottom:0.5rem;"><span class="mono" style="font-size:0.75rem;">Impersonation: ' + score + '%</span>' +
          '<div class="score-bar"><div class="score-bar-fill" style="width:' + score + '%;background:' + barColor + '"></div></div></div>' +
        '<div class="alert-signals">' + signals.map(s => '<span class="signal-tag">' + escHtml(String(s)) + '</span>').join('') + '</div>' +
        '<div class="alert-actions">' +
          '<button class="btn btn-outline btn-sm" onclick="updateAlert(\\'' + a.id + '\\',\\'investigating\\')">Investigate</button>' +
          '<button class="btn btn-outline btn-sm" onclick="updateAlert(\\'' + a.id + '\\',\\'false_positive\\')">False Positive</button>' +
          '<button class="btn btn-success btn-sm" onclick="updateAlert(\\'' + a.id + '\\',\\'resolved\\')">Resolve</button>' +
        '</div>' +
      '</div></div>';
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
  tbody.innerHTML = PLATFORMS.map(p => {
    const h = handles[p];
    const handle = h?.handle || '—';
    const status = h?.status || (h?.handle ? 'verified' : 'unclaimed');
    const dotClass = status === 'verified' ? 'verified' : status === 'squatted' ? 'squatted' : 'unclaimed';
    const action = status === 'unclaimed' ? 'Register handle' : status === 'squatted' ? 'Investigate' : 'Verified';
    return '<tr><td>' + p.charAt(0).toUpperCase() + p.slice(1) + '</td>' +
      '<td class="mono">' + escHtml(handle) + '</td>' +
      '<td><span class="status-dot ' + dotClass + '"></span>' + status + '</td>' +
      '<td>' + (status !== 'verified' ? '<button class="btn btn-outline btn-sm">' + action + '</button>' : '<span style="color:var(--green)">✓</span>') + '</td></tr>';
  }).join('');
}

async function updateAlert(id, status) {
  await fetch('/api/social/monitor/' + id, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ status })
  });
  loadAlerts();
}

async function triggerScan() {
  if (!currentBrandId) return;
  const btn = event.target;
  btn.textContent = 'Scanning...';
  btn.disabled = true;
  await fetch('/api/social/scan/' + currentBrandId, { method: 'POST', headers: headers() });
  btn.textContent = 'Scan Now';
  btn.disabled = false;
  loadAll();
}

function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  document.getElementById('theme-icon').textContent = t === 'dark' ? '☾' : '☀';
}

// Init
(function() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-icon').textContent = saved === 'dark' ? '☾' : '☀';
  if (TOKEN) { loadBrands(); } else {
    document.querySelector('.container').innerHTML = '<div class="empty-state"><h3>Authentication required</h3><p><a href="/login" style="color:var(--accent)">Sign in</a> to view social monitoring.</p></div>';
  }
  refreshTimer = setInterval(() => { if (currentBrandId) loadAll(); }, 60000);
})();
</script>
</body>
</html>`;
}
