import { logger } from '../lib/logger';
import { feedModules } from '../feeds/index';
import { createAlert } from '../lib/alerts';
import type { Env } from '../types';

interface CronJobResult {
  job: string;
  status: 'success' | 'error' | 'skipped';
  durationMs: number;
  details?: string;
}

export async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  const now = new Date();
  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const results: CronJobResult[] = [];

  // Every 30 minutes (minute 0 or 30): Threat feed scan
  if (minute === 0 || minute === 30) {
    const result = await runJob('threat_feed_scan', () => runThreatFeedScan(env));
    results.push(result);
  }

  // Every 6 hours (minute 0, hours 0/6/12/18): Social discovery + monitoring
  if (minute === 0 && hour % 6 === 0) {
    // Discovery first — so newly found handles get monitored in the same cycle
    const discoveryResult = await runJob('social_discovery', () => runSocialDiscovery(env));
    results.push(discoveryResult);

    const result = await runJob('social_monitor', () => runSocialMonitor(env));
    results.push(result);

    // After social monitor batch completes, run AI assessment on new findings
    const { runSentinelSocialAssessment } = await import('../agents/sentinel');
    await runSentinelSocialAssessment(env).catch(err =>
      logger.error('cron_sentinel_social_failed', { error: String(err) })
    );
  }

  // Daily at 06:00 UTC: Observer briefing + threat narratives
  if (minute === 0 && hour === 6) {
    const result = await runJob('observer_briefing', () => runObserverBriefing(env));
    results.push(result);

    // After Observer briefing: generate threat narratives for active brands with recent signals
    const narrativeResult = await runJob('threat_narratives', () => runThreatNarratives(env));
    results.push(narrativeResult);
  }

  // Every 5 minutes: CT certificate monitoring (lightweight — polls crt.sh)
  if (minute % 5 === 0) {
    const result = await runJob('ct_monitor', () => runCTMonitor(env));
    results.push(result);
  }

  // Every hour (minute 15): Lookalike domain checks
  if (minute === 15) {
    const result = await runJob('lookalike_check', () => runLookalikeDomainCheck(env));
    results.push(result);
  }

  // Log summary
  logger.info('cron_complete', {
    jobs_run: results.length,
    results: results.map(r => ({ job: r.job, status: r.status, ms: r.durationMs })),
  });

  // Store last cron run status in KV so the health endpoint can report it
  await env.CACHE.put('cron_last_run', JSON.stringify({
    timestamp: now.toISOString(),
    results,
  }), { expirationTtl: 7200 }); // 2 hour TTL
}

