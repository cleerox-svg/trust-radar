/**
 * Executive Social-Impersonation Detection — deterministic core (Stage 3)
 *
 * Given ONE org_executives row, generate plausible impersonation handles
 * from the executive's full name, HEAD-check which ones actually exist on
 * the watched platforms, and score name-similarity for the ones that do.
 *
 * This module is PURE detection logic and SIDE-EFFECT-FREE:
 *   - No AI calls (100% deterministic — permutation + HEAD + Levenshtein).
 *   - No D1 writes, no createAlert, no agent_runs/agent_events.
 *   - Takes the exec row + an injectable existence-checker; the only I/O is
 *     the injected HEAD probe (defaults to the real one, mocked in tests).
 *
 * Stage 4 wraps `runExecutiveMonitorForExec` in a dispatched agent that
 * persists results and creates `executive_impersonation` alerts; the
 * triage rule that gates those alerts is `decideExecutiveImpersonationTriage`
 * in lib/alert-triage.ts. This file just RETURNS candidates.
 *
 * Reuse (do NOT reinvent): mirrors scanners/social-monitor.ts's
 * `runSocialMonitorForBrand`, reuses the exact same HEAD checker
 * (lib/social-check.ts) and the exact same deterministic scorer
 * (scanners/impersonation-scorer.ts) the brand path uses, so behaviour is
 * consistent across the social / app-store / executive alert families.
 */

import { checkSocialHandles, toHandle, type SocialCheckResult } from '../lib/social-check';
import {
  scoreImpersonation,
  nameSimilarity,
  type ImpersonationSignals,
} from './impersonation-scorer';
import { SUPPORTED_PLATFORMS, PLATFORM_URL_TEMPLATES } from './social-monitor';

// COUPLING NOTE (OPTIONAL/INFO): the platform KEYS we match against below
// (`r.platform === platform`) are produced by lib/social-check.ts's own
// `PLATFORMS` array, which is independent of `SUPPORTED_PLATFORMS` here.
// They currently hold the same six lowercase keys. If social-check.ts ever
// renames/reorders a platform key, this list must track it (or both should
// be sourced from one shared const). Kept as-is for now — the sets match.

// ─── Types ──────────────────────────────────────────────────────

/** The minimal slice of an org_executives row the detector needs. */
export interface ExecutiveScanInput {
  id: string;
  full_name: string;
  /** JSON object text: platform -> handle. Mirrors brands.official_handles. */
  official_handles: string | null;
  /** JSON array text of platform keys to monitor (social-monitor's 6). */
  watch_platforms: string | null;
}

/** One existing handle surfaced by the detector. Stage 4 turns the
 *  non-official, over-threshold ones into `executive_impersonation` alerts. */
export interface ExecutiveImpersonationCandidate {
  execId: string;
  platform: string;
  /** The candidate handle actually probed — normalized via `toHandle`
   *  (lowercased, dots stripped, no leading '@'), so it equals what the
   *  HEAD checker really queried. */
  handle: string;
  /** Always true here — we only return handles the HEAD probe found to exist. */
  exists: boolean;
  /** Deterministic impersonation score 0.0-1.0 (name-similarity driven). */
  score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** Human-readable score reasons from the shared scorer. */
  signals: string[];
  /** True when this handle IS the exec's registered official handle for the
   *  platform — Stage 4/triage Rule B dismisses these as always-safe. */
  isOfficialHandle: boolean;
  profileUrl: string;
}

/** Injectable HEAD-existence checker. Same signature as
 *  `checkSocialHandles` — one call covers all six platforms. Injected so
 *  tests run offline/deterministically. */
export type SocialExistenceChecker = (handle: string) => Promise<SocialCheckResult[]>;

// ─── Bounds (Stage 4's cron batches on top of these) ─────────────

/** Max candidate handles probed per exec. Each is ONE `checkSocialHandles`
 *  network call (which already covers all 6 platforms), so this also caps
 *  network calls/exec at ~12 — mirrors the brand scanner's ~16 and keeps a
 *  per-exec run well under the Workers cron CPU ceiling. Stage 4 must still
 *  cap execs/run (the brand scanner's BATCH_LIMIT=10 lesson). */
export const MAX_CANDIDATES_PER_EXEC = 12;

/** Platforms probed per exec — never more than the supported set. */
export const MAX_PLATFORMS_PER_EXEC = SUPPORTED_PLATFORMS.length;

// The scanner returns EVERY existing candidate with its computed score; it
// applies no score floor of its own (FIX 3 — a local floor would be dead
// code: handle_is_permutation (0.25) + not-verified (0.10) alone floor
// every candidate at ~0.35). The single, documented keep/dismiss cut is the
// tunable `impersonationThreshold` (default 0.5) in
// decideExecutiveImpersonationTriage, which Stage 4 / ops tune there.

