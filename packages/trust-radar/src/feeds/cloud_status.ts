import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";

/** Cloud Provider Status — AWS/GCP/Azure incident feeds */
export const cloud_status: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const res = await fetch(ctx.feedUrl, {
      headers: { Accept: "application/json", ...ctx.headers },
    });
    if (!res.ok) throw new Error(`Cloud Status HTTP ${res.status}`);

    // AWS status.json format
    const body = await res.json() as {
      archive?: Array<{
        service_name: string;
        summary: string;
        date: string;
        status: number;
        description: Array<{ date: string; body: string }>;
      }>;
      current?: Array<{
        service_name: string;
        summary: string;
        status: number;
      }>;
    };

    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;

    const incidents = [...(body.current ?? []), ...(body.archive ?? []).slice(0, 50)];

    for (const incident of incidents) {
      try {
        if (incident.status === 0) continue; // healthy = skip

        const key = `${incident.service_name}:${incident.summary}`.slice(0, 200);
        if (await isDuplicate(ctx.env, "domain", key)) { itemsDuplicate++; continue; }

        const severity = incident.status >= 2 ? "high" : "medium";

        await insertThreat(ctx.env.DB, {
          id: threatId("cloud_status", "domain", key),
          type: "reputation",
          title: `Cloud Status: ${incident.service_name} — ${incident.summary.slice(0, 80)}`,
          description: incident.summary,
          severity,
          confidence: 0.99,
          source: "cloud_status",
          source_ref: key,
          ioc_type: "domain",
          ioc_value: incident.service_name,
          tags: ["cloud", "outage", "availability", incident.service_name.toLowerCase().replace(/\s+/g, "-")],
          metadata: {
            service: incident.service_name,
            status_code: incident.status,
          },
          created_by: "cloud_status",
        });
        await markSeen(ctx.env, "domain", key);
        itemsNew++;
      } catch { itemsError++; }
    }

    return { itemsFetched: incidents.length, itemsNew, itemsDuplicate, itemsError, threatsCreated: itemsNew };
  },
};
