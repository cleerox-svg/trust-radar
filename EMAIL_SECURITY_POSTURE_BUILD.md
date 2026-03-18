# EMAIL SECURITY POSTURE ENGINE — Claude Code Build Prompt

## CONTEXT
Trust Radar (lrxradar.com) is a threat intelligence platform built as a Cloudflare Worker SPA with D1 SQLite. We monitor 519 brands for phishing, typosquatting, malware, etc. This build adds **Email Security Posture Scanning** — DNS-based checks of DMARC, SPF, and DKIM for every monitored brand. This becomes a core component of each brand's trust score AND is shown on the public website when someone scans a domain.

**Tech stack**: Cloudflare Worker (TypeScript), D1 SQLite, vanilla JS frontend (app.js ~4000 lines, styles.css), Cloudflare DoH for DNS queries.

**Repo**: `packages/trust-radar/`
- Worker: `packages/trust-radar/src/worker.ts` (or index.ts — check which exists)
- Frontend: `packages/trust-radar/public/app.js` and `packages/trust-radar/public/styles.css`
- D1 binding: `DB` (trust-radar-v2)
- KV binding: `CACHE` (trust-radar-cache)

---

## PHASE 1: DATABASE SCHEMA

Add new table and columns. Generate migration SQL.

```sql
-- Migration: 0018_email_security_posture.sql

-- Email security scan results (one per brand per scan)
CREATE TABLE IF NOT EXISTS email_security_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  domain TEXT NOT NULL,
  
  -- DMARC
  dmarc_exists INTEGER DEFAULT 0,        -- boolean
  dmarc_policy TEXT,                       -- none/quarantine/reject
  dmarc_pct INTEGER,                       -- percentage (0-100)
  dmarc_rua TEXT,                          -- aggregate report URI
  dmarc_ruf TEXT,                          -- forensic report URI
  dmarc_raw TEXT,                          -- full DMARC TXT record
  
  -- SPF
  spf_exists INTEGER DEFAULT 0,           -- boolean
  spf_policy TEXT,                         -- ~all/-all/+all/?all
  spf_includes INTEGER DEFAULT 0,         -- count of include: directives
  spf_too_many_lookups INTEGER DEFAULT 0, -- boolean: >10 DNS lookups
  spf_raw TEXT,                            -- full SPF TXT record
  
  -- DKIM
  dkim_exists INTEGER DEFAULT 0,          -- boolean (checks common selectors)
  dkim_selectors_found TEXT,              -- JSON array of found selectors
  dkim_raw TEXT,                           -- first found DKIM record
  
  -- MX
  mx_exists INTEGER DEFAULT 0,           -- boolean
  mx_providers TEXT,                       -- JSON array: ["google","microsoft","proofpoint"]
  
  -- Scores
  email_security_score INTEGER DEFAULT 0, -- 0-100
  email_security_grade TEXT,              -- A+/A/B/C/D/F
  
  -- Metadata
  scanned_at TEXT DEFAULT (datetime('now')),
  scan_duration_ms INTEGER,
  
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

CREATE INDEX idx_ess_brand ON email_security_scans(brand_id);
CREATE INDEX idx_ess_domain ON email_security_scans(domain);
CREATE INDEX idx_ess_scanned ON email_security_scans(scanned_at);

-- Add email security score to brands table for quick access
ALTER TABLE brands ADD COLUMN email_security_score INTEGER DEFAULT NULL;
ALTER TABLE brands ADD COLUMN email_security_grade TEXT DEFAULT NULL;
ALTER TABLE brands ADD COLUMN email_security_scanned_at TEXT DEFAULT NULL;
```

---

## PHASE 2: DNS LOOKUP MODULE

Create a new module: `packages/trust-radar/src/email-security.ts`

Use **Cloudflare DoH** (DNS over HTTPS) — free, no API key, works from Workers:

