import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, requireAdmin } from "../../../../lib/server/admin-auth";

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

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const admin = await requireAdmin(request, env, {
    requireCsrf: true,
    requiredAnyPermission: ["website_creator.create", "website_creator.edit"]
  });
  if (!admin.ok) return admin.response;

  await request.text().catch(() => "");

  return adminJson(
    {
      error:
        "Server-side photo reprocessing is disabled. Re-upload the image so your browser can create the transparent cutout locally.",
      ok: false
    },
    410
  );
}
