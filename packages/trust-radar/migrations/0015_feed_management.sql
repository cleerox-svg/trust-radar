-- Migration: 0015_feed_management
-- Enhances feed_schedules with custom feed support, CRUD, api credentials,
-- settings JSON, and per-pull metrics (last_items_new for "new from last pull").

-- Add new columns to feed_schedules for full CRUD and custom feed support
ALTER TABLE feed_schedules ADD COLUMN description TEXT;
ALTER TABLE feed_schedules ADD COLUMN api_key_encrypted TEXT;       -- stored API key (encrypted/masked)
ALTER TABLE feed_schedules ADD COLUMN api_secret_encrypted TEXT;    -- stored API secret (encrypted/masked)
ALTER TABLE feed_schedules ADD COLUMN settings_json TEXT DEFAULT '{}';  -- provider-specific config
ALTER TABLE feed_schedules ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0;  -- 1 = user-added feed
ALTER TABLE feed_schedules ADD COLUMN created_by TEXT;              -- user_id who added (NULL = system seed)
ALTER TABLE feed_schedules ADD COLUMN last_items_new INTEGER NOT NULL DEFAULT 0;  -- new items from most recent pull
ALTER TABLE feed_schedules ADD COLUMN provider_url TEXT;            -- link to provider docs

CREATE INDEX IF NOT EXISTS idx_feeds_custom ON feed_schedules(is_custom);
