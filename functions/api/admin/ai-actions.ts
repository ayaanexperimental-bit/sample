import type { D1Database } from "@cloudflare/workers-types";
import { getAdminAICommand } from "../../../lib/admin-ai/adminAIRegistry";
import {
  adminAuthorizationResponse,
  adminJson,
  canAuthenticatedAdminPerform,
  readJsonBody,
  requireAdmin,
} from "../../../lib/server/admin-auth";
import { recordAdminAuditEvent } from "../../../lib/server/admin-audit";

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

type AdminAIActionBody = {
  actionId?: unknown;
  actionType?: unknown;
  confirmationResult?: unknown;
  phase?: unknown;
  recordIds?: unknown;
  sectionId?: unknown;
};

const AUDIT_PHASES = new Set(["completed", "confirmed", "denied", "failed", "requested"]);
const CONFIRMATION_RESULTS = new Set(["accepted", "declined", "not-required"]);

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const admin = await requireAdmin(request, env, { requireCsrf: true });
  if (!admin.ok) return admin.response;

  const body = await readJsonBody<AdminAIActionBody>(request);
  const actionId = parseText(body?.actionId, 120);
  const sectionId = parseText(body?.sectionId, 80);
  const phase = parseText(body?.phase, 32);
  const confirmationResult = parseText(body?.confirmationResult, 32) || "not-required";
  const recordIds = parseIdentifiers(body?.recordIds);
  const command = getAdminAICommand(actionId);

  if (
    !command ||
    command.sectionId !== sectionId ||
    command.type !== body?.actionType ||
    !AUDIT_PHASES.has(phase) ||
    !CONFIRMATION_RESULTS.has(confirmationResult)
  ) {
    return adminJson({ ok: false, error: "Invalid registered Copilot action." }, 400);
  }
  const requestId = `admin-ai-${crypto.randomUUID()}`;

  if (command.ownerOnly && !admin.admin.isOwner) {
    return adminAuthorizationResponse();
  }
  if (
    !admin.admin.isOwner &&
    !(command.requiredPermissions || []).every((permission) =>
      canAuthenticatedAdminPerform(admin.admin, permission)
    )
  ) {
    return adminAuthorizationResponse();
  }

  const persisted = await recordAdminAuditEvent({
    email: admin.admin.email,
    env,
    reason: [
      `copilot:${command.id}`,
      `section:${command.sectionId}`,
      `type:${command.type}`,
      `phase:${phase}`,
      `confirmation:${confirmationResult}`,
      `records:${recordIds.join(",") || "none"}`,
      `request:${requestId}`,
    ].join("|"),
    request,
    type: "ai_action",
  });

  return adminJson({
    audit: persisted ? "d1_table" : env.ADMIN_DB ? "unavailable" : "not_configured",
    ok: true,
    requestId,
  });
}

function parseText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, maxLength)
    : "";
}

function parseIdentifiers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => /^[a-zA-Z0-9._:-]{1,80}$/.test(item))
    )
  ).slice(0, 12);
}
