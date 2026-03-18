# DMARC REPORT RECEIVER — Claude Code Build Prompt

## CONTEXT
Trust Radar (lrxradar.com / trustradar.ca) is a threat intelligence platform built as a Cloudflare Worker SPA with D1 SQLite. We monitor 500+ brands for phishing, typosquatting, malware. We just shipped an Email Security Posture Engine that scans DMARC/SPF/DKIM/MX via DNS for every brand.

This build adds **DMARC Aggregate Report Receiving** — Trust Radar becomes a DMARC report receiver. When a brand adds `rua=mailto:dmarc-rua@trustradar.ca` to their DMARC DNS record, every major email provider (Google, Microsoft, Yahoo, Apple) sends daily XML reports showing:
- Every IP that sent email claiming to be that brand
- How many emails from each IP
- Whether SPF passed or failed
- Whether DKIM passed or failed
- What disposition was applied (none/quarantine/reject)
- The actual sending domain vs the spoofed domain

This is the raw email signal data that Proofpoint and Mimecast charge $65K+/year for. We collect it ourselves for free via Cloudflare Email Routing.

**Tech stack**: Cloudflare Workers (TypeScript), D1 SQLite (`trust-radar-v2`), KV (`trust-radar-cache`), Cloudflare Email Routing on trustradar.ca.
**Repo**: `packages/trust-radar/`
**Existing Worker**: `packages/trust-radar/src/index.ts`
**Frontend**: `packages/trust-radar/public/app.js` and `styles.css`

---

## PHASE 1: DATABASE SCHEMA

Generate migration SQL. I will run this in D1 Console manually.

```sql
-- Migration: 0021_dmarc_reports.sql

-- DMARC aggregate reports received from email providers
CREATE TABLE IF NOT EXISTS dmarc_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER,
  domain TEXT NOT NULL,                    -- the domain being reported on (e.g., apple.com)
  reporter_org TEXT,                       -- who sent the report (e.g., google.com, microsoft.com)
  reporter_email TEXT,                     -- sender email address
  report_id TEXT,                          -- unique report ID from XML metadata
  date_begin TEXT,                         -- report period start (ISO)
  date_end TEXT,                           -- report period end (ISO)
  total_records INTEGER DEFAULT 0,         -- total record rows in report
  total_messages INTEGER DEFAULT 0,        -- total email count across all records
  total_pass INTEGER DEFAULT 0,            -- messages that passed DMARC
  total_fail INTEGER DEFAULT 0,            -- messages that failed DMARC
  policy_published TEXT,                   -- the domain's published DMARC policy
  raw_xml TEXT,                            -- original XML (compressed)
  received_at TEXT DEFAULT (datetime('now')),
  processed INTEGER DEFAULT 0,            -- 0=pending, 1=processed, -1=error
  process_error TEXT,
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

CREATE INDEX IF NOT EXISTS idx_dr_domain ON dmarc_reports(domain);
CREATE INDEX IF NOT EXISTS idx_dr_brand ON dmarc_reports(brand_id);
CREATE INDEX IF NOT EXISTS idx_dr_received ON dmarc_reports(received_at);
CREATE INDEX IF NOT EXISTS idx_dr_reporter ON dmarc_reports(reporter_org);

-- Individual records from DMARC reports (one per source IP per report)
CREATE TABLE IF NOT EXISTS dmarc_report_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  source_ip TEXT NOT NULL,                 -- IP that sent the email
  count INTEGER DEFAULT 1,                -- number of messages from this IP
  disposition TEXT,                         -- none/quarantine/reject
  dkim_result TEXT,                        -- pass/fail
  spf_result TEXT,                         -- pass/fail
  dmarc_result TEXT,                       -- pass/fail (computed: both pass = pass)
  header_from TEXT,                        -- domain being spoofed (From: header)
  envelope_from TEXT,                      -- actual envelope sender domain
  dkim_domain TEXT,                        -- domain in DKIM signature
  spf_domain TEXT,                         -- domain checked for SPF
  -- Geo enrichment (populated later by existing geo pipeline)
  country_code TEXT,
  city TEXT,
  lat REAL,
  lng REAL,
  asn TEXT,
  org TEXT,
  FOREIGN KEY (report_id) REFERENCES dmarc_reports(id)
);

CREATE INDEX IF NOT EXISTS idx_drr_report ON dmarc_report_records(report_id);
CREATE INDEX IF NOT EXISTS idx_drr_ip ON dmarc_report_records(source_ip);
CREATE INDEX IF NOT EXISTS idx_drr_header_from ON dmarc_report_records(header_from);
CREATE INDEX IF NOT EXISTS idx_drr_dmarc_result ON dmarc_report_records(dmarc_result);

-- Summary stats table for fast dashboard queries
CREATE TABLE IF NOT EXISTS dmarc_daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  brand_id INTEGER,
  date TEXT NOT NULL,                      -- YYYY-MM-DD
  total_messages INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  unique_sources INTEGER DEFAULT 0,        -- unique source IPs
  top_fail_ips TEXT,                        -- JSON array of top 5 failing IPs
  reporters TEXT,                           -- JSON array of reporting orgs
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dds_domain_date ON dmarc_daily_stats(domain, date);
```

