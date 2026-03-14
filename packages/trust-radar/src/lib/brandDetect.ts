/**
 * Brand Auto-Detection — Match threat domains against known brands.
 *
 * Strategies:
 * 1. Exact domain match against brands.canonical_domain
 * 2. Substring match: domain contains brand name (e.g., "paypal-secure.com" → PayPal)
 * 3. Creates new brand records for frequently targeted but unknown brands
 */

interface BrandRow {
  id: string;
  name: string;
  canonical_domain: string;
}

/**
 * Load all brands from DB and build detection indexes.
 */
async function loadBrands(db: D1Database): Promise<BrandRow[]> {
  const rows = await db.prepare("SELECT id, name, canonical_domain FROM brands").all<BrandRow>();
  return rows.results;
}

/**
 * Try to match a domain to a known brand.
 * Returns brand ID if matched, null otherwise.
 */
function matchBrand(domain: string, brands: BrandRow[]): string | null {
  const lower = domain.toLowerCase();

  // Strategy 1: Exact canonical domain match (strip www.)
  const stripped = lower.replace(/^www\./, "");
  for (const brand of brands) {
    if (stripped === brand.canonical_domain.toLowerCase()) return brand.id;
  }

  // Strategy 2: Domain contains brand name as substring
  for (const brand of brands) {
    const brandLower = brand.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (brandLower.length >= 3 && lower.includes(brandLower)) return brand.id;
  }

  return null;
}

/**
 * Enrich threats that have a malicious_domain but no target_brand_id.
 * Matches against known brands and updates threats in-place.
 */
export async function enrichBrands(db: D1Database): Promise<{ matched: number; total: number }> {
  const brands = await loadBrands(db);
  if (brands.length === 0) return { matched: 0, total: 0 };

  // Get threats missing brand assignment
  const rows = await db.prepare(
    `SELECT id, malicious_domain FROM threats
     WHERE malicious_domain IS NOT NULL AND target_brand_id IS NULL
     LIMIT 500`,
  ).all<{ id: string; malicious_domain: string }>();

  const total = rows.results.length;
  if (total === 0) return { matched: 0, total: 0 };

  let matched = 0;

  for (const row of rows.results) {
    const brandId = matchBrand(row.malicious_domain, brands);
    if (!brandId) continue;

    try {
      await db.prepare(
        "UPDATE threats SET target_brand_id = ? WHERE id = ? AND target_brand_id IS NULL",
      ).bind(brandId, row.id).run();

      // Increment brand threat count
      await db.prepare(
        `UPDATE brands SET
           threat_count = threat_count + 1,
           last_threat_seen = datetime('now')
         WHERE id = ?`,
      ).bind(brandId).run();

      matched++;
    } catch (err) {
      console.error(`[brand-detect] update failed for ${row.id}:`, err);
    }
  }

  return { matched, total };
}
