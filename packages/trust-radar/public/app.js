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
      navigate('/');
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
  { path: '/',                     view: viewObservatory,     auth: true },
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
    const isObservatory = pathname === '/';
    if (isObservatory) {
      app.innerHTML = `<div>${renderTopbar()}<div class="observatory-layout"><div class="main" id="view"></div><div class="obs-sidebar" id="obs-sidebar"></div></div></div><div class="toast-container" id="toasts"></div>`;
    } else {
      app.innerHTML = `<div class="${isAdmin ? 'admin-mode' : ''}">${renderTopbar()}` +
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
    { href: '/', label: 'Observatory' },
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
          <a href="/">${u?.email || ''}</a>
          <a href="/"><span class="role-pill ${u?.role}">${u?.role || ''}</span></a>
          ${isAdmin ? '<a href="/admin">Admin Panel</a>' : ''}
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

  // UTC clock
  const clockEl = document.getElementById('utc-clock');
  const clockInterval = setInterval(() => {
    clockEl.textContent = new Date().toISOString().slice(11, 19) + ' UTC';
  }, 1000);
  clockEl.textContent = new Date().toISOString().slice(11, 19) + ' UTC';

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

async function viewProvidersHub(el) {
  el.innerHTML = `
    <div class="agg-stats" id="prov-agg"></div>
    <div class="sub-tabs" id="prov-tabs">
      <button class="sub-tab active" data-tab="worst">Worst Actors<span class="tab-count" id="tc-worst">--</span></button>
      <button class="sub-tab" data-tab="improving">Improving<span class="tab-count" id="tc-impr">--</span></button>
      <button class="sub-tab" data-tab="all">All Providers<span class="tab-count" id="tc-allp">--</span></button>
      <div class="sub-tab-actions">${renderPeriodSelector('7d', 'prov-period')}</div>
    </div>
    <div style="padding:20px 24px" id="prov-content">Loading...</div>`;

  // Aggregate stats
  api('/providers/stats').then(res => {
    const s = res?.data || {};
    document.getElementById('prov-agg').innerHTML = `
      <div class="agg-card"><div class="agg-val">${s.total_tracked || 0}</div><div class="agg-lbl">Providers Tracked</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--negative)">${s.worst_this_week || 0}</div><div class="agg-lbl">Worst This Week</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--positive)">${s.most_improved || 0}</div><div class="agg-lbl">Most Improved</div></div>
      <div class="agg-card"><div class="agg-val">${s.avg_response_time || '-'}</div><div class="agg-lbl">Avg Response Time</div></div>`;
  }).catch(() => {});

  const loadWorst = async (period) => {
    const res = await api(`/providers/worst?period=${period}&limit=20`).catch(() => null);
    const providers = res?.data || [];
    const el = document.getElementById('tc-worst');
    if (el) el.textContent = providers.length;
    const content = document.getElementById('prov-content');
    if (!providers.length) { content.innerHTML = '<div class="empty-state"><div class="message">No provider data</div></div>'; return; }
    content.innerHTML = `<div class="provider-grid">${providers.map((p, i) => {
      const trendDir = (p.trend_7d_pct || 0) >= 0 ? 'up' : 'down';
      const repColor = (p.reputation_score || 50) < 30 ? 'var(--negative)' : (p.reputation_score || 50) < 60 ? 'var(--threat-medium)' : 'var(--positive)';
      return `<a href="/providers/${encodeURIComponent(p.provider_id || p.name)}" class="provider-card">
        <div class="provider-card-top">
          <div class="provider-rank ${i < 3 ? 'top' : ''}">${i + 1}</div>
          <div class="provider-icon"><span style="font-size:14px">${p.country_code ? String.fromCodePoint(...[...p.country_code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))) : '\ud83c\udf10'}</span><span class="pico-asn">${p.asn || ''}</span></div>
          <div class="provider-card-info"><div class="provider-card-name">${p.name}</div><div class="provider-card-asn">${p.asn || ''} ${p.country ? '\u00b7 ' + p.country : ''}</div></div>
        </div>
        <div class="provider-card-stats">
          <div><div class="provider-threat-val" style="color:var(--negative)">${p.threat_count || 0}</div><div class="provider-threat-label">active threats</div></div>
          <div class="brand-trend">${renderSparkline(p.sparkline || [])}<span class="trend-pct ${trendDir}">${trendDir === 'up' ? '+' : ''}${p.trend_7d_pct || 0}%</span></div>
        </div>
        <div class="provider-card-footer">
          <div class="rep-gauge"><div class="rep-bar"><div class="rep-fill" style="width:${p.reputation_score || 0}%;background:${repColor}"></div></div><span class="rep-val" style="color:${repColor}">${p.reputation_score || 0}/100</span></div>
          ${p.top_brand_targeted ? `<span style="font-size:10px;color:var(--text-secondary)">${p.top_brand_targeted}</span>` : ''}
        </div>
      </a>`;
    }).join('')}</div>`;
  };

  const loadImproving = async (period) => {
    const res = await api(`/providers/improving?period=${period}&limit=10`).catch(() => null);
    const providers = res?.data || [];
    const el = document.getElementById('tc-impr');
    if (el) el.textContent = providers.length;
    const content = document.getElementById('prov-content');
    if (!providers.length) { content.innerHTML = '<div class="empty-state"><div class="message">No improving providers detected</div></div>'; return; }
    content.innerHTML = `<div class="provider-grid">${providers.map((p, i) => `<a href="/providers/${encodeURIComponent(p.provider_id || p.name)}" class="provider-card improving">
      <div class="provider-card-top">
        <div class="provider-rank">${i + 1}</div>
        <div class="provider-icon"><span style="font-size:14px">\ud83c\udf10</span><span class="pico-asn">${p.asn || ''}</span></div>
        <div class="provider-card-info"><div class="provider-card-name">${p.name}</div><div class="provider-card-asn">${p.asn || ''}</div></div>
      </div>
      <div class="provider-card-stats">
        <div><div class="provider-threat-val">${p.threat_count || 0}</div><div class="provider-threat-label">active threats</div></div>
        <div class="brand-trend"><span class="trend-pct down">${p.trend_7d_pct || 0}%</span></div>
      </div>
    </a>`).join('')}</div>`;
  };

  const loadAllProviders = async () => {
    const res = await api('/providers?limit=50').catch(() => null);
    const providers = res?.data || [];
    const el = document.getElementById('tc-allp');
    if (el) el.textContent = providers.length;
    document.getElementById('prov-content').innerHTML = renderDataTable(
      [
        { key: 'name', label: 'Provider', render: (v, r) => `<a href="/providers/${encodeURIComponent(r.provider_id || v)}">${v}</a>` },
        { key: 'asn', label: 'ASN', className: 'mono' },
        { key: 'country', label: 'Country' },
        { key: 'threat_count', label: 'Threats', className: 'mono' },
        { key: 'reputation_score', label: 'Reputation', className: 'mono' },
      ],
      providers,
      { emptyMessage: 'No providers' }
    );
  };

  await loadWorst('7d');

  document.getElementById('prov-tabs').addEventListener('click', async (e) => {
    const tab = e.target.closest('.sub-tab');
    if (!tab || !tab.dataset.tab) return;
    document.querySelectorAll('#prov-tabs .sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    _provSubTab = tab.dataset.tab;
    document.getElementById('prov-content').innerHTML = 'Loading...';
    if (_provSubTab === 'worst') await loadWorst('7d');
    else if (_provSubTab === 'improving') await loadImproving('7d');
    else await loadAllProviders();
  });
}

// ─── View: Provider Detail (Step 10) ────────────────────────
async function viewProviderDetail(el, params) {
  el.innerHTML = 'Loading...';
  try {
    const [provRes, threatsRes, brandsRes, timelineRes, locationsRes] = await Promise.all([
      api(`/providers/${encodeURIComponent(params.id)}`),
      api(`/providers/${encodeURIComponent(params.id)}/threats?limit=15`).catch(() => null),
      api(`/providers/${encodeURIComponent(params.id)}/brands`).catch(() => null),
      api(`/providers/${encodeURIComponent(params.id)}/timeline?period=90d`).catch(() => null),
      api(`/providers/${encodeURIComponent(params.id)}/locations`).catch(() => null),
    ]);
    const p = provRes?.data;
    if (!p) { el.innerHTML = '<div class="empty-state"><div class="message">Provider not found</div></div>'; return; }

    const threats = threatsRes?.data || [];
    const brands = brandsRes?.data || [];
    const maxBrand = brands[0]?.count || brands[0]?.threat_count || 1;
    const repScore = p.reputation_score || 50;
    const repColor = repScore < 30 ? 'var(--negative)' : repScore < 60 ? 'var(--threat-medium)' : 'var(--positive)';

    el.innerHTML = `
      <a href="/providers" class="back-link">\u2190 Back to Providers</a>
      <div class="detail-header">
        <div class="detail-header-icon" style="font-size:28px">\ud83c\udf10</div>
        <div class="detail-header-meta">
          <div class="detail-header-title">${p.name} ${p.asn ? `<span style="font-family:var(--font-mono);font-size:12px;padding:3px 10px;border-radius:20px;background:var(--bg-elevated);color:var(--text-secondary);border:1px solid var(--blue-border)">${p.asn}</span>` : ''}</div>
          <div class="detail-header-sub">${p.country || ''}</div>
          <div class="detail-header-stats">
            <div class="header-stat"><div class="header-stat-val">${p.threat_count || p.total_threats || 0}</div><div class="header-stat-label">Active Threats</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:${(p.trend_7d_pct||0) >= 0 ? 'var(--negative)' : 'var(--positive)'}">${(p.trend_7d_pct||0) >= 0 ? '+' : ''}${p.trend_7d_pct || 0}%</div><div class="header-stat-label">7d Trend</div></div>
            <div class="header-stat"><div class="header-stat-val">${p.trend_30d_pct || 0}%</div><div class="header-stat-label">30d Trend</div></div>
            <div class="header-stat"><div class="header-stat-val">${p.avg_response_time_hours || '-'}h</div><div class="header-stat-label">Avg Response</div></div>
          </div>
        </div>
        <div class="trust-score-ring" style="border-color:${repColor}"><div style="text-align:center"><div class="score-val" style="color:${repColor}">${repScore}</div><div class="score-grade">REP</div></div></div>
      </div>
      <div class="detail-grid">
        <div>
          ${renderPanel('Hosted Threats', threats.length, renderDataTable(
            [
              { key: 'malicious_domain', label: 'URL', className: 'domain' },
              { key: 'threat_type', label: 'Type', render: v => `<span class="threat-pill ${v}">${v}</span>` },
              { key: 'brand_name', label: 'Target Brand' },
              { key: 'created_at', label: 'First Seen', className: 'mono', render: v => v?.slice(0, 10) },
              { key: 'status', label: 'Status', render: v => `<span class="badge-status ${v}">${v}</span>` },
            ],
            threats,
            { emptyMessage: 'No threats hosted' }
          ))}
        </div>
        <div>
          <div class="panel" style="margin-bottom:16px"><div class="phead">Threat Locations</div><div class="panel-body"><div id="prov-mini-map" class="mini-map"></div></div></div>
          ${renderPanel('Brand Breakdown', null, brands.length ?
            brands.map(b => renderBarRow(b.name || b.brand_name, b.count || b.threat_count, maxBrand)).join('') :
            '<div class="empty-state"><div class="message">No brands</div></div>'
          )}
        </div>
      </div>
      <div class="chart-wrap"><div class="chart-head"><div class="chart-title">Trend Timeline</div></div><canvas id="prov-timeline-chart"></canvas></div>`;

    // Mini map
    const locations = locationsRes?.data || [];
    if (locations.length > 0) {
      const miniMap = L.map('prov-mini-map', { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView([20, 0], 1.5);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd' }).addTo(miniMap);
      locations.forEach(loc => {
        L.circleMarker([loc.lat, loc.lng], { radius: Math.max(5, (loc.count || 1) * 2), color: '#ff6b35', fillColor: '#ff6b35', fillOpacity: 0.5, weight: 1 }).addTo(miniMap);
      });
    }

    // Timeline chart
    const timeline = timelineRes?.data || {};
    if (timeline.labels?.length && typeof Chart !== 'undefined') {
      new Chart(document.getElementById('prov-timeline-chart'), {
        type: 'line',
        data: { labels: timeline.labels, datasets: [{ data: timeline.values, borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.1)', fill: true, tension: 0.3, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#4a5a73', font: { size: 9 } }, grid: { color: 'rgba(0,212,255,0.06)' } }, y: { ticks: { color: '#4a5a73', font: { size: 9 } }, grid: { color: 'rgba(0,212,255,0.06)' } } } }
      });
    }
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Campaigns Hub (Step 11) ──────────────────────────
async function viewCampaignsHub(el) {
  el.innerHTML = `
    <div class="agg-stats" id="camp-agg"></div>
    <div class="sub-tabs" id="camp-tabs">
      <button class="sub-tab active" data-tab="active">Active<span class="tab-count" id="tc-active">--</span></button>
      <button class="sub-tab" data-tab="dormant">Dormant<span class="tab-count" id="tc-dormant">--</span></button>
      <button class="sub-tab" data-tab="disrupted">Disrupted<span class="tab-count" id="tc-disrupted">--</span></button>
    </div>
    <div style="padding:20px 24px" id="camp-content">Loading...</div>`;

  // Stats
  api('/campaigns/stats').then(res => {
    const s = res?.data || {};
    document.getElementById('camp-agg').innerHTML = `
      <div class="agg-card"><div class="agg-val" style="color:var(--negative)">${s.active_count || 0}</div><div class="agg-lbl">Active Campaigns</div></div>
      <div class="agg-card"><div class="agg-val">${s.dormant_count || 0}</div><div class="agg-lbl">Dormant</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--positive)">${s.disrupted_count || 0}</div><div class="agg-lbl">Disrupted</div></div>
      <div class="agg-card"><div class="agg-val">${s.total_threats_in_campaigns || 0}</div><div class="agg-lbl">Total Threats</div><div class="agg-sub">${s.brands_affected || 0} brands affected</div></div>`;
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
    const statusClassMap = { active: 'active-status', dormant: 'dormant-status', disrupted: 'disrupted-status' };
    content.innerHTML = `<div class="campaign-grid">${campaigns.map(c => {
      const sevClass = c.severity || 'medium';
      const brandIcons = (c.brands || c.brand_breakdown || []).slice(0, 3).map(b =>
        `<div class="brand-ico">${((b.name || b.brand_name || '').slice(0, 2)).toUpperCase()}</div>`
      ).join('');
      return `<a href="/campaigns/${c.id}" class="campaign-card">
        <div class="campaign-card-top">
          <div class="campaign-name">${c.name}</div>
          <span class="sev ${sevClass}">${sevClass}</span>
        </div>
        <div class="campaign-status ${statusClassMap[c.status] || ''}">${c.status}</div>
        ${c.description ? `<div class="campaign-desc">${c.description}</div>` : ''}
        <div class="campaign-metrics">
          <div class="campaign-metric"><div class="campaign-metric-val">${c.threat_count || 0}</div><div class="campaign-metric-label">Threats</div></div>
          <div class="campaign-metric"><div class="campaign-metric-val">${c.brand_count || (c.brand_breakdown || []).length || 0}</div><div class="campaign-metric-label">Brands</div></div>
          <div class="campaign-metric"><div class="campaign-metric-val">${c.provider_count || (c.provider_breakdown || []).length || 0}</div><div class="campaign-metric-label">Providers</div></div>
        </div>
        <div class="campaign-card-footer">
          <div class="brand-icons">${brandIcons}</div>
          <div class="campaign-dates">${c.first_seen ? c.first_seen.slice(0, 10) : ''} \u2192 ${c.last_seen ? c.last_seen.slice(0, 10) : 'now'}</div>
        </div>
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
    const statusClassMap = { active: 'active-status', dormant: 'dormant-status', disrupted: 'disrupted-status' };

    el.innerHTML = `
      <a href="/campaigns" class="back-link">\u2190 Back to Campaigns</a>
      <div class="detail-header">
        <div class="detail-header-meta">
          <div class="detail-header-title">${c.name} <span class="campaign-status ${statusClassMap[c.status] || ''}">${c.status}</span> <span class="sev ${c.severity || 'medium'}">${c.severity || 'medium'}</span></div>
          <div class="detail-header-sub">${c.first_seen ? c.first_seen.slice(0, 10) : ''} \u2013 ${c.last_seen ? c.last_seen.slice(0, 10) : 'present'}</div>
          <div class="detail-header-stats">
            <div class="header-stat"><div class="header-stat-val">${c.threat_count || 0}</div><div class="header-stat-label">Threats</div></div>
            <div class="header-stat"><div class="header-stat-val">${brands.length || c.brand_count || 0}</div><div class="header-stat-label">Brands</div></div>
            <div class="header-stat"><div class="header-stat-val">${(infra.providers || []).length || c.provider_count || 0}</div><div class="header-stat-label">Providers</div></div>
          </div>
        </div>
      </div>
      ${c.ai_assessment || c.description ? `<div class="ai-panel">
        <div class="ai-head"><div class="ai-dot"></div><span class="ai-agent">Strategist Analysis</span></div>
        <div class="ai-body">${c.ai_assessment || c.description || ''}</div>
        ${c.methodology ? `<div class="ai-tags">${(Array.isArray(c.methodology) ? c.methodology : [c.methodology]).map(m => `<span class="ai-tag">${m}</span>`).join('')}</div>` : ''}
      </div>` : ''}
      ${(infra.domains || infra.ips || infra.providers) ? `<div class="infra-panel">
        <div class="phead">Infrastructure Map</div>
        <div class="infra-body" id="infra-graph"></div>
      </div>` : ''}
      <div class="detail-grid">
        <div>
          ${renderPanel('Campaign Threats', threats.length, renderDataTable(
            [
              { key: 'malicious_domain', label: 'URL', className: 'domain' },
              { key: 'threat_type', label: 'Type', render: v => `<span class="threat-pill ${v}">${v}</span>` },
              { key: 'brand_name', label: 'Brand' },
              { key: 'hosting_provider', label: 'Provider' },
              { key: 'status', label: 'Status', render: v => `<span class="badge-status ${v}">${v}</span>` },
            ],
            threats,
            { emptyMessage: 'No threats' }
          ))}
        </div>
        <div>
          ${renderPanel('Targeted Brands', null, brands.length ?
            brands.map(b => renderBarRow(b.name || b.brand_name, b.count || b.threat_count, maxBrand)).join('') :
            '<div class="empty-state"><div class="message">No brands</div></div>'
          )}
          ${renderPanel('Infrastructure Stats', null, `
            <div style="padding:4px 0;display:flex;justify-content:space-between;font-size:11px;border-bottom:1px solid rgba(0,212,255,0.05)"><span style="color:var(--text-secondary)">Domains</span><span style="font-family:var(--font-mono)">${(infra.domains || []).length}</span></div>
            <div style="padding:4px 0;display:flex;justify-content:space-between;font-size:11px;border-bottom:1px solid rgba(0,212,255,0.05)"><span style="color:var(--text-secondary)">IP Addresses</span><span style="font-family:var(--font-mono)">${(infra.ips || []).length}</span></div>
            <div style="padding:4px 0;display:flex;justify-content:space-between;font-size:11px;border-bottom:1px solid rgba(0,212,255,0.05)"><span style="color:var(--text-secondary)">Providers</span><span style="font-family:var(--font-mono)">${(infra.providers || []).length}</span></div>
            <div style="padding:4px 0;display:flex;justify-content:space-between;font-size:11px"><span style="color:var(--text-secondary)">Registrars</span><span style="font-family:var(--font-mono)">${(infra.registrars || []).length}</span></div>
          `)}
        </div>
      </div>
      <div class="chart-wrap"><div class="chart-head"><div class="chart-title">Activity Timeline</div></div><canvas id="camp-timeline-chart"></canvas></div>`;

    // Infrastructure graph (simple visualization)
    const graphEl = document.getElementById('infra-graph');
    if (graphEl) {
      const domains = (infra.domains || []).slice(0, 6);
      const ips = (infra.ips || []).slice(0, 4);
      const providers = (infra.providers || []).slice(0, 3);
      const registrars = (infra.registrars || []).slice(0, 2);
      let nodes = '';
      const totalItems = domains.length + ips.length + providers.length + registrars.length;
      if (totalItems > 0) {
        domains.forEach((d, i) => { nodes += `<div class="inode" style="left:${10 + (i * 14)}%;top:20%"><div class="inode-box domain-node">${typeof d === 'string' ? d : d.domain || d.name}</div><div class="inode-label">Domain</div></div>`; });
        ips.forEach((ip, i) => { nodes += `<div class="inode" style="left:${15 + (i * 18)}%;top:50%"><div class="inode-box ip-node">${typeof ip === 'string' ? ip : ip.ip || ip.address}</div><div class="inode-label">IP</div></div>`; });
        providers.forEach((p, i) => { nodes += `<div class="inode" style="left:${20 + (i * 22)}%;top:75%"><div class="inode-box provider-node">${typeof p === 'string' ? p : p.name || p.provider}</div><div class="inode-label">Provider</div></div>`; });
        registrars.forEach((r, i) => { nodes += `<div class="inode" style="left:${70 + (i * 15)}%;top:30%"><div class="inode-box registrar-node">${typeof r === 'string' ? r : r.name || r.registrar}</div><div class="inode-label">Registrar</div></div>`; });
      } else {
        nodes = '<div class="empty-state"><div class="message">No infrastructure data</div></div>';
      }
      graphEl.innerHTML = nodes;
    }

    // Timeline chart
    const timeline = timelineRes?.data || {};
    if (timeline.labels?.length && typeof Chart !== 'undefined') {
      new Chart(document.getElementById('camp-timeline-chart'), {
        type: 'bar',
        data: { labels: timeline.labels, datasets: [{ data: timeline.values, backgroundColor: 'rgba(255,59,92,0.4)', borderColor: '#ff3b5c', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#4a5a73', font: { size: 9 } }, grid: { color: 'rgba(0,212,255,0.06)' } }, y: { ticks: { color: '#4a5a73', font: { size: 9 } }, grid: { color: 'rgba(0,212,255,0.06)' } } } }
      });
    }
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
  observer: { icon: '\u25cb', iconClass: 'observer', color: '#b388ff', role: 'Trend Analysis & Intelligence Synthesis' },
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
      <div class="agg-card"><div class="agg-val">${agents.length}</div><div class="agg-lbl">Total Agents</div><div class="agg-sub">${activeCount} active</div></div>
      <div class="agg-card"><div class="agg-val">${totalJobs}</div><div class="agg-lbl">Jobs (24h)</div></div>
      <div class="agg-card"><div class="agg-val">${totalOutputs}</div><div class="agg-lbl">Outputs (24h)</div></div>
      <div class="agg-card"><div class="agg-val" style="color:${totalErrors > 0 ? 'var(--negative)' : 'var(--positive)'}">${totalErrors}</div><div class="agg-lbl">Errors (24h)</div></div>`;

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
            <div class="dhs"><div class="dhs-val">${agent?.jobs_24h || 0}</div><div class="dhs-label">Jobs</div></div>
            <div class="dhs"><div class="dhs-val">${agent?.outputs_24h || 0}</div><div class="dhs-label">Outputs</div></div>
            <div class="dhs"><div class="dhs-val">${agent?.avg_duration_ms ? Math.round(agent.avg_duration_ms / 1000) + 's' : '-'}</div><div class="dhs-label">Avg Duration</div></div>
          </div>
        </div>
        <div class="agent-detail-grid">
          <div class="agent-detail-left">
            <div class="dp-head"><span class="dp-title">Output Feed</span><span class="dp-badge">${outputs.length}</span></div>
            <div class="output-feed">${outputs.length ? outputs.map(o => `<div class="output-item">
              <div class="output-meta">
                <span class="output-type ${o.type || ''}">${o.type || 'output'}</span>
                ${o.severity ? `<span class="output-sev ${o.severity}">${o.severity}</span>` : ''}
                <span class="output-time">${o.created_at ? o.created_at.slice(11, 16) : ''}</span>
              </div>
              <div class="output-text">${o.summary || o.summary_text || ''}</div>
              ${o.related_entities?.length ? `<div class="output-entities">${o.related_entities.map(e => `<span class="output-entity">${typeof e === 'string' ? e : e.name || ''}</span>`).join('')}</div>` : ''}
            </div>`).join('') : '<div class="empty-state"><div class="message">No recent outputs</div></div>'}</div>
          </div>
          <div>
            <div class="dp-head"><span class="dp-title">Health (24h)</span></div>
            <div class="health-chart-area"><canvas id="agent-health-chart"></canvas></div>
          </div>
        </div>`;

      // Health chart
      if (_agentHealthChart) { _agentHealthChart.destroy(); _agentHealthChart = null; }
      const runs = health.runs || [];
      const errors = health.errors || [];
      const outputCounts = health.outputs || health.avg_duration_trend || [];
      if (runs.length && typeof Chart !== 'undefined') {
        const labels = Array.from({ length: runs.length }, (_, i) => `${i}h`);
        _agentHealthChart = new Chart(document.getElementById('agent-health-chart'), {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Duration (ms)', data: runs, backgroundColor: meta.color + '66', borderColor: meta.color, borderWidth: 1, yAxisID: 'y' },
              { label: 'Errors', data: errors, type: 'scatter', pointBackgroundColor: '#ff3b5c', pointRadius: errors.map(e => e > 0 ? 6 : 0), yAxisID: 'y', showLine: false },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#4a5a73', font: { size: 8 } }, grid: { color: 'rgba(0,212,255,0.06)' } },
              y: { ticks: { color: '#4a5a73', font: { size: 8 } }, grid: { color: 'rgba(0,212,255,0.06)' } }
            }
          }
        });
      }
    });

  } catch (err) { showToast(err.message, 'error'); }

  window._viewCleanup = () => { if (_agentHealthChart) { _agentHealthChart.destroy(); _agentHealthChart = null; } _selectedAgent = null; };
}

// ─── View: Admin Dashboard ──────────────────────────────────
async function viewAdmin(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Admin Dashboard</h1></div>
    <div class="stat-row" id="admin-stats"></div>
    <div class="grid-3">
      <a href="/admin/users" class="panel" style="text-decoration:none"><div class="phead">User Management</div><div class="panel-body" style="color:var(--text-secondary)">Manage users, roles, invitations</div></a>
      <a href="/admin/feeds" class="panel" style="text-decoration:none"><div class="phead">Feed Management</div><div class="panel-body" style="color:var(--text-secondary)">Monitor feed health and triggers</div></a>
      <a href="/admin/audit" class="panel" style="text-decoration:none"><div class="phead">Audit Log</div><div class="panel-body" style="color:var(--text-secondary)">View all system activity</div></a>
    </div>`;
  try {
    const res = await api('/admin/stats');
    const d = res?.data || {};
    document.getElementById('admin-stats').innerHTML = [
      renderStatCard('\ud83d\udc65', 'brands', d.users?.total || 0, 'Total Users'),
      renderStatCard('\u2b55', 'positive', d.users?.active || 0, 'Active Users'),
      renderStatCard('\u26a0', 'threats', d.threats?.total || 0, 'Total Threats'),
      renderStatCard('\ud83d\udd12', 'campaigns', d.sessions?.active || 0, 'Active Sessions'),
    ].join('');
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Admin Users ──────────────────────────────────────
async function viewAdminUsers(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">User Management</h1><button class="btn btn-primary" id="invite-btn">Invite User</button></div><div id="users-content">Loading...</div>`;
  try {
    const res = await api('/admin/users');
    document.getElementById('users-content').innerHTML = renderDataTable(
      [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email', className: 'mono' },
        { key: 'role', label: 'Role', render: v => `<span class="role-pill ${v}">${v}</span>` },
        { key: 'status', label: 'Status', render: v => `<span class="badge-status ${v}">${v}</span>` },
        { key: 'last_login', label: 'Last Login', className: 'mono', render: v => v?.slice(0, 10) || 'Never' },
      ],
      res?.data?.users || [],
    );
  } catch (err) { showToast(err.message, 'error'); }

  document.getElementById('invite-btn')?.addEventListener('click', () => {
    showModal('Invite User', `
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="invite-email" type="email" placeholder="user@company.com"></div>
      <div class="form-group"><label class="form-label">Role</label><select class="form-input form-select" id="invite-role"><option value="analyst">Analyst</option><option value="admin">Admin</option></select></div>
    `, async (overlay) => {
      const email = overlay.querySelector('#invite-email')?.value;
      const role = overlay.querySelector('#invite-role')?.value;
      if (!email) return;
      try {
        await api('/admin/invites', { method: 'POST', body: JSON.stringify({ email, role }) });
        showToast(`Invite sent to ${email}`, 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });
  });
}

// ─── View: Admin Feeds ──────────────────────────────────────
async function viewAdminFeeds(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Feed Management</h1></div><div id="feeds-content">Loading...</div>`;
  try {
    const res = await api('/feeds');
    document.getElementById('feeds-content').innerHTML = renderDataTable(
      [
        { key: 'name', label: 'Feed' },
        { key: 'enabled', label: 'Status', render: v => `<span class="badge-status ${v ? 'active' : 'down'}">${v ? 'enabled' : 'disabled'}</span>` },
        { key: 'health_status', label: 'Health', render: v => `<span class="badge-status ${v || 'active'}">${v || 'healthy'}</span>` },
        { key: 'last_run_at', label: 'Last Run', className: 'mono', render: v => v?.slice(0, 16) || '-' },
      ],
      res?.data || [],
    );
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Admin Leads ──────────────────────────────────────
async function viewAdminLeads(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Lead Management</h1></div><div id="leads-content">Loading...</div>`;
  try {
    const res = await api('/admin/leads');
    document.getElementById('leads-content').innerHTML = renderDataTable(
      [
        { key: 'company', label: 'Company' },
        { key: 'email', label: 'Email', className: 'mono' },
        { key: 'status', label: 'Status', render: v => `<span class="badge-status ${v}">${v}</span>` },
        { key: 'created_at', label: 'Date', className: 'mono', render: v => v?.slice(0, 10) },
      ],
      res?.data || [],
    );
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Admin Audit Log ──────────────────────────────────
async function viewAdminAudit(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Audit Log</h1><a href="/api/admin/audit/export?since=${new Date(Date.now()-30*86400000).toISOString()}" class="btn btn-secondary" target="_blank">Export CSV</a></div><div id="audit-content">Loading...</div>`;
  try {
    const res = await api('/admin/audit?limit=50');
    document.getElementById('audit-content').innerHTML = renderDataTable(
      [
        { key: 'timestamp', label: 'Time', className: 'mono', render: v => v?.slice(0, 19) },
        { key: 'user_id', label: 'User', className: 'mono', render: v => v?.slice(0, 8) || 'system' },
        { key: 'action', label: 'Action' },
        { key: 'resource_type', label: 'Resource' },
        { key: 'outcome', label: 'Outcome', render: v => `<span class="badge-status ${v === 'success' ? 'active' : v === 'denied' ? 'down' : 'degraded'}">${v}</span>` },
        { key: 'ip_address', label: 'IP', className: 'mono' },
      ],
      res?.data || [],
    );
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── Init ───────────────────────────────────────────────────
render();
