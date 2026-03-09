import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** Cloudflare Radar — Internet security insights and attack trends */
export const cf_radar: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const res = await fetch(ctx.feedUrl, {
      headers: {
        Accept: "application/json",
        ...(ctx.apiKey ? { Authorization: `Bearer ${ctx.apiKey}` } : {}),
        ...ctx.headers,
      },
    });
    if (!res.ok) throw new Error(`CF Radar HTTP ${res.status}`);

    const body = await res.json() as {
      result?: {
        summary?: {
          attackTypes?: Array<{ name: string; value: number }>;
          topAttackedCountries?: Array<{ name: string; value: number }>;
          topAttackedIndustries?: Array<{ name: string; value: number }>;
        };
        timeseries?: Array<{
          timestamp: string;
          value: number;
          attack_type?: string;
        }>;
      };
      success?: boolean;
    };

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;

    const summary = body.result?.summary;
    if (!summary) {
      return { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0, threatsCreated: 0 };
    }

    // Create threat entries for notable attack trends
    const attackTypes = summary.attackTypes ?? [];
    for (const attack of attackTypes) {
      try {
        const key = `cf-radar:${attack.name}:${new Date().toISOString().slice(0, 10)}`;
        if (await isDuplicate(ctx.env, "domain", key)) { itemsDuplicate++; continue; }

        await insertThreat(ctx.env.DB, {
          id: threatId("cf_radar", "domain", key),
          type: "reputation",
          title: `CF Radar: ${attack.name} trend (${attack.value}%)`,
          description: `Cloudflare Radar reports ${attack.name} attacks at ${attack.value}% of total attack traffic.`,
          severity: attack.value > 30 ? "high" : "medium",
          confidence: 0.9,
          source: "cf_radar",
          source_ref: key,
          ioc_type: "domain",
          ioc_value: attack.name,
          tags: ["cloudflare", "radar", "attack-trend", attack.name.toLowerCase().replace(/\s+/g, "-")],
          metadata: {
            attack_type: attack.name,
            percentage: attack.value,
            top_countries: summary.topAttackedCountries?.slice(0, 5),
            top_industries: summary.topAttackedIndustries?.slice(0, 5),
          },
          created_by: "cf_radar",
        });
        await markSeen(ctx.env, "domain", key);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: attackTypes.length, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};