```typescript
// DNS over HTTPS via Cloudflare
const DOH_URL = 'https://cloudflare-dns.com/dns-query';

interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DnsAnswer[];
}

async function dnsLookup(name: string, type: string = 'TXT'): Promise<string[]> {
  const url = `${DOH_URL}?name=${encodeURIComponent(name)}&type=${type}`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/dns-json' }
  });
  if (!resp.ok) return [];
  const data: DohResponse = await resp.json();
  if (data.Status !== 0 || !data.Answer) return [];
  return data.Answer
    .filter(a => a.type === (type === 'TXT' ? 16 : type === 'MX' ? 15 : 16))
    .map(a => a.data.replace(/"/g, ''));
}
```

### DMARC Check
```typescript
async function checkDmarc(domain: string) {
  const records = await dnsLookup(`_dmarc.${domain}`, 'TXT');
  const dmarcRecord = records.find(r => r.startsWith('v=DMARC1'));
  if (!dmarcRecord) return { exists: false, policy: null, pct: null, rua: null, ruf: null, raw: null };
  
  const policy = dmarcRecord.match(/;\s*p=(\w+)/)?.[1] || 'none';
  const pct = parseInt(dmarcRecord.match(/;\s*pct=(\d+)/)?.[1] || '100');
  const rua = dmarcRecord.match(/;\s*rua=([^;]+)/)?.[1] || null;
  const ruf = dmarcRecord.match(/;\s*ruf=([^;]+)/)?.[1] || null;
  
  return { exists: true, policy, pct, rua, ruf, raw: dmarcRecord };
}
```

### SPF Check
```typescript
async function checkSpf(domain: string) {
  const records = await dnsLookup(domain, 'TXT');
  const spfRecord = records.find(r => r.startsWith('v=spf1'));
  if (!spfRecord) return { exists: false, policy: null, includes: 0, tooManyLookups: false, raw: null };
  
  // Extract the all mechanism
  const allMatch = spfRecord.match(/([~\-+?])all/);
  const policy = allMatch ? `${allMatch[1]}all` : null;
  
  // Count include directives (each costs a DNS lookup)
  const includes = (spfRecord.match(/include:/g) || []).length;
  const redirects = (spfRecord.match(/redirect=/g) || []).length;
  const aRecords = (spfRecord.match(/\ba\b/g) || []).length;
  const mxRecords = (spfRecord.match(/\bmx\b/g) || []).length;
  const totalLookups = includes + redirects + aRecords + mxRecords;
  
  return { exists: true, policy, includes, tooManyLookups: totalLookups > 10, raw: spfRecord };
}
```

### DKIM Check
Check common selectors. We can't enumerate all selectors (DNS doesn't allow wildcard queries), but we check the most common ones:

```typescript
const COMMON_DKIM_SELECTORS = [
  'google', 'default', 'selector1', 'selector2',    // Google, generic, Microsoft
  'k1', 'k2', 'k3',                                  // Mailchimp
  'smtp', 'mail', 'email',                            // Generic
  'dkim', 's1', 's2',                                 // Generic
  'mandrill', 'amazonses', 'cm',                      // Mandrill, SES, Campaign Monitor
  'proofpoint', 'pp', 'pphosted',                     // Proofpoint  
  'mimecast', 'mimecast20190104',                     // Mimecast
  'everlytickey1', 'turbo-smtp',                      // Others
  'zendesk1', 'zendesk2'                              // Zendesk
];

async function checkDkim(domain: string) {
  const found: string[] = [];
  // Check in parallel batches of 5 to avoid hammering DNS
  for (let i = 0; i < COMMON_DKIM_SELECTORS.length; i += 5) {
    const batch = COMMON_DKIM_SELECTORS.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (selector) => {
        const records = await dnsLookup(`${selector}._domainkey.${domain}`, 'TXT');
        const dkimRecord = records.find(r => r.includes('v=DKIM1') || r.includes('p='));
        return dkimRecord ? selector : null;
      })
    );
    found.push(...results.filter(Boolean) as string[]);
    if (found.length > 0 && i >= 10) break; // Found some, don't need to check all
  }
  
  return {
    exists: found.length > 0,
    selectorsFound: found,
    raw: found.length > 0 ? `Selectors: ${found.join(', ')}` : null
  };
}
```

