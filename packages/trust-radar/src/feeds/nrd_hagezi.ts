import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";
import { diagnosticFetch } from "../lib/feedDiagnostic";

const NRD_CDN_URL = "https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/wildcard/nrd-3.txt";
const NRD_RAW_URL = "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/nrd-3.txt";

/** Common homoglyph substitutions for brand matching */
const HOMOGLYPHS: Record<string, string[]> = {
  l: ["1", "i"],
  o: ["0"],
  i: ["1", "l"],
  a: ["4", "@"],
  e: ["3"],
  s: ["5", "$"],
};

/**
 * Hagezi NRD — Newly Registered Domains (last 1 day).
 * Filters against monitored brands to find typosquatting/impersonation domains.
 * Schedule: daily (the list updates once per day).
 */
export const nrd_hagezi: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    // Try CDN first, fall back to raw GitHub if 403 (file too large for jsDelivr)
    const primaryUrl = ctx.feedUrl || NRD_CDN_URL;
    let res = await diagnosticFetch(ctx.env.DB, "nrd_hagezi", primaryUrl);
    if (res.status === 403) {
      console.warn(`[nrd_hagezi] CDN returned 403, falling back to raw GitHub URL`);
      res = await diagnosticFetch(ctx.env.DB, "nrd_hagezi", NRD_RAW_URL);
    }
    if (!res.ok) throw new Error(`NRD Hagezi HTTP ${res.status}`);

    const text = await res.text();
    const domains = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((d) => d.replace(/^\*\./, "").replace(/\.$/, "").toLowerCase());
    // Fetch monitored brands
    const brands = await ctx.env.DB.prepare(
      `SELECT b.id, b.name, b.canonical_domain
       FROM brands b
       INNER JOIN monitored_brands mb ON mb.brand_id = b.id
       WHERE mb.status = 'active'`
    ).all<{ id: string; name: string; canonical_domain: string }>();

    if (!brands.results.length) {
      return { itemsFetched: domains.length, itemsNew: 0, itemsDuplicate: 0, itemsError: 0 };
    }

    // Build keyword list from brand names
    const brandKeywords = brands.results.map((b) => ({
      id: b.id,
      keyword: b.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
      domain: b.canonical_domain.toLowerCase(),
    }));
    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;

    for (const domain of domains) {
      for (const brand of brandKeywords) {
        // Skip if domain IS the brand's canonical domain
        if (domain === brand.domain) continue;

        const matches = domainMatchesBrand(domain, brand.keyword);
        if (!matches) continue;

        try {
          if (await isDuplicate(ctx.env, "domain", domain)) { itemsDuplicate++; break; }

          await insertThreat(ctx.env.DB, {
            id: threatId("nrd_hagezi", "domain", domain),
            source_feed: "nrd_hagezi",
            threat_type: "typosquatting",
            malicious_url: null,
            malicious_domain: domain,
            target_brand_id: brand.id,
            ioc_value: domain,
            severity: "medium",
            confidence_score: 60,
          });
          await markSeen(ctx.env, "domain", domain);
          itemsNew++;
          break; // One brand match per domain is enough
        } catch { itemsError++; break; }
      }
    }

    return { itemsFetched: domains.length, itemsNew, itemsDuplicate, itemsError };
  },
};

/** Check if a domain contains a brand keyword or common homoglyph variants */
function domainMatchesBrand(domain: string, keyword: string): boolean {
  if (keyword.length < 3) return false; // Avoid false positives on short keywords

  // Direct substring match
  if (domain.includes(keyword)) return true;

  // Homoglyph variant matching
  const variants = generateHomoglyphVariants(keyword);
  for (const variant of variants) {
    if (domain.includes(variant)) return true;
  }

  return false;
}

/** Generate simple homoglyph variants of a keyword */
function generateHomoglyphVariants(keyword: string): string[] {
  const variants: string[] = [];
  for (let i = 0; i < keyword.length; i++) {
    const char = keyword[i]!;
    const subs = HOMOGLYPHS[char];
    if (subs) {
      for (const sub of subs) {
        variants.push(keyword.slice(0, i) + sub + keyword.slice(i + 1));
      }
    }
  }
  return variants;
}
