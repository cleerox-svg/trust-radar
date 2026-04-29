/**
 * Curator Agent — Platform Hygiene & Data Quality.
 *
 * Triggered weekly by Flight Control (Sunday, low-traffic period).
 * No AI model needed — purely algorithmic (queries + API calls).
 *
 * Tasks:
 *  1. Email security scanning for brands with no grade
 *  2. Safe domain false-positive cleanup
 *  3. Social profile discovery for high-threat brands
 *
 * Outputs: agent_outputs (type: 'hygiene_report')
 */

import type { AgentModule, AgentResult, AgentContext, AgentOutputEntry } from "../lib/agentRunner";
import { runEmailSecurityScan, saveEmailSecurityScan } from "../email-security";
import { discoverSocialProfiles } from "../lib/social-discovery";

// Known-safe infrastructure domains — threats targeting these are false positives
const SAFE_DOMAINS = [
  'apple.com', 'icloud.com', 'googleapis.com', 'google.com',
  'amazon.com', 'amazonaws.com', 'microsoft.com', 'windows.net',
  'cloudflare.com', 'fastly.net', 'akamai.net', 'akamaitechnologies.com',
];

// ─── Agent Module ────────────────────────────────────────────────

export const curatorAgent: AgentModule = {
  name: "curator",
  displayName: "Curator",
  description: "Platform hygiene — email security scanning, safe domain cleanup, social discovery",
  color: "#4ADE80",
  trigger: "event",
  requiresApproval: false,
  stallThresholdMinutes: 1500,
  parallelMax: 1,
  costGuard: "enforced",
  budget: { monthlyTokenCap: 1_000_000 },
  reads: [
    { kind: "d1_table", name: "brands" },
    { kind: "d1_table", name: "social_profiles" },
  ],
  writes: [
    { kind: "d1_table", name: "brands" },
    { kind: "d1_table", name: "social_profiles" },
    { kind: "d1_table", name: "threats" },
  ],
  outputs: [],
  status: "active",

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const { env } = ctx;
    const db = env.DB;
    const outputs: AgentOutputEntry[] = [];

    const results = {
      emailScansCompleted: 0,
      falsePositivesRemoved: 0,
      socialProfilesDiscovered: 0,
    };

    // ── TASK 1: Email security scanning ──────────────────────────
    // Find brands with no email_security_grade, scan up to 500
    const unscanned = await db.prepare(`
      SELECT id, canonical_domain, name FROM brands
      WHERE email_security_grade IS NULL
      AND monitoring_tier != 'none'
      ORDER BY threat_count DESC
      LIMIT 500
    `).all<{ id: number; canonical_domain: string | null; name: string }>();

    for (const brand of unscanned.results) {
      try {
        const domain = brand.canonical_domain || brand.name.toLowerCase();
        if (!domain) continue;

        const scanResult = await runEmailSecurityScan(domain);
        await saveEmailSecurityScan(db, brand.id, scanResult);
        await db.prepare(`
          UPDATE brands
          SET email_security_score = ?, email_security_grade = ?, email_security_scanned_at = datetime('now')
          WHERE id = ?
        `).bind(scanResult.score, scanResult.grade, brand.id).run();

        results.emailScansCompleted++;
      } catch {
        // Silent fail — next weekly run picks up remainder
      }
    }

    // ── TASK 2: Safe domain false-positive cleanup ───────────────
    // Remove threats targeting known-safe infrastructure
    for (const domain of SAFE_DOMAINS) {
      try {
        const removed = await db.prepare(`
          UPDATE threats SET status = 'false_positive'
          WHERE malicious_domain LIKE ?
          AND status = 'active'
          AND threat_score < 30
        `).bind(`%.${domain}`).run();
        results.falsePositivesRemoved += removed.meta?.changes ?? 0;
      } catch {
        // Silent fail
      }
    }

    // ── TASK 3: Social profile discovery (50 brands per run) ─────
    // Find active brands with no recent social profiles
    const brandsNeedingSocial = await db.prepare(`
      SELECT b.id, b.name, b.canonical_domain
      FROM brands b
      LEFT JOIN (
        SELECT brand_id, MAX(last_checked) as last_scan
        FROM social_profiles GROUP BY brand_id
      ) sp ON sp.brand_id = b.id
      WHERE b.threat_count > 10
      AND (sp.last_scan IS NULL OR sp.last_scan < datetime('now', '-30 days'))
      ORDER BY b.threat_count DESC
      LIMIT 50
    `).all<{ id: number; name: string; canonical_domain: string | null }>();

    for (const brand of brandsNeedingSocial.results) {
      try {
        const domain = brand.canonical_domain || brand.name.toLowerCase();
        if (!domain) continue;

        const discovered = await discoverSocialProfiles(`https://${domain}`);
        for (const profile of discovered) {
          await db.prepare(`
            INSERT INTO social_profiles
              (id, brand_id, platform, handle, profile_url, classification,
               classified_by, classification_confidence, last_checked, status)
            VALUES (?, ?, ?, ?, ?, 'official', 'auto_discovery', ?, datetime('now'), 'active')
            ON CONFLICT (brand_id, platform, handle) DO UPDATE SET
              last_checked = datetime('now'),
              profile_url = excluded.profile_url
          `).bind(
            crypto.randomUUID(),
            brand.id,
            profile.platform,
            profile.handle,
            profile.profileUrl,
            profile.confidence,
          ).run();
        }

        if (discovered.length > 0) {
          results.socialProfilesDiscovered++;
        }
      } catch {
        // Silent fail
      }
    }

    // ── Log completion ───────────────────────────────────────────
    const summaryText =
      `Curator weekly hygiene: ` +
      `${results.emailScansCompleted} email scans, ` +
      `${results.falsePositivesRemoved} false positives removed, ` +
      `${results.socialProfilesDiscovered} brands with new social profiles`;

    outputs.push({
      type: 'hygiene_report',
      summary: summaryText,
      severity: 'info',
      details: results,
    });

    return {
      itemsProcessed: results.emailScansCompleted + results.socialProfilesDiscovered,
      itemsCreated: results.socialProfilesDiscovered,
      itemsUpdated: results.emailScansCompleted + results.falsePositivesRemoved,
      output: results,
      agentOutputs: outputs,
    };
  },
};
