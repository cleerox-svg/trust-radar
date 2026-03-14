-- Trust Radar D1 Schema
-- Migration: 0001_initial

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  scans_used  INTEGER NOT NULL DEFAULT 0,
  scans_limit INTEGER NOT NULL DEFAULT 10,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  key_hash   TEXT NOT NULL UNIQUE,
  last_used  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scan Results
CREATE TABLE IF NOT EXISTS scans (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  url          TEXT NOT NULL,
  domain       TEXT NOT NULL,
  trust_score  INTEGER NOT NULL CHECK (trust_score BETWEEN 0 AND 100),
  risk_level   TEXT NOT NULL CHECK (risk_level IN ('safe', 'low', 'medium', 'high', 'critical')),
  flags        TEXT NOT NULL DEFAULT '[]',  -- JSON array
  metadata     TEXT NOT NULL DEFAULT '{}',  -- JSON object
  source       TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'api', 'extension')),
  cached       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Domain Cache (avoid re-scanning the same domain too frequently)
CREATE TABLE IF NOT EXISTS domain_cache (
  domain       TEXT PRIMARY KEY,
  trust_score  INTEGER NOT NULL,
  risk_level   TEXT NOT NULL,
  flags        TEXT NOT NULL DEFAULT '[]',
  metadata     TEXT NOT NULL DEFAULT '{}',
  expires_at   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scans_user_id     ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_domain       ON scans(domain);
CREATE INDEX IF NOT EXISTS idx_scans_created_at   ON scans(created_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id   ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_cache_exp   ON domain_cache(expires_at);
