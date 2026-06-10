const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5173';
const OUT_DIR = '/tmp/averrow-audit/screenshots';
const ROUTES = JSON.parse(fs.readFileSync('/tmp/averrow-audit/routes.json', 'utf8'));

const MOCK_USER = {
  id: 'admin-00000000-0000-0000-0000-000000000001',
  email: 'admin@imprsn8.io',
  name: 'Admin',
  role: 'super_admin',
  avatar_url: null,
  organization: null,
};

function getMockResponse(url) {
  const u = new URL(url);
  const p = u.pathname;
  const q = u.search;

  if (p === '/api/auth/me') return { success: true, data: MOCK_USER };
  if (p === '/api/auth/refresh') return { data: { token: 'mock-token' } };
  if (p.includes('/notifications/unread-count')) return { success: true, data: { count: 3 } };
  if (p.includes('/notifications')) return { success: true, data: { notifications: [], unread_count: 0 } };
  if (p.includes('/observatory/nodes')) return { success: true, data: [] };
  if (p.includes('/observatory/stats')) return { success: true, data: { threats_mapped: 1247, countries: 42, active_campaigns: 8, brands_monitored: 156, period: '7d' } };
  if (p.includes('/observatory/arcs')) return { success: true, data: [] };
  if (p.includes('/threats/heatmap')) return { success: true, data: [] };
  if (p === '/api/brands/stats') return { success: true, data: { total_tracked: 156, new_this_week: 4, newest_brand_name: 'Acme Corp', fastest_rising_name: 'TestBrand', top_threat_type_name: 'phishing', sector_breakdown: [] } };
  if (p.match(/\/api\/brands\/\d+\/threats\/timeline/)) return { success: true, data: { labels: [], values: [] } };
  if (p.match(/\/api\/brands\/\d+\/threats/)) return { success: true, data: [], total: 0 };
  if (p.match(/\/api\/brands\/\d+\/social/)) return { success: true, data: [] };
  if (p.match(/\/api\/brands\/\d+\/email-security/)) return { success: true, data: {} };
  if (p.match(/\/api\/brands\/\d+\/safe-domains/)) return { success: true, data: [] };
  if (p.match(/\/api\/brands\/\d+\/discover-social/)) return { success: true, data: {} };
  if (p.match(/\/api\/brands\/\d+\/analysis/)) return { success: true, data: {} };
  if (p.match(/\/api\/brands\/\d+/)) return { success: true, data: { id: 1, name: 'Acme Corp', canonical_domain: 'acme.com', sector: 'Technology', threat_count: 42, email_security_grade: 'B+', exposure_score: 65, monitoring_status: 'active', social_risk_score: 35, logo_url: null, threat_trend: [5,8,3,12,7,9,4], top_threat_type: 'phishing', threat_history: [], monitored: true, threat_analysis: 'Acme Corp faces moderate phishing risk with 42 active threats detected across multiple vectors.', analysis_updated_at: '2024-03-15T10:00:00Z', official_handles: [], aliases: ['Acme'], brand_keywords: ['acme'] } };
  if (p === '/api/brands') return { success: true, data: [{ id: 1, name: 'Acme Corp', canonical_domain: 'acme.com', sector: 'Technology', threat_count: 42, email_security_grade: 'B+', exposure_score: 65, monitoring_status: 'active', social_risk_score: 35, logo_url: null, threat_trend: [5,8,3,12,7,9,4], top_threat_type: 'phishing', threat_history: [], monitored: true }, { id: 2, name: 'BetaCo', canonical_domain: 'betaco.io', sector: 'Finance', threat_count: 18, email_security_grade: 'A-', exposure_score: 40, monitoring_status: 'active', social_risk_score: 20, logo_url: null, threat_trend: [2,4,3,5,2,1,3], top_threat_type: 'typosquatting', threat_history: [], monitored: true }], total: 2 };
  if (p === '/api/v1/operations') return { success: true, data: [] };
  if (p === '/api/v1/operations/stats') return { success: true, data: { active_operations: 3, accelerating: 1, total_clusters: 12, campaigns_tracked: 5, brands_targeted: 8, threat_types: {} } };
  if (p === '/api/providers/intelligence') return { success: true, data: { total_providers: 45, active_operations: 3, accelerating: 1, pivots_detected: 7, total_clusters: 12, active_clusters: 5 } };
  if (p === '/api/providers/v2') return { success: true, data: [], total: 0 };
  if (p === '/api/providers/clusters') return { success: true, data: [] };
  if (p.match(/\/api\/providers\/\d+\/threats/)) return { success: true, data: [] };
  if (p.match(/\/api\/providers\/\d+\/timeline/)) return { success: true, data: { labels: [], values: [] } };
  if (p.match(/\/api\/providers\/\d+\/clusters/)) return { success: true, data: [] };
  if (p.match(/\/api\/providers\/\d+/)) return { success: true, data: { id: 1, name: 'HostGator', asn: 'AS1234', country: 'US', reputation_score: 45, avg_response_time: 72, total_threats: 120, active_threats: 15, brands_targeted: 8, campaigns: 3, first_seen: '2024-01-01', last_seen: '2024-03-15', brand_breakdown: [], type_breakdown: [] } };
  if (p === '/api/campaigns') return { success: true, data: [] };
  if (p === '/api/campaigns/stats') return { success: true, data: { total: 5, active_count: 3, dormant_count: 1, disrupted_count: 1, active_threats: 42, brands_affected: 8 } };
  if (p.match(/\/api\/campaigns\/geo\/[^/]+\/stats/)) return { success: true, data: { total_threats: 150, threats_24h: 12, threats_7d: 67, brands_targeted: 5, unique_ips: 34, unique_domains: 28, critical_count: 3, high_count: 15 } };
  if (p.match(/\/api\/campaigns\/geo\/[^/]+\/threats/)) return { success: true, data: { threats: [], total: 0 } };
  if (p.match(/\/api\/campaigns\/geo\/[^/]+\/timeline/)) return { success: true, data: { labels: [], values: [], by_type: {} } };
  if (p.match(/\/api\/campaigns\/geo\/[^/]+\/brands/)) return { success: true, data: [] };
  if (p.match(/\/api\/campaigns\/geo\/[^/]+\/asns/)) return { success: true, data: [] };
  if (p.match(/\/api\/campaigns\/geo\/[^/]+\/attack-types/)) return { success: true, data: [] };
  if (p.match(/\/api\/campaigns\/geo\/.+/)) return { success: true, data: { id: 1, name: 'Test Campaign', conflict: 'Test', status: 'active', threat_actors: [], adversary_countries: ['RU'], adversary_asns: [], target_countries: ['US'], target_sectors: ['finance'], target_brands: [], ttps: [], escalation_rules: {}, ioc_sources: [], known_iocs: [], start_date: '2024-01-01', description: 'Test geo campaign', created_at: '2024-01-01' } };
  if (p.match(/\/api\/campaigns\/\d+/)) return { success: true, data: { id: 1, name: 'Campaign Alpha', first_seen: '2024-01-01', last_seen: '2024-03-15', threat_count: 45, brand_count: 3, provider_count: 5, domain_count: 12, attack_pattern: 'phishing', status: 'active', severity: 'high', ip_count: 8, brand_breakdown: [], provider_breakdown: [] } };
  if (p === '/api/threat-actors') return { success: true, data: [] };
  if (p === '/api/threat-actors/stats') return { success: true, data: { total: 12, active: 8, by_country: [], by_attribution: [], tracked_infrastructure: 45, targeted_brands: 20 } };
  if (p.match(/\/api\/threat-actors\/by-brand/)) return { success: true, data: [] };
  if (p.match(/\/api\/threat-actors\/\d+/)) return { success: true, data: { id: 1, name: 'APT-Phantom', aliases: ['Shadow Group'], attribution: 'state-sponsored', country: 'RU', description: 'Advanced persistent threat group.', ttps: ['phishing', 'malware'], target_sectors: ['finance', 'tech'], active_campaigns: 2, first_seen: '2023-06-01', last_seen: '2024-03-15', status: 'active', infra_count: 15, target_count: 8, infrastructure: [], targets: [], linked_threat_count: 42, created_at: '2023-06-01' } };
  if (p.includes('/trends/intelligence')) return { success: true, data: [] };
  if (p.includes('/trends/threat-volume')) return { success: true, data: [] };
  if (p.includes('/trends/brand-momentum')) return { success: true, data: [] };
  if (p.includes('/trends/provider-momentum')) return { success: true, data: [] };
  if (p.includes('/trends/nexus-active')) return { success: true, data: [] };
  if (p === '/api/agents') return { success: true, data: [] };
  if (p === '/api/agents/runs') return { success: true, data: { data: [], total: 0 } };
  if (p === '/api/agents/token-usage') return { success: true, data: [] };
  if (p.match(/\/api\/agents\/[^/]+\/outputs/)) return { success: true, data: [] };
  if (p.match(/\/api\/agents\/[^/]+\/health/)) return { success: true, data: { runs: [], errors: [], outputs: [] } };
  if (p.match(/\/api\/agents\/[^/]+/)) return { success: true, data: { agent: {}, runs: [], outputs: [], stats: {} } };
  if (p.includes('/api/admin/agents/config')) return { success: true, data: {} };
  if (p.includes('/api/admin/agents/api-usage')) return { success: true, data: { tokens_24h: 0, tokens_7d: 0, tokens_30d: 0, calls_today: 0, daily_limit: 1000, agent_cost_30d: 0, agent_calls_30d: 0, ondemand_cost_30d: 0, ondemand_calls_30d: 0, api_key_configured: true } };
  if (p.includes('/api/admin/stats')) return { success: true, data: { users: {}, threats: {}, sessions: {}, agent_backlogs: {}, ai_attribution_pending: 0, tranco_brand_count: 0 } };
  if (p === '/api/alerts') return { success: true, data: { alerts: [], total: 0 } };
  if (p === '/api/alerts/stats') return { success: true, data: { total: 0, new_count: 0, acknowledged: 0, resolved: 0, dismissed: 0, critical: 0, high: 0, medium: 0, low: 0, by_brand: [] } };
  if (p.includes('/api/admin/sales-leads/stats')) return { success: true, data: { pipeline: {}, weekly: {}, response_rate: 0, conversion_rate: 0 } };
  if (p.includes('/api/admin/sales-leads')) return { success: true, data: { data: [], total: 0 } };
  if (p === '/api/feeds/overview') return { success: true, data: [] };
  if (p === '/api/feeds/aggregate-stats') return { success: true, data: { active: 0, disabled: 0, total_ingested: 0 } };
  if (p.includes('/api/admin/takedowns')) return { success: true, data: { takedowns: [], total: 0, statusCounts: [] } };
  if (p.includes('/api/admin/budget')) return { success: true, data: {} };
  if (p.includes('/api/admin/system-health')) return { success: true, data: { threats: {}, agents: {}, feeds: {}, sessions: {}, migrations: {}, audit: {}, trend: [], infrastructure: {} } };
  if (p.includes('/api/admin/audit')) return { success: true, data: { entries: [], total: 0 } };
  if (p.includes('/api/admin/organizations')) return { success: true, data: [] };
  if (p.match(/\/api\/orgs\/\d+\/members/)) return { success: true, data: [] };
  if (p.match(/\/api\/orgs\/\d+\/brands/)) return { success: true, data: [] };
  if (p.match(/\/api\/orgs\/\d+\/invites/)) return { success: true, data: [] };
  if (p.match(/\/api\/orgs\/\d+\/api-keys/)) return { success: true, data: [] };
  if (p.match(/\/api\/orgs\/\d+\/integrations/)) return { success: true, data: [] };
  if (p.match(/\/api\/orgs\/\d+\/webhook\/deliveries/)) return { success: true, data: [] };
  if (p.match(/\/api\/orgs\/\d+\/webhook/)) return { success: true, data: {} };
  if (p.match(/\/api\/orgs\/\d+\/sso/)) return { success: true, data: {} };
  if (p.match(/\/api\/orgs\/\d+/)) return { success: true, data: { id: 1, name: 'Averrow', slug: 'averrow', plan: 'enterprise', status: 'active', max_brands: 100, max_members: 50, created_at: '2024-01-01' } };
  if (p.includes('/api/spam-trap/stats')) return { success: true, data: { total_captures: 0, captures_24h: 0, brands_spoofed: 0, unique_ips: 0, auth_fail_rate: 0 } };
  if (p.includes('/api/spam-trap/captures')) return { success: true, data: [] };
  if (p.includes('/api/spam-trap/addresses')) return { success: true, data: [] };
  if (p.includes('/api/spam-trap/campaigns')) return { success: true, data: [] };
  if (p.includes('/api/spam-trap/seeding-sources')) return { success: true, data: { sources: [], honeypot_visits: {} } };
  if (p.includes('/api/dashboard/brand-admin')) return { success: true, data: { total_threats: 0, active_threats: 0, brand_count: 0, avg_email_score: 0, recent_threats: [], brand_health: [], recent_alerts: [], takedown_summary: {} } };
  if (p.includes('/api/admin/sparrow/evidence')) return { success: true, data: [] };
  return { success: true, data: [] };
}

