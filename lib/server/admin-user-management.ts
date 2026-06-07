import type { D1Database } from "@cloudflare/workers-types";
import {
  ADMIN_PERMISSION_DEFINITIONS,
  ADMIN_ROLE_TEMPLATES,
  ensureAdminRbacSchema,
  getAdminAccessProfile,
  normalizeEmail,
  recordAdminSecurityAudit,
  type AdminPermissionDefinition,
  type AdminRbacEnv
} from "./admin-rbac";

const textEncoder = new TextEncoder();

const INVITE_TTL_SECONDS = 48 * 60 * 60;
const MAX_INVITE_RESENDS = 3;
const MAX_INVITES_PER_OWNER_PER_HOUR = 20;

type AdminUserManagementEnv = AdminRbacEnv & {
  ADMIN_EMAIL_OTP_FROM?: string;
  ADMIN_EMAIL_OTP_FROM_NAME?: string;
  ADMIN_SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
};

type AdminUserRow = {
  backup_notifications_enabled?: number | string | null;
  created_at: number;
  created_by?: string | null;
  email: string;
  first_name?: string | null;
  id?: string | null;
  is_owner?: number | string | null;
  last_login_at?: number | string | null;
  last_name?: string | null;
  last_verified_at?: number | string | null;
  note?: string | null;
  phone?: string | null;
  receive_security_backup?: number | string | null;
  role: string;
  role_key?: string | null;
  status: string;
  updated_at: number;
};

type AdminInviteRow = {
  created_at: number;
  created_by: string;
  delivered_at?: number | string | null;
  email: string;
  expires_at: number;
  first_name?: string | null;
  id: string;
  last_name?: string | null;
  note?: string | null;
  permission_payload: string;
  phone?: string | null;
  resend_count: number;
  role_payload: string;
  sent_at?: number | string | null;
  status: string;
  updated_at: number;
  verified_at?: number | string | null;
};

type InviteInput = {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  note?: unknown;
  permissions?: unknown;
  phone?: unknown;
  roleKey?: unknown;
};

type UpdateAdminInput = {
  backupNotificationsEnabled?: unknown;
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  note?: unknown;
  permissions?: unknown;
  phone?: unknown;
  receiveSecurityBackup?: unknown;
  roleKey?: unknown;
};

const writableRoleKeys = new Set(ADMIN_ROLE_TEMPLATES.map((role) => role.key).filter((key) => key !== "owner"));
const allPermissionKeys = new Set(ADMIN_PERMISSION_DEFINITIONS.map((permission) => permission.key));
const ownerOnlyPermissionKeys = new Set(["admin_users.manage", "security.strict_roles"]);
const assignablePermissionKeys = new Set(
  ADMIN_PERMISSION_DEFINITIONS
    .map((permission) => permission.key)
    .filter((permission) => !ownerOnlyPermissionKeys.has(permission))
);
const pendingInviteStatuses = new Set(["pending_send", "sent", "delivered", "pending_verification"]);

