-- imprsn8 D1 Schema
-- Migration: 0001_initial

-- Users / Profiles
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  username        TEXT UNIQUE,
  bio             TEXT,
  avatar_url      TEXT,
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Social Profiles linked to a user
CREATE TABLE IF NOT EXISTS social_profiles (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'github', 'instagram', 'tiktok', 'youtube', 'website')),
  handle      TEXT NOT NULL,
  profile_url TEXT,
  verified    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, platform)
);

-- Impression Analyses
CREATE TABLE IF NOT EXISTS analyses (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('profile', 'content', 'bio', 'portfolio')),
  input_text       TEXT,
  input_url        TEXT,
  platform         TEXT,
  score            INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  breakdown        TEXT NOT NULL DEFAULT '{}',  -- JSON: { clarity, professionalism, consistency, impact }
  suggestions      TEXT NOT NULL DEFAULT '[]',  -- JSON array of improvement suggestions
  strengths        TEXT NOT NULL DEFAULT '[]',  -- JSON array of strengths identified
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Score History (daily snapshots for trend charts)
CREATE TABLE IF NOT EXISTS score_history (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL,
  snapshot_at TEXT NOT NULL DEFAULT (datetime('now', 'start of day'))
);

-- Impressions received from others (public profile views, reactions)
CREATE TABLE IF NOT EXISTS impressions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  source      TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('direct', 'share', 'search', 'embed')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_social_user       ON social_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user      ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created   ON analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_score_history_user ON score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_impressions_profile ON impressions(profile_id);
CREATE INDEX IF NOT EXISTS idx_impressions_created ON impressions(created_at);