### MX Check
```typescript
const MX_PROVIDERS: Record<string, string> = {
  'google.com': 'Google Workspace',
  'googlemail.com': 'Google Workspace',
  'outlook.com': 'Microsoft 365',
  'protection.outlook.com': 'Microsoft 365',
  'pphosted.com': 'Proofpoint',
  'mimecast.com': 'Mimecast',
  'barracudanetworks.com': 'Barracuda',
  'messagelabs.com': 'Symantec',
  'iphmx.com': 'Cisco',
  'fireeyecloud.com': 'FireEye/Trellix',
  'ess.barracuda.com': 'Barracuda',
  'secureserver.net': 'GoDaddy',
  'zoho.com': 'Zoho',
  'mx.cloudflare.net': 'Cloudflare'
};

async function checkMx(domain: string) {
  const records = await dnsLookup(domain, 'MX');
  if (!records.length) return { exists: false, providers: [] };
  
  const providers: string[] = [];
  for (const record of records) {
    const mxHost = record.split(/\s+/).pop()?.toLowerCase() || '';
    for (const [pattern, provider] of Object.entries(MX_PROVIDERS)) {
      if (mxHost.includes(pattern) && !providers.includes(provider)) {
        providers.push(provider);
      }
    }
  }
  
  return { exists: true, providers };
}
```

---

## PHASE 3: SCORING ENGINE

### Email Security Score (0-100)

```typescript
function calculateEmailSecurityScore(scan: {
  dmarc: { exists: boolean; policy: string | null; rua: string | null };
  spf: { exists: boolean; policy: string | null; tooManyLookups: boolean };
  dkim: { exists: boolean };
  mx: { exists: boolean };
}): { score: number; grade: string } {
  let score = 0;
  
  // DMARC (40 points max)
  if (scan.dmarc.exists) {
    score += 10; // Has DMARC record
    if (scan.dmarc.policy === 'reject') score += 20;
    else if (scan.dmarc.policy === 'quarantine') score += 12;
    else if (scan.dmarc.policy === 'none') score += 4;
    if (scan.dmarc.rua) score += 5;  // Has aggregate reporting
    // Bonus: reporting to Trust Radar
    if (scan.dmarc.rua?.includes('trustradar.ca')) score += 5;
  }
  
  // SPF (30 points max)
  if (scan.spf.exists) {
    score += 10; // Has SPF record
    if (scan.spf.policy === '-all') score += 15;       // Hard fail
    else if (scan.spf.policy === '~all') score += 10;  // Soft fail
    else if (scan.spf.policy === '?all') score += 3;   // Neutral
    // Deduction for too many lookups
    if (!scan.spf.tooManyLookups) score += 5;
  }
  
  // DKIM (20 points max)
  if (scan.dkim.exists) {
    score += 20; // Found at least one DKIM selector
  }
  
  // MX (10 points max)
  if (scan.mx.exists) {
    score += 10;
  }
  
  // Cap at 100
  score = Math.min(score, 100);
  
  // Grade
  let grade: string;
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';
  
  return { score, grade };
}
```

### Integration with Brand Trust Score

The existing trust score should incorporate email security posture. In the trust scoring logic, add email_security_score as a weighted component:

```
Overall Trust Score = 
  (existing_threat_score * 0.70) +     // Threat intelligence (current weight, reduce from 1.0)
  (email_security_score * 0.30)         // Email posture (NEW)
```

When calculating brand severity/risk, a brand with DMARC p=none and no DKIM is MORE vulnerable to impersonation — their threat severity should be weighted UP.

---

## PHASE 4: API ENDPOINTS

### Worker Routes (add to router)

```
GET  /api/email-security/:brandId          → Get latest scan for a brand
POST /api/email-security/scan/:brandId     → Trigger manual scan for a brand
GET  /api/email-security/scan-all          → Trigger scan of all monitored brands (admin)
GET  /api/v1/public/email-security/:domain → Public endpoint for website visitors
GET  /api/email-security/stats             → Aggregate stats (grades distribution, etc.)
```

