/**
 * App Store Impersonation Monitoring
 *
 * Classifies candidate apps pulled from the iTunes Search API against a
 * brand's allowlist + name. Pure classification logic + a per-brand scanner
 * that upserts into `app_store_listings` and raises alerts on HIGH/CRITICAL
 * findings. The Haiku fallback for ambiguous rows and the batch/cron runner
 * are added in subsequent slices.
 */

import { nameSimilarity } from "./impersonation-scorer";
import { searchITunesApps, type ITunesApp } from "../feeds/itunes";
import { createAlert } from "../lib/alerts";
import { deliverWebhook } from "../lib/webhooks";
import { logger } from "../lib/logger";
import type { Env } from "../types";

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

// ─── Single-Brand Scanner ───────────────────────────────────────

export interface BrandRow {
  id: string;
  name: string;
  domain: string | null;
  aliases: string | null;         // JSON array
  brand_keywords: string | null;  // JSON array
  official_apps: string | null;   // JSON array of OfficialApp
}

export interface AppStoreScanResult {
  listing_id: string;
  store: string;
  app_id: string;
  app_name: string;
  developer_name: string | null;
  classification: AppClassification;
  severity: Severity;
  impersonation_score: number;
  alert_id: string | null;
}

const STORE_IOS = "ios";
const MAX_DESCRIPTION_CHARS = 1500;
const SEARCH_LIMIT = 50;

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function buildBrandContext(brand: BrandRow): BrandContext {
  return {
    name: brand.name,
    domain: brand.domain,
    aliases: parseJsonArray<string>(brand.aliases),
    brand_keywords: parseJsonArray<string>(brand.brand_keywords),
    official_apps: parseJsonArray<OfficialApp>(brand.official_apps),
  };
}

/**
 * Run the iOS App Store monitor for a single brand.
 * Searches iTunes for the brand name, classifies each hit, upserts into
 * `app_store_listings`, and creates HIGH/CRITICAL alerts.
 *
 * Caller drives ownership checks; this function trusts the brand row.
 */
