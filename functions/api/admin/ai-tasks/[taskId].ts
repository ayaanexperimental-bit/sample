import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, requireAdmin } from "../../../../lib/server/admin-auth";
import {
  buildAdminAIContinuityActor,
  deleteAdminAITask,
  getAdminAITaskPreview
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

type PagesContext = {
  env: Env;
  params: { taskId?: string | string[] };
  request: Request;
};

export async function onRequest({ env, params, request }: PagesContext) {
  if (request.method !== "GET" && request.method !== "DELETE") {
    return adminJson({ error: "Method not allowed.", ok: false }, 405, {
      allow: "GET, DELETE"
    });
  }
  const admin = await requireAdmin(request, env, { requireCsrf: request.method === "DELETE" });
  if (!admin.ok) return admin.response;
  if (
    env.ADMIN_AI_DURABLE_CONTINUITY !== "true" ||
    !env.ADMIN_DB ||
    !env.ADMIN_SESSION_SECRET
  ) {
    return adminJson(
      { code: "continuity-unavailable", error: "Durable Admin AI continuity is unavailable.", ok: false },
      503
    );
  }
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] || "" : params.taskId || "";
  try {
    const actor = await buildAdminAIContinuityActor(admin.admin, env.ADMIN_SESSION_SECRET);
    if (request.method === "GET") {
      const result = await getAdminAITaskPreview({ actor, db: env.ADMIN_DB, taskId });
      return result.ok
        ? adminJson({ ok: true, task: result.value })
        : adminJson({ code: result.code, error: result.message, ok: false }, result.status);
    }
    const expectedVersion = positiveInteger(
      new URL(request.url).searchParams.get("expectedVersion")
    );
    if (!expectedVersion) {
      return adminJson(
        { code: "task-version-required", error: "Current task version is required.", ok: false },
        400
      );
    }
    const idempotencyKey = request.headers.get("x-idempotency-key") || "";
    if (!idempotencyKey) {
      return adminJson(
        { code: "idempotency-required", error: "An idempotency key is required.", ok: false },
        400
      );
    }
    const result = await deleteAdminAITask({
      actor,
      db: env.ADMIN_DB,
      expectedVersion,
      idempotencyKey,
      taskId
    });
    return result.ok
      ? adminJson({ deleted: true, ok: true })
      : adminJson({ code: result.code, error: result.message, ok: false }, result.status);
  } catch {
    return adminJson(
      { code: "continuity-unavailable", error: "Durable Admin AI continuity is unavailable.", ok: false },
      503
    );
  }
}

function positiveInteger(value: string | null) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}
