-- Apply after 0001_auth.sql, before enabling new accounts.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

CREATE TABLE IF NOT EXISTS email_verifications (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  sent_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expiry ON email_verifications(expires_at);
