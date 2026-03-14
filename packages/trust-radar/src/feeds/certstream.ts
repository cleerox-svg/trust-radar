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
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`CertStream/crt.sh HTTP ${res.status}`);

    const data = await res.json() as Array<{
      id?: number;
      common_name?: string;
      name_value?: string;
      issuer_name?: string;
      serial_number?: string;
    }>;

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const items = (Array.isArray(data) ? data : []).slice(0, 500);
    const suspiciousPatterns = /(?:paypal|apple|google|microsoft|amazon|netflix|bank|login|secure|verify|account|update|signin|support)/i;

    for (const cert of items) {
      try {
        const domain = cert.common_name ?? cert.name_value?.split("\n")[0];
        if (!domain) continue;
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
        await markSeen(ctx.env, "domain", domain);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError };
  },
};
