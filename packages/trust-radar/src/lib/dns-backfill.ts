// DNS Backfill — resolve malicious domains to IP addresses.
//
// Uses Cloudflare DoH (1.1.1.1) via lib/domain-resolver.ts.
// Writes ip_address to the threats table; geo enrichment (lat/lng,
// country, ASN, hosting provider) is handled by Cartographer on its
// next hourly tick.
//
// Shared between:
//   1. POST /api/admin/backfill-domain-geo  (admin UI button)
//   2. The fast-tick cron (every 5 min)      (automated background drain)
//
// Never throws — always returns a structured result.

import type { Env } from '../types';
import { resolveToIp, extractHostname } from './domain-resolver';

export interface DnsBackfillResult {
  processed: number;
  resolved: number;
  enriched: number;
  durationMs: number;
  softCapHit: boolean;
}

export interface DnsBackfillOpts {
  /** Number of distinct domains to resolve per batch. Default 200. */
  batchSize?: number;
  /** Soft time cap in ms — stop starting new phases once exceeded. Default 8000. */
  timeoutMs?: number;
}

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_TIMEOUT_MS = 8000;
const CONCURRENCY = 25;

/**
 * Resolve one batch of unresolved malicious_domain values and write the
 * resulting IP addresses back to the threats table via db.batch().
 *
 * Geo enrichment is NOT performed here — Cartographer picks up the
 * newly-IP'd rows on its next scheduled run.
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
  const isOverCap = () => Date.now() - start > timeoutMs;

  const empty: DnsBackfillResult = {
    processed: 0, resolved: 0, enriched: 0, durationMs: 0, softCapHit: false,
  };

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
        AND (attempted_resolve_at IS NULL
             OR (attempted_resolve_at < datetime('now', '-7 days')
                 AND attempted_resolve_at > datetime('now', '-30 days')))
      LIMIT ?
    `).bind(batchSize).all<{ malicious_domain: string }>();

    const domains = batch.results.map((r) => r.malicious_domain);
    if (domains.length === 0) {
      return { ...empty, durationMs: Date.now() - start };
    }

    // ── Step 1: parallel DoH resolution, capped at CONCURRENCY ──
    const domainToIp = new Map<string, string>();
    const attempted = new Set<string>();
    let cursor = 0;
    let softCapHit = false;

    async function worker(): Promise<void> {
      while (cursor < domains.length) {
        if (isOverCap()) { softCapHit = true; return; }
        const i = cursor++;
        const domain = domains[i];
        if (!domain) continue;
        attempted.add(domain);
        const hostname = extractHostname(domain);
        if (!hostname) continue;
        const ip = await resolveToIp(hostname);
        if (ip) domainToIp.set(domain, ip);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, domains.length) }, () => worker()),
    );

    if (isOverCap()) softCapHit = true;
    const resolved = domainToIp.size;

    // ── Step 2: batch-write ip_address to threats via db.batch() ──
    // One round-trip per chunk instead of N individual UPDATEs.
    // Cartographer picks up these rows (enriched_at IS NULL, ip_address IS NOT NULL)
    // on its next hourly tick for geo/ASN/provider enrichment.
    let enriched = 0;
    if (resolved > 0 && !softCapHit) {
      const BATCH_CHUNK = 100;
      const entries = [...domainToIp.entries()];

      for (let i = 0; i < entries.length; i += BATCH_CHUNK) {
        if (isOverCap()) { softCapHit = true; break; }
        const chunk = entries.slice(i, i + BATCH_CHUNK);
        const stmts = chunk.map(([domain, ip]) =>
          env.DB.prepare(`
            UPDATE threats
            SET ip_address = ?, enriched_at = NULL
            WHERE malicious_domain = ?
              AND (ip_address IS NULL OR ip_address = '')
              AND status = 'active'
          `).bind(ip, domain),
        );
        try {
          const results = await env.DB.batch(stmts);
          for (const r of results) {
            enriched += r.meta?.changes ?? 0;
          }
        } catch (err) {
          console.error('[dns-backfill] batch ip_address write failed:', err);
        }
      }
    }

    if (isOverCap()) softCapHit = true;

    // ── Step 3: stamp attempted_resolve_at on ALL attempted domains ──
    // Prevents re-resolving dead domains every tick (7-day cooldown).
    if (attempted.size > 0) {
      const STAMP_CHUNK = 50;
      const attemptedArr = [...attempted];
      for (let i = 0; i < attemptedArr.length; i += STAMP_CHUNK) {
        if (isOverCap()) { softCapHit = true; break; }
        const chunk = attemptedArr.slice(i, i + STAMP_CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        try {
          await env.DB.prepare(`
            UPDATE threats
            SET attempted_resolve_at = datetime('now')
            WHERE malicious_domain IN (${placeholders})
              AND (ip_address IS NULL OR ip_address = '')
          `).bind(...chunk).run();
        } catch (err) {
          console.error('[dns-backfill] attempted_resolve_at stamp failed:', err);
        }
      }
    }

    return {
      processed: attempted.size,
      resolved,
      enriched,
      durationMs: Date.now() - start,
      softCapHit,
    };
  } catch (err) {
    console.error('[dns-backfill] Fatal error:', err);
    return { ...empty, durationMs: Date.now() - start };
  }
}
