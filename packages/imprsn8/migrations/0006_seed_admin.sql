-- Migration: 0006_seed_admin
-- Seeds the default admin user (admin@imprsn8.io).
-- SECURITY NOTE (audit 2026-06-10, finding C1): an earlier version of this
-- comment documented the seeded cleartext password. That credential is burned
-- and the account is disabled by migration 0019_disable_seeded_admin.sql.
-- Do not seed fixed credentials via migrations — bootstrap admins out-of-band.

INSERT OR IGNORE INTO users (id, email, password_hash, display_name, plan, role, is_admin)
VALUES (
  'admin-00000000-0000-0000-0000-000000000001',
  'admin@imprsn8.io',
  '5ce41ada64f1e8ffb0acfaafa622b141438f3a5777785e7f0b830fb73e40d3d6',
  'Admin',
  'enterprise',
  'admin',
  1
);
