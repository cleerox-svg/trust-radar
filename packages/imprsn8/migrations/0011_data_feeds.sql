-- ─── Data Feed Sources ────────────────────────────────────────────────────────
-- Stores platform API credentials and pull configuration for automated
-- ingestion of social media data into the impersonation detection pipeline.

CREATE TABLE IF NOT EXISTS data_feeds (
  id                 TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name               TEXT    NOT NULL,
  platform           TEXT    NOT NULL,
  tier               TEXT    NOT NULL DEFAULT 'free'
                             CHECK (tier IN ('free', 'low_cost', 'paid')),
  -- Credentials stored as-is; masked (last 4 chars) in API list responses
  api_key            TEXT,
  api_secret         TEXT,
  -- Platform-specific config as a JSON object string
  -- e.g. {"search_queries":["handle1","handle2"],"region_code":"US"}
  settings_json      TEXT    NOT NULL DEFAULT '{}',
  pull_interval_mins INTEGER NOT NULL DEFAULT 60,
  last_pulled_at     TEXT,
  last_pull_status   TEXT    CHECK (last_pull_status IN ('idle','running','success','error')),
  last_pull_error    TEXT,
  pull_count         INTEGER NOT NULL DEFAULT 0,
  threats_found      INTEGER NOT NULL DEFAULT 0,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feeds_platform   ON data_feeds(platform);
CREATE INDEX IF NOT EXISTS idx_feeds_active      ON data_feeds(is_active);
CREATE INDEX IF NOT EXISTS idx_feeds_next_pull   ON data_feeds(is_active, last_pulled_at);
