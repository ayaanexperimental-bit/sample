import type { D1Database } from "@cloudflare/workers-types";

export type AdminRole = "admin" | "owner" | "super_admin";

export type AdminPermissionDefinition = {
  description: string;
  key: string;
  label: string;
  module: AdminModuleKey;
};

export type AdminModuleKey =
  | "admin_users"
  | "backup_cleanup"
  | "coach_analytics"
  | "coach_sites"
  | "error_reports"
  | "overview"
  | "paid_masterclass"
  | "settings"
  | "security"
  | "website_creator";

export type AdminAccessProfile = {
  displayName: string;
  email: string;
  isOwner: boolean;
  modules: AdminModuleKey[];
  permissions: string[];
  role: AdminRole;
  roleKey: string;
  status: "active";
};

export type AdminRbacEnv = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_DB?: D1Database;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ROOT_OWNER_EMAIL?: string;
};

export const ADMIN_PERMISSION_DEFINITIONS: AdminPermissionDefinition[] = [
  ["overview.view", "overview", "View overview", "Open admin overview, KPIs, and alerts."],
  ["overview.kpis", "overview", "View KPIs", "View dashboard metrics and conversion summaries."],
  ["overview.alerts", "overview", "View alerts", "View high-level admin alerts."],
  ["website_creator.view", "website_creator", "View Website Creator", "Open the coach website creator."],
  ["website_creator.create", "website_creator", "Create coach site", "Create new coach referral sites."],
  ["website_creator.edit", "website_creator", "Edit coach site", "Edit existing coach referral sites."],
  ["website_creator.save_draft", "website_creator", "Save drafts", "Save reusable coach-site drafts."],
  ["website_creator.publish", "website_creator", "Publish site", "Publish coach referral sites."],
  ["website_creator.archive", "website_creator", "Archive/reactivate", "Archive or restore coach sites."],
  ["website_creator.ai_copy", "website_creator", "Use AI copy", "Generate coach website copy."],
  ["website_creator.google_form", "website_creator", "Manage Google Form link", "Edit registration form links."],
  ["website_creator.support_details", "website_creator", "Manage support details", "Edit coach fallback support details."],
  ["coach_sites.view", "coach_sites", "View coach sites", "View the coach sites list."],
  ["coach_sites.edit", "coach_sites", "Edit coach sites", "Edit coach-site records."],
  ["coach_sites.copy_links", "coach_sites", "Copy links", "Copy public coach links."],
  ["coach_sites.archive", "coach_sites", "Archive/reactivate", "Archive or restore coach sites."],
  ["coach_sites.remove", "coach_sites", "Remove coach sites", "Remove non-owner protected coach records."],
  ["coach_analytics.view", "coach_analytics", "View analytics", "View coach analytics."],
  ["coach_analytics.ai_insights", "coach_analytics", "Generate AI insights", "Generate AI coach analytics."],
  ["coach_analytics.reports", "coach_analytics", "Generate reports", "Create coach reports."],
  ["coach_analytics.export", "coach_analytics", "Export reports", "Download analytics reports."],
  ["coach_analytics.top_performers", "coach_analytics", "View top performers", "View top coach performance."],
  ["paid_masterclass.view_analytics", "paid_masterclass", "View paid analytics", "View paid funnel analytics."],
  ["paid_masterclass.view_settings", "paid_masterclass", "View paid settings", "View paid funnel link settings."],
  ["paid_masterclass.edit_settings", "paid_masterclass", "Edit paid settings", "Edit protected paid funnel settings."],
  ["paid_masterclass.reveal_private_links", "paid_masterclass", "Reveal private links", "Reveal private paid links after OTP."],
  ["error_reports.view", "error_reports", "View error reports", "View safe error reports."],
  ["error_reports.mark_status", "error_reports", "Mark fixed/ignored", "Update error report status."],
  ["error_reports.clear_stale", "error_reports", "Clear stale reports", "Clear old fixed or ignored reports."],
  ["error_reports.technical_details", "error_reports", "View technical details", "View owner-approved technical context."],
  ["backup_cleanup.view", "backup_cleanup", "View backup status", "View backup and cleanup state."],
  ["backup_cleanup.run_backup", "backup_cleanup", "Run backup", "Run analytics backup."],
  ["backup_cleanup.run_cleanup", "backup_cleanup", "Run cleanup", "Run protected cleanup after backup."],
  ["backup_cleanup.view_recipients", "backup_cleanup", "View recipients", "View backup recipient list."],
  ["backup_cleanup.download", "backup_cleanup", "Download backup", "Download protected backups."],
  ["settings.view", "settings", "View settings", "View admin settings."],
  ["settings.support", "settings", "Edit support settings", "Edit support defaults."],
  ["settings.integrations", "settings", "Edit integrations", "Edit integration settings."],
  ["settings.links", "settings", "Edit link settings", "Edit admin link settings."],
  ["settings.security", "settings", "Edit security settings", "Edit non-owner security settings."],
  ["admin_users.manage", "admin_users", "Manage admin users", "Owner-only admin user management."],
  ["security.strict_roles", "security", "Manage strict roles", "Owner-only DB role enforcement."]
].map(([key, module, label, description]) => ({
  description,
  key,
  label,
  module: module as AdminModuleKey
}));

