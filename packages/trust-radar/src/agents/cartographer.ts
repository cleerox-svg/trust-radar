/**
 * Cartographer Agent — Infrastructure mapping & provider reputation scoring.
 *
 * Runs every 6 hours.
 * Maps threat infrastructure to hosting providers and computes
 * reputation scores via Haiku AI analysis.
 *
 * Also performs:
 * - Geo enrichment of unenriched threats (merged from hosting-provider-analysis)
 * - Provider threat stats aggregation across time periods (merged from hosting-provider-analysis)
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { scoreProvider } from "../lib/haiku";
import { runEmailSecurityScan, saveEmailSecurityScan } from "../email-security";
import { createNotification } from "../lib/notifications";

export const cartographerAgent: AgentModule = {
  name: "cartographer",
  displayName: "Cartographer",
  description: "Infrastructure mapping & provider reputation scoring",
  color: "#34D399",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    let itemsProcessed = 0;
    let itemsUpdated = 0;
    let itemsCreated = 0;
    let totalTokens = 0;
    let model: string | undefined;
    const outputs: AgentOutputEntry[] = [];

    // Phase 1: Geo-enrich any threats missing location data
    try {
      const { enrichThreatsGeo } = await import("../lib/geoip");
      const enrichResult = await enrichThreatsGeo(env.DB, env.CACHE, env.IPINFO_TOKEN);
      itemsUpdated += enrichResult.enriched;
    } catch (err) {
      console.error("[cartographer] geo enrichment error:", err);
    }

    // Phase 2: Score hosting providers via Haiku AI
    const providers = await env.DB.prepare(
      `SELECT hp.id, hp.name, hp.asn, hp.active_threat_count, hp.total_threat_count,
              hp.avg_response_time, hp.trend_7d, hp.trend_30d
       FROM hosting_providers hp
       WHERE hp.total_threat_count > 0
       ORDER BY hp.active_threat_count DESC LIMIT 50`
    ).all<{
      id: string; name: string; asn: string | null;
      active_threat_count: number; total_threat_count: number;
      avg_response_time: number | null; trend_7d: number; trend_30d: number;
    }>();

    // Diagnostic: count total providers and threats with hosting_provider_id
    const totalProviders = await env.DB.prepare("SELECT COUNT(*) as n FROM hosting_providers").first<{ n: number }>();
    const threatsWithProvider = await env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE hosting_provider_id IS NOT NULL").first<{ n: number }>();
    const threatsWithoutProvider = await env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE hosting_provider_id IS NULL AND ip_address IS NOT NULL").first<{ n: number }>();
    const threatsTotal = await env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE status = 'active'").first<{ n: number }>();

    console.log(`[cartographer] Phase 2: ${providers.results.length} providers with threats (total providers=${totalProviders?.n ?? 0}, threats with provider=${threatsWithProvider?.n ?? 0}, threats without provider but with IP=${threatsWithoutProvider?.n ?? 0}, total active threats=${threatsTotal?.n ?? 0})`);

    let haikuSuccessCount = 0;
    let haikuFailCount = 0;

    for (const provider of providers.results) {
      itemsProcessed++;

      // Get threat type breakdown for this provider
      const typeBreakdown = await env.DB.prepare(
        `SELECT threat_type, COUNT(*) as count
         FROM threats WHERE hosting_provider_id = ?
         GROUP BY threat_type`
      ).bind(provider.id).all<{ threat_type: string; count: number }>();

      const threatTypes: Record<string, number> = {};
      for (const row of typeBreakdown.results) {
        threatTypes[row.threat_type] = row.count;
      }

      // Try Haiku scoring
      const result = await scoreProvider(env, {
        name: provider.name,
        asn: provider.asn,
        active_threats: provider.active_threat_count,
        total_threats: provider.total_threat_count,
        avg_response_time: provider.avg_response_time,
        threat_types: threatTypes,
        trend_7d: provider.trend_7d,
        trend_30d: provider.trend_30d,
      });

      let reputationScore: number;

      if (result.success && result.data) {
        reputationScore = result.data.reputation_score;
        if (result.tokens_used) totalTokens += result.tokens_used;
        if (result.model) model = result.model;
        haikuSuccessCount++;

        outputs.push({
          type: "score",
          summary: `${provider.name}: reputation ${reputationScore}/100 — ${result.data.reasoning}`,
          severity: reputationScore < 30 ? "critical" : reputationScore < 50 ? "high" : reputationScore < 70 ? "medium" : "info",
          details: {
            provider: provider.name,
            score: reputationScore,
            risk_factors: result.data.risk_factors,
            response_assessment: result.data.response_assessment,
          },
          relatedProviderIds: [provider.id],
        });
      } else {
        haikuFailCount++;
        console.log(`[cartographer] Haiku scoring failed for "${provider.name}": ${result.error ?? 'no data returned'}`);
        // Fallback: simple heuristic scoring
        reputationScore = computeHeuristicScore(
          provider.active_threat_count,
          provider.total_threat_count,
          provider.avg_response_time,
        );
      }

      try {
        await env.DB.prepare(
          "UPDATE hosting_providers SET reputation_score = ? WHERE id = ?"
        ).bind(reputationScore, provider.id).run();
        itemsUpdated++;
      } catch (err) {
        console.error(`[cartographer] update failed for ${provider.id}:`, err);
      }
    }

    // Phase 3: Email security posture scans — 50 brands per cycle, oldest first
    let emailScanned = 0;
    let emailErrors = 0;
    try {
      // Backfill canonical_domain from name for Tranco imports where domain is missing
      await env.DB.prepare(`
        UPDATE brands SET canonical_domain = LOWER(name)
        WHERE source = 'tranco_import' AND (canonical_domain IS NULL OR canonical_domain = '')
      `).run();

      // Debug stats
      const brandStats = await env.DB.prepare(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN canonical_domain IS NOT NULL AND canonical_domain != '' THEN 1 ELSE 0 END) as has_domain,
          SUM(CASE WHEN email_security_scanned_at IS NOT NULL THEN 1 ELSE 0 END) as scanned
        FROM brands WHERE monitoring_status = 'active'
      `).first<{ total: number; has_domain: number; scanned: number }>();
      console.log('[Cartographer] Email security brand stats:', JSON.stringify(brandStats));

      // Include brands without canonical_domain by falling back to name
      const brandsToScan = await env.DB.prepare(`
        SELECT b.id, COALESCE(b.canonical_domain, LOWER(b.name)) AS domain, b.email_security_grade AS existing_grade
        FROM brands b
        WHERE (b.canonical_domain IS NOT NULL OR b.name IS NOT NULL)
          AND (b.email_security_scanned_at IS NULL
               OR b.email_security_scanned_at < datetime('now', '-7 days'))
        ORDER BY b.email_security_scanned_at ASC NULLS FIRST
        LIMIT 50
      `).all<{ id: number; domain: string; existing_grade: string | null }>();

      for (const brand of brandsToScan.results) {
        try {
          const result = await runEmailSecurityScan(brand.domain);
          await saveEmailSecurityScan(env.DB, brand.id, result);
          await env.DB.prepare(`
            UPDATE brands
            SET email_security_score = ?, email_security_grade = ?, email_security_scanned_at = datetime('now')
            WHERE id = ?
          `).bind(result.score, result.grade, brand.id).run();

          // Detect grade changes and notify
          if (brand.existing_grade && brand.existing_grade !== result.grade) {
            const dropped = gradeOrder(result.grade) > gradeOrder(brand.existing_grade);
            const brandName = await env.DB.prepare('SELECT name FROM brands WHERE id = ?')
              .bind(brand.id).first<{ name: string }>();
            try {
              await createNotification(env.DB, {
                type: 'email_security_change',
                title: `${brandName?.name ?? brand.domain} email security ${dropped ? 'degraded' : 'improved'}`,
                message: `Grade changed from ${brand.existing_grade} to ${result.grade}`,
                severity: dropped ? 'high' : 'info',
              });
            } catch (notifErr) {
              console.error('[cartographer] notification error:', notifErr);
            }
          }

          emailScanned++;
          itemsUpdated++;
        } catch (e) {
          console.error(`[cartographer] email security scan failed for ${brand.domain}:`, e);
          emailErrors++;
        }
      }

      outputs.push({
        type: "diagnostic",
        summary: `Email security: ${emailScanned} brands scanned, ${emailErrors} errors`,
        severity: emailErrors > 5 ? "medium" : "info",
        details: { email_scanned: emailScanned, email_errors: emailErrors },
      });
    } catch (e) {
      console.error("[cartographer] email security phase error:", e);
    }

    // Phase 4: Geo-enrich DMARC source IPs — up to 10 per cycle
    let dmarcGeoEnriched = 0;
    try {
      const unenrichedIps = await env.DB.prepare(`
        SELECT DISTINCT source_ip FROM dmarc_report_records
        WHERE country_code IS NULL AND source_ip IS NOT NULL
        LIMIT 10
      `).all<{ source_ip: string }>();

      if (unenrichedIps.results.length > 0) {
        const { batchGeoLookup, isPrivateIP } = await import("../lib/geoip");
        const ips = unenrichedIps.results.map(r => r.source_ip).filter(ip => !isPrivateIP(ip));
        const { results: geoMap } = await batchGeoLookup(ips, env.CACHE, env.IPINFO_TOKEN);

        for (const [ip, geo] of geoMap.entries()) {
          await env.DB.prepare(`
            UPDATE dmarc_report_records
            SET country_code = ?, org = ?, asn = ?, lat = ?, lng = ?
            WHERE source_ip = ? AND country_code IS NULL
          `).bind(geo.countryCode, geo.org, geo.as, geo.lat, geo.lng, ip).run();
          dmarcGeoEnriched++;
        }

        // Mark private/bogon IPs so they exit the queue
        for (const { source_ip } of unenrichedIps.results) {
          const { isPrivateIP: priv } = await import("../lib/geoip");
          if (priv(source_ip)) {
            await env.DB.prepare(
              `UPDATE dmarc_report_records SET country_code = 'PRIV' WHERE source_ip = ? AND country_code IS NULL`
            ).bind(source_ip).run();
          }
        }
      }
    } catch (e) {
      console.error("[cartographer] DMARC geo enrichment error:", e);
    }

    // Phase 5: Aggregate provider threat stats across time periods
    const statsCreated = await aggregateProviderStats(env);
    itemsCreated += statsCreated;

    // Emit diagnostic output so cartographer never shows 0 outputs silently
    outputs.push({
      type: "diagnostic",
      summary: `Cartographer: ${providers.results.length} providers scored (${haikuSuccessCount} AI, ${haikuFailCount} heuristic), ${statsCreated} stat entries, ${emailScanned} email security scans, ${dmarcGeoEnriched} DMARC IPs geo-enriched, ${threatsWithProvider?.n ?? 0}/${threatsTotal?.n ?? 0} threats have provider`,
      severity: providers.results.length === 0 ? "medium" : "info",
      details: {
        providers_with_threats: providers.results.length,
        total_providers: totalProviders?.n ?? 0,
        haiku_scored: haikuSuccessCount,
        heuristic_scored: haikuFailCount,
        stats_entries: statsCreated,
        email_security_scanned: emailScanned,
        email_security_errors: emailErrors,
        dmarc_geo_enriched: dmarcGeoEnriched,
        threats_total_active: threatsTotal?.n ?? 0,
        threats_with_provider: threatsWithProvider?.n ?? 0,
        threats_without_provider_but_with_ip: threatsWithoutProvider?.n ?? 0,
      },
    });

    return {
      itemsProcessed,
      itemsCreated,
      itemsUpdated,
      output: { providersScored: providers.results.length, statsEntries: statsCreated },
      model,
      tokensUsed: totalTokens,
      agentOutputs: outputs,
    };
  },
};

function computeHeuristicScore(
  activeThreats: number,
  totalThreats: number,
  avgResponseTime: number | null,
): number {
  let score = 100;

  // Penalize for active threats
  if (activeThreats > 100) score -= 40;
  else if (activeThreats > 50) score -= 30;
  else if (activeThreats > 10) score -= 20;
  else if (activeThreats > 0) score -= 10;

  // Penalize for slow response
  if (avgResponseTime !== null) {
    if (avgResponseTime > 168) score -= 20;      // > 1 week
    else if (avgResponseTime > 72) score -= 15;   // > 3 days
    else if (avgResponseTime > 24) score -= 10;   // > 1 day
  }

  // Penalize for high total volume
  if (totalThreats > 1000) score -= 15;
  else if (totalThreats > 100) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function gradeOrder(g: string): number {
  return ({ 'A+': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 } as Record<string, number>)[g] ?? 6;
}

/**
 * Aggregate provider threat stats across time periods.
 * Merged from the hosting-provider-analysis agent — computes stats for
 * today, 7d, 30d, and all-time, writing to provider_threat_stats table.
 */