export async function listAdminUserManagement({
  currentAdminEmail,
  env
}: {
  currentAdminEmail: string;
  env: AdminUserManagementEnv;
}) {
  const db = await getConfiguredDb(env);
  const currentProfile = await getAdminAccessProfile(currentAdminEmail, env);

  const adminRows = await db
    .prepare(
      `SELECT email, id, first_name, last_name, phone, note, role, role_key, status, is_owner,
              created_by, created_at, updated_at, last_login_at, last_verified_at,
              backup_notifications_enabled, receive_security_backup
       FROM admin_users
       ORDER BY is_owner DESC, created_at ASC`
    )
    .all<AdminUserRow>();

  const inviteRows = await db
    .prepare(
      `SELECT id, email, first_name, last_name, phone, note, status, role_payload,
              permission_payload, expires_at, sent_at, delivered_at, verified_at,
              created_by, created_at, updated_at, resend_count
       FROM admin_invites
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all<AdminInviteRow>();
  const permissionRows = await db
    .prepare(
      `SELECT admin_user_email, permission_key
       FROM admin_user_permissions
       WHERE allowed = 1`
    )
    .all<{ admin_user_email: string; permission_key: string }>();
  const permissionsByEmail = new Map<string, string[]>();
  for (const row of permissionRows.results || []) {
    const email = normalizeEmail(row.admin_user_email || "");
    const permission = sanitizeText(row.permission_key, 120);
    if (!email || !allPermissionKeys.has(permission)) continue;
    permissionsByEmail.set(email, [...(permissionsByEmail.get(email) || []), permission]);
  }

  return {
    admins: (adminRows.results || []).map((row) =>
      mapAdminUserRow(row, permissionsByEmail.get(normalizeEmail(row.email)) || [])
    ),
    currentAdmin: currentProfile,
    invites: (inviteRows.results || []).map(mapInviteRow),
    ok: true,
    permissionDefinitions: ADMIN_PERMISSION_DEFINITIONS,
    roleTemplates: ADMIN_ROLE_TEMPLATES,
    strictRolePreflight: await getStrictRolePreflight({ currentAdminEmail, env })
  };
}

export async function createAdminInvite({
  actorEmail,
  env,
  input,
  request
}: {
  actorEmail: string;
  env: AdminUserManagementEnv;
  input: InviteInput;
  request: Request;
}) {
  const db = await getConfiguredDb(env);
  const parsed = parseInviteInput(input);
  if (!parsed.ok) return parsed;

  if (parsed.email === normalizeEmail(actorEmail)) {
    return { ok: false, error: "Owner is already active. Do not invite the current owner." };
  }
  const inviteWindowStart = nowSeconds() - 60 * 60;
  const recentInviteCount = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM admin_invites
       WHERE created_by = ?1 AND created_at >= ?2`
    )
    .bind(normalizeEmail(actorEmail), inviteWindowStart)
    .first<{ count?: number | string | null }>();
  if (Number(recentInviteCount?.count || 0) >= MAX_INVITES_PER_OWNER_PER_HOUR) {
    return { ok: false, error: "Admin invite rate limit reached. Try again later." };
  }

  const existingAdmin = await db
    .prepare("SELECT email, status, role, is_owner FROM admin_users WHERE email = ?1 LIMIT 1")
    .bind(parsed.email)
    .first<{ email: string; is_owner?: number | string | null; role: string; status: string }>();

  if (existingAdmin?.role === "owner" || isTruthy(existingAdmin?.is_owner)) {
    return { ok: false, error: "The root owner account cannot be re-invited or changed." };
  }
  if (existingAdmin?.status === "active") {
    return { ok: false, error: "This admin is already active." };
  }

  const pendingInvite = await db
    .prepare(
      `SELECT id, status FROM admin_invites
       WHERE email = ?1 AND status IN ('pending_send','sent','delivered','pending_verification')
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(parsed.email)
    .first<{ id: string; status: string }>();
  if (pendingInvite) {
    return { ok: false, error: "A pending invite already exists for this email." };
  }

  const token = createInviteToken();
  const tokenHash = await createTokenHash(token, env);
  const now = nowSeconds();
  const inviteId = `invite-${crypto.randomUUID()}`;
  const rolePayload = JSON.stringify({
    role: "admin",
    roleKey: parsed.roleKey
  });
  const permissionPayload = JSON.stringify(parsed.permissions);

  await db
    .prepare(
      `INSERT INTO admin_invites
       (id, email, first_name, last_name, phone, note, invite_token_hash, status,
        role_payload, permission_payload, expires_at, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending_send', ?8, ?9, ?10, ?11, ?12, ?12)`
    )
    .bind(
      inviteId,
      parsed.email,
      parsed.firstName,
      parsed.lastName,
      parsed.phone,
      parsed.note,
      tokenHash,
      rolePayload,
      permissionPayload,
      now + INVITE_TTL_SECONDS,
      normalizeEmail(actorEmail),
      now
    )
    .run();

  const emailResult = await sendInviteEmail({
    env,
    inviteUrl: new URL(`/api/admin/users/invite/verify?token=${encodeURIComponent(token)}`, request.url).toString(),
    recipientEmail: parsed.email
  });
  const nextStatus = emailResult.ok ? "sent" : "failed";

  await db
    .prepare(
      `UPDATE admin_invites
       SET status = ?1, sent_at = ?2, updated_at = ?2
       WHERE id = ?3`
    )
    .bind(nextStatus, nowSeconds(), inviteId)
    .run();

  await recordAdminSecurityAudit({
    action: "admin_invite_created",
    actorEmail,
    env,
    metadata: {
      emailProviderConfigured: emailResult.ok,
      inviteStatus: nextStatus,
      roleKey: parsed.roleKey
    },
    request,
    targetEmail: parsed.email
  });

  if (!emailResult.ok) {
    return {
      invite: { email: parsed.email, id: inviteId, status: nextStatus },
      ok: false,
      error: emailResult.error
    };
  }

  return {
    invite: { email: parsed.email, id: inviteId, status: nextStatus },
    ok: true,
    message: "Admin invite email sent."
  };
}

export async function resendAdminInvite({
  actorEmail,
  env,
  inviteId,
  request
}: {
  actorEmail: string;
  env: AdminUserManagementEnv;
  inviteId: string;
  request: Request;
}) {
  const db = await getConfiguredDb(env);
  const row = await getInviteById(db, inviteId);
  if (!row) return { ok: false, error: "Invite not found." };
  if (!pendingInviteStatuses.has(row.status) && row.status !== "failed") {
    return { ok: false, error: "Only pending or failed invites can be resent." };
  }
  if (Number(row.resend_count || 0) >= MAX_INVITE_RESENDS) {
    return { ok: false, error: "Invite resend limit reached." };
  }

  const token = createInviteToken();
  const tokenHash = await createTokenHash(token, env);
  const now = nowSeconds();
  const emailResult = await sendInviteEmail({
    env,
    inviteUrl: new URL(`/api/admin/users/invite/verify?token=${encodeURIComponent(token)}`, request.url).toString(),
    recipientEmail: row.email
  });
  const nextStatus = emailResult.ok ? "sent" : "failed";

  await db
    .prepare(
      `UPDATE admin_invites
       SET invite_token_hash = ?1,
           status = ?2,
           expires_at = ?3,
           sent_at = ?4,
           updated_at = ?4,
           resend_count = resend_count + 1
       WHERE id = ?5`
    )
    .bind(tokenHash, nextStatus, now + INVITE_TTL_SECONDS, now, row.id)
    .run();

  await recordAdminSecurityAudit({
    action: "admin_invite_resent",
    actorEmail,
    env,
    metadata: {
      inviteStatus: nextStatus,
      resendCount: Number(row.resend_count || 0) + 1
    },
    request,
    targetEmail: row.email
  });

  return emailResult.ok
    ? { ok: true, message: "Admin invite resent." }
    : { ok: false, error: emailResult.error };
}

export async function revokeAdminInvite({
  actorEmail,
  env,
  inviteId,
  request
}: {
  actorEmail: string;
  env: AdminUserManagementEnv;
  inviteId: string;
  request: Request;
}) {
  const db = await getConfiguredDb(env);
  const row = await getInviteById(db, inviteId);
  if (!row) return { ok: false, error: "Invite not found." };
  if (row.status === "verified" || row.status === "active") {
    return { ok: false, error: "Verified invites cannot be revoked here." };
  }

  await db
    .prepare("UPDATE admin_invites SET status = 'revoked', updated_at = ?1 WHERE id = ?2")
    .bind(nowSeconds(), row.id)
    .run();

  await recordAdminSecurityAudit({
    action: "admin_invite_revoked",
    actorEmail,
    env,
    request,
    targetEmail: row.email
  });

  return { ok: true, message: "Admin invite revoked." };
}

export async function updateManagedAdmin({
  actorEmail,
  env,
  input,
  request
}: {
  actorEmail: string;
  env: AdminUserManagementEnv;
  input: UpdateAdminInput;
  request: Request;
}) {
  const db = await getConfiguredDb(env);
  const email = normalizeEmail(typeof input.email === "string" ? input.email : "");
  if (!isValidEmail(email)) return { ok: false, error: "Valid admin email is required." };

  const row = await db
    .prepare("SELECT email, role, is_owner, status FROM admin_users WHERE email = ?1 LIMIT 1")
    .bind(email)
    .first<{ email: string; is_owner?: number | string | null; role: string; status: string }>();
  if (!row) return { ok: false, error: "Admin user not found." };
  if (row.role === "owner" || isTruthy(row.is_owner)) {
    await recordAdminSecurityAudit({
      action: "owner_modification_blocked",
      actorEmail,
      env,
      metadata: { attemptedAction: "update_admin" },
      request,
      targetEmail: email
    });
    return {
      ok: false,
      error: "The root owner account cannot be changed from this panel.",
      forbidden: true
    };
  }

  const roleKey = sanitizeRoleKey(typeof input.roleKey === "string" ? input.roleKey : "custom");
  const permissions =
    Array.isArray(input.permissions) && input.permissions.length > 0
      ? sanitizePermissions(input.permissions)
      : getTemplatePermissions(roleKey);
  const now = nowSeconds();

  await db
    .prepare(
      `UPDATE admin_users
       SET first_name = ?1,
           last_name = ?2,
           phone = ?3,
           note = ?4,
           role = 'admin',
           role_key = ?5,
           backup_notifications_enabled = ?6,
           receive_security_backup = ?7,
           updated_at = ?8
       WHERE email = ?9`
    )
    .bind(
      sanitizeText(input.firstName, 80),
      sanitizeText(input.lastName, 80),
      sanitizeText(input.phone, 40),
      sanitizeText(input.note, 500),
      roleKey,
      asBooleanInt(input.backupNotificationsEnabled, true),
      asBooleanInt(input.receiveSecurityBackup, false),
      now,
      email
    )
    .run();

  await replaceAdminPermissions({
    actorEmail,
    db,
    email,
    permissions,
    timestamp: now
  });

  await recordAdminSecurityAudit({
    action: "admin_user_updated",
    actorEmail,
    env,
    metadata: { permissionCount: permissions.length, roleKey },
    request,
    targetEmail: email
  });

  return { ok: true, message: "Admin user updated." };
}

export async function setManagedAdminStatus({
  action,
  actorEmail,
  email,
  env,
  request
}: {
  action: "reactivate" | "revoke" | "suspend";
  actorEmail: string;
  email: string;
  env: AdminUserManagementEnv;
  request: Request;
}) {
  const db = await getConfiguredDb(env);
  const normalizedEmail = normalizeEmail(email);
  const row = await db
    .prepare("SELECT email, role, is_owner, status FROM admin_users WHERE email = ?1 LIMIT 1")
    .bind(normalizedEmail)
    .first<{ email: string; is_owner?: number | string | null; role: string; status: string }>();
  if (!row) return { ok: false, error: "Admin user not found." };
  if (row.role === "owner" || isTruthy(row.is_owner)) {
    await recordAdminSecurityAudit({
      action: "owner_modification_blocked",
      actorEmail,
      env,
      metadata: { attemptedAction: `admin_user_${action}` },
      request,
      targetEmail: normalizedEmail
    });
    return {
      ok: false,
      error: "The root owner account cannot be suspended or revoked.",
      forbidden: true
    };
  }

  const nextStatus = action === "reactivate" ? "active" : action === "suspend" ? "disabled" : "inactive";
  await db
    .prepare("UPDATE admin_users SET status = ?1, updated_at = ?2 WHERE email = ?3")
    .bind(nextStatus, nowSeconds(), normalizedEmail)
    .run();

  await recordAdminSecurityAudit({
    action: `admin_user_${action}`,
    actorEmail,
    env,
    request,
    targetEmail: normalizedEmail
  });

  return {
    ok: true,
    message:
      action === "reactivate"
        ? "Admin user reactivated."
        : action === "suspend"
          ? "Admin user suspended."
          : "Admin user revoked."
  };
}

export async function verifyAdminInviteToken({
  env,
  request,
  token
}: {
  env: AdminUserManagementEnv;
  request: Request;
  token: string;
}) {
  const db = await getConfiguredDb(env);
  const tokenHash = await createTokenHash(token, env);
  const now = nowSeconds();
  const row = await db
    .prepare(
      `SELECT id, email, first_name, last_name, phone, note, role_payload, permission_payload,
              status, expires_at, resend_count, created_by, created_at, updated_at
       FROM admin_invites
       WHERE invite_token_hash = ?1
       LIMIT 1`
    )
    .bind(tokenHash)
    .first<AdminInviteRow>();
  if (!row) return { ok: false, error: "Admin invite is invalid or expired." };
  if (!pendingInviteStatuses.has(row.status) && row.status !== "failed") {
    return { ok: false, error: "Admin invite is no longer active." };
  }
  if (Number(row.expires_at || 0) <= now) {
    await db
      .prepare("UPDATE admin_invites SET status = 'expired', updated_at = ?1 WHERE id = ?2")
      .bind(now, row.id)
      .run();
    return { ok: false, error: "Admin invite is expired." };
  }

  const existingAdmin = await db
    .prepare("SELECT role, is_owner, status FROM admin_users WHERE email = ?1 LIMIT 1")
    .bind(row.email)
    .first<{ is_owner?: number | string | null; role: string; status: string }>();
  if (existingAdmin?.status === "active") {
    return { ok: false, error: "This admin account is already active." };
  }
  if (existingAdmin?.role === "owner" || isTruthy(existingAdmin?.is_owner)) {
    return { ok: false, error: "The root owner account cannot be modified by invite." };
  }

  const rolePayload = parseRolePayload(row.role_payload);
  const roleKey = sanitizeRoleKey(rolePayload.roleKey);
  const permissions = sanitizePermissions(safeJsonArray(row.permission_payload));

  await db
    .prepare(
      `INSERT INTO admin_users
       (email, role, status, created_at, updated_at, id, first_name, last_name, phone, note,
        role_key, is_owner, created_by, last_verified_at, backup_notifications_enabled,
        receive_security_backup)
       VALUES (?1, 'admin', 'active', ?2, ?2, ?1, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?2, 1, 0)
       ON CONFLICT(email) DO UPDATE SET
         role = 'admin',
         status = 'active',
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         phone = excluded.phone,
         note = excluded.note,
         role_key = excluded.role_key,
         is_owner = 0,
         last_verified_at = excluded.last_verified_at,
         updated_at = excluded.updated_at`
    )
    .bind(
      row.email,
      now,
      row.first_name || "",
      row.last_name || "",
      row.phone || "",
      row.note || "",
      roleKey,
      row.created_by || "invite"
    )
    .run();

  await replaceAdminPermissions({
    actorEmail: row.created_by || "invite",
    db,
    email: row.email,
    permissions: permissions.length ? permissions : getTemplatePermissions(roleKey),
    timestamp: now
  });

  await db
    .prepare(
      "UPDATE admin_invites SET status = 'active', verified_at = ?1, updated_at = ?1 WHERE id = ?2"
    )
    .bind(now, row.id)
    .run();

  await recordAdminSecurityAudit({
    action: "admin_invite_verified",
    actorEmail: row.created_by || "",
    env,
    request,
    targetEmail: row.email
  });

  return { ok: true, email: row.email };
}

async function getConfiguredDb(env: AdminUserManagementEnv) {
  if (!env.ADMIN_DB) throw new Error("admin_db_not_configured");
  await ensureAdminRbacSchema(env);
  return env.ADMIN_DB;
}

async function getInviteById(db: D1Database, inviteId: string) {
  const id = sanitizeText(inviteId, 120);
  if (!id) return null;
  return db
    .prepare(
      `SELECT id, email, first_name, last_name, phone, note, status, role_payload,
              permission_payload, expires_at, sent_at, delivered_at, verified_at,
              created_by, created_at, updated_at, resend_count
       FROM admin_invites
       WHERE id = ?1
       LIMIT 1`
    )
    .bind(id)
    .first<AdminInviteRow>();
}

function parseInviteInput(input: InviteInput) {
  const email = normalizeEmail(typeof input.email === "string" ? input.email : "");
  if (!isValidEmail(email)) return { ok: false as const, error: "Valid admin email is required." };
  const firstName = sanitizeText(input.firstName, 80);
  const lastName = sanitizeText(input.lastName, 80);

  if (!firstName) return { ok: false as const, error: "First name is required." };
  if (!lastName) return { ok: false as const, error: "Last name is required." };

  const roleKey = sanitizeRoleKey(typeof input.roleKey === "string" ? input.roleKey : "custom");
  const permissions =
    Array.isArray(input.permissions) && input.permissions.length > 0
      ? sanitizePermissions(input.permissions)
      : getTemplatePermissions(roleKey);

  if (!permissions.length) {
    return { ok: false as const, error: "At least one permission is required." };
  }

  return {
    ok: true as const,
    email,
    firstName,
    lastName,
    note: sanitizeText(input.note, 500),
    permissions,
    phone: sanitizeText(input.phone, 40),
    roleKey
  };
}

function mapAdminUserRow(row: AdminUserRow, assignedPermissions: string[]) {
  const roleKey = row.role === "owner" || isTruthy(row.is_owner) ? "owner" : row.role_key || "custom";
  const permissions =
    row.role === "owner" || isTruthy(row.is_owner)
      ? Array.from(allPermissionKeys)
      : assignedPermissions.length
        ? assignedPermissions
        : getTemplatePermissions(roleKey);
  return {
    backupNotificationsEnabled: isTruthy(row.backup_notifications_enabled ?? 1),
    createdAt: toIso(row.created_at),
    createdBy: row.created_by || "",
    displayName: `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.email,
    email: row.email,
    firstName: row.first_name || "",
    id: row.id || row.email,
    isOwner: row.role === "owner" || isTruthy(row.is_owner),
    lastLoginAt: toIso(row.last_login_at),
    lastName: row.last_name || "",
    lastVerifiedAt: toIso(row.last_verified_at),
    note: row.note || "",
    permissions,
    phone: row.phone || "",
    receiveSecurityBackup: isTruthy(row.receive_security_backup),
    role: row.role,
    roleKey,
    status: row.status,
    statusLabel: row.status === "disabled" ? "Suspended" : row.status === "inactive" ? "Revoked" : "Active",
    updatedAt: toIso(row.updated_at)
  };
}

function mapInviteRow(row: AdminInviteRow) {
  const rolePayload = parseRolePayload(row.role_payload);
  return {
    createdAt: toIso(row.created_at),
    createdBy: row.created_by || "",
    email: row.email,
    expiresAt: toIso(row.expires_at),
    firstName: row.first_name || "",
    id: row.id,
    lastName: row.last_name || "",
    note: row.note || "",
    permissionCount: sanitizePermissions(safeJsonArray(row.permission_payload)).length,
    phone: row.phone || "",
    resendCount: Number(row.resend_count || 0),
    roleKey: sanitizeRoleKey(rolePayload.roleKey),
    sentAt: toIso(row.sent_at),
    status: row.status,
    updatedAt: toIso(row.updated_at),
    verifiedAt: toIso(row.verified_at)
  };
}

async function replaceAdminPermissions({
  actorEmail,
  db,
  email,
  permissions,
  timestamp
}: {
  actorEmail: string;
  db: D1Database;
  email: string;
  permissions: string[];
  timestamp: number;
}) {
  await db.prepare("DELETE FROM admin_user_permissions WHERE admin_user_email = ?1").bind(email).run();

  for (const permission of sanitizePermissions(permissions)) {
    await db
      .prepare(
        `INSERT INTO admin_user_permissions
         (id, admin_user_email, permission_key, allowed, assigned_by, assigned_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5)`
      )
      .bind(`aup-${crypto.randomUUID()}`, email, permission, normalizeEmail(actorEmail), timestamp)
      .run();
  }
}

async function sendInviteEmail({
  env,
  inviteUrl,
  recipientEmail
}: {
  env: AdminUserManagementEnv;
  inviteUrl: string;
  recipientEmail: string;
}) {
  if (!env.RESEND_API_KEY || !env.ADMIN_EMAIL_OTP_FROM) {
    return { ok: false as const, error: "Invite email provider is not configured." };
  }

  const fromName = env.ADMIN_EMAIL_OTP_FROM_NAME || "YW Coach Admin";
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: `${fromName} <${env.ADMIN_EMAIL_OTP_FROM}>`,
      html: createInviteEmailHtml({ inviteUrl }),
      subject: "You have been invited to YW Coach Admin",
      text: `You have been invited to YW Coach Admin. Open this one-time invite link within 48 hours: ${inviteUrl}`,
      to: [recipientEmail]
    }),
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) return { ok: false as const, error: "Invite email delivery failed." };
  return { ok: true as const };
}

function createInviteEmailHtml({ inviteUrl }: { inviteUrl: string }) {
  return `<!doctype html>
    <html>
      <body style="margin:0;background:#fff7fb;padding:24px;font-family:Arial,sans-serif;color:#251822;">
        <main style="max-width:560px;margin:0 auto;border:1px solid #f2c9da;border-radius:14px;background:#ffffff;padding:28px;">
          <p style="margin:0 0 12px;color:#087a73;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">YW Coach Admin</p>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;">Admin invite</h1>
          <p style="margin:0 0 20px;color:#5f4a59;font-size:15px;line-height:1.6;">You have been invited to help manage YW Coach. This link is one-time use and expires in 48 hours.</p>
          <p style="margin:0 0 20px;"><a href="${escapeHtml(inviteUrl)}" style="display:inline-block;border-radius:10px;background:#102033;color:#ffffff;padding:14px 18px;text-decoration:none;font-weight:800;">Accept Admin Invite</a></p>
          <p style="margin:0;color:#75606c;font-size:13px;line-height:1.55;">If you did not expect this invite, ignore this email.</p>
        </main>
      </body>
    </html>`;
}

async function getStrictRolePreflight({
  currentAdminEmail,
  env
}: {
  currentAdminEmail: string;
  env: AdminUserManagementEnv;
}) {
  const profile = await getAdminAccessProfile(currentAdminEmail, env);
  return {
    currentAdminEmail: normalizeEmail(currentAdminEmail),
    dbConfigured: Boolean(env.ADMIN_DB),
    ownerVerified: Boolean(profile?.isOwner),
    strictDbRolesEnabled: env.ADMIN_REQUIRE_DB_ADMIN_ROLES === "true"
  };
}

function createInviteToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createTokenHash(token: string, env: AdminUserManagementEnv) {
  const secret = env.ADMIN_SESSION_SECRET || env.ROOT_OWNER_EMAIL || env.ADMIN_ALLOWED_EMAILS;
  if (!secret) throw new Error("admin_invite_secret_missing");

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(token));
  return base64UrlEncode(new Uint8Array(signature));
}

function sanitizePermissions(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => sanitizeText(value, 120))
        .filter((permission) => assignablePermissionKeys.has(permission))
    )
  );
}

function getTemplatePermissions(roleKey: string) {
  const template = ADMIN_ROLE_TEMPLATES.find((role) => role.key === roleKey);
  return template?.permissions.filter((permission) => assignablePermissionKeys.has(permission)) || ["overview.view"];
}

function sanitizeRoleKey(value: unknown) {
  const roleKey = sanitizeText(value, 50);
  return writableRoleKeys.has(roleKey) ? roleKey : "custom";
}

function parseRolePayload(value: string) {
  try {
    const parsed = JSON.parse(value || "{}") as { roleKey?: string };
    return { roleKey: sanitizeRoleKey(parsed.roleKey || "custom") };
  } catch {
    return { roleKey: "custom" };
  }
}

function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function asBooleanInt(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback ? 1 : 0;
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

function isTruthy(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function toIso(value: unknown) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return new Date(seconds * 1000).toISOString();
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export type AdminUserManagementPayload = Awaited<ReturnType<typeof listAdminUserManagement>>;
export type AdminPermissionManagementDefinition = AdminPermissionDefinition;
