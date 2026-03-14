/**
 * Haiku Integration — Railway FastAPI client for Claude Haiku AI analysis.
 *
 * All AI analysis flows through the Railway-hosted FastAPI backend
 * which proxies to Claude Haiku. This module provides typed wrappers
 * for each analysis endpoint.
 */

import type { Env } from "../types";

// ─── Response types ──────────────────────────────────────────────

export interface HaikuClassification {
  threat_type: string;
  confidence: number;      // 0-100
  severity: string;        // critical, high, medium, low, info
  reasoning: string;
  ioc_indicators: string[];
}

export interface HaikuBrandMatch {
  brand_name: string;
  confidence: number;      // 0-100
  reasoning: string;
  matched_indicators: string[];
}

export interface HaikuInsight {
  title: string;
  summary: string;
  severity: string;
  details: Record<string, unknown>;
  recommendations: string[];
}

export interface HaikuProviderScore {
  provider_name: string;
  reputation_score: number; // 0-100
  reasoning: string;
  risk_factors: string[];
  response_assessment: string;
}

interface HaikuResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  model?: string;
  tokens_used?: number;
}

// ─── Client ──────────────────────────────────────────────────────

async function callHaiku<T>(
  env: Env,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<HaikuResponse<T>> {
  if (!env.LRX_API_URL || !env.LRX_API_KEY) {
    return { success: false, error: "LRX_API_URL or LRX_API_KEY not configured" };
  }

  try {
    const res = await fetch(`${env.LRX_API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": env.LRX_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as HaikuResponse<T>;
    return data;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Threat Classification ───────────────────────────────────────

export async function classifyThreat(
  env: Env,
  threat: {
    malicious_url?: string | null;
    malicious_domain?: string | null;
    ip_address?: string | null;
    source_feed: string;
    ioc_value?: string | null;
  },
): Promise<HaikuResponse<HaikuClassification>> {
  return callHaiku<HaikuClassification>(env, "/api/ai/classify-threat", { threat });
}

// ─── Brand Inference ─────────────────────────────────────────────

export async function inferBrand(
  env: Env,
  threat: {
    malicious_url?: string | null;
    malicious_domain?: string | null;
    page_title?: string | null;
    source_feed: string;
  },
  knownBrands: string[],
): Promise<HaikuResponse<HaikuBrandMatch>> {
  return callHaiku<HaikuBrandMatch>(env, "/api/ai/infer-brand", {
    threat,
    known_brands: knownBrands,
  });
}

// ─── Daily Insight Generation ────────────────────────────────────

export async function generateInsight(
  env: Env,
  context: {
    period: string;           // "daily" | "weekly"
    threats_summary: Record<string, unknown>;
    top_brands: Array<{ name: string; count: number }>;
    top_providers: Array<{ name: string; count: number }>;
    trend_data: Record<string, unknown>;
  },
): Promise<HaikuResponse<HaikuInsight>> {
  return callHaiku<HaikuInsight>(env, "/api/ai/generate-insight", context);
}

// ─── Provider Reputation Scoring ─────────────────────────────────

export async function scoreProvider(
  env: Env,
  provider: {
    name: string;
    asn: string | null;
    active_threats: number;
    total_threats: number;
    avg_response_time: number | null;
    threat_types: Record<string, number>;
    trend_7d: number;
    trend_30d: number;
  },
): Promise<HaikuResponse<HaikuProviderScore>> {
  return callHaiku<HaikuProviderScore>(env, "/api/ai/score-provider", { provider });
}

// ─── Batch Classification ────────────────────────────────────────

export async function batchClassify(
  env: Env,
  threats: Array<{
    id: string;
    malicious_url?: string | null;
    malicious_domain?: string | null;
    ip_address?: string | null;
    source_feed: string;
    ioc_value?: string | null;
  }>,
): Promise<HaikuResponse<Array<{ id: string; classification: HaikuClassification }>>> {
  return callHaiku(env, "/api/ai/batch-classify", { threats });
}

// ─── Generic Analysis ────────────────────────────────────────────

export async function analyzeWithHaiku(
  env: Env,
  prompt: string,
  context: Record<string, unknown>,
): Promise<HaikuResponse<{ response: string; structured?: Record<string, unknown> }>> {
  return callHaiku(env, "/api/ai/analyze", { prompt, context });
}