---

## PHASE 2: EMAIL WORKER

Cloudflare Email Routing will forward emails to `dmarc-rua@trustradar.ca` to our Worker. The Worker needs an `email` event handler.

**IMPORTANT**: The email handler must be added to the EXISTING Worker in `src/index.ts`, not a separate Worker. Cloudflare Workers support both `fetch` and `email` event handlers in the same Worker.

### Email Handler

```typescript
// In src/index.ts, add the email handler to the existing export default:
export default {
  async fetch(request, env, ctx) { /* existing fetch handler */ },
  
  async email(message, env, ctx) {
    // message is a CloudFlare EmailMessage
    // message.from — sender email
    // message.to — recipient (dmarc-rua@trustradar.ca)
    // message.headers — email headers
    // message.raw — ReadableStream of raw email (RFC 822)
    
    try {
      await processDmarcEmail(message, env);
    } catch (e) {
      console.error('[DMARC] Failed to process email:', e);
      // Don't reject — accept all emails to avoid bouncing reports
    }
  },
  
  async scheduled(event, env, ctx) { /* existing cron handler */ }
};
```

### Email Processing Module

Create `src/dmarc-receiver.ts`:

```typescript
import { EmailMessage } from '@cloudflare/workers-types';

export async function processDmarcEmail(message: EmailMessage, env: Env) {
  const from = message.from;
  const to = message.to;
  const subject = message.headers.get('subject') || '';
  
  console.log(`[DMARC] Received report from ${from}, subject: ${subject}`);
  
  // Read the raw email into an ArrayBuffer
  const rawEmail = await streamToArrayBuffer(message.raw);
  
  // DMARC reports come as either:
  // 1. application/zip attachment containing XML
  // 2. application/gzip attachment containing XML
  // 3. application/xml directly (rare)
  // 4. multipart/mixed with zip/gzip attachment
  
  // Parse the MIME email to extract attachments
  const attachments = parseMimeAttachments(rawEmail);
  
  for (const attachment of attachments) {
    let xmlContent: string | null = null;
    
    if (attachment.contentType.includes('zip') || attachment.filename?.endsWith('.zip')) {
      // Decompress ZIP and extract XML
      xmlContent = await decompressZip(attachment.data);
    } else if (attachment.contentType.includes('gzip') || attachment.contentType.includes('gz') || attachment.filename?.endsWith('.gz')) {
      // Decompress GZIP
      xmlContent = await decompressGzip(attachment.data);
    } else if (attachment.contentType.includes('xml')) {
      xmlContent = new TextDecoder().decode(attachment.data);
    }
    
    if (xmlContent && xmlContent.includes('<feedback')) {
      await parseDmarcReport(xmlContent, from, env);
    }
  }
}
```

### MIME Parser

We need a lightweight MIME parser for multipart emails. Don't use external npm packages — write a minimal parser:

