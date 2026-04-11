/**
 * Flight Control Agent — Autonomous Supervisor.
 *
 * Runs on every cron tick (before all other agents). Responsibilities:
 * - Measure backlogs (cartographer enrichment, analyst scoring)
 * - Check agent health and detect stalled agents
 * - Enforce daily AI token budget (throttle analyst at 80%, observer at 90%)
 * - Scale up agents with parallel instances when backlogs grow
 * - Auto-recover stalled agents
 * - Log all decisions to agent_activity_log
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { BudgetManager, fetchAnthropicUsageReport } from "../lib/budgetManager";
import type { BudgetStatus, AgentBudgetLimits } from "../lib/budgetManager";

// ─── Types ───────────────────────────────────────────────────────

interface AgentHealth {
  agent_id: string;
  last_run_at: string | null;
  last_run_status: string | null;
  avg_duration_ms: number;
  is_stalled: boolean;
  circuit_state: 'closed' | 'tripped';
  consecutive_failures: number;
  paused_reason: string | null;
  paused_after_n_failures: number | null;
  paused_at: string | null;
}

interface Backlog {
  cartographer: number;
  analyst: number;
  totalUnlinked: number;
  totalNoGeo: number;
  surblUnchecked: number;
  vtUnchecked: number;
  gsbUnchecked: number;
  dblUnchecked: number;
  abuseipdbUnchecked: number;
  pdnsUnchecked: number;
  greynoiseUnchecked: number;
  seclookupUnchecked: number;
  watchdog: number;
  domainGeoBacklog:   number;  // threats with domain but no IP
  brandEnrichBacklog: number;  // brands with no enriched_at
}

interface DegradedFeed {
  feed_name: string;
  last_failure: string | null;
  health_status: string;
}

/**
 * Auto-paused feed — disabled with paused_reason='auto:consecutive_failures'.
 * Operationally distinct from DegradedFeed: a degraded feed is still running
 * on its schedule (just returning errors) whereas an auto-paused feed has
 * been flipped to enabled=0 by the feedRunner and will NOT run again until
 * an admin unpauses it. The dashboard shows these as separate counts.
 */
interface AutoPausedFeed {
  feed_name: string;
  display_name: string;
  consecutive_failures: number;
  last_failure: string | null;
  last_error: string | null;
}

/**
 * Auto-tripped agent — circuit breaker has flipped enabled=0 with
 * paused_reason='auto:consecutive_failures'. Operationally distinct
 * from degraded: a degraded agent is still running (just failing)
 * whereas a tripped agent is skipped by executeAgent() until an
 * admin resets its circuit breaker.
 */
interface TrippedAgent {
  agent_id: string;
  consecutive_failures: number;
  paused_at: string | null;
  paused_after_n_failures: number | null;
}

// Parallel instance thresholds per backlog level
const SCALING = {
  cartographer: { low: 500, medium: 2000, high: 5000, max_parallel: 3 },
  analyst:      { low: 50,  medium: 200,  high: 500,  max_parallel: 1 },
} as const;

// Minutes before an agent is considered stalled
const STALL_THRESHOLDS: Record<string, number> = {
  sentinel:      35,
  cartographer:  75,
  nexus:         260,
  analyst:       35,
  observer:      1500,
  sparrow:       120,
};

/**
 * Dynamically derived from the agent registry — all agents are monitored.
 * Must be resolved via dynamic import (not a top-level const) because
 * agents/index.ts imports flightControl.ts, creating a circular dependency.
 * A top-level static import of agentModules would resolve to undefined
 * at module load time.
 */
async function getAgentsToMonitor(): Promise<string[]> {
  const { agentModules: mods } = await import("./index");
  return Object.keys(mods);
}

// ─── Agent Module ────────────────────────────────────────────────

