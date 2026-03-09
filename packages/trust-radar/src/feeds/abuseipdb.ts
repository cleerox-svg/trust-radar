import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** AbuseIPDB — Crowd-sourced IP abuse reports (API key required) */
export const abuseipdb: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    if (!ctx.apiKey) throw new Error("AbuseIPDB requires an API key");

    const res = await fetch(ctx.feedUrl, {
      headers: {
        Key: ctx.apiKey,
        Accept: "application/json",
        ...ctx.headers,
      },
    });
    if (!res.ok) throw new Error(`AbuseIPDB HTTP ${res.status}`);

    const body = await res.json() as {
      data: Array<{
        ipAddress: string;
        abuseConfidenceScore: number;
        countryCode?: string;
        isp?: string;
        domain?: string;
        totalReports: number;
        lastReportedAt?: string;
        usageType?: string;
      }>;
    };

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const items = (body.data ?? []).slice(0, 500);

    for (const entry of items) {
      try {
        if (await isDuplicate(ctx.env, "ip", entry.ipAddress)) { itemsDuplicate++; continue; }

        const score = entry.abuseConfidenceScore;
        const severity = score >= 90 ? "critical" : score >= 70 ? "high" : score >= 40 ? "medium" : "low";

        await insertThreat(ctx.env.DB, {
          id: threatId("abuseipdb", "ip", entry.ipAddress),
          type: "reputation",
          title: `AbuseIPDB: ${entry.ipAddress} (${score}% confidence)`,
          description: `${entry.totalReports} abuse reports. ISP: ${entry.isp ?? "N/A"}. Usage: ${entry.usageType ?? "N/A"}`,
          severity,
          confidence: score / 100,
          source: "abuseipdb",
          source_ref: entry.ipAddress,
          ioc_type: "ip",
          ioc_value: entry.ipAddress,
          ip_address: entry.ipAddress,
          country_code: entry.countryCode,
          domain: entry.domain,
          tags: ["abuseipdb", "reputation", "crowd-sourced"],
          metadata: {
            abuse_confidence: score,
            total_reports: entry.totalReports,
            isp: entry.isp,
            usage_type: entry.usageType,
            last_reported: entry.lastReportedAt,
          },
          created_by: "abuseipdb",
        });
        await markSeen(ctx.env, "ip", entry.ipAddress);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};
