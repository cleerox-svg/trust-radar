// Daily D1 read-budget soft-cap.
//
// Cloudflare's free-plan ceiling is 25B rows_read/month. Spread evenly
// that's ~833M/day. We keep 5% headroom and start skipping non-essential
// pre-warms once the rolling-24h read total crosses the SKIP threshold.
//
// The number that drives the decision comes from CF GraphQL's
// d1AnalyticsAdaptiveGroups (same endpoint platform-diagnostics uses).
// We poll it at most once an hour and stash the value in KV so the
// every-5-min Navigator ticks don't each pay a CF GraphQL round-trip.
//
// Failure modes:
//   - No CF token configured: we don't know — assume under budget (no
//     skip). The platform-diagnostics dashboard will still flag the
//     setup gap.
//   - GraphQL error / rate-limit: keep the previous KV value if any,
//     otherwise treat as unknown (no skip).
//   - KV miss: refresh on this tick.

import type { Env } from "../types";

/** Plan ceiling: 25B reads/month. */
const PLAN_CEILING_PER_MONTH = 25_000_000_000;

/**
 * D1 database id — same literal used in `handlers/diagnostics.ts`
 * and matches `database_id` in `wrangler.toml`. Hardcoded here too
 * because there's no `D1_DATABASE_ID` env var configured on the
 * worker (the binding is named `DB`); we need the literal to query
 * CF GraphQL by databaseId.
 */
const D1_DATABASE_ID = "a3776a5f-c07c-4e20-9f3b-8d7f8c7f90c6";

/** Daily budget (1/30 of the monthly ceiling). */
export const DAILY_BUDGET = Math.round(PLAN_CEILING_PER_MONTH / 30);

/** Pre-warm anything below 85% of daily budget. Above is the warning zone. */
export const WARN_THRESHOLD = Math.round(DAILY_BUDGET * 0.85);

/** Skip non-essential pre-warms above 95% of daily budget. */
export const SKIP_THRESHOLD = Math.round(DAILY_BUDGET * 0.95);

const KV_KEY = "d1_budget:rows_read_24h";
const KV_KEY_LAST_SKIP = "d1_budget:last_skip_at";
const KV_KEY_SKIP_COUNT_24H = "d1_budget:skip_count_24h";
/** Cached for 65 min so a single-tick failure doesn't blow the cache. */
const KV_TTL_SECONDS = 65 * 60;

interface BudgetState {
  /** Total D1 rows read in the last 24h. */
  rowsRead24h: number;
  /** When this value was fetched (epoch ms). */
  fetchedAtMs: number;
  /** True if we couldn't reach CF GraphQL — value comes from a previous tick. */
  stale: boolean;
}

interface CachedBudget {
  rowsRead24h: number;
  fetchedAtMs: number;
}

/**
 * Get the current 24h rows-read total. Re-fetches from CF GraphQL once
 * per hour; otherwise returns the cached value.
 */
export async function getBudgetState(env: Env): Promise<BudgetState | null> {
  const token = (env as unknown as Record<string, string | undefined>).CF_API_TOKEN;
  const accountId = (env as unknown as Record<string, string | undefined>).CF_ACCOUNT_ID;
  if (!token || !accountId) return null;
  const databaseId = D1_DATABASE_ID;

  const cachedRaw = await env.CACHE.get(KV_KEY);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as CachedBudget;
      // Refresh if older than 60 min — we don't want to drift more than
      // an hour behind reality, even if KV TTL hasn't expired yet.
      if (Date.now() - cached.fetchedAtMs < 60 * 60 * 1000) {
        return { rowsRead24h: cached.rowsRead24h, fetchedAtMs: cached.fetchedAtMs, stale: false };
      }
    } catch {
      // fall through and refresh
    }
  }

  const fresh = await fetchRowsRead24h(token, accountId, databaseId);
  if (fresh == null) {
    // CF GraphQL failed — fall back to the (stale) cached value if any.
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as CachedBudget;
        return { rowsRead24h: cached.rowsRead24h, fetchedAtMs: cached.fetchedAtMs, stale: true };
      } catch {
        return null;
      }
    }
    return null;
  }

  const state: CachedBudget = { rowsRead24h: fresh, fetchedAtMs: Date.now() };
  await env.CACHE.put(KV_KEY, JSON.stringify(state), { expirationTtl: KV_TTL_SECONDS });
  return { ...state, stale: false };
}

