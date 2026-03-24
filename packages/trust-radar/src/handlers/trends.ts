// TODO: Refactor to use handler-utils (Phase 6 continuation)
// Averrow — Trend API Endpoints

import { json } from "../lib/cors";
import type { Env } from "../types";

function periodClause(period: string): { since: string; bucket: string; hourly: boolean } {
  switch (period) {
    case "7d": return { since: "datetime('now', '-7 days')", bucket: "strftime('%Y-%m-%d %H:00', created_at)", hourly: true };
    case "90d": return { since: "datetime('now', '-90 days')", bucket: "date(created_at)", hourly: false };
    case "1y": return { since: "datetime('now', '-1 year')", bucket: "strftime('%Y-%m', created_at)", hourly: false };
    default: return { since: "datetime('now', '-30 days')", bucket: "date(created_at)", hourly: false };
  }
}

/**
 * Collect all unique period labels across multiple series, sorted chronologically.
 */
function collectLabels(rows: Array<{ period: string }>): string[] {
  return [...new Set(rows.map((r) => r.period))].sort();
}

/**
 * Pivot raw rows [{name, period, count}] into {labels, series} for Chart.js.
 */
function pivotToSeries(
  rows: Array<{ name: string; period: string; count: number }>,
  limit: number,
): { labels: string[]; series: Array<{ name: string; values: number[] }> } {
  const labels = collectLabels(rows);

  // Group by name
  const byName: Record<string, Map<string, number>> = {};
  const totals: Record<string, number> = {};
  for (const row of rows) {
    if (!byName[row.name]) { byName[row.name] = new Map(); totals[row.name] = 0; }
    byName[row.name]!.set(row.period, (byName[row.name]!.get(row.period) ?? 0) + row.count);
    totals[row.name] = (totals[row.name] ?? 0) + row.count;
  }

  // Sort by total desc, take top N
  const sorted = Object.keys(byName)
    .sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))
    .slice(0, limit);

  const series = sorted.map((name) => ({
    name,
    values: labels.map((l) => byName[name]!.get(l) ?? 0),
  }));

  return { labels, series };
}

