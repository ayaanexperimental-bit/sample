import type { D1Database } from "@cloudflare/workers-types";
import {
  clearAdminGoogleStateCookie,
  createAdminSessionCookie,
  GENERIC_ADMIN_AUTH_ERROR,
  getAdminRoleForEmail,
  isRequestSecure,
  normalizeAdminEmail,
  verifyAdminGoogleStateFromRequest
} from "../../../../../lib/server/admin-auth";
import { recordAdminAuditEvent } from "../../../../../lib/server/admin-audit";
import { recordAdminLoginAudit } from "../../../../../lib/server/admin-rbac";
import { checkAdminRateLimit } from "../../../../../lib/server/admin-rate-limit";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_DB?: D1Database;
  ADMIN_GOOGLE_CLIENT_ID?: string;
  ADMIN_GOOGLE_CLIENT_SECRET?: string;
  ADMIN_GOOGLE_REDIRECT_URI?: string;
  ADMIN_OAUTH_STATE_SECRET?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  ROOT_OWNER_EMAIL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type GoogleTokenResponse = {
  error?: string;
  id_token?: string;
};

type GoogleTokenInfoResponse = {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  exp?: string;
  iss?: string;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        allow: "GET",
        "cache-control": "no-store"
      }
    });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    await recordAdminAuditEvent({
      env,
      reason: "google_cancelled",
      request,
      type: "blocked_attempt"
    });
    return redirectWithClearedState("/admin/login?google=cancelled", request);
  }

  const config = getGoogleConfig(request, env);
  if (!config) {
    await recordAdminAuditEvent({
      env,
      reason: "google_oauth_not_configured",
      request,
      type: "blocked_attempt"
    });
    return redirectWithClearedState("/admin/login?google=not_configured", request);
  }

  if (!code || !state) {
    await recordAdminAuditEvent({
      env,
      reason: "google_callback_missing_code_or_state",
      request,
      type: "blocked_attempt"
    });
    return redirectWithClearedState("/admin/login?google=unauthorized", request);
  }

  const verifiedState = await verifyAdminGoogleStateFromRequest({ env, request, state });
  if (!verifiedState) {
    await recordAdminAuditEvent({
      env,
      reason: "google_state_invalid",
      request,
      type: "blocked_attempt"
    });
    return redirectWithClearedState("/admin/login?google=unauthorized", request);
  }

  const rateLimit = await checkAdminRateLimit({
    action: "admin_google_callback",
    env,
    request
  });
  if (!rateLimit.allowed) {
    return redirectWithClearedState("/admin/login?google=rate_limited", request);
  }

  try {
    const token = await exchangeCodeForToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri: config.redirectUri
    });

    if (!token.id_token) {
      throw new Error(token.error || "missing_id_token");
    }

    const tokenInfo = await verifyGoogleIdToken(token.id_token);
    const email = normalizeAdminEmail(tokenInfo.email || "");
    const emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === "true";
    const issuerValid =
      tokenInfo.iss === "accounts.google.com" || tokenInfo.iss === "https://accounts.google.com";
    const audienceValid = tokenInfo.aud === config.clientId;

    if (
      !email ||
      !emailVerified ||
      !issuerValid ||
      !audienceValid ||
      !(await getAdminRoleForEmail(email, env))
    ) {
      await recordAdminAuditEvent({
        email,
        env,
        reason: "google_email_not_allowed_or_unverified",
        request,
        type: "blocked_attempt"
      });
      await recordAdminLoginAudit({
        email,
        env,
        loginMethod: "google",
        loginStatus: "unauthorized",
        request
      });
      return redirectWithClearedState("/admin/login?google=unauthorized", request);
    }

    const sessionCookie = await createAdminSessionCookie({
      email,
      env,
      rememberDevice: false,
      secure: isRequestSecure(request)
    });
    if (!sessionCookie) {
      return redirectWithClearedState("/admin/login?google=not_configured", request);
    }

    await recordAdminAuditEvent({ email, env, request, type: "otp_verified" });
    await recordAdminLoginAudit({
      email,
      env,
      loginMethod: "google",
      loginStatus: "success",
      request
    });

    return redirectWithCookies(verifiedState.redirectPath || "/admin", request, [
      sessionCookie,
      clearAdminGoogleStateCookie({ secure: isRequestSecure(request) })
    ]);
  } catch {
    await recordAdminAuditEvent({
      env,
      reason: "google_callback_failed",
      request,
      type: "blocked_attempt"
    });
    await recordAdminLoginAudit({
      email: "",
      env,
      loginMethod: "google",
      loginStatus: "failed",
      request
    });
    return redirectWithClearedState(
      `/admin/login?google=failed&message=${encodeURIComponent(GENERIC_ADMIN_AUTH_ERROR)}`,
      request
    );
  }
}

async function exchangeCodeForToken({
  clientId,
  clientSecret,
  code,
  redirectUri
}: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("code", code);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", redirectUri);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  return (await response.json()) as GoogleTokenResponse;
}

async function verifyGoogleIdToken(idToken: string) {
  const tokenInfoUrl = new URL(GOOGLE_TOKENINFO_URL);
  tokenInfoUrl.searchParams.set("id_token", idToken);

  const response = await fetch(tokenInfoUrl.toString(), {
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error("google_tokeninfo_failed");
  }

  return (await response.json()) as GoogleTokenInfoResponse;
}

function getGoogleConfig(request: Request, env: Env) {
  const clientId = env.ADMIN_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.ADMIN_GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    env.ADMIN_GOOGLE_REDIRECT_URI?.trim() ||
    new URL("/api/admin/auth/google/callback", request.url).toString();

  if (!clientId || !clientSecret || !redirectUri || !env.ADMIN_SESSION_SECRET) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

function redirectWithClearedState(path: string, request: Request) {
  return redirectWithCookies(path, request, [
    clearAdminGoogleStateCookie({ secure: isRequestSecure(request) })
  ]);
}

function redirectWithCookies(path: string, request: Request, cookies: string[]) {
  const headers = new Headers({
    "cache-control": "no-store",
    location: new URL(path, request.url).toString()
  });

  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }

  return new Response(null, {
    status: 302,
    headers
  });
}
