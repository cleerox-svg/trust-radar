-- imprsn8 D1 Schema
-- Migration: 0004_protection
-- Transforms imprsn8 from brand-scoring tool → SOC-grade influencer identity protection platform

-- ─── Extend users with role-based access ──────────────────────────────────
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'influencer'
  CHECK (role IN ('influencer', 'staff', 'soc', 'admin'));

ALTER TABLE users ADD COLUMN assigned_influencer_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- ─── Influencer profiles (managed subjects) ────────────────────────────────
CREATE TABLE IF NOT EXISTS influencer_profiles (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,  -- linked login account if any
  display_name    TEXT NOT NULL,
  handle          TEXT NOT NULL,
  avatar_url      TEXT,
  tier            TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'pro', 'enterprise')),
  active          INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Monitored accounts (per-platform accounts under watch) ───────────────
CREATE TABLE IF NOT EXISTS monitored_accounts (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  influencer_id       TEXT NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL CHECK (platform IN (
    'tiktok', 'instagram', 'x', 'youtube', 'facebook', 'linkedin', 'twitch', 'threads', 'snapchat', 'pinterest'
  )),
  handle              TEXT NOT NULL,
  profile_url         TEXT,
  is_verified         INTEGER NOT NULL DEFAULT 0,
  follower_count      INTEGER,
  risk_score          INTEGER NOT NULL DEFAULT 100 CHECK (risk_score BETWEEN 0 AND 100),
  risk_category       TEXT NOT NULL DEFAULT 'unscored' CHECK (risk_category IN (
    'legitimate', 'suspicious', 'imposter', 'unscored'
  )),
  bio_hash            TEXT,
  avatar_hash         TEXT,
  last_scanned_at     TEXT,
  added_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Account snapshots (historical profile captures for drift detection) ──
CREATE TABLE IF NOT EXISTS account_snapshots (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id      TEXT NOT NULL REFERENCES monitored_accounts(id) ON DELETE CASCADE,
  bio_text        TEXT,
  bio_hash        TEXT,
  avatar_url      TEXT,
  avatar_hash     TEXT,
  follower_count  INTEGER,
  following_count INTEGER,
  post_count      INTEGER,
  is_verified     INTEGER NOT NULL DEFAULT 0,
  raw_json        TEXT,                       -- full scraped payload (JSON)
  captured_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Handle variants (typosquat watchlist) ────────────────────────────────
CREATE TABLE IF NOT EXISTS handle_variants (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  influencer_id   TEXT NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  original_handle TEXT NOT NULL,
  variant_handle  TEXT NOT NULL,
  variant_type    TEXT NOT NULL CHECK (variant_type IN (
    'homoglyph', 'separator', 'suffix', 'prefix', 'swap', 'other'
  )),
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Impersonation reports (Indicator of Impersonation feed) ──────────────
CREATE TABLE IF NOT EXISTS impersonation_reports (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  influencer_id     TEXT NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL,
  suspect_handle    TEXT NOT NULL,
  suspect_url       TEXT,
  suspect_followers INTEGER,
  threat_type       TEXT NOT NULL CHECK (threat_type IN (
    'full_clone', 'handle_squat', 'bio_copy', 'avatar_copy',
    'scam_campaign', 'deepfake_media', 'unofficial_clips', 'voice_clone', 'other'
  )),
  severity          TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  similarity_score  INTEGER CHECK (similarity_score BETWEEN 0 AND 100),  -- doppelganger %
  similarity_breakdown TEXT NOT NULL DEFAULT '{}',  -- JSON: {bio_copy, avatar_match, posting_cadence, handle_distance}
  status            TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'investigating', 'confirmed', 'actioning', 'resolved', 'dismissed'
  )),
  ai_analysis       TEXT,                     -- LLM-generated threat summary
  soc_note          TEXT,                     -- internal SOC note (not visible to client)
  detected_by       TEXT NOT NULL DEFAULT 'manual' CHECK (detected_by IN (
    'SENTINEL', 'RECON', 'VERITAS', 'NEXUS', 'ARBITER', 'WATCHDOG', 'PHANTOM', 'manual'
  )),
  detected_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Takedown requests (5-stage lifecycle pipeline) ───────────────────────
CREATE TABLE IF NOT EXISTS takedown_requests (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  influencer_id       TEXT NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  report_id           TEXT REFERENCES impersonation_reports(id) ON DELETE SET NULL,
  platform            TEXT NOT NULL,
  suspect_handle      TEXT NOT NULL,
  takedown_type       TEXT NOT NULL CHECK (takedown_type IN (
    'dmca', 'impersonation', 'trademark', 'platform_tos', 'court_order'
  )),
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'acknowledged', 'in_review', 'resolved', 'rejected'
  )),
  case_ref            TEXT,                   -- platform-assigned case ID
  evidence_json       TEXT NOT NULL DEFAULT '[]',  -- JSON: [{type, url, description}]
  submitted_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at        TEXT,
  acknowledged_at     TEXT,
  resolved_at         TEXT,
  resolution          TEXT,                   -- outcome description
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── AI agents (SENTINEL, RECON, VERITAS, NEXUS, ARBITER, WATCHDOG) ───────
CREATE TABLE IF NOT EXISTS agent_definitions (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name            TEXT NOT NULL UNIQUE,       -- 'SENTINEL', 'RECON', etc.
  codename        TEXT NOT NULL,              -- display name
  description     TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('detect', 'respond', 'monitor', 'analyze')),
  is_active       INTEGER NOT NULL DEFAULT 1,
  schedule_mins   INTEGER,                    -- cron interval in minutes, NULL = manual only
  config_json     TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Agent run log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agent_id        TEXT NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  influencer_id   TEXT REFERENCES influencer_profiles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  items_scanned   INTEGER NOT NULL DEFAULT 0,
  threats_found   INTEGER NOT NULL DEFAULT 0,
  changes_detected INTEGER NOT NULL DEFAULT 0,
  error_msg       TEXT,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);

