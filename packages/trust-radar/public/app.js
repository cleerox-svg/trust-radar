// Trust Radar v2 — SPA Shell (Router, API Client, Shared Components)

// ─── Auth State ─────────────────────────────────────────────────
let accessToken = null;
let currentUser = null;

function getAccessToken() { return accessToken; }
function setAccessToken(token) { accessToken = token; }
function isAuthenticated() { return !!accessToken; }

// Unregister any existing service worker and clear caches
// (SW was caching stale files across deploys, breaking mobile)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
}

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

let _refreshAttempts = 0;
let _refreshInFlight = null;
let _refreshInvalidLogged = false;

async function refreshToken() {
  // Prevent concurrent refresh calls — reuse in-flight promise
  if (_refreshInFlight) return _refreshInFlight;

  _refreshAttempts++;
  if (_refreshAttempts > 2) {
    console.warn('[auth] refresh failed 3+ times, clearing auth');
    clearAuth();
    return false;
  }

  _refreshInFlight = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        // On 401 from refresh — clear token, don't retry
        if (res.status === 401) {
          if (!_refreshInvalidLogged) {
            console.warn('[auth] refresh_invalid — session expired');
            _refreshInvalidLogged = true;
          }
          clearAuth();
          return false;
        }
        return false;
      }
      const data = await res.json();
      if (data.success && data.data?.token) {
        setAccessToken(data.data.token);
        currentUser = data.data.user;
        _refreshAttempts = 0; // Reset on success
        _refreshInvalidLogged = false;
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

function clearAuth() {
  accessToken = null;
  currentUser = null;
  localStorage.removeItem('imprsn8_token');
  localStorage.removeItem('imprsn8_user');
}

// ─── Router ─────────────────────────────────────────────────────
const routes = [
  { path: '/',                      view: viewRootRedirect,    auth: false },
  { path: '/observatory',           view: viewObservatory,     auth: true },
  { path: '/brands',               view: viewBrandsHub,       auth: true },
  { path: '/brands/:id',           view: viewBrandDetail,     auth: true },
  { path: '/report/:id',           view: viewBrandReport,     auth: true },
  { path: '/social',               view: () => { navigate('/brands?tab=watchlist'); }, auth: true },
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
  { path: '/admin/spam-trap',     view: viewAdminSpamTrap,   auth: true, admin: true },
  { path: '/login',                view: viewLogin,           auth: false },
  { path: '/auth/callback',        view: viewAuthCallback,    auth: false },
  { path: '/auth/error',           view: viewAuthError,       auth: false },
  { path: '/public-preview',       view: viewPublicSite,      auth: false },
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

// Scroll active tab into view for mobile horizontal-scrollable tab rows
function scrollActiveTabIntoView(containerSel) {
  requestAnimationFrame(() => {
    const container = document.querySelector(containerSel);
    if (!container) return;
    const active = container.querySelector('.active');
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
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
      app.innerHTML = `<div class="observatory-view">${renderTopbar()}<div class="observatory-layout"><div class="main" id="view"></div><div class="obs-sidebar" id="obs-sidebar"></div></div></div><div class="toast-container" id="toasts"></div>`;
    } else if (isAdmin) {
      app.innerHTML = `<div class="admin-mode">${renderAdminTopbar(pathname)}<div class="main" id="view"></div></div><div class="toast-container" id="toasts"></div>`;
    } else {
      app.innerHTML = `<div>${renderTopbar()}` +
        `<div class="main" id="view"></div></div><div class="toast-container" id="toasts"></div>`;
    }
    route.view(document.getElementById('view'), params);
    // Append footer at bottom of main content
    const mainEl = document.querySelector('.main');
    if (mainEl) mainEl.insertAdjacentHTML('beforeend', '<div style="text-align:center;padding:16px;border-top:1px solid rgba(0,212,255,.15);font-size:10px;color:#4a5a73">Operated by <span style="color:#7a8ba8">LRX Enterprises Inc.</span> \u{1F1E8}\u{1F1E6} Canadian owned and operated</div>');
    startFeedStatusUpdater();
    startNotificationPoller();
    _initUserMenu();
    // Auto-scroll active nav pill into view on mobile
    requestAnimationFrame(() => {
      const activeNav = document.querySelector('.topbar-nav a.active') || document.querySelector('.admin-nav-pills .admin-np.active');
      if (activeNav) activeNav.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  } else {
    app.innerHTML = '<div id="view"></div><div class="toast-container" id="toasts"></div>';
    route.view(document.getElementById('view'), params);
  }
}

// ─── Global feed status updater ─────────────────────────────────
async function updateFeedStatus() {
  try {
    const res = await api('/feeds').catch(() => null);
    const feeds = res?.data || [];
    const fc = document.getElementById('feed-count');
    const fd = document.getElementById('feed-dot');
    if (!fc) return;
    const enabled = feeds.filter(f => f.enabled !== false);
    const issues = enabled.filter(f => f.health_status === 'degraded' || f.health_status === 'down');
    fc.textContent = enabled.length;
    if (issues.length > 0) {
      if (fd) fd.style.background = 'var(--threat-medium)';
      fc.parentElement.title = `${issues.length} feed${issues.length > 1 ? 's' : ''} with issues`;
    } else {
      if (fd) fd.style.background = 'var(--positive)';
      fc.parentElement.title = 'All feeds healthy';
    }
  } catch (_) { /* silent */ }
}
// Update feed status on page load and every 30s
let _feedStatusInterval = null;
function startFeedStatusUpdater() {
  if (_feedStatusInterval) clearInterval(_feedStatusInterval);
  updateFeedStatus();
  _feedStatusInterval = setInterval(updateFeedStatus, 30000);
}

// ─── Notification System ─────────────────────────────────────────
let _notifUnreadCount = 0;
let _notifPrevCount = 0;
let _notifInterval = null;
let _notifDropdownOpen = false;

function startNotificationPoller() {
  if (_notifInterval) clearInterval(_notifInterval);
  _pollUnreadCount();
  _notifInterval = setInterval(_pollUnreadCount, 30000);
}

async function _pollUnreadCount() {
  try {
    const res = await api('/notifications/unread-count').catch(() => null);
    if (!res?.success) return;
    const newCount = res.count ?? 0;
    const increased = newCount > _notifUnreadCount;
    _notifPrevCount = _notifUnreadCount;
    _notifUnreadCount = newCount;
    _updateBellBadge();
    if (increased) {
      _animateBell();
      _maybeBrowserNotify();
    }
  } catch (_) { /* silent */ }
}

function _updateBellBadge() {
  document.querySelectorAll('.notif-badge').forEach(badge => {
    if (_notifUnreadCount === 0) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'flex';
      badge.textContent = _notifUnreadCount > 99 ? '99+' : String(_notifUnreadCount);
    }
  });
}

function _animateBell() {
  document.querySelectorAll('.notif-bell-icon').forEach(bell => {
    bell.classList.remove('bell-shake');
    void bell.offsetWidth; // force reflow
    bell.classList.add('bell-shake');
  });
}

async function _maybeBrowserNotify() {
  try {
    const prefs = await api('/notifications/preferences').catch(() => null);
    if (!prefs?.data?.browser_notifications) return;
    if (Notification.permission !== 'granted') return;
    const res = await api('/notifications?unread=true&limit=1').catch(() => null);
    if (res?.data?.length) {
      const n = res.data[0];
      const notif = new Notification(n.title, { body: n.message, icon: '/favicon.svg' });
      notif.onclick = () => { window.focus(); if (n.link) navigate(n.link); };
    }
  } catch (_) { /* silent */ }
}

async function toggleNotifDropdown(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;
  _notifDropdownOpen = !_notifDropdownOpen;
  if (_notifDropdownOpen) {
    dropdown.classList.add('open');
    await _loadNotifications();
  } else {
    dropdown.classList.remove('open');
  }
}

async function _loadNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-tertiary)">Loading...</div>';
  try {
    const res = await api('/notifications?limit=30');
    const items = res?.data || [];
    if (items.length === 0) {
      list.innerHTML = `<div class="notif-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <div style="margin-top:8px">No notifications yet</div>
      </div>`;
      return;
    }
    list.innerHTML = items.map(n => {
      const severityColor = { critical: '#ff3b5c', high: '#ff6b35', medium: '#ffb627', low: '#00d4ff', info: '#7a8ba8' }[n.severity] || '#7a8ba8';
      const readClass = n.read_at ? 'notif-read' : 'notif-unread';
      const timeAgo = _timeAgo(n.created_at);
      return `<div class="notif-item ${readClass}" onclick="markNotifRead('${n.id}', '${n.link || ''}')">
        <div class="notif-dot" style="background:${severityColor}"></div>
        <div class="notif-body">
          <div class="notif-title">${_escHtml(n.title)}</div>
          <div class="notif-msg">${_escHtml(n.message)}</div>
          <div class="notif-time">${timeAgo}</div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--negative)">Failed to load</div>';
  }
}

async function markNotifRead(id, link) {
  try { await api(`/notifications/${id}/read`, { method: 'POST' }); } catch (_) {}
  _notifDropdownOpen = false;
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.remove('open');
  if (link) navigate(link);
  _pollUnreadCount();
}

async function markAllNotifRead() {
  try { await api('/notifications/read-all', { method: 'POST' }); } catch (_) {}
  _notifUnreadCount = 0;
  _updateBellBadge();
  await _loadNotifications();
}

function openNotifPreferences(e) {
  if (e) e.stopPropagation();
  _notifDropdownOpen = false;
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown) dropdown.classList.remove('open');
  _showPreferencesModal();
}

async function _showPreferencesModal() {
  // Remove existing modal
  document.getElementById('notif-prefs-modal')?.remove();

  const prefs = await api('/notifications/preferences').catch(() => ({ data: {} }));
  const d = prefs?.data || {};

  const types = [
    { key: 'brand_threat', label: 'Brand threats' },
    { key: 'campaign_escalation', label: 'Campaign escalation' },
    { key: 'feed_health', label: 'Feed health alerts' },
    { key: 'intelligence_digest', label: 'Intelligence digest' },
    { key: 'agent_milestone', label: 'Agent milestones' },
  ];

  const modal = document.createElement('div');
  modal.id = 'notif-prefs-modal';
  modal.className = 'notif-modal-overlay';
  modal.innerHTML = `<div class="notif-modal">
    <div class="notif-modal-header">
      <span>Notification Settings</span>
      <button class="notif-modal-close" onclick="document.getElementById('notif-prefs-modal').remove()">&times;</button>
    </div>
    <div class="notif-modal-body">
      ${types.map(t => `<div class="notif-pref-row">
        <span>${t.label}</span>
        <label class="notif-toggle"><input type="checkbox" data-pref="${t.key}" ${d[t.key] !== false ? 'checked' : ''}><span class="notif-toggle-slider"></span></label>
      </div>`).join('')}
      <div class="notif-pref-divider"></div>
      <div class="notif-pref-row">
        <span>Browser notifications</span>
        <label class="notif-toggle"><input type="checkbox" data-pref="browser_notifications" ${d.browser_notifications ? 'checked' : ''} onchange="handleBrowserNotifToggle(this)"><span class="notif-toggle-slider"></span></label>
      </div>
      <div class="notif-pref-row">
        <span>Push notifications</span>
        <label class="notif-toggle"><input type="checkbox" data-pref="push_notifications" ${d.push_notifications ? 'checked' : ''}><span class="notif-toggle-slider"></span></label>
      </div>
    </div>
    <div class="notif-modal-footer">
      <button class="btn-primary" onclick="saveNotifPreferences()">Save</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function handleBrowserNotifToggle(checkbox) {
  if (checkbox.checked) {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') checkbox.checked = false;
  }
}

async function saveNotifPreferences() {
  const body = {};
  document.querySelectorAll('#notif-prefs-modal [data-pref]').forEach(el => {
    body[el.dataset.pref] = el.checked;
  });
  try {
    await api('/notifications/preferences', { method: 'PUT', body: JSON.stringify(body) });
    document.getElementById('notif-prefs-modal')?.remove();
    showToast('Preferences saved', 'success');
  } catch (err) {
    showToast('Failed to save preferences', 'error');
  }
}

function _timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr + 'Z').getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function _escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderNotifBell() {
  return `<div class="notif-bell-wrapper" onclick="toggleNotifDropdown(event)">
    <svg class="notif-bell-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
    <span class="notif-badge" style="display:none">0</span>
    <div class="notif-dropdown" id="notif-dropdown">
      <div class="notif-dropdown-header">
        <span>Notifications</span>
        <a href="#" onclick="event.preventDefault(); event.stopPropagation(); markAllNotifRead();">Mark all read</a>
      </div>
      <div class="notif-dropdown-list" id="notif-list"></div>
      <div class="notif-dropdown-footer">
        <a href="#" onclick="event.preventDefault(); openNotifPreferences(event);">Notification Settings</a>
      </div>
    </div>
  </div>`;
}

// Close dropdown on outside click
document.addEventListener('click', () => {
  if (_notifDropdownOpen) {
    _notifDropdownOpen = false;
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  }
});

// ─── Expose functions used by inline handlers to global scope ───
// (app.js is loaded as a module, so functions are not global by default)
window.navigate = navigate;
window.toggleNotifDropdown = toggleNotifDropdown;
window.markNotifRead = markNotifRead;
window.markAllNotifRead = markAllNotifRead;
window.openNotifPreferences = openNotifPreferences;
window.saveNotifPreferences = saveNotifPreferences;
window.handleBrowserNotifToggle = handleBrowserNotifToggle;

// ─── Shared Components ──────────────────────────────────────────

function getUserInitials(u) {
  if (u?.name) {
    const parts = u.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (u?.email) return u.email[0].toUpperCase();
  return 'U';
}

function _initUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  // Click avatar to toggle
  menu.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
  // Click outside to close
  document.addEventListener('click', () => menu.classList.remove('open'));
  // Escape key to close
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.classList.remove('open'); });
  // Theme toggle
  const themeRow = document.getElementById('theme-toggle-row');
  if (themeRow) {
    themeRow.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('tr-theme', next); } catch {}
    });
  }
  // Apply saved theme
  try {
    const saved = localStorage.getItem('tr-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch {}
}

function renderTopbar() {
  const u = currentUser;
  const initials = getUserInitials(u);
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
    <div class="topbar-logo"><svg class="tr-logo-mark" width="200" height="32" viewBox="0 0 200 32"><g transform="translate(16,16)"><path d="M-2.2,-14 A14,14 0 0,1 8.2,-11.3" stroke="#00d4ff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M10.4,-8.2 A14,14 0 0,1 13.8,2.6" stroke="#00e5a0" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M12.6,6 A14,14 0 0,1 2.6,13.8" stroke="#ffb627" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-0.6,14 A14,14 0 0,1 -12.6,6" stroke="#ff3b5c" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-13.8,2.6 A14,14 0 0,1 -6.7,-12.3" stroke="#b388ff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite"/><line x1="0" y1="0" x2="0" y2="-13" stroke="#00d4ff" stroke-width=".8" opacity=".35"/></g><circle cx="2.7" cy="-8.6" r="1.5" fill="#00d4ff" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="0.3s" repeatCount="indefinite"/></circle><circle cx="8.6" cy="0" r="1.5" fill="#00e5a0" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="1.5s" repeatCount="indefinite"/></circle><circle cx="2.7" cy="8.6" r="1.5" fill="#ffb627" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="2.7s" repeatCount="indefinite"/></circle><circle cx="-6.9" cy="5" r="1.5" fill="#ff3b5c" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="3.9s" repeatCount="indefinite"/></circle><circle cx="-6.9" cy="-5" r="1.5" fill="#b388ff" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="5.1s" repeatCount="indefinite"/></circle><circle cx="0" cy="0" r="2.5" fill="rgba(0,212,255,.08)" stroke="#00d4ff" stroke-width="1"/><circle cx="0" cy="0" r="1.2" fill="#00d4ff"/></g><text class="tr-wordmark" x="36" y="21" font-family="'Chakra Petch',sans-serif" font-weight="700" font-size="16" letter-spacing="2" fill="#e8edf5">TRUST <tspan fill="#00d4ff">RADAR</tspan></text></svg></div>
    <nav class="topbar-nav">
      ${navItems.map(n => `<a href="${n.href}" class="${path === n.href || (n.href !== '/' && path.startsWith(n.href)) ? 'active' : ''}">${n.label}</a>`).join('')}
    </nav>
    <div class="topbar-right">
      <div class="feed-status"><span class="dot" id="feed-dot"></span><span id="feed-count">--</span> feeds</div>
      <div class="live-tag">LIVE</div>
      ${renderNotifBell()}
      ${isAdmin ? '<a href="/admin" class="admin-gear" onclick="event.preventDefault(); navigate(\'/admin\');" title="Admin Panel">\u2699</a>' : ''}
      <div class="user-menu" id="user-menu">
        <div class="user-avatar">${initials}</div>
        <div class="user-dropdown" style="right:0">
          <div style="padding:8px 12px;font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);border-bottom:1px solid var(--blue-border);pointer-events:none">${u?.email || ''}</div>
          <div style="padding:4px 12px 6px;pointer-events:none"><span class="role-pill ${u?.role}">${u?.role || ''}</span></div>
          <div class="dropdown-divider"></div>
          <div class="theme-toggle-row" id="theme-toggle-row"><span>Dark mode</span><div class="theme-toggle-switch"><div class="toggle-knob"></div></div></div>
          ${isAdmin ? '<a href="/admin" onclick="event.stopPropagation(); navigate(\'/admin\'); return false;">Admin Panel</a>' : ''}
          <div class="dropdown-divider"></div>
          <a href="#" onclick="event.stopPropagation(); logout(); return false;">Logout</a>
        </div>
      </div>
    </div>
  </div>`;
}

function renderAdminTopbar(activePath) {
  const u = currentUser;
  const initials = getUserInitials(u);
  const adminNav = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/feeds', label: 'Feeds' },
    { href: '/admin/leads', label: 'Leads' },
    { href: '/admin/api-keys', label: 'API Keys' },
    { href: '/admin/agent-config', label: 'Agent Config' },
    { href: '/admin/audit', label: 'Audit Log' },
    { href: '/admin/spam-trap', label: 'Spam Trap' },
  ];
  return `<div class="topbar admin-topbar">
    <div class="topbar-logo"><svg class="tr-logo-mark" width="200" height="32" viewBox="0 0 200 32"><g transform="translate(16,16)"><path d="M-2.2,-14 A14,14 0 0,1 8.2,-11.3" stroke="#00d4ff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M10.4,-8.2 A14,14 0 0,1 13.8,2.6" stroke="#00e5a0" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M12.6,6 A14,14 0 0,1 2.6,13.8" stroke="#ffb627" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-0.6,14 A14,14 0 0,1 -12.6,6" stroke="#ff3b5c" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-13.8,2.6 A14,14 0 0,1 -6.7,-12.3" stroke="#b388ff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite"/><line x1="0" y1="0" x2="0" y2="-13" stroke="#00d4ff" stroke-width=".8" opacity=".35"/></g><circle cx="2.7" cy="-8.6" r="1.5" fill="#00d4ff" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="0.3s" repeatCount="indefinite"/></circle><circle cx="8.6" cy="0" r="1.5" fill="#00e5a0" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="1.5s" repeatCount="indefinite"/></circle><circle cx="2.7" cy="8.6" r="1.5" fill="#ffb627" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="2.7s" repeatCount="indefinite"/></circle><circle cx="-6.9" cy="5" r="1.5" fill="#ff3b5c" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="3.9s" repeatCount="indefinite"/></circle><circle cx="-6.9" cy="-5" r="1.5" fill="#b388ff" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="5.1s" repeatCount="indefinite"/></circle><circle cx="0" cy="0" r="2.5" fill="rgba(0,212,255,.08)" stroke="#00d4ff" stroke-width="1"/><circle cx="0" cy="0" r="1.2" fill="#00d4ff"/></g><text class="tr-wordmark" x="36" y="21" font-family="'Chakra Petch',sans-serif" font-weight="700" font-size="16" letter-spacing="2" fill="#e8edf5">TRUST <tspan fill="#00d4ff">RADAR</tspan></text></svg></div>
    <nav class="topbar-nav admin-nav-pills">
      <span class="admin-badge">Admin</span>
      ${adminNav.map(n => `<a href="${n.href}" class="admin-np${activePath === n.href ? ' active' : ''}">${n.label}</a>`).join('')}
    </nav>
    <div class="topbar-right">
      <a href="/observatory" onclick="navigate('/observatory'); return false;" class="admin-back-link">\u2190 <span class="back-text">Observatory</span></a>
      ${renderNotifBell()}
      <div class="user-menu" id="user-menu">
        <div class="user-avatar">${initials}</div>
        <div class="user-dropdown" style="right:0">
          <div style="padding:8px 12px;font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);border-bottom:1px solid var(--blue-border);pointer-events:none">${u?.email || ''}</div>
          <div style="padding:4px 12px 6px;pointer-events:none"><span class="role-pill ${u?.role}">${u?.role || ''}</span></div>
          <div class="dropdown-divider"></div>
          <div class="theme-toggle-row" id="theme-toggle-row"><span>Dark mode</span><div class="theme-toggle-switch"><div class="toggle-knob"></div></div></div>
          <a href="/observatory" onclick="event.stopPropagation(); navigate('/observatory'); return false;">Analyst View</a>
          <div class="dropdown-divider"></div>
          <a href="#" onclick="event.stopPropagation(); logout(); return false;">Logout</a>
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
  const badgeHtml = badge != null ? `<span class="badge">${badge}</span>` : '';
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
  document.cookie = 'token=; Max-Age=0; path=/;';
  document.cookie = 'session=; Max-Age=0; path=/;';
  document.cookie = 'jwt=; Max-Age=0; path=/;';
  accessToken = null;
  currentUser = null;
  window.location.href = '/login';
}
window.logout = logout;

// ─── View: Root (public landing / redirect) ────────────────────
async function viewRootRedirect(el) {
  // If already authenticated (in-SPA nav), go to observatory
  if (isAuthenticated()) { navigate('/observatory', true); return; }
  // Try refresh (user has cookie but page was reloaded)
  const refreshed = await refreshToken();
  if (refreshed) { navigate('/observatory', true); return; }
  // Unauthenticated → show public marketing site
  viewPublicSite(el, {});
}

// ─── View: Login ────────────────────────────────────────────────
function viewLogin(el) {
  el.innerHTML = `<div class="login-screen">
    <div class="login-logo"><svg width="400" height="100" viewBox="0 0 480 120"><g transform="translate(60,60)"><path d="M-12.6,-44 A46,46 0 0,1 27,-37.2" stroke="#00d4ff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/><path d="M32.2,-30.6 A46,46 0 0,1 45.2,8.4" stroke="#00e5a0" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/><path d="M41.4,19.8 A46,46 0 0,1 8.4,45.2" stroke="#ffb627" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-1.8,46 A46,46 0 0,1 -41.4,19.8" stroke="#ff3b5c" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-45.2,8.4 A46,46 0 0,1 -22,-40.4" stroke="#b388ff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/><circle cx="30" cy="-34" r="2" fill="#ff3b5c" opacity=".3"><animate attributeName="opacity" values=".3;.6;.3" dur="4s" begin="0.8s" repeatCount="indefinite"/></circle><circle cx="-44" cy="14" r="2" fill="#ff3b5c" opacity=".3"><animate attributeName="opacity" values=".3;.6;.3" dur="4s" begin="2.4s" repeatCount="indefinite"/></circle><circle cx="0" cy="0" r="28" fill="none" stroke="#00d4ff" stroke-width=".5" opacity=".1"/><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite"/><path d="M0,0 L0,-44 A44,44 0 0,1 22,-38 Z" fill="rgba(0,212,255,.06)" opacity=".5"/><line x1="0" y1="0" x2="0" y2="-44" stroke="#00d4ff" stroke-width="1.5" opacity=".6" stroke-linecap="round"/></g><g><circle cx="8.7" cy="-26.6" r="6" fill="#00d4ff" opacity="0"><animate attributeName="opacity" values="0;.25;0" dur="6s" begin="0.3s" repeatCount="indefinite"/></circle><circle cx="8.7" cy="-26.6" r="5" fill="#040810" stroke="#00d4ff" stroke-width="1.5" opacity=".6"/><circle cx="8.7" cy="-26.6" r="2.2" fill="#00d4ff" opacity=".4"><animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="0.3s" repeatCount="indefinite"/><animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="0.3s" repeatCount="indefinite"/></circle></g><g><circle cx="28" cy="0" r="6" fill="#00e5a0" opacity="0"><animate attributeName="opacity" values="0;.25;0" dur="6s" begin="1.5s" repeatCount="indefinite"/></circle><circle cx="28" cy="0" r="5" fill="#040810" stroke="#00e5a0" stroke-width="1.5" opacity=".6"/><circle cx="28" cy="0" r="2.2" fill="#00e5a0" opacity=".4"><animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="1.5s" repeatCount="indefinite"/><animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="1.5s" repeatCount="indefinite"/></circle></g><g><circle cx="8.7" cy="26.6" r="6" fill="#ffb627" opacity="0"><animate attributeName="opacity" values="0;.25;0" dur="6s" begin="2.7s" repeatCount="indefinite"/></circle><circle cx="8.7" cy="26.6" r="5" fill="#040810" stroke="#ffb627" stroke-width="1.5" opacity=".6"/><circle cx="8.7" cy="26.6" r="2.2" fill="#ffb627" opacity=".4"><animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="2.7s" repeatCount="indefinite"/><animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="2.7s" repeatCount="indefinite"/></circle></g><g><circle cx="-22.6" cy="16.4" r="6" fill="#ff3b5c" opacity="0"><animate attributeName="opacity" values="0;.25;0" dur="6s" begin="3.9s" repeatCount="indefinite"/></circle><circle cx="-22.6" cy="16.4" r="5" fill="#040810" stroke="#ff3b5c" stroke-width="1.5" opacity=".6"/><circle cx="-22.6" cy="16.4" r="2.2" fill="#ff3b5c" opacity=".4"><animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="3.9s" repeatCount="indefinite"/><animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="3.9s" repeatCount="indefinite"/></circle></g><g><circle cx="-22.6" cy="-16.4" r="6" fill="#b388ff" opacity="0"><animate attributeName="opacity" values="0;.25;0" dur="6s" begin="5.1s" repeatCount="indefinite"/></circle><circle cx="-22.6" cy="-16.4" r="5" fill="#040810" stroke="#b388ff" stroke-width="1.5" opacity=".6"/><circle cx="-22.6" cy="-16.4" r="2.2" fill="#b388ff" opacity=".4"><animate attributeName="opacity" values=".4;1;.4" dur="6s" begin="5.1s" repeatCount="indefinite"/><animate attributeName="r" values="2.2;3.2;2.2" dur="6s" begin="5.1s" repeatCount="indefinite"/></circle></g><circle cx="0" cy="0" r="10" fill="rgba(0,212,255,.04)" stroke="#00d4ff" stroke-width="1.5" opacity=".5"/><circle cx="0" cy="0" r="4.5" fill="#00d4ff"><animate attributeName="r" values="4.5;5.5;4.5" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.5;1" dur="2s" repeatCount="indefinite"/></circle></g><text x="130" y="48" font-family="'Chakra Petch',sans-serif" font-weight="700" font-size="34" letter-spacing="4" fill="#e8edf5">TRUST</text><text x="130" y="82" font-family="'Chakra Petch',sans-serif" font-weight="500" font-size="34" letter-spacing="4" fill="#00d4ff">RADAR</text></svg></div>
    <p style="color:var(--text-secondary);font-size:13px">Threat Intelligence Observatory</p>
    <a class="login-btn" href="/api/auth/login">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Sign in with Google
    </a>
    <div style="text-align:center;padding:16px 0 0;font-size:10px;color:#4a5a73">Operated by <span style="color:#7a8ba8">LRX Enterprises Inc.</span> \u{1F1E8}\u{1F1E6} Canadian owned and operated</div>
  </div>`;
}

function viewAuthCallback(el) {
  el.innerHTML = '<div class="login-screen"><div class="login-logo">Authenticating...</div></div>';
}

function viewAuthError(el) {
  const msg = new URLSearchParams(location.search).get('message') || 'Authentication failed';
  el.innerHTML = `<div class="login-screen">
    <div class="login-logo"><svg width="200" height="32" viewBox="0 0 200 32"><g transform="translate(16,16)"><path d="M-2.2,-14 A14,14 0 0,1 8.2,-11.3" stroke="#00d4ff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M10.4,-8.2 A14,14 0 0,1 13.8,2.6" stroke="#00e5a0" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M12.6,6 A14,14 0 0,1 2.6,13.8" stroke="#ffb627" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-0.6,14 A14,14 0 0,1 -12.6,6" stroke="#ff3b5c" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-13.8,2.6 A14,14 0 0,1 -6.7,-12.3" stroke="#b388ff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite"/><line x1="0" y1="0" x2="0" y2="-13" stroke="#00d4ff" stroke-width=".8" opacity=".35"/></g><circle cx="2.7" cy="-8.6" r="1.5" fill="#00d4ff" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="0.3s" repeatCount="indefinite"/></circle><circle cx="8.6" cy="0" r="1.5" fill="#00e5a0" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="1.5s" repeatCount="indefinite"/></circle><circle cx="2.7" cy="8.6" r="1.5" fill="#ffb627" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="2.7s" repeatCount="indefinite"/></circle><circle cx="-6.9" cy="5" r="1.5" fill="#ff3b5c" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="3.9s" repeatCount="indefinite"/></circle><circle cx="-6.9" cy="-5" r="1.5" fill="#b388ff" opacity=".5"><animate attributeName="opacity" values=".5;1;.5" dur="6s" begin="5.1s" repeatCount="indefinite"/></circle><circle cx="0" cy="0" r="2.5" fill="rgba(0,212,255,.08)" stroke="#00d4ff" stroke-width="1"/><circle cx="0" cy="0" r="1.2" fill="#00d4ff"/></g><text x="36" y="21" font-family="'Chakra Petch',sans-serif" font-weight="700" font-size="16" letter-spacing="2" fill="#e8edf5">TRUST <tspan fill="#00d4ff">RADAR</tspan></text></svg></div>
    <p style="color:var(--negative);font-size:13px">${msg}</p>
    <a class="login-btn" href="/api/auth/login">Try Again</a>
  </div>`;
}

// ─── View: Public Site ──────────────────────────────────────
async function viewPublicSite(el, params) {
  const isPreview = location.pathname === '/public-preview';
  const isAuth = isAuthenticated();

  // Animated logo SVG (topbar size)
  const logoSvg = `<svg class="tr-logo-mark" width="200" height="32" viewBox="0 0 200 32"><g transform="translate(16,16)"><path d="M-2.2,-14 A14,14 0 0,1 8.2,-11.3" stroke="#00d4ff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M10.4,-8.2 A14,14 0 0,1 13.8,2.6" stroke="#00e5a0" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M12.6,6 A14,14 0 0,1 2.6,13.8" stroke="#ffb627" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-0.6,14 A14,14 0 0,1 -12.6,6" stroke="#ff3b5c" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><path d="M-13.8,2.6 A14,14 0 0,1 -6.7,-12.3" stroke="#b388ff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite"/><line x1="0" y1="0" x2="0" y2="-13" stroke="#00d4ff" stroke-width=".8" opacity=".35"/></g><circle cx="0" cy="0" r="2.5" fill="rgba(0,212,255,.08)" stroke="#00d4ff" stroke-width="1"/><circle cx="0" cy="0" r="1.2" fill="#00d4ff"/></g><text class="tr-wordmark" x="36" y="21" font-family="'Chakra Petch',sans-serif" font-weight="700" font-size="16" letter-spacing="2" fill="#e8edf5">TRUST <tspan fill="#00d4ff">RADAR</tspan></text></svg>`;

  // Hero logo (large animated SVG for footer CTA)
  const heroLogo = `<svg width="80" height="80" viewBox="0 0 80 80"><g transform="translate(40,40)"><path d="M-6.3,-35 A35,35 0 0,1 20.5,-28.3" stroke="#00d4ff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/><path d="M26,-20.5 A35,35 0 0,1 34.5,6.5" stroke="#00e5a0" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/><path d="M31.5,15 A35,35 0 0,1 6.5,34.5" stroke="#ffb627" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/><path d="M-1.5,35 A35,35 0 0,1 -31.5,15" stroke="#ff3b5c" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/><path d="M-34.5,6.5 A35,35 0 0,1 -16.8,-30.8" stroke="#b388ff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite"/><line x1="0" y1="0" x2="0" y2="-32" stroke="#00d4ff" stroke-width="1" opacity=".35"/></g><circle cx="0" cy="0" r="6" fill="rgba(0,212,255,.08)" stroke="#00d4ff" stroke-width="1.5"/><circle cx="0" cy="0" r="3" fill="#00d4ff"/></g></svg>`;

  const agents = [
    { name: 'Sentinel', color: '#00d4ff', role: 'Certificate & Domain Surveillance', icon: '\u25C9',
      bullets: ['Monitors Certificate Transparency logs in real-time', 'Detects newly registered suspicious domains', 'Flags typosquatting and homoglyph attacks'],
      statKey: 'certificates_today', statLabel: 'certificates scanned today' },
    { name: 'Analyst', color: '#00e5a0', role: 'Threat Classification & Brand Matching', icon: '\u25C8',
      bullets: ['AI-powered URL analysis using Claude Haiku', 'Matches threats to target brands automatically', 'Scores confidence and assigns severity levels'],
      statKey: 'threats_classified_today', statLabel: 'threats classified today' },
    { name: 'Cartographer', color: '#ffb627', role: 'Infrastructure Mapping & Provider Scoring', icon: '\u25CE',
      bullets: ['Maps IP addresses to hosting providers and ASNs', 'Scores provider abuse rates and response times', 'Identifies infrastructure patterns across campaigns'],
      statKey: 'providers_mapped', statLabel: 'providers mapped' },
    { name: 'Strategist', color: '#ff3b5c', role: 'Campaign Correlation & Clustering', icon: '\u25C6',
      bullets: ['Groups related threats into coordinated campaigns', 'AI-generates descriptive campaign names', 'Identifies shared infrastructure and attack patterns'],
      statKey: 'threat_campaigns', statLabel: 'active threat campaigns' },
    { name: 'Observer', color: '#b388ff', role: 'Intelligence Synthesis & Trend Analysis', icon: '\u25CB',
      bullets: ['Produces narrative threat intelligence briefings', 'Identifies emerging attack trends and shifts', 'Monitors brand-specific threat landscapes'],
      statKey: 'latest_insight_summary', statLabel: '' },
  ];

  // Threat category definitions with SVG icons
  const threatCategories = [
    { type: 'phishing', label: 'Phishing & Credential Harvesting', desc: 'Fake login pages designed to steal user credentials',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff3b5c" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4M12 16h.01"/></svg>' },
    { type: 'typosquatting', label: 'Brand Impersonation & Typosquatting', desc: 'Lookalike domains exploiting brand trust',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>' },
    { type: 'malware', label: 'Malware Distribution URLs', desc: 'URLs serving malicious payloads and downloaders',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffb627" stroke-width="1.5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4l2 2"/></svg>' },
    { type: 'c2', label: 'Command & Control Infrastructure', desc: 'C2 servers controlling compromised hosts',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>' },
    { type: 'botnet', label: 'Botnet Nodes', desc: 'Infected hosts participating in bot networks',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b388ff" stroke-width="1.5"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 8v3M7.5 17.5L10 13M16.5 17.5L14 13"/></svg>' },
    { type: 'ssl_blacklist', label: 'Malicious SSL Certificates', desc: 'SSL certs associated with known malware',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00e5a0" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>' },
    { type: 'scanner', label: 'Scanning & Reconnaissance', desc: 'Hosts performing network scans and probes',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7a8ba8" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' },
  ];

  // Feed type badges
  const feedTypeBadge = (name) => {
    const n = name.toLowerCase();
    if (n.includes('phish') || n.includes('openphish')) return { label: 'Phishing', color: '#ff3b5c' };
    if (n.includes('urlhaus') || n.includes('malware') || n.includes('threatfox')) return { label: 'Malware', color: '#ffb627' };
    if (n.includes('ssl') || n.includes('cert') || n.includes('ct_logs')) return { label: 'SSL', color: '#00e5a0' };
    if (n.includes('cins') || n.includes('dshield') || n.includes('blocklist')) return { label: 'IP Intel', color: '#b388ff' };
    if (n.includes('cloudflare')) return { label: 'Intel', color: '#00d4ff' };
    if (n.includes('nrd') || n.includes('hagezi')) return { label: 'Domains', color: '#ff6b35' };
    return { label: 'Intel', color: '#7a8ba8' };
  };

  el.innerHTML = `
    ${isPreview && isAuth ? '<div class="pub-preview-banner" id="pub-preview-banner"><span>\u2190 <a href="/observatory" style="color:#00d4ff">Back to Observatory</a></span><span>You\'re viewing the public site</span><button onclick="document.getElementById(\'pub-preview-banner\').remove()" style="background:none;border:none;color:#7a8ba8;font-size:16px;cursor:pointer">\u2715</button></div>' : ''}

    <!-- NAV -->
    <nav class="pub-nav">
      <div class="pub-nav-inner">
        <a href="/" class="pub-nav-logo">${logoSvg}</a>
        <div class="pub-nav-links">
          <a href="#detect">Detection</a>
          <a href="#agents">Agents</a>
          <a href="#feeds">Feeds</a>
          <a href="#assessment">Assessment</a>
        </div>
        <div class="pub-nav-cta">
          <a href="/login" class="pub-nav-login">Login</a>
          <a href="#assessment" class="pub-btn pub-btn-primary pub-btn-sm">Sign Up</a>
        </div>
        <button class="pub-hamburger" id="pub-hamburger">\u2630</button>
      </div>
      <div class="pub-mobile-menu" id="pub-mobile-menu" style="display:none">
        <a href="#detect">Detection</a><a href="#agents">Agents</a><a href="#feeds">Feeds</a><a href="#assessment">Assessment</a>
        <a href="/login">Login</a><a href="#assessment" class="pub-btn pub-btn-primary" style="text-align:center">Sign Up</a>
      </div>
    </nav>

    <!-- HERO -->
    <section class="pub-hero">
      <div class="pub-hero-map" id="pub-hero-map"></div>
      <div class="pub-hero-overlay"></div>
      <div class="pub-hero-content">
        <h1 class="pub-hero-title">See What Attackers See</h1>
        <p class="pub-hero-sub">Trust Radar is an AI-powered threat intelligence observatory that watches the internet\u2019s attack surface 24/7. Five autonomous agents detect threat campaigns, map hostile infrastructure, and protect your brand \u2014 before damage is done.</p>
        <div class="pub-hero-cta">
          <a href="#assessment" class="pub-btn pub-btn-primary pub-btn-lg">Scan Your Brand</a>
          <a href="#agents" class="pub-btn pub-btn-outline pub-btn-lg">See It Live \u2193</a>
        </div>
      </div>
      <div class="pub-hero-stats" id="pub-hero-stats">
        <span><strong id="pub-stat-threats" class="pub-countup">--</strong> Threats Tracked</span>
        <span><strong id="pub-stat-brands" class="pub-countup">--</strong> Brands Monitored</span>
        <span><strong id="pub-stat-feeds" class="pub-countup">--</strong> Active Feeds</span>
        <span><strong id="pub-stat-campaigns" class="pub-countup">--</strong> Campaigns Identified</span>
      </div>
    </section>

    <!-- PROBLEM -->
    <section class="pub-section">
      <h2 class="pub-section-title">Your Brand Is Being Impersonated Right Now</h2>
      <div class="pub-problem-grid">
        <div class="pub-problem-card">
          <div class="pub-problem-num">4,000+</div>
          <div class="pub-problem-label">Threat domains registered daily targeting major brands</div>
          <div class="pub-problem-src">Source: Anti-Phishing Working Group</div>
        </div>
        <div class="pub-problem-card">
          <div class="pub-problem-num" style="color:var(--threat-medium)">21 days</div>
          <div class="pub-problem-label">Average time to detect brand impersonation</div>
          <div class="pub-problem-src">Your customers are at risk before you even know</div>
        </div>
        <div class="pub-problem-card">
          <div class="pub-problem-num" style="color:var(--threat-high)">83%</div>
          <div class="pub-problem-label">Of threat sites use legitimate hosting providers</div>
          <div class="pub-problem-src">Making takedowns harder than ever</div>
        </div>
      </div>
      <p class="pub-problem-cta">Trust Radar changes this. Our AI agents watch the internet\u2019s attack surface continuously \u2014 not weekly, not daily, but <strong style="color:#00d4ff">every five minutes</strong>.</p>
    </section>

    <!-- WHAT WE DETECT -->
    <section class="pub-section" id="detect">
      <h2 class="pub-section-title">What We Detect</h2>
      <p class="pub-section-sub">Beyond phishing \u2014 we identify the full spectrum of online threats targeting your brand and infrastructure.</p>
      <div class="pub-detect-grid" id="pub-detect-grid">
        ${threatCategories.map(c => `
          <div class="pub-detect-card">
            <div class="pub-detect-icon">${c.icon}</div>
            <div class="pub-detect-body">
              <div class="pub-detect-label">${c.label}</div>
              <div class="pub-detect-desc">${c.desc}</div>
              <div class="pub-detect-count" data-type="${c.type}">--</div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- AGENTS -->
    <section class="pub-section" id="agents">
      <h2 class="pub-section-title">Five AI Agents. One Mission.</h2>
      <p class="pub-section-sub">Each agent has a specialized role in the intelligence pipeline. Together, they form a continuous detection and analysis system.</p>
      <div class="pub-agents-pipeline">
        ${agents.map((a, i) => `
          <div class="pub-agent-card" style="--agent-color:${a.color};animation-delay:${i * 0.2}s">
            <div class="pub-agent-icon" style="color:${a.color};border-color:${a.color}">${a.icon}</div>
            <div class="pub-agent-name" style="color:${a.color}">${a.name}</div>
            <div class="pub-agent-role">${a.role}</div>
            <ul class="pub-agent-bullets">${a.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
            <div class="pub-agent-stat" id="pub-agent-stat-${i}"></div>
          </div>
          ${i < agents.length - 1 ? '<div class="pub-agent-arrow">\u2192</div>' : ''}
        `).join('')}
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="pub-section" id="features">
      <h2 class="pub-section-title">How It Works</h2>
      <div class="pub-steps">
        <div class="pub-step">
          <div class="pub-step-num">1</div>
          <h3>Continuous Monitoring</h3>
          <p><span id="pub-step-feed-count">14</span> threat intelligence feeds scan the internet 24/7 \u2014 phishing databases, malware distribution lists, certificate transparency logs, IP blocklists, and SSL blacklists.</p>
          <div class="pub-step-badges">
            <span class="pub-step-badge">abuse.ch</span><span class="pub-step-badge">SANS DShield</span>
            <span class="pub-step-badge">PhishTank</span><span class="pub-step-badge">Cloudflare Radar</span>
            <span class="pub-step-badge">CT Logs</span><span class="pub-step-badge">SSL Blacklist</span>
          </div>
        </div>
        <div class="pub-step">
          <div class="pub-step-num">2</div>
          <h3>AI-Powered Analysis</h3>
          <p>Five AI agents \u2014 <span style="color:#00d4ff">Sentinel</span>, <span style="color:#00e5a0">Analyst</span>, <span style="color:#ffb627">Cartographer</span>, <span style="color:#ff3b5c">Strategist</span>, and <span style="color:#b388ff">Observer</span> \u2014 classify, correlate, and map every threat in real time.</p>
          <div class="pub-step-agents">
            <span class="pub-step-agent" style="--ac:#00d4ff">\u25C9</span>
            <span class="pub-step-agent" style="--ac:#00e5a0">\u25C8</span>
            <span class="pub-step-agent" style="--ac:#ffb627">\u25CE</span>
            <span class="pub-step-agent" style="--ac:#ff3b5c">\u25C6</span>
            <span class="pub-step-agent" style="--ac:#b388ff">\u25CB</span>
          </div>
        </div>
        <div class="pub-step">
          <div class="pub-step-num">3</div>
          <h3>Brand Correlation</h3>
          <p>Every threat is checked against monitored brands using domain matching, homoglyph detection, and certificate analysis. Typosquats are caught within minutes of registration.</p>
          <div class="pub-step-demo">
            <span class="pub-step-threat">paypal-secure.com</span>
            <span style="color:var(--text-tertiary)">\u2192</span>
            <span class="pub-step-match">Matched to PayPal</span>
          </div>
        </div>
        <div class="pub-step">
          <div class="pub-step-num">4</div>
          <h3>Intelligence Delivery</h3>
          <p>Campaigns are identified, infrastructure is mapped, and daily intelligence briefings are generated. Your security team gets actionable intelligence, not raw data.</p>
        </div>
        <div class="pub-step pub-step-coming">
          <div class="pub-step-num">5</div>
          <span class="pub-coming-badge">Coming Soon</span>
          <h3>We Take Action</h3>
          <p>Automated takedown requests, registrar notifications, and evidence preservation \u2014 turning intelligence into action.</p>
        </div>
      </div>
    </section>

    <!-- FEED SOURCES -->
    <section class="pub-section" id="feeds">
      <h2 class="pub-section-title">Powered by <span id="pub-feed-total">14</span> Threat Intelligence Feeds</h2>
      <p class="pub-section-sub">Real-time data from the world\u2019s leading threat intelligence sources. Every feed is monitored for health and freshness.</p>
      <div class="pub-feeds-grid" id="pub-feeds-grid">
        <div style="text-align:center;padding:32px;color:var(--text-tertiary)">Loading feeds...</div>
      </div>
    </section>

    <!-- ASSESSMENT -->
    <section class="pub-section pub-assess-section" id="assessment">
      <h2 class="pub-section-title">How Exposed Is Your Brand?</h2>
      <p class="pub-section-sub">Enter your domain to get a free AI-powered threat assessment. See if attackers are already targeting your brand.</p>
      <div class="pub-assess-form">
        <div class="pub-assess-input-row">
          <input type="text" id="pub-assess-domain" class="pub-assess-input" placeholder="yourbrand.com" autocomplete="off">
          <button class="pub-btn pub-btn-primary pub-btn-lg" id="pub-assess-submit">Scan Now \u2192</button>
        </div>
        <div class="pub-assess-note">Free assessment \u2022 No credit card \u2022 Results in 30 seconds</div>
      </div>
      <div id="pub-assess-loading" style="display:none" class="pub-assess-loading">
        ${heroLogo}
        <div>Scanning threat landscape...</div>
      </div>
      <div id="pub-assess-results" style="display:none"></div>
      <div id="pub-lead-form" style="display:none"></div>
    </section>

    <!-- CTA FOOTER -->
    <footer class="pub-footer">
      <div class="pub-footer-logo">${heroLogo}</div>
      <h2 class="pub-footer-title">Ready to protect your brand?</h2>
      <div class="pub-footer-stats" id="pub-footer-stats">
        <span>Tracking <strong id="pub-foot-threats">19,000+</strong> threats across <strong id="pub-foot-countries">35+</strong> countries</span>
        <span>Powered by <strong id="pub-foot-feeds">14</strong> intelligence feeds</span>
        <span>5 AI agents running continuously</span>
      </div>
      <div class="pub-footer-cta">
        <a href="#assessment" class="pub-btn pub-btn-primary pub-btn-lg">Get Your Free Assessment</a>
        <a href="mailto:hello@trustradar.ca" class="pub-btn pub-btn-outline pub-btn-lg">Request a Demo</a>
      </div>
      <div class="pub-footer-legal">
        <div>\u00A9 2026 LRX Enterprises Inc. \u{1F1E8}\u{1F1E6} Canadian owned and operated</div>
        <div>trustradar.ca</div>
        <div class="pub-footer-links"><a href="#">Privacy Policy</a> | <a href="#">Terms of Service</a></div>
      </div>
    </footer>
  `;

  // ─── Smooth scroll for anchor links ───
  el.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ─── Hamburger menu ───
  document.getElementById('pub-hamburger')?.addEventListener('click', () => {
    const menu = document.getElementById('pub-mobile-menu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
  });

  // ─── Hero map (decorative, non-interactive) ───
  try {
    if (typeof L !== 'undefined') {
      const map = L.map('pub-hero-map', {
        center: [30, 0], zoom: 2, zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        touchZoom: false, keyboard: false, boxZoom: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 4, opacity: 0.6,
      }).addTo(map);

      // Plot public geo markers
      const geoRes = await fetch('/api/v1/public/geo').then(r => r.json()).catch(() => null);
      if (geoRes?.data) {
        const colors = { critical: '#ff3b5c', high: '#ff6b35', medium: '#ffb627', low: '#00d4ff' };
        geoRes.data.slice(0, 200).forEach(p => {
          L.circleMarker([p.lat, p.lng], {
            radius: 3, fillColor: colors[p.severity] || '#00d4ff',
            fillOpacity: 0.6, stroke: false,
          }).addTo(map);
        });
      }
    }
  } catch {}

  // ─── Count-up animation helper ───
  function animateCountUp(el, target, suffix) {
    if (!el) return;
    const duration = 1500;
    const start = performance.now();
    const from = 0;
    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      el.textContent = current.toLocaleString() + (suffix || '');
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ─── Intersection Observer for count-up ───
  let statsAnimated = false;
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !statsAnimated) {
        statsAnimated = true;
        loadStats();
      }
    });
  }, { threshold: 0.3 });
  const heroStats = document.getElementById('pub-hero-stats');
  if (heroStats) statsObserver.observe(heroStats);

  // ─── Live stats ───
  let _pubStatsData = null;
  async function loadStats() {
    try {
      const res = await fetch('/api/v1/public/stats').then(r => r.json());
      const d = res?.data;
      if (!d) return;
      _pubStatsData = d;

      // Hero stats with count-up
      const totalThreats = d.total_threats || d.active_threats || 0;
      const roundedThreats = Math.floor(totalThreats / 1000) * 1000;
      animateCountUp(document.getElementById('pub-stat-threats'), roundedThreats, '+');
      animateCountUp(document.getElementById('pub-stat-brands'), d.brands_monitored || d.brands_tracked || 0, '');
      animateCountUp(document.getElementById('pub-stat-feeds'), d.active_feeds || 14, '');
      animateCountUp(document.getElementById('pub-stat-campaigns'), d.threat_campaigns || 0, '+');

      // Agent stats
      const agentStats = [d.certificates_today, d.threats_classified_today, d.providers_mapped, d.threat_campaigns, d.latest_insight_summary];
      agents.forEach((a, i) => {
        const el = document.getElementById('pub-agent-stat-' + i);
        if (!el) return;
        if (i === 4 && d.latest_insight_summary) {
          el.innerHTML = '<span style="font-size:10px;color:' + a.color + '">Latest: ' + d.latest_insight_summary.slice(0, 60) + '...</span>';
        } else {
          el.innerHTML = '<span style="font-family:var(--font-mono);font-size:12px;color:' + a.color + '">' + (agentStats[i] || 0).toLocaleString() + '</span> <span style="font-size:10px;color:var(--text-tertiary)">' + a.statLabel + '</span>';
        }
      });

      // Threat type counts in detect section
      if (d.threat_types) {
        const typeMap = {};
        d.threat_types.forEach(t => { typeMap[t.threat_type] = t.count; });
        document.querySelectorAll('.pub-detect-count').forEach(el => {
          const type = el.dataset.type;
          const count = typeMap[type] || 0;
          el.textContent = count > 0 ? count.toLocaleString() + ' detected' : 'Monitoring';
          el.style.color = count > 0 ? 'var(--blue-primary)' : 'var(--text-tertiary)';
        });
      }

      // Footer stats
      const footThreats = document.getElementById('pub-foot-threats');
      if (footThreats) footThreats.textContent = roundedThreats.toLocaleString() + '+';
      const footCountries = document.getElementById('pub-foot-countries');
      if (footCountries) footCountries.textContent = (d.countries || 35) + '+';
      const footFeeds = document.getElementById('pub-foot-feeds');
      if (footFeeds) footFeeds.textContent = String(d.active_feeds || 14);

      // Pipeline step feed count
      const stepFc = document.getElementById('pub-step-feed-count');
      if (stepFc) stepFc.textContent = String(d.active_feeds || 14);
      const feedTotal = document.getElementById('pub-feed-total');
      if (feedTotal) feedTotal.textContent = String(d.active_feeds || 14);
    } catch {}
  }
  // Load immediately if hero is already in view
  if (!statsAnimated) { statsAnimated = true; loadStats(); }
  const statsInterval = setInterval(loadStats, 60000);

  // ─── Load feeds grid ───
  async function loadFeeds() {
    try {
      const res = await fetch('/api/v1/public/feeds').then(r => r.json());
      const feeds = res?.data || [];
      const grid = document.getElementById('pub-feeds-grid');
      if (!grid || !feeds.length) return;
      grid.innerHTML = feeds.map(f => {
        const badge = feedTypeBadge(f.feed_name);
        const statusColor = f.health_status === 'healthy' ? '#00e5a0' : f.health_status === 'degraded' ? '#ffb627' : '#ff3b5c';
        return `<div class="pub-feed-card">
          <div class="pub-feed-card-header">
            <span class="pub-feed-card-dot" style="background:${statusColor}"></span>
            <span class="pub-feed-card-name">${f.display_name}</span>
            <span class="pub-feed-type-badge" style="background:${badge.color}20;color:${badge.color}">${badge.label}</span>
          </div>
          <div class="pub-feed-card-desc">${f.description || ''}</div>
          ${f.records_ingested_today > 0 ? `<div class="pub-feed-card-stat">${f.records_ingested_today.toLocaleString()} ingested today</div>` : ''}
        </div>`;
      }).join('');
    } catch {}
  }
  loadFeeds();

  // ─── Assessment form ───
  const submitBtn = document.getElementById('pub-assess-submit');
  const domainInput = document.getElementById('pub-assess-domain');

  async function runAssessment() {
    const domain = domainInput?.value?.trim();
    if (!domain || !domain.includes('.')) {
      domainInput.style.borderColor = '#ff3b5c';
      return;
    }
    domainInput.style.borderColor = '';
    document.getElementById('pub-assess-loading').style.display = 'flex';
    document.getElementById('pub-assess-results').style.display = 'none';
    document.getElementById('pub-lead-form').style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Scanning...';

    try {
      // Run threat assessment and email security scan in parallel
      const [res, esRes] = await Promise.all([
        fetch('/api/v1/public/assess', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain }),
        }).then(r => r.json()).catch(() => null),
        fetch(`/api/v1/public/email-security/${encodeURIComponent(domain)}`).then(r => r.json()).catch(() => null),
      ]);

      document.getElementById('pub-assess-loading').style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Scan Now \u2192';

      if (!res?.success || !res?.data) {
        document.getElementById('pub-assess-results').style.display = 'block';
        document.getElementById('pub-assess-results').innerHTML = '<div class="pub-assess-error">' + (res?.error || 'Assessment failed') + '</div>';
        return;
      }

      const d = res.data;
      const scoreColor = d.grade === 'A' ? '#00d4ff' : d.grade === 'B' ? '#00e5a0' : d.grade === 'C' ? '#ffb627' : d.grade === 'D' ? '#ff6b35' : '#ff3b5c';
      const pct = d.trust_score / 100;
      const radius = 60;
      const circ = 2 * Math.PI * radius;
      const offset = circ * (1 - pct);

      // Build threat types breakdown if available
      let typesHtml = '';
      if (d.threat_types && d.threat_types.length > 0) {
        typesHtml = '<div class="pub-assess-types"><div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px">Threat Breakdown</div>' +
          d.threat_types.map(t => `<div class="pub-assess-type-row"><span>${t.threat_type}</span><span style="color:var(--blue-primary);font-family:var(--font-mono)">${t.count}</span></div>`).join('') +
          '</div>';
      }

      const monitoredNote = d.is_monitored
        ? '<div style="font-size:11px;color:var(--positive);margin-top:8px">This brand is actively monitored by Trust Radar</div>'
        : '<div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">This brand is not currently monitored. <a href="#" style="color:var(--blue-primary)">Add it to get continuous protection.</a></div>';

      document.getElementById('pub-assess-results').style.display = 'block';
      document.getElementById('pub-assess-results').innerHTML = `
        <div class="pub-results-card">
          <div class="pub-results-top">
            <div class="pub-score-ring">
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="${radius}" fill="none" stroke="#111d35" stroke-width="8"/>
                <circle cx="80" cy="80" r="${radius}" fill="none" stroke="${scoreColor}" stroke-width="8" stroke-linecap="round"
                  stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
                  transform="rotate(-90 80 80)" style="transition:stroke-dashoffset 1.5s ease">
                  <animate attributeName="stroke-dashoffset" from="${circ}" to="${offset}" dur="1.5s" fill="freeze"/>
                </circle>
                <text x="80" y="72" text-anchor="middle" font-family="'Chakra Petch',sans-serif" font-size="36" font-weight="700" fill="${scoreColor}">${d.trust_score}</text>
                <text x="80" y="95" text-anchor="middle" font-family="'Chakra Petch',sans-serif" font-size="16" font-weight="600" fill="${scoreColor}">${d.grade}</text>
              </svg>
            </div>
            <div class="pub-results-stats">
              <div class="pub-result-stat"><div class="pub-result-stat-val" style="color:var(--threat-critical)">${d.threat_count}</div><div class="pub-result-stat-label">Threats Found</div></div>
              <div class="pub-result-stat"><div class="pub-result-stat-val" style="color:var(--threat-medium)">${d.provider_count}</div><div class="pub-result-stat-label">Providers Involved</div></div>
              <div class="pub-result-stat"><div class="pub-result-stat-val" style="color:var(--blue-primary)">${d.campaign_count}</div><div class="pub-result-stat-label">Campaigns Detected</div></div>
            </div>
          </div>
          ${d.threat_count > 0 ? '<div class="pub-alert-bar pub-alert-danger">\u26A0 Your brand has active threats in the wild.</div>' : '<div class="pub-alert-bar pub-alert-safe">\u2713 No threats detected. Stay ahead by monitoring your brand.</div>'}
          <div class="pub-assess-text">${d.assessment_text}</div>
          ${typesHtml}
          ${monitoredNote}
        </div>
      `;
      document.getElementById('pub-assess-results').scrollIntoView({ behavior: 'smooth' });

      // Render email security posture card (already fetched in parallel above)
      if (esRes?.success && esRes?.data) {
        const es = esRes.data;
          const esGradeColor = {'A+':'#00ff88','A':'#00dd66','B':'#ffcc00','C':'#ff8800','D':'#ff4444','F':'#ff0000'}[es.grade] || '#666';
          const esScore = es.score || 0;
          const dmarcStatus = es.dmarc?.exists ? `Policy: ${es.dmarc.policy || 'none'}` : 'Not configured';
          const spfStatus = es.spf?.exists ? (es.spf.policy || 'exists') : 'Not configured';
          const dkimStatus = es.dkim?.exists ? `${(es.dkim.selectors_found || []).length} selector(s)` : 'Not detected';
          const mxStatus = es.mx?.exists ? ((es.mx.providers || []).join(', ') || 'Active') : 'No mail servers';
          const vulnerabilityWarning = esScore < 50
            ? `<div class="pub-alert-bar pub-alert-danger">\u26A0 This domain has weak email security. Anyone could send emails pretending to be ${es.domain}.</div>`
            : esScore < 75
            ? `<div class="pub-alert-bar" style="background:rgba(255,182,39,.08);border-color:rgba(255,182,39,.3);color:#ffb627">\uD83D\uDCA1 Email security could be improved. Some spoofing protection gaps detected.</div>`
            : '';
          const esRecs = (es.recommendations || []).slice(0, 3).map(r => {
            const icon = r.startsWith('CRITICAL') ? '\uD83D\uDD34' : r.startsWith('WARNING') ? '\uD83D\uDFE1' : r.startsWith('GOOD') ? '\uD83D\uDFE2' : r.startsWith('Excellent') ? '\uD83C\uDFC6' : '\uD83D\uDCA1';
            return `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px">${icon} ${r}</div>`;
          }).join('');

          const emailHtml = `
            <div class="pub-results-card" style="margin-top:16px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                <div style="font-family:var(--font-display);font-size:15px;font-weight:700">\uD83D\uDCE7 Email Security Posture</div>
                <div style="display:flex;align-items:center;gap:12px">
                  <span style="background:${esGradeColor};color:#000;padding:4px 12px;border-radius:4px;font-weight:700;font-size:18px;font-family:var(--font-mono)">${es.grade}</span>
                  <span style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:${esGradeColor}">${esScore}<span style="font-size:12px;color:var(--text-tertiary)">/100</span></span>
                </div>
              </div>
              ${vulnerabilityWarning}
              <div class="protocol-grid" style="margin:12px 0">
                <div class="protocol-check ${es.dmarc?.exists ? 'pass' : 'fail'}"><div class="protocol-icon">${es.dmarc?.exists ? '\u2705' : '\u274C'}</div><div class="protocol-name">DMARC</div><div class="protocol-detail">${dmarcStatus}</div></div>
                <div class="protocol-check ${es.spf?.exists ? 'pass' : 'fail'}"><div class="protocol-icon">${es.spf?.exists ? '\u2705' : '\u274C'}</div><div class="protocol-name">SPF</div><div class="protocol-detail">${spfStatus}</div></div>
                <div class="protocol-check ${es.dkim?.exists ? 'pass' : 'fail'}"><div class="protocol-icon">${es.dkim?.exists ? '\u2705' : '\u274C'}</div><div class="protocol-name">DKIM</div><div class="protocol-detail">${dkimStatus}</div></div>
                <div class="protocol-check ${es.mx?.exists ? 'pass' : 'fail'}"><div class="protocol-icon">${es.mx?.exists ? '\u2705' : '\u274C'}</div><div class="protocol-name">MX</div><div class="protocol-detail">${mxStatus}</div></div>
              </div>
              ${esRecs ? `<div style="margin-top:12px">${esRecs}</div>` : ''}
              <div style="margin-top:16px;text-align:center">
                <a href="/login" class="pub-btn pub-btn-primary" style="font-size:12px">Monitor This Domain \u2192</a>
              </div>
            </div>`;

          const resultsEl = document.getElementById('pub-assess-results');
          if (resultsEl) resultsEl.insertAdjacentHTML('beforeend', emailHtml);
      }

      // Show lead capture form
      setTimeout(() => {
        const leadForm = document.getElementById('pub-lead-form');
        leadForm.style.display = 'block';
        leadForm.innerHTML = `
          <div class="pub-lead-card">
            <h3>Get the Full Threat Report</h3>
            <p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px">We\u2019ll send you a detailed analysis with every threat domain, hosting provider, and campaign targeting your brand.</p>
            <div class="pub-lead-fields">
              <input type="email" id="pub-lead-email" placeholder="Business email" required>
              <input type="text" id="pub-lead-name" placeholder="Full name" required>
              <input type="text" id="pub-lead-company" placeholder="Company" required>
              <select id="pub-lead-role"><option value="">Select role...</option><option>CISO</option><option>Security Engineer</option><option>IT Director</option><option>Brand Manager</option><option>Legal/Compliance</option><option>Executive/C-Suite</option><option>Other</option></select>
            </div>
            <div id="pub-lead-error" style="display:none;color:#ff3b5c;font-size:12px;margin-bottom:8px"></div>
            <button class="pub-btn pub-btn-primary pub-btn-lg" id="pub-lead-submit" style="width:100%">Send My Report \u2192</button>
          </div>
        `;

        document.getElementById('pub-lead-submit')?.addEventListener('click', async () => {
          const email = document.getElementById('pub-lead-email')?.value?.trim();
          const name = document.getElementById('pub-lead-name')?.value?.trim();
          const company = document.getElementById('pub-lead-company')?.value?.trim();
          const role = document.getElementById('pub-lead-role')?.value;
          const errEl = document.getElementById('pub-lead-error');

          if (!email || !name || !company) {
            errEl.style.display = 'block'; errEl.textContent = 'All fields are required'; return;
          }
          errEl.style.display = 'none';

          const btn = document.getElementById('pub-lead-submit');
          btn.disabled = true; btn.textContent = 'Sending...';

          try {
            const lRes = await fetch('/api/v1/public/leads', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name, company, role, domain: d.domain, trust_score: d.trust_score, grade: d.grade, assessment_id: d.assessment_id }),
            }).then(r => r.json());

            if (lRes?.success) {
              leadForm.innerHTML = '<div class="pub-lead-card" style="text-align:center;padding:32px">' + heroLogo + '<h3 style="color:var(--positive);margin-top:16px">\u2713 Report Requested</h3><p style="color:var(--text-secondary)">Check your inbox for the full threat assessment. A member of our team will follow up within 24 hours.</p></div>';
            } else {
              errEl.style.display = 'block'; errEl.textContent = lRes?.error || 'Failed to submit';
              btn.disabled = false; btn.textContent = 'Send My Report \u2192';
            }
          } catch (err) {
            errEl.style.display = 'block'; errEl.textContent = 'Network error. Please try again.';
            btn.disabled = false; btn.textContent = 'Send My Report \u2192';
          }
        });
      }, 800);

    } catch (err) {
      document.getElementById('pub-assess-loading').style.display = 'none';
      submitBtn.disabled = false; submitBtn.textContent = 'Scan Now \u2192';
    }
  }

  submitBtn?.addEventListener('click', runAssessment);
  domainInput?.addEventListener('keydown', e => { if (e.key === 'Enter') runAssessment(); });

  // ─── Cleanup ───
  window._viewCleanup = () => { clearInterval(statsInterval); };
}

// ─── View: Observatory (Step 8) — deck.gl + MapLibre GL ─────
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
    <div class="stat-bar-overlay" id="stat-bar"></div>
    <div class="obs-mode-selector" id="obs-mode-selector">
      <button class="obs-mode-btn obs-filters-toggle" id="obs-filters-toggle" title="Toggle Filters">☰</button>
      <div class="obs-mode-divider"></div>
      <button class="obs-mode-btn active" data-mode="1" title="Multi-Stream">⟿</button>
      <button class="obs-mode-btn" data-mode="2" title="Live Feed">▶</button>
      <button class="obs-mode-btn" data-mode="3" title="Corridors">═</button>
      <button class="obs-mode-btn" data-mode="4" title="Brand Focus">◉</button>
      <button class="obs-mode-btn" data-mode="5" title="Radar Sweep">◠</button>
    </div>
    <div class="obs-time-filter" id="obs-time-filter">
      <button class="obs-tf-btn active" data-period="24h">24H</button>
      <button class="obs-tf-btn" data-period="7d">7D</button>
      <button class="obs-tf-btn" data-period="30d">30D</button>
      <button class="obs-tf-btn" data-period="all">ALL</button>
    </div>
    <div class="obs-sev-filter" id="obs-sev-filter">
      <button class="obs-sev-btn active" data-sev="critical"><span class="obs-sev-dot" style="background:#ff3b5c"></span>Critical</button>
      <button class="obs-sev-btn active" data-sev="high"><span class="obs-sev-dot" style="background:#ff6b35"></span>High</button>
      <button class="obs-sev-btn active" data-sev="medium"><span class="obs-sev-dot" style="background:#ffb627"></span>Medium</button>
      <button class="obs-sev-btn active" data-sev="low"><span class="obs-sev-dot" style="background:#00d4ff"></span>Low</button>
    </div>
    <div class="obs-source-filter" id="obs-source-filter" style="position:absolute;bottom:56px;left:12px;display:flex;gap:4px;z-index:10">
      <button class="obs-sev-btn active" data-source="all"><span class="obs-src-dot" style="background:var(--text-secondary)"></span><span class="obs-src-text">All Sources</span></button>
      <button class="obs-sev-btn" data-source="feeds"><span class="obs-src-dot" style="background:var(--blue-primary)"></span><span class="obs-src-text">Feeds</span></button>
      <button class="obs-sev-btn" data-source="spam_trap" style="color:#F59E0B"><span class="obs-src-dot" style="background:#F59E0B"></span><span class="obs-src-text">Spam Trap</span></button>
    </div>
    <div class="obs-layer-toggle" id="obs-layer-toggle">
      <button class="obs-lt-btn active" data-layer="beams">Beams</button>
      <button class="obs-lt-btn active" data-layer="particles">Particles</button>
      <button class="obs-lt-btn active" data-layer="nodes">Nodes</button>
    </div>
    <button class="obs-fullscreen-btn" id="obs-fullscreen-btn" title="Toggle Fullscreen">⛶</button>
    <div class="obs-ticker" id="obs-ticker"></div>
    <div class="obs-brand-overlay" id="obs-brand-overlay" style="display:none">
      <div class="obs-brand-name" id="obs-brand-name"></div>
      <div class="obs-brand-stats" id="obs-brand-stats"></div>
    </div>
  </div>`;

  // ── Clock ────────────────────────────────────────────────────────
  const clockEl = document.getElementById('utc-clock');
  const _tzAbbr = Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || 'LOCAL';
  function _updateClock() { clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + _tzAbbr; }
  _updateClock();
  const clockInterval = setInterval(_updateClock, 1000);

  // ── deck.gl state ────────────────────────────────────────────────
  let currentMode = 1;
  let currentPeriod = '24h';
  let activeSeverities = new Set(['critical', 'high', 'medium', 'low']);
  let currentSourceFilter = 'all';
  let arcData = [], nodeData = [], liveData = [], brandList = [];
  let currentBrandIdx = 0;
  let brandCycleTimer = null;
  let livePoller = null;
  let radarFrame = null;
  let deckgl = null;
  const _isMobile = window.innerWidth < 768;
  let currentViewState = { longitude: _isMobile ? -20 : 15, latitude: _isMobile ? 40 : 25, zoom: _isMobile ? 0.8 : 1.8, pitch: 0, bearing: 0, minZoom: 0, maxZoom: 12 };
  let _brandFocusCache = {};
  let _curParticleLayers    = [];
  let _particlesVisible     = true;

  // ── Particle state ───────────────────────────────────────────────
  let _particles = [];
  let _particleFrame = null;
  let _particleArcs = [];

  // ── Brand HQ coordinates for arc targeting ───────────────────────
  const BRAND_HQ = {
    'amazon':             { lat: 47.6062, lng: -122.3321 },
    'apple':              { lat: 37.3349, lng: -122.0090 },
    'google':             { lat: 37.4220, lng: -122.0841 },
    'microsoft':          { lat: 47.6395, lng: -122.1283 },
    'meta':               { lat: 37.4848, lng: -122.1484 },
    'facebook':           { lat: 37.4848, lng: -122.1484 },
    'instagram':          { lat: 37.4848, lng: -122.1484 },
    'whatsapp':           { lat: 37.4848, lng: -122.1484 },
    'netflix':            { lat: 37.2580, lng: -121.9531 },
    'docusign':           { lat: 37.5202, lng: -122.2554 },
    'adobe':              { lat: 37.3309, lng: -121.8939 },
    'coinbase':           { lat: 37.7749, lng: -122.4194 },
    'disney':             { lat: 34.0577, lng: -118.1764 },
    "lowe's":             { lat: 35.4069, lng: -80.8412  },
    'lowes':              { lat: 35.4069, lng: -80.8412  },
    'roblox':             { lat: 37.7749, lng: -122.4194 },
    'standard chartered': { lat: 51.5074, lng: -0.1278   },
    'paypal':             { lat: 37.3769, lng: -121.9222 },
    'chase':              { lat: 40.7580, lng: -73.9855  },
    'bank of america':    { lat: 35.2271, lng: -80.8431  },
    'wells fargo':        { lat: 37.7749, lng: -122.4194 },
    'dhl':                { lat: 50.9375, lng: 6.9603    },
    'walmart':            { lat: 36.3729, lng: -94.2088  },
    'target':             { lat: 44.9778, lng: -93.2650  },
  };

  // Fuzzy brand HQ lookup — exact match first, then partial/substring match
  function findBrandHQ(brandName) {
    if (!brandName) return null;
    const name = brandName.toLowerCase().trim();
    if (BRAND_HQ[name]) return BRAND_HQ[name];
    for (const [key, hq] of Object.entries(BRAND_HQ)) {
      if (name.includes(key) || key.includes(name)) return hq;
    }
    return null;
  }

  // Zoom-scaled beam width — thin at world zoom, thicker when zoomed in
  function _beamWidth(volume, base) {
    const zoom = currentViewState.zoom ?? 2;
    const w = Math.max(1, Math.min(base, (volume || 1) * 0.3));
    if (zoom < 2) return w * 0.3;
    if (zoom < 3) return w * 0.6;
    return w;
  }

  // Quadratic bezier curve — bows NORTH on flat 2-D map
  function computeBezierPath(srcLng, srcLat, tgtLng, tgtLat, segments = 30) {
    const midLng = (srcLng + tgtLng) / 2;
    const midLat = (srcLat + tgtLat) / 2;
    const dist = Math.sqrt(Math.pow(tgtLng - srcLng, 2) + Math.pow(tgtLat - srcLat, 2));
    const controlLng = midLng;
    const controlLat = midLat + dist * 0.3;
    const path = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const t2 = t * t;
      const mt = 1 - t;
      const mt2 = mt * mt;
      path.push([
        mt2 * srcLng + 2 * mt * t * controlLng + t2 * tgtLng,
        mt2 * srcLat + 2 * mt * t * controlLat + t2 * tgtLat,
      ]);
    }
    return path;
  }

  // Bezier interpolation for particles — matches computeBezierPath curve exactly
  function _bezierInterp(srcLng, srcLat, tgtLng, tgtLat, t) {
    const midLng = (srcLng + tgtLng) / 2;
    const midLat = (srcLat + tgtLat) / 2;
    const dist = Math.sqrt(Math.pow(tgtLng - srcLng, 2) + Math.pow(tgtLat - srcLat, 2));
    const controlLng = midLng;
    const controlLat = midLat + dist * 0.3;
    const mt = 1 - t;
    return [
      mt * mt * srcLng + 2 * mt * t * controlLng + t * t * tgtLng,
      mt * mt * srcLat + 2 * mt * t * controlLat + t * t * tgtLat,
    ];
  }

  function _initParticles(arcs) {
    _particleArcs = arcs;
    _particles = [];
    arcs.forEach((arc, fi) => {
      if (!arc.sourcePosition || !arc.targetPosition) return;
      // Min 3 per arc; ~0.5 per unit of volume
      const n = Math.max(3, Math.ceil((arc.volume || 1) * 0.5));
      for (let i = 0; i < n; i++) {
        _particles.push({
          arc: fi,
          t: Math.random(),
          // ~3–4 seconds per full traverse at 60 fps  (1 / (3.5 * 60) ≈ 0.0048)
          speed: 0.004 + Math.random() * 0.002,
          color: _typeColor(arc.threat_type, 220),
        });
      }
    });
  }

  function _stopParticleLoop() {
    if (_particleFrame) { cancelAnimationFrame(_particleFrame); _particleFrame = null; }
  }

  function _startParticleLoop() {
    _stopParticleLoop();
    if (_particles.length === 0) return;
    function loop() {
      // Advance positions
      _particles.forEach(p => {
        p.t += p.speed;
        if (p.t > 1.05) p.t = -0.05;
      });

      if (deckgl) {
        const base = deckgl.props.layers.filter(l => !l.id.startsWith('particle-'));
        if (!_particlesVisible) {
          // Particles hidden — keep base layers only, skip rendering work
          deckgl.setProps({ layers: base });
          _particleFrame = requestAnimationFrame(loop);
          return;
        }

        const glowData = [], coreData = [];
        _particles.forEach(p => {
          const arc = _particleArcs[p.arc];
          if (!arc) return;
          const tc = Math.max(0, Math.min(1, p.t));
          const [lon, lat] = _bezierInterp(
            arc.sourcePosition[0], arc.sourcePosition[1],
            arc.targetPosition[0], arc.targetPosition[1], tc
          );
          // Outer glow: 6px cyan at 15% opacity
          glowData.push({ pos: [lon, lat], col: [0, 212, 255, 38] });
          // Core dot: 4px bright white
          coreData.push({ pos: [lon, lat], col: [255, 255, 255, 255] });
        });

        _curParticleLayers = [
          new deck.ScatterplotLayer({ id: 'particle-glow', data: glowData, getPosition: d => d.pos, radiusUnits: 'pixels', getRadius: 6, getFillColor: d => d.col }),
          new deck.ScatterplotLayer({ id: 'particle-core', data: coreData, getPosition: d => d.pos, radiusUnits: 'pixels', getRadius: 4, getFillColor: d => d.col }),
        ];
        deckgl.setProps({ layers: [...base, ..._curParticleLayers] });
      }
      _particleFrame = requestAnimationFrame(loop);
    }
    _particleFrame = requestAnimationFrame(loop);
  }

  // ── Color helpers ────────────────────────────────────────────────
  function _typeColor(type, alpha) {
    const a = alpha !== undefined ? alpha : 200;
    const map = {
      phishing:             [255, 45,  85,  a],
      malware_distribution: [255, 107, 53,  a],
      c2:                   [179, 136, 255, a],
      typosquatting:        [255, 182, 39,  a],
      scanning:             [0,   212, 255, a],
      credential_harvesting:[255, 45,  85,  a],
      impersonation:        [255, 107, 53,  a],
    };
    return map[type] || [0, 212, 255, a];
  }
  function _typeColorHex(type) {
    const map = {
      phishing: '#ff2d55', malware_distribution: '#ff6b35',
      c2: '#b388ff', typosquatting: '#ffb627',
      scanning: '#00d4ff', credential_harvesting: '#ff2d55',
      impersonation: '#ff6b35',
    };
    return map[type] || '#00d4ff';
  }
  function _sevColor(sev, alpha) {
    const a = alpha !== undefined ? alpha : 200;
    if (sev === 'critical') return [255, 59,  92,  a];
    if (sev === 'high')     return [255, 107, 53,  a];
    if (sev === 'medium')   return [255, 182, 39,  a];
    return [0, 212, 255, a];
  }
  function _periodToHours(p) {
    if (p === '24h') return 24;
    if (p === '7d')  return 168;
    if (p === '30d') return 720;
    return 8760;
  }

  // ── Initialize deck.gl ───────────────────────────────────────────
  function initDeck() {
    if (typeof deck === 'undefined') {
      console.warn('[Observatory] deck.gl not loaded');
      return;
    }
    const container = document.getElementById('obs-map');
    if (!container) return;

    deckgl = new deck.DeckGL({
      container,
      mapStyle: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      initialViewState: currentViewState,
      controller: true,
      layers: [],
      onViewStateChange: ({ viewState }) => { currentViewState = viewState; },
      getTooltip: ({ object }) => {
        if (!object) return null;
        if (object.volume != null && object.sourcePosition) {
          return {
            html: `<div class="deck-tooltip"><strong>${object.threat_type || 'threat'}</strong><span>Volume: ${object.volume} · ${object.severity || ''}</span></div>`,
            style: { background: 'rgba(10,16,32,0.92)', border: '1px solid rgba(0,212,255,0.4)', borderRadius: '6px', color: '#e8edf5', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', padding: '8px 12px' }
          };
        }
        if (object.threat_count != null) {
          return {
            html: `<div class="deck-tooltip"><strong>${object.top_threat_type || 'threats'}</strong><span>${object.threat_count} threats · ${object.top_severity || ''}</span></div>`,
            style: { background: 'rgba(10,16,32,0.92)', border: '1px solid rgba(0,212,255,0.4)', borderRadius: '6px', color: '#e8edf5', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', padding: '8px 12px' }
          };
        }
        return null;
      },
    });
    _obsMap = deckgl;
  }

  // ── Set layers helper ────────────────────────────────────────────
  function setLayers(layers) {
    if (deckgl) deckgl.setProps({ layers });
  }

  // ── Data fetching ────────────────────────────────────────────────
  async function fetchData() {
    try {
      const srcParam = currentSourceFilter !== 'all' ? `&source_feed=${currentSourceFilter}` : '';
      const [nodesRes, arcsRes, statsRes] = await Promise.all([
        api(`/observatory/nodes?period=${currentPeriod}${srcParam}`).catch(() => null),
        api(`/observatory/arcs?period=${currentPeriod}&limit=50${srcParam}`).catch(() => null),
        api(`/observatory/stats?period=${currentPeriod}${srcParam}`).catch(() => null),
      ]);

      const allNodes = nodesRes?.data || [];
      const allArcs  = arcsRes?.data  || [];
      nodeData = allNodes.filter(n => activeSeverities.has(n.top_severity || 'low'));
      arcData  = allArcs
        .filter(a => activeSeverities.has(a.severity || 'low'))
        .map(a => {
          // Override target with precise brand HQ if we know the brand
          const hq = findBrandHQ(a.brand_name || a.target_brand);
          const tgt = hq ? [hq.lng, hq.lat] : a.targetPosition;
          return {
            ...a,
            targetPosition: tgt,
            bezierPath: computeBezierPath(a.sourcePosition[0], a.sourcePosition[1], tgt[0], tgt[1]),
          };
        });

      // DEBUG: verify brand HQ matching
      arcData.slice(0, 10).forEach(a => {
        const raw = a.brand_name || a.target_brand;
        console.log(`[Observatory] Arc: brand="${raw}" target=[${a.targetPosition?.[0]?.toFixed(2)}, ${a.targetPosition?.[1]?.toFixed(2)}] matched_hq=${!!findBrandHQ(raw)}`);
      });

      const s = statsRes?.data || {};
      document.getElementById('stat-bar').innerHTML = [
        renderStatChip('⚠', 'threats',   s.threats_mapped    || 0, 'Threats Mapped',      null),
        renderStatChip('🌍', 'countries', s.countries         || 0, 'Countries',           null),
        renderStatChip('🎯', 'campaigns', s.active_campaigns  || 0, 'Active Campaigns',    null),
        renderStatChip('⭐', 'brands',    s.brands_monitored  || 0, 'Brands Monitored',    null),
      ].join('');

      updateMap();
    } catch (err) {
      console.error('[Observatory] fetchData:', err);
    }
  }

  async function fetchLive() {
    try {
      const res = await api('/observatory/live').catch(() => null);
      liveData = res?.data || [];
      updateTicker();
    } catch {}
  }

  // ── Map update dispatcher ────────────────────────────────────────
  function updateMap() {
    _stopParticleLoop();
    stopRadar();
    if      (currentMode === 1) renderMultiStream();
    else if (currentMode === 2) renderLiveFeed();
    else if (currentMode === 3) renderCorridors();
    else if (currentMode === 4) renderBrandFocus();
    else if (currentMode === 5) renderRadarSweep();
  }

  // ────────────────────────────────────────────────────────────────
  // MODE 1 — MULTI-STREAM
  // ────────────────────────────────────────────────────────────────
  function renderMultiStream() {
    if (!deckgl) return;
    document.getElementById('obs-brand-overlay').style.display = 'none';
    document.getElementById('obs-ticker').style.display = 'none';

    // Deduplicate target nodes
    const targetSet = {};
    arcData.forEach(a => { const k = a.targetPosition.join(','); if (!targetSet[k]) targetSet[k] = a; });
    const targetNodes = Object.values(targetSet);

    setLayers([
      // Node bloom (outer glow ring)
      new deck.ScatterplotLayer({
        id: 'nodes-bloom',
        data: nodeData,
        getPosition: d => [d.lng, d.lat],
        getRadius: d => Math.sqrt(Math.max(1, d.threat_count)) * 15000,
        getFillColor: d => _sevColor(d.top_severity, 18),
        radiusMinPixels: 10, radiusMaxPixels: 80,
      }),
      // Node mid glow
      new deck.ScatterplotLayer({
        id: 'nodes-glow',
        data: nodeData,
        getPosition: d => [d.lng, d.lat],
        getRadius: d => Math.sqrt(Math.max(1, d.threat_count)) * 8000,
        getFillColor: d => _sevColor(d.top_severity, 40),
        radiusMinPixels: 6, radiusMaxPixels: 50,
      }),
      // Source nodes (solid core)
      new deck.ScatterplotLayer({
        id: 'nodes',
        data: nodeData,
        getPosition: d => [d.lng, d.lat],
        getRadius: d => Math.sqrt(Math.max(1, d.threat_count)) * 4000,
        getFillColor: d => _sevColor(d.top_severity, 200),
        getLineColor: d => _sevColor(d.top_severity, 255),
        lineWidthMinPixels: 1, stroked: true, filled: true,
        radiusMinPixels: 3, radiusMaxPixels: 28,
        pickable: true,
        transitions: { getFillColor: 300, getRadius: 300 },
      }),
      // Bezier paths — glow pass (~4% opacity, zoom-scaled width)
      new deck.PathLayer({
        id: 'beam-glow-multistream',
        data: arcData,
        getPath: d => d.bezierPath,
        getColor: d => _typeColor(d.threat_type, 10),
        getWidth: d => _beamWidth(d.volume, 6),
        widthUnits: 'pixels',
        widthMinPixels: 1, widthMaxPixels: 4,
      }),
      // Bezier paths — core pass (~14% opacity, zoom-scaled width)
      new deck.PathLayer({
        id: 'beam-core-multistream',
        data: arcData,
        getPath: d => d.bezierPath,
        getColor: d => _typeColor(d.threat_type, 35),
        getWidth: d => _beamWidth(d.volume, 2),
        widthUnits: 'pixels',
        widthMinPixels: 1, widthMaxPixels: 2,
        pickable: true,
      }),
      // Target nodes (pulsing destination rings)
      new deck.ScatterplotLayer({
        id: 'targets-ring',
        data: targetNodes,
        getPosition: d => d.targetPosition,
        getRadius: 20000,
        getFillColor: [255, 255, 255, 8],
        getLineColor: [255, 255, 255, 60],
        lineWidthMinPixels: 1, stroked: true,
        radiusMinPixels: 4, radiusMaxPixels: 22,
      }),
      new deck.ScatterplotLayer({
        id: 'targets',
        data: targetNodes,
        getPosition: d => d.targetPosition,
        getRadius: 6000,
        getFillColor: [255, 255, 255, 60],
        radiusMinPixels: 2, radiusMaxPixels: 8,
      }),
    ]);
    _initParticles(arcData);
    _startParticleLoop();
  }

  // ────────────────────────────────────────────────────────────────
  // MODE 2 — LIVE FEED  (same arcs + animated ticker)
  // ────────────────────────────────────────────────────────────────
  function renderLiveFeed() {
    if (!deckgl) return;
    document.getElementById('obs-brand-overlay').style.display = 'none';
    document.getElementById('obs-ticker').style.display = 'block';
    renderMultiStream();
    updateTicker();
  }

  function updateTicker() {
    const ticker = document.getElementById('obs-ticker');
    if (!ticker || liveData.length === 0) return;
    const items = liveData.map(t =>
      `<span class="ticker-item"><span class="ticker-dot" style="background:${_typeColorHex(t.threat_type)}"></span>${t.malicious_domain || t.ioc_value || 'unknown'} <span class="ticker-arrow">→</span> ${t.threat_type} <span class="ticker-arrow">→</span> ${t.country_code || '??'} <span class="ticker-arrow">·</span> ${t.created_at ? new Date(t.created_at).toLocaleTimeString() : ''}</span>`
    ).join('&nbsp;&nbsp;');
    ticker.innerHTML = `<div class="ticker-inner">${items}&nbsp;&nbsp;&nbsp;&nbsp;${items}</div>`;
    ticker.style.display = 'block';
  }

  // ────────────────────────────────────────────────────────────────
  // MODE 3 — CORRIDORS  (thick glowing bands, top 15 routes)
  // ────────────────────────────────────────────────────────────────
  function renderCorridors() {
    if (!deckgl) return;
    document.getElementById('obs-brand-overlay').style.display = 'none';
    document.getElementById('obs-ticker').style.display = 'none';

    const top15 = arcData.slice(0, 15);

    setLayers([
      // Bezier paths — glow pass (~4% opacity, zoom-scaled width)
      new deck.PathLayer({
        id: 'beam-glow-corridor',
        data: top15,
        getPath: d => d.bezierPath,
        getColor: d => _typeColor(d.threat_type, 10),
        getWidth: d => _beamWidth(d.volume, 6),
        widthUnits: 'pixels',
        widthMinPixels: 1, widthMaxPixels: 4,
      }),
      // Bezier paths — core pass (~14% opacity, zoom-scaled width)
      new deck.PathLayer({
        id: 'beam-core-corridor',
        data: top15,
        getPath: d => d.bezierPath,
        getColor: d => _typeColor(d.threat_type, 35),
        getWidth: d => _beamWidth(d.volume, 4),
        widthUnits: 'pixels',
        widthMinPixels: 1, widthMaxPixels: 3,
        pickable: true,
      }),
      // Source labels
      new deck.TextLayer({
        id: 'corridor-src-labels',
        data: top15,
        getPosition: d => d.sourcePosition,
        getText: d => (d.source_region && d.source_region !== 'Unknown') ? d.source_region : '',
        getSize: 11,
        getColor: [200, 210, 225, 200],
        getPixelOffset: [0, -16],
        fontFamily: '"IBM Plex Mono", monospace',
        background: true,
        getBackgroundColor: [6, 10, 24, 200],
        backgroundPadding: [4, 2],
        characterSet: 'auto',
      }),
      // Target labels
      new deck.TextLayer({
        id: 'corridor-tgt-labels',
        data: top15,
        getPosition: d => d.targetPosition,
        getText: d => (d.target_brand && d.target_brand !== 'Unknown') ? d.target_brand : '',
        getSize: 11,
        getColor: [255, 59, 92, 220],
        getPixelOffset: [0, -16],
        fontFamily: '"IBM Plex Mono", monospace',
        background: true,
        getBackgroundColor: [6, 10, 24, 200],
        backgroundPadding: [4, 2],
        characterSet: 'auto',
      }),
      // Volume labels at midpoints
      new deck.TextLayer({
        id: 'corridor-vol',
        data: top15,
        getPosition: d => [
          (d.sourcePosition[0] + d.targetPosition[0]) / 2,
          (d.sourcePosition[1] + d.targetPosition[1]) / 2,
        ],
        getText: d => `×${d.volume}`,
        getSize: 10,
        getColor: [255, 255, 255, 180],
        fontFamily: '"IBM Plex Mono", monospace',
        background: true,
        getBackgroundColor: [6, 10, 24, 200],
        backgroundPadding: [4, 2],
        characterSet: 'auto',
      }),
      // Source/target nodes
      new deck.ScatterplotLayer({
        id: 'nodes-corridor',
        data: nodeData.slice(0, 40),
        getPosition: d => [d.lng, d.lat],
        getRadius: d => Math.sqrt(Math.max(1, d.threat_count)) * 4000,
        getFillColor: d => _sevColor(d.top_severity, 180),
        getLineColor: d => _sevColor(d.top_severity, 255),
        lineWidthMinPixels: 1, stroked: true,
        radiusMinPixels: 3, radiusMaxPixels: 22,
        pickable: true,
      }),
    ]);
    _initParticles(top15);
    _startParticleLoop();
  }

  // ────────────────────────────────────────────────────────────────
  // MODE 4 — BRAND FOCUS  (cycles top 5 brands every 8s)
  // ────────────────────────────────────────────────────────────────
  async function renderBrandFocus() {
    if (!deckgl) return;
    document.getElementById('obs-ticker').style.display = 'none';

    if (brandList.length === 0) {
      try {
        const res = await api('/brands?sort=threats&limit=5').catch(() => null);
        brandList = res?.data?.brands || res?.data || [];
      } catch {}
    }
    if (brandList.length === 0) {
      document.getElementById('obs-brand-overlay').style.display = 'none';
      return;
    }

    async function showBrand(idx) {
      const brand = brandList[idx % brandList.length];
      if (!brand) return;

      const overlay  = document.getElementById('obs-brand-overlay');
      const nameEl   = document.getElementById('obs-brand-name');
      const statsEl  = document.getElementById('obs-brand-stats');
      overlay.style.display = 'block';
      nameEl.textContent = `${(brand.name || '').toUpperCase()} — UNDER ATTACK`;

      const bid = brand.brand_id || brand.id;
      let bArcs = _brandFocusCache[bid];
      if (!bArcs) {
        try {
          const res = await api(`/observatory/brand-arcs?brand_id=${bid}&period=${currentPeriod}`).catch(() => null);
          const raw = res?.data || [];
          // Precompute bezier paths; override target with brand HQ if known
          const brandHQ = findBrandHQ(brand.name);
          bArcs = raw.map(a => {
            const tgt = brandHQ ? [brandHQ.lng, brandHQ.lat] : a.targetPosition;
            return {
              ...a,
              targetPosition: tgt,
              bezierPath: computeBezierPath(a.sourcePosition[0], a.sourcePosition[1], tgt[0], tgt[1]),
            };
          });
          _brandFocusCache[bid] = bArcs;
        } catch { bArcs = []; }
      }

      const srcCount     = new Set(bArcs.map(a => a.sourcePosition?.join(','))).size;
      const countryCount = new Set(bArcs.map(a => a.country_code).filter(Boolean)).size;
      const totalVol     = bArcs.reduce((s, a) => s + (a.volume || 1), 0);
      statsEl.textContent = `${srcCount} attack sources · ${totalVol} threats · ${countryCount} countries`;

      const targetPos = bArcs[0]?.targetPosition || [-74.0, 40.7];

      setLayers([
        // Crosshair outer ring
        new deck.ScatterplotLayer({
          id: 'target-xhair-outer',
          data: [{ pos: targetPos }],
          getPosition: d => d.pos,
          getRadius: 120000,
          getFillColor: [255, 59, 92, 8],
          getLineColor: [255, 59, 92, 80],
          lineWidthMinPixels: 1, stroked: true,
          radiusMinPixels: 30, radiusMaxPixels: 120,
        }),
        // Crosshair inner ring (pulsing effect via second layer offset)
        new deck.ScatterplotLayer({
          id: 'target-xhair-inner',
          data: [{ pos: targetPos }],
          getPosition: d => d.pos,
          getRadius: 40000,
          getFillColor: [255, 59, 92, 20],
          getLineColor: [255, 59, 92, 200],
          lineWidthMinPixels: 2, stroked: true,
          radiusMinPixels: 8, radiusMaxPixels: 40,
        }),
        // Bezier paths — glow pass (~4% opacity, zoom-scaled width)
        new deck.PathLayer({
          id: 'beam-glow-brand',
          data: bArcs,
          getPath: d => d.bezierPath,
          getColor: d => _typeColor(d.threat_type, 10),
          getWidth: d => _beamWidth(d.volume, 6),
          widthUnits: 'pixels',
          widthMinPixels: 1, widthMaxPixels: 4,
        }),
        // Bezier paths — core pass (~14% opacity, zoom-scaled width)
        new deck.PathLayer({
          id: 'beam-core-brand',
          data: bArcs,
          getPath: d => d.bezierPath,
          getColor: d => _typeColor(d.threat_type, 35),
          getWidth: d => _beamWidth(d.volume, 2),
          widthUnits: 'pixels',
          widthMinPixels: 1, widthMaxPixels: 2,
          pickable: true,
        }),
        // Source nodes
        new deck.ScatterplotLayer({
          id: 'nodes-brand-glow',
          data: bArcs,
          getPosition: d => d.sourcePosition,
          getRadius: 20000,
          getFillColor: d => _typeColor(d.threat_type, 25),
          radiusMinPixels: 5, radiusMaxPixels: 20,
        }),
        new deck.ScatterplotLayer({
          id: 'nodes-brand',
          data: bArcs,
          getPosition: d => d.sourcePosition,
          getRadius: 7000,
          getFillColor: d => _typeColor(d.threat_type, 200),
          getLineColor: [255, 255, 255, 80],
          stroked: true, lineWidthMinPixels: 1,
          radiusMinPixels: 3, radiusMaxPixels: 12,
          pickable: true,
        }),
        // Source city labels
        new deck.TextLayer({
          id: 'brand-src-labels',
          data: bArcs,
          getPosition: d => d.sourcePosition,
          getText: d => (d.source_region && d.source_region !== 'Unknown') ? d.source_region : '',
          getSize: 10,
          getColor: [200, 210, 225, 180],
          getPixelOffset: [0, -15],
          fontFamily: '"IBM Plex Mono", monospace',
          background: true,
          getBackgroundColor: [6, 10, 24, 190],
          backgroundPadding: [3, 2],
          characterSet: 'auto',
        }),
      ]);
      _initParticles(bArcs);
      _startParticleLoop();
    }

    showBrand(currentBrandIdx);
    if (brandCycleTimer) clearInterval(brandCycleTimer);
    brandCycleTimer = setInterval(() => {
      currentBrandIdx = (currentBrandIdx + 1) % Math.max(1, brandList.length);
      showBrand(currentBrandIdx);
    }, 8000);
  }

  // ────────────────────────────────────────────────────────────────
  // MODE 5 — RADAR SWEEP  (rotating sweep from HQ + illumination)
  // ────────────────────────────────────────────────────────────────
  const HQ_POS = [-79.38, 43.65]; // Trust Radar HQ — Toronto, Canada

  function stopRadar() {
    _stopParticleLoop();
    if (radarFrame) { cancelAnimationFrame(radarFrame); radarFrame = null; }
    if (brandCycleTimer) { clearInterval(brandCycleTimer); brandCycleTimer = null; }
    const rc = document.querySelector('.radar-canvas');
    if (rc) rc.remove();
  }

  function renderRadarSweep() {
    if (!deckgl) return;
    document.getElementById('obs-brand-overlay').style.display = 'none';
    document.getElementById('obs-ticker').style.display = 'none';

    // Range rings via large stroked scatter points
    const rings = [2000000, 5000000, 10000000]; // meters
    setLayers([
      ...rings.map((r, i) => new deck.ScatterplotLayer({
        id: `radar-ring-${i}`,
        data: [{ pos: HQ_POS }],
        getPosition: d => d.pos,
        getRadius: r,
        getFillColor: [0, 0, 0, 0],
        getLineColor: [0, 212, 255, 25],
        lineWidthMinPixels: 1,
        stroked: true, filled: false,
        radiusMinPixels: 30,
      })),
      // HQ glow
      new deck.ScatterplotLayer({
        id: 'radar-hq-glow',
        data: [{ pos: HQ_POS }],
        getPosition: d => d.pos,
        getRadius: 80000,
        getFillColor: [0, 212, 255, 15],
        getLineColor: [0, 212, 255, 150],
        lineWidthMinPixels: 2, stroked: true,
        radiusMinPixels: 6,
      }),
      // Threat nodes (dim — will be lit by canvas sweep)
      new deck.ScatterplotLayer({
        id: 'nodes-radar',
        data: nodeData,
        getPosition: d => [d.lng, d.lat],
        getRadius: d => Math.sqrt(Math.max(1, d.threat_count)) * 5000,
        getFillColor: d => _sevColor(d.top_severity, 40),
        getLineColor: d => _sevColor(d.top_severity, 70),
        stroked: true, lineWidthMinPixels: 1,
        radiusMinPixels: 2, radiusMaxPixels: 14,
      }),
    ]);

    // Canvas sweep overlay
    const mapWrap = document.getElementById('map-wrap');
    let radarCanvas = document.createElement('canvas');
    radarCanvas.className = 'radar-canvas';
    radarCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    mapWrap.appendChild(radarCanvas);

    let sweepAngle = -Math.PI / 2; // start at top (north)
    const illuminated = new Map(); // nodeIndex → opacity 0-1

    function animateRadar() {
      if (currentMode !== 5 || !deckgl) {
        radarCanvas.remove();
        return;
      }
      radarFrame = requestAnimationFrame(animateRadar);

      radarCanvas.width  = mapWrap.offsetWidth;
      radarCanvas.height = mapWrap.offsetHeight;
      const ctx = radarCanvas.getContext('2d');
      ctx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);

      // Project HQ using WebMercatorViewport
      let hqScreen = null;
      try {
        const vp = new deck.WebMercatorViewport({
          width: radarCanvas.width, height: radarCanvas.height,
          longitude: currentViewState.longitude, latitude: currentViewState.latitude,
          zoom: currentViewState.zoom, pitch: currentViewState.pitch || 0,
          bearing: currentViewState.bearing || 0,
        });
        hqScreen = vp.project(HQ_POS);

        // Draw sweep wedge
        const sweepSpan = Math.PI / 9; // 20°
        const maxR = Math.max(radarCanvas.width, radarCanvas.height) * 1.5;
        const cx = hqScreen[0], cy = hqScreen[1];

        // Fading trail wedge
        for (let i = 6; i >= 0; i--) {
          const trailAngle = sweepAngle - (sweepSpan * 0.15 * i);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, maxR, trailAngle - sweepSpan * 0.15, trailAngle, false);
          ctx.closePath();
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.7);
          const trailAlpha = Math.max(0, 0.18 - i * 0.025);
          grd.addColorStop(0, `rgba(0,212,255,${trailAlpha})`);
          grd.addColorStop(1, 'rgba(0,212,255,0)');
          ctx.fillStyle = grd;
          ctx.fill();
          ctx.restore();
        }

        // Leading edge glow wedge
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, sweepAngle - sweepSpan, sweepAngle, false);
        ctx.closePath();
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        grd.addColorStop(0, 'rgba(0,212,255,0.30)');
        grd.addColorStop(0.4, 'rgba(0,212,255,0.14)');
        grd.addColorStop(1, 'rgba(0,212,255,0)');
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.restore();

        // Leading edge line
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
        ctx.strokeStyle = 'rgba(0,212,255,0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // HQ marker — pulsing dot
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 10 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${0.08 + pulse * 0.06})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${0.7 + pulse * 0.3})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#00d4ff';
        ctx.fill();
        ctx.restore();

        // Check node illumination & draw lit nodes on canvas
        nodeData.forEach((node, i) => {
          const ns = vp.project([node.lng, node.lat]);
          if (!ns) return;
          const dx = ns[0] - cx, dy = ns[1] - cy;
          const nodeAngle = Math.atan2(dy, dx);
          let diff = ((nodeAngle - sweepAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (diff > Math.PI) diff -= Math.PI * 2;
          if (Math.abs(diff) < sweepSpan * 1.2) illuminated.set(i, 1.0);
        });

        illuminated.forEach((opacity, i) => {
          if (opacity <= 0) { illuminated.delete(i); return; }
          const node = nodeData[i];
          const ns = vp.project([node.lng, node.lat]);
          if (!ns) return;
          const color = _sevColor(node.top_severity, 255);
          ctx.save();
          ctx.globalAlpha = opacity * 0.9;
          ctx.beginPath();
          ctx.arc(ns[0], ns[1], 7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.25)`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ns[0], ns[1], 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
          ctx.fill();
          ctx.restore();
          illuminated.set(i, opacity - 0.007);
        });

      } catch (e) { /* viewport not ready yet */ }

      sweepAngle += (Math.PI * 2) / (60 * 10); // full rotation in 10s at ~60fps
      if (sweepAngle > Math.PI) sweepAngle -= Math.PI * 2;
    }

    radarFrame = requestAnimationFrame(animateRadar);
  }

  // ── Controls setup ───────────────────────────────────────────────
  function setupControls() {
    // Filter toggle button
    const filtersToggle = document.getElementById('obs-filters-toggle');
    if (filtersToggle) {
      filtersToggle.addEventListener('click', () => {
        const targets = ['obs-time-filter', 'obs-sev-filter', 'obs-layer-toggle'];
        const els = targets.map(id => document.getElementById(id)).filter(Boolean);
        const hidden = els.some(el => el.style.display === 'none');
        els.forEach(el => el.style.display = hidden ? '' : 'none');
        filtersToggle.classList.toggle('active', hidden);
      });
    }

    // Mode selector
    document.querySelectorAll('.obs-mode-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.obs-mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = parseInt(btn.dataset.mode);
        currentBrandIdx = 0;
        stopRadar();
        if (brandCycleTimer) { clearInterval(brandCycleTimer); brandCycleTimer = null; }
        updateMap();
        if (currentMode === 2) {
          fetchLive();
          if (livePoller) clearInterval(livePoller);
          livePoller = setInterval(fetchLive, 10000);
        } else {
          if (livePoller) { clearInterval(livePoller); livePoller = null; }
          document.getElementById('obs-ticker').style.display = 'none';
        }
      });
    });

    // Time filter
    document.querySelectorAll('.obs-tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.obs-tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPeriod = btn.dataset.period;
        _brandFocusCache = {};
        fetchData();
      });
    });

    // Severity filter
    document.querySelectorAll('#obs-sev-filter .obs-sev-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const sev = btn.dataset.sev;
        if (btn.classList.contains('active')) activeSeverities.add(sev);
        else activeSeverities.delete(sev);
        fetchData();
      });
    });

    // Source filter (All Sources / Feeds / Spam Trap)
    document.querySelectorAll('#obs-source-filter .obs-sev-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#obs-source-filter .obs-sev-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSourceFilter = btn.dataset.source;
        fetchData();
      });
    });

    // Layer toggles
    document.getElementById('map-wrap').addEventListener('click', e => {
      const btn = e.target.closest('[data-layer]');
      if (!btn) return;
      const layer = btn.dataset.layer;
      btn.classList.toggle('active');
      const isActive = btn.classList.contains('active');
      if (!deckgl) return;
      if (layer === 'particles') {
        // rAF loop reads _particlesVisible each frame — no layer manipulation needed here
        _particlesVisible = isActive;
        return;
      }
      console.log('[Observatory] Toggle layers:', deckgl.props.layers.map(l => `${l.id}(vis:${l.props?.visible ?? true})`));
      const updatedLayers = deckgl.props.layers.map(l => {
        const id = l.id || '';
        let shouldToggle = false;
        if (layer === 'beams')   shouldToggle = id.startsWith('beam-');
        if (layer === 'nodes')   shouldToggle = id.startsWith('node') || id.startsWith('target');
        if (!shouldToggle) return l;
        try { return l.clone({ visible: isActive }); }
        catch (_) { return new l.constructor({ ...l.props, visible: isActive }); }
      });
      deckgl.setProps({ layers: updatedLayers });
    });

    // Fullscreen
    const fsBtn = document.getElementById('obs-fullscreen-btn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        const mapWrap = document.getElementById('map-wrap');
        if (!document.fullscreenElement) {
          mapWrap.requestFullscreen?.().catch(() => {});
          fsBtn.title = 'Exit Fullscreen';
          fsBtn.textContent = '⊡';
        } else {
          document.exitFullscreen?.();
          fsBtn.title = 'Toggle Fullscreen';
          fsBtn.textContent = '⛶';
        }
      });
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
          fsBtn.textContent = '⛶';
          fsBtn.title = 'Toggle Fullscreen';
        }
      });
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────
  window._viewCleanup = () => {
    clearInterval(clockInterval);
    if (livePoller)      clearInterval(livePoller);
    if (brandCycleTimer) clearInterval(brandCycleTimer);
    if (_obsPoller)      clearInterval(_obsPoller);
    _stopParticleLoop();
    stopRadar();
    if (deckgl) { try { deckgl.finalize(); } catch {} deckgl = null; }
    _obsMap = null;
    _obsPoller = null;
  };

  // ── Boot ─────────────────────────────────────────────────────────
  initDeck();
  setupControls();

  // DEBUG: verify toggle buttons exist in DOM and have event listeners attached
  document.querySelectorAll('.obs-lt-btn').forEach(el =>
    console.log('[Observatory] Toggle DOM:', el.textContent.trim(), '| data-layer:', el.dataset.layer, '| has onclick prop:', !!el.onclick, '| in document:', document.contains(el))
  );

  try {
    const [stats, topBrands, worstProv, improvingProv, insights] = await Promise.all([
      api('/dashboard/overview').catch(() => null),
      api('/dashboard/top-brands?limit=10').catch(() => null),
      api('/dashboard/providers?sort=worst&limit=5').catch(() => null),
      api('/dashboard/providers?sort=improving&limit=3').catch(() => null),
      api('/insights/latest?limit=5').catch(() => null),
    ]);

    const d = stats?.data || {};
    const fc = document.getElementById('feed-count');
    if (fc) fc.textContent = d.feed_health?.active || 0;

    // ── Sidebar (unchanged) ────────────────────────────────────────
    const sidebar = document.getElementById('obs-sidebar');
    if (sidebar) {
      const brandRows = (topBrands?.data || []).map((b, i) => {
        const color = b.threat_count > 50 ? 'var(--threat-critical)' : b.threat_count > 20 ? 'var(--threat-high)' : 'var(--blue-primary)';
        return `<a href="/brands/${b.brand_id || b.id}" class="sidebar-brand-row">
          <span class="rank">${i + 1}</span>
          ${_brandLogoImg(b.name, 28)}
          <div class="brand-info"><div class="brand-name">${b.name}</div><div class="brand-sector">${b.sector || ''}</div></div>
          <span class="threat-count" style="color:${color}">${b.threat_count}</span>
        </a>`;
      }).join('') || '<div class="empty-state"><div class="message">No brands yet</div></div>';

      const worstRows = (worstProv?.data || []).map(p =>
        `<a href="/providers/${encodeURIComponent(p.provider_id || p.name)}" class="sidebar-provider-row">
          ${_providerLogoImg(p.name, 22)}
          <div class="prov-info"><div class="prov-name">${p.name}</div><div class="prov-asn">${p.asn || ''}</div></div>
          <span class="prov-count">${p.threat_count}</span>
          <span class="prov-trend" style="color:var(--negative)">${p.trend_7d_pct >= 0 ? '+' : ''}${p.trend_7d_pct || 0}%</span>
        </a>`
      ).join('');

      const improvingRows = (improvingProv?.data || []).map(p =>
        `<a href="/providers/${encodeURIComponent(p.provider_id || p.name)}" class="sidebar-provider-row">
          ${_providerLogoImg(p.name, 22)}
          <div class="prov-info"><div class="prov-name">${p.name}</div><div class="prov-asn">${p.asn || ''}</div></div>
          <span class="prov-count">${p.threat_count}</span>
          <span class="prov-trend" style="color:var(--positive)">${p.trend_7d_pct || 0}%</span>
        </a>`
      ).join('');

      const insightItems = (insights?.data || []).map(ins => {
        const colors = { sentinel: 'var(--blue-primary)', analyst: 'var(--positive)', cartographer: 'var(--threat-medium)', strategist: 'var(--negative)', observer: '#b388ff' };
        let linkBrand = null;
        try { if (ins.related_brand_ids) { const ids = JSON.parse(ins.related_brand_ids); if (ids.length) linkBrand = ids[0]; } } catch {}
        const linkCampaign = ins.related_campaign_id || null;
        const href = linkBrand ? `/brands/${linkBrand}` : linkCampaign ? `/campaigns/${linkCampaign}` : null;
        const clickAttr = href ? `onclick="navigate('${href}'); return false;" style="cursor:pointer"` : '';
        const text = (ins.summary_text || '').replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>');
        return `<div class="sidebar-insight" ${clickAttr}>
          <div class="si-top"><span class="si-agent" style="color:${colors[ins.agent_name] || 'var(--text-secondary)'}">${ins.agent_name}</span><span class="sev ${ins.severity}">${ins.severity}</span></div>
          <div class="si-text">${text}</div>
        </div>`;
      }).join('') || '<div class="empty-state"><div class="message">No insights yet</div></div>';

      sidebar.innerHTML =
        renderPanel('Top Targeted Brands', (topBrands?.data || []).length, brandRows) +
        renderPanel('Hosting Providers', null,
          (worstRows ? '<div class="sidebar-divider">Worst Actors</div>' + worstRows : '') +
          (improvingRows ? '<div class="sidebar-divider">Improving</div>' + improvingRows : '') ||
          '<div class="empty-state"><div class="message">No data</div></div>') +
        renderPanel('Agent Intelligence', (insights?.data || []).length, insightItems);
      _attachLogoFallbacks(sidebar);
    }

    // Store brand list for mode 4
    brandList = topBrands?.data || [];
  } catch (err) {
    showToast(err.message || 'Observatory load failed', 'error');
  }

  // Fetch map data (nodes + arcs)
  await fetchData();

  // Live polling — flash new threats
  let lastPollTime = new Date().toISOString();
  _obsPoller = setInterval(async () => {
    try {
      const recent = await api(`/threats/recent?since=${encodeURIComponent(lastPollTime)}&limit=10`);
      if (recent?.data?.length > 0) {
        lastPollTime = new Date().toISOString();
        if (deckgl && (currentMode === 1 || currentMode === 2)) {
          const flashData = recent.data.filter(t => t.lat && t.lng);
          if (flashData.length > 0) {
            const flashId = 'flash-' + Date.now();
            const flashLayer = new deck.ScatterplotLayer({
              id: flashId,
              data: flashData,
              getPosition: d => [d.lng, d.lat],
              getRadius: 40000,
              getFillColor: [0, 212, 255, 60],
              getLineColor: [0, 212, 255, 180],
              stroked: true, lineWidthMinPixels: 2,
              radiusMinPixels: 8,
            });
            if (deckgl) deckgl.setProps({ layers: [...deckgl.props.layers, flashLayer] });
            setTimeout(() => {
              if (deckgl) deckgl.setProps({ layers: deckgl.props.layers.filter(l => l.id !== flashId) });
            }, 2500);
          }
        }
      }
    } catch { /* silent */ }
  }, 15000);
}

// ─── View: Brands Hub (Step 9) ──────────────────────────────
let _brandsSubTab = 'top-targeted';
let _brandsPeriod = '24h';

function _brandInitials(name) { return (name || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(); }
const LOGO_DOMAINS = {
  'Standard Chartered': 'sc.com',
  'WhatsApp': 'whatsapp.com',
  'Instagram': 'instagram.com',
  'DocuSign': 'docusign.com',
  'PayPal': 'paypal.com',
  'LinkedIn': 'linkedin.com',
  'YouTube': 'youtube.com',
  'TikTok': 'tiktok.com',
  'AT&T': 'att.com',
};
function _brandLogoDomain(name) {
  if (LOGO_DOMAINS[name]) return LOGO_DOMAINS[name];
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
}
function _brandLogoImg(name, size, initials) {
  const domain = _brandLogoDomain(name);
  const init = initials || _brandInitials(name);
  return `<img class="brand-logo-img" src="https://www.google.com/s2/favicons?domain=${domain}&sz=128" data-domain="${domain}" data-initials="${init}" width="${size}" height="${size}" style="border-radius:6px;object-fit:contain;background:#0d1528;display:block" alt="${init}">`;
}
function _attachLogoFallbacks(container) {
  (container || document).querySelectorAll('.brand-logo-img').forEach(img => {
    img.onerror = function() {
      if (!this.dataset.fallback) {
        this.dataset.fallback = '1';
        this.src = 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://' + this.dataset.domain + '&size=128';
      } else {
        this.outerHTML = '<div class="brand-icon" style="width:' + this.width + 'px;height:' + this.height + 'px;font-size:' + Math.round(this.width * 0.45) + 'px">' + this.dataset.initials + '</div>';
      }
    };
  });
}
// ─── Provider Logo Functions ─────────────────────────────────────
const PROVIDER_LOGO_DOMAINS = {
  'Cloudflare': 'cloudflare.com',
  'Amazon AWS': 'aws.amazon.com',
  'Amazon.com, Inc.': 'aws.amazon.com',
  'Microsoft Azure': 'azure.microsoft.com',
  'Microsoft Corporation': 'microsoft.com',
  'Google': 'google.com',
  'Google LLC': 'google.com',
  'Google Cloud': 'cloud.google.com',
  'GoDaddy': 'godaddy.com',
  'GoDaddy.com, LLC': 'godaddy.com',
  'Fastly': 'fastly.com',
  'Fastly, Inc.': 'fastly.com',
  'DigitalOcean': 'digitalocean.com',
  'OVH': 'ovh.com',
  'OVHcloud': 'ovh.com',
  'Hetzner': 'hetzner.com',
  'Namecheap': 'namecheap.com',
  'Weebly': 'weebly.com',
  'Weebly, Inc.': 'weebly.com',
  'Vercel': 'vercel.com',
  'Netlify': 'netlify.com',
  'Hooray Solutions': 'yourhosting.nl',
  'Protocol Labs': 'protocol.ai',
  'Neon Core Network': 'neoncore.net',
  'UltaHost': 'ultahost.com',
  'Hostinger': 'hostinger.com',
  'Vultr': 'vultr.com',
  'Linode': 'linode.com',
  'Linode/Akamai': 'linode.com',
  'Akamai': 'akamai.com',
  'Contabo': 'contabo.com',
  'Bluehost': 'bluehost.com',
  'HostGator': 'hostgator.com',
  'SiteGround': 'siteground.com',
  'DreamHost': 'dreamhost.com',
  'Hostwinds': 'hostwinds.com',
  '1&1 IONOS': 'ionos.com',
  'Alibaba Cloud': 'alibabacloud.com',
  'Tencent Cloud': 'cloud.tencent.com',
  'Oracle Cloud': 'oracle.com',
  'Leaseweb': 'leaseweb.com',
  'Choopa/Vultr': 'vultr.com',
};
function _providerLogoDomain(name) {
  if (PROVIDER_LOGO_DOMAINS[name]) return PROVIDER_LOGO_DOMAINS[name];
  const clean = (name || '').replace(/,?\s*(Inc\.?|LLC|Corp\.?|Ltd\.?|GmbH|S\.?A\.?|Co\.?)$/i, '').trim();
  return clean.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
}
function _providerLogoImg(name, size) {
  const domain = _providerLogoDomain(name);
  const initials = (name || '??').substring(0, 2).toUpperCase();
  return `<img class="brand-logo-img" src="https://www.google.com/s2/favicons?domain=${domain}&sz=128" data-domain="${domain}" data-initials="${initials}" width="${size}" height="${size}" style="border-radius:6px;object-fit:contain;background:#0d1528;display:block" alt="${initials}">`;
}

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

  scrollActiveTabIntoView('#brands-tabs');

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
      const tp = b.trend_pct || 0;
      const trendDir = tp >= 0 ? 'up' : 'down';
      const trendHtml = tp !== 0 ? `<span class="trend-pct ${trendDir}">${tp > 0 ? '+' : ''}${tp}%</span>` : '<span class="trend-pct" style="color:var(--text-tertiary)">—</span>';
      const risingHtml = b.rising ? '<div class="rising-badge">Rising</div>' : '';
      const sparkData = b.sparkline || [];
      const gradeBg = {'A+':'#00e5a0','A':'#00e5a0','B':'#ffcc00','C':'#ff8800','D':'#ff4444','F':'#ff4444'}[b.email_security_grade] || 'rgba(255,255,255,0.1)';
      const gradeTxt = b.email_security_grade || '—';
      const gradeColor = b.email_security_grade ? '#000' : 'rgba(255,255,255,0.5)';
      const gradeBorder = b.email_security_grade ? 'none' : '1px solid rgba(255,255,255,0.15)';
      return `<a href="/brands/${b.brand_id || b.id}" class="brand-card">
        ${risingHtml}
        <div class="brand-card-top">
          <div class="brand-rank ${rankClass}">${i + 1}</div>
          ${_brandLogoImg(b.name, 36, initials)}
          <div class="brand-card-info"><div class="brand-card-name">${b.name}</div><div class="brand-card-sector">${b.sector || ''}</div></div>
        </div>
        <div class="brand-card-stats">
          <div><div class="brand-threat-val" style="color:${color}">${tc}</div><div class="brand-threat-label">active threats</div></div>
          <div class="brand-trend">${renderSparkline(sparkData)}${trendHtml}</div>
        </div>
        <div class="brand-card-footer">
          <span class="type-pill ${b.top_threat_type || 'phishing'}">${b.top_threat_type || 'phishing'}</span>
          <span class="brand-domain">${b.canonical_domain || ''}</span>
          ${(() => {
            const h = b.official_handles ? (typeof b.official_handles === 'string' ? JSON.parse(b.official_handles) : b.official_handles) : {};
            const pc = { twitter: '#1DA1F2', linkedin: '#0077B5', instagram: '#E4405F', tiktok: '#69C9D0', github: '#8b949e', youtube: '#FF0000' };
            return Object.keys(h).length ? `<div class="social-platform-dots">${Object.keys(h).map(p => `<span class="social-platform-dot" style="background:${pc[p] || '#4a5a73'}"></span>`).join('')}</div>` : '';
          })()}
          ${b.social_impersonation_count > 0 ? `<span class="social-impersonation-alert">⚠ ${b.social_impersonation_count}</span>` : ''}
          <span style="font-family:var(--font-mono);font-size:10px;font-weight:700;background:${gradeBg};color:${gradeColor};padding:1px 5px;border-radius:3px;border:${gradeBorder};flex-shrink:0">${gradeTxt}</span>
        </div>
      </a>`;
    }).join('')}</div>`;
    _attachLogoFallbacks(content);
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
      const mGradeBg = {'A+':'#00e5a0','A':'#00e5a0','B':'#ffcc00','C':'#ff8800','D':'#ff4444','F':'#ff4444'}[b.email_security_grade] || 'rgba(255,255,255,0.1)';
      const mGradeTxt = b.email_security_grade || '—';
      const mGradeColor = b.email_security_grade ? '#000' : 'rgba(255,255,255,0.5)';
      const mGradeBorder = b.email_security_grade ? 'none' : '1px solid rgba(255,255,255,0.15)';
      // Social indicators
      const handles = b.official_handles ? (typeof b.official_handles === 'string' ? JSON.parse(b.official_handles) : b.official_handles) : {};
      const platformColors = { twitter: '#1DA1F2', linkedin: '#0077B5', instagram: '#E4405F', tiktok: '#69C9D0', github: '#8b949e', youtube: '#FF0000' };
      const platformDotsHtml = Object.keys(handles).length
        ? `<div class="social-platform-dots">${Object.keys(handles).map(p => `<span class="social-platform-dot" style="background:${platformColors[p] || '#4a5a73'}" title="${p}: @${handles[p]}"></span>`).join('')}</div>`
        : '';
      const impAlertCount = b.social_impersonation_count || 0;
      const impAlertHtml = impAlertCount > 0 ? `<span class="social-impersonation-alert">⚠ ${impAlertCount} impersonation alert${impAlertCount > 1 ? 's' : ''}</span>` : '';

      return `<a href="/brands/${b.brand_id || b.id}" class="monitored-row" data-status="${statusClass}" data-name="${(b.name || '').toLowerCase()}">
        <div class="monitored-icon" style="color:${color}">${initials}</div>
        <div class="monitored-info"><div class="monitored-name">${b.name}</div><div class="monitored-domain">${b.canonical_domain || ''}</div></div>
        <div class="monitored-sector">${b.sector || ''}</div>
        ${platformDotsHtml}
        <div class="monitored-threats" style="color:${color}">${tc}</div>
        <span style="font-family:var(--font-mono);font-size:10px;font-weight:700;background:${mGradeBg};color:${mGradeColor};padding:1px 5px;border-radius:3px;border:${mGradeBorder}">${mGradeTxt}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
        ${impAlertHtml}
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
      <th style="width:32px">\u2605</th><th>Brand</th><th>Sector</th><th>Threats</th><th>Trend</th><th>Type</th><th>Grade</th>
    </tr></thead><tbody>`;

    brands.forEach(b => {
      const id = b.brand_id || b.id;
      const mon = monIds.has(id);
      const tc = b.threat_count || 0;
      const color = _tColor(tc);
      const t = b.trend_pct || 0;
      const trendDir = t >= 0 ? 'up' : 'down';
      const initials = _brandInitials(b.name);
      const tGradeBg = {'A+':'#00e5a0','A':'#00e5a0','B':'#ffcc00','C':'#ff8800','D':'#ff4444','F':'#ff4444'}[b.email_security_grade] || 'rgba(255,255,255,0.1)';
      const tGradeTxt = b.email_security_grade || '—';
      const tGradeColor = b.email_security_grade ? '#000' : 'rgba(255,255,255,0.5)';
      const tGradeBorder = b.email_security_grade ? 'none' : '1px solid rgba(255,255,255,0.15)';
      html += `<tr data-id="${id}" data-name="${(b.name || '').toLowerCase()}" data-domain="${(b.canonical_domain || '').toLowerCase()}" data-sector="${b.sector || ''}">
        <td><span class="star-toggle ${mon ? 'on' : 'off'}">${mon ? '\u2605' : '\u2606'}</span></td>
        <td><a href="/brands/${id}" class="brand-table-link"><div class="brand-table-icon" style="color:${color}">${initials}</div><div><div style="font-weight:500">${b.name}</div><div style="font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary)">${b.canonical_domain || ''}</div></div></a></td>
        <td style="font-size:11px;color:var(--text-secondary)">${b.sector || ''}</td>
        <td><span style="font-family:var(--font-display);font-weight:700;font-size:14px;color:${color}">${tc}</span></td>
        <td>${t !== 0 ? `<span class="trend-pct ${trendDir}" style="font-size:11px">${t > 0 ? '+' : ''}${t}%</span>` : '<span style="font-size:11px;color:var(--text-tertiary)">—</span>'}</td>
        <td>${b.top_threat_type ? `<span class="type-pill ${b.top_threat_type}">${b.top_threat_type}</span>` : '-'}</td>
        <td><span style="font-family:var(--font-mono);font-size:10px;font-weight:700;background:${tGradeBg};color:${tGradeColor};padding:1px 5px;border-radius:3px;border:${tGradeBorder}">${tGradeTxt}</span></td>
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
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
       <div class="form-group"><label class="form-label">Notes</label><input class="form-input" placeholder="Internal notes..." id="modal-notes"></div>
       <div class="social-handles-section">
         <button type="button" class="social-handles-toggle" id="modal-handles-toggle" onclick="this.classList.toggle('expanded');document.getElementById('modal-handles-fields').classList.toggle('visible')">Social Handles (optional)</button>
         <div class="social-handles-fields" id="modal-handles-fields">
           <div class="social-handle-field"><label>Twitter</label><input class="form-input" placeholder="@handle" id="modal-handle-twitter"></div>
           <div class="social-handle-field"><label>LinkedIn</label><input class="form-input" placeholder="company-slug" id="modal-handle-linkedin"></div>
           <div class="social-handle-field"><label>Instagram</label><input class="form-input" placeholder="@handle" id="modal-handle-instagram"></div>
           <div class="social-handle-field"><label>TikTok</label><input class="form-input" placeholder="@handle" id="modal-handle-tiktok"></div>
           <div class="social-handle-field"><label>GitHub</label><input class="form-input" placeholder="org-name" id="modal-handle-github"></div>
           <div class="social-handle-field"><label>YouTube</label><input class="form-input" placeholder="channel" id="modal-handle-youtube"></div>
         </div>
       </div>`,
      async (overlay) => {
        const domain = document.getElementById('modal-domain')?.value?.trim();
        if (!domain) {
          const inp = document.getElementById('modal-domain');
          if (inp) inp.style.borderColor = 'var(--threat-critical)';
          return false; // prevent close
        }
        try {
          // Collect social handles
          const officialHandles = {};
          ['twitter','linkedin','instagram','tiktok','github','youtube'].forEach(p => {
            const v = document.getElementById('modal-handle-' + p)?.value?.trim()?.replace(/^@/, '');
            if (v) officialHandles[p] = v;
          });
          const monRes = await api('/brands/monitor', {
            method: 'POST',
            body: JSON.stringify({
              domain,
              name: document.getElementById('modal-name')?.value?.trim() || null,
              sector: document.getElementById('modal-sector')?.value || null,
              reason: document.getElementById('modal-reason')?.value || null,
              notes: document.getElementById('modal-notes')?.value?.trim() || null,
              official_handles: Object.keys(officialHandles).length ? officialHandles : undefined,
            })
          });
          const linked = monRes?.data?.threats_linked || 0;
          showToast(linked > 0 ? `Monitoring started \u2014 ${linked} existing threats linked` : 'Monitoring started for ' + domain, 'success');
          if (_brandsSubTab === 'monitored') {
            const content = document.getElementById('brands-content');
            if (content) { content.innerHTML = 'Loading...'; await loadMonitored(); }
          }
        } catch (err) { showToast(err.message, 'error'); }
      }
    );
  });
}

// ─── Email Security Card ─────────────────────────────────────
// ─── DMARC CTA (3-state) ─────────────────────────────────────────
function renderDmarcCta(dmarc) {
  if (!dmarc.exists) {
    // No DMARC at all — show full suggested record
    return `<div class="email-cta">
      <strong>No DMARC record — anyone can spoof this domain.</strong><br>
      Add this DNS TXT record at <code>_dmarc.yourdomain.com</code> to start protecting it and receive spoofing intelligence in Trust Radar:<br>
      <code style="display:block;margin-top:6px;word-break:break-all">v=DMARC1; p=none; rua=mailto:dmarc_rua@trustradar.ca</code>
    </div>`;
  }
  const inTrustRadar = dmarc.record && dmarc.record.includes('trustradar.ca');
  if (inTrustRadar) {
    // Already reporting to Trust Radar
    return `<div class="email-cta" style="border-color:var(--positive);background:rgba(0,229,160,.06)">
      \u2705 <strong>DMARC reports are flowing to Trust Radar</strong> — spoofing intelligence will appear in the Email Intelligence panel below.
    </div>`;
  }
  // Has DMARC but not reporting to Trust Radar
  return `<div class="email-cta">
    <strong>DMARC configured — add Trust Radar as a report receiver.</strong><br>
    Append <code>mailto:dmarc_rua@trustradar.ca</code> to the <code>rua=</code> tag in your DMARC record to get full spoofing intelligence here.
  </div>`;
}

// ─── Email Intelligence card (DMARC aggregate reports) ───────────
function renderEmailIntelCard(stats, sources, brandId) {
  const totals = stats?.totals;
  const daily = stats?.daily || [];
  const domain = stats?.domain || '';

  // Empty state — no reports received yet
  if (!totals || !totals.total_emails) {
    const inTrustRadar = false; // handled by CTA in posture card
    return `
      <div class="panel" style="margin-bottom:16px">
        <div class="phead"><span>\uD83D\uDCCA Email Intelligence</span><span class="badge">No data</span></div>
        <div class="panel-body padded" style="font-size:12px;color:var(--text-secondary)">
          <div style="margin-bottom:10px;color:var(--text-tertiary)">No DMARC aggregate reports received yet for <strong>${domain || 'this domain'}</strong>.</div>
          <div style="font-size:11px;padding:10px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--border)">
            <strong>Activate DMARC reporting:</strong><br>
            Add <code>rua=mailto:dmarc_rua@trustradar.ca</code> to your DMARC DNS record.<br>
            Google, Microsoft, and Yahoo will send daily reports showing every IP that sent email claiming to be this domain.
          </div>
        </div>
      </div>`;
  }

  const passRate = totals.total_emails > 0 ? Math.round((totals.total_pass / totals.total_emails) * 100) : 0;
  const failRate = 100 - passRate;
  const passColor = passRate >= 90 ? '#00e5a0' : passRate >= 70 ? '#ffb627' : '#ff3b5c';

  // Mini trend chart data (last 14 days)
  const chartDays = daily.slice(0, 14).reverse();
  const maxEmails = Math.max(...chartDays.map(d => d.email_count), 1);
  const barChart = chartDays.length > 1 ? `
    <div style="display:flex;align-items:flex-end;gap:2px;height:36px;margin:10px 0 4px">
      ${chartDays.map(d => {
        const h = Math.max(2, Math.round((d.email_count / maxEmails) * 36));
        const fr = d.email_count > 0 ? d.fail_count / d.email_count : 0;
        const c = fr > 0.3 ? '#ff3b5c' : fr > 0.1 ? '#ffb627' : '#00e5a0';
        return `<div title="${d.date}: ${d.email_count} emails, ${d.fail_count} failed" style="flex:1;height:${h}px;background:${c};border-radius:1px;min-width:4px"></div>`;
      }).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-tertiary)">
      <span>${chartDays[0]?.date?.slice(5) || ''}</span><span>${chartDays[chartDays.length-1]?.date?.slice(5) || ''}</span>
    </div>` : '';

  // Top failing sources
  const srcRows = (sources || []).slice(0, 5).map(s => {
    const flag = s.country_code ? `\uD83C${String.fromCodePoint(0xDDE6 + (s.country_code.charCodeAt(0) - 65))}${String.fromCodePoint(0xDDE6 + (s.country_code.charCodeAt(1) - 65))}` : '\u{1F310}';
    const label = s.org ? s.org.slice(0, 28) : s.source_ip;
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px">
      <span style="font-family:var(--font-mono);color:var(--text-tertiary);min-width:100px">${s.source_ip}</span>
      <span>${flag}</span>
      <span style="flex:1;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>
      <span style="color:var(--threat-high);font-weight:600;font-family:var(--font-mono)">${s.fail_messages.toLocaleString()}</span>
    </div>`;
  }).join('');

  return `
    <div class="panel" style="margin-bottom:16px">
      <div class="phead">
        <span>\uD83D\uDCCA Email Intelligence</span>
        <span style="font-size:10px;color:var(--text-tertiary)">${totals.report_count} reports · ${totals.reporter_count} senders</span>
      </div>
      <div class="panel-body padded">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
          <div style="text-align:center;padding:8px;background:var(--bg-elevated);border-radius:6px">
            <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary)">${(totals.total_emails||0).toLocaleString()}</div>
            <div style="font-size:9px;color:var(--text-tertiary);margin-top:2px">Emails analyzed</div>
          </div>
          <div style="text-align:center;padding:8px;background:var(--bg-elevated);border-radius:6px">
            <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:${passColor}">${passRate}%</div>
            <div style="font-size:9px;color:var(--text-tertiary);margin-top:2px">Pass rate</div>
          </div>
          <div style="text-align:center;padding:8px;background:var(--bg-elevated);border-radius:6px">
            <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:var(--threat-high)">${(totals.total_fail||0).toLocaleString()}</div>
            <div style="font-size:9px;color:var(--text-tertiary);margin-top:2px">Failed DMARC</div>
          </div>
          <div style="text-align:center;padding:8px;background:var(--bg-elevated);border-radius:6px">
            <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:var(--blue-primary)">${failRate}%</div>
            <div style="font-size:9px;color:var(--text-tertiary);margin-top:2px">Fail rate</div>
          </div>
        </div>
        ${barChart}
        ${srcRows ? `
          <div style="margin-top:12px">
            <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">Top Spoofing Sources</div>
            ${srcRows}
          </div>` : ''}
      </div>
    </div>`;
}

async function loadEmailIntel(brandId) {
  const wrap = document.getElementById('email-intel-wrap');
  if (!wrap) return;
  try {
    const [statsRes, sourcesRes] = await Promise.all([
      api(`/dmarc-reports/${brandId}/stats`).catch(() => null),
      api(`/dmarc-reports/${brandId}/sources?limit=5`).catch(() => null),
    ]);
    wrap.innerHTML = renderEmailIntelCard(statsRes?.data, sourcesRes?.data, brandId);
  } catch {
    wrap.innerHTML = renderEmailIntelCard(null, null, brandId);
  }
}

function renderEmailSecurityCard(es, brandId) {
  if (!es) return `
    <div class="panel email-security-card" style="margin-bottom:16px">
      <div class="phead"><span>\uD83D\uDCE7 Email Security Posture</span>
        <button class="filter-pill" style="font-size:10px" onclick="scanEmailSecurity('${brandId}')">Scan Now</button>
      </div>
      <div class="panel-body padded" style="color:var(--text-tertiary);font-size:12px">No email security scan available. Click "Scan Now" to check this domain's email authentication.</div>
    </div>`;

  const gradeColor = {'A+':'#00ff88','A':'#00dd66','B':'#ffcc00','C':'#ff8800','D':'#ff4444','F':'#ff0000'}[es.email_security_grade] || '#666';
  const score = es.email_security_score || 0;
  const grade = es.email_security_grade || 'F';
  const dmarc = { exists: !!es.dmarc_exists, policy: es.dmarc_policy, reporting_enabled: !!es.dmarc_rua, record: es.dmarc_raw };
  const spf = { exists: !!es.spf_exists, policy: es.spf_policy, too_many_lookups: !!es.spf_too_many_lookups, record: es.spf_raw };
  const dkimSelectors = tryJson(es.dkim_selectors_found, []);
  const dkim = { exists: !!es.dkim_exists, selectors_found: dkimSelectors };
  const mxProviders = tryJson(es.mx_providers, []);
  const mx = { exists: !!es.mx_exists, providers: mxProviders };

  const recs = buildEmailRecs({ dmarc, spf, dkim, mx });

  return `
    <div class="panel email-security-card" style="margin-bottom:16px">
      <div class="phead">
        <span>\uD83D\uDCE7 Email Security Posture</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="email-grade" style="background:${gradeColor};color:#000;padding:3px 10px;border-radius:4px;font-weight:700;font-size:15px;font-family:var(--font-mono)">${grade}</span>
          <button class="filter-pill" style="font-size:10px" onclick="scanEmailSecurity('${brandId}')">Re-scan</button>
        </div>
      </div>
      <div class="panel-body padded">
        <div class="email-score-bar">
          <div class="score-label" style="font-size:11px;color:var(--text-secondary);min-width:140px">Email Security Score</div>
          <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${score}%;background:${gradeColor}"></div></div>
          <span class="score-value" style="font-family:var(--font-mono);font-size:12px;color:${gradeColor};min-width:48px;text-align:right">${score}/100</span>
        </div>
        <div class="protocol-grid">
          <div class="protocol-check ${dmarc.exists ? 'pass' : 'fail'}">
            <div class="protocol-icon">${dmarc.exists ? '\u2705' : '\u274C'}</div>
            <div class="protocol-name">DMARC</div>
            <div class="protocol-detail">${dmarc.exists ? `Policy: ${dmarc.policy || 'none'}` : 'Not configured'}</div>
          </div>
          <div class="protocol-check ${spf.exists ? 'pass' : 'fail'}">
            <div class="protocol-icon">${spf.exists ? '\u2705' : '\u274C'}</div>
            <div class="protocol-name">SPF</div>
            <div class="protocol-detail">${spf.exists ? (spf.policy || 'exists') : 'Not configured'}</div>
          </div>
          <div class="protocol-check ${dkim.exists ? 'pass' : 'fail'}">
            <div class="protocol-icon">${dkim.exists ? '\u2705' : '\u274C'}</div>
            <div class="protocol-name">DKIM</div>
            <div class="protocol-detail">${dkim.exists ? `${dkim.selectors_found.length} selector(s)` : 'Not detected'}</div>
          </div>
          <div class="protocol-check ${mx.exists ? 'pass' : 'fail'}">
            <div class="protocol-icon">${mx.exists ? '\u2705' : '\u274C'}</div>
            <div class="protocol-name">MX</div>
            <div class="protocol-detail">${mx.exists ? (mx.providers.join(', ') || 'Active') : 'No mail servers'}</div>
          </div>
        </div>
        ${recs.length ? `<div class="email-recommendations">
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">Recommendations</div>
          ${recs.map(r => {
            const icon = r.startsWith('CRITICAL') ? '\uD83D\uDD34' : r.startsWith('WARNING') ? '\uD83D\uDFE1' : r.startsWith('GOOD') ? '\uD83D\uDFE2' : r.startsWith('Excellent') ? '\uD83C\uDFC6' : '\uD83D\uDCA1';
            return `<div class="recommendation-item">${icon} ${r}</div>`;
          }).join('')}
        </div>` : ''}
        ${renderDmarcCta(dmarc)}
        <div style="font-size:10px;color:var(--text-tertiary);margin-top:12px">Last scanned: ${es.scanned_at ? new Date(es.scanned_at).toLocaleString() : 'Never'}</div>
      </div>
    </div>`;
}

function tryJson(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function buildEmailRecs({ dmarc, spf, dkim, mx }) {
  const recs = [];
  if (!dmarc.exists) recs.push('CRITICAL: No DMARC record found. Anyone can send emails pretending to be your domain.');
  else if (dmarc.policy === 'none') recs.push('WARNING: DMARC policy is set to "none" — spoofed emails are not being blocked. Upgrade to "quarantine" or "reject".');
  else if (dmarc.policy === 'quarantine') recs.push('GOOD: DMARC quarantine is active. Consider upgrading to "reject" for full protection.');
  if (dmarc.exists && !dmarc.reporting_enabled) recs.push('No DMARC aggregate reporting configured. You have no visibility into who is sending email as your domain.');
  if (!spf.exists) recs.push('CRITICAL: No SPF record found. Email receivers cannot verify your authorized mail servers.');
  else if (spf.policy === '~all' || spf.policy === '?all') recs.push('SPF soft-fail detected. Upgrade to "-all" (hard fail) for stronger protection.');
  if (spf.too_many_lookups) recs.push('SPF record exceeds 10 DNS lookups — this causes SPF validation failures.');
  if (!dkim.exists) recs.push('No DKIM signing detected (checked 20 common selectors). Email recipients cannot verify message integrity.');
  if (!mx.exists) recs.push('No MX records found. This domain may not be configured to receive email.');
  if (recs.length === 0) recs.push('Excellent! This domain has strong email authentication configured.');
  return recs;
}

async function scanEmailSecurity(brandId) {
  const wrap = document.getElementById('email-security-panel-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="panel" style="margin-bottom:16px"><div class="panel-body padded" style="color:var(--text-tertiary);font-size:12px">Scanning email security...</div></div>';
  try {
    const res = await api(`/email-security/scan/${brandId}`, { method: 'POST' });
    if (res?.success && res.data) {
      // Map live result to DB-style flat object
      const d = res.data;
      const flat = {
        email_security_score: d.score,
        email_security_grade: d.grade,
        dmarc_exists: d.dmarc?.exists ? 1 : 0,
        dmarc_policy: d.dmarc?.policy,
        dmarc_rua: d.dmarc?.reporting_enabled ? 'configured' : null,
        dmarc_raw: d.dmarc?.record,
        spf_exists: d.spf?.exists ? 1 : 0,
        spf_policy: d.spf?.policy,
        spf_too_many_lookups: d.spf?.too_many_lookups ? 1 : 0,
        dkim_exists: d.dkim?.exists ? 1 : 0,
        dkim_selectors_found: JSON.stringify(d.dkim?.selectors_found || []),
        mx_exists: d.mx?.exists ? 1 : 0,
        mx_providers: JSON.stringify(d.mx?.providers || []),
        scanned_at: d.scanned_at,
      };
      wrap.innerHTML = renderEmailSecurityCard(flat, brandId);
    } else {
      wrap.innerHTML = renderEmailSecurityCard(null, brandId);
      showToast('Email security scan failed', 'error');
    }
  } catch (err) {
    wrap.innerHTML = renderEmailSecurityCard(null, brandId);
    showToast(err.message || 'Scan failed', 'error');
  }
}

// ─── View: Brand Detail (Step 9) ────────────────────────────
let _brandDetailMap = null;
let _brandDetailChart = null;
let _brandThreatsPage = 1;
const _brandThreatsPerPage = 15;

async function viewBrandDetail(el, params) {
  el.innerHTML = 'Loading...';
  try {
    const [brandRes, threatsRes, locationsRes, providersRes, campaignsRes, timelineRes, analysisRes, safeDomainsRes, emailSecRes, socialProfilesRes, socialConfigRes] = await Promise.all([
      api(`/brands/${params.id}`),
      api(`/brands/${params.id}/threats?status=active&limit=50`).catch(() => null),
      api(`/brands/${params.id}/threats/locations`).catch(() => null),
      api(`/brands/${params.id}/providers`).catch(() => null),
      api(`/brands/${params.id}/campaigns`).catch(() => null),
      api(`/brands/${params.id}/threats/timeline?period=7d`).catch(() => null),
      api(`/brands/${params.id}/analysis`).catch(() => null),
      api(`/brands/${params.id}/safe-domains`).catch(() => null),
      api(`/email-security/${params.id}`).catch(() => null),
      api(`/brands/${params.id}/social-profiles`).catch(() => null),
      api(`/brands/${params.id}/social-config`).catch(() => null),
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
    let safeDomains = safeDomainsRes?.data || [];
    const sc = b.trust_score != null ? _scoreColor(b.trust_score) : 'var(--text-tertiary)';
    const trendColor = (stats.trend_pct || 0) >= 0 ? 'var(--threat-medium)' : 'var(--positive)';
    const threatColor = _tColor(totalThreats);

    // SVG Trust/Exposure Score ring (matches prototype: 72x72 SVG with dashoffset)
    const displayScore = b.trust_score != null ? b.trust_score : b.exposure_score != null ? b.exposure_score : null;
    const displayGrade = b.trust_grade || (b.exposure_score != null ? (b.exposure_score >= 70 ? 'HIGH' : b.exposure_score >= 40 ? 'MODERATE' : 'LOW') : '');
    const displayLabel = b.trust_score != null ? 'Trust' : b.exposure_score != null ? 'Exposure' : '';
    const ringColor = displayScore != null ? _scoreColor(displayScore) : 'var(--text-tertiary)';
    const trustRingHtml = displayScore != null
      ? `<div class="ts-ring-wrap"><div style="width:72px;height:72px;position:relative">
          <svg width="72" height="72" viewBox="0 0 72 72"><circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-elevated)" stroke-width="5"/><circle cx="36" cy="36" r="30" fill="none" stroke="${ringColor}" stroke-width="5" stroke-dasharray="188.5" stroke-dashoffset="${188.5 * (1 - displayScore / 100)}" stroke-linecap="round" transform="rotate(-90 36 36)"/></svg>
          <div class="ts-val-center">${displayScore}</div>
        </div><div class="ts-grade">${displayLabel}: ${displayGrade}</div></div>`
      : '';

    // Provider bar colors
    const provColors = ['#ff3b5c', '#ff6b35', '#ffb627', '#00d4ff', '#0091b3', '#4a5a73'];
    const maxProv = providers[0]?.count || providers[0]?.threat_count || 1;

    el.innerHTML = `
      <a href="/brands" class="back-link">\u2190 Back to Brands</a>
      <div class="detail-header">
        <div class="detail-header-icon" style="color:${threatColor}">${_brandLogoImg(b.name, 48, initials)}</div>
        <div class="detail-header-meta">
          <div class="detail-header-title">${b.name}<span class="sector-pill">${b.sector || 'Unknown'}</span></div>
          <div class="detail-header-sub">${b.canonical_domain || ''} \u2014 First tracked: ${b.first_tracked || b.created_at?.slice(0, 10) || '-'}</div>
          <div class="detail-header-stats">
            <div class="header-stat"><div class="header-stat-val" style="color:var(--threat-critical)">${totalThreats}</div><div class="header-stat-label">Active threats</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:${trendColor}">${(stats.trend_pct || 0) >= 0 ? '+' : ''}${stats.trend_pct || 0}%</div><div class="header-stat-label">7-day trend</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:var(--blue-primary)">${stats.countries || locationsRes?.totalCountries || locations.length}</div><div class="header-stat-label">Countries</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:var(--blue-primary)">${stats.provider_count || providers.length}</div><div class="header-stat-label">Hosting providers</div></div>
            <div class="header-stat"><div class="header-stat-val" style="color:${b.social_risk_score != null ? (b.social_risk_score >= 70 ? 'var(--threat-critical)' : b.social_risk_score >= 40 ? 'var(--threat-medium)' : 'var(--positive)') : 'var(--text-tertiary)'}">${b.social_risk_score != null ? b.social_risk_score + '/100' : '\u2014'}</div><div class="header-stat-label">${b.social_risk_score != null ? 'Social risk' : 'No social scan yet'}</div></div>
          </div>
        </div>
        ${trustRingHtml}
      </div>
      <div class="panel" id="brand-analysis-panel" style="margin-bottom:16px">
        <div class="phead"><span>AI Threat Analysis</span><span class="badge" id="brand-analysis-badge">${analysisRes?.data ? (analysisRes.data.stale ? 'Stale' : 'Current') : 'Not generated'}</span></div>
        <div class="panel-body padded" id="brand-analysis-body">${analysisRes?.data ? `
          <div style="font-size:13px;line-height:1.6;color:var(--text-primary);margin-bottom:12px">${analysisRes.data.analysis || ''}</div>
          ${analysisRes.data.key_findings?.length ? `<div style="margin-bottom:12px">${analysisRes.data.key_findings.map(f => `<div style="display:flex;gap:8px;padding:4px 0;font-size:11px;color:var(--text-secondary)"><span style="color:var(--threat-medium)">\u25cf</span>${f}</div>`).join('')}</div>` : ''}
          ${analysisRes.data.risk_level ? `<span style="font-family:var(--font-mono);font-size:9px;padding:2px 7px;border-radius:3px;background:${analysisRes.data.risk_level === 'critical' ? 'rgba(255,59,92,.12)' : analysisRes.data.risk_level === 'high' ? 'rgba(255,107,53,.1)' : 'rgba(255,182,39,.1)'};color:${analysisRes.data.risk_level === 'critical' ? 'var(--negative)' : analysisRes.data.risk_level === 'high' ? 'var(--threat-high)' : 'var(--threat-medium)'}">${analysisRes.data.risk_level} risk</span>` : ''}
          ${analysisRes.data.updated_at ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary);margin-left:8px">Updated ${analysisRes.data.updated_at.slice(0, 16).replace('T', ' ')}</span>` : ''}
          <button class="filter-pill" id="brand-refresh-analysis" style="margin-left:8px;font-size:9px">\u21bb Refresh</button>
        ` : `<div style="text-align:center;padding:12px"><div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">No AI analysis generated yet</div><button class="filter-pill" id="brand-gen-analysis">\u25c8 Generate Analysis</button></div>`}</div>
      </div>
      <div class="panel" style="margin-bottom:16px;padding:12px 16px;display:flex;align-items:center;gap:12px;justify-content:space-between">
        <div>
          <button class="filter-pill" id="brand-deep-scan" style="font-size:11px">\uD83D\uDD0D AI Deep Scan</button>
          <span style="font-size:9px;color:var(--text-tertiary);margin-left:8px">Uses AI credits (~$0.01 per 20 threats scanned)</span>
        </div>
        <span id="deep-scan-result" style="font-size:11px;color:var(--text-secondary)"></span>
      </div>
      <div class="panel" id="safe-domains-panel" style="margin-bottom:16px">
        <div class="phead">
          <span style="display:flex;align-items:center;gap:6px"><span style="color:var(--positive)">&#9432;</span> Safe Domains</span>
          <span class="badge" id="safe-domains-count">${safeDomains.length}</span>
        </div>
        <div class="panel-body padded" id="safe-domains-body"></div>
      </div>
      <div id="csv-upload-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center">
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;max-width:480px;width:90%">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px">Upload Known Domains</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:16px">Upload a CSV file of domains owned by this brand. These domains will be excluded from threat detection.</div>
          <input type="file" id="csv-file-input" accept=".csv,.txt,.tsv" style="margin-bottom:12px;font-size:12px;color:var(--text-secondary)">
          <div id="csv-preview" style="display:none;margin-bottom:12px;padding:10px;background:var(--bg-elevated);border-radius:6px;font-size:11px;max-height:180px;overflow-y:auto"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="filter-pill" id="csv-cancel-btn">Cancel</button>
            <button class="filter-pill" id="csv-upload-btn" style="background:var(--positive);color:var(--bg-body)" disabled>Upload</button>
          </div>
        </div>
      </div>
      <div id="social-profiles-panel-wrap"></div>
      <div id="email-security-panel-wrap">
        ${renderEmailSecurityCard(emailSecRes?.data, params.id)}
      </div>
      <div id="email-intel-wrap">
        <div class="panel" style="margin-bottom:16px"><div class="panel-body padded" style="color:var(--text-tertiary);font-size:12px">Loading email intelligence\u2026</div></div>
      </div>
      <div id="spam-trap-intel-wrap"></div>
      <div class="detail-grid">
        <div class="panel" id="brand-threats-panel"></div>
        <div class="detail-rcol">
          <div class="panel"><div class="phead"><span>Threat Locations</span><span class="badge">${locationsRes?.totalCountries || locations.length} countries</span></div><div class="panel-body"><div id="brand-mini-map" class="mini-map"></div></div></div>
          <div class="panel"><div class="phead"><span>Hosting Providers</span></div><div class="panel-body padded" id="brand-prov-bars">${providers.length ?
            providers.map((p, i) => {
              const cnt = p.count || p.threat_count || 0;
              const pct = maxProv > 0 ? Math.round(cnt / maxProv * 100) : 0;
              return `<div class="pbar-row"><span class="pbar-lbl">${p.name || p.provider_name}</span><div class="pbar-trk"><div class="pbar-fill" style="width:${pct}%;background:${provColors[i] || provColors[5]}"></div></div><span class="pbar-ct">${cnt}</span></div>`;
            }).join('') :
            '<div class="empty-state"><div class="message">No provider data yet<br><span style="font-size:10px;color:var(--text-tertiary)">Providers appear after geo enrichment resolves threat IPs</span></div></div>'
          }</div></div>
          <div class="panel"><div class="phead"><span>Active Campaigns</span><span class="badge">${campaigns.length}</span></div><div class="panel-body padded">${campaigns.length ?
            campaigns.map(c => `<a href="/campaigns/${c.id || c.campaign_id}" class="campaign-card-sm">
              <div class="ccard-name">${c.name}</div>
              <div class="ccard-meta"><span><span style="color:var(--threat-critical)">${c.threat_count || 0}</span> threats</span><span><span style="color:var(--blue-primary)">${c.brand_count || 1}</span> brands</span><span style="color:var(--text-tertiary)">Since ${(c.first_seen || c.created_at || '').slice(0, 10)}</span></div>
            </a>`).join('') :
            '<div class="empty-state"><div class="message">No campaigns detected<br><span style="font-size:10px;color:var(--text-tertiary)">Campaigns are created when the Strategist agent clusters related threats</span></div></div>'
          }</div></div>
        </div>
      </div>
      <div>
        <div class="chart-head"><div class="chart-title">Threat Timeline</div><div class="period-selector" id="brand-timeline-period">
          <button class="period-btn" data-period="24h">24H</button><button class="period-btn active" data-period="7d">7D</button><button class="period-btn" data-period="30d">30D</button><button class="period-btn" data-period="90d">90D</button>
        </div></div>
        <div class="chart-wrap"><canvas id="brand-timeline-chart"></canvas></div>
      </div>`;
    _attachLogoFallbacks(el);
    loadEmailIntel(params.id);
    loadSpamTrapIntel(params.id);

    // ─── Safe Domains panel rendering ───────────────────────
    const brandId = params.id;

    function renderSafeDomains() {
      const body = document.getElementById('safe-domains-body');
      if (!body) return;
      const badge = document.getElementById('safe-domains-count');
      if (badge) badge.textContent = safeDomains.length;

      const srcBadge = (s) => {
        const colors = { manual: '#00d4ff', csv_upload: '#ffb627', auto_detected: '#00e5a0' };
        const labels = { manual: 'manual', csv_upload: 'csv', auto_detected: 'auto' };
        return `<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:${colors[s] || '#4a5a73'}22;color:${colors[s] || '#4a5a73'}">${labels[s] || s}</span>`;
      };

      let html = '';
      if (safeDomains.length) {
        html += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px">';
        safeDomains.forEach(sd => {
          html += `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span style="font-family:var(--font-mono);font-size:12px;color:var(--text-primary);flex:1">${sd.domain}</span>
            ${srcBadge(sd.source)}
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary)">${(sd.added_at || '').slice(0, 10)}</span>
            <button class="safe-domain-rm" data-id="${sd.id}" style="background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:14px;padding:0 4px" title="Remove">&times;</button>
          </div>`;
        });
        html += '</div>';
      } else {
        html += '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:12px">No safe domains configured. Add domains owned by this brand to prevent false positive alerts.</div>';
      }
      html += `<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:8px">Use <code style="background:var(--bg-elevated);padding:1px 4px;border-radius:3px">*.brand.com</code> to mark all subdomains as safe</div>`;
      html += `<div style="display:flex;gap:8px;align-items:center">
        <div id="safe-add-form" style="display:flex;gap:6px;flex:1">
          <input type="text" id="safe-domain-input" placeholder="*.brand.com or subdomain.brand.com" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--text-primary);font-family:var(--font-mono)">
          <button class="filter-pill" id="safe-add-btn" style="font-size:11px">Add</button>
        </div>
        <button class="filter-pill" id="safe-csv-btn" style="font-size:11px">&#8593; Upload CSV</button>
        <button class="filter-pill" id="safe-clean-fp-btn" style="font-size:11px;border-color:rgba(0,229,160,.3);color:var(--positive)" title="Remove active threats matching safe domains">Clean FP</button>
      </div>`;
      body.innerHTML = html;

      // Wire remove buttons
      body.querySelectorAll('.safe-domain-rm').forEach(btn => {
        btn.addEventListener('click', async () => {
          const domainId = btn.dataset.id;
          await api(`/brands/${brandId}/safe-domains/${domainId}`, { method: 'DELETE' });
          safeDomains = safeDomains.filter(d => d.id !== domainId);
          renderSafeDomains();
        });
      });

      // Wire add button
      const addBtn = document.getElementById('safe-add-btn');
      const addInput = document.getElementById('safe-domain-input');
      if (addBtn && addInput) {
        const doAdd = async () => {
          const val = addInput.value.trim();
          if (!val) return;
          const res = await api(`/brands/${brandId}/safe-domains`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: val }),
          });
          if (res?.success && res.data) {
            safeDomains.unshift(res.data);
            addInput.value = '';
            renderSafeDomains();
          }
        };
        addBtn.addEventListener('click', doAdd);
        addInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
      }

      // Wire CSV upload button
      const csvBtn = document.getElementById('safe-csv-btn');
      if (csvBtn) {
        csvBtn.addEventListener('click', () => {
          const modal = document.getElementById('csv-upload-modal');
          if (modal) modal.style.display = 'flex';
        });
      }

      // Wire clean false positives button
      const cleanFpBtn = document.getElementById('safe-clean-fp-btn');
      if (cleanFpBtn) {
        cleanFpBtn.addEventListener('click', async () => {
          cleanFpBtn.disabled = true;
          cleanFpBtn.textContent = 'Cleaning...';
          try {
            const res = await api(`/brands/${brandId}/clean-false-positives`, { method: 'POST' });
            if (res?.success && res.data) {
              showToast(`Cleaned ${res.data.cleaned} false positives (checked ${res.data.checked} threats)`, 'success');
              if (res.data.cleaned > 0) {
                // Refresh threats list
                const refreshed = await api(`/brands/${brandId}/threats?status=active&limit=50`).catch(() => null);
                if (refreshed?.data) {
                  allThreats.length = 0;
                  allThreats.push(...refreshed.data);
                  renderBrandThreats();
                }
              }
            }
          } catch (err) { showToast(err.message, 'error'); }
          cleanFpBtn.disabled = false;
          cleanFpBtn.textContent = 'Clean FP';
        });
      }
    }

    renderSafeDomains();

    // ─── Social Profiles panel rendering ─────────────────────
    let socialProfiles = socialProfilesRes?.data || [];
    const socialConfig = socialConfigRes?.data || {};
    let _socialFilterTab = 'all';

    function _platformIcon(platform) {
      const icons = { twitter: '𝕏', linkedin: 'in', instagram: '📷', tiktok: '♪', github: '⌨', youtube: '▶' };
      const colors = { twitter: '#000', linkedin: '#0077B5', instagram: '#E4405F', tiktok: '#000', github: '#333', youtube: '#FF0000' };
      return `<span class="platform-icon ${platform || ''}" style="background:${colors[platform] || 'var(--bg-elevated)'};color:${platform === 'twitter' || platform === 'tiktok' ? '#fff' : (colors[platform] || 'var(--text-tertiary)')}">${icons[platform] || (platform || '?')[0].toUpperCase()}</span>`;
    }

    function _classificationBadge(cls) {
      const labels = { official: 'Official ✓', legitimate: 'Legitimate', suspicious: 'Suspicious', impersonation: 'Impersonation', unknown: 'Unknown' };
      return `<span class="social-classification-badge ${cls || 'unknown'}">${labels[cls] || cls || 'Unknown'}</span>`;
    }

    function _severityBadge(sev) {
      if (!sev) return '';
      return `<span class="social-severity-badge ${(sev || '').toLowerCase()}">${sev}</span>`;
    }

    function _impersonationScoreColor(score) {
      if (score >= 80) return 'var(--threat-critical)';
      if (score >= 60) return 'var(--threat-high)';
      if (score >= 40) return 'var(--threat-medium)';
      return 'var(--blue-primary)';
    }

    function _formatFollowers(n) {
      if (!n) return '0';
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(n);
    }

    function _timeAgo(dateStr) {
      if (!dateStr) return 'Never';
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return mins + ' min ago';
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + ' hour' + (hrs > 1 ? 's' : '') + ' ago';
      const days = Math.floor(hrs / 24);
      return days + ' day' + (days > 1 ? 's' : '') + ' ago';
    }

    function _aiConfidenceColor(confidence) {
      if (confidence >= 0.9) return 'var(--threat-critical)';
      if (confidence >= 0.7) return 'var(--threat-high)';
      if (confidence >= 0.4) return 'var(--threat-medium)';
      return 'var(--text-tertiary)';
    }

    function _aiActionLabel(action) {
      const labels = { safe: 'SAFE', review: 'REVIEW', escalate: 'ESCALATE', takedown: 'TAKEDOWN' };
      return labels[action] || action || '';
    }

    function _aiActionColor(action) {
      const colors = { safe: 'var(--positive)', review: 'var(--threat-medium)', escalate: 'var(--threat-high)', takedown: 'var(--threat-critical)' };
      return colors[action] || 'var(--text-tertiary)';
    }

    function renderSocialProfileCard(p) {
      const isSuspicious = p.classification === 'suspicious' || p.classification === 'impersonation';
      const cardClass = p.classification === 'impersonation' ? 'impersonation' : p.classification === 'suspicious' ? 'suspicious' : '';
      const avatarHtml = p.avatar_url
        ? `<div class="social-avatar"><img src="${p.avatar_url}" alt="" onerror="this.parentElement.textContent='${(p.handle || '?')[0].toUpperCase()}'"></div>`
        : `<div class="social-avatar" style="background:var(--bg-elevated)">${_platformIcon(p.platform)}</div>`;

      let html = `<div class="social-profile-card ${cardClass}" data-profile-id="${p.id}" data-classification="${p.classification || 'unknown'}">
        <div class="social-card-top">
          ${avatarHtml}
          <div class="social-card-info">
            <div class="social-card-handle">${_platformIcon(p.platform)} @${p.handle || ''} on ${(p.platform || 'unknown').charAt(0).toUpperCase() + (p.platform || 'unknown').slice(1)}</div>
            <div class="social-card-name">${p.display_name || ''}</div>
            ${p.bio ? `<div class="social-card-bio">"${p.bio}"</div>` : ''}
            <div class="social-card-meta">
              <span>${_formatFollowers(p.follower_count)} followers</span>
              ${p.is_verified ? '<span style="color:var(--positive)">Verified ✓</span>' : '<span style="color:var(--text-tertiary)">Not Verified</span>'}
              <span>Last checked: ${_timeAgo(p.last_checked)}</span>
            </div>
          </div>
          ${_classificationBadge(p.classification)}
        </div>`;

      // AI Assessment panel (enhanced)
      if (p.ai_assessment || p.ai_confidence != null) {
        const conf = p.ai_confidence != null ? p.ai_confidence : 0;
        const confPct = Math.round(conf * 100);
        const confColor = _aiConfidenceColor(conf);
        const aiAction = p.ai_action || '';
        const classification = p.classification || 'unknown';

        html += `<div class="social-ai-panel" style="margin-top:8px;border:1px solid color-mix(in srgb, ${confColor} 30%, transparent);border-radius:6px;padding:10px;background:color-mix(in srgb, ${confColor} 4%, transparent)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:11px;font-weight:600;color:${confColor}">AI Assessment (${confPct}% confidence)</span>
            <span style="font-size:9px;font-family:var(--font-mono);padding:2px 6px;border-radius:3px;background:color-mix(in srgb, ${_aiActionColor(aiAction)} 12%, transparent);color:${_aiActionColor(aiAction)};font-weight:600">${classification.toUpperCase()} → ${_aiActionLabel(aiAction)}</span>
          </div>`;

        if (p.ai_assessment) {
          html += `<div style="font-size:11px;color:var(--text-secondary);line-height:1.5;margin-bottom:6px">${p.ai_assessment}</div>`;
        }

        // Parse and show signals
        let signals = [];
        try {
          signals = p.impersonation_signals
            ? (typeof p.impersonation_signals === 'string' ? JSON.parse(p.impersonation_signals) : p.impersonation_signals)
            : [];
        } catch { signals = []; }

        if (signals.length > 0) {
          html += `<div style="margin-top:6px"><div style="font-size:10px;font-weight:600;color:var(--text-tertiary);margin-bottom:3px">Signals:</div>
            <ul style="margin:0;padding-left:16px;font-size:10px;color:var(--text-secondary);line-height:1.6">${signals.slice(0, 8).map(s => `<li>${s}</li>`).join('')}</ul></div>`;
        }

        html += `</div>`;
      }

      // Impersonation score bar (for suspicious/impersonation without AI)
      if (isSuspicious && !p.ai_assessment) {
        if (p.impersonation_score != null) {
          html += `<div class="impersonation-score-bar"><div class="impersonation-score-fill" style="width:${p.impersonation_score}%;background:${_impersonationScoreColor(p.impersonation_score)}"></div></div>
            <div style="display:flex;justify-content:space-between;margin-top:2px">
              <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary)">Impersonation score</span>
              <span style="font-family:var(--font-mono);font-size:9px;font-weight:600;color:${_impersonationScoreColor(p.impersonation_score)}">${p.impersonation_score}%</span>
            </div>`;
        }
        if (p.severity) html += `<div style="margin-top:4px">${_severityBadge(p.severity)}</div>`;
        if (p.impersonation_signals && p.impersonation_signals.length) {
          const sigs = typeof p.impersonation_signals === 'string' ? JSON.parse(p.impersonation_signals) : p.impersonation_signals;
          html += `<ul class="social-signals-list">${sigs.slice(0, 5).map(s => `<li>${s}</li>`).join('')}</ul>`;
        }
      }

      // Severity badge (shown for AI-assessed profiles too)
      if (p.severity && (p.ai_assessment || isSuspicious)) {
        if (p.ai_assessment) html += `<div style="margin-top:4px">${_severityBadge(p.severity)}</div>`;
      }

      // Action buttons
      html += '<div class="social-card-actions">';
      if (p.classification !== 'official' && p.classification !== 'legitimate') {
        html += `<button class="positive" onclick="window._socialClassify('${p.id}','legitimate','resolved')">Confirm Safe</button>`;
      }
      if (isSuspicious) {
        html += `<button class="negative" onclick="window._socialClassify('${p.id}','impersonation','active')">Confirm Impersonation</button>`;
        html += `<button onclick="window._socialClassify('${p.id}','legitimate','false_positive')">False Positive</button>`;
      } else if (p.classification !== 'suspicious') {
        html += `<button class="warning" onclick="window._socialClassify('${p.id}','suspicious',null)">Mark Suspicious</button>`;
      }
      // Re-Assess button
      html += `<button class="social-reassess-btn" data-profile-id="${p.id}" onclick="window._socialReassess('${p.id}', this)">Re-Assess</button>`;
      // Copy Takedown Evidence button (only if ai_evidence_draft exists)
      if (p.ai_evidence_draft) {
        html += `<button onclick="window._copyTakedownEvidence(this, '${p.id}')">Copy Takedown Evidence</button>`;
      }
      if (p.profile_url) {
        html += `<button onclick="window.open('${p.profile_url}','_blank')">View Profile ↗</button>`;
      }
      html += '</div></div>';
      return html;
    }

    function renderSocialPanel() {
      const wrap = document.getElementById('social-profiles-panel-wrap');
      if (!wrap) return;

      const filtered = _socialFilterTab === 'all' ? socialProfiles
        : _socialFilterTab === 'official' ? socialProfiles.filter(p => p.classification === 'official')
        : _socialFilterTab === 'suspicious' ? socialProfiles.filter(p => p.classification === 'suspicious' || p.classification === 'impersonation')
        : socialProfiles.filter(p => p.classification === 'official' || p.classification === 'legitimate');

      const suspiciousCount = socialProfiles.filter(p => p.classification === 'suspicious' || p.classification === 'impersonation').length;

      let html = `<div class="panel panel-collapsible" id="social-profiles-panel" style="margin-bottom:16px">
        <div class="phead">
          <div class="social-panel-header">
            <span>Social Profiles</span>
            <span class="badge">${socialProfiles.length}</span>
          </div>
          <div class="social-panel-actions">
            <button class="filter-pill" id="social-add-handle-btn" style="font-size:10px">+ Add Handle</button>
            <button class="filter-pill" id="social-scan-btn" style="font-size:10px">🔍 Scan Now</button>
            <button class="filter-pill" id="social-discover-btn" style="font-size:10px">🌐 Auto-Discover</button>
          </div>
        </div>
        <div class="social-sub-tabs" id="social-profile-tabs">
          <button class="social-sub-tab ${_socialFilterTab === 'all' ? 'active' : ''}" data-stab="all">All Profiles</button>
          <button class="social-sub-tab ${_socialFilterTab === 'official' ? 'active' : ''}" data-stab="official">Official</button>
          <button class="social-sub-tab ${_socialFilterTab === 'suspicious' ? 'active' : ''}" data-stab="suspicious">Suspicious${suspiciousCount ? ` <span class="badge" style="background:rgba(255,59,92,.12);color:var(--negative);margin-left:4px">${suspiciousCount}</span>` : ''}</button>
          <button class="social-sub-tab ${_socialFilterTab === 'safe' ? 'active' : ''}" data-stab="safe">Safe</button>
        </div>`;

      if (!socialProfiles.length && !Object.keys(socialConfig.official_handles || {}).length) {
        html += `<div class="social-empty-state"><div class="message">No social monitoring configured.<br>Add your brand's official handles to start detecting impersonation.</div><button class="filter-pill" id="social-empty-add-btn" style="font-size:11px;margin-top:8px">+ Add Handles</button></div>`;
      } else if (!filtered.length) {
        html += `<div class="social-empty-state"><div class="message">No profiles match this filter.</div></div>`;
      } else {
        html += `<div class="social-profiles-grid">${filtered.map(p => renderSocialProfileCard(p)).join('')}</div>`;
      }

      html += '</div>';
      wrap.innerHTML = html;

      // Wire sub-tab clicks
      wrap.querySelectorAll('.social-sub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          _socialFilterTab = tab.dataset.stab;
          renderSocialPanel();
        });
      });

      // Wire collapsible
      const panel = document.getElementById('social-profiles-panel');
      const phead = panel?.querySelector('.phead');
      if (phead) {
        phead.addEventListener('click', (e) => {
          if (e.target.closest('.social-panel-actions') || e.target.closest('.filter-pill')) return;
          panel.classList.toggle('collapsed');
        });
      }

      // Wire Add Handle button
      const addBtn = document.getElementById('social-add-handle-btn');
      const emptyAddBtn = document.getElementById('social-empty-add-btn');
      const openAddModal = () => {
        showModal('Add Social Handle',
          `<div class="modal-sub">Add an official social media handle for this brand.</div>
           <div class="form-group"><label class="form-label">Platform</label><select class="form-select" id="social-modal-platform"><option value="twitter">Twitter / X</option><option value="linkedin">LinkedIn</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="github">GitHub</option><option value="youtube">YouTube</option></select></div>
           <div class="form-group"><label class="form-label">Handle</label><input class="form-input" placeholder="@acmecorp" id="social-modal-handle"></div>
           <div class="form-group" style="display:flex;align-items:center;gap:8px">
             <input type="checkbox" id="social-modal-official" checked style="accent-color:var(--blue-primary)">
             <label for="social-modal-official" style="font-size:12px;color:var(--text-secondary)">This is our official account</label>
           </div>`,
          async (overlay) => {
            const platform = document.getElementById('social-modal-platform')?.value;
            let handle = document.getElementById('social-modal-handle')?.value?.trim();
            if (!handle) {
              const inp = document.getElementById('social-modal-handle');
              if (inp) inp.style.borderColor = 'var(--threat-critical)';
              return false;
            }
            handle = handle.replace(/^@/, '');
            try {
              const handles = { ...(socialConfig.official_handles || {}) };
              handles[platform] = handle;
              await api(`/brands/${brandId}/social-config`, {
                method: 'PATCH',
                body: JSON.stringify({ official_handles: handles }),
              });
              socialConfig.official_handles = handles;
              showToast(`Added @${handle} on ${platform}`, 'success');
              // Refresh profiles
              const refreshed = await api(`/brands/${brandId}/social-profiles`).catch(() => null);
              socialProfiles = refreshed?.data || socialProfiles;
              renderSocialPanel();
            } catch (err) { showToast(err.message, 'error'); }
          }
        );
      };
      if (addBtn) addBtn.addEventListener('click', (e) => { e.stopPropagation(); openAddModal(); });
      if (emptyAddBtn) emptyAddBtn.addEventListener('click', openAddModal);

      // Wire Scan Now button
      const scanBtn = document.getElementById('social-scan-btn');
      if (scanBtn) {
        scanBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          scanBtn.disabled = true;
          scanBtn.textContent = '⏳ Scanning...';
          try {
            const res = await api(`/social/scan/${brandId}`, { method: 'POST' });
            const count = res?.data?.results_count || res?.data?.profiles_found || 0;
            showToast(`Scan complete — ${count} profiles found`, 'success');
            const refreshed = await api(`/brands/${brandId}/social-profiles`).catch(() => null);
            socialProfiles = refreshed?.data || socialProfiles;
            renderSocialPanel();
          } catch (err) { showToast(err.message || 'Scan failed', 'error'); }
          scanBtn.disabled = false;
          scanBtn.textContent = '🔍 Scan Now';
        });
      }

      // Wire Auto-Discover button
      const discoverBtn = document.getElementById('social-discover-btn');
      if (discoverBtn) {
        discoverBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          discoverBtn.disabled = true;
          discoverBtn.textContent = '⏳ Discovering...';
          try {
            const res = await api(`/brands/${brandId}/discover-social`, { method: 'POST' });
            const count = res?.data?.discovered?.length || 0;
            const domain = b?.canonical_domain || 'website';
            showToast(`Discovered ${count} social profile${count !== 1 ? 's' : ''} from ${domain}`, 'success');
            const refreshed = await api(`/brands/${brandId}/social-profiles`).catch(() => null);
            socialProfiles = refreshed?.data || socialProfiles;
            // Update social config with new handles
            if (res?.data?.handles_updated) {
              socialConfig.official_handles = res.data.handles_updated;
            }
            renderSocialPanel();
          } catch (err) { showToast(err.message || 'Discovery failed', 'error'); }
          discoverBtn.disabled = false;
          discoverBtn.textContent = '🌐 Auto-Discover';
        });
      }
    }

    // Global classification action handler
    window._socialClassify = async function(profileId, classification, status) {
      try {
        const body = { classification };
        if (status) body.status = status;
        await api(`/brands/${brandId}/social-profiles/${profileId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        showToast(`Profile classified as ${classification}`, 'success');
        const refreshed = await api(`/brands/${brandId}/social-profiles`).catch(() => null);
        socialProfiles = refreshed?.data || socialProfiles;
        renderSocialPanel();
      } catch (err) { showToast(err.message, 'error'); }
    };

    // AI Re-Assessment handler
    window._socialReassess = async function(profileId, btn) {
      if (btn) { btn.disabled = true; btn.textContent = 'Assessing...'; }
      try {
        const res = await api(`/brands/${brandId}/social-profiles/${profileId}/assess`, { method: 'POST' });
        const assessment = res?.data?.assessment;
        if (assessment) {
          showToast(`AI Assessment: ${assessment.classification} (${Math.round(assessment.confidence * 100)}% confidence)`, 'success');
        } else {
          showToast('AI assessment completed', 'success');
        }
        const refreshed = await api(`/brands/${brandId}/social-profiles`).catch(() => null);
        socialProfiles = refreshed?.data || socialProfiles;
        renderSocialPanel();
      } catch (err) { showToast(err.message || 'AI assessment failed', 'error'); }
      if (btn) { btn.disabled = false; btn.textContent = 'Re-Assess'; }
    };

    // Copy Takedown Evidence handler
    window._copyTakedownEvidence = async function(btn, profileId) {
      const profile = socialProfiles.find(p => p.id === profileId);
      if (!profile || !profile.ai_evidence_draft) {
        showToast('No takedown evidence available', 'error');
        return;
      }
      try {
        await navigator.clipboard.writeText(profile.ai_evidence_draft);
        showToast('Takedown evidence copied to clipboard', 'success');
      } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = profile.ai_evidence_draft;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Takedown evidence copied to clipboard', 'success');
      }
    };

    renderSocialPanel();

    // ─── CSV Upload Modal logic ─────────────────────────────
    let parsedDomains = [];
    const csvModal = document.getElementById('csv-upload-modal');
    const csvFileInput = document.getElementById('csv-file-input');
    const csvPreview = document.getElementById('csv-preview');
    const csvUploadBtn = document.getElementById('csv-upload-btn');
    const csvCancelBtn = document.getElementById('csv-cancel-btn');

    function parseCSVDomains(text) {
      const lines = text.split(/\r?\n/);
      const domains = [];
      let headerIdx = -1;
      lines.forEach((line, i) => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        // Detect header row
        if (i === 0 && /\b(domain|url|host|name)\b/i.test(line)) {
          const cols = line.split(/[,\t]/);
          headerIdx = cols.findIndex(c => /^(domain|url|host|name)$/i.test(c.trim()));
          if (headerIdx < 0) headerIdx = 0;
          return;
        }
        let val = line;
        if (line.includes(',') || line.includes('\t')) {
          const cols = line.split(/[,\t]/);
          val = cols[headerIdx >= 0 ? headerIdx : 0] || '';
        }
        val = val.trim().replace(/^["']|["']$/g, '');
        // Clean: strip protocol, path, www
        val = val.toLowerCase().replace(/^https?:\/\//, '').replace(/^ftp:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '').trim();
        if (!val || val.length < 3 || !val.includes('.') || /\s/.test(val)) return;
        if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(val)) {
          domains.push(val);
        }
      });
      // Deduplicate
      return [...new Set(domains)];
    }

    if (csvFileInput) {
      csvFileInput.addEventListener('change', () => {
        const file = csvFileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          parsedDomains = parseCSVDomains(reader.result);
          if (csvPreview) {
            csvPreview.style.display = 'block';
            let previewHtml = `<div style="font-weight:600;color:var(--text-primary);margin-bottom:6px">Found ${parsedDomains.length} domains in your file</div>`;
            if (parsedDomains.length === 0) {
              previewHtml += '<div style="color:var(--negative)">No valid domains found. Check file format.</div>';
            } else {
              parsedDomains.slice(0, 10).forEach(d => {
                previewHtml += `<div style="font-family:var(--font-mono);padding:2px 0;color:var(--text-secondary)">${d}</div>`;
              });
              if (parsedDomains.length > 10) {
                previewHtml += `<div style="color:var(--text-tertiary);margin-top:4px">...and ${parsedDomains.length - 10} more</div>`;
              }
            }
            csvPreview.innerHTML = previewHtml;
          }
          if (csvUploadBtn) csvUploadBtn.disabled = parsedDomains.length === 0;
        };
        reader.readAsText(file);
      });
    }

    if (csvUploadBtn) {
      csvUploadBtn.addEventListener('click', async () => {
        if (!parsedDomains.length) return;
        csvUploadBtn.disabled = true;
        csvUploadBtn.textContent = 'Uploading...';
        const res = await api(`/brands/${brandId}/safe-domains/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domains: parsedDomains }),
        });
        if (csvModal) csvModal.style.display = 'none';
        if (res?.success && res.data) {
          // Reload safe domains list
          const refreshed = await api(`/brands/${brandId}/safe-domains`).catch(() => null);
          safeDomains = refreshed?.data || safeDomains;
          renderSafeDomains();
        }
        // Reset
        parsedDomains = [];
        if (csvFileInput) csvFileInput.value = '';
        if (csvPreview) { csvPreview.style.display = 'none'; csvPreview.innerHTML = ''; }
        if (csvUploadBtn) { csvUploadBtn.disabled = true; csvUploadBtn.textContent = 'Upload'; }
      });
    }

    if (csvCancelBtn) {
      csvCancelBtn.addEventListener('click', () => {
        if (csvModal) csvModal.style.display = 'none';
        parsedDomains = [];
        if (csvFileInput) csvFileInput.value = '';
        if (csvPreview) { csvPreview.style.display = 'none'; csvPreview.innerHTML = ''; }
        if (csvUploadBtn) { csvUploadBtn.disabled = true; csvUploadBtn.textContent = 'Upload'; }
      });
    }

    // Close modal on backdrop click
    if (csvModal) {
      csvModal.addEventListener('click', (e) => {
        if (e.target === csvModal) csvCancelBtn?.click();
      });
    }

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
        html += `<table class="data-table"><thead><tr><th>Malicious URL</th><th>Type</th><th>Provider</th><th>First Seen</th><th>Status</th><th>Ev</th><th></th></tr></thead><tbody>`;
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
            <td><button class="mark-safe-btn" data-domain="${url}" title="Mark domain as safe/owned" style="background:none;border:1px solid rgba(0,229,160,.3);border-radius:4px;color:var(--positive);cursor:pointer;font-size:9px;padding:2px 6px;white-space:nowrap">&#10003; Safe</button></td>
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

      // Wire mark-safe buttons
      panel?.querySelectorAll('.mark-safe-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const domain = btn.dataset.domain;
          if (!domain) return;
          btn.disabled = true;
          btn.textContent = '...';
          const res = await api(`/brands/${brandId}/safe-domains`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain }),
          });
          if (res?.success && res.data) {
            safeDomains.unshift(res.data);
            renderSafeDomains();
            // Dim the row visually
            const row = btn.closest('tr');
            if (row) row.style.opacity = '0.3';
            btn.textContent = '\u2713';
            btn.style.color = 'var(--text-tertiary)';
          }
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
            x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, callback: function(val, idx) { const l = this.getLabelForValue(idx); if (l && l.includes('T')) { const [d, t] = l.split('T'); return t || l; } return l; } }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false } },
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

    // Brand AI analysis — generate or refresh
    async function triggerBrandAnalysis() {
      const body = document.getElementById('brand-analysis-body');
      const badge = document.getElementById('brand-analysis-badge');
      if (!body) return;
      body.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-tertiary)"><span class="dash-spinner" style="display:inline-block;width:16px;height:16px;border:2px solid rgba(0,212,255,.3);border-top-color:var(--blue-primary);border-radius:50%;animation:trigger-spin 0.6s linear infinite"></span> Generating analysis...</div>';
      try {
        const res = await api(`/brands/${params.id}/analysis`, { method: 'POST' });
        const d = res?.data;
        if (d?.analysis) {
          if (badge) badge.textContent = 'Current';
          body.innerHTML = `<div style="font-size:13px;line-height:1.6;color:var(--text-primary);margin-bottom:12px">${d.analysis}</div>
            ${d.key_findings?.length ? `<div style="margin-bottom:12px">${d.key_findings.map(f => `<div style="display:flex;gap:8px;padding:4px 0;font-size:11px;color:var(--text-secondary)"><span style="color:var(--threat-medium)">\u25cf</span>${f}</div>`).join('')}</div>` : ''}
            ${d.risk_level ? `<span style="font-family:var(--font-mono);font-size:9px;padding:2px 7px;border-radius:3px;background:rgba(255,182,39,.1);color:var(--threat-medium)">${d.risk_level} risk</span>` : ''}
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary);margin-left:8px">Just now</span>
            <button class="filter-pill" id="brand-refresh-analysis" style="margin-left:8px;font-size:9px">\u21bb Refresh</button>`;
          body.querySelector('#brand-refresh-analysis')?.addEventListener('click', triggerBrandAnalysis);
        } else {
          body.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-tertiary)">Analysis generation failed — check API key configuration</div>';
        }
      } catch (err) {
        body.innerHTML = `<div style="text-align:center;padding:12px;color:var(--negative)">${err.message || 'Failed to generate analysis'}</div>`;
      }
    }
    document.getElementById('brand-gen-analysis')?.addEventListener('click', triggerBrandAnalysis);
    document.getElementById('brand-refresh-analysis')?.addEventListener('click', triggerBrandAnalysis);

    // AI Deep Scan handler
    document.getElementById('brand-deep-scan')?.addEventListener('click', async () => {
      const btn = document.getElementById('brand-deep-scan');
      const resultEl = document.getElementById('deep-scan-result');
      if (!btn) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="dash-spinner"></span> Scanning...';
      if (resultEl) resultEl.textContent = '';
      try {
        const res = await api(`/brands/${params.id}/deep-scan`, { method: 'POST' });
        const d = res?.data;
        btn.innerHTML = '\uD83D\uDD0D AI Deep Scan';
        btn.disabled = false;
        if (resultEl) resultEl.textContent = d?.newly_linked > 0 ? `Found ${d.newly_linked} additional threats (${d.scanned} scanned)` : `No new matches (${d?.scanned || 0} scanned)`;
        if (d?.newly_linked > 0) { showToast(`Deep scan linked ${d.newly_linked} new threats`, 'success'); }
      } catch (err) {
        btn.innerHTML = '\uD83D\uDD0D AI Deep Scan';
        btn.disabled = false;
        if (resultEl) resultEl.textContent = 'Scan failed: ' + (err.message || 'Unknown error');
      }
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
      <div class="provider-icon">${_providerLogoImg(p.name, 32)}</div>
      <div class="provider-card-info" style="min-width:0">
        <div class="provider-card-name" style="font-size:14px;font-weight:700;white-space:normal;word-wrap:break-word;overflow-wrap:break-word">${p.name}</div>
        ${(p.country_code || p.country) ? `<span style="display:inline-block;font-size:10px;padding:1px 6px;background:var(--bg-elevated);border-radius:4px;color:var(--text-secondary);margin-top:3px">${p.country_code || p.country}</span>` : ''}
        ${p.asn ? `<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);margin-top:2px;white-space:normal;word-wrap:break-word">${p.asn}</div>` : ''}
      </div>
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

// ─── Social Brand Monitor ──────────────────────────────────────
let _socialSubTab = 'brands';

function _renderPlatformStatusPills(brand) {
  let handles = {};
  try { handles = JSON.parse(brand.official_handles || '{}'); } catch {}
  const platforms = ['twitter','instagram','linkedin','tiktok','youtube','github'];
  const icons = { twitter: '𝕏', instagram: '◉', linkedin: 'in', tiktok: '♪', youtube: '▶', github: '⌥' };
  return platforms.map(p => {
    const hasHandle = !!handles[p];
    const color = hasHandle ? 'var(--positive)' : 'rgba(122,139,168,0.4)';
    const bg = hasHandle ? 'rgba(0,229,160,0.08)' : 'rgba(122,139,168,0.06)';
    const border = hasHandle ? 'rgba(0,229,160,0.25)' : 'rgba(122,139,168,0.15)';
    return `<span style="font-family:var(--font-mono);font-size:9px;padding:2px 6px;border-radius:4px;background:${bg};border:1px solid ${border};color:${color}">${icons[p] || p}</span>`;
  }).join('');
}

window.dismissSocialAlert = async function(resultId, e) {
  e.stopPropagation();
  try {
    await api(`/social/results/${resultId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'false_positive' })
    });
    showToast('Alert dismissed', 'success');
    if (typeof _loadSocialAlerts === 'function') _loadSocialAlerts();
  } catch (err) {
    showToast(err.message || 'Failed to dismiss', 'error');
  }
};

window.triggerSocialScan = async function(brandId, brandName, e) {
  e.stopPropagation();
  const btn = e.currentTarget;
  btn.textContent = '↻';
  btn.disabled = true;
  try {
    const res = await api(`/social/scan/${brandId}`, { method: 'POST' });
    const count = res?.data?.results_count || 0;
    showToast(`Scan complete — ${count} results for ${brandName}`, 'success');
    if (typeof _loadSocialBrands === 'function') _loadSocialBrands();
  } catch (err) {
    showToast(err.message || 'Scan failed', 'error');
    btn.textContent = '↻ Scan';
    btn.disabled = false;
  }
};

let _loadSocialBrands = null;
let _loadSocialAlerts = null;

async function viewSocialMonitor(el) {
  el.innerHTML = `
    <div style="padding:20px 24px 0">
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px;letter-spacing:1px">
        SOCIAL BRAND MONITOR
      </div>
    </div>
    <div class="agg-stats" id="social-agg"></div>
    <div class="sub-tabs" id="social-tabs">
      <button class="sub-tab active" data-tab="brands">Brand Coverage<span class="tab-count" id="tc-social-brands">--</span></button>
      <button class="sub-tab" data-tab="alerts">Active Alerts<span class="tab-count" id="tc-social-alerts">--</span></button>
      <button class="sub-tab" data-tab="add">+ Add Brand</button>
    </div>
    <div style="padding:20px 24px" id="social-content">Loading...</div>`;

  scrollActiveTabIntoView('#social-tabs');

  // ── Aggregate stats ──
  (async function loadSocialAgg() {
    const [overviewRes, alertsRes] = await Promise.all([
      api('/social/monitor?limit=100').catch(() => null),
      api('/social/alerts?limit=100').catch(() => null),
    ]);
    const brands = overviewRes?.data || [];
    const alerts = alertsRes?.data || [];
    const critCount = alerts.filter(a => a.severity === 'CRITICAL').length;
    const highCount = alerts.filter(a => a.severity === 'HIGH').length;
    const atRisk = brands.filter(b =>
      (b.monitoring?.open_critical || 0) > 0 || (b.monitoring?.open_high || 0) > 0
    ).length;
    const aggEl = document.getElementById('social-agg');
    if (aggEl) aggEl.innerHTML = `
      <div class="agg-card"><div class="agg-val" style="color:var(--blue-primary)">${brands.length}</div><div class="agg-lbl">Brands monitored</div><div class="agg-sub">Across 6 platforms</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--negative)">${critCount}</div><div class="agg-lbl">Critical alerts</div><div class="agg-sub">Require immediate action</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--threat-high)">${highCount}</div><div class="agg-lbl">High severity</div><div class="agg-sub">Likely impersonation</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--threat-medium)">${atRisk}</div><div class="agg-lbl">Brands at risk</div><div class="agg-sub">Open findings</div></div>`;
  })();

  // ── Brand Coverage tab ──
  _loadSocialBrands = async function() {
    const content = document.getElementById('social-content');
    if (!content) return;
    content.innerHTML = 'Loading...';
    const res = await api('/social/monitor?limit=50').catch(() => null);
    const brands = res?.data || [];
    const tcEl = document.getElementById('tc-social-brands');
    if (tcEl) tcEl.textContent = brands.length;

    if (!brands.length) {
      content.innerHTML = `<div class="empty-state"><div class="message">No brands monitored yet<br><span style="font-size:11px;color:var(--text-tertiary)">Add your first brand to start monitoring social platforms</span></div><button class="btn-monitor" onclick="_socialSubTab='add';document.querySelectorAll('#social-tabs .sub-tab').forEach(t=>t.classList.remove('active'));document.querySelector('#social-tabs .sub-tab[data-tab=add]').classList.add('active');_renderAddBrandForm()">+ Add First Brand</button></div>`;
      return;
    }

    content.innerHTML = `<div class="brand-grid">${brands.map(b => {
      const brandId = b.brand_id || b.id;
      const brandName = b.brand_name || b.name || '';
      return `<a class="brand-card" onclick="event.preventDefault()">
        <div class="brand-card-top">
          ${_brandLogoImg(brandName, 36)}
          <div class="brand-card-info">
            <div class="brand-card-name">${brandName}</div>
            <div class="brand-card-sector" style="font-family:var(--font-mono);font-size:10px">${b.domain || ''}</div>
          </div>
        </div>
        <div class="brand-card-stats" style="margin:10px 0 8px">
          <div class="social-platform-grid">${_renderPlatformStatusPills(b)}</div>
        </div>
        <div class="brand-card-footer">
          <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">Last scan: ${b.last_full_scan ? timeAgo(b.last_full_scan) : 'Never'}</span>
          <div style="display:flex;gap:6px;align-items:center">
            ${(b.monitoring?.open_critical || 0) > 0 ? `<span class="type-pill phishing">${b.monitoring.open_critical} critical</span>` : ''}
            ${(b.monitoring?.open_high || 0) > 0 ? `<span class="type-pill typosquat">${b.monitoring.open_high} high</span>` : ''}
            ${!(b.monitoring?.open_critical) && !(b.monitoring?.open_high) ? `<span style="color:var(--positive);font-size:11px">✓ Clear</span>` : ''}
            <button class="btn-monitor" style="font-size:10px;padding:3px 8px" onclick="triggerSocialScan('${brandId}','${brandName.replace(/'/g, "\\'")}',event)">↻ Scan</button>
          </div>
        </div>
      </a>`;
    }).join('')}</div>`;
    _attachLogoFallbacks(content);
  };

  // ── Active Alerts tab ──
  let _socialSevFilter = 'all';

  _loadSocialAlerts = async function() {
    const content = document.getElementById('social-content');
    if (!content) return;
    content.innerHTML = 'Loading...';
    const res = await api('/social/alerts?status=open&limit=50').catch(() => null);
    const allAlerts = res?.data || [];
    const tcEl = document.getElementById('tc-social-alerts');
    if (tcEl) tcEl.textContent = allAlerts.length;

    const alerts = _socialSevFilter === 'all' ? allAlerts : allAlerts.filter(a => a.severity === _socialSevFilter);

    if (!allAlerts.length) {
      content.innerHTML = '<div class="empty-state"><div class="message">No active alerts — looking good</div></div>';
      return;
    }

    const filterHtml = renderFilterPills(
      [{ value: 'all', label: 'All' }, { value: 'CRITICAL', label: 'Critical' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }],
      [_socialSevFilter],
      'social-sev-filter'
    );

    content.innerHTML = `${filterHtml}
      <table class="data-table" style="margin-top:12px">
        <thead><tr><th>Handle</th><th>Platform</th><th>Brand</th><th>Severity</th><th>Score</th><th>Detected</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${alerts.map(a => {
          const score = Math.round((a.impersonation_score || 0) * 100);
          const scoreColor = a.severity === 'CRITICAL' ? 'var(--negative)' : a.severity === 'HIGH' ? 'var(--threat-high)' : a.severity === 'MEDIUM' ? 'var(--threat-medium)' : 'var(--positive)';
          return `<tr>
            <td style="font-family:var(--font-mono);font-size:11px">@${a.handle_checked || a.suspicious_account_name || '-'}</td>
            <td><span class="type-pill ${a.platform || ''}">${a.platform || '-'}</span></td>
            <td style="font-size:12px">${a.brand_name || '-'}</td>
            <td><span class="sev ${(a.severity || '').toLowerCase()}">${a.severity || '-'}</span></td>
            <td style="font-family:var(--font-mono);font-size:12px;font-weight:700;color:${scoreColor}">${score}%</td>
            <td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${a.created_at ? timeAgo(a.created_at) : '-'}</td>
            <td><span class="status-badge-sm ${a.status || 'open'}">${a.status || 'open'}</span></td>
            <td>
              ${a.suspicious_account_url ? `<a href="${a.suspicious_account_url}" target="_blank" rel="noopener" class="adm-action-btn" style="font-size:10px">View Profile</a>` : ''}
              <button class="adm-action-btn" style="font-size:10px" onclick="dismissSocialAlert('${a.id}',event)">Dismiss</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;

    // Wire severity filter clicks
    document.getElementById('social-sev-filter')?.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;
      _socialSevFilter = pill.dataset.value;
      document.querySelectorAll('#social-sev-filter .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      _loadSocialAlerts();
    });
  };

  // ── Add Brand tab ──
  function _renderAddBrandForm() {
    const content = document.getElementById('social-content');
    if (!content) return;
    content.innerHTML = `<div style="max-width:560px">
      <div style="font-family:var(--font-display);font-size:14px;font-weight:700;margin-bottom:4px;letter-spacing:.5px">Add Brand Profile</div>
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:20px">Add your brand to start monitoring impersonation across 6 platforms.</div>
      <div class="form-group"><label class="form-label">Brand Name</label><input class="form-input" id="social-add-name" placeholder="Acme Corporation"></div>
      <div class="form-group"><label class="form-label">Domain</label><input class="form-input" id="social-add-domain" placeholder="acmecorp.com"></div>
      <div style="font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--text-secondary);margin:16px 0 8px">OFFICIAL HANDLES (optional)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        ${['twitter','instagram','linkedin','tiktok','youtube','github'].map(p =>
          `<div class="form-group" style="margin:0"><label class="form-label" style="font-size:10px;text-transform:capitalize">${p}</label><input class="form-input" id="social-handle-${p}" placeholder="handle (without @)" style="font-family:var(--font-mono);font-size:12px"></div>`
        ).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-monitor" id="social-add-submit">+ Start Monitoring</button>
        <button class="filter-pill" id="social-add-cancel">Cancel</button>
      </div>
      <div id="social-add-error" style="display:none;color:var(--negative);font-size:12px;margin-top:8px"></div>
    </div>`;

    document.getElementById('social-add-submit')?.addEventListener('click', async () => {
      const name = document.getElementById('social-add-name')?.value?.trim();
      const domain = document.getElementById('social-add-domain')?.value?.trim();
      const errEl = document.getElementById('social-add-error');
      if (!name || !domain) {
        errEl.style.display = 'block';
        errEl.textContent = 'Brand name and domain are required';
        return;
      }
      const handles = {};
      ['twitter','instagram','linkedin','tiktok','youtube','github'].forEach(p => {
        const val = document.getElementById(`social-handle-${p}`)?.value?.trim().replace(/^@/, '');
        if (val) handles[p] = val;
      });
      const btn = document.getElementById('social-add-submit');
      btn.textContent = 'Adding...';
      btn.disabled = true;
      try {
        const res = await api('/brand-profiles', {
          method: 'POST',
          body: JSON.stringify({
            brand_name: name, domain,
            official_handles: JSON.stringify(handles),
            brand_keywords: JSON.stringify([name.toLowerCase(), name.toLowerCase().replace(/\s+/g, ''), domain.split('.')[0].toLowerCase()]),
            monitoring_tier: 'professional',
          })
        });
        if (res?.success && res?.data?.id) {
          showToast(`${name} is now being monitored`, 'success');
          api(`/social/scan/${res.data.id}`, { method: 'POST' }).catch(() => {});
          _socialSubTab = 'brands';
          document.querySelectorAll('#social-tabs .sub-tab').forEach(t => t.classList.remove('active'));
          document.querySelector('#social-tabs .sub-tab[data-tab="brands"]')?.classList.add('active');
          await _loadSocialBrands();
        } else {
          errEl.style.display = 'block';
          errEl.textContent = res?.error || 'Failed to add brand';
          btn.textContent = '+ Start Monitoring'; btn.disabled = false;
        }
      } catch (err) {
        errEl.style.display = 'block';
        errEl.textContent = err.message || 'Failed to add brand';
        btn.textContent = '+ Start Monitoring'; btn.disabled = false;
      }
    });

    document.getElementById('social-add-cancel')?.addEventListener('click', () => {
      _socialSubTab = 'brands';
      document.querySelectorAll('#social-tabs .sub-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('#social-tabs .sub-tab[data-tab="brands"]')?.classList.add('active');
      _loadSocialBrands();
    });
  }

  // ── Tab switching ──
  document.getElementById('social-tabs').addEventListener('click', async (e) => {
    const tab = e.target.closest('.sub-tab');
    if (!tab || !tab.dataset.tab) return;
    document.querySelectorAll('#social-tabs .sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    _socialSubTab = tab.dataset.tab;
    document.getElementById('social-content').innerHTML = 'Loading...';
    if (_socialSubTab === 'brands') await _loadSocialBrands();
    else if (_socialSubTab === 'alerts') await _loadSocialAlerts();
    else _renderAddBrandForm();
  });

  // ── Initial load ──
  await _loadSocialBrands();
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

  scrollActiveTabIntoView('#prov-tabs');

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
    _attachLogoFallbacks(content);
  };

  const loadImproving = async (period) => {
    const res = await api(`/providers/improving?period=${period}&limit=10`).catch(() => null);
    const providers = res?.data || [];
    const tcEl = document.getElementById('tc-impr');
    if (tcEl) tcEl.textContent = providers.length;
    const content = document.getElementById('prov-content');
    if (!providers.length) { content.innerHTML = '<div class="empty-state"><div class="message">No improving providers detected</div></div>'; return; }
    content.innerHTML = `<div class="provider-grid">${providers.map((p, i) => _renderProvCard(p, i, true)).join('')}</div>`;
    _attachLogoFallbacks(content);
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
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
      api(`/providers/${encodeURIComponent(params.id)}/timeline?period=7d`).catch(() => null),
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
        <div class="detail-header-icon" style="flex-direction:column;gap:2px">${_providerLogoImg(p.name, 48)}</div>
        <div class="detail-header-meta">
          <div class="detail-header-title">${p.name}</div>
          <div class="detail-header-sub" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${p.country_code || p.country ? `<span class="country-code-pill" style="font-size:11px;padding:3px 8px">${p.country_code || p.country}</span>` : ''}${p.asn ? `<span class="asn-pill">${p.asn}</span>` : ''}<span>Hosting Provider \u2014 ${totalThreats} active threats hosted</span></div>
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
          <div class="panel"><div class="phead"><span>Target Locations</span><span class="badge" id="prov-loc-ct">${locationsRes?.totalCountries || locations.length} countries</span></div><div class="panel-body"><div id="prov-mini-map" class="mini-map"></div></div></div>
          <div class="panel"><div class="phead"><span>Brands Targeted</span></div><div class="panel-body padded" id="prov-brand-bars">${brands.length ?
            brands.map((b, i) => {
              const cnt = b.count || b.threat_count || 0;
              const pct = maxBrand > 0 ? Math.round(cnt / maxBrand * 100) : 0;
              return `<div class="pbar-row"><span class="pbar-lbl">${b.name || b.brand_name}</span><div class="pbar-trk"><div class="pbar-fill" style="width:${pct}%;background:${provColors[i] || provColors[5]}"></div></div><span class="pbar-ct">${cnt}</span></div>`;
            }).join('') :
            '<div class="empty-state"><div class="message">No brand data yet<br><span style="font-size:10px;color:var(--text-tertiary)">Brand links appear after threat-brand matching runs</span></div></div>'
          }</div></div>
          <div class="panel"><div class="phead"><span>AI Assessment</span></div><div class="panel-body padded" id="prov-ai-insight"></div></div>
        </div>
      </div>
      <div>
        <div class="chart-head"><div class="chart-title">Threat Trend</div><div class="period-selector" id="prov-timeline-period">
          <button class="period-btn" data-period="24h">24H</button><button class="period-btn active" data-period="7d">7D</button><button class="period-btn" data-period="30d">30D</button><button class="period-btn" data-period="90d">90D</button>
        </div></div>
        <div class="chart-legend" id="prov-chart-legend"></div>
        <div class="chart-wrap"><canvas id="prov-timeline-chart"></canvas></div>
      </div>`;

    _attachLogoFallbacks(el);

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

    // ── Timeline chart with period selector ──
    if (_provDetailChart) { _provDetailChart.destroy(); _provDetailChart = null; }
    function renderProvTimeline(tl) {
      if (_provDetailChart) { _provDetailChart.destroy(); _provDetailChart = null; }
      if (!tl?.labels?.length || typeof Chart === 'undefined') return;
      _provDetailChart = new Chart(document.getElementById('prov-timeline-chart'), {
        type: 'line',
        data: { labels: tl.labels, datasets: [
          { label: 'Threats', data: tl.values, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.06)', fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#00d4ff', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, borderWidth: 2 }
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
              titleColor: '#e8edf5', bodyColor: '#7a8ba8', padding: 10, cornerRadius: 6,
              displayColors: false,
              callbacks: { label: i => i.parsed.y + ' threats' }
            }
          },
          scales: {
            x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, callback: function(val, idx) { const l = this.getLabelForValue(idx); if (l && l.includes('T')) { return l.split('T')[1] || l; } return l; } }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false } },
            y: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, padding: 8 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, beginAtZero: true }
          }
        }
      });
    }
    renderProvTimeline(timelineRes?.data);

    document.getElementById('prov-timeline-period')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.period-btn');
      if (!btn) return;
      document.querySelectorAll('#prov-timeline-period .period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      try {
        const tlRes = await api(`/providers/${encodeURIComponent(params.id)}/timeline?period=${btn.dataset.period}`);
        renderProvTimeline(tlRes?.data);
      } catch {}
    });

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
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    document.getElementById('camp-content').innerHTML = 'Loading...';
    await loadCampaigns(tab.dataset.tab);
  });
}

// ─── View: Campaign Detail (Step 11) ────────────────────────
let _campDetailChart = null;

function _campDrawInfraGraph(canvasEl, domains, ips, providers, overflow) {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvasEl.parentElement.clientWidth;
  const cssH = 380;
  canvasEl.width = cssW * dpr;
  canvasEl.height = cssH * dpr;
  canvasEl.style.width = cssW + 'px';
  canvasEl.style.height = cssH + 'px';
  ctx.scale(dpr, dpr);
  const w = cssW, h = cssH;
  ctx.clearRect(0, 0, w, h);
  const extra = overflow || {};

  // ── Column header row ──
  const colD = w * 0.15, colI = w * 0.5, colP = w * 0.85;
  const headerY = 18;
  ctx.font = '600 11px "Chakra Petch"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [['DOMAINS', colD, '#ff3b5c'], ['IPs', colI, '#00d4ff'], ['PROVIDERS', colP, '#ffb627']].forEach(([lbl, x, c]) => {
    ctx.fillStyle = c;
    ctx.fillText(lbl, x, headerY);
  });
  ctx.beginPath();
  ctx.moveTo(20, headerY + 12);
  ctx.lineTo(w - 20, headerY + 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const topPad = 42;
  const botPad = 30;

  // ── Y positions: center nodes when few items ──
  function computeY(arr, pad) {
    const usable = h - topPad - botPad - pad;
    if (arr.length === 1) return [topPad + usable / 2];
    return arr.map((_, i) => topPad + pad / 2 + i * usable / (arr.length - 1));
  }
  const domY = computeY(domains, 0);
  const ipY = computeY(ips, 10);
  const provY = computeY(providers, 20);

  // ── Connection tracking for hover ──
  const connections = [];

  // ── Draw connections: domains → IPs (red Bezier) ──
  domains.forEach((d, di) => {
    const dObj = typeof d === 'string' ? { domain: d } : d;
    const dIp = dObj.ip || dObj.ip_address;
    ips.forEach((ipNode, ii) => {
      const ipStr = typeof ipNode === 'string' ? ipNode : ipNode.ip || ipNode.address || '';
      // Connect if same IP or fallback: first 2 IPs
      const linked = dIp ? (dIp === ipStr) : (ii < 2 || (di + ii) % ips.length < 2);
      if (!linked && ips.length > 2) return;
      ctx.beginPath();
      const x0 = colD + 70, y0 = domY[di], x1 = colI - 50, y1 = ipY[ii];
      ctx.moveTo(x0, y0);
      const cpx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
      ctx.strokeStyle = 'rgba(255,59,92,0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      connections.push({ type: 'domain-ip', di, ii, x0, y0, x1, y1 });
    });
  });

  // ── Draw connections: IPs → Providers (cyan Bezier) ──
  ips.forEach((ipNode, ii) => {
    const ipObj = typeof ipNode === 'string' ? {} : ipNode;
    const ipProv = ipObj.provider || ipObj.hosting_provider;
    providers.forEach((pNode, pi) => {
      const provStr = typeof pNode === 'string' ? pNode : pNode.name || pNode.provider || '';
      const linked = ipProv ? (ipProv === provStr) : (pi === ii % providers.length);
      if (!linked && providers.length > 2) return;
      ctx.beginPath();
      const x0 = colI + 50, y0 = ipY[ii], x1 = colP - 70, y1 = provY[pi];
      ctx.moveTo(x0, y0);
      const cpx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
      ctx.strokeStyle = 'rgba(0,212,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      connections.push({ type: 'ip-prov', ii, pi, x0, y0, x1, y1 });
    });
  });

  // ── Draw nodes ──
  const nodeRects = [];
  function drawNode(x, y, label, type, idx) {
    const colors = { domain: ['rgba(255,59,92,0.18)', '#ff3b5c'], ip: ['rgba(0,212,255,0.14)', '#00d4ff'], provider: ['rgba(255,182,39,0.14)', '#ffb627'] };
    const [bg, fg] = colors[type] || colors.ip;
    ctx.font = '500 11px "IBM Plex Mono"';
    const tw = ctx.measureText(label).width;
    const pw = tw + 20;
    const ph = 24;
    const rx = x - pw / 2, ry = y - ph / 2;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(rx, ry, pw, ph, 5);
    ctx.fill();
    ctx.strokeStyle = fg + '55';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
    nodeRects.push({ x: rx, y: ry, w: pw, h: ph, type, idx, label });
  }

  domains.forEach((d, i) => drawNode(colD, domY[i], (typeof d === 'string' ? d : d.domain || d.name || '').substring(0, 22), 'domain', i));
  ips.forEach((ip, i) => drawNode(colI, ipY[i], typeof ip === 'string' ? ip : ip.ip || ip.address || '', 'ip', i));
  providers.forEach((p, i) => drawNode(colP, provY[i], (typeof p === 'string' ? p : p.name || p.provider || '').substring(0, 22), 'provider', i));

  // ── "+N more" indicators ──
  ctx.font = '500 10px "IBM Plex Mono"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (extra.extraDomains > 0) { ctx.fillStyle = '#ff3b5c80'; ctx.fillText(`+${extra.extraDomains} more`, colD, h - 12); }
  if (extra.extraIps > 0) { ctx.fillStyle = '#00d4ff80'; ctx.fillText(`+${extra.extraIps} more`, colI, h - 12); }
  if (extra.extraProviders > 0) { ctx.fillStyle = '#ffb62780'; ctx.fillText(`+${extra.extraProviders} more`, colP, h - 12); }

  // ── Hover highlight: highlight connected nodes and lines ──
  let hoveredNode = null;
  canvasEl.style.cursor = 'default';

  function redrawHighlight(hovered) {
    // Redraw full graph then overlay highlights
    ctx.clearRect(0, 0, w, h);
    // Re-call without hover to redraw base
    _campDrawInfraGraph.__drawBase(ctx, w, h, domains, ips, providers, domY, ipY, provY, colD, colI, colP, connections, nodeRects, extra, headerY);
    if (!hovered) return;
    // Highlight connected edges
    const ht = hovered.type, hi = hovered.idx;
    connections.forEach(c => {
      let match = false;
      if (ht === 'domain' && c.type === 'domain-ip' && c.di === hi) match = true;
      if (ht === 'ip' && c.type === 'domain-ip' && c.ii === hi) match = true;
      if (ht === 'ip' && c.type === 'ip-prov' && c.ii === hi) match = true;
      if (ht === 'provider' && c.type === 'ip-prov' && c.pi === hi) match = true;
      if (match) {
        ctx.beginPath();
        ctx.moveTo(c.x0, c.y0);
        const cpx = (c.x0 + c.x1) / 2;
        ctx.bezierCurveTo(cpx, c.y0, cpx, c.y1, c.x1, c.y1);
        ctx.strokeStyle = c.type === 'domain-ip' ? 'rgba(255,59,92,0.7)' : 'rgba(0,212,255,0.7)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    });
  }

  canvasEl.onmousemove = function(e) {
    const rect = canvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const found = nodeRects.find(n => mx >= n.x && mx <= n.x + n.w && my >= n.y && my <= n.y + n.h);
    if (found && (!hoveredNode || found.type !== hoveredNode.type || found.idx !== hoveredNode.idx)) {
      hoveredNode = found;
      canvasEl.style.cursor = 'pointer';
      redrawHighlight(found);
    } else if (!found && hoveredNode) {
      hoveredNode = null;
      canvasEl.style.cursor = 'default';
      redrawHighlight(null);
    }
  };
  canvasEl.onmouseleave = function() {
    if (hoveredNode) { hoveredNode = null; canvasEl.style.cursor = 'default'; redrawHighlight(null); }
  };
}

// Static base-draw helper for hover re-render (avoids full re-init)
_campDrawInfraGraph.__drawBase = function(ctx, w, h, domains, ips, providers, domY, ipY, provY, colD, colI, colP, connections, nodeRects, extra, headerY) {
  // Header
  ctx.font = '600 11px "Chakra Petch"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [['DOMAINS', colD, '#ff3b5c'], ['IPs', colI, '#00d4ff'], ['PROVIDERS', colP, '#ffb627']].forEach(([lbl, x, c]) => {
    ctx.fillStyle = c;
    ctx.fillText(lbl, x, headerY);
  });
  ctx.beginPath(); ctx.moveTo(20, headerY + 12); ctx.lineTo(w - 20, headerY + 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();

  // Connections
  connections.forEach(c => {
    ctx.beginPath();
    ctx.moveTo(c.x0, c.y0);
    const cpx = (c.x0 + c.x1) / 2;
    ctx.bezierCurveTo(cpx, c.y0, cpx, c.y1, c.x1, c.y1);
    ctx.strokeStyle = c.type === 'domain-ip' ? 'rgba(255,59,92,0.28)' : 'rgba(0,212,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Nodes
  nodeRects.forEach(n => {
    const colors = { domain: ['rgba(255,59,92,0.18)', '#ff3b5c'], ip: ['rgba(0,212,255,0.14)', '#00d4ff'], provider: ['rgba(255,182,39,0.14)', '#ffb627'] };
    const [bg, fg] = colors[n.type] || colors.ip;
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(n.x, n.y, n.w, n.h, 5); ctx.fill();
    ctx.strokeStyle = fg + '55'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '500 11px "IBM Plex Mono"'; ctx.fillStyle = fg;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.label, n.x + n.w / 2, n.y + n.h / 2);
  });

  // +N more
  ctx.font = '500 10px "IBM Plex Mono"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (extra.extraDomains > 0) { ctx.fillStyle = '#ff3b5c80'; ctx.fillText(`+${extra.extraDomains} more`, colD, h - 12); }
  if (extra.extraIps > 0) { ctx.fillStyle = '#00d4ff80'; ctx.fillText(`+${extra.extraIps} more`, colI, h - 12); }
  if (extra.extraProviders > 0) { ctx.fillStyle = '#ffb62780'; ctx.fillText(`+${extra.extraProviders} more`, colP, h - 12); }
};

async function viewCampaignDetail(el, params) {
  el.innerHTML = 'Loading...';
  try {
    const [campRes, threatsRes, infraRes, brandsRes, timelineRes] = await Promise.all([
      api(`/campaigns/${params.id}`),
      api(`/campaigns/${params.id}/threats?limit=15`).catch(() => null),
      api(`/campaigns/${params.id}/infrastructure`).catch(() => null),
      api(`/campaigns/${params.id}/brands`).catch(() => null),
      api(`/campaigns/${params.id}/timeline?period=7d`).catch(() => null),
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
        <div class="infra-body" style="height:380px"><canvas id="camp-infra-canvas" class="infra-canvas"></canvas></div>
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
      '<div class="empty-state"><div class="message">No brands linked yet<br><span style="font-size:10px;color:var(--text-tertiary)">Brands appear after threat-brand matching</span></div></div>'
    }</div></div>
          <div class="panel"><div class="phead"><span class="ptitle" style="display:flex;align-items:center;gap:7px">Infrastructure Stats</span></div><div class="padded">
            <div class="infra-stat"><span class="infra-stat-label">TLD Distribution</span><span class="infra-stat-val">${Object.entries(tldDist).map(([t, v]) => `${t}: ${v}`).join(', ') || '\u2014'}</span></div>
            <div class="infra-stat"><span class="infra-stat-label">Providers</span><span class="infra-stat-val">${providerNames.join(', ') || '\u2014'}</span></div>
            <div class="infra-stat"><span class="infra-stat-label">Registrars</span><span class="infra-stat-val">${regCount} unique</span></div>
            <div class="infra-stat"><span class="infra-stat-label">IP Ranges</span><span class="infra-stat-val">${ipCount} unique addresses</span></div>
          </div></div>
        </div>
      </div>

      <div class="chart-head"><div class="chart-title">Campaign Activity Timeline</div><div class="period-selector" id="camp-timeline-period">
        <button class="period-btn" data-period="24h">24H</button><button class="period-btn active" data-period="7d">7D</button><button class="period-btn" data-period="30d">30D</button><button class="period-btn" data-period="90d">90D</button>
      </div></div>
      <div class="chart-wrap"><canvas id="camp-timeline-chart"></canvas></div>`;

    // ── Draw infrastructure graph on canvas with Bezier connections ──
    setTimeout(() => {
      const canvas = document.getElementById('camp-infra-canvas');
      if (!canvas) return;
      const allDomains = infra.domains || [];
      const allIps = infra.ips || [];
      const allProviders = infra.providers || [];
      const domainNodes = allDomains.slice(0, 8);
      const ipNodes = allIps.slice(0, 8);
      const provNodes = allProviders.slice(0, 8);
      if (domainNodes.length || ipNodes.length || provNodes.length) {
        _campDrawInfraGraph(canvas, domainNodes, ipNodes, provNodes, {
          extraDomains: Math.max(0, allDomains.length - 8),
          extraIps: Math.max(0, allIps.length - 8),
          extraProviders: Math.max(0, allProviders.length - 8),
        });
      }
    }, 100);

    // ── Timeline chart with period selector ──
    if (_campDetailChart) { _campDetailChart.destroy(); _campDetailChart = null; }
    const sevColorMap = { critical: '255,59,92', high: '255,107,53', medium: '255,182,39' };
    const rawColor = sevColorMap[sev] || '255,59,92';

    function renderCampTimeline(tl) {
      if (_campDetailChart) { _campDetailChart.destroy(); _campDetailChart = null; }
      if (!tl?.labels?.length || typeof Chart === 'undefined') return;
      const ctx2 = document.getElementById('camp-timeline-chart');
      if (!ctx2) return;
      _campDetailChart = new Chart(ctx2, {
        type: 'line',
        data: { labels: tl.labels, datasets: [{
          label: 'Threats', data: tl.values,
          borderColor: `rgb(${rawColor})`, backgroundColor: `rgba(${rawColor},0.06)`,
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
              titleColor: '#e8edf5', bodyColor: '#7a8ba8', padding: 10, cornerRadius: 6, displayColors: false,
              callbacks: { label: i => i.parsed.y + ' threats' }
            }
          },
          scales: {
            x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, callback: function(val, idx) { const l = this.getLabelForValue(idx); if (l && l.includes('T')) { return l.split('T')[1] || l; } return l; } }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false } },
            y: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 9 }, padding: 8 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, beginAtZero: true }
          }
        }
      });
    }
    setTimeout(() => renderCampTimeline(timelineRes?.data), 150);

    document.getElementById('camp-timeline-period')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.period-btn');
      if (!btn) return;
      document.querySelectorAll('#camp-timeline-period .period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      try {
        const tlRes = await api(`/campaigns/${params.id}/timeline?period=${btn.dataset.period}`);
        renderCampTimeline(tlRes?.data);
      } catch {}
    });

    // Cleanup
    window._viewCleanup = () => {
      if (_campDetailChart) { _campDetailChart.destroy(); _campDetailChart = null; }
    };

  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Trends (Step 12) ─────────────────────────────────
const CHART_COLORS = ['#00d4ff', '#ff3b5c', '#ff6b35', '#ffb627', '#00e5a0', '#b388ff', '#0091b3', '#ff80ab', '#82b1ff', '#ccff90'];
let _trendChart = null;
let _trendDimension = 'volume';
let _trendPeriod = '7d';
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
    const rawLabels = data.labels || [];
    const series = data.series || [];

    // Format labels: hourly labels like "2026-03-15 02:00" → "Mar 15 02:00"
    const isHourly = _trendPeriod === '7d';
    const labels = rawLabels.map(l => {
      if (isHourly && l.includes(' ')) {
        const [date, time] = l.split(' ');
        const d = new Date(date + 'T' + time);
        if (!isNaN(d)) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + time;
      }
      return l;
    });

    // Destroy old chart
    if (_trendChart) { _trendChart.destroy(); _trendChart = null; }

    // Determine chart type
    const isStacked = _trendDimension === 'tlds' || _trendDimension === 'types';
    const isArea = _trendDimension === 'volume';
    const chartType = isStacked ? 'line' : isArea ? 'line' : 'line';

    // Build datasets
    let datasets;
    if (isArea || series.length === 0) {
      // Volume - total + severity overlay
      const values = data.values || (Array.isArray(data) ? data.map(d => d.total || d.count || 0) : []);
      datasets = [
        { label: 'Total Threats', data: values, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.10)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        ...(data.high_sev ? [{ label: 'High Severity', data: data.high_sev, borderColor: '#ff3b5c', backgroundColor: 'rgba(255,59,92,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }] : []),
        ...(data.active ? [{ label: 'Active', data: data.active, borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,0.06)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }] : []),
      ];
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

// ─── Agent Icon Helper (single source of truth) ─────────────
function agentIcon(agentId, size = 24) {
  const icons = {
    sentinel: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="currentColor" stroke-width="1.2" opacity="0.3"/><circle cx="18" cy="18" r="10" stroke="currentColor" stroke-width="1.2" opacity="0.5"/><circle cx="18" cy="18" r="4" stroke="currentColor" stroke-width="1.5"/><line x1="18" y1="18" x2="28" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="28" cy="6" r="2.5" fill="currentColor"/></svg>`,
    analyst: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none"><circle cx="6" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="26" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="18" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="30" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="30" cy="18" r="2.5" stroke="currentColor" stroke-width="1.5"/><line x1="8.5" y1="10" x2="15.5" y2="6" stroke="currentColor" stroke-width="1"/><line x1="8.5" y1="10" x2="15.5" y2="18" stroke="currentColor" stroke-width="1"/><line x1="8.5" y1="26" x2="15.5" y2="18" stroke="currentColor" stroke-width="1"/><line x1="8.5" y1="26" x2="15.5" y2="30" stroke="currentColor" stroke-width="1"/><line x1="20.5" y1="6" x2="27.5" y2="18" stroke="currentColor" stroke-width="1"/><line x1="20.5" y1="18" x2="27.5" y2="18" stroke="currentColor" stroke-width="1"/><line x1="20.5" y1="30" x2="27.5" y2="18" stroke="currentColor" stroke-width="1"/></svg>`,
    cartographer: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="14" stroke="currentColor" stroke-width="1.5"/><ellipse cx="18" cy="18" rx="7" ry="14" stroke="currentColor" stroke-width="1.2"/><line x1="4" y1="18" x2="32" y2="18" stroke="currentColor" stroke-width="1.2"/><path d="M6 11H30M6 25H30" stroke="currentColor" stroke-width="0.8" opacity="0.5"/></svg>`,
    strategist: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="4" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="10" r="3" stroke="currentColor" stroke-width="1.3"/><circle cx="28" cy="10" r="3" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="26" r="3" stroke="currentColor" stroke-width="1.3"/><circle cx="28" cy="26" r="3" stroke="currentColor" stroke-width="1.3"/><line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" stroke-width="1"/><line x1="25" y1="11" x2="21" y2="15" stroke="currentColor" stroke-width="1"/><line x1="11" y1="25" x2="15" y2="21" stroke="currentColor" stroke-width="1"/><line x1="25" y1="25" x2="21" y2="21" stroke="currentColor" stroke-width="1"/><line x1="11" y1="10" x2="25" y2="10" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.5"/><line x1="8" y1="13" x2="8" y2="23" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.5"/></svg>`,
    observer: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none"><polyline points="2,18 6,18 8,10 10,26 12,14 14,22 16,18 18,8 20,28 22,16 24,20 26,18 30,18 34,18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
    prospector: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none"><circle cx="16" cy="16" r="10" stroke="currentColor" stroke-width="1.5"/><line x1="23" y1="23" x2="32" y2="32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="4" stroke="currentColor" stroke-width="1" opacity="0.5"/><line x1="16" y1="6" x2="16" y2="10" stroke="currentColor" stroke-width="1" opacity="0.4"/><line x1="16" y1="22" x2="16" y2="26" stroke="currentColor" stroke-width="1" opacity="0.4"/></svg>`,
  };
  return icons[agentId] || icons.sentinel;
}

// ─── View: Agents (Step 13) ─────────────────────────────────
const AGENT_META = {
  sentinel: { iconClass: 'sentinel', color: '#22d3ee', role: 'Certificate & Domain Surveillance' },
  analyst: { iconClass: 'analyst', color: '#4ade80', role: 'Threat Classification & Brand Matching' },
  cartographer: { iconClass: 'cartographer', color: '#f59e0b', role: 'Infrastructure Mapping & Provider Scoring' },
  strategist: { iconClass: 'strategist', color: '#f87171', role: 'Campaign Correlation & Clustering' },
  observer: { iconClass: 'observer', color: '#a78bfa', role: 'Trend Analysis & Intelligence Synthesis' },
  prospector: { iconClass: 'prospector', color: '#F59E0B', role: 'Sales Intelligence & Lead Generation' },
};
let _selectedAgent = null;
let _agentHealthChart = null;

function relativeTime(val) {
  if (!val && val !== 0) return '-';
  // If it's a date string (contains '-' or ':'), convert to minutes
  if (typeof val === 'string' && (val.includes('-') || val.includes(':'))) {
    return timeAgo(val);
  }
  const minutes = val;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  if (isNaN(d.getTime())) return 'unknown';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

async function viewAgents(el) {
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">AI Agent Operations</div>
    <div class="agg-stats" id="agents-agg"></div>
    <div class="agent-grid" id="agent-grid"></div>
    <div class="agent-detail-panel" id="agent-detail"></div>
    <div id="agents-automation-strip" style="margin-top:24px"></div>`;

  try {
    const agentsRes = await api('/agents').catch(() => null);
    const agents = agentsRes?.data || [];

    // Agg stats
    const totalJobs = agents.reduce((s, a) => s + (a.jobs_24h || 0), 0);
    const totalOutputs = agents.reduce((s, a) => s + (a.outputs_24h || 0), 0);
    const totalErrors = agents.reduce((s, a) => s + (a.error_count_24h || 0), 0);
    // Agent is operational if: status === 'active' OR has outputs in last 24h OR last_run within 2h
    const now = Date.now();
    const isOperational = (a) => {
      if (a.status === 'active') return true;
      if ((a.outputs_24h || 0) > 0) return true;
      if (a.last_output_at) { const age = now - new Date(a.last_output_at).getTime(); if (age < 2 * 60 * 60 * 1000) return true; }
      if (a.last_run_at) { const age = now - new Date(a.last_run_at).getTime(); if (age < 2 * 60 * 60 * 1000) return true; }
      return false;
    };
    const activeCount = agents.filter(isOperational).length;

    document.getElementById('agents-agg').innerHTML = `
      <div class="agg-card"><div class="agg-val" style="color:var(--positive)">${activeCount}/${agents.length}</div><div class="agg-lbl">Agents operational</div><div class="agg-sub">${agents.filter(a => !isOperational(a)).length} idle</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--blue-primary)">${totalJobs}</div><div class="agg-lbl">Jobs (24h)</div><div class="agg-sub">Analysis runs completed</div></div>
      <div class="agg-card"><div class="agg-val" style="color:var(--text-accent)">${totalOutputs}</div><div class="agg-lbl">Outputs (24h)</div><div class="agg-sub">Insights + classifications</div></div>
      <div class="agg-card"><div class="agg-val" style="color:${totalErrors > 0 ? 'var(--negative)' : 'var(--positive)'}">${totalErrors}</div><div class="agg-lbl">Errors (24h)</div><div class="agg-sub">${totalErrors === 0 ? 'All systems nominal' : 'Attention needed'}</div></div>`;

    // Agent cards — render shells first, fill activity bars after
    const grid = document.getElementById('agent-grid');
    grid.innerHTML = agents.map(a => {
      const aid = a.agent_id || a.name;
      const meta = AGENT_META[a.name] || AGENT_META[aid] || { iconClass: 'sentinel', color: '#22d3ee', role: a.description || '' };
      const emptySegs = Array(12).fill(`<div class="activity-seg" style="background:${meta.color};opacity:0.05"></div>`).join('');
      return `<div class="agent-card" data-agent="${aid}">
        <div class="agent-status-dot ${a.status || 'idle'}"></div>
        <div class="agent-header">
          <div class="agent-icon ${meta.iconClass}" style="color:${meta.color}">${agentIcon(aid, 28)}</div>
          <div class="agent-name-block"><div class="agent-name">${a.display_name || a.name}</div><div class="agent-role">${meta.role}</div></div>
        </div>
        <div class="agent-stats-row">
          <div class="agent-stat"><div class="agent-stat-val">${a.jobs_24h || 0}</div><div class="agent-stat-label">Jobs</div></div>
          <div class="agent-stat"><div class="agent-stat-val">${a.outputs_24h || 0}</div><div class="agent-stat-label">Outputs</div></div>
          <div class="agent-stat"><div class="agent-stat-val" style="color:${(a.error_count_24h || 0) > 0 ? 'var(--negative)' : ''}">${a.error_count_24h || 0}</div><div class="agent-stat-label">Errors</div></div>
        </div>
        <div class="agent-last"><span>Last output</span><span>${relativeTime(a.last_output_at)}</span></div>
        <div class="activity-bar" id="activity-bar-${aid}">${emptySegs}</div>
      </div>`;
    }).join('');

    // Fill activity bars with time-based buckets (12 × 2h = 24h)
    // Uses count-based opacity so busy periods glow brighter
    const BUCKET_COUNT = 12;
    const BUCKET_MS = 2 * 60 * 60 * 1000; // 2 hours
    const nowMs = Date.now();
    const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;
    for (const a of agents) {
      const aid = a.agent_id || a.name;
      const meta = AGENT_META[a.name] || AGENT_META[aid] || { color: '#22d3ee' };
      try {
        const outRes = await api(`/agents/${aid}/outputs?limit=200`).catch(() => null);
        const outputs = (outRes?.data || []).filter(o => {
          if (!o.created_at) return false;
          const ts = new Date(o.created_at.endsWith('Z') ? o.created_at : o.created_at + 'Z').getTime();
          return ts >= dayAgoMs;
        });
        const buckets = new Array(BUCKET_COUNT).fill(0);
        for (const o of outputs) {
          const ts = new Date(o.created_at.endsWith('Z') ? o.created_at : o.created_at + 'Z').getTime();
          const idx = Math.floor((ts - dayAgoMs) / BUCKET_MS);
          if (idx >= 0 && idx < BUCKET_COUNT) buckets[idx]++;
        }
        const maxCount = Math.max(...buckets, 1);
        const barEl = document.getElementById(`activity-bar-${aid}`);
        if (barEl) {
          barEl.innerHTML = buckets.map(count => {
            const opacity = count > 0 ? 0.2 + 0.6 * (count / maxCount) : 0.05;
            return `<div class="activity-seg" style="background:${meta.color};opacity:${opacity}"></div>`;
          }).join('');
        }
      } catch { /* ok */ }
    }

    // Pipeline Automation strip
    try {
      const statsRes = await api('/admin/stats').catch(() => null);
      const emailStatsRes = await api('/email-security/stats').catch(() => null);
      const pStats = statsRes?.data || {};
      const geoRemaining = pStats.agent_backlogs?.cartographer ?? 0;
      const brandPending = pStats.agent_backlogs?.strategist ?? 0;
      const emailPending = emailStatsRes?.data?.total_unscanned ?? 0;
      const aiPending = pStats.ai_attribution_pending ?? 0;
      const trancoCount = pStats.tranco_brand_count ?? 0;
      const dotClass = (v) => typeof v === 'number' ? (v > 1000 ? 'pill-dot-red' : v > 100 ? 'pill-dot-amber' : 'pill-dot-green') : 'pill-dot-green';
      const stripEl = document.getElementById('agents-automation-strip');
      if (stripEl) {
        const pills = [
          { agent: 'sentinel', label: 'Geo Enrichment', value: `${geoRemaining} remaining \u00b7 auto`, count: geoRemaining },
          { agent: 'analyst', label: 'Brand Matching', value: `${brandPending} pending \u00b7 auto`, count: brandPending },
          { agent: 'cartographer', label: 'Email Security', value: `${emailPending} pending \u00b7 10/cycle`, count: emailPending },
          { agent: 'observer', label: 'AI Attribution', value: `${aiPending} remaining`, count: aiPending },
          { agent: 'strategist', label: 'Tranco', value: `${trancoCount.toLocaleString()} brands \u00b7 daily`, count: 0 },
        ];
        stripEl.innerHTML = `
          <div style="font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--text-secondary);margin-bottom:10px;letter-spacing:1px;text-transform:uppercase">Pipeline Automation</div>
          <div id="adm-automation-status">${pills.map(p => {
            const meta = AGENT_META[p.agent] || { color: '#22d3ee' };
            return `<div class="auto-pill" data-pipeline="${p.agent}">
              <span class="pill-icon" style="color:${meta.color};display:flex;align-items:center">${agentIcon(p.agent, 18)}</span>
              <span class="pill-label">${p.label}</span>
              <span class="pill-value">${p.value}</span>
              <span class="pill-dot ${dotClass(p.count)}"></span>
            </div>`;
          }).join('')}</div>`;
      }
    } catch { /* ok */ }

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
      const meta = AGENT_META[agentId] || AGENT_META[agent?.name] || { iconClass: 'sentinel', color: '#22d3ee', role: '' };

      // Fetch outputs and health
      const [outputsRes, healthRes] = await Promise.all([
        api(`/agents/${agentId}/outputs?limit=10`).catch(() => null),
        api(`/agents/${agentId}/health?period=24h`).catch(() => null),
      ]);
      const outputs = outputsRes?.data || [];
      const health = healthRes?.data || {};

      // Find latest attribution output for this agent
      const latestOutput = outputs[0];
      const latestSummary = latestOutput?.summary ? latestOutput.summary.replace(/\*\*/g, '').substring(0, 80) : null;

      // Check for weekly intel (Observer) or correlation count (Strategist)
      const weeklyIntel = outputs.find(o => o.type === 'weekly_intel');
      const correlations = outputs.filter(o => o.type === 'correlation').length;

      const detail = document.getElementById('agent-detail');
      detail.classList.add('visible');
      detail.innerHTML = `
        <div class="agent-detail-header">
          <div class="dh-icon agent-icon ${meta.iconClass}" style="color:${meta.color}">${agentIcon(agentId, 32)}</div>
          <div class="dh-info">
            <div class="dh-name">${agent?.display_name || agentId} <span class="status-label ${agent?.status || 'idle'}">${agent?.status || 'idle'}</span></div>
            <div class="dh-desc">${agent?.description || meta.role}</div>
            ${latestSummary ? `<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Last: ${latestSummary}${latestOutput?.created_at ? ' · ' + timeAgo(latestOutput.created_at) : ''}</div>` : ''}
            ${agentId === 'strategist' && correlations > 0 ? `<div style="font-size:10px;color:#F472B6;margin-top:2px">${correlations} correlation${correlations > 1 ? 's' : ''} detected</div>` : ''}
            ${agentId === 'observer' && weeklyIntel ? `<div style="font-size:10px;color:#FBBF24;margin-top:2px">Weekly intel report available</div>` : ''}
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
                <span class="output-time">${o.created_at ? timeAgo(o.created_at) : ''}</span>
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
// Quick rescan a single brand's email security from admin widgets
async function scanBrand(brandId) {
  try {
    showToast('Scanning...', 'info');
    await api(`/email-security/scan/${brandId}`, { method: 'POST' });
    showToast('Scan complete', 'success');
  } catch (err) {
    showToast('Scan failed: ' + (err.message || 'unknown error'), 'error');
  }
}

async function viewAdmin(el) {
  el.innerHTML = `
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">System Overview</div>
    <div class="adm-metrics" id="adm-metrics"></div>
    <div class="adm-actions">
      <div class="adm-action-btn" style="border-left:3px solid #00d4ff" onclick="navigate('/admin/users')"><div class="adm-action-icon">\u{1F464}</div><div class="adm-action-label">Invite User</div><div class="adm-action-desc">Send invitation email</div></div>
      <div class="adm-action-btn adm-dash-trigger" style="border-left:3px solid #00e5a0" id="adm-dash-feeds"><div class="adm-action-icon">\u{1F504}</div><div class="adm-action-label">Force Feed Pull</div><div class="adm-action-desc">Trigger all feeds now</div></div>
      <div class="adm-action-btn adm-dash-trigger" style="border-left:3px solid #b388ff" id="adm-dash-agents"><div class="adm-action-icon">\u{1F9E0}</div><div class="adm-action-label">Run AI Analysis</div><div class="adm-action-desc">Trigger all agents</div></div>
      <div class="adm-action-btn adm-dash-trigger" style="border-left:3px solid #00a8ff" id="adm-dash-backfill"><div class="adm-action-icon">\u{1F6E1}</div><div class="adm-action-label">Backfill Safe Domains</div><div class="adm-action-desc">Add safe domains for all brands</div></div>
      <div class="adm-action-btn adm-dash-trigger" style="border-left:3px solid #ffb627" id="adm-dash-tranco"><div class="adm-action-icon">\u{1F4E5}</div><div class="adm-action-label">Import Top Brands</div><div class="adm-action-desc">Import top 10K from Tranco</div></div>
      <div class="adm-action-btn adm-dash-trigger" style="border-left:3px solid #00e5a0" id="adm-dash-geo"><div class="adm-action-icon">\u{1F30D}</div><div class="adm-action-label">Backfill Geo</div><div class="adm-action-desc">Enrich IPs per click</div></div>
      <div class="adm-action-btn adm-dash-trigger" style="border-left:3px solid #ff6b6b" id="adm-dash-brand-match"><div class="adm-action-icon">\u{1F3AF}</div><div class="adm-action-label">Match Brands</div><div class="adm-action-desc">Match up to 5,000 unlinked threats</div></div>
      <div class="adm-action-btn adm-dash-trigger" style="border-left:3px solid #8b5cf6" id="adm-dash-ai-attr"><div class="adm-action-icon">\u{1F916}</div><div class="adm-action-label">AI Attribution</div><div class="adm-action-desc">Haiku-powered brand attribution</div></div>
      <div class="adm-action-btn" style="border-left:3px solid #667" onclick="navigate('/admin/audit')"><div class="adm-action-icon">\u{1F4CB}</div><div class="adm-action-label">View Audit Log</div><div class="adm-action-desc">Recent system events</div></div>
      <div class="adm-action-btn" style="border-left:3px solid #00d4ff" onclick="navigate('/public-preview')"><div class="adm-action-icon">\u{1F310}</div><div class="adm-action-label">View Public Site</div><div class="adm-action-desc">Preview marketing page</div></div>
    </div>
    <div class="adm-grid-2">
      <div class="adm-panel">
        <div class="adm-phead"><div class="adm-ptitle">\uD83D\uDCE7 Email Security Coverage</div><div class="adm-pbadge" id="adm-es-badge">-</div></div>
        <div class="adm-padded" id="adm-es-grades"></div>
        <div class="adm-padded" style="margin-top:8px">
          <button class="filter-pill" style="font-size:11px" id="adm-scan-all-email">Scan All Brands</button>
          <span id="adm-scan-all-status" style="font-size:11px;color:var(--text-tertiary);margin-left:8px"></span>
        </div>
      </div>
      <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">AI Agent Health</div><div class="adm-pbadge" id="adm-agent-badge">-</div></div><div class="adm-padded" id="adm-agent-summary"></div></div>
    </div>
    <div class="adm-grid-2">
      <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Lead Pipeline</div><div class="adm-pbadge" id="adm-pipe-badge">-</div></div><div class="adm-padded"><div class="adm-pipeline" id="adm-pipeline"></div><div id="adm-pipe-meta" style="font-size:11px;color:var(--text-tertiary);margin-top:8px"></div></div></div>
      <div class="adm-panel">
        <div class="adm-phead"><div class="adm-ptitle">Worst Email Security</div><div class="adm-pbadge" id="adm-es-worst-badge">-</div></div>
        <div style="padding:8px 12px;display:flex;gap:4px;border-bottom:1px solid var(--blue-border)" id="adm-es-grade-tabs"></div>
        <div id="adm-es-worst" style="max-height:240px;overflow-y:auto;scrollbar-width:thin"></div>
        <div style="padding:6px 12px;border-top:1px solid var(--blue-border);text-align:right" id="adm-es-worst-footer"></div>
      </div>
    </div>
    <div class="adm-grid-2">
      <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Feed Ingestion (24h)</div><div class="adm-pbadge" id="adm-feed-badge">Loading</div></div><div class="adm-chart-wrap"><canvas id="adm-feed-chart"></canvas></div><div class="adm-padded" id="adm-feed-list"></div></div>
      <div class="adm-panel"><div class="adm-phead"><div class="adm-ptitle">Recent System Events</div><div class="adm-pbadge" id="adm-events-badge">-</div></div><div style="display:flex;justify-content:flex-end;padding:4px 8px"><button id="adm-events-noise-toggle" style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--blue-border);background:transparent;color:var(--text-tertiary);cursor:pointer">Show all</button></div><div id="adm-events" style="max-height:400px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--bg-elevated) transparent"></div></div>
    </div>`;

  try {
    const [statsRes, feedsRes, eventsRes, leadsRes, agentsRes, emailStatsRes] = await Promise.all([
      api('/admin/stats').catch(() => null),
      api('/feeds').catch(() => null),
      api('/admin/audit?limit=15').catch(() => null),
      api('/admin/leads').catch(() => null),
      api('/agents').catch(() => null),
      api('/email-security/stats').catch(() => null),
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
    const healthyFeeds = feeds.filter(f => (f.health_status === 'healthy' || !f.health_status) && f.enabled).length;
    const degradedFeeds = feeds.filter(f => f.health_status === 'degraded').length;
    const downFeeds = feeds.filter(f => f.health_status === 'down').length;
    const totalFeeds = feeds.length;
    const totalRecords = feeds.reduce((s, f) => s + (f.records_today || f.records_ingested_today || 0), 0);
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
      <div class="adm-metric"><div class="adm-metric-label">Data Feeds</div><div class="adm-metric-value" style="color:var(--positive)">${healthyFeeds}/${totalFeeds}</div><div class="adm-metric-sub"><span style="color:var(--positive)">${healthyFeeds} healthy</span>${degradedFeeds?`<span style="color:var(--threat-medium)">${degradedFeeds} degraded</span>`:''}${downFeeds?`<span style="color:var(--negative)">${downFeeds} down</span>`:''}</div><div class="adm-metric-bar"><div class="adm-metric-bar-seg" style="background:var(--positive);width:${healthyFeeds/Math.max(totalFeeds,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--threat-medium);width:${degradedFeeds/Math.max(totalFeeds,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--negative);width:${downFeeds/Math.max(totalFeeds,1)*100}%"></div></div></div>
      <div class="adm-metric"><div class="adm-metric-label">Leads in Pipeline</div><div class="adm-metric-value" style="color:var(--threat-medium)">${leadTotal}</div><div class="adm-metric-sub"><span style="color:var(--negative)">${leadNew} new</span><span style="color:var(--positive)">${leadConverted} converted</span></div><div class="adm-metric-bar"><div class="adm-metric-bar-seg" style="background:var(--negative);width:${leadNew/Math.max(leadTotal,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--threat-high);width:${leadContacted/Math.max(leadTotal,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--threat-medium);width:${leadQualified/Math.max(leadTotal,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--positive);width:${leadProposal/Math.max(leadTotal,1)*100}%"></div></div></div>
      <div class="adm-metric"><div class="adm-metric-label">AI Analysis (24h)</div><div class="adm-metric-value" style="color:var(--text-primary)">${agentJobs}</div><div class="adm-metric-sub"><span style="color:var(--positive)">${agentJobs} completed</span><span style="color:${agentErrors>0?'var(--negative)':'var(--positive)'}">${agentErrors} failed</span></div><div class="adm-metric-bar"><div class="adm-metric-bar-seg" style="background:var(--positive);width:${agentJobs/Math.max(agentJobs+agentErrors,1)*100}%"></div><div class="adm-metric-bar-seg" style="background:var(--negative);width:${agentErrors/Math.max(agentJobs+agentErrors,1)*100}%"></div></div></div>`;

    // Feed ingestion chart
    const feedBadgeEl = document.getElementById('adm-feed-badge');
    if (feedBadgeEl) feedBadgeEl.textContent = feeds.every(f => f.health_status === 'healthy' || !f.health_status) ? 'All healthy' : 'Issues detected';
    if (feeds.length && typeof Chart !== 'undefined') {
      const feedLabels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
      const feedColors = ['#00d4ff', '#00e5a0', '#ffb627', '#b388ff', '#ff6b35', '#ff3b5c'];
      if (_adminFeedChart) { _adminFeedChart.destroy(); _adminFeedChart = null; }
      // Fetch real ingestion job data for chart
      const jobsRes = await api('/feeds/jobs?limit=500').catch(() => null);
      const jobs = jobsRes?.data || [];
      const feedDatasets = feeds.slice(0, 6).map((f, i) => {
        const hourBuckets = new Array(24).fill(0);
        jobs.filter(j => j.feed_name === f.feed_name && j.status === 'success').forEach(j => {
          const h = parseInt((j.started_at || '').substring(11, 13), 10);
          if (!isNaN(h)) hourBuckets[h] += (j.records_ingested || 0);
        });
        return { label: f.display_name || f.feed_name, data: hourBuckets,
          backgroundColor: feedColors[i % feedColors.length] + '30', borderColor: feedColors[i % feedColors.length], borderWidth: 1.5, fill: true, tension: 0.35, pointRadius: 0 };
      });
      const hasData = feedDatasets.some(ds => ds.data.some(v => v > 0));
      if (!hasData) {
        document.getElementById('adm-feed-chart').parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-tertiary);font-size:12px;font-family:var(--font-mono)">No ingestion data in last 24h \u2014 trigger a feed pull</div>';
      } else {
        _adminFeedChart = new Chart(document.getElementById('adm-feed-chart'), {
          type: 'line', data: { labels: feedLabels, datasets: feedDatasets },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(10,16,32,0.95)', borderColor: 'rgba(0,212,255,0.35)', borderWidth: 1, titleFont: { family: "'Chakra Petch'", size: 10 }, bodyFont: { family: "'IBM Plex Mono'", size: 10 }, titleColor: '#e8edf5', bodyColor: '#7a8ba8', padding: 8, cornerRadius: 6 } },
            scales: { x: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, stacked: true }, y: { ticks: { color: '#4a5a73', font: { family: "'IBM Plex Mono'", size: 8 } }, grid: { color: 'rgba(0,212,255,0.04)', drawBorder: false }, stacked: true, beginAtZero: true } } }
        });
      }
    }

    // Feed list
    document.getElementById('adm-feed-list').innerHTML = feeds.map(f => {
      const st = f.health_status || 'healthy';
      return `<div class="adm-feed-row"><div class="adm-feed-dot ${st}"></div><div class="adm-feed-name">${f.display_name || f.feed_name}</div><div class="adm-feed-last">${f.last_successful_pull ? relativeTime(Math.round((Date.now() - new Date(f.last_successful_pull).getTime()) / 60000)) : '-'}</div><div class="adm-feed-count">${(f.records_ingested_today || 0).toLocaleString()} today</div></div>`;
    }).join('');

    // Events — deduplicated + noise toggle
    const evBadge = document.getElementById('adm-events-badge');
    const evIcons = { login: { cls: 'auth', icon: '\u25c8' }, login_failed: { cls: 'feed-err', icon: '\u25c8' }, feed_run: { cls: 'feed', icon: '\u21bb' }, feed_error: { cls: 'feed-err', icon: '\u26a0' }, config_change: { cls: 'config', icon: '\u229e' }, role_change: { cls: 'user', icon: '+' }, invitation: { cls: 'user', icon: '+' }, lead_update: { cls: 'lead', icon: '\u25c9' } };
    const NOISE_ACTIONS = ['refresh_invalid', 'token_refresh', 'session_check'];
    let _evHideNoise = true;
    function deduplicateEvents(arr) {
      const groups = [];
      for (const e of arr) {
        const key = (e.action || '') + '|' + (e.outcome || '');
        const last = groups[groups.length - 1];
        if (last && last.key === key) { last.count++; last.lastTs = last.lastTs || e.timestamp; }
        else groups.push({ key, event: e, count: 1, firstTs: e.timestamp, lastTs: e.timestamp });
      }
      return groups;
    }
    function renderEvents() {
      let filtered = _evHideNoise ? events.filter(e => !NOISE_ACTIONS.includes(e.action)) : events;
      const groups = deduplicateEvents(filtered);
      if (evBadge) evBadge.textContent = `${groups.length} events`;
      const toggleBtn = document.getElementById('adm-events-noise-toggle');
      if (toggleBtn) toggleBtn.textContent = _evHideNoise ? 'Show all' : 'Hide noise';
      document.getElementById('adm-events').innerHTML = groups.map(g => {
        const e = g.event;
        const ev = evIcons[e.action] || evIcons.login;
        const countBadge = g.count > 1 ? `<span style="font-family:var(--font-mono);font-size:9px;background:rgba(0,212,255,.1);color:var(--blue-primary);padding:1px 5px;border-radius:3px;margin-left:4px">\u00d7${g.count}</span>` : '';
        return `<div class="adm-event-row"><div class="adm-ev-icon ${ev.cls}">${ev.icon}</div><div class="adm-ev-body"><div class="adm-ev-text">${e.summary || e.action || ''} <strong>${e.resource_type || ''}</strong>${countBadge}</div><div class="adm-ev-time">${e.timestamp ? relativeTime(Math.round((Date.now() - new Date(e.timestamp).getTime()) / 60000)) : ''}</div></div><span class="adm-ev-outcome ${e.outcome || 'success'}">${e.outcome || 'success'}</span></div>`;
      }).join('') || '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No recent events</div>';
    }
    renderEvents();
    document.getElementById('adm-events-noise-toggle')?.addEventListener('click', () => { _evHideNoise = !_evHideNoise; renderEvents(); });

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

    // Agent summary with backlog stats
    const agentBadge = document.getElementById('adm-agent-badge');
    const agentActive = agents.filter(a => a.status === 'active').length;
    if (agentBadge) agentBadge.textContent = `${agentActive}/${agents.length} operational`;
    const backlogs = stats.agent_backlogs || {};
    const backlogMap = {
      sentinel: { val: backlogs.sentinel ?? 0, label: 'new threats/hr' },
      analyst: { val: backlogs.analyst ?? 0, label: 'unclassified' },
      cartographer: { val: backlogs.cartographer ?? 0, label: 'pending geo' },
      strategist: { val: backlogs.strategist ?? 0, label: 'unlinked' },
      observer: { val: null, label: backlogs.observer_last_run ? (() => { const m = Math.round((Date.now() - new Date(backlogs.observer_last_run + 'Z').getTime()) / 60000); return m < 60 ? `Last briefing: ${m}m ago` : `Last briefing: ${Math.round(m/60)}h ago`; })() : 'No briefings yet' },
      prospector: { val: null, label: backlogs.prospector_leads ?? 'Weekly sales intelligence' },
    };
    document.getElementById('adm-agent-summary').innerHTML = agents.map(a => {
      const aid = a.agent_id || a.name;
      const meta = AGENT_META[a.name] || AGENT_META[aid] || { color: '#22d3ee' };
      const dotColor = a.status === 'active' ? 'var(--positive)' : a.status === 'error' ? 'var(--negative)' : a.status === 'degraded' ? 'var(--threat-medium)' : 'var(--blue-primary)';
      const dotAnim = a.status === 'active' ? 'animation:pulse 2s ease-in-out infinite' : a.status === 'degraded' ? 'animation:pulse 1.5s ease-in-out infinite' : '';
      const bl = backlogMap[a.name] || backlogMap[aid];
      const blText = bl ? (bl.val !== null ? `${bl.val} ${bl.label}` : bl.label) : '';
      const blColor = bl && bl.val !== null ? (bl.val > 100 ? 'var(--threat-medium)' : 'var(--positive)') : 'var(--text-tertiary)';
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(0,212,255,.04);flex-wrap:wrap"><div style="color:${meta.color};flex-shrink:0;width:18px;height:18px;display:flex;align-items:center">${agentIcon(aid, 18)}</div><div style="width:7px;height:7px;border-radius:50%;background:${dotColor};${dotAnim};flex-shrink:0"></div><div style="flex:1;font-size:12px;font-weight:500;color:${meta.color};min-width:90px">${a.display_name || a.name}</div><div style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary)">${a.jobs_24h || 0} jobs</div><div style="font-family:var(--font-mono);font-size:10px;color:${meta.color}">${a.outputs_24h || 0} out</div><div style="font-family:var(--font-mono);font-size:10px;color:${(a.error_count_24h||0)>0?'var(--negative)':'var(--positive)'}">${a.error_count_24h || 0} err</div>${blText ? `<div style="width:100%;padding-left:17px;font-family:var(--font-mono);font-size:9px;color:${blColor};margin-top:-2px">\u2514 ${blText}</div>` : ''}</div>`;
    }).join('') || '<div style="padding:12px;text-align:center;color:var(--text-tertiary)">No agents configured</div>';

    // Email Security stats
    const esData = emailStatsRes?.data;
    if (esData) {
      const esBadgeEl = document.getElementById('adm-es-badge');
      if (esBadgeEl) esBadgeEl.textContent = `${esData.total_scanned} scanned / ${esData.total_unscanned} pending`;

      const gradeColors = {'A+':'#00ff88','A':'#00dd66','B':'#ffcc00','C':'#ff8800','D':'#ff4444','F':'#ff0000'};
      const gradesEl = document.getElementById('adm-es-grades');
      if (gradesEl && esData.grade_distribution?.length) {
        const total = esData.grade_distribution.reduce((s, g) => s + g.count, 0) || 1;
        gradesEl.innerHTML = `
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px">Avg score: <span style="font-family:var(--font-mono);color:var(--text-primary)">${esData.average_score}/100</span></div>
          <div style="display:flex;gap:6px;margin-bottom:10px">
            ${esData.grade_distribution.map(g => {
              const pct = Math.round(g.count / total * 100);
              return `<div style="text-align:center;flex:1">
                <div style="font-family:var(--font-mono);font-weight:700;color:${gradeColors[g.grade]||'#666'};font-size:14px">${g.count}</div>
                <div style="height:4px;background:${gradeColors[g.grade]||'#666'};border-radius:2px;margin:3px 0;opacity:.7"></div>
                <div style="font-size:10px;color:var(--text-tertiary)">${g.grade}</div>
              </div>`;
            }).join('')}
          </div>`;
      } else if (gradesEl) {
        gradesEl.innerHTML = '<div style="font-size:11px;color:var(--text-tertiary)">No email security scans yet. Click "Scan All Brands" to start.</div>';
      }

      const worstEl = document.getElementById('adm-es-worst');
      const worstBrands = esData.worst_brands || [];
      const worstBadge = document.getElementById('adm-es-worst-badge');
      const tabsEl = document.getElementById('adm-es-grade-tabs');
      const footerEl = document.getElementById('adm-es-worst-footer');

      if (worstEl && worstBrands.length) {
        // Grade counts for tabs
        const gradeCounts = { F: 0, D: 0, C: 0 };
        worstBrands.forEach(b => { if (gradeCounts[b.email_security_grade] !== undefined) gradeCounts[b.email_security_grade]++; });
        if (worstBadge) worstBadge.textContent = `${worstBrands.length} brands`;

        let activeFilter = 'all';

        function renderWorstTabs() {
          if (!tabsEl) return;
          tabsEl.innerHTML = ['F','D','C','all'].map(g => {
            const count = g === 'all' ? worstBrands.length : (gradeCounts[g] || 0);
            const active = activeFilter === g;
            const gc = g === 'all' ? '#00d4ff' : (gradeColors[g] || '#666');
            return `<button data-esg="${g}" style="font-family:var(--font-mono);font-size:10px;padding:3px 8px;border-radius:3px;border:1px solid ${active ? gc : 'var(--blue-border)'};background:${active ? gc+'22' : 'transparent'};color:${active ? gc : 'var(--text-tertiary)'};cursor:pointer">${g === 'all' ? 'All' : g} <span style="font-size:9px;opacity:.7">${count}</span></button>`;
          }).join('');
          tabsEl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => { activeFilter = btn.dataset.esg; renderWorstTabs(); renderWorstList(); });
          });
        }

        function renderWorstList() {
          const filtered = activeFilter === 'all' ? worstBrands : worstBrands.filter(b => b.email_security_grade === activeFilter);
          worstEl.innerHTML = filtered.map(b => {
            const gc = gradeColors[b.email_security_grade] || '#666';
            const atRisk = b.email_security_grade === 'F' && (b.active_threats || 0) > 0;
            return `<div style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-bottom:1px solid rgba(0,212,255,.04)">
              <span style="font-family:var(--font-mono);font-size:10px;background:${gc};color:#000;padding:1px 5px;border-radius:3px;font-weight:700;flex-shrink:0">${b.email_security_grade}</span>
              <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${b.canonical_domain || ''}">${b.name}</span>
              ${atRisk ? '<span style="font-family:var(--font-mono);font-size:8px;background:rgba(255,59,92,.2);color:var(--negative);padding:1px 4px;border-radius:2px;font-weight:600;flex-shrink:0">AT RISK</span>' : ''}
              <span style="font-family:var(--font-mono);font-size:10px;color:${gc};flex-shrink:0">${b.email_security_score}</span>
              <button onclick="event.stopPropagation();scanBrand('${b.id}')" style="font-family:var(--font-mono);font-size:9px;padding:2px 6px;border-radius:3px;border:1px solid var(--blue-border);background:transparent;color:var(--text-secondary);cursor:pointer;flex-shrink:0">Scan</button>
            </div>`;
          }).join('') || '<div style="padding:12px;font-size:11px;color:var(--text-tertiary)">No brands for this grade</div>';
        }

        // CSV export
        if (footerEl) {
          footerEl.innerHTML = '<a href="#" id="adm-es-export-csv" style="font-size:10px;color:var(--blue-primary);text-decoration:none;font-family:var(--font-mono)">Export CSV</a>';
          document.getElementById('adm-es-export-csv')?.addEventListener('click', (e) => {
            e.preventDefault();
            const csv = 'Grade,Name,Domain,Score,Active Threats\n' + worstBrands.map(b =>
              `${b.email_security_grade},"${(b.name||'').replace(/"/g,'""')}","${b.canonical_domain||''}",${b.email_security_score},${b.active_threats||0}`
            ).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'worst_email_security.csv'; a.click();
            URL.revokeObjectURL(url);
          });
        }

        renderWorstTabs();
        renderWorstList();
      } else if (worstEl) {
        worstEl.innerHTML = '<div style="padding:12px;font-size:11px;color:var(--text-tertiary)">No scan data yet</div>';
        if (tabsEl) tabsEl.style.display = 'none';
        if (footerEl) footerEl.style.display = 'none';
      }
    }

  } catch (err) { showToast(err.message, 'error'); }

  // Scan all brands email security
  document.getElementById('adm-scan-all-email')?.addEventListener('click', async () => {
    const btn = document.getElementById('adm-scan-all-email');
    const status = document.getElementById('adm-scan-all-status');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Scanning...';
    if (status) status.textContent = 'Scanning up to 50 brands...';
    try {
      const res = await api('/email-security/scan-all');
      if (res?.success) {
        if (status) status.textContent = `Done: ${res.data.scanned} scanned, ${res.data.errors} errors`;
      } else {
        if (status) status.textContent = res?.error || 'Failed';
      }
    } catch (err) {
      if (status) status.textContent = err.message || 'Error';
    }
    btn.disabled = false;
    btn.textContent = 'Scan All Brands';
  });

  // Dashboard trigger buttons with spinner/checkmark feedback
  function setupDashTrigger(btnId, apiPath) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('dash-pending')) return;
      const icon = btn.querySelector('.adm-action-icon');
      const origIcon = icon?.textContent;
      btn.classList.add('dash-pending');
      if (icon) icon.innerHTML = '<span class="dash-spinner"></span>';
      try {
        await api(apiPath, { method: 'POST' });
        btn.classList.remove('dash-pending');
        btn.classList.add('dash-ok');
        if (icon) icon.textContent = '\u2713';
      } catch (err) {
        btn.classList.remove('dash-pending');
        btn.classList.add('dash-fail');
        if (icon) icon.textContent = '\u2717';
      }
      setTimeout(() => { btn.classList.remove('dash-ok', 'dash-fail'); if (icon) icon.textContent = origIcon; }, 3000);
    });
  }
  setupDashTrigger('adm-dash-feeds', '/feeds/trigger-all');
  setupDashTrigger('adm-dash-agents', '/agents/trigger-all');

  // Backfill button with result message
  const bfBtn = document.getElementById('adm-dash-backfill');
  if (bfBtn) {
    bfBtn.addEventListener('click', async () => {
      if (bfBtn.classList.contains('dash-pending')) return;
      const icon = bfBtn.querySelector('.adm-action-icon');
      const desc = bfBtn.querySelector('.adm-action-desc');
      const origIcon = icon?.textContent;
      const origDesc = desc?.textContent;
      bfBtn.classList.add('dash-pending');
      if (icon) icon.innerHTML = '<span class="dash-spinner"></span>';
      try {
        const res = await api('/admin/backfill-safe-domains', { method: 'POST' });
        bfBtn.classList.remove('dash-pending');
        bfBtn.classList.add('dash-ok');
        if (icon) icon.textContent = '\u2713';
        if (desc) desc.textContent = `Processed ${res.data?.brands_processed ?? 0} brands, added ${res.data?.domains_added ?? 0} domains`;
      } catch (err) {
        bfBtn.classList.remove('dash-pending');
        bfBtn.classList.add('dash-fail');
        if (icon) icon.textContent = '\u2717';
        if (desc) desc.textContent = 'Failed: ' + (err.message || 'unknown error');
      }
      setTimeout(() => { bfBtn.classList.remove('dash-ok', 'dash-fail'); if (icon) icon.textContent = origIcon; if (desc) desc.textContent = origDesc; }, 5000);
    });
  }

  // Import Tranco button with result message
  const trancoBtn = document.getElementById('adm-dash-tranco');
  if (trancoBtn) {
    trancoBtn.addEventListener('click', async () => {
      if (trancoBtn.classList.contains('dash-pending')) return;
      const icon = trancoBtn.querySelector('.adm-action-icon');
      const desc = trancoBtn.querySelector('.adm-action-desc');
      const origIcon = icon?.textContent;
      const origDesc = desc?.textContent;
      trancoBtn.classList.add('dash-pending');
      if (icon) icon.innerHTML = '<span class="dash-spinner"></span>';
      if (desc) desc.textContent = 'Downloading & importing...';
      try {
        const res = await api('/admin/import-tranco', { method: 'POST' });
        trancoBtn.classList.remove('dash-pending');
        trancoBtn.classList.add('dash-ok');
        if (icon) icon.textContent = '\u2713';
        if (desc) desc.textContent = res.data?.message || `Imported ${res.data?.imported ?? 0} brands`;
      } catch (err) {
        trancoBtn.classList.remove('dash-pending');
        trancoBtn.classList.add('dash-fail');
        if (icon) icon.textContent = '\u2717';
        if (desc) desc.textContent = 'Failed: ' + (err.message || 'unknown error');
      }
      setTimeout(() => { trancoBtn.classList.remove('dash-ok', 'dash-fail'); if (icon) icon.textContent = origIcon; if (desc) desc.textContent = origDesc; }, 8000);
    });
  }

  // Backfill Geo button with result message
  const geoBtn = document.getElementById('adm-dash-geo');
  if (geoBtn) {
    geoBtn.addEventListener('click', async () => {
      if (geoBtn.classList.contains('dash-pending')) return;
      const icon = geoBtn.querySelector('.adm-action-icon');
      const desc = geoBtn.querySelector('.adm-action-desc');
      const origIcon = icon?.textContent;
      const origDesc = desc?.textContent;
      geoBtn.classList.add('dash-pending');
      if (icon) icon.innerHTML = '<span class="dash-spinner"></span>';
      try {
        const res = await api('/admin/backfill-geo', { method: 'POST' });
        geoBtn.classList.remove('dash-pending');
        geoBtn.classList.add('dash-ok');
        if (icon) icon.textContent = '\u2713';
        if (desc) desc.textContent = `${res.data?.enriched ?? 0} enriched \u00b7 ${res.data?.skippedPrivate ?? 0} private \u00b7 ${res.data?.remaining ?? 0} remaining`;
      } catch (err) {
        geoBtn.classList.remove('dash-pending');
        geoBtn.classList.add('dash-fail');
        if (icon) icon.textContent = '\u2717';
        if (desc) desc.textContent = 'Failed: ' + (err.message || 'unknown error');
      }
      setTimeout(() => { geoBtn.classList.remove('dash-ok', 'dash-fail'); if (icon) icon.textContent = origIcon; if (desc) desc.textContent = origDesc; }, 5000);
    });
  }

  // Match Brands button with result message
  const brandBtn = document.getElementById('adm-dash-brand-match');
  if (brandBtn) {
    brandBtn.addEventListener('click', async () => {
      if (brandBtn.classList.contains('dash-pending')) return;
      const icon = brandBtn.querySelector('.adm-action-icon');
      const desc = brandBtn.querySelector('.adm-action-desc');
      const origIcon = icon?.textContent;
      const origDesc = desc?.textContent;
      brandBtn.classList.add('dash-pending');
      if (icon) icon.innerHTML = '<span class="dash-spinner"></span>';
      try {
        const res = await api('/admin/backfill-brand-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rounds: 10 }) });
        brandBtn.classList.remove('dash-pending');
        brandBtn.classList.add('dash-ok');
        if (icon) icon.textContent = '\u2713';
        if (desc) desc.textContent = `${res.data?.matched ?? 0} matched \u00b7 ${res.data?.pending ?? 0} pending`;
      } catch (err) {
        brandBtn.classList.remove('dash-pending');
        brandBtn.classList.add('dash-fail');
        if (icon) icon.textContent = '\u2717';
        if (desc) desc.textContent = 'Failed: ' + (err.message || 'unknown error');
      }
      setTimeout(() => { brandBtn.classList.remove('dash-ok', 'dash-fail'); if (icon) icon.textContent = origIcon; if (desc) desc.textContent = origDesc; }, 5000);
    });
  }

  // AI Attribution button
  const aiAttrBtn = document.getElementById('adm-dash-ai-attr');
  if (aiAttrBtn) {
    aiAttrBtn.addEventListener('click', async () => {
      if (aiAttrBtn.classList.contains('dash-pending')) return;
      const icon = aiAttrBtn.querySelector('.adm-action-icon');
      const desc = aiAttrBtn.querySelector('.adm-action-desc');
      const origIcon = icon?.textContent;
      const origDesc = desc?.textContent;
      aiAttrBtn.classList.add('dash-pending');
      if (icon) icon.innerHTML = '<span class="dash-spinner"></span>';
      if (desc) desc.textContent = 'Running Haiku attribution...';
      try {
        const res = await api('/admin/backfill-ai-attribution', { method: 'POST' });
        aiAttrBtn.classList.remove('dash-pending');
        aiAttrBtn.classList.add('dash-ok');
        if (icon) icon.textContent = '\u2713';
        if (desc) desc.textContent = `${res.data?.attributed ?? 0} attributed \u00b7 ${res.data?.calls ?? 0} calls \u00b7 ~$${(res.data?.costUsd ?? 0).toFixed(4)}`;
      } catch (err) {
        aiAttrBtn.classList.remove('dash-pending');
        aiAttrBtn.classList.add('dash-fail');
        if (icon) icon.textContent = '\u2717';
        if (desc) desc.textContent = 'Failed: ' + (err.message || 'unknown error');
      }
      setTimeout(() => { aiAttrBtn.classList.remove('dash-ok', 'dash-fail'); if (icon) icon.textContent = origIcon; if (desc) desc.textContent = origDesc; }, 5000);
    });
  }

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
    return `<div class="adm-table-scroll"><table class="adm-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Last Active</th><th>Actions</th></tr></thead><tbody>${users.map(u => {
      const roleColors = { super_admin: 'var(--threat-medium)', admin: 'var(--purple)', analyst: 'var(--blue-primary)' };
      const c = roleColors[u.role] || 'var(--blue-primary)';
      return `<tr data-uid="${u.id}"><td><div class="adm-user-cell"><div class="adm-avatar" style="color:${c}">${ini(u.name)}</div><div><div class="adm-user-name">${u.name}</div><div class="adm-user-email">${u.email}</div></div></div></td><td><span class="adm-role-pill ${u.role}">${(u.role || '').replace('_', ' ')}</span></td><td><span class="adm-status-pill ${u.status || 'active'}">${u.status || 'active'}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${u.last_login ? relativeTime(Math.round((Date.now() - new Date(u.last_login).getTime()) / 60000)) : '-'}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${u.last_active_at ? relativeTime(Math.round((Date.now() - new Date(u.last_active_at).getTime()) / 60000)) : '-'}</td><td><button class="adm-action-btn" onclick="event.stopPropagation()">Details</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
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
      <div class="adm-detail-header"><div class="adm-dh-left"><div class="adm-dh-dot" style="background:${st==='healthy'?'var(--positive)':st==='degraded'?'var(--threat-medium)':'var(--negative)'}"></div><div><div class="adm-dh-name">${f.display_name || f.feed_name}</div><div class="adm-dh-meta">${f.source_url || f.feed_name} \u2014 ${f.schedule_cron || '-'}</div></div></div><div class="adm-dh-right"><button class="adm-action-btn adm-trigger-btn" data-feed="${fid}" style="font-size:11px;padding:8px 16px">Trigger Now</button><button class="adm-toggle-btn ${f.enabled !== false ? 'enabled' : 'disabled'}">${f.enabled !== false ? 'Enabled' : 'Disabled'}</button></div></div>
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

    // Feed detail trigger button — visual feedback
    const detailTrigger = document.querySelector('#adm-feed-detail-content .adm-trigger-btn[data-feed]');
    if (detailTrigger) {
      detailTrigger.addEventListener('click', async () => {
        detailTrigger.classList.remove('trigger-ok', 'trigger-fail');
        detailTrigger.classList.add('trigger-pending');
        try {
          await api(`/feeds/${detailTrigger.dataset.feed}/trigger`, { method: 'POST' });
          detailTrigger.classList.remove('trigger-pending');
          detailTrigger.classList.add('trigger-ok');
        } catch (err) {
          detailTrigger.classList.remove('trigger-pending');
          detailTrigger.classList.add('trigger-fail');
        }
        setTimeout(() => { detailTrigger.classList.remove('trigger-ok', 'trigger-fail'); }, 3000);
      });
    }
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

    document.getElementById('adm-feeds-table').innerHTML = allFeeds.length ? `<div class="adm-table-scroll"><table class="adm-table"><thead><tr><th>Feed</th><th>Status</th><th>Last Pull</th><th>Last Failure</th><th>Records Today</th><th>Avg Duration</th><th>Schedule</th><th>Actions</th></tr></thead><tbody>${allFeeds.map(f => {
      const st = f.health_status || 'healthy';
      return `<tr data-fid="${f.feed_name || f.feed_id || f.id}"><td><div class="adm-feed-name-cell"><div class="adm-feed-dot ${st}"></div>${f.display_name || f.feed_name}</div></td><td><span style="font-family:var(--font-mono);font-size:10px;color:${st==='healthy'?'var(--positive)':st==='degraded'?'var(--threat-medium)':'var(--negative)'};text-transform:capitalize">${st}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${f.last_successful_pull ? relativeTime(Math.round((Date.now() - new Date(f.last_successful_pull).getTime()) / 60000)) : '-'}</td><td style="font-family:var(--font-mono);font-size:10px;color:${f.last_failure ? 'var(--negative)' : 'var(--text-tertiary)'}">${f.last_failure ? relativeTime(Math.round((Date.now() - new Date(f.last_failure).getTime()) / 60000)) : '\u2014'}</td><td style="font-family:var(--font-mono);font-size:12px;font-weight:500">${(f.records_ingested_today || 0).toLocaleString()}${f.last_pull_count != null ? ` <span style="color:${f.last_pull_count > 0 ? '#00d4ff' : 'var(--text-tertiary)'};font-size:10px">(+${f.last_pull_count.toLocaleString()})</span>` : ''}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary)">${f.avg_duration_ms ? (f.avg_duration_ms >= 1000 ? (f.avg_duration_ms / 1000).toFixed(1) + 's' : Math.round(f.avg_duration_ms) + 'ms') : '-'}</td><td><span class="adm-schedule-pill">${f.schedule_cron || '-'}</span></td><td><button class="adm-action-btn adm-trigger-btn" data-feed="${f.feed_name || f.feed_id || f.id}" onclick="event.stopPropagation()">Trigger Now</button><button class="adm-action-btn" onclick="event.stopPropagation()">Configure</button></td></tr>`;
    }).join('')}</tbody></table></div>` : '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No feeds configured</div>';

    // Row click to detail
    document.querySelectorAll('#adm-feeds-table tr[data-fid]').forEach(tr => {
      tr.addEventListener('click', () => showFeedDetail(tr.dataset.fid));
    });

    // Feed trigger buttons — visual feedback + auto-refresh row
    el.querySelectorAll('.adm-trigger-btn[data-feed]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const feedId = btn.dataset.feed;
        btn.classList.remove('trigger-ok', 'trigger-fail');
        btn.classList.add('trigger-pending');
        try {
          await api(`/feeds/${feedId}/trigger`, { method: 'POST' });
          btn.classList.remove('trigger-pending');
          btn.classList.add('trigger-ok');
          // Auto-refresh: wait 2s then re-fetch feed stats and update the row
          setTimeout(async () => {
            try {
              const res = await api('/feeds');
              const updated = (res?.data || []).find(f => (f.feed_name || f.feed_id || f.id) === feedId);
              if (updated) {
                const row = btn.closest('tr');
                if (row) {
                  const cells = row.querySelectorAll('td');
                  // cells[1]=Status, cells[2]=Last Pull, cells[4]=Records Today
                  const ust = updated.health_status || 'healthy';
                  if (cells[1]) cells[1].innerHTML = `<span style="font-family:var(--font-mono);font-size:10px;color:${ust==='healthy'?'var(--positive)':ust==='degraded'?'var(--threat-medium)':'var(--negative)'};text-transform:capitalize">${ust}</span>`;
                  if (cells[2]) { cells[2].textContent = updated.last_successful_pull ? relativeTime(Math.round((Date.now() - new Date(updated.last_successful_pull).getTime()) / 60000)) : '-'; cells[2].style.color = 'var(--positive)'; setTimeout(() => { cells[2].style.color = 'var(--text-tertiary)'; }, 3000); }
                  if (cells[4]) cells[4].textContent = (updated.records_ingested_today || 0).toLocaleString();
                }
              }
            } catch (_) { /* silent */ }
          }, 2000);
        } catch (err) {
          btn.classList.remove('trigger-pending');
          btn.classList.add('trigger-fail');
        }
        setTimeout(() => { btn.classList.remove('trigger-ok', 'trigger-fail'); }, 3000);
      });
    });
  } catch (err) { showToast(err.message, 'error'); }

  document.getElementById('adm-feed-back')?.addEventListener('click', () => {
    document.getElementById('adm-feed-detail-view')?.classList.remove('visible');
    document.getElementById('adm-feed-list-view')?.classList.add('visible');
  });

  window._viewCleanup = () => { if (_feedDetailChart) { _feedDetailChart.destroy(); _feedDetailChart = null; } };
}

// ─── View: Admin Leads (Step 17) ────────────────────────────
const SALES_STAGES = [
  { key: 'new', label: 'New', color: 'var(--negative)' },
  { key: 'researched', label: 'Researched', color: 'var(--threat-high)' },
  { key: 'outreach_drafted', label: 'Drafted', color: 'var(--threat-medium)' },
  { key: 'approved', label: 'Approved', color: 'var(--blue-primary)' },
  { key: 'sent', label: 'Sent', color: 'var(--purple)' },
  { key: 'responded', label: 'Replied', color: '#22d3ee' },
  { key: 'meeting_booked', label: 'Meeting', color: '#34d399' },
  { key: 'converted', label: 'Converted', color: 'var(--positive)' },
  { key: 'declined', label: 'Declined', color: 'var(--text-tertiary)' },
];
const PITCH_LABELS = { urgent_exposure: 'Urgent Exposure', active_attack: 'Active Attack', email_security: 'Email Security', ai_threat: 'AI Threat', campaign_targeting: 'Campaign Targeting', brand_protection: 'Brand Protection' };
const PITCH_COLORS = { urgent_exposure: 'var(--negative)', active_attack: 'var(--threat-high)', email_security: 'var(--threat-medium)', ai_threat: 'var(--purple)', campaign_targeting: '#22d3ee', brand_protection: 'var(--blue-primary)' };
function prospectScoreColor(s) { return s >= 90 ? 'var(--positive)' : s >= 70 ? 'var(--blue-primary)' : s >= 50 ? 'var(--threat-medium)' : 'var(--negative)'; }

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
        <div class="adm-view-toggle" id="adm-lead-tabs">
          <button class="adm-vt-btn active" data-ltab="scan">Scan Leads</button>
          <button class="adm-vt-btn" data-ltab="pipeline">Sales Pipeline</button>
        </div>
      </div>
    </div>
    <div id="adm-scan-view" class="visible">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <input class="adm-search" placeholder="Search leads..." id="adm-lead-search">
        <div class="adm-view-toggle"><button class="adm-vt-btn active" data-view="kanban">Kanban</button><button class="adm-vt-btn" data-view="table">Table</button></div>
      </div>
      <div id="adm-kanban-view" class="visible"></div>
      <div id="adm-table-view"></div>
    </div>
    <div id="adm-pipeline-view"></div>
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
    el.innerHTML = `<div class="adm-panel"><div class="adm-table-scroll"><table class="adm-table"><thead><tr><th>Company</th><th>Contact</th><th>Domain</th><th>Score</th><th>Grade</th><th>Status</th><th>Assigned</th><th>Created</th></tr></thead><tbody>${sorted.map(l => {
      const sc = leadScoreColor(l.trust_score || l.score || 0);
      const gc = leadGradeColor(l.trust_grade || l.grade || 'F');
      return `<tr data-lid="${l.id}"><td style="font-weight:500">${l.company || l.domain || '-'}</td><td style="font-size:11px;color:var(--text-secondary)">${l.contact_name || ''}<br><span style="font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary)">${l.email || ''}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${l.domain || ''}</td><td><span style="font-family:var(--font-display);font-weight:700;color:${sc}">${l.trust_score || l.score || 0}</span></td><td><span class="adm-grade-badge" style="background:${gc}20;color:${gc}">${l.trust_grade || l.grade || '?'}</span></td><td><span class="adm-status-pill ${l.status}">${(l.status || '').replace('_', ' ')}</span></td><td style="font-size:11px;color:var(--text-secondary)">${l.assigned_to || 'Unassigned'}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${l.created_at ? relativeTime(Math.round((Date.now() - new Date(l.created_at).getTime()) / 60000)) : '-'}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
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

  // Kanban/Table view toggle (within scan view)
  document.getElementById('adm-scan-view')?.querySelectorAll('.adm-vt-btn').forEach(b => b.addEventListener('click', () => {
    document.getElementById('adm-scan-view')?.querySelectorAll('.adm-vt-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('adm-kanban-view')?.classList.toggle('visible', b.dataset.view === 'kanban');
    document.getElementById('adm-table-view')?.classList.toggle('visible', b.dataset.view === 'table');
  }));

  // ── Sales Pipeline view ────────────────────────────────────
  let salesLeads = [];
  let salesStats = {};

  function renderSalesPipeline() {
    const pv = document.getElementById('adm-pipeline-view');
    if (!pv) return;
    const ps = salesStats.pipeline || {};
    const stageData = SALES_STAGES.map(s => ({ ...s, count: ps[s.key + '_count'] ?? 0 }));
    const rr = salesStats.response_rate ?? 0;
    const cr = salesStats.conversion_rate ?? 0;

    pv.innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
        ${stageData.map(s => `<div style="flex:1;min-width:80px;text-align:center;padding:8px 6px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--blue-border)"><div style="font-family:var(--font-mono);font-weight:700;font-size:18px;color:${s.color}">${s.count}</div><div style="font-size:9px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px">${s.label}</div></div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <div style="flex:1;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--blue-border);font-size:11px;color:var(--text-secondary)">Response rate: <span style="font-family:var(--font-mono);font-weight:600;color:var(--blue-primary)">${rr}%</span></div>
        <div style="flex:1;padding:8px 12px;background:var(--bg-elevated);border-radius:6px;border:1px solid var(--blue-border);font-size:11px;color:var(--text-secondary)">Conversion rate: <span style="font-family:var(--font-mono);font-weight:600;color:var(--positive)">${cr}%</span></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select class="adm-sel" id="sp-status-filter" style="min-width:120px"><option value="">All Statuses</option>${SALES_STAGES.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}</select>
        <select class="adm-sel" id="sp-pitch-filter" style="min-width:120px"><option value="">All Pitch Angles</option>${Object.entries(PITCH_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <input class="adm-search" placeholder="Search company..." id="sp-search" style="flex:1;min-width:150px">
      </div>
      <div class="adm-panel"><div class="adm-table-scroll"><table class="adm-table" id="sp-table"><thead><tr><th>Company</th><th>Domain</th><th>Score</th><th>Pitch Angle</th><th>Target</th><th>Email Grade</th><th>Threats</th><th>Status</th><th>Created</th></tr></thead><tbody id="sp-tbody"></tbody></table></div></div>`;

    renderSalesTable();

    document.getElementById('sp-status-filter')?.addEventListener('change', renderSalesTable);
    document.getElementById('sp-pitch-filter')?.addEventListener('change', renderSalesTable);
    document.getElementById('sp-search')?.addEventListener('input', renderSalesTable);
  }

  function renderSalesTable() {
    const statusF = document.getElementById('sp-status-filter')?.value || '';
    const pitchF = document.getElementById('sp-pitch-filter')?.value || '';
    const searchF = (document.getElementById('sp-search')?.value || '').toLowerCase();
    const filtered = salesLeads.filter(l => {
      if (statusF && l.status !== statusF) return false;
      if (pitchF && l.pitch_angle !== pitchF) return false;
      if (searchF && !(l.company_name || '').toLowerCase().includes(searchF) && !(l.company_domain || '').toLowerCase().includes(searchF)) return false;
      return true;
    });
    const tbody = document.getElementById('sp-tbody');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(l => {
      const sc = prospectScoreColor(l.prospect_score || 0);
      const stage = SALES_STAGES.find(s => s.key === l.status) || { label: l.status, color: 'var(--text-tertiary)' };
      const pc = PITCH_COLORS[l.pitch_angle] || 'var(--text-tertiary)';
      const pl = PITCH_LABELS[l.pitch_angle] || l.pitch_angle || '-';
      return `<tr data-slid="${l.id}" style="cursor:pointer"><td style="font-weight:500">${l.company_name || '-'}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${l.company_domain || ''}</td><td><span style="font-family:var(--font-display);font-weight:700;color:${sc}">${l.prospect_score || 0}</span></td><td><span style="font-size:10px;padding:2px 8px;border-radius:3px;background:${pc}18;color:${pc};border:1px solid ${pc}40">${pl}</span></td><td style="font-size:11px">${l.target_name ? `${l.target_name}<br><span style="font-size:9px;color:var(--text-tertiary)">${l.target_title || ''}</span>` : '<span style="color:var(--text-tertiary)">-</span>'}</td><td><span style="font-family:var(--font-mono);font-weight:600;color:${leadGradeColor(l.email_security_grade || 'F')}">${l.email_security_grade || '-'}</span></td><td style="font-family:var(--font-mono);font-size:11px">${l.threat_count_30d ?? 0}</td><td><span style="font-size:10px;padding:2px 8px;border-radius:3px;background:${stage.color}18;color:${stage.color};border:1px solid ${stage.color}40">${stage.label}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${l.created_at ? relativeTime(l.created_at) : '-'}</td></tr>`;
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text-tertiary);padding:24px">No sales leads yet. The Prospector agent runs weekly.</td></tr>';
    tbody.querySelectorAll('tr[data-slid]').forEach(r => r.addEventListener('click', () => openSalesLeadDetail(r.dataset.slid)));
  }

  async function openSalesLeadDetail(id) {
    try {
      const [leadRes, actRes] = await Promise.all([
        api(`/admin/sales-leads/${id}`).catch(() => null),
        api(`/admin/sales-leads/${id}/activity`).catch(() => null),
      ]);
      const l = leadRes?.data;
      if (!l) return;
      const activities = actRes?.data || [];
      const sc = prospectScoreColor(l.prospect_score || 0);
      const stage = SALES_STAGES.find(s => s.key === l.status) || { label: l.status, color: 'var(--text-tertiary)' };
      const breakdown = (() => { try { return JSON.parse(l.score_breakdown_json || '{}'); } catch { return {}; } })();
      const research = (() => { try { return JSON.parse(l.research_json || '{}'); } catch { return {}; } })();
      const v1 = (() => { try { return JSON.parse(l.outreach_variant_1 || '{}'); } catch { return {}; } })();
      const v2 = (() => { try { return JSON.parse(l.outreach_variant_2 || '{}'); } catch { return {}; } })();

      document.getElementById('adm-lead-so-content').innerHTML = `
        <div style="text-align:center;margin-bottom:16px">
          <div class="adm-so-score-ring"><svg width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-elevated)" stroke-width="5"/><circle cx="40" cy="40" r="34" fill="none" stroke="${sc}" stroke-width="5" stroke-dasharray="213.6" stroke-dashoffset="${213.6 * (1 - (l.prospect_score || 0) / 170)}" stroke-linecap="round" transform="rotate(-90 40 40)"/></svg><div class="adm-so-score-val" style="color:${sc}">${l.prospect_score || 0}</div></div>
          <div style="font-size:11px;color:${stage.color};font-weight:600;margin-top:4px">${stage.label}</div>
        </div>

        <div class="adm-so-section"><div class="adm-so-sect-title">Company</div>
          <div class="adm-so-row"><span class="adm-so-row-l">Name</span><span class="adm-so-row-v" style="font-weight:500">${l.company_name || '-'}</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">Domain</span><span class="adm-so-row-v" style="font-family:var(--font-mono);font-size:11px">${l.company_domain || '-'}</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">Industry</span><span class="adm-so-row-v">${l.company_industry || '-'}</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">Size</span><span class="adm-so-row-v">${l.company_size || '-'}</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">HQ</span><span class="adm-so-row-v">${l.company_hq || '-'}</span></div>
        </div>

        <div class="adm-so-section"><div class="adm-so-sect-title">Security Leader</div>
          <div class="adm-so-row"><span class="adm-so-row-l">Name</span><span class="adm-so-row-v" style="font-weight:500">${l.target_name || 'Not found'}</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">Title</span><span class="adm-so-row-v">${l.target_title || '-'}</span></div>
          ${l.target_linkedin ? `<div class="adm-so-row"><span class="adm-so-row-l">LinkedIn</span><span class="adm-so-row-v"><a href="${l.target_linkedin}" target="_blank" style="font-size:11px">Profile</a></span></div>` : ''}
          ${l.target_email ? `<div class="adm-so-row"><span class="adm-so-row-l">Email</span><span class="adm-so-row-v" style="font-family:var(--font-mono);font-size:11px;color:var(--blue-primary)">${l.target_email}</span></div>` : ''}
        </div>

        <div class="adm-so-section"><div class="adm-so-sect-title">Platform Findings</div>
          <div class="adm-so-row"><span class="adm-so-row-l">Email Grade</span><span class="adm-so-row-v" style="font-family:var(--font-mono);font-weight:700;color:${leadGradeColor(l.email_security_grade || 'F')}">${l.email_security_grade || '-'}</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">Threats (30d)</span><span class="adm-so-row-v" style="font-family:var(--font-mono)">${l.threat_count_30d ?? 0}</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">Phishing URLs</span><span class="adm-so-row-v" style="font-family:var(--font-mono);color:${(l.phishing_urls_active||0)>0?'var(--negative)':'var(--text-secondary)'}">${l.phishing_urls_active ?? 0}</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">Trap Catches</span><span class="adm-so-row-v" style="font-family:var(--font-mono)">${l.trap_catches_30d ?? 0}</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">Risk Score</span><span class="adm-so-row-v" style="font-family:var(--font-mono)">${l.composite_risk_score ?? '-'}/100</span></div>
          <div class="adm-so-row"><span class="adm-so-row-l">Pitch Angle</span><span class="adm-so-row-v" style="color:${PITCH_COLORS[l.pitch_angle]||'var(--text-secondary)'}">${PITCH_LABELS[l.pitch_angle] || l.pitch_angle || '-'}</span></div>
          ${l.findings_summary ? `<div style="margin-top:8px;font-size:11px;color:var(--text-secondary);padding:8px;background:var(--bg-void);border-radius:4px;border:1px solid var(--blue-border)">${l.findings_summary}</div>` : ''}
        </div>

        ${Object.keys(breakdown).length ? `<div class="adm-so-section"><div class="adm-so-sect-title">Score Breakdown</div>${Object.entries(breakdown).map(([k,v]) => `<div class="adm-so-row"><span class="adm-so-row-l" style="font-size:10px">${k.replace(/_/g,' ')}</span><span class="adm-so-row-v" style="font-family:var(--font-mono);color:var(--blue-primary)">+${v}</span></div>`).join('')}</div>` : ''}

        ${v1.subject ? `<div class="adm-so-section"><div class="adm-so-sect-title">Outreach Variant 1 — Intelligence Briefing</div>
          <div style="font-size:11px;color:var(--blue-primary);margin-bottom:4px">Subject: ${v1.subject}</div>
          <div style="font-size:11px;color:var(--text-secondary);padding:8px;background:var(--bg-void);border-radius:4px;border:1px solid var(--blue-border);white-space:pre-wrap">${v1.body}</div>
        </div>` : ''}
        ${v2.subject ? `<div class="adm-so-section"><div class="adm-so-sect-title">Outreach Variant 2 — Peer Benchmark</div>
          <div style="font-size:11px;color:var(--blue-primary);margin-bottom:4px">Subject: ${v2.subject}</div>
          <div style="font-size:11px;color:var(--text-secondary);padding:8px;background:var(--bg-void);border-radius:4px;border:1px solid var(--blue-border);white-space:pre-wrap">${v2.body}</div>
        </div>` : ''}

        <div class="adm-so-section"><div class="adm-so-sect-title">Actions</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px" id="sp-actions">
            ${l.status === 'outreach_drafted' ? '<button class="adm-btn-sm" data-spa="approve" style="background:rgba(0,212,255,.1);color:var(--blue-primary);border-color:var(--blue-primary)">Approve</button>' : ''}
            ${l.status === 'approved' ? '<button class="adm-btn-sm" data-spa="send" style="background:rgba(139,92,246,.1);color:var(--purple);border-color:var(--purple)">Mark Sent</button>' : ''}
            ${l.status === 'sent' ? '<button class="adm-btn-sm" data-spa="respond" style="background:rgba(34,211,238,.1);color:#22d3ee;border-color:#22d3ee">Log Response</button>' : ''}
            ${l.status === 'responded' ? '<button class="adm-btn-sm" data-spa="book" style="background:rgba(52,211,153,.1);color:#34d399;border-color:#34d399">Book Meeting</button>' : ''}
            ${['responded','meeting_booked'].includes(l.status) ? '<button class="adm-btn-sm" data-spa="convert" style="background:rgba(0,229,160,.1);color:var(--positive);border-color:var(--positive)">Convert</button>' : ''}
            ${!['converted','declined'].includes(l.status) ? '<button class="adm-btn-sm" data-spa="decline" style="background:rgba(255,59,92,.05);color:var(--negative);border-color:var(--negative)">Decline</button>' : ''}
            <button class="adm-btn-sm" data-spa="delete" style="background:transparent;color:var(--text-tertiary);border-color:var(--text-tertiary)">Discard</button>
          </div>
        </div>

        ${activities.length ? `<div class="adm-so-section"><div class="adm-so-sect-title">Activity Timeline</div>${activities.map(a => `<div class="adm-note-item"><div class="adm-note-time">${a.created_at ? relativeTime(a.created_at) : '-'} \u00b7 <span class="adm-note-by">${a.performed_by || 'system'}</span></div><div class="adm-note-text" style="font-size:11px">${a.activity_type.replace(/_/g,' ')}</div></div>`).join('')}</div>` : ''}

        <div class="adm-so-section"><div class="adm-so-sect-title">Notes</div>
          <textarea class="adm-note-input" placeholder="Add notes..." id="sp-notes-input">${l.notes || ''}</textarea>
          <button class="adm-btn-sm" id="sp-save-notes">Save Notes</button>
        </div>`;

      // Bind action buttons
      document.getElementById('sp-actions')?.querySelectorAll('button[data-spa]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.spa;
          if (action === 'delete' && !confirm('Discard this lead permanently?')) return;
          if (action === 'decline' && !confirm('Decline this lead? It won\'t be re-prospected.')) return;
          try {
            if (action === 'delete') {
              await api(`/admin/sales-leads/${id}`, { method: 'DELETE' });
            } else {
              await api(`/admin/sales-leads/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) });
            }
            showToast(`Lead ${action === 'delete' ? 'discarded' : action}`, 'success');
            document.getElementById('adm-lead-slideout')?.classList.remove('open');
            await loadSalesLeads();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });

      // Save notes
      document.getElementById('sp-save-notes')?.addEventListener('click', async () => {
        const notes = document.getElementById('sp-notes-input')?.value;
        try {
          await api(`/admin/sales-leads/${id}`, { method: 'PATCH', body: JSON.stringify({ notes }) });
          showToast('Notes saved', 'success');
        } catch (err) { showToast(err.message, 'error'); }
      });

      document.getElementById('adm-lead-slideout').classList.add('open');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function loadSalesLeads() {
    try {
      const [leadsRes, statsRes] = await Promise.all([
        api('/admin/sales-leads').catch(() => null),
        api('/admin/sales-leads/stats').catch(() => null),
      ]);
      salesLeads = leadsRes?.data?.leads || [];
      salesStats = statsRes?.data || {};
      renderSalesPipeline();
    } catch (err) { showToast(err.message, 'error'); }
  }

  // Tab switching: Scan Leads vs Sales Pipeline
  document.getElementById('adm-lead-tabs')?.querySelectorAll('.adm-vt-btn').forEach(b => b.addEventListener('click', async () => {
    document.getElementById('adm-lead-tabs')?.querySelectorAll('.adm-vt-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const tab = b.dataset.ltab;
    document.getElementById('adm-scan-view')?.classList.toggle('visible', tab === 'scan');
    document.getElementById('adm-pipeline-view')?.classList.toggle('visible', tab === 'pipeline');
    if (tab === 'pipeline' && salesLeads.length === 0) await loadSalesLeads();
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

    document.getElementById('adm-agent-config-table').innerHTML = agents.length ? `<div class="adm-table-scroll"><table class="adm-table"><thead><tr><th>Agent</th><th>Status</th><th>Schedule</th><th>Last Run</th><th>Avg Duration</th><th>Success Rate</th><th>Outputs (24h)</th><th>Actions</th></tr></thead><tbody>${agents.map(a => {
      const aid = a.agent_id || a.name;
      const meta = AGENT_META[a.name] || AGENT_META[aid] || { color: '#22d3ee' };
      const cfg = configs[aid] || {};
      const successRate = a.jobs_24h ? ((1 - (a.error_count_24h || 0) / a.jobs_24h) * 100).toFixed(1) : '100.0';
      const avgDur = a.avg_duration_ms ? (a.avg_duration_ms / 1000).toFixed(1) + 's' : '-';
      return `<tr style="--agent-accent:${meta.color}" data-agent-color><td><div style="display:flex;align-items:center;gap:8px;border-left:3px solid ${meta.color};padding-left:10px"><div class="agent-icon ${meta.iconClass || ''}" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:${meta.color};background:${meta.color}15">${agentIcon(aid, 20)}</div><span style="font-weight:500;color:${meta.color}">${a.display_name || a.name}</span></div></td><td><span class="adm-status-pill ${a.status || 'idle'}">${a.status || 'idle'}</span></td><td><span class="adm-schedule-pill">${cfg.schedule_label || a.schedule || cfg.schedule || '-'}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${a.last_run_at ? relativeTime(Math.round((Date.now() - new Date(a.last_run_at).getTime()) / 60000)) : '-'}</td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary)">${avgDur}</td><td style="font-family:var(--font-mono);font-size:10px;color:${parseFloat(successRate) >= 99 ? 'var(--positive)' : 'var(--threat-medium)'}">${successRate}%</td><td style="font-family:var(--font-mono);font-size:12px;font-weight:500">${a.outputs_24h || 0}</td><td style="white-space:nowrap"><button class="adm-action-btn adm-trigger-btn" data-agent="${a.agent_id || a.name}">Trigger Now</button></td></tr>`;
    }).join('')}</tbody></table></div>` : '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No agents configured</div>';

    // API usage section — KV-backed accurate per-day tracking
    const tokens24h = usage.tokens_24h || 0;
    const tokens7d = usage.tokens_7d || 0;
    const tokens30d = usage.tokens_30d || 0;
    const callsToday = usage.calls_today || 0;
    const dailyLimit = usage.daily_limit || 500;
    const limitPct = Math.min(100, Math.round(callsToday / dailyLimit * 100));
    document.getElementById('adm-api-usage').innerHTML = `
      <div style="display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap">
        <div><div style="font-family:var(--font-display);font-weight:700;font-size:18px;color:var(--blue-primary)">${tokens24h.toLocaleString()}</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Tokens (24h)</div><div style="font-size:9px;color:var(--text-tertiary)">${usage.estimated_cost_24h || '$0.00'}</div></div>
        <div><div style="font-family:var(--font-display);font-weight:700;font-size:18px">${tokens7d.toLocaleString()}</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Tokens (7d)</div><div style="font-size:9px;color:var(--text-tertiary)">${usage.estimated_cost_7d || '$0.00'}</div></div>
        <div><div style="font-family:var(--font-display);font-weight:700;font-size:18px">${tokens30d.toLocaleString()}</div><div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Tokens (30d)</div><div style="font-size:9px;color:var(--text-tertiary)">${usage.estimated_cost_30d || '$0.00'}</div></div>
      </div>
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:var(--text-secondary)">Today: ${callsToday} calls</span><span style="color:var(--text-tertiary)">limit: 300 soft / ${dailyLimit} hard</span></div>
        <div style="height:6px;background:var(--bg-elevated);border-radius:3px;overflow:hidden"><div style="height:100%;width:${limitPct}%;background:${limitPct >= 100 ? 'var(--negative)' : limitPct >= 60 ? 'var(--threat-medium)' : 'var(--positive)'};border-radius:3px;transition:width .3s"></div></div>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap">
        <div style="font-size:11px"><span style="color:var(--text-secondary)">Agent AI</span> <span style="font-family:var(--font-mono);color:var(--text-primary)">${usage.agent_cost_30d || '$0.00'}</span><span style="color:var(--text-tertiary);font-size:9px"> (${usage.agent_calls_30d || 0} calls)</span></div>
        <div style="font-size:11px"><span style="color:var(--text-secondary)">On-demand AI</span> <span style="font-family:var(--font-mono);color:var(--text-primary)">${usage.ondemand_cost_30d || '$0.00'}</span><span style="color:var(--text-tertiary);font-size:9px"> (${usage.ondemand_calls_30d || 0} calls)</span></div>
      </div>
      <div style="padding-top:12px;border-top:1px solid var(--blue-border)">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--text-secondary)">Anthropic API Key</span>
          <span style="font-family:var(--font-mono);font-size:11px;color:${usage.api_key_configured ? 'var(--positive)' : 'var(--negative)'}">${usage.api_key_configured ? 'Configured \u2713' : 'Not set \u26a0'}</span>
        </div>
      </div>`;

    // Trigger Now buttons — visual feedback (spinner → green check / red x) + auto-refresh row
    el.querySelectorAll('.adm-trigger-btn[data-agent]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const agentId = btn.dataset.agent;
        btn.classList.remove('trigger-ok', 'trigger-fail');
        btn.classList.add('trigger-pending');
        try {
          await api(`/agents/${agentId}/trigger`, { method: 'POST' });
          btn.classList.remove('trigger-pending');
          btn.classList.add('trigger-ok');
          // Auto-refresh: wait 2s then re-fetch agent stats and update the row
          setTimeout(async () => {
            try {
              const res = await api('/agents');
              const updated = (res?.data || []).find(a => (a.agent_id || a.name) === agentId);
              if (updated) {
                const row = btn.closest('tr');
                if (row) {
                  const cells = row.querySelectorAll('td');
                  // cells[1]=Status, cells[3]=Last Run, cells[4]=Success Rate, cells[5]=Outputs
                  if (cells[1]) cells[1].innerHTML = `<span class="adm-status-pill ${updated.status || 'idle'}">${updated.status || 'idle'}</span>`;
                  if (cells[3]) { cells[3].textContent = updated.last_run_at ? relativeTime(Math.round((Date.now() - new Date(updated.last_run_at).getTime()) / 60000)) : '-'; cells[3].style.color = 'var(--positive)'; setTimeout(() => { cells[3].style.color = 'var(--text-tertiary)'; }, 3000); }
                  if (cells[4]) { const sr = updated.jobs_24h ? ((1 - (updated.error_count_24h || 0) / updated.jobs_24h) * 100).toFixed(1) : '100.0'; cells[4].textContent = sr + '%'; }
                  if (cells[5]) cells[5].textContent = String(updated.outputs_24h || 0);
                }
              }
            } catch (_) { /* silent */ }
          }, 2000);
        } catch (err) {
          btn.classList.remove('trigger-pending');
          btn.classList.add('trigger-fail');
        }
        setTimeout(() => { btn.classList.remove('trigger-ok', 'trigger-fail'); }, 3000);
      });
    });

  } catch (err) { showToast(err.message, 'error'); }
}

// ─── View: Admin Audit Log (Step 18c) ──────────────────────
async function viewAdminAudit(el) {
  const AUDIT_CATEGORIES = {
    Auth: ['login', 'logout', 'refresh_invalid', 'token_refresh'],
    Admin: ['backfill_geo', 'match_brands', 'import_brands', 'run_ai_analysis', 'force_feed_pull', 'invite_user'],
    Feeds: ['feed_pull', 'feed_error', 'feed_enabled', 'feed_config'],
    Agents: ['agent_trigger', 'agent_output', 'agent_error'],
    System: ['session_check', 'cron_run', 'migration', 'config_change', 'data_export'],
  };
  function actionCategory(action) {
    for (const [cat, actions] of Object.entries(AUDIT_CATEGORIES)) {
      if (actions.includes(action)) return cat;
    }
    return 'System';
  }
  function deriveDetails(e) {
    if (e.details && typeof e.details === 'object' && Object.keys(e.details).length > 0) {
      const d = e.details;
      if (d.message) return d.message;
      if (d.enriched !== undefined) return `enriched ${d.enriched} IPs, ${d.remaining ?? '?'} remaining`;
      if (d.matched !== undefined) return `matched ${d.matched} threats, ${d.pending ?? '?'} pending`;
      if (d.imported !== undefined) return `imported ${d.imported} brands from Tranco`;
      if (d.feeds !== undefined) return `triggered ${d.feeds} feeds`;
      return JSON.stringify(d).slice(0, 80);
    }
    if (e.metadata && typeof e.metadata === 'object' && Object.keys(e.metadata).length > 0) {
      return JSON.stringify(e.metadata).slice(0, 80);
    }
    const hints = {
      login: `from ${e.ip_address || 'unknown IP'}`,
      refresh_invalid: 'token expired, session ended',
      backfill_geo: 'geo enrichment triggered',
      match_brands: 'brand matching triggered',
      force_feed_pull: 'all feeds triggered',
      run_ai_analysis: 'triggered all agents',
      import_brands: 'brand import triggered',
    };
    return hints[e.action] || '-';
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700">Audit Log</div>
      <a href="/api/v1/admin/audit/export?since=${new Date(Date.now() - 30 * 86400000).toISOString()}" class="adm-btn adm-btn-primary" target="_blank">Export CSV</a>
    </div>
    <div style="margin-bottom:12px">
      <input class="adm-search" id="adm-audit-search" placeholder="Search by action, user, or IP..." style="width:100%;max-width:400px">
    </div>
    <div class="adm-controls" style="margin-bottom:16px">
      <select class="adm-sel" id="adm-audit-user"><option value="">All Users</option></select>
      <select class="adm-sel" id="adm-audit-action"><option value="">All Actions</option><option value="login">Login</option><option value="login_failed">Login Failed</option><option value="role_change">Role Change</option><option value="invitation">Invitation</option><option value="feed_config">Feed Config</option><option value="config_change">Config Change</option><option value="data_export">Data Export</option></select>
      <select class="adm-sel" id="adm-audit-outcome"><option value="">All Outcomes</option><option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option></select>
      <select class="adm-sel" id="adm-audit-category"><option value="">All Categories</option><option value="Auth">Auth</option><option value="Admin" selected>Admin</option><option value="Feeds">Feeds</option><option value="Agents">Agents</option><option value="System">System</option></select>
    </div>
    <div class="adm-panel" id="adm-audit-table"><div style="padding:20px;text-align:center;color:var(--text-tertiary)">Loading...</div></div>`;

  let allEntries = [];
  let allUsers = [];
  let _expandedIdx = -1;
  let _searchTerm = '';

  function deduplicateAuditEntries(entries) {
    const groups = [];
    for (const e of entries) {
      const key = (e.action || '') + '|' + (e.outcome || '');
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.count++;
        last.lastTs = e.timestamp;
      } else {
        groups.push({ key, entries: [e], event: e, count: 1, firstTs: e.timestamp, lastTs: e.timestamp });
      }
    }
    return groups;
  }

  function renderAuditTable(entries) {
    if (!entries.length) return '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">No audit entries found</div>';
    const groups = deduplicateAuditEntries(entries);
    return `<div class="adm-table-scroll" style="max-height:600px;overflow-y:auto"><table class="adm-table"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Category</th><th>Details</th><th>Outcome</th><th>IP Address</th></tr></thead><tbody>${groups.map((g, i) => {
      const e = g.event;
      const cat = actionCategory(e.action);
      const details = deriveDetails(e);
      const countBadge = g.count > 1 ? ` <span style="font-family:var(--font-mono);font-size:9px;background:rgba(0,212,255,.1);color:var(--blue-primary);padding:1px 5px;border-radius:3px">\u00d7${g.count}</span>` : '';
      const timeRange = g.count > 1 && g.firstTs && g.lastTs ? g.firstTs.slice(11, 16) + '\u2013' + g.lastTs.slice(11, 16) : (e.timestamp ? e.timestamp.slice(0, 19).replace('T', ' ') : '-');
      const isExpanded = _expandedIdx === i;
      let expandHtml = '';
      if (isExpanded) {
        expandHtml = `<tr><td colspan="7" style="padding:12px;background:rgba(0,212,255,.03);border-left:2px solid var(--blue-primary)"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;font-family:var(--font-mono)">
          <div><span style="color:var(--text-tertiary)">Full timestamp:</span> ${e.timestamp || '-'}</div>
          <div><span style="color:var(--text-tertiary)">IP:</span> ${e.ip_address || '-'}</div>
          <div><span style="color:var(--text-tertiary)">User agent:</span> ${e.user_agent || e.details?.user_agent || '-'}</div>
          <div><span style="color:var(--text-tertiary)">Resource:</span> ${e.resource_type || '-'} ${e.resource_id || ''}</div>
        </div>${e.details ? `<pre style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);white-space:pre-wrap;word-break:break-all;max-height:200px;overflow-y:auto;margin-top:8px;padding:8px;background:rgba(0,0,0,.2);border-radius:4px">${JSON.stringify(e.details, null, 2)}</pre>` : ''}</td></tr>`;
      }
      return `<tr data-gidx="${i}" style="cursor:pointer;${isExpanded ? 'background:rgba(0,212,255,.05)' : ''}"><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${timeRange}</td><td style="font-size:11px">${e.user_name || e.user_email || (e.user_id ? e.user_id.slice(0, 8) : 'system')}</td><td style="font-size:11px">${e.action || '-'}${countBadge}</td><td><span class="audit-cat-badge audit-cat-${cat.toLowerCase()}">${cat}</span></td><td style="font-size:10px;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${details}</td><td><span class="adm-ev-outcome ${e.outcome || 'success'}">${e.outcome || 'success'}</span></td><td style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">${e.ip_address || '-'}</td></tr>${expandHtml}`;
    }).join('')}</tbody></table></div>`;
  }

  function getFiltered() {
    const user = document.getElementById('adm-audit-user')?.value || '';
    const action = document.getElementById('adm-audit-action')?.value || '';
    const outcome = document.getElementById('adm-audit-outcome')?.value || '';
    const category = document.getElementById('adm-audit-category')?.value || '';
    return allEntries.filter(e => {
      if (user && e.user_id !== user) return false;
      if (action && e.action !== action) return false;
      if (outcome && e.outcome !== outcome) return false;
      if (category && actionCategory(e.action) !== category) return false;
      if (_searchTerm) {
        const s = _searchTerm.toLowerCase();
        const hay = ((e.action || '') + ' ' + (e.user_name || e.user_email || '') + ' ' + (e.ip_address || '') + ' ' + deriveDetails(e)).toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }

  function filterAudit() {
    _expandedIdx = -1;
    document.getElementById('adm-audit-table').innerHTML = renderAuditTable(getFiltered());
    bindAuditRows();
  }

  function bindAuditRows() {
    document.querySelectorAll('#adm-audit-table tr[data-gidx]').forEach(tr => {
      tr.addEventListener('click', () => {
        const idx = parseInt(tr.dataset.gidx);
        _expandedIdx = _expandedIdx === idx ? -1 : idx;
        document.getElementById('adm-audit-table').innerHTML = renderAuditTable(getFiltered());
        bindAuditRows();
      });
    });
  }

  try {
    const [auditRes, usersRes] = await Promise.all([
      api('/admin/audit?limit=200').catch(() => null),
      api('/admin/users').catch(() => null),
    ]);
    allEntries = auditRes?.data || [];
    allUsers = usersRes?.data?.users || usersRes?.data || [];

    const userSel = document.getElementById('adm-audit-user');
    allUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name || u.email;
      userSel?.appendChild(opt);
    });

    // Default filter is "Admin" (set via selected attribute above)
    filterAudit();
  } catch (err) { showToast(err.message, 'error'); }

  document.getElementById('adm-audit-user')?.addEventListener('change', filterAudit);
  document.getElementById('adm-audit-action')?.addEventListener('change', filterAudit);
  document.getElementById('adm-audit-outcome')?.addEventListener('change', filterAudit);
  document.getElementById('adm-audit-category')?.addEventListener('change', filterAudit);
  let _auditSearchTimer = null;
  document.getElementById('adm-audit-search')?.addEventListener('input', (ev) => {
    clearTimeout(_auditSearchTimer);
    _auditSearchTimer = setTimeout(() => { _searchTerm = ev.target.value; filterAudit(); }, 300);
  });
}

// ─── Brand Report View ──────────────────────────────────────
async function viewBrandReport(el, params) {
  el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">Generating report...</div>';
  try {
    const res = await api(`/brands/${params.id}/report`);
    const r = res?.data;
    if (!r) { el.innerHTML = '<div class="empty-state"><div class="message">Report not found</div></div>'; return; }

    const exec = r.executive || {};
    const scoreColor = exec.trustScore >= 80 ? 'var(--positive)' : exec.trustScore >= 60 ? 'var(--threat-medium)' : exec.trustScore >= 40 ? 'var(--threat-high)' : 'var(--negative)';

    const severityColors = { critical: 'var(--negative)', high: 'var(--threat-high)', medium: 'var(--threat-medium)', low: 'var(--positive)', info: 'var(--text-tertiary)' };

    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto;padding:24px 0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="${r.brand?.logo_url || ''}" alt="" style="width:32px;height:32px;border-radius:6px" onerror="this.style.display='none'">
            <div>
              <div style="font-size:20px;font-weight:700;font-family:var(--font-display)">${r.brand?.name || 'Brand Report'}</div>
              <div style="font-size:12px;color:var(--text-tertiary)">${r.period?.label || ''} &middot; ${r.reportId || ''}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px">
            <button onclick="window.print()" style="padding:6px 16px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--surface-primary);color:var(--text-primary);cursor:pointer;font-size:12px">Print / PDF</button>
            <a href="/brands/${params.id}" style="padding:6px 16px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--surface-primary);color:var(--text-primary);text-decoration:none;font-size:12px">Back to Brand</a>
          </div>
        </div>

        <!-- Executive Summary -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
          <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px">Trust Score</div>
            <div style="font-size:32px;font-weight:800;color:${scoreColor}">${exec.trustScore ?? '-'}</div>
            <div style="font-size:11px;color:${scoreColor};font-weight:600">${exec.riskLevel || ''} Risk</div>
          </div>
          <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px">Total Threats</div>
            <div style="font-size:32px;font-weight:800;color:var(--text-primary)">${exec.totalThreats ?? 0}</div>
            <div style="font-size:11px;color:var(--negative)">${exec.activeThreats ?? 0} active</div>
          </div>
          <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px">Campaigns</div>
            <div style="font-size:32px;font-weight:800;color:var(--text-primary)">${exec.campaignsIdentified ?? 0}</div>
            <div style="font-size:11px;color:var(--text-tertiary)">${exec.countriesInvolved ?? 0} countries</div>
          </div>
          <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px">Remediated</div>
            <div style="font-size:32px;font-weight:800;color:var(--positive)">${exec.remediatedThreats ?? 0}</div>
            <div style="font-size:11px;color:var(--text-tertiary)">${exec.hostingProviders ?? 0} providers</div>
          </div>
        </div>

        <!-- AI Summary -->
        <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;margin-bottom:20px">
          <div style="font-size:13px;font-weight:700;margin-bottom:8px;font-family:var(--font-display)">Executive Summary</div>
          <div style="font-size:13px;line-height:1.6;color:var(--text-secondary)">${exec.aiSummary || 'No summary available.'}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <!-- Threat Breakdown by Type -->
          <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px">
            <div style="font-size:13px;font-weight:700;margin-bottom:12px;font-family:var(--font-display)">Threats by Type</div>
            ${(r.threatBreakdown?.byType || []).map(t => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-subtle)">
                <span style="font-size:12px;text-transform:capitalize">${t.type}</span>
                <span style="font-size:12px;font-weight:600">${t.count}</span>
              </div>`).join('') || '<div style="font-size:12px;color:var(--text-tertiary)">No threats detected</div>'}
          </div>

          <!-- Threat Breakdown by Severity -->
          <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px">
            <div style="font-size:13px;font-weight:700;margin-bottom:12px;font-family:var(--font-display)">Threats by Severity</div>
            ${(r.threatBreakdown?.bySeverity || []).map(s => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-subtle)">
                <span style="font-size:12px;text-transform:capitalize;color:${severityColors[s.severity] || 'var(--text-primary)'}">${s.severity}</span>
                <span style="font-size:12px;font-weight:600">${s.count}</span>
              </div>`).join('') || '<div style="font-size:12px;color:var(--text-tertiary)">No data</div>'}
          </div>
        </div>

        <!-- Top Threats Table -->
        <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;margin-bottom:20px">
          <div style="font-size:13px;font-weight:700;margin-bottom:12px;font-family:var(--font-display)">Top Threats</div>
          <table class="data-table" style="font-size:12px">
            <thead><tr><th>Domain/URL</th><th>Type</th><th>Severity</th><th>Status</th><th>First Seen</th></tr></thead>
            <tbody>${(r.threatBreakdown?.topThreats || []).map(t => `
              <tr>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.malicious_domain || t.malicious_url || '-'}</td>
                <td><span class="type-pill">${t.threat_type || '-'}</span></td>
                <td style="color:${severityColors[t.severity] || 'var(--text-primary)'};text-transform:capitalize">${t.severity || '-'}</td>
                <td>${t.status || '-'}</td>
                <td>${t.first_seen ? new Date(t.first_seen).toLocaleDateString() : '-'}</td>
              </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-tertiary)">No threats</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <!-- Infrastructure: Top Providers -->
          <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px">
            <div style="font-size:13px;font-weight:700;margin-bottom:12px;font-family:var(--font-display)">Hosting Providers</div>
            ${(r.infrastructure?.providers || []).slice(0, 8).map(p => `
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border-subtle)">
                <span style="font-size:12px">${p.name}</span>
                <span style="font-size:11px;color:var(--text-tertiary)">${p.threat_count} threats (${p.active_count} active)</span>
              </div>`).join('') || '<div style="font-size:12px;color:var(--text-tertiary)">No provider data</div>'}
          </div>

          <!-- Campaigns -->
          <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px">
            <div style="font-size:13px;font-weight:700;margin-bottom:12px;font-family:var(--font-display)">Campaigns</div>
            ${(r.campaigns || []).slice(0, 8).map(c => `
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border-subtle)">
                <span style="font-size:12px">${c.name}</span>
                <span style="font-size:11px;color:var(--text-tertiary)">${c.threat_count} threats &middot; ${c.status}</span>
              </div>`).join('') || '<div style="font-size:12px;color:var(--text-tertiary)">No campaigns</div>'}
          </div>
        </div>

        <!-- Recommendations -->
        <div style="background:var(--surface-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:16px;margin-bottom:20px">
          <div style="font-size:13px;font-weight:700;margin-bottom:12px;font-family:var(--font-display)">Recommendations</div>
          <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.8;color:var(--text-secondary)">
            ${(r.recommendations || []).map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>

        <div style="text-align:center;font-size:11px;color:var(--text-tertiary);padding:16px 0">
          Generated ${r.generatedAt ? new Date(r.generatedAt).toLocaleString() : ''} &middot; ${r.reportId || ''}
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = '<div class="empty-state"><div class="message">Failed to generate report: ' + (err.message || 'Unknown error') + '</div></div>';
  }
}

// ─── Spam Trap Intelligence Card (Brand Detail) ─────────────
async function loadSpamTrapIntel(brandId) {
  const wrap = document.getElementById('spam-trap-intel-wrap');
  if (!wrap) return;
  try {
    const res = await api(`/spam-trap/captures/brand/${brandId}`).catch(() => null);
    const d = res?.data;
    if (!d || d.total === 0) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div class="panel" style="margin-bottom:16px">
        <div class="phead"><span>Spam Trap Intelligence</span><span class="badge" style="background:rgba(245,158,11,.15);color:#F59E0B">${d.total} caught</span></div>
        <div class="panel-body padded">
          <div style="display:flex;gap:24px;margin-bottom:12px">
            <div><div style="font-size:20px;font-weight:700;color:var(--text-primary)">${d.total}</div><div style="font-size:10px;color:var(--text-tertiary)">Spoofed emails caught</div></div>
            <div><div style="font-size:20px;font-weight:700;color:var(--text-primary)">${d.unique_ips}</div><div style="font-size:10px;color:var(--text-tertiary)">Unique source IPs</div></div>
            <div><div style="font-size:20px;font-weight:700;color:${d.auth_fail_pct > 80 ? 'var(--negative)' : 'var(--text-primary)'}">${d.auth_fail_pct}%</div><div style="font-size:10px;color:var(--text-tertiary)">Auth failure rate</div></div>
          </div>
          ${(d.recent || []).map(c => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">
              <span style="font-family:var(--font-mono);color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.from_address || ''}</span>
              <span style="color:var(--text-tertiary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(c.subject || '').substring(0, 60)}</span>
              <span>SPF:<span style="color:${c.spf_result === 'fail' ? 'var(--negative)' : 'var(--positive)'}">${c.spf_result || '-'}</span></span>
              <span>DKIM:<span style="color:${c.dkim_result === 'fail' ? 'var(--negative)' : 'var(--positive)'}">${c.dkim_result || '-'}</span></span>
            </div>
          `).join('')}
        </div>
      </div>`;
  } catch {
    wrap.innerHTML = '';
  }
}

// ─── Admin Spam Trap Tab ─────────────────────────────────────
async function viewAdminSpamTrap(el) {
  el.innerHTML = `
    <div class="admin-content" style="max-width:1200px;margin:0 auto;padding:20px">
    <div style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:16px">Spam Trap Command Center</div>
    <div class="adm-metrics" id="st-metrics"></div>
    <div class="adm-grid-2">
      <div class="adm-panel">
        <div class="adm-phead"><div class="adm-ptitle">Trap Health</div></div>
        <div class="adm-padded" id="st-health">Loading...</div>
        <div class="adm-padded" style="margin-top:8px">
          <button class="filter-pill" id="st-deploy-seeds" style="font-size:11px">Deploy Initial Seeds</button>
        </div>
      </div>
      <div class="adm-panel">
        <div class="adm-phead"><div class="adm-ptitle">Seed Campaigns</div></div>
        <div id="st-campaigns" style="max-height:300px;overflow-y:auto">Loading...</div>
        <div class="adm-padded" style="margin-top:8px">
          <button class="filter-pill" id="st-run-strategist" style="font-size:11px">Run Strategist</button>
        </div>
      </div>
    </div>
    <div class="adm-panel" style="margin-top:16px">
      <div class="adm-phead"><div class="adm-ptitle">Recent Captures</div><div class="adm-pbadge" id="st-total-badge">-</div></div>
      <div id="st-captures" style="max-height:400px;overflow-y:auto">Loading...</div>
    </div>
    <div class="adm-grid-2" style="margin-top:16px">
      <div class="adm-panel">
        <div class="adm-phead"><div class="adm-ptitle">Daily Catch Chart (30d)</div></div>
        <div class="adm-chart-wrap"><canvas id="st-daily-chart"></canvas></div>
      </div>
      <div class="adm-panel">
        <div class="adm-phead"><div class="adm-ptitle">Top Spoofing Sources</div></div>
        <div id="st-sources" style="max-height:300px;overflow-y:auto">Loading...</div>
      </div>
    </div>
    </div>`;

  let _stChart = null;

  try {
    const [statsRes, capturesRes, campaignsRes, sourcesRes] = await Promise.all([
      api('/spam-trap/stats').catch(() => null),
      api('/spam-trap/captures?limit=20').catch(() => null),
      api('/spam-trap/campaigns').catch(() => null),
      api('/spam-trap/sources').catch(() => null),
    ]);

    const s = statsRes?.data?.stats || {};
    const daily = statsRes?.data?.daily || [];
    const health = statsRes?.data?.health || [];
    const captures = capturesRes?.data || [];
    const campaigns = campaignsRes?.data || [];
    const sources = sourcesRes?.data || [];
    const totalCaptures = capturesRes?.total || s.total_captures || 0;

    // Stats cards
    document.getElementById('st-metrics').innerHTML = `
      <div class="adm-metric"><div class="adm-metric-val">${s.total_captures || 0}</div><div class="adm-metric-label">Captured</div><div class="adm-metric-sub">+${s.last_24h || 0} 24h</div></div>
      <div class="adm-metric"><div class="adm-metric-val">${s.brands_spoofed || 0}</div><div class="adm-metric-label">Brands Spoofed</div></div>
      <div class="adm-metric"><div class="adm-metric-val">${s.unique_ips || 0}</div><div class="adm-metric-label">Unique IPs</div></div>
      <div class="adm-metric"><div class="adm-metric-val">${s.auth_fail_rate || 0}%</div><div class="adm-metric-label">Auth Fail Rate</div></div>`;

    document.getElementById('st-total-badge').textContent = totalCaptures;

    // Trap health
    const channelIcons = { generic: '\u25cb', brand: '\u25c9', spider: '\u25cc', paste: '\u25ce', honeypot: '\u25cf', employee: '\u25ca' };
    document.getElementById('st-health').innerHTML = health.length
      ? health.map(h => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px"><span>${channelIcons[h.channel] || '\u25cb'}</span><span style="flex:1;text-transform:capitalize">${h.channel}</span><span style="font-weight:700">${h.count} active</span></div>`).join('')
      : '<div style="color:var(--text-tertiary);font-size:12px">No seed addresses deployed yet</div>';

    // Campaigns
    document.getElementById('st-campaigns').innerHTML = campaigns.length
      ? `<div class="adm-table-scroll"><table class="adm-table"><thead><tr><th>Name</th><th>Channel</th><th>Catches</th><th>Status</th></tr></thead><tbody>${campaigns.map(c => `<tr><td>${c.name}</td><td>${c.channel}</td><td>${c.total_catches}</td><td><span style="color:${c.status === 'active' ? 'var(--positive)' : 'var(--text-tertiary)'}">${c.status}</span></td></tr>`).join('')}</tbody></table></div>`
      : '<div style="padding:12px;text-align:center;color:var(--text-tertiary);font-size:12px">No campaigns yet</div>';

    // Recent captures
    document.getElementById('st-captures').innerHTML = captures.length
      ? `<div class="adm-table-scroll"><table class="adm-table"><thead><tr><th>From</th><th>Brand</th><th>SPF</th><th>DKIM</th><th>DMARC</th><th>Category</th><th>Severity</th><th>Time</th></tr></thead><tbody>${captures.map(c => {
          const authColor = r => r === 'fail' ? 'var(--negative)' : r === 'pass' ? 'var(--positive)' : 'var(--text-tertiary)';
          return `<tr>
            <td style="font-family:var(--font-mono);font-size:10px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.from_address || ''}</td>
            <td>${c.spoofed_domain || '-'}</td>
            <td style="color:${authColor(c.spf_result)}">${c.spf_result || '-'}</td>
            <td style="color:${authColor(c.dkim_result)}">${c.dkim_result || '-'}</td>
            <td style="color:${authColor(c.dmarc_result)}">${c.dmarc_result || '-'}</td>
            <td>${c.category || '-'}</td>
            <td><span class="severity-pill ${c.severity}">${c.severity || '-'}</span></td>
            <td style="font-size:10px;color:var(--text-tertiary)">${(c.captured_at || '').slice(0, 16).replace('T', ' ')}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`
      : '<div style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:12px">No captures yet — deploy initial seeds to start catching emails</div>';

    // Top sources
    document.getElementById('st-sources').innerHTML = sources.length
      ? `<div class="adm-table-scroll"><table class="adm-table"><thead><tr><th>IP</th><th>Emails</th><th>Brands Hit</th><th>Country</th><th>ASN</th><th>Last Seen</th></tr></thead><tbody>${sources.slice(0, 20).map(s => `<tr>
          <td style="font-family:var(--font-mono);font-size:10px">${s.sending_ip}</td>
          <td>${s.emails_caught}</td>
          <td>${s.brands_hit}</td>
          <td>${s.country_code || '-'}</td>
          <td style="font-size:10px">${s.asn || '-'}</td>
          <td style="font-size:10px;color:var(--text-tertiary)">${(s.last_seen || '').slice(0, 16).replace('T', ' ')}</td>
        </tr>`).join('')}</tbody></table></div>`
      : '<div style="padding:12px;text-align:center;color:var(--text-tertiary);font-size:12px">No source data yet</div>';

    // Daily chart
    if (daily.length && typeof Chart !== 'undefined') {
      const ctx = document.getElementById('st-daily-chart');
      if (ctx) {
        _stChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: daily.map(d => d.date?.slice(5) || ''),
            datasets: [
              { label: 'Phishing', data: daily.map(d => d.phishing || 0), backgroundColor: 'rgba(255,59,92,.7)' },
              { label: 'Spam', data: daily.map(d => d.spam || 0), backgroundColor: 'rgba(0,212,255,.5)' },
              { label: 'Malware', data: daily.map(d => d.malware || 0), backgroundColor: 'rgba(255,107,53,.7)' },
            ],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8899aa', font: { size: 10 } } } }, scales: { x: { stacked: true, ticks: { color: '#667788', font: { size: 9 } }, grid: { display: false } }, y: { stacked: true, ticks: { color: '#667788', font: { size: 9 } }, grid: { color: 'rgba(100,120,140,.1)' } } } },
        });
      }
    }
  } catch (err) {
    document.getElementById('st-metrics').innerHTML = `<div style="color:var(--negative)">Failed to load: ${err.message}</div>`;
  }

  // Button handlers
  document.getElementById('st-deploy-seeds')?.addEventListener('click', async () => {
    const btn = document.getElementById('st-deploy-seeds');
    btn.textContent = 'Deploying...'; btn.disabled = true;
    try {
      const res = await api('/spam-trap/seed/initial', { method: 'POST' });
      btn.textContent = `Deployed ${res?.data?.addresses_created || 0} addresses`;
    } catch (e) { btn.textContent = 'Failed: ' + e.message; }
  });

  document.getElementById('st-run-strategist')?.addEventListener('click', async () => {
    const btn = document.getElementById('st-run-strategist');
    btn.textContent = 'Running...'; btn.disabled = true;
    try {
      await api('/spam-trap/strategist/run', { method: 'POST' });
      btn.textContent = 'Complete! Refresh to see results.';
    } catch (e) { btn.textContent = 'Failed: ' + e.message; }
  });
}

// ─── Close user-menu dropdowns on outside click ─────────────
document.addEventListener('click', () => {
  document.querySelectorAll('.user-menu.open').forEach(m => m.classList.remove('open'));
});

// ─── Init ───────────────────────────────────────────────────
render();
