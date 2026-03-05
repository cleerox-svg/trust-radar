import { json } from "../lib/cors";
import type { Env } from "../types";

const SOURCE_MAP: Record<string, string> = {
  web: "station-alpha",
  api: "station-beta",
  extension: "station-gamma",
};

function domainToRange(domain: string): number {
  let h = 0;
  for (let i = 0; i < domain.length; i++) {
    h = (Math.imul(31, h) + domain.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 90000) + 10000;
}

function scoreToIntensity(score: number): number {
  // Low trust = high intensity threat signal
  return Math.round(((100 - score) / 100) * 60 * 10) / 10;
}

function scoreToTags(score: number, flags: string): string[] {
  const tags: string[] = [];
  try {
    const f = JSON.parse(flags) as Array<{ type: string }>;
    if (f.length === 0) tags.push("nominal");
    else tags.push(...f.slice(0, 2).map((x) => x.type.replace(/_/g, "-")));
  } catch {
    if (score >= 70) tags.push("nominal");
    else if (score >= 40) tags.push("weak-signal");
    else tags.push("anomaly", "high-gain");
  }
  return tags;
}

export async function handleSignals(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

  try {
    const rows = await env.DB.prepare(
      `SELECT id, url, domain, trust_score, risk_level, flags, source, cached, created_at
       FROM scans ORDER BY created_at DESC LIMIT ?`
    ).bind(limit).all<{ id: string; url: string; domain: string; trust_score: number; risk_level: string; flags: string; source: string; cached: number; created_at: string }>();

    const signals = rows.results.map((r) => ({
      id: r.id,
      captured_at: r.created_at,
      source: r.cached ? "node-001" : (SOURCE_MAP[r.source] ?? "station-alpha"),
      range_m: domainToRange(r.domain),
      intensity_dbz: scoreToIntensity(r.trust_score),
      quality: r.trust_score,
      tags: scoreToTags(r.trust_score, r.flags),
      domain: r.domain,
      risk_level: r.risk_level,
    }));

    return json({ success: true, data: signals }, 200, origin);
  } catch {
    return json({ success: true, data: [] }, 200, origin);
  }
}

export async function handleAlerts(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  try {
    // First try the signal_alerts table
    const alertRows = await env.DB.prepare(
      "SELECT * FROM signal_alerts WHERE status = 'open' ORDER BY created_at DESC LIMIT 10"
    ).all<{ id: string; source: string; scan_ref: string; quality: number; status: string; created_at: string }>()
      .catch(() => ({ results: [] as Array<{ id: string; source: string; scan_ref: string; quality: number; status: string; created_at: string }> }));

    if (alertRows.results.length > 0) {
      return json({ success: true, data: alertRows.results }, 200, origin);
    }

    // Fall back to high/critical scans
    const rows = await env.DB.prepare(
      `SELECT id, domain, trust_score, source, cached, created_at FROM scans
       WHERE risk_level IN ('critical', 'high')
       ORDER BY created_at DESC LIMIT 10`
    ).all<{ id: string; domain: string; trust_score: number; source: string; cached: number; created_at: string }>();

    const alerts = rows.results.map((r, i) => ({
      id: `scan-${Math.floor(Math.random() * 9000) + 1000}`,
      source: r.cached ? "node-001" : (SOURCE_MAP[r.source] ?? "station-alpha"),
      scan_ref: r.id,
      domain: r.domain,
      quality: r.trust_score,
      status: i === 0 ? "open" : "open",
      created_at: r.created_at,
    }));

    return json({ success: true, data: alerts }, 200, origin);
  } catch {
    return json({ success: true, data: [] }, 200, origin);
  }
}

export async function handleAckAlert(request: Request, env: Env, alertId: string): Promise<Response> {
  const origin = request.headers.get("Origin");

  try {
    await env.DB.prepare(
      "UPDATE signal_alerts SET status = 'acked' WHERE id = ?"
    ).bind(alertId).run().catch(() => {});
    return json({ success: true }, 200, origin);
  } catch {
    return json({ success: true }, 200, origin);
  }
}
