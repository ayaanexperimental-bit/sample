CREATE TABLE admin_users_next (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  id TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  role_key TEXT NOT NULL DEFAULT 'custom',
  is_owner INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  last_login_at INTEGER NOT NULL DEFAULT 0,
  last_verified_at INTEGER NOT NULL DEFAULT 0,
  backup_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  receive_security_backup INTEGER NOT NULL DEFAULT 0
);

INSERT INTO admin_users_next
  (email, role, status, created_at, updated_at, id, first_name, last_name, phone, note,
   role_key, is_owner, created_by, last_login_at, last_verified_at, backup_notifications_enabled,
   receive_security_backup)
SELECT
  email,
  CASE
    WHEN role IN ('owner', 'admin', 'super_admin') THEN role
    WHEN is_owner = 1 THEN 'owner'
    ELSE 'admin'
  END,
  CASE WHEN status IN ('active', 'inactive', 'disabled') THEN status ELSE 'active' END,
  created_at,
  updated_at,
  COALESCE(NULLIF(id, ''), email),
  COALESCE(first_name, ''),
  COALESCE(last_name, ''),
  COALESCE(phone, ''),
  COALESCE(note, ''),
  CASE WHEN role = 'owner' OR is_owner = 1 THEN 'owner' ELSE COALESCE(NULLIF(role_key, ''), 'custom') END,
  CASE WHEN role = 'owner' OR is_owner = 1 THEN 1 ELSE 0 END,
  COALESCE(created_by, ''),
  COALESCE(last_login_at, 0),
  COALESCE(last_verified_at, 0),
  COALESCE(backup_notifications_enabled, 1),
  COALESCE(receive_security_backup, 0)
FROM admin_users;

DROP INDEX IF EXISTS idx_admin_users_status;
ALTER TABLE admin_users RENAME TO admin_users_owner_only_backup;
ALTER TABLE admin_users_next RENAME TO admin_users;
DROP TABLE admin_users_owner_only_backup;
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users (status);
