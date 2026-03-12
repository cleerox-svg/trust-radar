-- Migration: 0010_feeds
-- Intelligence feed scheduling, ingestion logging, and batch jobs

-- Feed configuration and scheduling (24 feeds)
CREATE TABLE IF NOT EXISTS feed_schedules (
  id              TEXT PRIMARY KEY,
  feed_name       TEXT NOT NULL UNIQUE,                 -- threatfox, feodo, phishtank, cisa_kev, etc.
  display_name    TEXT NOT NULL,
  tier            INTEGER NOT NULL DEFAULT 3,           -- 1-6 priority tier
  category        TEXT NOT NULL DEFAULT 'threat',       -- threat, vulnerability, reputation, social, infrastructure
  url             TEXT NOT NULL,                        -- feed endpoint URL
  method          TEXT NOT NULL DEFAULT 'GET',
  headers         TEXT DEFAULT '{}',                    -- JSON: custom request headers
  interval_mins   INTEGER NOT NULL DEFAULT 60,          -- polling interval in minutes
  enabled         INTEGER NOT NULL DEFAULT 1,
  requires_key    INTEGER NOT NULL DEFAULT 0,           -- needs API key
  api_key_env     TEXT,                                 -- env var name for API key
  parser          TEXT NOT NULL DEFAULT 'json',         -- json, csv, xml, text, custom
  last_run_at     TEXT,
  last_success_at TEXT,
  last_error      TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  circuit_open    INTEGER NOT NULL DEFAULT 0,           -- circuit breaker: 1 = open (paused)
  circuit_opened_at TEXT,
  total_runs      INTEGER NOT NULL DEFAULT 0,
  total_items     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feeds_enabled  ON feed_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_feeds_tier     ON feed_schedules(tier);
CREATE INDEX IF NOT EXISTS idx_feeds_category ON feed_schedules(category);

-- Seed the 24 intelligence feeds
INSERT OR IGNORE INTO feed_schedules (id, feed_name, display_name, tier, category, url, interval_mins, parser, requires_key, api_key_env) VALUES
  ('feed-01', 'threatfox',       'ThreatFox (abuse.ch)',      1, 'threat',         'https://threatfox-api.abuse.ch/api/v1/',                     15, 'json', 0, NULL),
  ('feed-02', 'feodo',           'Feodo Tracker (abuse.ch)',   1, 'threat',         'https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt', 15, 'text', 0, NULL),
  ('feed-03', 'phishtank',       'PhishTank Community',        1, 'threat',         'https://data.phishtank.com/data/online-valid.json',          30, 'json', 0, NULL),
  ('feed-04', 'cisa_kev',        'CISA KEV',                   2, 'vulnerability',  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', 360, 'json', 0, NULL),
  ('feed-05', 'sslbl',           'SSL Blocklist (abuse.ch)',   2, 'threat',         'https://sslbl.abuse.ch/blacklist/sslblacklist.csv',          30, 'csv',  0, NULL),
  ('feed-06', 'malbazaar',       'MalBazaar (abuse.ch)',       2, 'threat',         'https://mb-api.abuse.ch/api/v1/',                            60, 'json', 0, NULL),
  ('feed-07', 'sans_isc',        'SANS ISC Top IPs',           3, 'reputation',     'https://isc.sans.edu/api/topips/records/100?json',           60, 'json', 0, NULL),
  ('feed-08', 'ransomwatch',     'Ransomwatch',                3, 'threat',         'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json', 360, 'json', 0, NULL),
  ('feed-09', 'tor_exits',       'Tor Exit Nodes',             3, 'infrastructure', 'https://check.torproject.org/torbulkexitlist',               60, 'text', 0, NULL),
  ('feed-10', 'ipsum',           'IPsum Reputation',           3, 'reputation',     'https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt', 360, 'text', 0, NULL),
  ('feed-11', 'spamhaus_drop',   'Spamhaus DROP',              3, 'reputation',     'https://www.spamhaus.org/drop/drop.txt',                     360, 'text', 0, NULL),
  ('feed-12', 'blocklist_de',    'Blocklist.de',               3, 'reputation',     'https://lists.blocklist.de/lists/all.txt',                   360, 'text', 0, NULL),
  ('feed-13', 'tweetfeed',       'TweetFeed IOCs',             4, 'social',         'https://raw.githubusercontent.com/0xDanielLopez/TweetFeed/master/today.csv', 30, 'csv', 0, NULL),
  ('feed-14', 'mastodon_iocs',   'Mastodon IOCs',              4, 'social',         'https://ioc.exchange/api/v1/timelines/public?limit=40',      30, 'json', 0, NULL),
  ('feed-15', 'abuseipdb',       'AbuseIPDB',                  5, 'reputation',     'https://api.abuseipdb.com/api/v2/blacklist',                 360, 'json', 1, 'ABUSEIPDB_KEY'),
  ('feed-16', 'virustotal',      'VirusTotal',                 5, 'threat',         'https://www.virustotal.com/api/v3/',                         1440, 'json', 1, 'VIRUSTOTAL_API_KEY'),
  ('feed-17', 'ipqs',            'IPQualityScore',             5, 'reputation',     'https://ipqualityscore.com/api/json/',                       1440, 'json', 1, 'IPQS_KEY'),
  ('feed-18', 'certstream',      'CertStream',                 6, 'infrastructure', 'https://crt.sh/',                                            15, 'json', 0, NULL),
  ('feed-19', 'google_safebrowsing', 'Google Safe Browsing',   6, 'threat',         'https://safebrowsing.googleapis.com/v4/threatListUpdates:fetch', 60, 'json', 1, 'GOOGLE_SB_KEY'),
  ('feed-20', 'cloud_status',    'Cloud Status Monitor',       6, 'infrastructure', 'https://status.cloud.google.com/incidents.json',             15, 'json', 0, NULL),
  ('feed-21', 'cf_radar',        'Cloudflare Radar',           6, 'infrastructure', 'https://api.cloudflare.com/client/v4/radar/attacks/layer3/summary', 60, 'json', 1, 'CF_API_KEY'),
  ('feed-22', 'bgpstream',       'BGPStream',                  6, 'infrastructure', 'https://bgpstream.crosswork.cisco.com/api/events',           60, 'json', 0, NULL),
  ('feed-23', 'greynoise',       'GreyNoise',                  6, 'reputation',     'https://api.greynoise.io/v3/community/',                     360, 'json', 1, 'GREYNOISE_KEY'),
  ('feed-24', 'otx_pulses',      'AlienVault OTX',             6, 'threat',         'https://otx.alienvault.com/api/v1/pulses/subscribed',        60, 'json', 1, 'OTX_KEY');

-- Individual feed run results
CREATE TABLE IF NOT EXISTS feed_ingestions (
  id              TEXT PRIMARY KEY,
  feed_id         TEXT NOT NULL,                        -- FK to feed_schedules.id
  feed_name       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',      -- running, success, partial, failed
  items_fetched   INTEGER NOT NULL DEFAULT 0,
  items_new       INTEGER NOT NULL DEFAULT 0,
  items_duplicate INTEGER NOT NULL DEFAULT 0,
  items_error     INTEGER NOT NULL DEFAULT 0,
  threats_created INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  duration_ms     INTEGER,
  response_size   INTEGER,                              -- bytes
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ingestions_feed_id    ON feed_ingestions(feed_id);
CREATE INDEX IF NOT EXISTS idx_ingestions_feed_name  ON feed_ingestions(feed_name);
CREATE INDEX IF NOT EXISTS idx_ingestions_status     ON feed_ingestions(status);
CREATE INDEX IF NOT EXISTS idx_ingestions_started_at ON feed_ingestions(started_at);

-- Batch job tracking (for large operations spanning multiple feeds/agents)
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id              TEXT PRIMARY KEY,
  job_type        TEXT NOT NULL,                        -- full_ingest, tier_ingest, manual_trigger
  status          TEXT NOT NULL DEFAULT 'queued',       -- queued, running, success, partial, failed
  feeds_total     INTEGER NOT NULL DEFAULT 0,
  feeds_complete  INTEGER NOT NULL DEFAULT 0,
  feeds_failed    INTEGER NOT NULL DEFAULT 0,
  total_items     INTEGER NOT NULL DEFAULT 0,
  total_new       INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  triggered_by    TEXT,                                 -- user_id or 'cron'
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status     ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type       ON ingestion_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON ingestion_jobs(created_at);
