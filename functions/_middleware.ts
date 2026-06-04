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
import {
  paidFunnelSupportResponse,
  type PaidFunnelSupportEnv
} from "../lib/server/paid-funnel-support";

type Env = PaidFunnelSupportEnv & {
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

const PROTECTED_ADMIN_PAGE_PATHS = new Set(["/admin/dashboard"]);
const ADMIN_ROUTE_ALIASES = new Map([
  ["/admin-dashboard", "/admin/dashboard"],
  ["/admin_dashboard", "/admin/dashboard"],
  ["/admin-panel", "/admin/dashboard"],
  ["/admin_panel", "/admin/dashboard"],
  ["/adminpanel", "/admin/dashboard"],
  ["/admin-login", "/admin/login"],
  ["/adminlogin", "/admin/login"],
  ["/dashboard", "/admin/dashboard"],
  ["/admin/home", "/admin/dashboard"],
  ["/admin/dashboard/index", "/admin/dashboard"]
]);

const PUBLIC_PAGE_PATHS = new Set([
  ...PUBLIC_ADMIN_PAGE_PATHS,
  "/blocked",
  "/cancellation",
  "/coach-template-preview",
  "/disclaimer",
  "/privacy",
  "/refund",
  "/support/error",
  "/terms"
]);

export async function onRequest(context: PagesContext) {
  const url = new URL(context.request.url);
  const pathname = normalizePathname(url.pathname);
  const adminRedirect = getCanonicalAdminRedirect(pathname);

  if (adminRedirect && adminRedirect !== pathname) {
    const redirectUrl = new URL(context.request.url);
    redirectUrl.pathname = adminRedirect;

    return new Response(null, {
      status: 302,
      headers: {
        ...NO_STORE_HEADERS,
        location: redirectUrl.toString()
      }
    });
  }

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

  if (isPublicCoachPagePath(pathname)) {
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

    if (routeFunnel.type === "paidProgram") {
      return paidFunnelSupportResponse({
        env: context.env,
        funnel: routeFunnel,
        funnelStep: "paid_page_access",
        request: context.request,
        safeMessage:
          "This paid masterclass page could not verify the access link. Please contact support.",
        status: 403,
        technicalDigest: "paid_page_access_cookie_missing",
        userAction: "Open paid masterclass page"
      });
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
    if (!PROTECTED_ADMIN_PAGE_PATHS.has(pathname)) {
      return new Response(null, {
        status: 302,
        headers: {
          ...NO_STORE_HEADERS,
          location: new URL("/admin/dashboard", context.request.url).toString()
        }
      });
    }

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

function isPublicCoachPagePath(pathname: string) {
  return /^\/coach\/[a-z0-9-]+$/.test(pathname);
}

function isPageLikePath(pathname: string) {
  return pathname !== "/" && !isStaticOrApiPath(pathname);
}

function getCanonicalAdminRedirect(pathname: string) {
  const lowerPathname = pathname.toLowerCase();

  if (ADMIN_ROUTE_ALIASES.has(lowerPathname)) {
    return ADMIN_ROUTE_ALIASES.get(lowerPathname) || null;
  }

  if (lowerPathname === "/admin" || lowerPathname.startsWith("/admin/")) {
    return lowerPathname;
  }

  return null;
}
