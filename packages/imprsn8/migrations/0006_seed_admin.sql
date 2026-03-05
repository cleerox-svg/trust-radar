-- Migration: 0005_seed_admin
-- Seeds the default admin user (admin@imprsn8.io / Admin1234!)
-- Password is SHA-256("Admin1234!")

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
