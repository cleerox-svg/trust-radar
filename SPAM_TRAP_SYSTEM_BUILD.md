# SPAM TRAP INTELLIGENCE SYSTEM — Claude Code Build Prompt

## CONTEXT
Trust Radar (lrxradar.com / trustradar.ca) is a threat intelligence platform built as a Cloudflare Worker SPA with D1 SQLite. We monitor 520+ brands for phishing, typosquatting, malware across 17 feeds. We have 5 AI agents (Sentinel, Analyst, Cartographer, Strategist, Observer) running on Claude Haiku. We just shipped an Email Security Posture Engine and DMARC Report Receiver.

This build adds a **Spam Trap Intelligence System** — a honeypot email network across two domains that catches live phishing emails, extracts authentication signals and IOCs, and propagates the data across the entire platform. This is Trust Radar's first proprietary data source — data nobody else has.

**Domains**: 
- `trustradar.ca` — Cloudflare Email Routing already enabled, catch-all route `*@trustradar.ca` → Worker needed
- `lrxradar.com` — Cloudflare Email Routing will be enabled manually, catch-all route `*@lrxradar.com` → Worker needed

**Tech stack**: Cloudflare Workers (TypeScript), D1 SQLite (`trust-radar-v2`), KV (`trust-radar-cache`), Claude Haiku API (env.ANTHROPIC_API_KEY)
**Repo**: `packages/trust-radar/`
**Existing Worker**: `packages/trust-radar/src/index.ts` (already has `fetch`, `email`, `scheduled` handlers)
**Frontend**: `packages/trust-radar/public/app.js` (~5000 lines) and `styles.css`
**Existing email handler**: Already processes DMARC reports for `dmarc_rua@trustradar.ca`

---

## PHASE 1: DATABASE SCHEMA

Generate migration SQL. I will run this in D1 Console manually.

```sql
-- Migration: 0022_spam_trap_system.sql

-- ============================================
-- SPAM TRAP CAPTURES
-- ============================================

-- Every email caught by the spam trap
CREATE TABLE IF NOT EXISTS spam_trap_captures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Trap identification
  trap_address TEXT NOT NULL,              -- which address caught it (e.g., apple-billing@trustradar.ca)
  trap_domain TEXT NOT NULL,               -- trustradar.ca or lrxradar.com
  trap_channel TEXT,                       -- generic/brand/spider/paste/honeypot
  trap_campaign_id INTEGER,                -- linked seed campaign if known
  
  -- Sender info
  from_address TEXT,                       -- From: header
  from_domain TEXT,                        -- extracted domain from From:
  reply_to TEXT,                           -- Reply-To: header
  return_path TEXT,                        -- Return-Path: header
  helo_hostname TEXT,                      -- HELO/EHLO from Received headers
  subject TEXT,                            -- Subject line
  
  -- Authentication results (parsed from Authentication-Results header)
  spf_result TEXT,                         -- pass/fail/softfail/none
  spf_domain TEXT,                         -- domain checked for SPF
  dkim_result TEXT,                        -- pass/fail/none
  dkim_domain TEXT,                        -- domain in DKIM signature
  dmarc_result TEXT,                       -- pass/fail/none
  dmarc_disposition TEXT,                  -- none/quarantine/reject
  
  -- Sending infrastructure
  sending_ip TEXT,                         -- source IP from headers
  x_mailer TEXT,                           -- X-Mailer header (phishing toolkit ID)
  
  -- Extracted IOCs
  urls_found TEXT,                         -- JSON array of URLs in body
  url_count INTEGER DEFAULT 0,
  attachment_hashes TEXT,                  -- JSON array: [{filename, sha256, size, content_type}]
  attachment_count INTEGER DEFAULT 0,
  
  -- Brand matching
  spoofed_brand_id TEXT,                   -- matched brand being impersonated
  spoofed_domain TEXT,                     -- domain being spoofed (from From: header)
  brand_match_method TEXT,                 -- from_header/reply_to/subject/url
  brand_confidence INTEGER DEFAULT 50,     -- 0-100 confidence of brand match
  
  -- Classification
  category TEXT DEFAULT 'phishing',        -- phishing/spam/malware/scam/bec
  severity TEXT DEFAULT 'medium',          -- critical/high/medium/low
  
  -- Geo (enriched later)
  country_code TEXT,
  city TEXT,
  lat REAL,
  lng REAL,
  asn TEXT,
  org TEXT,
  
  -- Linked records
  threat_id TEXT,                          -- created threat record ID
  campaign_id TEXT,                        -- linked campaign if correlated
  
  -- Metadata
  raw_headers TEXT,                        -- full email headers
  body_preview TEXT,                       -- first 500 chars of body (no attachments)
  captured_at TEXT DEFAULT (datetime('now')),
  processed INTEGER DEFAULT 0             -- 0=pending, 1=processed, -1=error
);

CREATE INDEX IF NOT EXISTS idx_stc_trap ON spam_trap_captures(trap_address);
CREATE INDEX IF NOT EXISTS idx_stc_domain ON spam_trap_captures(from_domain);
CREATE INDEX IF NOT EXISTS idx_stc_brand ON spam_trap_captures(spoofed_brand_id);
CREATE INDEX IF NOT EXISTS idx_stc_ip ON spam_trap_captures(sending_ip);
CREATE INDEX IF NOT EXISTS idx_stc_captured ON spam_trap_captures(captured_at);
CREATE INDEX IF NOT EXISTS idx_stc_category ON spam_trap_captures(category);
CREATE INDEX IF NOT EXISTS idx_stc_channel ON spam_trap_captures(trap_channel);

-- ============================================
-- SEED CAMPAIGNS
-- ============================================

-- Tracks seeding campaigns and their performance
CREATE TABLE IF NOT EXISTS seed_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                      -- "Amazon paste seed March 2026"
  channel TEXT NOT NULL,                   -- paste/spider/honeypot/manual
  status TEXT DEFAULT 'active',            -- active/paused/completed/failed
  target_brands TEXT,                      -- JSON array of brand IDs targeted
  
  -- Configuration
  config TEXT,                             -- JSON: channel-specific config (paste URL, page path, etc.)
  addresses_seeded INTEGER DEFAULT 0,      -- how many addresses were deployed
  
  -- Performance
  total_catches INTEGER DEFAULT 0,
  unique_ips_caught INTEGER DEFAULT 0,
  brands_spoofed INTEGER DEFAULT 0,
  last_catch_at TEXT,
  
  -- AI strategist
  created_by TEXT DEFAULT 'manual',        -- manual/strategist_agent
  strategist_notes TEXT,                   -- AI reasoning for creating this campaign
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sc_status ON seed_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_sc_channel ON seed_campaigns(channel);

-- ============================================
-- SEED ADDRESSES
-- ============================================

-- Individual trap addresses and their metadata
CREATE TABLE IF NOT EXISTS seed_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL UNIQUE,            -- full email address
  domain TEXT NOT NULL,                    -- trustradar.ca or lrxradar.com
  channel TEXT NOT NULL,                   -- generic/brand/spider/paste/honeypot/employee
  campaign_id INTEGER,                     -- linked seed campaign
  brand_target TEXT,                       -- brand ID this address targets (for brand traps)
  
  -- Tracking
  seeded_at TEXT DEFAULT (datetime('now')),
  seeded_location TEXT,                    -- URL/site where address was placed
  total_catches INTEGER DEFAULT 0,
  last_catch_at TEXT,
  
  -- Status
  status TEXT DEFAULT 'active',            -- active/retired/burned
  
  FOREIGN KEY (campaign_id) REFERENCES seed_campaigns(id)
);

CREATE INDEX IF NOT EXISTS idx_sa_address ON seed_addresses(address);
CREATE INDEX IF NOT EXISTS idx_sa_channel ON seed_addresses(channel);
CREATE INDEX IF NOT EXISTS idx_sa_brand ON seed_addresses(brand_target);
CREATE INDEX IF NOT EXISTS idx_sa_status ON seed_addresses(status);

-- ============================================
-- SPAM TRAP DAILY STATS
-- ============================================

CREATE TABLE IF NOT EXISTS spam_trap_daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  total_captures INTEGER DEFAULT 0,
  phishing_count INTEGER DEFAULT 0,
  spam_count INTEGER DEFAULT 0,
  malware_count INTEGER DEFAULT 0,
  unique_ips INTEGER DEFAULT 0,
  unique_brands_spoofed INTEGER DEFAULT 0,
  auth_fail_rate REAL DEFAULT 0,           -- % of captures with SPF/DKIM/DMARC fail
  top_spoofed_brands TEXT,                 -- JSON array
  top_source_countries TEXT,               -- JSON array
  new_urls_discovered INTEGER DEFAULT 0,
  new_threats_created INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stds_date ON spam_trap_daily_stats(date);
```

