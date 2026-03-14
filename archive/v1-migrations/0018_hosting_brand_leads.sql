-- Migration: 0018_hosting_brand_leads
-- Adds hosting provider tracking, brand scan engine, and leads enhancements

-- ─── Hosting provider columns on threats ─────────────────────────
-- threats.asn already exists from 0004, add ISP and hosting info
ALTER TABLE threats ADD COLUMN isp_name TEXT;
ALTER TABLE threats ADD COLUMN hosting_provider TEXT;
ALTER TABLE threats ADD COLUMN is_datacenter INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_threats_isp ON threats(isp_name);
CREATE INDEX IF NOT EXISTS idx_threats_hosting ON threats(hosting_provider);

-- ─── Provider threat stats (aggregated by hosting provider) ──────
CREATE TABLE IF NOT EXISTS provider_threat_stats (
  id              TEXT PRIMARY KEY,
  provider_name   TEXT NOT NULL,
  period          TEXT NOT NULL,            -- 'today', '7d', '30d', 'all'
  threat_count    INTEGER NOT NULL DEFAULT 0,
  critical_count  INTEGER NOT NULL DEFAULT 0,
  high_count      INTEGER NOT NULL DEFAULT 0,
  phishing_count  INTEGER NOT NULL DEFAULT 0,
  malware_count   INTEGER NOT NULL DEFAULT 0,
  top_countries   TEXT DEFAULT '[]',        -- JSON array of {country_code, count}
  trend_direction TEXT DEFAULT 'stable',    -- 'up', 'down', 'stable'
  trend_pct       REAL DEFAULT 0,           -- percentage change vs prior period
  computed_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_stats_name ON provider_threat_stats(provider_name);
CREATE INDEX IF NOT EXISTS idx_provider_stats_period ON provider_threat_stats(period);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_stats_unique ON provider_threat_stats(provider_name, period);

-- ─── Brand scans (domain exposure analysis) ─────────────────────
CREATE TABLE IF NOT EXISTS brand_scans (
  id              TEXT PRIMARY KEY,
  domain          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
  trust_score     REAL,                             -- 0-100 computed score
  -- Email security
  spf_record      TEXT,
  spf_policy      TEXT,                             -- none, softfail, hardfail, neutral
  dmarc_record    TEXT,
  dmarc_policy    TEXT,                             -- none, quarantine, reject
  dkim_found      INTEGER DEFAULT 0,
  mx_records      TEXT DEFAULT '[]',                -- JSON array
  -- Lookalike detection
  lookalikes_found INTEGER DEFAULT 0,
  lookalikes       TEXT DEFAULT '[]',               -- JSON array of {domain, type, registered, ip}
  -- Feed cross-reference
  feed_mentions    INTEGER DEFAULT 0,
  feed_matches     TEXT DEFAULT '[]',               -- JSON array of threat references
  -- Certificate transparency
  cert_matches     INTEGER DEFAULT 0,
  cert_details     TEXT DEFAULT '[]',               -- JSON array
  -- Summary
  risk_factors     TEXT DEFAULT '[]',               -- JSON array of risk items
  recommendations  TEXT DEFAULT '[]',               -- JSON array
  scan_duration_ms INTEGER,
  scanned_by       TEXT,                            -- user_id or 'public'
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brand_scans_domain ON brand_scans(domain);
CREATE INDEX IF NOT EXISTS idx_brand_scans_status ON brand_scans(status);
CREATE INDEX IF NOT EXISTS idx_brand_scans_created ON brand_scans(created_at);

-- ─── Add phone and domain to leads table ─────────────────────────
ALTER TABLE scan_leads ADD COLUMN phone TEXT;
ALTER TABLE scan_leads ADD COLUMN domain TEXT;
ALTER TABLE scan_leads ADD COLUMN brand_scan_id TEXT;
