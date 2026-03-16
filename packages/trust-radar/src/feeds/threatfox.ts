import type { FeedModule, FeedContext, FeedResult, ThreatRow } from "./types";
import { threatId, extractDomain } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** ThreatFox (abuse.ch) — IOCs: domains, URLs, IPs, hashes */
export const threatfox: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    console.log(`[threatfox] fetching: ${ctx.feedUrl}`);
    const res = await fetch(ctx.feedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "get_iocs", days: 1 }),
    });
    console.log(`[threatfox] response: HTTP ${res.status}`);
    if (!res.ok) throw new Error(`ThreatFox HTTP ${res.status}`);

    const data = await res.json() as { query_status: string; data?: Array<{
      id: number; ioc: string; ioc_type: string; threat_type: string;
      malware?: string; confidence_level?: number; tags?: string[];
    }> };
    console.log(`[threatfox] query_status=${data.query_status}, iocs=${data.data?.length ?? 0}`);

    if (data.query_status !== "ok" || !data.data) {
      console.log(`[threatfox] no data, returning empty`);
      return { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0 };
    }

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const items = data.data.slice(0, 500);

    for (const ioc of items) {
      try {
        const iocType = mapIocType(ioc.ioc_type);
        if (await isDuplicate(ctx.env, iocType, ioc.ioc)) { itemsDuplicate++; continue; }

        const domain = iocType === "domain" ? ioc.ioc : extractDomain(ioc.ioc);
        const isUrl = iocType === "url";
        const isIp = iocType === "ip";
        const confidence = ioc.confidence_level ?? 50;

        await insertThreat(ctx.env.DB, {
          id: threatId("threatfox", iocType, ioc.ioc),
          source_feed: "threatfox",
          threat_type: mapThreatType(ioc.threat_type),
          malicious_url: isUrl ? ioc.ioc : null,
          malicious_domain: domain,
          ip_address: isIp ? ioc.ioc : null,
          ioc_value: ioc.ioc,
          severity: confidenceToSeverity(confidence),
          confidence_score: confidence,
        });
        await markSeen(ctx.env, iocType, ioc.ioc);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError };
  },
};

function mapThreatType(t: string): ThreatRow["threat_type"] {
  if (t === "botnet_cc") return "c2";
  if (t === "payload_delivery") return "malware_distribution";
  return "malware_distribution";
}

function mapIocType(t: string): string {
  if (t.includes("domain")) return "domain";
  if (t.includes("url")) return "url";
  if (t.includes("ip")) return "ip";
  if (t.includes("md5") || t.includes("sha")) return "hash";
  return "unknown";
}

function confidenceToSeverity(c: number): ThreatRow["severity"] {
  if (c >= 90) return "critical";
  if (c >= 70) return "high";
  if (c >= 40) return "medium";
  return "low";
}
