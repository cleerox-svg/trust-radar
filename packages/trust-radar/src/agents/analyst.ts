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
import { correlateBrandThreats } from "../brand-threat-correlator";
import { getBrandSocialIntel } from "../lib/social-intel";
import { computeBrandExposureScore } from "../lib/brand-scoring";
import { getBrandById, incrementBrandThreatCount } from "../db/brands";

export const analystAgent: AgentModule = {
  name: "analyst",
  displayName: "ASTRA",
  description: "Threat classification & brand matching via Haiku",
  color: "#E8923C",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
    const keySource = env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : env.LRX_API_KEY ? "LRX_API_KEY" : "NONE";

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

    // Also check total threats for context
    const totalCount = await env.DB.prepare("SELECT COUNT(*) as n FROM threats").first<{ n: number }>();
    const noBrandCount = await env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE target_brand_id IS NULL").first<{ n: number }>();
    const noBrandWithDomain = await env.DB.prepare("SELECT COUNT(*) as n FROM threats WHERE target_brand_id IS NULL AND malicious_domain IS NOT NULL").first<{ n: number }>();

    // Load known brands for context
    const brands = await env.DB.prepare(
      "SELECT name FROM brands ORDER BY threat_count DESC LIMIT 100"
    ).all<{ name: string }>();
    const brandNames = brands.results.map((b) => b.name);

    // Load safe domains for allowlist filtering
    const safeSet = await loadSafeDomainSet(env.DB);

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

      // Derive attack classification from available signals
      const domain = threat.malicious_domain ?? '';
      const url = threat.malicious_url ?? '';
      const attackVector = url.includes('login') || url.includes('signin') || url.includes('password') || domain.includes('login')
        ? 'credential_theft'
        : threat.threat_type === 'malware_distribution' ? 'malware'
        : domain.includes('redirect') || url.includes('redirect') ? 'redirect'
        : 'scam';
      const targetAudience = domain.includes('gov') || domain.includes('.mil') ? 'government'
        : domain.includes('crypto') || domain.includes('wallet') || domain.includes('nft') ? 'crypto'
        : domain.includes('enterprise') || domain.includes('corp') ? 'enterprise'
        : 'consumer';
      const sophistication = (domain.length > 30 || url.includes('?')) && !domain.includes('free')
        ? 'high' : domain.includes('free') || domain.includes('giveaway') ? 'low' : 'medium';

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
        continue;
      }

      haikuSuccesses++;
      if (result.tokens_used) totalTokens += result.tokens_used;
      if (result.model) model = result.model;

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
        } catch (err) {
          console.error(`[analyst] Brand creation failed for ${matchedBrand}:`, err);
          continue;
        }
      }

      try {
        await env.DB.prepare(
          "UPDATE threats SET target_brand_id = ? WHERE id = ? AND target_brand_id IS NULL"
        ).bind(brandId.id, threat.id).run();
        await incrementBrandThreatCount(env, brandId.id);
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
          }
          outputs.push({
            type: 'classification',
            summary: `**Email Security Risk** — ${matchedBrand} has grade ${emailSec.email_security_grade}: weak spoofing protection increases phishing effectiveness. ${threat.threat_type === 'phishing' ? 'Threat escalated to CRITICAL.' : ''}`,
            severity: 'high',
            details: {
              brand: matchedBrand,
              email_security_grade: emailSec.email_security_grade,
              threat_type: threat.threat_type,
              attack_vector: attackVector,
              target_audience: targetAudience,
              sophistication,
            },
            relatedBrandIds: [brandId.id],
          });
        }
      } catch (err) {
        console.error(`[analyst] update failed for ${threat.id}:`, err);
      }
    }

    // ─── Phase 2.5: Enrichment validation context per brand ─────
    // Query enrichment stats for brands that had threats matched this run
    const enrichmentStats = await env.DB.prepare(`
      SELECT
        target_brand_id,
        SUM(CASE WHEN surbl_listed = 1 THEN 1 ELSE 0 END) as surbl_confirmed,
        SUM(CASE WHEN vt_malicious > 0 THEN 1 ELSE 0 END) as vt_flagged,
        ROUND(AVG(CASE WHEN vt_malicious > 0 THEN vt_malicious ELSE NULL END), 1) as vt_avg_malicious,
        SUM(CASE WHEN gsb_flagged = 1 THEN 1 ELSE 0 END) as gsb_confirmed,
        SUM(CASE WHEN dbl_listed = 1 THEN 1 ELSE 0 END) as dbl_confirmed
      FROM threats
      WHERE target_brand_id IS NOT NULL
        AND status = 'active'
        AND (surbl_listed = 1 OR vt_malicious > 0 OR gsb_flagged = 1 OR dbl_listed = 1)
      GROUP BY target_brand_id
    `).all<{
      target_brand_id: string;
      surbl_confirmed: number;
      vt_flagged: number;
      vt_avg_malicious: number | null;
      gsb_confirmed: number;
      dbl_confirmed: number;
    }>();

    const enrichmentByBrand = new Map(
      enrichmentStats.results.map(r => [r.target_brand_id, r])
    );

    // ─── Phase 3: Brand threat correlation escalation ──────────
    // After processing threats, run correlation for brands with new matches
    const matchedBrandIds = new Set<string>();
    if (threats.results.length > 0) {
      const threatIds = threats.results.map(t => t.id);
      const brandRows = await env.DB.prepare(
        `SELECT DISTINCT target_brand_id FROM threats
         WHERE id IN (${threatIds.map(() => '?').join(',')})
           AND target_brand_id IS NOT NULL`
      ).bind(...threatIds).all<{ target_brand_id: string }>();
      for (const row of brandRows.results) {
        matchedBrandIds.add(row.target_brand_id);
      }
    }

    for (const bid of Array.from(matchedBrandIds).slice(0, 5)) {
      try {
        const assessment = await correlateBrandThreats(env, bid);
        if (!assessment) continue;

        // Escalation: PhishTank + no DMARC
        if (assessment.phishtank_active_urls > 0 && (!assessment.dmarc_policy || assessment.dmarc_policy === "none")) {
          outputs.push({
            type: "classification",
            summary: `**Active Phishing + No DMARC** — ${assessment.brand_name} has ${assessment.phishtank_active_urls} active phishing URLs with DMARC policy "${assessment.dmarc_policy ?? "missing"}". Immediate enforcement recommended.`,
            severity: "critical",
            details: {
              brand: assessment.brand_name,
              phishtank_urls: assessment.phishtank_active_urls,
              dmarc_policy: assessment.dmarc_policy,
              risk_score: assessment.composite_risk_score,
            },
            relatedBrandIds: [bid],
          });
        }

        // Escalation: AI-generated phishing detected
        if (assessment.ai_generated_phishing_detected) {
          outputs.push({
            type: "classification",
            summary: `**AI-Generated Threat Detected** — ${assessment.ai_phishing_count_30d} AI-generated phishing attempts targeting ${assessment.brand_name} in the last 30 days.`,
            severity: "high",
            details: {
              brand: assessment.brand_name,
              ai_phishing_count: assessment.ai_phishing_count_30d,
              risk_score: assessment.composite_risk_score,
            },
            relatedBrandIds: [bid],
          });
        }

        // Escalation: Risk score spike (check previous assessment)
        const prev = await env.DB.prepare(
          "SELECT composite_risk_score FROM brand_threat_assessments WHERE brand_id = ? ORDER BY assessed_at DESC LIMIT 1"
        ).bind(bid).first<{ composite_risk_score: number }>();
        if (prev && assessment.composite_risk_score - prev.composite_risk_score >= 20) {
          outputs.push({
            type: "classification",
            summary: `**Risk Score Spike** — ${assessment.brand_name} risk score jumped from ${prev.composite_risk_score} to ${assessment.composite_risk_score} (+${assessment.composite_risk_score - prev.composite_risk_score} points).`,
            severity: "high",
            details: {
              brand: assessment.brand_name,
              previous_score: prev.composite_risk_score,
              current_score: assessment.composite_risk_score,
              risk_factors: assessment.risk_factors,
            },
            relatedBrandIds: [bid],
          });
        }
      } catch (corrErr) {
        console.error(`[analyst] correlation check failed for brand ${bid}:`, corrErr);
      }
    }

    // ─── Phase 3.5: Enrichment validation summaries per brand ──────
    for (const bid of Array.from(matchedBrandIds).slice(0, 5)) {
      const enrichment = enrichmentByBrand.get(bid);
      if (enrichment && (enrichment.surbl_confirmed > 0 || enrichment.vt_flagged > 0 || enrichment.gsb_confirmed > 0 || enrichment.dbl_confirmed > 0)) {
        const brand = await getBrandById(env, bid);
        const brandName = brand?.name ?? bid;
        const parts: string[] = [];
        if (enrichment.surbl_confirmed > 0) parts.push(`${enrichment.surbl_confirmed} confirmed by SURBL`);
        if (enrichment.vt_flagged > 0) parts.push(`${enrichment.vt_flagged} flagged by VirusTotal (avg ${enrichment.vt_avg_malicious ?? 0} engines)`);
        if (enrichment.gsb_confirmed > 0) parts.push(`${enrichment.gsb_confirmed} confirmed by Google Safe Browsing`);
        if (enrichment.dbl_confirmed > 0) parts.push(`${enrichment.dbl_confirmed} confirmed by Spamhaus DBL`);
        outputs.push({
          type: 'classification',
          summary: `**External Validation** — ${brandName}: ${parts.join('. ')}.`,
          severity: enrichment.vt_flagged > 5 || enrichment.surbl_confirmed > 10 || enrichment.gsb_confirmed > 5 || enrichment.dbl_confirmed > 5 ? 'high' : 'medium',
          details: {
            brand_id: bid,
            surbl_confirmed: enrichment.surbl_confirmed,
            vt_flagged: enrichment.vt_flagged,
            vt_avg_malicious: enrichment.vt_avg_malicious,
            gsb_confirmed: enrichment.gsb_confirmed,
            dbl_confirmed: enrichment.dbl_confirmed,
          },
          relatedBrandIds: [bid],
        });
      }
    }

    // ─── Phase 4: Social intelligence correlation & exposure scoring ──
    for (const bid of Array.from(matchedBrandIds).slice(0, 5)) {
      try {
        const socialIntel = await getBrandSocialIntel(env, bid);

        if (socialIntel.totalProfiles > 0) {
          const socialContext = `Social Media Intelligence:
- Total profiles tracked: ${socialIntel.totalProfiles} across ${socialIntel.platformsCovered.join(', ')}
- Official verified: ${socialIntel.officialProfiles}
- Suspicious/Impersonation: ${socialIntel.suspiciousProfiles + socialIntel.impersonationProfiles}
- Platforms with impersonation: ${socialIntel.platformsWithImpersonation.join(', ') || 'None'}
- Social Risk Score: ${socialIntel.socialRiskScore ?? 'Not computed'}
- AI recommends takedown for ${socialIntel.aiTakedownRecommendations} profiles
- New impersonations (24h): ${socialIntel.newImpersonationsLast24h}`;

          // Check for coordinated attack: phishing + social impersonation
          const brandThreats = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM threats WHERE target_brand_id = ? AND status = 'active' AND threat_type = 'phishing'"
          ).bind(bid).first<{ n: number }>();

          if ((brandThreats?.n || 0) > 0 && socialIntel.impersonationProfiles > 0) {
            outputs.push({
              type: "classification",
              summary: `**Coordinated Attack Signal** — Brand has ${brandThreats?.n} active phishing campaigns AND ${socialIntel.impersonationProfiles} social impersonation accounts. This suggests a coordinated attack.`,
              severity: "critical",
              details: {
                brand_id: bid,
                phishing_count: brandThreats?.n,
                impersonation_count: socialIntel.impersonationProfiles,
                platforms_affected: socialIntel.platformsWithImpersonation,
                social_risk_score: socialIntel.socialRiskScore,
                social_context: socialContext,
              },
              relatedBrandIds: [bid],
            });
          }

          // Check for high-vulnerability: weak email + social impersonation
          const emailSec2 = await env.DB.prepare(
            "SELECT email_security_grade FROM brands WHERE id = ?"
          ).bind(bid).first<{ email_security_grade: string | null }>();

          if (emailSec2?.email_security_grade && ['F', 'D'].includes(emailSec2.email_security_grade) && socialIntel.impersonationProfiles > 0) {
            outputs.push({
              type: "classification",
              summary: `**High Vulnerability** — Brand has email security grade ${emailSec2.email_security_grade} AND ${socialIntel.impersonationProfiles} active impersonation accounts. Extremely vulnerable to brand abuse.`,
              severity: "high",
              details: {
                brand_id: bid,
                email_grade: emailSec2.email_security_grade,
                impersonation_count: socialIntel.impersonationProfiles,
                social_risk_assessment: {
                  score: socialIntel.socialRiskScore,
                  highest_severity: socialIntel.highestSeverity,
                  takedown_needed: socialIntel.aiTakedownRecommendations,
                },
              },
              relatedBrandIds: [bid],
            });
          }
        }

        // Compute composite exposure score
        await computeBrandExposureScore(env, bid);
      } catch (socialErr) {
        console.error(`[analyst] social intel check failed for brand ${bid}:`, socialErr);
      }
    }

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
        enhanced_fields: ['attack_vector', 'target_audience', 'sophistication'],
      },
    });

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
