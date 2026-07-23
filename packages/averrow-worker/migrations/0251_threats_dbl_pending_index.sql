-- Partial index for the Spamhaus DBL enrichment work-queue.
--
-- Context (D1 spend blowout, 2026-07): the DBL feed's candidate
-- SELECT (src/feeds/spamhausDbl.ts) and Flight Control's backlog.dbl
-- counter (src/agents/flightControl.ts) both filter:
--
--     WHERE dbl_checked = 0
--       AND malicious_domain IS NOT NULL
--       AND first_seen >= datetime('now', '-7 days')
--
-- No index matched, so each run full-scanned the ~764K-row threats
-- table (25.5M rows/24h — one of the top D1 queries in the budget
-- blowout). A work-queue SELECT can't be cached (it must see fresh
-- rows), so the fix is an index.
--
-- Why this is safe where migration 0095 deliberately skipped DBL:
-- 0095's note ("dbl_checked=0 matches >50% of the table, a partial
-- index would still scan most rows") applies to a count WITHOUT a
-- time bound. Both live queries here additionally filter
-- `first_seen >= -7 days`. Indexing on first_seen DESC turns that
-- into a bounded range scan at the head of the partial index — SQLite
-- reads only the recent slice, never the >50% tail. This mirrors
-- idx_threats_abuseipdb_pending (0095:64), which is likewise a
-- no-severity-filter partial index on first_seen DESC.
--
-- EXPLAIN QUERY PLAN (expected):
--   SEARCH threats USING INDEX idx_threats_dbl_pending (first_seen>?)
-- with `malicious_domain != ''` applied as a cheap residual filter and
-- the `ORDER BY CASE severity ...` satisfied by a temp b-tree sort over
-- the small candidate set (LIMIT 50).
--
-- Column choice: both callers filter/scan on first_seen (NOT
-- created_at, unlike the VT index fixed in 0097), so first_seen DESC
-- is the correct indexed key.
--
-- Write amplification: each threats INSERT/UPDATE touching dbl_checked
-- or malicious_domain writes one index row — same profile as the other
-- *_pending partial indexes, negligible vs the read savings.

CREATE INDEX IF NOT EXISTS idx_threats_dbl_pending
  ON threats(first_seen DESC)
  WHERE dbl_checked = 0
    AND malicious_domain IS NOT NULL;
