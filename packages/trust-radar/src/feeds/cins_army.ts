import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";
import { diagnosticFetch } from "../lib/feedDiagnostic";

const CINS_URL = "https://cinsscore.com/list/ci-badguys.txt";

/**
 * CINS Army — Verified malicious IP addresses from honeypot network.
 * Enriches existing threats and stores new IPs that match existing data.
 * Limits new entries to 200 per pull.
 * Schedule: daily.
 */
export const cins_army: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const url = ctx.feedUrl || CINS_URL;
    console.log(`[cins_army] ingest() called — url=${url}`);
    const res = await diagnosticFetch(ctx.env.DB, "cins_army", url, {
      headers: { "User-Agent": "trust-radar/2.0" },
    });
    console.log(`[cins_army] response: HTTP ${res.status}, content-type=${res.headers.get("content-type")}`);
    if (!res.ok) throw new Error(`CINS Army HTTP ${res.status}`);

    const text = await res.text();
    const ips = text.split("\n").map((l) => l.trim()).filter((l) => l && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(l));
    console.log(`[cins_army] parsed ${ips.length} IPs`);

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const MAX_NEW = 200;

    for (const ip of ips) {
      try {
        // Check if this IP exists in any existing threat
        const existing = await ctx.env.DB.prepare(
          "SELECT id, confidence_score FROM threats WHERE ip_address = ? LIMIT 1"
        ).bind(ip).first<{ id: string; confidence_score: number | null }>();

        if (existing) {
          // Enrich: confirmed malicious → boost confidence to at least 80
          const newScore = Math.max(existing.confidence_score ?? 0, 80);
          await ctx.env.DB.prepare(
            "UPDATE threats SET confidence_score = ?, last_seen = datetime('now') WHERE id = ?"
          ).bind(newScore, existing.id).run();
          itemsDuplicate++;
          continue;
        }

        // Limit new entries
        if (itemsNew >= MAX_NEW) continue;
        if (await isDuplicate(ctx.env, "ip", ip)) { itemsDuplicate++; continue; }

        await insertThreat(ctx.env.DB, {
          id: threatId("cins_army", "ip", ip),
          source_feed: "cins_army",
          threat_type: "malicious_ip",
          malicious_url: null,
          malicious_domain: null,
          ip_address: ip,
          ioc_value: ip,
          severity: "medium",
          confidence_score: 75,
        });
        await markSeen(ctx.env, "ip", ip);
        itemsNew++;
      } catch { itemsError++; }
    }

    console.log(`[cins_army] done: total=${ips.length}, new=${itemsNew}, enriched/dup=${itemsDuplicate}, err=${itemsError}`);
    return { itemsFetched: ips.length, itemsNew, itemsDuplicate, itemsError };
  },
};
