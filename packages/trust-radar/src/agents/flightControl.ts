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

// ─── Types ───────────────────────────────────────────────────────

interface AgentHealth {
  agent_id: string;
  last_run_at: string | null;
  last_run_status: string | null;
  avg_duration_ms: number;
  is_stalled: boolean;
}

interface Backlog {
  cartographer: number;
  analyst: number;
  totalUnlinked: number;
  totalNoGeo: number;
}

interface TokenBudget {
  used_today: number;
  daily_limit: number;
  pct_used: number;
  throttle_analyst: boolean;
  throttle_observer: boolean;
}

// Parallel instance thresholds per backlog level
const SCALING = {
  cartographer: { low: 500, medium: 2000, high: 5000, max_parallel: 3 },
  analyst:      { low: 50,  medium: 200,  high: 500,  max_parallel: 3 },
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

const AGENTS_TO_MONITOR = ['sentinel', 'cartographer', 'nexus', 'analyst', 'observer', 'sparrow'];
const DAILY_TOKEN_LIMIT = 500_000;

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

    // Run all reads in parallel — single round trip to D1
    const [backlogs, health, budget, lastCuratorRun, unscannedEmails] = await Promise.all([
      measureBacklogs(db),
      getAgentHealth(db),
      checkTokenBudget(db),
      db.prepare(`
        SELECT MAX(created_at) as last_run
        FROM agent_outputs
        WHERE agent_id = 'curator' AND type = 'hygiene_report'
      `).first<{ last_run: string | null }>(),
      db.prepare(`
        SELECT COUNT(*) as count FROM brands
        WHERE email_security_grade IS NULL
      `).first<{ count: number }>(),
    ]);

    // Fire-and-forget scaling (no await — don't block on spawning agents)
    const scalingActions = await scaleAgents(db, env, ctx, backlogs, budget);
    const recoveryActions = await recoverStalledAgents(db, env, ctx, health);

    // ── Curator weekly trigger ─────────────────────────────────
    const lastRun = lastCuratorRun?.last_run
      ? new Date(lastCuratorRun.last_run + 'Z')
      : null;
    const daysSinceCuratorRun = lastRun
      ? (Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // Run if: > 6 days since last run (weekly) OR email scan backlog very large
    if (daysSinceCuratorRun > 6 || (unscannedEmails?.count ?? 0) > 5000) {
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
    const overallStatus = stalled.length > 0 ? 'degraded'
      : Object.values(backlogs).some(b => b > 5000) ? 'busy'
      : 'healthy';

    const snapshot = {
      timestamp: new Date().toISOString(),
      backlogs,
      agents: health,
      budget,
      overall_status: overallStatus,
    };

    outputs.push({
      type: 'diagnostic',
      summary: `Platform ${overallStatus} — backlog: cart=${backlogs.cartographer} analyst=${backlogs.analyst} budget=${Math.round(budget.pct_used)}%`,
      severity: stalled.length > 0 ? 'high' : 'info',
      details: snapshot,
    });

    // Single write at the end — log only, no snapshot to agent_outputs
    // (agent_outputs table is growing and the NOT EXISTS query against it was
    // the primary CPU killer — we now log to agent_activity_log only)
    await logActivity(
      db,
      'flight_control',
      'info',
      'batch_complete',
      `Flight Control: ${overallStatus} — cart backlog: ${backlogs.cartographer}, analyst backlog: ${backlogs.analyst}, unlinked: ${backlogs.totalUnlinked}, no_geo: ${backlogs.totalNoGeo}`,
      { backlogs, stalled, budget_pct: Math.round(budget.pct_used), scaling: scalingActions, recovery: recoveryActions }
    );

    return {
      itemsProcessed: Object.values(backlogs).reduce((a, b) => a + b, 0),
      itemsCreated: 0,
      itemsUpdated: scalingActions + recoveryActions,
      output: {
        overall_status: overallStatus,
        backlogs,
        stalled,
        budget_pct: Math.round(budget.pct_used),
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
  const [cartResult, analystResult, totalUnlinkedResult, totalNoGeoResult] = await Promise.all([
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
  ]);

  return {
    cartographer: cartResult?.count ?? 0,
    analyst: analystResult?.count ?? 0,
    totalUnlinked: totalUnlinkedResult?.count ?? 0,
    totalNoGeo: totalNoGeoResult?.count ?? 0,
  };
}

// ─── Agent Health ────────────────────────────────────────────────

async function getAgentHealth(db: D1Database): Promise<AgentHealth[]> {
  // Single query gets latest run per agent — no loop (2 queries instead of 12)
  const [results, avgResults] = await Promise.all([
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
      AND agent_id IN ('sentinel','cartographer','nexus','analyst','observer','sparrow')
    `).all<{ agent_id: string; last_run_status: string; last_run_at: string; duration_ms: number | null }>(),

    db.prepare(`
      SELECT agent_id, AVG(duration_ms) as avg_ms
      FROM agent_runs
      WHERE started_at >= datetime('now', '-24 hours')
        AND duration_ms IS NOT NULL
        AND agent_id IN ('sentinel','cartographer','nexus','analyst','observer','sparrow')
      GROUP BY agent_id
    `).all<{ agent_id: string; avg_ms: number | null }>(),
  ]);

  const avgMap = new Map(avgResults.results.map(r => [r.agent_id, r.avg_ms]));

  return AGENTS_TO_MONITOR.map(agentId => {
    const latest = results.results.find(r => r.agent_id === agentId);
    const thresholdMs = (STALL_THRESHOLDS[agentId] ?? 60) * 60 * 1000;
    const lastRunAge = latest?.last_run_at
      ? Date.now() - new Date(latest.last_run_at + 'Z').getTime()
      : Infinity;
    const isStalled = lastRunAge > thresholdMs ||
      (latest?.last_run_status === 'partial' && lastRunAge > 45 * 60 * 1000);

    return {
      agent_id: agentId,
      last_run_at: latest?.last_run_at ?? null,
      last_run_status: latest?.last_run_status ?? null,
      avg_duration_ms: Math.round(avgMap.get(agentId) ?? 0),
      is_stalled: isStalled,
    };
  });
}

// ─── Token Budget ────────────────────────────────────────────────

async function checkTokenBudget(db: D1Database): Promise<TokenBudget> {
  const result = await db.prepare(`
    SELECT COALESCE(SUM(tokens_used), 0) as total
    FROM agent_runs
    WHERE started_at >= datetime('now', 'start of day')
      AND tokens_used > 0
  `).first<{ total: number }>();

  const usedToday = result?.total ?? 0;
  const pctUsed = (usedToday / DAILY_TOKEN_LIMIT) * 100;

  return {
    used_today: usedToday,
    daily_limit: DAILY_TOKEN_LIMIT,
    pct_used: pctUsed,
    throttle_analyst: pctUsed > 80,
    throttle_observer: pctUsed > 90,
  };
}

// ─── Scaling ─────────────────────────────────────────────────────

async function scaleAgents(
  db: D1Database,
  env: AgentContext['env'],
  ctx: AgentContext,
  backlogs: Backlog,
  budget: TokenBudget
): Promise<number> {
  // We need the agent runner + modules to trigger agents
  const { agentModules } = await import('./index');
  const { executeAgent } = await import('../lib/agentRunner');
  let actions = 0;

  // Scale Cartographer
  const cartBacklog = backlogs.cartographer;
  if (cartBacklog > 0) {
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
  const analystBacklog = backlogs.analyst;
  const totalUnlinked = backlogs.totalUnlinked;
  if ((analystBacklog > 0 || totalUnlinked > 0) && !budget.throttle_analyst) {
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
        executeAgent(env, analystMod, { trigger: 'flight_control' }, 'flight_control', 'event')
          .catch(() => { /* logged by agentRunner */ });
        actions++;
      }
    }

    if (instances > 1) {
      await logActivity(db, 'flight_control', 'info', 'scaling',
        `Scaling Analyst to ${instances} parallel instances (backlog: ${analystBacklog}, unlinked: ${totalUnlinked})`,
        { agent: 'analyst', instances, backlog: analystBacklog, total_unlinked: totalUnlinked }
      );
    }
  } else if (budget.throttle_analyst && analystBacklog > 0) {
    await logActivity(db, 'flight_control', 'warning', 'throttle',
      `Analyst throttled — token budget at ${Math.round(budget.pct_used)}%`,
      { budget_pct: Math.round(budget.pct_used), analyst_backlog: analystBacklog }
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