const ALL_PERMISSION_KEYS = ADMIN_PERMISSION_DEFINITIONS.map((permission) => permission.key);

export const ADMIN_ROLE_TEMPLATES: Array<{
  description: string;
  key: string;
  label: string;
  permissions: string[];
}> = [
  {
    description: "Root account. Full system control including admin user management.",
    key: "owner",
    label: "Owner",
    permissions: ALL_PERMISSION_KEYS
  },
  {
    description: "High operational access without owner-only user/security controls.",
    key: "co_owner",
    label: "Co-owner operational",
    permissions: ALL_PERMISSION_KEYS.filter(
      (key) =>
        !key.startsWith("admin_users.") &&
        !key.startsWith("security.") &&
        !key.startsWith("backup_cleanup.") &&
        key !== "paid_masterclass.reveal_private_links"
    )
  },
  {
    description: "Create, edit, draft, publish, and manage coach referral websites.",
    key: "website_creator",
    label: "Website Creator",
    permissions: ALL_PERMISSION_KEYS.filter(
      (key) => key.startsWith("website_creator.") || key.startsWith("coach_sites.")
    ).filter((key) => key !== "coach_sites.remove")
  },
  {
    description: "View coach analytics, top performers, AI insights, and exports.",
    key: "analytics",
    label: "Analytics",
    permissions: ALL_PERMISSION_KEYS.filter(
      (key) => key.startsWith("coach_analytics.") || key === "overview.view" || key === "overview.kpis"
    )
  },
  {
    description: "Review reports and mark issues fixed without destructive cleanup.",
    key: "reports",
    label: "Reports",
    permissions: [
      "overview.view",
      "error_reports.view",
      "error_reports.mark_status",
      "coach_analytics.view",
      "coach_analytics.reports"
    ]
  },
  {
    description: "Custom section-specific access selected by owner.",
    key: "custom",
    label: "Custom",
    permissions: ["overview.view"]
  }
];

type AdminUserRow = {
  email: string;
  first_name?: string | null;
  is_owner?: number | string | null;
  last_name?: string | null;
  role: string;
  role_key?: string | null;
  status: string;
};

