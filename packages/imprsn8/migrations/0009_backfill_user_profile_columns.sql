-- Migration: 0009_backfill_user_profile_columns
-- Adds username, bio, avatar_url to users.
-- These columns already exist in the remote DB (applied before migration tracking).
-- No-op marker so the migration tracker advances past it.

SELECT 1;
