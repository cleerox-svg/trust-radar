/**
 * Lookalike Domain Scanner — Continuous monitoring for brand-impersonating domains.
 *
 * Generates permutations via dnstwist.ts, stores them in D1, and periodically
 * re-checks registration status via Cloudflare DoH. Newly registered domains
 * trigger AI assessment and alert creation.
 */

import { generatePermutations } from '../lib/dnstwist';
import { createAlert } from '../lib/alerts';
import { analyzeWithHaiku } from '../lib/haiku';
import { logger } from '../lib/logger';
import type { Env } from '../types';

// ─── Generate & Store ────────────────────────────────────────────

/**
 * Generate domain permutations for a brand and store them in the
 * lookalike_domains table. Uses INSERT OR IGNORE to avoid duplicates.
 * Returns the count of newly inserted permutations.
 */
export async function generateAndStoreLookalikes(
  env: Env,
  brandId: string,
  domain: string,
): Promise<number> {
  const permutations = generatePermutations(domain);
  if (permutations.length === 0) return 0;

  let inserted = 0;

  // Batch insert in groups of 10 to stay within D1 limits
  const BATCH = 10;
  for (let i = 0; i < permutations.length; i += BATCH) {
    const batch = permutations.slice(i, i + BATCH);
    const stmts = batch.map((perm) => {
      const id = crypto.randomUUID();
      return env.DB.prepare(
        `INSERT OR IGNORE INTO lookalike_domains (id, brand_id, domain, permutation_type)
         VALUES (?, ?, ?, ?)`,
      ).bind(id, brandId, perm.domain, perm.type);
    });

    const results = await env.DB.batch(stmts);
    for (const r of results) {
      if ((r.meta.changes ?? 0) > 0) inserted++;
    }
  }

  logger.info('lookalike_generate', {
    brand_id: brandId,
    domain,
    total_permutations: permutations.length,
    new_stored: inserted,
  });

  return inserted;
}

// ─── Batch Check (called by cron) ────────────────────────────────

/**
 * Check a batch of lookalike domains for registration changes.
 * Called by the cron orchestrator every hour.
 *
 * 1. Queries domains that haven't been checked in 24 hours (LIMIT 50).
 * 2. For each, checks A record, MX record, and web availability.
 * 3. For newly registered domains, requests AI assessment and creates alerts.
 */
