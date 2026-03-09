import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** ThreatFox (abuse.ch) — IOCs: domains, URLs, IPs, hashes */
export const threatfox: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const res = await fetch(ctx.feedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "get_iocs", days: 1 }),
    });
    if (!res.ok) throw new Error(`ThreatFox HTTP ${res.status}`);

    const data = await res.json() as { query_status: string; data?: Array<{
      id: number; ioc: string; ioc_type: string; threat_type: string;
      malware?: string; confidence_level?: number; tags?: string[];
      reference?: string; first_seen_utc?: string;
    }> };

    if (data.query_status !== "ok" || !data.data) return { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0, threatsCreated: 0 };

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const items = data.data.slice(0, 500); // Cap per run

    for (const ioc of items) {
      try {
        const iocType = mapIocType(ioc.ioc_type);
        if (await isDuplicate(ctx.env, iocType, ioc.ioc)) { itemsDuplicate++; continue; }

        await insertThreat(ctx.env.DB, {
          id: threatId("threatfox", iocType, ioc.ioc),
          type: mapThreatType(ioc.threat_type),
          title: `ThreatFox: ${ioc.malware ?? ioc.threat_type} — ${ioc.ioc}`,
          description: `IOC from ThreatFox feed. Malware: ${ioc.malware ?? "unknown"}. Ref: ${ioc.reference ?? "N/A"}`,
          severity: confidenceToSeverity(ioc.confidence_level ?? 50),
          confidence: (ioc.confidence_level ?? 50) / 100,
          source: "threatfox",
          source_ref: String(ioc.id),
          ioc_type: iocType,
          ioc_value: ioc.ioc,
          domain: iocType === "domain" ? ioc.ioc : extractDomain(ioc.ioc),
          url: iocType === "url" ? ioc.ioc : undefined,
          ip_address: iocType === "ip" ? ioc.ioc : undefined,
          tags: ioc.tags ?? [],
          metadata: { malware: ioc.malware, threat_type: ioc.threat_type },
          created_by: "threatfox",
        });
        await markSeen(ctx.env, iocType, ioc.ioc);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};

function mapIocType(t: string): string {
  if (t.includes("domain")) return "domain";
  if (t.includes("url")) return "url";
  if (t.includes("ip")) return "ip";
  if (t.includes("md5") || t.includes("sha")) return "hash";
  return "unknown";
}

function mapThreatType(t: string): string {
  if (t.includes("botnet")) return "c2";
  if (t.includes("payload")) return "malware";
  return "malware";
}

function confidenceToSeverity(c: number): string {
  if (c >= 90) return "critical";
  if (c >= 70) return "high";
  if (c >= 40) return "medium";
  return "low";
}

function extractDomain(val: string): string | undefined {
  try {
    const u = new URL(val.startsWith("http") ? val : `https://${val}`);
    return u.hostname;
  } catch { return undefined; }
}
