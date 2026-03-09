import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** CertStream — Certificate Transparency log monitoring for suspicious domains */
export const certstream: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    // CertStream typically uses WebSocket, but we poll the REST fallback endpoint
    const res = await fetch(ctx.feedUrl, {
      headers: { Accept: "application/json", ...ctx.headers },
    });
    if (!res.ok) throw new Error(`CertStream HTTP ${res.status}`);

    const data = await res.json() as Array<{
      domain: string;
      san?: string[];
      issuer?: string;
      not_before?: string;
      not_after?: string;
      fingerprint?: string;
      source?: string;
    }>;

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const items = (Array.isArray(data) ? data : []).slice(0, 500);

    // Suspicious keyword patterns for brand impersonation detection
    const suspiciousPatterns = /(?:paypal|apple|google|microsoft|amazon|netflix|bank|login|secure|verify|account|update|signin|support)/i;

    for (const cert of items) {
      try {
        const domain = cert.domain;
        if (!domain) continue;
        if (!suspiciousPatterns.test(domain)) continue; // Only flag suspicious certs

        if (await isDuplicate(ctx.env, "domain", domain)) { itemsDuplicate++; continue; }

        await insertThreat(ctx.env.DB, {
          id: threatId("certstream", "domain", domain),
          type: "phishing",
          title: `CertStream: Suspicious cert for ${domain}`,
          description: `New SSL certificate issued for suspicious domain. Issuer: ${cert.issuer ?? "N/A"}. SANs: ${cert.san?.length ?? 0}`,
          severity: "medium",
          confidence: 0.65,
          source: "certstream",
          source_ref: cert.fingerprint ?? domain,
          ioc_type: "domain",
          ioc_value: domain,
          domain,
          tags: ["certstream", "certificate-transparency", "brand-impersonation"],
          metadata: {
            san: cert.san,
            issuer: cert.issuer,
            not_before: cert.not_before,
            not_after: cert.not_after,
            fingerprint: cert.fingerprint,
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