export async function ensureAdminRbacSchema(env: AdminRbacEnv) {
  const db = env.ADMIN_DB;
  if (!db) return;
  if (!canUseD1SchemaMigrations(db)) return;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_users (
        email TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'super_admin')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'disabled')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();

  await ensureColumn(db, "admin_users", "id", "TEXT");
  await ensureColumn(db, "admin_users", "first_name", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "admin_users", "last_name", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "admin_users", "phone", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "admin_users", "note", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "admin_users", "role_key", "TEXT NOT NULL DEFAULT 'custom'");
  await ensureColumn(db, "admin_users", "is_owner", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "admin_users", "created_by", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "admin_users", "last_login_at", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "admin_users", "last_verified_at", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "admin_users", "backup_notifications_enabled", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "admin_users", "receive_security_backup", "INTEGER NOT NULL DEFAULT 0");

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_roles (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        permission_payload TEXT NOT NULL DEFAULT '[]',
        owner_only INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_permissions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        module TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_user_permissions (
        id TEXT PRIMARY KEY,
        admin_user_email TEXT NOT NULL,
        permission_key TEXT NOT NULL,
        allowed INTEGER NOT NULL DEFAULT 1,
        assigned_by TEXT NOT NULL DEFAULT '',
        assigned_at INTEGER NOT NULL,
        UNIQUE(admin_user_email, permission_key)
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_invites (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        invite_token_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        role_payload TEXT NOT NULL DEFAULT '{}',
        permission_payload TEXT NOT NULL DEFAULT '[]',
        expires_at INTEGER NOT NULL,
        sent_at INTEGER NOT NULL DEFAULT 0,
        delivered_at INTEGER NOT NULL DEFAULT 0,
        verified_at INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        resend_count INTEGER NOT NULL DEFAULT 0
      )`
    )
    .run();
  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_admin_invites_email_status ON admin_invites(email, status)")
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_security_audit_logs (
        id TEXT PRIMARY KEY,
        actor_email TEXT NOT NULL DEFAULT '',
        target_email TEXT NOT NULL DEFAULT '',
        action TEXT NOT NULL,
        safe_metadata TEXT NOT NULL DEFAULT '{}',
        ip_hash TEXT NOT NULL DEFAULT '',
        user_agent_hash TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_login_audit_logs (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL DEFAULT '',
        login_status TEXT NOT NULL,
        login_method TEXT NOT NULL,
        device_info_safe TEXT NOT NULL DEFAULT '',
        ip_hash TEXT NOT NULL DEFAULT '',
        user_agent_hash TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`
    )
    .run();

  const now = nowSeconds();
  for (const permission of ADMIN_PERMISSION_DEFINITIONS) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO admin_permissions (id, key, label, module, description, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      )
      .bind(
        `perm-${permission.key}`,
        permission.key,
        permission.label,
        permission.module,
        permission.description,
        now
      )
      .run();
  }
  for (const roleTemplate of ADMIN_ROLE_TEMPLATES) {
    await db
      .prepare(
        `INSERT INTO admin_roles
         (id, key, label, description, permission_payload, owner_only, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
         ON CONFLICT(key) DO UPDATE SET
           label = excluded.label,
           description = excluded.description,
           permission_payload = excluded.permission_payload,
           owner_only = excluded.owner_only,
           updated_at = excluded.updated_at`
      )
      .bind(
        `role-${roleTemplate.key}`,
        roleTemplate.key,
        roleTemplate.label,
        roleTemplate.description,
        JSON.stringify(roleTemplate.permissions),
        roleTemplate.key === "owner" ? 1 : 0,
        now
      )
      .run();
  }

  await bootstrapOwner(env);
  await db
    .prepare(
      `UPDATE admin_users
       SET is_owner = 1,
           role = 'owner',
           role_key = 'owner',
           status = 'active',
           receive_security_backup = 1,
           backup_notifications_enabled = 1,
           id = COALESCE(NULLIF(id, ''), email),
           updated_at = ?1
       WHERE role = 'owner' OR is_owner = 1`
    )
    .bind(now)
    .run();
}

export async function getAdminAccessProfile(
  email: string,
  env: AdminRbacEnv
): Promise<AdminAccessProfile | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  await ensureAdminRbacSchema(env);
  const db = env.ADMIN_DB;
  if (!db) {
    if (env.ADMIN_REQUIRE_DB_ADMIN_ROLES === "true") return null;
    if (!isEmailAllowlisted(normalizedEmail, env)) return null;
    return createFallbackOwnerProfile(normalizedEmail);
  }

  let row: AdminUserRow | null = null;
  try {
    row = await db
      .prepare(
        `SELECT email, first_name, last_name, role, role_key, status, is_owner
         FROM admin_users
         WHERE email = ?1
         LIMIT 1`
      )
      .bind(normalizedEmail)
      .first<AdminUserRow>();
  } catch {
    row = null;
  }

  if (!row || row.status !== "active" || !isAdminRole(row.role)) {
    if (env.ADMIN_REQUIRE_DB_ADMIN_ROLES === "true") return null;
    const fallbackOwnerEmail = normalizeEmail(env.ROOT_OWNER_EMAIL || "") || getFirstAllowlistedEmail(env);
    if (normalizedEmail !== fallbackOwnerEmail || !isEmailAllowlisted(normalizedEmail, env)) {
      return null;
    }
    return createFallbackOwnerProfile(normalizedEmail);
  }

  const role = row.role as AdminRole;
  const isOwner = role === "owner" || isTruthy(row.is_owner);
  const roleKey = isOwner ? "owner" : sanitizeText(row.role_key || role, 40);
  const permissions = isOwner
    ? ALL_PERMISSION_KEYS
    : await getAllowedPermissionKeysForEmail({
        db,
        email: normalizedEmail,
        roleKey
      });
  const modules = getModulesForPermissions(permissions);
  const displayName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || normalizedEmail;

  return {
    displayName,
    email: normalizedEmail,
    isOwner,
    modules,
    permissions,
    role,
    roleKey,
    status: "active"
  };
}