export const flightControlAgent: AgentModule = {
  name: "flight_control",
  displayName: "Flight Control",
  description: "Autonomous supervisor — parallel scaling, stall recovery, token budget enforcement",
  color: "#00d4ff",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;
    const db = env.DB;
    const outputs: AgentOutputEntry[] = [];
    const budgetMgr = new BudgetManager(db);

    // Fetch Anthropic usage report (once per hour, guarded by KV)
    let anthropicReported = 0;
    const anthropicAdminKey = (env as unknown as Record<string, string | undefined>).ANTHROPIC_ADMIN_KEY;
    if (anthropicAdminKey) {
      const lastCheck = await env.CACHE.get('budget:anthropic_last_check');
      if (!lastCheck) {
        anthropicReported = await fetchAnthropicUsageReport(anthropicAdminKey);
        await env.CACHE.put('budget:anthropic_last_check', String(Date.now()), { expirationTtl: 3600 });
      }
    }

    // Run all reads in parallel — single round trip to D1
    const [backlogs, health, budgetStatus, agentLimits, lastCuratorRun, unscannedEmails, degradedFeeds, autoPausedFeeds, trippedAgents] = await Promise.all([
      measureBacklogs(db),
      getAgentHealth(db),
      budgetMgr.getStatus(anthropicReported),
      budgetMgr.getAgentLimits(),
      db.prepare(`
        SELECT MAX(created_at) as last_run
        FROM agent_outputs
        WHERE agent_id = 'curator' AND type = 'hygiene_report'
      `).first<{ last_run: string | null }>(),
      db.prepare(`
        SELECT COUNT(*) as count FROM brands
        WHERE email_security_grade IS NULL
      `).first<{ count: number }>(),
      // Degraded feeds are still enabled & running — they're just returning
      // errors. Intentionally excludes auto-paused feeds via the enabled=1
      // join so the two counts don't double-report the same feed.
      db.prepare(`
        SELECT feed_name, last_failure, health_status FROM feed_status
        WHERE health_status IN ('degraded', 'down')
          AND feed_name IN (SELECT feed_name FROM feed_configs WHERE enabled = 1)
      `).all<DegradedFeed>(),
      // Auto-paused feeds are enabled=0 by the feedRunner's auto-pause
      // guard. Operationally distinct from degraded — they will NOT run
      // again until an admin unpauses them, so the dashboard surfaces
      // them as a separate category.
      db.prepare(`
        SELECT fc.feed_name,
               fc.display_name,
               COALESCE(fs.consecutive_failures, 0) AS consecutive_failures,
               fs.last_failure,
               fs.last_error
          FROM feed_configs fc
          LEFT JOIN feed_status fs ON fs.feed_name = fc.feed_name
          WHERE fc.enabled = 0
            AND fc.paused_reason = 'auto:consecutive_failures'
          ORDER BY fs.consecutive_failures DESC
      `).all<AutoPausedFeed>(),
      // Auto-tripped agents — circuit breaker has flipped them to
      // enabled=0 with paused_reason='auto:consecutive_failures'.
      // Distinct from degraded (still running but failing).
      db.prepare(`
        SELECT agent_id,
               consecutive_failures,
               paused_at,
               paused_after_n_failures
          FROM agent_configs
          WHERE enabled = 0
            AND paused_reason = 'auto:consecutive_failures'
          ORDER BY consecutive_failures DESC
      `).all<TrippedAgent>(),
    ]);

    // Log emergency budget state
    if (budgetStatus.throttle_level === 'emergency') {
      await logActivity(db, 'flight_control', 'critical', 'budget_emergency',
        `EMERGENCY: Budget exhausted — AI agents paused ($${budgetStatus.spent_this_month}/$${budgetStatus.config.monthly_limit_usd})`,
        { budget: budgetStatus }
      );
    } else if (budgetStatus.throttle_level === 'hard') {
      await logActivity(db, 'flight_control', 'warning', 'budget_hard',
        `Budget hard limit — minimal AI processing ($${budgetStatus.spent_this_month}/$${budgetStatus.config.monthly_limit_usd})`,
        { budget: budgetStatus }
      );
    } else if (budgetStatus.throttle_level === 'soft') {
      await logActivity(db, 'flight_control', 'info', 'budget_soft',
        `Budget soft limit — reduced batch sizes ($${budgetStatus.spent_this_month}/$${budgetStatus.config.monthly_limit_usd})`,
        { budget: budgetStatus }
      );
    }

    // ── Enrichment backlog warnings ──────────────────────────────
    if (backlogs.surblUnchecked > 1000) {
      await logActivity(db, 'flight_control', 'warning', 'enrichment_backlog',
        `SURBL enrichment backlog: ${backlogs.surblUnchecked} domains unchecked`,
        { backlog: 'surbl', count: backlogs.surblUnchecked }
      );
    }
    if (backlogs.vtUnchecked > 500) {
      await logActivity(db, 'flight_control', 'warning', 'enrichment_backlog',
        `VT enrichment backlog: ${backlogs.vtUnchecked} high-severity threats unchecked`,
        { backlog: 'virustotal', count: backlogs.vtUnchecked }
      );
    }
    if (backlogs.gsbUnchecked > 1000) {
      await logActivity(db, 'flight_control', 'warning', 'enrichment_backlog',
        `GSB enrichment backlog: ${backlogs.gsbUnchecked} URLs/domains unchecked`,
        { backlog: 'google_safe_browsing', count: backlogs.gsbUnchecked }
      );
    }
    if (backlogs.dblUnchecked > 1000) {
      await logActivity(db, 'flight_control', 'warning', 'enrichment_backlog',
        `DBL enrichment backlog: ${backlogs.dblUnchecked} domains unchecked`,
        { backlog: 'spamhaus_dbl', count: backlogs.dblUnchecked }
      );
    }
    if (backlogs.abuseipdbUnchecked > 500) {
      await logActivity(db, 'flight_control', 'warning', 'enrichment_backlog',
        `AbuseIPDB enrichment backlog: ${backlogs.abuseipdbUnchecked} IPs unchecked`,
        { backlog: 'abuseipdb', count: backlogs.abuseipdbUnchecked }
      );
    }
    if (backlogs.pdnsUnchecked > 200) {
      await logActivity(db, 'flight_control', 'warning', 'enrichment_backlog',
        `PDNS enrichment backlog: ${backlogs.pdnsUnchecked} domains unchecked`,
        { backlog: 'circl_pdns', count: backlogs.pdnsUnchecked }
      );
    }
    if (backlogs.greynoiseUnchecked > 100) {
      await logActivity(db, 'flight_control', 'warning', 'enrichment_backlog',
        `GreyNoise enrichment backlog: ${backlogs.greynoiseUnchecked} high-severity IPs unchecked`,
        { backlog: 'greynoise', count: backlogs.greynoiseUnchecked }
      );
    }
    if (backlogs.seclookupUnchecked > 1000) {
      await logActivity(db, 'flight_control', 'warning', 'enrichment_backlog',
        `SecLookup enrichment backlog: ${backlogs.seclookupUnchecked} threats unchecked`,
        { backlog: 'seclookup', count: backlogs.seclookupUnchecked }
      );
    }

    // ── Watchdog social mention backlog ─────────────────────────────
    if (backlogs.watchdog > 100) {
      await logActivity(db, 'flight_control', 'warning', 'social_backlog',
        `Watchdog backlog: ${backlogs.watchdog} unclassified social mentions`,
        { backlog: 'watchdog', count: backlogs.watchdog }
      );
    }

    // High backlog: trigger additional watchdog run
    if (backlogs.watchdog > 200) {
      const { agentModules: allAgents } = await import('./index');
      const { executeAgent } = await import('../lib/agentRunner');
      const watchdogMod = allAgents['watchdog'];
      if (watchdogMod) {
        executeAgent(env, watchdogMod, { trigger: 'flight_control_backlog', backlog: backlogs.watchdog }, 'flight_control', 'event')
          .catch(() => { /* logged by agentRunner */ });
        await logActivity(db, 'flight_control', 'info', 'scaling',
          `Triggered extra Watchdog run — backlog: ${backlogs.watchdog} unclassified social mentions`,
          { agent: 'watchdog', backlog: backlogs.watchdog }
        );
      }
    }

    // ── Degraded feed health monitoring ───────────────────────────
    if (degradedFeeds.results.length > 0) {
      for (const feed of degradedFeeds.results) {
        await logActivity(db, 'flight_control', 'warning', 'feed_degraded',
          `Feed ${feed.feed_name} is ${feed.health_status}${feed.last_failure ? ` (last failure: ${feed.last_failure})` : ''}`,
          { feed_name: feed.feed_name, health_status: feed.health_status, last_failure: feed.last_failure }
        );
      }
    }

    // ── Auto-paused feed surfacing ────────────────────────────────
    // feedRunner already wrote a critical agent_activity_log row at the
    // moment of the pause transition, so we don't need another
    // per-feed critical entry here. Just log a single roll-up so the
    // FC dashboard timeline shows the current count without spamming.
    if (autoPausedFeeds.results.length > 0) {
      await logActivity(db, 'flight_control', 'warning', 'feeds_auto_paused',
        `${autoPausedFeeds.results.length} feed${autoPausedFeeds.results.length === 1 ? '' : 's'} currently auto-paused: ${autoPausedFeeds.results.map(f => f.feed_name).join(', ')}`,
        { count: autoPausedFeeds.results.length, feeds: autoPausedFeeds.results.map(f => ({ feed_name: f.feed_name, consecutive_failures: f.consecutive_failures })) }
      );
    }

    // ── Auto-tripped agent surfacing ──────────────────────────────
    // Same pattern as auto-paused feeds: a single roll-up log line
    // per FC tick so the dashboard timeline shows the current count.
    // The critical notification was already fired by executeAgent()
    // at the moment of the transition.
    if (trippedAgents.results.length > 0) {
      await logActivity(db, 'flight_control', 'warning', 'agents_tripped',
        `${trippedAgents.results.length} agent${trippedAgents.results.length === 1 ? '' : 's'} circuit-tripped: ${trippedAgents.results.map(a => a.agent_id).join(', ')}`,
        { count: trippedAgents.results.length, agents: trippedAgents.results.map(a => ({ agent_id: a.agent_id, consecutive_failures: a.consecutive_failures })) }
      );
    }

    // ── C2 infrastructure overlap detection ────────────────────────
    try {
      const c2Overlap = await db.prepare(`
        SELECT COUNT(*) as cnt FROM threats
        WHERE source_feed = 'c2_tracker'
        AND ip_address IN (SELECT DISTINCT ip_address FROM threats WHERE source_feed != 'c2_tracker' AND ip_address IS NOT NULL)
      `).first<{ cnt: number }>();
      if (c2Overlap && c2Overlap.cnt > 0) {
        await logActivity(db, 'flight_control', 'warning', 'c2_overlap',
          `[flight-control] ${c2Overlap.cnt} C2 server IPs also appear in other threat feeds — infrastructure overlap detected`,
          { c2_overlap_count: c2Overlap.cnt }
        );
      }
    } catch { /* non-fatal — c2_tracker may not have data yet */ }

    // ── CertStream health check ──────────────────────────────────
    try {
      const csId = env.CERTSTREAM_MONITOR.idFromName('certstream-primary');
      const csStub = env.CERTSTREAM_MONITOR.get(csId);
      const statsResp = await csStub.fetch(new Request('https://internal/stats'));
      const csStats = await statsResp.json() as {
        status: string;
        stats?: { certsProcessed?: number; certsMatched?: number; certsWritten?: number };
      };

      if (!csStats.status || csStats.status !== 'connected') {
        console.log('[flight-control] CertStream disconnected — attempting restart');
        await csStub.fetch(new Request('https://internal/start'));
        await logActivity(db, 'flight_control', 'warning', 'certstream_reconnect',
          'CertStream disconnected — triggered restart', { csStats });
      }

      console.log(`[flight-control] CertStream: ${csStats.stats?.certsProcessed || 0} processed, ${csStats.stats?.certsMatched || 0} matched, ${csStats.stats?.certsWritten || 0} written`);
    } catch (err) {
      console.error('[flight-control] CertStream health check failed:', err);
    }

    // Fire-and-forget scaling (no await — don't block on spawning agents)
    const scalingActions = await scaleAgents(db, env, ctx, backlogs, budgetStatus, agentLimits);
    const recoveryActions = await recoverStalledAgents(db, env, ctx, health);

    // ── Curator weekly trigger ─────────────────────────────────
    const lastRun = lastCuratorRun?.last_run
      ? new Date(lastCuratorRun.last_run + 'Z')
      : null;
    const daysSinceCuratorRun = lastRun
      ? (Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // Run if: > 6 days since last run (weekly) OR email scan backlog very large
    // Skip curator if budget is at hard or emergency level
    if ((daysSinceCuratorRun > 6 || (unscannedEmails?.count ?? 0) > 5000) && !agentLimits.skip_curator) {
      const { curatorAgent } = await import('./curator');
      const { executeAgent } = await import('../lib/agentRunner');
      executeAgent(env, curatorAgent, { trigger: 'flight_control' }, 'flight_control', 'event')
        .catch(() => { /* logged by agentRunner */ });

      await logActivity(db, 'flight_control', 'info', 'scheduling',
        'Triggered Curator weekly hygiene run', {
          days_since_last: Math.round(daysSinceCuratorRun),
          unscanned_emails: unscannedEmails?.count ?? 0,
        });
    }

    const stalled = health.filter(h => h.is_stalled).map(h => h.agent_id);
    const tripped = health.filter(h => h.circuit_state === 'tripped').map(h => h.agent_id);
    const healthyAgents = health.filter(h => !h.is_stalled && h.circuit_state === 'closed');
    const overallStatus = tripped.length > 0 || stalled.length > 0 ? 'degraded'
      : Object.values(backlogs).some(b => b > 5000) ? 'busy'
      : 'healthy';

    const snapshot = {
      timestamp: new Date().toISOString(),
      backlogs,
      agents: health,
      budget: budgetStatus,
      overall_status: overallStatus,
      degraded_feeds: degradedFeeds.results,
      auto_paused_feeds: autoPausedFeeds.results,
      tripped_agents: trippedAgents.results,
    };

    const feedHealthSummary = `${autoPausedFeeds.results.length} feeds auto-paused, ${degradedFeeds.results.length} degraded`;
    const agentHealthSummary = `${tripped.length} tripped, ${stalled.length} degraded, ${healthyAgents.length} healthy`;

    outputs.push({
      type: 'diagnostic',
      summary: `Platform ${overallStatus} — backlog: cart=${backlogs.cartographer} analyst=${backlogs.analyst} watchdog=${backlogs.watchdog} surbl=${backlogs.surblUnchecked} vt=${backlogs.vtUnchecked} gsb=${backlogs.gsbUnchecked} dbl=${backlogs.dblUnchecked} abuseipdb=${backlogs.abuseipdbUnchecked} pdns=${backlogs.pdnsUnchecked} greynoise=${backlogs.greynoiseUnchecked} seclookup=${backlogs.seclookupUnchecked} domainGeo=${backlogs.domainGeoBacklog} brandEnrich=${backlogs.brandEnrichBacklog} agents=[${agentHealthSummary}] feeds=[${feedHealthSummary}] budget=$${budgetStatus.spent_this_month}/${budgetStatus.config.monthly_limit_usd} (${budgetStatus.throttle_level})`,
      severity: tripped.length > 0 || stalled.length > 0 || budgetStatus.throttle_level === 'emergency' ? 'high' : 'info',
      details: snapshot,
    });

    // Single write at the end — log only, no snapshot to agent_outputs
    await logActivity(
      db,
      'flight_control',
      'info',
      'batch_complete',
      `Flight Control: ${overallStatus} — cart backlog: ${backlogs.cartographer}, analyst backlog: ${backlogs.analyst}, domain geo backlog: ${backlogs.domainGeoBacklog}, brand enrich backlog: ${backlogs.brandEnrichBacklog}, budget: $${budgetStatus.spent_this_month}/$${budgetStatus.config.monthly_limit_usd} (${budgetStatus.throttle_level})`,
      { backlogs, stalled, budget: budgetStatus, scaling: scalingActions, recovery: recoveryActions }
    );

    return {
      itemsProcessed: Object.values(backlogs).reduce((a, b) => a + b, 0),
      itemsCreated: 0,
      itemsUpdated: scalingActions + recoveryActions,
      output: {
        overall_status: overallStatus,
        backlogs,
        stalled,
        budget: budgetStatus,
        scaling_actions: scalingActions,
        recovery_actions: recoveryActions,
      },
      agentOutputs: outputs,
    };
  },
};

