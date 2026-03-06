-- ─── PHANTOM agent — Voice Clone Detection (coming soon) ──────────────────
-- Seeds PHANTOM as inactive so the Agents panel can render a "Coming Soon" card
-- without enabling it in production workflows.

INSERT OR IGNORE INTO agent_definitions (id, name, codename, description, category, is_active, schedule_mins) VALUES
  ('agt-phantom', 'PHANTOM', 'Voice Clone Detector',
   'Monitors audio and video content across platforms for AI-generated voice clones impersonating protected influencers. Flags synthetic speech patterns and deepfake audio used in scam calls and fraudulent podcasts.',
   'detect', 0, NULL);
