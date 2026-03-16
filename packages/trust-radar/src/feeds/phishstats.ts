import type { FeedModule, FeedContext, FeedResult } from "./types";
import { threatId, extractDomain } from "./types";
import { isDuplicate, markSeen, insertThreat } from "../lib/feedRunner";
import { diagnosticFetch } from "../lib/feedDiagnostic";

/**
 * PhishStats — Phishing URLs with confidence scores, IP, ASN, country.
 * Primary: CSV format (date, score, url, ip). Score 0-10, filter >= 5.
 * Fallback: JSON API if CSV endpoint fails.
 */
export const phishstats: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    // Try CSV first, fall back to JSON API
    const csvUrl = ctx.feedUrl || "https://phishstats.info/phish_score.csv";
    const apiUrl = "https://phishstats.info:2096/api/phishing?_sort=-date&_limit=500";

    let entries: Array<{ url: string; score: number; ip: string }>;

    try {
      entries = await fetchCsv(ctx.env.DB, csvUrl);
      console.log(`[phishstats] CSV returned ${entries.length} entries (score>=5)`);
    } catch (csvErr) {
      console.warn(`[phishstats] CSV failed (${csvErr}), trying JSON API fallback`);
      entries = await fetchApi(ctx.env.DB, apiUrl);
      console.log(`[phishstats] API returned ${entries.length} entries`);
    }

    if (entries.length === 0) {
      return { itemsFetched: 0, itemsNew: 0, itemsDuplicate: 0, itemsError: 0 };
    }

    const items = entries.slice(0, 500);
    let itemsNew = 0, itemsDuplicate = 0, itemsError = 0;

    for (const entry of items) {
      try {
        if (await isDuplicate(ctx.env, "url", entry.url)) { itemsDuplicate++; continue; }

        const domain = extractDomain(entry.url);
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entry.ip);

        const severity = entry.score >= 9 ? "critical" as const
          : entry.score >= 7 ? "high" as const
          : "medium" as const;
        const confidence = Math.min(95, Math.round(50 + entry.score * 5));

        await insertThreat(ctx.env.DB, {
          id: threatId("phishstats", "url", entry.url),
          source_feed: "phishstats",
          threat_type: "phishing",
          malicious_url: entry.url,
          malicious_domain: domain,
          ip_address: isIp ? entry.ip : null,
          ioc_value: entry.url,
          severity,
          confidence_score: confidence,
        });
        await markSeen(ctx.env, "url", entry.url);
        itemsNew++;
      } catch { itemsError++; }
    }

    console.log(`[phishstats] done: fetched=${items.length}, new=${itemsNew}, dup=${itemsDuplicate}, err=${itemsError}`);
    return { itemsFetched: items.length, itemsNew, itemsDuplicate, itemsError };
  },
};

async function fetchCsv(db: D1Database, url: string): Promise<Array<{ url: string; score: number; ip: string }>> {
  console.log(`[phishstats] fetching CSV: ${url}`);
  const res = await diagnosticFetch(db, "phishstats", url);
  console.log(`[phishstats] CSV response: HTTP ${res.status}`);
  if (!res.ok) throw new Error(`PhishStats CSV HTTP ${res.status}`);

  const text = await res.text();
  const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const results: Array<{ url: string; score: number; ip: string }> = [];

  for (const line of lines) {
    const match = line.match(
      /^"?([^",]*)"?\s*,\s*"?(\d+(?:\.\d+)?)"?\s*,\s*"?(https?:\/\/[^"]*)"?\s*,\s*"?([^",]*)"?\s*$/,
    );
    if (!match) continue;
    const score = parseFloat(match[2]!);
    if (score < 5) continue;
    results.push({ url: match[3]!.trim(), score, ip: match[4]!.trim() });
  }
  return results;
}

async function fetchApi(db: D1Database, url: string): Promise<Array<{ url: string; score: number; ip: string }>> {
  console.log(`[phishstats] fetching API: ${url}`);
  const res = await diagnosticFetch(db, "phishstats", url);
  console.log(`[phishstats] API response: HTTP ${res.status}`);
  if (!res.ok) throw new Error(`PhishStats API HTTP ${res.status}`);

  const data = await res.json() as Array<{
    url?: string; score?: number; ip?: string;
  }>;

  return data
    .filter((d) => d.url && typeof d.score === "number" && d.score >= 5)
    .map((d) => ({ url: d.url!, score: d.score!, ip: d.ip ?? "" }));
}