---

## PHASE 2: SPAM TRAP EMAIL RECEIVER

### Modify existing email handler

The existing `email` handler in `src/index.ts` currently routes to the DMARC receiver for `dmarc_rua@trustradar.ca`. Update it to also handle spam trap emails:

```typescript
async email(message, env, ctx) {
  const to = message.to;
  
  // Route DMARC reports to existing handler
  if (to === 'dmarc_rua@trustradar.ca') {
    ctx.waitUntil(handleDmarcEmail(message, env));
    return;
  }
  
  // Everything else goes to spam trap
  ctx.waitUntil(handleSpamTrapEmail(message, env));
}
```

### Create `src/spam-trap.ts`

This module processes every non-DMARC email that arrives at either domain.

```typescript
export async function handleSpamTrapEmail(message: EmailMessage, env: Env) {
  const startTime = Date.now();
  const to = message.to;
  const from = message.from;
  const subject = message.headers.get('subject') || '';
  
  console.log(`[SpamTrap] Captured: to=${to} from=${from} subject="${subject.substring(0, 80)}"`);
  
  // Parse trap address metadata
  const trapInfo = parseTrapAddress(to);
  
  // Read raw email
  const rawEmail = await streamToArrayBuffer(message.raw);
  const rawText = new TextDecoder().decode(rawEmail);
  
  // Extract headers
  const headers = extractHeaders(rawText);
  
  // Parse Authentication-Results
  const authResults = parseAuthenticationResults(headers['authentication-results'] || '');
  
  // Extract sending IP from Received headers
  const sendingIp = extractSendingIp(headers);
  
  // Extract From domain
  const fromDomain = extractDomain(from);
  
  // Extract URLs from body
  const body = extractBody(rawText);
  const urls = extractUrls(body);
  
  // Extract attachment info (hashes, filenames)
  const attachments = extractAttachmentInfo(rawEmail);
  
  // Match to a monitored brand
  const brandMatch = await matchBrand(from, subject, urls, headers['reply-to'] || '', env);
  
  // Classify the email
  const classification = classifyEmail(authResults, urls, attachments, brandMatch);
  
  // Calculate severity
  const severity = calculateSeverity(authResults, brandMatch, urls.length, attachments.length);
  
  // Store the capture
  const captureId = await env.DB.prepare(`
    INSERT INTO spam_trap_captures (
      trap_address, trap_domain, trap_channel, trap_campaign_id,
      from_address, from_domain, reply_to, return_path, helo_hostname, subject,
      spf_result, spf_domain, dkim_result, dkim_domain, dmarc_result, dmarc_disposition,
      sending_ip, x_mailer,
      urls_found, url_count, attachment_hashes, attachment_count,
      spoofed_brand_id, spoofed_domain, brand_match_method, brand_confidence,
      category, severity,
      raw_headers, body_preview
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    to, trapInfo.domain, trapInfo.channel, trapInfo.campaignId,
    from, fromDomain, headers['reply-to'] || null, headers['return-path'] || null,
    extractHeloHostname(headers), subject.substring(0, 500),
    authResults.spf, authResults.spfDomain, authResults.dkim, authResults.dkimDomain,
    authResults.dmarc, authResults.dmarcDisposition,
    sendingIp, headers['x-mailer'] || null,
    JSON.stringify(urls.slice(0, 50)), urls.length,
    JSON.stringify(attachments.slice(0, 10)), attachments.length,
    brandMatch?.brandId || null, brandMatch?.spoofedDomain || fromDomain,
    brandMatch?.method || null, brandMatch?.confidence || 0,
    classification.category, severity,
    truncateHeaders(rawText, 5000), body.substring(0, 500)
  ).run();
  
  // Update seed address catch count
  await env.DB.prepare(`
    UPDATE seed_addresses SET total_catches = total_catches + 1, last_catch_at = datetime('now')
    WHERE address = ?
  `).bind(to).run();
  
  // Update seed campaign catch count
  if (trapInfo.campaignId) {
    await env.DB.prepare(`
      UPDATE seed_campaigns SET total_catches = total_catches + 1, last_catch_at = datetime('now')
      WHERE id = ?
    `).bind(trapInfo.campaignId).run();
  }
  
  // Create threat record if this looks like phishing/malware
  if (classification.category === 'phishing' || classification.category === 'malware') {
    const threatId = await createThreatFromCapture(env, {
      fromDomain, sendingIp, urls, brandMatch, classification, severity, subject
    });
    
    if (threatId) {
      await env.DB.prepare(
        'UPDATE spam_trap_captures SET threat_id = ?, processed = 1 WHERE id = ?'
      ).bind(threatId, captureId).run();
    }
  }
  
  // Fire notification if a monitored brand was spoofed
  if (brandMatch?.brandId) {
    await env.DB.prepare(`
      INSERT INTO notifications (type, title, message, severity, brand_id, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      'spam_trap_capture',
      `Spam trap: ${brandMatch.spoofedDomain} spoofed`,
      `Caught email from ${from} impersonating ${brandMatch.spoofedDomain}. Subject: "${subject.substring(0, 100)}". Auth: SPF=${authResults.spf}, DKIM=${authResults.dkim}, DMARC=${authResults.dmarc}`,
      severity,
      brandMatch.brandId
    ).run();
  }
  
  console.log(`[SpamTrap] Processed in ${Date.now() - startTime}ms: brand=${brandMatch?.spoofedDomain || 'unknown'} category=${classification.category} severity=${severity}`);
}
```

### Trap Address Parser

Every trap address encodes metadata about its origin:

```typescript
interface TrapInfo {
  domain: string;       // trustradar.ca or lrxradar.com
  channel: string;      // generic/brand/spider/paste/honeypot/employee
  campaignId: number | null;
  brandTarget: string | null;
}

function parseTrapAddress(address: string): TrapInfo {
  const [local, domain] = address.split('@');
  
  // Brand traps: apple-support@trustradar.ca, amazon-billing@trustradar.ca
  const brandTrapMatch = local.match(/^([\w]+)-(support|billing|account|verify|security|id|help|sign)$/);
  if (brandTrapMatch) {
    return { domain, channel: 'brand', campaignId: null, brandTarget: brandTrapMatch[1] };
  }
  
  // Spider traps: spider-pub-footer-0318@lrxradar.com
  if (local.startsWith('spider-')) {
    return { domain, channel: 'spider', campaignId: null, brandTarget: null };
  }
  
  // Paste traps: paste-c012-amz-0318@lrxradar.com
  const pasteMatch = local.match(/^paste-c(\d+)/);
  if (pasteMatch) {
    return { domain, channel: 'paste', campaignId: parseInt(pasteMatch[1]), brandTarget: null };
  }
  
  // Honeypot traps: honey-team-003@lrxradar.com
  if (local.startsWith('honey-')) {
    return { domain, channel: 'honeypot', campaignId: null, brandTarget: null };
  }
  
  // Employee traps: james.wilson@lrxradar.com, ceo@lrxradar.com
  if (local.includes('.') || ['ceo','cfo','cto','hr','finance'].includes(local)) {
    return { domain, channel: 'employee', campaignId: null, brandTarget: null };
  }
  
  // Generic traps: admin@, info@, support@, etc.
  return { domain, channel: 'generic', campaignId: null, brandTarget: null };
}
```

### Authentication-Results Parser

```typescript
interface AuthResults {
  spf: string;          // pass/fail/softfail/none
  spfDomain: string;
  dkim: string;         // pass/fail/none
  dkimDomain: string;
  dmarc: string;        // pass/fail/none
  dmarcDisposition: string; // none/quarantine/reject
}

function parseAuthenticationResults(header: string): AuthResults {
  const result: AuthResults = {
    spf: 'none', spfDomain: '', dkim: 'none', dkimDomain: '',
    dmarc: 'none', dmarcDisposition: 'none'
  };
  
  if (!header) return result;
  
  // SPF
  const spfMatch = header.match(/spf=(\w+)/i);
  if (spfMatch) result.spf = spfMatch[1].toLowerCase();
  const spfDomainMatch = header.match(/spf=\w+[^;]*domain[:\s]+of\s+(\S+)/i) || 
                          header.match(/spf=\w+[^;]*\(.*?domain:?\s*(\S+)/i);
  if (spfDomainMatch) result.spfDomain = spfDomainMatch[1].replace(/[)]/g, '');
  
  // DKIM
  const dkimMatch = header.match(/dkim=(\w+)/i);
  if (dkimMatch) result.dkim = dkimMatch[1].toLowerCase();
  const dkimDomainMatch = header.match(/dkim=\w+[^;]*header\.[dis]=@?(\S+)/i);
  if (dkimDomainMatch) result.dkimDomain = dkimDomainMatch[1].replace(/[;)]/g, '');
  
  // DMARC
  const dmarcMatch = header.match(/dmarc=(\w+)/i);
  if (dmarcMatch) result.dmarc = dmarcMatch[1].toLowerCase();
  const dispMatch = header.match(/dmarc=\w+[^;]*dis=(\w+)/i) ||
                    header.match(/dmarc=\w+[^;]*\(.*?dis[=:](\w+)/i);
  if (dispMatch) result.dmarcDisposition = dispMatch[1].toLowerCase();
  
  return result;
}
```

### Brand Matching

```typescript
async function matchBrand(
  from: string, subject: string, urls: string[], replyTo: string, env: Env
): Promise<{brandId: string; spoofedDomain: string; method: string; confidence: number} | null> {
  
  const fromDomain = extractDomain(from);
  
  // Method 1: From domain matches a monitored brand's canonical_domain
  const directMatch = await env.DB.prepare(
    'SELECT id, name, canonical_domain FROM brands WHERE canonical_domain = ? LIMIT 1'
  ).bind(fromDomain).first();
  if (directMatch) {
    return { brandId: directMatch.id as string, spoofedDomain: fromDomain, method: 'from_header', confidence: 90 };
  }
  
  // Method 2: From domain contains a brand name (typosquat-style)
  // e.g., apple-id-verify.com contains "apple"
  const brands = await env.DB.prepare(
    'SELECT id, name, canonical_domain FROM brands WHERE threat_count > 0 ORDER BY threat_count DESC LIMIT 50'
  ).all();
  
  for (const brand of brands.results) {
    const name = (brand.name as string).toLowerCase();
    const domain = (brand.canonical_domain as string || '').toLowerCase();
    
    // Check From domain contains brand name
    if (name.length > 3 && fromDomain.includes(name)) {
      return { brandId: brand.id as string, spoofedDomain: domain, method: 'from_header', confidence: 75 };
    }
    
    // Check subject contains brand name
    if (name.length > 3 && subject.toLowerCase().includes(name)) {
      return { brandId: brand.id as string, spoofedDomain: domain, method: 'subject', confidence: 60 };
    }
    
    // Check Reply-To contains brand name
    if (name.length > 3 && replyTo.toLowerCase().includes(name)) {
      return { brandId: brand.id as string, spoofedDomain: domain, method: 'reply_to', confidence: 65 };
    }
    
    // Check URLs contain brand name
    for (const url of urls.slice(0, 10)) {
      if (name.length > 3 && url.toLowerCase().includes(name)) {
        return { brandId: brand.id as string, spoofedDomain: domain, method: 'url', confidence: 70 };
      }
    }
  }
  
  // Method 3: Trap address encodes brand target
  // This is handled by parseTrapAddress — caller should check trap_channel === 'brand'
  
  return null;
}
```

### Create Threat from Capture

When a phishing email is caught, create a real threat record that flows into the existing platform:

```typescript
async function createThreatFromCapture(env: Env, data: {
  fromDomain: string;
  sendingIp: string | null;
  urls: string[];
  brandMatch: any;
  classification: { category: string };
  severity: string;
  subject: string;
}): Promise<string | null> {
  
  // Use the first phishing URL as the primary IOC, or the from domain
  const primaryUrl = data.urls[0] || `https://${data.fromDomain}`;
  const threatId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Determine threat type
  let threatType = 'phishing';
  if (data.classification.category === 'malware') threatType = 'malware_distribution';
  if (data.subject.toLowerCase().includes('invoice') || data.subject.toLowerCase().includes('payment')) {
    threatType = 'credential_harvesting';
  }
  
  try {
    await env.DB.prepare(`
      INSERT INTO threats (id, source_feed, threat_type, malicious_url, malicious_domain,
        target_brand_id, ip_address, severity, confidence_score, ioc_value, status)
      VALUES (?, 'spam_trap', ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).bind(
      threatId, threatType, primaryUrl, data.fromDomain,
      data.brandMatch?.brandId || null, data.sendingIp || null,
      data.severity, data.brandMatch ? 85 : 60,
      data.fromDomain
    ).run();
    
    // Also create threat records for each unique phishing URL found
    for (const url of data.urls.slice(1, 5)) { // Max 5 additional URLs
      const urlThreatId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const urlDomain = extractDomain(url);
      await env.DB.prepare(`
        INSERT OR IGNORE INTO threats (id, source_feed, threat_type, malicious_url, malicious_domain,
          target_brand_id, ip_address, severity, confidence_score, ioc_value, status)
        VALUES (?, 'spam_trap', 'phishing', ?, ?, ?, ?, ?, 80, ?, 'active')
      `).bind(
        urlThreatId, url, urlDomain,
        data.brandMatch?.brandId || null, data.sendingIp || null,
        data.severity, urlDomain
      ).run();
    }
    
    // Update brand threat count
    if (data.brandMatch?.brandId) {
      await env.DB.prepare(
        'UPDATE brands SET threat_count = threat_count + 1, last_threat_seen = datetime(\'now\') WHERE id = ?'
      ).bind(data.brandMatch.brandId).run();
    }
    
    return threatId;
  } catch (e) {
    console.error('[SpamTrap] Failed to create threat:', e);
    return null;
  }
}
```

### Helper Functions

```typescript
function extractHeaders(rawText: string): Record<string, string> {
  const headerEnd = rawText.indexOf('\r\n\r\n');
  const headerSection = headerEnd > 0 ? rawText.substring(0, headerEnd) : rawText.substring(0, 5000);
  const headers: Record<string, string> = {};
  
  // Unfold continued headers (lines starting with whitespace)
  const unfolded = headerSection.replace(/\r\n(\s+)/g, ' ');
  const lines = unfolded.split('\r\n');
  
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const name = line.substring(0, colonIdx).trim().toLowerCase();
      const value = line.substring(colonIdx + 1).trim();
      headers[name] = value;
    }
  }
  return headers;
}

function extractSendingIp(headers: Record<string, string>): string | null {
  // Look at Received headers for the originating IP
  // The last Received header (first in chain) typically has the sender IP
  const received = headers['received'] || '';
  const ipMatch = received.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/);
  return ipMatch?.[1] || null;
}

function extractDomain(emailOrUrl: string): string {
  // Handle email addresses
  if (emailOrUrl.includes('@')) {
    return emailOrUrl.split('@').pop()?.toLowerCase().trim() || '';
  }
  // Handle URLs
  try {
    const url = emailOrUrl.startsWith('http') ? emailOrUrl : `https://${emailOrUrl}`;
    return new URL(url).hostname.toLowerCase();
  } catch {
    return emailOrUrl.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  }
}

function extractBody(rawText: string): string {
  const headerEnd = rawText.indexOf('\r\n\r\n');
  if (headerEnd < 0) return '';
  return rawText.substring(headerEnd + 4);
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  const matches = text.match(urlRegex) || [];
  // Deduplicate and limit
  return [...new Set(matches)].slice(0, 50);
}

function extractAttachmentInfo(raw: ArrayBuffer): Array<{filename: string; sha256: string; size: number; contentType: string}> {
  // Parse MIME boundaries and find attachments
  // For each attachment, compute SHA-256 hash
  const text = new TextDecoder().decode(raw);
  const attachments: Array<{filename: string; sha256: string; size: number; contentType: string}> = [];
  
  const boundaryMatch = text.match(/boundary="?([^"\r\n]+)"?/i);
  if (!boundaryMatch) return [];
  
  const parts = text.split(`--${boundaryMatch[1]}`);
  for (const part of parts) {
    const fnMatch = part.match(/filename="?([^"\r\n]+)"?/i);
    const ctMatch = part.match(/Content-Type:\s*([^\r\n;]+)/i);
    if (fnMatch && ctMatch) {
      const contentType = ctMatch[1].trim();
      // Skip text/plain and text/html body parts
      if (contentType.startsWith('text/')) continue;
      
      attachments.push({
        filename: fnMatch[1].trim(),
        sha256: '', // Would need crypto.subtle for real hashing
        size: part.length,
        contentType
      });
    }
  }
  return attachments;
}

