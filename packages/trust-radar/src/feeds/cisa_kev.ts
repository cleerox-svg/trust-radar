import type { FeedModule, FeedContext, FeedResult } from "./types";

/**
 * CISA Known Exploited Vulnerabilities — Daily catalog.
 * No API key required.
 * Stores the most recent 50 KEVs as intelligence entries in agent_outputs
 * so the Observer agent can reference them in daily briefings.
 * Schedule: daily at 6 AM UTC.
 */

interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
}

export const cisa_kev: FeedModule = {
  async ingest(ctx: FeedContext): Promise<FeedResult> {
    const feedUrl = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
    console.log(`[cisa_kev] fetching: ${feedUrl}`);

    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "trust-radar/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    console.log(`[cisa_kev] response: HTTP ${res.status}`);
    if (!res.ok) throw new Error(`CISA KEV HTTP ${res.status}`);

    const body = await res.json() as {
      title?: string;
      catalogVersion?: string;
      vulnerabilities?: KevEntry[];
    };

    const vulns = body.vulnerabilities ?? [];
    console.log(`[cisa_kev] parsed ${vulns.length} total vulnerabilities`);

    // Sort by dateAdded descending, take most recent 50
    const recent = vulns
      .sort((a, b) => (b.dateAdded ?? "").localeCompare(a.dateAdded ?? ""))
      .slice(0, 50);

    // Check what we already stored to avoid duplicates
    const lastDigest = await ctx.env.DB.prepare(
      "SELECT summary FROM agent_outputs WHERE agent_id = 'sentinel' AND type = 'intelligence' AND summary LIKE 'CISA KEV%' ORDER BY created_at DESC LIMIT 1"
    ).first<{ summary: string }>();

    // Only write a new entry if the newest CVE is different from last digest
    const newestCve = recent[0]?.cveID ?? "none";
    if (lastDigest?.summary?.includes(newestCve)) {
      console.log(`[cisa_kev] no new KEVs since last digest (newest: ${newestCve})`);
      return { itemsFetched: recent.length, itemsNew: 0, itemsDuplicate: recent.length, itemsError: 0 };
    }

    // Build summary of recent KEVs
    const ransomwareCount = recent.filter(v => v.knownRansomwareCampaignUse === "Known").length;
    const topEntries = recent.slice(0, 5).map(v =>
      `${v.cveID} — ${v.vendorProject} ${v.product}: ${v.vulnerabilityName}`
    ).join("\n");

    const summary = `CISA KEV Update: ${recent.length} most recent actively exploited vulnerabilities. ` +
      `${ransomwareCount} linked to ransomware campaigns. ` +
      `Most critical:\n${topEntries}`;

    const details = JSON.stringify(recent.map(v => ({
      cve: v.cveID,
      vendor: v.vendorProject,
      product: v.product,
      name: v.vulnerabilityName,
      added: v.dateAdded,
      due: v.dueDate,
      ransomware: v.knownRansomwareCampaignUse,
      description: v.shortDescription,
    })));

    await ctx.env.DB.prepare(
      "INSERT INTO agent_outputs (id, agent_id, type, summary, severity, details, created_at) VALUES (?, 'sentinel', 'intelligence', ?, 'high', ?, datetime('now'))"
    ).bind('kev_' + Date.now(), summary, details).run();

    console.log(`[cisa_kev] done: stored ${recent.length} KEVs, newest=${newestCve}`);
    return { itemsFetched: recent.length, itemsNew: 1, itemsDuplicate: 0, itemsError: 0 };
  },
};
