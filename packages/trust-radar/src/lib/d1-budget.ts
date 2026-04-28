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

/** Daily budget (1/30 of the monthly ceiling). */
export const DAILY_BUDGET = Math.round(PLAN_CEILING_PER_MONTH / 30);

/** Pre-warm anything below 85% of daily budget. Above is the warning zone. */
export const WARN_THRESHOLD = Math.round(DAILY_BUDGET * 0.85);

/** Skip non-essential pre-warms above 95% of daily budget. */
export const SKIP_THRESHOLD = Math.round(DAILY_BUDGET * 0.95);

const KV_KEY = "d1_budget:rows_read_24h";
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
  const databaseId = (env as unknown as Record<string, string | undefined>).D1_DATABASE_ID;
  if (!token || !accountId || !databaseId) return null;

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
