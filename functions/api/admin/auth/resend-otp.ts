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

type ResendOtpBody = {
  email?: unknown;
};

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody<ResendOtpBody>(request);
  const email = typeof body?.email === "string" ? normalizeAdminEmail(body.email) : "";

  if (isValidAdminEmail(email)) {
    const rateLimit = await checkAdminRateLimit({
      action: "admin_resend_otp",
      email,
      env,
      request
    });
    if (!rateLimit.allowed) {
      await recordAdminAuditEvent({
        email,
        env,
        reason: "resend_otp_rate_limited",
        request,
        type: "otp_requested"
      });
      return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 429, {
        "retry-after": String(rateLimit.retryAfterSeconds)
      });
    }

    await recordAdminAuditEvent({ email, env, request, type: "otp_requested" });
  }

  // TODO: Connect real OTP/MFA provider delivery after admin identity provider is finalized.
  return adminJson(
    {
      error: GENERIC_ADMIN_AUTH_ERROR,
      ok: false
    },
    501
  );
}
