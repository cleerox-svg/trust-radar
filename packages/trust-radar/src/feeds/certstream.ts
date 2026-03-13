import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/**
 * CertStream — Certificate Transparency log monitoring for suspicious domains.
 * Uses crt.sh REST API (CT log aggregator) to search for recently-issued certs
 * containing brand impersonation keywords.
 */
export const certstream: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    // Suspicious brand keywords to query CT logs for
    const keywords = ["paypal", "microsoft-login", "apple-id", "netflix-verify", "amazon-secure"];
    const keyword = keywords[Math.floor(Date.now() / 900_000) % keywords.length]; // rotate every 15 min

    const url = `${ctx.feedUrl}?q=%25${keyword}%25&output=json&limit=100`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...ctx.headers },
    });
    if (!res.ok) throw new Error(`CertStream/crt.sh HTTP ${res.status}`);

    const data = await res.json() as Array<{
      id?: number;
      common_name?: string;
      name_value?: string;       // newline-delimited SANs
      issuer_name?: string;
      not_before?: string;
      not_after?: string;
      serial_number?: string;
    }>;

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const items = (Array.isArray(data) ? data : []).slice(0, 500);

    // Additional filter: skip wildcard-only and legitimate results
    const suspiciousPatterns = /(?:paypal|apple|google|microsoft|amazon|netflix|bank|login|secure|verify|account|update|signin|support)/i;

    for (const cert of items) {
      try {
        const domain = cert.common_name ?? cert.name_value?.split("\n")[0];
        if (!domain) continue;
        if (!suspiciousPatterns.test(domain)) continue;

        // Skip actual legitimate domains
        if (/\.(paypal|apple|google|microsoft|amazon|netflix)\.com$/i.test(domain)) continue;

        if (await isDuplicate(ctx.env, "domain", domain)) { itemsDuplicate++; continue; }

        const sans = cert.name_value?.split("\n").filter(Boolean) ?? [];

        await insertThreat(ctx.env.DB, {
          id: threatId("certstream", "domain", domain),
          type: "phishing",
          title: `CertStream: Suspicious cert for ${domain}`,
          description: `New SSL certificate issued for suspicious domain. Issuer: ${cert.issuer_name ?? "N/A"}. SANs: ${sans.length}`,
          severity: "medium",
          confidence: 0.65,
          source: "certstream",
          source_ref: cert.serial_number ?? String(cert.id ?? domain),
          ioc_type: "domain",
          ioc_value: domain,
          domain,
          tags: ["certstream", "certificate-transparency", "brand-impersonation"],
          metadata: {
            san: sans.slice(0, 20),
            issuer: cert.issuer_name,
            not_before: cert.not_before,
            not_after: cert.not_after,
            serial: cert.serial_number,
          },
          created_by: "certstream",
        });
        await markSeen(ctx.env, "domain", domain);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};
