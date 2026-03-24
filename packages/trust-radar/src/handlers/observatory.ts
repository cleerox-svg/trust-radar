// TODO: Refactor to use handler-utils (Phase 6 continuation)
// Averrow — Observatory API Endpoints
// Powers the deck.gl + MapLibre GL threat map visualization
//
// Endpoints:
//   GET /api/observatory/nodes      — ScatterplotLayer hotspot clusters
//   GET /api/observatory/arcs       — ArcLayer attack corridors
//   GET /api/observatory/live       — 20 most recent threats (live feed)
//   GET /api/observatory/brand-arcs — Arcs targeting a specific brand
//   GET /api/observatory/stats      — Summary stats bar

import { json } from "../lib/cors";
import type { Env } from "../types";

// ── Static brand HQ coordinates (fallback when no geo data on brand) ──────────
// Used as target positions for arcs targeting known brands.
// Format: [longitude, latitude]
const BRAND_HQ: Record<string, [number, number]> = {
  paypal:       [-121.9, 37.3],   // San Jose, CA
  amazon:       [-122.3, 47.6],   // Seattle, WA
  microsoft:    [-122.1, 47.6],   // Redmond, WA
  google:       [-122.1, 37.4],   // Mountain View, CA
  apple:        [-122.0, 37.3],   // Cupertino, CA
  facebook:     [-122.5, 37.5],   // Menlo Park, CA
  meta:         [-122.5, 37.5],   // Menlo Park, CA
  netflix:      [-118.4, 34.1],   // Los Gatos, CA
  twitter:      [-122.4, 37.8],   // San Francisco, CA
  instagram:    [-122.5, 37.5],   // Menlo Park, CA
  linkedin:     [-122.0, 37.4],   // Sunnyvale, CA
  chase:        [-74.0,  40.7],   // New York, NY
  wellsfargo:   [-122.4, 37.8],   // San Francisco, CA
  bankofamerica:[-80.8,  35.2],   // Charlotte, NC
  citibank:     [-74.0,  40.7],   // New York, NY
  hsbc:         [-0.1,   51.5],   // London, UK
  barclays:     [-0.1,   51.5],   // London, UK
  dhl:          [8.7,    50.1],   // Frankfurt, DE
  fedex:        [-90.0,  35.1],   // Memphis, TN
  ups:          [-84.3,  33.8],   // Atlanta, GA
  netflix2:     [-118.4, 34.1],
  docusign:     [-122.4, 37.8],
  salesforce:   [-122.4, 37.8],
  dropbox:      [-122.4, 37.8],
  slack:        [-122.4, 37.8],
  adobe:        [-117.2, 32.9],   // San Diego, CA
  walmart:      [-94.2,  36.4],   // Bentonville, AR
  target:       [-93.2,  44.9],   // Minneapolis, MN
  ebay:         [-122.0, 37.4],   // San Jose, CA
  default:      [-74.0,  40.7],   // New York, NY (fallback)
};

const FALLBACK_COORDS: [number, number] = [-74.0, 40.7]; // New York, NY

function getBrandCoords(brandName: string | null): [number, number] {
  if (!brandName) return FALLBACK_COORDS;
  const key = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return BRAND_HQ[key] ?? FALLBACK_COORDS;
}

function periodToInterval(period: string): string {
  if (period === "24h") return "-1 days";
  if (period === "30d") return "-30 days";
  if (period === "all") return "-3650 days";
  return "-7 days"; // default 7d
}

function buildSourceFilter(sourceFeed: string | null, alias?: string): string {
  if (!sourceFeed) return "";
  const col = alias ? `${alias}.source_feed` : "source_feed";
  if (sourceFeed === "feeds") return ` AND ${col} != 'spam_trap'`;
  if (sourceFeed === "spam_trap") return ` AND ${col} = 'spam_trap'`;
  return ` AND ${col} = '${sourceFeed.replace(/'/g, "")}'`;
}

