// DNS Backfill — resolve malicious domains -> IP -> geo + hosting provider.
//
// Extracted from handlers/admin.ts handleBackfillDomainGeo so the same
// per-batch logic can run from both:
//   1. POST /api/admin/backfill-domain-geo  (admin UI button)
//   2. The fast-tick cron (every 5 min)      (automated background drain)
//
// Uses Cloudflare DoH (1.1.1.1) via lib/domain-resolver.ts.
// Never throws — always returns a structured result.

import type { Env } from '../types';
import { resolveToIp, extractHostname } from './domain-resolver';
import {
  batchGeoLookup,
  normalizeProvider,
  upsertHostingProvider,
  isPrivateIP,
} from './geoip';

export interface DnsBackfillResult {
  processed: number;
  resolved: number;
  failed: number;
  enriched: number;
  durationMs: number;
}

export interface DnsBackfillOpts {
  /** Number of distinct domains to resolve per batch. Default 200. */
  batchSize?: number;
  /** Hard timeout in ms — stop processing if elapsed exceeds this. Default 8000. */
  timeoutMs?: number;
}

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_TIMEOUT_MS = 8000;
const CONCURRENCY = 20;

/**
 * Resolve one batch of unresolved malicious_domain values, geo-enrich
 * the resulting IPs, and bulk-update the threats table.
 *
 * Safe to call from cron — never throws.
 */
export async function runDomainGeoBackfillBatch(
  env: Env,
  opts?: DnsBackfillOpts,
): Promise<DnsBackfillResult> {
  const start = Date.now();
  const batchSize = opts?.batchSize ?? DEFAULT_BATCH_SIZE;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const empty: DnsBackfillResult = { processed: 0, resolved: 0, failed: 0, enriched: 0, durationMs: 0 };

  try {
    // ── Fetch next batch of unique unresolved domains ──
    const batch = await env.DB.prepare(`
      SELECT DISTINCT malicious_domain
      FROM threats
      WHERE (ip_address IS NULL OR ip_address = '')
        AND malicious_domain IS NOT NULL
        AND malicious_domain != ''
        AND malicious_domain NOT LIKE '*%'
        AND malicious_domain LIKE '%.%'
      LIMIT ?
    `).bind(batchSize).all<{ malicious_domain: string }>();

    const domains = batch.results.map((r) => r.malicious_domain);
    if (domains.length === 0) {
      return { ...empty, durationMs: Date.now() - start };
    }

    // ── Step 1: parallel DoH resolution, capped at CONCURRENCY ──
    const domainToIp = new Map<string, string>();
    let cursor = 0;

    async function worker(): Promise<void> {
      while (cursor < domains.length) {
        // Hard timeout guard
        if (Date.now() - start > timeoutMs) return;
        const i = cursor++;
        const domain = domains[i];
        if (!domain) continue;
        const hostname = extractHostname(domain);
        if (!hostname) continue;
        const ip = await resolveToIp(hostname);
        if (ip) domainToIp.set(domain, ip);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, domains.length) }, () => worker()),
    );

    const resolved = domainToIp.size;
    const failed = domains.length - resolved;

    // Bail early if we've burned through the timeout on resolution alone
    if (Date.now() - start > timeoutMs) {
      return { processed: domains.length, resolved, failed, enriched: 0, durationMs: Date.now() - start };
    }

    // ── Step 2: batch geo lookup for unique public IPs ──
    const uniqueIps = [...new Set(domainToIp.values())].filter((ip) => !isPrivateIP(ip));
    const { results: geoMap } = await batchGeoLookup(
      uniqueIps,
      env.CACHE,
      env.IPINFO_TOKEN,
    );

    // Resolve hosting provider IDs once per unique IP with geo
    const ipToProviderId = new Map<string, string | null>();
    for (const [ip, geo] of geoMap) {
      if (Date.now() - start > timeoutMs) break;
      const providerName = normalizeProvider(geo.isp, geo.org);
      if (!providerName) {
        ipToProviderId.set(ip, null);
        continue;
      }
      try {
        const providerId = await upsertHostingProvider(
          env.DB,
          providerName,
          geo.as,
          geo.countryCode,
        );
        ipToProviderId.set(ip, providerId);
      } catch {
        ipToProviderId.set(ip, null);
      }
    }

    // ── Step 3: bulk-update all threats sharing each resolved domain ──
    let enriched = 0;
    for (const [domain, ip] of domainToIp) {
      if (Date.now() - start > timeoutMs) break;

      const geo = geoMap.get(ip);
      const providerId = ipToProviderId.get(ip) ?? null;
      const countryCode = geo?.countryCode ?? null;
      const lat = geo?.lat ?? null;
      const lng = geo?.lng ?? null;
      const asn = geo?.as ?? null;

      try {
        await env.DB.prepare(`
          UPDATE threats
          SET
            ip_address = ?,
            lat = COALESCE(?, lat),
            lng = COALESCE(?, lng),
            country_code = COALESCE(?, country_code),
            asn = COALESCE(?, asn),
            hosting_provider_id = COALESCE(?, hosting_provider_id)
          WHERE malicious_domain = ?
            AND (ip_address IS NULL OR ip_address = '')
        `).bind(ip, lat, lng, countryCode, asn, providerId, domain).run();
        enriched++;
      } catch (err) {
        console.error(`[dns-backfill] update failed for ${domain}:`, err);
      }
    }

    // Keep provider counts in sync (best effort)
    try {
      await env.DB.prepare(`
        UPDATE hosting_providers SET
          active_threat_count = (SELECT COUNT(*) FROM threats WHERE threats.hosting_provider_id = hosting_providers.id AND threats.status = 'active'),
          total_threat_count = (SELECT COUNT(*) FROM threats WHERE threats.hosting_provider_id = hosting_providers.id)
      `).run();
    } catch { /* non-critical */ }

    return {
      processed: domains.length,
      resolved,
      failed,
      enriched,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    console.error('[dns-backfill] Fatal error:', err);
    return { ...empty, durationMs: Date.now() - start };
  }
}
