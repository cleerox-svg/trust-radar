/**
 * Hosting Provider Analysis Agent
 *
 * Aggregates threat data by hosting provider/ISP to identify:
 * - Worst offender providers (today, 7d, 30d)
 * - Trending providers (increasing/decreasing threat activity)
 * - Provider pivot detection (attackers moving between providers)
 *
 * Runs after geo enrichment and on schedule.
 */

import type { AgentModule, AgentContext, AgentResult } from "../lib/agentRunner";

export const hostingProviderAnalysisAgent: AgentModule = {
  name: "hosting-provider-analysis" as any,
  displayName: "Hosting Provider Analysis",
  description: "Track hosting providers used by threat actors, identify worst offenders and pivot patterns",
  color: "#F97316",
  trigger: "event",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;
    const db = env.DB;
    let itemsProcessed = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;

    // First, enrich any threats missing hosting provider data
    const { enrichThreatsGeo } = await import("../lib/geoip");
    const enrichResult = await enrichThreatsGeo(db);
    itemsUpdated += enrichResult.enriched;

    // Compute provider stats for each period
    const periods = [
      { key: "today", where: "created_at >= date('now', 'start of day')", priorWhere: "created_at >= date('now', '-1 day', 'start of day') AND created_at < date('now', 'start of day')" },
      { key: "7d", where: "created_at >= date('now', '-7 days')", priorWhere: "created_at >= date('now', '-14 days') AND created_at < date('now', '-7 days')" },
      { key: "30d", where: "created_at >= date('now', '-30 days')", priorWhere: "created_at >= date('now', '-60 days') AND created_at < date('now', '-30 days')" },
      { key: "all", where: "1=1", priorWhere: null },
    ];

    for (const period of periods) {
      const providerRows = await db.prepare(`
        SELECT
          hosting_provider,
          COUNT(*) as threat_count,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
          SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
          SUM(CASE WHEN type = 'phishing' THEN 1 ELSE 0 END) as phishing_count,
          SUM(CASE WHEN type = 'malware' THEN 1 ELSE 0 END) as malware_count,
          GROUP_CONCAT(DISTINCT country_code) as countries
        FROM threats
        WHERE hosting_provider IS NOT NULL AND ${period.where}
        GROUP BY hosting_provider
        ORDER BY threat_count DESC
        LIMIT 50
      `).all<{
        hosting_provider: string; threat_count: number;
        critical_count: number; high_count: number;
        phishing_count: number; malware_count: number;
        countries: string | null;
      }>();

      // Get prior period for trend calculation
      let priorMap = new Map<string, number>();
      if (period.priorWhere) {
        const priorRows = await db.prepare(`
          SELECT hosting_provider, COUNT(*) as count
          FROM threats
          WHERE hosting_provider IS NOT NULL AND ${period.priorWhere}
          GROUP BY hosting_provider
        `).all<{ hosting_provider: string; count: number }>();
        for (const r of priorRows.results) {
          priorMap.set(r.hosting_provider, r.count);
        }
      }

      for (const row of providerRows.results) {
        const priorCount = priorMap.get(row.hosting_provider) ?? 0;
        let trendDirection = "stable";
        let trendPct = 0;

        if (priorCount > 0 && period.priorWhere) {
          trendPct = ((row.threat_count - priorCount) / priorCount) * 100;
          trendDirection = trendPct > 10 ? "up" : trendPct < -10 ? "down" : "stable";
        } else if (row.threat_count > 0 && priorCount === 0 && period.priorWhere) {
          trendDirection = "up";
          trendPct = 100;
        }

        // Build top countries array
        const countryCodes = (row.countries || "").split(",").filter(Boolean);
        const topCountries = countryCodes.slice(0, 5).map(c => ({ country_code: c, count: 1 }));

        const id = crypto.randomUUID();
        // Upsert by provider + period
        await db.prepare(`
          INSERT INTO provider_threat_stats
            (id, provider_name, period, threat_count, critical_count, high_count, phishing_count, malware_count, top_countries, trend_direction, trend_pct, computed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(provider_name, period) DO UPDATE SET
            threat_count = excluded.threat_count,
            critical_count = excluded.critical_count,
            high_count = excluded.high_count,
            phishing_count = excluded.phishing_count,
            malware_count = excluded.malware_count,
            top_countries = excluded.top_countries,
            trend_direction = excluded.trend_direction,
            trend_pct = excluded.trend_pct,
            computed_at = excluded.computed_at
        `).bind(
          id, row.hosting_provider, period.key,
          row.threat_count, row.critical_count, row.high_count,
          row.phishing_count, row.malware_count,
          JSON.stringify(topCountries), trendDirection, Math.round(trendPct * 10) / 10,
        ).run();

        itemsProcessed++;
        itemsCreated++;
      }
    }

    return {
      itemsProcessed,
      itemsCreated,
      itemsUpdated,
      output: {
        enriched: enrichResult.enriched,
        periodsComputed: periods.length,
        message: `Analyzed ${itemsProcessed} provider entries across ${periods.length} time periods`,
      },
    };
  },
};
