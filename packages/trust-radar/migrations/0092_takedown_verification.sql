-- Add verification columns to takedown_requests for periodic domain rescan.
-- Sparrow Phase F checks taken-down domains every 7 days to detect resurrection.

ALTER TABLE takedown_requests ADD COLUMN last_verified_at TEXT;
ALTER TABLE takedown_requests ADD COLUMN verification_status TEXT DEFAULT 'unchecked';
-- Values: 'unchecked' | 'down' | 'alive'

-- Index for the Phase F rescan query: taken-down domains due for verification
CREATE INDEX IF NOT EXISTS idx_takedown_rescan_pending
  ON takedown_requests(last_verified_at)
  WHERE status = 'taken_down' AND target_type IN ('domain', 'url');
