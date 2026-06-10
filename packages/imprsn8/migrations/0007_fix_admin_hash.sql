-- Migration: 0007_fix_admin_hash
-- Corrects the admin password hash for admin@imprsn8.io.
-- SECURITY NOTE (audit 2026-06-10, finding C1): an earlier version of this
-- comment documented the cleartext password. That credential is burned and
-- the account is disabled by migration 0019_disable_seeded_admin.sql.

UPDATE users
SET password_hash = '5ce41ada64f1e8ffb0acfaafa622b141438f3a5777785e7f0b830fb73e40d3d6'
WHERE email = 'admin@imprsn8.io';
