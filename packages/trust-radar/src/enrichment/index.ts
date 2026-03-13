/**
 * Enrichment Chain — Post-ingestion context enrichment using free APIs.
 *
 * Each enricher is idempotent: it checks a metadata flag before processing
 * a threat and sets it on completion, so re-runs safely skip already-enriched rows.
 *
 * Run order matters:
 *   1. Shodan — adds port/CVE data to IP-based threats
 *   2. RDAP   — adds domain age to domain-based threats
 *   3. DNS    — adds DNS health signals to domain-based threats
 */

import type { Env } from "../types";
import { enrichShodan } from "./shodan";
import { enrichRdap } from "./rdap";
import { enrichDns } from "./dns";

export { enrichShodan, enrichRdap, enrichDns };

export async function runEnrichmentChain(db: D1Database, env: Env): Promise<void> {
  // Shodan and RDAP/DNS are independent — run them concurrently
  const [shodanResult, rdapResult, dnsResult] = await Promise.allSettled([
    enrichShodan(db, env),
    enrichRdap(db, env),
    enrichDns(db, env),
  ]);

  if (shodanResult.status === "fulfilled") {
    const r = shodanResult.value;
    if (r.enriched > 0 || r.errors > 0) {
      console.log(`[shodan] enriched=${r.enriched} skipped=${r.skipped} errors=${r.errors}`);
    }
  } else {
    console.error("[shodan] enrichment chain error:", shodanResult.reason);
  }

  if (rdapResult.status === "fulfilled") {
    const r = rdapResult.value;
    if (r.enriched > 0 || r.errors > 0) {
      console.log(`[rdap] enriched=${r.enriched} skipped=${r.skipped} errors=${r.errors}`);
    }
  } else {
    console.error("[rdap] enrichment chain error:", rdapResult.reason);
  }

  if (dnsResult.status === "fulfilled") {
    const r = dnsResult.value;
    if (r.enriched > 0 || r.errors > 0) {
      console.log(`[dns] enriched=${r.enriched} skipped=0 errors=${r.errors}`);
    }
  } else {
    console.error("[dns] enrichment chain error:", dnsResult.reason);
  }
}
