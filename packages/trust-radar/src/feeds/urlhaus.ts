import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId, extractDomain } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";
import { diagnosticFetch } from "../lib/feedDiagnostic";

/** URLhaus (abuse.ch) — Active malware distribution URLs */
export const urlhaus: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    // The feed_configs source_url may be missing /urls/recent/ — use correct endpoint
    const url = ctx.feedUrl.includes("/urls/recent")
      ? ctx.feedUrl
      : "https://urlhaus-api.abuse.ch/v1/urls/recent/";
    console.log(`[urlhaus] fetching: ${url}`);
    const res = await diagnosticFetch(ctx.env.DB, "urlhaus", url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Auth-Key": ctx.env.ABUSECH_AUTH_KEY,
      },
    });
    console.log(`[urlhaus] response: HTTP ${res.status}`);
    if (!res.ok) throw new Error(`URLhaus HTTP ${res.status}`);

    const body = await res.json() as {
      query_status: string;
      urls?: Array<{
        id: string; url_status: string; url: string; host: string;
        date_added: string; threat: string; tags: string[] | null;
      }>;
    };
    console.log(`[urlhaus] query_status=${body.query_status}, urls=${body.urls?.length ?? 0}`);

    if (!body.urls) {
      console.log(`[urlhaus] no urls in response, returning empty`);
      return { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0 };
    }

    const items = body.urls.slice(0, 500);
    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;

    for (const entry of items) {
      try {
        if (await isDuplicate(ctx.env, "url", entry.url)) { itemsDuplicate++; continue; }

        const domain = extractDomain(entry.url);
        const isActive = entry.url_status === "online";
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entry.host);

        await insertThreat(ctx.env.DB, {
          id: threatId("urlhaus", "url", entry.url),
          source_feed: "urlhaus",
          threat_type: "malware_distribution",
          malicious_url: entry.url,
          malicious_domain: domain,
          ip_address: isIp ? entry.host : null,
          ioc_value: entry.url,
          severity: isActive ? "high" : "medium",
          confidence_score: isActive ? 90 : 75,
          status: isActive ? "active" : "down",
        });
        await markSeen(ctx.env, "url", entry.url);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError };
  },
};