async function aggregateProviderStats(env: { DB: D1Database }): Promise<number> {
  const db = env.DB;
  let totalEntries = 0;

  const periods = [
    { key: "today", where: "created_at >= date('now', 'start of day')", priorWhere: "created_at >= date('now', '-1 day', 'start of day') AND created_at < date('now', 'start of day')" },
    { key: "7d", where: "created_at >= date('now', '-7 days')", priorWhere: "created_at >= date('now', '-14 days') AND created_at < date('now', '-7 days')" },
    { key: "30d", where: "created_at >= date('now', '-30 days')", priorWhere: "created_at >= date('now', '-60 days') AND created_at < date('now', '-30 days')" },
    { key: "all", where: "1=1", priorWhere: null as string | null },
  ];

  for (const period of periods) {
    const providerRows = await db.prepare(`
      SELECT
        hosting_provider_id,
        COUNT(*) as threat_count,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN threat_type = 'phishing' THEN 1 ELSE 0 END) as phishing_count,
        SUM(CASE WHEN threat_type = 'malware_distribution' THEN 1 ELSE 0 END) as malware_count,
        GROUP_CONCAT(DISTINCT country_code) as countries
      FROM threats
      WHERE hosting_provider_id IS NOT NULL AND ${period.where}
      GROUP BY hosting_provider_id
      ORDER BY threat_count DESC
      LIMIT 50
    `).all<{
      hosting_provider_id: string; threat_count: number;
      critical_count: number; high_count: number;
      phishing_count: number; malware_count: number;
      countries: string | null;
    }>();

    // Get prior period for trend calculation
    const priorMap = new Map<string, number>();
    if (period.priorWhere) {
      const priorRows = await db.prepare(`
        SELECT hosting_provider_id, COUNT(*) as count
        FROM threats
        WHERE hosting_provider_id IS NOT NULL AND ${period.priorWhere}
        GROUP BY hosting_provider_id
      `).all<{ hosting_provider_id: string; count: number }>();
      for (const r of priorRows.results) {
        priorMap.set(r.hosting_provider_id, r.count);
      }
    }

    for (const row of providerRows.results) {
      const priorCount = priorMap.get(row.hosting_provider_id) ?? 0;
      let trendDirection = "stable";
      let trendPct = 0;

      if (priorCount > 0 && period.priorWhere) {
        trendPct = ((row.threat_count - priorCount) / priorCount) * 100;
        trendDirection = trendPct > 10 ? "up" : trendPct < -10 ? "down" : "stable";
      } else if (row.threat_count > 0 && priorCount === 0 && period.priorWhere) {
        trendDirection = "up";
        trendPct = 100;
      }

      const countryCodes = (row.countries || "").split(",").filter(Boolean);
      const topCountries = countryCodes.slice(0, 5).map(c => ({ country_code: c, count: 1 }));

      // Resolve provider name from hosting_providers table
      const hp = await db.prepare("SELECT name FROM hosting_providers WHERE id = ?")
        .bind(row.hosting_provider_id).first<{ name: string }>();
      const providerName = hp?.name ?? row.hosting_provider_id;

      const id = crypto.randomUUID();
      try {
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
          id, providerName, period.key,
          row.threat_count, row.critical_count, row.high_count,
          row.phishing_count, row.malware_count,
          JSON.stringify(topCountries), trendDirection, Math.round(trendPct * 10) / 10,
        ).run();
        totalEntries++;
      } catch (err) {
        console.error(`[cartographer] stats upsert failed for ${providerName}/${period.key}:`, err);
      }
    }
  }

  return totalEntries;
}
