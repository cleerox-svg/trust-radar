/**
 * GeoIP Enrichment — IP-to-location resolution using ipapi.co (HTTPS).
 *
 * Free tier: 1000 requests/day, no API key required.
 * Returns ISO 3166-1 alpha-2 country codes (e.g., "US", "DE", "CN").
 * Processes IPs individually with concurrency control.
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

interface IpapiCoResponse {
  ip: string;
  country_code?: string;
  country_name?: string;
  org?: string;
  asn?: string;
  latitude?: number;
  longitude?: number;
  error?: boolean;
  reason?: string;
}

/**
 * Look up a single IP via ipapi.co (HTTPS, free, no key).
 */
async function lookupSingleIP(ip: string): Promise<GeoIPResult | null> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "trust-radar/1.0", Accept: "application/json" },
    });

    if (res.status === 429) {
      console.warn(`[geoip] Rate limited on ${ip} — stopping batch`);
      return null;
    }

    if (!res.ok) {
      console.error(`[geoip] HTTP ${res.status} for ${ip}`);
      return null;
    }

    const data = (await res.json()) as IpapiCoResponse;

    if (data.error) {
      console.error(`[geoip] API error for ${ip}: ${data.reason}`);
      return null;
    }

    return {
      ip: data.ip || ip,
      countryCode: data.country_code ?? null,
      country: data.country_name ?? null,
      isp: data.org ?? null,
      org: data.org ?? null,
      as: data.asn ?? null,
      lat: data.latitude ?? null,
      lng: data.longitude ?? null,
    };
  } catch (err) {
    console.error(`[geoip] fetch error for ${ip}:`, err);
    return null;
  }
}

/**
 * Batch-resolve IPs to geo data via ipapi.co (HTTPS).
 * Processes concurrently (5 at a time) with rate limiting.
 */
export async function batchGeoLookup(ips: string[]): Promise<Map<string, GeoIPResult>> {
  const results = new Map<string, GeoIPResult>();
  if (ips.length === 0) return results;

  const uniqueIps = [...new Set(ips)];
  const CONCURRENCY = 5;
  let rateLimited = false;

  console.log(`[geoip] Looking up ${uniqueIps.length} unique IPs via ipapi.co (HTTPS)`);

  for (let i = 0; i < uniqueIps.length; i += CONCURRENCY) {
    if (rateLimited) break;

    const chunk = uniqueIps.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(async (ip) => {
        const geo = await lookupSingleIP(ip);
        if (geo) {
          results.set(ip, geo);
        } else if (geo === null) {
          // Check if we got rate limited (lookupSingleIP logs and returns null)
          // We'll detect via the results count after this chunk
        }
        return geo;
      }),
    );

    // Check if any in this chunk got rate limited (all null = likely rate limited)
    const allNull = settled.every(
      (s) => s.status === "rejected" || (s.status === "fulfilled" && s.value === null),
    );
    if (allNull && chunk.length > 1) {
      console.warn(`[geoip] All ${chunk.length} lookups returned null — likely rate limited, stopping`);
      rateLimited = true;
      break;
    }

    // Rate limit: 200ms between chunks to stay under 1000/day (~5 req/s is fine)
    if (i + CONCURRENCY < uniqueIps.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  console.log(`[geoip] Resolved ${results.size}/${uniqueIps.length} IPs${rateLimited ? " (stopped: rate limited)" : ""}`);

  // Log first result as sample for debugging
  if (results.size > 0) {
    const sample = results.values().next().value;
    console.log(`[geoip] Sample: ip=${sample?.ip} country=${sample?.countryCode} org=${sample?.org} asn=${sample?.as}`);
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