// ── GET /api/observatory/nodes ─────────────────────────────────────────────────
// Returns threat hotspot clusters for ScatterplotLayer
export async function handleObservatoryNodes(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "7d";
  const interval = periodToInterval(period);
  const sourceFilter = buildSourceFilter(url.searchParams.get("source_feed"));

  try {
    const rows = await env.DB.prepare(`
      SELECT
        ROUND(lat, 1) AS lat,
        ROUND(lng, 1) AS lng,
        COUNT(*) AS threat_count,
        MAX(severity) AS top_severity,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN severity = 'high'     THEN 1 ELSE 0 END) AS high,
        SUM(CASE WHEN severity = 'medium'   THEN 1 ELSE 0 END) AS medium,
        SUM(CASE WHEN severity = 'low'      THEN 1 ELSE 0 END) AS low,
        country_code,
        threat_type AS top_threat_type
      FROM threats
      WHERE lat IS NOT NULL AND lng IS NOT NULL
        AND status = 'active'
        AND created_at > datetime('now', '${interval}')${sourceFilter}
      GROUP BY ROUND(lat, 1), ROUND(lng, 1)
      ORDER BY threat_count DESC
      LIMIT 200
    `).all<{
      lat: number; lng: number; threat_count: number; top_severity: string | null;
      critical: number; high: number; medium: number; low: number;
      country_code: string | null; top_threat_type: string | null;
    }>();

    return json({ success: true, data: rows.results ?? [] }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ── GET /api/observatory/arcs ──────────────────────────────────────────────────
// Returns attack corridors for ArcLayer
export async function handleObservatoryArcs(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "7d";
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));
  const interval = periodToInterval(period);
  const sourceFilter = buildSourceFilter(url.searchParams.get("source_feed"), "t");

  try {
    const rows = await env.DB.prepare(`
      SELECT
        ROUND(t.lat, 1) AS source_lat,
        ROUND(t.lng, 1) AS source_lng,
        t.threat_type,
        t.severity,
        t.country_code AS source_country,
        b.name AS target_brand,
        b.sector AS target_sector,
        COUNT(*) AS volume
      FROM threats t
      LEFT JOIN brands b ON b.id = t.target_brand_id
      WHERE t.lat IS NOT NULL AND t.lng IS NOT NULL
        AND t.status = 'active'
        AND t.created_at > datetime('now', '${interval}')${sourceFilter}
      GROUP BY ROUND(t.lat, 1), ROUND(t.lng, 1), t.threat_type, t.target_brand_id
      ORDER BY volume DESC
      LIMIT ${limit}
    `).all<{
      source_lat: number; source_lng: number; threat_type: string;
      severity: string | null; source_country: string | null;
      target_brand: string | null; target_sector: string | null;
      volume: number;
    }>();

    const arcs = (rows.results ?? []).map(row => {
      const targetCoords = getBrandCoords(row.target_brand);
      // Add slight jitter to target to spread arcs landing at same brand
      const jitter: [number, number] = [
        targetCoords[0] + (Math.random() - 0.5) * 2,
        targetCoords[1] + (Math.random() - 0.5) * 2,
      ];
      return {
        sourcePosition: [row.source_lng, row.source_lat] as [number, number],
        targetPosition: jitter,
        threat_type: row.threat_type,
        severity: row.severity ?? "low",
        source_region: row.source_country ?? "Unknown",
        target_brand: row.target_brand ?? "Unknown",
        brand_name: row.target_brand ?? null,
        volume: row.volume,
      };
    });

    return json({ success: true, data: arcs }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ── GET /api/observatory/live ──────────────────────────────────────────────────
// Returns 20 most recent active threats with full geo data
export async function handleObservatoryLive(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const sourceFilter = buildSourceFilter(url.searchParams.get("source_feed"), "t");

  try {
    const rows = await env.DB.prepare(`
      SELECT
        t.id,
        t.malicious_domain,
        t.malicious_url,
        t.ioc_value,
        t.threat_type,
        t.severity,
        t.lat,
        t.lng,
        t.country_code,
        t.created_at,
        b.name AS target_brand
      FROM threats t
      LEFT JOIN brands b ON b.id = t.target_brand_id
      WHERE t.lat IS NOT NULL AND t.lng IS NOT NULL
        AND t.status = 'active'${sourceFilter}
      ORDER BY t.created_at DESC
      LIMIT 20
    `).all<{
      id: string; malicious_domain: string | null; malicious_url: string | null;
      ioc_value: string | null; threat_type: string; severity: string | null;
      lat: number; lng: number; country_code: string | null;
      created_at: string; target_brand: string | null;
    }>();

    return json({ success: true, data: rows.results ?? [] }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ── GET /api/observatory/brand-arcs ───────────────────────────────────────────
// Returns arcs targeting a specific brand
export async function handleObservatoryBrandArcs(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const brandId = url.searchParams.get("brand_id");
  const period = url.searchParams.get("period") ?? "7d";
  const interval = periodToInterval(period);

  if (!brandId) {
    return json({ success: false, error: "brand_id required" }, 400, origin);
  }

  try {
    // Get brand name for coordinate lookup
    const brand = await env.DB.prepare(
      "SELECT id, name FROM brands WHERE id = ? LIMIT 1"
    ).bind(brandId).first<{ id: string; name: string }>();

    const targetCoords = getBrandCoords(brand?.name ?? null);

    const rows = await env.DB.prepare(`
      SELECT
        ROUND(t.lat, 1) AS source_lat,
        ROUND(t.lng, 1) AS source_lng,
        t.threat_type,
        t.severity,
        t.country_code AS source_country,
        COUNT(*) AS volume
      FROM threats t
      WHERE t.lat IS NOT NULL AND t.lng IS NOT NULL
        AND t.target_brand_id = ?
        AND t.status = 'active'
        AND t.created_at > datetime('now', '${interval}')
      GROUP BY ROUND(t.lat, 1), ROUND(t.lng, 1), t.threat_type
      ORDER BY volume DESC
      LIMIT 40
    `).bind(brandId).all<{
      source_lat: number; source_lng: number; threat_type: string;
      severity: string | null; source_country: string | null; volume: number;
    }>();

    const arcs = (rows.results ?? []).map(row => ({
      sourcePosition: [row.source_lng, row.source_lat] as [number, number],
      targetPosition: [
        targetCoords[0] + (Math.random() - 0.5) * 1,
        targetCoords[1] + (Math.random() - 0.5) * 1,
      ] as [number, number],
      threat_type: row.threat_type,
      severity: row.severity ?? "low",
      source_region: row.source_country ?? "Unknown",
      volume: row.volume,
      country_code: row.source_country,
    }));

    return json({
      success: true,
      data: arcs,
      brand: brand ? { id: brand.id, name: brand.name } : null,
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}

// ── GET /api/observatory/stats ─────────────────────────────────────────────────
// Returns summary stats for the stats bar
export async function handleObservatoryStats(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "7d";
  const interval = periodToInterval(period);
  const sf = buildSourceFilter(url.searchParams.get("source_feed"));

  try {
    const [threats, countries, campaigns, brands] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) AS n FROM threats WHERE status = 'active' AND created_at > datetime('now', '${interval}')${sf}`
      ).first<{ n: number }>(),
      env.DB.prepare(
        `SELECT COUNT(DISTINCT country_code) AS n FROM threats WHERE lat IS NOT NULL AND status = 'active' AND created_at > datetime('now', '${interval}')${sf}`
      ).first<{ n: number }>(),
      env.DB.prepare(
        `SELECT COUNT(*) AS n FROM campaigns WHERE status = 'active'`
      ).first<{ n: number }>(),
      env.DB.prepare(
        `SELECT COUNT(DISTINCT target_brand_id) AS n FROM threats WHERE target_brand_id IS NOT NULL AND status = 'active' AND created_at > datetime('now', '${interval}')${sf}`
      ).first<{ n: number }>(),
    ]);

    return json({
      success: true,
      data: {
        threats_mapped: threats?.n ?? 0,
        countries: countries?.n ?? 0,
        active_campaigns: campaigns?.n ?? 0,
        brands_monitored: brands?.n ?? 0,
        period,
      },
    }, 200, origin);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500, origin);
  }
}
