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

CREATE TABLE IF NOT EXISTS admin_ai_action_receipts (
  id TEXT PRIMARY KEY,
  audit_reference TEXT NOT NULL UNIQUE,
  action_id TEXT NOT NULL,
  handler_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  record_id TEXT NOT NULL,
  previous_value TEXT NOT NULL,
  applied_value TEXT NOT NULL,
  recommendation_reference TEXT NOT NULL,
  rollback_available INTEGER NOT NULL DEFAULT 1 CHECK (rollback_available IN (0, 1)),
  created_at INTEGER NOT NULL,
  rolled_back_at INTEGER,
  rollback_audit_reference TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_ai_action_receipts_admin_created_at
ON admin_ai_action_receipts (admin_email, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_ai_incidents (
  id TEXT PRIMARY KEY,
  classification TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high')),
  status TEXT NOT NULL CHECK (status IN ('active', 'resolved')),
  freeze_active INTEGER NOT NULL CHECK (freeze_active IN (0, 1)),
  scope TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  evidence_fingerprint TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  opened_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  opened_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolution_reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_ai_incidents_active_classification
ON admin_ai_incidents (classification) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_admin_ai_incidents_active_freeze
ON admin_ai_incidents (status, freeze_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS admin_ai_incident_events (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('incident-opened', 'incident-refreshed', 'checklist-updated', 'incident-resolved')
  ),
  detail TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  occurred_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_ai_incident_events_incident_occurred
ON admin_ai_incident_events (incident_id, occurred_at, id);

CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_status
ON admin_users (status);

CREATE TABLE IF NOT EXISTS admin_ai_tasks (
  id TEXT PRIMARY KEY,
  admin_subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'active', 'awaiting-user', 'blocked-access-changed', 'cancelled',
    'completed', 'failed-safe', 'paused'
  )),
  scope_json TEXT NOT NULL,
  goal_summary TEXT NOT NULL,
  capsule_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  active_job_id TEXT,
  created_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_admin_ai_tasks_subject_activity
ON admin_ai_tasks (admin_subject_id, deleted_at, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_ai_tasks_expiry
ON admin_ai_tasks (expires_at);

CREATE TABLE IF NOT EXISTS admin_ai_conversations (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
  safe_summary TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_ai_conversations_task
ON admin_ai_conversations (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_ai_conversations_expiry
ON admin_ai_conversations (expires_at);

CREATE TABLE IF NOT EXISTS admin_ai_task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  conversation_id TEXT,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_subject_id TEXT NOT NULL,
  safe_reason_code TEXT NOT NULL,
  task_version INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_ai_task_events_task
ON admin_ai_task_events (task_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_ai_task_events_expiry
ON admin_ai_task_events (expires_at);

CREATE TABLE IF NOT EXISTS admin_ai_task_checkpoints (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  job_id TEXT,
  sequence INTEGER NOT NULL,
  safe_checkpoint_json TEXT NOT NULL,
  artifact_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE (task_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_admin_ai_task_checkpoints_expiry
ON admin_ai_task_checkpoints (expires_at);

CREATE TABLE IF NOT EXISTS admin_ai_idempotency (
  admin_subject_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key_hash TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  result_reference TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (admin_subject_id, operation, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_admin_ai_idempotency_expiry
ON admin_ai_idempotency (expires_at);
