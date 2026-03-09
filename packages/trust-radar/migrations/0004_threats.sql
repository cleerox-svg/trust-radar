-- Migration: 0004_threats
-- Primary threat intelligence table — phishing, malware, impersonation, etc.

CREATE TABLE IF NOT EXISTS threats (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL DEFAULT 'unknown',       -- phishing, malware, impersonation, c2, ransomware, scam
  title         TEXT NOT NULL,
  description   TEXT,
  severity      TEXT NOT NULL DEFAULT 'medium',        -- critical, high, medium, low, info
  confidence    REAL NOT NULL DEFAULT 0.5,             -- 0.0–1.0
  status        TEXT NOT NULL DEFAULT 'new',           -- new, investigating, confirmed, mitigated, resolved, false_positive
  source        TEXT NOT NULL DEFAULT 'manual',        -- feed name, manual, agent, scan
  source_ref    TEXT,                                  -- external reference ID
  ioc_type      TEXT,                                  -- domain, url, ip, hash, email
  ioc_value     TEXT,                                  -- the actual indicator
  domain        TEXT,
  url           TEXT,
  ip_address    TEXT,
  country_code  TEXT,
  asn           TEXT,
  tags          TEXT DEFAULT '[]',                     -- JSON array
  metadata      TEXT DEFAULT '{}',                     -- JSON object
  first_seen    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen     TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at   TEXT,
  created_by    TEXT,                                  -- user_id or agent name
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_threats_type       ON threats(type);
CREATE INDEX IF NOT EXISTS idx_threats_severity   ON threats(severity);
CREATE INDEX IF NOT EXISTS idx_threats_status     ON threats(status);
CREATE INDEX IF NOT EXISTS idx_threats_source     ON threats(source);
CREATE INDEX IF NOT EXISTS idx_threats_ioc_type   ON threats(ioc_type);
CREATE INDEX IF NOT EXISTS idx_threats_ioc_value  ON threats(ioc_value);
CREATE INDEX IF NOT EXISTS idx_threats_domain     ON threats(domain);
CREATE INDEX IF NOT EXISTS idx_threats_ip         ON threats(ip_address);
CREATE INDEX IF NOT EXISTS idx_threats_first_seen ON threats(first_seen);
CREATE INDEX IF NOT EXISTS idx_threats_created_at ON threats(created_at);
