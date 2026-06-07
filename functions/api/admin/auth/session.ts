import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, createAdminCsrfToken, requireAdmin } from "../../../../lib/server/admin-auth";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  ROOT_OWNER_EMAIL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET") {
    return adminJson({ authenticated: false, error: "Method not allowed." }, 405, {
      allow: "GET"
    });
  }

  const admin = await requireAdmin(request, env);
  if (!admin.ok) {
    return adminJson({ authenticated: false });
  }
  const csrfToken = await createAdminCsrfToken({ env, session: admin.session });

  return adminJson({
    admin: admin.admin,
    authenticated: true,
    csrfToken
  });
}
