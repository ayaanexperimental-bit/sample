import type { D1Database } from "@cloudflare/workers-types";
import { getMasterclassSettingsWithEnvStatus } from "../../../lib/admin-control-center";
import { adminJson, readJsonBody, requireAdmin } from "../../../lib/server/admin-auth";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  RAZORPAY_PAYMENT_PAGE_URL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type MasterclassSettingsBody = {
  setting?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET") {
    const admin = await requireAdmin(request, env, { requiredPermission: "paid_masterclass.view_settings" });
    if (!admin.ok) return admin.response;

    return adminJson({
      ok: true,
      paymentLinkConfigured: Boolean(env.RAZORPAY_PAYMENT_PAGE_URL?.trim()),
      privateLinkValuesExposed: false,
      settings: getMasterclassSettingsWithEnvStatus()
    });
  }

  if (request.method === "POST" || request.method === "PATCH") {
    const admin = await requireAdmin(request, env, {
      requireCsrf: true,
      requiredPermission: "paid_masterclass.edit_settings"
    });
    if (!admin.ok) return admin.response;

    const body = await readJsonBody<MasterclassSettingsBody>(request);
    const setting = typeof body?.setting === "string" ? body.setting.trim() : "";

    if (!setting) {
      return adminJson({ ok: false, error: "Setting name is required." }, 400);
    }

    return adminJson(
      {
        error:
          "Masterclass settings persistence is not configured yet. No paid link setting was changed.",
        ok: false,
        privateLinkValuesExposed: false
      },
      503
    );
  }

  return adminJson({ ok: false, error: "Method not allowed." }, 405, {
    allow: "GET, POST, PATCH"
  });
}
