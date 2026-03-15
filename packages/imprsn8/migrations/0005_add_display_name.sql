-- Migration: 0005_add_display_name
-- Originally: ALTER TABLE users ADD COLUMN display_name TEXT;
-- The display_name column already exists in the remote DB (added before migration tracking).
-- This migration is now a no-op marker so the migration tracker advances past it.

SELECT 1;
