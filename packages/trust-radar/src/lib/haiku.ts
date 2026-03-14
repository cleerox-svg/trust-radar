/**
 * Haiku Integration — Direct Anthropic Messages API client.
 *
 * Calls the Anthropic API directly using the Messages API format.
 * Uses claude-haiku-4-5-20251001 for fast, cheap threat analysis.
 */

import type { Env } from "../types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";

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

// ─── Core Anthropic API caller ──────────────────────────────────

async function callAnthropic<T>(
  env: Env,
  systemPrompt: string,
  userMessage: string,
): Promise<HaikuResponse<T>> {
  // Support both secret names: ANTHROPIC_API_KEY (preferred) or LRX_API_KEY (legacy)
  const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
  const keySource = env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : env.LRX_API_KEY ? "LRX_API_KEY" : "NONE";

  if (!apiKey) {
    console.error("[haiku] No API key found — set ANTHROPIC_API_KEY in Cloudflare secrets (wrangler secret put ANTHROPIC_API_KEY)");
    return { success: false, error: "No Anthropic API key configured (checked ANTHROPIC_API_KEY and LRX_API_KEY)" };
  }

  if (apiKey.startsWith("lrx_")) {
    console.error("[haiku] LRX_API_KEY contains an LRX proxy key (lrx_...) which does not work with api.anthropic.com. Set ANTHROPIC_API_KEY to a real Anthropic key (sk-ant-...)");
    return { success: false, error: "LRX_API_KEY is an LRX proxy key — need an Anthropic API key (sk-ant-...). Run: wrangler secret put ANTHROPIC_API_KEY" };
  }

  const body = {
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };

  console.log(`[haiku] POST ${ANTHROPIC_API_URL} model=${MODEL} key_source=${keySource} key_prefix=${apiKey.slice(0, 8)}...`);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await res.text();
    console.log(`[haiku] Response: HTTP ${res.status} (${responseText.length} bytes)`);

    if (!res.ok) {
      console.error(`[haiku] API error: HTTP ${res.status}: ${responseText.slice(0, 500)}`);
      return { success: false, error: `Anthropic HTTP ${res.status}: ${responseText.slice(0, 200)}` };
    }

    const apiResponse = JSON.parse(responseText) as {
      content: Array<{ type: string; text: string }>;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    const textBlock = apiResponse.content.find((b) => b.type === "text");
    if (!textBlock) {
      console.error("[haiku] No text block in response:", JSON.stringify(apiResponse.content).slice(0, 200));
      return { success: false, error: "No text content in Anthropic response" };
    }

    // Parse the JSON from the response text
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[haiku] No JSON found in response text:", textBlock.text.slice(0, 200));
      return { success: false, error: "No JSON in Anthropic response text" };
    }

    const parsed = JSON.parse(jsonMatch[0]) as T;
    return {
      success: true,
      data: parsed,
      model: apiResponse.model,
      tokens_used: apiResponse.usage.input_tokens + apiResponse.usage.output_tokens,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[haiku] Request failed:`, errMsg);
    return { success: false, error: errMsg };
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
  const systemPrompt = `You are a cybersecurity threat classifier. Analyze the given threat indicator and classify it.
Respond with ONLY a JSON object (no markdown, no explanation outside the JSON) with these fields:
- threat_type: one of "phishing", "typosquatting", "impersonation", "malware_distribution", "credential_harvesting"
- confidence: number 0-100
- severity: one of "critical", "high", "medium", "low", "info"
- reasoning: brief explanation
- ioc_indicators: array of notable IOC patterns found`;

  const userMessage = `Classify this threat:
- URL: ${threat.malicious_url ?? "N/A"}
- Domain: ${threat.malicious_domain ?? "N/A"}
- IP: ${threat.ip_address ?? "N/A"}
- Source Feed: ${threat.source_feed}
- IOC Value: ${threat.ioc_value ?? "N/A"}`;

  return callAnthropic<HaikuClassification>(env, systemPrompt, userMessage);
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
  const systemPrompt = `You are a brand impersonation detector. Analyze the threat indicator and determine which brand is being targeted/impersonated.
Respond with ONLY a JSON object (no markdown, no explanation outside the JSON) with these fields:
- brand_name: the brand being targeted (use official name)
- confidence: number 0-100 (use 0 if no brand match)
- reasoning: brief explanation
- matched_indicators: array of indicators that suggest brand targeting`;

  const brandList = knownBrands.length > 0
    ? `Known brands in our database: ${knownBrands.slice(0, 50).join(", ")}`
    : "No known brands in database yet.";

  const userMessage = `${brandList}

Identify the targeted brand for this threat:
- URL: ${threat.malicious_url ?? "N/A"}
- Domain: ${threat.malicious_domain ?? "N/A"}
- Page Title: ${threat.page_title ?? "N/A"}
- Source Feed: ${threat.source_feed}`;

  return callAnthropic<HaikuBrandMatch>(env, systemPrompt, userMessage);
}

// ─── Daily Insight Generation ────────────────────────────────────

export async function generateInsight(
  env: Env,
  context: {
    period: string;
    threats_summary: Record<string, unknown>;
    top_brands: Array<{ name: string; count: number }>;
    top_providers: Array<{ name: string; count: number }>;
    trend_data: Record<string, unknown>;
  },
): Promise<HaikuResponse<HaikuInsight>> {
  const systemPrompt = `You are a threat intelligence analyst. Generate an executive intelligence briefing from the data provided.
Respond with ONLY a JSON object (no markdown, no explanation outside the JSON) with these fields:
- title: brief title for the insight
- summary: 2-3 sentence executive summary
- severity: one of "critical", "high", "medium", "low", "info"
- details: object with key findings
- recommendations: array of actionable recommendations`;

  const userMessage = `Generate a ${context.period} threat intelligence briefing:
${JSON.stringify(context, null, 2)}`;

  return callAnthropic<HaikuInsight>(env, systemPrompt, userMessage);
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
  const systemPrompt = `You are a hosting provider reputation analyst. Score the hosting provider based on their threat hosting metrics.
Respond with ONLY a JSON object (no markdown, no explanation outside the JSON) with these fields:
- provider_name: the provider name
- reputation_score: number 0-100 (100 = excellent, 0 = terrible)
- reasoning: brief explanation
- risk_factors: array of notable risk factors
- response_assessment: assessment of their abuse response`;

  const userMessage = `Score this hosting provider's reputation:
${JSON.stringify(provider, null, 2)}`;

  return callAnthropic<HaikuProviderScore>(env, systemPrompt, userMessage);
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
  const systemPrompt = `You are a cybersecurity threat classifier. Classify each threat in the batch.
Respond with ONLY a JSON array (no markdown) where each element has:
- id: the threat id
- classification: object with threat_type, confidence (0-100), severity, reasoning, ioc_indicators`;

  const userMessage = `Classify these ${threats.length} threats:\n${JSON.stringify(threats, null, 2)}`;

  // Wrap array response parsing
  const result = await callAnthropic<Array<{ id: string; classification: HaikuClassification }>>(
    env, systemPrompt, userMessage,
  );
  return result;
}

// ─── Generic Analysis ────────────────────────────────────────────

export async function analyzeWithHaiku(
  env: Env,
  prompt: string,
  context: Record<string, unknown>,
): Promise<HaikuResponse<{ response: string; structured?: Record<string, unknown> }>> {
  const systemPrompt = `You are a cybersecurity analyst. Analyze the provided data and respond with a JSON object containing:
- response: your analysis as a string
- structured: optional object with any structured findings`;

  const userMessage = `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`;

  return callAnthropic(env, systemPrompt, userMessage);
}
