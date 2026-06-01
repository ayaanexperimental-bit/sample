import type { D1Database } from "@cloudflare/workers-types";
import {
  adminJson,
  createAdminCsrfToken,
  GENERIC_ADMIN_AUTH_ERROR,
  isValidAdminEmail,
  isValidOtp,
  normalizeAdminEmail,
  readJsonBody
} from "../../../../../lib/server/admin-auth";
import { verifyAdminEmailOtp } from "../../../../../lib/server/admin-email-otp";
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

type VerifyEmailOtpBody = {
  email?: unknown;
  otp?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody<VerifyEmailOtpBody>(request);
  const email = typeof body?.email === "string" ? normalizeAdminEmail(body.email) : "";
  const otp = typeof body?.otp === "string" ? body.otp.trim() : "";

  if (!isValidAdminEmail(email) || !isValidOtp(otp)) {
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 400);
  }

  const rateLimit = await checkAdminRateLimit({
    action: "admin_email_otp_verify",
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
    const result = await verifyAdminEmailOtp({ email, env, otp, request });
    if (!result.ok || !result.sessionCookie) {
      const status = result.reason === "not_configured" ? 503 : 401;
      return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, status);
    }
    const csrfToken = await createAdminCsrfToken({ env, session: result.session });

    return adminJson(
      {
        admin: { email: result.email },
        authenticated: true,
        csrfToken,
        ok: true
      },
      200,
      { "set-cookie": result.sessionCookie }
    );
  } catch {
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 401);
  }
}
