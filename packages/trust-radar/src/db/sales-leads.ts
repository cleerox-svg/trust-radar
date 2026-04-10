/**
 * Data access layer — sales_leads table.
 *
 * Typed query functions for the Pathfinder agent pipeline.
 * Replaces inline INSERT/UPDATE/SELECT in agents/pathfinder.ts.
 */

import type { SalesLead, CreateLeadInput, EnrichLeadInput, Env } from "../types";

// Re-export for consumers that import from db/sales-leads
export type { SalesLead, CreateLeadInput, EnrichLeadInput };

// ─── Queries ──────────────────────────────────────────────────────

/**
 * Insert a new lead and return its auto-incremented ID.
 * Used by the Prospector agent after scoring a brand candidate.
 */
export async function createLead(env: Env, input: CreateLeadInput): Promise<number> {
  const result = await env.DB.prepare(`
    INSERT INTO sales_leads (
      brand_id, prospect_score, score_breakdown_json, status,
      company_name, company_domain,
      email_security_grade, threat_count_30d, phishing_urls_active,
      trap_catches_30d, composite_risk_score, pitch_angle, findings_summary,
      identified_by, ai_enriched,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
  `).bind(
    input.brand_id,
    input.prospect_score,
    input.score_breakdown_json ?? null,
    input.company_name ?? null,
    input.company_domain ?? null,
    input.email_security_grade ?? null,
    input.threat_count_30d ?? null,
    input.phishing_urls_active ?? null,
    input.trap_catches_30d ?? null,
    input.composite_risk_score ?? null,
    input.pitch_angle ?? null,
    input.findings_summary ?? null,
    input.identified_by ?? 'pathfinder_agent',
  ).run();
  return result.meta?.last_row_id as number;
}

/**
 * Fetch the highest-scored lead that hasn't been AI-enriched yet.
 * Used by the Prospector's Phase 2 enrichment loop.
 */
export async function getUnenrichedLead(env: Env): Promise<SalesLead | null> {
  return env.DB.prepare(
    "SELECT * FROM sales_leads WHERE ai_enriched = 0 ORDER BY prospect_score DESC LIMIT 1"
  ).first<SalesLead>();
}

/**
 * Mark a lead as AI-enriched with summary, outreach variants, and research data.
 */
export async function enrichLead(
  env: Env,
  leadId: number,
  data: EnrichLeadInput,
): Promise<void> {
  await env.DB.prepare(`
    UPDATE sales_leads SET
      findings_summary = ?,
      outreach_variant_1 = ?,
      outreach_variant_2 = ?,
      research_json = ?,
      ai_enriched = 1,
      ai_enriched_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(
    data.findings_summary,
    data.outreach_variant_1,
    data.outreach_variant_2,
    data.research_json,
    leadId,
  ).run();
}

export async function getLeadById(env: Env, id: number): Promise<SalesLead | null> {
  return env.DB.prepare("SELECT * FROM sales_leads WHERE id = ?")
    .bind(id)
    .first<SalesLead>();
}

export async function getLeadByBrandId(env: Env, brandId: string): Promise<SalesLead | null> {
  return env.DB.prepare(
    "SELECT * FROM sales_leads WHERE brand_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(brandId).first<SalesLead>();
}
