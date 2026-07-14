import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireAdmin } from "../../../lib/server/admin-auth";
import {
  getAdminSupportDefaults,
  updateAdminSupportDefaults,
  type AdminSupportDefaultsInput
} from "../../../lib/server/admin-support-defaults";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  NEXT_PUBLIC_SUPPORT_EMAIL?: string;
  NEXT_PUBLIC_SUPPORT_MESSAGE?: string;
  NEXT_PUBLIC_SUPPORT_NAME?: string;
  NEXT_PUBLIC_SUPPORT_PHONE?: string;
  NEXT_PUBLIC_SUPPORT_WHATSAPP?: string;
  ROOT_OWNER_EMAIL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET") {
    const admin = await requireAdmin(request, env, { requiredPermission: "settings.view" });
    if (!admin.ok) return admin.response;

    return adminJson({
      defaults: await getAdminSupportDefaults(env),
      editable: admin.admin.isOwner || admin.admin.permissions.includes("settings.support"),
      ok: true
    });
  }

  if (request.method === "PATCH") {
    const admin = await requireAdmin(request, env, {
      requireCsrf: true,
      requiredPermission: "settings.support"
    });
    if (!admin.ok) return admin.response;

    const body = await readJsonBody<Record<string, unknown>>(request);
    const result = await updateAdminSupportDefaults({
      env,
      input: (body || {}) as AdminSupportDefaultsInput,
      updatedBy: admin.admin.email
    });

    if (!result.ok) {
      return adminJson({ error: result.error, ok: false }, result.error.includes("database") ? 503 : 400);
    }

    return adminJson({
      defaults: result.defaults,
      editable: true,
      ok: true
    });
  }

  return adminJson({ ok: false, error: "Method not allowed." }, 405, {
    allow: "GET, PATCH"
  });
}
