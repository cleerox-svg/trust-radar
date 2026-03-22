/**
 * Social Profile AI Assessor
 *
 * Uses Claude Haiku to evaluate social media profiles for brand impersonation.
 * Enriches algorithmic scoring with AI-powered contextual analysis that
 * cross-references Trust Radar threat intelligence data.
 */

import { checkCostGuard } from "./haiku";
import { logger } from "./logger";
import type { Env } from "../types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";

// ─── Types ──────────────────────────────────────────────────────

export interface SocialAIAssessment {
  classification: "official" | "legitimate" | "suspicious" | "impersonation";
  confidence: number;          // 0.0-1.0
  action: "safe" | "review" | "escalate" | "takedown";
  reasoning: string;           // 2-3 sentence explanation
  evidenceDraft: string | null; // pre-written takedown request text (for impersonation only)
  signals: string[];           // list of specific signals detected
  crossCorrelations: string[]; // connections to other Trust Radar data
}

export interface ProfileContext {
  // Brand info
  brandName: string;
  brandDomain: string;
  brandAliases: string[];
  brandKeywords: string[];
  officialHandles: Record<string, string>;

  // Profile being assessed
  platform: string;
  handle: string;
  profileUrl: string;
  displayName: string | null;
  bio: string | null;
  followersCount: number | null;
  verified: boolean;
  accountCreated: string | null;

  // Trust Radar cross-references
  existingThreats: string[];
  emailSecurityGrade: string | null;
  activeCampaigns: string[];
  lookalikeDomainsFound: number;
  otherImpersonationProfiles: number;
}

// ─── Prompts ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a brand protection analyst for Trust Radar, a threat intelligence platform. You assess social media profiles to determine if they are legitimate or impersonating a brand.

You must respond ONLY with a JSON object (no markdown, no preamble) with these fields:
{
  "classification": "official" | "legitimate" | "suspicious" | "impersonation",
  "confidence": 0.0-1.0,
  "action": "safe" | "review" | "escalate" | "takedown",
  "reasoning": "2-3 sentence explanation",
  "evidence_draft": "takedown request text or null",
  "signals": ["signal1", "signal2"],
  "cross_correlations": ["correlation1"]
}

Classification definitions:
- official: This IS the brand's verified/confirmed account
- legitimate: This is a real person/org using a similar name but NOT impersonating
- suspicious: Unclear intent, possible impersonation, needs human review
- impersonation: High confidence this account is deliberately impersonating the brand

Action definitions:
- safe: No action needed
- review: Flag for human review by SOC analyst
- escalate: Alert brand owner / company analyst immediately
- takedown: Recommend filing a takedown request with the platform`;

function buildUserMessage(ctx: ProfileContext): string {
  const aliases = ctx.brandAliases.length > 0 ? ctx.brandAliases.join(", ") : "None";
  const keywords = ctx.brandKeywords.length > 0 ? ctx.brandKeywords.join(", ") : "None";
  const handles = Object.entries(ctx.officialHandles)
    .map(([p, h]) => `${p}: @${h}`)
    .join(", ") || "None configured";

  const threats = ctx.existingThreats.length > 0
    ? ctx.existingThreats.join("; ")
    : "None";
  const campaigns = ctx.activeCampaigns.length > 0
    ? ctx.activeCampaigns.join(", ")
    : "None";

  return `Assess this social media profile for potential brand impersonation.

BRAND INFORMATION:
- Brand: ${ctx.brandName}
- Official domain: ${ctx.brandDomain}
- Known aliases: ${aliases}
- Keywords: ${keywords}
- Official handles on other platforms: ${handles}

PROFILE BEING ASSESSED:
- Platform: ${ctx.platform}
- Handle: @${ctx.handle}
- Display name: ${ctx.displayName || "Unknown"}
- Bio: ${ctx.bio || "Not available"}
- Followers: ${ctx.followersCount ?? "Unknown"}
- Verified: ${ctx.verified}
- Account created: ${ctx.accountCreated || "Unknown"}
- Profile URL: ${ctx.profileUrl || "N/A"}

TRUST RADAR CONTEXT:
- Active threats targeting this brand: ${threats}
- Email security grade: ${ctx.emailSecurityGrade || "Not assessed"}
- Active phishing campaigns: ${campaigns}
- Lookalike domains detected: ${ctx.lookalikeDomainsFound}
- Other suspicious social profiles for this brand: ${ctx.otherImpersonationProfiles}

