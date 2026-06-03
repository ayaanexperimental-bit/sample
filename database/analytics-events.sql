CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  funnel_type TEXT NOT NULL CHECK (funnel_type IN ('free_guest_link', 'paid_masterclass')),
  coach_slug TEXT NOT NULL DEFAULT '',
  coach_site_id TEXT NOT NULL DEFAULT '',
  coach_id TEXT NOT NULL DEFAULT '',
  funnel_id TEXT NOT NULL DEFAULT '',
  page_path TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'unknown',
  region TEXT NOT NULL DEFAULT 'Not available',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  created_date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
ON analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_coach_created
ON analytics_events (coach_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_funnel_created
ON analytics_events (funnel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
ON analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_date_funnel
ON analytics_events (created_date, funnel_type);

