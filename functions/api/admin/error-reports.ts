import type { D1Database } from "@cloudflare/workers-types";
import { adminControlCenterData, type AdminErrorReportStatus } from "../../../lib/admin-control-center";
import { adminJson, readJsonBody, requireAdmin } from "../../../lib/server/admin-auth";
import { listWebsiteErrorReports, updateWebsiteErrorReportStatus } from "../../../lib/server/error-reports";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type ErrorReportActionBody = {
  adminNotes?: unknown;
  referenceId?: unknown;
  status?: unknown;
};

const ALLOWED_STATUSES = new Set<AdminErrorReportStatus>([
  "Fixed",
  "Ignored",
  "New",
  "Reviewing"
]);

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET") {
    const admin = await requireAdmin(request, env, { requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    const reports = await listWebsiteErrorReports(env);
    const hasLiveErrorReports = Array.isArray(reports);

    return adminJson({
      configured: Boolean(env.ADMIN_DB),
      errorReports: hasLiveErrorReports ? reports : adminControlCenterData.errorReports,
      ok: true,
      persistence: hasLiveErrorReports ? "d1_table" : "unavailable"
    });
  }

  if (request.method === "POST" || request.method === "PATCH") {
    const admin = await requireAdmin(request, env, { requireCsrf: true, requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    const body = await readJsonBody<ErrorReportActionBody>(request);
    const referenceId = typeof body?.referenceId === "string" ? body.referenceId.trim() : "";
    const status = typeof body?.status === "string" ? body.status.trim() : "";
    const adminNotes = typeof body?.adminNotes === "string" ? body.adminNotes.trim() : "";

    if (!referenceId || !ALLOWED_STATUSES.has(status as AdminErrorReportStatus)) {
      return adminJson({ ok: false, error: "Reference ID and valid status are required." }, 400);
    }

    const result = await updateWebsiteErrorReportStatus({
      adminNotes,
      env,
      referenceId,
      status: status as AdminErrorReportStatus
    });

    if (!result.ok) {
      return adminJson({ ok: false, error: result.error }, 503);
    }

    return adminJson({ ok: true, referenceId, status });
  }

  return adminJson({ ok: false, error: "Method not allowed." }, 405, {
    allow: "GET, POST, PATCH"
  });
}
