// Safe domain lookup helper for threat pipeline integration

import type { D1Database } from "@cloudflare/workers-types";

/** Load all safe domains into a Set for O(1) lookup during a cron cycle */
export async function loadSafeDomainSet(db: D1Database): Promise<Set<string>> {
  const rows = await db.prepare("SELECT domain FROM brand_safe_domains").all<{ domain: string }>();
  const set = new Set<string>();
  for (const r of rows.results) {
    set.add(r.domain);
    // Also add www. variant for matching
    if (!r.domain.startsWith("www.")) {
      set.add("www." + r.domain);
    }
  }
  return set;
}

/** Check if a domain (or its www-stripped variant) is in the safe set */
export function isSafeDomain(domain: string, safeSet: Set<string>): boolean {
  const d = domain.toLowerCase().replace(/\.$/, "");
  if (safeSet.has(d)) return true;
  // Also check without www
  const noWww = d.replace(/^www\./, "");
  if (noWww !== d && safeSet.has(noWww)) return true;
  return false;
}
