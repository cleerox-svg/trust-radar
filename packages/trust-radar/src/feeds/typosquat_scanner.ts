import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/**
 * Typosquat Scanner — generates domain variants for monitored brands
 * and checks DNS registration via Cloudflare DoH.
 *
 * 5 brands per run, rotating through all brands. Full cycle ~7 days.
 * Registered typosquats are inserted as threats with source_feed = 'typosquat_scanner'.
 */

// ─── Variant Generation ─────────────────────────────────────────

const COMMON_SUBS: Record<string, string[]> = {
  a: ["@", "4", "e"],
  e: ["3", "a"],
  i: ["1", "l", "!"],
  o: ["0", "u"],
  l: ["1", "i", "|"],
  s: ["5", "$", "z"],
  t: ["7", "+"],
  g: ["9", "q"],
  b: ["d", "6"],
};

const ALT_TLDS = [
  "com", "net", "org", "io", "co", "xyz", "app", "dev",
  "info", "biz", "us", "ca", "uk", "shop", "site", "online",
];

const COMBO_PREFIXES = ["secure", "login", "my", "account", "verify", "update", "support"];
const COMBO_SUFFIXES = ["login", "secure", "verify", "account", "app", "online", "help"];

export function generateVariants(domain: string): string[] {
  const dotIdx = domain.indexOf(".");
  if (dotIdx < 1) return [];
  const name = domain.slice(0, dotIdx);
  const tld = domain.slice(dotIdx + 1);
  const variants: string[] = [];

  // 1. Character omission
  for (let i = 0; i < name.length; i++) {
    variants.push(name.slice(0, i) + name.slice(i + 1) + "." + tld);
  }

  // 2. Adjacent character swap
  for (let i = 0; i < name.length - 1; i++) {
    const arr = name.split("");
    [arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!];
    variants.push(arr.join("") + "." + tld);
  }

  // 3. Character duplication
  for (let i = 0; i < name.length; i++) {
    variants.push(name.slice(0, i) + name[i] + name.slice(i) + "." + tld);
  }

  // 4. Common character substitutions
  for (let i = 0; i < name.length; i++) {
    const char = name[i]!.toLowerCase();
    const subs = COMMON_SUBS[char];
    if (subs) {
      for (const sub of subs) {
        variants.push(name.slice(0, i) + sub + name.slice(i + 1) + "." + tld);
      }
    }
  }

  // 5. TLD variants
  for (const t of ALT_TLDS) {
    if (t !== tld) variants.push(name + "." + t);
  }

  // 6. Combosquatting (hyphenated prefixes/suffixes)
  for (const p of COMBO_PREFIXES) variants.push(p + "-" + name + ".com");
  for (const s of COMBO_SUFFIXES) variants.push(name + "-" + s + ".com");

  // Deduplicate, remove original, remove too-short domains
  return [...new Set(variants)].filter(v => v !== domain && v.length > 3);
}

// ─── DNS Resolution via Cloudflare DoH ──────────────────────────

interface DohResponse {
  Answer?: { type: number; data: string }[];
}

async function checkDomainRegistered(domain: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      { headers: { Accept: "application/dns-json" } },
    );
    if (!resp.ok) return false;
    const data = (await resp.json()) as DohResponse;
    return !!(data.Answer && data.Answer.length > 0);
  } catch {
    return false;
  }
}

// ─── Feed Module ────────────────────────────────────────────────

const BRANDS_PER_RUN = 5;
const MAX_DNS_CHECKS_PER_RUN = 500;

export const typosquat_scanner: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const { env } = ctx;

    // Get the offset for brand rotation from KV
    const offsetKey = "typosquat_scanner_offset";
    const storedOffset = await env.CACHE.get(offsetKey);
    const offset = storedOffset ? parseInt(storedOffset, 10) : 0;

    // Fetch next batch of brands with canonical domains
    const brands = await env.DB.prepare(`
      SELECT id, name, canonical_domain
      FROM brands
      WHERE canonical_domain IS NOT NULL AND canonical_domain != ''
      ORDER BY id
      LIMIT ? OFFSET ?
    `).bind(BRANDS_PER_RUN, offset).all<{
      id: number;
      name: string;
      canonical_domain: string;
    }>();

    // If we got fewer than BRANDS_PER_RUN, wrap around next time
    const totalBrands = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM brands WHERE canonical_domain IS NOT NULL AND canonical_domain != ''",
    ).first<{ n: number }>();
    const total = totalBrands?.n ?? 0;
    const nextOffset = brands.results.length < BRANDS_PER_RUN ? 0 : offset + BRANDS_PER_RUN;
    await env.CACHE.put(offsetKey, String(nextOffset), { expirationTtl: 604800 }); // 7 day TTL

    let itemsFetched = 0;
    let itemsNew = 0;
    let itemsDuplicate = 0;
    let itemsError = 0;
    let dnsChecks = 0;

    for (const brand of brands.results) {
      const domain = brand.canonical_domain.toLowerCase();
      const variants = generateVariants(domain);
      itemsFetched += variants.length;

      for (const variant of variants) {
        if (dnsChecks >= MAX_DNS_CHECKS_PER_RUN) break;

        // Skip if we already know about this typosquat
        const dedupKey = `typosquat:${variant}`;
        if (await isDuplicate(ctx.env, "domain", dedupKey)) {
          itemsDuplicate++;
          continue;
        }

        dnsChecks++;
        try {
          const isRegistered = await checkDomainRegistered(variant);
          if (!isRegistered) continue;

          // Registered typosquat found — insert as threat
          await insertThreat(env.DB, {
            id: threatId("typosquat_scanner", "domain", variant),
            source_feed: "typosquat_scanner",
            threat_type: "typosquatting",
            malicious_domain: variant,
            malicious_url: `http://${variant}`,
            ioc_value: variant,
            target_brand_id: String(brand.id),
            severity: "medium",
            confidence_score: 70,
          });
          await markSeen(ctx.env, "domain", dedupKey);
          itemsNew++;
        } catch {
          itemsError++;
        }
      }

      if (dnsChecks >= MAX_DNS_CHECKS_PER_RUN) break;
    }

    console.log(
      `[typosquat_scanner] Scanned ${brands.results.length} brands (offset=${offset}, total=${total}), ` +
      `variants=${itemsFetched}, dns_checks=${dnsChecks}, registered=${itemsNew}, ` +
      `dupes=${itemsDuplicate}, errors=${itemsError}`,
    );

    return { itemsFetched, itemsNew, itemsDuplicate, itemsError };
  },
};