### Public Endpoint (Critical — this is the public website integration)
When someone enters a domain on the public site, scan it live:

```typescript
// GET /api/v1/public/email-security/:domain
async function handlePublicEmailSecurityScan(domain: string, env: Env) {
  const startTime = Date.now();
  
  // Clean domain
  domain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  
  // Check cache first (KV, 1 hour TTL)
  const cacheKey = `email-sec:${domain}`;
  const cached = await env.CACHE.get(cacheKey, 'json');
  if (cached) return cached;
  
  // Run all checks in parallel
  const [dmarc, spf, dkim, mx] = await Promise.all([
    checkDmarc(domain),
    checkSpf(domain),
    checkDkim(domain),
    checkMx(domain)
  ]);
  
  const { score, grade } = calculateEmailSecurityScore({ dmarc, spf, dkim, mx });
  
  const result = {
    domain,
    score,
    grade,
    dmarc: {
      exists: dmarc.exists,
      policy: dmarc.policy,
      reporting_enabled: !!dmarc.rua,
      record: dmarc.raw
    },
    spf: {
      exists: spf.exists,
      policy: spf.policy,
      too_many_lookups: spf.tooManyLookups,
      record: spf.raw
    },
    dkim: {
      exists: dkim.exists,
      selectors_found: dkim.selectorsFound
    },
    mx: {
      exists: mx.exists,
      providers: mx.providers
    },
    recommendations: generateRecommendations({ dmarc, spf, dkim, mx }),
    scanned_at: new Date().toISOString(),
    scan_duration_ms: Date.now() - startTime
  };
  
  // Cache for 1 hour
  await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 });
  
  // If domain matches a monitored brand, save to DB
  const brand = await env.DB.prepare(
    'SELECT id FROM brands WHERE domain = ? AND status = ?'
  ).bind(domain, 'active').first();
  
  if (brand) {
    await saveEmailSecurityScan(env.DB, brand.id as number, result);
  }
  
  return result;
}
```

### Recommendations Generator
```typescript
function generateRecommendations(scan: any): string[] {
  const recs: string[] = [];
  
  if (!scan.dmarc.exists) {
    recs.push('CRITICAL: No DMARC record found. Anyone can send emails pretending to be your domain.');
  } else if (scan.dmarc.policy === 'none') {
    recs.push('WARNING: DMARC policy is set to "none" — spoofed emails are not being blocked. Upgrade to "quarantine" or "reject".');
  } else if (scan.dmarc.policy === 'quarantine') {
    recs.push('GOOD: DMARC quarantine is active. Consider upgrading to "reject" for full protection.');
  }
  if (scan.dmarc.exists && !scan.dmarc.rua) {
    recs.push('No DMARC aggregate reporting configured. You have no visibility into who is sending email as your domain.');
  }
  
  if (!scan.spf.exists) {
    recs.push('CRITICAL: No SPF record found. Email receivers cannot verify your authorized mail servers.');
  } else if (scan.spf.policy === '~all' || scan.spf.policy === '?all') {
    recs.push('SPF soft-fail detected. Upgrade to "-all" (hard fail) for stronger protection.');
  }
  if (scan.spf.tooManyLookups) {
    recs.push('SPF record exceeds 10 DNS lookups — this causes SPF validation failures.');
  }
  
  if (!scan.dkim.exists) {
    recs.push('No DKIM signing detected. Email recipients cannot verify message integrity.');
  }
  
  if (!scan.mx.exists) {
    recs.push('No MX records found. This domain may not be configured to receive email.');
  }
  
  if (recs.length === 0) {
    recs.push('Excellent! This domain has strong email authentication configured.');
  }
  
  return recs;
}
```

---

## PHASE 5: CRON-BASED SCANNING (Agent Integration)

Add email security scanning to the **Cartographer agent** (runs every 6 hours). Scan 50 brands per cycle (to stay within DNS rate limits):

