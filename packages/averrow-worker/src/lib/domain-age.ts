// Averrow — Newly Registered Domain (NRD) age derivation (D4 / S2.4).
//
// Pure helpers for the NRD signal. The VirusTotal domain report carries
// a `creation_date` (WHOIS registration, unix SECONDS) that the platform
// already fetches; this module turns it into a stored ISO timestamp + a
// whole-day age snapshot, guarding against the garbage values VT returns
// for domains it has no WHOIS creation date for.
//
// Doctrine (CLAUDE.md §13): this is a deterministic date subtraction —
// SQL/code does correlation, AI does narrative. No tokens spent here.

/**
 * Domains registered within this many days of first being seen
 * impersonating a brand are "newly registered" (NRD) — a strong
 * phishing precursor. Industry NRD feeds commonly draw the line at 14
 * or 30 days; 30 is the conservative upper bound that still isolates
 * the register-then-weaponize pattern.
 *
 * The signal is only used to *withhold* auto-dismissal of an
 * otherwise-clean alert (never to auto-escalate severity), so a
 * generous window is low-risk: the worst case is one extra alert left
 * in the human queue, not a false critical.
 */
export const NRD_MAX_AGE_DAYS = 30;

/**
 * Earliest plausible domain creation date. Anything before the
 * commercial DNS era is a sentinel/garbage value — VT returns 0 or
 * epoch-adjacent values when it has no WHOIS creation date.
 */
const MIN_PLAUSIBLE_CREATION_MS = Date.UTC(1990, 0, 1);

export interface DomainAge {
  /** ISO-8601 registration timestamp (from VT creation_date). */
  domainCreatedAt: string;
  /** Whole days between registration and the reference time (age at
   *  detection). Never negative. */
  domainAgeDays: number;
}

/**
 * Derive a domain's registration timestamp + age snapshot from a
 * VirusTotal `creation_date` (unix SECONDS).
 *
 * Returns null — leaving both columns NULL rather than writing garbage —
 * whenever the datum is absent or nonsensical:
 *   - null / undefined / non-finite / NaN
 *   - <= 0 (VT's "unknown" sentinel)
 *   - before 1990 (pre-DNS-era garbage)
 *   - in the future relative to `nowMs` (clock/parse error)
 *
 * `nowMs` defaults to Date.now() and is injectable for deterministic
 * tests. The age is a *snapshot at detection time* — intentionally
 * static once written (a domain that was 5 days old when it attacked
 * stays a meaningful "5-day-old NRD" record; `domainCreatedAt` is kept
 * so a live age can always be recomputed if ever needed).
 */
export function deriveDomainAge(
  creationDateUnixSeconds: number | null | undefined,
  nowMs: number = Date.now(),
): DomainAge | null {
  if (creationDateUnixSeconds == null || !Number.isFinite(creationDateUnixSeconds)) {
    return null;
  }
  if (creationDateUnixSeconds <= 0) return null;

  const createdMs = creationDateUnixSeconds * 1000;
  if (createdMs < MIN_PLAUSIBLE_CREATION_MS) return null;
  if (createdMs > nowMs) return null;

  const ageDays = Math.floor((nowMs - createdMs) / 86_400_000);
  return {
    domainCreatedAt: new Date(createdMs).toISOString(),
    domainAgeDays: ageDays,
  };
}

/**
 * True when a stored `domain_age_days` marks a newly registered domain.
 *
 * NULL age (VT had no creation date, or returned garbage) is NOT an NRD —
 * absence of evidence, not evidence of youth. Negative ages (shouldn't
 * occur post-`deriveDomainAge`, but defensive) are rejected too.
 */
export function isNewlyRegistered(
  domainAgeDays: number | null | undefined,
  maxAgeDays: number = NRD_MAX_AGE_DAYS,
): boolean {
  return domainAgeDays != null && domainAgeDays >= 0 && domainAgeDays <= maxAgeDays;
}