function extractHeloHostname(headers: Record<string, string>): string | null {
  const received = headers['received'] || '';
  const heloMatch = received.match(/helo=([^\s)]+)/i) || received.match(/ehlo=([^\s)]+)/i);
  return heloMatch?.[1] || null;
}

function truncateHeaders(rawText: string, maxLen: number): string {
  const headerEnd = rawText.indexOf('\r\n\r\n');
  const headers = headerEnd > 0 ? rawText.substring(0, headerEnd) : rawText.substring(0, maxLen);
  return headers.substring(0, maxLen);
}

function classifyEmail(auth: AuthResults, urls: string[], attachments: any[], brand: any): { category: string } {
  // Malware if has suspicious attachments
  if (attachments.some(a => /\.(exe|scr|bat|cmd|ps1|vbs|js|hta|msi)$/i.test(a.filename))) {
    return { category: 'malware' };
  }
  // Phishing if has URLs and impersonates a brand
  if (urls.length > 0 && brand) return { category: 'phishing' };
  // Phishing if auth fails and has URLs
  if (auth.spf === 'fail' && urls.length > 0) return { category: 'phishing' };
  // Default spam
  return { category: urls.length > 0 ? 'phishing' : 'spam' };
}

function calculateSeverity(auth: AuthResults, brand: any, urlCount: number, attachmentCount: number): string {
  let score = 0;
  if (auth.spf === 'fail') score += 2;
  if (auth.dkim === 'fail') score += 2;
  if (auth.dmarc === 'fail') score += 3;
  if (brand) score += 3;
  if (urlCount > 0) score += 1;
  if (attachmentCount > 0) score += 2;
  
  if (score >= 8) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}
