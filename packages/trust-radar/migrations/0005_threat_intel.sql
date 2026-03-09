-- Migration: 0005_threat_intel
-- CVE advisories, AI briefings, and community IOCs

-- CVE advisories and vulnerability data
CREATE TABLE IF NOT EXISTS threat_news (
  id            TEXT PRIMARY KEY,
  cve_id        TEXT,                                   -- CVE-YYYY-NNNNN
  title         TEXT NOT NULL,
  description   TEXT,
  severity      TEXT NOT NULL DEFAULT 'medium',
  cvss_score    REAL,
  affected      TEXT DEFAULT '[]',                      -- JSON array of affected products
  references    TEXT DEFAULT '[]',                      -- JSON array of URLs
  source        TEXT NOT NULL DEFAULT 'cisa_kev',
  source_ref    TEXT,
  published_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_threat_news_cve      ON threat_news(cve_id);
CREATE INDEX IF NOT EXISTS idx_threat_news_severity ON threat_news(severity);
CREATE INDEX IF NOT EXISTS idx_threat_news_source   ON threat_news(source);

-- AI-generated intelligence briefings
CREATE TABLE IF NOT EXISTS threat_briefings (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  body          TEXT NOT NULL,                          -- markdown content
  severity      TEXT NOT NULL DEFAULT 'medium',
  category      TEXT NOT NULL DEFAULT 'general',        -- general, campaign, vulnerability, incident
  threat_ids    TEXT DEFAULT '[]',                      -- JSON array of related threat IDs
  generated_by  TEXT NOT NULL DEFAULT 'executive-intel', -- agent name
  approved_by   TEXT,                                   -- user_id of approver
  status        TEXT NOT NULL DEFAULT 'draft',          -- draft, published, archived
  published_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_briefings_status     ON threat_briefings(status);
CREATE INDEX IF NOT EXISTS idx_briefings_category   ON threat_briefings(category);
CREATE INDEX IF NOT EXISTS idx_briefings_created_at ON threat_briefings(created_at);

-- Community-sourced IOCs from social media (Twitter/X, Mastodon, etc.)
CREATE TABLE IF NOT EXISTS social_iocs (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL,                          -- twitter, mastodon, reddit, telegram
  author        TEXT,
  post_url      TEXT,
  ioc_type      TEXT NOT NULL,                          -- domain, url, ip, hash, email
  ioc_value     TEXT NOT NULL,
  confidence    REAL NOT NULL DEFAULT 0.5,
  context       TEXT,                                   -- extracted context around the IOC
  tags          TEXT DEFAULT '[]',
  threat_id     TEXT,                                   -- FK to threats if matched
  verified      INTEGER NOT NULL DEFAULT 0,
  captured_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_social_iocs_ioc_type  ON social_iocs(ioc_type);
CREATE INDEX IF NOT EXISTS idx_social_iocs_ioc_value ON social_iocs(ioc_value);
CREATE INDEX IF NOT EXISTS idx_social_iocs_platform  ON social_iocs(platform);
CREATE INDEX IF NOT EXISTS idx_social_iocs_captured  ON social_iocs(captured_at);
