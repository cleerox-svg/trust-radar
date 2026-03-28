# Brand UUID Stability + Historical Data Isolation

## Problem
Brand IDs are domain-derived (brand_httpwg_org) — unstable
if domain changes or brand reassigned between orgs.

## Solution
```sql
ALTER TABLE brands ADD COLUMN uuid TEXT UNIQUE
  DEFAULT (lower(hex(randomblob(16))));
CREATE UNIQUE INDEX idx_brands_uuid ON brands(uuid);
```

## Tenant Data Isolation
org_brands join provides isolation — all historical data
automatically scoped when brand assigned to org. No backfill.
```sql
-- All tenant queries follow this pattern:
SELECT t.* FROM threats t
INNER JOIN org_brands ob ON ob.brand_id = t.target_brand_id
WHERE ob.org_id = ?
```

## Customer Onboarding
1. Org created → super admin assigns brands via org_brands
2. Customer logs in → sees brands with FULL historical intel
3. New threats → auto-scoped if brand assigned
