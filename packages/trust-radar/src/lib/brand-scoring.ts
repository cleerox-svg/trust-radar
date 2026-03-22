/**
 * Composite Brand Exposure Score
 *
 * Computes a weighted exposure score across five signal categories:
 * threat activity, email security, social risk, domain risk, and campaign association.
 * Updates the brands table with computed scores.
 */

import type { Env } from "../types";

const WEIGHTS = {
  threat_activity: 0.30,    // active threats targeting this brand
  email_security: 0.20,     // SPF/DKIM/DMARC posture
  social_risk: 0.25,        // social impersonation risk
  domain_risk: 0.15,        // lookalike domains
  campaign_association: 0.10, // linked to active campaigns
};

export interface BrandExposureResult {
  exposure_score: number;
  social_risk_score: number;
  domain_risk_score: number;
  threat_score: number;
  email_score: number;
  campaign_score: number;
}

export async function computeBrandExposureScore(
  env: Env,
  brandId: string,
): Promise<BrandExposureResult> {
  // 1. Threat activity score (0-100, higher = more threats = worse)
  const threatCount = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM threats WHERE target_brand_id = ? AND status = 'active'"
  ).bind(brandId).first<{ n: number }>();
  const threatScore = Math.min(100, (threatCount?.n || 0) * 5); // 20+ threats = max

  // 2. Email security score (invert grade: A=0, F=100)
  const emailGrade = await env.DB.prepare(`
    SELECT email_security_grade FROM brands WHERE id = ?
  `).bind(brandId).first<{ email_security_grade: string | null }>();

  const gradeScores: Record<string, number> = {
    'A+': 0, 'A': 10, 'A-': 15, 'B+': 20, 'B': 30, 'B-': 35,
    'C+': 40, 'C': 50, 'C-': 55, 'D+': 60, 'D': 75, 'D-': 80, 'F': 100,
  };
  const emailScore = gradeScores[emailGrade?.email_security_grade || ''] ?? 50;

  // 3. Social risk score (0-100)
  const socialProfiles = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN classification = 'impersonation' AND status = 'active' THEN 1 ELSE 0 END) AS impersonations,
      SUM(CASE WHEN classification = 'suspicious' AND status = 'active' THEN 1 ELSE 0 END) AS suspicious
    FROM social_profiles WHERE brand_id = ?
  `).bind(brandId).first<{ impersonations: number; suspicious: number }>();
  const socialScore = Math.min(100,
    (socialProfiles?.impersonations || 0) * 25 +
    (socialProfiles?.suspicious || 0) * 10
  );

  // 4. Domain risk (lookalike domains)
  const lookalikes = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM lookalike_domains WHERE brand_id = ? AND status = 'active'"
  ).bind(brandId).first<{ n: number }>();
  const domainScore = Math.min(100, (lookalikes?.n || 0) * 5);

  // 5. Campaign association
  const campaigns = await env.DB.prepare(
    "SELECT COUNT(DISTINCT t.campaign_id) AS n FROM threats t WHERE t.target_brand_id = ? AND t.campaign_id IS NOT NULL AND t.status = 'active'"
  ).bind(brandId).first<{ n: number }>();
  const campaignScore = Math.min(100, (campaigns?.n || 0) * 20);

  // Weighted composite
  const composite = Math.round(
    threatScore * WEIGHTS.threat_activity +
    emailScore * WEIGHTS.email_security +
    socialScore * WEIGHTS.social_risk +
    domainScore * WEIGHTS.domain_risk +
    campaignScore * WEIGHTS.campaign_association
  );

  // Update the brand record
  await env.DB.prepare(`
    UPDATE brands SET
      exposure_score = ?,
      social_risk_score = ?,
      domain_risk_score = ?
    WHERE id = ?
  `).bind(composite, socialScore, domainScore, brandId).run();

  return {
    exposure_score: composite,
    social_risk_score: socialScore,
    domain_risk_score: domainScore,
    threat_score: threatScore,
    email_score: emailScore,
    campaign_score: campaignScore,
  };
}