// ─── Backlog Measurement ─────────────────────────────────────────

async function measureBacklogs(db: D1Database): Promise<Backlog> {
  // Run all backlog queries in parallel
  const [cartResult, analystResult, totalUnlinkedResult, totalNoGeoResult, surblResult, vtResult, gsbResult, dblResult, abuseipdbResult, pdnsResult, greynoiseResult, seclookupResult, watchdogResult] = await Promise.all([
    // Cartographer backlog: unenriched threats with IPs or domains
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE enriched_at IS NULL
        AND (ip_address IS NOT NULL OR malicious_domain IS NOT NULL)
    `).first<{ count: number }>(),

    // Analyst backlog: brands with recent threats but no recent analyst output
    db.prepare(`
      SELECT COUNT(DISTINCT target_brand_id) as count
      FROM threats
      WHERE first_seen >= datetime('now', '-24 hours')
        AND target_brand_id IS NOT NULL
        AND status = 'active'
    `).first<{ count: number }>(),

    // Total unlinked threat backlog (not just recent)
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE target_brand_id IS NULL
      AND status = 'active'
    `).first<{ count: number }>(),

    // Total geo backlog
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE (lat IS NULL OR lng IS NULL)
      AND status = 'active'
    `).first<{ count: number }>(),

    // SURBL enrichment backlog: unchecked domains from last 7 days
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE surbl_checked = 0
        AND malicious_domain IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `).first<{ count: number }>(),

    // VT enrichment backlog: unchecked high-severity threats from last 7 days
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE vt_checked = 0
        AND severity IN ('critical', 'high')
        AND malicious_domain IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `).first<{ count: number }>(),

    // GSB enrichment backlog: unchecked URLs/domains from last 7 days
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE gsb_checked = 0
        AND (malicious_url IS NOT NULL OR malicious_domain IS NOT NULL)
        AND first_seen >= datetime('now', '-7 days')
    `).first<{ count: number }>(),

    // DBL enrichment backlog: unchecked domains from last 7 days
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE dbl_checked = 0
        AND malicious_domain IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `).first<{ count: number }>(),

    // AbuseIPDB enrichment backlog: unchecked IPs from last 7 days
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE abuseipdb_checked = 0
        AND ip_address IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `).first<{ count: number }>(),

    // PDNS enrichment backlog: unchecked high-severity domains from last 7 days
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE pdns_checked = 0
        AND severity IN ('critical', 'high')
        AND malicious_domain IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `).first<{ count: number }>(),

    // GreyNoise enrichment backlog: unchecked high-severity IPs from last 7 days
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE greynoise_checked = 0
        AND ip_address IS NOT NULL
        AND severity IN ('critical', 'high')
        AND first_seen >= datetime('now', '-7 days')
    `).first<{ count: number }>().catch(() => ({ count: 0 })),

    // SecLookup enrichment backlog: unchecked threats from last 7 days
    db.prepare(`
      SELECT COUNT(*) as count FROM threats
      WHERE seclookup_checked = 0
        AND (malicious_domain IS NOT NULL OR ip_address IS NOT NULL)
        AND first_seen >= datetime('now', '-7 days')
    `).first<{ count: number }>().catch(() => ({ count: 0 })),

    // Watchdog backlog: unclassified social mentions
    db.prepare(`
      SELECT COUNT(*) as count FROM social_mentions WHERE status = 'new'
    `).first<{ count: number }>().catch(() => ({ count: 0 })),
  ]);

  const domainGeoRow = await db.prepare(`
    SELECT COUNT(*) as n FROM threats
    WHERE (ip_address IS NULL OR ip_address = '')
      AND malicious_domain IS NOT NULL
      AND malicious_domain NOT LIKE '*%'
      AND malicious_domain LIKE '%.%'
  `).first<{ n: number }>();

  const brandEnrichRow = await db.prepare(`
    SELECT COUNT(*) as n FROM brands
    WHERE enriched_at IS NULL AND canonical_domain IS NOT NULL
  `).first<{ n: number }>();

  const backlog: Backlog = {
    cartographer: cartResult?.count ?? 0,
    analyst: analystResult?.count ?? 0,
    totalUnlinked: totalUnlinkedResult?.count ?? 0,
    totalNoGeo: totalNoGeoResult?.count ?? 0,
    surblUnchecked: surblResult?.count ?? 0,
    vtUnchecked: vtResult?.count ?? 0,
    gsbUnchecked: gsbResult?.count ?? 0,
    dblUnchecked: dblResult?.count ?? 0,
    abuseipdbUnchecked: abuseipdbResult?.count ?? 0,
    pdnsUnchecked: pdnsResult?.count ?? 0,
    greynoiseUnchecked: greynoiseResult?.count ?? 0,
    seclookupUnchecked: seclookupResult?.count ?? 0,
    watchdog: watchdogResult?.count ?? 0,
    domainGeoBacklog:   0,
    brandEnrichBacklog: 0,
  };

  backlog.domainGeoBacklog   = domainGeoRow?.n ?? 0;
  backlog.brandEnrichBacklog = brandEnrichRow?.n ?? 0;

  // ── Persist backlog snapshots + run stall detection ────────────
  // Flight Control used to log the backlog count every tick but had no
  // memory of what it logged the previous tick. The Enricher could be
  // dead and FC would still happily report "domain geo backlog: 90852"
  // hour after hour with no alarm. Now we keep a 5-tick rolling history
  // and emit a critical event whenever a backlog fails to strictly
  // decrease over 4 ticks.
  const TRACKED: Array<{ name: string; count: number }> = [
    { name: 'domain_geo',    count: backlog.domainGeoBacklog },
    { name: 'brand_enrich',  count: backlog.brandEnrichBacklog },
    { name: 'cartographer',  count: backlog.cartographer },
    { name: 'analyst',       count: backlog.analyst },
    { name: 'surbl',         count: backlog.surblUnchecked },
    { name: 'virustotal',    count: backlog.vtUnchecked },
    { name: 'gsb',           count: backlog.gsbUnchecked },
    { name: 'dbl',           count: backlog.dblUnchecked },
    { name: 'abuseipdb',     count: backlog.abuseipdbUnchecked },
    { name: 'pdns',          count: backlog.pdnsUnchecked },
    { name: 'greynoise',     count: backlog.greynoiseUnchecked },
    { name: 'seclookup',     count: backlog.seclookupUnchecked },
  ];

  for (const t of TRACKED) {
    try {
      await db.prepare(
        `INSERT INTO backlog_history (backlog_name, count) VALUES (?, ?)`
      ).bind(t.name, t.count).run();
    } catch { /* never block FC on logging */ }
  }

  // Stall detection: compare the current count (just inserted) to the
  // value from 4 ticks ago. If the backlog is non-zero, has 5+ samples
  // (so it isn't brand new), and is not strictly decreasing, log a
  // critical event.
  for (const t of TRACKED) {
    if (t.count === 0) continue;
    try {
      const history = await db.prepare(`
        SELECT count FROM backlog_history
        WHERE backlog_name = ?
        ORDER BY recorded_at DESC
        LIMIT 5
      `).bind(t.name).all<{ count: number }>();

      const samples = history.results ?? [];
      if (samples.length < 5) continue; // need 5 (current + 4 history) to judge

      const current = samples[0]?.count ?? 0;
      const fourAgo = samples[4]?.count ?? 0;
      const trend   = current - fourAgo; // negative = draining, positive/0 = stalled

      if (trend >= 0) {
        await db.prepare(`
          INSERT INTO agent_activity_log (id, agent_id, event_type, message, metadata_json, severity, created_at)
          VALUES (?, 'flight_control', 'backlog_stalled', ?, ?, 'critical', datetime('now'))
        `).bind(
          crypto.randomUUID(),
          `Backlog ${t.name} stalled at ${current} (4 ticks ago: ${fourAgo}, trend: ${trend >= 0 ? '+' : ''}${trend})`,
          JSON.stringify({ backlog: t.name, current, four_ticks_ago: fourAgo, trend }),
        ).run();
      }
    } catch { /* never block FC */ }
  }

  // Trim history to last 7 days (best effort, keeps the table small).
  try {
    await db.prepare(
      `DELETE FROM backlog_history WHERE recorded_at < datetime('now', '-7 days')`
    ).run();
  } catch { /* ignore */ }

  return backlog;
}

