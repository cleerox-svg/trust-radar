-- Migration: 0016_seed_default_feeds
-- Seeds one default (inactive) row for every fully-implemented feed platform
-- that isn't already seeded by earlier migrations.
--
-- Migration 0014 already seeds: github, mastodon
-- This migration seeds: youtube, twitch, reddit, bluesky, rss, x_basic, x_pro
--
-- Uses WHERE NOT EXISTS so this is safe to apply to a database that already
-- has rows for some of these platforms — no duplicates will be created.
-- All rows are seeded inactive (is_active = 0); an admin must add credentials
-- and activate before any pulls will run.

-- ── Free tier ─────────────────────────────────────────────────────────────────

INSERT INTO data_feeds (id, name, platform, tier, api_key, api_secret, settings_json, pull_interval_mins, is_active, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'YouTube Channel Search', 'youtube', 'free',
       NULL, NULL, '{"search_queries":[],"region_code":"US"}', 60, 0, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM data_feeds WHERE platform = 'youtube');

INSERT INTO data_feeds (id, name, platform, tier, api_key, api_secret, settings_json, pull_interval_mins, is_active, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'Twitch Streamer Search', 'twitch', 'free',
       NULL, NULL, '{"search_queries":[]}', 30, 0, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM data_feeds WHERE platform = 'twitch');

INSERT INTO data_feeds (id, name, platform, tier, api_key, api_secret, settings_json, pull_interval_mins, is_active, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'Reddit User Search', 'reddit', 'free',
       NULL, NULL, '{"search_queries":[]}', 60, 0, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM data_feeds WHERE platform = 'reddit');

INSERT INTO data_feeds (id, name, platform, tier, api_key, api_secret, settings_json, pull_interval_mins, is_active, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'Bluesky Actor Search', 'bluesky', 'free',
       NULL, NULL, '{"search_queries":[]}', 30, 0, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM data_feeds WHERE platform = 'bluesky');

INSERT INTO data_feeds (id, name, platform, tier, api_key, api_secret, settings_json, pull_interval_mins, is_active, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'RSS / Atom Feed Monitor', 'rss', 'free',
       NULL, NULL, '{"feed_urls":[]}', 60, 0, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM data_feeds WHERE platform = 'rss');

-- ── Low-cost tier ─────────────────────────────────────────────────────────────

INSERT INTO data_feeds (id, name, platform, tier, api_key, api_secret, settings_json, pull_interval_mins, is_active, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'X / Twitter (Basic)', 'x_basic', 'low_cost',
       NULL, NULL, '{"search_queries":[],"usernames":[]}', 15, 0, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM data_feeds WHERE platform = 'x_basic');

-- ── Paid tier ─────────────────────────────────────────────────────────────────

INSERT INTO data_feeds (id, name, platform, tier, api_key, api_secret, settings_json, pull_interval_mins, is_active, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'X / Twitter (Pro)', 'x_pro', 'paid',
       NULL, NULL, '{"search_queries":[],"usernames":[],"stream_rules":[]}', 5, 0, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM data_feeds WHERE platform = 'x_pro');