async function setupPage(page) {
  // Set up API interception BEFORE any navigation
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    try {
      const mock = getMockResponse(url);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mock),
      });
    } catch (e) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    }
  });

  // Block external resources that hang (fonts, maps, etc.)
  await page.route('**/*.pbf', route => route.abort());
  await page.route('**/tiles/**', route => route.abort());
  await page.route('**/*.mvt', route => route.abort());
  await page.route('**/maplibre/**', route => route.abort());
  await page.route('**/mapbox/**', route => route.abort());
  await page.route('**/fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/fonts.gstatic.com/**', route => route.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));

  // Navigate to set localStorage
  await page.goto(`${BASE_URL}/v2/login`, { waitUntil: 'commit', timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('averrow_token', 'mock-jwt-token-for-audit');
    localStorage.setItem('averrow_refresh', 'mock-refresh-token');
  });
  await page.waitForTimeout(500);
}

async function captureRoute(page, route, prefix = '') {
  const name = prefix ? `${prefix}${route.name}` : route.name;
  try {
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'commit', timeout: 10000 });
    await page.waitForTimeout(3000); // Let React render
    await page.screenshot({ path: path.join(OUT_DIR, `${name}-full.png`), fullPage: true });
    if (!prefix) {
      await page.screenshot({ path: path.join(OUT_DIR, `${name}-fold.png`), fullPage: false });
    }
    console.log(`  ✓ ${name}`);
    return null;
  } catch (e) {
    const err = e.message.slice(0, 150);
    console.log(`  ✗ ${name} — ${err}`);
    try {
      await page.screenshot({ path: path.join(OUT_DIR, `${name}-ERROR.png`), fullPage: false });
    } catch {}
    return { route: route.name, viewport: prefix || 'desktop', error: err };
  }
}

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-proxy-server'],
  });
  const failures = [];

  // --- DESKTOP ---
  console.log('=== DESKTOP (1440x900) ===');
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dPage = await desktop.newPage();
  await setupPage(dPage);

  for (const route of ROUTES) {
    const fail = await captureRoute(dPage, route);
    if (fail) failures.push(fail);
  }

  // --- MOBILE ---
  console.log('\n=== MOBILE (390x844) ===');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mPage = await mobile.newPage();
  await setupPage(mPage);

  for (const route of ROUTES) {
    const fail = await captureRoute(mPage, route, 'mobile-');
    if (fail) failures.push(fail);
  }

  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\n✅ DONE — ${files.length} screenshots saved to ${OUT_DIR}`);

  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    routeCount: ROUTES.length,
    screenshotCount: files.length,
    failures,
    files,
  };
  fs.writeFileSync('/tmp/averrow-audit/capture-summary.json', JSON.stringify(summary, null, 2));
  console.log('Summary: /tmp/averrow-audit/capture-summary.json');

  if (failures.length > 0) {
    console.log(`\n⚠️  ${failures.length} failures:`);
    failures.forEach(f => console.log(`  - ${f.route} (${f.viewport}): ${f.error.slice(0, 80)}`));
  }
}

run().catch(console.error);
