/**
 * Canonical model constants for trust-radar AI call sites.
 * Change HOT_PATH_HAIKU here to update every non-ARCHITECT AI call at once.
 *
 * Cost reference (per 1M tokens, input / output):
 *   claude-3-haiku-20240307     $0.25 / $1.25   (current — pre-revenue minimum cost)
 *   claude-haiku-3-5-20241022   $0.80 / $4.00   (3.2x — if classification quality drops)
 *   claude-haiku-4-5-20251001   $1.00 / $5.00   (4x — bump specific call sites if needed)
 */
export const HOT_PATH_HAIKU = "claude-3-haiku-20240307" as const;
