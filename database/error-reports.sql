CREATE TABLE IF NOT EXISTS error_reports (
  id TEXT PRIMARY KEY,
  reference_id TEXT NOT NULL UNIQUE,
  error_code TEXT NOT NULL,
  category TEXT NOT NULL,
  safe_message TEXT NOT NULL,
  page_path TEXT NOT NULL DEFAULT '',
  user_action TEXT NOT NULL DEFAULT '',
  coach_slug TEXT NOT NULL DEFAULT '',
  funnel_step TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  screen_size TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'unknown',
  support_source TEXT NOT NULL DEFAULT 'default',
  missing_support_fields TEXT NOT NULL DEFAULT '',
  technical_details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New',
  admin_notes TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'medium',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_reports_status_created_at
  ON error_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_reports_category_created_at
  ON error_reports (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_reports_coach_slug_created_at
  ON error_reports (coach_slug, created_at DESC);