```typescript
interface MimeAttachment {
  contentType: string;
  filename: string | null;
  encoding: string;
  data: Uint8Array;
}

function parseMimeAttachments(raw: ArrayBuffer): MimeAttachment[] {
  const text = new TextDecoder().decode(raw);
  const attachments: MimeAttachment[] = [];
  
  // Find boundary from Content-Type header
  const boundaryMatch = text.match(/boundary="?([^"\r\n]+)"?/i);
  if (!boundaryMatch) {
    // Not multipart — treat entire body as potential attachment
    // Check if it's a compressed file
    const bytes = new Uint8Array(raw);
    // ZIP magic: PK (0x50 0x4B)
    // GZIP magic: 0x1F 0x8B
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      return [{ contentType: 'application/zip', filename: 'report.zip', encoding: 'binary', data: bytes }];
    }
    if (bytes[0] === 0x1F && bytes[1] === 0x8B) {
      return [{ contentType: 'application/gzip', filename: 'report.xml.gz', encoding: 'binary', data: bytes }];
    }
    if (text.includes('<feedback')) {
      return [{ contentType: 'text/xml', filename: 'report.xml', encoding: 'utf-8', data: bytes }];
    }
    return [];
  }
  
  const boundary = boundaryMatch[1];
  const parts = text.split(`--${boundary}`);
  
  for (const part of parts) {
    if (part.trim() === '' || part.trim() === '--') continue;
    
    // Split headers from body
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    
    const headers = part.substring(0, headerEnd);
    const body = part.substring(headerEnd + 4);
    
    // Get content type
    const ctMatch = headers.match(/Content-Type:\s*([^\r\n;]+)/i);
    const contentType = ctMatch?.[1]?.trim() || '';
    
    // Get filename
    const fnMatch = headers.match(/filename="?([^"\r\n]+)"?/i);
    const filename = fnMatch?.[1]?.trim() || null;
    
    // Get encoding
    const encMatch = headers.match(/Content-Transfer-Encoding:\s*(\S+)/i);
    const encoding = encMatch?.[1]?.trim()?.toLowerCase() || '7bit';
    
    // Only process attachments (zip, gzip, xml)
    if (contentType.includes('zip') || contentType.includes('gzip') || contentType.includes('xml') ||
        contentType.includes('octet-stream') ||
        filename?.endsWith('.zip') || filename?.endsWith('.gz') || filename?.endsWith('.xml')) {
      
      let data: Uint8Array;
      if (encoding === 'base64') {
        data = base64ToUint8Array(body.replace(/\s/g, ''));
      } else {
        data = new TextEncoder().encode(body);
      }
      
      attachments.push({ contentType, filename, encoding, data });
    }
  }
  
  return attachments;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

### Decompression

For GZIP, use the built-in `DecompressionStream` API (available in Cloudflare Workers):

```typescript
async function decompressGzip(data: Uint8Array): Promise<string> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  const decompressed = await new Response(stream).text();
  return decompressed;
}
```

For ZIP files, we need a minimal ZIP parser. ZIP files have a central directory at the end. DMARC report ZIPs typically contain a single XML file:

```typescript
async function decompressZip(data: Uint8Array): Promise<string | null> {
  // Find local file header (PK\x03\x04)
  if (data[0] !== 0x50 || data[1] !== 0x4B || data[2] !== 0x03 || data[3] !== 0x04) {
    return null;
  }
  
  // Parse local file header
  const compressionMethod = data[8] | (data[9] << 8);
  const compressedSize = data[18] | (data[19] << 8) | (data[20] << 16) | (data[21] << 24);
  const filenameLength = data[26] | (data[27] << 8);
  const extraLength = data[28] | (data[29] << 8);
  const dataOffset = 30 + filenameLength + extraLength;
  
  const compressedData = data.slice(dataOffset, dataOffset + compressedSize);
  
  if (compressionMethod === 0) {
    // Stored (no compression)
    return new TextDecoder().decode(compressedData);
  } else if (compressionMethod === 8) {
    // Deflate — use DecompressionStream with 'raw' deflate
    // Cloudflare Workers support 'deflate-raw'
    try {
      const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    } catch {
      // Fallback: try regular deflate
      const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream('deflate'));
      return await new Response(stream).text();
    }
  }
  
  return null;
}
```

### XML Parser

DMARC aggregate reports follow RFC 7489 format. Parse without external XML library — use regex/string parsing (the XML structure is simple and predictable):

```typescript
interface DmarcReportData {
  reporterOrg: string;
  reportId: string;
  dateBegin: string;
  dateEnd: string;
  domain: string;
  policyPublished: string;
  records: DmarcRecord[];
}

interface DmarcRecord {
  sourceIp: string;
  count: number;
  disposition: string;
  dkimResult: string;
  spfResult: string;
  headerFrom: string;
  envelopeFrom: string;
  dkimDomain: string;
  spfDomain: string;
}

