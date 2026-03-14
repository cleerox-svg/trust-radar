-- Migration: 0016_feed_quotas
-- Adds per-feed daily API quota limits so the system knows each provider's
-- free-tier cap and can enforce proactive guards + display usage in the UI.
--
-- daily_limit: max API calls per UTC day (NULL = no known hard limit)
-- Actual call counts are tracked in KV under feed-quota:{feedName}:{YYYY-MM-DD}

ALTER TABLE feed_schedules ADD COLUMN daily_limit INTEGER;

-- Seed known daily limits (free-tier caps from provider docs)
UPDATE feed_schedules SET daily_limit = 500  WHERE feed_name = 'virustotal';          -- Free: 500/day
UPDATE feed_schedules SET daily_limit = 1000 WHERE feed_name = 'abuseipdb';           -- Free: 1,000/day
UPDATE feed_schedules SET daily_limit = 50   WHERE feed_name = 'greynoise';           -- Community: 50/day
UPDATE feed_schedules SET daily_limit = 167  WHERE feed_name = 'ipqs';                -- Free: 5,000/mo ≈ 167/day
UPDATE feed_schedules SET daily_limit = 10000 WHERE feed_name = 'google_safebrowsing'; -- Free: 10,000/day
-- otx_pulses: 10,000/hr — effectively unlimited, no limit set
-- cf_radar: Cloudflare token-based, no published hard limit
-- All other feeds: public/unauthenticated, no hard daily limit
