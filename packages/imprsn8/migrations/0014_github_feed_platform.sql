-- Migration: 0014_github_feed_platform
-- Adds GitHub as a free data feed platform.
-- The data_feeds.platform column is TEXT with no CHECK constraint (set at application layer),
-- so this migration seeds the default GitHub feed configuration and updates the health constant.

-- Seed a default GitHub feed (inactive by default — admin must activate)
INSERT OR IGNORE INTO data_feeds (
  id, name, platform, tier,
  api_key, api_secret,
  settings_json,
  pull_interval_mins,
  is_active,
  created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'GitHub User Search',
  'github',
  'free',
  NULL, NULL,
  '{"search_queries":[]}',
  120,
  0,
  datetime('now'), datetime('now')
);

-- Seed a default Mastodon feed (inactive by default)
INSERT OR IGNORE INTO data_feeds (
  id, name, platform, tier,
  api_key, api_secret,
  settings_json,
  pull_interval_mins,
  is_active,
  created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Mastodon Social Search',
  'mastodon',
  'free',
  NULL, NULL,
  '{"instance":"mastodon.social","search_queries":[]}',
  120,
  0,
  datetime('now'), datetime('now')
);
