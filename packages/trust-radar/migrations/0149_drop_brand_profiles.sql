-- 0149_drop_brand_profiles.sql
-- R4 (final step) of the brand_profiles deprecation. Archives the
-- remaining row(s) into a `_legacy_brand_profiles_2026_05` table and
-- drops `brand_profiles`.
--
-- Per `docs/v3/BRAND_PROFILES_DEPRECATION.md`:
--   - R1 (410 Gone routes), R2 (handler ownership joins), R3 (agent
--     JOIN drops), R5 (manifest regen) shipped in PR #1105
--   - R6/R7/R8/R9 (scanner refactors + admin backfill cleanup)
--     shipped in PR #1108
--   - This migration is R4 — drop the table.
--
-- Production state at write time (2026-05-07):
--   - brand_profiles has exactly 1 row: a "Trust Radar" test
--     profile owned by cleerox@gmail.com, domain trustradar.ca,
--     never scanned, no matching brands row. OP3 verdict was
--     "drop", but we keep it in the archive table so the audit
--     trail survives.
--
-- Safe to run because:
--   - No CRUD handler still queries brand_profiles (R1, R2, R9)
--   - No agent declares it in `reads:` (R3)
--   - No scanner SELECTs from it (R6, R7)
--   - No cron path looks it up (R8)
--   - Architect manifest no longer references it (R5)

-- 1) Create the archive table mirroring the legacy schema. Drop on
--    re-run so the migration is idempotent if it gets re-applied.
DROP TABLE IF EXISTS _legacy_brand_profiles_2026_05;

CREATE TABLE _legacy_brand_profiles_2026_05 (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT,
  domain              TEXT,
  brand_name          TEXT,
  aliases             TEXT,
  official_handles    TEXT,
  brand_keywords      TEXT,
  executive_names     TEXT,
  logo_url            TEXT,
  logo_hash           TEXT,
  monitoring_tier     TEXT,
  status              TEXT,
  last_full_scan      TEXT,
  next_scheduled_scan TEXT,
  exposure_score      INTEGER,
  email_grade         TEXT,
  social_risk_score   INTEGER,
  domain_risk_score   INTEGER,
  threat_feed_score   INTEGER,
  created_at          TEXT,
  updated_at          TEXT,
  archived_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2) Copy every remaining brand_profiles row into the archive.
INSERT INTO _legacy_brand_profiles_2026_05
  (id, user_id, domain, brand_name, aliases, official_handles,
   brand_keywords, executive_names, logo_url, logo_hash, monitoring_tier,
   status, last_full_scan, next_scheduled_scan, exposure_score, email_grade,
   social_risk_score, domain_risk_score, threat_feed_score, created_at,
   updated_at)
SELECT id, user_id, domain, brand_name, aliases, official_handles,
       brand_keywords, executive_names, logo_url, logo_hash, monitoring_tier,
       status, last_full_scan, next_scheduled_scan, exposure_score, email_grade,
       social_risk_score, domain_risk_score, threat_feed_score, created_at,
       updated_at
FROM brand_profiles;

-- 3) Drop the live table.
DROP TABLE brand_profiles;
