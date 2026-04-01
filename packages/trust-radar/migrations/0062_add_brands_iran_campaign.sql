-- Migration 0062: Add missing brands, Iran IRGC campaign, and tag existing threats
-- Priority 1 items: brands (Meta, Palantir), campaign creation, threat tagging

-- ─── A) Add source column to brands if missing ─────────────────────
ALTER TABLE brands ADD COLUMN source TEXT DEFAULT 'curated';

-- ─── B) Add description column to campaigns if missing ─────────────
ALTER TABLE campaigns ADD COLUMN description TEXT;

-- ─── C) Add Meta to monitored_brands ────────────────────────────────
INSERT OR IGNORE INTO monitored_brands (brand_id, tenant_id, added_by, status)
SELECT id, '__internal__', 'aae5bfa2-e702-4d48-99f9-4adef43a8330', 'active'
FROM brands WHERE canonical_domain = 'meta.com';

-- ─── D) Add Palantir to brands + monitored_brands ──────────────────
INSERT OR IGNORE INTO brands (id, name, canonical_domain, sector, source)
VALUES ('palantir-com', 'Palantir', 'palantir.com', 'defense', 'curated');

INSERT OR IGNORE INTO monitored_brands (brand_id, tenant_id, added_by, status)
VALUES ('palantir-com', '__internal__', 'aae5bfa2-e702-4d48-99f9-4adef43a8330', 'active');

-- ─── E) Create Iran IRGC Retaliation Campaign ──────────────────────
INSERT OR IGNORE INTO campaigns (id, name, description, attack_pattern, status)
VALUES (
  'iran-irgc-retaliation-2026',
  'IRGC Retaliation Campaign — Operation Epic Fury Response',
  'Iranian state-sponsored and hacktivist cyber operations targeting US tech companies in retaliation for Operation Epic Fury strikes. Named targets include Amazon, Microsoft, Google, Apple, Oracle, and 13 others. Threat actors: Handala (MOIS), Hydro Kitten (IRGC), CyberAv3ngers. TTPs: credential harvesting, wiper attacks, DDoS, website defacement, subdomain brand spoofing, vishing.',
  'credential_harvesting,wiper,ddos,defacement,vishing',
  'active'
);

-- ─── F) Tag existing Iranian threats to campaign ────────────────────
UPDATE threats SET campaign_id = 'iran-irgc-retaliation-2026'
WHERE country_code = 'IR'
AND first_seen >= '2026-02-28'
AND campaign_id IS NULL;