-- ─── Seed agent definitions ───────────────────────────────────────────────
INSERT OR IGNORE INTO agent_definitions (id, name, codename, description, category, schedule_mins) VALUES
  ('agt-sentinel', 'SENTINEL', 'Doppelganger Hunter',
   'Scans all major platforms for handles similar to monitored influencer identities. Calculates similarity scores and flags clones.',
   'detect', 30),
  ('agt-recon', 'RECON', 'Cross-Platform Discovery',
   'Discovers new platform presences for monitored influencers across 10+ social networks. Surfaces unknown official and suspect accounts.',
   'monitor', 60),
  ('agt-veritas', 'VERITAS', 'Deepfake Sentinel',
   'Analyzes media content for AI-generated or manipulated images and video using perceptual hash comparison and vision AI.',
   'detect', 120),
  ('agt-nexus', 'NEXUS', 'Scam Link Detector',
   'Crawls content from suspect accounts for malicious URLs, phishing domains, and scam affiliate links.',
   'detect', 360),
  ('agt-arbiter', 'ARBITER', 'Risk Scorer',
   'Re-scores all monitored accounts based on recent snapshots, bio drift, follower anomalies, and threat intelligence.',
   'analyze', 60),
  ('agt-watchdog', 'WATCHDOG', 'Profile Snapshot',
   'Takes periodic snapshots of all monitored accounts. Detects bio changes, avatar swaps, and follower count anomalies.',
   'monitor', 120);

-- ─── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_influencer_active        ON influencer_profiles(active);
CREATE INDEX IF NOT EXISTS idx_monitored_influencer     ON monitored_accounts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_monitored_platform       ON monitored_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_monitored_risk           ON monitored_accounts(risk_category);
CREATE INDEX IF NOT EXISTS idx_snapshots_account        ON account_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured       ON account_snapshots(captured_at);
CREATE INDEX IF NOT EXISTS idx_reports_influencer       ON impersonation_reports(influencer_id);
CREATE INDEX IF NOT EXISTS idx_reports_severity         ON impersonation_reports(severity);
CREATE INDEX IF NOT EXISTS idx_reports_status           ON impersonation_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_detected         ON impersonation_reports(detected_at);
CREATE INDEX IF NOT EXISTS idx_takedowns_influencer     ON takedown_requests(influencer_id);
CREATE INDEX IF NOT EXISTS idx_takedowns_status         ON takedown_requests(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent         ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_influencer    ON agent_runs(influencer_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started       ON agent_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_handle_variants_influencer ON handle_variants(influencer_id);
CREATE INDEX IF NOT EXISTS idx_users_role               ON users(role);
