import { expect, test } from "@playwright/test";
import type { D1Database } from "@cloudflare/workers-types";
import {
  clearOldErrorReports,
  getAdminMaintenanceStatus,
  getBackupDownload,
  runAnalyticsBackup,
  runAnalyticsCleanupAfterBackup
} from "../../lib/server/admin-maintenance";
import { onRequest as backupCleanupRequest } from "../../functions/api/admin/backup-cleanup";

const OLD_EVENT_TIME = 1_700_000_000;

test.describe("admin maintenance backup safeguards", () => {
  test("creates CSV and XLS backups for active admins and blocks cleanup until notifications succeed", async () => {
    const db = new MaintenanceFakeD1();
    const env = {
      ADMIN_DB: db as unknown as D1Database,
      ADMIN_SESSION_SECRET: "local-maintenance-secret"
    };

    const before = await getAdminMaintenanceStatus({
      currentAdminEmail: "owner@example.com",
      env
    });
    expect(before.activeAdminRecipientCount).toBe(3);
    expect(before.backupDestination).toBe("Email CSV + XLS attachments primary");
    expect(before.cleanupStatus).toBe("Blocked: backup email provider is not configured.");

    const backup = await runAnalyticsBackup({
      adminEmail: "owner@example.com",
      env,
      request: new Request("https://ywcoach.com/api/admin/backup-cleanup")
    });
    expect(backup).toMatchObject({
      notificationStatus: "email_not_configured",
      ok: true,
      recordCount: 2,
      status: "completed"
    });
    if (!backup.ok) {
      throw new Error("Expected backup to succeed in fake D1 test.");
    }
    expect(backup.backupDownloadUrl).toContain("format=csv");
    expect(backup.backupXlsDownloadUrl).toContain("format=xls");
    expect(backup.backupDownloadUrl).toContain("token=");
    expect(backup.backupXlsDownloadUrl).toContain("token=");

    const savedBackup = db.backups.get(backup.backupId);
    expect(savedBackup?.backup_csv).toContain("coach_site_view");
    expect(savedBackup?.backup_csv).toContain("paid_landing_view");
    expect(savedBackup?.backup_xls).toContain("<?mso-application progid=\"Excel.Sheet\"?>");
    expect(savedBackup?.recipient_count).toBe(3);

    const csvDownload = await getBackupDownload({
      backupId: backup.backupId,
      env,
      format: "csv"
    });
    expect(csvDownload).toMatchObject({
      contentType: "text/csv; charset=utf-8",
      fileName: expect.stringMatching(/\.csv$/)
    });
    expect(csvDownload?.content).toContain("coach_slug");

    const xlsDownload = await getBackupDownload({
      backupId: backup.backupId,
      env,
      format: "xls"
    });
    expect(xlsDownload).toMatchObject({
      contentType: "application/vnd.ms-excel; charset=utf-8",
      fileName: expect.stringMatching(/\.xls$/)
    });
    expect(xlsDownload?.content).toContain("<Workbook");

    const signedCsvResponse = await backupCleanupRequest({
      env,
      request: new Request(`https://ywcoach.com${backup.backupDownloadUrl}`)
    });
    expect(signedCsvResponse.status).toBe(200);
    expect(signedCsvResponse.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(await signedCsvResponse.text()).toContain("coach_site_view");

    const signedXlsResponse = await backupCleanupRequest({
      env,
      request: new Request(`https://ywcoach.com${backup.backupXlsDownloadUrl}`)
    });
    expect(signedXlsResponse.status).toBe(200);
    expect(signedXlsResponse.headers.get("content-type")).toBe(
      "application/vnd.ms-excel; charset=utf-8"
    );
    expect(await signedXlsResponse.text()).toContain("<Workbook");

    const tamperedUrl = backup.backupDownloadUrl.replace(/token=[^&]+/, "token=tampered");
    const tamperedResponse = await backupCleanupRequest({
      env,
      request: new Request(`https://ywcoach.com${tamperedUrl}`)
    });
    expect(tamperedResponse.status).toBe(302);
    expect(tamperedResponse.headers.get("location")).toContain("/admin/login?next=");

    const legacyUrl = `/api/admin/backup-cleanup?download=${backup.backupId}&format=csv`;
    const blockedLegacyResponse = await backupCleanupRequest({
      env,
      request: new Request(`https://ywcoach.com${legacyUrl}`)
    });
    expect(blockedLegacyResponse.status).toBe(302);

    savedBackup!.notification_status = "sent";
    const recentEmailedLegacyResponse = await backupCleanupRequest({
      env,
      request: new Request(`https://ywcoach.com${legacyUrl}`)
    });
    expect(recentEmailedLegacyResponse.status).toBe(200);
    expect(await recentEmailedLegacyResponse.text()).toContain("coach_site_view");
    savedBackup!.notification_status = "email_not_configured";

    const after = await getAdminMaintenanceStatus({
      currentAdminEmail: "owner@example.com",
      env
    });
    expect(after.activeAdminRecipientCount).toBe(3);
    expect(after.backupXlsDownloadUrl).toContain("format=xls");
    expect(after.lastBackupRecordCount).toBe(2);
    expect(after.lastBackupStatus).toBe("completed");
    expect(after.cleanupStatus).toBe("Blocked: backup email provider is not configured.");

    const cleanup = await runAnalyticsCleanupAfterBackup({
      adminEmail: "owner@example.com",
      env,
      request: new Request("https://ywcoach.com/api/admin/backup-cleanup")
    });
    expect(cleanup.ok).toBe(false);
    expect(cleanup.error).toBe(
      "Backup notification did not succeed for all active admins. No analytics data was deleted."
    );
    expect(db.analyticsRows).toHaveLength(2);
    expect(db.cleanupLogs[0]).toMatchObject({
      deleted_record_count: 0,
      reason: "Backup notification status is email_not_configured.",
      status: "skipped"
    });
  });

  test("clears only selected stale error reports without requiring analytics backup", async () => {
    const db = new ErrorReportCleanupFakeD1();
    const env = {
      ADMIN_DB: db as unknown as D1Database,
      ADMIN_SESSION_SECRET: "local-maintenance-secret"
    };

    const result = await clearOldErrorReports({
      adminEmail: "owner@example.com",
      env,
      filter: "stale_all",
      request: new Request("https://ywcoach.com/api/admin/error-reports")
    });

    expect(result).toMatchObject({
      deletedCount: 3,
      filter: "stale_all",
      ok: true
    });
    expect(db.errorReports.map((row) => row.status).sort()).toEqual(["New", "Reviewing"]);
    expect(db.errorCleanupLogs[0]).toMatchObject({
      deleted_report_count: 3,
      filter_used: "stale_all"
    });
    expect(db.auditEvents[0]).toMatchObject({
      event_type: "error_reports_cleared"
    });
  });
});

type StoredBackup = {
  backup_csv: string;
  backup_xls: string;
  created_at: number;
  failed_recipients: string;
  file_name: string;
  file_url: string;
  id: string;
  notification_status: string;
  record_count: number;
  recipient_count: number;
  status: string;
};

class MaintenanceFakeD1 {
  analyticsRows = [
    {
      coach_id: "coach-1",
      coach_site_id: "site-1",
      coach_slug: "coach-one",
      created_at: OLD_EVENT_TIME,
      created_date: "2023-11-14",
      device_type: "mobile",
      event_name: "coach_site_view",
      funnel_id: "free-1",
      funnel_type: "free_guest_link",
      id: "event-1",
      page_path: "/coach/coach-one",
      region: "Odisha",
      source: "direct",
      utm_campaign: "",
      utm_medium: "",
      utm_source: ""
    },
    {
      coach_id: "coach-1",
      coach_site_id: "",
      coach_slug: "coach-one",
      created_at: OLD_EVENT_TIME + 100,
      created_date: "2023-11-14",
      device_type: "desktop",
      event_name: "paid_landing_view",
      funnel_id: "paid-1",
      funnel_type: "paid_masterclass",
      id: "event-2",
      page_path: "/coach-one/paid",
      region: "Not available",
      source: "instagram",
      utm_campaign: "launch",
      utm_medium: "social",
      utm_source: "instagram"
    }
  ];
  backups = new Map<string, StoredBackup>();
  cleanupLogs: Array<Record<string, unknown>> = [];
  auditEvents: Array<Record<string, unknown>> = [];

  adminUsers = [
    {
      backup_notifications_enabled: 1,
      email: "owner@example.com",
      role: "owner",
      status: "active"
    },
    {
      backup_notifications_enabled: 1,
      email: "admin@example.com",
      role: "admin",
      status: "active"
    },
    {
      backup_notifications_enabled: 1,
      email: "super@example.com",
      role: "super_admin",
      status: "active"
    },
    {
      backup_notifications_enabled: 1,
      email: "inactive@example.com",
      role: "admin",
      status: "inactive"
    },
    {
      backup_notifications_enabled: 0,
      email: "disabled@example.com",
      role: "owner",
      status: "active"
    },
    {
      backup_notifications_enabled: 1,
      email: "viewer@example.com",
      role: "viewer",
      status: "active"
    }
  ];

  prepare(sql: string) {
    return new MaintenanceFakeStatement(this, sql);
  }

  all(sql: string, params: unknown[]) {
    if (sql.includes("PRAGMA table_info")) {
      return { results: this.getColumns(sql).map((name) => ({ name })) };
    }

    if (sql.includes("FROM admin_users") && sql.includes("WHERE status = 'active'")) {
      return { results: this.adminUsers.filter((row) => row.status === "active") };
    }

    if (sql.includes("FROM analytics_events") && sql.includes("WHERE created_at <")) {
      const cutoff = Number(params[0]);
      return { results: this.analyticsRows.filter((row) => row.created_at < cutoff) };
    }

    return { results: [] };
  }

  first(sql: string, params: unknown[]) {
    if (sql.includes("SELECT COUNT(*) AS total FROM analytics_events")) {
      const cutoff = Number(params[0]);
      return { total: this.analyticsRows.filter((row) => row.created_at < cutoff).length };
    }

    if (sql.includes("FROM analytics_backups") && sql.includes("ORDER BY created_at DESC")) {
      return this.getLatestBackup();
    }

    if (sql.includes("FROM cleanup_logs")) {
      return this.cleanupLogs.at(-1) || null;
    }

    if (sql.includes("FROM error_report_cleanup_logs")) {
      return null;
    }

    if (sql.includes("FROM admin_users WHERE email")) {
      const email = String(params[0] || "").toLowerCase();
      return this.adminUsers.find((row) => row.email === email) || null;
    }

    if (sql.includes("SELECT backup_csv, backup_xls, file_name")) {
      return this.backups.get(String(params[0] || "")) || null;
    }

    if (sql.includes("SELECT created_at, notification_status")) {
      return this.backups.get(String(params[0] || "")) || null;
    }

    return null;
  }

  run(sql: string, params: unknown[]) {
    if (sql.includes("INSERT INTO analytics_backups")) {
      this.backups.set(String(params[0]), {
        backup_csv: String(params[10] || ""),
        backup_xls: String(params[11] || ""),
        created_at: Number(params[12] || 0),
        failed_recipients: String(params[8] || ""),
        file_name: String(params[3] || ""),
        file_url: String(params[4] || ""),
        id: String(params[0] || ""),
        notification_status: String(params[9] || ""),
        record_count: Number(params[6] || 0),
        recipient_count: Number(params[7] || 0),
        status: String(params[5] || "")
      });
    }

    if (sql.includes("INSERT INTO cleanup_logs")) {
      this.cleanupLogs.push({
        backup_id: String(params[2] || ""),
        deleted_record_count: Number(params[3] || 0),
        reason: String(params[5] || ""),
        status: String(params[4] || "")
      });
    }

    if (sql.includes("DELETE FROM analytics_events")) {
      const cutoff = Number(params[0]);
      this.analyticsRows = this.analyticsRows.filter((row) => row.created_at >= cutoff);
    }

    if (sql.includes("INSERT INTO admin_audit_events")) {
      this.auditEvents.push({
        email: params[2],
        event_type: params[1],
        reason: params[3]
      });
    }

    return { success: true };
  }

  private getLatestBackup() {
    return (
      Array.from(this.backups.values()).sort((left, right) => right.created_at - left.created_at)[0] ||
      null
    );
  }

  private getColumns(sql: string) {
    if (sql.includes("admin_users")) {
      return ["email", "role", "status", "backup_notifications_enabled"];
    }
    if (sql.includes("analytics_backups")) {
      return ["backup_csv", "backup_xls", "created_at", "file_name", "file_url"];
    }
    if (sql.includes("cleanup_logs")) {
      return ["created_at", "deleted_record_count", "status"];
    }
    if (sql.includes("error_report_cleanup_logs")) {
      return ["created_at", "deleted_report_count"];
    }
    if (sql.includes("analytics_events")) {
      return ["id", "created_at"];
    }

    return [];
  }
}

class ErrorReportCleanupFakeD1 {
  errorReports = [
    { created_at: 1_700_000_000, id: "new-old", status: "New" },
    { created_at: 1_700_000_000, id: "fixed-old", status: "Fixed" },
    { created_at: 1_700_000_000, id: "ignored-old", status: "Ignored" },
    { created_at: 1_700_000_000, id: "reviewing-old", status: "Reviewing" },
    { created_at: Math.floor(Date.now() / 1000), id: "reviewing-current", status: "Reviewing" }
  ];
  errorCleanupLogs: Array<Record<string, unknown>> = [];
  auditEvents: Array<Record<string, unknown>> = [];

  prepare(sql: string) {
    return new ErrorReportCleanupFakeStatement(this, sql);
  }

  all(sql: string) {
    if (sql.includes("PRAGMA table_info")) {
      return { results: [{ name: "id" }, { name: "status" }, { name: "created_at" }] };
    }

    return { results: [] };
  }

  first(sql: string, params: unknown[]) {
    if (sql.includes("SELECT COUNT(*) AS total FROM error_reports")) {
      return { total: this.matchErrorReportCleanupRows(sql, params).length };
    }

    return null;
  }

  run(sql: string, params: unknown[]) {
    if (sql.includes("DELETE FROM error_reports")) {
      const idsToDelete = new Set(this.matchErrorReportCleanupRows(sql, params).map((row) => row.id));
      this.errorReports = this.errorReports.filter((row) => !idsToDelete.has(row.id));
    }

    if (sql.includes("INSERT INTO error_report_cleanup_logs")) {
      this.errorCleanupLogs.push({
        deleted_report_count: Number(params[2] || 0),
        filter_used: String(params[1] || "")
      });
    }

    if (sql.includes("INSERT INTO admin_audit_events")) {
      this.auditEvents.push({
        email: params[2],
        event_type: params[1],
        reason: params[3]
      });
    }

    return { success: true };
  }

  private matchErrorReportCleanupRows(sql: string, params: unknown[]) {
    if (sql.includes("status IN ('Fixed', 'Ignored') OR")) {
      const cutoff = Number(params[0]);
      return this.errorReports.filter(
        (row) =>
          row.status === "Fixed" ||
          row.status === "Ignored" ||
          (row.status === "Reviewing" && row.created_at < cutoff)
      );
    }

    if (sql.includes("status IN ('Fixed', 'Ignored')")) {
      return this.errorReports.filter((row) => row.status === "Fixed" || row.status === "Ignored");
    }

    return [];
  }
}

class ErrorReportCleanupFakeStatement {
  private params: unknown[] = [];

  constructor(
    private readonly db: ErrorReportCleanupFakeD1,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async all<T>() {
    return this.db.all(this.sql) as { results: T[] };
  }

  async first<T>() {
    return this.db.first(this.sql, this.params) as T | null;
  }

  async run() {
    return this.db.run(this.sql, this.params);
  }
}

class MaintenanceFakeStatement {
  private params: unknown[] = [];

  constructor(
    private readonly db: MaintenanceFakeD1,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async all<T>() {
    return this.db.all(this.sql, this.params) as { results: T[] };
  }

  async first<T>() {
    return this.db.first(this.sql, this.params) as T | null;
  }

  async run() {
    return this.db.run(this.sql, this.params);
  }
}
