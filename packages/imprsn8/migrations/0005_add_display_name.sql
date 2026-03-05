-- Migration: 0005_add_display_name
-- Backfills display_name column on users table (missed in initial remote schema)

ALTER TABLE users ADD COLUMN display_name TEXT;