Based on all available signals, classify this profile and provide your assessment.`;
}

// ─── Validation ─────────────────────────────────────────────────

const VALID_CLASSIFICATIONS = ["official", "legitimate", "suspicious", "impersonation"] as const;
const VALID_ACTIONS = ["safe", "review", "escalate", "takedown"] as const;

interface RawAIResponse {
  classification?: string;
  confidence?: number;
  action?: string;
  reasoning?: string;
  evidence_draft?: string | null;
  signals?: string[];
  cross_correlations?: string[];
}

function validateAndNormalize(raw: RawAIResponse): SocialAIAssessment | null {
  if (!raw || typeof raw !== "object") return null;

  const classification = VALID_CLASSIFICATIONS.includes(raw.classification as typeof VALID_CLASSIFICATIONS[number])
    ? (raw.classification as SocialAIAssessment["classification"])
    : null;
  if (!classification) return null;

  const action = VALID_ACTIONS.includes(raw.action as typeof VALID_ACTIONS[number])
    ? (raw.action as SocialAIAssessment["action"])
    : null;
  if (!action) return null;

  let confidence = typeof raw.confidence === "number" ? raw.confidence : null;
  if (confidence === null) return null;
  confidence = Math.min(1, Math.max(0, confidence));

  const reasoning = typeof raw.reasoning === "string" && raw.reasoning.length > 0
    ? raw.reasoning
    : null;
  if (!reasoning) return null;

  return {
    classification,
    confidence,
    action,
    reasoning,
    evidenceDraft: classification === "impersonation" && typeof raw.evidence_draft === "string"
      ? raw.evidence_draft
      : null,
    signals: Array.isArray(raw.signals) ? raw.signals.filter(s => typeof s === "string") : [],
    crossCorrelations: Array.isArray(raw.cross_correlations)
      ? raw.cross_correlations.filter(s => typeof s === "string")
      : [],
  };
}

// ─── Main Assessment Function ───────────────────────────────────

export async function assessSocialProfile(
  env: Env,
  context: ProfileContext,
): Promise<SocialAIAssessment> {
  // Cost guard — social assessments are non-critical
  const guardMsg = await checkCostGuard(env, false);
  if (guardMsg) {
    logger.warn("social_ai_cost_guard", { message: guardMsg, handle: context.handle });
    return fallbackAssessment(context);
  }

  const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
  if (!apiKey || apiKey.startsWith("lrx_")) {
    logger.warn("social_ai_no_key", { message: "No valid Anthropic API key for social assessment" });
    return fallbackAssessment(context);
  }

  const userMessage = buildUserMessage(context);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await res.text();

    if (!res.ok) {
      logger.warn("social_ai_api_error", {
        status: res.status,
        body: responseText.slice(0, 200),
        handle: context.handle,
      });
      return fallbackAssessment(context);
    }

    const apiResponse = JSON.parse(responseText) as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const textBlock = apiResponse.content?.find((b) => b.type === "text");
    if (!textBlock) {
      logger.warn("social_ai_no_text", { handle: context.handle });
      return fallbackAssessment(context);
    }

    // Strip markdown fences if present
    let jsonText = textBlock.text.trim();
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    // Extract JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn("social_ai_no_json", { raw: jsonText.slice(0, 200), handle: context.handle });
      return fallbackAssessment(context);
    }

    const parsed = JSON.parse(jsonMatch[0]) as RawAIResponse;
    const assessment = validateAndNormalize(parsed);

    if (!assessment) {
      logger.warn("social_ai_invalid_response", { parsed, handle: context.handle });
      return fallbackAssessment(context);
    }

    // Track usage via KV (same pattern as haiku.ts trackUsage)
    try {
      const today = new Date().toISOString().slice(0, 10);
      const usageKey = `haiku_usage_${today}`;
      const val = await env.CACHE.get(usageKey);
      const current = val ? JSON.parse(val) : { calls: 0, input_tokens: 0, output_tokens: 0, agent_calls: 0, ondemand_calls: 0 };
      current.calls += 1;
      current.input_tokens += apiResponse.usage?.input_tokens ?? 0;
      current.output_tokens += apiResponse.usage?.output_tokens ?? 0;
      current.agent_calls += 1; // social_assessment runs in agent/cron context
      await env.CACHE.put(usageKey, JSON.stringify(current), { expirationTtl: 86400 * 31 });
    } catch {
      // Non-fatal — usage tracking failure shouldn't block assessment
    }

    return assessment;
  } catch (err) {
    logger.warn("social_ai_assessment_error", {
      handle: context.handle,
      error: err instanceof Error ? err.message : String(err),
    });
    return fallbackAssessment(context);
  }
}

// ─── Fallback (algorithmic-only) ────────────────────────────────

function fallbackAssessment(context: ProfileContext): SocialAIAssessment {
  // Simple heuristic fallback when AI is unavailable
  const handleLower = context.handle.toLowerCase();
  const brandLower = context.brandName.toLowerCase().replace(/[^a-z0-9]/g, "");

  const isSimilar = handleLower.includes(brandLower) || brandLower.includes(handleLower);
  const hasOfficialOnPlatform = !!context.officialHandles[context.platform];
  const isOfficialHandle = hasOfficialOnPlatform &&
    context.officialHandles[context.platform]!.toLowerCase().replace(/^@/, "") === handleLower;

  if (isOfficialHandle) {
    return {
      classification: "official",
      confidence: 0.9,
      action: "safe",
      reasoning: "This handle matches the configured official handle for this platform.",
      evidenceDraft: null,
      signals: ["Matches configured official handle"],
      crossCorrelations: [],
    };
  }

  if (isSimilar && !context.verified) {
    return {
      classification: "suspicious",
      confidence: 0.4,
      action: "review",
      reasoning: "Handle resembles brand name but AI assessment was unavailable. Flagged for manual review.",
      evidenceDraft: null,
      signals: ["Handle contains brand name", "Not verified", "AI assessment unavailable"],
      crossCorrelations: [],
    };
  }

  return {
    classification: "legitimate",
    confidence: 0.3,
    action: "safe",
    reasoning: "AI assessment was unavailable. Low-confidence algorithmic fallback applied.",
    evidenceDraft: null,
    signals: ["AI assessment unavailable — algorithmic fallback"],
    crossCorrelations: [],
  };
}
