import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** VirusTotal — Domain/URL scanning via VT API (API key required) */
export const virustotal: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    if (!ctx.apiKey) throw new Error("VirusTotal requires an API key");

    // Fetch popular threat domains from VT hunting livehunt
    const res = await fetch(ctx.feedUrl, {
      headers: {
        "x-apikey": ctx.apiKey,
        Accept: "application/json",
        ...ctx.headers,
      },
    });
    if (!res.ok) throw new Error(`VirusTotal HTTP ${res.status}`);

    const body = await res.json() as {
      data?: Array<{
        id: string;
        type: string;
        attributes: {
          url?: string;
          last_analysis_stats?: { malicious: number; suspicious: number; harmless: number; undetected: number };
          last_final_url?: string;
          title?: string;
          tags?: string[];
          threat_names?: string[];
          last_http_response_content_sha256?: string;
          last_analysis_date?: number;
        };
      }>;
    };

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const items = (body.data ?? []).slice(0, 200);

    for (const entry of items) {
      try {
        const attrs = entry.attributes;
        const value = attrs.url ?? entry.id;
        if (await isDuplicate(ctx.env, "url", value)) { itemsDuplicate++; continue; }

        const stats = attrs.last_analysis_stats;
        const malicious = stats?.malicious ?? 0;
        const total = (stats?.malicious ?? 0) + (stats?.suspicious ?? 0) + (stats?.harmless ?? 0) + (stats?.undetected ?? 0);
        const ratio = total > 0 ? malicious / total : 0;

        const severity = ratio > 0.5 ? "critical" : ratio > 0.2 ? "high" : ratio > 0.05 ? "medium" : "low";

        let domain: string | undefined;
        try { domain = new URL(value).hostname; } catch {}

        await insertThreat(ctx.env.DB, {
          id: threatId("virustotal", "url", value),
          type: "malware",
          title: `VirusTotal: ${domain ?? value.slice(0, 50)} (${malicious}/${total} detections)`,
          description: `VirusTotal scan: ${malicious} engines flagged as malicious out of ${total}.${attrs.threat_names?.length ? ` Threats: ${attrs.threat_names.join(", ")}` : ""}`,
          severity,
          confidence: Math.min(0.5 + ratio, 0.99),
          source: "virustotal",
          source_ref: entry.id,
          ioc_type: "url",
          ioc_value: value,
          domain,
          url: value,
          tags: [
            "virustotal", ...(attrs.tags ?? []).map(t => t.toLowerCase()),
            ...(attrs.threat_names ?? []).map(t => t.toLowerCase()),
          ],
          metadata: {
            analysis_stats: stats,
            title: attrs.title,
            content_sha256: attrs.last_http_response_content_sha256,
            analysis_date: attrs.last_analysis_date,
          },
          created_by: "virustotal",
        });
        await markSeen(ctx.env, "url", value);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};
