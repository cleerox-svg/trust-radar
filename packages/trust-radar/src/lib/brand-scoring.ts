/**
 * Composite Brand Exposure Score
 *
 * Computes a weighted exposure score across seven signal categories:
 * threat activity, email security, social risk, domain risk, campaign
 * association, app-store risk, and dark-web risk.
 * Updates the brands table with computed scores.
 */

import type { Env } from "../types";

const WEIGHTS = {
  threat_activity: 0.24,       // active threats targeting this brand
  email_security: 0.16,        // SPF/DKIM/DMARC posture
  social_risk: 0.20,           // social impersonation risk
  domain_risk: 0.12,           // lookalike domains
  campaign_association: 0.08,  // linked to active campaigns
  app_store_risk: 0.10,        // mobile-app impersonation (iOS; Google Play later)
  dark_web_risk: 0.10,         // paste-archive mentions (Telegram / HIBP / Flare later)
};

export interface BrandExposureResult {
  exposure_score: number;
  social_risk_score: number;
  domain_risk_score: number;
  threat_score: number;
  email_score: number;
  campaign_score: number;
  app_store_score: number;
  dark_web_score: number;
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

  // 6. App-store risk — mobile-app impersonations (iOS; Play later).
  //    Single query; table may have no rows for new brands.
  const appStoreCounts = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN classification = 'impersonation' AND status = 'active' THEN 1 ELSE 0 END) AS impersonations,
      SUM(CASE WHEN classification = 'suspicious'   AND status = 'active' THEN 1 ELSE 0 END) AS suspicious
    FROM app_store_listings WHERE brand_id = ?
  `).bind(brandId).first<{ impersonations: number; suspicious: number }>();
  const appStoreScore = Math.min(100,
    (appStoreCounts?.impersonations || 0) * 25 +
    (appStoreCounts?.suspicious || 0) * 10
  );

  // 7. Dark-web risk — paste-archive mentions (Telegram / HIBP / Flare later).
  //    Confirmed weighs heavier than suspicious; severity already filters the
  //    feed before rows land here, so we don't double-weight by severity.
  const darkWebCounts = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN classification = 'confirmed'  AND status = 'active' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN classification = 'suspicious' AND status = 'active' THEN 1 ELSE 0 END) AS suspicious
    FROM dark_web_mentions WHERE brand_id = ?
  `).bind(brandId).first<{ confirmed: number; suspicious: number }>();
  const darkWebScore = Math.min(100,
    (darkWebCounts?.confirmed || 0) * 20 +
    (darkWebCounts?.suspicious || 0) * 5
  );

  // Weighted composite
  const composite = Math.round(
    threatScore * WEIGHTS.threat_activity +
    emailScore * WEIGHTS.email_security +
    socialScore * WEIGHTS.social_risk +
    domainScore * WEIGHTS.domain_risk +
    campaignScore * WEIGHTS.campaign_association +
    appStoreScore * WEIGHTS.app_store_risk +
    darkWebScore * WEIGHTS.dark_web_risk
  );

  // Update the brand record. app_store_score and dark_web_score are not
  // persisted as dedicated columns yet — we expose them in the return type
  // for callers that want the per-category breakdown. If a future migration
  // adds columns, they can be bound here alongside existing risk fields.
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
    app_store_score: appStoreScore,
    dark_web_score: darkWebScore,
  };
}
