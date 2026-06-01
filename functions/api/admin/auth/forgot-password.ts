import type { D1Database } from "@cloudflare/workers-types";
import {
  adminJson,
  GENERIC_ADMIN_AUTH_ERROR,
  isValidAdminEmail,
  normalizeAdminEmail,
  readJsonBody
} from "../../../../lib/server/admin-auth";
import { recordAdminAuditEvent } from "../../../../lib/server/admin-audit";
import { checkAdminRateLimit } from "../../../../lib/server/admin-rate-limit";

type Env = {
  ADMIN_DB?: D1Database;
  ADMIN_SESSION_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type ForgotPasswordBody = {
  email?: unknown;
};

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody<ForgotPasswordBody>(request);
  const email = typeof body?.email === "string" ? normalizeAdminEmail(body.email) : "";

  if (!isValidAdminEmail(email)) {
    return adminJson({ ok: false, error: "Enter a valid admin email." }, 400);
  }

  const rateLimit = await checkAdminRateLimit({
    action: "admin_forgot_password",
    email,
    env,
    request
  });
  if (!rateLimit.allowed) {
    await recordAdminAuditEvent({
      email,
      env,
      reason: "forgot_password_rate_limited",
      request,
      type: "forgot_password_requested"
    });
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 429, {
      "retry-after": String(rateLimit.retryAfterSeconds)
    });
  }

  await recordAdminAuditEvent({ email, env, request, type: "forgot_password_requested" });

  // TODO: Connect secure one-time reset token flow with expiry, rate limiting, audit logs, and session invalidation.
  return adminJson(
    {
      error: GENERIC_ADMIN_AUTH_ERROR,
      ok: false
    },
    501
  );
}
