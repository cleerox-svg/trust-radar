-- Migration: 0019_disable_seeded_admin
-- Security (audit 2026-06-10, finding C1): migrations 0006/0007 seeded an
-- admin account whose cleartext password was documented in repository
-- comments — the credential is burned. This migration neutralizes the account:
--   * password_hash is set to the sentinel '!disabled!', which can never match
--     any hash the verifier accepts (it is neither a 64-char SHA-256 hex digest
--     nor a valid 'pbkdf2$...' record), so login is impossible.
--   * is_admin is cleared so the row grants no privileges even if somehow
--     re-enabled.
-- A replacement admin must be bootstrapped out-of-band — e.g. an existing
-- admin uses POST /api/admin/users/direct-create, or run a one-off
-- `wrangler d1 execute` with a freshly generated PBKDF2 hash. Never seed
-- fixed credentials via migrations.

UPDATE users
SET password_hash = '!disabled!',
    is_admin = 0,
    updated_at = datetime('now')
WHERE email = 'admin@imprsn8.io';
