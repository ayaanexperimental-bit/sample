import type { D1Database } from "@cloudflare/workers-types";
import {
  adminJson,
  GENERIC_ADMIN_AUTH_ERROR,
  normalizeAdminEmail,
  readJsonBody
} from "../../../../lib/server/admin-auth";
import { recordAdminAuditEvent } from "../../../../lib/server/admin-audit";
import { checkAdminRateLimit } from "../../../../lib/server/admin-rate-limit";

type PagesContext = {
  env: {
    ADMIN_DB?: D1Database;
    ADMIN_SESSION_SECRET?: string;
  };
  request: Request;
};

type LoginBody = {
  email?: unknown;
};

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody<LoginBody>(request);
  const email = typeof body?.email === "string" ? normalizeAdminEmail(body.email) : "";
  const rateLimit = await checkAdminRateLimit({
    action: "admin_login_password",
    email,
    env,
    request
  });
  if (!rateLimit.allowed) {
    await recordAdminAuditEvent({
      email,
      env,
      reason: "password_login_rate_limited",
      request,
      type: "login_failed"
    });
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 429, {
      "retry-after": String(rateLimit.retryAfterSeconds)
    });
  }

  await recordAdminAuditEvent({
    email,
    env,
    reason: "password_login_disabled",
    request,
    type: "login_failed"
  });

  return adminJson(
    {
      error: GENERIC_ADMIN_AUTH_ERROR,
      ok: false
    },
    501
  );
}
