// Trust Radar v2 — Trend API Endpoints

import { json } from "../lib/cors";
import type { Env } from "../types";

function periodClause(period: string): { since: string; bucket: string } {
  switch (period) {
    case "7d": return { since: "datetime('now', '-7 days')", bucket: "date(created_at)" };
    case "90d": return { since: "datetime('now', '-90 days')", bucket: "strftime('%Y-%W', created_at)" };
    case "1y": return { since: "datetime('now', '-1 year')", bucket: "strftime('%Y-%m', created_at)" };
    default: return { since: "datetime('now', '-30 days')", bucket: "date(created_at)" };
  }
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
    `).all();

    return json({ success: true, data: rows.results }, 200, origin);
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
      SELECT b.id AS brand_id, b.name, ${bucket} AS period, COUNT(t.id) AS count
      FROM threats t JOIN brands b ON b.id = t.target_brand_id
      WHERE t.created_at >= ${since} AND t.target_brand_id IS NOT NULL
      GROUP BY b.id, ${bucket}
      ORDER BY period ASC
    `).all();

    // Group by brand for sparkline data
    const byBrand: Record<string, { brand_id: string; name: string; points: { period: string; count: number }[] }> = {};
    for (const row of rows.results as { brand_id: string; name: string; period: string; count: number }[]) {
      if (!byBrand[row.brand_id]) byBrand[row.brand_id] = { brand_id: row.brand_id, name: row.name, points: [] };
      byBrand[row.brand_id]!.points.push({ period: row.period, count: row.count });
    }

    // Sort by total and take top N
    const sorted = Object.values(byBrand)
      .map((b) => ({ ...b, total: b.points.reduce((s, p) => s + p.count, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    return json({ success: true, data: sorted }, 200, origin);
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
      SELECT hosting_provider_id AS provider_id, ${bucket} AS period, COUNT(*) AS count
      FROM threats
      WHERE created_at >= ${since} AND hosting_provider_id IS NOT NULL
      GROUP BY hosting_provider_id, ${bucket}
      ORDER BY period ASC
    `).all();

    const byProvider: Record<string, { provider_id: string; points: { period: string; count: number }[] }> = {};
    for (const row of rows.results as { provider_id: string; period: string; count: number }[]) {
      if (!byProvider[row.provider_id]) byProvider[row.provider_id] = { provider_id: row.provider_id, points: [] };
      byProvider[row.provider_id]!.points.push({ period: row.period, count: row.count });
    }

    const sorted = Object.values(byProvider)
      .map((p) => ({ ...p, total: p.points.reduce((s, pt) => s + pt.count, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    return json({ success: true, data: sorted }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// GET /api/trends/tlds
export async function handleTrendTLDs(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  try {
    const { since } = periodClause(new URL(request.url).searchParams.get("period") ?? "30d");

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
        END AS tld,
        COUNT(*) AS count
      FROM threats
      WHERE created_at >= ${since} AND malicious_domain IS NOT NULL
      GROUP BY tld ORDER BY count DESC LIMIT 15
    `).all();

    return json({ success: true, data: rows.results }, 200, origin);
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
      SELECT ${bucket} AS period, threat_type, COUNT(*) AS count
      FROM threats WHERE created_at >= ${since}
      GROUP BY ${bucket}, threat_type ORDER BY period ASC
    `).all();

    return json({ success: true, data: rows.results }, 200, origin);
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
      env.DB.prepare(`SELECT ${bucket} AS period, COUNT(*) AS count FROM threats WHERE ${field} = ? AND created_at >= ${since} GROUP BY ${bucket} ORDER BY period ASC`).bind(entityA).all(),
      env.DB.prepare(`SELECT ${bucket} AS period, COUNT(*) AS count FROM threats WHERE ${field} = ? AND created_at >= ${since} GROUP BY ${bucket} ORDER BY period ASC`).bind(entityB).all(),
    ]);

    return json({ success: true, data: { a: rowsA.results, b: rowsB.results } }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
