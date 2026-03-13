import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** URLhaus (abuse.ch) — Active malware distribution URLs */
export const urlhaus: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const res = await fetch(ctx.feedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) throw new Error(`URLhaus HTTP ${res.status}`);

    const body = await res.json() as {
      query_status: string;
      urls?: Array<{
        id: string;
        url_status: string;
        url: string;
        host: string;
        date_added: string;
        threat: string;
        tags: string[] | null;
        reporter: string;
        urls_on_host: number;
      }>;
    };

    if (!body.urls) {
      return { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0, threatsCreated: 0 };
    }

    const items = body.urls.slice(0, 1000);
    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;

    for (const entry of items) {
      try {
        if (await isDuplicate(ctx.env, "url", entry.url)) { itemsDuplicate++; continue; }

        let domain: string | undefined;
        try { domain = new URL(entry.url).hostname; } catch { /* ignore */ }

        const isActive = entry.url_status === "online";
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entry.host);

        await insertThreat(ctx.env.DB, {
          id: threatId("urlhaus", "url", entry.url),
          type: "malware",
          title: `URLhaus: Malware distribution — ${domain ?? entry.host}`,
          description: `Malware distribution URL${isActive ? " (currently active)" : " (offline)"}. Threat: ${entry.threat}. Host serves ${entry.urls_on_host} malicious URLs.`,
          severity: isActive ? "high" : "medium",
          confidence: isActive ? 0.90 : 0.75,
          source: "urlhaus",
          source_ref: entry.id,
          ioc_type: "url",
          ioc_value: entry.url,
          domain,
          url: entry.url,
          ip_address: isIp ? entry.host : undefined,
          tags: ["urlhaus", "malware-distribution", ...(entry.tags ?? []).map(t => t.toLowerCase())],
          metadata: {
            url_status: entry.url_status,
            threat: entry.threat,
            reporter: entry.reporter,
            urls_on_host: entry.urls_on_host,
            date_added: entry.date_added,
          },
          created_by: "urlhaus",
        });
        await markSeen(ctx.env, "url", entry.url);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};
