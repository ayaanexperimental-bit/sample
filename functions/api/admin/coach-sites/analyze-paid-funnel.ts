import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireAdmin } from "../../../../lib/server/admin-auth";
import { analyzePaidFunnelPage } from "../../../../lib/server/paid-funnel-page-analyzer";

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

type AnalyzeBody = {
  url?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const admin = await requireAdmin(request, env, {
    requireCsrf: true,
    requiredPermission: "website_creator.ai_copy"
  });
  if (!admin.ok) return admin.response;

  const body = await readJsonBody<AnalyzeBody>(request);
  const url = typeof body?.url === "string" ? body.url.trim().slice(0, 1200) : "";
  if (!url) {
    return adminJson({ ok: false, error: "Existing paid funnel page URL is required." }, 400);
  }

  const result = await analyzePaidFunnelPage(url);
  if (!result.ok) {
    return adminJson(
      {
        message: result.message,
        ok: false
      },
      422
    );
  }

  return adminJson({
    analysis: result.analysis,
    ok: true
  });
}
