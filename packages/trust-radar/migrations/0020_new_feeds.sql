-- Add new Phase D feeds: URLhaus, OpenPhish, Disposable Email Domains
INSERT OR IGNORE INTO feed_schedules (id, feed_name, display_name, tier, category, url, interval_mins, parser, requires_key, api_key_env) VALUES
  ('feed-25', 'openphish',        'OpenPhish Community',          1, 'threat',      'https://openphish.com/feed.txt',               30,   'text', 0, NULL),
  ('feed-26', 'urlhaus',          'URLhaus (abuse.ch)',            2, 'threat',      'https://urlhaus-api.abuse.ch/v1/urls/recent/', 30,   'json', 0, NULL),
  ('feed-27', 'disposableemails', 'Disposable Email Domains',      3, 'reputation',  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_domains.txt', 1440, 'text', 0, NULL);
