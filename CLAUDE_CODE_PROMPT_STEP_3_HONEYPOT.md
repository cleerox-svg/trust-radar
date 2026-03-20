# Claude Code Prompt — Step 3: Honeypot Site Generator + Multi-Domain Worker

Paste this into Claude Code:

---

I'm building a honeypot site system for Trust Radar's spam trap seed campaign. The goal: serve realistic-looking small business websites on throwaway domains, with trap email addresses embedded in raw HTML where email harvesters will scrape them. All decisions are locked in — single multi-domain Worker, route by hostname.

## Context

The Trust Radar monorepo is at `packages/trust-radar/`. The existing Worker in `src/index.ts` already serves `lrxradar.com`, `www.lrxradar.com`, `trustradar.ca`, and `www.trustradar.ca` as custom domains. The existing `src/honeypot.ts` already serves a honeypot contact page on `trustradar.ca` with embedded trap addresses.

The spam trap inbound pipeline is fully built — `spam_trap_captures`, `seed_campaigns`, `seed_addresses` tables all exist. The email handler in `src/spam-trap.ts` processes all non-DMARC inbound email and the `parseTrapAddress()` function handles `{role}-{channelCode}{seq}@domain` patterns.

## What I Need Built

### 1. Multi-Domain Honeypot Worker Route

Extend the existing Worker in `src/index.ts` to handle requests from honeypot domains. The Worker already has hostname-based routing — add a check for honeypot domains.

**Architecture:**
```
Request arrives → check hostname →
  If lrxradar.com / trustradar.ca → existing app logic
  If honeypot domain → serve honeypot site from KV
  Else → 404
```

**Implementation:**
- Maintain a list of honeypot domains (either hardcoded array or KV lookup under key `honeypot:domains`)
- For honeypot requests, fetch the site HTML from KV using key pattern `honeypot-site:{hostname}`
- Serve with correct Content-Type headers, cache headers, etc.
- Handle these routes per honeypot domain:
  - `GET /` → main page (about + contact info)
  - `GET /contact` → contact page with trap emails
  - `GET /team` or `/about` → staff directory with trap emails
  - `GET /sitemap.xml` → sitemap for search engine indexing
  - `GET /robots.txt` → allow all (we WANT crawlers)
  - Everything else → 404
- Each route's HTML is stored as a separate KV key: `honeypot-site:{hostname}:index`, `honeypot-site:{hostname}:contact`, `honeypot-site:{hostname}:team`, `honeypot-site:{hostname}:sitemap`

### 2. Honeypot Site Generator (`src/honeypot-generator.ts`)

Create a new module that generates realistic small business website HTML using Claude Haiku. This will be called manually (via an admin API endpoint) or eventually by the orchestrator agent.

**Function: `generateHoneypotSite(params)`**

Input:
```typescript
interface HoneypotSiteConfig {
  hostname: string;           // e.g. "novaridge-consulting.xyz"
  businessName: string;       // e.g. "Novaridge Consulting"
  businessType: string;       // e.g. "management consulting"
  city: string;               // e.g. "Vancouver, BC"
  trapAddresses: {
    address: string;          // e.g. "info-cp01@novaridge-consulting.xyz"
    role: string;             // e.g. "General Inquiries"
    displayName?: string;     // e.g. "Sarah Chen"
  }[];
  teamMembers: {
    name: string;
    title: string;
    email: string;            // trap address
  }[];
}
```

Output: An object with HTML strings for each page:
```typescript
interface HoneypotSiteOutput {
  index: string;    // Main page HTML
  contact: string;  // Contact page HTML
  team: string;     // Team/staff directory HTML
  sitemap: string;  // sitemap.xml content
  robots: string;   // robots.txt content
}
```

**Haiku generation requirements:**
- Call the Anthropic API (the Worker already has `ANTHROPIC_API_KEY` as a secret — check wrangler.toml or existing Haiku agent code for the pattern used in this codebase)
- System prompt instructs Haiku to generate a complete, realistic single-page HTML site for the given business
- The HTML must be self-contained (inline CSS, no external dependencies)
- Each generation must produce DIFFERENT HTML structure, layout, and styling — no single template that harvesters can fingerprint
- Tell Haiku to vary: color schemes, layout patterns, font choices (use Google Fonts CDN), section ordering, copy style

