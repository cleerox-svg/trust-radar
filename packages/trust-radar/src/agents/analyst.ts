/**
 * Analyst Agent — Threat classification & brand matching via Haiku.
 *
 * Runs every 15 minutes. For threats that have no target_brand_id,
 * uses Haiku to infer the targeted brand from domain/URL patterns.
 * Complements the rule-based brand detection in lib/brandDetect.ts.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { inferBrand } from "../lib/haiku";

export const analystAgent: AgentModule = {
  name: "analyst",
  displayName: "Analyst",
  description: "Threat classification & brand matching via Haiku",
  color: "#818CF8",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    // Get threats without brand assignment that rule-based detection missed
    const threats = await env.DB.prepare(
      `SELECT id, malicious_url, malicious_domain, source_feed
       FROM threats
       WHERE target_brand_id IS NULL AND malicious_domain IS NOT NULL
       ORDER BY created_at DESC LIMIT 30`
    ).all<{
      id: string; malicious_url: string | null;
      malicious_domain: string | null; source_feed: string;
    }>();

    // Load known brands for context
    const brands = await env.DB.prepare(
      "SELECT name FROM brands ORDER BY threat_count DESC LIMIT 100"
    ).all<{ name: string }>();
    const brandNames = brands.results.map((b) => b.name);

    let itemsProcessed = 0;
    let itemsUpdated = 0;
    let totalTokens = 0;
    let model: string | undefined;
    const outputs: AgentOutputEntry[] = [];

    for (const threat of threats.results) {
      itemsProcessed++;

      const result = await inferBrand(
        env,
        {
          malicious_url: threat.malicious_url,
          malicious_domain: threat.malicious_domain,
          source_feed: threat.source_feed,
        },
        brandNames,
      );

      if (!result.success || !result.data || result.data.confidence < 70) continue;

      if (result.tokens_used) totalTokens += result.tokens_used;
      if (result.model) model = result.model;

      // Find or create the brand
      const matchedBrand = result.data.brand_name;
      let brandId = await env.DB.prepare(
        "SELECT id FROM brands WHERE LOWER(name) = LOWER(?)"
      ).bind(matchedBrand).first<{ id: string }>();

      if (!brandId) {
        // Create new brand from AI inference
        const newId = `brand_${matchedBrand.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
        const domain = threat.malicious_domain ?? "unknown";
        try {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO brands (id, name, canonical_domain, threat_count, first_seen)
             VALUES (?, ?, ?, 0, datetime('now'))`
          ).bind(newId, matchedBrand, domain).run();
          brandId = { id: newId };
        } catch {
          continue;
        }
      }

      try {
        await env.DB.prepare(
          "UPDATE threats SET target_brand_id = ? WHERE id = ? AND target_brand_id IS NULL"
        ).bind(brandId.id, threat.id).run();
        await env.DB.prepare(
          "UPDATE brands SET threat_count = threat_count + 1, last_threat_seen = datetime('now') WHERE id = ?"
        ).bind(brandId.id).run();
        itemsUpdated++;
      } catch (err) {
        console.error(`[analyst] update failed for ${threat.id}:`, err);
      }
    }

    if (itemsUpdated > 0) {
      outputs.push({
        type: "classification",
        summary: `Analyst matched ${itemsUpdated} threats to brands via AI inference`,
        severity: "info",
        details: { processed: itemsProcessed, matched: itemsUpdated, model },
      });
    }

    return {
      itemsProcessed,
      itemsCreated: 0,
      itemsUpdated,
      output: { brandMatches: itemsUpdated },
      model,
      tokensUsed: totalTokens,
      agentOutputs: outputs,
    };
  },
};
