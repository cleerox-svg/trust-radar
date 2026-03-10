/**
 * Impersonation Detector Agent — Detect lookalike domains and homoglyphs.
 * Analyzes recently seen domains for brand impersonation patterns.
 */

import type { AgentModule, AgentContext, AgentResult } from "../lib/agentRunner";

// Common brand keywords to watch for impersonation
const BRAND_KEYWORDS = [
  "paypal", "apple", "google", "microsoft", "amazon", "netflix", "facebook",
  "instagram", "twitter", "linkedin", "dropbox", "adobe", "zoom", "slack",
  "github", "cloudflare", "stripe", "shopify", "coinbase", "binance",
];

// Homoglyph character mappings (common confusables)
const HOMOGLYPHS: Record<string, string[]> = {
  a: ["а", "ą", "ä", "å", "α"],
  e: ["е", "ë", "ę", "ε"],
  o: ["о", "ö", "ø", "ο", "0"],
  i: ["і", "ì", "1", "l", "|"],
  l: ["1", "і", "|", "ℓ"],
  n: ["ñ", "ń", "η"],
  c: ["с", "ç", "ć"],
  s: ["ś", "ş", "ș"],
};

function detectHomoglyphs(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/[.-]/g, "");
  for (const [char, glyphs] of Object.entries(HOMOGLYPHS)) {
    for (const glyph of glyphs) {
      if (normalized.includes(glyph)) return true;
    }
  }
  return false;
}

function detectBrandSquatting(domain: string): string | null {
  const cleaned = domain.toLowerCase().replace(/[.-]/g, "");
  for (const brand of BRAND_KEYWORDS) {
    if (cleaned.includes(brand) && !cleaned.endsWith(`.${brand}.com`) && !cleaned.endsWith(`.${brand}.io`)) {
      // Likely squatting if domain contains brand but isn't the real domain
      const realPatterns = [`${brand}.com`, `${brand}.io`, `${brand}.org`, `${brand}.net`];
      if (!realPatterns.includes(domain)) return brand;
    }
  }
  return null;
}

export const impersonationDetectorAgent: AgentModule = {
  name: "impersonation-detector",
  displayName: "Impersonation Detector",
  description: "Detect lookalike domains and homoglyphs",
  color: "#F472B6",
  trigger: "event",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const hoursBack = (ctx.input.hoursBack as number) ?? 24;

    const recentDomains = await ctx.env.DB.prepare(
      `SELECT DISTINCT domain, id, type, source
       FROM threats
       WHERE domain IS NOT NULL
         AND created_at >= datetime('now', ? || ' hours')
       ORDER BY created_at DESC LIMIT 500`
    ).bind(-hoursBack).all<{
      domain: string; id: string; type: string; source: string;
    }>();

    let processed = 0;
    let flagged = 0;

    for (const row of recentDomains.results) {
      processed++;

      const hasHomoglyphs = detectHomoglyphs(row.domain);
      const squattedBrand = detectBrandSquatting(row.domain);

      if (hasHomoglyphs || squattedBrand) {
        const tags: string[] = [];
        if (hasHomoglyphs) tags.push("homoglyph");
        if (squattedBrand) tags.push(`impersonation:${squattedBrand}`);

        await ctx.env.DB.prepare(
          `UPDATE threats SET
             severity = CASE WHEN severity IN ('low', 'medium') THEN 'high' ELSE severity END,
             type = CASE WHEN type = 'unknown' THEN 'impersonation' ELSE type END,
             tags = json_insert(COALESCE(tags, '[]'), '$[#]', ?),
             last_seen = datetime('now')
           WHERE id = ?`
        ).bind(tags.join(","), row.id).run();
        flagged++;
      }
    }

    return {
      itemsProcessed: processed,
      itemsCreated: 0,
      itemsUpdated: flagged,
      output: {
        domainsScanned: processed,
        impersonationsFound: flagged,
        hoursBack,
      },
    };
  },
};
