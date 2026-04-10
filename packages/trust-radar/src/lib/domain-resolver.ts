/**
 * Domain → IP resolver using Cloudflare's 1.1.1.1 DNS over HTTPS.
 *
 * Uses the Cloudflare DoH JSON API (cloudflare-dns.com/dns-query), which is
 * reachable from any Cloudflare Worker without additional configuration.
 * Each call is one subrequest, so a 500-domain batch consumes 500 subrequests —
 * safely under the 1,000/invocation limit.
 */

/**
 * Resolve a domain to its first IPv4 address.
 * Returns null if resolution fails or times out.
 */
export async function resolveToIp(domain: string): Promise<string | null> {
  // Strip protocol, path, port — extract bare hostname
  const hostname = domain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:[\d]+$/, "")
    .toLowerCase()
    .trim();

  // Skip wildcards, bare IP addresses, empty strings
  if (!hostname || hostname.startsWith("*") || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(2000), // 2s timeout
      },
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      Status: number;
      Answer?: Array<{ type: number; data: string }>;
    };

    // Status 0 = NOERROR
    if (data.Status !== 0 || !data.Answer) return null;

    // Find first A record (type 1)
    const aRecord = data.Answer.find((r) => r.type === 1);
    return aRecord?.data ?? null;
  } catch {
    return null;
  }
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