```

---

## PHASE 3: SEED STRATEGIST AGENT

Create `src/agents/seed-strategist.ts`. This is a new AI agent that runs daily via the existing cron handler. It analyzes trap performance and generates new seeding plans.

### Agent Logic

```typescript
export async function runSeedStrategist(env: Env) {
  console.log('[SeedStrategist] Starting daily analysis...');
  
  // Gather metrics
  const trapStats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total_captures_7d,
      COUNT(DISTINCT sending_ip) as unique_ips_7d,
      COUNT(DISTINCT spoofed_brand_id) as brands_spoofed_7d,
      SUM(CASE WHEN trap_channel = 'generic' THEN 1 ELSE 0 END) as generic_catches,
      SUM(CASE WHEN trap_channel = 'brand' THEN 1 ELSE 0 END) as brand_catches,
      SUM(CASE WHEN trap_channel = 'spider' THEN 1 ELSE 0 END) as spider_catches,
      SUM(CASE WHEN trap_channel = 'paste' THEN 1 ELSE 0 END) as paste_catches,
      SUM(CASE WHEN trap_channel = 'honeypot' THEN 1 ELSE 0 END) as honeypot_catches
    FROM spam_trap_captures
    WHERE captured_at > datetime('now', '-7 days')
  `).first();
  
  // Brands with active phishing but no trap catches
  const uncoveredBrands = await env.DB.prepare(`
    SELECT b.id, b.name, b.threat_count,
      (SELECT COUNT(*) FROM spam_trap_captures WHERE spoofed_brand_id = b.id 
       AND captured_at > datetime('now', '-30 days')) as trap_catches
    FROM brands b
    WHERE b.threat_count > 10
    HAVING trap_catches = 0
    ORDER BY b.threat_count DESC
    LIMIT 10
  `).all();
  
  // Top performing seed campaigns
  const topCampaigns = await env.DB.prepare(`
    SELECT name, channel, total_catches, addresses_seeded,
      ROUND(CAST(total_catches AS REAL) / MAX(addresses_seeded, 1), 1) as catch_rate
    FROM seed_campaigns
    WHERE status = 'active'
    ORDER BY total_catches DESC
    LIMIT 5
  `).all();
  
  // Generate AI analysis and recommendations
  const prompt = `You are the Seed Strategist agent for Trust Radar, a threat intelligence platform.
  
Analyze spam trap performance and recommend new seeding actions.

TRAP PERFORMANCE (last 7 days):
${JSON.stringify(trapStats)}

BRANDS WITH PHISHING BUT NO TRAP CATCHES:
${JSON.stringify(uncoveredBrands.results)}

TOP PERFORMING CAMPAIGNS:
${JSON.stringify(topCampaigns.results)}

Based on this data, provide:
1. ASSESSMENT: Brief performance assessment (2-3 sentences)
2. RECOMMENDATIONS: 3-5 specific, actionable seeding recommendations. For each, specify:
   - channel (paste/spider/honeypot/brand)
   - target brands (if applicable)
   - specific addresses to create
   - where to seed them
3. RETIRE: Any addresses or campaigns that should be retired (0 catches in 30 days)

Format your response as JSON:
{
  "assessment": "...",
  "recommendations": [
    {
      "action": "create_campaign",
      "channel": "paste",
      "name": "campaign name",
      "target_brands": ["brand_amazon_com"],
      "addresses": ["paste-c{next_id}-amz@lrxradar.com"],
      "seed_location": "pastebin",
      "reasoning": "..."
    }
  ],
  "retire": ["address1@domain.com"]
}`;

  // Call Haiku
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  const aiResponse = await response.json();
  const content = aiResponse.content?.[0]?.text || '';
  
  // Parse AI recommendations
  try {
    const plan = JSON.parse(content);
    
    // Auto-create recommended campaigns
    for (const rec of plan.recommendations || []) {
      if (rec.action === 'create_campaign') {
        const campaignResult = await env.DB.prepare(`
          INSERT INTO seed_campaigns (name, channel, status, target_brands, config, created_by, strategist_notes)
          VALUES (?, ?, 'active', ?, ?, 'strategist_agent', ?)
        `).bind(
          rec.name, rec.channel, JSON.stringify(rec.target_brands || []),
          JSON.stringify({ seed_location: rec.seed_location, addresses: rec.addresses }),
          rec.reasoning
        ).run();
        
        // Create seed addresses
        for (const addr of rec.addresses || []) {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO seed_addresses (address, domain, channel, campaign_id, brand_target)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            addr, addr.split('@')[1], rec.channel,
            campaignResult.meta?.last_row_id,
            rec.target_brands?.[0] || null
          ).run();
        }
      }
    }
    
    // Retire recommended addresses
    for (const addr of plan.retire || []) {
      await env.DB.prepare(
        "UPDATE seed_addresses SET status = 'retired' WHERE address = ?"
      ).bind(addr).run();
    }
    
    // Save agent output
    await env.DB.prepare(`
      INSERT INTO agent_outputs (agent_name, output_type, content, created_at)
      VALUES ('seed_strategist', 'daily_plan', ?, datetime('now'))
    `).bind(content).run();
    
    console.log(`[SeedStrategist] Generated ${plan.recommendations?.length || 0} recommendations`);
    
  } catch (e) {
    console.error('[SeedStrategist] Failed to parse AI response:', e);
    // Save raw output for debugging
    await env.DB.prepare(`
      INSERT INTO agent_outputs (agent_name, output_type, content, created_at)
      VALUES ('seed_strategist', 'error', ?, datetime('now'))
    `).bind(content).run();
  }
}
```

### Register in Cron Handler

Add to the existing scheduled handler. Run once daily (check if hour is 6am UTC):

```typescript
// In the cron handler:
const hour = new Date().getUTCHours();
if (hour === 6) {
  await runSeedStrategist(env);
}
```

---

## PHASE 4: PASTE SEEDER MODULE

Create `src/seeders/paste-seeder.ts`. This automatically posts "leaked" content to paste sites.

```typescript
const PASTE_SITES = [
  {
    name: 'rentry.co',
    postUrl: 'https://rentry.co/api/new',
    method: 'POST',
    bodyType: 'form', // application/x-www-form-urlencoded
    bodyField: 'text',
    responseIdField: 'url'
  }
  // Pastebin requires API key — add later if user provides one
  // dpaste.org — similar POST API
];

export async function executePasteSeeding(env: Env, campaign: any) {
  const config = JSON.parse(campaign.config || '{}');
  const addresses = config.addresses || [];
  
  if (addresses.length === 0) return;
  
  // Generate realistic-looking "leaked" content
  const content = generateLeakedContent(addresses, campaign.target_brands);
  
  for (const site of PASTE_SITES) {
    try {
      const body = new URLSearchParams();
      body.set(site.bodyField, content);
      
      const resp = await fetch(site.postUrl, {
        method: site.method,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      
      if (resp.ok) {
        const result = await resp.json();
        console.log(`[PasteSeeder] Posted to ${site.name}: ${result[site.responseIdField] || 'success'}`);
        
        // Update campaign with paste URL
        await env.DB.prepare(
          "UPDATE seed_campaigns SET config = json_set(config, '$.paste_url', ?), addresses_seeded = addresses_seeded + ? WHERE id = ?"
        ).bind(result[site.responseIdField] || '', addresses.length, campaign.id).run();
      }
    } catch (e) {
      console.error(`[PasteSeeder] Failed to post to ${site.name}:`, e);
    }
  }
}

function generateLeakedContent(addresses: string[], brandTargets: string[]): string {
  // Generate content that looks like a data export but contains only trap addresses
  const date = new Date().toISOString().split('T')[0];
  const lines = [
    `-- Export ${date} --`,
    `-- Customer contact list --`,
    `name,email,department,status`,
  ];
  
  const fakeNames = [
    'James Wilson', 'Sarah Chen', 'Michael Brown', 'Emily Davis',
    'Robert Kim', 'Jennifer Lee', 'David Patel', 'Lisa Rodriguez',
    'Thomas Anderson', 'Maria Garcia', 'Kevin Murphy', 'Sandra Wright'
  ];
  
  const departments = ['Support', 'Billing', 'Security', 'Accounts', 'Verification'];
  
  for (let i = 0; i < addresses.length; i++) {
    const name = fakeNames[i % fakeNames.length];
    const dept = departments[i % departments.length];
    lines.push(`${name},${addresses[i]},${dept},active`);
  }
  
  return lines.join('\n');
}
```

---

## PHASE 5: SPIDER TRAP INJECTOR

Create `src/seeders/spider-injector.ts`. This generates hidden HTML for the public site.

```typescript
export function generateSpiderTraps(domain: string = 'lrxradar.com'): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const traps = [
    `spider-pub-footer-${date}`,
    `spider-pub-meta-${date}`,
    `spider-pub-comment-${date}`,
    `spider-pub-hidden-${date}`
  ];
  
  return `
    <!-- Trust Radar monitoring -->
    <div style="position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden" aria-hidden="true">
      <a href="mailto:${traps[0]}@${domain}">contact us</a>
      <a href="mailto:${traps[1]}@${domain}">support</a>
    </div>
    <meta name="reply-to" content="${traps[2]}@${domain}">
  `.trim();
}
```

This HTML should be injected into the public site's HTML template. The Worker can inject it dynamically when serving the public page.

---

## PHASE 6: HONEYPOT PAGES (lrxradar.com)

Add routes to the Worker for lrxradar.com that serve realistic-looking pages with trap addresses.

```typescript
// In the fetch handler, check for lrxradar.com hostname:
if (url.hostname === 'lrxradar.com') {
  if (url.pathname === '/contact') return serveHoneypotPage('contact', env);
  if (url.pathname === '/team') return serveHoneypotPage('team', env);
  if (url.pathname === '/careers') return serveHoneypotPage('careers', env);
  if (url.pathname === '/about') return serveHoneypotPage('about', env);
  // Default: redirect to trustradar.ca
  return Response.redirect('https://trustradar.ca', 301);
}

function serveHoneypotPage(page: string, env: Env): Response {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  const pages: Record<string, {title: string; content: string; email: string}> = {
    contact: {
      title: 'Contact Us — LRX Radar',
      email: `honey-contact-${date}@lrxradar.com`,
      content: 'For general inquiries, reach out to our team.'
    },
    team: {
      title: 'Our Team — LRX Radar', 
      email: `honey-team-${date}@lrxradar.com`,
      content: 'Meet the team behind LRX Radar.'
    },
    careers: {
      title: 'Careers — LRX Radar',
      email: `honey-careers-${date}@lrxradar.com`,
      content: 'We are always looking for talented individuals.'
    },
    about: {
      title: 'About — LRX Radar',
      email: `honey-about-${date}@lrxradar.com`,
      content: 'LRX Radar provides threat intelligence solutions.'
    }
  };
  
  const p = pages[page] || pages.contact;
  
  // Visible email + hidden spider traps
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${p.title}</title>
<style>body{font-family:system-ui;max-width:600px;margin:60px auto;color:#333;padding:0 20px}
h1{font-size:24px}a{color:#0066cc}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:13px;color:#999}</style></head>
<body>
<h1>${p.title.split('—')[0].trim()}</h1>
<p>${p.content}</p>
<p>Email: <a href="mailto:${p.email}">${p.email}</a></p>
<div class="footer">
  <p>&copy; 2026 LRX Enterprises Inc. All rights reserved.</p>
  <p><a href="https://trustradar.ca">Trust Radar</a> | <a href="/contact">Contact</a> | <a href="/about">About</a></p>
</div>
<!-- spider traps -->
<div style="position:absolute;left:-9999px;height:0;overflow:hidden" aria-hidden="true">
  <a href="mailto:spider-honey-${page}-${date}@lrxradar.com">support</a>
  <a href="mailto:spider-honey-${page}b-${date}@lrxradar.com">info</a>
</div>
</body></html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=86400' }
  });
}
```

---

## PHASE 7: API ENDPOINTS

Create `src/handlers/spamTrap.ts`:

```
GET  /api/spam-trap/stats                    → Overall stats + daily chart
GET  /api/spam-trap/captures?limit=50        → Recent captures (admin)
GET  /api/spam-trap/captures/brand/:brandId  → Captures for a specific brand
GET  /api/spam-trap/sources                  → Top source IPs
GET  /api/spam-trap/campaigns                → All seed campaigns
POST /api/spam-trap/campaigns                → Create new seed campaign
POST /api/spam-trap/campaigns/:id/execute    → Execute a paste seeding campaign
PUT  /api/spam-trap/campaigns/:id            → Update campaign status
GET  /api/spam-trap/addresses                → All seed addresses with catch counts
POST /api/spam-trap/seed/initial             → Deploy initial set of generic + brand trap addresses
```

### Initial Seed Deployment Endpoint

```typescript
// POST /api/spam-trap/seed/initial
// One-time: creates the initial set of generic and brand trap addresses
async function handleInitialSeed(env: Env) {
  const genericPrefixes = [
    'admin', 'info', 'support', 'billing', 'security', 'contact',
    'help', 'sales', 'hr', 'finance', 'webmaster', 'postmaster',
    'abuse', 'noreply'
  ];
  
  const brandTraps = [
    { prefix: 'amazon-support', brand: 'brand_amazon_com' },
    { prefix: 'amazon-billing', brand: 'brand_amazon_com' },
    { prefix: 'apple-support', brand: 'brand_apple_com' },
    { prefix: 'apple-id', brand: 'brand_apple_com' },
    { prefix: 'google-security', brand: 'brand_google_com' },
    { prefix: 'microsoft-account', brand: 'brand_microsoft_com' },
    { prefix: 'netflix-billing', brand: 'brand_netflix_com' },
    { prefix: 'paypal-support', brand: null }, // may not exist yet
    { prefix: 'docusign-sign', brand: 'brand_docusign_net' },
    { prefix: 'coinbase-verify', brand: 'brand_coinbase' },
    { prefix: 'instagram-help', brand: 'brand_instagram_com' },
    { prefix: 'facebook-security', brand: 'brand_facebook_com' },
    { prefix: 'whatsapp-verify', brand: 'brand_whatsapp_com' },
    { prefix: 'roblox-support', brand: 'brand_roblox_com' },
    { prefix: 'disney-plus', brand: 'brand_disney' }
  ];
  
  const employeePrefixes = [
    'james.wilson', 'sarah.chen', 'michael.patel', 'jennifer.smith',
    'david.johnson', 'lisa.rodriguez', 'ceo', 'cfo', 'cto'
  ];
  
  let created = 0;
  
  // Generic traps on both domains
  for (const domain of ['trustradar.ca', 'lrxradar.com']) {
    for (const prefix of genericPrefixes) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO seed_addresses (address, domain, channel, brand_target)
        VALUES (?, ?, 'generic', NULL)
      `).bind(`${prefix}@${domain}`, domain).run();
      created++;
    }
  }
  
  // Brand traps on trustradar.ca
  for (const trap of brandTraps) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO seed_addresses (address, domain, channel, brand_target)
      VALUES (?, 'trustradar.ca', 'brand', ?)
    `).bind(`${trap.prefix}@trustradar.ca`, trap.brand).run();
    created++;
  }
  
  // Employee traps on lrxradar.com
  for (const prefix of employeePrefixes) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO seed_addresses (address, domain, channel)
      VALUES (?, 'lrxradar.com', 'employee')
    `).bind(`${prefix}@lrxradar.com`).run();
    created++;
  }
  
  return { success: true, addresses_created: created };
}
```

---

## PHASE 8: FRONTEND — ADMIN SPAM TRAP TAB

Add a new tab to the Admin section: **SPAM TRAP** (alongside Dashboard, Users, Feeds, Leads, API Keys, Agent Config, Audit Log).

### Admin Spam Trap Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ SPAM TRAP COMMAND CENTER                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ Captured │ │ Brands   │ │ Unique   │ │ Auth     │        │
│ │  2,847   │ │ Spoofed  │ │ IPs      │ │ Fail %   │        │
│ │ +124 24h │ │   43     │ │  318     │ │  94%     │        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│                                                              │
│ TRAP HEALTH          │ SEED CAMPAIGNS                        │
│ ○ Generic: 14 active │ ┌─────────────────────────────┐      │
│ ○ Brand: 15 active   │ │ Name      Channel  Catches  │      │
│ ○ Spider: 8 active   │ │ Amazon P  paste    47       │      │
│ ○ Paste: 12 active   │ │ Brand v1  brand    23       │      │
│ ○ Honeypot: 4 active │ │ Spider 1  spider   12       │      │
│ ○ Employee: 9 active │ │ [+ New Campaign]            │      │
│                      │ └─────────────────────────────┘      │
│ [Deploy Initial Seeds]│ [Run Paste Seeder]                   │
│                      │ [Run Strategist]                      │
│                                                              │
│ RECENT CAPTURES (live feed)                                  │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 🇷🇺 noreply@apple-id-verify.com → Apple               │  │
│ │    SPF:fail DKIM:fail DMARC:fail  │ 2min ago          │  │
│ │ 🇳🇬 security@arnazon-alert.net → Amazon               │  │
│ │    SPF:fail DKIM:fail DMARC:fail  │ 5min ago          │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ DAILY CATCH CHART (30 days)                                  │
│ [Chart.js bar chart: captures per day, stacked by category]  │
│                                                              │
│ TOP SPOOFING SOURCES                                         │
│ [Table: IP, ASN, org, country, emails caught, brands hit]    │
└─────────────────────────────────────────────────────────────┘
```

