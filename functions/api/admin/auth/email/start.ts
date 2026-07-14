import type { D1Database } from "@cloudflare/workers-types";
import {
  adminJson,
  GENERIC_ADMIN_AUTH_ERROR,
  getAdminRoleForEmail,
  isAdminDemoAuthEnabled,
  isValidAdminEmail,
  isValidOtp,
  normalizeAdminEmail,
  readJsonBody
} from "../../../../../lib/server/admin-auth";
import { startAdminEmailOtp } from "../../../../../lib/server/admin-email-otp";
import { checkAdminRateLimit } from "../../../../../lib/server/admin-rate-limit";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_EMAIL_OTP_ENABLED?: string;
  ADMIN_EMAIL_OTP_FROM?: string;
  ADMIN_EMAIL_OTP_FROM_NAME?: string;
  ADMIN_EMAIL_OTP_SECRET?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
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
      if (await canUseLocalDemoEmailOtp({ email, env, request })) {
        return adminJson({
          message: GENERIC_SENT_MESSAGE,
          nextStep: "otp",
          ok: true
        });
      }

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

async function canUseLocalDemoEmailOtp({
  email,
  env,
  request
}: {
  email: string;
  env: Env;
  request: Request;
}) {
  const localDevOtp = env.ADMIN_DEV_OTP?.trim() || "";

  return (
    isAdminDemoAuthEnabled(env) &&
    isLocalDemoRequest(request) &&
    isValidOtp(localDevOtp) &&
    Boolean(await getAdminRoleForEmail(email, env))
  );
}

function isLocalDemoRequest(request: Request) {
  const urlHostname = new URL(request.url).hostname.toLowerCase();
  const headerHostname = getHostHeaderHostname(request.headers.get("host"));

  return isLocalHostname(urlHostname) && isLocalHostname(headerHostname);
}

function getHostHeaderHostname(hostHeader: string | null) {
  const normalized = (hostHeader || "").trim().toLowerCase();
  if (normalized.startsWith("[")) {
    const closingBracketIndex = normalized.indexOf("]");

    return closingBracketIndex >= 0 ? normalized.slice(0, closingBracketIndex + 1) : normalized;
  }

  return normalized.split(":")[0] || "";
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}
