import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireOwner } from "../../../lib/server/admin-auth";
import {
  getAdminAISchedules,
  mutateAdminAISchedule,
  type AdminAIScheduleCapabilities
} from "../../../lib/server/admin-ai-schedules";

type Env = {
  ADMIN_AI_EMAIL_WORKFLOW_APPROVED?: string;
  ADMIN_AI_SCHEDULED_JOBS_ENABLED?: string;
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
  if (!["GET", "PATCH", "POST"].includes(request.method)) {
    return adminJson({ error: "Method not allowed.", ok: false }, 405, {
      allow: "GET, POST, PATCH"
    });
  }

  const admin = await requireOwner(request, env, { requireCsrf: request.method !== "GET" });
  if (!admin.ok) return admin.response;
  if (!env.ADMIN_DB) {
    return adminJson(
      { error: "Durable scheduled-briefing storage is unavailable.", ok: false },
      503
    );
  }
  const actor = { email: admin.admin.email, isOwner: admin.admin.isOwner };

  if (request.method === "GET") {
    const url = new URL(request.url);
    if (Array.from(url.searchParams.keys()).length > 0) {
      return adminJson({ error: "Invalid schedule query fields.", ok: false }, 400);
    }
    const result = await getAdminAISchedules({ actor, db: env.ADMIN_DB });
    return result.ok
      ? adminJson({ ok: true, schedules: result.schedules })
      : adminJson({ code: result.code, error: result.message, ok: false }, result.status);
  }

  const body = await readJsonBody<Record<string, unknown>>(request);
  if (!body) return adminJson({ error: "Invalid scheduled-briefing request.", ok: false }, 400);
  if (
    (request.method === "POST" && body.operation !== "create") ||
    (request.method === "PATCH" && body.operation === "create")
  ) {
    return adminJson({ error: "Invalid schedule operation for this method.", ok: false }, 400);
  }
  if (body.operation === "record-delivery") {
    return adminJson(
      {
        code: "forbidden",
        error:
          "Delivery status can only be recorded by a secure scheduled-job runner; admin sessions cannot attest delivery.",
        ok: false
      },
      403
    );
  }
  const result = await mutateAdminAISchedule({
    actor,
    capabilities: scheduleCapabilities(env),
    db: env.ADMIN_DB,
    input: body
  });
  return result.ok
    ? adminJson({ ok: true, schedule: result.schedule }, result.status)
    : adminJson({ code: result.code, error: result.message, ok: false }, result.status);
}

function scheduleCapabilities(env: Env): AdminAIScheduleCapabilities {
  return {
    approvedEmailWorkflow: env.ADMIN_AI_EMAIL_WORKFLOW_APPROVED === "true",
    secureScheduledJobs: env.ADMIN_AI_SCHEDULED_JOBS_ENABLED === "true"
  };
}