// ─── Agent Health ────────────────────────────────────────────────

async function getAgentHealth(db: D1Database): Promise<AgentHealth[]> {
  const agentIds = await getAgentsToMonitor();
  // Build a placeholder list for the IN clause
  const placeholders = agentIds.map(() => '?').join(',');

  const [results, avgResults, configResults] = await Promise.all([
    db.prepare(`
      SELECT
        agent_id,
        status as last_run_status,
        started_at as last_run_at,
        duration_ms
      FROM agent_runs ar1
      WHERE started_at = (
        SELECT MAX(started_at) FROM agent_runs ar2
        WHERE ar2.agent_id = ar1.agent_id
      )
      AND agent_id IN (${placeholders})
    `).bind(...agentIds).all<{ agent_id: string; last_run_status: string; last_run_at: string; duration_ms: number | null }>(),

    db.prepare(`
      SELECT agent_id, AVG(duration_ms) as avg_ms
      FROM agent_runs
      WHERE started_at >= datetime('now', '-24 hours')
        AND duration_ms IS NOT NULL
        AND agent_id IN (${placeholders})
      GROUP BY agent_id
    `).bind(...agentIds).all<{ agent_id: string; avg_ms: number | null }>(),

    // LEFT JOIN agent_configs for circuit breaker state
    db.prepare(`
      SELECT agent_id, enabled, paused_reason, consecutive_failures,
             paused_at, paused_after_n_failures
      FROM agent_configs
      WHERE agent_id IN (${placeholders})
    `).bind(...agentIds).all<{
      agent_id: string; enabled: number; paused_reason: string | null;
      consecutive_failures: number; paused_at: string | null;
      paused_after_n_failures: number | null;
    }>(),
  ]);

  const avgMap = new Map(avgResults.results.map(r => [r.agent_id, r.avg_ms]));
  const configMap = new Map(configResults.results.map(r => [r.agent_id, r]));

  return agentIds.map(agentId => {
    const latest = results.results.find(r => r.agent_id === agentId);
    const config = configMap.get(agentId);
    const thresholdMs = (STALL_THRESHOLDS[agentId] ?? 60) * 60 * 1000;
    const lastRunAge = latest?.last_run_at
      ? Date.now() - new Date(latest.last_run_at + 'Z').getTime()
      : Infinity;
    const isStalled = lastRunAge > thresholdMs ||
      (latest?.last_run_status === 'partial' && lastRunAge > 45 * 60 * 1000);

    // Derive circuit state from agent_configs
    const isTripped = config?.enabled === 0 && config.paused_reason === 'auto:consecutive_failures';

    return {
      agent_id: agentId,
      last_run_at: latest?.last_run_at ?? null,
      last_run_status: latest?.last_run_status ?? null,
      avg_duration_ms: Math.round(avgMap.get(agentId) ?? 0),
      is_stalled: isStalled,
      circuit_state: isTripped ? 'tripped' as const : 'closed' as const,
      consecutive_failures: config?.consecutive_failures ?? 0,
      paused_reason: config?.paused_reason ?? null,
      paused_after_n_failures: config?.paused_after_n_failures ?? null,
      paused_at: config?.paused_at ?? null,
    };
  });
}

