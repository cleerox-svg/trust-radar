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
      const batchUrl = "http://ip-api.com/batch?fields=status,query,countryCode,country,isp,org,as,lat,lon";
      console.log(`[geoip] POST ${batchUrl} (${chunk.length} IPs)`);
      const res = await fetch(batchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });

      console.log(`[geoip] Response: HTTP ${res.status}`);
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[geoip] batch lookup HTTP ${res.status}: ${errBody.slice(0, 300)}`);
        continue;
      }

      const data = await res.json() as IpApiBatchResponse[];
      console.log(`[geoip] Parsed ${data.length} entries, ${data.filter(e => e.status === "success").length} successful`);

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
 * Uses v2 schema: hosting_provider_id (FK) instead of hosting_provider (text).
 */
export async function enrichThreatsGeo(db: D1Database): Promise<{ enriched: number; total: number }> {
  const rows = await db.prepare(
    `SELECT id, ip_address FROM threats
     WHERE ip_address IS NOT NULL AND (country_code IS NULL OR hosting_provider_id IS NULL)
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
      const providerName = normalizeProvider(geo.isp, geo.org);
      let providerId: string | null = null;
      if (providerName) {
        providerId = await upsertHostingProvider(db, providerName, geo.as, geo.countryCode);
      }

      await db.prepare(
        `UPDATE threats SET
          country_code = COALESCE(country_code, ?),
          asn = COALESCE(asn, ?),
          hosting_provider_id = COALESCE(hosting_provider_id, ?),
          lat = COALESCE(lat, ?),
          lng = COALESCE(lng, ?)
        WHERE id = ?`
      ).bind(
        geo.countryCode, geo.as, providerId, geo.lat, geo.lng, row.id,
      ).run();
      enriched++;
    } catch (err) {
      console.error(`[geoip] update failed for ${row.id}:`, err);
    }
  }

  return { enriched, total };
}

/**
 * Upsert a hosting provider record. Returns the provider ID.
 * Uses deterministic IDs based on provider name.
 */
export async function upsertHostingProvider(
  db: D1Database,
  name: string,
  asn: string | null,
  country: string | null,
): Promise<string> {
  const id = `hp_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  await db.prepare(
    `INSERT INTO hosting_providers (id, name, asn, country)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       asn = COALESCE(hosting_providers.asn, excluded.asn),
       country = COALESCE(hosting_providers.country, excluded.country)`
  ).bind(id, name, asn, country).run();
  return id;
}

/**
 * Normalize ISP/Org names to canonical hosting provider names.
 * Maps common ISP variations to consistent provider names for trending.
 */
export function normalizeProvider(isp: string | null, org: string | null): string | null {
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
