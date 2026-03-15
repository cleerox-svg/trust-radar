// Trust Radar v2 — SPA Shell (Router, API Client, Shared Components)

// ─── Auth State ─────────────────────────────────────────────────
let accessToken = null;
let currentUser = null;

function getAccessToken() { return accessToken; }
function setAccessToken(token) { accessToken = token; }
function isAuthenticated() { return !!accessToken; }

// Parse token from auth callback hash fragment
function checkAuthCallback() {
  if (location.pathname === '/auth/callback' && location.hash) {
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.get('token');
    if (token) {
      setAccessToken(token);
      navigate('/observatory');
      return true;
    }
  }
  return false;
}

// ─── API Client ─────────────────────────────────────────────────
async function api(path, options = {}) {
  const token = getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api' + path, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      return fetch('/api' + path, { ...options, headers, credentials: 'include' }).then(r => r.json());
    }
    navigate('/login');
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

async function refreshToken() {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.success && data.data?.token) {
      setAccessToken(data.data.token);
      currentUser = data.data.user;
      return true;
    }
    return false;
  } catch { return false; }
}

// ─── Router ─────────────────────────────────────────────────────
const routes = [
  { path: '/',                      view: viewRootRedirect,    auth: false },
  { path: '/observatory',           view: viewObservatory,     auth: true },
  { path: '/brands',               view: viewBrandsHub,       auth: true },
  { path: '/brands/:id',           view: viewBrandDetail,     auth: true },
  { path: '/providers',            view: viewProvidersHub,    auth: true },
  { path: '/providers/:id',        view: viewProviderDetail,  auth: true },
  { path: '/campaigns',            view: viewCampaignsHub,    auth: true },
  { path: '/campaigns/:id',        view: viewCampaignDetail,  auth: true },
  { path: '/trends',               view: viewTrends,          auth: true },
  { path: '/agents',               view: viewAgents,          auth: true },
  { path: '/admin',                view: viewAdmin,           auth: true, admin: true },
  { path: '/admin/users',          view: viewAdminUsers,      auth: true, admin: true },
  { path: '/admin/feeds',          view: viewAdminFeeds,      auth: true, admin: true },
  { path: '/admin/leads',          view: viewAdminLeads,      auth: true, admin: true },
  { path: '/admin/api-keys',       view: viewAdminApiKeys,    auth: true, admin: true },
  { path: '/admin/agent-config',   view: viewAdminAgentConfig, auth: true, admin: true },
  { path: '/admin/audit',          view: viewAdminAudit,      auth: true, admin: true },
  { path: '/login',                view: viewLogin,           auth: false },
  { path: '/auth/callback',        view: viewAuthCallback,    auth: false },
  { path: '/auth/error',           view: viewAuthError,       auth: false },
];

let currentParams = {};

function matchRoute(pathname) {
  for (const route of routes) {
    const parts = route.path.split('/');
    const pathParts = pathname.split('/');
    if (parts.length !== pathParts.length) continue;

    const params = {};
    let match = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) {
        params[parts[i].slice(1)] = pathParts[i];
      } else if (parts[i] !== pathParts[i]) {
        match = false; break;
      }
    }
    if (match) return { route, params };
  }
  return null;
}

function navigate(path, replace = false) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  render();
}

window.addEventListener('popstate', render);

// Intercept all link clicks for SPA navigation
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.origin !== location.origin) return;
  if (a.pathname.startsWith('/api/')) return;
  e.preventDefault();
  navigate(a.pathname + a.search);
});

async function render() {
  const app = document.getElementById('app');
  const pathname = location.pathname;

  // Handle auth callback
  if (pathname === '/auth/callback') {
    if (checkAuthCallback()) return;
  }

  const matched = matchRoute(pathname);
  if (!matched) {
    app.innerHTML = renderTopbar() + '<div class="main"><div class="empty-state"><div class="message">Page not found</div></div></div>';
    return;
  }

  const { route, params } = matched;
  currentParams = params;

  // Auth check
  if (route.auth && !isAuthenticated()) {
    // Try refresh first
    const refreshed = await refreshToken();
    if (!refreshed) { navigate('/login', true); return; }
  }

  // Fetch user info if authenticated and not yet loaded
  if (isAuthenticated() && !currentUser) {
    try {
      const res = await api('/auth/me');
      if (res?.data) currentUser = res.data;
    } catch { /* will redirect on 401 */ }
  }

  // Admin check
  if (route.admin && currentUser && !['super_admin', 'admin'].includes(currentUser.role)) {
    app.innerHTML = renderTopbar() + '<div class="main"><div class="empty-state"><div class="message">Forbidden: Admin access required</div></div></div>';
    return;
  }

  // Cleanup previous view
  if (window._viewCleanup) { window._viewCleanup(); window._viewCleanup = null; }

  // Render view
  if (route.auth) {
    const isAdmin = pathname.startsWith('/admin');
    const isObservatory = pathname === '/observatory';
    if (isObservatory) {
      app.innerHTML = `<div>${renderTopbar()}<div class="observatory-layout"><div class="main" id="view"></div><div class="obs-sidebar" id="obs-sidebar"></div></div></div><div class="toast-container" id="toasts"></div>`;
    } else if (isAdmin) {
      app.innerHTML = `<div class="admin-mode">${renderAdminTopbar(pathname)}<div class="main" id="view"></div></div><div class="toast-container" id="toasts"></div>`;
    } else {
      app.innerHTML = `<div>${renderTopbar()}` +
        `<div class="main" id="view"></div></div><div class="toast-container" id="toasts"></div>`;
    }
    route.view(document.getElementById('view'), params);
  } else {
    app.innerHTML = '<div id="view"></div><div class="toast-container" id="toasts"></div>';
    route.view(document.getElementById('view'), params);
  }
}

// ─── Shared Components ──────────────────────────────────────────

function renderTopbar() {
  const u = currentUser;
  const initials = u?.name ? u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  const isAdmin = ['super_admin', 'admin'].includes(u?.role);
  const path = location.pathname;

  const navItems = [
    { href: '/observatory', label: 'Observatory' },
    { href: '/brands', label: 'Brands' },
    { href: '/providers', label: 'Providers' },
    { href: '/campaigns', label: 'Campaigns' },
    { href: '/trends', label: 'Trends' },
    { href: '/agents', label: 'Agents' },
  ];

  return `<div class="topbar">
    <div class="topbar-logo"><span class="dot"></span>TRUST RADAR</div>
    <nav class="topbar-nav">
      ${navItems.map(n => `<a href="${n.href}" class="${path === n.href || (n.href !== '/' && path.startsWith(n.href)) ? 'active' : ''}">${n.label}</a>`).join('')}
    </nav>
    <div class="topbar-right">
      <div class="feed-status"><span class="dot"></span><span id="feed-count">--</span> feeds</div>
      <div class="live-tag">LIVE</div>
      <div class="user-menu" onclick="this.classList.toggle('open')">
        <div class="user-avatar">${initials}</div>
        <div class="user-dropdown">
          <a href="/observatory">${u?.email || ''}</a>
          <a href="/observatory"><span class="role-pill ${u?.role}">${u?.role || ''}</span></a>
          ${isAdmin ? '<a href="/admin">Admin Panel</a>' : ''}
          <a href="#" onclick="logout(); return false;">Logout</a>
        </div>
      </div>
    </div>
  </div>`;
}

function renderAdminTopbar(activePath) {
  const u = currentUser;
  const initials = u?.name ? u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  const adminNav = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/feeds', label: 'Feeds' },
    { href: '/admin/leads', label: 'Leads' },
    { href: '/admin/api-keys', label: 'API Keys' },
    { href: '/admin/agent-config', label: 'Agent Config' },
    { href: '/admin/audit', label: 'Audit Log' },
  ];
  return `<div class="topbar admin-topbar">
    <div class="topbar-left" style="display:flex;align-items:center;gap:20px">
      <div class="topbar-logo"><span class="dot"></span>TRUST RADAR</div>
      <span class="admin-badge">Admin</span>
      <nav class="admin-nav-pills">
        ${adminNav.map(n => `<a href="${n.href}" class="admin-np${activePath === n.href ? ' active' : ''}">${n.label}</a>`).join('')}
      </nav>
    </div>
    <div class="topbar-right">
      <a href="/observatory" class="admin-back-link">\u2190 Back to Observatory</a>
      <div class="user-menu" onclick="this.classList.toggle('open')">
        <div class="user-avatar">${initials}</div>
        <div class="user-dropdown">
          <a href="/observatory">${u?.email || ''}</a>
          <a href="#" onclick="logout(); return false;">Logout</a>
        </div>
      </div>
    </div>
  </div>`;
}

function renderStatCard(icon, iconClass, value, label, trend) {
  const trendHtml = trend !== undefined && trend !== null
    ? `<span class="stat-trend ${trend >= 0 ? 'up' : 'down'}">${trend >= 0 ? '+' : ''}${trend}%</span>` : '';
  return `<div class="stat-card">
    <div class="stat-icon ${iconClass}">${icon}</div>
    <div class="stat-content"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>
    ${trendHtml}
  </div>`;
}

function renderPanel(title, badge, body) {
  const badgeHtml = badge !== undefined ? `<span class="badge">${badge}</span>` : '';
  return `<div class="panel"><div class="phead">${title}${badgeHtml}</div><div class="panel-body">${body}</div></div>`;
}

function renderDataTable(columns, rows, options = {}) {
  const { onRowClick, id, emptyMessage } = options;
  if (!rows.length) {
    return `<div class="empty-state"><div class="message">${emptyMessage || 'No data'}</div></div>`;
  }
  const thead = columns.map(c => `<th>${c.label}</th>`).join('');
  const tbody = rows.map((row, i) => {
    const cells = columns.map(c => {
      const val = c.render ? c.render(row[c.key], row) : (row[c.key] ?? '-');
      return `<td class="${c.className || ''}">${val}</td>`;
    }).join('');
    return `<tr data-idx="${i}">${cells}</tr>`;
  }).join('');

  return `<table class="data-table" ${id ? `id="${id}"` : ''}><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

function renderBarRow(label, value, max) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<div class="bar-row">
    <span class="label" title="${label}">${label}</span>
    <div class="track"><div class="fill" style="width:${pct}%"></div></div>
    <span class="count">${value}</span>
  </div>`;
}

function renderFilterPills(items, activeValues, containerId) {
  return `<div class="filter-pills" id="${containerId}">${items.map(item =>
    `<button class="filter-pill ${activeValues.includes(item.value) ? 'active' : ''}" data-value="${item.value}">${item.label}</button>`
  ).join('')}</div>`;
}

function renderPeriodSelector(active, containerId) {
  const periods = [{ v: '7d', l: '7D' }, { v: '30d', l: '30D' }, { v: '90d', l: '90D' }, { v: '1y', l: '1Y' }];
  return `<div class="period-selector" id="${containerId}">${periods.map(p =>
    `<button class="period-btn ${active === p.v ? 'active' : ''}" data-period="${p.v}">${p.l}</button>`
  ).join('')}</div>`;
}

