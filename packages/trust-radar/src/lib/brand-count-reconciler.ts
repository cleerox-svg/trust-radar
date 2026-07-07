/**
 * Brand threat-counter reconciler.
 *
 * brands.threat_count / brands.last_threat_seen are pre-computed columns
 * (CLAUDE.md §8: "use them, don't re-derive") but drifted permanently
 * because several brand-link paths set threats.target_brand_id without
 * bumping the counter (analyst keyword pre-match was the highest-volume
 * offender; feedRunner inserts, watchdog escalations, and the spam-trap
 * extra-URL loop also skip it) and no job owned the recompute — the
 * hosting_providers counters have cartographer as their owner; brands
 * had no equivalent.
 *
 * Audit 2026-07-07: 4,420 of 9,853 linked brands (45%) had a wrong
 * counter, 3,246 stuck at 0 despite live threats. Beyond the Brands
 * page sort, the mastodon/reddit feeds gate eligibility on
 * threat_count > 0, so stuck-at-zero brands were silently excluded
 * from social monitoring.
 *
 * Strategy: one GROUP BY over threats(target_brand_id) per run
 * (index-driven via idx_threats_brand_status), diffed in memory
 * against the non-zero counters, then batched UPDATEs for drifted
 * rows only. Steady-state this touches only the rows the incremental
 * writers missed since the last run. Semantics: COUNT(*) of ALL
 * linked threats regardless of status — parity with the two existing
 * authoritative recompute sites in handlers/brands.ts (add-monitored
 * and deep-scan flows).
 *
 * Runs inside the cube_healer agent (6-hourly cron) — same "healer"
 * pattern that bounds cube drift. Stamps its result into KV
 * (metrics:brand_threat_count_drift) for platform-diagnostics.
 */

import type { Env } from '../types';

export interface BrandCountReconcileResult {
  brandsChecked: number;
  drifted: number;
  fixed: number;
}

export const BRAND_DRIFT_METRIC_KEY = 'metrics:brand_threat_count_drift';
const BATCH_SIZE = 100;

export async function reconcileBrandThreatCounts(env: Env): Promise<BrandCountReconcileResult> {
  const [agg, current] = await Promise.all([
    env.DB.prepare(
      `SELECT target_brand_id AS id, COUNT(*) AS n, MAX(last_seen) AS latest
         FROM threats
        WHERE target_brand_id IS NOT NULL
        GROUP BY target_brand_id`,
    ).all<{ id: string; n: number; latest: string | null }>(),
    env.DB.prepare(
      `SELECT id, threat_count FROM brands WHERE threat_count != 0`,
    ).all<{ id: string; threat_count: number }>(),
  ]);

  const currentMap = new Map(current.results.map((r) => [r.id, r.threat_count]));
  const liveIds = new Set<string>();
  const fixes: D1PreparedStatement[] = [];

  for (const row of agg.results) {
    liveIds.add(row.id);
    if ((currentMap.get(row.id) ?? 0) !== row.n) {
      // COALESCE keeps an existing last_threat_seen when the aggregate
      // has no timestamp (last_seen NULL on every linked row).
      fixes.push(
        env.DB.prepare(
          `UPDATE brands
              SET threat_count = ?,
                  last_threat_seen = COALESCE(?, last_threat_seen)
            WHERE id = ?`,
        ).bind(row.n, row.latest, row.id),
      );
    }
  }

  // Counter is non-zero but no linked threats remain (links removed or
  // threats deleted) — zero it so the social-feed eligibility gate and
  // list sort stop trusting a phantom count.
  for (const row of current.results) {
    if (!liveIds.has(row.id)) {
      fixes.push(
        env.DB.prepare(`UPDATE brands SET threat_count = 0 WHERE id = ?`).bind(row.id),
      );
    }
  }

  let fixed = 0;
  for (let i = 0; i < fixes.length; i += BATCH_SIZE) {
    const res = await env.DB.batch(fixes.slice(i, i + BATCH_SIZE));
    fixed += res.reduce((s, r) => s + (r.meta?.changes ?? 0), 0);
  }

  const result: BrandCountReconcileResult = {
    brandsChecked: liveIds.size,
    drifted: fixes.length,
    fixed,
  };

  // Best-effort telemetry stamp — read back by platform-diagnostics as
  // `brand_count_drift`. Persistent large `drifted` between runs means
  // a new writer is skipping the counter again.
  try {
    await env.CACHE.put(
      BRAND_DRIFT_METRIC_KEY,
      JSON.stringify({ ...result, checked_at: new Date().toISOString() }),
      { expirationTtl: 7 * 24 * 3600 },
    );
  } catch {
    // metric stamp only — never fail the reconcile over KV
  }

  return result;
}
