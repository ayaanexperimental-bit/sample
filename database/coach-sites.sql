CREATE TABLE IF NOT EXISTS coach_sites (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  coach_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('archived', 'draft', 'paused', 'published', 'removed')),
  niche TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  vision TEXT NOT NULL DEFAULT '',
  coach_email TEXT NOT NULL DEFAULT '',
  coach_phone TEXT NOT NULL DEFAULT '',
  whatsapp_link TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  google_form_url TEXT NOT NULL DEFAULT '',
  hero_media_type TEXT NOT NULL DEFAULT 'image' CHECK (hero_media_type IN ('image', 'none', 'video')),
  public_url TEXT NOT NULL,
  register_button_text TEXT NOT NULL DEFAULT 'Register Now',
  selected_theme_id TEXT NOT NULL DEFAULT 'default-current',
  support_text TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL,
  analytics_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER,
  archived_at INTEGER,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_coach_sites_status_updated_at
ON coach_sites (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_sites_slug
ON coach_sites (slug);

CREATE TABLE IF NOT EXISTS coach_site_media (
  id TEXT PRIMARY KEY,
  coach_site_id TEXT,
  slug TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  object_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (coach_site_id) REFERENCES coach_sites(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_coach_site_media_slug_created_at
ON coach_site_media (slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_site_media_deleted_at
ON coach_site_media (deleted_at);
