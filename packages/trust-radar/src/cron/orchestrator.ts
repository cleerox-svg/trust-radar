import { logger } from '../lib/logger';
import { feedModules, enrichmentModules, socialModules } from '../feeds/index';
import { createAlert } from '../lib/alerts';
import type { Env } from '../types';

interface CronJobResult {
  job: string;
  status: 'success' | 'error' | 'skipped';
  durationMs: number;
  details?: string;
}

export async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  // ─── Fast tick: lightweight sub-hour cron (*/5 * * * *, 30s CPU ceiling) ───
  // Must branch BEFORE any heavy work — Flight Control, CertStream, etc.
  if (event.cron === '*/5 * * * *') {
    const { runFastTick } = await import('./fast-tick');
    return runFastTick(env, ctx);
  }

  // ─── Hourly tick: full agent mesh (0 * * * *, 15min CPU ceiling) ───

  // ─── Flight Control: autonomous supervisor runs first every tick ───
  try {
    const { flightControlAgent } = await import('../agents/flightControl');
    const { executeAgent } = await import('../lib/agentRunner');
    await executeAgent(env, flightControlAgent, {}, 'cron', 'scheduled');
  } catch (err) {
    logger.error('flight_control_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // ─── CertStream: ensure persistent DO connection is alive ───
  try {
    const csId = env.CERTSTREAM_MONITOR.idFromName('certstream-primary');
    const csStub = env.CERTSTREAM_MONITOR.get(csId);
    const csResponse = await csStub.fetch(new Request('https://internal/start'));
    const csStatus = await csResponse.json() as { status: string; stats?: { connected: boolean; certsProcessed: number; certsMatched: number; errors: number } };
    console.log(`[cron] CertStream pinged — status=${csStatus.status}, connected=${csStatus.stats?.connected}, processed=${csStatus.stats?.certsProcessed}, matched=${csStatus.stats?.certsMatched}, errors=${csStatus.stats?.errors}`);

    // Log to agent_activity_log for Flight Control visibility
    await logFlightControlActivity(env, 'health_check', `CertStream DO: ${csStatus.status}`, {
      connected: csStatus.stats?.connected,
      certsProcessed: csStatus.stats?.certsProcessed,
      certsMatched: csStatus.stats?.certsMatched,
      errors: csStatus.stats?.errors,
    }, csStatus.stats?.connected ? 'info' : 'warning');
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[cron] CertStream ping failed:', errMsg);
    logger.error('certstream_ping_failed', { error: errMsg });
    await logFlightControlActivity(env, 'health_check', `CertStream DO ping failed: ${errMsg}`, { error: errMsg }, 'warning');
  }

  // ─── Flight Control v1: consume pending agent_events before cron jobs ───
  await processAgentEvents(env, ctx);

  // Use scheduledTime (the intended cron fire time) — NOT new Date().
  // Pre-work (Flight Control, CertStream, event processing) can push
  // wall-clock past :00, making minute !== 0 and skipping every job.
  const now = new Date(event.scheduledTime);
  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const results: CronJobResult[] = [];

  // Every 30 minutes (minute 0 or 30): Threat feed scan
  if (minute === 0 || minute === 30) {
    const result = await runJob('threat_feed_scan', () => runThreatFeedScan(env));
    results.push(result);
  }

  // Enricher runs every cron tick — owns domain_geo, brand_logo_hq,
  // brand_sector_rdap. Decoupled from feed ingest so its failures
  // don't poison feeds and vice versa.
  try {
    const { runEnricher } = await import('./enricher');
    const enricherResult = await runJob('enricher', () => runEnricher(env));
    results.push(enricherResult);
  } catch (err) {
    logger.error('enricher_dispatch_error', {
      error: err instanceof Error ? err.message : String(err),
    });
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

  // Daily at 13:00 UTC (9 AM ET): Generate + email daily briefing
  // NOTE: hour 13 avoids collision with social ops (hour % 6 === 0 runs at 0/6/12/18)
  if (minute === 0 && hour === 13) {
    console.log('[CRON] 13:00 UTC — starting daily briefing generation');
    const emailResult = await runJob('briefing_email', async () => {
      // Dedup: only skip if a cron briefing already exists for today (manual ones don't count)
      const today = now.toISOString().slice(0, 10);
      let existing: { count: number } | null = null;
      try {
        existing = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM threat_briefings
           WHERE report_date = ? AND trigger LIKE 'cron%' AND emailed = 1`
        ).bind(today).first<{ count: number }>();
      } catch (err) {
        console.error('[CRON] Briefing dedup check failed:', err instanceof Error ? err.message : String(err));
      }

      if (existing && existing.count > 0) {
        logger.info('briefing_email_skipped_duplicate', { date: today });
        console.log('[CRON] Briefing already generated for today, skipping');
        return;
      }

      console.log('[CRON] No existing cron briefing for today, generating...');
      const { generateAndEmailBriefing } = await import('../handlers/briefing');
      const result = await generateAndEmailBriefing(env);
      if (!result.emailSent) {
        logger.warn('briefing_email_not_sent', { briefingId: result.briefingId, error: result.error });
        console.error('[CRON] Briefing email not sent:', result.error);
      } else {
        logger.info('briefing_email_delivered', { briefingId: result.briefingId });
        console.log('[CRON] Briefing generated and emailed, id:', result.briefingId);
      }
    });
    results.push(emailResult);
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

// ─── Flight Control v1: Agent Event Consumer ────────────────────
async function processAgentEvents(env: Env, ctx: ExecutionContext): Promise<void> {
  try {
    const events = await env.DB.prepare(`
      SELECT id, event_type, source_agent, target_agent, payload_json, priority
      FROM agent_events
      WHERE status = 'pending'
      ORDER BY priority ASC, created_at ASC
      LIMIT 10
    `).all<{
      id: string;
      event_type: string;
      source_agent: string;
      target_agent: string;
      payload_json: string | null;
      priority: number;
    }>();

    if (events.results.length === 0) return;

    // Log Flight Control event processing decision to activity log
    await logFlightControlActivity(env, 'scaling', `Processing ${events.results.length} pending agent events`, {
      eventCount: events.results.length,
      eventTypes: events.results.map(e => e.event_type),
    }, 'info');

    const { agentModules } = await import('../agents/index');
    const { executeAgent } = await import('../lib/agentRunner');

    for (const event of events.results) {
      // Mark as processing to prevent double-processing
      await env.DB.prepare(
        `UPDATE agent_events SET status = 'processing' WHERE id = ?`
      ).bind(event.id).run();

      try {
        const payload = event.payload_json ? JSON.parse(event.payload_json) as Record<string, unknown> : {};
        const mod = agentModules[event.target_agent];

        if (mod) {
          ctx.waitUntil(
            executeAgent(env, mod, { ...payload, triggeredByEvent: event.event_type }, "cron", "event")
          );
        } else {
          logger.warn('agent_event_unknown_target', {
            event_id: event.id,
            target_agent: event.target_agent,
            event_type: event.event_type,
          });
        }

        await env.DB.prepare(
          `UPDATE agent_events SET status = 'done', processed_at = datetime('now') WHERE id = ?`
        ).bind(event.id).run();

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('agent_event_processing_failed', {
          event_id: event.id,
          target_agent: event.target_agent,
          error: message,
        });
        await env.DB.prepare(
          `UPDATE agent_events SET status = 'failed' WHERE id = ?`
        ).bind(event.id).run();

        await logFlightControlActivity(env, 'recovery', `Agent event processing failed for ${event.target_agent}: ${message}`, {
          event_id: event.id,
          target_agent: event.target_agent,
          event_type: event.event_type,
        }, 'warning');
      }
    }

    logger.info('agent_events_processed', { count: events.results.length });
  } catch (err) {
    logger.error('agent_events_consumer_error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
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

  // NOTE: domain→IP resolution moved to the dedicated Enricher job
  // (cron/enricher.ts). Coupling it to feed ingest meant a feed
  // failure could starve the enrichment pipeline. The Enricher now
  // owns it, with full activity logging and stall detection.

  // Feed ingestion — wrapped in try/catch so enrichment/social still run on failure
  const { runAllFeeds, runAllEnrichmentFeeds } = await import('../lib/feedRunner');
  let feedResult = { feedsRun: 0, totalNew: 0, feedsFailed: 0, feedsSkipped: 0 };
  try {
    feedResult = await runAllFeeds(env, feedModules);
    logger.info('threat_feed_scan_feeds', {
      feedsRun: feedResult.feedsRun,
      totalNew: feedResult.totalNew,
      feedsFailed: feedResult.feedsFailed,
      feedsSkipped: feedResult.feedsSkipped,
    });
  } catch (err) {
    console.error('[cron] INGEST FEEDS FAILED:', err instanceof Error ? err.message : String(err));
    logger.error('ingest_feeds_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // ─── API Key Health Check: log presence of enrichment API keys ───
  {
    const keyStatus = {
      GREYNOISE_API_KEY: !!env.GREYNOISE_API_KEY,
      SECLOOKUP_API_KEY: !!env.SECLOOKUP_API_KEY,
      VIRUSTOTAL_API_KEY: !!env.VIRUSTOTAL_API_KEY,
      ABUSEIPDB_API_KEY: !!env.ABUSEIPDB_API_KEY,
      HIBP_API_KEY: !!env.HIBP_API_KEY,
      GOOGLE_SAFE_BROWSING_KEY: !!env.GOOGLE_SAFE_BROWSING_KEY,
    };
    const missing = Object.entries(keyStatus).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      console.warn(`[cron] Missing API keys: ${missing.join(', ')}`);
      logger.warn('enrichment_api_keys_missing', { missing, present: Object.entries(keyStatus).filter(([, v]) => v).map(([k]) => k) });
    } else {
      console.log('[cron] All enrichment API keys present');
    }
  }

  // Enrichment feeds (SURBL, VirusTotal, HIBP) — run AFTER ingest feeds
  try {
    const enrichmentNames = Object.keys(enrichmentModules);
    console.log(`[cron] About to run enrichment feeds...`);
    console.log(`[cron] Enrichment modules registered: ${enrichmentNames.join(', ')}`);
    const enrichResult = await runAllEnrichmentFeeds(env, enrichmentModules);
    console.log(`[cron] Enrichment feeds complete: run=${enrichResult.feedsRun} enriched=${enrichResult.totalEnriched} failed=${enrichResult.feedsFailed} skipped=${enrichResult.feedsSkipped}`);
    logger.info('threat_feed_scan_enrichment_feeds', {
      feedsRun: enrichResult.feedsRun,
      totalEnriched: enrichResult.totalEnriched,
      feedsFailed: enrichResult.feedsFailed,
      feedsSkipped: enrichResult.feedsSkipped,
    });
  } catch (err) {
    console.error('[cron] ENRICHMENT FEEDS FAILED:', err instanceof Error ? err.message : String(err));
    logger.error('enrichment_feeds_error', { error: err instanceof Error ? err.message : String(err) });
  }

  // Social intelligence feeds (Reddit, GitHub) — insert into social_mentions
  try {
    const { runAllSocialFeeds } = await import('../lib/feedRunner');
    const socialResult = await runAllSocialFeeds(env, socialModules);
    console.log(`[cron] Social feeds complete: run=${socialResult.feedsRun} new=${socialResult.totalNew} failed=${socialResult.feedsFailed} skipped=${socialResult.feedsSkipped}`);
    logger.info('threat_feed_scan_social_feeds', {
      feedsRun: socialResult.feedsRun,
      totalNew: socialResult.totalNew,
      feedsFailed: socialResult.feedsFailed,
      feedsSkipped: socialResult.feedsSkipped,
    });

    // Trigger Watchdog if there are unclassified social mentions
    if (socialResult.totalNew > 0) {
      try {
        const socialBacklog = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM social_mentions WHERE status = 'new'"
        ).first<{ count: number }>();
        if ((socialBacklog?.count ?? 0) > 0) {
          const { agentModules: socialAgents } = await import('../agents/index');
          const watchdogMod = socialAgents["watchdog"];
          if (watchdogMod) {
            const { executeAgent: runAgent } = await import('../lib/agentRunner');
            await runAgent(env, watchdogMod, { trigger: 'social_feeds', backlog: socialBacklog?.count ?? 0 }, 'cron', 'event');
            logger.info('social_feeds_triggered_watchdog', { backlog: socialBacklog?.count ?? 0 });
          }
        }
      } catch (watchdogErr) {
        logger.error('social_feeds_watchdog_trigger_error', { error: watchdogErr instanceof Error ? watchdogErr.message : String(watchdogErr) });
      }
    }
  } catch (err) {
    console.error('[cron] SOCIAL FEEDS FAILED:', err instanceof Error ? err.message : String(err));
    logger.error('social_feeds_error', { error: err instanceof Error ? err.message : String(err) });
  }

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

    // Write feed_pulled event for traceability
    try {
      await env.DB.prepare(`
        INSERT INTO agent_events (id, event_type, source_agent, target_agent, payload_json, priority, status)
        VALUES (?, 'feed_pulled', 'sentinel', 'cartographer', ?, 2, 'pending')
      `).bind(crypto.randomUUID(), JSON.stringify({ newItems: feedResult.totalNew, trigger: 'immediate' })).run();
    } catch (err) {
      logger.error('sentinel_event_write_error', { error: err instanceof Error ? err.message : String(err) });
    }

    // After Sentinel feed pull, trigger Cartographer immediately to enrich new threats
    try {
      const cartographerMod = allAgents["cartographer"];
      if (cartographerMod) {
        await executeAgent(env, cartographerMod, { trigger: 'sentinel', newItems: feedResult.totalNew }, "cron", "event");
        logger.info('sentinel_triggered_cartographer', { newItems: feedResult.totalNew });
      }
    } catch (err) {
      logger.error('sentinel_cartographer_trigger_error', { error: err instanceof Error ? err.message : String(err) });
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

  // Cartographer — every 15 minutes to clear enrichment backlog
  // (also triggered above after Sentinel, but this ensures it runs even without new feeds)
  // Runs at every cron tick (*/15) — stagger by checking we didn't just run via Sentinel trigger
  if (!(feedResult.totalNew > 0)) {
    try {
      const mod = allAgents["cartographer"];
      if (mod) {
        await executeAgent(env, mod, { trigger: 'scheduled' }, "cron", "scheduled");
      }
    } catch (err) {
      logger.error('threat_feed_scan_cartographer_error', { error: err instanceof Error ? err.message : String(err) });
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

  // NEXUS — every 4 hours (0, 4, 8, 12, 16, 20), at minute 0
  if (hour % 4 === 0 && minute === 0) {
    try {
      const mod = allAgents["nexus"];
      if (mod) {
        await executeAgent(env, mod, {}, "cron", "scheduled");
        logger.info('nexus_scheduled_run', { hour, minute });
      }
    } catch (err) {
      logger.error('cron_nexus_error', { error: err instanceof Error ? err.message : String(err) });
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

  // Pathfinder agent — daily at 03:00 UTC (KV throttle ensures once per 7 days)
  if (hour === 3 && minute < 5) {
    try {
      const pathfinderMod = allAgents["pathfinder"];
      if (pathfinderMod) {
        await executeAgent(env, pathfinderMod, {}, "cron", "scheduled");
      }
    } catch (err) {
      logger.error('threat_feed_scan_pathfinder_error', { error: err instanceof Error ? err.message : String(err) });
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

  // NOTE: brand logo/HQ + sector/RDAP enrichment moved to the dedicated
  // Enricher job (cron/enricher.ts). Running it once per day from inside
  // Observer was a single point of failure with no observability and no
  // retries. The Enricher now owns it on every cron tick.

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

// ─── Flight Control Activity Logger ──────────────────────────
async function logFlightControlActivity(
  env: Env,
  eventType: string,
  message: string,
  metadata: Record<string, unknown>,
  severity: 'info' | 'warning' | 'critical'
): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO agent_activity_log (id, agent_id, event_type, message, metadata_json, severity)
      VALUES (?, 'flight_control', ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      eventType,
      message,
      JSON.stringify(metadata),
      severity
    ).run();
  } catch {
    // Don't let activity logging failures break the cron
  }
}
