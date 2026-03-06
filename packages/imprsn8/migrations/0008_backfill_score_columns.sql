-- Migration: 0008_backfill_score_columns
-- Adds impression_score and total_analyses to users.
-- These were in an older version of 0001_initial.sql but not in the original
-- remote schema. The current 0001_initial.sql no longer includes them so this
-- migration is safe on both production and fresh databases.

ALTER TABLE users ADD COLUMN impression_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN total_analyses INTEGER NOT NULL DEFAULT 0;
