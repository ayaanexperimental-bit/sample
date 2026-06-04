import type { D1Database } from "@cloudflare/workers-types";
import { ensureAnalyticsEventTables } from "./analytics-events";
import { recordAdminAuditEvent } from "./admin-audit";
import { ensureErrorReportsSchema } from "./error-reports";

export type AdminMaintenanceEnv = {
  ADMIN_DB?: D1Database;
  ADMIN_EMAIL_OTP_FROM?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
};

export type ErrorReportCleanupFilter =
  | "fixed_ignored"
  | "older_30"
  | "older_90"
  | "stale_all";

export type BackupRecipient = {
  email: string;
  maskedEmail: string;
  notificationsEnabled: boolean;
  role: string;
  status: string;
};

export type MaintenanceStatus = {
  activeAdminRecipientCount: number;
  backupDestination: string;
  backupDownloadUrl: string | null;
  backupEmailConfigured: boolean;
  cleanupEligibleAnalyticsEvents: number;
  cleanupStatus: string;
  failedRecipients: string[];
  googleSheetsConfigured: boolean;
  lastBackupAt: string;
  lastBackupRecordCount: number;
  lastBackupStatus: string;
  lastCleanupAt: string;
  lastCleanupDeletedCount: number;
  lastErrorReportCleanupAt: string;
  lastErrorReportCleanupDeletedCount: number;
  maskedRecipients: string[];
  rawRecipientRoles: Array<Pick<BackupRecipient, "maskedEmail" | "role" | "status">>;
  retentionDays: number;
  roleChecklist: AdminRoleChecklist;
  scheduledCleanup: string;
};

export type AdminRoleChecklist = {
  adminEmailPresent: boolean;
  adminEmailRole: string;
  adminEmailStatus: string;
  adminRoleTableExists: boolean;
  currentAdminEmailMasked: string;
  lockoutRisk: "high" | "low" | "medium";
  rollbackInstructions: string[];
  roleRequirementMet: boolean;
  strictDbRolesEnabled: boolean;
};

type BackupRow = {
  backup_csv: string;
  created_at: number | string;
  failed_recipients: string;
  file_name: string;
  file_url: string;
  id: string;
  notification_status: string;
  record_count: number | string;
  status: string;
};

type CleanupRow = {
  created_at: number | string;
  deleted_record_count: number | string;
  status: string;
};

type ErrorCleanupRow = {
  created_at: number | string;
  deleted_report_count: number | string;
};

type AdminUserRow = {
  backup_notifications_enabled?: number | string | null;
  email: string;
  role: string;
  status: string;
};

const RETENTION_DAYS = 90;
const BACKUP_EMAIL_SUBJECT = "YWcoach Trimonthly Backup Data";

