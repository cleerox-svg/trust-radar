/**
 * GeoIP Enrichment — Batch IP-to-country resolution using ip-api.com.
 *
 * Free tier: 45 requests/min, 100 IPs per batch.
 * Returns ISO 3166-1 alpha-2 country codes (e.g., "US", "DE", "CN").
 */

export interface GeoIPResult {
  ip: string;
  countryCode: string | null;
  country: string | null;
  isp: string | null;
  org: string | null;
  as: string | null;
}

interface IpApiBatchResponse {
  status: string;
  query: string;
  countryCode?: string;
  country?: string;
  isp?: string;
  org?: string;
  as?: string;
}

/**
 * Batch-resolve IPs to country codes via ip-api.com.
 * Processes in chunks of 100 (API limit).
 */
export async function batchGeoLookup(ips: string[]): Promise<Map<string, GeoIPResult>> {
  const results = new Map<string, GeoIPResult>();
  if (ips.length === 0) return results;

  // Deduplicate
  const uniqueIps = [...new Set(ips)];
  const CHUNK_SIZE = 100;

  for (let i = 0; i < uniqueIps.length; i += CHUNK_SIZE) {
    const chunk = uniqueIps.slice(i, i + CHUNK_SIZE);

    try {
      const res = await fetch("http://ip-api.com/batch?fields=status,query,countryCode,country,isp,org,as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        console.error(`[geoip] batch lookup HTTP ${res.status}`);
        continue;
      }

      const data = await res.json() as IpApiBatchResponse[];

      for (const entry of data) {
        if (entry.status === "success" && entry.countryCode) {
          results.set(entry.query, {
            ip: entry.query,
            countryCode: entry.countryCode,
            country: entry.country ?? null,
            isp: entry.isp ?? null,
            org: entry.org ?? null,
            as: entry.as ?? null,
          });
        }
      }
    } catch (err) {
      console.error("[geoip] batch lookup error:", err);
    }

    // Rate limit: small delay between chunks
    if (i + CHUNK_SIZE < uniqueIps.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return results;
}

/**
 * Enrich threats in D1 that have ip_address but no country_code.
 * Returns the number of enriched rows.
 */
export async function enrichThreatsGeo(db: D1Database): Promise<{ enriched: number; total: number }> {
  // Get threats with IP but no country
  const rows = await db.prepare(
    `SELECT id, ip_address FROM threats
     WHERE ip_address IS NOT NULL AND country_code IS NULL
     LIMIT 500`
  ).all<{ id: string; ip_address: string }>();

  const total = rows.results.length;
  if (total === 0) return { enriched: 0, total: 0 };

  const ips = rows.results.map((r) => r.ip_address);
  const geoMap = await batchGeoLookup(ips);

  let enriched = 0;

  // Batch update in chunks
  for (const row of rows.results) {
    const geo = geoMap.get(row.ip_address);
    if (!geo?.countryCode) continue;

    try {
      await db.prepare(
        "UPDATE threats SET country_code = ?, updated_at = datetime('now') WHERE id = ? AND country_code IS NULL"
      ).bind(geo.countryCode, row.id).run();
      enriched++;
    } catch (err) {
      console.error(`[geoip] update failed for ${row.id}:`, err);
    }
  }

  return { enriched, total };
}
