-- Migration: 0013_fix_assigned_influencer_fk
-- assigned_influencer_id was incorrectly defined as REFERENCES users(id).
-- It must reference influencer_profiles(id) since invite tokens carry influencer_profiles IDs.
-- SQLite doesn't support ALTER COLUMN, so we drop and re-add.

ALTER TABLE users DROP COLUMN assigned_influencer_id;
ALTER TABLE users ADD COLUMN assigned_influencer_id TEXT REFERENCES influencer_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_assigned_influencer ON users(assigned_influencer_id);