export async function getCurrentAdminPermissions(email: string, env: AdminRbacEnv) {
  return getAdminAccessProfile(email, env);
}

export function canAccessAdminModule(profile: AdminAccessProfile | null, moduleKey: AdminModuleKey) {
  return Boolean(profile?.isOwner || profile?.modules.includes(moduleKey));
}

export function canPerformAdminAction(profile: AdminAccessProfile | null, permissionKey: string) {
  return Boolean(profile?.isOwner || profile?.permissions.includes(permissionKey));
}

export async function recordAdminSecurityAudit({
  action,
  actorEmail,
  env,
  metadata = {},
  request,
  targetEmail = ""
}: {
  action: string;
  actorEmail?: string;
  env: AdminRbacEnv;
  metadata?: Record<string, unknown>;
  request?: Request;
  targetEmail?: string;
}) {
  const db = env.ADMIN_DB;
  if (!db) return;
  await ensureAdminRbacSchema(env);
  await db
    .prepare(
      `INSERT INTO admin_security_audit_logs
       (id, actor_email, target_email, action, safe_metadata, ip_hash, user_agent_hash, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
    .bind(
      `security-${crypto.randomUUID()}`,
      normalizeEmail(actorEmail || ""),
      normalizeEmail(targetEmail || ""),
      sanitizeText(action, 80),
      JSON.stringify(sanitizeMetadata(metadata)),
      await hashRequestPart(env, request?.headers.get("cf-connecting-ip") || ""),
      await hashRequestPart(env, request?.headers.get("user-agent") || ""),
      nowSeconds()
    )
    .run();
}

export async function recordAdminLoginAudit({
  email,
  env,
  loginMethod,
  loginStatus,
  request
}: {
  email: string;
  env: AdminRbacEnv;
  loginMethod: string;
  loginStatus: string;
  request?: Request;
}) {
  const db = env.ADMIN_DB;
  if (!db) return;
  await ensureAdminRbacSchema(env);
  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO admin_login_audit_logs
       (id, email, login_status, login_method, device_info_safe, ip_hash, user_agent_hash, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
    .bind(
      `login-${crypto.randomUUID()}`,
      normalizeEmail(email),
      sanitizeText(loginStatus, 40),
      sanitizeText(loginMethod, 40),
      sanitizeText(request?.headers.get("user-agent") || "", 180),
      await hashRequestPart(env, request?.headers.get("cf-connecting-ip") || ""),
      await hashRequestPart(env, request?.headers.get("user-agent") || ""),
      now
    )
    .run();

  if (loginStatus === "success") {
    await db
      .prepare("UPDATE admin_users SET last_login_at = ?1, updated_at = ?1 WHERE email = ?2")
      .bind(now, normalizeEmail(email))
      .run();
  }
}

async function getAllowedPermissionKeysForEmail({
  db,
  email,
  roleKey
}: {
  db: D1Database;
  email: string;
  roleKey: string;
}) {
  const template = ADMIN_ROLE_TEMPLATES.find((item) => item.key === roleKey);
  const defaultKeys = new Set(template?.permissions || ADMIN_ROLE_TEMPLATES.find((item) => item.key === "custom")?.permissions || []);
  let rows: { results?: Array<{ allowed: number | string; permission_key: string }> } = {
    results: []
  };
  try {
    rows = await db
      .prepare(
        `SELECT permission_key, allowed
         FROM admin_user_permissions
         WHERE admin_user_email = ?1`
      )
      .bind(email)
      .all<{ allowed: number | string; permission_key: string }>();
  } catch {
    rows = { results: [] };
  }

  for (const row of rows.results || []) {
    const key = sanitizeText(row.permission_key, 120);
    if (!ALL_PERMISSION_KEYS.includes(key)) continue;
    if (isTruthy(row.allowed)) defaultKeys.add(key);
    else defaultKeys.delete(key);
  }

  return Array.from(defaultKeys).filter((key) => ALL_PERMISSION_KEYS.includes(key));
}

function getModulesForPermissions(permissions: string[]) {
  return Array.from(
    new Set(
      permissions
        .map((key) => ADMIN_PERMISSION_DEFINITIONS.find((definition) => definition.key === key)?.module)
        .filter(Boolean) as AdminModuleKey[]
    )
  );
}

async function bootstrapOwner(env: AdminRbacEnv) {
  const db = env.ADMIN_DB;
  if (!db) return;
  const existing = await db
    .prepare("SELECT email FROM admin_users WHERE role = 'owner' OR is_owner = 1 LIMIT 1")
    .first<{ email: string }>();
  if (existing?.email) return;

  const ownerEmail =
    normalizeEmail(env.ROOT_OWNER_EMAIL || "") ||
    (await getFirstAdminUserEmail(db)) ||
    getFirstAllowlistedEmail(env);
  if (!ownerEmail) return;

  const now = nowSeconds();
  await db
    .prepare(
      `INSERT INTO admin_users
       (email, role, status, created_at, updated_at, id, first_name, last_name, role_key, is_owner,
        created_by, backup_notifications_enabled, receive_security_backup)
       VALUES (?1, 'owner', 'active', ?2, ?2, ?1, 'Root', 'Owner', 'owner', 1, 'owner-bootstrap', 1, 1)
       ON CONFLICT(email) DO UPDATE SET
         role = 'owner',
         status = 'active',
         role_key = 'owner',
         is_owner = 1,
         backup_notifications_enabled = 1,
         receive_security_backup = 1,
         updated_at = ?2`
    )
    .bind(ownerEmail, now)
    .run();
}

async function getFirstAdminUserEmail(db: D1Database) {
  try {
    const row = await db.prepare("SELECT email FROM admin_users ORDER BY created_at ASC LIMIT 1").first<{ email: string }>();
    return normalizeEmail(row?.email || "");
  } catch {
    return "";
  }
}

function getFirstAllowlistedEmail(env: AdminRbacEnv) {
  return (env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .find(Boolean) || "";
}

async function ensureColumn(db: D1Database, tableName: string, columnName: string, definition: string) {
  const columns = await getColumns(db, tableName);
  if (columns.has(columnName)) return;
  await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
}

function canUseD1SchemaMigrations(db: D1Database) {
  try {
    const statement = db.prepare("PRAGMA table_info(admin_users)") as unknown as {
      all?: unknown;
      first?: unknown;
      run?: unknown;
    };
    return (
      typeof statement.all === "function" &&
      typeof statement.first === "function" &&
      typeof statement.run === "function"
    );
  } catch {
    return false;
  }
}

async function getColumns(db: D1Database, tableName: string) {
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>();
  return new Set((result.results || []).map((row) => row.name).filter(Boolean));
}

function createFallbackOwnerProfile(email: string): AdminAccessProfile {
  return {
    displayName: email,
    email,
    isOwner: true,
    modules: getModulesForPermissions(ALL_PERMISSION_KEYS),
    permissions: ALL_PERMISSION_KEYS,
    role: "owner",
    roleKey: "owner",
    status: "active"
  };
}

function isEmailAllowlisted(email: string, env: AdminRbacEnv) {
  return new Set(
    (env.ADMIN_ALLOWED_EMAILS || "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean)
  ).has(normalizeEmail(email));
}

function isAdminRole(value: string): value is AdminRole {
  return value === "admin" || value === "owner" || value === "super_admin";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isTruthy(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/token|secret|otp|password|cookie|authorization/i.test(key)) continue;
    if (typeof value === "string") safe[key] = sanitizeText(value, 240);
    else if (typeof value === "number" || typeof value === "boolean") safe[key] = value;
  }
  return safe;
}

async function hashRequestPart(env: AdminRbacEnv, value: string) {
  const clean = sanitizeText(value, 500);
  const secret = env.ROOT_OWNER_EMAIL || env.ADMIN_ALLOWED_EMAILS || "ywcoach-admin-audit";
  if (!clean) return "";
  const input = new TextEncoder().encode(`${secret}:${clean}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}
