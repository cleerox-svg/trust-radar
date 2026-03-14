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

  // Render view
  if (route.auth) {
    const isAdmin = pathname.startsWith('/admin');
    app.innerHTML = `<div class="${isAdmin ? 'admin-mode' : ''}">${renderTopbar()}` +
      `<div class="main" id="view"></div></div><div class="toast-container" id="toasts"></div>`;
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
    <div class="modal-header">${title}<button class="modal-close">&times;</button></div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="confirm">Confirm</button>
    </div>
  </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.modal-close') || e.target.dataset.action === 'cancel') overlay.remove();
    if (e.target.dataset.action === 'confirm' && onConfirm) { onConfirm(overlay); overlay.remove(); }
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

// ─── View: Observatory ──────────────────────────────────────────
async function viewObservatory(el) {
  el.innerHTML = '<div class="stat-row" id="obs-stats"></div><div class="grid-2" id="obs-panels"></div>';

  try {
    const [overview, topBrands, insights] = await Promise.all([
      api('/dashboard/overview'),
      api('/dashboard/top-brands?limit=5'),
      api('/insights/latest?limit=5'),
    ]);
    const d = overview?.data || {};
    document.getElementById('obs-stats').innerHTML = [
      renderStatCard('\u26a0', 'threats', d.active_threats || 0, 'Active Threats', null),
      renderStatCard('\u2b50', 'brands', d.brands_tracked || 0, 'Brands Tracked', null),
      renderStatCard('\ud83c\udfe2', 'providers', d.providers_tracked || 0, 'Providers', null),
      renderStatCard('\ud83c\udfaf', 'campaigns', d.active_campaigns || 0, 'Campaigns', null),
    ].join('');

    // Feed health status
    const fc = document.getElementById('feed-count');
    if (fc) fc.textContent = d.feed_health?.active || 0;

    const brands = (topBrands?.data || []).map(b => renderBarRow(b.name, b.threat_count, topBrands.data[0]?.threat_count || 1)).join('');
    const insightList = (insights?.data || []).map(i =>
      `<div style="margin-bottom:10px;padding:8px;background:var(--bg-panel);border-radius:var(--radius)">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span class="sev ${i.severity}">${i.severity}</span>
          <span class="mono" style="font-size:10px;color:var(--text-tertiary)">${i.agent_name}</span>
        </div>
        <div style="font-size:12px">${i.summary_text || ''}</div>
      </div>`
    ).join('') || '<div class="empty-state"><div class="message">No insights yet</div></div>';

    document.getElementById('obs-panels').innerHTML =
      renderPanel('Top Targeted Brands', topBrands?.data?.length, brands) +
      renderPanel('Latest Insights', insights?.data?.length, insightList);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── View: Brands Hub ───────────────────────────────────────────
async function viewBrandsHub(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Brands</h1></div><div id="brands-content">Loading...</div>`;
  try {
    const res = await api('/brands?limit=50');
    const brands = res?.data || [];
    document.getElementById('brands-content').innerHTML = renderDataTable(
      [
        { key: 'name', label: 'Brand', render: (v, r) => `<a href="/brands/${r.id}">${v}</a>` },
        { key: 'sector', label: 'Sector' },
        { key: 'threat_count', label: 'Threats', className: 'mono' },
        { key: 'last_threat_seen', label: 'Last Threat', className: 'mono', render: v => v ? v.slice(0, 10) : '-' },
      ],
      brands,
      { emptyMessage: 'No brands detected yet' }
    );
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Brand Detail ─────────────────────────────────────────
async function viewBrandDetail(el, params) {
  el.innerHTML = 'Loading...';
  try {
    const res = await api(`/brands/${params.id}`);
    const b = res?.data;
    if (!b) { el.innerHTML = '<div class="empty-state"><div class="message">Brand not found</div></div>'; return; }

    const stats = b.stats || {};
    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">${b.name}</h1><span class="mono" style="color:var(--text-tertiary)">${b.canonical_domain}</span></div>
      <div class="stat-row">
        ${renderStatCard('\u26a0', 'threats', stats.total_threats || 0, 'Total Threats')}
        ${renderStatCard('\u2b55', 'brands', stats.active_threats || 0, 'Active')}
        ${renderStatCard('\ud83c\udfa3', 'campaigns', stats.phishing || 0, 'Phishing')}
        ${renderStatCard('\ud83d\udd0d', 'providers', stats.typosquatting || 0, 'Typosquat')}
      </div>
      <div class="grid-sidebar">
        <div id="brand-threats"></div>
        <div>${renderPanel('Top Providers', null, (b.top_providers || []).map(p => renderBarRow(p.provider_id, p.count, b.top_providers[0]?.count || 1)).join('') || 'None')}</div>
      </div>`;

    const threats = await api(`/brands/${params.id}/threats?limit=20`);
    document.getElementById('brand-threats').innerHTML = renderPanel('Threats', threats?.total, renderDataTable(
      [
        { key: 'malicious_domain', label: 'Domain', className: 'domain' },
        { key: 'threat_type', label: 'Type', render: v => `<span class="threat-pill ${v}">${v}</span>` },
        { key: 'severity', label: 'Severity', render: v => `<span class="sev ${v}">${v}</span>` },
        { key: 'status', label: 'Status', render: v => `<span class="badge-status ${v}">${v}</span>` },
        { key: 'created_at', label: 'Detected', className: 'mono', render: v => v?.slice(0, 10) },
      ],
      threats?.data || [],
    ));
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Providers Hub ────────────────────────────────────────
async function viewProvidersHub(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Providers</h1></div><div id="prov-content">Loading...</div>`;
  try {
    const res = await api('/providers/stats?period=30d');
    const providers = res?.data?.providers || [];
    document.getElementById('prov-content').innerHTML = renderDataTable(
      [
        { key: 'provider_name', label: 'Provider', render: (v) => `<a href="/providers/${encodeURIComponent(v)}">${v}</a>` },
        { key: 'threat_count', label: 'Threats', className: 'mono' },
        { key: 'critical_count', label: 'Critical', className: 'mono' },
        { key: 'trend_direction', label: 'Trend', render: (v, r) => `<span class="stat-trend ${v === 'up' ? 'up' : 'down'}">${r.trend_pct || 0}%</span>` },
      ],
      providers,
    );
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Provider Detail ──────────────────────────────────────
async function viewProviderDetail(el, params) {
  el.innerHTML = 'Loading...';
  try {
    const res = await api(`/providers/${encodeURIComponent(params.id)}`);
    const p = res?.data;
    if (!p) { el.innerHTML = '<div class="empty-state"><div class="message">Provider not found</div></div>'; return; }

    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">${p.name}</h1></div>
      <div class="stat-row">
        ${renderStatCard('\u26a0', 'threats', p.total_threats || 0, 'Total Threats')}
        ${renderStatCard('\u2b55', 'brands', p.active_threats || 0, 'Active')}
        ${renderStatCard('\u2b50', 'campaigns', p.brands_targeted || 0, 'Brands Targeted')}
      </div>
      <div class="grid-sidebar">
        <div id="prov-threats"></div>
        <div>
          ${renderPanel('Brands Targeted', null, (p.brand_breakdown || []).map(b => renderBarRow(b.brand_name || b.brand_id, b.count, p.brand_breakdown[0]?.count || 1)).join('') || 'None')}
          ${renderPanel('Attack Types', null, (p.type_breakdown || []).map(t => renderBarRow(t.threat_type, t.count, p.type_breakdown[0]?.count || 1)).join('') || 'None')}
        </div>
      </div>`;

    const threats = await api(`/providers/${encodeURIComponent(params.id)}/threats?limit=20`);
    document.getElementById('prov-threats').innerHTML = renderPanel('Threats', null, renderDataTable(
      [
        { key: 'malicious_domain', label: 'Domain', className: 'domain' },
        { key: 'threat_type', label: 'Type', render: v => `<span class="threat-pill ${v}">${v}</span>` },
        { key: 'severity', label: 'Severity', render: v => `<span class="sev ${v}">${v}</span>` },
        { key: 'brand_name', label: 'Brand' },
      ],
      threats?.data || [],
    ));
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Campaigns Hub ────────────────────────────────────────
async function viewCampaignsHub(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Campaigns</h1></div>
    ${renderFilterPills([{value:'active',label:'Active'},{value:'dormant',label:'Dormant'},{value:'disrupted',label:'Disrupted'}], ['active'], 'camp-filters')}
    <div id="camp-content">Loading...</div>`;

  const loadCampaigns = async (status) => {
    const res = await api(`/campaigns?status=${status}`);
    document.getElementById('camp-content').innerHTML = renderDataTable(
      [
        { key: 'name', label: 'Campaign', render: (v, r) => `<a href="/campaigns/${r.id}">${v}</a>` },
        { key: 'status', label: 'Status', render: v => `<span class="badge-status ${v}">${v}</span>` },
        { key: 'threat_count', label: 'Threats', className: 'mono' },
        { key: 'first_seen', label: 'First Seen', className: 'mono', render: v => v?.slice(0, 10) },
        { key: 'last_seen', label: 'Last Active', className: 'mono', render: v => v?.slice(0, 10) },
      ],
      res?.data || [],
    );
  };
  await loadCampaigns('active');

  document.getElementById('camp-filters')?.addEventListener('click', async (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;
    document.querySelectorAll('#camp-filters .filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    await loadCampaigns(pill.dataset.value);
  });
}

// ─── View: Campaign Detail ──────────────────────────────────────
async function viewCampaignDetail(el, params) {
  el.innerHTML = 'Loading...';
  try {
    const res = await api(`/campaigns/${params.id}`);
    const c = res?.data;
    if (!c) { el.innerHTML = '<div class="empty-state"><div class="message">Campaign not found</div></div>'; return; }

    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">${c.name}</h1><span class="badge-status ${c.status}">${c.status}</span></div>
      <div class="stat-row">
        ${renderStatCard('\u26a0', 'threats', c.threat_count || 0, 'Threats')}
        ${renderStatCard('\u2b50', 'brands', c.brand_breakdown?.length || 0, 'Brands')}
        ${renderStatCard('\ud83c\udfe2', 'providers', c.provider_breakdown?.length || 0, 'Providers')}
      </div>
      <div class="grid-sidebar">
        <div id="camp-threats"></div>
        <div>
          ${renderPanel('Targeted Brands', null, (c.brand_breakdown || []).map(b => renderBarRow(b.brand_name || b.brand_id, b.count, c.brand_breakdown[0]?.count || 1)).join('') || 'None')}
          ${renderPanel('Infrastructure', null, (c.provider_breakdown || []).map(p => renderBarRow(p.provider_id, p.count, c.provider_breakdown[0]?.count || 1)).join('') || 'None')}
        </div>
      </div>`;

    const threats = await api(`/campaigns/${params.id}/threats?limit=20`);
    document.getElementById('camp-threats').innerHTML = renderPanel('Threats', threats?.data?.length, renderDataTable(
      [
        { key: 'malicious_domain', label: 'Domain', className: 'domain' },
        { key: 'threat_type', label: 'Type', render: v => `<span class="threat-pill ${v}">${v}</span>` },
        { key: 'brand_name', label: 'Brand' },
        { key: 'severity', label: 'Severity', render: v => `<span class="sev ${v}">${v}</span>` },
      ],
      threats?.data || [],
    ));
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Trends ───────────────────────────────────────────────
async function viewTrends(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">Trends</h1>${renderPeriodSelector('30d', 'trend-period')}</div>
    <div class="grid-2" id="trend-panels"></div>`;

  const loadTrends = async (period) => {
    const [volume, types, tlds] = await Promise.all([
      api(`/trends/volume?period=${period}`),
      api(`/trends/types?period=${period}`),
      api(`/trends/tlds?period=${period}`),
    ]);
    const volData = (volume?.data || []).map(d => d.total);
    const tldRows = (tlds?.data || []).map(t => renderBarRow(t.tld, t.count, tlds.data[0]?.count || 1)).join('');

    document.getElementById('trend-panels').innerHTML =
      renderPanel('Threat Volume', null, `<div style="text-align:center;padding:20px">${renderSparkline(volData, 300, 60)}</div>`) +
      renderPanel('TLD Distribution', null, tldRows || 'No data') +
      renderPanel('Attack Types', null, renderDataTable(
        [{ key: 'threat_type', label: 'Type' }, { key: 'count', label: 'Count', className: 'mono' }],
        aggregateByField(types?.data || [], 'threat_type', 'count'),
      ));
  };
  await loadTrends('30d');

  document.getElementById('trend-period')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.period-btn');
    if (!btn) return;
    document.querySelectorAll('#trend-period .period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await loadTrends(btn.dataset.period);
  });
}

function aggregateByField(rows, field, countField) {
  const map = {};
  for (const r of rows) {
    const key = r[field];
    map[key] = (map[key] || 0) + (r[countField] || 0);
  }
  return Object.entries(map).map(([k, v]) => ({ [field]: k, count: v })).sort((a, b) => b.count - a.count);
}

// ─── View: Agents ───────────────────────────────────────────────
async function viewAgents(el) {
  el.innerHTML = `<div class="page-header"><h1 class="page-title">AI Agents</h1></div><div id="agents-content">Loading...</div>`;
  try {
    const [agents, stats] = await Promise.all([api('/agents'), api('/agents/stats')]);
    const list = agents?.data || [];
    document.getElementById('agents-content').innerHTML = renderDataTable(
      [
        { key: 'name', label: 'Agent' },
        { key: 'type', label: 'Type' },
        { key: 'trigger', label: 'Trigger' },
        { key: 'status', label: 'Status', render: v => `<span class="badge-status ${v === 'active' ? 'active' : 'down'}">${v || 'active'}</span>` },
      ],
      list,
      { emptyMessage: 'No agents configured' }
    );
  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Admin Dashboard ──────────────────────────────────────
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

// ─── View: Admin Users ──────────────────────────────────────────
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
        const res = await api('/admin/invites', { method: 'POST', body: JSON.stringify({ email, role }) });
        showToast(`Invite sent to ${email}`, 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });
  });
}

// ─── View: Admin Feeds ──────────────────────────────────────────
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

// ─── View: Admin Leads ──────────────────────────────────────────
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

// ─── View: Admin Audit Log ──────────────────────────────────────
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

// ─── Init ───────────────────────────────────────────────────────
render();
