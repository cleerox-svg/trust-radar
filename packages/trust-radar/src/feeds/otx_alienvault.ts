import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId, extractDomain } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/**
 * AlienVault OTX — Public pulse activity feed.
 * No API key required for the public activity endpoint.
 * Extracts domain, URL, and IPv4 indicators from recent pulses.
 * Schedule: every 2 hours.
 */
export const otx_alienvault: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const feedUrl = "https://otx.alienvault.com/api/v1/pulses/activity";
    console.log(`[otx] fetching: ${feedUrl}`);

    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "trust-radar/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    console.log(`[otx] response: HTTP ${res.status}`);
    if (!res.ok) throw new Error(`OTX HTTP ${res.status}`);

    const body = await res.json() as {
      results?: Array<{
        name?: string;
        tags?: string[];
        indicators?: Array<{
          type: string;
          indicator: string;
        }>;
      }>;
    };

    const pulses = body.results ?? [];
    console.log(`[otx] parsed ${pulses.length} pulses`);

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    let total = 0;

    for (const pulse of pulses) {
      if (total >= 200) break;
      const tags = (pulse.tags ?? []).map(t => t.toLowerCase());

      // Determine threat_type from pulse tags
      let threatType: "phishing" | "malware_distribution" | "c2" = "malware_distribution";
      if (tags.some(t => t.includes("phishing"))) threatType = "phishing";
      else if (tags.some(t => t.includes("c2") || t.includes("c&c") || t.includes("command"))) threatType = "c2";

      for (const ind of pulse.indicators ?? []) {
        if (total >= 200) break;
        const iocType = ind.type;
        const iocValue = ind.indicator;

        // Only process domains, URLs, and IPv4 addresses
        if (iocType !== "domain" && iocType !== "URL" && iocType !== "IPv4") continue;

        try {
          if (await isDuplicate(ctx.env, iocType, iocValue)) { itemsDuplicate++; continue; }

          const url = iocType === "URL" ? iocValue : (iocType === "domain" ? `http://${iocValue}` : null);
          const domain = iocType === "domain" ? iocValue : (iocType === "URL" ? extractDomain(iocValue) : null);
          const ip = iocType === "IPv4" ? iocValue : null;

          await insertThreat(ctx.env.DB, {
            id: threatId("otx", iocType, iocValue),
            source_feed: "otx_alienvault",
            threat_type: threatType,
            malicious_url: url,
            malicious_domain: domain,
            ip_address: ip,
            ioc_value: iocValue,
            severity: threatType === "phishing" ? "high" : "medium",
            confidence_score: 65,
          });
          await markSeen(ctx.env, iocType, iocValue);
          itemsNew++;
          total++;
        } catch (e) {
          itemsError++;
          if (itemsError <= 3) console.error(`[otx] item error: ${e}`);
        }
      }
    }

    console.log(`[otx] done: fetched=${total}, new=${itemsNew}, dup=${itemsDuplicate}, err=${itemsError}`);
    return { itemsFetched: total, itemsNew, itemsDuplicate, itemsError };
  },
};
