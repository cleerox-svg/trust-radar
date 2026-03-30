import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId, extractDomain } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";
import { diagnosticFetch } from "../lib/feedDiagnostic";

/**
 * AlienVault OTX — Pulse activity feed.
 * Requires OTX_API_KEY for authenticated access (free account at otx.alienvault.com).
 * Falls back to public endpoint if no key, but may get HTTP 403.
 * Extracts domain, URL, and IPv4 indicators from recent pulses.
 * Schedule: every 2 hours.
 */
export const otx_alienvault: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    if (!ctx.env.OTX_API_KEY) {
      console.error("[otx] OTX feed disabled — OTX_API_KEY secret not set. Create a free account at otx.alienvault.com and run: wrangler secret put OTX_API_KEY");
      return { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0 };
    }

    // OTX requires modified_since param — without it, subscribed endpoint returns 403
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const baseUrl = ctx.feedUrl || "https://otx.alienvault.com/api/v1/pulses/subscribed";
    const feedUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}modified_since=${encodeURIComponent(since)}`;
    console.log(`[otx_alienvault] feedUrl from config: "${ctx.feedUrl}"`);
    console.log(`[otx_alienvault] Fetching: ${feedUrl}`);
    const headers: Record<string, string> = {
      "User-Agent": "Averrow-ThreatIntel/1.0",
      Accept: "application/json",
      "X-OTX-API-KEY": ctx.env.OTX_API_KEY,
    };
    const res = await diagnosticFetch(ctx.env.DB, "otx_alienvault", feedUrl, { headers });
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

    return { itemsFetched: total, itemsNew, itemsDuplicate, itemsError };
  },
};
