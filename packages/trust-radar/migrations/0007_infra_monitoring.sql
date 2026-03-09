-- Migration: 0007_infra_monitoring
-- Tor exit nodes, email auth reports, cloud incidents, attack metrics

-- Tor exit node IP tracking
CREATE TABLE IF NOT EXISTS tor_exit_nodes (
  id            TEXT PRIMARY KEY,
  ip_address    TEXT NOT NULL,
  fingerprint   TEXT,
  nickname      TEXT,
  country_code  TEXT,
  bandwidth     INTEGER,                                -- bytes/sec
  flags         TEXT DEFAULT '[]',                      -- JSON array: Exit, Guard, Fast, Stable, etc.
  first_seen    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen     TEXT NOT NULL DEFAULT (datetime('now')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tor_ip    ON tor_exit_nodes(ip_address);
CREATE INDEX IF NOT EXISTS idx_tor_active       ON tor_exit_nodes(active);
CREATE INDEX IF NOT EXISTS idx_tor_last_seen    ON tor_exit_nodes(last_seen);

-- SPF/DKIM/DMARC compliance reports
CREATE TABLE IF NOT EXISTS email_auth_reports (
  id              TEXT PRIMARY KEY,
  domain          TEXT NOT NULL,
  report_type     TEXT NOT NULL,                        -- spf, dkim, dmarc
  result          TEXT NOT NULL,                        -- pass, fail, softfail, neutral, none, temperror, permerror
  source_ip       TEXT,
  source_domain   TEXT,
  alignment       TEXT,                                 -- strict, relaxed
  details         TEXT DEFAULT '{}',                    -- JSON
  report_date     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_auth_domain ON email_auth_reports(domain);
CREATE INDEX IF NOT EXISTS idx_email_auth_type   ON email_auth_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_email_auth_result ON email_auth_reports(result);
CREATE INDEX IF NOT EXISTS idx_email_auth_date   ON email_auth_reports(report_date);

-- CSP/SaaS/social platform outage tracking
CREATE TABLE IF NOT EXISTS cloud_incidents (
  id              TEXT PRIMARY KEY,
  provider        TEXT NOT NULL,                        -- aws, gcp, azure, cloudflare, github, slack, etc.
  service         TEXT,                                 -- specific service (e.g., "S3", "Cloud Run")
  title           TEXT NOT NULL,
  description     TEXT,
  severity        TEXT NOT NULL DEFAULT 'minor',        -- critical, major, minor, maintenance
  status          TEXT NOT NULL DEFAULT 'investigating', -- investigating, identified, monitoring, resolved
  impact          TEXT DEFAULT '{}',                    -- JSON: regions, services affected
  source_url      TEXT,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cloud_provider   ON cloud_incidents(provider);
CREATE INDEX IF NOT EXISTS idx_cloud_severity   ON cloud_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_cloud_status     ON cloud_incidents(status);
CREATE INDEX IF NOT EXISTS idx_cloud_started_at ON cloud_incidents(started_at);

-- Aggregated attack statistics (hourly/daily rollups)
CREATE TABLE IF NOT EXISTS attack_metrics (
  id              TEXT PRIMARY KEY,
  period          TEXT NOT NULL,                        -- hourly, daily, weekly
  period_start    TEXT NOT NULL,
  metric_type     TEXT NOT NULL,                        -- threats_by_type, threats_by_severity, scans_total, etc.
  dimensions      TEXT DEFAULT '{}',                    -- JSON: grouping dimensions
  value           REAL NOT NULL DEFAULT 0,
  metadata        TEXT DEFAULT '{}',                    -- JSON
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_metrics_period      ON attack_metrics(period, period_start);
CREATE INDEX IF NOT EXISTS idx_metrics_type        ON attack_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_period_start ON attack_metrics(period_start);
