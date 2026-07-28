import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, requireOwner } from "../../../../lib/server/admin-auth";
import { purgeExpiredAdminAIRecords } from "../../../../lib/server/admin-ai-retention";

type Env = {
  ADMIN_AI_DURABLE_CONTINUITY?: string;
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
  if (request.method !== "POST") {
    return adminJson({ error: "Method not allowed.", ok: false }, 405, { allow: "POST" });
  }
  const admin = await requireOwner(request, env, { requireCsrf: true });
  if (!admin.ok) return admin.response;
  if (env.ADMIN_AI_DURABLE_CONTINUITY !== "true" || !env.ADMIN_DB) {
    return adminJson(
      { code: "continuity-unavailable", error: "Durable Admin AI continuity is unavailable.", ok: false },
      503
    );
  }
  try {
    const deleted = await purgeExpiredAdminAIRecords({ batchSize: 500, db: env.ADMIN_DB });
    return adminJson({
      deleted,
      ok: true,
      retentionDays: 90
    });
  } catch {
    return adminJson(
      { code: "purge-failed", error: "Expired Admin AI records were not purged.", ok: false },
      503
    );
  }
}