function renderSparkline(data, width = 80, height = 20) {
  if (!data.length) return '';
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`).join(' ');
  return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><polyline points="${points}"/></svg>`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function showModal(title, bodyHtml, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">
    <div class="modal-title">${title}</div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-actions">
      <button class="modal-btn-cancel" data-action="cancel">Cancel</button>
      <button class="modal-btn-submit" data-action="confirm">Begin Monitoring</button>
    </div>
  </div>`;
  const close = () => overlay.remove();
  overlay.addEventListener('click', async (e) => {
    if (e.target === overlay || e.target.dataset.action === 'cancel') close();
    if (e.target.dataset.action === 'confirm' && onConfirm) {
      const result = await onConfirm(overlay);
      if (result !== false) close();
    }
  });
  document.body.appendChild(overlay);
}

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  accessToken = null;
  currentUser = null;
  navigate('/login');
}

// ─── View: Root (public landing / redirect) ────────────────────
async function viewRootRedirect(el) {
  // If already authenticated (in-SPA nav), go to observatory
  if (isAuthenticated()) { navigate('/observatory', true); return; }
  // Try refresh (user has cookie but page was reloaded)
  const refreshed = await refreshToken();
  if (refreshed) { navigate('/observatory', true); return; }
  // Unauthenticated → show simple coming soon page
  el.innerHTML = `<div class="login-screen">
    <div class="login-logo">TRUST RADAR</div>
    <p style="color:var(--text-secondary);font-size:14px;margin:12px 0 24px">AI-Powered Brand Threat Intelligence</p>
    <p style="color:var(--text-tertiary);font-size:12px;margin-bottom:24px">Public site coming soon. Sign in to access the Observatory.</p>
    <a class="login-btn" href="/api/auth/login">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Sign in with Google
    </a>
  </div>`;
}

// ─── View: Login ────────────────────────────────────────────────
function viewLogin(el) {
  el.innerHTML = `<div class="login-screen">
    <div class="login-logo">TRUST RADAR</div>
    <p style="color:var(--text-secondary);font-size:13px">Threat Intelligence Observatory</p>
    <a class="login-btn" href="/api/auth/login">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Sign in with Google
    </a>
  </div>`;
}

function viewAuthCallback(el) {
  el.innerHTML = '<div class="login-screen"><div class="login-logo">Authenticating...</div></div>';
}

function viewAuthError(el) {
  const msg = new URLSearchParams(location.search).get('message') || 'Authentication failed';
  el.innerHTML = `<div class="login-screen">
    <div class="login-logo">TRUST RADAR</div>
    <p style="color:var(--negative);font-size:13px">${msg}</p>
    <a class="login-btn" href="/api/auth/login">Try Again</a>
  </div>`;
}

// ─── View: Observatory (Step 8) ─────────────────────────────
let _obsMap = null;
let _obsPoller = null;

function renderStatChip(icon, iconClass, value, label, trend) {
  const trendHtml = trend != null ? `<span class="chip-trend ${trend >= 0 ? 'up' : 'down'}">${trend >= 0 ? '+' : ''}${trend}</span>` : '';
  return `<div class="stat-chip">
    <div class="chip-icon ${iconClass}">${icon}</div>
    <div><div class="chip-value">${value}</div><div class="chip-label">${label}</div></div>
    ${trendHtml}
  </div>`;
}

async function viewObservatory(el) {
  el.innerHTML = `<div class="map-container" id="map-wrap">
    <div id="obs-map"></div>
    <div class="hud-corners"><div class="hud-corner tl"></div><div class="hud-corner tr"></div><div class="hud-corner bl"></div><div class="hud-corner br"></div></div>
    <div class="scan-line"></div>
    <div class="utc-clock" id="utc-clock"></div>
    <div class="country-tooltip" id="country-tooltip"><div class="ct-name" id="ct-name"></div><div id="ct-rows"></div></div>
    <div class="stat-bar-overlay" id="stat-bar"></div>
    <div class="severity-legend">
      <div class="sl-row"><div class="sl-dot" style="background:var(--threat-critical)"></div>Critical (8+)</div>
      <div class="sl-row"><div class="sl-dot" style="background:var(--threat-high)"></div>High (5-7)</div>
      <div class="sl-row"><div class="sl-dot" style="background:var(--threat-medium)"></div>Medium (3-4)</div>
      <div class="sl-row"><div class="sl-dot" style="background:var(--blue-primary)"></div>Low (&lt;3)</div>
    </div>
  </div>`;

  // Local time clock
  const clockEl = document.getElementById('utc-clock');
  const _tzAbbr = Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || 'LOCAL';
  function _updateClock() { clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + _tzAbbr; }
  _updateClock();
  const clockInterval = setInterval(_updateClock, 1000);

  // Initialize Leaflet map
  const map = L.map('obs-map', { zoomControl: false, attributionControl: false }).setView([25, 10], 2.5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18 }).addTo(map);
  L.control.zoom({ position: 'topleft' }).addTo(map);
  _obsMap = map;

  let _obsPulseInterval = null;

  window._viewCleanup = () => {
    clearInterval(clockInterval);
    if (_obsPulseInterval) clearInterval(_obsPulseInterval);
    if (_obsPoller) clearInterval(_obsPoller);
    if (_obsMap) { _obsMap.remove(); _obsMap = null; }
    _obsPoller = null;
  };

  try {
    const [stats, clusters, flows, topBrands, worstProv, improvingProv, insights] = await Promise.all([
      api('/dashboard/overview').catch(() => null),
      api('/threats/geo-clusters').catch(() => null),
      api('/threats/attack-flows').catch(() => null),
      api('/dashboard/top-brands?limit=10').catch(() => null),
      api('/dashboard/providers?sort=worst&limit=5').catch(() => null),
      api('/dashboard/providers?sort=improving&limit=3').catch(() => null),
      api('/insights/latest?limit=5').catch(() => null),
    ]);

    const d = stats?.data || {};
    const fc = document.getElementById('feed-count');
    if (fc) fc.textContent = d.feed_health?.active || 0;

    // Stat bar chips
    document.getElementById('stat-bar').innerHTML = [
      renderStatChip('\u26a0', 'threats', d.active_threats || 0, 'Active Threats', d.threats_24h),
      renderStatChip('\u2b50', 'brands', d.brands_tracked || 0, 'Brands Tracked', d.brands_new),
      renderStatChip('\ud83c\udfe2', 'providers', d.providers_tracked || 0, 'Providers', d.providers_delta),
      renderStatChip('\ud83c\udfaf', 'campaigns', d.active_campaigns || 0, 'Campaigns', d.campaigns_new),
    ].join('');

    // Heatmap layer
    const clusterData = clusters?.data || [];
    if (clusterData.length > 0) {
      const heatPoints = [];
      clusterData.forEach(c => {
        const count = Math.max(1, Math.ceil(c.threat_count / 5));
        for (let i = 0; i < count; i++) {
          heatPoints.push([c.lat + (Math.random() - 0.5) * 3, c.lng + (Math.random() - 0.5) * 3, c.intensity || 0.5]);
        }
      });
      L.heatLayer(heatPoints, {
        radius: 25, blur: 20, maxZoom: 10, max: 1.0,
        gradient: { 0.0: '#040810', 0.2: '#003366', 0.4: '#005f7a', 0.5: '#0091b3', 0.6: '#00d4ff', 0.75: '#ffb627', 0.85: '#ff6b35', 1.0: '#ff3b5c' }
      }).addTo(map);
    }

    // Cluster markers + pulse ring layer group
    const pulseRings = L.layerGroup().addTo(map);

    clusterData.forEach(c => {
      const color = c.intensity >= 0.8 ? '#ff3b5c' : c.intensity >= 0.5 ? '#ff6b35' : c.intensity >= 0.3 ? '#ffb627' : '#00d4ff';
      const outerR = Math.max(8, Math.min(30, c.threat_count * 0.5));

      // Outer ring (used for pulse animation)
      const ring = L.circleMarker([c.lat, c.lng], { radius: outerR, color, fillColor: color, fillOpacity: 0.12, weight: 1, opacity: 0.4 });
      ring._baseRadius = outerR;
      ring.addTo(pulseRings);

      // Inner bright core
      const marker = L.circleMarker([c.lat, c.lng], { radius: Math.max(3, outerR * 0.4), color, fillColor: color, fillOpacity: 0.85, weight: 0.5, opacity: 1 }).addTo(map);

      // Click popup (matches prototype: country name, threats, brands, type, providers)
      const popupContent = `
        <div class="popup-title">${c.country || c.country_code || 'Unknown'}</div>
        <div class="popup-row"><span class="popup-label">Active threats</span><span class="popup-val" style="color:${color}">${(c.threat_count || 0).toLocaleString()}</span></div>
        <div class="popup-row"><span class="popup-label">Brands targeted</span><span class="popup-val">${c.brands_targeted || 0}</span></div>
        <div class="popup-row"><span class="popup-label">Top threat type</span><span class="popup-val">${c.top_threat_type || '-'}</span></div>
        <div class="popup-row"><span class="popup-label">Hosting providers</span><span class="popup-val">${c.provider_count || 0}</span></div>
      `;
      marker.bindPopup(popupContent, { className: 'threat-popup' });

      // Hover → sidebar country tooltip
      marker.on('mouseover', () => {
        const tt = document.getElementById('country-tooltip');
        document.getElementById('ct-name').textContent = c.country || c.country_code || 'Unknown';
        document.getElementById('ct-rows').innerHTML =
          `<div class="ct-row"><span>Threats</span><span>${c.threat_count}</span></div>` +
          `<div class="ct-row"><span>Brands</span><span>${c.brands_targeted || 0}</span></div>` +
          `<div class="ct-row"><span>Type</span><span>${c.top_threat_type || '-'}</span></div>` +
          `<div class="ct-row"><span>Providers</span><span>${c.provider_count || 0}</span></div>`;
        tt.classList.add('visible');
      });
      marker.on('mouseout', () => document.getElementById('country-tooltip').classList.remove('visible'));
    });

    // Pulse animation — expand outer rings every 3s then revert (matches prototype)
    _obsPulseInterval = setInterval(() => {
      pulseRings.eachLayer(ring => {
        const base = ring._baseRadius || ring.getRadius();
        const expand = base * (1 + Math.random() * 0.3);
        ring.setRadius(expand);
        setTimeout(() => ring.setRadius(base), 1500);
      });
    }, 3000);

    // Arc overlay (canvas)
    const flowData = flows?.data || [];
    if (flowData.length > 0) {
      const ArcLayer = L.Layer.extend({
        onAdd(m) {
          this._map = m;
          this._canvas = L.DomUtil.create('canvas', '');
          this._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:450;';
          m.getPane('overlayPane').appendChild(this._canvas);
          this._particles = [];
          flowData.forEach((f, fi) => {
            const count = Math.ceil((f.volume || 1) * 0.8);
            for (let i = 0; i < count; i++) {
              this._particles.push({ fi, t: Math.random(), speed: 0.002 + Math.random() * 0.003, size: 1.5 + (f.volume || 1) * 0.2 });
            }
          });
          m.on('move zoom resize', this._reset, this);
          this._reset();
          this._animate();
        },
        onRemove(m) {
          if (this._canvas.parentNode) this._canvas.parentNode.removeChild(this._canvas);
          m.off('move zoom resize', this._reset, this);
          if (this._frame) cancelAnimationFrame(this._frame);
        },
        _reset() {
          const size = this._map.getSize();
          this._canvas.width = size.x; this._canvas.height = size.y;
          L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0]));
        },
        _getColor(vol) { return vol >= 8 ? '#ff3b5c' : vol >= 5 ? '#ff6b35' : vol >= 3 ? '#ffb627' : '#00d4ff'; },
        _animate() {
          const ctx = this._canvas.getContext('2d');
          ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
          const m = this._map;
          const cpCache = [];
          flowData.forEach((f, fi) => {
            const op = m.latLngToContainerPoint([f.origin_lat, f.origin_lng]);
            const tp = m.latLngToContainerPoint([f.target_lat, f.target_lng]);
            const mx = (op.x + tp.x) / 2, my = (op.y + tp.y) / 2;
            const dx = tp.x - op.x, dy = tp.y - op.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const offset = Math.min(120, dist * 0.3);
            const cx = mx - (dy / dist) * offset, cy = my + (dx / dist) * offset;
            cpCache[fi] = { op, tp, cx, cy };
            const color = this._getColor(f.volume || 1);
            ctx.beginPath(); ctx.moveTo(op.x, op.y); ctx.quadraticCurveTo(cx, cy, tp.x, tp.y);
            ctx.strokeStyle = color + '26'; ctx.lineWidth = (f.volume || 1) * 0.22; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(op.x, op.y); ctx.quadraticCurveTo(cx, cy, tp.x, tp.y);
            ctx.strokeStyle = color + '59'; ctx.lineWidth = (f.volume || 1) * 0.11; ctx.stroke();
            // Origin diamond
            ctx.save(); ctx.translate(op.x, op.y); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = color + '80'; ctx.fillRect(-3, -3, 6, 6); ctx.restore();
            // Target crosshair
            ctx.strokeStyle = color + '80'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(tp.x - 5, tp.y); ctx.lineTo(tp.x + 5, tp.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(tp.x, tp.y - 5); ctx.lineTo(tp.x, tp.y + 5); ctx.stroke();
            // Arrowhead
            const angle = Math.atan2(tp.y - cy, tp.x - cx);
            const aLen = 4 + (f.volume || 1) * 0.5;
            ctx.beginPath(); ctx.moveTo(tp.x, tp.y);
            ctx.lineTo(tp.x - aLen * Math.cos(angle - 0.4), tp.y - aLen * Math.sin(angle - 0.4));
            ctx.moveTo(tp.x, tp.y);
            ctx.lineTo(tp.x - aLen * Math.cos(angle + 0.4), tp.y - aLen * Math.sin(angle + 0.4));
            ctx.strokeStyle = color + '99'; ctx.lineWidth = 1.5; ctx.stroke();
          });
          // Particles
          this._particles.forEach(p => {
            const cp = cpCache[p.fi];
            if (!cp) return;
            const t = p.t;
            if (t >= 0 && t <= 1) {
              const x = (1 - t) * (1 - t) * cp.op.x + 2 * (1 - t) * t * cp.cx + t * t * cp.tp.x;
              const y = (1 - t) * (1 - t) * cp.op.y + 2 * (1 - t) * t * cp.cy + t * t * cp.tp.y;
              const color = this._getColor(flowData[p.fi].volume || 1);
              ctx.beginPath(); ctx.arc(x, y, p.size + 3, 0, Math.PI * 2);
              ctx.fillStyle = color + '26'; ctx.fill();
              ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2);
              ctx.fillStyle = color + 'd9'; ctx.fill();
              ctx.beginPath(); ctx.arc(x, y, p.size * 0.4, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffffb3'; ctx.fill();
            }
            p.t += p.speed;
            if (p.t > 1.05) p.t = -0.05;
          });
          this._frame = requestAnimationFrame(() => this._animate());
        }
      });
      new ArcLayer().addTo(map);
    }

    // Sidebar
    const sidebar = document.getElementById('obs-sidebar');
    if (sidebar) {
      const brandRows = (topBrands?.data || []).map((b, i) => {
        const initials = (b.name || '').slice(0, 2).toUpperCase();
        const color = b.threat_count > 50 ? 'var(--threat-critical)' : b.threat_count > 20 ? 'var(--threat-high)' : 'var(--blue-primary)';
        return `<a href="/brands/${b.brand_id || b.id}" class="sidebar-brand-row">
          <span class="rank">${i + 1}</span>
          <div class="brand-icon" style="color:${color};border-color:${color}">${initials}</div>
          <div class="brand-info"><div class="brand-name">${b.name}</div><div class="brand-sector">${b.sector || ''}</div></div>
          <span class="threat-count" style="color:${color}">${b.threat_count}</span>
        </a>`;
      }).join('') || '<div class="empty-state"><div class="message">No brands yet</div></div>';

      const worstRows = (worstProv?.data || []).map(p =>
        `<a href="/providers/${encodeURIComponent(p.provider_id || p.name)}" class="sidebar-provider-row">
          <div class="status-dot-sm" style="background:var(--negative)"></div>
          <div class="prov-info"><div class="prov-name">${p.name}</div><div class="prov-asn">${p.asn || ''}</div></div>
          <span class="prov-count">${p.threat_count}</span>
          <span class="prov-trend" style="color:var(--negative)">${p.trend_7d_pct >= 0 ? '+' : ''}${p.trend_7d_pct || 0}%</span>
        </a>`
      ).join('');

      const improvingRows = (improvingProv?.data || []).map(p =>
        `<a href="/providers/${encodeURIComponent(p.provider_id || p.name)}" class="sidebar-provider-row">
          <div class="status-dot-sm" style="background:var(--positive)"></div>
          <div class="prov-info"><div class="prov-name">${p.name}</div><div class="prov-asn">${p.asn || ''}</div></div>
          <span class="prov-count">${p.threat_count}</span>
          <span class="prov-trend" style="color:var(--positive)">${p.trend_7d_pct || 0}%</span>
        </a>`
      ).join('');

      const insightItems = (insights?.data || []).map(ins => {
        const colors = { sentinel: 'var(--blue-primary)', analyst: 'var(--positive)', cartographer: 'var(--threat-medium)', strategist: 'var(--negative)', observer: '#b388ff' };
        return `<div class="sidebar-insight">
          <div class="si-top"><span class="si-agent" style="color:${colors[ins.agent_name] || 'var(--text-secondary)'}">${ins.agent_name}</span><span class="sev ${ins.severity}">${ins.severity}</span></div>
          <div class="si-text">${ins.summary_text || ''}</div>
        </div>`;
      }).join('') || '<div class="empty-state"><div class="message">No insights yet</div></div>';

      sidebar.innerHTML =
        renderPanel('Top Targeted Brands', (topBrands?.data || []).length, brandRows) +
        renderPanel('Hosting Providers', null, (worstRows ? '<div class="sidebar-divider">Worst Actors</div>' + worstRows : '') + (improvingRows ? '<div class="sidebar-divider">Improving</div>' + improvingRows : '') || '<div class="empty-state"><div class="message">No data</div></div>') +
        renderPanel('Agent Intelligence', (insights?.data || []).length, insightItems);
    }

    // Live polling
    let lastPollTime = new Date().toISOString();
    _obsPoller = setInterval(async () => {
      try {
        const recent = await api(`/threats/recent?since=${encodeURIComponent(lastPollTime)}&limit=10`);
        if (recent?.data?.length > 0) {
          lastPollTime = new Date().toISOString();
          recent.data.forEach(t => {
            if (t.lat && t.lng) {
              const flash = L.circleMarker([t.lat, t.lng], { radius: 12, color: '#00d4ff', fillColor: '#00d4ff', fillOpacity: 0.6, weight: 1, opacity: 0.8 }).addTo(map);
              // Animate: expand radius and fade out (matches prototype spawnThreat)
              let r = 12, o = 0.6;
              const anim = setInterval(() => {
                r += 1.5;
                o -= 0.03;
                if (o <= 0) { clearInterval(anim); map.removeLayer(flash); return; }
                flash.setRadius(r);
                flash.setStyle({ fillOpacity: o, opacity: o });
              }, 50);
            }
          });
        }
      } catch { /* silent */ }
    }, 15000);

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── View: Brands Hub (Step 9) ──────────────────────────────
let _brandsSubTab = 'top-targeted';
let _brandsPeriod = '24h';

function _brandInitials(name) { return (name || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(); }
function _tColor(t) { return t >= 200 ? 'var(--threat-critical)' : t >= 100 ? 'var(--threat-high)' : t >= 50 ? 'var(--threat-medium)' : 'var(--blue-primary)'; }
function _scoreColor(s) { return s >= 90 ? 'var(--positive)' : s >= 80 ? 'var(--blue-primary)' : s >= 70 ? 'var(--threat-medium)' : s >= 50 ? 'var(--threat-high)' : 'var(--threat-critical)'; }

async function viewBrandsHub(el) {
  el.innerHTML = `
    <div style="padding:20px 24px 0"><div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">Brands Intelligence</div></div>
    <div class="agg-stats" id="brands-agg"></div>
    <div class="sub-tabs" id="brands-tabs">
      <button class="sub-tab active" data-tab="top-targeted">Top Targeted<span class="tab-count" id="tc-top">--</span></button>
      <button class="sub-tab" data-tab="monitored">Monitored<span class="tab-count" id="tc-mon">--</span></button>
      <button class="sub-tab" data-tab="all">All Brands<span class="tab-count" id="tc-all">--</span></button>
      <div class="sub-tab-actions">
        ${renderPeriodSelector(_brandsPeriod, 'brands-period')}
        <button class="btn-monitor" id="brands-add-btn"><span style="font-size:14px">+</span> Monitor Brand</button>
      </div>
    </div>
    <div style="padding:20px 24px" id="brands-content">Loading...</div>`;

  // Aggregate stats — populated from API
  api('/brands/stats').then(res => {
    const s = res?.data || {};
    document.getElementById('brands-agg').innerHTML = `
      <div class="agg-card"><div class="agg-val" style="color:var(--blue-primary)">${s.total_tracked || 0}</div><div class="agg-lbl">Brands tracked</div><div class="agg-sub">Across all feeds</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--positive)">+${s.new_this_week || 0}</div><div class="agg-lbl">New this week</div><div class="agg-sub">First seen in feeds</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--threat-critical)">${s.fastest_rising || '-'}</div><div class="agg-lbl">Fastest rising</div><div class="agg-sub">${s.fastest_rising_pct ? '+' + s.fastest_rising_pct + '% in 24h' : ''}</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--threat-medium)">${s.top_threat_type || 'Phishing'}</div><div class="agg-lbl">Top threat type</div><div class="agg-sub">${s.top_threat_type_pct || 0}% of all threats</div></div>`;
  }).catch(() => {});

  const loadTopTargeted = async (period) => {
    const res = await api(`/brands/top-targeted?period=${period}&limit=20`).catch(() => null);
    const brands = res?.data?.brands || res?.data || [];
    const el = document.getElementById('tc-top');
    if (el) el.textContent = brands.length;
    const content = document.getElementById('brands-content');
    if (!brands.length) { content.innerHTML = '<div class="empty-state"><div class="message">No targeted brands detected yet</div></div>'; return; }
    content.innerHTML = `<div class="brand-grid">${brands.map((b, i) => {
      const initials = _brandInitials(b.name);
      const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : 'rn';
      const tc = b.threat_count || 0;
      const color = _tColor(tc);
      const trendDir = (b.trend_pct || 0) >= 0 ? 'up' : 'down';
      const risingHtml = b.rising ? '<div class="rising-badge">Rising</div>' : '';
      const sparkData = b.sparkline || [];
      return `<a href="/brands/${b.brand_id || b.id}" class="brand-card">
        ${risingHtml}
        <div class="brand-card-top">
          <div class="brand-rank ${rankClass}">${i + 1}</div>
          <div class="brand-icon-lg" style="color:${color}">${initials}</div>
          <div class="brand-card-info"><div class="brand-card-name">${b.name}</div><div class="brand-card-sector">${b.sector || ''}</div></div>
        </div>
        <div class="brand-card-stats">
          <div><div class="brand-threat-val" style="color:${color}">${tc}</div><div class="brand-threat-label">active threats</div></div>
          <div class="brand-trend">${renderSparkline(sparkData)}<span class="trend-pct ${trendDir}">${trendDir === 'up' ? '+' : ''}${b.trend_pct || 0}%</span></div>
        </div>
        <div class="brand-card-footer">
          <span class="type-pill ${b.top_threat_type || 'phishing'}">${b.top_threat_type || 'phishing'}</span>
          <span class="brand-domain">${b.canonical_domain || ''}</span>
        </div>
      </a>`;
    }).join('')}</div>`;
  };

  const loadMonitored = async () => {
    const res = await api('/brands/monitored').catch(() => null);
    const brands = res?.data?.brands || res?.data || [];
    const el = document.getElementById('tc-mon');
    if (el) el.textContent = brands.length;
    const content = document.getElementById('brands-content');
    if (!brands.length) { content.innerHTML = '<div class="empty-state"><div class="message">No monitored brands. Add one to start proactive monitoring.</div></div>'; return; }

    // Search + filter controls
    let html = `<div class="mon-controls">
      <input class="search-input" placeholder="Search monitored brands..." id="mon-search">
      <div class="filter-row">
        <button class="filter-pill active" data-filter="all">All</button>
        <button class="filter-pill" data-filter="active">Active Threats</button>
        <button class="filter-pill" data-filter="clean">Clean</button>
        <button class="filter-pill" data-filter="new">New</button>
      </div>
    </div>`;

    html += brands.map(b => {
      const initials = _brandInitials(b.name);
      const tc = b.threat_count || 0;
      const color = tc > 0 ? _tColor(tc) : 'var(--positive)';
      const statusClass = tc > 0 ? 'active-threats' : b.status === 'new' ? 'new-status' : 'clean';
      const statusText = tc > 0 ? 'Active Threats' : b.status === 'new' ? 'New' : 'Clean';
      return `<a href="/brands/${b.brand_id || b.id}" class="monitored-row" data-status="${statusClass}" data-name="${(b.name || '').toLowerCase()}">
        <div class="monitored-icon" style="color:${color}">${initials}</div>
        <div class="monitored-info"><div class="monitored-name">${b.name}</div><div class="monitored-domain">${b.canonical_domain || ''}</div></div>
        <div class="monitored-sector">${b.sector || ''}</div>
        <div class="monitored-threats" style="color:${color}">${tc}</div>
        <span class="status-badge ${statusClass}">${statusText}</span>
        <div class="monitored-meta">Since ${b.monitored_since ? b.monitored_since.slice(0, 10) : ''}</div>
      </a>`;
    }).join('');

    content.innerHTML = html;

    // Search filter wiring
    const searchEl = document.getElementById('mon-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        const q = searchEl.value.toLowerCase();
        content.querySelectorAll('.monitored-row').forEach(r => {
          r.style.display = r.dataset.name.includes(q) ? '' : 'none';
        });
      });
    }
    content.querySelectorAll('.filter-pill').forEach(p => p.addEventListener('click', () => {
      content.querySelectorAll('.filter-pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      const f = p.dataset.filter;
      content.querySelectorAll('.monitored-row').forEach(r => {
        if (f === 'all') r.style.display = '';
        else if (f === 'active') r.style.display = r.dataset.status === 'active-threats' ? '' : 'none';
        else if (f === 'clean') r.style.display = r.dataset.status === 'clean' ? '' : 'none';
        else if (f === 'new') r.style.display = r.dataset.status === 'new-status' ? '' : 'none';
      });
    }));
  };

  const loadAll = async () => {
    const res = await api('/brands?limit=100').catch(() => null);
    const brands = res?.data || [];
    const elCount = document.getElementById('tc-all');
    if (elCount) elCount.textContent = brands.length;
    const content = document.getElementById('brands-content');
    if (!brands.length) { content.innerHTML = '<div class="empty-state"><div class="message">No brands detected yet</div></div>'; return; }

    // Search + sector filter
    let html = `<div class="mon-controls">
      <input class="search-input" placeholder="Search by name or domain..." id="all-search" style="width:280px">
      <select class="sector-select" id="all-sector-filter"><option value="">All Sectors</option><option>Financial Services</option><option>Technology</option><option>E-commerce</option><option>Cryptocurrency</option><option>Healthcare</option><option>Social Media</option><option>Logistics</option><option>Government</option></select>
    </div>`;

    const monRes = await api('/brands/monitored').catch(() => null);
    const monIds = new Set((monRes?.data?.brands || monRes?.data || []).map(b => b.brand_id || b.id));

    html += `<div class="all-brands-table"><table class="data-table"><thead><tr>
      <th style="width:32px">\u2605</th><th>Brand</th><th>Sector</th><th>Threats</th><th>Trend</th><th>Type</th>
    </tr></thead><tbody>`;

    brands.forEach(b => {
      const id = b.brand_id || b.id;
      const mon = monIds.has(id);
      const tc = b.threat_count || 0;
      const color = _tColor(tc);
      const t = b.trend_pct || 0;
      const trendDir = t >= 0 ? 'up' : 'down';
      const initials = _brandInitials(b.name);
      html += `<tr data-id="${id}" data-name="${(b.name || '').toLowerCase()}" data-domain="${(b.canonical_domain || '').toLowerCase()}" data-sector="${b.sector || ''}">
        <td><span class="star-toggle ${mon ? 'on' : 'off'}">${mon ? '\u2605' : '\u2606'}</span></td>
        <td><a href="/brands/${id}" class="brand-table-link"><div class="brand-table-icon" style="color:${color}">${initials}</div><div><div style="font-weight:500">${b.name}</div><div style="font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary)">${b.canonical_domain || ''}</div></div></a></td>
        <td style="font-size:11px;color:var(--text-secondary)">${b.sector || ''}</td>
        <td><span style="font-family:var(--font-display);font-weight:700;font-size:14px;color:${color}">${tc}</span></td>
        <td><span class="trend-pct ${trendDir}" style="font-size:11px">${t >= 0 ? '+' : ''}${t}%</span></td>
        <td>${b.top_threat_type ? `<span class="type-pill ${b.top_threat_type}">${b.top_threat_type}</span>` : '-'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    content.innerHTML = html;

    // Star toggle
    content.querySelectorAll('.star-toggle').forEach(s => s.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      s.classList.toggle('on'); s.classList.toggle('off');
      s.textContent = s.classList.contains('on') ? '\u2605' : '\u2606';
    }));

    // Search
    const searchEl = document.getElementById('all-search');
    const sectorEl = document.getElementById('all-sector-filter');
    const filterRows = () => {
      const q = (searchEl?.value || '').toLowerCase();
      const sec = sectorEl?.value || '';
      content.querySelectorAll('.all-brands-table tbody tr').forEach(r => {
        const nameMatch = !q || r.dataset.name.includes(q) || r.dataset.domain.includes(q);
        const secMatch = !sec || r.dataset.sector === sec;
        r.style.display = nameMatch && secMatch ? '' : 'none';
      });
    };
    searchEl?.addEventListener('input', filterRows);
    sectorEl?.addEventListener('change', filterRows);
  };

  // Aggregate stats
  await loadTopTargeted(_brandsPeriod);

  // Tab switching
  document.getElementById('brands-tabs').addEventListener('click', async (e) => {
    const tab = e.target.closest('.sub-tab');
    if (!tab || !tab.dataset.tab) return;
    document.querySelectorAll('#brands-tabs .sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    _brandsSubTab = tab.dataset.tab;
    document.getElementById('brands-content').innerHTML = 'Loading...';
    if (_brandsSubTab === 'top-targeted') await loadTopTargeted(_brandsPeriod);
    else if (_brandsSubTab === 'monitored') await loadMonitored();
    else await loadAll();
  });

  // Period selector
  document.getElementById('brands-period')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.period-btn');
    if (!btn) return;
    document.querySelectorAll('#brands-period .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _brandsPeriod = btn.dataset.period;
    if (_brandsSubTab === 'top-targeted') await loadTopTargeted(_brandsPeriod);
  });

  // Monitor Brand modal
  document.getElementById('brands-add-btn')?.addEventListener('click', () => {
    showModal('Monitor a Brand',
      `<div class="modal-sub">Add a domain for proactive monitoring. We\u2019ll scan it immediately and begin watching for threats.</div>
       <div class="form-group"><label class="form-label">Domain</label><input class="form-input" placeholder="e.g. acmecorp.com" id="modal-domain"></div>
       <div class="form-group"><label class="form-label">Brand Name (optional)</label><input class="form-input" placeholder="Auto-detected if left blank" id="modal-name"></div>
       <div style="display:flex;gap:12px">
         <div class="form-group" style="flex:1"><label class="form-label">Sector</label><select class="form-select" id="modal-sector"><option value="">Auto-detect</option><option>Financial Services</option><option>Technology</option><option>E-commerce</option><option>Cryptocurrency</option><option>Healthcare</option><option>Government</option><option>Social Media</option></select></div>
         <div class="form-group" style="flex:1"><label class="form-label">Reason</label><select class="form-select" id="modal-reason"><option>Prospect</option><option>Competitor</option><option>Client request</option><option>Threat research</option></select></div>
       </div>
       <div class="form-group"><label class="form-label">Notes</label><input class="form-input" placeholder="Internal notes..." id="modal-notes"></div>`,
      async (overlay) => {
        const domain = document.getElementById('modal-domain')?.value?.trim();
        if (!domain) {
          const inp = document.getElementById('modal-domain');
          if (inp) inp.style.borderColor = 'var(--threat-critical)';
          return false; // prevent close
        }
        try {
          await api('/brands/monitor', {
            method: 'POST',
            body: JSON.stringify({
              domain,
              name: document.getElementById('modal-name')?.value?.trim() || null,
              sector: document.getElementById('modal-sector')?.value || null,
              reason: document.getElementById('modal-reason')?.value || null,
              notes: document.getElementById('modal-notes')?.value?.trim() || null,
            })
          });
          showToast('Monitoring started for ' + domain, 'success');
          if (_brandsSubTab === 'monitored') {
            const content = document.getElementById('brands-content');
            if (content) { content.innerHTML = 'Loading...'; await loadMonitored(); }
          }
        } catch (err) { showToast(err.message, 'error'); }
      }
    );
  });
}

// ─── View: Brand Detail (Step 9) ────────────────────────────
let _brandDetailMap = null;
let _brandDetailChart = null;
let _brandThreatsPage = 1;
const _brandThreatsPerPage = 15;

async function viewBrandDetail(el, params) {
  el.innerHTML = 'Loading...';
  try {
    const [brandRes, threatsRes, locationsRes, providersRes, campaignsRes, timelineRes] = await Promise.all([
      api(`/brands/${params.id}`),
      api(`/brands/${params.id}/threats?status=active&limit=50`).catch(() => null),
      api(`/brands/${params.id}/threats/locations`).catch(() => null),
      api(`/brands/${params.id}/providers`).catch(() => null),
      api(`/brands/${params.id}/campaigns`).catch(() => null),
      api(`/brands/${params.id}/threats/timeline?period=30d`).catch(() => null),
    ]);
    const b = brandRes?.data;
    if (!b) { el.innerHTML = '<div class="empty-state"><div class="message">Brand not found</div></div>'; return; }

    const stats = b.stats || b;
    const initials = _brandInitials(b.name);
    const allThreats = threatsRes?.data || [];
    const totalThreats = stats.threat_count || stats.total_threats || allThreats.length;
    const providers = providersRes?.data || [];
    const campaigns = campaignsRes?.data || [];
    const locations = locationsRes?.data || [];
    const sc = b.trust_score != null ? _scoreColor(b.trust_score) : 'var(--text-tertiary)';
    const trendColor = (stats.trend_pct || 0) >= 0 ? 'var(--threat-medium)' : 'var(--positive)';
    const threatColor = _tColor(totalThreats);

    // SVG Trust Score ring (matches prototype: 72x72 SVG with dashoffset)
    const trustRingHtml = b.trust_score != null
      ? `<div class="ts-ring-wrap"><div style="width:72px;height:72px;position:relative">
          <svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-elevated)" stroke-width="5"/><circle cx="36" cy="36" r="30" fill="none" stroke="${sc}" stroke-width="5" stroke-dasharray="188.5" stroke-dashoffset="${188.5 * (1 - b.trust_score / 100)}" stroke-linecap="round" transform="rotate(-90 36 36)"/></svg>
          <div class="ts-val-center">${b.trust_score}</div>
        </div><div class="ts-grade">Grade: ${b.trust_grade || ''}</div></div>`
      : '';

    // Provider bar colors
    const provColors = ['#ff3b5c', '#ff6b35', '#ffb627', '#00d4ff', '#0091b3', '#4a5a73'];
    const maxProv = providers[0]?.count || providers[0]?.threat_count || 1;

    el.innerHTML = `
      <a href="/brands" class="back-link">\u2190 Back to Brands</a>
      <div class="detail-header">
        <div class="detail-header-icon" style="color:${threatColor}">${initials}</div>
        <div class="detail-header-meta">
          <div class="detail-header-title">${b.name}<span class="sector-pill">${b.sector || 'Unknown'}</span></div>
          <div class="detail-header-sub">${b.canonical_domain || ''} \u2014 First tracked: ${b.first_tracked || b.created_at?.slice(0, 10) || '-'}</div>
          <div class="detail-header-stats">
            <div class="header-stat"><div class="header-stat-val" style="color:var(--threat-critical)">${totalThreats}</div><div class="header-stat-label">Active threats</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:${trendColor}">${(stats.trend_pct || 0) >= 0 ? '+' : ''}${stats.trend_pct || 0}%</div><div class="header-stat-label">7-day trend</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:var(--blue-primary)">${providers.length}</div><div class="header-stat-label">Hosting providers</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:var(--blue-primary)">${campaigns.length}</div><div class="header-stat-label">Active campaigns</div></div>
          </div>
        </div>
        ${trustRingHtml}
      </div>
      <div class="detail-grid">
        <div class="panel" id="brand-threats-panel"></div>
        <div class="detail-rcol">
          <div class="panel"><div class="phead"><span>Threat Locations</span><span class="badge">${locations.length} countries</span></div><div class="panel-body"><div id="brand-mini-map" class="mini-map"></div></div></div>
          <div class="panel"><div class="phead"><span>Hosting Providers</span></div><div class="panel-body padded" id="brand-prov-bars">${providers.length ?
            providers.map((p, i) => {
              const cnt = p.count || p.threat_count || 0;
              const pct = maxProv > 0 ? Math.round(cnt / maxProv * 100) : 0;
              return `<div class="pbar-row"><span class="pbar-lbl">${p.name || p.provider_name}</span><div class="pbar-trk"><div class="pbar-fill" style="width:${pct}%;background:${provColors[i] || provColors[5]}"></div></div><span class="pbar-ct">${cnt}</span></div>`;
            }).join('') :
            '<div class="empty-state"><div class="message">No provider data</div></div>'
          }</div></div>
          <div class="panel"><div class="phead"><span>Active Campaigns</span><span class="badge">${campaigns.length}</span></div><div class="panel-body padded">${campaigns.length ?
            campaigns.map(c => `<a href="/campaigns/${c.id || c.campaign_id}" class="campaign-card-sm">
              <div class="ccard-name">${c.name}</div>
              <div class="ccard-meta"><span><span style="color:var(--threat-critical)">${c.threat_count || 0}</span> threats</span><span><span style="color:var(--blue-primary)">${c.brand_count || 1}</span> brands</span><span style="color:var(--text-tertiary)">Since ${(c.first_seen || c.created_at || '').slice(0, 10)}</span></div>
            </a>`).join('') :
            '<div class="empty-state"><div class="message">No campaigns associated</div></div>'
          }</div></div>
        </div>
      </div>
      <div>
        <div class="chart-head"><div class="chart-title">Threat Timeline</div><div class="period-selector" id="brand-timeline-period">
          <button class="period-btn" data-period="7d">7D</button><button class="period-btn active" data-period="30d">30D</button><button class="period-btn" data-period="90d">90D</button><button class="period-btn" data-period="1y">1Y</button>
        </div></div>
        <div class="chart-wrap"><canvas id="brand-timeline-chart"></canvas></div>
      </div>`;

    // Render threats table with filter, evidence column, and pagination
    _brandThreatsPage = 1;
    const threatTypes = ['all', 'phishing', 'typosquat', 'impersonation', 'credential'];
    let activeFilter = 'all';

    function renderBrandThreats() {
      const filtered = activeFilter === 'all' ? allThreats : allThreats.filter(t => (t.threat_type || t.type) === activeFilter);
      const totalPages = Math.max(1, Math.ceil(filtered.length / _brandThreatsPerPage));
      if (_brandThreatsPage > totalPages) _brandThreatsPage = totalPages;
      const start = (_brandThreatsPage - 1) * _brandThreatsPerPage;
      const pageThreats = filtered.slice(start, start + _brandThreatsPerPage);

      let html = `<div class="phead"><span>Active Threats</span><span class="badge">${totalThreats} total</span></div>`;

      // Filter controls
      html += `<div class="threats-controls"><div class="filter-row" id="threat-type-filter">
        ${threatTypes.map(t => `<button class="filter-pill ${t === activeFilter ? 'active' : ''}" data-type="${t}">${t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
      </div><span style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${start + 1}\u2013${Math.min(start + _brandThreatsPerPage, filtered.length)} of ${filtered.length}</span></div>`;

      if (!pageThreats.length) {
        html += '<div class="empty-state"><div class="message">No threats matching filter</div></div>';
      } else {
        html += `<table class="data-table"><thead><tr><th>Malicious URL</th><th>Type</th><th>Provider</th><th>First Seen</th><th>Status</th><th>Ev</th></tr></thead><tbody>`;
        pageThreats.forEach(t => {
          const url = t.malicious_domain || t.url || '';
          const type = t.threat_type || t.type || '';
          const prov = t.hosting_provider || t.provider || '';
          const asn = t.asn || '';
          const date = (t.created_at || t.first_seen || '').slice(0, 16).replace('T', ' ');
          const status = t.status || 'active';
          const hasEv = t.evidence_captured ?? t.evidence ?? false;
          const statusClass = status === 'active' ? 'active' : status === 'down' ? 'down' : 'monitoring';
          html += `<tr>
            <td><div class="td-url">${url}</div></td>
            <td><span class="type-pill ${type}">${type}</span></td>
            <td><div class="prov-cell">${prov}${asn ? '<br><span class="asn">' + asn + '</span>' : ''}</div></td>
            <td><span class="date-cell">${date}</span></td>
            <td><span class="status-badge-sm ${statusClass}">${status}</span></td>
            <td><span class="ev-icon ${hasEv ? 'captured' : ''}">${hasEv ? '\u25c9' : '\u25cb'}</span></td>
          </tr>`;
        });
        html += '</tbody></table>';

        // Pagination
        html += `<div class="pagination"><span class="pgn-info">Page ${_brandThreatsPage} of ${totalPages}</span><div class="pgn-btns">
          <button class="pgn-btn ${_brandThreatsPage <= 1 ? 'disabled' : ''}" data-page="prev">\u2039</button>`;
        for (let p = 1; p <= Math.min(totalPages, 5); p++) {
          html += `<button class="pgn-btn ${p === _brandThreatsPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
        }
        html += `<button class="pgn-btn ${_brandThreatsPage >= totalPages ? 'disabled' : ''}" data-page="next">\u203a</button></div></div>`;
      }

      const panel = document.getElementById('brand-threats-panel');
      if (panel) panel.innerHTML = html;

      // Wire filter pills
      panel?.querySelectorAll('#threat-type-filter .filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          activeFilter = pill.dataset.type;
          _brandThreatsPage = 1;
          renderBrandThreats();
        });
      });

      // Wire pagination
      panel?.querySelectorAll('.pgn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.classList.contains('disabled')) return;
          const page = btn.dataset.page;
          if (page === 'prev') _brandThreatsPage = Math.max(1, _brandThreatsPage - 1);
          else if (page === 'next') _brandThreatsPage = Math.min(totalPages, _brandThreatsPage + 1);
          else _brandThreatsPage = parseInt(page);
          renderBrandThreats();
        });
      });
    }

    renderBrandThreats();

    // Mini map with sized+colored markers (matches prototype)
    if (_brandDetailMap) { _brandDetailMap.remove(); _brandDetailMap = null; }
    if (locations.length > 0) {
      setTimeout(() => {
        _brandDetailMap = L.map('brand-mini-map', { zoomControl: false, attributionControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18 }).addTo(_brandDetailMap);
        const maxC = Math.max(...locations.map(l => l.count || 1));
        locations.forEach(loc => {
          const int = (loc.count || 1) / maxC;
          const col = int >= 0.7 ? '#ff3b5c' : int >= 0.4 ? '#ff6b35' : int >= 0.2 ? '#ffb627' : '#00d4ff';
          L.circleMarker([loc.lat, loc.lng], { radius: Math.max(4, int * 16), fillColor: col, fillOpacity: 0.3, color: col, weight: 0.5, opacity: 0.6 }).addTo(_brandDetailMap);
          L.circleMarker([loc.lat, loc.lng], { radius: Math.max(2, int * 6), fillColor: col, fillOpacity: 0.9, color: col, weight: 0 })
            .bindPopup(`<div style="font-family:var(--font-display);font-weight:600;color:var(--text-accent);font-size:12px;margin-bottom:4px">${loc.country || loc.country_code || ''}</div><div style="display:flex;justify-content:space-between;font-size:11px"><span style="color:var(--text-secondary)">Threats</span><span style="font-family:var(--font-mono);color:${col}">${loc.count || 0}</span></div>`)
            .addTo(_brandDetailMap);
        });
        const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng]));
        _brandDetailMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 5 });
      }, 50);
    }

    // Timeline chart
    if (_brandDetailChart) { _brandDetailChart.destroy(); _brandDetailChart = null; }
    const timeline = timelineRes?.data || {};
    if (timeline.labels?.length && typeof Chart !== 'undefined') {
      _brandDetailChart = new Chart(document.getElementById('brand-timeline-chart'), {
        type: 'line',
        data: {
          labels: timeline.labels,
          datasets: [{
            label: 'Threats', data: timeline.values,
            borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.06)',
            fill: true, tension: 0.35, pointRadius: 0,
            pointHoverRadius: 5, pointHoverBackgroundColor: '#00d4ff',
            pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, borderWidth: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(10,16,32,0.95)', borderColor: 'rgba(0,212,255,0.35)', borderWidth: 1,
              titleFont: { family: "'Chakra Petch'", size: 11, weight: '600' },
              bodyFont: { family: "'IBM Plex Mono'", size: 11 },
              titleColor: '#e8edf5', bodyColor: '#7a8ba8', padding: 10, cornerRadius: 6,
              displayColors: false,
              callbacks: { label: i => i.parsed.y + ' new threats' }
            }
          },
          scales: {
            x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false } },
            y: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, padding: 8 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, beginAtZero: true }
          }
        }
      });
    }

    // Period selector for timeline
    document.getElementById('brand-timeline-period')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.period-btn');
      if (!btn) return;
      document.querySelectorAll('#brand-timeline-period .period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      try {
        const tlRes = await api(`/brands/${params.id}/threats/timeline?period=${btn.dataset.period}`);
        const tl = tlRes?.data || {};
        if (_brandDetailChart && tl.labels?.length) {
          _brandDetailChart.data.labels = tl.labels;
          _brandDetailChart.data.datasets[0].data = tl.values;
          _brandDetailChart.update();
        }
      } catch {}
    });

    // Cleanup
    window._viewCleanup = () => {
      if (_brandDetailMap) { _brandDetailMap.remove(); _brandDetailMap = null; }
      if (_brandDetailChart) { _brandDetailChart.destroy(); _brandDetailChart = null; }
    };

  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Providers Hub (Step 10) ──────────────────────────
let _provSubTab = 'worst';
let _provPeriod = '7d';

function _provFlag(countryCode) {
  if (!countryCode) return '\ud83c\udf10';
  try { return String.fromCodePoint(...[...countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))); } catch { return '\ud83c\udf10'; }
}
function _provRepColor(r) { return r >= 75 ? 'var(--positive)' : r >= 50 ? 'var(--blue-primary)' : r >= 30 ? 'var(--threat-medium)' : r >= 15 ? 'var(--threat-high)' : 'var(--threat-critical)'; }

function _renderProvCard(p, i, isImproving) {
  const tc = _tColor(p.threat_count || p.threats || 0);
  const rc = _provRepColor(p.reputation_score ?? p.reputation ?? 50);
  const trend = p.trend_7d_pct ?? p.trend_7d ?? 0;
  const tSign = trend >= 0 ? '+' : '';
  const tClass = trend >= 0 ? 'up' : 'down';
  const flag = _provFlag(p.country_code || p.country);
  const threats = p.threat_count || p.threats || 0;
  const rep = p.reputation_score ?? p.reputation ?? 0;
  const respHrs = p.avg_response_time_hours ?? p.response_hrs;
  const color = isImproving ? 'var(--positive)' : tc;
  return `<a href="/providers/${encodeURIComponent(p.provider_id || p.id || p.name)}" class="provider-card ${isImproving ? 'improving' : ''}">
    <div class="provider-card-top">
      <div class="provider-rank ${!isImproving && i < 3 ? 'top' : ''}">${i + 1}</div>
      <div class="provider-icon"><span style="font-size:16px;line-height:1">${flag}</span><span class="pico-asn">${p.asn || ''}</span></div>
      <div class="provider-card-info"><div class="provider-card-name">${p.name}</div><div class="provider-card-asn">${p.asn || ''} <span class="country-code-pill">${p.country_code || p.country || ''}</span></div></div>
    </div>
    <div class="provider-card-stats">
      <div><div class="provider-threat-val" style="color:${color}">${threats}</div><div class="provider-threat-label">active threats</div></div>
      <div class="brand-trend"><span class="trend-pct ${tClass}">${tSign}${trend}%</span>${renderSparkline(p.sparkline || [])}</div>
    </div>
    <div class="provider-card-footer">
      <div class="rep-gauge"><div class="rep-bar"><div class="rep-fill" style="width:${rep}%;background:${rc}"></div></div><span class="rep-val" style="color:${rc}">${rep}/100</span></div>
      <span class="resp-time">${respHrs != null ? respHrs + 'h resp' : 'No data'}</span>
    </div>
  </a>`;
}

async function viewProvidersHub(el) {
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">Infrastructure Intelligence</div>
    <div class="agg-stats" id="prov-agg"></div>
    <div class="sub-tabs" id="prov-tabs">
      <button class="sub-tab active" data-tab="worst">Worst Actors<span class="tab-count" id="tc-worst">--</span></button>
      <button class="sub-tab" data-tab="improving">Improving<span class="tab-count" id="tc-impr">--</span></button>
      <button class="sub-tab" data-tab="all">All Providers<span class="tab-count" id="tc-allp">--</span></button>
      <div class="sub-tab-actions">${renderPeriodSelector('7d', 'prov-period')}</div>
    </div>
    <div style="padding:20px 0" id="prov-content">Loading...</div>`;

  // Aggregate stats
  api('/providers/stats').then(res => {
    const s = res?.data || {};
    document.getElementById('prov-agg').innerHTML = `
      <div class="agg-card"><div class="agg-val" style="color:var(--blue-primary)">${s.total_tracked || 0}</div><div class="agg-lbl">Providers tracked</div><div class="agg-sub">Across all feeds</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--threat-critical)">${s.worst_this_week_name || s.worst_this_week || '-'}</div><div class="agg-lbl">Worst this week</div><div class="agg-sub">${s.worst_this_week_threats || ''} active threats</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--positive)">${s.most_improved_name || s.most_improved || '-'}</div><div class="agg-lbl">Most improved</div><div class="agg-sub">${s.most_improved_pct || ''}% this week</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--threat-medium)">${s.avg_response_time || '-'}</div><div class="agg-lbl">Avg response time</div><div class="agg-sub">Across all providers</div></div>`;
  }).catch(() => {});

  const loadWorst = async (period) => {
    const res = await api(`/providers/worst?period=${period}&limit=20`).catch(() => null);
    const providers = res?.data || [];
    const tcEl = document.getElementById('tc-worst');
    if (tcEl) tcEl.textContent = providers.length;
    const content = document.getElementById('prov-content');
    if (!providers.length) { content.innerHTML = '<div class="empty-state"><div class="message">No provider data</div></div>'; return; }
    content.innerHTML = `<div class="provider-grid">${providers.map((p, i) => _renderProvCard(p, i, false)).join('')}</div>`;
  };

  const loadImproving = async (period) => {
    const res = await api(`/providers/improving?period=${period}&limit=10`).catch(() => null);
    const providers = res?.data || [];
    const tcEl = document.getElementById('tc-impr');
    if (tcEl) tcEl.textContent = providers.length;
    const content = document.getElementById('prov-content');
    if (!providers.length) { content.innerHTML = '<div class="empty-state"><div class="message">No improving providers detected</div></div>'; return; }
    content.innerHTML = `<div class="provider-grid">${providers.map((p, i) => _renderProvCard(p, i, true)).join('')}</div>`;
  };

  const loadAllProviders = async () => {
    const res = await api('/providers?limit=100').catch(() => null);
    const allProviders = (res?.data || []).sort((a, b) => (b.threat_count || b.threats || 0) - (a.threat_count || a.threats || 0));
    const tcEl = document.getElementById('tc-allp');
    if (tcEl) tcEl.textContent = allProviders.length;
    const content = document.getElementById('prov-content');

    // Collect unique countries for filter
    const countries = [...new Set(allProviders.map(p => p.country_code || p.country).filter(Boolean))].sort();

    function renderAllTable(filter, search) {
      let filtered = allProviders;
      if (filter) filtered = filtered.filter(p => (p.country_code || p.country) === filter);
      if (search) { const s = search.toLowerCase(); filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || (p.asn || '').toLowerCase().includes(s)); }

      let html = `<div class="prov-search-bar"><input class="prov-search-in" placeholder="Search providers..." value="${search || ''}"><select class="prov-country-sel"><option value="">All Countries</option>${countries.map(c => `<option ${c === filter ? 'selected' : ''}>${c}</option>`).join('')}</select></div>`;
      html += `<div class="prov-all-tbl"><table><thead><tr><th>Provider</th><th>ASN</th><th>Country</th><th>Threats</th><th>7d</th><th>30d</th><th>Reputation</th><th>Response</th></tr></thead><tbody>`;
      filtered.forEach(p => {
        const threats = p.threat_count || p.threats || 0;
        const tc = _tColor(threats);
        const rep = p.reputation_score ?? p.reputation ?? 0;
        const rc = _provRepColor(rep);
        const flag = _provFlag(p.country_code || p.country);
        const t7 = p.trend_7d_pct ?? p.trend_7d ?? 0;
        const t30 = p.trend_30d_pct ?? p.trend_30d ?? 0;
        const respHrs = p.avg_response_time_hours ?? p.response_hrs;
        html += `<tr data-id="${p.provider_id || p.id || p.name}">
          <td style="font-weight:500">${flag} ${p.name}</td>
          <td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${p.asn || ''}</td>
          <td>${p.country_code || p.country || ''}</td>
          <td><span style="font-family:var(--font-display);font-weight:700;font-size:14px;color:${tc}">${threats}</span></td>
          <td><span class="trend-pct ${t7 >= 0 ? 'up' : 'down'}" style="font-size:11px">${t7 >= 0 ? '+' : ''}${t7}%</span></td>
          <td><span class="trend-pct ${t30 >= 0 ? 'up' : 'down'}" style="font-size:11px">${t30 >= 0 ? '+' : ''}${t30}%</span></td>
          <td><span style="font-family:var(--font-mono);font-size:11px;color:${rc}">${rep}/100</span></td>
          <td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${respHrs != null ? respHrs + 'h' : '\u2014'}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      content.innerHTML = html;

      // Wire table row clicks
      content.querySelectorAll('.prov-all-tbl tbody tr').forEach(r => {
        r.addEventListener('click', () => navigate('/providers/' + encodeURIComponent(r.dataset.id)));
      });

      // Wire search
      content.querySelector('.prov-search-in')?.addEventListener('input', (e) => {
        renderAllTable(content.querySelector('.prov-country-sel')?.value || '', e.target.value);
      });
      // Wire country filter
      content.querySelector('.prov-country-sel')?.addEventListener('change', (e) => {
        renderAllTable(e.target.value, content.querySelector('.prov-search-in')?.value || '');
      });
    }

    renderAllTable('', '');
  };

  await loadWorst(_provPeriod);

  // Sub-tab switching
  document.getElementById('prov-tabs').addEventListener('click', async (e) => {
    const tab = e.target.closest('.sub-tab');
    if (!tab || !tab.dataset.tab) return;
    document.querySelectorAll('#prov-tabs .sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    _provSubTab = tab.dataset.tab;
    document.getElementById('prov-content').innerHTML = 'Loading...';
    if (_provSubTab === 'worst') await loadWorst(_provPeriod);
    else if (_provSubTab === 'improving') await loadImproving(_provPeriod);
    else await loadAllProviders();
  });

  // Period selector
  document.getElementById('prov-period')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.period-btn');
    if (!btn) return;
    document.querySelectorAll('#prov-period .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _provPeriod = btn.dataset.period;
    if (_provSubTab === 'worst') { document.getElementById('prov-content').innerHTML = 'Loading...'; await loadWorst(_provPeriod); }
    else if (_provSubTab === 'improving') { document.getElementById('prov-content').innerHTML = 'Loading...'; await loadImproving(_provPeriod); }
  });
}

// ─── View: Provider Detail (Step 10) ────────────────────────
let _provDetailMap = null;
let _provDetailChart = null;
let _provThreatsPage = 1;
const _provThreatsPerPage = 15;

async function viewProviderDetail(el, params) {
  el.innerHTML = 'Loading...';
  try {
    const [provRes, threatsRes, brandsRes, timelineRes, locationsRes] = await Promise.all([
      api(`/providers/${encodeURIComponent(params.id)}`),
      api(`/providers/${encodeURIComponent(params.id)}/threats?limit=50`).catch(() => null),
      api(`/providers/${encodeURIComponent(params.id)}/brands`).catch(() => null),
      api(`/providers/${encodeURIComponent(params.id)}/timeline?period=90d`).catch(() => null),
      api(`/providers/${encodeURIComponent(params.id)}/locations`).catch(() => null),
    ]);
    const p = provRes?.data;
    if (!p) { el.innerHTML = '<div class="empty-state"><div class="message">Provider not found</div></div>'; return; }

    const allThreats = threatsRes?.data || [];
    const brands = brandsRes?.data || [];
    const locations = locationsRes?.data || [];
    const totalThreats = p.threat_count || p.total_threats || allThreats.length;
    const repScore = p.reputation_score ?? p.reputation ?? 50;
    const rc = _provRepColor(repScore);
    const flag = _provFlag(p.country_code || p.country);
    const t7 = p.trend_7d_pct ?? p.trend_7d ?? 0;
    const t30 = p.trend_30d_pct ?? p.trend_30d ?? 0;
    const respHrs = p.avg_response_time_hours ?? p.response_hrs;
    const repLabel = repScore >= 60 ? 'Responsive' : repScore >= 30 ? 'Slow' : 'Negligent';
    const provColors = ['#ff3b5c', '#ff6b35', '#ffb627', '#00d4ff', '#0091b3', '#4a5a73'];
    const maxBrand = brands[0]?.count || brands[0]?.threat_count || 1;

    el.innerHTML = `
      <a href="/providers" class="back-link">\u2190 Back to Providers</a>
      <div class="detail-header">
        <div class="detail-header-icon" style="flex-direction:column;gap:2px"><span style="font-size:22px">${flag}</span><span style="font-family:var(--font-mono);font-size:8px;color:var(--text-tertiary)">${p.asn || ''}</span></div>
        <div class="detail-header-meta">
          <div class="detail-header-title">${p.name}${p.asn ? `<span class="asn-pill">${p.asn}</span>` : ''}<span class="country-code-pill" style="font-size:11px;padding:3px 8px">${p.country_code || p.country || ''}</span></div>
          <div class="detail-header-sub">Hosting Provider \u2014 ${totalThreats} active threats hosted</div>
          <div class="detail-header-stats">
            <div class="header-stat"><div class="header-stat-val" style="color:${_tColor(totalThreats)}">${totalThreats}</div><div class="header-stat-label">Active threats</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:${t7 >= 0 ? 'var(--threat-medium)' : 'var(--positive)'}">${t7 >= 0 ? '+' : ''}${t7}%</div><div class="header-stat-label">7-day trend</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:${t30 >= 0 ? 'var(--threat-high)' : 'var(--positive)'}">${t30 >= 0 ? '+' : ''}${t30}%</div><div class="header-stat-label">30-day trend</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:var(--text-secondary)">${respHrs != null ? respHrs + 'h' : 'N/A'}</div><div class="header-stat-label">Avg response</div></div>
          </div>
        </div>
        <div class="rep-ring"><div style="width:72px;height:72px;position:relative"><svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-elevated)" stroke-width="5"/><circle cx="36" cy="36" r="30" fill="none" stroke="${rc}" stroke-width="5" stroke-dasharray="188.5" stroke-dashoffset="${188.5 * (1 - repScore / 100)}" stroke-linecap="round" transform="rotate(-90 36 36)"/></svg><div class="rep-ring-val" style="color:${rc}">${repScore}</div></div><div class="rep-ring-label" style="color:${rc}">${repLabel}</div></div>
      </div>
      <div class="detail-grid">
        <div class="panel" id="prov-threats-panel"></div>
        <div class="detail-rcol" style="display:flex;flex-direction:column;gap:16px">
          <div class="panel"><div class="phead"><span>Target Locations</span><span class="badge" id="prov-loc-ct">${locations.length} countries</span></div><div class="panel-body"><div id="prov-mini-map" class="mini-map"></div></div></div>
          <div class="panel"><div class="phead"><span>Brands Targeted</span></div><div class="panel-body padded" id="prov-brand-bars">${brands.length ?
            brands.map((b, i) => {
              const cnt = b.count || b.threat_count || 0;
              const pct = maxBrand > 0 ? Math.round(cnt / maxBrand * 100) : 0;
              return `<div class="pbar-row"><span class="pbar-lbl">${b.name || b.brand_name}</span><div class="pbar-trk"><div class="pbar-fill" style="width:${pct}%;background:${provColors[i] || provColors[5]}"></div></div><span class="pbar-ct">${cnt}</span></div>`;
            }).join('') :
            '<div class="empty-state"><div class="message">No brand data</div></div>'
          }</div></div>
          <div class="panel"><div class="phead"><span>AI Assessment</span></div><div class="panel-body padded" id="prov-ai-insight"></div></div>
        </div>
      </div>
      <div>
        <div class="chart-head"><div class="chart-title">Threat Trend</div></div>
        <div class="chart-legend" id="prov-chart-legend"></div>
        <div class="chart-wrap"><canvas id="prov-timeline-chart"></canvas></div>
      </div>`;

    // ── Threats table with filter pills, evidence column, pagination ──
    _provThreatsPage = 1;
    const threatTypes = ['all', 'phishing', 'typosquat', 'impersonation', 'credential'];
    let activeFilter = 'all';

    function renderProvThreats() {
      const filtered = activeFilter === 'all' ? allThreats : allThreats.filter(t => (t.threat_type || t.type) === activeFilter);
      const totalPages = Math.max(1, Math.ceil(filtered.length / _provThreatsPerPage));
      if (_provThreatsPage > totalPages) _provThreatsPage = totalPages;
      const start = (_provThreatsPage - 1) * _provThreatsPerPage;
      const pageThreats = filtered.slice(start, start + _provThreatsPerPage);

      let html = `<div class="phead"><span>Threats Hosted</span><span class="badge">${totalThreats} total</span></div>`;
      html += `<div class="prov-threats-controls"><div class="prov-tfilter" id="prov-threat-filter">
        ${threatTypes.map(t => `<button class="prov-fp ${t === activeFilter ? 'active' : ''}" data-type="${t}">${t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
      </div><span style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${filtered.length > 0 ? (start + 1) + '\u2013' + Math.min(start + _provThreatsPerPage, filtered.length) + ' of ' + filtered.length : '0'}</span></div>`;

      if (!pageThreats.length) {
        html += '<div class="empty-state"><div class="message">No threats matching filter</div></div>';
      } else {
        html += `<table class="prov-threats-tbl"><thead><tr><th>Malicious URL</th><th>Type</th><th>Target Brand</th><th>First Seen</th><th>Status</th><th>Ev</th></tr></thead><tbody>`;
        pageThreats.forEach(t => {
          const url = t.malicious_domain || t.url || '';
          const type = t.threat_type || t.type || '';
          const brand = t.brand_name || t.brand || '';
          const date = (t.created_at || t.first_seen || '').slice(0, 16).replace('T', ' ');
          const status = t.status || 'active';
          const hasEv = t.evidence_captured ?? t.evidence ?? false;
          const statusClass = status === 'active' ? 'active' : status === 'down' ? 'down' : 'monitoring';
          html += `<tr>
            <td><div class="td-url">${url}</div></td>
            <td><span class="type-pill ${type}">${type}</span></td>
            <td style="font-size:11px;color:var(--text-secondary)">${brand}</td>
            <td><span style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${date}</span></td>
            <td><span class="status-badge-sm ${statusClass}">${status}</span></td>
            <td><span class="ev-icon ${hasEv ? 'captured' : ''}">${hasEv ? '\u25c9' : '\u25cb'}</span></td>
          </tr>`;
        });
        html += '</tbody></table>';

        // Pagination
        html += `<div class="prov-pgn"><span class="prov-pgn-info">Page ${_provThreatsPage} of ${totalPages}</span><div class="prov-pgn-btns">
          <button class="prov-pgn-btn ${_provThreatsPage <= 1 ? 'disabled' : ''}" data-page="prev">\u2039</button>`;
        for (let pg = 1; pg <= Math.min(totalPages, 5); pg++) {
          html += `<button class="prov-pgn-btn ${pg === _provThreatsPage ? 'active' : ''}" data-page="${pg}">${pg}</button>`;
        }
        html += `<button class="prov-pgn-btn ${_provThreatsPage >= totalPages ? 'disabled' : ''}" data-page="next">\u203a</button></div></div>`;
      }

      const panel = document.getElementById('prov-threats-panel');
      if (panel) panel.innerHTML = html;

      // Wire filter pills
      panel?.querySelectorAll('#prov-threat-filter .prov-fp').forEach(pill => {
        pill.addEventListener('click', () => {
          activeFilter = pill.dataset.type;
          _provThreatsPage = 1;
          renderProvThreats();
        });
      });

      // Wire pagination
      panel?.querySelectorAll('.prov-pgn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.classList.contains('disabled')) return;
          const page = btn.dataset.page;
          if (page === 'prev') _provThreatsPage = Math.max(1, _provThreatsPage - 1);
          else if (page === 'next') _provThreatsPage = Math.min(totalPages, _provThreatsPage + 1);
          else _provThreatsPage = parseInt(page);
          renderProvThreats();
        });
      });
    }

    renderProvThreats();

    // ── Cartographer AI assessment card ──
    document.getElementById('prov-ai-insight').innerHTML = `<div class="ai-card">
      <div class="ai-agent">Cartographer</div>
      <div class="ai-text">Attackers are ${t7 > 0 ? 'increasingly' : 'decreasingly'} using <strong>${p.name}</strong> (${p.asn || ''}) to host attack infrastructure. ${respHrs != null ? `Average abuse response time is <strong>${respHrs} hours</strong>${respHrs > 24 ? ', significantly above the industry average of 8 hours' : ''}.` : 'No abuse response data available.'} ${t7 > 20 ? `This provider has seen a <strong>${t7}% surge</strong> in hosted threats this week \u2014 attackers may be exploiting lax enforcement.` : `Threat volume is ${t7 > 0 ? 'gradually increasing' : 'declining'}.`}</div>
    </div>`;

    // ── Mini map with sized/colored markers ──
    if (_provDetailMap) { _provDetailMap.remove(); _provDetailMap = null; }
    if (locations.length > 0) {
      setTimeout(() => {
        _provDetailMap = L.map('prov-mini-map', { zoomControl: false, attributionControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 18 }).addTo(_provDetailMap);
        const maxC = Math.max(...locations.map(l => l.count || 1));
        locations.forEach(loc => {
          const int = (loc.count || 1) / maxC;
          const col = int >= 0.7 ? '#ff3b5c' : int >= 0.4 ? '#ff6b35' : int >= 0.2 ? '#ffb627' : '#00d4ff';
          L.circleMarker([loc.lat, loc.lng], { radius: Math.max(4, int * 16), fillColor: col, fillOpacity: 0.3, color: col, weight: 0.5 }).addTo(_provDetailMap);
          L.circleMarker([loc.lat, loc.lng], { radius: Math.max(2, int * 6), fillColor: col, fillOpacity: 0.9, color: col, weight: 0 })
            .bindPopup(`<div style="font-family:var(--font-display);font-weight:600;color:var(--text-accent);font-size:12px;margin-bottom:4px">${loc.country || loc.country_code || ''}</div><div style="display:flex;justify-content:space-between;font-size:11px"><span style="color:var(--text-secondary)">Threats</span><span style="font-family:var(--font-mono);color:${col}">${loc.count || 0}</span></div>`)
            .addTo(_provDetailMap);
        });
        _provDetailMap.fitBounds(L.latLngBounds(locations.map(l => [l.lat, l.lng])), { padding: [20, 20], maxZoom: 5 });
      }, 50);
    }

    // ── 3-dataset timeline chart (current 30d, prev 30d, 60-90d ago) ──
    document.getElementById('prov-chart-legend').innerHTML = `
      <div class="legend-item"><div class="legend-swatch" style="background:#00d4ff"></div>Last 30 days</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#ff6b35"></div>Previous 30 days</div>
      <div class="legend-item"><div class="legend-swatch" style="background:var(--text-tertiary);opacity:.5"></div>60\u201390 days ago</div>`;

    if (_provDetailChart) { _provDetailChart.destroy(); _provDetailChart = null; }
    const timeline = timelineRes?.data || {};
    if (timeline.labels?.length && typeof Chart !== 'undefined') {
      const allVals = timeline.values || [];
      const labels30 = timeline.labels.slice(-30);
      const d30 = allVals.slice(-30);
      const prev30 = allVals.length >= 60 ? allVals.slice(-60, -30) : d30.map(() => null);
      const old30 = allVals.length >= 90 ? allVals.slice(-90, -60) : d30.map(() => null);

      _provDetailChart = new Chart(document.getElementById('prov-timeline-chart'), {
        type: 'line',
        data: { labels: labels30, datasets: [
          { label: 'Last 30d', data: d30, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.06)', fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#00d4ff', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, borderWidth: 2 },
          { label: 'Prev 30d', data: prev30, borderColor: '#ff6b35', backgroundColor: 'transparent', fill: false, tension: 0.35, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 3] },
          { label: '60-90d ago', data: old30, borderColor: 'rgba(122,139,168,0.3)', backgroundColor: 'transparent', fill: false, tension: 0.35, pointRadius: 0, borderWidth: 1, borderDash: [2, 4] }
        ] },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(10,16,32,0.95)', borderColor: 'rgba(0,212,255,0.35)', borderWidth: 1,
              titleFont: { family: "'Chakra Petch'", size: 11, weight: '600' },
              bodyFont: { family: "'IBM Plex Mono'", size: 11 },
              titleColor: '#e8edf5', bodyColor: '#7a8ba8', padding: 10, cornerRadius: 6
            }
          },
          scales: {
            x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false } },
            y: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, padding: 8 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, beginAtZero: true }
          }
        }
      });
    }

    // Cleanup
    window._viewCleanup = () => {
      if (_provDetailMap) { _provDetailMap.remove(); _provDetailMap = null; }
      if (_provDetailChart) { _provDetailChart.destroy(); _provDetailChart = null; }
    };

  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Campaigns Hub (Step 11) ──────────────────────────
