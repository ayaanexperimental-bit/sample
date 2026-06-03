import type { D1Database } from "@cloudflare/workers-types";
import {
  adminJson,
  createAdminCsrfToken,
  createAdminSessionCookie,
  GENERIC_ADMIN_AUTH_ERROR,
  isAdminDemoAuthEnabled,
  isAdminEmailAllowed,
  isRequestSecure,
  isValidAdminEmail,
  isValidOtp,
  normalizeAdminEmail,
  readJsonBody
} from "../../../../lib/server/admin-auth";
import { recordAdminAuditEvent } from "../../../../lib/server/admin-audit";
import { checkAdminRateLimit } from "../../../../lib/server/admin-rate-limit";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_SESSION_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type VerifyOtpBody = {
  email?: unknown;
  otp?: unknown;
  rememberDevice?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody<VerifyOtpBody>(request);
  const email = typeof body?.email === "string" ? normalizeAdminEmail(body.email) : "";
  const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
  const rememberDevice = body?.rememberDevice === true;

  if (!isValidAdminEmail(email) || !isValidOtp(otp)) {
    await recordAdminAuditEvent({
      email,
      env,
      reason: "invalid_payload",
      request,
      type: "otp_failed"
    });
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 400);
  }

  const rateLimit = await checkAdminRateLimit({
    action: "admin_verify_otp",
    email,
    env,
    request
  });
  if (!rateLimit.allowed) {
    await recordAdminAuditEvent({
      email,
      env,
      reason: "rate_limited",
      request,
      type: "otp_failed"
    });
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 429, {
      "retry-after": String(rateLimit.retryAfterSeconds)
    });
  }

  // TODO: Connect real OTP/MFA provider with expiry, attempt limits, rate limiting, and audit logs.
  const localDevOtp = env.ADMIN_DEV_OTP?.trim();
  const localDevAllowsSession =
    isAdminDemoAuthEnabled(env) &&
    isLocalDemoRequest(request) &&
    typeof localDevOtp === "string" &&
    isValidOtp(localDevOtp) &&
    isAdminEmailAllowed(email, env) &&
    otp === localDevOtp;

  if (!localDevAllowsSession) {
    await recordAdminAuditEvent({
      email,
      env,
      reason: "unauthorized_or_bad_otp",
      request,
      type: "otp_failed"
    });
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionTtlSeconds = rememberDevice ? 14 * 24 * 60 * 60 : 8 * 60 * 60;
  const sessionCookie = await createAdminSessionCookie({
    email,
    env,
    nowSeconds: now,
    rememberDevice,
    secure: isRequestSecure(request)
  });
  if (!sessionCookie) {
    await recordAdminAuditEvent({
      email,
      env,
      reason: "session_secret_missing",
      request,
      type: "otp_failed"
    });
    return adminJson({ ok: false, error: GENERIC_ADMIN_AUTH_ERROR }, 503);
  }

  const csrfToken = await createAdminCsrfToken({
    env,
    session: {
      email,
      expiresAt: now + sessionTtlSeconds,
      issuedAt: now,
      otpVerified: true,
      source: "admin_auth"
    }
  });

  await recordAdminAuditEvent({ email, env, request, type: "otp_verified" });

  return adminJson(
    {
      admin: { email },
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
