-- ─── CIPHER + ECHO agents — v2 Design Spec Expansion ─────────────────────────
-- Adds 2 new specialist agents to complete the 9-agent roster.
--
-- CIPHER: URL & Phishing Analysis
--   Scans linked URLs in suspected impersonator profiles and DMs,
--   detecting phishing domains, malware redirects, and credential-harvesting pages.
--
-- ECHO: Audience Reach Measurement
--   Measures the downstream reach and potential victim count of detected threats,
--   quantifying brand impact score changes and audience exposure risk.

INSERT OR IGNORE INTO agent_definitions (id, name, codename, description, category, is_active, schedule_mins) VALUES
  (
    'agt-cipher',
    'CIPHER',
    'URL & Phishing Analyst',
    'Scans URLs linked from impersonator profiles and suspicious DMs across platforms. Detects phishing domains, credential-harvesting pages, and malware redirect chains. Integrates with threat intelligence feeds to cross-reference known malicious infrastructure.',
    'detect',
    1,
    60
  );

INSERT OR IGNORE INTO agent_definitions (id, name, codename, description, category, is_active, schedule_mins) VALUES
  (
    'agt-echo',
    'ECHO',
    'Audience Reach Analyst',
    'Measures the downstream audience exposure of detected threat accounts. Calculates potential victim count, predicts brand health score impact, and prioritises threat response based on reach severity. Outputs are used by APEX and ARBITER for triage decisions.',
    'analyze',
    1,
    120
  );
