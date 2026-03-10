-- Seed cross-platform admin: admin@imprsn8.io gets admin access to Trust Radar.
-- Password: AdminRadar2026!  (SHA-256 hash stored below)
-- This user can be re-authenticated via the standard /api/auth/login endpoint.
-- Run with: wrangler d1 execute radar-db --file migrations/0013_seed_cross_platform_admin.sql

INSERT OR IGNORE INTO users (
  id,
  email,
  password_hash,
  plan,
  scans_used,
  scans_limit,
  is_admin,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'admin@imprsn8.io',
  'b7a7e328b3f2dfe6235d205ccf6acd25ace7bcfb6d50f9c05ce474e622deb144',
  'enterprise',
  0,
  999999,
  1,
  datetime('now'),
  datetime('now')
);

-- If the account already exists (registered independently), promote it to admin.
UPDATE users
SET
  is_admin   = 1,
  plan       = 'enterprise',
  scans_limit = 999999,
  updated_at = datetime('now')
WHERE email = 'admin@imprsn8.io'
  AND id    != 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
