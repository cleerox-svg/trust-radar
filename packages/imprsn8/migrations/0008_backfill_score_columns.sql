-- Migration: 0008_backfill_score_columns
-- Adds impression_score and total_analyses to users.
-- These columns already exist in the remote DB (applied before migration tracking).
-- No-op marker so the migration tracker advances past it.

SELECT 1;