async function runJob(name: string, fn: () => Promise<void>): Promise<CronJobResult> {
  const start = Date.now();
  try {
    await fn();
    return { job: name, status: 'success', durationMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('cron_job_failed', { job: name, error: message });
    return { job: name, status: 'error', durationMs: Date.now() - start, details: message };
  }
}

// ─── Job Implementations ──────────────────────────────────────

async function runThreatFeedScan(env: Env): Promise<void> {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  // Geo enrichment
  try {
    const { enrichThreatsGeo } = await import('../lib/geoip');
    await enrichThreatsGeo(env.DB, env.CACHE);
  } catch (e) {
    logger.error('threat_feed_scan_geo_error', { error: e instanceof Error ? e.message : String(e) });
  }

  // Feed ingestion
  const { runAllFeeds } = await import('../lib/feedRunner');
  const feedResult = await runAllFeeds(env, feedModules);
  logger.info('threat_feed_scan_feeds', {
    feedsRun: feedResult.feedsRun,
    totalNew: feedResult.totalNew,
    feedsFailed: feedResult.feedsFailed,
    feedsSkipped: feedResult.feedsSkipped,
  });

  // Enrichment pipeline
  try {
    const { runEnrichmentPipeline } = await import('../lib/enrichment');
    const enrichResult = await runEnrichmentPipeline(env);
    logger.info('threat_feed_scan_enrichment', {
      dnsResolved: enrichResult.dnsResolved,
      geoEnriched: enrichResult.geoEnriched,
      whoisEnriched: enrichResult.whoisEnriched,
      brandsMatched: enrichResult.brandsMatched,
      domainRanksChecked: enrichResult.domainRanksChecked,
    });
  } catch (err) {
    logger.error('threat_feed_scan_enrichment_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // Brand match backfill (2 rounds)
  try {
    const { runBrandMatchBackfill } = await import('../handlers/admin');
    const pendingRow = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM threats WHERE target_brand_id IS NULL AND (malicious_domain IS NOT NULL OR malicious_url IS NOT NULL OR ioc_value IS NOT NULL)"
    ).first<{ n: number }>();
    const pending = pendingRow?.n ?? 0;
    if (pending > 0) {
      let totalMatched = 0;
      for (let i = 0; i < 2; i++) {
        const bf = await runBrandMatchBackfill(env);
        totalMatched += bf.matched;
        if (bf.pending === 0 || bf.checked === 0) break;
      }
      logger.info('threat_feed_scan_brand_match', { pending, matched: totalMatched });
    }
  } catch (err) {
    logger.error('threat_feed_scan_brand_match_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // Email security scan (10 brands/cycle)
  try {
    const pendingEmail = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM brands WHERE email_security_scanned_at IS NULL AND canonical_domain IS NOT NULL"
    ).first<{ n: number }>();
    const emailPending = pendingEmail?.n ?? 0;
    if (emailPending > 0) {
      const { runEmailSecurityScan, saveEmailSecurityScan } = await import('../email-security');
      const brandsToScan = await env.DB.prepare(`
        SELECT b.id, COALESCE(b.canonical_domain, LOWER(b.name)) AS domain
        FROM brands b
        LEFT JOIN threats t ON t.target_brand_id = b.id AND t.status = 'active'
        WHERE b.email_security_scanned_at IS NULL
          AND (b.canonical_domain IS NOT NULL OR b.name IS NOT NULL)
        GROUP BY b.id
        ORDER BY COUNT(t.id) DESC
        LIMIT 10
      `).all<{ id: number; domain: string }>();
      let scanned = 0;
      for (const brand of brandsToScan.results) {
        try {
          const scanResult = await runEmailSecurityScan(brand.domain);
          await saveEmailSecurityScan(env.DB, brand.id, scanResult);
          await env.DB.prepare(
            "UPDATE brands SET email_security_score = ?, email_security_grade = ?, email_security_scanned_at = datetime('now') WHERE id = ?"
          ).bind(scanResult.score, scanResult.grade, brand.id).run();
          scanned++;
        } catch (e) {
          logger.error('threat_feed_scan_email_security_brand_error', { domain: brand.domain, error: e instanceof Error ? e.message : String(e) });
        }
      }
      logger.info('threat_feed_scan_email_security', { pending: emailPending, scanned });
    }
  } catch (err) {
    logger.error('threat_feed_scan_email_security_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // Email grade change detection — compare latest scan with previous grade
  try {
    const gradeChanges = await env.DB.prepare(`
      SELECT b.id AS brand_id, b.name, b.email_security_grade AS current_grade,
             ess.email_security_grade AS previous_grade
      FROM brands b
      JOIN email_security_scans ess ON ess.brand_id = b.id
      WHERE b.email_security_grade IS NOT NULL
        AND ess.email_security_grade IS NOT NULL
        AND b.email_security_grade != ess.email_security_grade
        AND ess.scanned_at < b.email_security_scanned_at
        AND ess.scanned_at = (
          SELECT MAX(e2.scanned_at) FROM email_security_scans e2
          WHERE e2.brand_id = b.id AND e2.scanned_at < b.email_security_scanned_at
        )
    `).all<{ brand_id: string; name: string; current_grade: string; previous_grade: string }>();

    for (const change of gradeChanges.results) {
      // Check if we already created an alert for this grade transition recently
      const existing = await env.DB.prepare(
        `SELECT id FROM alerts
         WHERE brand_id = ? AND alert_type = 'email_grade_change'
           AND created_at >= datetime('now', '-24 hours')
         LIMIT 1`
      ).bind(change.brand_id).first<{ id: string }>();

      if (existing) continue;

      // Determine severity based on direction and resulting grade
      const degraded = ['F', 'D'].includes(change.current_grade);
      const severity = degraded ? 'HIGH' : 'MEDIUM';

      // Look up the brand owner (user_id) for the alert
      const brandOwner = await env.DB.prepare(
        `SELECT user_id FROM brand_profiles WHERE brand_id = ? LIMIT 1`
      ).bind(change.brand_id).first<{ user_id: string }>();

      const userId = brandOwner?.user_id ?? 'system';

      await createAlert(env.DB, {
        brandId: change.brand_id,
        userId,
        alertType: 'email_grade_change',
        severity: severity as 'HIGH' | 'MEDIUM',
        title: `Email security grade changed: ${change.previous_grade} → ${change.current_grade}`,
        summary: `${change.name} email security grade changed from ${change.previous_grade} to ${change.current_grade}.${degraded ? ' The domain now has weak spoofing protection — phishing attacks are more likely to succeed.' : ''}`,
        details: {
          brand_name: change.name,
          previous_grade: change.previous_grade,
          current_grade: change.current_grade,
        },
        sourceType: 'email_security_scan',
      });

      logger.info('email_grade_change_alert', {
        brand_id: change.brand_id,
        brand_name: change.name,
        previous_grade: change.previous_grade,
        current_grade: change.current_grade,
        severity,
      });
    }

    if (gradeChanges.results.length > 0) {
      logger.info('email_grade_change_detection', { changes_detected: gradeChanges.results.length });
    }
  } catch (err) {
    logger.error('email_grade_change_detection_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // AI attribution (1 batch of 50)
  try {
    const unmatchedCount = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM threats WHERE target_brand_id IS NULL AND threat_type IN ('phishing','credential_harvesting','typosquatting','impersonation')"
    ).first<{ n: number }>();
    const unmatched = unmatchedCount?.n ?? 0;
    if (unmatched > 500) {
      const today = new Date().toISOString().slice(0, 10);
      const attrCallsToday = parseInt(await env.CACHE.get(`ai_attr_calls_${today}`) || '0', 10);
      if (attrCallsToday < 20) {
        const { runAiAttribution } = await import('../handlers/admin');
        const attrResult = await runAiAttribution(env, 50);
        logger.info('threat_feed_scan_ai_attribution', {
          attributed: attrResult.attributed,
          calls: attrResult.calls,
          costUsd: attrResult.costUsd,
        });
      }
    }
  } catch (err) {
    logger.error('threat_feed_scan_ai_attribution_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // Threat feed sync (PhishTank, URLhaus signals)
  try {
    const { runThreatFeedSync } = await import('../threat-feeds');
    const syncResult = await runThreatFeedSync(env);
    logger.info('threat_feed_scan_sync', {
      phishtank: `${syncResult.phishtank.matched}/${syncResult.phishtank.fetched}`,
      urlhaus: `${syncResult.urlhaus.matched}/${syncResult.urlhaus.fetched}`,
    });
  } catch (err) {
    logger.error('threat_feed_scan_sync_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // ─── AI Agents ─────────────────────────────────────────────────
  const { agentModules: allAgents } = await import('../agents/index');
  const { executeAgent } = await import('../lib/agentRunner');

  // Sentinel: event-triggered on new data
  if (feedResult.totalNew > 0) {
    try {
      const mod = allAgents["sentinel"];
      if (mod) {
        await executeAgent(env, mod, { newItems: feedResult.totalNew }, "cron", "event");
      }
    } catch (err) {
      logger.error('threat_feed_scan_sentinel_error', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Analyst agent — runs every 15 minutes (checked within 30-min window)
  if (minute % 15 < 5) {
    try {
      const mod = allAgents["analyst"];
      if (mod) {
        await executeAgent(env, mod, {}, "cron", "scheduled");
      }
    } catch (err) {
      logger.error('threat_feed_scan_analyst_error', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Strategist — every 6 hours, minute 5-10 (staggered)
  if (hour % 6 === 0 && minute >= 5 && minute < 10) {
    try {
      const mod = allAgents["strategist"];
      if (mod) {
        await executeAgent(env, mod, {}, "cron", "scheduled");
      }
    } catch (err) {
      logger.error('threat_feed_scan_strategist_error', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Cartographer — every 6 hours, minute 10-15 (staggered)
  if (hour % 6 === 0 && minute >= 10 && minute < 15) {
    try {
      const mod = allAgents["cartographer"];
      if (mod) {
        await executeAgent(env, mod, {}, "cron", "scheduled");
      }
    } catch (err) {
      logger.error('threat_feed_scan_cartographer_error', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Sparrow (takedown agent) — every 6 hours, minute 15-20 (staggered after cartographer)
  if (hour % 6 === 0 && minute >= 15 && minute < 20) {
    try {
      const mod = allAgents["sparrow"];
      if (mod) {
        await executeAgent(env, mod, {}, "cron", "scheduled");
      }
    } catch (err) {
      logger.error('cron_sparrow_error', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Observer + daily assessments — daily at midnight UTC
  if (hour === 0 && minute < 5) {
    try {
      const mod = allAgents["observer"];
      if (mod) {
        await executeAgent(env, mod, {}, "cron", "scheduled");
      }
    } catch (err) {
      logger.error('threat_feed_scan_observer_error', { error: err instanceof Error ? err.message : String(err) });
    }

    try {
      const { runDailyAssessments } = await import('../brand-threat-correlator');
      const assessResult = await runDailyAssessments(env);
      logger.info('threat_feed_scan_daily_assessments', {
        brandsAssessed: assessResult.brandsAssessed,
        highRiskBrands: assessResult.highRiskBrands,
        scoreSpikes: assessResult.scoreSpikes,
      });
    } catch (err) {
      logger.error('threat_feed_scan_daily_assessments_error', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Prospector agent — daily at 03:00 UTC (KV throttle ensures once per 7 days)
  if (hour === 3 && minute < 5) {
    try {
      const prospectorMod = allAgents["prospector"];
      if (prospectorMod) {
        await executeAgent(env, prospectorMod, {}, "cron", "scheduled");
      }
    } catch (err) {
      logger.error('threat_feed_scan_prospector_error', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Daily snapshots — generate if none exist today
  try {
    const { generateDailySnapshots } = await import('../lib/snapshots');
    const today = new Date().toISOString().slice(0, 10);
    const hasSnapshotToday = await env.DB.prepare(
      "SELECT COUNT(*) as n FROM daily_snapshots WHERE date = ?"
    ).bind(today).first<{ n: number }>();
    if ((hour === 0 && minute < 5) || (hasSnapshotToday?.n ?? 0) === 0) {
      await generateDailySnapshots(env.DB, today);
    }
  } catch (err) {
    logger.error('threat_feed_scan_snapshots_error', { error: err instanceof Error ? err.message : String(err) });
  }
}

async function runSocialDiscovery(env: Env): Promise<void> {
  const { runSocialDiscoveryBatch } = await import('../scanners/social-monitor');
  await runSocialDiscoveryBatch(env);
}

async function runSocialMonitor(env: Env): Promise<void> {
  const { runSocialMonitorBatch } = await import('../scanners/social-monitor');
  await runSocialMonitorBatch(env);
}

async function runObserverBriefing(env: Env): Promise<void> {
  // Daily Tranco import + brand matching (runs at 06:00 UTC)
  try {
    const { handleImportTranco, runBrandMatchBackfill } = await import('../handlers/admin');
    const fakeReq = new Request('https://localhost/api/admin/import-tranco', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 10000 }),
    });
    const trancoRes = await handleImportTranco(fakeReq, env);
    const trancoData = await trancoRes.json() as { success: boolean; data?: { imported: number; message: string } };
    logger.info('observer_briefing_tranco', { message: trancoData.data?.message ?? 'unknown' });
    if (trancoData.data?.imported && trancoData.data.imported > 0) {
      let postImportMatched = 0;
      for (let i = 0; i < 5; i++) {
        const bf = await runBrandMatchBackfill(env);
        postImportMatched += bf.matched;
        if (bf.pending === 0 || bf.checked === 0) break;
      }
      logger.info('observer_briefing_post_tranco_match', { matched: postImportMatched });
    }
  } catch (err) {
    logger.error('observer_briefing_tranco_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // Seed Strategist agent
  try {
    const { seedStrategistAgent } = await import('../agents/seed-strategist');
    const { executeAgent } = await import('../lib/agentRunner');
    await executeAgent(env, seedStrategistAgent, {}, "cron", "scheduled");
  } catch (err) {
    logger.error('observer_briefing_seed_strategist_error', { error: err instanceof Error ? err.message : String(err) });
  }
}

async function runCTMonitor(env: Env): Promise<void> {
  const { pollCertificates } = await import('../scanners/ct-monitor');
  await pollCertificates(env);
}

async function runLookalikeDomainCheck(env: Env): Promise<void> {
  const { checkLookalikeBatch } = await import('../scanners/lookalike-domains');
  await checkLookalikeBatch(env);
}

async function runThreatNarratives(env: Env): Promise<void> {
  const { generateNarrativesForBrand } = await import('../agents/narrator');

  // Find active brands that have recent signals (last 7 days) from at least 2 sources
  const brandsWithSignals = await env.DB.prepare(`
    SELECT b.id, b.name,
      (SELECT COUNT(*) FROM threats t WHERE t.target_brand_id = b.id AND t.created_at >= datetime('now', '-7 days')) as threat_count,
      (SELECT COUNT(*) FROM social_monitor_results smr WHERE smr.brand_id = b.id AND smr.found_at >= datetime('now', '-7 days')) as social_count,
      (SELECT COUNT(*) FROM lookalike_domains ld WHERE ld.brand_id = b.id AND ld.registered = 1 AND ld.created_at >= datetime('now', '-7 days')) as lookalike_count,
      (SELECT COUNT(*) FROM ct_certificates ct WHERE ct.brand_id = b.id AND ct.suspicious = 1 AND ct.not_before >= datetime('now', '-7 days')) as ct_count
    FROM brands b
    WHERE b.threat_count > 0
    ORDER BY b.threat_count DESC
    LIMIT 20
  `).all<{
    id: string; name: string;
    threat_count: number; social_count: number;
    lookalike_count: number; ct_count: number;
  }>();

  let generated = 0;
  for (const brand of brandsWithSignals.results) {
    // Count distinct signal types
    let signalTypes = 0;
    if (brand.threat_count > 0) signalTypes++;
    if (brand.social_count > 0) signalTypes++;
    if (brand.lookalike_count > 0) signalTypes++;
    if (brand.ct_count > 0) signalTypes++;

    // Only generate if at least 2 signal types (email security is checked inside generateNarrativesForBrand)
    if (signalTypes < 2) continue;

    // Check if we already generated a narrative for this brand in the last 24 hours
    const existing = await env.DB.prepare(
      `SELECT id FROM threat_narratives WHERE brand_id = ? AND created_at >= datetime('now', '-24 hours') LIMIT 1`
    ).bind(brand.id).first();
    if (existing) continue;

    try {
      await generateNarrativesForBrand(env, brand.id);
      generated++;
    } catch (err) {
      logger.error('threat_narrative_brand_error', {
        brand_id: brand.id,
        brand_name: brand.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Limit to 5 narrative generations per cron run to control API costs
    if (generated >= 5) break;
  }

  logger.info('threat_narratives_complete', {
    brands_checked: brandsWithSignals.results.length,
    narratives_generated: generated,
  });
}