**Critical trap address embedding rules (include in Haiku system prompt):**
- All trap emails MUST be in raw `<a href="mailto:...">email@domain</a>` tags — NOT JavaScript-rendered
- Include trap emails in `schema.org/LocalBusiness` JSON-LD structured data in the `<head>`
- Include trap emails in HTML comments: `<!-- Contact: email@domain -->`
- Staff directory page must list team members with their email addresses as visible mailto links
- Contact page must show primary contact email prominently
- Do NOT use `display:none`, `visibility:hidden`, or `font-size:0` on trap addresses — sophisticated harvesters skip hidden content

**Sitemap generation:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://{hostname}/</loc></url>
  <url><loc>https://{hostname}/contact</loc></url>
  <url><loc>https://{hostname}/team</loc></url>
</urlset>
```

**Robots.txt:**
```
User-agent: *
Allow: /
Sitemap: https://{hostname}/sitemap.xml
```

### 3. Admin Endpoint for Site Generation

Add a protected API endpoint to generate and store a honeypot site:

```
POST /api/admin/honeypot/generate
Authorization: Bearer {admin_token}
```

Request body:
```json
{
  "hostname": "novaridge-consulting.xyz",
  "businessName": "Novaridge Consulting",
  "businessType": "management consulting",
  "city": "Vancouver, BC",
  "seedCount": 5
}
```

This endpoint should:
1. Auto-generate trap addresses using the `{role}-{channelCode}{seq}@{hostname}` pattern (e.g. `info-cp01@novaridge-consulting.xyz`, `admin-cp02@novaridge-consulting.xyz`, etc.)
2. Auto-generate realistic team member names (Haiku can do this, or use a simple random name generator)
3. Call `generateHoneypotSite()` with the config
4. Store the generated HTML pages in KV under `honeypot-site:{hostname}:*` keys
5. Insert the new seed addresses into `seed_addresses` table with campaign reference
6. Add the hostname to the honeypot domains list (KV key `honeypot:domains`)
7. Return a summary of what was created

### 4. Seed Address Registration

When generating a honeypot site, automatically create `seed_addresses` rows for every trap address embedded in the site. Use the existing schema from migration 0022. Set:
- `channel` = `honeypot` for contact page addresses, `honeypot` for team page addresses
- `campaign_id` = reference to a new or existing campaign
- `is_active` = 1
- `domain` = the honeypot hostname

Also create a new `seed_campaigns` row for each honeypot domain:
```sql
INSERT INTO seed_campaigns (name, channel, created_by)
VALUES ('Honeypot: novaridge-consulting.xyz', 'honeypot', 'generator');
```

### 5. Wrangler.toml Updates

For now, do NOT add the throwaway domains to wrangler.toml — I'll add those manually after purchasing the domains. But make the Worker code ready to accept any hostname that's in the `honeypot:domains` KV list.

Document in a comment what I'll need to add per domain:
```toml
# For each honeypot domain, add:
# { pattern = "example-business.xyz", custom_domain = true },
```

### 6. Email Routing for Honeypot Domains

The existing email handler in `src/index.ts` already routes all non-DMARC mail to `handleSpamTrapEmail()`. Verify that this will work for emails arriving at honeypot domains (e.g. `info-cp01@novaridge-consulting.xyz`) — the `parseTrapAddress()` function should already handle the `{role}-{channelCode}{seq}@` pattern regardless of domain.

If there's any domain-specific filtering that would exclude honeypot domains, flag it.

## Implementation Notes

- Follow the existing code patterns in the monorepo (TypeScript, existing module structure, existing Haiku agent call patterns)
- Check how existing Haiku/AI calls are made in the codebase (look for `ANTHROPIC_API_KEY`, existing agent code in src/) and follow the same pattern
- KV namespace is already bound as `CACHE` in wrangler.toml — use that
- All new files go in `packages/trust-radar/src/`
- If a new migration is needed for any schema changes, put it in `packages/trust-radar/migrations/` as the next number in sequence

## Output

Show me:
1. The new `src/honeypot-generator.ts` module (full file)
2. The changes to `src/index.ts` for honeypot domain routing
3. The admin endpoint code
4. Any migration SQL if needed
5. Confirmation that email routing will work for honeypot domain addresses
6. Do NOT deploy — I will review first

---
