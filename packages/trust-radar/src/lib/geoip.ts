/**
 * GeoIP Enrichment — IP-to-location resolution using ipinfo.io (HTTPS).
 *
 * Free tier: 50,000 requests/month, no API key required.
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

interface IpinfoResponse {
  ip: string;
  city?: string;
  region?: string;
  country?: string;   // 2-letter code
  loc?: string;        // "lat,lng"
  org?: string;        // "AS13335 Cloudflare, Inc."
  postal?: string;
  timezone?: string;
  bogon?: boolean;
}

/**
 * Look up a single IP via ipinfo.io (HTTPS, free, no key).
 */
async function lookupSingleIP(ip: string, isFirst: boolean): Promise<GeoIPResult | null> {
  try {
    const res = await fetch(`https://ipinfo.io/${ip}/json`, {
      headers: { Accept: "application/json" },
    });

    if (isFirst) {
      const bodyText = await res.text();
      console.log(`[geoip] DIAGNOSTIC first lookup: ip=${ip} HTTP ${res.status} body=${bodyText.slice(0, 500)}`);
      if (!res.ok) return null;
      const data = JSON.parse(bodyText) as IpinfoResponse;
      return parseIpinfoResponse(ip, data);
    }

    if (res.status === 429) {
      console.warn(`[geoip] Rate limited on ${ip} — stopping batch`);
      return null;
    }

    if (!res.ok) {
      console.error(`[geoip] HTTP ${res.status} for ${ip}`);
      return null;
    }

    const data = (await res.json()) as IpinfoResponse;
    if (data.bogon) return null;

    return parseIpinfoResponse(ip, data);
  } catch (err) {
    console.error(`[geoip] fetch error for ${ip}:`, err);
    return null;
  }
}

function parseIpinfoResponse(ip: string, data: IpinfoResponse): GeoIPResult | null {
  if (data.bogon) return null;

  // Parse "lat,lng" from loc field
  let lat: number | null = null;
  let lng: number | null = null;
  if (data.loc) {
    const parts = data.loc.split(",");
    lat = parseFloat(parts[0]!) || null;
    lng = parseFloat(parts[1]!) || null;
  }

  // Parse ASN and org from org field: "AS13335 Cloudflare, Inc."
  let asn: string | null = null;
  let org: string | null = null;
  if (data.org) {
    const asnMatch = data.org.match(/^(AS\d+)\s+(.+)$/);
    if (asnMatch) {
      asn = asnMatch[1]!;
      org = asnMatch[2]!;
    } else {
      org = data.org;
    }
  }

  return {
    ip: data.ip || ip,
    countryCode: data.country ?? null,
    country: null, // ipinfo.io free tier only returns 2-letter code
    isp: org,
    org,
    as: asn,
    lat,
    lng,
  };
}

/**
 * Batch-resolve IPs to geo data via ipinfo.io (HTTPS).
 * Processes concurrently (5 at a time) with rate limiting.
 */
export async function batchGeoLookup(ips: string[]): Promise<Map<string, GeoIPResult>> {
  const results = new Map<string, GeoIPResult>();
  if (ips.length === 0) return results;

  const uniqueIps = [...new Set(ips)];
  const CONCURRENCY = 5;
  let rateLimited = false;
  let isFirst = true;

  console.log(`[geoip] Looking up ${uniqueIps.length} unique IPs via ipinfo.io (HTTPS)`);

  for (let i = 0; i < uniqueIps.length; i += CONCURRENCY) {
    if (rateLimited) break;

    const chunk = uniqueIps.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map(async (ip) => {
        const geo = await lookupSingleIP(ip, isFirst);
        isFirst = false;
        if (geo) {
          results.set(ip, geo);
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

    // Rate limit: 200ms between chunks
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
