import type { D1Database } from "@cloudflare/workers-types";
import {
  adminJson,
  GENERIC_ADMIN_AUTH_ERROR,
  isValidAdminEmail,
  normalizeAdminEmail,
  readJsonBody
} from "../../../../../lib/server/admin-auth";
import { startAdminEmailOtp } from "../../../../../lib/server/admin-email-otp";
import { checkAdminRateLimit } from "../../../../../lib/server/admin-rate-limit";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_DB?: D1Database;
  ADMIN_EMAIL_OTP_ENABLED?: string;
  ADMIN_EMAIL_OTP_FROM?: string;
  ADMIN_EMAIL_OTP_FROM_NAME?: string;
  ADMIN_EMAIL_OTP_SECRET?: string;
  ADMIN_OTP_MAX_ATTEMPTS?: string;
  ADMIN_OTP_TTL_SECONDS?: string;
  ADMIN_SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type StartEmailOtpBody = {
  email?: unknown;
};

const GENERIC_SENT_MESSAGE = "If this email is authorized, a one-time code will be sent.";

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody<StartEmailOtpBody>(request);
  const email = typeof body?.email === "string" ? normalizeAdminEmail(body.email) : "";

  if (!isValidAdminEmail(email)) {
    return adminJson({ ok: false, error: "Enter a valid admin email." }, 400);
  }

  const rateLimit = await checkAdminRateLimit({
    action: "admin_email_otp_start",
    email,
    env,
    request
  });
  if (!rateLimit.allowed) {
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 429, {
      "retry-after": String(rateLimit.retryAfterSeconds)
    });
  }

  try {
    const result = await startAdminEmailOtp({ email, env, request });
    if (!result.ok && result.reason === "rate_limited") {
      return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 429);
    }

    if (!result.ok && result.reason === "not_configured") {
      return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 503);
    }

    return adminJson({
      message: GENERIC_SENT_MESSAGE,
      nextStep: "otp",
      ok: true
    });
  } catch {
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 502);
  }
}
