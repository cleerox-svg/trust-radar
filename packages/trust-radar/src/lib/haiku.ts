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

// ─── Daily cost guard & usage tracking ───────────────────────────

const DAILY_LIMIT = 500;

interface DailyUsage {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  agent_calls: number;
  ondemand_calls: number;
}

function usageKey(date: string): string { return `haiku_usage_${date}`; }

export async function getDailyUsage(env: Env, date?: string): Promise<DailyUsage> {
  const d = date || new Date().toISOString().slice(0, 10);
  const val = await env.CACHE.get(usageKey(d));
  if (!val) return { calls: 0, input_tokens: 0, output_tokens: 0, agent_calls: 0, ondemand_calls: 0 };
  try { return JSON.parse(val) as DailyUsage; } catch { return { calls: 0, input_tokens: 0, output_tokens: 0, agent_calls: 0, ondemand_calls: 0 }; }
}

async function trackUsage(
  env: Env,
  inputTokens: number,
  outputTokens: number,
  category: "agent" | "on_demand",
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const current = await getDailyUsage(env, today);
  current.calls += 1;
  current.input_tokens += inputTokens;
  current.output_tokens += outputTokens;
  if (category === "agent") current.agent_calls += 1;
  else current.ondemand_calls += 1;
  await env.CACHE.put(usageKey(today), JSON.stringify(current), { expirationTtl: 86400 * 31 });
}

export async function checkCostGuard(env: Env, critical: boolean): Promise<string | null> {
  const usage = await getDailyUsage(env);
  if (usage.calls >= DAILY_LIMIT && !critical) {
    console.warn(`[haiku] Daily limit reached (${usage.calls}/${DAILY_LIMIT}), non-critical call paused`);
    return `Daily Haiku limit reached (${usage.calls}/${DAILY_LIMIT}), non-critical calls paused`;
  }
  return null;
}

// Current Haiku call category context — set by agents before calling
let _currentCategory: "agent" | "on_demand" = "agent";
export function setHaikuCategory(cat: "agent" | "on_demand"): void { _currentCategory = cat; }

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
    await trackUsage(env, apiResponse.usage.input_tokens, apiResponse.usage.output_tokens, _currentCategory);
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

// ─── Raw text caller (for YES/NO style prompts) ─────────────────

