/**
 * Domain → IP resolver — multi-provider DoH with first-valid-wins
 * racing.
 *
 * Three resolvers run in parallel; the first one that returns a
 * valid A record wins. If all three return null/NXDOMAIN/error
 * the resolver returns null. Each call is one subrequest per
 * resolver, so a 500-domain batch consumes up to 1500 subrequests
 * worst-case — still safely under Cloudflare Workers' standard
 * subrequest limits when the navigator cron runs every 5 min.
 *
 * Why three providers:
 *   - Resilience: Cloudflare DoH 403 / throttle doesn't stall the
 *     queue
 *   - Speed: median latency = fastest of three (often Google or
 *     Cloudflare; Quad9 is the tie-breaker)
 *   - Cross-validation: divergent answers can flag DNS poisoning
 *     or geographically split records (logged silently for now)
 *
 * Per planning session 2026-04-30 (Option A); Workflow conversion
 * deferred (Option B).
 */

interface DohResponse {
  Status: number;
  Answer?: Array<{ type: number; data: string }>;
}

interface ResolverDef {
  name: string;
  url: (hostname: string) => string;
  headers: Record<string, string>;
}

/** Public list of resolver display names + their base hostname,
 *  surfaced in the agent declarations UI so operators can see the
 *  external DNS endpoints we depend on. */
export const DNS_RESOLVER_ENDPOINTS = [
  { name: 'Cloudflare 1.1.1.1', url: 'https://cloudflare-dns.com' },
  { name: 'Google DNS', url: 'https://dns.google' },
  { name: 'Quad9 DNS', url: 'https://dns.quad9.net:5053' },
];

const RESOLVERS: ResolverDef[] = [
  {
    name: 'cloudflare',
    url: (h) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(h)}&type=A`,
    headers: { Accept: 'application/dns-json' },
  },
  {
    name: 'google',
    url: (h) => `https://dns.google/resolve?name=${encodeURIComponent(h)}&type=A`,
    headers: { Accept: 'application/dns-json' },
  },
  {
    name: 'quad9',
    url: (h) => `https://dns.quad9.net:5053/dns-query?name=${encodeURIComponent(h)}&type=A`,
    headers: { Accept: 'application/dns-json' },
  },
];

const PER_RESOLVER_TIMEOUT_MS = 2000;

async function tryResolver(resolver: ResolverDef, hostname: string): Promise<string | null> {
  try {
    const res = await fetch(resolver.url(hostname), {
      headers: resolver.headers,
      signal: AbortSignal.timeout(PER_RESOLVER_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DohResponse;
    if (data.Status !== 0 || !data.Answer) return null;
    const aRecord = data.Answer.find((r) => r.type === 1);
    return aRecord?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Race resolvers — resolve as soon as ANY returns a valid IP.
 * If all return null/error, resolve null. Faster than waiting for
 * all three even when one is slow or throttled.
 */
function raceFirstValid(promises: Array<Promise<string | null>>): Promise<string | null> {
  return new Promise((resolve) => {
    let pending = promises.length;
    let resolved = false;
    for (const p of promises) {
      p.then((result) => {
        if (resolved) return;
        if (result !== null) {
          resolved = true;
          resolve(result);
        } else if (--pending === 0) {
          resolved = true;
          resolve(null);
        }
      });
    }
  });
}

/**
 * Resolve a domain to its first IPv4 address using a multi-provider
 * DoH race. Returns null if every resolver fails.
 */
export async function resolveToIp(domain: string): Promise<string | null> {
  const hostname = extractHostname(domain);
  if (!hostname) return null;
  return raceFirstValid(RESOLVERS.map((r) => tryResolver(r, hostname)));
}

/**
 * Extract a bare hostname from a domain field that may contain
 * protocol, subdomains, wildcards, ports, or paths. Returns null
 * for wildcards, IP addresses, or values without a dot.
 */
export function extractHostname(domain: string): string | null {
  if (!domain) return null;
  const h = domain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:[\d]+$/, "")
    .toLowerCase()
    .trim();

  if (!h || h.startsWith("*") || !h.includes(".")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
  return h;
}