/** Returns true if non-essential pre-warms should be skipped this tick. */
export function shouldSkipNonEssentialWarms(state: BudgetState | null): boolean {
  if (!state) return false;
  return state.rowsRead24h >= SKIP_THRESHOLD;
}

/**
 * Record that Navigator just skipped a non-essential pre-warm tick.
 * Increments a 24h-windowed counter + bumps `last_skip_at` so the
 * diagnostics endpoint can prove the soft-cap is actually firing.
 *
 * Counter expires on a 24h KV TTL, so it self-resets after a day
 * of no skips. We don't try to atomically increment — KV doesn't
 * support that — so under heavy contention the count is approximate
 * (off by a few). Acceptable for a "is the cap working" signal.
 */
export async function recordNavigatorSkip(env: Env): Promise<void> {
  const now = Date.now();
  try {
    await env.CACHE.put(KV_KEY_LAST_SKIP, String(now), { expirationTtl: 7 * 24 * 60 * 60 });

    const prev = await env.CACHE.get(KV_KEY_SKIP_COUNT_24H);
    const prevCount = prev ? parseInt(prev, 10) || 0 : 0;
    await env.CACHE.put(KV_KEY_SKIP_COUNT_24H, String(prevCount + 1), {
      expirationTtl: 24 * 60 * 60,
    });
  } catch {
    // KV failure shouldn't kill the cron tick.
  }
}

/**
 * Diagnostics surface for the soft-cap. Returns everything the operator
 * needs to answer "is the cap working and how aggressively?"
 */
export interface BudgetDiagnostics {
  /** CF-reported rows_read in the last 24h. */
  rows_read_24h: number | null;
  /** When that value was fetched (ISO). */
  fetched_at: string | null;
  /** True when KV had a value but CF GraphQL is currently failing. */
  stale: boolean;
  /** Plain-language thresholds for the operator's mental model. */
  daily_budget: number;
  warn_threshold: number;
  skip_threshold: number;
  /** Where we sit relative to the budget. */
  pct_of_daily_budget: number | null;
  threshold_state: 'ok' | 'warn' | 'skip' | 'unknown';
  /** When Navigator last skipped a pre-warm (ISO), if ever. */
  last_skip_at: string | null;
  /** Approximate count of skipped ticks in the last 24h. */
  skip_count_24h: number;
}

export async function getBudgetDiagnostics(env: Env): Promise<BudgetDiagnostics> {
  const state = await getBudgetState(env);
  const lastSkipRaw = await env.CACHE.get(KV_KEY_LAST_SKIP).catch(() => null);
  const skipCountRaw = await env.CACHE.get(KV_KEY_SKIP_COUNT_24H).catch(() => null);

  const rowsRead = state?.rowsRead24h ?? null;
  const pct = rowsRead != null
    ? Math.round((rowsRead / DAILY_BUDGET) * 1000) / 10
    : null;

  let thresholdState: BudgetDiagnostics['threshold_state'] = 'unknown';
  if (rowsRead != null) {
    if (rowsRead >= SKIP_THRESHOLD) thresholdState = 'skip';
    else if (rowsRead >= WARN_THRESHOLD) thresholdState = 'warn';
    else thresholdState = 'ok';
  }

  return {
    rows_read_24h: rowsRead,
    fetched_at: state ? new Date(state.fetchedAtMs).toISOString() : null,
    stale: state?.stale ?? false,
    daily_budget: DAILY_BUDGET,
    warn_threshold: WARN_THRESHOLD,
    skip_threshold: SKIP_THRESHOLD,
    pct_of_daily_budget: pct,
    threshold_state: thresholdState,
    last_skip_at: lastSkipRaw ? new Date(parseInt(lastSkipRaw, 10)).toISOString() : null,
    skip_count_24h: skipCountRaw ? parseInt(skipCountRaw, 10) || 0 : 0,
  };
}

