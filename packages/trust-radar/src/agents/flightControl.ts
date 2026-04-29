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
import type { Env } from "../types";
import { BudgetManager, fetchAnthropicUsageReport } from "../lib/budgetManager";
import type { BudgetStatus, AgentBudgetLimits, ThrottleLevel } from "../lib/budgetManager";
import { createNotification } from "../lib/notifications";
import { PRIVATE_IP_SQL_FILTER } from "../lib/geoip";
import { getOrComputeMetric } from "../lib/system-metrics";

// TTLs for backlog counters. "Monitoring" backlogs (the broad _checked
// queries that a partial index can't help with because the predicate
// matches 50-70% of the table) get a longer TTL — one fresh recompute
// per 4 ticks instead of every tick. "Live" backlogs used for scaling
// decisions stay on a shorter TTL so Flight Control reacts quickly, but
// must exceed the 3600s cron cadence so the cache is still fresh at the
// next :07 tick — a 3000s TTL expired ~10min before each tick, making
// every read a miss and silently defeating the cache for these metrics.
const BACKLOG_TTL_LIVE_S = 3900;       // 65 min — survives to next hourly tick
const BACKLOG_TTL_MONITORING_S = 14400; // 4h   — refresh every ~4th tick

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

//
// Navigator health report. Navigator is an independent agent on the every-
// 5-minute cron, NOT part of the Flight Control dispatch mesh — FC observes
// it, does not manage it. Produced once per FC tick and surfaced in the
// diagnostic payload so the Agent Monitor UI can render Navigator alongside
// managed agents.
//
// Status thresholds (doubled from Navigator's 5-minute cycle for latency):
//   - healthy  : ran within last 10 min, success rate > 80%
//   - degraded : ran within last 10 min, success rate <= 80%
//   - stale    : last run was 10-30 min ago
//   - dead     : no run in 30+ minutes
//
interface NavigatorHealth {
  last_run_at: string | null;
  runs_last_hour: number;
  success_rate_last_hour: number; // 0-100, percent
  avg_records_processed: number;  // per run, last hour
  avg_duration_ms: number;
  status: 'healthy' | 'degraded' | 'stale' | 'dead';
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

// Minutes before an agent is considered stalled by Flight Control's
// stall-recovery loop (recoverStalledAgents).
//
// CRITICAL: this constant must contain an entry for every agent in
// `agentModules` — anything missing falls back to the 60-minute default
// (see `?? 60` in getAgentHealth). For agents with intended cadences
// longer than 1 hour, the default short-circuits their schedule:
//   - FC ticks every hour (orchestrator cron `7 * * * *`)
//   - At each tick, FC sees `lastRunAge > 60min` for the slow agent
//   - FC dispatches it via executeAgent(..., 'flight_control_recovery')
//   - The orchestrator's hour gates (e.g. `hour % 6 === 0`) are bypassed
//
// Choose threshold ≈ (intended interval × 1.2) so a single skipped tick
// or jittered run timing doesn't trigger spurious recovery, but a
// genuinely-hung agent still gets recovered within one extra interval.
//
// History: prior to PR #814 only six agents were listed here; the
// other 10+ defaulted to 60 minutes and were re-dispatched every hour
// regardless of their actual schedule, producing platform-wide
// cadence drift visible in agent_runs (e.g. sparrow running every 3h
// instead of every 6h, pathfinder running every 1-2h instead of daily).
const STALL_THRESHOLDS: Record<string, number> = {
  // ─── Per-tick agents (every hour, orchestrator cron) ─────────────
  sentinel:           75,
  analyst:            75,
  cartographer:       75,
  flight_control:     75,    // self — FC runs every tick, never stalls in practice

  // ─── Every 4 hours (hour % 4 === 0) ──────────────────────────────
  nexus:              300,   // 5h

  // ─── Every 6 hours (hour % 6 === 0) ──────────────────────────────
  strategist:         420,   // 7h
  sparrow:            420,   // 7h (was 120 — too tight, caused FC to re-dispatch sparrow every 3h)
  social_monitor:     420,
  social_discovery:   420,
  app_store_monitor:  420,
  dark_web_monitor:   420,

  // ─── Daily (hour === 0/3/6) ──────────────────────────────────────
  observer:           1500,  // 25h — fires at hour===0 in runThreatFeedScan
  narrator:           1500,  // 25h — fires at hour===6 inside runObserverBriefing
  pathfinder:         1500,  // 25h — fires at hour===3
  seed_strategist:    1500,  // 25h — fires at hour===6 inside runObserverBriefing
                             //       (currently auto-paused via agent_configs anyway)

  // ─── Weekly (auto-seeder, Sunday 05:23 UTC) ──────────────────────
  // Threshold = 7d × 1.2 = ~12100 min. Single missed tick won't
  // trigger spurious recovery; a hung run gets recovered within one
  // extra week. FC stall-recovery would re-dispatch via executeAgent
  // off-schedule, which is the correct behaviour for an agent that
  // mutates seeding state — better to plant a week early than skip
  // a week if the cron itself is failing.
  auto_seeder:        12100,

  // ─── Event-driven (no cron schedule) ─────────────────────────────
  // FC dispatches these when conditions warrant. The stall-recovery
  // loop should NOT auto-fire them — that defeats the event-driven
  // dispatch model. High threshold so they're effectively excluded
  // from recovery without needing a separate skip-list.
  curator:            1500,
  watchdog:           1500,
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
    const [backlogs, health, navigatorHealth, budgetStatus, agentLimits, lastCuratorRun, unscannedEmails, degradedFeeds, autoPausedFeeds, trippedAgents] = await Promise.all([
      measureBacklogs(db),
      getAgentHealth(db),
      getNavigatorHealth(db),
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

    // Log budget state every tick for the activity log (diagnostic trail).
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

    // Fire a user-facing notification only on state transitions so we
    // don't spam the dashboard every hourly tick while the budget stays
    // in a throttled state. The activity-log entries above run every
    // tick regardless — they're the diagnostic trail, not the alert.
    //
    // Previously there was no createNotification() call at all for
    // budget events: a budget-triggered throttle could silently starve
    // Cartographer scaling (limits.pause_all_ai gates scaleAgents) with
    // nothing but an agent_activity_log row for anyone to notice. That
    // is the gap this block closes.
    try {
      const prevLevel = await budgetMgr.getLastThrottleLevel();
      const currLevel = budgetStatus.throttle_level;
      if (prevLevel !== currLevel) {
        await notifyBudgetTransition(env, prevLevel, currLevel, budgetStatus);
        await budgetMgr.setLastThrottleLevel(currLevel);
      }
    } catch (err) {
      // Never let a notification failure break Flight Control — the
      // activity log above already captured the state for diagnostics.
      await logActivity(db, 'flight_control', 'warning', 'budget_notification_error',
        `Failed to emit budget transition notification: ${err instanceof Error ? err.message : String(err)}`,
        { throttle_level: budgetStatus.throttle_level }
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
        try {
          await executeAgent(env, watchdogMod, { trigger: 'flight_control_backlog', backlog: backlogs.watchdog }, 'flight_control', 'event');
        } catch { /* logged by agentRunner */ }
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
      try {
        await executeAgent(env, curatorAgent, { trigger: 'flight_control' }, 'flight_control', 'event');
      } catch { /* logged by agentRunner */ }

      await logActivity(db, 'flight_control', 'info', 'scheduling',
        'Triggered Curator weekly hygiene run', {
          days_since_last: Math.round(daysSinceCuratorRun),
          unscanned_emails: unscannedEmails?.count ?? 0,
        });
    }

    const stalled = health.filter(h => h.is_stalled).map(h => h.agent_id);
    const tripped = health.filter(h => h.circuit_state === 'tripped').map(h => h.agent_id);
    const healthyAgents = health.filter(h => !h.is_stalled && h.circuit_state === 'closed');

    // Navigator is independent — its stale/dead state contributes to overall
    // platform status the same way a stalled managed agent does.
    const navigatorDegraded = navigatorHealth.status === 'stale' || navigatorHealth.status === 'dead';
    if (navigatorDegraded) {
      await logActivity(
        db,
        'flight_control',
        navigatorHealth.status === 'dead' ? 'critical' : 'warning',
        'navigator_health',
        `Navigator ${navigatorHealth.status} — last run: ${navigatorHealth.last_run_at ?? 'never'} (expected every 5 min)`,
        navigatorHealth as unknown as Record<string, unknown>,
      );
    } else if (navigatorHealth.status === 'degraded') {
      await logActivity(
        db,
        'flight_control',
        'warning',
        'navigator_health',
        `Navigator degraded — success rate ${navigatorHealth.success_rate_last_hour}% over last hour`,
        navigatorHealth as unknown as Record<string, unknown>,
      );
    }

    const overallStatus = tripped.length > 0 || stalled.length > 0 || navigatorDegraded ? 'degraded'
      : Object.values(backlogs).some(b => b > 5000) ? 'busy'
      : 'healthy';

    const snapshot = {
      timestamp: new Date().toISOString(),
      backlogs,
      agents: health,
      navigator_health: navigatorHealth,
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
      summary: `Platform ${overallStatus} — backlog: cart=${backlogs.cartographer} analyst=${backlogs.analyst} watchdog=${backlogs.watchdog} surbl=${backlogs.surblUnchecked} vt=${backlogs.vtUnchecked} gsb=${backlogs.gsbUnchecked} dbl=${backlogs.dblUnchecked} abuseipdb=${backlogs.abuseipdbUnchecked} pdns=${backlogs.pdnsUnchecked} greynoise=${backlogs.greynoiseUnchecked} seclookup=${backlogs.seclookupUnchecked} domainGeo=${backlogs.domainGeoBacklog} brandEnrich=${backlogs.brandEnrichBacklog} agents=[${agentHealthSummary}] navigator=${navigatorHealth.status} feeds=[${feedHealthSummary}] budget=$${budgetStatus.spent_this_month}/${budgetStatus.config.monthly_limit_usd} (${budgetStatus.throttle_level})`,
      severity: tripped.length > 0 || stalled.length > 0 || navigatorDegraded || budgetStatus.throttle_level === 'emergency' ? 'high' : 'info',
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
  // Each backlog is routed through system_metrics. The TTL picks whether
  // this is a "live" counter (short TTL, ~every tick) or a "monitoring"
  // counter (long TTL, ~every 4th tick). The stall-detection logic below
  // writes to backlog_history only when wasCached === false, so detection
  // still runs on fresh samples regardless of cadence.

  const cacheCount = (key: string, ttl: number, sql: string, suppressErrors = false) =>
    getOrComputeMetric(db, key, ttl, async () => {
      try {
        const r = await db.prepare(sql).first<{ count: number }>();
        return r?.count ?? 0;
      } catch (err) {
        if (suppressErrors) return 0;
        throw err;
      }
    });

  const [
    cartResult,
    analystResult,
    totalUnlinkedResult,
    totalNoGeoResult,
    surblResult,
    vtResult,
    gsbResult,
    dblResult,
    abuseipdbResult,
    pdnsResult,
    greynoiseResult,
    seclookupResult,
    watchdogResult,
    domainGeoResult,
    brandEnrichResult,
  ] = await Promise.all([
    // Live counters — used for scaling decisions, kept fresh every tick.
    cacheCount('backlog.cartographer', BACKLOG_TTL_LIVE_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE enriched_at IS NULL
        AND ip_address IS NOT NULL AND ip_address != ''
        ${PRIVATE_IP_SQL_FILTER}
    `),
    cacheCount('backlog.analyst', BACKLOG_TTL_LIVE_S, `
      SELECT COUNT(DISTINCT target_brand_id) as count
      FROM threats
      WHERE first_seen >= datetime('now', '-24 hours')
        AND target_brand_id IS NOT NULL
        AND status = 'active'
    `),
    cacheCount('backlog.total_unlinked', BACKLOG_TTL_LIVE_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE target_brand_id IS NULL
      AND status = 'active'
    `),
    cacheCount('backlog.total_no_geo', BACKLOG_TTL_LIVE_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE (lat IS NULL OR lng IS NULL)
      AND status = 'active'
    `),

    // Monitoring counters — broad _checked queries with no selective
    // index. Refreshed every ~4 ticks; stall detection still works on
    // fresh-recompute samples.
    cacheCount('backlog.surbl', BACKLOG_TTL_MONITORING_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE surbl_checked = 0
        AND malicious_domain IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `),
    cacheCount('backlog.vt', BACKLOG_TTL_MONITORING_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE vt_checked = 0
        AND severity IN ('critical', 'high')
        AND malicious_domain IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `),
    cacheCount('backlog.gsb', BACKLOG_TTL_MONITORING_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE gsb_checked = 0
        AND (malicious_url IS NOT NULL OR malicious_domain IS NOT NULL)
        AND first_seen >= datetime('now', '-7 days')
    `),
    cacheCount('backlog.dbl', BACKLOG_TTL_MONITORING_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE dbl_checked = 0
        AND malicious_domain IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `),
    cacheCount('backlog.abuseipdb', BACKLOG_TTL_MONITORING_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE abuseipdb_checked = 0
        AND ip_address IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `),
    cacheCount('backlog.pdns', BACKLOG_TTL_MONITORING_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE pdns_checked = 0
        AND severity IN ('critical', 'high')
        AND malicious_domain IS NOT NULL
        AND first_seen >= datetime('now', '-7 days')
    `),
    cacheCount('backlog.greynoise', BACKLOG_TTL_MONITORING_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE greynoise_checked = 0
        AND ip_address IS NOT NULL
        AND severity IN ('critical', 'high')
        AND first_seen >= datetime('now', '-7 days')
    `, true),
    cacheCount('backlog.seclookup', BACKLOG_TTL_MONITORING_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE seclookup_checked = 0
        AND (malicious_domain IS NOT NULL OR ip_address IS NOT NULL)
        AND first_seen >= datetime('now', '-7 days')
    `, true),
    cacheCount('backlog.watchdog', BACKLOG_TTL_LIVE_S, `
      SELECT COUNT(*) as count FROM social_mentions WHERE status = 'new'
    `, true),
    cacheCount('backlog.domain_geo', BACKLOG_TTL_LIVE_S, `
      SELECT COUNT(*) as count FROM threats
      WHERE (ip_address IS NULL OR ip_address = '')
        AND malicious_domain IS NOT NULL
        AND malicious_domain NOT LIKE '*%'
        AND malicious_domain LIKE '%.%'
    `),
    cacheCount('backlog.brand_enrich', BACKLOG_TTL_LIVE_S, `
      SELECT COUNT(*) as count FROM brands
      WHERE enriched_at IS NULL AND canonical_domain IS NOT NULL
    `),
  ]);

  const backlog: Backlog = {
    cartographer: cartResult.value,
    analyst: analystResult.value,
    totalUnlinked: totalUnlinkedResult.value,
    totalNoGeo: totalNoGeoResult.value,
    surblUnchecked: surblResult.value,
    vtUnchecked: vtResult.value,
    gsbUnchecked: gsbResult.value,
    dblUnchecked: dblResult.value,
    abuseipdbUnchecked: abuseipdbResult.value,
    pdnsUnchecked: pdnsResult.value,
    greynoiseUnchecked: greynoiseResult.value,
    seclookupUnchecked: seclookupResult.value,
    watchdog: watchdogResult.value,
    domainGeoBacklog:   domainGeoResult.value,
    brandEnrichBacklog: brandEnrichResult.value,
  };

  // ── Persist backlog snapshots + run stall detection ────────────
  // Flight Control used to log the backlog count every tick but had no
  // memory of what it logged the previous tick. The Enricher could be
  // dead and FC would still happily report "domain geo backlog: 90852"
  // hour after hour with no alarm. Now we keep a rolling history and
  // emit a critical event whenever a backlog fails to strictly decrease
  // across samples.
  //
  // Samples are written ONLY for freshly computed metrics (wasCached ===
  // false). If we wrote every tick, cached metrics would produce long
  // runs of identical values and stall detection would fire falsely.
  // Monitoring counters with the 4h TTL therefore write one sample per
  // ~4 ticks and stall detection compares fresh samples, not cached
  // reads.
  const TRACKED: Array<{ name: string; count: number; cached: boolean }> = [
    { name: 'domain_geo',    count: backlog.domainGeoBacklog,     cached: domainGeoResult.wasCached },
    { name: 'brand_enrich',  count: backlog.brandEnrichBacklog,   cached: brandEnrichResult.wasCached },
    { name: 'cartographer',  count: backlog.cartographer,         cached: cartResult.wasCached },
    { name: 'analyst',       count: backlog.analyst,              cached: analystResult.wasCached },
    { name: 'surbl',         count: backlog.surblUnchecked,       cached: surblResult.wasCached },
    { name: 'virustotal',    count: backlog.vtUnchecked,          cached: vtResult.wasCached },
    { name: 'gsb',           count: backlog.gsbUnchecked,         cached: gsbResult.wasCached },
    { name: 'dbl',           count: backlog.dblUnchecked,         cached: dblResult.wasCached },
    { name: 'abuseipdb',     count: backlog.abuseipdbUnchecked,   cached: abuseipdbResult.wasCached },
    { name: 'pdns',          count: backlog.pdnsUnchecked,        cached: pdnsResult.wasCached },
    { name: 'greynoise',     count: backlog.greynoiseUnchecked,   cached: greynoiseResult.wasCached },
    { name: 'seclookup',     count: backlog.seclookupUnchecked,   cached: seclookupResult.wasCached },
  ];

  for (const t of TRACKED) {
    if (t.cached) continue;
    try {
      await db.prepare(
        `INSERT INTO backlog_history (backlog_name, count) VALUES (?, ?)`
      ).bind(t.name, t.count).run();
    } catch { /* never block FC on logging */ }
  }

  // Stall detection: compare the current count (just inserted) to the
  // value from 4 samples ago. Only runs on freshly computed metrics —
  // cached reads skip detection to avoid false positives from identical
  // consecutive values. For 4h-TTL metrics this means the comparison
  // window is ~16 hours of real time, which is strictly more conservative
  // than the previous 4-hour window.
  for (const t of TRACKED) {
    if (t.count === 0) continue;
    if (t.cached) continue;
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

// ─── Navigator Health ────────────────────────────────────────────
//
// Navigator runs on its own */5 cron and is NOT part of agentModules, so
// getAgentHealth never sees it. This function computes Navigator health
// directly from agent_runs. Navigator was previously named 'fast_tick' —
// historical rows still carry that ID, so queries span both IDs to get
// the full recent history.

async function getNavigatorHealth(db: D1Database): Promise<NavigatorHealth> {
  const DEFAULT_EMPTY: NavigatorHealth = {
    last_run_at: null,
    runs_last_hour: 0,
    success_rate_last_hour: 0,
    avg_records_processed: 0,
    avg_duration_ms: 0,
    status: 'dead',
  };

  try {
    // Two reads in parallel: last run (for status freshness) + last hour aggregates.
    const [latestRow, hourAgg] = await Promise.all([
      db.prepare(`
        SELECT started_at, status
        FROM agent_runs
        WHERE agent_id IN ('navigator', 'fast_tick')
        ORDER BY started_at DESC
        LIMIT 1
      `).first<{ started_at: string; status: string }>(),

      db.prepare(`
        SELECT
          COUNT(*) AS runs,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
          AVG(records_processed) AS avg_records,
          AVG(duration_ms) AS avg_ms
        FROM agent_runs
        WHERE agent_id IN ('navigator', 'fast_tick')
          AND started_at >= datetime('now', '-1 hour')
      `).first<{ runs: number; successes: number; avg_records: number | null; avg_ms: number | null }>(),
    ]);

    if (!latestRow) return DEFAULT_EMPTY;

    // SQLite datetime strings are UTC but lack the 'Z' suffix — add it so
    // `new Date(...)` parses them as UTC rather than local time.
    const lastRunMs = new Date(latestRow.started_at + 'Z').getTime();
    const ageMs = Date.now() - lastRunMs;
    const ageMin = ageMs / 60_000;

    const runs = hourAgg?.runs ?? 0;
    const successes = hourAgg?.successes ?? 0;
    const successRate = runs > 0 ? Math.round((successes / runs) * 100) : 0;

    // Status thresholds — doubled from the 5-min cycle for latency tolerance.
    let status: NavigatorHealth['status'];
    if (ageMin > 30) {
      status = 'dead';
    } else if (ageMin > 10) {
      status = 'stale';
    } else if (runs > 0 && successRate <= 80) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      last_run_at: latestRow.started_at,
      runs_last_hour: runs,
      success_rate_last_hour: successRate,
      avg_records_processed: Math.round(hourAgg?.avg_records ?? 0),
      avg_duration_ms: Math.round(hourAgg?.avg_ms ?? 0),
      status,
    };
  } catch {
    // Never let a Navigator health read failure break Flight Control.
    return DEFAULT_EMPTY;
  }
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

  // ── Wave 1B: fire-and-forget scaling via ctx.waitUntil ──────────
  // Previously, scaleAgents awaited each cartographer/analyst run
  // sequentially, blocking the hourly cron for ~50-150s and holding the
  // D1 writer the entire time. Now we fire them via ExecutionContext
  // .waitUntil() — the agent runs continue in the background while FC
  // returns and the cron proceeds with its remaining jobs.
  //
  // The ExecutionContext is passed from the cron handler via
  // ctx.input._executionCtx. If absent (manual trigger), fall back to
  // the old await behavior for backward compatibility.
  const execCtx = ctx.input._executionCtx as ExecutionContext | undefined;

  // Scale Cartographer (geo enrichment is non-AI, but AI classification may be throttled)
  const cartBacklog = backlogs.cartographer;
  if (cartBacklog > 0 && !limits.pause_all_ai) {
    const cfg = SCALING.cartographer;
    const instances = cartBacklog >= cfg.high ? cfg.max_parallel
      : cartBacklog >= cfg.medium ? 2
      : 1;

    const cartMod = agentModules['cartographer'];
    if (cartMod) {
      // Offset stride must equal one instance's full row window so the three
      // instances cover disjoint ranges. Each instance processes 5 batches ×
      // 500 rows = 2,500 rows; a smaller stride (e.g. 500) makes every
      // instance's later batches overlap with the next instance's earlier
      // ones, wasting ip-api.com subrequests and D1 writes on idempotent
      // re-enrichments of the same rows.
      const CART_ROWS_PER_INSTANCE = 2500;
      for (let i = 0; i < instances; i++) {
        const promise = executeAgent(env, cartMod, { trigger: 'flight_control', offset: i * CART_ROWS_PER_INSTANCE }, 'flight_control', 'event');
        if (execCtx) {
          // Fire-and-forget: cron keeps running, cartographer runs in background
          execCtx.waitUntil(promise.catch(() => { /* logged by agentRunner */ }));
        } else {
          // Fallback for manual triggers: await as before
          try { await promise; } catch { /* logged by agentRunner */ }
        }
        actions++;
      }
    }

    if (instances > 1) {
      await logActivity(db, 'flight_control', 'info', 'scaling',
        `Scaling Cartographer to ${instances} background instances (backlog: ${cartBacklog})`,
        { agent: 'cartographer', instances, backlog: cartBacklog }
      );
    }
  } else if (cartBacklog > 0 && limits.pause_all_ai) {
    // Budget emergency gate. scaleAgents would otherwise silently skip
    // with no trace — the budget-transition notification goes out once,
    // but once you're already in 'emergency' each subsequent tick has
    // nothing saying "and Cartographer did not run this tick either."
    // Log it every tick so the activity trail explains the enrichment
    // queue growth while the throttle is in effect.
    await logActivity(db, 'flight_control', 'warning', 'scaling_skipped',
      `Cartographer scaling skipped — AI budget in emergency (pause_all_ai). Backlog: ${cartBacklog}`,
      { agent: 'cartographer', reason: 'budget_pause_all_ai', backlog: cartBacklog }
    );
  }

  // Cartographer geo backlog — trigger geo enrichment if geo backlog is large
  // and cartographer isn't already busy with unenriched threats
  if (backlogs.totalNoGeo > 5000 && cartBacklog === 0) {
    const cartMod2 = agentModules['cartographer'];
    if (cartMod2) {
      const promise = executeAgent(env, cartMod2, { trigger: 'flight_control', mode: 'geo_backlog', priority: 'low' }, 'flight_control', 'event');
      if (execCtx) {
        execCtx.waitUntil(promise.catch(() => {}));
      } else {
        try { await promise; } catch { /* logged by agentRunner */ }
      }
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
    const rawInstances = totalUnlinked > 50000 ? 3
      : totalUnlinked > 10000 ? 2
      : analystBacklog >= SCALING.analyst.high ? SCALING.analyst.max_parallel
      : analystBacklog >= SCALING.analyst.medium ? 2
      : analystBacklog > 0 ? 1
      : 0;
    const instances = Math.min(rawInstances, SCALING.analyst.max_parallel);

    const analystMod = agentModules['analyst'];
    if (analystMod) {
      for (let i = 0; i < instances; i++) {
        const promise = executeAgent(env, analystMod, {
          trigger: 'flight_control',
          budget_batch_limit: limits.analyst_batch,
        }, 'flight_control', 'event');
        if (execCtx) {
          execCtx.waitUntil(promise.catch(() => { /* logged by agentRunner */ }));
        } else {
          try { await promise; } catch { /* logged by agentRunner */ }
        }
        actions++;
      }
    }

    if (instances > 1) {
      await logActivity(db, 'flight_control', 'info', 'scaling',
        `Scaling Analyst to ${instances} background instances (backlog: ${analystBacklog}, unlinked: ${totalUnlinked}, batch limit: ${limits.analyst_batch})`,
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
    // (architect was previously skipped explicitly here due to Anthropic
    // timeout; retired in Phase 2.2 of the agent audit, so the !mod guard
    // above now handles it implicitly.)

    await logActivity(db, 'flight_control', 'warning', 'recovery',
      `Recovering stalled agent: ${agent.agent_id} (last run: ${agent.last_run_at ?? 'never'})`,
      { agent: agent.agent_id, last_run: agent.last_run_at, status: agent.last_run_status }
    );

    try {
      await executeAgent(env, mod, { trigger: 'flight_control_recovery' }, 'flight_control', 'event');
    } catch { /* logged by agentRunner */ }
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

/**
 * Fire a user-facing notification on budget throttle transitions.
 *
 * Severity mapping mirrors the operational consequences, not the raw
 * percent used:
 *   → emergency  critical  (all AI paused — Cartographer scaling stops)
 *   → hard       high      (reduced AI batches, observer/curator skipped)
 *   → soft       medium    (smaller batches, but everything still runs)
 *   → none       info      (recovery — useful positive signal)
 *
 * Uses circuit_breaker_tripped as the notification type because
 * semantically that's exactly what this is — the budget-based
 * circuit breaker on AI spend has flipped. Keeping it on an existing
 * type avoids touching the notifications CHECK constraint and reuses
 * whatever routing / preferences users already have in place.
 */
async function notifyBudgetTransition(
  env: Env,
  prev: ThrottleLevel | null,
  curr: ThrottleLevel,
  status: BudgetStatus,
): Promise<void> {
  // On a clean deploy (no prior state in system_config) don't fire for
  // 'none' — there's nothing to announce, we're just recording the
  // baseline. But if we come up in a throttled state, do fire: the
  // operator needs to know the deploy landed during a live incident.
  if (prev === null && curr === 'none') return;

  const spendLine = `$${status.spent_this_month}/$${status.config.monthly_limit_usd} (${status.pct_used}% used)`;
  const prevLabel = prev ?? 'unknown';

  let severity: 'critical' | 'high' | 'medium' | 'info';
  let title: string;
  let message: string;

  if (curr === 'emergency') {
    severity = 'critical';
    title = 'AI budget exhausted — all AI agents paused';
    message = `Budget crossed emergency threshold (${status.config.emergency_pct}%). ` +
      `All AI agents are paused until spend resets or the limit is raised. ` +
      `Current: ${spendLine}. Previous state: ${prevLabel}.`;
  } else if (curr === 'hard') {
    severity = 'high';
    title = 'AI budget at hard limit — processing minimized';
    message = `Budget crossed hard threshold (${status.config.hard_pct}%). ` +
      `Observer and Curator are paused; Analyst and Cartographer are running at reduced batch sizes. ` +
      `Current: ${spendLine}. Previous state: ${prevLabel}.`;
  } else if (curr === 'soft') {
    severity = 'medium';
    title = 'AI budget at soft limit — batch sizes reduced';
    message = `Budget crossed soft threshold (${status.config.soft_pct}%). ` +
      `Batch sizes reduced; all agents still running. ` +
      `Current: ${spendLine}. Previous state: ${prevLabel}.`;
  } else {
    severity = 'info';
    title = 'AI budget back below thresholds — full processing resumed';
    message = `Budget has dropped back to normal from ${prevLabel}. ` +
      `All AI agents are running at full capacity. Current: ${spendLine}.`;
  }

  await createNotification(env, {
    type: 'circuit_breaker_tripped',
    severity,
    title,
    message,
    link: '/admin/budget',
    metadata: {
      source: 'flight_control',
      kind: 'budget_throttle',
      from: prev,
      to: curr,
      pct_used: status.pct_used,
      spent_this_month: status.spent_this_month,
      monthly_limit_usd: status.config.monthly_limit_usd,
    },
  });
}
