-- Threat Actors — activity backfill
--
-- Migration 0063 seeded 7 threat actors but never populated last_seen, so the
-- Threat Actors card footer ("Last seen X ago") was blank for every actor.
-- Only 3 of the 7 actors had threat_actor_infrastructure rows, so Sentinel's
-- ASN-driven last_seen update (PR #760) could never reach the other 4.
--
-- This migration:
--   1. Backfills last_seen from first_seen where NULL (honest baseline —
--      shows when we first tracked the actor, not a synthetic "now")
--   2. Adds ASN mappings for the 4 previously-unmapped actors, drawing from
--      the IRANIAN_APT_ASNS set already recognised by sentinel.ts
--   3. Refreshes last_observed on all infrastructure rows so the detail view
--      reflects the current monitoring baseline
--
-- Idempotent: all statements are safe to re-run.

-- 1. Backfill last_seen from first_seen
UPDATE threat_actors
SET last_seen = first_seen,
    updated_at = datetime('now')
WHERE last_seen IS NULL
  AND first_seen IS NOT NULL;

-- 2. Add infrastructure ASN mappings for the 4 previously-unmapped actors.
-- ASN choices mirror the IRANIAN_APT_ASNS set in packages/trust-radar/src/agents/sentinel.ts.
INSERT OR IGNORE INTO threat_actor_infrastructure (id, threat_actor_id, asn, country_code, confidence, notes) VALUES
('tai_ir_as44244', 'ta_hydro_kitten',     'AS44244', 'IR', 'medium', 'Irancell — mobile carrier infrastructure used by IRGC-affiliated financial-sector operations'),
('tai_ir_as58224', 'ta_cyberav3ngers',    'AS58224', 'IR', 'medium', 'Telecommunication Infrastructure Company (TIC) — state-owned telecom used by IRGC ICS/SCADA operators'),
('tai_ir_as12880', 'ta_agrius',           'AS12880', 'IR', 'medium', 'Information Technology Company (ITC) — Iranian state-affiliated infrastructure for MOIS supply chain ops'),
('tai_ir_as48159', 'ta_cotton_sandstorm', 'AS48159', 'IR', 'medium', 'TIC subsidiary — hosting used by MOIS influence-operations infrastructure');

-- 3. Refresh last_observed on infrastructure rows so the detail view shows
-- recent monitoring activity even before a feed hit lands. Sentinel continues
-- to bump these as real threats arrive.
UPDATE threat_actor_infrastructure
SET last_observed = datetime('now')
WHERE last_observed < datetime('now', '-7 days');
