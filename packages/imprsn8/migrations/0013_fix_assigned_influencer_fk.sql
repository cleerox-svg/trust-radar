-- Migration: 0013_fix_assigned_influencer_fk
-- Originally: DROP + re-ADD assigned_influencer_id to fix FK reference.
-- This change already exists in the remote DB (applied before migration tracking).
-- No-op marker so the migration tracker advances past it.

CREATE INDEX IF NOT EXISTS idx_users_assigned_influencer ON users(assigned_influencer_id);
