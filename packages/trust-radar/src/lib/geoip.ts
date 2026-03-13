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
  lat: number | null;
  lng: number | null;
}

interface IpApiBatchResponse {
  status: string;
  query: string;
  countryCode?: string;
  country?: string;
  isp?: string;
  org?: string;
  as?: string;
  lat?: number;
  lon?: number;
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
      const res = await fetch("http://ip-api.com/batch?fields=status,query,countryCode,country,isp,org,as,lat,lon", {
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
            lat: entry.lat ?? null,
            lng: entry.lon ?? null,
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
  // Get threats with IP but missing geo or hosting data
  const rows = await db.prepare(
    `SELECT id, ip_address FROM threats
     WHERE ip_address IS NOT NULL AND (country_code IS NULL OR hosting_provider IS NULL)
     LIMIT 500`
  ).all<{ id: string; ip_address: string }>();

  const total = rows.results.length;
  if (total === 0) return { enriched: 0, total: 0 };

  const ips = rows.results.map((r) => r.ip_address);
  const geoMap = await batchGeoLookup(ips);

  let enriched = 0;

  for (const row of rows.results) {
    const geo = geoMap.get(row.ip_address);
    if (!geo) continue;

    try {
      const hostingProvider = normalizeProvider(geo.isp, geo.org);
      await db.prepare(
        `UPDATE threats SET
          country_code = COALESCE(country_code, ?),
          isp_name = COALESCE(isp_name, ?),
          hosting_provider = COALESCE(hosting_provider, ?),
          asn = COALESCE(asn, ?),
          is_datacenter = CASE WHEN ? IS NOT NULL THEN 1 ELSE is_datacenter END,
          lat = COALESCE(lat, ?),
          lng = COALESCE(lng, ?),
          updated_at = datetime('now')
        WHERE id = ?`
      ).bind(
        geo.countryCode, geo.isp, hostingProvider, geo.as,
        hostingProvider, geo.lat, geo.lng, row.id,
      ).run();
      enriched++;
    } catch (err) {
      console.error(`[geoip] update failed for ${row.id}:`, err);
    }
  }

  return { enriched, total };
}

/**
 * Normalize ISP/Org names to canonical hosting provider names.
 * Maps common ISP variations to consistent provider names for trending.
 */
function normalizeProvider(isp: string | null, org: string | null): string | null {
  const raw = (isp || org || "").toLowerCase();
  if (!raw) return null;

  const providerMap: Array<[string[], string]> = [
    [["cloudflare"], "Cloudflare"],
    [["amazon", "aws", "ec2"], "Amazon AWS"],
    [["google cloud", "google llc", "gcp"], "Google Cloud"],
    [["microsoft", "azure"], "Microsoft Azure"],
    [["digitalocean"], "DigitalOcean"],
    [["ovh", "ovhcloud"], "OVHcloud"],
    [["hetzner"], "Hetzner"],
    [["linode", "akamai connected"], "Linode/Akamai"],
    [["godaddy"], "GoDaddy"],
    [["1&1", "ionos", "1und1"], "1&1 IONOS"],
    [["hostinger"], "Hostinger"],
    [["namecheap"], "Namecheap"],
    [["bluehost"], "Bluehost"],
    [["vultr"], "Vultr"],
    [["contabo"], "Contabo"],
    [["hostgator"], "HostGator"],
    [["siteground"], "SiteGround"],
    [["alibaba", "aliyun"], "Alibaba Cloud"],
    [["tencent"], "Tencent Cloud"],
    [["oracle cloud"], "Oracle Cloud"],
    [["leaseweb"], "Leaseweb"],
    [["choopa", "gameservers"], "Choopa/Vultr"],
    [["hostwinds"], "Hostwinds"],
    [["dreamhost"], "DreamHost"],
    [["fastly"], "Fastly"],
    [["vercel"], "Vercel"],
    [["netlify"], "Netlify"],
  ];

  for (const [keywords, name] of providerMap) {
    if (keywords.some(k => raw.includes(k))) return name;
  }

  return org || isp;
}
