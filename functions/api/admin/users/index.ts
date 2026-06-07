import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireOwner } from "../../../../lib/server/admin-auth";
import {
  createAdminInvite,
  listAdminUserManagement,
  resendAdminInvite,
  revokeAdminInvite,
  setManagedAdminStatus,
  updateManagedAdmin
} from "../../../../lib/server/admin-user-management";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_DB?: D1Database;
  ADMIN_EMAIL_OTP_FROM?: string;
  ADMIN_EMAIL_OTP_FROM_NAME?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
  ROOT_OWNER_EMAIL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type AdminUsersActionBody = {
  action?: unknown;
  email?: unknown;
  invite?: unknown;
  inviteId?: unknown;
  user?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET") {
    const admin = await requireOwner(request, env);
    if (!admin.ok) return admin.response;

    try {
      return adminJson(
        await listAdminUserManagement({
          currentAdminEmail: admin.admin.email,
          env
        })
      );
    } catch {
      return adminJson({ ok: false, error: "Admin user database is not configured." }, 503);
    }
  }

  if (request.method !== "POST" && request.method !== "PATCH") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, {
      allow: "GET, POST, PATCH"
    });
  }

  const admin = await requireOwner(request, env, { requireCsrf: true });
  if (!admin.ok) return admin.response;

  const body = await readJsonBody<AdminUsersActionBody>(request);
  const action = typeof body?.action === "string" ? body.action.trim() : "";

  try {
    if (request.method === "POST" && action === "create_invite") {
      const result = await createAdminInvite({
        actorEmail: admin.admin.email,
        env,
        input: isRecord(body?.invite) ? body.invite : {},
        request
      });
      return adminJson(result, result.ok ? 200 : 400);
    }

    if (request.method === "POST" && action === "resend_invite") {
      const inviteId = typeof body?.inviteId === "string" ? body.inviteId : "";
      const result = await resendAdminInvite({
        actorEmail: admin.admin.email,
        env,
        inviteId,
        request
      });
      return adminJson(result, result.ok ? 200 : 400);
    }

    if (request.method === "PATCH" && action === "revoke_invite") {
      const inviteId = typeof body?.inviteId === "string" ? body.inviteId : "";
      const result = await revokeAdminInvite({
        actorEmail: admin.admin.email,
        env,
        inviteId,
        request
      });
      return adminJson(result, result.ok ? 200 : 400);
    }

    if (request.method === "PATCH" && action === "update_admin") {
      const result = await updateManagedAdmin({
        actorEmail: admin.admin.email,
        env,
        input: isRecord(body?.user) ? body.user : {},
        request
      });
      return adminJson(result, result.ok ? 200 : 400);
    }

    if (
      request.method === "PATCH" &&
      (action === "suspend_admin" || action === "reactivate_admin" || action === "revoke_admin")
    ) {
      const email = typeof body?.email === "string" ? body.email : "";
      const result = await setManagedAdminStatus({
        action:
          action === "reactivate_admin" ? "reactivate" : action === "suspend_admin" ? "suspend" : "revoke",
        actorEmail: admin.admin.email,
        email,
        env,
        request
      });
      return adminJson(result, result.ok ? 200 : 400);
    }
  } catch {
    return adminJson({ ok: false, error: "Admin user action failed safely." }, 503);
  }

  return adminJson({ ok: false, error: "Unsupported admin user action." }, 400);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