```typescript
// In the cron handler, add:
if (trigger === 'cartographer' || minuteOfDay % 360 === 0) {
  // ... existing geo enrichment ...
  
  // Email security scans — 50 brands per cycle, oldest scans first
  const brandsToScan = await env.DB.prepare(`
    SELECT b.id, b.domain 
    FROM brands b 
    WHERE b.status = 'active' 
      AND b.domain IS NOT NULL
      AND (b.email_security_scanned_at IS NULL 
           OR b.email_security_scanned_at < datetime('now', '-7 days'))
    ORDER BY b.email_security_scanned_at ASC NULLS FIRST
    LIMIT 50
  `).all();
  
  for (const brand of brandsToScan.results) {
    try {
      const [dmarc, spf, dkim, mx] = await Promise.all([
        checkDmarc(brand.domain),
        checkSpf(brand.domain),
        checkDkim(brand.domain),
        checkMx(brand.domain)
      ]);
      const { score, grade } = calculateEmailSecurityScore({ dmarc, spf, dkim, mx });
      
      // Save scan result
      await saveEmailSecurityScan(env.DB, brand.id, { domain: brand.domain, score, grade, dmarc, spf, dkim, mx });
      
      // Update brand record
      await env.DB.prepare(`
        UPDATE brands SET email_security_score = ?, email_security_grade = ?, email_security_scanned_at = datetime('now')
        WHERE id = ?
      `).bind(score, grade, brand.id).run();
      
    } catch (e) {
      console.error(`Email security scan failed for ${brand.domain}:`, e);
    }
  }
}
```

At 50 brands per 6-hour cycle = ~200 brands/day. All 519 brands scanned within 3 days. Re-scans every 7 days.

---

## PHASE 6: FRONTEND — BRAND DETAIL PAGE

Add an "Email Security" section to the brand detail page. This should appear between the threat overview and the campaigns section.

### Email Security Card (Brand Detail Page)

