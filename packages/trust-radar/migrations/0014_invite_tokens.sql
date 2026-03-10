-- Shield invite tokens — mirrors Guard's invite pattern
-- Admin generates invite link → new user registers with token → assigned role + group

CREATE TABLE IF NOT EXISTS invite_tokens (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  token           TEXT NOT NULL UNIQUE,
  role            TEXT NOT NULL DEFAULT 'analyst',        -- admin, analyst, customer
  group_id        TEXT REFERENCES access_groups(id),      -- optional group assignment
  email_hint      TEXT,                                   -- pre-fill email for invite
  notes           TEXT,                                   -- admin-visible notes
  created_by      TEXT NOT NULL REFERENCES users(id),
  expires_at      TEXT NOT NULL DEFAULT (datetime('now', '+7 days')),
  used_at         TEXT,
  used_by_user_id TEXT REFERENCES users(id),
  email_sent_at   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token      ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_created_by ON invite_tokens(created_by);