function _campSevColor(s) { return s === 'critical' ? 'var(--threat-critical)' : s === 'high' ? 'var(--threat-high)' : 'var(--threat-medium)'; }
function _campSpark(data, color) {
  if (!data || !data.length) return '';
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${2 + i / (data.length - 1) * 70},${24 - ((v - min) / range) * 20}`);
  return `<svg width="74" height="26" viewBox="0 0 74 26"><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

async function viewCampaignsHub(el) {
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">Campaign Intelligence</div>
    <div class="agg-stats" id="camp-agg"></div>
    <div class="sub-tabs" id="camp-tabs">
      <button class="sub-tab active" data-tab="active">Active<span class="tab-count" id="tc-active">--</span></button>
      <button class="sub-tab" data-tab="dormant">Dormant<span class="tab-count" id="tc-dormant">--</span></button>
      <button class="sub-tab" data-tab="disrupted">Disrupted<span class="tab-count" id="tc-disrupted">--</span></button>
    </div>
    <div style="padding:20px 0" id="camp-content">Loading...</div>`;

  // Stats
  api('/campaigns/stats').then(res => {
    const s = res?.data || {};
    document.getElementById('camp-agg').innerHTML = `
      <div class="agg-card"><div class="agg-val" style="color:var(--negative)">${s.active_count || 0}</div><div class="agg-lbl">Active campaigns</div><div class="agg-sub">${s.active_threats || ''} associated threats</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--threat-medium)">${s.dormant_count || 0}</div><div class="agg-lbl">Dormant</div><div class="agg-sub">No activity 7+ days</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--positive)">${s.disrupted_count || 0}</div><div class="agg-lbl">Disrupted</div><div class="agg-sub">All threats remediated</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--blue-primary)">${s.brands_affected || 0}</div><div class="agg-lbl">Brands affected</div><div class="agg-sub">Across all campaigns</div></div>`;
    if (document.getElementById('tc-active')) document.getElementById('tc-active').textContent = s.active_count || 0;
    if (document.getElementById('tc-dormant')) document.getElementById('tc-dormant').textContent = s.dormant_count || 0;
    if (document.getElementById('tc-disrupted')) document.getElementById('tc-disrupted').textContent = s.disrupted_count || 0;
  }).catch(() => {});

  const loadCampaigns = async (status) => {
    const res = await api(`/campaigns?status=${status}&limit=20`).catch(() => null);
    const campaigns = res?.data || [];
    const content = document.getElementById('camp-content');
    if (!campaigns.length) {
      content.innerHTML = `<div class="empty-state"><div class="message">No ${status} campaigns</div></div>`;
      return;
    }
    content.innerHTML = `<div class="campaign-grid">${campaigns.map(c => {
      const sev = c.severity || 'medium';
      const sc = _campSevColor(sev);
      const stClass = c.status === 'active' ? 'active-s' : c.status;
      const stLabel = (c.status || '').charAt(0).toUpperCase() + (c.status || '').slice(1);
      const brandNames = c.brand_names || (c.brands || c.brand_breakdown || []).map(b => b.name || b.brand_name || '');
      const brandCount = c.brand_count || brandNames.length || 0;
      const provCount = c.provider_count || (c.provider_breakdown || []).length || 0;
      const domainCount = c.domain_count || c.domains || 0;
      const sparkData = c.sparkline || c.spark || [];
      const brandIcons = brandNames.slice(0, 3).map(b =>
        `<div class="brand-ico">${_brandInitials(b)}</div>`
      ).join('') + (brandCount > 3 ? `<div class="brand-ico" style="color:var(--text-tertiary)">+${brandCount - 3}</div>` : '');
      return `<a href="/campaigns/${c.id || c.campaign_id}" class="campaign-card">
        <div class="campaign-card-top">
          <div class="campaign-name">${c.name}</div>
          <span class="sev ${sev}">${sev}</span>
        </div>
        <div class="campaign-card-status ${stClass}">${stLabel}</div>
        ${c.description ? `<div class="campaign-desc">${c.description}</div>` : ''}
        <div class="campaign-metrics">
          <div class="campaign-metric"><div class="campaign-metric-val" style="color:${sc}">${c.threat_count || 0}</div><div class="campaign-metric-label">Threats</div></div>
          <div class="campaign-metric"><div class="campaign-metric-val" style="color:var(--blue-primary)">${brandCount}</div><div class="campaign-metric-label">Brands</div></div>
          <div class="campaign-metric"><div class="campaign-metric-val" style="color:var(--threat-medium)">${provCount}</div><div class="campaign-metric-label">Providers</div></div>
          <div class="campaign-metric"><div class="campaign-metric-val" style="color:var(--text-secondary)">${domainCount}</div><div class="campaign-metric-label">Domains</div></div>
        </div>
        <div class="campaign-card-footer">
          <div class="brand-icons">${brandIcons}</div>
          <div class="campaign-dates">${c.first_seen ? c.first_seen.slice(0, 10) : ''} \u2192 ${c.last_seen ? c.last_seen.slice(0, 10) : 'now'}</div>
        </div>
        ${sparkData.length ? `<div class="campaign-card-spark">${_campSpark(sparkData, sc)}</div>` : ''}
      </a>`;
    }).join('')}</div>`;
  };

  await loadCampaigns('active');

  document.getElementById('camp-tabs').addEventListener('click', async (e) => {
    const tab = e.target.closest('.sub-tab');
    if (!tab || !tab.dataset.tab) return;
    document.querySelectorAll('#camp-tabs .sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('camp-content').innerHTML = 'Loading...';
    await loadCampaigns(tab.dataset.tab);
  });
}

