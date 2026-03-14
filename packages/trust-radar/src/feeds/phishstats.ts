import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId, extractDomain } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/**
 * PhishStats — Phishing URLs with confidence scores, IP, ASN, country.
 * CSV format: date, score, url, ip
 * Score 0-10 where higher = more likely phishing. Filter to score >= 5.
 * Free, no auth. ~90 min update cycle.
 */
export const phishstats: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    console.log(`[phishstats] fetching: ${ctx.feedUrl}`);
    const res = await fetch(ctx.feedUrl);
    console.log(`[phishstats] response: HTTP ${res.status}`);
    if (!res.ok) throw new Error(`PhishStats HTTP ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    console.log(`[phishstats] parsed ${lines.length} lines from ${text.length} chars`);

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    let itemsFetched = 0;

    for (const line of lines) {
      // CSV: date, score, url, ip
      // Some URLs contain commas, so parse carefully:
      // The format is: "date","score","url","ip"
      // Or unquoted: date,score,url,ip
      const match = line.match(
        /^"?([^",]*)"?\s*,\s*"?(\d+(?:\.\d+)?)"?\s*,\s*"?(https?:\/\/[^"]*)"?\s*,\s*"?([^",]*)"?\s*$/,
      );
      if (!match) continue;

      const score = parseFloat(match[2]!);
      const url = match[3]!.trim();
      const ip = match[4]!.trim();

      // Filter: only score >= 5
      if (score < 5) continue;
      itemsFetched++;

      try {
        if (await isDuplicate(ctx.env, "url", url)) { itemsDuplicate++; continue; }

        const domain = extractDomain(url);
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);

        // Map score 5-10 to severity
        const severity = score >= 9 ? "critical" as const
          : score >= 7 ? "high" as const
          : "medium" as const;

        // Map score 5-10 to confidence 60-95
        const confidence = Math.min(95, Math.round(50 + score * 5));

        await insertThreat(ctx.env.DB, {
          id: threatId("phishstats", "url", url),
          source_feed: "phishstats",
          threat_type: "phishing",
          malicious_url: url,
          malicious_domain: domain,
          ip_address: isIp ? ip : null,
          ioc_value: url,
          severity,
          confidence_score: confidence,
        });
        await markSeen(ctx.env, "url", url);
        itemsNew++;
      } catch { itemsError++; }
    }

    console.log(`[phishstats] done: fetched=${itemsFetched} (score>=5), new=${itemsNew}, dup=${itemsDuplicate}, err=${itemsError}`);
    return { itemsFetched, itemsNew, itemsDuplicate, itemsError };
  },
};
