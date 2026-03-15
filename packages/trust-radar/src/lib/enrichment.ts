/**
 * Enrichment Pipeline Orchestrator — Runs after feed ingestion.
 *
 * Pipeline stages:
 * 1. DNS resolution: domain → IP (for threats missing ip_address)
 * 2. GeoIP + ASN: IP → country, ASN, hosting provider
 * 3. WHOIS/RDAP: domain → registrar (for high-severity threats)
 * 4. Brand auto-detection: domain → target_brand_id
 * 5. Provider count sync: update hosting_providers.active_threat_count
 *
 * Designed to be idempotent — can safely re-run without duplicating work.
 */

import type { Env } from "../types";
import { batchResolve } from "./dns";
import { batchGeoLookup, normalizeProvider, upsertHostingProvider } from "./geoip";
import { batchRDAPLookup } from "./whois";
import { enrichBrands } from "./brandDetect";

export interface EnrichmentResult {
  dnsResolved: number;
  geoEnriched: number;
  whoisEnriched: number;
  brandsMatched: number;
  providersUpserted: number;
  providerCountsUpdated: number;
}

/**
 * Run the full enrichment pipeline on unenriched threats.
 */
export async function runEnrichmentPipeline(env: Env): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    dnsResolved: 0,
    geoEnriched: 0,
    whoisEnriched: 0,
    brandsMatched: 0,
    providersUpserted: 0,
    providerCountsUpdated: 0,
  };

  console.log("[enrich] === PIPELINE STARTING ===");

  // Count what needs enrichment
  const counts = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM threats WHERE malicious_domain IS NOT NULL AND ip_address IS NULL) as needs_dns,
      (SELECT COUNT(*) FROM threats WHERE ip_address IS NOT NULL AND (country_code IS NULL OR asn IS NULL OR hosting_provider_id IS NULL)) as needs_geo,
      (SELECT COUNT(*) FROM threats WHERE malicious_domain IS NOT NULL AND registrar IS NULL AND severity IN ('critical', 'high')) as needs_whois,
      (SELECT COUNT(*) FROM threats WHERE target_brand_id IS NULL AND malicious_domain IS NOT NULL) as needs_brand,
      (SELECT COUNT(*) FROM threats) as total
  `).first<{ needs_dns: number; needs_geo: number; needs_whois: number; needs_brand: number; total: number }>();

  console.log(`[enrich] Threats needing enrichment: dns=${counts?.needs_dns}, geo=${counts?.needs_geo}, whois=${counts?.needs_whois}, brand=${counts?.needs_brand} (total=${counts?.total})`);

  // ─── Stage 1: DNS Resolution ──────────────────────────────────
  // Resolve threats that have a domain but no IP
  const needsDns = await env.DB.prepare(
    `SELECT id, malicious_domain FROM threats
     WHERE malicious_domain IS NOT NULL AND ip_address IS NULL
     LIMIT 200`,
  ).all<{ id: string; malicious_domain: string }>();

  console.log(`[enrich] Stage 1 DNS: ${needsDns.results.length} threats to resolve`);

  if (needsDns.results.length > 0) {
    const domains = needsDns.results.map((r) => r.malicious_domain);
    try {
      const dnsMap = await batchResolve(domains);
      console.log(`[enrich] DNS resolved: ${dnsMap.size}/${domains.length} domains got IPs`);

      for (const row of needsDns.results) {
        const ip = dnsMap.get(row.malicious_domain);
        if (!ip) continue;
        try {
          await env.DB.prepare(
            "UPDATE threats SET ip_address = ? WHERE id = ? AND ip_address IS NULL",
          ).bind(ip, row.id).run();
          result.dnsResolved++;
        } catch (err) {
          console.error(`[enrich] DNS update failed for ${row.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[enrich] Stage 1 DNS batch resolve failed:", err);
    }
  }

  console.log(`[enrich] Stage 1 complete: ${result.dnsResolved} IPs resolved`);

  // ─── Stage 2: GeoIP + ASN + Hosting Provider ─────────────────
  // Enrich threats that have IP but missing geo/ASN/provider
  const needsGeo = await env.DB.prepare(
    `SELECT id, ip_address FROM threats
     WHERE ip_address IS NOT NULL
       AND (country_code IS NULL OR asn IS NULL OR hosting_provider_id IS NULL)
     LIMIT 500`,
  ).all<{ id: string; ip_address: string }>();

  console.log(`[enrich] Stage 2 GeoIP: ${needsGeo.results.length} threats to enrich`);

  if (needsGeo.results.length > 0) {
    const ips = needsGeo.results.map((r) => r.ip_address);

    // ─── GEO DIAGNOSTIC: probe first IP and write result to agent_outputs ───
    try {
      const probeIp = ips[0]!;
      const probeRes = await fetch(`https://ipinfo.io/${probeIp}/json`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      const probeBody = await probeRes.text();
      const diagSummary = `geo_probe: ip=${probeIp} HTTP ${probeRes.status} body=${probeBody.slice(0, 200)}`;
      await env.DB.prepare(
        `INSERT INTO agent_outputs (id, agent_id, type, summary, severity, details, created_at)
         VALUES (?, 'enrichment', 'diagnostic', ?, 'info', ?, datetime('now'))`,
      ).bind(
        crypto.randomUUID(),
        diagSummary,
        JSON.stringify({ ip: probeIp, http_status: probeRes.status, body_preview: probeBody.slice(0, 500), provider: "ipinfo.io", ips_to_enrich: ips.length }),
      ).run();
    } catch (diagErr) {
      console.error("[enrich] geo diagnostic write failed:", diagErr);
    }

    try {
      const geoMap = await batchGeoLookup(ips);
      console.log(`[enrich] GeoIP resolved: ${geoMap.size}/${ips.length} IPs got location data`);

      if (geoMap.size === 0 && ips.length > 0) {
        console.error("[enrich] WARNING: GeoIP returned 0 results — ipinfo.io may be rate limiting or blocking");
      }

      for (const row of needsGeo.results) {
        const geo = geoMap.get(row.ip_address);
        if (!geo) continue;

        try {
          // Determine hosting provider and upsert into hosting_providers table
          const providerName = normalizeProvider(geo.isp, geo.org);
          let providerId: string | null = null;

          if (providerName) {
            providerId = await upsertHostingProvider(env.DB, providerName, geo.as, geo.countryCode);
            if (providerId) result.providersUpserted++;
          }

          await env.DB.prepare(
            `UPDATE threats SET
               country_code = COALESCE(country_code, ?),
               asn = COALESCE(asn, ?),
               lat = COALESCE(lat, ?),
               lng = COALESCE(lng, ?),
               hosting_provider_id = COALESCE(hosting_provider_id, ?)
             WHERE id = ?`,
          ).bind(
            geo.countryCode, geo.as, geo.lat, geo.lng, providerId, row.id,
          ).run();
          result.geoEnriched++;
        } catch (err) {
          console.error(`[enrich] GeoIP update failed for ${row.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[enrich] Stage 2 GeoIP batch lookup failed:", err);
    }
  }

  console.log(`[enrich] Stage 2 complete: ${result.geoEnriched} threats geo-enriched, ${result.providersUpserted} providers upserted`);

  // ─── Stage 3: WHOIS/RDAP ──────────────────────────────────────
  // Only enrich high/critical severity threats without registrar data
  const needsWhois = await env.DB.prepare(
    `SELECT id, malicious_domain FROM threats
     WHERE malicious_domain IS NOT NULL AND registrar IS NULL
       AND severity IN ('critical', 'high')
     LIMIT 20`,
  ).all<{ id: string; malicious_domain: string }>();

  console.log(`[enrich] Stage 3 WHOIS: ${needsWhois.results.length} threats to look up`);

  if (needsWhois.results.length > 0) {
    const domains = needsWhois.results.map((r) => r.malicious_domain);
    try {
      const rdapMap = await batchRDAPLookup(domains);
      console.log(`[enrich] WHOIS resolved: ${rdapMap.size}/${domains.length} domains got registrar data`);

      for (const row of needsWhois.results) {
        const rdap = rdapMap.get(row.malicious_domain);
        if (!rdap?.registrar) continue;

        try {
          await env.DB.prepare(
            "UPDATE threats SET registrar = ? WHERE id = ? AND registrar IS NULL",
          ).bind(rdap.registrar, row.id).run();
          result.whoisEnriched++;
        } catch (err) {
          console.error(`[enrich] WHOIS update failed for ${row.id}:`, err);
        }
      }
    } catch (err) {
      console.error("[enrich] Stage 3 WHOIS batch lookup failed:", err);
    }
  }

  console.log(`[enrich] Stage 3 complete: ${result.whoisEnriched} registrars resolved`);

  // ─── Stage 4: Brand Auto-Detection ────────────────────────────
  try {
    const brandResult = await enrichBrands(env.DB);
    result.brandsMatched = brandResult.matched;
    console.log(`[enrich] Stage 4 complete: ${result.brandsMatched} brands matched`);
  } catch (err) {
    console.error("[enrich] Stage 4 brand detection failed:", err);
  }

  // ─── Stage 5: Sync hosting_providers counts ───────────────────
  try {
    const providerUpdate = await env.DB.prepare(`
      UPDATE hosting_providers SET
        active_threat_count = (
          SELECT COUNT(*) FROM threats
          WHERE threats.hosting_provider_id = hosting_providers.id AND threats.status = 'active'
        ),
        total_threat_count = (
          SELECT COUNT(*) FROM threats
          WHERE threats.hosting_provider_id = hosting_providers.id
        )
    `).run();
    result.providerCountsUpdated = providerUpdate.meta.changes ?? 0;
    console.log(`[enrich] Stage 5 complete: ${result.providerCountsUpdated} provider counts synced`);
  } catch (err) {
    console.error("[enrich] Stage 5 provider count update failed:", err);
  }

  console.log(`[enrich] === PIPELINE COMPLETE === ${JSON.stringify(result)}`);
  return result;
}
