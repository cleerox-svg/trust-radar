/**
 * App Store Impersonation Monitoring
 *
 * Classifies candidate apps pulled from the iTunes Search API against a
 * brand's allowlist + name. Pure classification logic lives here; the
 * per-brand scanner, batch runner, and AI fallback are added in subsequent
 * slices.
 */

import { nameSimilarity } from "./impersonation-scorer";
import type { ITunesApp } from "../feeds/itunes";

// ─── Types ──────────────────────────────────────────────────────

export type AppClassification =
  | "official"      // exact bundle-ID match to brands.official_apps
  | "legitimate"   // same developer as an official app (sibling product)
  | "impersonation" // strong signals the app is pretending to be the brand
  | "suspicious"   // ambiguous — send to AI fallback
  | "unknown";     // no match at all (caller should usually skip)

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface OfficialApp {
  platform: "ios" | "google_play" | string;
  app_id?: string;
  bundle_id?: string;
  developer_name?: string;
  developer_id?: string;
}

export interface BrandContext {
  name: string;
  domain: string | null;
  aliases: string[];
  brand_keywords: string[];
  official_apps: OfficialApp[];
}

export interface ClassificationResult {
  classification: AppClassification;
  confidence: number;           // 0.0 – 1.0
  impersonation_score: number;  // 0.0 – 1.0 (0 when official/legitimate)
  severity: Severity;
  signals: string[];
  reason: string;
  /** True when the result is ambiguous enough that Haiku should weigh in. */
  needs_ai_review: boolean;
}

// ─── Classifier ─────────────────────────────────────────────────

/**
 * Classify a candidate iTunes app against a brand's allowlist and name.
 *
 * Rule order (first match wins):
 *   1. Bundle-ID hit on official_apps         → official
 *   2. Developer-name hit on official_apps    → legitimate
 *   3. Strong brand-name signal + unknown dev → impersonation
 *   4. Moderate brand signal                  → suspicious  (AI review)
 *   5. Otherwise                              → unknown     (caller skips)
 */
export function classifyApp(
  brand: BrandContext,
  app: ITunesApp,
  store: string = "ios",
): ClassificationResult {
  const brandName = brand.name.trim();
  const appName = (app.app_name ?? "").trim();
  const devName = (app.developer_name ?? "").trim();

  const signals: string[] = [];

  // Normalize allowlist entries for the store we're classifying against.
  const storeOfficials = brand.official_apps.filter(
    (o) => !o.platform || o.platform === store,
  );

  // 1. Bundle-ID exact match → official.
  if (app.bundle_id) {
    const bundleHit = storeOfficials.find(
      (o) => o.bundle_id && o.bundle_id.toLowerCase() === app.bundle_id!.toLowerCase(),
    );
    if (bundleHit) {
      return {
        classification: "official",
        confidence: 1.0,
        impersonation_score: 0,
        severity: "LOW",
        signals: ["bundle_id_match"],
        reason: `Bundle ID ${app.bundle_id} matches official app allowlist.`,
        needs_ai_review: false,
      };
    }
  }

  // App-ID (trackId) match as a secondary allowlist path.
  if (app.app_id) {
    const idHit = storeOfficials.find((o) => o.app_id === app.app_id);
    if (idHit) {
      return {
        classification: "official",
        confidence: 1.0,
        impersonation_score: 0,
        severity: "LOW",
        signals: ["app_id_match"],
        reason: `App ID ${app.app_id} matches official app allowlist.`,
        needs_ai_review: false,
      };
    }
  }

  // 2. Same developer as any official app → legitimate sibling.
  if (devName) {
    const devLower = devName.toLowerCase();
    const devHit = storeOfficials.find(
      (o) =>
        (o.developer_name && o.developer_name.toLowerCase() === devLower) ||
        (o.developer_id && app.developer_id && o.developer_id === app.developer_id),
    );
    if (devHit) {
      return {
        classification: "legitimate",
        confidence: 0.9,
        impersonation_score: 0,
        severity: "LOW",
        signals: ["developer_match"],
        reason: `Published by the same developer ("${devName}") as an allowlisted app.`,
        needs_ai_review: false,
      };
    }
  }

  // 3 & 4: brand-name signals against unknown developer.
  const brandTokens = [
    brandName,
    ...brand.aliases,
    ...brand.brand_keywords,
    ...(brand.domain ? [brand.domain.split(".")[0] ?? ""] : []),
  ]
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 3);

  const appNameLower = appName.toLowerCase();
  const devNameLower = devName.toLowerCase();

  const keywordInAppName = brandTokens.some((kw) => appNameLower.includes(kw));
  const keywordInDevName = brandTokens.some((kw) => devNameLower.includes(kw));
  const nameSim = nameSimilarity(brandName, appName);
  const devSim = devName ? nameSimilarity(brandName, devName) : 0;

  if (keywordInAppName) signals.push("brand_keyword_in_app_name");
  if (keywordInDevName) signals.push("brand_keyword_in_developer_name");
  if (nameSim >= 0.85) signals.push("high_name_similarity");
  else if (nameSim >= 0.6) signals.push("moderate_name_similarity");
  if (devSim >= 0.85) signals.push("developer_name_mimics_brand");

  // Free apps impersonating a paid brand product, or vice-versa, is a minor signal.
  if (app.price === 0 && storeOfficials.some((o) => o.platform === store)) {
    signals.push("free_vs_official");
  }

  // Low rating count + high name similarity is a classic fake-app signature.
  const ratingCount = app.rating_count ?? 0;
  if (ratingCount < 50 && nameSim >= 0.7) {
    signals.push("low_review_volume");
  }

  // 3. Strong impersonation signal.
  const strongImpersonation =
    (nameSim >= 0.85 && keywordInAppName) ||
    (keywordInAppName && keywordInDevName && devSim < 0.85);

  if (strongImpersonation) {
    // Escalate to CRITICAL when the dev name itself mimics the brand.
    const critical = devSim >= 0.85 || (nameSim >= 0.95 && ratingCount < 100);
    const score = Math.min(1, 0.75 + nameSim * 0.2);
    return {
      classification: "impersonation",
      confidence: 0.9,
      impersonation_score: score,
      severity: critical ? "CRITICAL" : "HIGH",
      signals,
      reason: `Unknown developer "${devName || "?"}" published "${appName}" with brand keywords and ${(nameSim * 100).toFixed(0)}% name similarity.`,
      needs_ai_review: false,
    };
  }

  // 4. Moderate signal → suspicious, defer to AI.
  const moderate = keywordInAppName || keywordInDevName || nameSim >= 0.6;
  if (moderate) {
    const score = Math.max(0.3, nameSim * 0.7 + (keywordInAppName ? 0.15 : 0));
    return {
      classification: "suspicious",
      confidence: 0.5,
      impersonation_score: Math.min(0.75, score),
      severity: "MEDIUM",
      signals,
      reason: `Brand signal present but developer "${devName || "?"}" is unknown — ambiguous.`,
      needs_ai_review: true,
    };
  }

  // 5. No meaningful match.
  return {
    classification: "unknown",
    confidence: 0.1,
    impersonation_score: 0,
    severity: "LOW",
    signals: [],
    reason: "No brand signal matched.",
    needs_ai_review: false,
  };
}
