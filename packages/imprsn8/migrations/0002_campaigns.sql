-- imprsn8 D1 Schema
-- Migration: 0002_campaigns

-- Campaigns (grouping of content/profile work across channels)
CREATE TABLE IF NOT EXISTS campaigns (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'mobile', 'email', 'api')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'done')),
  reach       INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Impression events (live feed entries)
CREATE TABLE IF NOT EXISTS impression_events (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  campaign_id     TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  campaign_name   TEXT,
  channel         TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'mobile', 'email', 'api')),
  action          TEXT NOT NULL,
  influence_score REAL NOT NULL DEFAULT 0 CHECK (influence_score BETWEEN 0 AND 1),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user    ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_events_user       ON impression_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_campaign   ON impression_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_created    ON impression_events(created_at);
