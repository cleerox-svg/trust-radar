// Averrow — Cartographer Health Handler
//
// Focused diagnostic for the Phase 0 enrichment pipeline. Designed for
// programmatic consumption (Claude Code, ops scripts) when platform-diagnostics
// is too coarse and a wrangler shell is too heavy. All queries are read-only.

import { json } from "../lib/cors";
import { PRIVATE_IP_SQL_FILTER } from "../lib/geoip";
import type { Env } from "../types";

/** GET /api/admin/cartographer-health    (JWT super-admin auth)
 *  GET /api/internal/cartographer-health  (AVERROW_INTERNAL_SECRET auth) */
export async function handleCartographerHealth(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  try {
    // ─── Migration sanity ─────────────────────────────────────────
    // If migration 0110 hasn't applied, every other query that references
    // enrichment_attempts will throw. Surface the gap as the first field
    // so the consumer can short-circuit before reading the rest.
    const columnP = env.DB.prepare(
      "SELECT name, type, [notnull] AS not_null, dflt_value FROM pragma_table_info('threats') WHERE name = 'enrichment_attempts'"
    ).first<{ name: string; type: string; not_null: number; dflt_value: string | null }>();

    const indexP = env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_threats_carto_phase0'"
    ).first<{ sql: string | null }>();

    // ─── Attempts distribution ────────────────────────────────────
    // Histogram across the full 0..5 range so the consumer can see the
    // shape of the queue: heavy at 0 = fresh ingest dominating, heavy at
    // higher buckets = ip-api yield is poor and most threats are spinning.
    const attemptsHistP = env.DB.prepare(`
      SELECT enrichment_attempts AS attempts, COUNT(*) AS n
      FROM threats
      WHERE enriched_at IS NULL
        AND ip_address IS NOT NULL AND ip_address != ''
      GROUP BY enrichment_attempts
      ORDER BY enrichment_attempts ASC
    `).all<{ attempts: number; n: number }>();

    // ─── Queue / exhausted split (matches platform-diagnostics) ───
    const queueP = env.DB.prepare(`
      SELECT
        SUM(CASE WHEN enrichment_attempts < 5 THEN 1 ELSE 0 END) AS queue_active,
        SUM(CASE WHEN enrichment_attempts >= 5 THEN 1 ELSE 0 END) AS exhausted
      FROM threats
      WHERE enriched_at IS NULL
        AND ip_address IS NOT NULL AND ip_address != ''
        ${PRIVATE_IP_SQL_FILTER}
    `).first<{ queue_active: number; exhausted: number }>();

    // ─── Stuck pile (pre-fix orphans) ─────────────────────────────
    // Threats with enriched_at stamped but no lat — partial-geo bug from
    // before migration 0110 / cartographer attempts logic. Distinct from
    // the cartographer queue (those have enriched_at NULL).
    const stuckP = env.DB.prepare(`
      SELECT COUNT(*) AS n FROM threats
      WHERE status = 'active'
        AND enriched_at IS NOT NULL
        AND lat IS NULL
        AND ip_address IS NOT NULL AND ip_address != ''
    `).first<{ n: number }>();

    // ─── Throughput: enriched-now vs queue ────────────────────────
    const throughputP = env.DB.prepare(`
      SELECT
        SUM(CASE WHEN lat IS NOT NULL AND enriched_at >= datetime('now', '-1 hour') THEN 1 ELSE 0 END) AS enriched_last_hour,
        SUM(CASE WHEN lat IS NOT NULL AND enriched_at >= datetime('now', '-6 hours') THEN 1 ELSE 0 END) AS enriched_last_6h,
        SUM(CASE WHEN lat IS NOT NULL AND enriched_at >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS enriched_last_24h
      FROM threats
    `).first<{ enriched_last_hour: number; enriched_last_6h: number; enriched_last_24h: number }>();

    // ─── Recent runs ──────────────────────────────────────────────
    const recentRunsP = env.DB.prepare(`
      SELECT id, status, started_at, completed_at, duration_ms, records_processed,
             outputs_generated, tokens_used, error_message
      FROM agent_runs
      WHERE agent_id = 'cartographer'
      ORDER BY started_at DESC
      LIMIT 10
    `).all<{
      id: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      duration_ms: number | null;
      records_processed: number | null;
      outputs_generated: number | null;
      tokens_used: number | null;
      error_message: string | null;
    }>();

    // ─── Recent Phase 0 batches (yield = batch_enriched / batch_size) ─
    // The diagnostic agent_outputs row pushed at the end of Phase 0 carries
    // batch_enriched, rdap_enriched, batch_size, and max_batches. Surfacing
    // batch_enriched lets us calculate ip-api yield without scraping logs.
    const batchOutputsP = env.DB.prepare(`
      SELECT created_at, summary,
             json_extract(details, '$.batch_enriched') AS batch_enriched,
             json_extract(details, '$.rdap_enriched') AS rdap_enriched,
             json_extract(details, '$.batch_size') AS batch_size,
             json_extract(details, '$.max_batches') AS max_batches
      FROM agent_outputs
      WHERE agent_id = 'cartographer' AND type = 'diagnostic'
      ORDER BY created_at DESC
      LIMIT 10
    `).all<{
      created_at: string;
      summary: string;
      batch_enriched: number | null;
      rdap_enriched: number | null;
      batch_size: number | null;
      max_batches: number | null;
    }>();

    const [
      column, indexRow, attemptsHist, queue, stuck, throughput, recentRuns, batchOutputs,
    ] = await Promise.all([
      columnP, indexP, attemptsHistP, queueP, stuckP, throughputP, recentRunsP, batchOutputsP,
    ]);

    // ─── Compute ip-api yield from recent batches ─────────────────
    // Yield = avg(batch_enriched / max_theoretical) where max_theoretical
    // = batch_size × max_batches. This is the headline number that drives
    // the "do we need a fallback geo source?" decision.
    const validYields = batchOutputs.results
      .filter(r => r.batch_enriched != null && r.batch_size != null && r.max_batches != null)
      .map(r => {
        const max = (r.batch_size ?? 0) * (r.max_batches ?? 0);
        return max > 0 ? (r.batch_enriched ?? 0) / max : null;
      })
      .filter((v): v is number => v != null);

    const avgYieldPct = validYields.length > 0
      ? Math.round((validYields.reduce((a, b) => a + b, 0) / validYields.length) * 1000) / 10
      : null;

    // ─── Migration status flag ────────────────────────────────────
    const migration0110Applied = column != null;
    const indexHasAttemptsFilter = (indexRow?.sql ?? "").includes("enrichment_attempts < 5");

    return json({
      success: true,
      data: {
        _meta: {
          generated_at: new Date().toISOString(),
          endpoint_version: 1,
        },

        migration: {
          // If false, all other fields below are stale or partial. The
          // diagnostic queries reference enrichment_attempts; if the column
          // is missing some of them throw and the response is incomplete.
          column_applied: migration0110Applied,
          index_has_attempts_filter: indexHasAttemptsFilter,
          column_def: column,
          index_sql: indexRow?.sql ?? null,
        },

        queue: {
          active: queue?.queue_active ?? 0,
          exhausted: queue?.exhausted ?? 0,
          stuck_pile: stuck?.n ?? 0,
          attempts_histogram: attemptsHist.results,
        },

        throughput: {
          enriched_last_hour: throughput?.enriched_last_hour ?? 0,
          enriched_last_6h: throughput?.enriched_last_6h ?? 0,
          enriched_last_24h: throughput?.enriched_last_24h ?? 0,
        },

        ip_api_yield: {
          recent_batches: batchOutputs.results,
          avg_yield_pct: avgYieldPct,
          // Threshold guidance for the consumer:
          //  >= 50%  → ip-api is healthy, no fallback needed
          //  20-50% → degraded but functional, monitor
          //  <  20% → fallback geo source likely needed (Cloudflare Radar, MaxMind)
        },

        recent_runs: recentRuns.results,
      },
    }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: message }, 500, origin);
  }
}
