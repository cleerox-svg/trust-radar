-- Migration: 0011_access_control
-- RBAC, group-based permissions, session tracking

-- Extended user profiles
CREATE TABLE IF NOT EXISTS profiles (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE,                 -- FK to users.id
  display_name    TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'customer',     -- admin, analyst, customer, influencer
  timezone        TEXT DEFAULT 'UTC',
  notification_prefs TEXT DEFAULT '{}',                 -- JSON
  onboarded       INTEGER NOT NULL DEFAULT 0,
  invited_by      TEXT,                                 -- user_id who sent invite
  invite_code     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role    ON profiles(role);

-- Role assignments (supports multiple roles per user)
CREATE TABLE IF NOT EXISTS user_roles (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,                        -- FK to users.id
  role            TEXT NOT NULL,                        -- admin, analyst, customer, influencer
  granted_by      TEXT,                                 -- user_id who granted
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at      TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique ON user_roles(user_id, role) WHERE active = 1;
CREATE INDEX IF NOT EXISTS idx_user_roles_user     ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role     ON user_roles(role);

-- Named permission groups
CREATE TABLE IF NOT EXISTS access_groups (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  is_default      INTEGER NOT NULL DEFAULT 0,           -- auto-assign to new users
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default groups
INSERT OR IGNORE INTO access_groups (id, name, description, is_default) VALUES
  ('grp-admin',    'Administrators',  'Full platform access',                  0),
  ('grp-analyst',  'SOC Analysts',    'Investigation and response access',     0),
  ('grp-customer', 'Customers',       'Dashboard and scan access',             1),
  ('grp-readonly', 'Read Only',       'View-only access to dashboards',        0);

-- User-to-group assignments
CREATE TABLE IF NOT EXISTS user_group_assignments (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  group_id        TEXT NOT NULL,
  assigned_by     TEXT,
  assigned_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at      TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uga_unique ON user_group_assignments(user_id, group_id) WHERE active = 1;
CREATE INDEX IF NOT EXISTS idx_uga_user     ON user_group_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_uga_group    ON user_group_assignments(group_id);

-- Module access per group
CREATE TABLE IF NOT EXISTS group_module_permissions (
  id              TEXT PRIMARY KEY,
  group_id        TEXT NOT NULL,                        -- FK to access_groups.id
  module          TEXT NOT NULL,                        -- dashboard, scan, threats, investigations, agents, feeds, admin, etc.
  can_read        INTEGER NOT NULL DEFAULT 1,
  can_write       INTEGER NOT NULL DEFAULT 0,
  can_delete      INTEGER NOT NULL DEFAULT 0,
  can_approve     INTEGER NOT NULL DEFAULT 0,           -- HITL approval rights
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gmp_unique ON group_module_permissions(group_id, module);
CREATE INDEX IF NOT EXISTS idx_gmp_group  ON group_module_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_gmp_module ON group_module_permissions(module);

-- Seed default permissions
INSERT OR IGNORE INTO group_module_permissions (id, group_id, module, can_read, can_write, can_delete, can_approve) VALUES
  -- Admins: full access to everything
  ('perm-01', 'grp-admin', 'dashboard',      1, 1, 1, 1),
  ('perm-02', 'grp-admin', 'scan',           1, 1, 1, 1),
  ('perm-03', 'grp-admin', 'threats',        1, 1, 1, 1),
  ('perm-04', 'grp-admin', 'investigations', 1, 1, 1, 1),
  ('perm-05', 'grp-admin', 'agents',         1, 1, 1, 1),
  ('perm-06', 'grp-admin', 'feeds',          1, 1, 1, 1),
  ('perm-07', 'grp-admin', 'admin',          1, 1, 1, 1),
  ('perm-08', 'grp-admin', 'takedowns',      1, 1, 1, 1),
  -- Analysts: read/write on most, approve on takedowns
  ('perm-10', 'grp-analyst', 'dashboard',      1, 1, 0, 0),
  ('perm-11', 'grp-analyst', 'scan',           1, 1, 0, 0),
  ('perm-12', 'grp-analyst', 'threats',        1, 1, 0, 0),
  ('perm-13', 'grp-analyst', 'investigations', 1, 1, 0, 0),
  ('perm-14', 'grp-analyst', 'agents',         1, 0, 0, 1),
  ('perm-15', 'grp-analyst', 'feeds',          1, 0, 0, 0),
  ('perm-16', 'grp-analyst', 'takedowns',      1, 1, 0, 1),
  -- Customers: read dashboard + scan
  ('perm-20', 'grp-customer', 'dashboard',      1, 0, 0, 0),
  ('perm-21', 'grp-customer', 'scan',           1, 1, 0, 0),
  ('perm-22', 'grp-customer', 'threats',        1, 0, 0, 0);

-- Login/logout audit trail
CREATE TABLE IF NOT EXISTS session_events (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  event_type      TEXT NOT NULL,                        -- login, logout, token_refresh, password_change, mfa_enable, mfa_disable, forced_logout
  ip_address      TEXT,
  user_agent      TEXT,
  country_code    TEXT,
  metadata        TEXT DEFAULT '{}',                    -- JSON
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON session_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_event_type ON session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON session_events(created_at);
