-- Migration: 0003_admin
-- Adds is_admin flag to users for admin panel access

ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