function parseDmarcXml(xml: string): DmarcReportData | null {
  // Extract report metadata
  const reporterOrg = extractTag(xml, 'org_name') || 'unknown';
  const reportId = extractTag(xml, 'report_id') || '';
  const dateBegin = extractTag(xml, 'begin') || '';
  const dateEnd = extractTag(xml, 'end') || '';
  const domain = extractTag(xml, 'domain') || '';  // inside <policy_published>
  const policy = extractTag(xml, 'p') || '';        // inside <policy_published>
  
  // Extract all <record> blocks
  const records: DmarcRecord[] = [];
  const recordBlocks = xml.match(/<record>[\s\S]*?<\/record>/g) || [];
  
  for (const block of recordBlocks) {
    const sourceIp = extractTag(block, 'source_ip') || '';
    const count = parseInt(extractTag(block, 'count') || '1');
    const disposition = extractTag(block, 'disposition') || 'none';
    
    // Auth results
    const dkimResult = extractNestedTag(block, 'dkim', 'result') || 'none';
    const spfResult = extractNestedTag(block, 'spf', 'result') || 'none';
    const headerFrom = extractTag(block, 'header_from') || domain;
    const envelopeFrom = extractTag(block, 'envelope_from') || '';
    const dkimDomain = extractNestedTag(block, 'dkim', 'domain') || '';
    const spfDomain = extractNestedTag(block, 'spf', 'domain') || '';
    
    records.push({
      sourceIp, count, disposition, dkimResult, spfResult,
      headerFrom, envelopeFrom, dkimDomain, spfDomain
    });
  }
  
  return {
    reporterOrg, reportId, dateBegin, dateEnd, domain,
    policyPublished: policy, records
  };
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match?.[1]?.trim() || null;
}