// ─── Name → candidate handle generation ──────────────────────────

/**
 * Normalize one name token to handle-safe characters, ASCII-FOLDING
 * diacritics first (José -> jose, García -> garcia) so realistic
 * transliterated squat handles are generated. Fold is deterministic and
 * dependency-free: NFD decomposes accented letters into base + combining
 * mark, then the combining marks (U+0300–U+036F) are stripped.
 *
 * Residual limitation: characters that DON'T NFD-decompose to an ASCII base
 * (e.g. ø, ł, ð) are dropped rather than transliterated. Accepted gap — the
 * common Latin-1 accents (é, á, í, ó, ú, ü, ñ, ç, â, ê…) all fold correctly.
 */
function normalizeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Generate plausible impersonation handles for a person's full name.
 *
 * The brand `generateHandlePermutations` is brand-token oriented
 * (_official/_hq/_inc suffixes, char substitution). People get impersonated
 * with a different, name-shaped vocabulary, so this produces the realistic
 * personal forms: `janedoe`, `jane.doe`, `jane_doe`, `jane-doe`,
 * `janedoeofficial`, `realjanedoe`, `officialjanedoe`, `jdoe`, plus
 * full-surname / hyphenated forms for multi-token names (`janedoesmith`,
 * `jane-doe-smith`).
 *
 * Deterministic and bounded (<= MAX_CANDIDATES_PER_EXEC, priority-ordered:
 * canonical first+last forms, then multi-token surname forms, then the
 * "official/real" dressing, then initials/digits). FALSE-POSITIVE CONTROL —
 * the first line of defence against common-name flooding:
 *   - Requires >= 2 name tokens (a first AND a last name). Mononyms and
 *     single tokens ("Cher", "Madonna", "John") yield NO candidates.
 *   - Each usable token must be >= 2 chars; the combined base must be
 *     >= 4 chars.
 *   - Middle names are dropped from the first+last core (matching how the
 *     platform derives initials elsewhere), but ARE included in the
 *     multi-token forms so hyphenated surnames aren't missed.
 * When the gate fails, returns [] → the scanner produces nothing.
 */
export function generateExecutiveHandleCandidates(fullName: string): string[] {
  const tokens = fullName
    .split(/[\s._\-]+/)
    .map(normalizeToken)
    .filter((t) => t.length >= 2);

  // FP gate: need at least a first + last name token.
  if (tokens.length < 2) return [];

  const first = tokens[0]!;
  const last = tokens[tokens.length - 1]!; // drop middle names for the core forms
  const base = `${first}${last}`;
  if (base.length < 4) return [];

  const allBase = tokens.join(''); // full name incl. middle / hyphenated parts
  const firstInitial = first.slice(0, 1);

  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string): void => {
    const clean = raw.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
    if (clean.length < 4 || seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  };

  // Canonical first+last forms.
  add(`${first}${last}`);            // janedoe
  add(`${first}.${last}`);           // jane.doe
  add(`${first}_${last}`);           // jane_doe
  add(`${first}-${last}`);           // jane-doe

  // Multi-token forms (middle name OR hyphenated surname) — FIX 2b.
  if (tokens.length > 2) {
    add(allBase);                    // janedoesmith
    add(tokens.join('.'));           // jane.doe.smith
    add(tokens.join('-'));           // jane-doe-smith
    add(tokens.join('_'));           // jane_doe_smith
  }

  // "Verified/official" impersonation dressing.
  add(`${base}official`);            // janedoeofficial
  add(`real${base}`);                // realjanedoe
  add(`official${base}`);            // officialjanedoe
  add(`${base}_official`);           // janedoe_official
  add(`the${base}`);                 // thejanedoe

  // Initial + last, and trailing-digit takeover variants.
  add(`${firstInitial}${last}`);     // jdoe
  add(`${base}1`);                   // janedoe1
  add(`${base}0`);                   // janedoe0

  return out.slice(0, MAX_CANDIDATES_PER_EXEC);
}

// ─── Single Executive Monitor (pure, side-effect-free) ───────────

