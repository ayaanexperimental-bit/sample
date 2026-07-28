import type { D1Database } from "@cloudflare/workers-types";
import { adminAIRegistry, getAdminAICommand } from "../../../lib/admin-ai/adminAIRegistry";
import {
  adminAuthorizationResponse,
  adminJson,
  canAuthenticatedAdminPerform,
  readJsonBody,
  requireAdmin,
  type AuthenticatedAdmin
} from "../../../lib/server/admin-auth";
import { recordAdminAuditEvent } from "../../../lib/server/admin-audit";
import {
  executeAdminAIRegisteredAction,
  getAdminAIActionReceipt,
  getAdminAIServerActionCommand,
  hasAdminAIExecutableActionContract,
  rollbackAdminAIRegisteredAction,
  type AdminAIServerActionCommand
} from "../../../lib/server/admin-ai-actions";
import type { AdminAICommand } from "../../../lib/admin-ai/adminAIRegistry";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  NEXT_PUBLIC_SUPPORT_EMAIL?: string;
  NEXT_PUBLIC_SUPPORT_MESSAGE?: string;
  NEXT_PUBLIC_SUPPORT_NAME?: string;
  NEXT_PUBLIC_SUPPORT_PHONE?: string;
  NEXT_PUBLIC_SUPPORT_WHATSAPP?: string;
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
  currentValue?: unknown;
  mode?: unknown;
  module?: unknown;
  outcome?: unknown;
  phase?: unknown;
  receiptId?: unknown;
  referenceId?: unknown;
  recordIds?: unknown;
  sectionId?: unknown;
  proposedValue?: unknown;
  settingKey?: unknown;
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
  const mode = parseText(body?.mode, 24);
  if (mode === "attest-read") {
    const actionId = parseText(body?.actionId, 120);
    const moduleId = parseText(body?.module, 80);
    const outcome = parseText(body?.outcome, 24);
    const command = actionId ? getAdminAICommand(actionId) : undefined;
    const commandMatchesModule =
      !command ||
      (moduleId === "global"
        ? command.id.startsWith("global.")
        : command.sectionId === moduleId);
    if (
      (moduleId !== "global" &&
        !Object.prototype.hasOwnProperty.call(adminAIRegistry, moduleId)) ||
      !["blocked", "failed", "success"].includes(outcome) ||
      (body?.actionId !== undefined &&
        (!actionId ||
          !command ||
          !["read", "suggest"].includes(command.type) ||
          !commandMatchesModule))
    ) {
      return adminJson({ ok: false, error: "Invalid bounded Copilot read attestation." }, 400);
    }
    if (
      command &&
      ((command.ownerOnly && !admin.admin.isOwner) ||
        (command.requiredPermissions || []).some(
          (permission) => !canAuthenticatedAdminPerform(admin.admin, permission)
        ))
    ) {
      return adminAuthorizationResponse();
    }
    const requestId = `admin-ai-${crypto.randomUUID()}`;
    const phase = outcome === "success" ? "completed" : outcome === "blocked" ? "denied" : "failed";
    const persisted = await recordAdminAuditEvent({
      email: admin.admin.email,
      env,
      reason: [
        `copilot:${command?.id || "natural-language"}`,
        `section:${moduleId}`,
        "type:read",
        `phase:${phase}`,
        `request:${requestId}`,
        "confirmation:not-required",
        "records:none"
      ].join("|"),
      request,
      type: "ai_action"
    });
    const audit = persisted ? "d1_table" : env.ADMIN_DB ? "unavailable" : "not_configured";
    return persisted
      ? adminJson({ audit, ok: true, requestId })
      : adminJson(
          {
            audit,
            error: "Durable Admin AI read attestation storage is unavailable.",
            ok: false,
            requestId
          },
          503
        );
  }
  if (mode === "execute") {
    const actionId = parseText(body?.actionId, 120);
    const sectionId = parseText(body?.sectionId, 80);
    const confirmationResult = parseText(body?.confirmationResult, 32);
    const referenceId = parseIdentifier(body?.referenceId, 160);
    const settingKey = parseText(body?.settingKey, 80);
    const command = getAdminAIServerActionCommand(actionId);
    if (
      !command ||
      command.kind !== "registered-action" ||
      !hasAdminAIExecutableActionContract(command) ||
      command.sectionId !== sectionId ||
      confirmationResult !== "accepted" ||
      (command.handlerId === "error-report-status-reviewing" && !referenceId) ||
      (String(command.handlerId) === "shop-paid-order-publish-retry" && !referenceId) ||
      (command.handlerId === "settings-proactive-suggestions-update" &&
        (!settingKey ||
          typeof body?.currentValue !== "boolean" ||
          typeof body?.proposedValue !== "boolean")) ||
      (command.handlerId === "settings-support-defaults-update" &&
        (settingKey !== "supportDefaults" ||
          typeof body?.currentValue !== "string" ||
          typeof body?.proposedValue !== "string" ||
          body.currentValue.length > 2_000 ||
          body.proposedValue.length > 2_000))
    ) {
      return adminJson({ ok: false, error: "Invalid registered Copilot action." }, 400);
    }
    const authorization = authorizeCommand(command, admin.admin);
    if (authorization) return authorization;
    if (!env.ADMIN_DB) {
      return adminJson(
        {
          ok: false,
          response: {
            body: "Durable audit storage is unavailable. No data changed.",
            items: [],
            state: "action-failed",
            title: command.failureMessage || "Registered action failed"
          }
        },
        503
      );
    }
    const result = await executeAdminAIRegisteredAction({
      adminEmail: admin.admin.email,
      command,
      currentValue: body?.currentValue,
      db: env.ADMIN_DB,
      proposedValue: body?.proposedValue,
      referenceId,
      settingKey,
      supportDefaultsEnv: env
    });
    return adminJson({ ok: result.ok, response: result.response }, result.status);
  }
  if (mode === "rollback") {
    const receiptId = parseIdentifier(body?.receiptId, 120);
    if (!receiptId) return adminJson({ ok: false, error: "Invalid rollback receipt." }, 400);
    if (!env.ADMIN_DB) {
      return adminJson(
        {
          ok: false,
          response: {
            body: "Durable rollback storage is unavailable. No data changed.",
            items: [],
            state: "action-failed",
            title: "Rollback failed"
          }
        },
        503
      );
    }
    const receipt = await getAdminAIActionReceipt(env.ADMIN_DB, receiptId);
    const command = receipt ? getAdminAIServerActionCommand(receipt.actionId) : null;
    if (
      !receipt ||
      !command ||
      command.kind !== "registered-action" ||
      !hasAdminAIExecutableActionContract(command)
    ) {
      return adminJson(
        {
          ok: false,
          response: {
            body: "The rollback receipt was not found.",
            items: [],
            state: "action-failed",
            title: "Rollback failed"
          }
        },
        404
      );
    }
    const authorization = authorizeCommand(command, admin.admin);
    if (authorization) return authorization;
    const result = await rollbackAdminAIRegisteredAction({
      adminEmail: admin.admin.email,
      db: env.ADMIN_DB,
      receiptId
    });
    return adminJson({ ok: result.ok, response: result.response }, result.status);
  }
  if (mode) return adminJson({ ok: false, error: "Invalid Admin AI action mode." }, 400);

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
      `request:${requestId}`
    ].join("|"),
    request,
    type: "ai_action"
  });

  const audit = persisted ? "d1_table" : env.ADMIN_DB ? "unavailable" : "not_configured";
  if (!persisted) {
    return adminJson(
      {
        audit,
        error: "Durable Admin AI audit storage is unavailable.",
        ok: false,
        requestId
      },
      503
    );
  }

  return adminJson({ audit, ok: true, requestId });
}

function authorizeCommand(
  command: AdminAICommand | AdminAIServerActionCommand,
  admin: AuthenticatedAdmin
) {
  if (command.ownerOnly && !admin.isOwner) return adminAuthorizationResponse();
  if (
    !admin.isOwner &&
    !(command.requiredPermissions || []).every((permission) =>
      canAuthenticatedAdminPerform(admin, permission)
    )
  ) {
    return adminAuthorizationResponse();
  }
  return null;
}

function parseText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, maxLength) : "";
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

function parseIdentifier(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized.length <= maxLength && /^[a-zA-Z0-9._:-]+$/.test(normalized) ? normalized : "";
}