Implement this as a new route in app.js. Follow the existing admin page patterns. Include:

1. **Stats cards** — total captures, brands spoofed, unique IPs, auth failure rate (query spam_trap_captures)
2. **Trap health** — count of active addresses by channel (query seed_addresses)
3. **Seed campaigns table** — list with name, channel, catches, status, [Execute] button
4. **Deploy Initial Seeds button** — calls POST /api/spam-trap/seed/initial
5. **Run Paste Seeder button** — calls POST /api/spam-trap/campaigns/:id/execute
6. **Run Strategist button** — triggers the seed strategist agent manually
7. **Recent captures table** — last 20 captures with from, brand, auth results, timestamp
8. **Daily catch chart** — Chart.js bar chart, 30 days
9. **Top spoofing sources** — table with IP, ASN, country, catch count

---

## PHASE 9: FRONTEND — OBSERVATORY FILTER

Add a new toggle to the Observatory controls for filtering by data source.

### Source filter buttons

Next to the existing severity toggles (Critical/High/Medium/Low), add source filters:

```
[All Sources] [Feeds] [Spam Trap]
```

When "Spam Trap" is selected:
- The arc/node API calls add `?source_feed=spam_trap` parameter
- Only threats with `source_feed = 'spam_trap'` appear on the map
- Particles use a different color: amber/gold instead of cyan

