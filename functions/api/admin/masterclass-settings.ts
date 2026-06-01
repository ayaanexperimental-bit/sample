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
  WHATSAPP_GROUP_URL_GYANA_PCOS_51?: string;
  YW_PRIVATE_FUNNEL_LINKS_JSON?: string;
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
    const admin = await requireAdmin(request, env, { requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    return adminJson({
      ok: true,
      paymentLinkConfigured: Boolean(env.RAZORPAY_PAYMENT_PAGE_URL?.trim()),
      privateLinkValuesExposed: false,
      settings: getMasterclassSettingsWithEnvStatus({
        WHATSAPP_GROUP_URL_GYANA_PCOS_51: env.WHATSAPP_GROUP_URL_GYANA_PCOS_51,
        YW_PRIVATE_FUNNEL_LINKS_JSON: env.YW_PRIVATE_FUNNEL_LINKS_JSON
      })
    });
  }

  if (request.method === "POST" || request.method === "PATCH") {
    const admin = await requireAdmin(request, env, { requireCsrf: true, requiredRole: "owner" });
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
