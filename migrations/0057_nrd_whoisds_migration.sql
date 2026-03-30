-- Migration 0057: Replace NRD source from xRuffKez/Hagezi (EOL Dec 2025) to WhoisDS.com
-- Also creates nrd_domains reference table for all NRD storage

-- Update feed_configs source URL
UPDATE feed_configs
SET source_url = 'https://whoisds.com/whois-database/newly-registered-domains/',
    display_name = 'WhoisDS Newly Registered Domains'
WHERE feed_name = 'nrd_hagezi';

-- Create NRD reference table for storing all newly registered domains
CREATE TABLE IF NOT EXISTS nrd_domains (
  domain TEXT PRIMARY KEY,
  registered_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  brand_matched INTEGER DEFAULT 0
);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_nrd_domains_date ON nrd_domains(registered_date);