export async function callHaikuRaw(
  env: Env,
  systemPrompt: string,
  userMessage: string,
): Promise<{ success: boolean; text?: string; error?: string; tokens_used?: number }> {
  const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;
  if (!apiKey || apiKey.startsWith("lrx_")) {
    return { success: false, error: "No valid Anthropic API key" };
  }
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
        max_tokens: 16,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json() as { content: Array<{ type: string; text: string }>; usage: { input_tokens: number; output_tokens: number } };
    const text = data.content?.find((b: { type: string }) => b.type === "text")?.text?.trim() ?? "";
    await trackUsage(env, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, _currentCategory);
    return { success: true, text, tokens_used: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0) };
  } catch (err) {
    return { success: false, error: String(err) };
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

export interface HaikuBriefingItem {
  title: string;
  severity: string;
  summary: string;
  related_brand_id?: string | null;
  related_campaign_id?: string | null;
}

export async function generateInsight(
  env: Env,
  context: {
    period: string;
    threats_summary: Record<string, unknown>;
    top_brands: Array<{ name: string; count: number; id?: string }>;
    top_providers: Array<{ name: string; count: number }>;
    trend_data: Record<string, unknown>;
    recent_campaigns?: Array<{ id: string; name: string; threat_count: number }>;
    agent_context?: Array<{ agent: string; summary: string }>;
    type_distribution?: Array<{ threat_type: string; count: number }>;
    email_security_summary?: string;
  },
): Promise<HaikuResponse<{ items: HaikuBriefingItem[] }>> {
  const systemPrompt = `You are a senior threat intelligence analyst at a security operations center. Based on the data provided, write 3-5 intelligence briefing items. Each item must have:
- A concise descriptive title (e.g., 'Roblox Credential Harvest Expanding')
- A severity level: critical, high, medium, or info
- A 2-3 sentence summary explaining WHAT is happening, WHO is being targeted, HOW the attack works, and WHY it matters
- A related_brand_id if the item is about a specific brand (use the brand ID from the data, or null)
- A related_campaign_id if the item is about a specific campaign (use the campaign ID from the data, or null)

Focus on: new or expanding campaigns, brand targeting spikes, infrastructure shifts, emerging attack patterns, and notable changes from previous periods. Write for a security professional — be specific, cite numbers, name the brands and providers involved. Do NOT write generic security advice.

Respond with ONLY a JSON object: {"items": [...]}`;

  const userMessage = `Generate intelligence briefing items from this ${context.period} data:
${JSON.stringify(context, null, 2)}`;

  return callAnthropic<{ items: HaikuBriefingItem[] }>(env, systemPrompt, userMessage);
}

// Legacy single-insight generation (kept for backward compatibility)
export async function generateSingleInsight(
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

// ─── Campaign Name Generation ────────────────────────────────────

export async function generateCampaignName(
  env: Env,
  campaign: {
    domains?: string[];
    target_brands?: string[];
    threat_types?: string[];
    providers?: string[];
    threat_count?: number;
    ip_count?: number;
  },
): Promise<HaikuResponse<{ name: string }>> {
  const systemPrompt = `You generate short, descriptive threat campaign names (3-6 words) based on cluster metadata.
The name should describe the attack method and target, like "GoDaddy Phishing Kit Network" or "Crypto Exchange Credential Harvest".
Do not use technical IDs, IP addresses, or UUIDs.
Respond with ONLY a JSON object: {"name": "Your Campaign Name Here"}`;

  const userMessage = `Generate a campaign name for this threat cluster:
- Domains: ${(campaign.domains || []).slice(0, 10).join(", ") || "N/A"}
- Target brands: ${(campaign.target_brands || []).join(", ") || "Unknown"}
- Threat types: ${(campaign.threat_types || []).join(", ") || "Mixed"}
- Hosting providers: ${(campaign.providers || []).join(", ") || "Unknown"}
- Threat count: ${campaign.threat_count ?? 0}
- Unique IPs: ${campaign.ip_count ?? 1}`;

  return callAnthropic<{ name: string }>(env, systemPrompt, userMessage);
}

// ─── Brand Threat Analysis ───────────────────────────────────────

export interface HaikuBrandAnalysis {
  analysis: string;
  risk_level: string;
  key_findings: string[];
}

export async function analyzeBrandThreats(
  env: Env,
  context: {
    brand_name: string;
    threat_count: number;
    providers: string[];
    domains: string[];
    threat_types: Record<string, number>;
    campaigns: string[];
  },
): Promise<HaikuResponse<HaikuBrandAnalysis>> {
  const types = Object.entries(context.threat_types).map(([k, v]) => `${k} (${v})`).join(", ");
  const systemPrompt = `You are a brand protection analyst. Analyze the threat landscape for the brand and write a concise threat assessment.
Respond with ONLY a JSON object (no markdown) with these fields:
- analysis: a 3-4 sentence threat assessment suitable for a brand protection briefing. Be specific about the attack methodology, infrastructure used, and risk level.
- risk_level: one of "critical", "high", "medium", "low"
- key_findings: array of 2-4 brief key findings`;

  const userMessage = `Analyze the threat landscape for ${context.brand_name}. Based on the data: ${context.threat_count} active phishing threats, hosted across ${context.providers.slice(0, 10).join(", ") || "unknown providers"}, targeting ${context.domains.slice(0, 5).join(", ") || "unknown domains"}. The primary attack types are ${types || "unknown"}. Campaigns: ${context.campaigns.slice(0, 5).join(", ") || "none identified"}. Write a 3-4 sentence threat assessment suitable for a brand protection briefing. Be specific about the attack methodology, infrastructure used, and risk level.`;

  return callAnthropic<HaikuBrandAnalysis>(env, systemPrompt, userMessage);
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
