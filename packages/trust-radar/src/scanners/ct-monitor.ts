/**
 * Certificate Transparency Monitor — Polls crt.sh for newly issued certificates
 * matching monitored brand domains and keywords. Flags suspicious certificates
 * (typosquatting, free-CA phishing sites) and creates alerts.
 *
 * Called by the cron orchestrator every 5 minutes.
 */

import { createAlert } from '../lib/alerts';
import { logger } from '../lib/logger';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────

interface CrtShEntry {
  id: number;
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;  // newline-separated SANs
  not_before: string;
  not_after: string;
  serial_number: string;
}

interface BrandProfile {
  id: string;
  brand_id: string;
  user_id: string;
  domain: string;
  brand_keywords: string | null;
}

// Free CAs commonly used for phishing sites
const FREE_CA_PATTERNS = [
  /let's encrypt/i,
  /letsencrypt/i,
  /zerossl/i,
  /buypass/i,
  /ssl\.com.*free/i,
];

const CRTSH_TIMEOUT_MS = 10_000;
const BRAND_BATCH_SIZE = 10;
const KV_CACHE_TTL = 3600; // 1 hour

// ─── Main Poller ────────────────────────────────────────────────

/**
 * Poll crt.sh for certificates matching all active brand profiles.
 * Called by the cron orchestrator every 5 minutes.
 */
export async function pollCertificates(env: Env): Promise<void> {
  // 1. Get all active brand_profiles with their domains and brand_keywords
  const profiles = await env.DB.prepare(
    `SELECT bp.id, bp.brand_id, bp.user_id,
            COALESCE(bp.domain, b.canonical_domain) AS domain,
            bp.brand_keywords
     FROM brand_profiles bp
     JOIN brands b ON b.id = bp.brand_id
     WHERE bp.monitoring_enabled = 1
       AND COALESCE(bp.domain, b.canonical_domain) IS NOT NULL`
  ).all<BrandProfile>();

  if (profiles.results.length === 0) {
    logger.info('ct_monitor_skip', { reason: 'no active brand profiles' });
    return;
  }

  logger.info('ct_monitor_start', { brands: profiles.results.length });

  let totalCerts = 0;
  let totalSuspicious = 0;
  let totalNew = 0;

  // 2. Process brands in batches of BRAND_BATCH_SIZE
  for (let i = 0; i < profiles.results.length; i += BRAND_BATCH_SIZE) {
    const batch = profiles.results.slice(i, i + BRAND_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (profile) => {
        const keywords = profile.brand_keywords
          ? JSON.parse(profile.brand_keywords) as string[]
          : [];
        const result = await checkCertForBrand(env, profile.brand_id, profile.domain, keywords, profile.user_id);
        return result;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalCerts += result.value.total;
        totalSuspicious += result.value.suspicious;
        totalNew += result.value.newCerts;
      } else {
        logger.error('ct_monitor_brand_error', { error: String(result.reason) });
      }
    }
  }

  logger.info('ct_monitor_complete', {
    brands: profiles.results.length,
    totalCerts,
    totalNew,
    totalSuspicious,
  });
}

// ─── Per-Brand Check ────────────────────────────────────────────

/**
 * Query crt.sh for a specific brand's domain and keywords.
 * Returns counts of total and suspicious certificates found.
 */
export async function checkCertForBrand(
  env: Env,
  brandId: string,
  domain: string,
  keywords: string[],
  userId?: string,
): Promise<{ total: number; suspicious: number; newCerts: number }> {
  let total = 0;
  let suspicious = 0;
  let newCerts = 0;

  // Query for wildcard subdomain certificates matching the domain
  const domainEntries = await fetchCrtSh(env, `%25.${domain}`);
  const processed = await processCertEntries(env, domainEntries, brandId, domain, keywords, userId);
  total += processed.total;
  suspicious += processed.suspicious;
  newCerts += processed.newCerts;

  // Also search by brand keywords for typosquatting certificates
  for (const keyword of keywords.slice(0, 3)) { // limit to 3 keywords to avoid hammering
    if (keyword.length < 4) continue;
    const keywordEntries = await fetchCrtSh(env, `%25${keyword}%25`, true);
    const kResult = await processCertEntries(env, keywordEntries, brandId, domain, keywords, userId);
    total += kResult.total;
    suspicious += kResult.suspicious;
    newCerts += kResult.newCerts;
  }

  return { total, suspicious, newCerts };
}

// ─── crt.sh API ─────────────────────────────────────────────────

/**
 * Fetch certificates from crt.sh with caching and timeout.
 */