### Observatory API changes

The existing arc and node endpoints need to accept a `source_feed` query parameter:

```typescript
// In /api/observatory/arcs
const sourceFeed = url.searchParams.get('source_feed');
let query = `SELECT ... FROM threats WHERE status = 'active'`;
if (sourceFeed) query += ` AND source_feed = '${sourceFeed}'`;
```

Apply this to all Observatory data endpoints: `/api/observatory/nodes`, `/api/observatory/arcs`, `/api/observatory/live`, `/api/observatory/stats`.

---

## PHASE 10: FRONTEND — BRAND DETAIL PAGE

Add a **Spam Trap Intelligence** card to brand detail pages, BELOW the Email Intelligence card. Only shows if there are captures for the brand.

```javascript
function renderSpamTrapCard(captures) {
  if (!captures || captures.total === 0) return '';
  
  return `
  <div class="card spam-trap-card">
    <div class="card-header">
      <h3>🪤 Spam Trap Intelligence</h3>
      <span class="badge badge-warning">${captures.total} caught</span>
    </div>
    <div class="card-body">
      <div class="trap-stats">
        <div class="stat">
          <div class="stat-value">${captures.total}</div>
          <div class="stat-label">Spoofed emails caught</div>
        </div>
        <div class="stat">
          <div class="stat-value">${captures.unique_ips}</div>
          <div class="stat-label">Unique source IPs</div>
        </div>
        <div class="stat">
          <div class="stat-value">${captures.auth_fail_pct}%</div>
          <div class="stat-label">Auth failure rate</div>
        </div>
      </div>
      
      <!-- Recent captures for this brand -->
      ${captures.recent?.map(c => `
        <div class="capture-row">
          <span class="capture-from">${c.from_address}</span>
          <span class="capture-subject">${c.subject?.substring(0, 60)}</span>
          <span class="capture-auth">
            SPF:<span class="${c.spf_result === 'fail' ? 'text-danger' : 'text-success'}">${c.spf_result}</span>
            DKIM:<span class="${c.dkim_result === 'fail' ? 'text-danger' : 'text-success'}">${c.dkim_result}</span>
          </span>
        </div>
      `).join('') || ''}
    </div>
  </div>`;
}
```