// GET /api/trends/volume
export async function handleTrendVolume(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const { since, bucket } = periodClause(new URL(request.url).searchParams.get("period") ?? "30d");

    const rows = await env.DB.prepare(`
      SELECT ${bucket} AS period, COUNT(*) AS total,
             SUM(CASE WHEN severity IN ('critical','high') THEN 1 ELSE 0 END) AS high_sev,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
      FROM threats WHERE created_at >= ${since}
      GROUP BY ${bucket} ORDER BY period ASC
    `).all<{ period: string; total: number; high_sev: number; active: number }>();

    const labels = rows.results.map((r) => r.period);
    const values = rows.results.map((r) => r.total);
    const high_sev = rows.results.map((r) => r.high_sev);
    const active = rows.results.map((r) => r.active);

    return json({ success: true, data: { labels, values, high_sev, active } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/trends/brands
export async function handleTrendBrands(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const { since, bucket } = periodClause(url.searchParams.get("period") ?? "30d");
    const limit = Math.min(10, parseInt(url.searchParams.get("limit") ?? "5", 10));

    const rows = await env.DB.prepare(`
      SELECT b.name AS name, ${bucket} AS period, COUNT(t.id) AS count
      FROM threats t JOIN brands b ON b.id = t.target_brand_id
      WHERE t.created_at >= ${since} AND t.target_brand_id IS NOT NULL
      GROUP BY b.id, ${bucket}
      ORDER BY period ASC
    `).all<{ name: string; period: string; count: number }>();

    const result = pivotToSeries(rows.results, limit);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/trends/providers
export async function handleTrendProviders(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const { since, bucket } = periodClause(url.searchParams.get("period") ?? "30d");
    const limit = Math.min(10, parseInt(url.searchParams.get("limit") ?? "5", 10));

    const rows = await env.DB.prepare(`
      SELECT COALESCE(hp.name, t.hosting_provider_id) AS name,
             ${bucket} AS period, COUNT(*) AS count
      FROM threats t
      LEFT JOIN hosting_providers hp ON hp.id = t.hosting_provider_id
      WHERE t.created_at >= ${since} AND t.hosting_provider_id IS NOT NULL
      GROUP BY t.hosting_provider_id, ${bucket}
      ORDER BY period ASC
    `).all<{ name: string; period: string; count: number }>();

    const result = pivotToSeries(rows.results, limit);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/trends/tlds
export async function handleTrendTLDs(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const { since, bucket } = periodClause(url.searchParams.get("period") ?? "30d");

    const rows = await env.DB.prepare(`
      SELECT
        CASE
          WHEN malicious_domain LIKE '%.com' THEN '.com'
          WHEN malicious_domain LIKE '%.net' THEN '.net'
          WHEN malicious_domain LIKE '%.org' THEN '.org'
          WHEN malicious_domain LIKE '%.xyz' THEN '.xyz'
          WHEN malicious_domain LIKE '%.top' THEN '.top'
          WHEN malicious_domain LIKE '%.info' THEN '.info'
          WHEN malicious_domain LIKE '%.tk' THEN '.tk'
          WHEN malicious_domain LIKE '%.ml' THEN '.ml'
          WHEN malicious_domain LIKE '%.cf' THEN '.cf'
          ELSE 'other'
        END AS name,
        ${bucket} AS period,
        COUNT(*) AS count
      FROM threats
      WHERE created_at >= ${since} AND malicious_domain IS NOT NULL
      GROUP BY name, ${bucket}
      ORDER BY period ASC
    `).all<{ name: string; period: string; count: number }>();

    const result = pivotToSeries(rows.results, 15);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/trends/types
export async function handleTrendTypes(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const { since, bucket } = periodClause(new URL(request.url).searchParams.get("period") ?? "30d");

    const rows = await env.DB.prepare(`
      SELECT threat_type AS name, ${bucket} AS period, COUNT(*) AS count
      FROM threats WHERE created_at >= ${since}
      GROUP BY threat_type, ${bucket} ORDER BY period ASC
    `).all<{ name: string; period: string; count: number }>();

    const result = pivotToSeries(rows.results, 10);
    return json({ success: true, data: result }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/trends/compare
export async function handleTrendCompare(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const url = new URL(request.url);
    const entityA = url.searchParams.get("a");
    const entityB = url.searchParams.get("b");
    const type = url.searchParams.get("type") ?? "brand"; // brand | provider
    const { since, bucket } = periodClause(url.searchParams.get("period") ?? "30d");

    if (!entityA || !entityB) return json({ success: false, error: "Both a and b parameters required" }, 400, origin);

    const field = type === "provider" ? "hosting_provider_id" : "target_brand_id";

    const [rowsA, rowsB] = await Promise.all([
      env.DB.prepare(`SELECT ${bucket} AS period, COUNT(*) AS count FROM threats WHERE ${field} = ? AND created_at >= ${since} GROUP BY ${bucket} ORDER BY period ASC`).bind(entityA).all<{ period: string; count: number }>(),
      env.DB.prepare(`SELECT ${bucket} AS period, COUNT(*) AS count FROM threats WHERE ${field} = ? AND created_at >= ${since} GROUP BY ${bucket} ORDER BY period ASC`).bind(entityB).all<{ period: string; count: number }>(),
    ]);

    // Merge labels from both series
    const allLabels = collectLabels([...rowsA.results, ...rowsB.results]);
    const mapA = new Map(rowsA.results.map((r) => [r.period, r.count]));
    const mapB = new Map(rowsB.results.map((r) => [r.period, r.count]));

    return json({
      success: true,
      data: {
        labels: allLabels,
        series: [
          { name: entityA, values: allLabels.map((l) => mapA.get(l) ?? 0) },
          { name: entityB, values: allLabels.map((l) => mapB.get(l) ?? 0) },
        ],
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
