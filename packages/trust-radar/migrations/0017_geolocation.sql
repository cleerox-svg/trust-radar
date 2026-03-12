-- Add geolocation columns to scans table (Phase 1 — heatmap fix)
ALTER TABLE scans ADD COLUMN ip_address TEXT;
ALTER TABLE scans ADD COLUMN lat REAL;
ALTER TABLE scans ADD COLUMN lng REAL;
ALTER TABLE scans ADD COLUMN geo_city TEXT;
ALTER TABLE scans ADD COLUMN geo_country TEXT;
ALTER TABLE scans ADD COLUMN geo_country_code TEXT;

-- Index for heatmap queries
CREATE INDEX IF NOT EXISTS idx_scans_geo ON scans(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Aggregate stats table for homepage counter
CREATE TABLE IF NOT EXISTS threat_stats_hourly (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  hour_bucket     TEXT NOT NULL,
  total_scans     INTEGER DEFAULT 0,
  total_threats   INTEGER DEFAULT 0,
  unique_countries INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);
