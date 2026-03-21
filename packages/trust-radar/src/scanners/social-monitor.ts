/**
 * Social Brand Monitoring Pipeline
 *
 * Scans social media platforms for handle squatting and impersonation
 * of monitored brands. Runs on a cron schedule (every 6 hours) and
 * can be triggered on-demand per brand.
 */

import type { Env } from '../types';
import { checkSocialHandles, type SocialCheckResult } from '../lib/social-check';
import { generateHandlePermutations } from '../lib/handle-permutations';
import { scoreImpersonation, nameSimilarity, type ImpersonationSignals } from './impersonation-scorer';
import { createAlert } from '../lib/alerts';
import { logger } from '../lib/logger';

// ─── Types ──────────────────────────────────────────────────────

export interface SocialMonitorResult {
  brandId: string;
  platform: string;
  checkType: 'handle_check' | 'impersonation_scan';
  handleChecked: string;
  handleAvailable: boolean | null;
  suspiciousAccountUrl?: string;
  suspiciousAccountName?: string;
  impersonationScore: number;  // 0.0-1.0
  impersonationSignals: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const SUPPORTED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'github', 'youtube'] as const;

const PLATFORM_URL_TEMPLATES: Record<string, (handle: string) => string> = {
  twitter: (h) => `https://x.com/${h}`,
  instagram: (h) => `https://www.instagram.com/${h}/`,
  linkedin: (h) => `https://www.linkedin.com/company/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  github: (h) => `https://github.com/${h}`,
  youtube: (h) => `https://www.youtube.com/@${h}`,
};

/** Maximum permutations to check per platform per brand to avoid rate limiting */
const MAX_PERMUTATIONS_PER_PLATFORM = 10;

// ─── Single Brand Monitor ───────────────────────────────────────

/**
 * Run social monitoring for a single brand.
 * Checks official handle status and scans for impersonation via permutations.
 */
