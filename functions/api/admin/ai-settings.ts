import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireAdmin } from "../../../lib/server/admin-auth";
import {
  getAdminAISettingsCenter,
  updateAdminAISettingsCenter
} from "../../../lib/server/admin-ai-settings";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  ROOT_OWNER_EMAIL?: string;
};

type PagesContext = { env: Env; request: Request };

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "GET" && request.method !== "PATCH") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "GET, PATCH" });
  }

  const admin = await requireAdmin(request, env, { requireCsrf: request.method === "PATCH" });
  if (!admin.ok) return admin.response;
  if (!env.ADMIN_DB) {
    return adminJson({ ok: false, error: "Durable AI settings storage is unavailable." }, 503);
  }
  const actor = { email: admin.admin.email, isOwner: admin.admin.isOwner };

  try {
    if (request.method === "GET") {
      return adminJson({
        ok: true,
        settings: await getAdminAISettingsCenter({ actor, db: env.ADMIN_DB })
      });
    }
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body) return adminJson({ ok: false, error: "Invalid AI settings request." }, 400);
    const result = await updateAdminAISettingsCenter({ actor, db: env.ADMIN_DB, input: body });
    return result.ok
      ? adminJson({ ok: true, settings: result.settings })
      : adminJson({ code: result.code, error: result.message, ok: false }, result.status);
  } catch {
    return adminJson({ ok: false, error: "Durable AI settings storage is unavailable." }, 503);
  }
}
