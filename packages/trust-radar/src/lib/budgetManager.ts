/**
 * BudgetManager — Real-time AI budget management with three-level throttle.
 *
 * Canonical Anthropic pricing table for the whole worker. Every AI call
 * site attributes cost through recordCost() — see lib/anthropic.ts for
 * the canonical wrapper that enforces that contract.
 *
 * Current models in use (per 1M tokens):
 *   claude-haiku-4-5-20251001    $1.00 in / $5.00 out
 *   claude-sonnet-4-5-20250929   $3.00 in / $15.00 out
 *
 * Legacy Claude 3 / Sonnet 4 entries are kept so historical ledger
 * rows (and the Anthropic Usage Report API verification path) still
 * price correctly.
 *
 * Throttle levels:
 *   SOFT  (80%+)  — reduced batch sizes
 *   HARD  (95%+)  — minimal AI, skip observer/curator
 *   EMERGENCY (99%+) — ALL AI paused, only sentinel + nexus run
 */

// ─── Cost Model ─────────────────────────────────────────────────

export const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  // Current production models
  'claude-haiku-4-5-20251001':   { input: 1.00, output: 5.00 },
  'claude-sonnet-4-5-20250929':  { input: 3.00, output: 15.00 },
  // Legacy models kept for historical ledger queries + usage reports
  'claude-3-haiku-20240307':     { input: 0.25, output: 1.25 },
  'claude-3-5-haiku-20241022':   { input: 0.80, output: 4.00 },
  'claude-3-sonnet-20240229':    { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022':  { input: 3.00, output: 15.00 },
  'claude-sonnet-4-20250514':    { input: 3.00, output: 15.00 },
};

