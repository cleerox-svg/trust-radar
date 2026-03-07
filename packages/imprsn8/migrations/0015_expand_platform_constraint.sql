-- Migration: 0015_expand_platform_constraint
-- Expands monitored_accounts.platform to include free open-source social platforms
-- discovered by RECON agent: bluesky, reddit, github, mastodon.
--
-- SQLite does not support ALTER TABLE ... MODIFY COLUMN, so we recreate the table
-- using the standard SQLite table-rename approach.

PRAGMA foreign_keys = OFF;

-- 1. Create replacement table with expanded platform list
CREATE TABLE monitored_accounts_new (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  influencer_id       TEXT NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL CHECK (platform IN (
    'tiktok', 'instagram', 'x', 'youtube', 'facebook',
    'linkedin', 'twitch', 'threads', 'snapchat', 'pinterest',
    'bluesky', 'reddit', 'github', 'mastodon'
  )),
  handle              TEXT NOT NULL,
  profile_url         TEXT,
  is_verified         INTEGER NOT NULL DEFAULT 0,
  follower_count      INTEGER,
  risk_score          INTEGER NOT NULL DEFAULT 100 CHECK (risk_score BETWEEN 0 AND 100),
  risk_category       TEXT NOT NULL DEFAULT 'unscored' CHECK (risk_category IN (
    'legitimate', 'suspicious', 'imposter', 'unscored'
  )),
  bio_hash            TEXT,
  avatar_hash         TEXT,
  last_scanned_at     TEXT,
  added_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Copy all existing data
INSERT INTO monitored_accounts_new
  SELECT * FROM monitored_accounts;

-- 3. Drop old table
DROP TABLE monitored_accounts;

-- 4. Rename new table
ALTER TABLE monitored_accounts_new RENAME TO monitored_accounts;

PRAGMA foreign_keys = ON;