/**
 * Run impersonation detection for ONE executive. Returns the existing
 * candidate handles across the exec's watched platforms. Writes nothing,
 * creates no alerts, makes no AI calls.
 *
 * FIX 1 — normalization consistency. The real HEAD probe applies
 * `toHandle` internally (which STRIPS dots: `jane.doe` -> `janedoe`). We
 * therefore push every generated candidate AND every official handle
 * through the SAME `toHandle` transform BEFORE we dedup / probe / key /
 * compare. Consequences:
 *   - `jane.doe` and `janedoe` collapse to ONE probed candidate, and its
 *     `profileUrl` is built from the handle actually probed.
 *   - An official handle stored as `jane.doe` compares equal to that
 *     collapsed candidate, so the exec's OWN account is flagged
 *     isOfficialHandle=true and is NOT also emitted as an impersonation.
 * Residual limitation (inherited from the shared brand path, tracked as
 * follow-up #22, NOT fixed here): because dots are stripped, this scanner
 * cannot distinguish `instagram.com/jane.doe` from `instagram.com/janedoe`
 * — they are one probe. That's a detection-granularity gap, separate from
 * the internal-consistency fix above.
 *
 * @param exec         the org_executives row slice
 * @param checkHandles injectable HEAD-existence probe (defaults to the real
 *                     `checkSocialHandles`; mocked in tests)
 */
export async function runExecutiveMonitorForExec(
  exec: ExecutiveScanInput,
  checkHandles: SocialExistenceChecker = checkSocialHandles,
): Promise<ExecutiveImpersonationCandidate[]> {
  // Parse official handles (platform -> handle), normalized via toHandle so
  // the comparison matches what the probe actually queries (FIX 1).
  const officialByPlatform: Record<string, string> = {};
  try {
    const parsed = exec.official_handles ? JSON.parse(exec.official_handles) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [platform, handle] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof handle === 'string' && handle.trim()) {
          officialByPlatform[platform.toLowerCase()] = toHandle(handle);
        }
      }
    }
  } catch {
    // Malformed JSON — treat as no official handles.
  }

  // Resolve watched platforms → clamp to the supported set, dedupe, bound.
  let watched: string[] = [];
  try {
    const parsed = exec.watch_platforms ? JSON.parse(exec.watch_platforms) : null;
    if (Array.isArray(parsed)) {
      watched = parsed.filter((p): p is string => typeof p === 'string');
    }
  } catch {
    // Malformed JSON — fall through to default below.
  }
  const supported = new Set<string>(SUPPORTED_PLATFORMS);
  const platformSeen = new Set<string>();
  const platforms: string[] = [];
  for (const raw of watched.length > 0 ? watched : SUPPORTED_PLATFORMS) {
    const p = raw.toLowerCase();
    if (supported.has(p) && !platformSeen.has(p)) {
      platformSeen.add(p);
      platforms.push(p);
    }
    if (platforms.length >= MAX_PLATFORMS_PER_EXEC) break;
  }

  // Generate candidate handles, then normalize each through the SAME
  // transform the real probe applies (toHandle) and dedup so what we think
  // we probed matches what actually got queried (FIX 1).
  const candSeen = new Set<string>();
  const candidates: string[] = [];
  for (const raw of generateExecutiveHandleCandidates(exec.full_name)) {
    const norm = toHandle(raw);
    if (norm.length < 2 || candSeen.has(norm)) continue;
    candSeen.add(norm);
    candidates.push(norm);
  }
  if (candidates.length === 0 || platforms.length === 0) return [];

  // Dedupe network checks: ONE call per unique handle covers all platforms.
  const resultsByHandle = new Map<string, SocialCheckResult[]>();
  for (const handle of candidates) {
    resultsByHandle.set(handle, await checkHandles(handle));
  }

  const out: ExecutiveImpersonationCandidate[] = [];
  for (const platform of platforms) {
    for (const handle of candidates) {
      const platformResult = resultsByHandle
        .get(handle)
        ?.find((r) => r.platform === platform);

      // available===false means "profile exists (taken)". Anything else
      // (available / unknown / no result) is not an impersonation hit.
      if (!platformResult || platformResult.available !== false) continue;

      const signals: ImpersonationSignals = {
        name_similarity: nameSimilarity(exec.full_name, handle),
        uses_brand_keywords: false, // person, not a brand — no brand-keyword signal
        account_age_suspicious: false, // HEAD-only, cannot determine
        low_followers: false, // HEAD-only, cannot determine
        verified: false, // HEAD-only — assume unverified (conservative)
        handle_is_permutation: true, // by construction
      };
      const scored = scoreImpersonation(signals);

      const isOfficialHandle =
        officialByPlatform[platform] !== undefined &&
        officialByPlatform[platform] === handle;

      out.push({
        execId: exec.id,
        platform,
        handle,
        exists: true,
        score: scored.score,
        severity: scored.severity,
        signals: scored.reasons,
        isOfficialHandle,
        profileUrl: PLATFORM_URL_TEMPLATES[platform]?.(handle) ?? '',
      });
    }
  }

  return out;
}