// ─── Scaling ─────────────────────────────────────────────────────

async function scaleAgents(
  db: D1Database,
  env: AgentContext['env'],
  ctx: AgentContext,
  backlogs: Backlog,
  budget: BudgetStatus,
  limits: AgentBudgetLimits
): Promise<number> {
  // We need the agent runner + modules to trigger agents
  const { agentModules } = await import('./index');
  const { executeAgent } = await import('../lib/agentRunner');
  let actions = 0;

  // Scale Cartographer (geo enrichment is non-AI, but AI classification may be throttled)
  const cartBacklog = backlogs.cartographer;
  if (cartBacklog > 0 && !limits.pause_all_ai) {
    const cfg = SCALING.cartographer;
    const instances = cartBacklog >= cfg.high ? cfg.max_parallel
      : cartBacklog >= cfg.medium ? 2
      : 1;

    const cartMod = agentModules['cartographer'];
    if (cartMod) {
      for (let i = 0; i < instances; i++) {
        // Pass offset so parallel instances work on different slices
        executeAgent(env, cartMod, { trigger: 'flight_control', offset: i * 500 }, 'flight_control', 'event')
          .catch(() => { /* logged by agentRunner */ });
        actions++;
      }
    }

    if (instances > 1) {
      await logActivity(db, 'flight_control', 'info', 'scaling',
        `Scaling Cartographer to ${instances} parallel instances (backlog: ${cartBacklog})`,
        { agent: 'cartographer', instances, backlog: cartBacklog }
      );
    }
  }

  // Cartographer geo backlog — trigger geo enrichment if geo backlog is large
  // and cartographer isn't already busy with unenriched threats
  if (backlogs.totalNoGeo > 5000 && cartBacklog === 0) {
    const cartMod2 = agentModules['cartographer'];
    if (cartMod2) {
      executeAgent(env, cartMod2, { trigger: 'flight_control', mode: 'geo_backlog', priority: 'low' }, 'flight_control', 'event')
        .catch(() => { /* logged by agentRunner */ });
      actions++;

      await logActivity(db, 'flight_control', 'info', 'scaling',
        `Queued Cartographer geo backlog run (${backlogs.totalNoGeo} threats missing geo)`,
        { agent: 'cartographer', mode: 'geo_backlog', no_geo_count: backlogs.totalNoGeo }
      );
    }
  }

  // Scale Analyst — factor in TOTAL unlinked backlog, not just recent
  // Emergency: pause all AI. Hard/Soft: reduced batches handled by agent limits.
  const analystBacklog = backlogs.analyst;
  const totalUnlinked = backlogs.totalUnlinked;
  if ((analystBacklog > 0 || totalUnlinked > 0) && !limits.pause_all_ai) {
    // If total unlinked > 50k, max scale; > 10k, scale to 2; else use recent backlog
    const instances = totalUnlinked > 50000 ? 3
      : totalUnlinked > 10000 ? 2
      : analystBacklog >= SCALING.analyst.high ? SCALING.analyst.max_parallel
      : analystBacklog >= SCALING.analyst.medium ? 2
      : analystBacklog > 0 ? 1
      : 0;

    const analystMod = agentModules['analyst'];
    if (analystMod) {
      for (let i = 0; i < instances; i++) {
        executeAgent(env, analystMod, {
          trigger: 'flight_control',
          budget_batch_limit: limits.analyst_batch,
        }, 'flight_control', 'event')
          .catch(() => { /* logged by agentRunner */ });
        actions++;
      }
    }

    if (instances > 1) {
      await logActivity(db, 'flight_control', 'info', 'scaling',
        `Scaling Analyst to ${instances} parallel instances (backlog: ${analystBacklog}, unlinked: ${totalUnlinked}, batch limit: ${limits.analyst_batch})`,
        { agent: 'analyst', instances, backlog: analystBacklog, total_unlinked: totalUnlinked, batch_limit: limits.analyst_batch }
      );
    }
  } else if (limits.pause_all_ai && analystBacklog > 0) {
    await logActivity(db, 'flight_control', 'critical', 'throttle',
      `Analyst paused — budget ${budget.throttle_level} ($${budget.spent_this_month}/$${budget.config.monthly_limit_usd})`,
      { throttle_level: budget.throttle_level, spent: budget.spent_this_month }
    );
  }

  return actions;
}