```javascript
// In the brand detail page renderer, add this section:
function renderEmailSecurityCard(emailSecurity) {
  if (!emailSecurity) return `
    <div class="card email-security-card">
      <div class="card-header">
        <h3>📧 Email Security Posture</h3>
        <button class="btn btn-sm btn-primary" onclick="scanEmailSecurity('${brandId}')">Scan Now</button>
      </div>
      <div class="card-body">
        <p class="text-muted">No email security scan available. Click "Scan Now" to check this domain's email authentication.</p>
      </div>
    </div>`;
  
  const es = emailSecurity;
  const gradeColor = {
    'A+': '#00ff88', 'A': '#00dd66', 'B': '#ffcc00', 'C': '#ff8800', 'D': '#ff4444', 'F': '#ff0000'
  }[es.grade] || '#666';
  
  return `
    <div class="card email-security-card">
      <div class="card-header">
        <h3>📧 Email Security Posture</h3>
        <span class="email-grade" style="background: ${gradeColor}; color: #000; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 18px;">${es.grade}</span>
      </div>
      <div class="card-body">
        <!-- Score bar -->
        <div class="email-score-bar">
          <div class="score-label">Email Security Score</div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${es.score}%; background: ${gradeColor};"></div>
          </div>
          <span class="score-value">${es.score}/100</span>
        </div>
        
        <!-- Protocol checks grid -->
        <div class="protocol-grid">
          <div class="protocol-check ${es.dmarc.exists ? 'pass' : 'fail'}">
            <div class="protocol-icon">${es.dmarc.exists ? '✅' : '❌'}</div>
            <div class="protocol-name">DMARC</div>
            <div class="protocol-detail">${es.dmarc.exists ? `Policy: ${es.dmarc.policy}` : 'Not configured'}</div>
          </div>
          <div class="protocol-check ${es.spf.exists ? 'pass' : 'fail'}">
            <div class="protocol-icon">${es.spf.exists ? '✅' : '❌'}</div>
            <div class="protocol-name">SPF</div>
            <div class="protocol-detail">${es.spf.exists ? es.spf.policy : 'Not configured'}</div>
          </div>
          <div class="protocol-check ${es.dkim.exists ? 'pass' : 'fail'}">
            <div class="protocol-icon">${es.dkim.exists ? '✅' : '❌'}</div>
            <div class="protocol-name">DKIM</div>
            <div class="protocol-detail">${es.dkim.exists ? `${es.dkim.selectors_found?.length || 0} selector(s)` : 'Not detected'}</div>
          </div>
          <div class="protocol-check ${es.mx.exists ? 'pass' : 'fail'}">
            <div class="protocol-icon">${es.mx.exists ? '✅' : '❌'}</div>
            <div class="protocol-name">MX</div>
            <div class="protocol-detail">${es.mx.exists ? (es.mx.providers?.join(', ') || 'Active') : 'No mail servers'}</div>
          </div>
        </div>
        
        <!-- Recommendations -->
        ${es.recommendations?.length ? `
          <div class="email-recommendations">
            <h4>Recommendations</h4>
            ${es.recommendations.map(r => {
              const icon = r.startsWith('CRITICAL') ? '🔴' : r.startsWith('WARNING') ? '🟡' : r.startsWith('GOOD') ? '🟢' : r.startsWith('Excellent') ? '🏆' : '💡';
              return `<div class="recommendation-item">${icon} ${r}</div>`;
            }).join('')}
          </div>
        ` : ''}
        
        <!-- CTA: Add Trust Radar as DMARC report receiver -->
        ${es.dmarc.exists && !es.dmarc.reporting_enabled ? `
          <div class="email-cta">
            <strong>Want visibility into who's spoofing this domain?</strong><br>
            Add <code>rua=mailto:reports@trustradar.ca</code> to the DMARC record to receive aggregate reports through Trust Radar.
          </div>
        ` : ''}
        ${es.dmarc.exists && es.dmarc.reporting_enabled && !es.dmarc.record?.includes('trustradar.ca') ? `
          <div class="email-cta">
            <strong>Send DMARC reports to Trust Radar</strong><br>
            Add <code>mailto:reports@trustradar.ca</code> to the <code>rua</code> tag to get spoofing intelligence in this dashboard.
          </div>
        ` : ''}
        
        <div class="scan-meta">Last scanned: ${new Date(es.scanned_at).toLocaleString()}</div>
      </div>
    </div>`;
}
```

---

## PHASE 7: FRONTEND — PUBLIC WEBSITE

On the public website's Brand Assessment section, after the existing domain scan results, add the email security results.

When a visitor enters a domain on the public site:
1. Existing flow: calls `/api/v1/public/assess/:domain` → shows threat data
2. **NEW**: also calls `/api/v1/public/email-security/:domain` → shows email posture

### Public Site Email Security Display

```javascript
// After the existing assessment results, add:
async function showEmailSecurity(domain) {
  const resp = await fetch(`/api/v1/public/email-security/${domain}`);
  const data = await resp.json();
  
  // Show grade badge prominently
  // Show the 4 protocol checks (DMARC/SPF/DKIM/MX) as a visual grid
  // Show recommendations
  // Show CTA: "Want to protect this domain? Sign up for monitoring"
  // If email_security_score < 50: "⚠️ This domain is highly vulnerable to email impersonation"
}
```

The public page should show a combined score card:
```
┌──────────────────────────────────────────────┐
│  example.com                                  │
│  ┌─────────┐  ┌─────────┐                    │
│  │ Threat  │  │ Email   │                    │
│  │ Score   │  │ Security│                    │
│  │  72/100 │  │  45/100 │                    │
│  │    B    │  │    D    │                    │
│  └─────────┘  └─────────┘                    │
│                                               │
│  DMARC: ❌ None  SPF: ✅ ~all                │
│  DKIM: ❌ None   MX: ✅ Google               │
│                                               │
│  ⚠️ This domain has weak email security.     │
│  Anyone could send emails pretending to be    │
│  example.com.                                 │
│                                               │
│  🔴 No DMARC — spoofed emails not blocked    │
│  🟡 SPF soft-fail — upgrade to hard fail     │
│  🔴 No DKIM — message integrity not verified │
│                                               │
│  [Monitor This Domain] [Full Report]          │
└──────────────────────────────────────────────┘
```

