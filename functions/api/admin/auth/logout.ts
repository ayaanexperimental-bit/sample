import type { D1Database } from "@cloudflare/workers-types";
import {
  adminJson,
  clearAdminSessionCookie,
  isRequestSecure,
  requireAdmin
} from "../../../../lib/server/admin-auth";
import { recordAdminAuditEvent } from "../../../../lib/server/admin-audit";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
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

  const admin = await requireAdmin(request, env, { requireCsrf: true });
  if (!admin.ok) {
    return admin.response;
  }

  await recordAdminAuditEvent({ email: admin.session.email, env, request, type: "logout" });

  return adminJson({ ok: true }, 200, {
    "set-cookie": clearAdminSessionCookie({ secure: isRequestSecure(request) })
  });
}