Load data from: `GET /api/spam-trap/captures/brand/:brandId`

---

## PHASE 11: AGENT INTEGRATION

### Analyst Agent
When the Analyst classifies a brand's threats, also query spam trap data:

```typescript
const trapData = await env.DB.prepare(`
  SELECT COUNT(*) as trap_catches,
    COUNT(DISTINCT sending_ip) as trap_ips,
    SUM(CASE WHEN dmarc_result = 'fail' THEN 1 ELSE 0 END) as dmarc_fails
  FROM spam_trap_captures
  WHERE spoofed_brand_id = ? AND captured_at > datetime('now', '-7 days')
`).bind(brandId).first();
```

Add to the Analyst's AI prompt: "Our spam traps caught X emails spoofing this brand in the last 7 days from Y unique IPs. Z had DMARC failures." This should influence severity assessment.

### Observer Agent
Add to the daily briefing:

```typescript
const trapSummary = await env.DB.prepare(`
  SELECT COUNT(*) as total,
    COUNT(DISTINCT spoofed_brand_id) as brands,
    COUNT(DISTINCT sending_ip) as ips
  FROM spam_trap_captures
  WHERE captured_at > datetime('now', '-24 hours')
`).first();
```

Include in briefing: "Spam trap network: Caught X emails targeting Y brands from Z unique IPs in the last 24 hours."