async function fetchCrtSh(
  env: Env,
  query: string,
  excludeExpired = false,
): Promise<CrtShEntry[]> {
  const cacheKey = `crtsh:${query}:${excludeExpired ? 'active' : 'all'}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as CrtShEntry[];
    } catch {
      // Cache corrupted, proceed to fetch
    }
  }

  let url = `https://crt.sh/?q=${query}&output=json`;
  if (excludeExpired) {
    url += '&exclude=expired';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRTSH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.error('ct_monitor_crtsh_error', { status: res.status, query });
      return [];
    }

    const text = await res.text();
    let entries: CrtShEntry[];
    try {
      entries = JSON.parse(text) as CrtShEntry[];
    } catch {
      logger.error('ct_monitor_crtsh_parse_error', { query, bodyLen: text.length });
      return [];
    }

    // Cache results for 1 hour
    await env.CACHE.put(cacheKey, JSON.stringify(entries.slice(0, 200)), {
      expirationTtl: KV_CACHE_TTL,
    });

    return entries.slice(0, 200);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      logger.error('ct_monitor_crtsh_timeout', { query });
    } else {
      logger.error('ct_monitor_crtsh_fetch_error', { query, error: String(err) });
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Certificate Processing ─────────────────────────────────────

async function processCertEntries(
  env: Env,
  entries: CrtShEntry[],
  brandId: string,
  officialDomain: string,
  keywords: string[],
  userId?: string,
): Promise<{ total: number; suspicious: number; newCerts: number }> {
  let total = 0;
  let suspicious = 0;
  let newCerts = 0;

  // Filter to only recent certificates (last 24 hours)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const entry of entries) {
    // Only process recently issued certificates
    if (entry.not_before && entry.not_before < cutoff) continue;

    total++;

    const fingerprint = `crtsh:${entry.id}:${entry.serial_number}`;

    // Check if already stored (by fingerprint)
    const existing = await env.DB.prepare(
      'SELECT id FROM ct_certificates WHERE fingerprint = ?'
    ).bind(fingerprint).first<{ id: string }>();

    if (existing) continue;

    const commonName = entry.common_name ?? '';
    const sanDomains = entry.name_value
      ? entry.name_value.split('\n').filter(Boolean)
      : [];

    // Determine if suspicious
    const isSuspicious = determineSuspicion(
      commonName,
      sanDomains,
      entry.issuer_name ?? '',
      officialDomain,
      keywords,
    );

    const certId = crypto.randomUUID();

    // Store in ct_certificates table
    await env.DB.prepare(
      `INSERT OR IGNORE INTO ct_certificates
       (id, brand_id, domain, issuer, subject_cn, san_domains, not_before, not_after,
        fingerprint, log_source, suspicious, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'crtsh', ?, 'new', datetime('now'))`
    ).bind(
      certId,
      brandId,
      commonName,
      entry.issuer_name ?? null,
      commonName,
      JSON.stringify(sanDomains),
      entry.not_before ?? null,
      entry.not_after ?? null,
      fingerprint,
      isSuspicious ? 1 : 0,
    ).run();

    newCerts++;

    // If suspicious, create alert
    if (isSuspicious) {
      suspicious++;

      const resolvedUserId = userId ?? await resolveUserForBrand(env, brandId);

      if (resolvedUserId) {
        try {
          const alertId = await createAlert(env.DB, {
            brandId,
            userId: resolvedUserId,
            alertType: 'ct_certificate_issued',
            severity: 'HIGH',
            title: `Suspicious certificate issued for: ${commonName}`,
            summary: `A certificate was issued for "${commonName}" by ${entry.issuer_name ?? 'unknown CA'}. ` +
              `This domain does not match your official domain (${officialDomain}) and may indicate ` +
              `phishing or brand impersonation.`,
            details: {
              domain: commonName,
              san_domains: sanDomains,
              issuer: entry.issuer_name,
              not_before: entry.not_before,
              not_after: entry.not_after,
              fingerprint,
              official_domain: officialDomain,
            },
            sourceType: 'ct_certificate',
            sourceId: certId,
          });

          // Update the certificate record with the alert ID
          await env.DB.prepare(
            'UPDATE ct_certificates SET alert_id = ? WHERE id = ?'
          ).bind(alertId, certId).run();
        } catch (err) {
          logger.error('ct_monitor_alert_error', {
            certId,
            domain: commonName,
            error: String(err),
          });
        }
      }
    }
  }

  return { total, suspicious, newCerts };
}

// ─── Suspicion Heuristics ───────────────────────────────────────

/**
 * Determine if a certificate is suspicious based on heuristics:
 * - Domain doesn't match any official brand domain
 * - Issued by a free CA (common for phishing sites)
 * - Contains brand keywords but is hosted elsewhere
 */
function determineSuspicion(
  commonName: string,
  sanDomains: string[],
  issuer: string,
  officialDomain: string,
  keywords: string[],
): boolean {
  const cn = commonName.toLowerCase();
  const official = officialDomain.toLowerCase();

  // If it's the official domain or a subdomain of it, it's benign
  if (cn === official || cn.endsWith(`.${official}`)) return false;
  for (const san of sanDomains) {
    const s = san.toLowerCase();
    if (s === official || s.endsWith(`.${official}`)) return false;
  }

  // Check if domain contains brand keywords but isn't the official domain
  const containsBrandKeyword = keywords.some(kw =>
    kw.length >= 4 && cn.includes(kw.toLowerCase())
  );

  // Also check if domain contains the brand's base domain name (without TLD)
  const officialBase = official.split('.')[0] ?? '';
  const containsBrandBase = officialBase.length >= 4 && cn.includes(officialBase);

  if (!containsBrandKeyword && !containsBrandBase) return false;

  // It contains a brand keyword/base but isn't the official domain — suspicious
  // Extra signal: free CA issuers are more suspicious
  const isFreeCa = FREE_CA_PATTERNS.some(p => p.test(issuer));

  // If it uses a free CA and contains brand keywords, definitely suspicious
  if (isFreeCa) return true;

  // Even with a paid CA, containing brand keywords on a different domain is suspicious
  return true;
}

// ─── Helpers ────────────────────────────────────────────────────

async function resolveUserForBrand(env: Env, brandId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT user_id FROM brand_profiles WHERE brand_id = ? LIMIT 1'
  ).bind(brandId).first<{ user_id: string }>();
  return row?.user_id ?? null;
}
