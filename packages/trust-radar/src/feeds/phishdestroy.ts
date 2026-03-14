import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/**
 * PhishDestroy (destroylist) — Curated phishing & scam domain blocklist.
 * Source: https://github.com/phishdestroy/destroylist
 * Format: JSON array of domain strings.
 * Free, no auth, updated hourly.
 */
export const phishdestroy: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    console.log(`[phishdestroy] fetching: ${ctx.feedUrl}`);
    const res = await fetch(ctx.feedUrl);
    console.log(`[phishdestroy] response: HTTP ${res.status}`);
    if (!res.ok) throw new Error(`PhishDestroy HTTP ${res.status}`);

    const domains = (await res.json()) as string[];
    if (!Array.isArray(domains)) throw new Error("PhishDestroy: expected JSON array");

    console.log(`[phishdestroy] parsed ${domains.length} domains`);

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;

    // Process in order, cap at 5000 per run to stay within Worker limits
    const batch = domains.slice(0, 5000);

    for (const domain of batch) {
      if (!domain || typeof domain !== "string" || domain.length < 4) continue;

      try {
        if (await isDuplicate(ctx.env, "domain", domain)) { itemsDuplicate++; continue; }

        await insertThreat(ctx.env.DB, {
          id: threatId("phishdestroy", "domain", domain),
          source_feed: "phishdestroy",
          threat_type: "phishing",
          malicious_url: `https://${domain}`,
          malicious_domain: domain,
          ioc_value: domain,
          severity: "high",
          confidence_score: 80,
        });
        await markSeen(ctx.env, "domain", domain);
        itemsNew++;
      } catch { itemsError++; }
    }

    console.log(`[phishdestroy] done: fetched=${batch.length}, new=${itemsNew}, dup=${itemsDuplicate}, err=${itemsError}`);
    return { itemsFetched: batch.length, itemsNew, itemsDuplicate, itemsError };
  },
};
