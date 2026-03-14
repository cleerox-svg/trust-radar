import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId, extractDomain } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** PhishTank Community — Verified phishing URLs */
export const phishtank: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const res = await fetch(ctx.feedUrl);
    if (!res.ok) throw new Error(`PhishTank HTTP ${res.status}`);

    const data = await res.json() as Array<{
      phish_id: number; url: string; phish_detail_url?: string;
      submission_time?: string; verified?: string; target?: string;
    }>;

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const items = data.slice(0, 2000);

    for (const entry of items) {
      try {
        if (await isDuplicate(ctx.env, "url", entry.url)) { itemsDuplicate++; continue; }

        const domain = extractDomain(entry.url);

        await insertThreat(ctx.env.DB, {
          id: threatId("phishtank", "url", entry.url),
          source_feed: "phishtank",
          threat_type: "phishing",
          malicious_url: entry.url,
          malicious_domain: domain,
          ioc_value: entry.url,
          severity: "high",
          confidence_score: entry.verified === "yes" ? 95 : 70,
        });
        await markSeen(ctx.env, "url", entry.url);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError };
  },
};
