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

    // ─── Diagnostic logging ───────────────────────────────────
    console.log("[analyst] === STARTING ===");
    console.log("[analyst] ANTHROPIC_API_KEY configured:", !!env.ANTHROPIC_API_KEY, env.ANTHROPIC_API_KEY ? "present (length=" + env.ANTHROPIC_API_KEY.length + ")" : "MISSING");

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

    console.log("[analyst] Threats without brand (target_brand_id IS NULL, domain NOT NULL):", threats.results.length);

    // Also check total threats for context
    const totalCount = await env.DB.prepare("SELECT COUNT(*) as n FROM threats").first<{ n: number }>();
    const noBrandCount = await env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE target_brand_id IS NULL").first<{ n: number }>();
    const noBrandWithDomain = await env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE target_brand_id IS NULL AND malicious_domain IS NOT NULL").first<{ n: number }>();
    console.log("[analyst] Total threats:", totalCount?.n ?? 0, "| No brand:", noBrandCount?.n ?? 0, "| No brand + has domain:", noBrandWithDomain?.n ?? 0);

    // Load known brands for context
    const brands = await env.DB.prepare(
      "SELECT name FROM brands ORDER BY threat_count DESC LIMIT 100"
    ).all<{ name: string }>();
    const brandNames = brands.results.map((b) => b.name);
    console.log("[analyst] Known brands loaded:", brandNames.length, brandNames.length > 0 ? `(first: ${brandNames[0]})` : "(none)");

    let itemsProcessed = 0;
    let itemsUpdated = 0;
    let totalTokens = 0;
    let model: string | undefined;
    let haikuSuccesses = 0;
    let haikuFailures = 0;
    let lowConfidence = 0;
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

      if (!result.success || !result.data) {
        haikuFailures++;
        if (haikuFailures <= 3) {
          console.log(`[analyst] Haiku FAILED for ${threat.id} (domain=${threat.malicious_domain}): ${result.error ?? "no data returned"}`);
        }
        continue;
      }

      if (result.data.confidence < 70) {
        lowConfidence++;
        if (lowConfidence <= 3) {
          console.log(`[analyst] Low confidence for ${threat.id}: brand="${result.data.brand_name}", confidence=${result.data.confidence}`);
        }
        continue;
      }

      haikuSuccesses++;
      if (result.tokens_used) totalTokens += result.tokens_used;
      if (result.model) model = result.model;

      if (haikuSuccesses <= 3) {
        console.log(`[analyst] Haiku SUCCESS for ${threat.id}: brand="${result.data.brand_name}", confidence=${result.data.confidence}`);
      }

      // Find or create the brand
      const matchedBrand = result.data.brand_name;
      let brandId = await env.DB.prepare(
        "SELECT id FROM brands WHERE LOWER(name) = LOWER(?)"
      ).bind(matchedBrand).first<{ id: string }>();

      if (!brandId) {
        const newId = `brand_${matchedBrand.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
        const domain = threat.malicious_domain ?? "unknown";
        try {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO brands (id, name, canonical_domain, threat_count, first_seen)
             VALUES (?, ?, ?, 0, datetime('now'))`
          ).bind(newId, matchedBrand, domain).run();
          brandId = { id: newId };
          console.log(`[analyst] Created new brand: ${matchedBrand} (${newId})`);
        } catch (err) {
          console.error(`[analyst] Brand creation failed for ${matchedBrand}:`, err);
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

    console.log(`[analyst] Processing complete: processed=${itemsProcessed}, matched=${itemsUpdated}, haiku_ok=${haikuSuccesses}, haiku_fail=${haikuFailures}, low_confidence=${lowConfidence}`);

    // Always generate an output so agent_outputs gets populated
    outputs.push({
      type: "classification",
      summary: itemsProcessed > 0
        ? `Analyst matched ${itemsUpdated} threats to brands (${itemsProcessed} processed, haiku=${haikuSuccesses}/${haikuFailures}, low_conf=${lowConfidence})`
        : `Analyst found 0 unmatched threats (${totalCount?.n ?? 0} total, ${noBrandWithDomain?.n ?? 0} without brand+domain)`,
      severity: "info",
      details: {
        processed: itemsProcessed,
        matched: itemsUpdated,
        haikuSuccesses,
        haikuFailures,
        lowConfidence,
        totalThreats: totalCount?.n ?? 0,
        noBrandThreats: noBrandCount?.n ?? 0,
        noBrandWithDomain: noBrandWithDomain?.n ?? 0,
        knownBrands: brandNames.length,
        anthropicApiConfigured: !!env.ANTHROPIC_API_KEY,
        model,
      },
    });

    console.log("[analyst] agentOutputs to persist:", outputs.length, "entries");
    console.log("[analyst] === DONE ===");

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
