-- Batch 09: Add all new brands to monitored_brands
-- This picks up ALL curated brands and ensures they're monitored

INSERT OR IGNORE INTO monitored_brands (brand_id, tenant_id, added_by, status)
SELECT id, '__internal__', 'aae5bfa2-e702-4d48-99f9-4adef43a8330', 'active'
FROM brands WHERE source = 'curated' AND monitoring_status = 'active';
