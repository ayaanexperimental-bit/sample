import type { D1Database } from "@cloudflare/workers-types";
import { demoCoachSites } from "../../../../lib/admin-coach-sites";
import { adminControlCenterData } from "../../../../lib/admin-control-center";
import { adminDashboardData } from "../../../../lib/admin-dashboard-data";
import { adminJson, requireAdmin } from "../../../../lib/server/admin-auth";
import { listCoachSitesFromDb } from "../../../../lib/server/coach-site-storage";

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
  if (request.method !== "GET") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "GET" });
  }

  const admin = await requireAdmin(request, env, { requiredRole: "owner" });
  if (!admin.ok) {
    return admin.response;
  }

  const persistedCoachSites = await listCoachSitesFromDb(env);

  return adminJson({
    admin: admin.admin,
    coachSites:
      persistedCoachSites && persistedCoachSites.length > 0 ? persistedCoachSites : demoCoachSites,
    controlCenter: adminControlCenterData,
    dashboard: adminDashboardData,
    realCoachSiteStorage: Boolean(persistedCoachSites),
    ok: true
  });
}
