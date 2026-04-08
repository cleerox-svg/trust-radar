/**
 * Brand Enrichment — Sessions A + B
 * Session A: logo_url, website_url, hq_lat, hq_lng, hq_country
 *   via Clearbit Logo API + DNS resolution.
 * Session B: sector (Haiku classification), registrar, registered_at,
 *   expires_at, registrant_country via IANA RDAP.
 */

import { resolveToIp, extractHostname } from "./domain-resolver";

// ── Canonical sector taxonomy ────────────────────────────────────
// Consistent values across the platform. Anything Haiku returns that's
// not in this list is coerced to "other".
export const SECTORS = [
  "finance",     // banks, payments, crypto, insurance
  "tech",        // software, SaaS, cloud, dev tools
  "ecommerce",   // retail, marketplaces, shopping
  "social",      // social networks, messaging, dating
  "media",       // news, streaming, entertainment
  "healthcare",  // pharma, health tech, medical
  "government",  // gov portals, public services
  "logistics",   // shipping, delivery, freight
  "telecom",     // carriers, ISPs, VoIP
  "gaming",      // games, esports, gaming platforms
  "education",   // edtech, universities, learning
  "travel",      // airlines, hotels, booking
  "energy",      // utilities, oil, renewable
  "legal",       // law firms, legal tech
  "other",       // catch-all
] as const;

export type Sector = (typeof SECTORS)[number];

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

// ── RDAP registrant data ─────────────────────────────────────────
// IANA's free structured WHOIS replacement. https://rdap.org/domain/{domain}
// returns JSON with registrar, registration/expiry dates, registrant country.
export interface RdapResult {
  registrar:          string | null;
  registered_at:      string | null; // ISO date (YYYY-MM-DD)
  expires_at:         string | null; // ISO date (YYYY-MM-DD)
  registrant_country: string | null;
}

export async function fetchRdap(domain: string): Promise<RdapResult> {
  const empty: RdapResult = {
    registrar:          null,
    registered_at:      null,
    expires_at:         null,
    registrant_country: null,
  };

  try {
    const res = await fetch(
      `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      {
        headers: { Accept: "application/json" },
        signal:  AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) return empty;
    const data = (await res.json()) as Record<string, unknown>;

    // Extract registrar from entities array (role = "registrar")
    let registrar: string | null = null;
    const entities = data.entities as
      | Array<Record<string, unknown>>
      | undefined;
    if (entities) {
      const registrarEntity = entities.find(
        e =>
          Array.isArray(e.roles) &&
          (e.roles as string[]).includes("registrar"),
      );
      if (registrarEntity?.vcardArray) {
        const vcard = registrarEntity.vcardArray as unknown[][];
        const props = vcard[1];
        if (Array.isArray(props)) {
          const fn = props.find(
            (v: unknown) => Array.isArray(v) && (v as unknown[])[0] === "fn",
          ) as unknown[] | undefined;
          if (fn && typeof fn[3] === "string") {
            registrar = fn[3];
          }
        }
      }
    }

    // Extract dates from events array
    let registered_at: string | null = null;
    let expires_at:    string | null = null;
    const events = data.events as
      | Array<{ eventAction: string; eventDate: string }>
      | undefined;

    if (events) {
      const reg = events.find(e => e.eventAction === "registration");
      const exp = events.find(e => e.eventAction === "expiration");
      registered_at = reg?.eventDate?.slice(0, 10) ?? null;
      expires_at    = exp?.eventDate?.slice(0, 10) ?? null;
    }

    // Registrant country — vcard "adr" property, country-name subfield
    let registrant_country: string | null = null;
    if (entities) {
      const registrantEntity = entities.find(
        e =>
          Array.isArray(e.roles) &&
          (e.roles as string[]).includes("registrant"),
      );
      if (registrantEntity?.vcardArray) {
        const vcard = registrantEntity.vcardArray as unknown[][];
        const props = vcard[1];
        if (Array.isArray(props)) {
          const adr = props.find(
            (v: unknown) => Array.isArray(v) && (v as unknown[])[0] === "adr",
          ) as unknown[] | undefined;
          if (adr && typeof adr[3] === "object" && adr[3] !== null) {
            const params = adr[3] as Record<string, string>;
            registrant_country = params["country-name"] ?? null;
          }
          // Some RDAP servers put the country in a structured "adr" array
          // at position [4] with 7 fields. Country is the last element.
          if (!registrant_country && adr && Array.isArray(adr[3])) {
            const structured = adr[3] as string[];
            const country = structured[structured.length - 1];
            if (country && country.length <= 3) {
              registrant_country = country;
            }
          }
        }
      }
    }

    return { registrar, registered_at, expires_at, registrant_country };
  } catch {
    return empty;
  }
}

// ── Sector classification via Claude Haiku ───────────────────────
// One cheap Haiku call per brand. Fetches website <title> for extra
// context (best-effort). Returns a canonical Sector, or null if the
// call failed entirely.
export async function classifySector(
  domain: string,
  brandName: string,
  anthropicApiKey: string,
): Promise<Sector | null> {
  try {
    // Fetch website title for extra context (best-effort)
    let title = "";
    try {
      const res = await fetch(`https://${domain}`, {
        signal:  AbortSignal.timeout(3000),
        headers: { "User-Agent": "Averrow/1.0 brand-classifier" },
      });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        title = match?.[1]?.trim().slice(0, 200) ?? "";
      }
    } catch {
      /* title fetch failed — classify on domain only */
    }

    const prompt = `Classify this brand into exactly one sector from this list:
${SECTORS.join(", ")}

Brand: ${brandName}
Domain: ${domain}
${title ? `Website title: ${title}` : ""}

Respond with ONLY the sector name, nothing else. Pick "other" if unsure.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 20,
        messages:   [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const raw =
      data.content
        .find(c => c.type === "text")
        ?.text.trim()
        .toLowerCase() ?? "";

    // Validate it's a known sector; coerce anything unknown to "other"
    return SECTORS.includes(raw as Sector) ? (raw as Sector) : "other";
  } catch {
    return null;
  }
}
