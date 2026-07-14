import type { D1Database } from "@cloudflare/workers-types";
import {
  adminJson,
  createAdminCsrfToken,
  createAdminSessionCookie,
  GENERIC_ADMIN_AUTH_ERROR,
  getAdminRoleForEmail,
  isAdminDemoAuthEnabled,
  isRequestSecure,
  isValidAdminEmail,
  isValidOtp,
  normalizeAdminEmail,
  readJsonBody
} from "../../../../../lib/server/admin-auth";
import { verifyAdminEmailOtp } from "../../../../../lib/server/admin-email-otp";
import { getAdminAccessProfile } from "../../../../../lib/server/admin-rbac";
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
  ROOT_OWNER_EMAIL?: string;
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
      if (result.reason === "not_configured") {
        const localDemoResponse = await verifyLocalDemoEmailOtp({ email, env, otp, request });
        if (localDemoResponse) return localDemoResponse;
      }

      const status = result.reason === "not_configured" ? 503 : 401;
      return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, status);
    }
    const csrfToken = await createAdminCsrfToken({ env, session: result.session });
    const profile = await getAdminAccessProfile(result.email, env);

    return adminJson(
      {
        admin: profile || { email: result.email },
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

async function verifyLocalDemoEmailOtp({
  email,
  env,
  otp,
  request
}: {
  email: string;
  env: Env;
  otp: string;
  request: Request;
}) {
  const localDevOtp = env.ADMIN_DEV_OTP?.trim() || "";
  const localDevAllowsSession =
    isAdminDemoAuthEnabled(env) &&
    isLocalDemoRequest(request) &&
    isValidOtp(localDevOtp) &&
    otp === localDevOtp &&
    Boolean(await getAdminRoleForEmail(email, env));

  if (!localDevAllowsSession) return null;

  const now = Math.floor(Date.now() / 1000);
  const session = {
    email,
    expiresAt: now + 8 * 60 * 60,
    issuedAt: now,
    otpVerified: true as const,
    source: "admin_auth" as const
  };
  const sessionCookie = await createAdminSessionCookie({
    email,
    env,
    nowSeconds: now,
    rememberDevice: false,
    secure: isRequestSecure(request)
  });
  if (!sessionCookie) return null;

  const csrfToken = await createAdminCsrfToken({ env, session });
  const profile = await getAdminAccessProfile(email, env);

  return adminJson(
    {
      admin: profile || { email },
      authenticated: true,
      csrfToken,
      ok: true
    },
    200,
    { "set-cookie": sessionCookie }
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
