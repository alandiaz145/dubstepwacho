CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  collaborators TEXT NOT NULL DEFAULT '',
  genre TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  download_allowed INTEGER NOT NULL DEFAULT 0 CHECK(download_allowed IN (0,1)),
  audio_key TEXT NOT NULL UNIQUE,
  cover_key TEXT NOT NULL UNIQUE,
  audio_bytes INTEGER NOT NULL,
  audio_sha256 TEXT NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'pending' CHECK(scan_status IN ('pending','clean','infected','error')),
  status TEXT NOT NULL DEFAULT 'pending_analysis' CHECK(status IN ('pending_analysis','pending_review','approved','rejected','published','withdrawn')),
  review_reason TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tracks_queue ON tracks(status,created_at);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(user_id,created_at);

CREATE TABLE IF NOT EXISTS moderation_events (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
