import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** Feodo Tracker (abuse.ch) — Botnet C2 IP blocklist */
export const feodo: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    if (!ctx.feedUrl) throw new Error("Feodo: feed_configs.source_url is empty");
    const res = await fetch(ctx.feedUrl);
    if (!res.ok) throw new Error(`Feodo HTTP ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n").filter(l => l.trim() && !l.startsWith("#"));

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    let ipMatches = 0;

    for (const line of lines) {
      const ip = line.trim();
      if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) continue;
      ipMatches++;
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

    // If we got a non-empty body but zero lines matched the IP regex,
    // upstream changed format. Throw so the feed pull row carries
    // diagnostic info instead of being silently 0-record.
    if (lines.length > 0 && ipMatches === 0) {
      const sample = lines.slice(0, 2).join(' | ').slice(0, 200);
      throw new Error(`Feodo: ${lines.length} lines, 0 IPs (format change?): ${sample}`);
    }

    return { itemsFetched: lines.length, itemsNew, itemsDuplicate, itemsError };
  },
};
