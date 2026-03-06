-- Invite tokens for influencer onboarding (no email required)
-- Admin generates a token, shares the link or credentials manually.
-- When email is configured, sendInviteEmail() will use this record.

CREATE TABLE IF NOT EXISTS invite_tokens (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  token           TEXT NOT NULL UNIQUE,
  influencer_id   TEXT NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'influencer',
  -- Optional email hint so admin can pre-fill the invite URL
  email_hint      TEXT,
  -- Notes visible only to admin (e.g. "sent via DM to @kylerez")
  notes           TEXT,
  created_by      TEXT NOT NULL REFERENCES users(id),
  expires_at      TEXT NOT NULL DEFAULT (datetime('now', '+7 days')),
  used_at         TEXT,
  used_by_user_id TEXT REFERENCES users(id),
  -- email_sent_at populated when email integration is active
  email_sent_at   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token        ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_influencer   ON invite_tokens(influencer_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_created_by   ON invite_tokens(created_by);