function extractNestedTag(xml: string, parentTag: string, childTag: string): string | null {
  const parentMatch = xml.match(new RegExp(`<${parentTag}>[\\s\\S]*?</${parentTag}>`));
  if (!parentMatch) return null;
  return extractTag(parentMatch[0], childTag);
}
```

### Store in D1

```typescript
async function parseDmarcReport(xmlContent: string, senderEmail: string, env: Env) {
  const report = parseDmarcXml(xmlContent);
  if (!report || !report.domain) {
    console.log('[DMARC] Could not parse report XML');
    return;
  }
  
  console.log(`[DMARC] Parsed report: org=${report.reporterOrg} domain=${report.domain} records=${report.records.length}`);
  
  // Match to a monitored brand
  const brand = await env.DB.prepare(
    'SELECT id FROM brands WHERE LOWER(COALESCE(canonical_domain, LOWER(name))) = ? AND monitoring_status = ?'
  ).bind(report.domain.toLowerCase(), 'active').first();
  
  // Calculate totals
  let totalMessages = 0, totalPass = 0, totalFail = 0;
  for (const r of report.records) {
    totalMessages += r.count;
    if (r.dkimResult === 'pass' && r.spfResult === 'pass') {
      totalPass += r.count;
    } else {
      totalFail += r.count;
    }
  }
  
  // Insert report
  const result = await env.DB.prepare(`
    INSERT INTO dmarc_reports (brand_id, domain, reporter_org, reporter_email, report_id,
      date_begin, date_end, total_records, total_messages, total_pass, total_fail,
      policy_published, raw_xml, processed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).bind(
    brand?.id || null,
    report.domain,
    report.reporterOrg,
    senderEmail,
    report.reportId,
    report.dateBegin ? new Date(parseInt(report.dateBegin) * 1000).toISOString() : null,
    report.dateEnd ? new Date(parseInt(report.dateEnd) * 1000).toISOString() : null,
    report.records.length,
    totalMessages,
    totalPass,
    totalFail,
    report.policyPublished,
    xmlContent.substring(0, 50000),  // Cap stored XML at 50KB
    1
  ).run();
  
  const dbReportId = result.meta?.last_row_id;
  if (!dbReportId) return;
  
  // Insert individual records
  for (const r of report.records) {
    const dmarcResult = (r.dkimResult === 'pass' || r.spfResult === 'pass') ? 'pass' : 'fail';
    
    await env.DB.prepare(`
      INSERT INTO dmarc_report_records (report_id, source_ip, count, disposition,
        dkim_result, spf_result, dmarc_result, header_from, envelope_from, dkim_domain, spf_domain)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      dbReportId, r.sourceIp, r.count, r.disposition,
      r.dkimResult, r.spfResult, dmarcResult,
      r.headerFrom, r.envelopeFrom, r.dkimDomain, r.spfDomain
    ).run();
  }
  
  // Update daily stats
  const reportDate = report.dateBegin 
    ? new Date(parseInt(report.dateBegin) * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  
  const uniqueSources = new Set(report.records.map(r => r.sourceIp)).size;
  const topFailIps = report.records
    .filter(r => r.dkimResult !== 'pass' || r.spfResult !== 'pass')
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(r => ({ ip: r.sourceIp, count: r.count }));
  
  await env.DB.prepare(`
    INSERT INTO dmarc_daily_stats (domain, brand_id, date, total_messages, passed, failed, unique_sources, top_fail_ips, reporters)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (domain, date) DO UPDATE SET
      total_messages = total_messages + excluded.total_messages,
      passed = passed + excluded.passed,
      failed = failed + excluded.failed,
      unique_sources = unique_sources + excluded.unique_sources,
      top_fail_ips = excluded.top_fail_ips,
      reporters = excluded.reporters
  `).bind(
    report.domain, brand?.id || null, reportDate,
    totalMessages, totalPass, totalFail, uniqueSources,
    JSON.stringify(topFailIps), JSON.stringify([report.reporterOrg])
  ).run();
  
  // If this is a monitored brand with failed messages, create a notification
  if (brand?.id && totalFail > 0) {
    const failPct = Math.round((totalFail / totalMessages) * 100);
    await env.DB.prepare(`
      INSERT INTO notifications (type, title, message, severity, brand_id, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      'brand_threat',
      `DMARC Report: ${report.domain} has ${totalFail} failed emails`,
      `${report.reporterOrg} reports ${totalMessages} emails from ${uniqueSources} sources. ${failPct}% failed authentication — potential spoofing detected.`,
      failPct > 20 ? 'high' : 'medium',
      brand.id
    ).run();
  }
  
  console.log(`[DMARC] Stored report: ${report.domain} from ${report.reporterOrg} — ${totalMessages} messages, ${totalFail} failed`);
}

async function streamToArrayBuffer(stream: ReadableStream): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result.buffer;
}
```

---

## PHASE 3: API ENDPOINTS

Add these routes to the existing Worker router:

```
GET  /api/dmarc-reports/:brandId              → Reports received for a brand
GET  /api/dmarc-reports/:brandId/stats         → Daily stats for a brand
GET  /api/dmarc-reports/:brandId/sources       → Top source IPs (spoofing attempts)
GET  /api/dmarc-reports/overview               → Admin: all reports summary
```

### Brand DMARC Intelligence Endpoint

```typescript
// GET /api/dmarc-reports/:brandId
async function handleDmarcReports(brandId: string, env: Env) {
  const reports = await env.DB.prepare(`
    SELECT id, reporter_org, report_id, date_begin, date_end,
      total_records, total_messages, total_pass, total_fail, received_at
    FROM dmarc_reports
    WHERE brand_id = ?
    ORDER BY received_at DESC
    LIMIT 50
  `).bind(brandId).all();
  
  return reports.results;
}

// GET /api/dmarc-reports/:brandId/stats
async function handleDmarcStats(brandId: string, env: Env) {
  const stats = await env.DB.prepare(`
    SELECT date, total_messages, passed, failed, unique_sources, top_fail_ips, reporters
    FROM dmarc_daily_stats
    WHERE brand_id = ?
    ORDER BY date DESC
    LIMIT 30
  `).bind(brandId).all();
  
  // Summary
  const summary = await env.DB.prepare(`
    SELECT 
      SUM(total_messages) as total_emails,
      SUM(passed) as total_passed,
      SUM(failed) as total_failed,
      SUM(unique_sources) as total_sources,
      COUNT(DISTINCT date) as days_reporting
    FROM dmarc_daily_stats
    WHERE brand_id = ?
  `).bind(brandId).first();
  
  return { summary, daily: stats.results };
}

// GET /api/dmarc-reports/:brandId/sources
async function handleDmarcSources(brandId: string, env: Env) {
  // Get top source IPs across all reports for this brand
  const sources = await env.DB.prepare(`
    SELECT drr.source_ip, SUM(drr.count) as total_messages,
      drr.dmarc_result, drr.spf_result, drr.dkim_result,
      drr.spf_domain, drr.dkim_domain,
      drr.country_code, drr.city, drr.org, drr.asn
    FROM dmarc_report_records drr
    JOIN dmarc_reports dr ON dr.id = drr.report_id
    WHERE dr.brand_id = ?
      AND drr.dmarc_result = 'fail'
    GROUP BY drr.source_ip
    ORDER BY total_messages DESC
    LIMIT 20
  `).bind(brandId).all();
  
  return sources.results;
}

// GET /api/dmarc-reports/overview (admin)
async function handleDmarcOverview(env: Env) {
  const overview = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total_reports,
      COUNT(DISTINCT domain) as domains_reporting,
      SUM(total_messages) as total_emails_analyzed,
      SUM(total_fail) as total_failures,
      COUNT(DISTINCT reporter_org) as reporter_count
    FROM dmarc_reports
  `).first();
  
  const recentReports = await env.DB.prepare(`
    SELECT domain, reporter_org, total_messages, total_fail, received_at
    FROM dmarc_reports
    ORDER BY received_at DESC
    LIMIT 10
  `).all();
  
  return { overview, recent: recentReports.results };
}
```

---

## PHASE 4: FRONTEND — Email Intelligence on Brand Detail Page

Add a new section to the brand detail page, BELOW the Email Security Posture card. This section only appears if DMARC reports have been received for the brand.

### "Email Intelligence" Card

```javascript
function renderEmailIntelligence(dmarcData) {
  if (!dmarcData || !dmarcData.summary || dmarcData.summary.total_emails === 0) {
    return `
    <div class="card email-intel-card">
      <div class="card-header">
        <h3>📊 Email Intelligence</h3>
      </div>
      <div class="card-body">
        <p style="color: rgba(255,255,255,0.5); font-size: 13px;">
          No DMARC reports received yet for this domain.
        </p>
        <div class="email-cta">
          <strong>Activate Email Intelligence</strong><br>
          Add this to your DMARC record to see who's sending email as your domain:<br>
          <code>rua=mailto:dmarc-rua@trustradar.ca</code><br>
          <span style="font-size: 11px; color: rgba(255,255,255,0.4);">
            Reports start arriving within 24-48 hours from Google, Microsoft, Yahoo, and other providers.
          </span>
        </div>
      </div>
    </div>`;
  }
  
  const s = dmarcData.summary;
  const failPct = s.total_emails > 0 ? Math.round((s.total_failed / s.total_emails) * 100) : 0;
  
  return `
  <div class="card email-intel-card">
    <div class="card-header">
      <h3>📊 Email Intelligence</h3>
      <span class="badge ${failPct > 20 ? 'badge-danger' : failPct > 5 ? 'badge-warning' : 'badge-success'}">
        ${failPct}% failure rate
      </span>
    </div>
    <div class="card-body">
      <!-- Summary stats row -->
      <div class="email-intel-stats">
        <div class="stat">
          <div class="stat-value">${s.total_emails?.toLocaleString() || 0}</div>
          <div class="stat-label">Emails Analyzed</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: #00ff88;">${s.total_passed?.toLocaleString() || 0}</div>
          <div class="stat-label">Passed Auth</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: #ff4444;">${s.total_failed?.toLocaleString() || 0}</div>
          <div class="stat-label">Failed Auth</div>
        </div>
        <div class="stat">
          <div class="stat-value">${s.total_sources || 0}</div>
          <div class="stat-label">Unique Sources</div>
        </div>
      </div>
      
      <!-- Top spoofing sources (if any failures) -->
      ${dmarcData.sources?.length ? `
        <h4 style="margin-top: 16px; font-size: 13px; color: rgba(255,255,255,0.6);">TOP SPOOFING SOURCES</h4>
        <div class="spoofing-sources">
          ${dmarcData.sources.slice(0, 5).map(src => `
            <div class="source-row">
              <span class="source-ip">${src.source_ip}</span>
              <span class="source-org">${src.org || src.asn || 'Unknown'}</span>
              <span class="source-country">${src.country_code || '??'}</span>
              <span class="source-count" style="color: #ff4444;">${src.total_messages} emails</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <!-- Daily trend (mini chart) -->
      ${dmarcData.daily?.length > 1 ? `
        <canvas id="dmarc-daily-chart" height="120" style="margin-top: 16px;"></canvas>
      ` : ''}
      
      <div class="scan-meta">
        Receiving reports from ${s.reporter_count || 0} email provider(s) over ${s.days_reporting || 0} day(s)
      </div>
    </div>
  </div>`;
}
```

When loading a brand detail page, fetch DMARC data:

```javascript
const [statsResp, sourcesResp] = await Promise.all([
  fetch(`/api/dmarc-reports/${brandId}/stats`),
  fetch(`/api/dmarc-reports/${brandId}/sources`)
]);
const dmarcStats = await statsResp.json();
const dmarcSources = await sourcesResp.json();

// Render the Email Intelligence card
const emailIntelHtml = renderEmailIntelligence({
  summary: dmarcStats.data?.summary,
  daily: dmarcStats.data?.daily,
  sources: dmarcSources.data
});
```

---

## PHASE 5: CTA ON EMAIL SECURITY CARD

On the existing Email Security Posture card (brand detail page), add a CTA to activate DMARC reporting through Trust Radar. This should appear whether or not the brand already has DMARC:

If brand has NO DMARC:
> "This domain has no DMARC protection. Set up DMARC and add Trust Radar as your report receiver:
> `v=DMARC1; p=quarantine; rua=mailto:dmarc-rua@trustradar.ca`"

If brand HAS DMARC but Trust Radar is not in rua:
> "Send your DMARC reports to Trust Radar to see who's spoofing your domain:
> Add `mailto:dmarc-rua@trustradar.ca` to your rua tag"

If brand HAS DMARC and Trust Radar IS in rua:
> "✅ DMARC reports are flowing to Trust Radar"

Check if `trustradar.ca` appears in the `dmarc_rua` field of the email security scan.

---

## PHASE 6: GEO ENRICHMENT INTEGRATION

The existing Cartographer agent geo-enriches IPs. Add DMARC report source IPs to the enrichment queue.

In the Cartographer's geo enrichment phase, also enrich un-enriched DMARC source IPs:

```typescript
// After existing threat IP enrichment, also enrich DMARC source IPs
const dmarcIps = await env.DB.prepare(`
  SELECT DISTINCT source_ip FROM dmarc_report_records
  WHERE country_code IS NULL AND source_ip IS NOT NULL
  LIMIT 10
`).all();

for (const row of dmarcIps.results) {
  // Use existing geo enrichment function
  const geo = await enrichIp(row.source_ip, env);
  if (geo) {
    await env.DB.prepare(`
      UPDATE dmarc_report_records SET country_code = ?, city = ?, lat = ?, lng = ?, asn = ?, org = ?
      WHERE source_ip = ? AND country_code IS NULL
    `).bind(geo.countryCode, geo.city, geo.lat, geo.lng, geo.asn, geo.org, row.source_ip).run();
  }
}
```

---

## CRITICAL IMPLEMENTATION NOTES

1. **The email handler goes in the EXISTING Worker** — same `src/index.ts`. Don't create a separate Worker.

2. **Accept ALL emails** — never reject/bounce. DMARC report senders (Google, Microsoft) may stop sending if they get bounces.

3. **No external npm packages** for MIME parsing, XML parsing, or decompression. Use built-in APIs (`DecompressionStream`, regex, string parsing). The XML structure of DMARC reports is simple and predictable.

4. **Cloudflare Email Routing must be configured manually** — I will set up `dmarc-rua@trustradar.ca` → Worker in the Cloudflare dashboard. The Worker just needs the `email` event handler.

5. **wrangler.toml needs updating** — add `[email_routing]` or ensure the Worker is set as an email destination in Cloudflare.

6. **D1 batch writes** — for reports with many records (100+), batch the INSERT statements to avoid hitting D1 limits.

7. **Don't touch** the Observatory, existing email security posture engine, or any other existing functionality.

---

## BUILD ORDER
1. Migration SQL (I run in D1 Console)
2. `src/dmarc-receiver.ts` — MIME parser, decompressor, XML parser, D1 writer
3. Email handler in `src/index.ts`
4. API endpoints in `src/handlers/dmarcReports.ts`
5. Routes in `src/index.ts`
6. Brand detail page — Email Intelligence card
7. Email Security card — CTA updates
8. Cartographer — geo enrichment for DMARC source IPs

## COST
$0 — Cloudflare Email Routing is free (up to 25 destination addresses). Email Workers included in Workers plan.

## ESTIMATED LINES
- Worker: ~500 lines (receiver + parser + handlers)
- Frontend: ~200 lines (Email Intelligence card + CTA)
- Total: ~700 lines