export async function runSocialMonitorForBrand(
  env: Env,
  brand: { id: string; brand_name: string; domain: string; official_handles: string },
): Promise<SocialMonitorResult[]> {
  const results: SocialMonitorResult[] = [];

  // Parse official handles
  let officialHandles: Record<string, string> = {};
  try {
    officialHandles = brand.official_handles ? JSON.parse(brand.official_handles) : {};
  } catch {
    officialHandles = {};
  }

  // Generate permutations from the brand name
  const permutations = generateHandlePermutations(brand.brand_name);

  // Extract brand keywords for impersonation signal detection
  const brandKeywords = [
    brand.brand_name.toLowerCase(),
    brand.domain.split('.')[0]!.toLowerCase(),
    brand.brand_name.toLowerCase().replace(/\s+/g, ''),
  ];

  for (const platform of SUPPORTED_PLATFORMS) {
    const officialHandle = officialHandles[platform]?.replace(/^@/, '') ?? null;

    // 1. Check official handle status
    if (officialHandle) {
      const checkResults = await checkSocialHandles(officialHandle);
      const platformResult = checkResults.find((r) => r.platform === platform);

      if (platformResult) {
        results.push({
          brandId: brand.id,
          platform,
          checkType: 'handle_check',
          handleChecked: officialHandle,
          handleAvailable: platformResult.available,
          impersonationScore: 0,
          impersonationSignals: [],
          severity: platformResult.available === true ? 'HIGH' : 'LOW',
        });
      }
    }

    // 2. Check top permutations for squatting / impersonation
    const permutationsToCheck = permutations.slice(0, MAX_PERMUTATIONS_PER_PLATFORM);

    for (const perm of permutationsToCheck) {
      // Skip if this permutation IS the official handle
      if (officialHandle && perm.handle.toLowerCase() === officialHandle.toLowerCase()) {
        continue;
      }

      try {
        const checkResults = await checkSocialHandles(perm.handle);
        const platformResult = checkResults.find((r) => r.platform === platform);

        if (!platformResult || platformResult.available !== false) {
          // Handle is available or couldn't check — not a threat
          continue;
        }

        // Handle exists — score impersonation risk
        const signals: ImpersonationSignals = {
          name_similarity: nameSimilarity(brand.brand_name, perm.handle),
          uses_brand_keywords: brandKeywords.some((kw) => perm.handle.toLowerCase().includes(kw)),
          account_age_suspicious: false,  // Cannot determine from HEAD request
          low_followers: false,           // Cannot determine from HEAD request
          verified: false,               // Assume not verified (conservative)
          handle_is_permutation: true,    // By definition
        };

        const impersonationResult = scoreImpersonation(signals);

        // Only report if score indicates at least MEDIUM risk
        if (impersonationResult.score >= 0.3) {
          const urlTemplate = PLATFORM_URL_TEMPLATES[platform];
          results.push({
            brandId: brand.id,
            platform,
            checkType: 'impersonation_scan',
            handleChecked: perm.handle,
            handleAvailable: false,
            suspiciousAccountUrl: urlTemplate ? urlTemplate(perm.handle) : undefined,
            suspiciousAccountName: perm.handle,
            impersonationScore: impersonationResult.score,
            impersonationSignals: impersonationResult.reasons,
            severity: impersonationResult.severity,
          });
        }
      } catch (err) {
        // Network errors for individual checks — skip and continue
        logger.warn('social_monitor_permutation_error', {
          brand_id: brand.id,
          platform,
          handle: perm.handle,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return results;
}

// ─── Batch Monitor (Cron) ───────────────────────────────────────

/**
 * Run social monitoring for all brands due for a check.
 * Called by the cron orchestrator every 6 hours.
 */
export async function runSocialMonitorBatch(env: Env): Promise<void> {
  const now = new Date().toISOString();

  // 1. Query brands that are due for social monitoring
  const brands = await env.DB.prepare(`
    SELECT DISTINCT bp.id, bp.brand_name, bp.domain, bp.official_handles, bp.user_id
    FROM brand_profiles bp
    INNER JOIN social_monitor_schedule sms ON sms.brand_id = bp.id
    WHERE bp.status = 'active'
      AND sms.enabled = 1
      AND (sms.next_check IS NULL OR sms.next_check <= ?)
    ORDER BY sms.next_check ASC
    LIMIT 50
  `).bind(now).all<{
    id: string;
    brand_name: string;
    domain: string;
    official_handles: string;
    user_id: string;
  }>();

  if (brands.results.length === 0) {
    logger.info('social_monitor_batch', { message: 'No brands due for monitoring', checked_at: now });
    return;
  }

  logger.info('social_monitor_batch_start', { brands_count: brands.results.length });

  let totalResults = 0;
  let totalAlerts = 0;
  let brandsProcessed = 0;

  for (const brand of brands.results) {
    try {
      // 2. Run monitoring for this brand
      const results = await runSocialMonitorForBrand(env, {
        id: brand.id,
        brand_name: brand.brand_name,
        domain: brand.domain,
        official_handles: brand.official_handles,
      });

      // 3. Store results in social_monitor_results
      for (const result of results) {
        const resultId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO social_monitor_results
            (id, brand_id, platform, check_type, handle_checked, handle_available,
             suspicious_account_url, suspicious_account_name,
             impersonation_score, impersonation_signals, severity, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
        `).bind(
          resultId,
          result.brandId,
          result.platform,
          result.checkType,
          result.handleChecked,
          result.handleAvailable === null ? null : result.handleAvailable ? 1 : 0,
          result.suspiciousAccountUrl ?? null,
          result.suspiciousAccountName ?? null,
          result.impersonationScore,
          JSON.stringify(result.impersonationSignals),
          result.severity,
        ).run();

        // 4. Create alerts for HIGH/CRITICAL severity
        if (result.severity === 'HIGH' || result.severity === 'CRITICAL') {
          try {
            await createAlert(env.DB, {
              brandId: brand.id,
              userId: brand.user_id,
              alertType: 'social_impersonation',
              severity: result.severity,
              title: `${result.severity === 'CRITICAL' ? 'Likely' : 'Possible'} impersonation on ${result.platform}: @${result.handleChecked}`,
              summary: `A ${result.platform} account "${result.handleChecked}" was detected that may be impersonating ${brand.brand_name}. Impersonation score: ${(result.impersonationScore * 100).toFixed(0)}%.`,
              details: {
                platform: result.platform,
                handle: result.handleChecked,
                url: result.suspiciousAccountUrl,
                score: result.impersonationScore,
                signals: result.impersonationSignals,
                check_type: result.checkType,
              },
              sourceType: 'social_monitor',
              sourceId: resultId,
            });
            totalAlerts++;
          } catch (alertErr) {
            logger.error('social_monitor_alert_error', {
              brand_id: brand.id,
              error: alertErr instanceof Error ? alertErr.message : String(alertErr),
            });
          }
        }

        totalResults++;
      }

      // 5. Update schedule: set last_checked and compute next_check
      await env.DB.prepare(`
        UPDATE social_monitor_schedule
        SET last_checked = ?,
            next_check = datetime(?, '+' || check_interval_hours || ' hours')
        WHERE brand_id = ? AND enabled = 1
      `).bind(now, now, brand.id).run();

      brandsProcessed++;
    } catch (brandErr) {
      logger.error('social_monitor_brand_error', {
        brand_id: brand.id,
        brand_name: brand.brand_name,
        error: brandErr instanceof Error ? brandErr.message : String(brandErr),
      });
    }
  }

  logger.info('social_monitor_batch_complete', {
    brands_processed: brandsProcessed,
    total_results: totalResults,
    total_alerts: totalAlerts,
  });
}
