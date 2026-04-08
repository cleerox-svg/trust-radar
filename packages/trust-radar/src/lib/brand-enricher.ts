/**
 * Brand Enrichment — Session A
 * Populates logo_url, website_url, hq_lat, hq_lng, hq_country
 * for brands using Clearbit Logo API + DNS resolution.
 */

import { resolveToIp, extractHostname } from "./domain-resolver";

export interface BrandEnrichmentResult {
  logo_url:    string | null;
  website_url: string | null;
  hq_ip:       string | null;
  hq_lat:      number | null;
  hq_lng:      number | null;
  hq_country:  string | null;
}

// ── Logo URL ─────────────────────────────────────────────────────
// Clearbit Logo API returns PNG if found, 404 if not.
// We verify it resolves before storing.
async function resolveLogoUrl(domain: string): Promise<string | null> {
  const url = `https://logo.clearbit.com/${domain}`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

// ── GeoIP for brand HQ ───────────────────────────────────────────
interface HqGeo {
  ip:      string;
  lat:     number;
  lng:     number;
  country: string;
}

async function resolveHqGeo(
  domain: string,
  cache: KVNamespace,
): Promise<HqGeo | null> {
  const hostname = extractHostname(domain);
  if (!hostname) return null;

  // Check KV cache first
  const cacheKey = `hq_geo:${hostname}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as HqGeo;
    } catch {
      /* ignore */
    }
  }

  const ip = await resolveToIp(hostname);
  if (!ip) return null;

  // Use ipapi.co free tier (no key required) for the HQ lookup.
  // This is separate from the main ipinfo pipeline so the threat-geo
  // monthly budget stays intact.
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      latitude?:     number;
      longitude?:    number;
      country_code?: string;
      error?:        boolean;
    };

    if (data.error || data.latitude == null || data.longitude == null) {
      return null;
    }

    const result: HqGeo = {
      ip,
      lat:     data.latitude,
      lng:     data.longitude,
      country: data.country_code ?? "",
    };

    // Cache for 7 days
    await cache.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 604800,
    });
    return result;
  } catch {
    return null;
  }
}

// ── Main enrichment function ──────────────────────────────────────
export async function enrichBrand(
  domain: string,
  cache: KVNamespace,
): Promise<BrandEnrichmentResult> {
  // Run logo + geo in parallel
  const [logoResult, hqResult] = await Promise.allSettled([
    resolveLogoUrl(domain),
    resolveHqGeo(domain, cache),
  ]);

  const logoUrl =
    logoResult.status === "fulfilled" ? logoResult.value : null;
  const hqGeo =
    hqResult.status === "fulfilled" ? hqResult.value : null;

  return {
    logo_url:    logoUrl,
    website_url: `https://${domain}`,
    hq_ip:       hqGeo?.ip ?? null,
    hq_lat:      hqGeo?.lat ?? null,
    hq_lng:      hqGeo?.lng ?? null,
    hq_country:  hqGeo?.country ?? null,
  };
}