---

## PHASE 8: PDF REPORT INTEGRATION

In the PDF report (route `/report/:brandId`), add an "Email Security Posture" page between the existing sections. Include:

1. Grade badge (large, colored)
2. Score bar
3. Protocol status table (DMARC/SPF/DKIM/MX — status, detail, raw record)
4. Recommendations list
5. If DMARC p=none or missing: big callout about spoofing risk

---

## PHASE 9: ADMIN DASHBOARD

Add to the admin dashboard:

1. **Email Security Stats card**: Grade distribution chart (how many brands at each grade)
2. **"Scan All Brands" button**: Triggers `/api/email-security/scan-all` 
3. **Worst-protected brands list**: Bottom 10 brands by email security score
4. **DMARC adoption pie chart**: reject vs quarantine vs none vs missing

---

## PHASE 10: STYLES

Add CSS for the email security components. Follow existing design system (navy/cyan, JetBrains Mono for data, Inter for text). Key classes:

```css
.email-security-card { /* follows existing .card pattern */ }
.protocol-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
.protocol-check { text-align: center; padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); }
.protocol-check.pass { border: 1px solid rgba(0,255,136,0.3); }
.protocol-check.fail { border: 1px solid rgba(255,68,68,0.3); }
.protocol-icon { font-size: 24px; margin-bottom: 4px; }
.protocol-name { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 13px; }
.protocol-detail { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }
.email-score-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.progress-bar-bg { flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; }
.progress-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.email-recommendations { margin-top: 16px; }
.recommendation-item { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
.email-cta { background: rgba(0,200,255,0.08); border: 1px solid rgba(0,200,255,0.2); border-radius: 8px; padding: 12px 16px; margin-top: 16px; font-size: 13px; }
.email-cta code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; }
.email-grade { font-family: 'JetBrains Mono', monospace; }
/* Mobile: protocol grid becomes 2x2 */
@media (max-width: 768px) {
  .protocol-grid { grid-template-columns: repeat(2, 1fr); }
}
```

---

## CRITICAL IMPLEMENTATION NOTES

1. **DNS Rate Limiting**: Cloudflare DoH has no hard rate limit for Workers, but be respectful. Batch DKIM selector checks, limit to 50 brands per scan cycle.

2. **No external dependencies**: All DNS queries via `fetch()` to Cloudflare DoH. No npm packages needed.

3. **Don't touch existing code unnecessarily**: The frontend is ~4000 lines. Add new functions, don't refactor existing ones. Find the brand detail page renderer and add the email security card in the right spot.

4. **Cache aggressively**: KV cache public scans for 1 hour. Brand scans in D1 refresh every 7 days.

5. **The public endpoint is the money feature**: This is what makes people sign up. Make it fast (<2 seconds), informative, and scary if their email security is bad.

6. **DKIM is best-effort**: We check ~20 common selectors. We'll never find all of them. Make this clear in the UI: "Checked 20 common selectors" with a note that custom selectors may exist.

7. **Trust Score integration**: The email security score should factor into the brand's overall trust/risk assessment. A brand with F email security and active phishing threats targeting it = CRITICAL risk.

---

## BUILD ORDER
1. Schema migration SQL (generate and document — I'll run in D1 Console)
2. `email-security.ts` module (DNS lookups + scoring)
3. API endpoints in worker
4. Brand detail page UI
5. Public website integration
6. PDF report page
7. Admin dashboard stats
8. Cron integration (Cartographer agent)

## COST
$0.00 — all DNS lookups via free Cloudflare DoH. No new API keys or services.

## ESTIMATED LINES
- Worker: ~400 lines new code
- Frontend: ~300 lines new code
- CSS: ~60 lines
- Total: ~760 lines
