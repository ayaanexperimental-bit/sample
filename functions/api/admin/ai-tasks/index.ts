import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireAdmin } from "../../../../lib/server/admin-auth";
import {
  buildAdminAIContinuityActor,
  createAdminAITask,
  listAdminAITasks,
  purgeExpiredAdminAIContinuity
} from "../../../../lib/server/admin-ai-continuity";

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
  if (request.method !== "GET" && request.method !== "POST") {
    return adminJson({ error: "Method not allowed.", ok: false }, 405, {
      allow: "GET, POST"
    });
  }
  const admin = await requireAdmin(request, env, { requireCsrf: request.method === "POST" });
  if (!admin.ok) return admin.response;
  if (
    env.ADMIN_AI_DURABLE_CONTINUITY !== "true" ||
    !env.ADMIN_DB ||
    !env.ADMIN_SESSION_SECRET
  ) {
    return adminJson(
      {
        code: "continuity-unavailable",
        error: "Durable Admin AI continuity is unavailable; the current chat remains non-resumable.",
        ok: false
      },
      503
    );
  }

  try {
    const actor = await buildAdminAIContinuityActor(admin.admin, env.ADMIN_SESSION_SECRET);
    await purgeExpiredAdminAIContinuity({ batchSize: 50, db: env.ADMIN_DB }).catch(
      () => undefined
    );
    if (request.method === "GET") {
      return adminJson({ ok: true, tasks: await listAdminAITasks({ actor, db: env.ADMIN_DB }) });
    }
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return adminJson({ code: "invalid-task", error: "Invalid saved-task request.", ok: false }, 400);
    }
    const result = await createAdminAITask({
      actor,
      db: env.ADMIN_DB,
      idempotencyKey: request.headers.get("x-idempotency-key") || "",
      input: body
    });
    return result.ok
      ? adminJson({ ok: true, task: result.value }, 201)
      : adminJson({ code: result.code, error: result.message, ok: false }, result.status);
  } catch {
    return adminJson(
      {
        code: "continuity-unavailable",
        error: "Durable Admin AI continuity is unavailable; core Admin V2 remains available.",
        ok: false
      },
      503
    );
  }
}
