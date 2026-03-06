-- Migration: 0009_backfill_user_profile_columns
-- Production DB was created without username, bio, avatar_url in the initial
-- schema. Add them safely with IF NOT EXISTS (D1 / SQLite 3.37+).

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
