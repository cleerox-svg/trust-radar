/**
 * Haiku 4.5 pricing constants (USD per million tokens).
 *
 * Centralised so that when Anthropic updates published rates we only
 * edit this file. Values current as of 2025-10 list pricing.
 */

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";

/** USD per 1M input tokens. */
export const HAIKU_INPUT_USD_PER_MTOK = 1.0;
/** USD per 1M output tokens. */
export const HAIKU_OUTPUT_USD_PER_MTOK = 5.0;

/**
 * Hard cap per individual analyzer call. Haiku is cheap, but analyses
 * take ~4-8k input tokens and 1-2k output tokens so a single call
 * should land well under $0.05 — the $0.50 cap is the "something is
 * catastrophically wrong" tripwire, not a soft budget.
 */
export const MAX_COST_PER_CALL_USD = 0.5;

/**
 * Hard cap for a full Phase 2 run (all three sections combined).
 * Tripped by the orchestrator after each analyzer returns.
 */
export const MAX_COST_PER_RUN_USD = 2.0;

export function computeCostUsd(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * HAIKU_INPUT_USD_PER_MTOK;
  const outputCost = (outputTokens / 1_000_000) * HAIKU_OUTPUT_USD_PER_MTOK;
  return inputCost + outputCost;
}
