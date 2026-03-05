-- Migration: 0007_fix_admin_hash
-- Corrects the admin password hash for admin@imprsn8.io (Admin1234!)
-- Previous hash in 0006 was incorrect; this is the correct SHA-256 of "Admin1234!"

UPDATE users
SET password_hash = '5ce41ada64f1e8ffb0acfaafa622b141438f3a5777785e7f0b830fb73e40d3d6'
WHERE email = 'admin@imprsn8.io';
