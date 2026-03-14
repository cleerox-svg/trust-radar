import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** Feodo Tracker (abuse.ch) — Botnet C2 IP blocklist */
export const feodo: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    console.log(`[feodo] fetching: ${ctx.feedUrl}`);
    const res = await fetch(ctx.feedUrl);
    console.log(`[feodo] response: HTTP ${res.status}`);
    if (!res.ok) throw new Error(`Feodo HTTP ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n").filter(l => l.trim() && !l.startsWith("#"));
    console.log(`[feodo] parsed ${lines.length} lines from ${text.length} chars`);

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;

    for (const line of lines) {
      const ip = line.trim();
      if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) continue;
      try {
        if (await isDuplicate(ctx.env, "ip", ip)) { itemsDuplicate++; continue; }

        await insertThreat(ctx.env.DB, {
          id: threatId("feodo", "ip", ip),
          source_feed: "feodo",
          threat_type: "malware_distribution",
          malicious_url: null,
          malicious_domain: null,
          ip_address: ip,
          ioc_value: ip,
          severity: "high",
          confidence_score: 90,
        });
        await markSeen(ctx.env, "ip", ip);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: lines.length, itemsNew, itemsDuplicate, itemsError };
  },
};
