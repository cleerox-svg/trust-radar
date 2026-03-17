-- Cloudflare Radar feed setup: scanner + email security
-- Adds required columns to threats table and registers feeds

-- ─── Add CF Scanner columns to threats ──────────────────────────
ALTER TABLE threats ADD COLUMN cf_scan_id TEXT;
ALTER TABLE threats ADD COLUMN cf_verdict TEXT;
ALTER TABLE threats ADD COLUMN cf_categories TEXT;

CREATE INDEX idx_threats_cf_scan ON threats(cf_scan_id) WHERE cf_scan_id IS NOT NULL;

-- ─── Register Cloudflare feeds in feed_configs ──────────────────
INSERT OR IGNORE INTO feed_configs (feed_name, display_name, description, source_url, schedule_cron, rate_limit, batch_size, enabled) VALUES
  ('cloudflare_scanner', 'Cloudflare URL Scanner', 'Two-phase URL scanner: submit unscanned threat URLs, poll for verdicts and confidence adjustment', 'https://api.cloudflare.com/client/v4/accounts/', '*/30 * * * *', 10, 20, 1),
  ('cloudflare_email',   'Cloudflare Email Security', 'Daily email threat intelligence from Cloudflare Radar (spam, spoof, malicious, categories)', 'https://api.cloudflare.com/client/v4/radar/email/security/', '0 6 * * *', 10, 4, 1);

-- ─── Register feed_status entries ───────────────────────────────
INSERT OR IGNORE INTO feed_status (feed_name, health_status) VALUES
  ('cloudflare_scanner', 'healthy'),
  ('cloudflare_email',   'healthy');
