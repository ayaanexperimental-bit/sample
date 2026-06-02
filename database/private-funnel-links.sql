CREATE TABLE IF NOT EXISTS private_funnel_links (
  funnel_id TEXT PRIMARY KEY,
  whatsapp_group_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_private_funnel_links_status_updated_at
ON private_funnel_links (status, updated_at DESC);
