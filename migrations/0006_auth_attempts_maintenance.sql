-- Apply after 0001_auth.sql, before enabling public accounts.
-- Supports incremental pruning of expired anti-abuse counters.
CREATE INDEX IF NOT EXISTS idx_auth_attempts_window_start ON auth_attempts(window_start);