export async function runAppStoreMonitorForBrand(
  env: Env,
  brand: BrandRow,
  opts: { userId?: string | null; triggeredBy?: string } = {},
): Promise<AppStoreScanResult[]> {
  const ctx = buildBrandContext(brand);
  const results: AppStoreScanResult[] = [];

  let apps: ITunesApp[] = [];
  try {
    apps = await searchITunesApps(brand.name, { limit: SEARCH_LIMIT });
  } catch (err) {
    logger.warn("app_store_monitor_search_error", {
      brand_id: brand.id,
      brand_name: brand.name,
      error: err instanceof Error ? err.message : String(err),
    });
    return results;
  }

  // Resolve alert recipient once — same fallback as social-monitor.
  let alertUserId = opts.userId ?? null;
  if (!alertUserId) {
    const monitoredBy = await env.DB.prepare(
      "SELECT added_by FROM monitored_brands WHERE brand_id = ? LIMIT 1",
    ).bind(brand.id).first<{ added_by: string }>();
    alertUserId = monitoredBy?.added_by ?? null;
  }

  // Resolve org for webhooks.
  const orgRow = await env.DB.prepare(
    "SELECT org_id FROM org_brands WHERE brand_id = ? LIMIT 1",
  ).bind(brand.id).first<{ org_id: number }>();

  for (const app of apps) {
    const verdict = classifyApp(ctx, app, STORE_IOS);
    if (verdict.classification === "unknown") continue;

    const listingId = crypto.randomUUID();
    const description = app.description
      ? app.description.slice(0, MAX_DESCRIPTION_CHARS)
      : null;

    // Upsert — preserve manual classifications and prior status transitions.
    await env.DB.prepare(`
      INSERT INTO app_store_listings (
        id, brand_id, store, app_id, bundle_id, app_name, developer_name,
        developer_id, seller_url, app_url, icon_url,
        price, currency, rating, rating_count, release_date, store_updated_at,
        version, categories, description,
        classification, classified_by, classification_confidence, classification_reason,
        impersonation_score, impersonation_signals, severity, status, last_checked
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, 'system', ?, ?,
        ?, ?, ?, 'active', datetime('now')
      )
      ON CONFLICT (brand_id, store, app_id) DO UPDATE SET
        bundle_id         = excluded.bundle_id,
        app_name          = excluded.app_name,
        developer_name    = excluded.developer_name,
        developer_id      = excluded.developer_id,
        seller_url        = excluded.seller_url,
        app_url           = excluded.app_url,
        icon_url          = excluded.icon_url,
        price             = excluded.price,
        currency          = excluded.currency,
        rating            = excluded.rating,
        rating_count      = excluded.rating_count,
        release_date      = excluded.release_date,
        store_updated_at  = excluded.store_updated_at,
        version           = excluded.version,
        categories        = excluded.categories,
        description       = excluded.description,
        classification    = CASE
          WHEN app_store_listings.classified_by = 'manual' THEN app_store_listings.classification
          ELSE excluded.classification
        END,
        classified_by     = CASE
          WHEN app_store_listings.classified_by = 'manual' THEN app_store_listings.classified_by
          ELSE 'system'
        END,
        classification_confidence = CASE
          WHEN app_store_listings.classified_by = 'manual' THEN app_store_listings.classification_confidence
          ELSE excluded.classification_confidence
        END,
        classification_reason = CASE
          WHEN app_store_listings.classified_by = 'manual' THEN app_store_listings.classification_reason
          ELSE excluded.classification_reason
        END,
        impersonation_score   = excluded.impersonation_score,
        impersonation_signals = excluded.impersonation_signals,
        severity              = excluded.severity,
        last_checked          = datetime('now'),
        updated_at            = datetime('now')
    `).bind(
      listingId, brand.id, STORE_IOS, app.app_id, app.bundle_id, app.app_name, app.developer_name,
      app.developer_id, app.seller_url, app.app_url, app.icon_url,
      app.price, app.currency, app.rating, app.rating_count, app.release_date, app.store_updated_at,
      app.version, JSON.stringify(app.categories), description,
      verdict.classification, verdict.confidence, verdict.reason,
      verdict.impersonation_score, JSON.stringify(verdict.signals), verdict.severity,
    ).run();

    // Alert on HIGH/CRITICAL impersonation findings.
    let alertId: string | null = null;
    if (
      (verdict.severity === "HIGH" || verdict.severity === "CRITICAL") &&
      verdict.classification === "impersonation" &&
      alertUserId
    ) {
      try {
        alertId = await createAlert(env.DB, {
          brandId: brand.id,
          userId: alertUserId,
          alertType: "app_store_impersonation",
          severity: verdict.severity,
          title: `${verdict.severity === "CRITICAL" ? "Likely" : "Possible"} impersonation app on iOS App Store: "${app.app_name}"`,
          summary: `App "${app.app_name}" by "${app.developer_name ?? "unknown developer"}" on the iOS App Store appears to impersonate ${brand.name}. Impersonation score: ${(verdict.impersonation_score * 100).toFixed(0)}%.`,
          details: {
            store: STORE_IOS,
            app_id: app.app_id,
            bundle_id: app.bundle_id,
            app_name: app.app_name,
            developer_name: app.developer_name,
            app_url: app.app_url,
            impersonation_score: verdict.impersonation_score,
            signals: verdict.signals,
            reason: verdict.reason,
          },
          sourceType: "app_store_monitor",
          sourceId: listingId,
        });

        if (orgRow?.org_id) {
          deliverWebhook(env, orgRow.org_id, "alert.created", {
            alert_id: alertId,
            brand_name: brand.name,
            brand_domain: brand.domain,
            severity: verdict.severity,
            title: `Possible impersonation app: "${app.app_name}"`,
            alert_type: "app_store_impersonation",
            store: STORE_IOS,
            app_id: app.app_id,
            app_url: app.app_url,
            impersonation_score: verdict.impersonation_score,
          }).catch(() => {});
        }
      } catch (alertErr) {
        logger.error("app_store_monitor_alert_error", {
          brand_id: brand.id,
          app_id: app.app_id,
          error: alertErr instanceof Error ? alertErr.message : String(alertErr),
        });
      }
    }

    results.push({
      listing_id: listingId,
      store: STORE_IOS,
      app_id: app.app_id,
      app_name: app.app_name,
      developer_name: app.developer_name,
      classification: verdict.classification,
      severity: verdict.severity,
      impersonation_score: verdict.impersonation_score,
      alert_id: alertId,
    });
  }

  logger.info("app_store_monitor_brand_complete", {
    brand_id: brand.id,
    brand_name: brand.name,
    apps_returned: apps.length,
    rows_written: results.length,
    triggered_by: opts.triggeredBy ?? "unknown",
  });

  return results;
}
