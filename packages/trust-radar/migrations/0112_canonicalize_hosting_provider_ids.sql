-- Canonicalize hosting_providers.id to hp_${asn} for all rows with an asn.
--
-- Background: cartographer historically derived hosting_providers.id from
-- the provider NAME (e.g. hp_china_unicom_beijing). ip-api returns name
-- variants for the same ASN over time ("AS4837 China Unicom Beijing" vs
-- "AS4837 China Unicom"), so different threats with the same ASN generated
-- different ids. UNIQUE(asn) caught the conflict and rolled back the entire
-- batch chunk atomically — see PR #826 for the cartographer-side fix.
--
-- After PR #826, new providers use the canonical hp_${asn} form. This
-- migration backfills existing rows so the legacy/new dichotomy goes away
-- permanently. After this migration, every active row in hosting_providers
-- has id = hp_${asn} (only rows with NULL asn keep their original id —
-- those are the rare cases where cartographer never resolved the ASN).
--
-- Order matters: threats and threat_cube_provider must be updated FIRST
-- because they look up the BEFORE state of hosting_providers via subquery.
-- Once hosting_providers.id is renamed, the old ids no longer exist and
-- the lookup returns NULL.
--
-- Before running, verify the count:
--   SELECT COUNT(*) FROM hosting_providers
--   WHERE asn IS NOT NULL AND asn != '' AND id != 'hp_' || asn;
-- Expected: a few thousand. If 0, this migration is a no-op (already canonical).
-- If dramatically larger than expected, STOP and investigate.

-- ─── Step 1: Update threats.hosting_provider_id ──────────────────────
-- Uses the BEFORE state of hosting_providers to map each threat's FK
-- from the legacy id to the canonical hp_${asn} form.
UPDATE threats
SET hosting_provider_id = 'hp_' || (
  SELECT asn FROM hosting_providers hp
  WHERE hp.id = threats.hosting_provider_id
    AND hp.asn IS NOT NULL
    AND hp.asn != ''
)
WHERE hosting_provider_id IN (
  SELECT id FROM hosting_providers
  WHERE asn IS NOT NULL AND asn != '' AND id != 'hp_' || asn
);

-- ─── Step 2: Update threat_cube_provider.hosting_provider_id ─────────
-- The cube self-heals on the next 6-hour cube_healer pass, but explicitly
-- updating avoids an inconsistency window where queries against the cube
-- would miss rows because hosting_provider_id no longer matches anything
-- in hosting_providers.
UPDATE threat_cube_provider
SET hosting_provider_id = 'hp_' || (
  SELECT asn FROM hosting_providers hp
  WHERE hp.id = threat_cube_provider.hosting_provider_id
    AND hp.asn IS NOT NULL
    AND hp.asn != ''
)
WHERE hosting_provider_id IN (
  SELECT id FROM hosting_providers
  WHERE asn IS NOT NULL AND asn != '' AND id != 'hp_' || asn
);

-- ─── Step 3: Rename hosting_providers.id to canonical form ───────────
-- Safe because UNIQUE(asn) guarantees one row per asn — no destination
-- id collisions are possible. Done last so steps 1 and 2 could resolve
-- the old-to-new mapping via subquery.
UPDATE hosting_providers
SET id = 'hp_' || asn
WHERE asn IS NOT NULL AND asn != '' AND id != 'hp_' || asn;
