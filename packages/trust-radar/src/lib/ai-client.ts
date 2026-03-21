/**
 * Unified AI Client for Trust Radar
 *
 * Wraps Anthropic Claude Haiku calls with consistent error handling,
 * retry logic, and token usage tracking. Provides a single interface
 * for all agent AI calls instead of scattered direct fetch usage.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

// ─── Error types ──────────────────────────────────────────────────

export class AIClientError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "AIClientError";
  }
}

export type AIErrorCode =
  | "NO_API_KEY"
  | "INVALID_API_KEY"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "NO_CONTENT"
  | "JSON_PARSE_ERROR"
  | "UNEXPECTED_ERROR";

// ─── Interfaces ───────────────────────────────────────────────────

export interface AgentCall {
  agent: string;           // 'analyst' | 'observer' | 'strategist' | etc.
  task: string;            // Description of what's being done
  systemPrompt: string;    // Agent system prompt
  userPrompt: string;      // User message content
  maxTokens?: number;      // Default 1024
  responseFormat?: "text" | "json";  // If 'json', parse response as JSON
}

export interface AgentResponse {
  content: string;         // Raw text response
  parsed?: unknown;        // Parsed JSON if responseFormat='json'
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  agent: string;
  durationMs: number;
}

// ─── TrustRadarAI class ──────────────────────────────────────────

export class TrustRadarAI {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_MODEL;
  }

  /**
   * Make a call to the Anthropic Messages API with retry logic,
   * timing, and optional JSON parsing.
   */
  async call(params: AgentCall): Promise<AgentResponse> {
    const {
      agent,
      task,
      systemPrompt,
      userPrompt,
      maxTokens = DEFAULT_MAX_TOKENS,
      responseFormat = "text",
    } = params;

    const startTime = Date.now();

    console.log(`[ai-client] agent=${agent} task="${task}" model=${this.model} maxTokens=${maxTokens} format=${responseFormat}`);

    const body = {
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user" as const, content: userPrompt }],
    };

    let lastError: AIClientError | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        console.log(`[ai-client] Retrying (attempt ${attempt + 1}) agent=${agent} task="${task}"`);
      }

      try {
        const res = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const responseText = await res.text();

        if (!res.ok) {
          const retryable = res.status >= 500 || res.status === 429;
          lastError = new AIClientError(
            `Anthropic HTTP ${res.status}: ${responseText.slice(0, 200)}`,
            "HTTP_ERROR",
            res.status,
            retryable,
          );

          if (retryable && attempt < MAX_RETRIES) {
            console.warn(`[ai-client] Transient error (HTTP ${res.status}), will retry. agent=${agent}`);
            continue;
          }

          throw lastError;
        }

        // Parse the API response envelope
        const apiResponse = JSON.parse(responseText) as {
          content: Array<{ type: string; text: string }>;
          model: string;
          usage: { input_tokens: number; output_tokens: number };
        };

        const textBlock = apiResponse.content.find((b) => b.type === "text");
        if (!textBlock) {
          throw new AIClientError(
            "No text content block in Anthropic response",
            "NO_CONTENT",
          );
        }

        const durationMs = Date.now() - startTime;
        const usage = {
          inputTokens: apiResponse.usage.input_tokens,
          outputTokens: apiResponse.usage.output_tokens,
        };

        console.log(
          `[ai-client] Success agent=${agent} model=${apiResponse.model} ` +
          `tokens=${usage.inputTokens}+${usage.outputTokens} ` +
          `duration=${durationMs}ms`,
        );

        const response: AgentResponse = {
          content: textBlock.text,
          usage,
          model: apiResponse.model,
          agent,
          durationMs,
        };

        // Parse JSON from the response if requested
        if (responseFormat === "json") {
          const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new AIClientError(
              `No JSON object found in response text: ${textBlock.text.slice(0, 200)}`,
              "JSON_PARSE_ERROR",
            );
          }
          try {
            response.parsed = JSON.parse(jsonMatch[0]);
          } catch (parseErr) {
            throw new AIClientError(
              `Failed to parse JSON from response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
              "JSON_PARSE_ERROR",
            );
          }
        }

        return response;

      } catch (err) {
        if (err instanceof AIClientError) {
          lastError = err;
          if (!err.retryable || attempt >= MAX_RETRIES) {
            throw err;
          }
          continue;
        }

        // Handle network/timeout errors
        const message = err instanceof Error ? err.message : String(err);
        const isTimeout = message.includes("timeout") || message.includes("abort");
        const isNetwork = message.includes("fetch") || message.includes("network") || message.includes("ECONNREFUSED");
        const retryable = isTimeout || isNetwork;

        lastError = new AIClientError(
          message,
          isTimeout ? "TIMEOUT" : isNetwork ? "NETWORK_ERROR" : "UNEXPECTED_ERROR",
          undefined,
          retryable,
        );

        if (retryable && attempt < MAX_RETRIES) {
          console.warn(`[ai-client] Transient error (${lastError.code}), will retry. agent=${agent}`);
          continue;
        }

        throw lastError;
      }
    }

    // Should not reach here, but satisfy TypeScript
    throw lastError ?? new AIClientError("Unexpected retry exhaustion", "UNEXPECTED_ERROR");
  }
}

// ─── Convenience factory ─────────────────────────────────────────

/**
 * Create a TrustRadarAI client from environment bindings.
 * Picks up the API key using the same precedence as haiku.ts:
 * ANTHROPIC_API_KEY (preferred) then LRX_API_KEY (legacy).
 *
 * Throws AIClientError if no valid key is found.
 */
export function createAIClient(
  env: { ANTHROPIC_API_KEY?: string; LRX_API_KEY?: string },
  model?: string,
): TrustRadarAI {
  const apiKey = env.ANTHROPIC_API_KEY || env.LRX_API_KEY;

  if (!apiKey) {
    throw new AIClientError(
      "No Anthropic API key configured (checked ANTHROPIC_API_KEY and LRX_API_KEY)",
      "NO_API_KEY",
    );
  }

  if (apiKey.startsWith("lrx_")) {
    throw new AIClientError(
      "LRX_API_KEY contains an LRX proxy key (lrx_...) which does not work with api.anthropic.com. Set ANTHROPIC_API_KEY to a real Anthropic key (sk-ant-...)",
      "INVALID_API_KEY",
    );
  }

  return new TrustRadarAI(apiKey, model);
}
