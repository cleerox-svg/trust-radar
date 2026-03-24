/**
 * WHOIS/RDAP Enrichment — Query domain registration data via public RDAP.
 *
 * Uses rdap.org (free, no auth) for domain → registrar, creation date.
 * Falls back gracefully on errors or rate limits.
 * Non-blocking: failures are logged but never block the pipeline.
 */

export interface RDAPResult {
  registrar: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
}

interface RDAPEntity {
  vcardArray?: [string, ...Array<[string, Record<string, string>, string, string]>];
  roles?: string[];
  handle?: string;
}

interface RDAPEvent {
  eventAction: string;
  eventDate: string;
}

interface RDAPResponse {
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
}

/**
 * Query RDAP for a domain's registration data.
 */
export async function rdapLookup(domain: string, isFirst = false): Promise<RDAPResult | null> {
  try {
    const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(5000),
    });

    if (isFirst) {
      const bodyText = await res.text();
      if (!res.ok) return null;
      const data = JSON.parse(bodyText) as RDAPResponse;
      return parseRDAPResponse(data);
    }

    if (!res.ok) {
      console.error(`[whois] HTTP ${res.status} for ${domain}`);
      return null;
    }

    const data = (await res.json()) as RDAPResponse;
    return parseRDAPResponse(data);
  } catch (err) {
    console.error(`[whois] fetch error for ${domain}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function parseRDAPResponse(data: RDAPResponse): RDAPResult {
  // Extract registrar from entities with "registrar" role
  let registrar: string | null = null;
  const registrarEntity = data.entities?.find((e) => e.roles?.includes("registrar"));
  if (registrarEntity?.vcardArray) {
    const fn = registrarEntity.vcardArray[1]?.find((v: unknown) => Array.isArray(v) && v[0] === "fn");
    if (Array.isArray(fn)) registrar = fn[3] as string ?? null;
  }
  if (!registrar && registrarEntity?.handle) {
    registrar = registrarEntity.handle;
  }

  // Extract dates from events
  let registrationDate: string | null = null;
  let expirationDate: string | null = null;
  for (const event of data.events ?? []) {
    if (event.eventAction === "registration") registrationDate = event.eventDate;
    if (event.eventAction === "expiration") expirationDate = event.eventDate;
  }

  return { registrar, registrationDate, expirationDate };
}

/**
 * Batch RDAP lookups with rate limiting.
 * Processes sequentially with delay to respect free API limits.
 * Non-blocking: individual failures are logged and skipped.
 */
export async function batchRDAPLookup(
  domains: string[],
): Promise<Map<string, RDAPResult>> {
  const results = new Map<string, RDAPResult>();
  const unique = [...new Set(domains)];
  let consecutiveFailures = 0;

  for (let i = 0; i < unique.length; i++) {
    const domain = unique[i]!;
    const result = await rdapLookup(domain, i === 0);

    if (result) {
      results.set(domain, result);
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
      // If first 3 consecutive lookups all fail, RDAP is likely down — bail early
      if (consecutiveFailures >= 3) {
        console.error(`[whois] ${consecutiveFailures} consecutive RDAP failures — service likely down, stopping batch`);
        break;
      }
    }
    // RDAP has strict rate limits — 1 req/sec is safe
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}
