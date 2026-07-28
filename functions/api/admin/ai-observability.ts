import type { D1Database } from "@cloudflare/workers-types";
import {
  adminAuthorizationResponse,
  adminJson,
  readJsonBody,
  requireAdmin,
  requireOwner
} from "../../../lib/server/admin-auth";
import {
  getAdminAIObservabilityDashboard,
  recordAdminAIObservation,
  recordAdminAIObservationFeedback,
  reviewAdminAICorrection,
  submitAdminAICorrection,
  type AdminAICorrectionInput,
  type AdminAIOperationFailure,
  type AdminAIObservationInput
} from "../../../lib/server/admin-ai-observability";

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

type AdminAIObservabilityBody = {
  correction?: AdminAICorrectionInput;
  correctionId?: unknown;
  decision?: unknown;
  feedbackKind?: unknown;
  mode?: unknown;
  observation?: AdminAIObservationInput;
  reason?: unknown;
  requestId?: unknown;
};

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "GET" && request.method !== "POST") {
    return adminJson({ error: "Method not allowed.", ok: false }, 405, {
      allow: "GET, POST"
    });
  }

  if (request.method === "GET") {
    const owner = await requireOwner(request, env);
    if (!owner.ok) return owner.response;
    if (!env.ADMIN_DB) return storageUnavailable();
    try {
      const url = new URL(request.url);
      const dashboard = await getAdminAIObservabilityDashboard({
        db: env.ADMIN_DB,
        range: {
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to")
        },
        viewerIsOwner: owner.admin.isOwner
      });
      return "ok" in dashboard && !dashboard.ok
        ? operationFailure(dashboard)
        : adminJson({ dashboard, ok: true });
    } catch {
      return storageUnavailable();
    }
  }

  const admin = await requireAdmin(request, env, { requireCsrf: true });
  if (!admin.ok) return admin.response;
  if (!env.ADMIN_DB) return storageUnavailable();
  const body = await readJsonBody<AdminAIObservabilityBody>(request);
  const mode = parseIdentifier(body?.mode, 40);

  try {
    if (mode === "observe") {
      const result = await recordAdminAIObservation({
        adminEmail: admin.admin.email,
        db: env.ADMIN_DB,
        observation: body?.observation || {}
      });
      return result.ok
        ? adminJson({ observation: result.observation, ok: true }, result.status)
        : operationFailure(result);
    }

    if (mode === "feedback") {
      const result = await recordAdminAIObservationFeedback({
        adminEmail: admin.admin.email,
        db: env.ADMIN_DB,
        feedbackKind: body?.feedbackKind,
        requestId: body?.requestId
      });
      return result.ok
        ? adminJson({ feedback: result.feedback, ok: true }, result.status)
        : operationFailure(result);
    }

    if (mode === "correct") {
      const result = await submitAdminAICorrection({
        adminEmail: admin.admin.email,
        correction: body?.correction || {},
        db: env.ADMIN_DB
      });
      return result.ok
        ? adminJson({ correction: result.correction, ok: true }, result.status)
        : operationFailure(result);
    }

    if (mode === "review-correction") {
      if (!admin.admin.isOwner) return adminAuthorizationResponse();
      const result = await reviewAdminAICorrection({
        correctionId: parseIdentifier(body?.correctionId, 120),
        db: env.ADMIN_DB,
        decision: body?.decision,
        reason: body?.reason,
        reviewerEmail: admin.admin.email,
        reviewerIsOwner: admin.admin.isOwner
      });
      return result.ok
        ? adminJson(
            {
              correction: result.correction,
              improvement: result.improvement,
              ok: true
            },
            result.status
          )
        : operationFailure(result);
    }

    return adminJson({ error: "Invalid observability operation.", ok: false }, 400);
  } catch {
    return storageUnavailable();
  }
}

function operationFailure(result: AdminAIOperationFailure) {
  return adminJson({ code: result.code, error: result.message, ok: false }, result.status);
}

function storageUnavailable() {
  return adminJson(
    { error: "Durable Admin AI observability storage is unavailable.", ok: false },
    503
  );
}

function parseIdentifier(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(normalized) ? normalized.slice(0, maxLength) : "";
}
