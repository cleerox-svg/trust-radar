-- Disable PhishStats (CSV 404, API 522 — service appears permanently down)
UPDATE feed_configs SET enabled = 0 WHERE feed_name = 'phishstats';
UPDATE feed_status SET health_status = 'disabled' WHERE feed_name = 'phishstats';

-- Fix NRD Hagezi URL: NRD-14 list exceeds jsdelivr 150MB limit, use NRD-1 (1-day) instead
UPDATE feed_configs SET source_url = 'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/wildcard/nrd-1.txt'
WHERE feed_name = 'nrd_hagezi';
