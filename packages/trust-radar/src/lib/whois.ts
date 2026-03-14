/**
 * WHOIS/RDAP Enrichment — Query domain registration data via public RDAP.
 *
 * Uses rdap.org (free, no auth) for domain → registrar, creation date.
 * Falls back gracefully on errors or rate limits.
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
export async function rdapLookup(domain: string): Promise<RDAPResult | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as RDAPResponse;

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
  } catch {
    return null;
  }
}

/**
 * Batch RDAP lookups with rate limiting.
 * Processes sequentially with delay to respect free API limits.
 */
export async function batchRDAPLookup(
  domains: string[],
): Promise<Map<string, RDAPResult>> {
  const results = new Map<string, RDAPResult>();
  const unique = [...new Set(domains)];

  for (const domain of unique) {
    const result = await rdapLookup(domain);
    if (result) results.set(domain, result);
    // RDAP has strict rate limits — 1 req/sec is safe
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}