### Strategist Agent
When the Strategist identifies campaigns, include spam trap source IPs in correlation:

If the same IP appears in both spam trap data AND existing threat feeds (URLhaus, PhishTank), that's a high-confidence campaign link. Add a check for IP overlap between threats and spam_trap_captures.

### Cartographer Agent
Add spam trap source IP geo-enrichment to the Cartographer's enrichment phase:

```typescript
const trapIps = await env.DB.prepare(`
  SELECT DISTINCT sending_ip FROM spam_trap_captures
  WHERE country_code IS NULL AND sending_ip IS NOT NULL
  LIMIT 10
`).all();
// Use existing geo enrichment pipeline
```

---

## PHASE 12: PUBLIC SITE ENHANCEMENT

When someone scans a domain on the public site and we have spam trap data for that brand, show it:

```
"Trust Radar's trap network has intercepted X spoofed emails 
impersonating this domain in the last 30 days from Y unique IPs."
```

Add this to the existing public assessment display, after the email security card.

---

## PHASE 13: PDF REPORT ENHANCEMENT

Add a "Spam Trap Evidence" section to the PDF report (route `/report/:brandId`):
- Total trap catches for this brand
- Top 5 source IPs with geo
- Sample captured subjects (up to 5)
- Auth failure breakdown (SPF/DKIM/DMARC fail percentages)
- "This data is collected from Trust Radar's proprietary trap network"

---

## PHASE 14: NOTIFICATIONS

Add new notification types:

```typescript
// In notification type definitions, add:
'spam_trap_capture'    // "Apple spoofed 23 times today via spam trap"
'spam_trap_campaign'   // "New campaign: same IP spoofing Apple, Google, Netflix"
```

Rate limit: max 1 notification per brand per hour for spam_trap_capture (aggregate multiple catches).

---

## CRITICAL IMPLEMENTATION NOTES

1. **The email handler already exists** — modify it to route non-DMARC emails to the spam trap handler. Don't create a separate Worker.

2. **Threat records use `source_feed = 'spam_trap'`** — this is the universal filter key. Every existing view that filters by source_feed automatically includes/excludes trap data.

3. **Accept ALL emails silently** — never reject or bounce. Bouncing tells spammers the address is monitored.

4. **No external npm packages** — use built-in APIs for MIME parsing, header extraction, URL extraction.

5. **Honeypot pages only serve from lrxradar.com** — check the request hostname before serving. trustradar.ca serves the normal app.

6. **Paste seeder needs network access** to rentry.co — check if the Worker's egress allows this domain. If not, document it as a manual step.

7. **Rate limiting** — the paste seeder should not post more than 5 pastes per day to avoid being banned.

8. **DON'T touch** existing Observatory visualization code (arcs, particles, bezier curves). Only add the source filter toggle and pass the parameter to API calls.

9. **Spider trap HTML** should be injected into the public site template, not hardcoded into individual pages. Add it in the Worker's HTML serving logic.

10. **The Admin Spam Trap tab** follows existing admin page patterns — look at how the Dashboard and Feeds tabs are structured and replicate the layout.

---

## BUILD ORDER
1. Migration SQL (I run in D1 Console)
2. `src/spam-trap.ts` — email receiver, parsers, brand matching, threat creation
3. Email handler routing update in `src/index.ts`
4. `src/agents/seed-strategist.ts` — AI agent
5. `src/seeders/paste-seeder.ts` — automated paste creation
6. `src/seeders/spider-injector.ts` — hidden HTML generator
7. Honeypot page routes for lrxradar.com
8. `src/handlers/spamTrap.ts` — API endpoints
9. Routes in `src/index.ts`
10. Admin Spam Trap tab in `app.js`
11. Observatory source filter in `app.js`
12. Brand detail Spam Trap card in `app.js`
13. Agent integration (Analyst, Observer, Strategist, Cartographer)
14. Public site enhancement
15. PDF report section
16. Notification types
17. Register Seed Strategist in cron handler
18. Initial seed deployment endpoint

## COST
$0 for infrastructure. ~$0.05/day for Seed Strategist Haiku calls.

## ESTIMATED LINES
- Worker (spam-trap.ts + seeders + handlers): ~800 lines
- Agent (seed-strategist.ts): ~150 lines
- Frontend (admin tab + observatory filter + brand card): ~500 lines
- Agent integration (analyst + observer + strategist + cartographer): ~100 lines
- Total: ~1,550 lines
