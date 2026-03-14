/**
 * Enrichment Pipeline Orchestrator — Runs after feed ingestion.
 *
 * Pipeline stages:
 * 1. DNS resolution: domain → IP (for threats missing ip_address)
 * 2. GeoIP + ASN: IP → country, ASN, hosting provider
 * 3. WHOIS/RDAP: domain → registrar (for high-severity threats)
 * 4. Brand auto-detection: domain → target_brand_id
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
  };

  // ─── Stage 1: DNS Resolution ──────────────────────────────────
  // Resolve threats that have a domain but no IP
  const needsDns = await env.DB.prepare(
    `SELECT id, malicious_domain FROM threats
     WHERE malicious_domain IS NOT NULL AND ip_address IS NULL
     LIMIT 200`,
  ).all<{ id: string; malicious_domain: string }>();

  if (needsDns.results.length > 0) {
    const domains = needsDns.results.map((r) => r.malicious_domain);
    const dnsMap = await batchResolve(domains);

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
  }

  // ─── Stage 2: GeoIP + ASN + Hosting Provider ─────────────────
  // Enrich threats that have IP but missing geo/ASN/provider
  const needsGeo = await env.DB.prepare(
    `SELECT id, ip_address FROM threats
     WHERE ip_address IS NOT NULL
       AND (country_code IS NULL OR asn IS NULL OR hosting_provider_id IS NULL)
     LIMIT 500`,
  ).all<{ id: string; ip_address: string }>();

  if (needsGeo.results.length > 0) {
    const ips = needsGeo.results.map((r) => r.ip_address);
    const geoMap = await batchGeoLookup(ips);

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
  }

  // ─── Stage 3: WHOIS/RDAP ──────────────────────────────────────
  // Only enrich high/critical severity threats without registrar data
  const needsWhois = await env.DB.prepare(
    `SELECT id, malicious_domain FROM threats
     WHERE malicious_domain IS NOT NULL AND registrar IS NULL
       AND severity IN ('critical', 'high')
     LIMIT 20`,
  ).all<{ id: string; malicious_domain: string }>();

  if (needsWhois.results.length > 0) {
    const domains = needsWhois.results.map((r) => r.malicious_domain);
    const rdapMap = await batchRDAPLookup(domains);

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
  }

  // ─── Stage 4: Brand Auto-Detection ────────────────────────────
  const brandResult = await enrichBrands(env.DB);
  result.brandsMatched = brandResult.matched;

  console.log(`[enrich] pipeline complete: ${JSON.stringify(result)}`);
  return result;
}
