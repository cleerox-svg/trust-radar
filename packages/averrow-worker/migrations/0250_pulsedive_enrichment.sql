-- Feed-expansion Phase 2 (key-based half) — Pulsedive enrichment.
--
-- Pulsedive's free registered tier gives a REST API key (its STIX/TAXII
-- export is paid, so this is an ENRICHMENT feed, not a TAXII ingest). It
-- scores indicators we already hold (domain/ip) with a risk level. Same
-- shape as greynoise/seclookup: reads unchecked threats, calls the API
-- per-IOC under a daily budget, and writes the enrichment columns below.
--
-- Runs on a dedicated cron (own Worker budget) because the free tier is
-- rate-limited and the per-IOC sleeps would otherwise starve the shared
-- enrichment chain — see DEDICATED_ENRICHMENT_FEEDS + cron/orchestrator.ts.
-- Requires the PULSEDIVE_API_KEY secret; the module self-gates (no-op)
-- until it is set via `wrangler secret put PULSEDIVE_API_KEY`.

ALTER TABLE threats ADD COLUMN pulsedive_checked INTEGER DEFAULT 0;
ALTER TABLE threats ADD COLUMN pulsedive_risk TEXT;
ALTER TABLE threats ADD COLUMN pulsedive_checked_at TEXT;

INSERT INTO feed_configs (feed_name, display_name, description, source_url, enabled, schedule_cron, feed_type, rate_limit, batch_size)
VALUES ('pulsedive', 'Pulsedive Risk Scoring',
  'Scores already-ingested indicators (domain/ip) with Pulsedive risk levels via the free REST API. Enrichment only — Pulsedive TAXII export is paid.',
  'https://pulsedive.com/api/info.php', 1, '27 */4 * * *', 'enrichment', 30, 15)
ON CONFLICT(feed_name) DO NOTHING;

INSERT OR IGNORE INTO feed_status (feed_name, health_status) VALUES ('pulsedive', 'healthy');
