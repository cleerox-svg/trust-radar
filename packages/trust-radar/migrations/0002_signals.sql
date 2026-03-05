-- Trust Radar D1 Schema
-- Migration: 0002_signals

-- Signal sources (stations / nodes)
CREATE TABLE IF NOT EXISTS signal_sources (
  id       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name     TEXT NOT NULL UNIQUE,
  label    TEXT NOT NULL,
  active   INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO signal_sources (name, label) VALUES
  ('station-alpha', 'Web Scanner'),
  ('station-beta',  'API Endpoint'),
  ('station-gamma', 'Extension'),
  ('node-001',      'Cache Node');

-- Signals (derived from or independent of scans)
CREATE TABLE IF NOT EXISTS signals (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  source       TEXT NOT NULL DEFAULT 'station-alpha',
  range_m      REAL NOT NULL DEFAULT 0,
  intensity_dbz REAL NOT NULL DEFAULT 0,
  quality      REAL NOT NULL DEFAULT 0 CHECK (quality BETWEEN 0 AND 1),
  tags         TEXT NOT NULL DEFAULT '[]',  -- JSON array
  scan_id      TEXT REFERENCES scans(id) ON DELETE SET NULL,
  captured_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Signal alerts (anomalies flagged for triage)
CREATE TABLE IF NOT EXISTS signal_alerts (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  signal_id  TEXT NOT NULL,
  source     TEXT NOT NULL,
  scan_ref   TEXT,
  quality    REAL NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acked', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_signals_captured   ON signals(captured_at);
CREATE INDEX IF NOT EXISTS idx_signals_source     ON signals(source);
CREATE INDEX IF NOT EXISTS idx_alerts_status      ON signal_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created     ON signal_alerts(created_at);
