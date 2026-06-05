CREATE TABLE IF NOT EXISTS admin_email_otps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at INTEGER,
  resend_email_id TEXT,
  resend_status TEXT,
  created_at INTEGER NOT NULL,
  sent_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_email_otps_email_created_at
ON admin_email_otps (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_email_otps_expires_at
ON admin_email_otps (expires_at);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  email TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created_at
ON admin_audit_events (created_at DESC);

CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_status
ON admin_users (status);