const MAINTENANCE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS analytics_backups (
    id TEXT PRIMARY KEY,
    date_range_start INTEGER NOT NULL,
    date_range_end INTEGER NOT NULL,
    backup_type TEXT NOT NULL,
    destination TEXT NOT NULL,
    file_name TEXT NOT NULL DEFAULT '',
    file_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    failed_recipients TEXT NOT NULL DEFAULT '',
    notification_status TEXT NOT NULL DEFAULT '',
    backup_csv TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_backups_created_at
    ON analytics_backups (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS cleanup_logs (
    id TEXT PRIMARY KEY,
    cleanup_type TEXT NOT NULL,
    date_range_start INTEGER NOT NULL,
    date_range_end INTEGER NOT NULL,
    backup_id TEXT NOT NULL DEFAULT '',
    deleted_record_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cleanup_logs_created_at
    ON cleanup_logs (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS error_report_cleanup_logs (
    id TEXT PRIMARY KEY,
    filter_used TEXT NOT NULL,
    deleted_report_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_error_report_cleanup_logs_created_at
    ON error_report_cleanup_logs (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS analytics_event_rollups (
    id TEXT PRIMARY KEY,
    backup_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    funnel_type TEXT NOT NULL,
    coach_slug TEXT NOT NULL DEFAULT '',
    coach_id TEXT NOT NULL DEFAULT '',
    funnel_id TEXT NOT NULL DEFAULT '',
    event_count INTEGER NOT NULL DEFAULT 0,
    first_created_at INTEGER NOT NULL DEFAULT 0,
    last_created_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_event_rollups_backup
    ON analytics_event_rollups (backup_id)`
];

export async function getAdminMaintenanceStatus({
  currentAdminEmail,
  env
}: {
  currentAdminEmail: string;
  env: AdminMaintenanceEnv;
}): Promise<MaintenanceStatus> {
  const db = env.ADMIN_DB;
  const backupEmailConfigured = isBackupEmailConfigured(env);

  if (!db) {
    return {
      activeAdminRecipientCount: 0,
      backupDestination: "Email CSV attachment, database missing",
      backupDownloadUrl: null,
      backupEmailConfigured,
      cleanupEligibleAnalyticsEvents: 0,
      cleanupStatus: "Database missing. No cleanup can run.",
      failedRecipients: [],
      googleSheetsConfigured: false,
      lastBackupAt: "No backup created yet",
      lastBackupRecordCount: 0,
      lastBackupStatus: "Not configured",
      lastCleanupAt: "No cleanup run yet",
      lastCleanupDeletedCount: 0,
      lastErrorReportCleanupAt: "No error report cleanup run yet",
      lastErrorReportCleanupDeletedCount: 0,
      maskedRecipients: [],
      rawRecipientRoles: [],
      retentionDays: RETENTION_DAYS,
      roleChecklist: createUnavailableRoleChecklist(currentAdminEmail, env),
      scheduledCleanup:
        "Manual safe fallback is active. Cloudflare Cron can call the same backup-first workflow later."
    };
  }

  await ensureMaintenanceTables(db);
  await ensureAnalyticsEventTables(env);

  const recipients = await getActiveBackupRecipients(db);
  const latestBackup = await getLatestBackup(db);
  const latestCleanup = await getLatestCleanup(db);
  const latestErrorCleanup = await getLatestErrorCleanup(db);
  const cutoff = getRetentionCutoffSeconds();
  const cleanupEligibleAnalyticsEvents = await countOldAnalyticsEvents(db, cutoff);
  const roleChecklist = await getAdminRoleChecklist({ currentAdminEmail, db, env });

  return {
    activeAdminRecipientCount: recipients.length,
    backupDestination: "Email CSV attachment primary",
    backupDownloadUrl: latestBackup?.file_url || (latestBackup?.id ? `/api/admin/backup-cleanup?download=${latestBackup.id}` : null),
    backupEmailConfigured,
    cleanupEligibleAnalyticsEvents,
    cleanupStatus: getCleanupStatusText({
      backupEmailConfigured,
      cleanupEligibleAnalyticsEvents,
      latestBackup,
      recipients
    }),
    failedRecipients: parseList(latestBackup?.failed_recipients).map(maskEmail),
    googleSheetsConfigured: false,
    lastBackupAt: secondsToDisplay(latestBackup?.created_at) || "No backup created yet",
    lastBackupRecordCount: normalizeNumber(latestBackup?.record_count),
    lastBackupStatus: latestBackup?.status || "No backup created yet",
    lastCleanupAt: secondsToDisplay(latestCleanup?.created_at) || "No cleanup run yet",
    lastCleanupDeletedCount: normalizeNumber(latestCleanup?.deleted_record_count),
    lastErrorReportCleanupAt:
      secondsToDisplay(latestErrorCleanup?.created_at) || "No error report cleanup run yet",
    lastErrorReportCleanupDeletedCount: normalizeNumber(
      latestErrorCleanup?.deleted_report_count
    ),
    maskedRecipients: recipients.map((recipient) => recipient.maskedEmail),
    rawRecipientRoles: recipients.map((recipient) => ({
      maskedEmail: recipient.maskedEmail,
      role: recipient.role,
      status: recipient.status
    })),
    retentionDays: RETENTION_DAYS,
    roleChecklist,
    scheduledCleanup:
      "Manual safe fallback is active. Cloudflare Cron can call the same backup-first workflow later."
  };
}

export async function runAnalyticsBackup({
  adminEmail,
  env,
  request
}: {
  adminEmail: string;
  env: AdminMaintenanceEnv;
  request: Request;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "ADMIN_DB is not configured. No backup was created." };

  await ensureMaintenanceTables(db);
  await ensureAnalyticsEventTables(env);

  const cutoff = getRetentionCutoffSeconds();
  const recipients = await getActiveBackupRecipients(db);
  const rows = await listOldAnalyticsRows(db, cutoff);
  const backupId = `analytics-backup-${crypto.randomUUID()}`;
  const createdAt = getNowSeconds();
  const fileName = `ywcoach-analytics-backup-${new Date(createdAt * 1000)
    .toISOString()
    .slice(0, 10)}.csv`;
  const csv = createAnalyticsBackupCsv(rows);
  const destination = "email_csv_attachment";
  const fileUrl = `/api/admin/backup-cleanup?download=${backupId}`;
  const status = rows.length === 0 ? "completed_empty" : "completed";

  let notificationStatus = "not_sent";
  let failedRecipients: string[] = [];

  if (recipients.length === 0) {
    notificationStatus = "no_active_admin_recipients";
  } else if (!isBackupEmailConfigured(env)) {
    notificationStatus = "email_not_configured";
  } else {
    const result = await sendBackupNotificationEmails({
      backupId,
      createdAt,
      csvContent: csv,
      cutoff,
      env,
      fileUrl: `${new URL(request.url).origin}${fileUrl}`,
      fileName,
      recordCount: rows.length,
      recipients
    });
    notificationStatus = result.failedRecipients.length > 0 ? "partial_failed" : "sent";
    failedRecipients = result.failedRecipients;
  }

  await db
    .prepare(
      `INSERT INTO analytics_backups (
        id, date_range_start, date_range_end, backup_type, destination, file_name, file_url,
        status, record_count, recipient_count, failed_recipients, notification_status,
        backup_csv, created_at, created_by
      ) VALUES (?1, 0, ?2, 'analytics_events_raw', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
    )
    .bind(
      backupId,
      cutoff,
      destination,
      fileName,
      fileUrl,
      status,
      rows.length,
      recipients.length,
      failedRecipients.join(","),
      notificationStatus,
      csv,
      createdAt,
      sanitizeEmail(adminEmail)
    )
    .run();

  await recordAdminAuditEvent({
    email: adminEmail,
    env,
    reason: `analytics_backup:${backupId}:${rows.length}:${notificationStatus}`,
    request,
    type: "backup_created"
  });

  return {
    backupDownloadUrl: fileUrl,
    backupId,
    failedRecipients: failedRecipients.map(maskEmail),
    notificationStatus,
    ok: true as const,
    recordCount: rows.length,
    status
  };
}

export async function runAnalyticsCleanupAfterBackup({
  adminEmail,
  env,
  request
}: {
  adminEmail: string;
  env: AdminMaintenanceEnv;
  request: Request;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "ADMIN_DB is not configured. No data was deleted." };

  await ensureMaintenanceTables(db);
  await ensureAnalyticsEventTables(env);

  const cutoff = getRetentionCutoffSeconds();
  const latestBackup = await getLatestBackup(db);

  if (!latestBackup || latestBackup.status.startsWith("failed")) {
    await insertCleanupLog({
      adminEmail,
      backupId: latestBackup?.id || "",
      cutoff,
      db,
      deletedCount: 0,
      reason: "No successful backup found.",
      status: "skipped"
    });
    return { ok: false as const, error: "No successful backup found. No analytics data was deleted." };
  }

  if (latestBackup.notification_status !== "sent") {
    await insertCleanupLog({
      adminEmail,
      backupId: latestBackup.id,
      cutoff,
      db,
      deletedCount: 0,
      reason: `Backup notification status is ${latestBackup.notification_status || "unknown"}.`,
      status: "skipped"
    });
    return {
      ok: false as const,
      error: "Backup notification did not succeed for all active admins. No analytics data was deleted."
    };
  }

  const eligibleCount = await countOldAnalyticsEvents(db, cutoff);
  await preserveAnalyticsRollups({ backupId: latestBackup.id, cutoff, db });

  if (eligibleCount > 0) {
    await db.prepare("DELETE FROM analytics_events WHERE created_at < ?1").bind(cutoff).run();
  }

  await insertCleanupLog({
    adminEmail,
    backupId: latestBackup.id,
    cutoff,
    db,
    deletedCount: eligibleCount,
    reason: "Backup and active-admin notification succeeded.",
    status: "completed"
  });

  await recordAdminAuditEvent({
    email: adminEmail,
    env,
    reason: `analytics_cleanup:${latestBackup.id}:${eligibleCount}`,
    request,
    type: "cleanup_completed"
  });

  return {
    backupId: latestBackup.id,
    deletedCount: eligibleCount,
    ok: true as const,
    status: "completed"
  };
}

export async function sendTestBackupEmail({
  adminEmail,
  env,
  request
}: {
  adminEmail: string;
  env: AdminMaintenanceEnv;
  request: Request;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "ADMIN_DB is not configured." };

  await ensureMaintenanceTables(db);
  const recipients = await getActiveBackupRecipients(db);
  if (recipients.length === 0) {
    return { ok: false as const, error: "No active admin backup recipient found." };
  }
  if (!isBackupEmailConfigured(env)) {
    return { ok: false as const, error: "Backup email provider is not configured." };
  }

  const result = await sendBackupNotificationEmails({
    backupId: "test-backup-email",
    createdAt: getNowSeconds(),
    cutoff: getRetentionCutoffSeconds(),
    env,
    fileName: "ywcoach-backup-email-test.csv",
    fileUrl: `${new URL(request.url).origin}/admin/dashboard`,
    isTest: true,
    recordCount: 0,
    recipients
  });

  await recordAdminAuditEvent({
    email: adminEmail,
    env,
    reason: `backup_test_email:${result.failedRecipients.length}`,
    request,
    type: "backup_test_email_sent"
  });

  if (result.failedRecipients.length > 0) {
    return {
      failedRecipients: result.failedRecipients.map(maskEmail),
      ok: false as const,
      error: "Test backup email failed for one or more active admins."
    };
  }

  return { ok: true as const, recipientCount: recipients.length };
}

export async function getBackupDownload({
  backupId,
  env
}: {
  backupId: string;
  env: AdminMaintenanceEnv;
}) {
  const db = env.ADMIN_DB;
  if (!db) return null;

  await ensureMaintenanceTables(db);

  const row = await db
    .prepare(
      `SELECT backup_csv, file_name
       FROM analytics_backups
       WHERE id = ?1
       LIMIT 1`
    )
    .bind(sanitizeToken(backupId, 120))
    .first<{ backup_csv: string; file_name: string }>();

  if (!row?.backup_csv) return null;

  return {
    csv: row.backup_csv,
    fileName: row.file_name || "ywcoach-analytics-backup.csv"
  };
}

export async function clearOldErrorReports({
  adminEmail,
  env,
  filter,
  request
}: {
  adminEmail: string;
  env: AdminMaintenanceEnv;
  filter: ErrorReportCleanupFilter;
  request: Request;
}) {
  const db = env.ADMIN_DB;
  if (!db) {
    return { ok: false as const, error: "Error report database is not configured." };
  }

  await ensureErrorReportsSchema(db);
  await ensureMaintenanceTables(db);

  const cleanup = getErrorReportCleanupSql(filter);
  const before = await db.prepare(cleanup.countSql).bind(...cleanup.params).first<{ total: number }>();
  const deletedCount = normalizeNumber(before?.total);

  if (deletedCount > 0) {
    await db.prepare(cleanup.deleteSql).bind(...cleanup.params).run();
  }

  const now = getNowSeconds();
  await db
    .prepare(
      `INSERT INTO error_report_cleanup_logs (
        id, filter_used, deleted_report_count, created_at, created_by
      ) VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(
      `error-cleanup-${crypto.randomUUID()}`,
      filter,
      deletedCount,
      now,
      sanitizeEmail(adminEmail)
    )
    .run();

  await recordAdminAuditEvent({
    email: adminEmail,
    env,
    reason: `error_report_cleanup:${filter}:${deletedCount}`,
    request,
    type: "error_reports_cleared"
  });

  return { deletedCount, filter, ok: true as const };
}

export async function ensureMaintenanceTables(db: D1Database) {
  for (const statement of MAINTENANCE_SCHEMA) {
    await db.prepare(statement).run();
  }
}

async function getActiveBackupRecipients(db: D1Database): Promise<BackupRecipient[]> {
  const columns = await getTableColumns(db, "admin_users");
  if (!columns.has("email") || !columns.has("role") || !columns.has("status")) return [];

  const hasNotificationsColumn = columns.has("backup_notifications_enabled");
  const rows = await db
    .prepare(
      `SELECT email, role, status${
        hasNotificationsColumn ? ", backup_notifications_enabled" : ""
      }
       FROM admin_users
       WHERE status = 'active'`
    )
    .all<AdminUserRow>();

  return (rows.results || [])
    .map((row) => ({
      email: sanitizeEmail(row.email),
      maskedEmail: maskEmail(row.email),
      notificationsEnabled: hasNotificationsColumn
        ? isTruthy(row.backup_notifications_enabled)
        : true,
      role: sanitizeText(row.role, 40),
      status: sanitizeText(row.status, 40)
    }))
    .filter((row) => {
      const acceptedRole = row.role === "admin" || row.role === "super_admin" || row.role === "owner";
      return isValidEmail(row.email) && acceptedRole && row.status === "active" && row.notificationsEnabled;
    });
}

async function getAdminRoleChecklist({
  currentAdminEmail,
  db,
  env
}: {
  currentAdminEmail: string;
  db: D1Database;
  env: AdminMaintenanceEnv;
}): Promise<AdminRoleChecklist> {
  const normalizedEmail = sanitizeEmail(currentAdminEmail);
  const columns = await getTableColumns(db, "admin_users");
  const adminRoleTableExists = columns.size > 0;
  const row =
    adminRoleTableExists && normalizedEmail
      ? await db
          .prepare("SELECT email, role, status FROM admin_users WHERE email = ?1 LIMIT 1")
          .bind(normalizedEmail)
          .first<AdminUserRow>()
      : null;
  const strictDbRolesEnabled = env.ADMIN_REQUIRE_DB_ADMIN_ROLES === "true";
  const role = row?.role || "";
  const status = row?.status || "";
  const roleRequirementMet =
    status === "active" && (role === "admin" || role === "super_admin" || role === "owner");
  const lockoutRisk = strictDbRolesEnabled
    ? roleRequirementMet
      ? "low"
      : "high"
    : roleRequirementMet
      ? "low"
      : "medium";

  return {
    adminEmailPresent: Boolean(row?.email),
    adminEmailRole: role || "Not found",
    adminEmailStatus: status || "Not found",
    adminRoleTableExists,
    currentAdminEmailMasked: maskEmail(normalizedEmail),
    lockoutRisk,
    rollbackInstructions: [
      "Set ADMIN_REQUIRE_DB_ADMIN_ROLES=false in Cloudflare Pages variables.",
      "Redeploy or wait for the variable update to take effect.",
      "Keep ADMIN_ALLOWED_EMAILS configured until DB-role login is verified."
    ],
    roleRequirementMet,
    strictDbRolesEnabled
  };
}

async function getTableColumns(db: D1Database, tableName: string) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>();
    return new Set((result.results || []).map((row) => row.name).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

async function getLatestBackup(db: D1Database) {
  return db
    .prepare(
      `SELECT id, created_at, failed_recipients, file_name, file_url, notification_status,
              record_count, status
       FROM analytics_backups
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .first<BackupRow>();
}

async function getLatestCleanup(db: D1Database) {
  return db
    .prepare(
      `SELECT created_at, deleted_record_count, status
       FROM cleanup_logs
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .first<CleanupRow>();
}

async function getLatestErrorCleanup(db: D1Database) {
  return db
    .prepare(
      `SELECT created_at, deleted_report_count
       FROM error_report_cleanup_logs
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .first<ErrorCleanupRow>();
}

async function countOldAnalyticsEvents(db: D1Database, cutoff: number) {
  const row = await db
    .prepare("SELECT COUNT(*) AS total FROM analytics_events WHERE created_at < ?1")
    .bind(cutoff)
    .first<{ total: number }>();
  return normalizeNumber(row?.total);
}

async function listOldAnalyticsRows(db: D1Database, cutoff: number) {
  const result = await db
    .prepare(
      `SELECT id, event_name, funnel_type, coach_slug, coach_site_id, coach_id, funnel_id,
              page_path, source, utm_source, utm_medium, utm_campaign, device_type, region,
              created_at, created_date
       FROM analytics_events
       WHERE created_at < ?1
       ORDER BY created_at ASC
       LIMIT 50000`
    )
    .bind(cutoff)
    .all<Record<string, unknown>>();

  return result.results || [];
}

async function preserveAnalyticsRollups({
  backupId,
  cutoff,
  db
}: {
  backupId: string;
  cutoff: number;
  db: D1Database;
}) {
  const now = getNowSeconds();
  await db
    .prepare(
      `INSERT INTO analytics_event_rollups (
        id, backup_id, event_name, funnel_type, coach_slug, coach_id, funnel_id,
        event_count, first_created_at, last_created_at, created_at
      )
      SELECT
        'rollup-' || lower(hex(randomblob(16))),
        ?1,
        event_name,
        funnel_type,
        coach_slug,
        coach_id,
        funnel_id,
        COUNT(*),
        MIN(created_at),
        MAX(created_at),
        ?2
      FROM analytics_events
      WHERE created_at < ?3
      GROUP BY event_name, funnel_type, coach_slug, coach_id, funnel_id`
    )
    .bind(backupId, now, cutoff)
    .run();
}

async function insertCleanupLog({
  adminEmail,
  backupId,
  cutoff,
  db,
  deletedCount,
  reason,
  status
}: {
  adminEmail: string;
  backupId: string;
  cutoff: number;
  db: D1Database;
  deletedCount: number;
  reason: string;
  status: string;
}) {
  await db
    .prepare(
      `INSERT INTO cleanup_logs (
        id, cleanup_type, date_range_start, date_range_end, backup_id,
        deleted_record_count, status, reason, created_at, created_by
      ) VALUES (?1, 'analytics_events_raw', 0, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
    .bind(
      `cleanup-${crypto.randomUUID()}`,
      cutoff,
      sanitizeToken(backupId, 160),
      deletedCount,
      sanitizeText(status, 40),
      sanitizeText(reason, 320),
      getNowSeconds(),
      sanitizeEmail(adminEmail)
    )
    .run();
}

async function sendBackupNotificationEmails({
  backupId,
  createdAt,
  csvContent,
  cutoff,
  env,
  fileName,
  fileUrl,
  isTest = false,
  recordCount,
  recipients
}: {
  backupId: string;
  createdAt: number;
  csvContent?: string;
  cutoff: number;
  env: AdminMaintenanceEnv;
  fileName: string;
  fileUrl: string;
  isTest?: boolean;
  recordCount: number;
  recipients: BackupRecipient[];
}) {
  const failedRecipients: string[] = [];

  for (const recipient of recipients) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        body: JSON.stringify({
          from: env.ADMIN_EMAIL_OTP_FROM,
          html: createBackupEmailHtml({
            backupId,
            createdAt,
            cutoff,
            fileUrl,
            isTest,
            recordCount
          }),
          attachments:
            !isTest && typeof csvContent === "string"
              ? [
                  {
                    content: base64Encode(csvContent),
                    filename: fileName
                  }
                ]
              : undefined,
          subject: BACKUP_EMAIL_SUBJECT,
          text: createBackupEmailText({
            backupId,
            createdAt,
            cutoff,
            fileUrl,
            isTest,
            recordCount
          }),
          to: recipient.email
        }),
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          "content-type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) failedRecipients.push(recipient.email);
    } catch {
      failedRecipients.push(recipient.email);
    }
  }

  return { failedRecipients };
}

function createBackupEmailText({
  backupId,
  createdAt,
  cutoff,
  fileUrl,
  isTest,
  recordCount
}: {
  backupId: string;
  createdAt: number;
  cutoff: number;
  fileUrl: string;
  isTest: boolean;
  recordCount: number;
}) {
  return [
    isTest ? "This is a YWcoach backup email test." : "YWcoach analytics backup is ready.",
    `Backup ID: ${backupId}`,
    "Backup type: analytics_events_raw",
    `Date range: before ${new Date(cutoff * 1000).toISOString()}`,
    `Record count: ${recordCount}`,
    `Cleanup status: ${
      isTest
        ? "Test only. No cleanup ran."
        : "Backup completed. Cleanup requires successful notification."
    }`,
    isTest
      ? `Backup test link: ${fileUrl}`
      : `Primary backup: CSV attached to this email. Protected download fallback: ${fileUrl}`,
    `Timestamp: ${new Date(createdAt * 1000).toISOString()}`,
    "This email does not include secrets, OTPs, private links, tokens, or payment card data."
  ].join("\n");
}

function createBackupEmailHtml(input: Parameters<typeof createBackupEmailText>[0]) {
  return createBackupEmailText(input)
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function createAnalyticsBackupCsv(rows: Array<Record<string, unknown>>) {
  const headers = [
    "id",
    "event_name",
    "funnel_type",
    "coach_slug",
    "coach_site_id",
    "coach_id",
    "funnel_id",
    "page_path",
    "source",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "device_type",
    "region",
    "created_at",
    "created_date"
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(String(row[header] ?? ""))).join(","))
  ];

  return lines.join("\n");
}

function getErrorReportCleanupSql(filter: ErrorReportCleanupFilter) {
  const now = getNowSeconds();
  const older30 = now - 30 * 86400;
  const older90 = now - 90 * 86400;

  if (filter === "fixed_ignored") {
    return createCleanupQuery("status IN ('Fixed', 'Ignored')", []);
  }
  if (filter === "older_30") {
    return createCleanupQuery(
      "created_at < ?1 AND status IN ('Fixed', 'Ignored', 'Reviewing')",
      [older30]
    );
  }
  if (filter === "older_90") {
    return createCleanupQuery(
      "created_at < ?1 AND status IN ('Fixed', 'Ignored', 'Reviewing')",
      [older90]
    );
  }

  return createCleanupQuery(
    "status IN ('Fixed', 'Ignored') OR (status = 'Reviewing' AND created_at < ?1)",
    [older90]
  );
}

function createCleanupQuery(where: string, params: number[]) {
  return {
    countSql: `SELECT COUNT(*) AS total FROM error_reports WHERE ${where}`,
    deleteSql: `DELETE FROM error_reports WHERE ${where}`,
    params
  };
}

function getCleanupStatusText({
  backupEmailConfigured,
  cleanupEligibleAnalyticsEvents,
  latestBackup,
  recipients
}: {
  backupEmailConfigured: boolean;
  cleanupEligibleAnalyticsEvents: number;
  latestBackup: BackupRow | null;
  recipients: BackupRecipient[];
}) {
  if (cleanupEligibleAnalyticsEvents === 0) return "No raw analytics older than 90 days.";
  if (recipients.length === 0) return "Blocked: No active admin backup recipient found.";
  if (!backupEmailConfigured) return "Blocked: backup email provider is not configured.";
  if (!latestBackup) return "Blocked until Run Backup Now succeeds.";
  if (latestBackup.notification_status !== "sent") {
    return "Blocked until backup notification succeeds for all active admins.";
  }
  return "Ready for cleanup after backup confirmation.";
}

function isBackupEmailConfigured(env: AdminMaintenanceEnv) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.ADMIN_EMAIL_OTP_FROM?.trim());
}

function getRetentionCutoffSeconds() {
  return getNowSeconds() - RETENTION_DAYS * 86400;
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function secondsToDisplay(value: number | string | null | undefined) {
  const seconds = normalizeNumber(value);
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function normalizeNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function parseList(value: unknown) {
  return typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function maskEmail(value: unknown) {
  const email = sanitizeEmail(value);
  if (!email) return "not configured";
  const [name, domain] = email.split("@");
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, Math.min(6, name.length - visible.length)))}@${domain}`;
}

function sanitizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength)
    : "";
}

function sanitizeToken(value: unknown, maxLength: number) {
  return sanitizeText(value, maxLength).replace(/[^A-Za-z0-9._:-]/g, "");
}

function isTruthy(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function base64Encode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

function createUnavailableRoleChecklist(
  currentAdminEmail: string,
  env: AdminMaintenanceEnv
): AdminRoleChecklist {
  return {
    adminEmailPresent: false,
    adminEmailRole: "Database missing",
    adminEmailStatus: "Database missing",
    adminRoleTableExists: false,
    currentAdminEmailMasked: maskEmail(currentAdminEmail),
    lockoutRisk: env.ADMIN_REQUIRE_DB_ADMIN_ROLES === "true" ? "high" : "medium",
    rollbackInstructions: [
      "Set ADMIN_REQUIRE_DB_ADMIN_ROLES=false in Cloudflare Pages variables.",
      "Redeploy or wait for the variable update to take effect.",
      "Keep ADMIN_ALLOWED_EMAILS configured until DB-role login is verified."
    ],
    roleRequirementMet: false,
    strictDbRolesEnabled: env.ADMIN_REQUIRE_DB_ADMIN_ROLES === "true"
  };
}
