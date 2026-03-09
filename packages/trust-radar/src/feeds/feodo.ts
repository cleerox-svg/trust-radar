import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** Feodo Tracker (abuse.ch) — Botnet C2 IP blocklist */
export const feodo: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const res = await fetch(ctx.feedUrl);
    if (!res.ok) throw new Error(`Feodo HTTP ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n").filter(l => l.trim() && !l.startsWith("#"));

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;

    for (const line of lines) {
      const ip = line.trim();
      if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) continue;
      try {
        if (await isDuplicate(ctx.env, "ip", ip)) { itemsDuplicate++; continue; }
        await insertThreat(ctx.env.DB, {
          id: threatId("feodo", "ip", ip),
          type: "c2",
          title: `Feodo C2: ${ip}`,
          description: "Botnet command-and-control IP from Feodo Tracker recommended blocklist.",
          severity: "high",
          confidence: 0.9,
          source: "feodo",
          ioc_type: "ip",
          ioc_value: ip,
          ip_address: ip,
          tags: ["botnet", "c2"],
          created_by: "feodo",
        });
        await markSeen(ctx.env, "ip", ip);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: lines.length, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};