// ─── View: Campaign Detail (Step 11) ────────────────────────
let _campDetailChart = null;

function _campDrawInfraGraph(canvasEl, domains, ips, providers) {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  canvasEl.width = canvasEl.parentElement.clientWidth;
  canvasEl.height = 280;
  const w = canvasEl.width, h = canvasEl.height;
  ctx.clearRect(0, 0, w, h);

  // Layout: Domains (left 15%) → IPs (center 50%) → Providers (right 85%)
  const colD = w * 0.15, colI = w * 0.5, colP = w * 0.85;
  const domY = domains.map((_, i) => 40 + i * (h - 60) / Math.max(domains.length - 1, 1));
  const ipY = ips.map((_, i) => 50 + i * (h - 80) / Math.max(ips.length - 1, 1));
  const provY = providers.map((_, i) => 60 + i * (h - 100) / Math.max(providers.length - 1, 1));

  // Draw connections: domains → IPs (red Bezier curves)
  domains.forEach((_, di) => {
    const targets = ips.slice(0, Math.min(2, ips.length));
    targets.forEach((_, ti) => {
      const tIdx = (di + ti) % ips.length;
      ctx.beginPath();
      ctx.moveTo(colD + 60, domY[di]);
      ctx.quadraticCurveTo((colD + colI) / 2, domY[di] * 0.6 + ipY[tIdx] * 0.4, colI - 40, ipY[tIdx]);
      ctx.strokeStyle = 'rgba(255,59,92,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });

  // Draw connections: IPs → Providers (cyan Bezier curves)
  ips.forEach((_, ii) => {
    const pIdx = ii % providers.length;
    ctx.beginPath();
    ctx.moveTo(colI + 40, ipY[ii]);
    ctx.quadraticCurveTo((colI + colP) / 2, ipY[ii] * 0.5 + provY[pIdx] * 0.5, colP - 60, provY[pIdx]);
    ctx.strokeStyle = 'rgba(0,212,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Draw nodes
  function drawNode(x, y, label, type) {
    const colors = { domain: ['rgba(255,59,92,0.15)', '#ff3b5c'], ip: ['rgba(0,212,255,0.1)', '#00d4ff'], provider: ['rgba(255,182,39,0.1)', '#ffb627'] };
    const [bg, fg] = colors[type] || colors.ip;
    ctx.font = '500 9px "IBM Plex Mono"';
    const tw = ctx.measureText(label).width;
    const pw = tw + 16;
    const rx = x - pw / 2, ry = y - 10;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(rx, ry, pw, 20, 4);
    ctx.fill();
    ctx.strokeStyle = fg + '40';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
    // Category label
    ctx.font = '500 7px "Chakra Petch"';
    ctx.fillStyle = '#4a5a73';
    ctx.fillText(type.toUpperCase(), x, y + 16);
  }

  domains.forEach((d, i) => drawNode(colD, domY[i], (typeof d === 'string' ? d : d.domain || d.name || '').substring(0, 18), 'domain'));
  ips.forEach((ip, i) => drawNode(colI, ipY[i], typeof ip === 'string' ? ip : ip.ip || ip.address || '', 'ip'));
  providers.forEach((p, i) => drawNode(colP, provY[i], typeof p === 'string' ? p : p.name || p.provider || '', 'provider'));
}

async function viewCampaignDetail(el, params) {
  el.innerHTML = 'Loading...';
  try {
    const [campRes, threatsRes, infraRes, brandsRes, timelineRes] = await Promise.all([
      api(`/campaigns/${params.id}`),
      api(`/campaigns/${params.id}/threats?limit=15`).catch(() => null),
      api(`/campaigns/${params.id}/infrastructure`).catch(() => null),
      api(`/campaigns/${params.id}/brands`).catch(() => null),
      api(`/campaigns/${params.id}/timeline?period=30d`).catch(() => null),
    ]);
    const c = campRes?.data;
    if (!c) { el.innerHTML = '<div class="empty-state"><div class="message">Campaign not found</div></div>'; return; }

    const threats = threatsRes?.data || [];
    const infra = infraRes?.data || {};
    const brands = brandsRes?.data || [];
    const maxBrand = brands[0]?.count || brands[0]?.threat_count || 1;
    const brandColors = ['#ff3b5c', '#ff6b35', '#ffb627', '#00d4ff', '#0091b3'];
    const sev = c.severity || 'medium';
    const sc = _campSevColor(sev);
    const stClass = c.status === 'active' ? 'active-s' : c.status;
    const stLabel = (c.status || '').charAt(0).toUpperCase() + (c.status || '').slice(1);
    const domainCount = c.domain_count || c.domains || (infra.domains || []).length || 0;
    const ipCount = c.ip_count || c.ips || (infra.ips || []).length || 0;
    const provCount = c.provider_count || (infra.providers || []).length || 0;
    const regCount = c.registrar_count || c.registrars || (infra.registrars || []).length || 0;
    const tldDist = c.tld_distribution || c.tld_dist || {};
    const providerNames = c.provider_names || (infra.providers || []).map(p => typeof p === 'string' ? p : p.name || p.provider || '');

    el.innerHTML = `
      <a href="/campaigns" class="back-link">\u2190 Back to Campaigns</a>
      <div class="camp-header">
        <div class="camp-title">${c.name}<span class="sev ${sev}">${sev}</span><span class="campaign-card-status ${stClass}">${stLabel}</span></div>
        <div class="camp-sub">First seen: ${c.first_seen ? c.first_seen.slice(0, 10) : '-'} \u2014 Last activity: ${c.last_seen ? c.last_seen.slice(0, 10) : 'present'}</div>
        <div class="camp-stats">
          <div class="camp-stat"><div class="camp-stat-val" style="color:${sc}">${c.threat_count || 0}</div><div class="camp-stat-label">Total threats</div></div>
          <div class="camp-stat"><div class="camp-stat-val" style="color:var(--blue-primary)">${brands.length || c.brand_count || 0}</div><div class="camp-stat-label">Brands targeted</div></div>
          <div class="camp-stat"><div class="camp-stat-val" style="color:var(--threat-medium)">${provCount}</div><div class="camp-stat-label">Hosting providers</div></div>
          <div class="camp-stat"><div class="camp-stat-val" style="color:var(--text-secondary)">${domainCount}</div><div class="camp-stat-label">Domains</div></div>
          <div class="camp-stat"><div class="camp-stat-val" style="color:var(--text-secondary)">${ipCount}</div><div class="camp-stat-label">Unique IPs</div></div>
          <div class="camp-stat"><div class="camp-stat-val" style="color:var(--text-secondary)">${regCount}</div><div class="camp-stat-label">Registrars</div></div>
        </div>
      </div>

      <div class="ai-panel">
        <div class="ai-head"><div class="ai-dot"></div><span class="ai-agent">Strategist \u2014 Campaign Assessment</span></div>
        <div class="ai-body">${c.description || c.ai_assessment || ''}${c.methodology ? `<br><br><strong>Methodology:</strong> ${typeof c.methodology === 'string' ? c.methodology : (Array.isArray(c.methodology) ? c.methodology.join('. ') : '')}` : ''}${c.actor_profile ? `<br><br><strong>Actor Profile:</strong> ${c.actor_profile}` : ''}</div>
        <div class="ai-tags">
          ${c.sophistication ? `<div class="ai-tag">Sophistication: ${c.sophistication}</div>` : ''}
          <div class="ai-tag">${domainCount} domains</div>
          <div class="ai-tag">${ipCount} IPs</div>
          ${Object.entries(tldDist).map(([tld, ct]) => `<div class="ai-tag">${tld}: ${ct}</div>`).join('')}
        </div>
      </div>

      <div class="infra-panel">
        <div class="phead"><span class="ptitle" style="display:flex;align-items:center;gap:7px">Infrastructure Map</span><span class="badge">${domainCount} domains \u2192 ${ipCount} IPs \u2192 ${provCount} providers</span></div>
        <div class="infra-body" style="height:280px"><canvas id="camp-infra-canvas" class="infra-canvas"></canvas></div>
      </div>

      <div class="detail-grid">
        <div class="panel">
          <div class="phead"><span class="ptitle" style="display:flex;align-items:center;gap:7px">Associated Threats</span><span class="badge">${c.threat_count || threats.length}</span></div>
          <table class="prov-threats-tbl"><thead><tr><th>URL</th><th>Type</th><th>Target</th><th>Provider</th><th>Status</th></tr></thead><tbody>
          ${threats.map(t => {
      const url = t.malicious_domain || t.url || '';
      const type = t.threat_type || t.type || '';
      const brand = t.brand_name || t.brand || '';
      const prov = t.hosting_provider || t.provider || '';
      const status = t.status || 'active';
      return `<tr>
              <td><div class="td-url">${url}</div></td>
              <td><span class="type-pill ${type}">${type}</span></td>
              <td style="font-size:11px;color:var(--text-secondary)">${brand}</td>
              <td style="font-size:11px;color:var(--text-tertiary)">${prov}</td>
              <td><span class="status-badge-sm ${status}">${status}</span></td>
            </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-tertiary);padding:24px">No threats</td></tr>'}
          </tbody></table>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="panel"><div class="phead"><span class="ptitle" style="display:flex;align-items:center;gap:7px">Targeted Brands</span></div><div class="padded">${brands.length ?
      brands.map((b, i) => {
        const cnt = b.count || b.threat_count || 0;
        const pct = maxBrand > 0 ? Math.round(cnt / maxBrand * 100) : 0;
        return `<div class="pbar-row"><span class="pbar-lbl">${b.name || b.brand_name}</span><div class="pbar-trk"><div class="pbar-fill" style="width:${pct}%;background:${brandColors[i] || brandColors[4]}"></div></div><span class="pbar-ct">${cnt}</span></div>`;
      }).join('') :
      '<div class="empty-state"><div class="message">No brands</div></div>'
    }</div></div>
          <div class="panel"><div class="phead"><span class="ptitle" style="display:flex;align-items:center;gap:7px">Infrastructure Stats</span></div><div class="padded">
            <div class="infra-stat"><span class="infra-stat-label">TLD Distribution</span><span class="infra-stat-val">${Object.entries(tldDist).map(([t, v]) => `${t}: ${v}`).join(', ') || '\u2014'}</span></div>
            <div class="infra-stat"><span class="infra-stat-label">Providers</span><span class="infra-stat-val">${providerNames.join(', ') || '\u2014'}</span></div>
            <div class="infra-stat"><span class="infra-stat-label">Registrars</span><span class="infra-stat-val">${regCount} unique</span></div>
            <div class="infra-stat"><span class="infra-stat-label">IP Ranges</span><span class="infra-stat-val">${ipCount} unique addresses</span></div>
          </div></div>
        </div>
      </div>

      <div class="chart-head"><div class="chart-title">Campaign Activity Timeline</div></div>
      <div class="chart-wrap"><canvas id="camp-timeline-chart"></canvas></div>`;

    // ── Draw infrastructure graph on canvas with Bezier connections ──
    setTimeout(() => {
      const canvas = document.getElementById('camp-infra-canvas');
      if (!canvas) return;
      const domainNodes = (infra.domains || []).slice(0, 6);
      const ipNodes = (infra.ips || []).slice(0, 6);
      const provNodes = (infra.providers || []).slice(0, 3);
      if (domainNodes.length || ipNodes.length || provNodes.length) {
        _campDrawInfraGraph(canvas, domainNodes, ipNodes, provNodes);
      }
    }, 100);

    // ── Timeline chart — line type with fill (not bar) ──
    if (_campDetailChart) { _campDetailChart.destroy(); _campDetailChart = null; }
    const timeline = timelineRes?.data || {};
    if (timeline.labels?.length && typeof Chart !== 'undefined') {
      // Resolve severity color to a raw rgba string for Chart.js fill
      const sevColorMap = { critical: '255,59,92', high: '255,107,53', medium: '255,182,39' };
      const rawColor = sevColorMap[sev] || '255,59,92';
      const borderColor = `rgb(${rawColor})`;
      const bgColor = `rgba(${rawColor},0.06)`;

      setTimeout(() => {
        const ctx2 = document.getElementById('camp-timeline-chart');
        if (!ctx2) return;
        _campDetailChart = new Chart(ctx2, {
          type: 'line',
          data: { labels: timeline.labels, datasets: [{
            label: 'Threats', data: timeline.values,
            borderColor, backgroundColor: bgColor,
            fill: true, tension: 0.35, pointRadius: 0,
            pointHoverRadius: 5, borderWidth: 2
          }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(10,16,32,0.95)', borderColor: 'rgba(0,212,255,0.35)', borderWidth: 1,
                titleFont: { family: "'Chakra Petch'", size: 11 },
                bodyFont: { family: "'IBM Plex Mono'", size: 11 },
                titleColor: '#e8edf5', bodyColor: '#7a8ba8', padding: 10, cornerRadius: 6, displayColors: false
              }
            },
            scales: {
              x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false } },
              y: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, padding: 8 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, beginAtZero: true }
            }
          }
        });
      }, 150);
    }

    // Cleanup
    window._viewCleanup = () => {
      if (_campDetailChart) { _campDetailChart.destroy(); _campDetailChart = null; }
    };

  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Trends (Step 12) ─────────────────────────────────
const CHART_COLORS = ['#00d4ff', '#ff3b5c', '#ff6b35', '#ffb627', '#00e5a0', '#b388ff', '#0091b3', '#ff80ab', '#82b1ff', '#ccff90'];
let _trendChart = null;
let _trendDimension = 'brands';
let _trendPeriod = '30d';
let _trendCompare = false;
let _hiddenSeries = new Set();

function aggregateByField(rows, field, countField) {
  const map = {};
  for (const r of rows) {
    const key = r[field];
    map[key] = (map[key] || 0) + (r[countField] || 0);
  }
  return Object.entries(map).map(([k, v]) => ({ [field]: k, count: v })).sort((a, b) => b.count - a.count);
}

async function viewTrends(el) {
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">Trend Explorer</div>
    <div class="insights-row" id="trend-insights"></div>
    <div class="trend-controls" id="trend-controls">
      <div class="ctrl-group">
        <span class="ctrl-label">Dimension</span>
        <button class="filter-pill active" data-dim="brands">Brands</button>
        <button class="filter-pill" data-dim="providers">Providers</button>
        <button class="filter-pill" data-dim="tlds">TLDs</button>
        <button class="filter-pill" data-dim="types">Threat Types</button>
        <button class="filter-pill" data-dim="volume">Volume</button>
      </div>
      <div class="ctrl-divider"></div>
      <div class="ctrl-group">
        <span class="ctrl-label">Period</span>
        ${['7d', '30d', '90d', '1y'].map(p => `<button class="filter-pill ${p === _trendPeriod ? 'active' : ''}" data-period="${p}">${p.toUpperCase()}</button>`).join('')}
      </div>
      <div class="ctrl-divider"></div>
      <div class="compare-toggle">
        <span style="font-size:10px;color:var(--text-secondary)">Compare</span>
        <div class="toggle-switch" id="compare-toggle"><div class="toggle-dot"></div></div>
      </div>
    </div>
    <div class="ai-trend-panel" id="ai-trend-panel" style="display:none"><div class="ai-head"><div class="ai-dot"></div><span class="ai-agent">Observer</span></div><div class="ai-trend-text" id="ai-trend-text"></div></div>
    <div class="trend-legend" id="trend-legend"></div>
    <div class="chart-container"><canvas id="trend-chart"></canvas></div>`;

  const loadTrends = async () => {
    const dimMap = { brands: '/trends/brands', providers: '/trends/providers', tlds: '/trends/tlds', types: '/trends/types', volume: '/trends/volume' };
    const res = await api(`${dimMap[_trendDimension]}?period=${_trendPeriod}&limit=10`).catch(() => null);
    const data = res?.data || {};
    const labels = data.labels || [];
    const series = data.series || [];

    // Destroy old chart
    if (_trendChart) { _trendChart.destroy(); _trendChart = null; }

    // Determine chart type
    const isStacked = _trendDimension === 'tlds' || _trendDimension === 'types';
    const isArea = _trendDimension === 'volume';
    const chartType = isStacked ? 'line' : isArea ? 'line' : 'line';

    // Build datasets
    let datasets;
    if (isArea || series.length === 0) {
      // Volume - single series or fallback
      const values = data.values || (Array.isArray(data) ? data.map(d => d.total || d.count || 0) : []);
      datasets = [{ label: 'Total Threats', data: values, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.15)', fill: true, tension: 0.3, pointRadius: 0 }];
    } else {
      datasets = series.map((s, i) => ({
        label: s.name || s.tld || `Series ${i}`,
        data: s.values || [],
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        backgroundColor: isStacked ? CHART_COLORS[i % CHART_COLORS.length] + '33' : 'transparent',
        fill: isStacked,
        tension: 0.3,
        pointRadius: 0,
        hidden: _hiddenSeries.has(s.name || s.tld),
      }));
    }

    // Legend
    const legendEl = document.getElementById('trend-legend');
    if (datasets.length > 1) {
      legendEl.innerHTML = datasets.map((ds, i) =>
        `<div class="legend-item ${_hiddenSeries.has(ds.label) ? 'muted' : ''}" data-series="${ds.label}">
          <div class="legend-swatch" style="background:${ds.borderColor}"></div>${ds.label}
        </div>`
      ).join('');
      legendEl.addEventListener('click', (e) => {
        const item = e.target.closest('.legend-item');
        if (!item) return;
        const name = item.dataset.series;
        if (_hiddenSeries.has(name)) _hiddenSeries.delete(name);
        else _hiddenSeries.add(name);
        loadTrends();
      });
    } else {
      legendEl.innerHTML = '';
    }

    // Chart
    const ctx = document.getElementById('trend-chart');
    if (ctx && typeof Chart !== 'undefined') {
      _trendChart = new Chart(ctx, {
        type: chartType,
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0a1020', borderColor: 'rgba(0,212,255,0.3)', borderWidth: 1, titleFont: { family: "'Chakra Petch'" }, bodyFont: { family: "'IBM Plex Mono'", size: 11 } } },
          scales: {
            x: { stacked: isStacked, ticks: { color: '#4a5a73', font: { size: 9 }, maxRotation: 0 }, grid: { color: 'rgba(0,212,255,0.06)' } },
            y: { stacked: isStacked, ticks: { color: '#4a5a73', font: { size: 9 } }, grid: { color: 'rgba(0,212,255,0.06)' } }
          }
        }
      });
    }

    // Headline insights
    const insightsEl = document.getElementById('trend-insights');
    if (series.length > 1) {
      const totals = series.map(s => ({ name: s.name, total: (s.values || []).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
      const biggest = totals[0];
      const smallest = totals[totals.length - 1];
      insightsEl.innerHTML = `
        <div class="insight-card"><div class="insight-card-label">Highest Volume</div><div class="insight-card-value">${biggest?.name || '-'}</div><div class="insight-card-sub">${biggest?.total || 0} total</div></div>
        <div class="insight-card"><div class="insight-card-label">Lowest Volume</div><div class="insight-card-value">${smallest?.name || '-'}</div><div class="insight-card-sub">${smallest?.total || 0} total</div></div>
        <div class="insight-card"><div class="insight-card-label">Series Count</div><div class="insight-card-value">${series.length}</div><div class="insight-card-sub">${_trendDimension}</div></div>
        <div class="insight-card"><div class="insight-card-label">Period</div><div class="insight-card-value">${_trendPeriod.toUpperCase()}</div><div class="insight-card-sub">${labels.length} data points</div></div>`;
    } else {
      insightsEl.innerHTML = '';
    }
  };

  await loadTrends();

  // Dimension and period controls
  document.getElementById('trend-controls').addEventListener('click', async (e) => {
    const dim = e.target.closest('[data-dim]');
    const period = e.target.closest('[data-period]');
    const toggle = e.target.closest('#compare-toggle');

    if (dim) {
      document.querySelectorAll('[data-dim]').forEach(b => b.classList.remove('active'));
      dim.classList.add('active');
      _trendDimension = dim.dataset.dim;
      _hiddenSeries.clear();
      await loadTrends();
    }
    if (period) {
      document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
      period.classList.add('active');
      _trendPeriod = period.dataset.period;
      await loadTrends();
    }
    if (toggle) {
      toggle.classList.toggle('on');
      _trendCompare = toggle.classList.contains('on');
    }
  });

  // Cleanup
  window._viewCleanup = () => { if (_trendChart) { _trendChart.destroy(); _trendChart = null; } };
}

// ─── View: Agents (Step 13) ─────────────────────────────────
const AGENT_META = {
  sentinel: { icon: '\u25ce', iconClass: 'sentinel', color: '#00d4ff', role: 'Certificate & Domain Surveillance' },
  analyst: { icon: '\u25c8', iconClass: 'analyst', color: '#00e5a0', role: 'Threat Classification & Brand Matching' },
  cartographer: { icon: '\u25c7', iconClass: 'cartographer', color: '#ffb627', role: 'Infrastructure Mapping & Provider Scoring' },
  strategist: { icon: '\u25c6', iconClass: 'strategist', color: '#ff3b5c', role: 'Campaign Correlation & Clustering' },
  observer: { icon: '\u25c9', iconClass: 'observer', color: '#b388ff', role: 'Trend Analysis & Intelligence Synthesis' },
};
let _selectedAgent = null;
let _agentHealthChart = null;

function relativeTime(minutes) {
  if (!minutes && minutes !== 0) return '-';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

async function viewAgents(el) {
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">AI Agent Operations</div>
    <div class="agg-stats" id="agents-agg"></div>
    <div class="agent-grid" id="agent-grid"></div>
    <div class="agent-detail-panel" id="agent-detail"></div>`;

  try {
    const agentsRes = await api('/agents').catch(() => null);
    const agents = agentsRes?.data || [];

    // Agg stats
    const totalJobs = agents.reduce((s, a) => s + (a.jobs_24h || 0), 0);
    const totalOutputs = agents.reduce((s, a) => s + (a.outputs_24h || 0), 0);
    const totalErrors = agents.reduce((s, a) => s + (a.error_count_24h || 0), 0);
    const activeCount = agents.filter(a => a.status === 'active').length;

    document.getElementById('agents-agg').innerHTML = `
      <div class="agg-card"><div class="agg-val" style="color:var(--positive)">${activeCount}/${agents.length}</div><div class="agg-lbl">Agents operational</div><div class="agg-sub">${agents.filter(a => a.status === 'idle').length} idle</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--blue-primary)">${totalJobs}</div><div class="agg-lbl">Jobs (24h)</div><div class="agg-sub">Analysis runs completed</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--text-accent)">${totalOutputs}</div><div class="agg-lbl">Outputs (24h)</div><div class="agg-sub">Insights + classifications</div></div>
      <div class="agg-card"><div class="agg-val" style="color:${totalErrors > 0 ? 'var(--negative)' : 'var(--positive)'}">${totalErrors}</div><div class="agg-lbl">Errors (24h)</div><div class="agg-sub">${totalErrors === 0 ? 'All systems nominal' : 'Attention needed'}</div></div>`;

    // Agent cards
    const grid = document.getElementById('agent-grid');
    grid.innerHTML = agents.map(a => {
      const meta = AGENT_META[a.name] || AGENT_META[a.agent_id] || { icon: '\u25cb', iconClass: 'sentinel', color: '#00d4ff', role: a.description || '' };
      const activity = a.activity || Array(24).fill(0);
      const maxAct = Math.max(...activity, 1);
      return `<div class="agent-card" data-agent="${a.agent_id || a.name}">
        <div class="agent-status-dot ${a.status || 'idle'}"></div>
        <div class="agent-header">
          <div class="agent-icon ${meta.iconClass}">${meta.icon}</div>
          <div class="agent-name-block"><div class="agent-name">${a.display_name || a.name}</div><div class="agent-role">${meta.role}</div></div>
        </div>
        <div class="agent-stats-row">
          <div class="agent-stat"><div class="agent-stat-val">${a.jobs_24h || 0}</div><div class="agent-stat-label">Jobs</div></div>
          <div class="agent-stat"><div class="agent-stat-val">${a.outputs_24h || 0}</div><div class="agent-stat-label">Outputs</div></div>
          <div class="agent-stat"><div class="agent-stat-val" style="color:${(a.error_count_24h || 0) > 0 ? 'var(--negative)' : ''}">${a.error_count_24h || 0}</div><div class="agent-stat-label">Errors</div></div>
        </div>
        <div class="agent-last"><span>Last output</span><span>${relativeTime(a.last_output_at)}</span></div>
        <div class="activity-bar">${activity.map(v => {
          const opacity = v > 0 ? 0.2 + (v / maxAct) * 0.8 : 0.05;
          return `<div class="activity-seg" style="background:${meta.color};opacity:${opacity}"></div>`;
        }).join('')}</div>
      </div>`;
    }).join('');

    // Click to expand detail
    grid.addEventListener('click', async (e) => {
      const card = e.target.closest('.agent-card');
      if (!card) return;
      const agentId = card.dataset.agent;
      document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      if (_selectedAgent === agentId) {
        _selectedAgent = null;
        card.classList.remove('selected');
        document.getElementById('agent-detail').classList.remove('visible');
        return;
      }
      _selectedAgent = agentId;

      const agent = agents.find(a => (a.agent_id || a.name) === agentId);
      const meta = AGENT_META[agentId] || AGENT_META[agent?.name] || { icon: '\u25cb', iconClass: 'sentinel', color: '#00d4ff', role: '' };

      // Fetch outputs and health
      const [outputsRes, healthRes] = await Promise.all([
        api(`/agents/${agentId}/outputs?limit=10`).catch(() => null),
        api(`/agents/${agentId}/health?period=24h`).catch(() => null),
      ]);
      const outputs = outputsRes?.data || [];
      const health = healthRes?.data || {};

      const detail = document.getElementById('agent-detail');
      detail.classList.add('visible');
      detail.innerHTML = `
        <div class="agent-detail-header">
          <div class="dh-icon agent-icon ${meta.iconClass}">${meta.icon}</div>
          <div class="dh-info">
            <div class="dh-name">${agent?.display_name || agentId} <span class="status-label ${agent?.status || 'idle'}">${agent?.status || 'idle'}</span></div>
            <div class="dh-desc">${agent?.description || meta.role}</div>
          </div>
          <div class="dh-stats">
            <div class="dhs"><div class="dhs-val">${agent?.schedule || '-'}</div><div class="dhs-label">Schedule</div></div>
            <div class="dhs"><div class="dhs-val">${agent?.avg_duration_ms ? (agent.avg_duration_ms / 1000).toFixed(1) + 's' : '-'}</div><div class="dhs-label">Avg duration</div></div>
            <div class="dhs"><div class="dhs-val" style="color:${(agent?.error_count_24h || 0) > 0 ? 'var(--negative)' : 'var(--positive)'}">${agent?.jobs_24h ? ((1 - (agent.error_count_24h || 0) / agent.jobs_24h) * 100).toFixed(1) + '%' : '100.0%'}</div><div class="dhs-label">Success</div></div>
          </div>
        </div>
        <div class="agent-detail-grid">
          <div class="agent-detail-left">
            <div class="dp-head"><span class="dp-title">Recent Outputs</span><span class="dp-badge">${agent?.outputs_24h || outputs.length} today</span></div>
            <div class="output-feed">${outputs.length ? outputs.map(o => `<div class="output-item">
              <div class="output-meta">
                <span class="output-type ${o.type || ''}">${o.type || 'output'}</span>
                ${o.severity ? `<span class="output-sev ${o.severity}">${o.severity}</span>` : ''}
                <span class="output-time">${o.created_at ? relativeTime(Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000)) : ''}</span>
              </div>
              <div class="output-text">${o.summary || o.summary_text || ''}</div>
              ${o.related_entities?.length ? `<div class="output-entities">${o.related_entities.map(e => `<span class="output-entity">${typeof e === 'string' ? e : e.name || ''}</span>`).join('')}</div>` : ''}
            </div>`).join('') : '<div class="empty-state"><div class="message">No recent outputs</div></div>'}</div>
          </div>
          <div>
            <div class="dp-head"><span class="dp-title">Health (24h)</span><span class="dp-badge">${agent?.jobs_24h || 0} runs</span></div>
            <div class="health-chart-area"><canvas id="agent-health-chart"></canvas></div>
          </div>
        </div>`;

      // Health chart
      if (_agentHealthChart) { _agentHealthChart.destroy(); _agentHealthChart = null; }
      const runs = health.runs || [];
      const errors = health.errors || [];
      const outputCounts = health.outputs || health.avg_duration_trend || [];
      if (runs.length && typeof Chart !== 'undefined') {
        const labels = Array.from({ length: runs.length }, (_, i) => {
          const h = (new Date().getHours() - runs.length + 1 + i + 24) % 24;
          return String(h).padStart(2, '0') + ':00';
        });
        _agentHealthChart = new Chart(document.getElementById('agent-health-chart'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Duration (s)', data: runs.map(v => v / 1000), backgroundColor: meta.color + '40', borderColor: meta.color + '99', borderWidth: 1, borderRadius: 3, barPercentage: 0.6, yAxisID: 'y' },
              { label: 'Outputs', data: outputCounts, type: 'line', borderColor: '#00e5a0', backgroundColor: 'transparent', borderWidth: 2, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, yAxisID: 'y1' },
              { label: 'Errors', data: errors, type: 'line', borderColor: '#ff3b5c', backgroundColor: 'transparent', borderWidth: 2, tension: 0.35, pointRadius: errors.map(e => e > 0 ? 5 : 0), pointBackgroundColor: '#ff3b5c', yAxisID: 'y1' },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
              legend: { display: true, position: 'top', labels: { color: '#7a8ba8', font: { family: "'IBM Plex Mono'", size: 9 }, boxWidth: 12, padding: 12, usePointStyle: true } },
              tooltip: { backgroundColor: 'rgba(10,16,32,0.95)', borderColor: 'rgba(0,212,255,0.35)', borderWidth: 1, titleFont: { family: "'Chakra Petch'", size: 11 }, bodyFont: { family: "'IBM Plex Mono'", size: 11 }, titleColor: '#e8edf5', bodyColor: '#7a8ba8', padding: 10, cornerRadius: 6 }
            },
            scales: {
              x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false } },
              y: { position: 'left', title: { display: true, text: 'Duration (s)', color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 } }, ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 } }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, beginAtZero: true },
              y1: { position: 'right', title: { display: true, text: 'Count', color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 } }, ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 } }, grid: { display: false }, beginAtZero: true }
            }
          }
        });
      }
    });

  } catch (err) { showToast(err.message, 'error'); }

  window._viewCleanup = () => { if (_agentHealthChart) { _agentHealthChart.destroy(); _agentHealthChart = null; } _selectedAgent = null; };
}

// ─── View: Admin Dashboard (Step 14) ────────────────────────
let _adminFeedChart = null;
async function viewAdmin(el) {
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">System Overview</div>
    <div class="adm-metrics" id="adm-metrics"></div>
    <div class="adm-actions">
      <div class="adm-action-btn" onclick="navigate('/admin/users')"><div class="adm-action-icon">+</div><div class="adm-action-label">Invite User</div><div class="adm-action-desc">Send invitation email</div></div>
      <div class="adm-action-btn" onclick="navigate('/admin/feeds')"><div class="adm-action-icon">\u21bb</div><div class="adm-action-label">Force Feed Pull</div><div class="adm-action-desc">Trigger all feeds now</div></div>
      <div class="adm-action-btn" onclick="navigate('/admin/agent-config')"><div class="adm-action-icon">\u25c8</div><div class="adm-action-label">Run AI Analysis</div><div class="adm-action-desc">Trigger all agents</div></div>
      <div class="adm-action-btn" onclick="navigate('/admin/audit')"><div class="adm-action-icon">\u229e</div><div class="adm-action-label">View Audit Log</div><div class="adm-action-desc">Recent system events</div></div>
    </div>
    <div class="adm-grid-2">
      <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Feed Ingestion (24h)</div><div class="adm-pbadge" id="adm-feed-badge">Loading</div></div><div class="adm-chart-wrap"><canvas id="adm-feed-chart"></canvas></div><div class="adm-padded" id="adm-feed-list"></div></div>
      <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Recent System Events</div><div class="adm-pbadge" id="adm-events-badge">-</div></div><div id="adm-events" style="max-height:440px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--bg-elevated) transparent"></div></div>
    </div>
    <div class="adm-grid-2">
      <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Lead Pipeline</div><div class="adm-pbadge" id="adm-pipe-badge">-</div></div><div class="adm-padded"><div class="adm-pipeline" id="adm-pipeline"></div><div id="adm-pipe-meta" style="font-size:11px;color:var(--text-tertiary);margin-top:8px"></div></div></div>
      <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">AI Agent Health</div><div class="adm-pbadge" id="adm-agent-badge">-</div></div><div class="adm-padded" id="adm-agent-summary"></div></div>
    </div>`;

  try {
    const [statsRes, feedsRes, eventsRes, leadsRes, agentsRes] = await Promise.all([
      api('/admin/stats').catch(() => null),
      api('/feeds').catch(() => null),
      api('/admin/audit?limit=15').catch(() => null),
      api('/admin/leads').catch(() => null),
      api('/agents').catch(() => null),
    ]);
    const stats = statsRes?.data || {};
    const feeds = feedsRes?.data || [];
    const events = eventsRes?.data || [];
    const leads = leadsRes?.data || [];
    const agents = agentsRes?.data || [];

    // Metrics
    const userTotal = stats.users?.total || 0;
    const activeSessions = stats.sessions?.active || 0;
    const saCount = stats.users?.super_admin || 0;
    const adminCount = stats.users?.admin || 0;
    const analystCount = stats.users?.analyst || 0;
    const healthyFeeds = feeds.filter(f => f.health_status === 'healthy' || f.enabled).length;
    const totalFeeds = feeds.length;
    const totalRecords = feeds.reduce((s, f) => s + (f.records_today || 0), 0);
    const leadNew = leads.filter(l => l.status === 'new').length;
    const leadContacted = leads.filter(l => l.status === 'contacted').length;
    const leadQualified = leads.filter(l => l.status === 'qualified').length;
    const leadProposal = leads.filter(l => l.status === 'proposal').length;
    const leadConverted = leads.filter(l => l.status === 'converted').length;
    const leadTotal = leadNew + leadContacted + leadQualified + leadProposal;
    const agentJobs = agents.reduce((s, a) => s + (a.jobs_24h || 0), 0);
    const agentErrors = agents.reduce((s, a) => s + (a.error_count_24h || 0), 0);

    document.getElementById('adm-metrics').innerHTML = `
      <div class="adm-metric"><div class="adm-metric-label">Users</div><div class="adm-metric-value" style="color:var(--blue-primary)">${userTotal}</div><div class="adm-metric-sub"><span style="color:var(--positive)">${activeSessions} active sessions</span></div><div class="adm-metric-bar"><div class="adm-metric-bar-seg" style="background:var(--threat-medium);width:${saCount/Math.max(userTotal,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--purple);width:${adminCount/Math.max(userTotal,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--positive);width:${analystCount/Math.max(userTotal,1)*100}%"></div></div></div>
      <div class="adm-metric"><div class="adm-metric-label">Data Feeds</div><div class="adm-metric-value" style="color:var(--positive)">${healthyFeeds}/${totalFeeds}</div><div class="adm-metric-sub"><span style="color:var(--positive)">${healthyFeeds} healthy</span></div><div class="adm-metric-bar"><div class="adm-metric-bar-seg" style="background:var(--positive);width:100%"></div></div></div>
      <div class="adm-metric"><div class="adm-metric-label">Leads in Pipeline</div><div class="adm-metric-value" style="color:var(--threat-medium)">${leadTotal}</div><div class="adm-metric-sub"><span style="color:var(--negative)">${leadNew} new</span><span style="color:var(--positive)">${leadConverted} converted</span></div><div class="adm-metric-bar"><div class="adm-metric-bar-seg" style="background:var(--negative);width:${leadNew/Math.max(leadTotal,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--threat-high);width:${leadContacted/Math.max(leadTotal,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--threat-medium);width:${leadQualified/Math.max(leadTotal,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--positive);width:${leadProposal/Math.max(leadTotal,1)*100}%"></div></div></div>
      <div class="adm-metric"><div class="adm-metric-label">AI Analysis (24h)</div><div class="adm-metric-value" style="color:var(--text-primary)">${agentJobs}</div><div class="adm-metric-sub"><span style="color:var(--positive)">${agentJobs} completed</span><span style="color:${agentErrors>0?'var(--negative)':'var(--positive)'}">${agentErrors} failed</span></div><div class="adm-metric-bar"><div class="adm-metric-bar-seg" style="background:var(--positive);width:${agentJobs/Math.max(agentJobs+agentErrors,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--negative);width:${agentErrors/Math.max(agentJobs+agentErrors,1)*100}%"></div></div></div>`;

    // Feed ingestion chart
    const feedBadgeEl = document.getElementById('adm-feed-badge');
    if (feedBadgeEl) feedBadgeEl.textContent = feeds.every(f => f.health_status === 'healthy' || !f.health_status) ? 'All healthy' : 'Issues detected';
    if (feeds.length && typeof Chart !== 'undefined') {
      const feedLabels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
      const feedColors = ['#00d4ff', '#00e5a0', '#ffb627', '#b388ff'];
      if (_adminFeedChart) { _adminFeedChart.destroy(); _adminFeedChart = null; }
      // Fetch real ingestion job data for chart
      const jobsRes = await api('/feeds/jobs?limit=100').catch(() => null);
      const jobs = jobsRes?.data || [];
      const feedDatasets = feeds.slice(0, 4).map((f, i) => {
        const hourBuckets = new Array(24).fill(0);
        jobs.filter(j => j.feed_name === f.feed_name && j.status === 'success').forEach(j => {
          const h = parseInt((j.started_at || '').substring(11, 13), 10);
          if (!isNaN(h)) hourBuckets[h] += (j.records_ingested || 0);
        });
        return { label: f.display_name || f.feed_name, data: hourBuckets,
          backgroundColor: feedColors[i % 4] + '30', borderColor: feedColors[i % 4], borderWidth: 1.5, fill: true, tension: 0.35, pointRadius: 0 };
      });
      _adminFeedChart = new Chart(document.getElementById('adm-feed-chart'), {
        type: 'line', data: { labels: feedLabels, datasets: feedDatasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(10,16,32,0.95)', borderColor: 'rgba(0,212,255,0.35)', borderWidth: 1, titleFont: { family: "'Chakra Petch'", size: 10 }, bodyFont: { family: "'IBM Plex Mono'", size: 10 }, titleColor: '#e8edf5', bodyColor: '#7a8ba8', padding: 8, cornerRadius: 6 } },
          scales: { x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, stacked: true }, y: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 8 } }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, stacked: true, beginAtZero: true } } }
      });
    }

    // Feed list
    document.getElementById('adm-feed-list').innerHTML = feeds.map(f => {
      const st = f.health_status || 'healthy';
      return `<div class="adm-feed-row"><div class="adm-feed-dot ${st}"></div><div class="adm-feed-name">${f.display_name || f.feed_name}</div><div class="adm-feed-last">${f.last_successful_pull ? relativeTime(Math.round((Date.now() - new Date(f.last_successful_pull).getTime()) / 60000)) : '-'}</div><div class="adm-feed-count">${(f.records_ingested_today || 0).toLocaleString()} today</div></div>`;
    }).join('');

    // Events
    const evBadge = document.getElementById('adm-events-badge');
    if (evBadge) evBadge.textContent = `Last ${events.length}`;
    const evIcons = { login: { cls: 'auth', icon: '\u25c8' }, login_failed: { cls: 'feed-err', icon: '\u25c8' }, feed_run: { cls: 'feed', icon: '\u21bb' }, feed_error: { cls: 'feed-err', icon: '\u26a0' }, config_change: { cls: 'config', icon: '\u229e' }, role_change: { cls: 'user', icon: '+' }, invitation: { cls: 'user', icon: '+' }, lead_update: { cls: 'lead', icon: '\u25c9' } };
    document.getElementById('adm-events').innerHTML = events.map(e => {
      const ev = evIcons[e.action] || evIcons.login;
      return `<div class="adm-event-row"><div class="adm-ev-icon ${ev.cls}">${ev.icon}</div><div class="adm-ev-body"><div class="adm-ev-text">${e.summary || e.action || ''} <strong>${e.resource_type || ''}</strong></div><div class="adm-ev-time">${e.timestamp ? relativeTime(Math.round((Date.now() - new Date(e.timestamp).getTime()) / 60000)) : ''}</div></div><span class="adm-ev-outcome ${e.outcome || 'success'}">${e.outcome || 'success'}</span></div>`;
    }).join('') || '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No recent events</div>';

    // Pipeline
    const pipeStages = [
      { label: 'New', count: leadNew, color: 'var(--negative)' },
      { label: 'Contacted', count: leadContacted, color: 'var(--threat-high)' },
      { label: 'Qualified', count: leadQualified, color: 'var(--threat-medium)' },
      { label: 'Proposal', count: leadProposal, color: 'var(--blue-primary)' },
      { label: 'Converted', count: leadConverted, color: 'var(--positive)' },
    ];
    const pipeBadge = document.getElementById('adm-pipe-badge');
    if (pipeBadge) pipeBadge.textContent = `${leads.length} total`;
    document.getElementById('adm-pipeline').innerHTML = pipeStages.map(s => `<div class="adm-pipe-stage"><div class="adm-pipe-v" style="color:${s.color}">${s.count}</div><div class="adm-pipe-l">${s.label}</div></div>`).join('');
    document.getElementById('adm-pipe-meta').innerHTML = `Avg time to contact: <span style="font-family:var(--font-mono);color:var(--text-secondary)">--</span> \u00b7 Conversion rate: <span style="font-family:var(--font-mono);color:var(--positive)">${leads.length > 0 ? Math.round(leadConverted / leads.length * 100) : 0}%</span>`;

    // Agent summary
    const agentBadge = document.getElementById('adm-agent-badge');
    const agentActive = agents.filter(a => a.status === 'active').length;
    if (agentBadge) agentBadge.textContent = `${agentActive}/${agents.length} operational`;
    document.getElementById('adm-agent-summary').innerHTML = agents.map(a => {
      const meta = AGENT_META[a.name] || AGENT_META[a.agent_id] || { color: '#00d4ff' };
      return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(0,212,255,.04)"><div style="width:7px;height:7px;border-radius:50%;background:${a.status==='active'?'var(--positive)':'var(--blue-primary)'};${a.status==='active'?'animation:pulse 2s ease-in-out infinite':''}"></div><div style="flex:1;font-size:12px;font-weight:500;color:${meta.color}">${a.display_name || a.name}</div><div style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary)">${a.jobs_24h || 0} jobs</div><div style="font-family:var(--font-mono);font-size:10px;color:${meta.color}">${a.outputs_24h || 0} outputs</div><div style="font-family:var(--font-mono);font-size:10px;color:${(a.error_count_24h||0)>0?'var(--negative)':'var(--positive)'}">${a.error_count_24h || 0} err</div></div>`;
    }).join('') || '<div style="padding:12px;text-align:center;color:var(--text-tertiary)">No agents configured</div>';

  } catch (err) { showToast(err.message, 'error'); }

  window._viewCleanup = () => { if (_adminFeedChart) { _adminFeedChart.destroy(); _adminFeedChart = null; } };
}

// ─── View: Admin Users (Step 15) ────────────────────────────
async function viewAdminUsers(el) {
  const ini = n => n ? n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??';

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700">Users & Roles</div>
      <button class="adm-btn adm-btn-primary" id="adm-invite-btn"><span style="font-size:14px">+</span> Invite User</button>
    </div>
    <div class="adm-page-tabs">
      <div class="adm-ptab active" data-tab="users">Active Users<span style="font-family:var(--font-mono);font-size:9px;margin-left:6px;color:var(--text-tertiary)" id="user-count">-</span></div>
      <div class="adm-ptab" data-tab="invites">Pending Invitations<span style="font-family:var(--font-mono);font-size:9px;margin-left:6px;color:var(--text-tertiary)" id="inv-count">-</span></div>
    </div>
    <div class="adm-ptab-c visible" id="tab-users">
      <div class="adm-controls">
        <input class="adm-search" placeholder="Search by name or email..." id="adm-user-search">
        <select class="adm-sel" id="adm-role-filter"><option value="">All Roles</option><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="analyst">Analyst</option></select>
        <select class="adm-sel" id="adm-status-filter"><option value="">All Status</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
      </div>
      <div class="adm-panel" id="users-table-wrap"><div style="padding:20px;text-align:center;color:var(--text-tertiary)">Loading...</div></div>
    </div>
    <div class="adm-ptab-c" id="tab-invites"><div id="inv-list"><div style="padding:20px;text-align:center;color:var(--text-tertiary)">Loading...</div></div></div>
    <div class="adm-modal-ov" id="adm-inv-modal">
      <div class="adm-modal">
        <div class="adm-modal-t">Invite User</div>
        <div class="adm-modal-s">Send an invitation email with a secure token link. The recipient must authenticate with the matching Google account.</div>
        <div class="adm-fg"><label class="adm-fl">Email Address</label><input class="adm-fi" placeholder="user@company.com" id="adm-inv-email"></div>
        <div class="adm-fg"><label class="adm-fl">Role</label><select class="adm-fsel" id="adm-inv-role"><option value="analyst">Analyst</option><option value="admin">Admin</option></select></div>
        <div class="adm-macts"><button class="adm-btn-c" id="adm-inv-cancel">Cancel</button><button class="adm-btn-s" id="adm-inv-send">Send Invitation</button></div>
      </div>
    </div>
    <div class="adm-slideout" id="adm-user-slideout"><button class="adm-so-close" id="adm-so-close">\u00d7</button><div id="adm-so-content"></div></div>`;

  let allUsers = [];
  let allInvites = [];

  function renderUsersTable(users) {
    if (!users.length) return '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No users found</div>';
    return `<table class="adm-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Last Active</th><th>Actions</th></tr></thead><tbody>${users.map(u => {
      const roleColors = { super_admin: 'var(--threat-medium)', admin: 'var(--purple)', analyst: 'var(--blue-primary)' };
      const c = roleColors[u.role] || 'var(--blue-primary)';
      return `<tr data-uid="${u.id}"><td><div class="adm-user-cell"><div class="adm-avatar" style="color:${c}">${ini(u.name)}</div><div><div class="adm-user-name">${u.name}</div><div class="adm-user-email">${u.email}</div></div></div></td><td><span class="adm-role-pill ${u.role}">${(u.role || '').replace('_', ' ')}</span></td><td><span class="adm-status-pill ${u.status || 'active'}">${u.status || 'active'}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${u.last_login ? relativeTime(Math.round((Date.now() - new Date(u.last_login).getTime()) / 60000)) : '-'}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${u.last_active_at ? relativeTime(Math.round((Date.now() - new Date(u.last_active_at).getTime()) / 60000)) : '-'}</td><td><button class="adm-action-btn" onclick="event.stopPropagation()">Details</button></td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function filterUsers() {
    const search = (document.getElementById('adm-user-search')?.value || '').toLowerCase();
    const role = document.getElementById('adm-role-filter')?.value || '';
    const status = document.getElementById('adm-status-filter')?.value || '';
    const filtered = allUsers.filter(u => {
      if (search && !u.name?.toLowerCase().includes(search) && !u.email?.toLowerCase().includes(search)) return false;
      if (role && u.role !== role) return false;
      if (status && u.status !== status) return false;
      return true;
    });
    document.getElementById('users-table-wrap').innerHTML = renderUsersTable(filtered);
    bindUserRows();
  }

  function openUserSlideout(userId) {
    const u = allUsers.find(x => x.id === userId);
    if (!u) return;
    const c = { super_admin: 'var(--threat-medium)', admin: 'var(--purple)', analyst: 'var(--blue-primary)' }[u.role] || 'var(--blue-primary)';
    document.getElementById('adm-so-content').innerHTML = `
      <div class="adm-so-header"><div class="adm-so-avatar" style="color:${c}">${ini(u.name)}</div><div><div class="adm-so-name">${u.name}</div><div class="adm-so-email">${u.email}</div></div></div>
      <div class="adm-so-section"><div class="adm-so-sect-title">Account</div>
        <div class="adm-so-row"><span class="adm-so-row-l">Role</span><span class="adm-so-row-v"><span class="adm-role-pill ${u.role}">${(u.role || '').replace('_', ' ')}</span></span></div>
        <div class="adm-so-row"><span class="adm-so-row-l">Status</span><span class="adm-so-row-v"><span class="adm-status-pill ${u.status || 'active'}">${u.status || 'active'}</span></span></div>
        <div class="adm-so-row"><span class="adm-so-row-l">Created</span><span class="adm-so-row-v">${u.created_at ? u.created_at.slice(0, 10) : '-'}</span></div>
        <div class="adm-so-row"><span class="adm-so-row-l">Total logins</span><span class="adm-so-row-v">${u.login_count || 0}</span></div>
        <div class="adm-so-row"><span class="adm-so-row-l">Last login</span><span class="adm-so-row-v">${u.last_login ? relativeTime(Math.round((Date.now() - new Date(u.last_login).getTime()) / 60000)) : '-'}</span></div>
      </div>
      <div class="adm-so-section"><div class="adm-so-sect-title">Active Sessions (${u.sessions?.length || 0})</div>
        ${(u.sessions || []).length ? (u.sessions || []).map(s => `<div class="adm-session-row"><div style="width:6px;height:6px;border-radius:50%;background:var(--positive);flex-shrink:0"></div><div class="adm-sess-device">${s.device || 'Unknown'}<br><span class="adm-sess-ip">${s.ip || ''}</span></div><div class="adm-sess-active">${s.active || '-'}</div><button class="adm-revoke-btn">Revoke</button></div>`).join('') : '<div style="font-size:11px;color:var(--text-tertiary);padding:8px 0">No active sessions</div>'}
      </div>
      <div class="adm-so-section"><div class="adm-so-sect-title">Actions</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="adm-action-btn" onclick="event.stopPropagation()">Change Role</button>
          <button class="adm-action-btn" style="border-color:${u.status==='active'?'rgba(255,59,92,.2)':'rgba(0,229,160,.2)'};color:${u.status==='active'?'var(--negative)':'var(--positive)'}">${u.status==='active'?'Suspend':'Reactivate'}</button>
          <button class="adm-action-btn" onclick="navigate('/admin/audit')">View Audit Trail</button>
        </div>
      </div>`;
    document.getElementById('adm-user-slideout').classList.add('open');
  }

  function bindUserRows() {
    document.querySelectorAll('#users-table-wrap tr[data-uid]').forEach(tr => {
      tr.addEventListener('click', () => openUserSlideout(tr.dataset.uid));
    });
  }

  try {
    const [usersRes, invitesRes] = await Promise.all([
      api('/admin/users').catch(() => null),
      api('/admin/invites').catch(() => null),
    ]);
    allUsers = usersRes?.data?.users || usersRes?.data || [];
    allInvites = invitesRes?.data || [];

    document.getElementById('user-count').textContent = allUsers.length;
    document.getElementById('inv-count').textContent = allInvites.length;
    filterUsers();

    // Invitations
    document.getElementById('inv-list').innerHTML = allInvites.length ? allInvites.map(inv => `
      <div class="adm-inv-row">
        <div class="adm-inv-email">${inv.email}</div>
        <div class="adm-inv-role"><span class="adm-role-pill ${inv.role || 'analyst'}">${inv.role || 'analyst'}</span></div>
        <div class="adm-inv-sent">Sent ${inv.created_at ? relativeTime(Math.round((Date.now() - new Date(inv.created_at).getTime()) / 60000)) : '-'}</div>
        <div class="adm-inv-status"><span class="adm-status-pill ${inv.status === 'pending' ? 'pending-inv' : 'expired'}">${inv.status || 'pending'}</span></div>
        <div style="display:flex;gap:4px"><button class="adm-action-btn">Resend</button><button class="adm-action-btn" style="border-color:rgba(255,59,92,.2);color:var(--negative)">Revoke</button></div>
      </div>`).join('') : '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No pending invitations</div>';
  } catch (err) { showToast(err.message, 'error'); }

  // Search/filter handlers
  document.getElementById('adm-user-search')?.addEventListener('input', filterUsers);
  document.getElementById('adm-role-filter')?.addEventListener('change', filterUsers);
  document.getElementById('adm-status-filter')?.addEventListener('change', filterUsers);

  // Tabs
  el.querySelectorAll('.adm-ptab').forEach(t => t.addEventListener('click', () => {
    el.querySelectorAll('.adm-ptab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    el.querySelectorAll('.adm-ptab-c').forEach(c => c.classList.remove('visible'));
    document.getElementById('tab-' + t.dataset.tab)?.classList.add('visible');
  }));

  // Modal
  document.getElementById('adm-invite-btn')?.addEventListener('click', () => document.getElementById('adm-inv-modal')?.classList.add('vis'));
  document.getElementById('adm-inv-cancel')?.addEventListener('click', () => document.getElementById('adm-inv-modal')?.classList.remove('vis'));
  document.getElementById('adm-inv-modal')?.addEventListener('click', e => { if (e.target.id === 'adm-inv-modal') e.target.classList.remove('vis'); });
  document.getElementById('adm-inv-send')?.addEventListener('click', async () => {
    const email = document.getElementById('adm-inv-email')?.value;
    const role = document.getElementById('adm-inv-role')?.value;
    if (!email) return;
    try {
      await api('/admin/invites', { method: 'POST', body: JSON.stringify({ email, role }) });
      showToast(`Invite sent to ${email}`, 'success');
      document.getElementById('adm-inv-modal')?.classList.remove('vis');
    } catch (err) { showToast(err.message, 'error'); }
  });

  // Slideout close
  document.getElementById('adm-so-close')?.addEventListener('click', () => document.getElementById('adm-user-slideout')?.classList.remove('open'));

  window._viewCleanup = () => { document.getElementById('adm-user-slideout')?.classList.remove('open'); document.getElementById('adm-inv-modal')?.classList.remove('vis'); };
}

// ─── View: Admin Feeds (Step 16) ────────────────────────────
let _feedDetailChart = null;
async function viewAdminFeeds(el) {
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">Feed Management</div>
    <div class="adm-agg" id="adm-feed-agg"></div>
    <div id="adm-feed-list-view" class="visible"><div class="adm-panel" id="adm-feeds-table"><div style="padding:20px;text-align:center;color:var(--text-tertiary)">Loading...</div></div></div>
    <div id="adm-feed-detail-view"><button class="adm-back-btn" id="adm-feed-back">\u2190 Back to Feeds</button><div id="adm-feed-detail-content"></div></div>`;

  let allFeeds = [];

  async function showFeedDetail(feedId) {
    const f = allFeeds.find(x => (x.feed_name || x.feed_id || x.id) === feedId);
    if (!f) return;
    document.getElementById('adm-feed-list-view')?.classList.remove('visible');
    document.getElementById('adm-feed-detail-view')?.classList.add('visible');
    const st = f.health_status || 'healthy';

    // Fetch real pull history from API
    const detailRes = await api(`/feeds/${encodeURIComponent(feedId)}`).catch(() => null);
    const pulls = (detailRes?.data?.pulls || []).map(p => ({
      time: (p.started_at || '').substring(0, 16).replace('T', ' '),
      dur: p.duration_ms != null ? (p.duration_ms / 1000).toFixed(1) + 's' : '-',
      records: p.records_ingested || 0,
      rejected: p.records_rejected || 0,
      status: p.status || 'success',
    }));

    document.getElementById('adm-feed-detail-content').innerHTML = `
      <div class="adm-detail-header"><div class="adm-dh-left"><div class="adm-dh-dot" style="background:${st==='healthy'?'var(--positive)':st==='degraded'?'var(--threat-medium)':'var(--negative)'}"></div><div><div class="adm-dh-name">${f.display_name || f.feed_name}</div><div class="adm-dh-meta">${f.source_url || f.feed_name} \u2014 ${f.schedule_cron || '-'}</div></div></div><div class="adm-dh-right"><button class="adm-action-btn adm-trigger-btn" style="font-size:11px;padding:8px 16px">Trigger Now</button><button class="adm-toggle-btn ${f.enabled !== false ? 'enabled' : 'disabled'}">${f.enabled !== false ? 'Enabled' : 'Disabled'}</button></div></div>
      <div class="adm-grid-2">
        <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Ingestion (7d)</div></div><div class="adm-chart-wrap"><canvas id="adm-feed-detail-chart"></canvas></div></div>
        <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Configuration</div><button class="adm-action-btn" style="font-size:9px">Edit</button></div><div class="adm-padded">
          <div class="adm-config-row"><span class="adm-cfg-label">Schedule (cron)</span><span class="adm-cfg-val">${f.schedule_cron || '*/5 * * * *'}</span></div>
          <div class="adm-config-row"><span class="adm-cfg-label">Source URL</span><span class="adm-cfg-val" style="font-size:9px">${f.source_url || '-'}</span></div>
          <div class="adm-config-row"><span class="adm-cfg-label">API Key</span><span class="adm-cfg-val">${f.api_key_encrypted ? 'Configured \u2713' : 'Not required'}</span></div>
          <div class="adm-config-row"><span class="adm-cfg-label">Rate Limit</span><span class="adm-cfg-val">${f.rate_limit || 60} req/min</span></div>
          <div class="adm-config-row"><span class="adm-cfg-label">Batch Size</span><span class="adm-cfg-val">${f.batch_size || 500} records</span></div>
          <div class="adm-config-row"><span class="adm-cfg-label">Retries</span><span class="adm-cfg-val">${f.retry_count || 3} attempts</span></div>
        </div></div>
      </div>
      <div class="adm-grid-2">
        <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Pull History</div><div class="adm-pbadge">${pulls.length ? 'Last ' + pulls.length : 'No pulls'}</div></div><div style="max-height:300px;overflow-y:auto">${pulls.length ? pulls.map(p => `<div class="adm-pull-row"><span class="adm-pull-time">${p.time}</span><span class="adm-pull-dur">${p.dur}</span><span class="adm-pull-count">${p.records} ingested</span><span class="adm-pull-count" style="color:var(--text-tertiary)">${p.rejected} rejected</span><span class="adm-pull-status ${p.status}">${p.status}</span></div>`).join('') : '<div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:12px">No pull history yet</div>'}</div></div>
        <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Recent Errors</div><div class="adm-pbadge">${f.error_count || 0}</div></div><div class="adm-padded">${f.recent_errors?.length ? f.recent_errors.map(e => `<div class="adm-error-row"><div class="adm-err-time">${e.time || ''}</div><div class="adm-err-msg">${e.message || e.msg || ''}</div></div>`).join('') : '<div style="text-align:center;padding:24px;color:var(--positive);font-size:12px">No errors recorded</div>'}</div></div>
      </div>`;

    // Detail chart — use real pull history data aggregated by day
    if (_feedDetailChart) { _feedDetailChart.destroy(); _feedDetailChart = null; }
    setTimeout(() => {
      const ctx = document.getElementById('adm-feed-detail-chart');
      if (!ctx || typeof Chart === 'undefined') return;
      const dayMap = {};
      const allPulls = detailRes?.data?.pulls || [];
      allPulls.forEach(p => {
        const day = (p.started_at || '').substring(0, 10);
        if (day) dayMap[day] = (dayMap[day] || 0) + (p.records_ingested || 0);
      });
      const labels = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 86400000); return d.toISOString().substring(0, 10); });
      const data = labels.map(d => dayMap[d] || 0);
      const displayLabels = labels.map(d => { const dt = new Date(d); return `${dt.getMonth() + 1}/${dt.getDate()}`; });
      _feedDetailChart = new Chart(ctx, {
        type: 'bar', data: { labels: displayLabels, datasets: [{ data, backgroundColor: 'rgba(255,182,39,0.3)', borderColor: '#ffb627', borderWidth: 1, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(10,16,32,0.95)', borderColor: 'rgba(255,182,39,.3)', borderWidth: 1, titleFont: { family: "'Chakra Petch'", size: 10 }, bodyFont: { family: "'IBM Plex Mono'", size: 10 }, titleColor: '#e8edf5', bodyColor: '#7a8ba8', padding: 8, cornerRadius: 6 } },
          scales: { x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 } }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false } }, y: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 } }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, beginAtZero: true } } }
      });
    }, 50);
  }

  try {
    const res = await api('/feeds').catch(() => null);
    allFeeds = res?.data || [];
    const totalToday = allFeeds.reduce((s, f) => s + (f.records_ingested_today || f.records_today || 0), 0);
    const healthyCount = allFeeds.filter(f => f.health_status === 'healthy' || !f.health_status).length;

    document.getElementById('adm-feed-agg').innerHTML = `
      <div class="adm-ac"><div class="adm-ac-v" style="color:var(--positive)">${healthyCount}/${allFeeds.length}</div><div class="adm-ac-l">Feeds healthy</div></div>
      <div class="adm-ac"><div class="adm-ac-v" style="color:var(--blue-primary)">${totalToday.toLocaleString()}</div><div class="adm-ac-l">Records today</div></div>
      <div class="adm-ac"><div class="adm-ac-v" style="color:var(--positive)">0.2%</div><div class="adm-ac-l">Error rate (24h)</div></div>
      <div class="adm-ac"><div class="adm-ac-v" style="color:var(--text-primary)">2.0s</div><div class="adm-ac-l">Avg pull latency</div></div>`;

    document.getElementById('adm-feeds-table').innerHTML = allFeeds.length ? `<table class="adm-table"><thead><tr><th>Feed</th><th>Status</th><th>Last Pull</th><th>Last Failure</th><th>Records Today</th><th>Avg Duration</th><th>Schedule</th><th>Actions</th></tr></thead><tbody>${allFeeds.map(f => {
      const st = f.health_status || 'healthy';
      return `<tr data-fid="${f.feed_name || f.feed_id || f.id}"><td><div class="adm-feed-name-cell"><div class="adm-feed-dot ${st}"></div>${f.display_name || f.feed_name}</div></td><td><span style="font-family:var(--font-mono);font-size:10px;color:${st==='healthy'?'var(--positive)':st==='degraded'?'var(--threat-medium)':'var(--negative)'};text-transform:capitalize">${st}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${f.last_successful_pull ? relativeTime(Math.round((Date.now() - new Date(f.last_successful_pull).getTime()) / 60000)) : '-'}</td><td style="font-family:var(--font-mono);font-size:10px;color:${f.last_failure ? 'var(--negative)' : 'var(--text-tertiary)'}">${f.last_failure ? relativeTime(Math.round((Date.now() - new Date(f.last_failure).getTime()) / 60000)) : '\u2014'}</td><td style="font-family:var(--font-mono);font-size:12px;font-weight:500">${(f.records_ingested_today || 0).toLocaleString()}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary)">${f.avg_duration_ms ? (f.avg_duration_ms / 1000).toFixed(1) + 's' : '-'}</td><td><span class="adm-schedule-pill">${f.schedule_cron || '-'}</span></td><td><button class="adm-action-btn adm-trigger-btn" onclick="event.stopPropagation()">Trigger Now</button><button class="adm-action-btn" onclick="event.stopPropagation()">Configure</button></td></tr>`;
    }).join('')}</tbody></table>` : '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No feeds configured</div>';

    // Row click to detail
    document.querySelectorAll('#adm-feeds-table tr[data-fid]').forEach(tr => {
      tr.addEventListener('click', () => showFeedDetail(tr.dataset.fid));
    });
  } catch (err) { showToast(err.message, 'error'); }

  document.getElementById('adm-feed-back')?.addEventListener('click', () => {
    document.getElementById('adm-feed-detail-view')?.classList.remove('visible');
    document.getElementById('adm-feed-list-view')?.classList.add('visible');
  });

  window._viewCleanup = () => { if (_feedDetailChart) { _feedDetailChart.destroy(); _feedDetailChart = null; } };
}

// ─── View: Admin Leads (Step 17) ────────────────────────────
const LEAD_STAGES = [
  { key: 'new', label: 'New', color: 'var(--negative)' },
  { key: 'contacted', label: 'Contacted', color: 'var(--threat-high)' },
  { key: 'qualified', label: 'Qualified', color: 'var(--threat-medium)' },
  { key: 'proposal', label: 'Proposal Sent', color: 'var(--blue-primary)' },
  { key: 'converted', label: 'Converted', color: 'var(--positive)' },
  { key: 'closed_lost', label: 'Closed Lost', color: 'var(--text-tertiary)' },
];
function leadScoreColor(s) { return s >= 90 ? 'var(--positive)' : s >= 80 ? 'var(--blue-primary)' : s >= 70 ? 'var(--threat-medium)' : s >= 50 ? 'var(--threat-high)' : 'var(--negative)'; }
function leadGradeColor(g) { return { A: 'var(--positive)', B: 'var(--blue-primary)', C: 'var(--threat-medium)', D: 'var(--threat-high)', F: 'var(--negative)' }[g] || 'var(--text-tertiary)'; }

async function viewAdminLeads(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700">Lead Management</div>
      <div style="display:flex;align-items:center;gap:12px">
        <input class="adm-search" placeholder="Search leads..." id="adm-lead-search">
        <div class="adm-view-toggle"><button class="adm-vt-btn active" data-view="kanban">Kanban</button><button class="adm-vt-btn" data-view="table">Table</button></div>
      </div>
    </div>
    <div id="adm-kanban-view" class="visible"></div>
    <div id="adm-table-view"></div>
    <div class="adm-slideout" id="adm-lead-slideout"><button class="adm-so-close" id="adm-lead-so-close">\u00d7</button><div id="adm-lead-so-content"></div></div>`;

  let allLeads = [];

  function renderKanban() {
    const el = document.getElementById('adm-kanban-view');
    el.innerHTML = '<div class="adm-kanban">' + LEAD_STAGES.map(s => {
      const leads = allLeads.filter(l => l.status === s.key);
      return `<div class="adm-kanban-col"><div class="adm-kanban-header"><span class="adm-kh-title">${s.label}</span><span class="adm-kh-count" style="color:${s.color}">${leads.length}</span></div><div class="adm-kh-bar" style="background:${s.color}"></div><div class="adm-kanban-cards">${leads.map(l => {
        const sc = leadScoreColor(l.trust_score || l.score || 0);
        const gc = leadGradeColor(l.trust_grade || l.grade || 'F');
        return `<div class="adm-lead-card" data-lid="${l.id}"><div class="adm-lc-company">${l.company || l.domain || '-'}</div><div class="adm-lc-contact">${l.contact_name || l.email || ''}</div><div class="adm-lc-domain">${l.domain || ''}</div><div class="adm-lc-bottom"><div class="adm-lc-score"><div class="adm-score-badge" style="background:${sc}20;color:${sc};border:1px solid ${sc}40">${l.trust_score || l.score || 0}</div><span class="adm-grade-badge" style="background:${gc}20;color:${gc}">${l.trust_grade || l.grade || '?'}</span></div><div class="adm-lc-time">${l.created_at ? relativeTime(Math.round((Date.now() - new Date(l.created_at).getTime()) / 60000)) : '-'}</div></div></div>`;
      }).join('')}</div></div>`;
    }).join('') + '</div>';
    el.querySelectorAll('.adm-lead-card').forEach(c => c.addEventListener('click', () => openLeadDetail(c.dataset.lid)));
  }

  function renderTable() {
    const el = document.getElementById('adm-table-view');
    const sorted = [...allLeads].sort((a, b) => LEAD_STAGES.findIndex(s => s.key === a.status) - LEAD_STAGES.findIndex(s => s.key === b.status));
    el.innerHTML = `<div class="adm-panel"><table class="adm-table"><thead><tr><th>Company</th><th>Contact</th><th>Domain</th><th>Score</th><th>Grade</th><th>Status</th><th>Assigned</th><th>Created</th></tr></thead><tbody>${sorted.map(l => {
      const sc = leadScoreColor(l.trust_score || l.score || 0);
      const gc = leadGradeColor(l.trust_grade || l.grade || 'F');
      return `<tr data-lid="${l.id}"><td style="font-weight:500">${l.company || l.domain || '-'}</td><td style="font-size:11px;color:var(--text-secondary)">${l.contact_name || ''}<br><span style="font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary)">${l.email || ''}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${l.domain || ''}</td><td><span style="font-family:var(--font-display);font-weight:700;color:${sc}">${l.trust_score || l.score || 0}</span></td><td><span class="adm-grade-badge" style="background:${gc}20;color:${gc}">${l.trust_grade || l.grade || '?'}</span></td><td><span class="adm-status-pill ${l.status}">${(l.status || '').replace('_', ' ')}</span></td><td style="font-size:11px;color:var(--text-secondary)">${l.assigned_to || 'Unassigned'}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${l.created_at ? relativeTime(Math.round((Date.now() - new Date(l.created_at).getTime()) / 60000)) : '-'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
    el.querySelectorAll('tr[data-lid]').forEach(r => r.addEventListener('click', () => openLeadDetail(r.dataset.lid)));
  }

  function openLeadDetail(id) {
    const l = allLeads.find(x => x.id === id);
    if (!l) return;
    const sc = leadScoreColor(l.trust_score || l.score || 0);
    const gc = leadGradeColor(l.trust_grade || l.grade || 'F');
    const score = l.trust_score || l.score || 0;
    const grade = l.trust_grade || l.grade || '?';
    const risks = l.risk_indicators || [];
    const notes = l.notes || [];
    document.getElementById('adm-lead-so-content').innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        <div class="adm-so-score-ring"><svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-elevated)" stroke-width="5"/><circle cx="40" cy="40" r="34" fill="none" stroke="${sc}" stroke-width="5" stroke-dasharray="213.6" stroke-dashoffset="${213.6 * (1 - score / 100)}" stroke-linecap="round" transform="rotate(-90 40 40)"/></svg><div class="adm-so-score-val" style="color:${sc}">${score}</div></div>
        <div class="adm-so-grade" style="color:${gc}">Grade: ${grade}</div>
      </div>
      <div class="adm-so-section"><div class="adm-so-sect-title">Contact</div>
        <div class="adm-so-row"><span class="adm-so-row-l">Company</span><span class="adm-so-row-v" style="font-weight:500;font-family:var(--font-body)">${l.company || '-'}</span></div>
        <div class="adm-so-row"><span class="adm-so-row-l">Name</span><span class="adm-so-row-v">${l.contact_name || '-'}</span></div>
        <div class="adm-so-row"><span class="adm-so-row-l">Email</span><span class="adm-so-row-v" style="color:var(--blue-primary)">${l.email || '-'}</span></div>
        <div class="adm-so-row"><span class="adm-so-row-l">Phone</span><span class="adm-so-row-v">${l.phone || '\u2014'}</span></div>
        <div class="adm-so-row"><span class="adm-so-row-l">Domain</span><span class="adm-so-row-v">${l.domain || '-'}</span></div>
      </div>
      ${risks.length ? `<div class="adm-so-section"><div class="adm-so-sect-title">Risk Indicators</div><div class="adm-risk-indicators">${risks.map(r => `<span class="adm-risk-ind ${typeof r === 'string' && (r.includes('None') || r.includes('phishing') || r.includes('No ')) ? 'bad' : typeof r === 'string' && (r.includes('Weak') || r.includes('Partial')) ? 'warn' : 'ok'}">${typeof r === 'string' ? r : r.label || ''}</span>`).join('')}</div></div>` : ''}
      <div class="adm-so-section"><div class="adm-so-sect-title">Pipeline</div>
        <div class="adm-so-row"><span class="adm-so-row-l">Status</span><span class="adm-so-row-v"><select class="adm-so-status-sel">${LEAD_STAGES.map(s => `<option value="${s.key}" ${s.key === l.status ? 'selected' : ''}>${s.label}</option>`).join('')}</select></span></div>
        <div class="adm-so-row" style="margin-top:8px"><span class="adm-so-row-l">Assigned to</span><span class="adm-so-row-v">${l.assigned_to || 'Unassigned'}</span></div>
        <div style="margin-top:12px"><button class="adm-btn-sm" style="width:100%;text-align:center;display:block">View Full Assessment Report</button></div>
      </div>
      <div class="adm-so-section"><div class="adm-so-sect-title">Notes</div>
        ${notes.map(n => `<div class="adm-note-item"><div class="adm-note-time">${n.created_at || n.time || ''} \u00b7 <span class="adm-note-by">${n.author || n.by || 'System'}</span></div><div class="adm-note-text">${n.text || n.content || ''}</div></div>`).join('') || '<div style="font-size:11px;color:var(--text-tertiary)">No notes yet</div>'}
        <textarea class="adm-note-input" placeholder="Add a note..."></textarea>
        <button class="adm-btn-sm">Add Note</button>
      </div>`;
    document.getElementById('adm-lead-slideout').classList.add('open');
  }

  try {
    const res = await api('/admin/leads').catch(() => null);
    allLeads = res?.data || [];
    renderKanban();
    renderTable();
  } catch (err) { showToast(err.message, 'error'); }

  // View toggle
  el.querySelectorAll('.adm-vt-btn').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('.adm-vt-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('adm-kanban-view')?.classList.toggle('visible', b.dataset.view === 'kanban');
    document.getElementById('adm-table-view')?.classList.toggle('visible', b.dataset.view === 'table');
  }));

  document.getElementById('adm-lead-so-close')?.addEventListener('click', () => document.getElementById('adm-lead-slideout')?.classList.remove('open'));

  window._viewCleanup = () => { document.getElementById('adm-lead-slideout')?.classList.remove('open'); };
}

// ─── View: Admin API Keys (Step 18a) ────────────────────────
async function viewAdminApiKeys(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700">API Key Management</div>
      <button class="adm-btn adm-btn-primary" id="adm-create-key-btn"><span style="font-size:14px">+</span> Create API Key</button>
    </div>
    <div class="adm-panel" id="adm-keys-table"><div style="padding:20px;text-align:center;color:var(--text-tertiary)">Loading...</div></div>
    <div class="adm-modal-ov" id="adm-key-modal">
      <div class="adm-modal">
        <div class="adm-modal-t" id="adm-key-modal-title">Create API Key</div>
        <div class="adm-modal-s" id="adm-key-modal-desc">Generate a new API key for external integrations.</div>
        <div id="adm-key-modal-body">
          <div class="adm-fg"><label class="adm-fl">Key Name</label><input class="adm-fi" placeholder="e.g., SIEM Integration" id="adm-key-name"></div>
          <div class="adm-fg"><label class="adm-fl">Permissions</label><select class="adm-fsel" id="adm-key-perms"><option value="taxii_read">TAXII Read</option><option value="threat_export">Threat Export</option><option value="webhook_push">Webhook Push</option><option value="full_api">Full API Access</option></select></div>
          <div class="adm-fg"><label class="adm-fl">Rate Limit</label><select class="adm-fsel" id="adm-key-rate"><option value="10">10 req/min</option><option value="60" selected>60 req/min</option><option value="100">100 req/min</option><option value="unlimited">Unlimited</option></select></div>
        </div>
        <div class="adm-macts"><button class="adm-btn-c" id="adm-key-cancel">Cancel</button><button class="adm-btn-s" id="adm-key-create">Create Key</button></div>
      </div>
    </div>`;

  try {
    const res = await api('/admin/api-keys').catch(() => null);
    const keys = res?.data || [];
    document.getElementById('adm-keys-table').innerHTML = keys.length ? `<table class="adm-table"><thead><tr><th>Name</th><th>Permissions</th><th>Rate Limit</th><th>Created By</th><th>Created</th><th>Last Used</th><th>Status</th><th>Actions</th></tr></thead><tbody>${keys.map(k => `<tr><td style="font-weight:500">${k.name || '-'}</td><td>${(k.permissions || []).map(p => `<span class="adm-role-pill analyst" style="margin-right:4px">${p}</span>`).join('') || '-'}</td><td style="font-family:var(--font-mono);font-size:10px">${k.rate_limit || 60} req/min</td><td style="font-size:11px;color:var(--text-secondary)">${k.created_by || '-'}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${k.created_at ? k.created_at.slice(0, 10) : '-'}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${k.last_used_at ? relativeTime(Math.round((Date.now() - new Date(k.last_used_at).getTime()) / 60000)) : 'Never'}</td><td><span class="adm-status-pill ${k.revoked ? 'suspended' : 'active'}">${k.revoked ? 'revoked' : 'active'}</span></td><td><button class="adm-action-btn">Edit</button><button class="adm-action-btn" style="border-color:rgba(255,59,92,.2);color:var(--negative)">Revoke</button></td></tr>`).join('')}</tbody></table>` : '<div style="padding:40px;text-align:center;color:var(--text-tertiary)"><div style="font-size:24px;margin-bottom:8px">No API keys</div><div style="font-size:12px">Create your first API key for external integrations</div></div>';
  } catch (err) { showToast(err.message, 'error'); }

  document.getElementById('adm-create-key-btn')?.addEventListener('click', () => {
    document.getElementById('adm-key-modal-title').textContent = 'Create API Key';
    document.getElementById('adm-key-modal-desc').textContent = 'Generate a new API key for external integrations.';
    document.getElementById('adm-key-modal')?.classList.add('vis');
  });
  document.getElementById('adm-key-cancel')?.addEventListener('click', () => document.getElementById('adm-key-modal')?.classList.remove('vis'));
  document.getElementById('adm-key-modal')?.addEventListener('click', e => { if (e.target.id === 'adm-key-modal') e.target.classList.remove('vis'); });
  document.getElementById('adm-key-create')?.addEventListener('click', async () => {
    const name = document.getElementById('adm-key-name')?.value;
    const permissions = [document.getElementById('adm-key-perms')?.value];
    const rate_limit = document.getElementById('adm-key-rate')?.value;
    if (!name) { showToast('Key name is required', 'error'); return; }
    try {
      const res = await api('/admin/api-keys', { method: 'POST', body: JSON.stringify({ name, permissions, rate_limit: parseInt(rate_limit) || 60 }) });
      const key = res?.data?.raw_key;
      if (key) {
        document.getElementById('adm-key-modal-title').textContent = 'API Key Created';
        document.getElementById('adm-key-modal-desc').textContent = 'Copy this key now. It will not be shown again.';
        document.getElementById('adm-key-modal-body').innerHTML = `<div style="background:var(--bg-panel);border:1px solid var(--blue-border);border-radius:var(--radius);padding:12px;font-family:var(--font-mono);font-size:11px;word-break:break-all;color:var(--positive);margin-bottom:12px">${key}</div><div style="font-size:11px;color:var(--negative)">Warning: This key will not be shown again. Copy it now.</div>`;
        document.getElementById('adm-key-create').style.display = 'none';
      } else {
        showToast('API key created', 'success');
        document.getElementById('adm-key-modal')?.classList.remove('vis');
      }
    } catch (err) { showToast(err.message, 'error'); }
  });

  window._viewCleanup = () => { document.getElementById('adm-key-modal')?.classList.remove('vis'); };
}

// ─── View: Admin Agent Config (Step 18b) ────────────────────
async function viewAdminAgentConfig(el) {
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">Agent Configuration</div>
    <div class="adm-panel" id="adm-agent-config-table"><div style="padding:20px;text-align:center;color:var(--text-tertiary)">Loading...</div></div>
    <div style="margin-top:20px" id="adm-agent-config-detail"></div>
    <div class="adm-panel" style="margin-top:20px">
      <div class="adm-phead"><div class="adm-ptitle">Haiku API Usage</div></div>
      <div class="adm-padded" id="adm-api-usage"><div style="color:var(--text-tertiary)">Loading usage data...</div></div>
    </div>`;

  try {
    const [agentsRes, configRes, usageRes] = await Promise.all([
      api('/agents').catch(() => null),
      api('/admin/agents/config').catch(() => null),
      api('/admin/agents/api-usage').catch(() => null),
    ]);
    const agents = agentsRes?.data || [];
    const configs = configRes?.data || {};
    const usage = usageRes?.data || {};

    document.getElementById('adm-agent-config-table').innerHTML = agents.length ? `<table class="adm-table"><thead><tr><th>Agent</th><th>Status</th><th>Schedule</th><th>Last Run</th><th>Success Rate</th><th>Outputs (24h)</th><th>Actions</th></tr></thead><tbody>${agents.map(a => {
      const meta = AGENT_META[a.name] || AGENT_META[a.agent_id] || { color: '#00d4ff', icon: '\u25cb' };
      const cfg = configs[a.agent_id || a.name] || {};
      const successRate = a.jobs_24h ? ((1 - (a.error_count_24h || 0) / a.jobs_24h) * 100).toFixed(1) : '100.0';
      return `<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="agent-icon ${meta.iconClass || ''}" style="width:28px;height:28px;font-size:14px">${meta.icon}</div><span style="font-weight:500;color:${meta.color}">${a.display_name || a.name}</span></div></td><td><span class="adm-status-pill ${a.status || 'idle'}">${a.status || 'idle'}</span></td><td><span class="adm-schedule-pill">${cfg.schedule_label || a.schedule || cfg.schedule || '-'}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${a.last_run_at ? relativeTime(Math.round((Date.now() - new Date(a.last_run_at).getTime()) / 60000)) : '-'}</td><td style="font-family:var(--font-mono);font-size:10px;color:${parseFloat(successRate) >= 99 ? 'var(--positive)' : 'var(--threat-medium)'}">${successRate}%</td><td style="font-family:var(--font-mono);font-size:12px;font-weight:500">${a.outputs_24h || 0}</td><td><button class="adm-action-btn adm-trigger-btn" data-agent="${a.agent_id || a.name}">Trigger Now</button><button class="adm-action-btn" data-agent="${a.agent_id || a.name}" data-action="config">Edit Config</button></td></tr>`;
    }).join('')}</tbody></table>` : '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No agents configured</div>';

    // API usage section
    const tokens24h = usage.tokens_24h || 0;
    const tokens7d = usage.tokens_7d || 0;
    const tokens30d = usage.tokens_30d || 0;
    document.getElementById('adm-api-usage').innerHTML = `
      <div style="display:flex;gap:24px;margin-bottom:16px">
        <div><div style="font-family:var(--font-display);font-weight:700;font-size:18px;color:var(--blue-primary)">${tokens24h.toLocaleString()}</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Tokens (24h)</div></div>
        <div><div style="font-family:var(--font-display);font-weight:700;font-size:18px">${tokens7d.toLocaleString()}</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Tokens (7d)</div></div>
        <div><div style="font-family:var(--font-display);font-weight:700;font-size:18px">${tokens30d.toLocaleString()}</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Tokens (30d)</div></div>
        <div><div style="font-family:var(--font-display);font-weight:700;font-size:18px;color:var(--positive)">${usage.estimated_cost_30d || '$0.00'}</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Est. cost (30d)</div></div>
      </div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px">Per-agent token breakdown (24h):</div>
      ${agents.map(a => {
        const meta = AGENT_META[a.name] || AGENT_META[a.agent_id] || { color: '#00d4ff' };
        const agentTokens = usage.per_agent?.[a.agent_id || a.name] || 0;
        const pct = tokens24h > 0 ? (agentTokens / tokens24h * 100).toFixed(0) : 0;
        return `<div style="display:flex;align-items:center;gap:10px;padding:4px 0"><span style="font-size:11px;color:${meta.color};min-width:100px">${a.display_name || a.name}</span><div style="flex:1;height:6px;background:var(--bg-elevated);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${meta.color};border-radius:3px"></div></div><span style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);min-width:80px;text-align:right">${agentTokens.toLocaleString()}</span></div>`;
      }).join('')}
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--blue-border)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--text-secondary)">Anthropic API Key</span>
          <span style="font-family:var(--font-mono);font-size:11px;color:${usage.api_key_configured ? 'var(--positive)' : 'var(--negative)'}">${usage.api_key_configured ? 'Configured \u2713' : 'Not set \u26a0'}</span>
        </div>
      </div>`;

    // Trigger Now buttons
    el.querySelectorAll('.adm-trigger-btn[data-agent]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const agentId = btn.dataset.agent;
        try {
          await api(`/admin/agents/${agentId}/trigger`, { method: 'POST' });
          showToast(`Triggered ${agentId}`, 'success');
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Admin Audit Log (Step 18c) ──────────────────────
async function viewAdminAudit(el) {
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700">Audit Log</div>
      <a href="/api/v1/admin/audit/export?since=${new Date(Date.now() - 30 * 86400000).toISOString()}" class="adm-btn adm-btn-primary" target="_blank">Export CSV</a>
    </div>
    <div class="adm-controls" style="margin-bottom:16px">
      <select class="adm-sel" id="adm-audit-user"><option value="">All Users</option></select>
      <select class="adm-sel" id="adm-audit-action"><option value="">All Actions</option><option value="login">Login</option><option value="login_failed">Login Failed</option><option value="role_change">Role Change</option><option value="invitation">Invitation</option><option value="feed_config">Feed Config</option><option value="config_change">Config Change</option><option value="data_export">Data Export</option></select>
      <select class="adm-sel" id="adm-audit-outcome"><option value="">All Outcomes</option><option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option></select>
    </div>
    <div class="adm-panel" id="adm-audit-table"><div style="padding:20px;text-align:center;color:var(--text-tertiary)">Loading...</div></div>
    <div class="adm-panel" id="adm-audit-detail" style="margin-top:16px;display:none"><div class="adm-phead"><div class="adm-ptitle">Event Details</div><button class="adm-action-btn" id="adm-audit-detail-close">Close</button></div><div class="adm-padded" id="adm-audit-detail-content"></div></div>`;

  let allEntries = [];
  let allUsers = [];

  function renderAuditTable(entries) {
    if (!entries.length) return '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No audit entries found</div>';
    return `<table class="adm-table"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Resource</th><th>Resource ID</th><th>Outcome</th><th>IP Address</th></tr></thead><tbody>${entries.map((e, i) => `<tr data-aidx="${i}" style="cursor:pointer"><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${e.timestamp ? e.timestamp.slice(0, 19).replace('T', ' ') : '-'}</td><td style="font-size:11px">${e.user_name || e.user_email || (e.user_id ? e.user_id.slice(0, 8) : 'system')}</td><td style="font-size:11px">${e.action || '-'}</td><td style="font-family:var(--font-mono);font-size:10px">${e.resource_type || '-'}</td><td style="font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary)">${e.resource_id ? e.resource_id.slice(0, 12) : '-'}</td><td><span class="adm-ev-outcome ${e.outcome || 'success'}">${e.outcome || 'success'}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${e.ip_address || '-'}</td></tr>`).join('')}</tbody></table>`;
  }

  function filterAudit() {
    const user = document.getElementById('adm-audit-user')?.value || '';
    const action = document.getElementById('adm-audit-action')?.value || '';
    const outcome = document.getElementById('adm-audit-outcome')?.value || '';
    const filtered = allEntries.filter(e => {
      if (user && e.user_id !== user) return false;
      if (action && e.action !== action) return false;
      if (outcome && e.outcome !== outcome) return false;
      return true;
    });
    document.getElementById('adm-audit-table').innerHTML = renderAuditTable(filtered);
    bindAuditRows();
  }

  function bindAuditRows() {
    document.querySelectorAll('#adm-audit-table tr[data-aidx]').forEach(tr => {
      tr.addEventListener('click', () => {
        const idx = parseInt(tr.dataset.aidx);
        const entry = allEntries[idx];
        if (!entry) return;
        const detailPanel = document.getElementById('adm-audit-detail');
        detailPanel.style.display = 'block';
        document.getElementById('adm-audit-detail-content').innerHTML = `<pre style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto">${JSON.stringify(entry.details || entry, null, 2)}</pre>`;
      });
    });
  }

  try {
    const [auditRes, usersRes] = await Promise.all([
      api('/admin/audit?limit=50').catch(() => null),
      api('/admin/users').catch(() => null),
    ]);
    allEntries = auditRes?.data || [];
    allUsers = usersRes?.data?.users || usersRes?.data || [];

    // Populate user filter
    const userSel = document.getElementById('adm-audit-user');
    allUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name || u.email;
      userSel?.appendChild(opt);
    });

    document.getElementById('adm-audit-table').innerHTML = renderAuditTable(allEntries);
    bindAuditRows();
  } catch (err) { showToast(err.message, 'error'); }

  document.getElementById('adm-audit-user')?.addEventListener('change', filterAudit);
  document.getElementById('adm-audit-action')?.addEventListener('change', filterAudit);
  document.getElementById('adm-audit-outcome')?.addEventListener('change', filterAudit);
  document.getElementById('adm-audit-detail-close')?.addEventListener('click', () => {
    document.getElementById('adm-audit-detail').style.display = 'none';
  });
}

// ─── Init ───────────────────────────────────────────────────
render();
