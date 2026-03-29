-- Migration 0053: AbuseIPDB + CIRCL Passive DNS + Blocklist.de infrastructure intelligence
-- AbuseIPDB enrichment columns
ALTER TABLE threats ADD COLUMN abuseipdb_checked INTEGER DEFAULT 0;
ALTER TABLE threats ADD COLUMN abuseipdb_score INTEGER;
ALTER TABLE threats ADD COLUMN abuseipdb_reports INTEGER;
ALTER TABLE threats ADD COLUMN abuseipdb_isp TEXT;

-- CIRCL Passive DNS enrichment columns
ALTER TABLE threats ADD COLUMN pdns_checked INTEGER DEFAULT 0;
ALTER TABLE threats ADD COLUMN pdns_correlations INTEGER DEFAULT 0;

-- Passive DNS resolution records (relational — one domain maps to many IPs over time)
CREATE TABLE IF NOT EXISTS passive_dns_records (
  id TEXT PRIMARY KEY,
  threat_id TEXT NOT NULL,
  query_domain TEXT NOT NULL,
  resolved_ip TEXT,
  rrtype TEXT,
  time_first TEXT,
  time_last TEXT,
  source TEXT DEFAULT 'circl',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Register AbuseIPDB feed
INSERT OR IGNORE INTO feed_configs (feed_name, display_name, description, source_url, enabled, schedule_cron, feed_type, rate_limit, batch_size)
VALUES ('abuseipdb', 'AbuseIPDB',
  'IP abuse reputation checks — community-reported attack data with confidence scoring. Free tier: 1000 checks/day.',
  'https://api.abuseipdb.com/api/v2/', 1, '*/30 * * * *', 'enrichment', 1000, 20);

-- Register Blocklist.de feed
INSERT OR IGNORE INTO feed_configs (feed_name, display_name, description, source_url, enabled, schedule_cron, feed_type, rate_limit, batch_size)
VALUES ('blocklist_de', 'Blocklist.de',
  'Community-driven IP blocklist — SSH, FTP, mail, and web server attack sources. Updated every 12 hours.',
  'https://lists.blocklist.de/lists/all.txt', 1, '0 */12 * * *', 'ingest', 60, 500);

-- Register CIRCL Passive DNS feed (DISABLED until credentials obtained)
INSERT OR IGNORE INTO feed_configs (feed_name, display_name, description, source_url, enabled, schedule_cron, feed_type, rate_limit, batch_size)
VALUES ('circl_pdns', 'CIRCL Passive DNS',
  'Historical DNS resolution data from CIRCL — reveals infrastructure sharing between threat domains. Requires free registration.',
  'https://www.circl.lu/pdns/query/', 0, '0 */2 * * *', 'enrichment', 10, 10);
