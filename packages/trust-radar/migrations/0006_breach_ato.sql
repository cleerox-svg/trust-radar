-- Migration: 0006_breach_ato
-- Breach exposure, account takeover events, and spam trap hits

-- Email/domain breach exposure checks
CREATE TABLE IF NOT EXISTS breach_checks (
  id            TEXT PRIMARY KEY,
  check_type    TEXT NOT NULL DEFAULT 'email',          -- email, domain, credential
  target        TEXT NOT NULL,                          -- email or domain checked
  breach_name   TEXT,
  breach_date   TEXT,
  data_types    TEXT DEFAULT '[]',                      -- JSON array: passwords, emails, phone, etc.
  source        TEXT NOT NULL DEFAULT 'manual',
  source_ref    TEXT,
  severity      TEXT NOT NULL DEFAULT 'medium',
  resolved      INTEGER NOT NULL DEFAULT 0,
  checked_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_breach_target     ON breach_checks(target);
CREATE INDEX IF NOT EXISTS idx_breach_type       ON breach_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_breach_severity   ON breach_checks(severity);
CREATE INDEX IF NOT EXISTS idx_breach_checked_at ON breach_checks(checked_at);

-- Account takeover detection events
CREATE TABLE IF NOT EXISTS ato_events (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,                                   -- affected user
  email         TEXT NOT NULL,
  event_type    TEXT NOT NULL DEFAULT 'suspicious_login', -- suspicious_login, password_reset, mfa_bypass, credential_stuffing
  ip_address    TEXT,
  country_code  TEXT,
  user_agent    TEXT,
  risk_score    REAL NOT NULL DEFAULT 0.5,              -- 0.0–1.0
  details       TEXT DEFAULT '{}',                      -- JSON
  status        TEXT NOT NULL DEFAULT 'open',           -- open, investigating, confirmed, false_positive, resolved
  source        TEXT NOT NULL DEFAULT 'monitor',
  detected_at   TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ato_email       ON ato_events(email);
CREATE INDEX IF NOT EXISTS idx_ato_status      ON ato_events(status);
CREATE INDEX IF NOT EXISTS idx_ato_event_type  ON ato_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ato_detected_at ON ato_events(detected_at);

-- Spam trap / honeypot email captures
CREATE TABLE IF NOT EXISTS spam_trap_hits (
  id            TEXT PRIMARY KEY,
  trap_address  TEXT NOT NULL,
  sender        TEXT,
  sender_ip     TEXT,
  subject       TEXT,
  headers       TEXT DEFAULT '{}',                      -- JSON
  body_preview  TEXT,
  threat_id     TEXT,
  captured_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spam_trap_sender     ON spam_trap_hits(sender);
CREATE INDEX IF NOT EXISTS idx_spam_trap_sender_ip  ON spam_trap_hits(sender_ip);
CREATE INDEX IF NOT EXISTS idx_spam_trap_captured   ON spam_trap_hits(captured_at);
