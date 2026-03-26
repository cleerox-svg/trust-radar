/**
 * Sparrow Agent — Takedown Agent.
 *
 * Runs every 6 hours (staggered at minute 15-20 after cartographer).
 * Four phases:
 *   A) Scan unprocessed spam trap captures for malicious URLs
 *   B) Auto-create takedown request drafts from malicious URL scan results
 *   C) Auto-create takedown request drafts from impersonation social profiles
 *   D) AI evidence assembly for unenriched takedown drafts
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { scanUnprocessedCaptures } from "../lib/url-scanner";

export const sparrowAgent: AgentModule = {
  name: "sparrow",
  displayName: "Sparrow",
  description: "Takedown agent — scans URLs, auto-creates takedowns, assembles evidence, resolves providers",
  color: "#28A050",
  trigger: "scheduled",
  requiresApproval: false,

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;

    let itemsProcessed = 0;
    let itemsCreated = 0;
    const outputs: AgentOutputEntry[] = [];

    // ── Phase A: Scan unprocessed spam trap captures ──────────────
    const scanResults = await scanUnprocessedCaptures(env, 20);
    itemsProcessed += scanResults.captures_processed;

    if (scanResults.malicious_found > 0) {
      outputs.push({
        type: "diagnostic",
        summary: `Scanned ${scanResults.captures_processed} captures: ${scanResults.urls_scanned} URLs checked, ${scanResults.malicious_found} malicious found`,
        severity: "info",
        details: scanResults,
      });
    }

    // ── Phase B: Auto-create takedowns from malicious URL scan results ──
    const urlTakedowns = await createTakedownsFromMaliciousUrls(env);
    itemsCreated += urlTakedowns;

    // ── Phase C: Auto-create takedowns from impersonation social profiles ──
    const socialTakedowns = await createTakedownsFromImpersonations(env);
    itemsCreated += socialTakedowns;

    if (urlTakedowns > 0 || socialTakedowns > 0) {
      outputs.push({
        type: "insight",
        summary: `Created ${urlTakedowns + socialTakedowns} takedown drafts (${urlTakedowns} from URLs, ${socialTakedowns} from impersonation profiles)`,
        severity: urlTakedowns + socialTakedowns > 5 ? "high" : "medium",
        details: { url_takedowns: urlTakedowns, social_takedowns: socialTakedowns },
      });
    }

    // ── Phase D: AI evidence assembly for unenriched takedowns ────
    const unenrichedTakedowns = await env.DB.prepare(`
      SELECT id FROM takedown_requests
      WHERE status = 'draft'
        AND id NOT IN (
          SELECT takedown_id FROM takedown_evidence WHERE evidence_type = 'ai_report'
        )
      ORDER BY priority_score DESC
      LIMIT 3
    `).all<{ id: string }>();

    let evidenceAssembled = 0;
    for (const td of unenrichedTakedowns.results || []) {
      try {
        const { assembleEvidence } = await import("../lib/evidence-assembler");
        await assembleEvidence(env, td.id);
        evidenceAssembled++;
      } catch (err) {
        console.error(`[Sparrow] Evidence assembly failed for ${td.id}: ${err}`);
      }
    }

    if (evidenceAssembled > 0) {
      itemsCreated += evidenceAssembled;
      outputs.push({
        type: "diagnostic",
        summary: `Assembled AI evidence for ${evidenceAssembled} takedown request(s)`,
        severity: "info",
        details: { evidence_assembled: evidenceAssembled },
      });
    }

    // ── Phase E: Resolve providers and generate submission drafts ───
    let providersResolved = 0;
    const noProviderTakedowns = await env.DB.prepare(`
      SELECT tr.*, b.name as brand_name
      FROM takedown_requests tr
      LEFT JOIN brands b ON b.id = tr.brand_id
      WHERE tr.status = 'draft'
        AND (tr.provider_name IS NULL OR tr.provider_abuse_contact IS NULL)
        AND tr.target_type IN ('domain', 'url')
      ORDER BY tr.priority_score DESC
      LIMIT 5
    `).all();

    for (const td of noProviderTakedowns.results || []) {
      try {
        const { resolveProvider, generateSubmissionDraft } = await import("../lib/provider-resolver");
        const providerInfo = await resolveProvider(env, td.target_value as string);

        const updates: string[] = [];
        const values: unknown[] = [];

        if (providerInfo.hosting_provider && !td.provider_name) {
          updates.push("provider_name = ?");
          values.push(providerInfo.hosting_provider);
        }
        if (providerInfo.abuse_contact?.abuse_email || providerInfo.abuse_contact?.abuse_url) {
          updates.push("provider_abuse_contact = ?");
          values.push(providerInfo.abuse_contact.abuse_email || providerInfo.abuse_contact.abuse_url);
        }
        if (providerInfo.abuse_contact?.abuse_api_type) {
          updates.push("provider_method = ?");
          values.push(providerInfo.abuse_contact.abuse_api_type);
        }

        // Generate submission draft
        const draft = generateSubmissionDraft(
          { ...(td as Record<string, unknown>), brand_name: td.brand_name as string } as {
            target_type: string;
            target_value: string;
            target_url?: string | null;
            evidence_summary: string;
            evidence_detail?: string | null;
            brand_name?: string;
          },
          providerInfo.abuse_contact,
          providerInfo,
        );
        updates.push("evidence_detail = COALESCE(evidence_detail, '') || ?");
        values.push("\n\n--- SUBMISSION DRAFT ---\n" + draft);

        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          values.push(td.id);
          await env.DB.prepare(
            `UPDATE takedown_requests SET ${updates.join(", ")} WHERE id = ?`
          ).bind(...values).run();
          providersResolved++;
        }
      } catch (err) {
        console.error(`[Sparrow] Provider resolution failed for ${td.id}: ${err}`);
      }
    }

    if (providersResolved > 0) {
      outputs.push({
        type: "diagnostic",
        summary: `Resolved providers and generated submission drafts for ${providersResolved} takedown(s)`,
        severity: "info",
        details: { providers_resolved: providersResolved },
      });
    }

    return {
      itemsProcessed,
      itemsCreated,
      itemsUpdated: providersResolved,
      output: {
        captures_scanned: scanResults.captures_processed,
        urls_scanned: scanResults.urls_scanned,
        malicious_found: scanResults.malicious_found,
        url_takedowns: urlTakedowns,
        social_takedowns: socialTakedowns,
        evidence_assembled: evidenceAssembled,
        providers_resolved: providersResolved,
      },
      agentOutputs: outputs,
    };
  },
};

// ─── Phase B: Malicious URL → Takedown ─────────────────────────────

async function createTakedownsFromMaliciousUrls(env: Env): Promise<number> {
  const unlinkedMalicious = await env.DB.prepare(`
    SELECT usr.*, b.name as brand_name, b.canonical_domain as brand_domain
    FROM url_scan_results usr
    JOIN brands b ON b.id = usr.brand_id
    WHERE usr.is_malicious = 1
      AND usr.takedown_id IS NULL
      AND usr.confidence_score >= 0.6
    ORDER BY usr.confidence_score DESC
    LIMIT 10
  `).all();

  let created = 0;

  for (const result of unlinkedMalicious.results) {
    const hostingProvider = result.hosting_provider as string | null;

    // Look up hosting provider from takedown_providers
    const provider = hostingProvider
      ? await env.DB.prepare(
          "SELECT * FROM takedown_providers WHERE provider_name LIKE ? LIMIT 1"
        ).bind(`%${hostingProvider}%`).first()
      : null;

    const confidenceScore = (result.confidence_score as number) || 0;
    const maliciousReasons: string[] = JSON.parse((result.malicious_reasons as string) || "[]");
    const brandName = (result.brand_name as string) || "unknown brand";
    const url = result.url as string;
    const domain = result.domain as string;

    const takedownId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO takedown_requests (
        id, org_id, brand_id, target_type, target_value, target_url,
        source_type, source_id, evidence_summary, evidence_detail,
        provider_name, provider_abuse_contact, provider_method,
        status, severity, priority_score, requested_by, created_at, updated_at
      ) VALUES (?, NULL, ?, 'url', ?, ?, 'url_scan', ?, ?, ?, ?, ?, ?, 'draft', ?, ?, null, datetime('now'), datetime('now'))
    `).bind(
      takedownId,
      result.brand_id as string | null,
      domain,
      url,
      String(result.id),
      `Malicious URL detected targeting ${brandName}. ${maliciousReasons.join(". ")}.`,
      `URL: ${url}\nDomain: ${domain}\nConfidence: ${Math.round(confidenceScore * 100)}%\nReasons: ${maliciousReasons.join(", ")}`,
      (provider?.provider_name as string) || null,
      (provider?.abuse_email as string) || (provider?.abuse_url as string) || null,
      (provider?.abuse_api_type as string) || "email",
      confidenceScore >= 0.8 ? "HIGH" : "MEDIUM",
      confidenceScore >= 0.8 ? 70 : 50,
    ).run();

    // Link the scan result to the takedown
    await env.DB.prepare(
      "UPDATE url_scan_results SET takedown_id = ? WHERE id = ?"
    ).bind(takedownId, result.id).run();

    // Create evidence record
    await env.DB.prepare(`
      INSERT INTO takedown_evidence (id, takedown_id, evidence_type, title, content_text, metadata_json, created_at)
      VALUES (?, ?, 'url_scan', 'URL Scan Result', ?, ?, datetime('now'))
    `).bind(
      crypto.randomUUID(),
      takedownId,
      `URL: ${url}\nDomain: ${domain}\nMalicious: Yes (${Math.round(confidenceScore * 100)}% confidence)\nReasons:\n${maliciousReasons.map((r: string) => "  - " + r).join("\n")}`,
      JSON.stringify({
        url,
        domain,
        confidence_score: confidenceScore,
        reasons: maliciousReasons,
        hosting_provider: hostingProvider,
        known_threat_id: result.known_threat_id,
        source_capture_id: result.source_id,
      }),
    ).run();

    created++;
  }

  return created;
}

// ─── Phase C: Impersonation Profiles → Takedown ────────────────────

async function createTakedownsFromImpersonations(env: Env): Promise<number> {
  const impersonations = await env.DB.prepare(`
    SELECT sp.*, b.name as brand_name
    FROM social_profiles sp
    JOIN brands b ON b.id = sp.brand_id
    WHERE sp.classification = 'impersonation'
      AND sp.status = 'active'
      AND sp.id NOT IN (
        SELECT source_id FROM takedown_requests
        WHERE source_type = 'social_profile' AND source_id IS NOT NULL
      )
    ORDER BY sp.impersonation_score DESC
    LIMIT 10
  `).all();

  let created = 0;

  for (const profile of impersonations.results) {
    const platform = ((profile.platform as string) || "").toLowerCase();
    const handle = profile.handle as string;
    const confidenceScore = (profile.impersonation_score as number) || 0;
    const brandName = profile.brand_name as string;

    // Look up platform abuse contact
    const provider = await env.DB.prepare(
      "SELECT * FROM takedown_providers WHERE provider_type = 'social_platform' AND LOWER(provider_name) LIKE ? LIMIT 1"
    ).bind(`%${platform}%`).first();

    const evidenceText = (profile.ai_evidence_draft as string)
      || (profile.ai_assessment as string)
      || `Account @${handle} on ${platform} is impersonating ${brandName}.`;

    const takedownId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO takedown_requests (
        id, org_id, brand_id, target_type, target_value, target_platform, target_url,
        source_type, source_id, evidence_summary, evidence_detail,
        provider_name, provider_abuse_contact, provider_method,
        status, severity, priority_score, requested_by, created_at, updated_at
      ) VALUES (?, NULL, ?, 'social_profile', ?, ?, ?, 'social_profile', ?, ?, ?, ?, ?, ?, 'draft', ?, ?, null, datetime('now'), datetime('now'))
    `).bind(
      takedownId,
      profile.brand_id as string,
      `@${handle}`,
      platform,
      (profile.profile_url as string) || null,
      String(profile.id),
      `Impersonation account @${handle} on ${platform} targeting ${brandName}. Confidence: ${Math.round(confidenceScore * 100)}%.`,
      evidenceText,
      (provider?.provider_name as string) || platform,
      (provider?.abuse_url as string) || null,
      (provider?.abuse_api_type as string) || "form",
      confidenceScore >= 0.8 ? "HIGH" : "MEDIUM",
      confidenceScore >= 0.8 ? 70 : 50,
    ).run();

    // Create evidence record
    await env.DB.prepare(`
      INSERT INTO takedown_evidence (id, takedown_id, evidence_type, title, content_text, metadata_json, created_at)
      VALUES (?, ?, 'ai_report', 'Social Profile Assessment', ?, ?, datetime('now'))
    `).bind(
      crypto.randomUUID(),
      takedownId,
      evidenceText,
      JSON.stringify({
        platform,
        handle,
        url: profile.profile_url,
        confidence_score: confidenceScore,
        classification: profile.classification,
        brand_name: brandName,
      }),
    ).run();

    created++;
  }

  return created;
}

// Need Env type for helper functions
import type { Env } from "../types";
