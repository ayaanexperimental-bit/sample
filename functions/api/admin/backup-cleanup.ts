import type { D1Database } from "@cloudflare/workers-types";
import { adminControlCenterData } from "../../../lib/admin-control-center";
import { adminJson, readJsonBody, requireAdmin } from "../../../lib/server/admin-auth";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  GOOGLE_SHEETS_BACKUP_CREDENTIALS_JSON?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type BackupCleanupActionBody = {
  action?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET") {
    const admin = await requireAdmin(request, env, { requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    return adminJson({
      backupCleanup: {
        ...adminControlCenterData.backupCleanup,
        googleSheetsConfigured: Boolean(env.GOOGLE_SHEETS_BACKUP_CREDENTIALS_JSON?.trim())
      },
      ok: true,
      persistence: "disabled"
    });
  }

  if (request.method === "POST") {
    const admin = await requireAdmin(request, env, { requireCsrf: true, requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    const body = await readJsonBody<BackupCleanupActionBody>(request);
    const action = typeof body?.action === "string" ? body.action.trim() : "";

    if (action !== "backup" && action !== "cleanup") {
      return adminJson({ ok: false, error: "Unsupported backup/cleanup action." }, 400);
    }

    return adminJson(
      {
        error:
          action === "cleanup"
            ? "Cleanup is disabled until a backup destination succeeds. No data was deleted."
            : "Backup storage is not configured yet. No backup was created.",
        ok: false,
        persistence: "disabled"
      },
      503
    );
  }

  return adminJson({ ok: false, error: "Method not allowed." }, 405, {
    allow: "GET, POST"
  });
}
