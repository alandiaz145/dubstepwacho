-- Volumes remain private until explicitly published.
CREATE TABLE IF NOT EXISTS ep_volumes (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  volume_number INTEGER NOT NULL CHECK(volume_number>0),
  year INTEGER NOT NULL CHECK(year>=2026),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','applications_open','selection','published','archived')),
  opens_at TEXT,
  closes_at TEXT,
  released_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year,volume_number)
);

CREATE TABLE IF NOT EXISTS ep_tracks (
  volume_id TEXT NOT NULL REFERENCES ep_volumes(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  track_order INTEGER NOT NULL CHECK(track_order>0),
  PRIMARY KEY(volume_id,track_id),
  UNIQUE(volume_id,track_order)
);
CREATE INDEX IF NOT EXISTS idx_ep_volumes_public ON ep_volumes(status,released_at);
