-- 0239_threats_domain_age.sql
-- D4 (S2.4) — Newly Registered Domain (NRD) signal.
--
-- The VirusTotal domain report already carries `creation_date` (the
-- domain's WHOIS registration date, unix seconds); the platform fetches
-- it and throws it away. Capture it so we can derive an impersonating
-- domain's age and flag newly registered domains — a domain registered
-- days before it starts impersonating a brand is a strong phishing
-- precursor.
--
--   domain_created_at — ISO-8601 registration timestamp (absolute; a
--                       live age can always be recomputed from it).
--   domain_age_days   — whole days between registration and the moment
--                       we enriched the threat (age *at detection* — a
--                       deliberately static precursor snapshot). NULL
--                       when VT had no creation date or returned a
--                       garbage/sentinel value.
--
-- ADD COLUMN only (never alter/drop existing columns). Mirrors the
-- `phishing_signals.domain_age_days INTEGER` naming (migration 0023).
--
-- No index: the only reader (lib/alert-triage.ts) loads a single threat
-- row by primary key and reads these columns inline — there is no
-- `WHERE domain_age_days <= N` scan to support, so an index would only
-- add write amplification on the hot threats table for zero read
-- benefit. Add one later if/when a range-filtered query appears.

ALTER TABLE threats ADD COLUMN domain_created_at TEXT;
ALTER TABLE threats ADD COLUMN domain_age_days INTEGER;