/**
 * Compute the USD cost of a single Anthropic call. Throws on an unknown
 * model rather than silently defaulting — a missing entry means the
 * pricing table is stale and ledger numbers will be wrong, which is
 * exactly the bug the wrapper refactor exists to fix. Callers inside
 * the canonical wrapper should treat a throw here as a "catch and log
 * loudly, don't write to the ledger" situation.
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_MILLION[model];
  if (!rates) {
    throw new Error(
      `[budgetManager] estimateCost: unknown model "${model}" — add it to COST_PER_MILLION in lib/budgetManager.ts`,
    );
  }
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

// ─── Types ──────────────────────────────────────────────────────

export type ThrottleLevel = 'none' | 'soft' | 'hard' | 'emergency';

export interface BudgetConfig {
  monthly_limit_usd: number;
  soft_pct: number;
  hard_pct: number;
  emergency_pct: number;
}

export interface BudgetStatus {
  config: BudgetConfig;
  spent_this_month: number;
  remaining: number;
  pct_used: number;
  throttle_level: ThrottleLevel;
  days_in_month: number;
  days_elapsed: number;
  daily_burn_rate: number;
  projected_monthly: number;
  anthropic_reported: number;
}

export interface AgentBudgetLimits {
  analyst_batch: number;
  cartographer_batch: number;
  skip_observer: boolean;
  skip_curator: boolean;
  pause_all_ai: boolean;
}

// ─── BudgetManager ──────────────────────────────────────────────

export class BudgetManager {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /** Get budget config (singleton row). */
  async getConfig(): Promise<BudgetConfig> {
    const row = await this.db.prepare(
      `SELECT monthly_limit_usd, soft_pct, hard_pct, emergency_pct FROM budget_config WHERE id = 1`
    ).first<BudgetConfig>();

    return row ?? { monthly_limit_usd: 50, soft_pct: 80, hard_pct: 95, emergency_pct: 99 };
  }

  /** Update budget config. Only updates provided fields. */
  async updateConfig(patch: Partial<BudgetConfig>): Promise<BudgetConfig> {
    const current = await this.getConfig();
    const merged: BudgetConfig = {
      monthly_limit_usd: patch.monthly_limit_usd ?? current.monthly_limit_usd,
      soft_pct: patch.soft_pct ?? current.soft_pct,
      hard_pct: patch.hard_pct ?? current.hard_pct,
      emergency_pct: patch.emergency_pct ?? current.emergency_pct,
    };

    await this.db.prepare(`
      INSERT INTO budget_config (id, monthly_limit_usd, soft_pct, hard_pct, emergency_pct, updated_at)
      VALUES (1, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        monthly_limit_usd = excluded.monthly_limit_usd,
        soft_pct = excluded.soft_pct,
        hard_pct = excluded.hard_pct,
        emergency_pct = excluded.emergency_pct,
        updated_at = excluded.updated_at
    `).bind(merged.monthly_limit_usd, merged.soft_pct, merged.hard_pct, merged.emergency_pct).run();

    return merged;
  }

  /** Record a cost entry in the ledger. */
  async recordCost(
    agentId: string,
    runId: string | null,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<number> {
    const cost = estimateCost(model, inputTokens, outputTokens);
    await this.db.prepare(`
      INSERT INTO budget_ledger (id, agent_id, run_id, model, input_tokens, output_tokens, cost_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), agentId, runId, model, inputTokens, outputTokens, cost
    ).run();
    return cost;
  }

  /** Get total spend for the current month from our ledger. */
  async getMonthlySpend(): Promise<number> {
    const result = await this.db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) as total
      FROM budget_ledger
      WHERE created_at >= datetime('now', 'start of month')
    `).first<{ total: number }>();
    return result?.total ?? 0;
  }

  /** Get spend breakdown by agent for the current month. */
  async getSpendByAgent(): Promise<{ agent_id: string; cost_usd: number; calls: number }[]> {
    const result = await this.db.prepare(`
      SELECT agent_id, SUM(cost_usd) as cost_usd, COUNT(*) as calls
      FROM budget_ledger
      WHERE created_at >= datetime('now', 'start of month')
      GROUP BY agent_id
      ORDER BY cost_usd DESC
    `).all<{ agent_id: string; cost_usd: number; calls: number }>();
    return result.results;
  }

  /** Full budget status check — used by Flight Control and dashboard. */
  async getStatus(anthropicReported: number = 0): Promise<BudgetStatus> {
    const [config, spent] = await Promise.all([
      this.getConfig(),
      this.getMonthlySpend(),
    ]);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = Math.max(1, now.getDate());
    const dailyBurn = spent / daysElapsed;
    const projected = dailyBurn * daysInMonth;
    const pctUsed = config.monthly_limit_usd > 0
      ? (spent / config.monthly_limit_usd) * 100
      : 0;

    let throttle: ThrottleLevel = 'none';
    if (pctUsed >= config.emergency_pct) throttle = 'emergency';
    else if (pctUsed >= config.hard_pct) throttle = 'hard';
    else if (pctUsed >= config.soft_pct) throttle = 'soft';

    return {
      config,
      spent_this_month: Math.round(spent * 100) / 100,
      remaining: Math.round((config.monthly_limit_usd - spent) * 100) / 100,
      pct_used: Math.round(pctUsed * 10) / 10,
      throttle_level: throttle,
      days_in_month: daysInMonth,
      days_elapsed: daysElapsed,
      daily_burn_rate: Math.round(dailyBurn * 100) / 100,
      projected_monthly: Math.round(projected * 100) / 100,
      anthropic_reported: Math.round(anthropicReported * 100) / 100,
    };
  }

  /** Get agent-specific limits based on current throttle level. */
  async getAgentLimits(): Promise<AgentBudgetLimits> {
    const status = await this.getStatus();

    switch (status.throttle_level) {
      case 'soft':
        return {
          analyst_batch: 10,
          cartographer_batch: 20,
          skip_observer: false,
          skip_curator: false,
          pause_all_ai: false,
        };
      case 'hard':
        return {
          analyst_batch: 5,
          cartographer_batch: 10,
          skip_observer: true,
          skip_curator: true,
          pause_all_ai: false,
        };
      case 'emergency':
        return {
          analyst_batch: 0,
          cartographer_batch: 0,
          skip_observer: true,
          skip_curator: true,
          pause_all_ai: true,
        };
      default:
        return {
          analyst_batch: 30,
          cartographer_batch: 50,
          skip_observer: false,
          skip_curator: false,
          pause_all_ai: false,
        };
    }
  }
}

// ─── Anthropic Usage Report API (optional verification) ─────────

export async function fetchAnthropicUsageReport(anthropicAdminKey: string | undefined): Promise<number> {
  if (!anthropicAdminKey) return 0;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  try {
    const res = await fetch(
      `https://api.anthropic.com/v1/organizations/usage_report/messages` +
      `?starting_at=${startOfMonth.toISOString()}&bucket_width=1d`,
      {
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': anthropicAdminKey,
        },
      }
    );

    if (!res.ok) return 0;
    const data = await res.json() as { data?: { usage?: { model: string; input_tokens: number; output_tokens: number }[] }[] };

    let totalCost = 0;
    for (const bucket of data.data ?? []) {
      for (const item of bucket.usage ?? []) {
        try {
          totalCost += estimateCost(
            item.model,
            item.input_tokens ?? 0,
            item.output_tokens ?? 0,
          );
        } catch (err) {
          // Anthropic may report legacy / future model IDs that aren't
          // in our table yet. Log once and skip — verification-only
          // path, never blocks primary ledger accounting.
          console.warn(`[budgetManager] usage report skipped model: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    return totalCost;
  } catch {
    return 0;
  }
}
