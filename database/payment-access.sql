CREATE TABLE IF NOT EXISTS paid_attempts (
  attempt_hash TEXT PRIMARY KEY,
  payment_hash TEXT,
  event_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_paid_attempts_expires_at
  ON paid_attempts (expires_at);