export async function checkLookalikeBatch(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT ld.id, ld.brand_id, ld.domain, ld.permutation_type, ld.registered
     FROM lookalike_domains ld
     WHERE ld.last_checked IS NULL
        OR ld.last_checked < datetime('now', '-24 hours')
     ORDER BY ld.last_checked ASC NULLS FIRST
     LIMIT 50`,
  ).all<{
    id: string;
    brand_id: string;
    domain: string;
    permutation_type: string;
    registered: number;
  }>();

  if (rows.results.length === 0) {
    logger.info('lookalike_check', { message: 'no domains to check' });
    return;
  }

  let newRegistrations = 0;
  let totalChecked = 0;

  // Process in batches of 5 concurrent checks
  const CONCURRENCY = 5;
  for (let i = 0; i < rows.results.length; i += CONCURRENCY) {
    const batch = rows.results.slice(i, i + CONCURRENCY);
    const checks = batch.map(async (row) => {
      totalChecked++;
      const result = await checkDomain(row.domain);

      // Update the record
      await env.DB.prepare(
        `UPDATE lookalike_domains
         SET registered = ?,
             resolves_to = ?,
             has_mx = ?,
             has_web = ?,
             last_checked = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?`,
      ).bind(
        result.registered ? 1 : 0,
        result.ip ?? null,
        result.hasMx ? 1 : 0,
        result.hasWeb ? 1 : 0,
        row.id,
      ).run();

      // Detect NEWLY registered domains (was 0, now resolves)
      if (result.registered && row.registered === 0) {
        newRegistrations++;

        // Set first_seen
        await env.DB.prepare(
          `UPDATE lookalike_domains
           SET first_seen = datetime('now')
           WHERE id = ? AND first_seen IS NULL`,
        ).bind(row.id).run();

        // Get the brand info for context
        const brand = await env.DB.prepare(
          `SELECT bp.brand_name, bp.domain, bp.user_id
           FROM brand_profiles bp
           WHERE bp.id = ?`,
        ).bind(row.brand_id).first<{
          brand_name: string;
          domain: string;
          user_id: string;
        }>();

        if (!brand) return;

        // Request AI assessment
        let threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
        let aiAssessment = '';

        try {
          const aiResult = await analyzeWithHaiku(env,
            `Assess the threat level of this newly registered lookalike domain. Is it likely malicious brand impersonation or benign?
             Respond with JSON: {"threat_level": "LOW|MEDIUM|HIGH|CRITICAL", "assessment": "brief explanation", "indicators": ["list of suspicious indicators"]}`,
            {
              lookalike_domain: row.domain,
              original_domain: brand.domain,
              brand_name: brand.brand_name,
              permutation_type: row.permutation_type,
              resolves_to_ip: result.ip,
              has_mx_records: result.hasMx,
              has_web_server: result.hasWeb,
            },
          );

          if (aiResult.success && aiResult.data) {
            const structured = aiResult.data.structured as {
              threat_level?: string;
              assessment?: string;
            } | undefined;
            const responseText = aiResult.data.response ?? '';

            // Try to extract threat_level from structured data or response
            if (structured?.threat_level) {
              const level = structured.threat_level.toUpperCase();
              if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(level)) {
                threatLevel = level as typeof threatLevel;
              }
            }
            aiAssessment = structured?.assessment ?? responseText;
          }
        } catch (err) {
          logger.error('lookalike_ai_assessment_error', {
            domain: row.domain,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        // Boost threat level based on infrastructure signals
        if (result.hasMx && result.hasWeb && threatLevel === 'MEDIUM') {
          threatLevel = 'HIGH';
        }

        // Update threat level and AI assessment
        await env.DB.prepare(
          `UPDATE lookalike_domains
           SET threat_level = ?,
               ai_assessment = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
        ).bind(threatLevel, aiAssessment, row.id).run();

        // Create alert via alerts pipeline
        const severity = threatLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        const alertId = await createAlert(env.DB, {
          brandId: row.brand_id,
          userId: brand.user_id,
          alertType: 'lookalike_domain_active',
          severity,
          title: `Lookalike domain registered: ${row.domain}`,
          summary: `A domain similar to ${brand.domain} (${row.permutation_type} variant) has been registered and is now active. ${result.hasWeb ? 'It has a web server.' : ''} ${result.hasMx ? 'It has MX records configured for email.' : ''}`.trim(),
          details: {
            lookalike_domain: row.domain,
            original_domain: brand.domain,
            permutation_type: row.permutation_type,
            resolves_to: result.ip,
            has_mx: result.hasMx,
            has_web: result.hasWeb,
          },
          sourceType: 'lookalike_scanner',
          sourceId: row.id,
          aiAssessment: aiAssessment || undefined,
          aiRecommendations: threatLevel === 'CRITICAL' || threatLevel === 'HIGH'
            ? [
                'Investigate the domain for brand impersonation content',
                'Consider filing a UDRP complaint or takedown request',
                'Monitor for phishing emails from this domain',
                'Alert customers if the domain is actively being used for phishing',
              ]
            : [
                'Continue monitoring for content changes',
                'Check periodically for brand impersonation',
              ],
        });

        // Link the alert back to the lookalike record
        await env.DB.prepare(
          `UPDATE lookalike_domains SET alert_id = ? WHERE id = ?`,
        ).bind(alertId, row.id).run();
      }
    });

    await Promise.all(checks);
  }

  logger.info('lookalike_check', {
    checked: totalChecked,
    new_registrations: newRegistrations,
  });
}

// ─── DNS Check Helper ────────────────────────────────────────────

async function checkDomain(domain: string): Promise<{
  registered: boolean;
  ip?: string;
  hasMx: boolean;
  hasWeb: boolean;
}> {
  let ip: string | undefined;
  let registered = false;
  let hasMx = false;
  let hasWeb = false;

  // A record check via Cloudflare DoH
  try {
    const aRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (aRes.ok) {
      const data = (await aRes.json()) as { Answer?: Array<{ data: string }> };
      if (data.Answer && data.Answer.length > 0) {
        registered = true;
        ip = data.Answer[0]?.data;
      }
    }
  } catch {
    // DNS timeout or network error — treat as not registered
  }

  // MX record check via Cloudflare DoH
  try {
    const mxRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (mxRes.ok) {
      const data = (await mxRes.json()) as { Answer?: Array<{ data: string }> };
      if (data.Answer && data.Answer.length > 0) {
        hasMx = true;
        if (!registered) registered = true;
      }
    }
  } catch {
    // MX check failed — leave hasMx as false
  }

  // Web check: HEAD request with 3s timeout
  if (registered) {
    try {
      const webRes = await fetch(`https://${domain}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
        redirect: 'manual',
      });
      // Any response (including redirects) means there's a web server
      hasWeb = webRes.status > 0;
    } catch {
      // Try HTTP as fallback
      try {
        const httpRes = await fetch(`http://${domain}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(3000),
          redirect: 'manual',
        });
        hasWeb = httpRes.status > 0;
      } catch {
        // No web server
      }
    }
  }

  return { registered, ip, hasMx, hasWeb };
}
