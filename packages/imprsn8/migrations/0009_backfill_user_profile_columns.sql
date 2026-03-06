-- Migration: 0009_backfill_user_profile_columns
-- Adds username, bio, avatar_url to users.
-- These were never in the original remote schema. The current 0001_initial.sql
-- no longer includes them so this migration is safe on both production and
-- fresh databases. D1 does not support ADD COLUMN IF NOT EXISTS.

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
