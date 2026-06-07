import type { D1Database } from "@cloudflare/workers-types";
import {
  adminAuthorizationResponse,
  adminJson,
  canAuthenticatedAdminPerform,
  readJsonBody,
  requireAdmin
} from "../../../lib/server/admin-auth";
import {
  getAdminMaintenanceStatus,
  getBackupDownload,
  runAnalyticsBackup,
  runAnalyticsCleanupAfterBackup,
  sendTestBackupEmail,
  verifyBackupDownloadToken,
  verifyRecentEmailedBackupDownload
} from "../../../lib/server/admin-maintenance";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
  ADMIN_EMAIL_OTP_FROM?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type BackupCleanupActionBody = {
  action?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET" || request.method === "HEAD") {
    const url = new URL(request.url);
    const downloadId = url.searchParams.get("download") || "";
    if (request.method === "HEAD" && !downloadId) {
      return adminJson({ ok: false, error: "Method not allowed." }, 405, {
        allow: "GET, HEAD, POST"
      });
    }

    let currentAdminEmail = "";
    if (downloadId) {
      const signedDownloadAllowed = await verifyBackupDownloadToken({
        backupId: downloadId,
        env,
        token: url.searchParams.get("token")
      });
      const recentEmailedBackupAllowed =
        signedDownloadAllowed ||
        (await verifyRecentEmailedBackupDownload({
          backupId: downloadId,
          env
        }));

      if (!recentEmailedBackupAllowed) {
        const admin = await requireAdmin(request, env, { requiredPermission: "backup_cleanup.download" });
        if (!admin.ok) return Response.redirect(createAdminLoginDownloadRedirect(url), 302);
        currentAdminEmail = admin.admin.email;
      }
    } else {
      const admin = await requireAdmin(request, env, { requiredPermission: "backup_cleanup.view" });
      if (!admin.ok) {
        return admin.response;
      }

      currentAdminEmail = admin.admin.email;
    }

    if (downloadId) {
      const requestedFormat = url.searchParams.get("format") === "xls" ? "xls" : "csv";
      const backup = await getBackupDownload({
        backupId: downloadId,
        env,
        format: requestedFormat
      });
      if (!backup) {
        return adminJson({ ok: false, error: "Backup file was not found." }, 404);
      }

      return new Response(request.method === "HEAD" ? null : backup.content, {
        headers: {
          "cache-control": "no-store",
          "content-disposition": `attachment; filename="${backup.fileName.replace(/"/g, "")}"`,
          "content-type": backup.contentType
        }
      });
    }

    return adminJson({
      backupCleanup: await getAdminMaintenanceStatus({
        currentAdminEmail,
        env
      }),
      ok: true,
      persistence: env.ADMIN_DB ? "d1_table" : "unavailable"
    });
  }

  if (request.method === "POST") {
    const admin = await requireAdmin(request, env, {
      requireCsrf: true,
      requiredPermission: "backup_cleanup.view"
    });
    if (!admin.ok) return admin.response;

    const body = await readJsonBody<BackupCleanupActionBody>(request);
    const action = typeof body?.action === "string" ? body.action.trim() : "";

    if (action !== "backup" && action !== "cleanup" && action !== "test_backup_email") {
      return adminJson({ ok: false, error: "Unsupported backup/cleanup action." }, 400);
    }

    const actionPermission =
      action === "cleanup" ? "backup_cleanup.run_cleanup" : "backup_cleanup.run_backup";
    if (!canAuthenticatedAdminPerform(admin.admin, actionPermission)) {
      return adminAuthorizationResponse();
    }

    const result =
      action === "cleanup"
        ? await runAnalyticsCleanupAfterBackup({
            adminEmail: admin.admin.email,
            env,
            request
          })
        : action === "test_backup_email"
          ? await sendTestBackupEmail({
              adminEmail: admin.admin.email,
              env,
              request
            })
          : await runAnalyticsBackup({
              adminEmail: admin.admin.email,
              env,
              request
            });

    return adminJson(
      {
        ...result,
        backupCleanup: await getAdminMaintenanceStatus({
          currentAdminEmail: admin.admin.email,
          env
        }),
        persistence: env.ADMIN_DB ? "d1_table" : "unavailable"
      },
      result.ok ? 200 : 503
    );
  }

  return adminJson({ ok: false, error: "Method not allowed." }, 405, {
    allow: "GET, HEAD, POST"
  });
}

function createAdminLoginDownloadRedirect(url: URL) {
  const loginUrl = new URL("/admin/login", url.origin);
  loginUrl.searchParams.set("next", `${url.pathname}${url.search}`);

  return loginUrl.toString();
}
