-- Migration: 0012_leads_trust
-- Landing page form submissions and brand trust score tracking

-- Landing page lead capture (Request Briefing / Request Access forms)
CREATE TABLE IF NOT EXISTS scan_leads (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  company         TEXT,
  name            TEXT,
  role            TEXT,                                 -- title/position
  form_type       TEXT NOT NULL DEFAULT 'access',       -- access, briefing, demo, contact
  source          TEXT DEFAULT 'landing_page',          -- landing_page, referral, organic
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'new',          -- new, contacted, qualified, converted, rejected
  notes           TEXT DEFAULT '[]',                    -- JSON array
  converted_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_email      ON scan_leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON scan_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_form_type  ON scan_leads(form_type);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON scan_leads(created_at);

-- Brand trust score tracking (continuous monitoring per domain/brand)
CREATE TABLE IF NOT EXISTS trust_score_history (
  id              TEXT PRIMARY KEY,
  domain          TEXT NOT NULL,
  score           REAL NOT NULL,                        -- 0.0–100.0
  previous_score  REAL,
  delta           REAL,                                 -- score change from previous
  components      TEXT DEFAULT '{}',                    -- JSON: {ssl: 95, reputation: 80, phishing: 60, ...}
  threat_count    INTEGER NOT NULL DEFAULT 0,           -- active threats at time of measurement
  risk_level      TEXT NOT NULL DEFAULT 'low',          -- critical, high, medium, low, safe
  measured_by     TEXT NOT NULL DEFAULT 'trust-monitor', -- agent name
  measured_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trust_domain     ON trust_score_history(domain);
CREATE INDEX IF NOT EXISTS idx_trust_measured   ON trust_score_history(measured_at);
CREATE INDEX IF NOT EXISTS idx_trust_risk       ON trust_score_history(risk_level);
CREATE INDEX IF NOT EXISTS idx_trust_domain_time ON trust_score_history(domain, measured_at);
