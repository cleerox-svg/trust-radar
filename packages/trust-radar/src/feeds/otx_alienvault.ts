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
    console.log(`[otx] ingest() called — feedUrl=${feedUrl}`);

    let res: Response;
    try {
      res = await fetch(feedUrl, {
        headers: { "User-Agent": "trust-radar/2.0", Accept: "application/json" },
      });
    } catch (fetchErr) {
      console.error(`[otx] fetch threw:`, fetchErr);
      throw new Error(`OTX fetch failed: ${fetchErr}`);
    }
    console.log(`[otx] response: HTTP ${res.status}, content-type=${res.headers.get("content-type")}`);
    if (!res.ok) throw new Error(`OTX HTTP ${res.status}`);

    let body: {
      results?: Array<{
        name?: string;
        tags?: string[];
        indicators?: Array<{ type: string; indicator: string }>;
      }>;
    };
    try {
      body = await res.json() as typeof body;
    } catch (jsonErr) {
      console.error(`[otx] JSON parse error:`, jsonErr);
      throw new Error(`OTX JSON parse failed: ${jsonErr}`);
    }

    const pulses = body.results ?? [];
    console.log(`[otx] parsed ${pulses.length} pulses`);
    if (pulses.length > 0) {
      const first = pulses[0]!;
      console.log(`[otx] sample pulse: name="${first.name}", tags=${JSON.stringify(first.tags?.slice(0, 5))}, indicators=${first.indicators?.length ?? 0}`);
    }

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    let total = 0;

    for (const pulse of pulses) {
      if (total >= 200) break;
      const tags = (pulse.tags ?? []).map(t => t.toLowerCase());

      let threatType: "phishing" | "malware_distribution" | "c2" = "malware_distribution";
      if (tags.some(t => t.includes("phishing"))) threatType = "phishing";
      else if (tags.some(t => t.includes("c2") || t.includes("c&c") || t.includes("command"))) threatType = "c2";

      for (const ind of pulse.indicators ?? []) {
        if (total >= 200) break;
        const iocType = ind.type;
        const iocValue = ind.indicator;

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