/** Per-query stat from CF d1QueriesAdaptiveGroups. */
export interface D1QueryStat {
  /** Stable hash CF assigns to the SQL text (after parameter normalization). */
  query_hash: string;
  /** Truncated sample of the SQL text. May be null when CF doesn't surface it. */
  query_sample: string | null;
  rows_read: number;
  rows_written: number;
  query_count: number;
  avg_rows_per_query: number;
}

/**
 * Top-N queries by rows_read in the last 24h. Hits CF's per-query
 * analytics endpoint (d1QueriesAdaptiveGroups) so we get visibility
 * even on uninstrumented endpoints. Complements our AE-based
 * recordD1Reads attribution which only covers handlers we've wired.
 */
export interface TopQueriesResult {
  /** Stats array; empty when no data (or when error is set). */
  queries: D1QueryStat[];
  /** Diagnostic message — surfaces what blocked the fetch when
   *  `queries` is empty, so the operator can debug from
   *  /api/internal/platform-diagnostics output without grepping logs. */
  error: string | null;
}

export async function fetchD1TopQueries(env: Env, limit = 20): Promise<TopQueriesResult> {
  const token = (env as unknown as Record<string, string | undefined>).CF_API_TOKEN;
  const accountId = (env as unknown as Record<string, string | undefined>).CF_ACCOUNT_ID;
  if (!token || !accountId) {
    return { queries: [], error: "CF_API_TOKEN or CF_ACCOUNT_ID not configured" };
  }
  const databaseId = D1_DATABASE_ID;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Cloudflare's per-query analytics dataset.
  //
  // `sum.queries` from PR #864 doesn't exist — CF rejects with
  // `unknown field "queries"`. The query count is on the top-level
  // `count` field (number of analytics samples in the group),
  // sibling of `sum` and `dimensions` — same pattern as the
  // workers/pages adaptive groups.
  const query = `
    query {
      viewer {
        accounts(filter: { accountTag: "${accountId}" }) {
          d1QueriesAdaptiveGroups(
            filter: { datetimeHour_geq: "${since}", databaseId: "${databaseId}" }
            orderBy: [sum_rowsRead_DESC]
            limit: ${limit}
          ) {
            count
            sum {
              rowsRead
              rowsWritten
            }
            dimensions {
              query
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { queries: [], error: `CF GraphQL HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as {
      data?: {
        viewer?: {
          accounts?: Array<{
            d1QueriesAdaptiveGroups?: Array<{
              count: number;
              sum: { rowsRead: number; rowsWritten: number };
              dimensions: { query: string };
            }>;
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };
    if (json.errors?.length) {
      return {
        queries: [],
        error: json.errors.map((e) => e.message).slice(0, 3).join("; "),
      };
    }

    const groups = json.data?.viewer?.accounts?.[0]?.d1QueriesAdaptiveGroups ?? [];
    if (groups.length === 0) {
      return { queries: [], error: "CF returned 0 query groups (no d1QueriesAdaptiveGroups data?)" };
    }

    const queries = groups.map((g) => ({
      query_hash: g.dimensions.query,
      query_sample: g.dimensions.query,
      rows_read: g.sum.rowsRead,
      rows_written: g.sum.rowsWritten,
      query_count: g.count,
      avg_rows_per_query: g.count > 0
        ? Math.round(g.sum.rowsRead / g.count)
        : 0,
    }));
    return { queries, error: null };
  } catch (err) {
    return {
      queries: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function fetchRowsRead24h(token: string, accountId: string, databaseId: string): Promise<number | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const query = `
    query {
      viewer {
        accounts(filter: { accountTag: "${accountId}" }) {
          d1AnalyticsAdaptiveGroups(
            filter: { datetimeHour_geq: "${since}", databaseId: "${databaseId}" }
            limit: 1000
          ) {
            sum { rowsRead }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: {
        viewer?: {
          accounts?: Array<{
            d1AnalyticsAdaptiveGroups?: Array<{ sum: { rowsRead: number } }>;
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };
    if (json.errors?.length) return null;

    const groups = json.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups ?? [];
    return groups.reduce((acc, g) => acc + (g.sum?.rowsRead ?? 0), 0);
  } catch {
    return null;
  }
}
