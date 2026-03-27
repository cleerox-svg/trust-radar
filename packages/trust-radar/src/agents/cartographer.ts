/**
 * Cartographer Agent — Infrastructure mapping & provider reputation scoring.
 *
 * Runs every 15 minutes (clearing enrichment backlog) and on Sentinel trigger.
 * Maps threat infrastructure to hosting providers and computes
 * reputation scores via Haiku AI analysis.
 *
 * Enrichment pipeline:
 * - ip-api.com batch (100 IPs/req, 45 req/min free) → lat/lng/ASN/country
 * - RDAP → registrar + registration date for domains
 * - hosting_providers table upsert from ASN data
 * - agent_events emitted after each enrichment batch
 *
 * Also performs:
 * - Geo enrichment of unenriched threats (ipinfo.io fallback)
 * - Provider threat stats aggregation across time periods
 * - Email security posture scans
 * - DMARC source IP geo enrichment
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { scoreProvider } from "../lib/haiku";
import { runEmailSecurityScan, saveEmailSecurityScan } from "../email-security";
import { createNotification } from "../lib/notifications";

// ─── ip-api.com batch types ───────────────────────────────────────

interface IpApiResult {
  status: string;
  lat: number;
  lon: number;
  as: string;
  country: string;
  countryCode: string;
  isp: string;
  org: string;
}

interface IpGeoResult {
  status: string;
  lat: number;
  lon: number;
  as: string;
  country: string;
  countryCode: string;
  isp: string;
  org: string;
}

// ─── Utility ──────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── ip-api.com batch enrichment ──────────────────────────────────

async function enrichIpBatch(ips: string[]): Promise<Map<string, IpGeoResult>> {
  const chunks = chunkArray(ips.filter(Boolean), 100);
  const results = new Map<string, IpGeoResult>();

  for (const chunk of chunks) {
    try {
      const res = await fetch('http://ip-api.com/batch?fields=status,lat,lon,as,country,countryCode,isp,org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map(ip => ({ query: ip }))),
      });
      if (!res.ok) continue;
      const data = await res.json() as IpGeoResult[];
      chunk.forEach((ip, i) => {
        if (data[i]?.status === 'success') results.set(ip, data[i]);
      });
      // Respect 45 req/min rate limit
      if (chunks.length > 1) await sleep(1400);
    } catch (err) {
      console.error('[cartographer] ip-api batch error:', err);
    }
  }
  return results;
}

// ─── RDAP registrar lookup ────────────────────────────────────────

async function lookupRegistrar(domain: string): Promise<{ registrar: string | null; registration_date: string | null }> {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { registrar: null, registration_date: null };
    const data = await res.json() as {
      entities?: Array<{ roles?: string[]; vcardArray?: [string, Array<[string, unknown, string, string]>] }>;
      events?: Array<{ eventAction?: string; eventDate?: string }>;
    };
    const registrar = data.entities?.find((e) => e.roles?.includes('registrar'))?.vcardArray?.[1]
      ?.find((v) => v[0] === 'fn')?.[3] ?? null;
    const registration_date = data.events?.find((e) => e.eventAction === 'registration')?.eventDate ?? null;
    return { registrar, registration_date };
  } catch {
    return { registrar: null, registration_date: null };
  }
}

// ─── Agent Definition ─────────────────────────────────────────────

export const cartographerAgent: AgentModule = {
  name: "cartographer",
  displayName: "Navigator",
  description: "Infrastructure mapping, geo enrichment & provider reputation scoring",
  color: "#5A80A8",
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

    // ─── Phase 0: ip-api.com batch enrichment for unenriched threats ───
    let batchEnriched = 0;
    let rdapEnriched = 0;
    try {
      const unenriched = await env.DB.prepare(`
        SELECT id, ip_address, malicious_domain, malicious_url, hosting_provider_id
        FROM threats
        WHERE enriched_at IS NULL
          AND (ip_address IS NOT NULL OR malicious_domain IS NOT NULL)
        LIMIT 100
      `).all<{
        id: string;
        ip_address: string | null;
        malicious_domain: string | null;
        malicious_url: string | null;
        hosting_provider_id: string | null;
      }>();

      if (unenriched.results.length > 0) {
        // Batch enrich IPs via ip-api.com
        const ips = unenriched.results
          .map(t => t.ip_address)
          .filter((ip): ip is string => ip != null && ip !== '');
        const geoResults = ips.length > 0 ? await enrichIpBatch([...new Set(ips)]) : new Map<string, IpGeoResult>();

        // Update each threat
        for (const threat of unenriched.results) {
          const geo = threat.ip_address ? geoResults.get(threat.ip_address) : null;

          // Match or create hosting provider from ASN
          let providerId = threat.hosting_provider_id;
          if (!providerId && geo?.as) {
            const asn = geo.as.split(' ')[0]; // "AS4837"
            const providerName = geo.as.replace(/^AS\d+\s*/, '').trim() || geo.isp || geo.org;

            if (providerName) {
              // Upsert hosting provider by ASN
              const hpId = `hp_${providerName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
              try {
                await env.DB.prepare(`
                  INSERT INTO hosting_providers (id, name, asn, country, last_enriched)
                  VALUES (?, ?, ?, ?, datetime('now'))
                  ON CONFLICT(id) DO UPDATE SET
                    last_enriched = datetime('now'),
                    asn = COALESCE(hosting_providers.asn, excluded.asn),
                    country = COALESCE(hosting_providers.country, excluded.country)
                `).bind(hpId, providerName, asn, geo.countryCode).run();
                providerId = hpId;
              } catch (err) {
                console.error('[cartographer] provider upsert error:', err);
              }
            }
          }

          // RDAP for domain (throttled — max 10 per batch to avoid overload)
          let registrar: string | null = null;
          let registration_date: string | null = null;
          if (threat.malicious_domain && rdapEnriched < 10) {
            const rdap = await lookupRegistrar(threat.malicious_domain);
            registrar = rdap.registrar;
            registration_date = rdap.registration_date;
            if (registrar || registration_date) rdapEnriched++;
          }

          // Update threat with enriched data
          try {
            await env.DB.prepare(`
              UPDATE threats SET
                lat = COALESCE(lat, ?),
                lng = COALESCE(lng, ?),
                country_code = COALESCE(country_code, ?),
                asn = COALESCE(asn, ?),
                hosting_provider_id = COALESCE(hosting_provider_id, ?),
                registrar = COALESCE(registrar, ?),
                registration_date = COALESCE(registration_date, ?),
                enriched_at = datetime('now')
              WHERE id = ?
            `).bind(
              geo?.lat ?? null, geo?.lon ?? null, geo?.countryCode ?? null,
              geo?.as?.split(' ')[0] ?? null, providerId,
              registrar, registration_date, threat.id
            ).run();
            batchEnriched++;
            itemsUpdated++;
          } catch (err) {
            console.error(`[cartographer] threat update error for ${threat.id}:`, err);
          }
        }

        // Emit agent_event after enrichment batch
        try {
          await env.DB.prepare(`
            INSERT INTO agent_events (id, event_type, source_agent, payload_json, priority)
            VALUES (?, 'threats_enriched', 'cartographer', ?, 3)
          `).bind(
            crypto.randomUUID(),
            JSON.stringify({ count: unenriched.results.length, enriched: batchEnriched, batch_complete: true })
          ).run();
        } catch (err) {
          console.error('[cartographer] agent_event emit error:', err);
        }

        outputs.push({
          type: "diagnostic",
          summary: `ip-api.com batch: ${batchEnriched}/${unenriched.results.length} threats enriched, ${rdapEnriched} RDAP lookups`,
          severity: "info",
          details: { batch_enriched: batchEnriched, rdap_enriched: rdapEnriched, total_unenriched: unenriched.results.length },
        });
      }
    } catch (err) {
      console.error("[cartographer] ip-api batch enrichment error:", err);
    }

    // ─── Phase 1: ipinfo.io fallback for threats still missing country_code ───
    try {
      const { enrichThreatsGeo } = await import("../lib/geoip");
      const enrichResult = await enrichThreatsGeo(env.DB, env.CACHE, env.IPINFO_TOKEN);
      itemsUpdated += enrichResult.enriched;
    } catch (err) {
      console.error("[cartographer] geo enrichment error:", err);
    }

    // ─── Phase 2: Score hosting providers via Haiku AI ───
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

    let haikuSuccessCount = 0;
    let haikuFailCount = 0;

    // Batch: threat type breakdowns for all providers
    const providerIds = providers.results.map(p => p.id);
    const allTypeBreakdowns = providerIds.length > 0 ? await env.DB.prepare(`
      SELECT hosting_provider_id, threat_type, COUNT(*) as count
      FROM threats
      WHERE hosting_provider_id IN (${providerIds.map(() => '?').join(',')})
      GROUP BY hosting_provider_id, threat_type
    `).bind(...providerIds).all<{ hosting_provider_id: string; threat_type: string; count: number }>() : { results: [] as { hosting_provider_id: string; threat_type: string; count: number }[] };

    const breakdownsByProvider = new Map<string, Record<string, number>>();
    for (const row of allTypeBreakdowns.results) {
      const existing = breakdownsByProvider.get(row.hosting_provider_id) ?? {};
      existing[row.threat_type] = row.count;
      breakdownsByProvider.set(row.hosting_provider_id, existing);
    }

    // Batch: campaign counts for all providers
    const allCampaignStats = providerIds.length > 0 ? await env.DB.prepare(`
      SELECT hosting_provider_id, COUNT(DISTINCT campaign_id) as campaign_count
      FROM threats
      WHERE hosting_provider_id IN (${providerIds.map(() => '?').join(',')})
        AND campaign_id IS NOT NULL
      GROUP BY hosting_provider_id
    `).bind(...providerIds).all<{ hosting_provider_id: string; campaign_count: number }>() : { results: [] as { hosting_provider_id: string; campaign_count: number }[] };

    const campaignCountByProvider = new Map<string, number>();
    for (const row of allCampaignStats.results) {
      campaignCountByProvider.set(row.hosting_provider_id, row.campaign_count);
    }

    for (const provider of providers.results) {
      itemsProcessed++;

      const threatTypes = breakdownsByProvider.get(provider.id) ?? {};
      const campaignCount = campaignCountByProvider.get(provider.id) ?? 0;
      const repeatOffender = campaignCount >= 3;

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
          summary: `${provider.name}: reputation ${reputationScore}/100${repeatOffender ? ' [REPEAT OFFENDER]' : ''} — ${result.data.reasoning}`,
          severity: reputationScore < 30 ? "critical" : reputationScore < 50 ? "high" : reputationScore < 70 ? "medium" : "info",
          details: {
            provider: provider.name,
            score: reputationScore,
            risk_factors: result.data.risk_factors,
            response_assessment: result.data.response_assessment,
            campaign_count: campaignCount,
            repeat_offender: repeatOffender,
          },
          relatedProviderIds: [provider.id],
        });
      } else {
        haikuFailCount++;
        // Fallback: simple heuristic scoring
        reputationScore = computeHeuristicScore(
          provider.active_threat_count,
          provider.total_threat_count,
          provider.avg_response_time,
        );
        // Penalize repeat offenders (3+ campaigns)
        if (repeatOffender) reputationScore = Math.max(0, reputationScore - 15);
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

    // ─── Phase 3: Email security posture scans — 50 brands per cycle, oldest first ───
    let emailScanned = 0;
    let emailErrors = 0;
    try {
      // Backfill canonical_domain from name for Tranco imports where domain is missing
      await env.DB.prepare(`
        UPDATE brands SET canonical_domain = LOWER(name)
        WHERE source = 'tranco_import' AND (canonical_domain IS NULL OR canonical_domain = '')
      `).run();

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

    // ─── Phase 4: Geo-enrich DMARC source IPs — up to 10 per cycle ───
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
          if (isPrivateIP(source_ip)) {
            await env.DB.prepare(
              `UPDATE dmarc_report_records SET country_code = 'PRIV' WHERE source_ip = ? AND country_code IS NULL`
            ).bind(source_ip).run();
          }
        }
      }
    } catch (e) {
      console.error("[cartographer] DMARC geo enrichment error:", e);
    }

    // ─── Phase 5: Aggregate provider threat stats across time periods ───
    const statsCreated = await aggregateProviderStats(env);
    itemsCreated += statsCreated;

    // Emit diagnostic output so cartographer never shows 0 outputs silently
    outputs.push({
      type: "diagnostic",
      summary: `Cartographer: ${batchEnriched} ip-api enriched, ${providers.results.length} providers scored (${haikuSuccessCount} AI, ${haikuFailCount} heuristic), ${statsCreated} stat entries, ${emailScanned} email security scans, ${dmarcGeoEnriched} DMARC IPs geo-enriched, ${threatsWithProvider?.n ?? 0}/${threatsTotal?.n ?? 0} threats have provider`,
      severity: providers.results.length === 0 ? "medium" : "info",
      details: {
        ip_api_enriched: batchEnriched,
        rdap_enriched: rdapEnriched,
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
      output: { providersScored: providers.results.length, statsEntries: statsCreated, ipApiBatchEnriched: batchEnriched },
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

  // Pre-load provider names to avoid N+1 in the stats loop
  const providerNameRows = await db.prepare(
    "SELECT id, name FROM hosting_providers"
  ).all<{ id: string; name: string }>();
  const providerNameMap = new Map<string, string>();
  for (const r of providerNameRows.results) {
    providerNameMap.set(r.id, r.name);
  }

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

      const providerName = providerNameMap.get(row.hosting_provider_id) ?? row.hosting_provider_id;

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
