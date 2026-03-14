-- Migration: 0008_investigations
-- Case management, takedowns, evidence, campaigns, abuse mailbox

-- Investigation tickets with LRX-XXXXX IDs
CREATE TABLE IF NOT EXISTS investigation_tickets (
  id              TEXT PRIMARY KEY,
  ticket_id       TEXT NOT NULL UNIQUE,                 -- LRX-00001 format
  title           TEXT NOT NULL,
  description     TEXT,
  severity        TEXT NOT NULL DEFAULT 'medium',       -- critical, high, medium, low
  status          TEXT NOT NULL DEFAULT 'open',         -- open, investigating, escalated, resolved, closed
  priority        INTEGER NOT NULL DEFAULT 3,           -- 1 (highest) to 5 (lowest)
  category        TEXT NOT NULL DEFAULT 'general',      -- phishing, malware, impersonation, ato, breach, other
  assignee_id     TEXT,                                 -- user_id of assigned analyst
  threat_ids      TEXT DEFAULT '[]',                    -- JSON array of related threat IDs
  evidence_ids    TEXT DEFAULT '[]',                    -- JSON array of evidence capture IDs
  tags            TEXT DEFAULT '[]',
  notes           TEXT DEFAULT '[]',                    -- JSON array of {author, text, timestamp}
  resolution      TEXT,
  sla_due_at      TEXT,
  escalated_at    TEXT,
  resolved_at     TEXT,
  closed_at       TEXT,
  created_by      TEXT NOT NULL,                        -- user_id
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id  ON investigation_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status     ON investigation_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_severity   ON investigation_tickets(severity);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee   ON investigation_tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category   ON investigation_tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON investigation_tickets(created_at);

-- Takedown / erasure action tracking
CREATE TABLE IF NOT EXISTS erasure_actions (
  id              TEXT PRIMARY KEY,
  ticket_id       TEXT,                                 -- FK to investigation_tickets.id
  target_type     TEXT NOT NULL,                        -- domain, url, social_account, content
  target_value    TEXT NOT NULL,
  provider        TEXT NOT NULL,                        -- registrar name, hosting provider, social platform
  provider_email  TEXT,
  method          TEXT NOT NULL DEFAULT 'email',        -- email, api, form, legal
  status          TEXT NOT NULL DEFAULT 'draft',        -- draft, submitted, acknowledged, in_review, resolved, rejected, expired
  abuse_notice    TEXT,                                 -- generated abuse notice content
  response        TEXT,                                 -- provider response
  submitted_at    TEXT,
  acknowledged_at TEXT,
  resolved_at     TEXT,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_erasure_ticket    ON erasure_actions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_erasure_status    ON erasure_actions(status);
CREATE INDEX IF NOT EXISTS idx_erasure_provider  ON erasure_actions(provider);
CREATE INDEX IF NOT EXISTS idx_erasure_created   ON erasure_actions(created_at);

-- Forensic evidence captures (screenshots, WHOIS, DNS, headers)
CREATE TABLE IF NOT EXISTS evidence_captures (
  id              TEXT PRIMARY KEY,
  ticket_id       TEXT,                                 -- FK to investigation_tickets.id
  threat_id       TEXT,                                 -- FK to threats.id
  capture_type    TEXT NOT NULL,                        -- screenshot, whois, dns, headers, html, certificate
  target_url      TEXT,
  data            TEXT NOT NULL,                        -- JSON or base64 content
  hash            TEXT,                                 -- SHA-256 of raw content for integrity
  file_size       INTEGER,
  metadata        TEXT DEFAULT '{}',
  captured_by     TEXT NOT NULL DEFAULT 'evidence-agent',
  captured_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_ticket   ON evidence_captures(ticket_id);
CREATE INDEX IF NOT EXISTS idx_evidence_threat   ON evidence_captures(threat_id);
CREATE INDEX IF NOT EXISTS idx_evidence_type     ON evidence_captures(capture_type);
CREATE INDEX IF NOT EXISTS idx_evidence_captured ON evidence_captures(captured_at);

-- Grouped threat campaigns (clustered by infrastructure/TTPs)
CREATE TABLE IF NOT EXISTS campaign_clusters (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',       -- active, dormant, resolved
  threat_count    INTEGER NOT NULL DEFAULT 0,
  threat_ids      TEXT DEFAULT '[]',                    -- JSON array
  ioc_summary     TEXT DEFAULT '{}',                    -- JSON: common domains, IPs, hashes
  ttps            TEXT DEFAULT '[]',                    -- JSON array of MITRE ATT&CK techniques
  attribution     TEXT,                                 -- suspected actor/group
  confidence      REAL NOT NULL DEFAULT 0.5,
  first_seen      TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen       TEXT NOT NULL DEFAULT (datetime('now')),
  created_by      TEXT NOT NULL DEFAULT 'campaign-correlator',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON campaign_clusters(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_first_seen ON campaign_clusters(first_seen);

-- Phishing email triage inbox
CREATE TABLE IF NOT EXISTS abuse_mailbox (
  id              TEXT PRIMARY KEY,
  from_address    TEXT NOT NULL,
  from_ip         TEXT,
  to_address      TEXT NOT NULL,
  subject         TEXT,
  body_preview    TEXT,
  headers         TEXT DEFAULT '{}',                    -- JSON: key email headers
  attachments     TEXT DEFAULT '[]',                    -- JSON array of {name, type, size, hash}
  verdict         TEXT NOT NULL DEFAULT 'pending',      -- pending, phishing, spam, legitimate, suspicious
  confidence      REAL,
  threat_id       TEXT,                                 -- FK if matched to a threat
  ticket_id       TEXT,                                 -- FK if investigation created
  triaged_by      TEXT NOT NULL DEFAULT 'abuse-mailbox-agent',
  received_at     TEXT NOT NULL DEFAULT (datetime('now')),
  triaged_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_abuse_verdict     ON abuse_mailbox(verdict);
CREATE INDEX IF NOT EXISTS idx_abuse_from        ON abuse_mailbox(from_address);
CREATE INDEX IF NOT EXISTS idx_abuse_received_at ON abuse_mailbox(received_at);
