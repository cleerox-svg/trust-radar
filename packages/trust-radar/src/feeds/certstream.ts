import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId, extractDomain } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/**
 * CertStream — Certificate Transparency log monitoring for suspicious domains.
 * Uses crt.sh REST API to search for recently-issued certs containing brand
 * impersonation keywords.
 */
export const certstream: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const keywords = ["paypal", "microsoft-login", "apple-id", "netflix-verify", "amazon-secure"];
    const keyword = keywords[Math.floor(Date.now() / 900_000) % keywords.length];

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
        if (!suspiciousPatterns.test(domain)) continue;
        if (/\.(paypal|apple|google|microsoft|amazon|netflix)\.com$/i.test(domain)) continue;

        if (await isDuplicate(ctx.env, "domain", domain)) { itemsDuplicate++; continue; }

        const threatRow = {
          id: threatId("ct_logs", "domain", domain),
          source_feed: "ct_logs" as const,
          threat_type: "phishing" as const,
          malicious_url: null,
          malicious_domain: domain,
          ioc_value: domain,
          severity: "medium" as const,
          confidence_score: 65,
        };
        if (itemsNew < 3) console.log(`[ct_logs] inserting threat: domain=${domain}, id=${threatRow.id}`);
        await insertThreat(ctx.env.DB, threatRow);
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
