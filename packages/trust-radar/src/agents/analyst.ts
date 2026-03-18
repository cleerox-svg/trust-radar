/**
 * Analyst Agent — Threat classification & brand matching via Haiku.
 *
 * Runs every 15 minutes. For threats that have no target_brand_id,
 * uses Haiku to infer the targeted brand from domain/URL patterns.
 * Complements the rule-based brand detection in lib/brandDetect.ts.
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { inferBrand } from "../lib/haiku";
import { loadSafeDomainSet, isSafeDomain } from "../lib/safeDomains";

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
    const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
    const keySource = env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : env.LRX_API_KEY ? "LRX_API_KEY" : "NONE";
    console.log(`[analyst] API key: source=${keySource}, configured=${!!apiKey}${apiKey ? ", prefix=" + apiKey.slice(0, 8) + "..." : ""}`);

    // Get threats without brand assignment that rule-based detection missed
    const threats = await env.DB.prepare(
      `SELECT id, malicious_url, malicious_domain, source_feed, threat_type
       FROM threats
       WHERE target_brand_id IS NULL AND malicious_domain IS NOT NULL
       ORDER BY created_at DESC LIMIT 30`
    ).all<{
      id: string; malicious_url: string | null;
      malicious_domain: string | null; source_feed: string; threat_type: string;
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

    // Load safe domains for allowlist filtering
    const safeSet = await loadSafeDomainSet(env.DB);
    console.log("[analyst] Safe domain set loaded:", safeSet.size, "entries");

    let itemsProcessed = 0;
    let itemsUpdated = 0;
    let totalTokens = 0;
    let model: string | undefined;
    let haikuSuccesses = 0;
    let haikuFailures = 0;
    let lowConfidence = 0;
    const outputs: AgentOutputEntry[] = [];

    let safeSkipped = 0;

    for (const threat of threats.results) {
      itemsProcessed++;

      // Skip threats whose domain is in the safe domain allowlist
      if (threat.malicious_domain && isSafeDomain(threat.malicious_domain, safeSet)) {
        safeSkipped++;
        continue;
      }

      const result = await inferBrand(
        env,
        {
          malicious_url: threat.malicious_url,
          malicious_domain: threat.malicious_domain,
          source_feed: threat.source_feed,
        },
        brandNames,
      );

      // On FIRST call, write diagnostic directly to agent_outputs for D1 querying
      if (itemsProcessed === 1) {
        const diagSummary = `ANTHROPIC_API_KEY set=${!!env.ANTHROPIC_API_KEY}, LRX_API_KEY set=${!!env.LRX_API_KEY}, key_prefix=${apiKey ? apiKey.slice(0, 8) + "..." : "NONE"}, haiku_success=${result.success}, haiku_error=${result.error ?? "none"}, domain=${threat.malicious_domain}`;
        try {
          await env.DB.prepare(
            `INSERT INTO agent_outputs (id, agent_id, type, summary, severity, details, created_at)
             VALUES (?, 'analyst', 'diagnostic', ?, 'info', ?, datetime('now'))`
          ).bind(
            crypto.randomUUID(),
            diagSummary,
            JSON.stringify({
              anthropic_key_set: !!env.ANTHROPIC_API_KEY,
              lrx_key_set: !!env.LRX_API_KEY,
              key_source: keySource,
              key_prefix: apiKey ? apiKey.slice(0, 8) + "..." : "NONE",
              haiku_success: result.success,
              haiku_error: result.error ?? null,
              haiku_model: result.model ?? null,
              haiku_tokens: result.tokens_used ?? null,
              test_domain: threat.malicious_domain,
              threats_to_process: threats.results.length,
            }),
          ).run();
        } catch (diagErr) {
          console.error("[analyst] diagnostic write failed:", diagErr);
        }
      }

      if (!result.success || !result.data) {
        haikuFailures++;
        if (haikuFailures === 1) {
          console.error(`[analyst] FIRST HAIKU FAILURE — domain=${threat.malicious_domain}, error: ${result.error ?? "no data returned"}`);
          console.error(`[analyst] This error will repeat for all ${threats.results.length} threats. Fix the root cause above.`);
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

        // Factor email security into risk: escalate phishing to CRITICAL when brand has weak email security
        const emailSec = await env.DB.prepare(
          'SELECT email_security_grade, email_security_score FROM brands WHERE id = ?'
        ).bind(brandId.id).first<{ email_security_grade: string | null; email_security_score: number | null }>();

        if (emailSec?.email_security_grade && ['F', 'D'].includes(emailSec.email_security_grade)) {
          if (threat.threat_type === 'phishing') {
            await env.DB.prepare(
              "UPDATE threats SET severity = 'critical' WHERE id = ?"
            ).bind(threat.id).run();
            console.log(`[analyst] Escalated threat ${threat.id} to CRITICAL: ${matchedBrand} has email security grade ${emailSec.email_security_grade}`);
          }
          outputs.push({
            type: 'classification',
            summary: `**Email Security Risk** — ${matchedBrand} has grade ${emailSec.email_security_grade}: weak spoofing protection increases phishing effectiveness. ${threat.threat_type === 'phishing' ? 'Threat escalated to CRITICAL.' : ''}`,
            severity: 'high',
            details: { brand: matchedBrand, email_security_grade: emailSec.email_security_grade, threat_type: threat.threat_type },
            relatedBrandIds: [brandId.id],
          });
        }
      } catch (err) {
        console.error(`[analyst] update failed for ${threat.id}:`, err);
      }
    }

    console.log(`[analyst] Processing complete: processed=${itemsProcessed}, matched=${itemsUpdated}, haiku_ok=${haikuSuccesses}, haiku_fail=${haikuFailures}, low_confidence=${lowConfidence}, safe_skipped=${safeSkipped}`);

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
        anthropicKeySource: keySource,
        anthropicApiConfigured: !!apiKey,
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
