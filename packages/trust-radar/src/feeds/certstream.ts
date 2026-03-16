import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId, extractDomain } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

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
 * CertStream — Certificate Transparency log monitoring for suspicious domains.
 * Uses crt.sh REST API to search for recently-issued certs containing brand
 * impersonation keywords.
 *
 * Checks each domain against:
 * 1. Monitored brands from the DB (typosquatting detection with homoglyphs)
 * 2. Hardcoded suspicious patterns (fallback for generic phishing keywords)
 */
export const certstream: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    // ─── Load monitored brand keywords from DB ──────────────
    const brands = await ctx.env.DB.prepare(
      `SELECT b.id, b.name, b.canonical_domain
       FROM brands b
       INNER JOIN monitored_brands mb ON mb.brand_id = b.id
       WHERE mb.status = 'active'`
    ).all<{ id: string; name: string; canonical_domain: string }>();

    const brandKeywords = brands.results.map((b) => ({
      id: b.id,
      keyword: b.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
      domain: b.canonical_domain.toLowerCase(),
    }));
    console.log(`[ct_logs] loaded ${brandKeywords.length} monitored brands for matching`);

    // ─── Build search keyword list ──────────────────────────
    // Use monitored brand names + hardcoded fallback keywords for crt.sh query
    const hardcodedKeywords = ["paypal", "microsoft-login", "apple-id", "netflix-verify", "amazon-secure"];
    const allSearchKeywords = [
      ...brandKeywords.filter((b) => b.keyword.length >= 4).map((b) => b.keyword),
      ...hardcodedKeywords,
    ];
    // Rotate through keywords each 15-minute window
    const keyword = allSearchKeywords[Math.floor(Date.now() / 900_000) % allSearchKeywords.length]!;

    const url = `${ctx.feedUrl}?q=%25${keyword}%25&output=json&limit=100`;
    console.log(`[ct_logs] fetching: ${url}`);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    console.log(`[ct_logs] response: HTTP ${res.status}, content-type=${res.headers.get("content-type")}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[ct_logs] error body: ${body.slice(0, 500)}`);
      throw new Error(`CertStream/crt.sh HTTP ${res.status}`);
    }

    const rawText = await res.text();
    console.log(`[ct_logs] response body length: ${rawText.length} chars, first 200: ${rawText.slice(0, 200)}`);

    let data: Array<{
      id?: number;
      common_name?: string;
      name_value?: string;
      issuer_name?: string;
      serial_number?: string;
    }>;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error(`[ct_logs] JSON parse failed: ${e}`);
      throw new Error(`CertStream JSON parse error: ${e}`);
    }

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const items = (Array.isArray(data) ? data : []).slice(0, 500);
    console.log(`[ct_logs] parsed ${items.length} certificates`);
    const suspiciousPatterns = /(?:paypal|apple|google|microsoft|amazon|netflix|bank|login|secure|verify|account|update|signin|support)/i;

    for (const cert of items) {
      try {
        const domain = cert.common_name ?? cert.name_value?.split("\n")[0];
        if (!domain) continue;

        // ─── Check against monitored brands (typosquatting) ───
        const matchedBrand = matchMonitoredBrand(domain.toLowerCase(), brandKeywords);
        if (matchedBrand) {
          if (await isDuplicate(ctx.env, "domain", domain)) { itemsDuplicate++; continue; }

          await insertThreat(ctx.env.DB, {
            id: threatId("ct_logs", "domain", domain),
            source_feed: "ct_logs",
            threat_type: "typosquatting",
            malicious_url: null,
            malicious_domain: domain,
            target_brand_id: matchedBrand.id,
            ioc_value: domain,
            severity: "high",
            confidence_score: 75,
          });
          await markSeen(ctx.env, "domain", domain);
          itemsNew++;
          continue;
        }

        // ─── Fallback: hardcoded suspicious patterns ──────────
        if (!suspiciousPatterns.test(domain)) continue;
        if (/\.(paypal|apple|google|microsoft|amazon|netflix)\.com$/i.test(domain)) continue;

        if (await isDuplicate(ctx.env, "domain", domain)) { itemsDuplicate++; continue; }

        await insertThreat(ctx.env.DB, {
          id: threatId("ct_logs", "domain", domain),
          source_feed: "ct_logs",
          threat_type: "phishing",
          malicious_url: null,
          malicious_domain: domain,
          ioc_value: domain,
          severity: "medium",
          confidence_score: 65,
        });
        if (itemsNew < 3) console.log(`[ct_logs] inserting threat: domain=${domain}`);
        await markSeen(ctx.env, "domain", domain);
        itemsNew++;
      } catch (e) {
        itemsError++;
        if (itemsError <= 3) console.error(`[ct_logs] item error: ${e}`);
      }
    }

    console.log(`[ct_logs] done: fetched=${items.length}, new=${itemsNew}, dup=${itemsDuplicate}, err=${itemsError}`);
    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError };
  },
};

/** Check if a domain matches any monitored brand (substring + homoglyph variants) */
function matchMonitoredBrand(
  domain: string,
  brands: Array<{ id: string; keyword: string; domain: string }>,
): { id: string; keyword: string } | null {
  for (const brand of brands) {
    // Skip if this IS the brand's canonical domain
    if (domain === brand.domain) continue;
    if (brand.keyword.length < 3) continue;

    // Direct substring match
    if (domain.includes(brand.keyword)) return brand;

    // Homoglyph variant matching
    for (let i = 0; i < brand.keyword.length; i++) {
      const char = brand.keyword[i]!;
      const subs = HOMOGLYPHS[char];
      if (subs) {
        for (const sub of subs) {
          const variant = brand.keyword.slice(0, i) + sub + brand.keyword.slice(i + 1);
          if (domain.includes(variant)) return brand;
        }
      }
    }
  }
  return null;
}
