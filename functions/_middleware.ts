import type { D1Database } from "@cloudflare/workers-types";
import {
  getFunnelByEntryCode,
  getFunnelById,
  getFunnelForPath,
  isPathAllowedForFunnel,
  normalizePathname,
  YW_ROOT_REDIRECT_URL
} from "../lib/coach-platform";
import { blockedLinkResponse } from "../lib/server/blocked-response";
import {
  createFunnelAccessCookie,
  verifyFunnelAccessFromCookie
} from "../lib/server/funnel-access";
import { getAdminRoleForEmail, verifyAdminSessionFromRequest } from "../lib/server/admin-auth";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  FUNNEL_ACCESS_SECRET?: string;
};

type PagesContext = {
  env: Env;
  next: () => Promise<Response>;
  request: Request;
};

const NO_STORE_HEADERS = {
  "cache-control": "no-store"
};

const PUBLIC_ADMIN_PAGE_PATHS = new Set([
  "/admin",
  "/admin/forgot-password",
  "/admin/login",
  "/admin/reset-password",
  "/admin/verify"
]);

const PUBLIC_PAGE_PATHS = new Set([
  ...PUBLIC_ADMIN_PAGE_PATHS,
  "/blocked",
  "/cancellation",
  "/disclaimer",
  "/privacy",
  "/refund",
  "/terms"
]);

export async function onRequest(context: PagesContext) {
  const url = new URL(context.request.url);
  const pathname = normalizePathname(url.pathname);

  if (isStaticOrApiPath(pathname)) {
    return context.next();
  }

  if (pathname === "/") {
    return new Response(null, {
      status: 302,
      headers: {
        ...NO_STORE_HEADERS,
        location: YW_ROOT_REDIRECT_URL
      }
    });
  }

  if (pathname.startsWith("/go/")) {
    return handleGoLink(context, pathname, url);
  }

  if (isProtectedAdminPagePath(pathname)) {
    return handleProtectedAdminPage(context, pathname);
  }

  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    return context.next();
  }

  const routeFunnel = getFunnelForPath(pathname);
  if (routeFunnel) {
    const activeFunnel = await getActiveFunnel(context.request, context.env);

    if (
      activeFunnel &&
      activeFunnel.id === routeFunnel.id &&
      isPathAllowedForFunnel(activeFunnel, pathname)
    ) {
      return context.next();
    }

    return blockedLinkResponse();
  }

  if (isPageLikePath(pathname)) {
    return blockedLinkResponse(404);
  }

  return context.next();
}

async function handleProtectedAdminPage(context: PagesContext, pathname: string) {
  const session = await verifyAdminSessionFromRequest(context.request, context.env);
  const role = session ? await getAdminRoleForEmail(session.email, context.env) : null;

  if (session && role === "owner") {
    return context.next();
  }

  const loginUrl = new URL("/admin/login", context.request.url);
  loginUrl.searchParams.set("next", pathname);

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: loginUrl.toString()
    }
  });
}

async function handleGoLink(context: PagesContext, pathname: string, url: URL) {
  const match = pathname.match(/^\/go\/([^/]+)$/);
  if (!match) {
    return blockedLinkResponse(404);
  }

  const funnel = getFunnelByEntryCode(match[1]);
  const secret = resolveFunnelAccessSecret(context.env);
  if (!funnel || !secret) {
    return blockedLinkResponse(funnel ? 503 : 404);
  }

  const accessCookie = await createFunnelAccessCookie({
    entryCode: funnel.entryCode,
    funnelId: funnel.id,
    secret,
    secure: url.protocol === "https:"
  });
  const redirectUrl = new URL(funnel.canonicalPath, context.request.url);

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: redirectUrl.toString(),
      "set-cookie": accessCookie
    }
  });
}

async function getActiveFunnel(request: Request, env: Env) {
  const secret = resolveFunnelAccessSecret(env);
  if (!secret) return null;

  const access = await verifyFunnelAccessFromCookie({
    cookieHeader: request.headers.get("cookie"),
    secret
  });
  if (!access) return null;

  return getFunnelById(access.funnelId);
}

function resolveFunnelAccessSecret(env: Env) {
  return env.FUNNEL_ACCESS_SECRET || null;
}

function isStaticOrApiPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/images/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/icon.svg" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.includes(".")
  );
}

function isProtectedAdminPagePath(pathname: string) {
  return pathname.startsWith("/admin/") && !PUBLIC_ADMIN_PAGE_PATHS.has(pathname);
}

function isPageLikePath(pathname: string) {
  return pathname !== "/" && !isStaticOrApiPath(pathname);
}
