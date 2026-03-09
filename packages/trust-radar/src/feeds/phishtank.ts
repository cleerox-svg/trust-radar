import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
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
    const items = data.slice(0, 500);

    for (const entry of items) {
      try {
        if (await isDuplicate(ctx.env, "url", entry.url)) { itemsDuplicate++; continue; }

        let domain: string | undefined;
        try { domain = new URL(entry.url).hostname; } catch {}

        await insertThreat(ctx.env.DB, {
          id: threatId("phishtank", "url", entry.url),
          type: "phishing",
          title: `PhishTank: ${domain ?? entry.url}`,
          description: `Verified phishing URL${entry.target ? ` targeting ${entry.target}` : ""}. PhishTank ID: ${entry.phish_id}`,
          severity: "high",
          confidence: entry.verified === "yes" ? 0.95 : 0.7,
          source: "phishtank",
          source_ref: String(entry.phish_id),
          ioc_type: "url",
          ioc_value: entry.url,
          domain,
          url: entry.url,
          tags: ["phishing", ...(entry.target ? [entry.target.toLowerCase()] : [])],
          metadata: { target: entry.target, detail_url: entry.phish_detail_url },
          created_by: "phishtank",
        });
        await markSeen(ctx.env, "url", entry.url);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};
