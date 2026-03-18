-- DMARC Aggregate Report Receiving — D1 Schema Migration
-- Run in D1 Console for trust-radar-v2
-- Three tables: dmarc_reports, dmarc_report_records, dmarc_daily_stats

-- 1. dmarc_reports — one row per received aggregate report
CREATE TABLE IF NOT EXISTS dmarc_reports (
  id             TEXT    PRIMARY KEY,
  brand_id       INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  domain         TEXT    NOT NULL,           -- domain the report covers
  reporter_org   TEXT    NOT NULL,           -- e.g. "google.com"
  reporter_email TEXT,                       -- envelope sender
  date_begin     INTEGER NOT NULL,           -- Unix epoch (period start)
  date_end       INTEGER NOT NULL,           -- Unix epoch (period end)
  email_count    INTEGER NOT NULL DEFAULT 0,
  pass_count     INTEGER NOT NULL DEFAULT 0,
  fail_count     INTEGER NOT NULL DEFAULT 0,
  dmarc_policy   TEXT,                       -- none / quarantine / reject
  raw_xml        TEXT,                       -- capped at 50KB
  received_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dmarc_reports_domain      ON dmarc_reports(domain);
CREATE INDEX IF NOT EXISTS idx_dmarc_reports_brand_id    ON dmarc_reports(brand_id);
CREATE INDEX IF NOT EXISTS idx_dmarc_reports_received_at ON dmarc_reports(received_at);

-- 2. dmarc_report_records — one row per source IP per report
CREATE TABLE IF NOT EXISTS dmarc_report_records (
  id             TEXT    PRIMARY KEY,
  report_id      TEXT    NOT NULL REFERENCES dmarc_reports(id) ON DELETE CASCADE,
  source_ip      TEXT    NOT NULL,
  message_count  INTEGER NOT NULL DEFAULT 0,
  disposition    TEXT,                       -- none / quarantine / reject
  dkim_result    TEXT,                       -- pass / fail
  spf_result     TEXT,                       -- pass / fail
  header_from    TEXT,                       -- claimed From: domain
  envelope_from  TEXT,                       -- envelope sender domain
  envelope_to    TEXT,                       -- envelope recipient domain
  -- Geo fields (filled by Cartographer agent)
  country_code   TEXT,
  org            TEXT,
  asn            TEXT,
  lat            REAL,
  lng            REAL
);

CREATE INDEX IF NOT EXISTS idx_dmarc_records_report_id   ON dmarc_report_records(report_id);
CREATE INDEX IF NOT EXISTS idx_dmarc_records_source_ip   ON dmarc_report_records(source_ip);
CREATE INDEX IF NOT EXISTS idx_dmarc_records_dkim_result ON dmarc_report_records(dkim_result);
CREATE INDEX IF NOT EXISTS idx_dmarc_records_spf_result  ON dmarc_report_records(spf_result);
CREATE INDEX IF NOT EXISTS idx_dmarc_records_no_geo      ON dmarc_report_records(source_ip) WHERE country_code IS NULL;

-- 3. dmarc_daily_stats — aggregated daily stats per domain (fast dashboard queries)
CREATE TABLE IF NOT EXISTS dmarc_daily_stats (
  id              TEXT    PRIMARY KEY,
  domain          TEXT    NOT NULL,
  date            TEXT    NOT NULL,          -- YYYY-MM-DD
  email_count     INTEGER NOT NULL DEFAULT 0,
  pass_count      INTEGER NOT NULL DEFAULT 0,
  fail_count      INTEGER NOT NULL DEFAULT 0,
  unique_sources  INTEGER NOT NULL DEFAULT 0,
  top_failing_ips TEXT,                      -- JSON: [{ip, count, country_code}]
  UNIQUE(domain, date)
);

CREATE INDEX IF NOT EXISTS idx_dmarc_daily_domain ON dmarc_daily_stats(domain, date);