// ─── Stall Recovery ──────────────────────────────────────────────

async function recoverStalledAgents(
  db: D1Database,
  env: AgentContext['env'],
  ctx: AgentContext,
  health: AgentHealth[]
): Promise<number> {
  const { agentModules } = await import('./index');
  const { executeAgent } = await import('../lib/agentRunner');
  let recoveries = 0;

  for (const agent of health) {
    if (!agent.is_stalled) continue;

    const mod = agentModules[agent.agent_id];
    if (!mod) continue;

    // TEMP DISABLED — Anthropic timeout, re-enable after fix (Phase 0.5d)
    // architect times out on every Anthropic call; stall-recovery was spawning it
    // every hour producing zero output while consuming 200-300 sec of D1 time.
    if (agent.agent_id === 'architect') continue;

    await logActivity(db, 'flight_control', 'warning', 'recovery',
      `Recovering stalled agent: ${agent.agent_id} (last run: ${agent.last_run_at ?? 'never'})`,
      { agent: agent.agent_id, last_run: agent.last_run_at, status: agent.last_run_status }
    );

    executeAgent(env, mod, { trigger: 'flight_control_recovery' }, 'flight_control', 'event')
      .catch(() => { /* logged by agentRunner */ });
    recoveries++;
  }

  return recoveries;
}

// ─── Activity Logging ────────────────────────────────────────────

async function logActivity(
  db: D1Database,
  agentId: string,
  severity: 'info' | 'warning' | 'critical',
  eventType: string,
  message: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO agent_activity_log (id, agent_id, event_type, message, metadata_json, severity)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      agentId,
      eventType,
      message,
      JSON.stringify(metadata),
      severity
    ).run();
  } catch {
    // Don't let activity logging failures break Flight Control
  }
}
