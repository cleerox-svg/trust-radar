-- Migration: 0005_seed_admin
-- Seeds the default admin user (admin@imprsn8.io / Admin1234!)
-- Password is SHA-256("Admin1234!")

INSERT OR IGNORE INTO users (id, email, password_hash, display_name, plan, role, is_admin)
VALUES (
  'admin-00000000-0000-0000-0000-000000000001',
  'admin@imprsn8.io',
  '8255d91c8db453fb78cb647a5d8678e68d8b28bcf4089e959a66abd528bad760',
  'Admin',
  'enterprise',
  'admin',
  1
);
