import type { D1Database } from "@cloudflare/workers-types";
import {
  createAdminGoogleStateCookie,
  isRequestSecure
} from "../../../../../lib/server/admin-auth";
import { recordAdminAuditEvent } from "../../../../../lib/server/admin-audit";
import { checkAdminRateLimit } from "../../../../../lib/server/admin-rate-limit";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_DB?: D1Database;
  ADMIN_GOOGLE_CLIENT_ID?: string;
  ADMIN_GOOGLE_REDIRECT_URI?: string;
  ADMIN_OAUTH_STATE_SECRET?: string;
  ADMIN_SESSION_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

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

  const clientId = env.ADMIN_GOOGLE_CLIENT_ID?.trim();
  const stateSecret = env.ADMIN_OAUTH_STATE_SECRET || env.ADMIN_SESSION_SECRET;

  if (!clientId || !stateSecret) {
    await recordAdminAuditEvent({
      env,
      reason: "google_oauth_not_configured",
      request,
      type: "blocked_attempt"
    });
    return redirectToAdmin("/admin/login?google=not_configured");
  }

  const rateLimit = await checkAdminRateLimit({
    action: "admin_google_start",
    env,
    request
  });
  if (!rateLimit.allowed) {
    return redirectToAdmin("/admin/login?google=rate_limited");
  }

  const state = await createAdminGoogleStateCookie({
    env,
    redirectPath: "/admin",
    secure: isRequestSecure(request)
  });
  if (!state) {
    return redirectToAdmin("/admin/login?google=not_configured");
  }

  const redirectUri = getGoogleRedirectUri(request, env);
  const googleUrl = new URL(GOOGLE_AUTH_URL);
  googleUrl.searchParams.set("client_id", clientId);
  googleUrl.searchParams.set("redirect_uri", redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state.state);
  googleUrl.searchParams.set("prompt", "select_account");

  await recordAdminAuditEvent({
    env,
    request,
    type: "login_attempt"
  });

  return new Response(null, {
    status: 302,
    headers: {
      "cache-control": "no-store",
      location: googleUrl.toString(),
      "set-cookie": state.cookie
    }
  });
}

function getGoogleRedirectUri(request: Request, env: Env) {
  return (
    env.ADMIN_GOOGLE_REDIRECT_URI?.trim() ||
    new URL("/api/admin/auth/google/callback", request.url).toString()
  );
}

function redirectToAdmin(path: string) {
  return new Response(null, {
    status: 302,
    headers: {
      "cache-control": "no-store",
      location: path
    }
  });
}
