import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** AlienVault OTX — Open Threat Exchange pulse indicators (API key required) */
export const otx: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    if (!ctx.apiKey) throw new Error("OTX requires an API key");

    const res = await fetch(ctx.feedUrl, {
      headers: {
        "X-OTX-API-KEY": ctx.apiKey,
        Accept: "application/json",
        ...ctx.headers,
      },
    });
    if (!res.ok) throw new Error(`OTX HTTP ${res.status}`);

    const body = await res.json() as {
      results?: Array<{
        id: string;
        name: string;
        description?: string;
        author_name?: string;
        created?: string;
        modified?: string;
        tags?: string[];
        targeted_countries?: string[];
        adversary?: string;
        indicators?: Array<{
          indicator: string;
          type: string; // "IPv4", "domain", "URL", "FileHash-SHA256", "email", "hostname"
          title?: string;
          description?: string;
        }>;
        pulse_source?: string;
        TLP?: string;
      }>;
      count?: number;
    };

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;
    const pulses = (body.results ?? []).slice(0, 50);

    const typeMap: Record<string, string> = {
      IPv4: "ip", IPv6: "ip", domain: "domain", hostname: "domain",
      URL: "url", "FileHash-SHA256": "hash", "FileHash-MD5": "hash",
      "FileHash-SHA1": "hash", email: "email",
    };

    for (const pulse of pulses) {
      try {
        const indicators = (pulse.indicators ?? []).slice(0, 20);

        for (const ioc of indicators) {
          const iocType = typeMap[ioc.type] ?? "domain";
          if (await isDuplicate(ctx.env, iocType, ioc.indicator)) { itemsDuplicate++; continue; }

          let domain: string | undefined;
          let ip: string | undefined;
          if (iocType === "domain") domain = ioc.indicator;
          if (iocType === "ip") ip = ioc.indicator;
          if (iocType === "url") { try { domain = new URL(ioc.indicator).hostname; } catch {} }

          await insertThreat(ctx.env.DB, {
            id: threatId("otx", iocType, ioc.indicator),
            type: "malware",
            title: `OTX: ${ioc.indicator.slice(0, 60)} — ${pulse.name.slice(0, 40)}`,
            description: `From OTX pulse "${pulse.name}"${pulse.adversary ? ` by ${pulse.adversary}` : ""}. ${ioc.description ?? pulse.description ?? ""}`.slice(0, 500),
            severity: pulse.adversary ? "high" : "medium",
            confidence: 0.75,
            source: "otx",
            source_ref: pulse.id,
            ioc_type: iocType,
            ioc_value: ioc.indicator,
            domain,
            ip_address: ip,
            url: iocType === "url" ? ioc.indicator : undefined,
            country_code: pulse.targeted_countries?.[0],
            tags: [
              "otx", "pulse",
              ...(pulse.tags ?? []).map(t => t.toLowerCase()),
              ...(pulse.adversary ? [pulse.adversary.toLowerCase()] : []),
            ],
            metadata: {
              pulse_id: pulse.id,
              pulse_name: pulse.name,
              author: pulse.author_name,
              adversary: pulse.adversary,
              tlp: pulse.TLP,
              indicator_type: ioc.type,
            },
            created_by: "otx",
          });
          await markSeen(ctx.env, iocType, ioc.indicator);
          itemsNew++;
        }
      } catch { itemsError++; }
    }

    const totalIndicators = pulses.reduce((sum, p) => sum + (p.indicators?.length ?? 0), 0);
    return { itemsFetched: totalIndicators, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};
