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
};

type PagesContext = {
  env: Env;
  request: Request;
};

type ErrorReportActionBody = {
  action?: unknown;
  adminNotes?: unknown;
  referenceId?: unknown;
  status?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET") {
    const admin = await requireAdmin(request, env, { requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    return adminJson({
      errorReports: adminControlCenterData.errorReports,
      ok: true,
      persistence: "placeholder"
    });
  }

  if (request.method === "POST" || request.method === "PATCH") {
    const admin = await requireAdmin(request, env, { requireCsrf: true, requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    const body = await readJsonBody<ErrorReportActionBody>(request);
    const referenceId = typeof body?.referenceId === "string" ? body.referenceId.trim() : "";
    const status = typeof body?.status === "string" ? body.status.trim() : "";

    if (!referenceId || !status) {
      return adminJson({ ok: false, error: "Reference ID and status are required." }, 400);
    }

    return adminJson(
      {
        error:
          "Error report persistence is not configured yet. No report status was changed.",
        ok: false,
        persistence: "disabled"
      },
      503
    );
  }

  return adminJson({ ok: false, error: "Method not allowed." }, 405, {
    allow: "GET, POST, PATCH"
  });
}
