-- Migration: 0008_backfill_score_columns
-- Adds impression_score and total_analyses to users if missing from the
-- original remote schema (these were in 0001_initial.sql but not migrated
-- to the remote DB, similar to the display_name issue fixed in 0005).
-- IF NOT EXISTS is safe on D1 (SQLite 3.37+) — no-op if columns already exist.

ALTER TABLE users ADD COLUMN IF NOT EXISTS impression_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_analyses INTEGER NOT NULL DEFAULT 0;
