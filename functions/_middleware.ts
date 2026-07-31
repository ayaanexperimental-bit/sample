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
  createFunnelAccessHash,
  createFunnelAccessCookie,
  FUNNEL_ACCESS_HASH_QUERY,
  verifyFunnelAccessFromCookie
} from "../lib/server/funnel-access";
import { verifyPaymentAccessFromCookie } from "../lib/server/payment-access";
import { verifyAdminSessionFromRequest } from "../lib/server/admin-auth";
import { getAdminAccessProfile } from "../lib/server/admin-rbac";
import {
  paidFunnelSupportResponse,
  type PaidFunnelSupportEnv
} from "../lib/server/paid-funnel-support";
import { funnelSocialPreviewResponse, isSocialPreviewRequest } from "../lib/server/funnel-preview";

type Env = PaidFunnelSupportEnv & {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  FUNNEL_ACCESS_SECRET?: string;
  SUCCESS_ACCESS_SECRET?: string;
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
  ["/admil", "/admin/dashboard"],
  ["/admim", "/admin/dashboard"],
  ["/admn", "/admin/dashboard"],
  ["/admin-dashboard", "/admin/dashboard"],
  ["/admin-dashboard/dashboard", "/admin/dashboard"],
  ["/admin_dashboard", "/admin/dashboard"],
  ["/admin_dashboard/dashboard", "/admin/dashboard"],
  ["/admin-panel", "/admin/dashboard"],
  ["/admin-panel/dashboard", "/admin/dashboard"],
  ["/admin_panel", "/admin/dashboard"],
  ["/admin_panel/dashboard", "/admin/dashboard"],
  ["/adminpanel", "/admin/dashboard"],
  ["/adminpanel/dashboard", "/admin/dashboard"],
  ["/admin-login", "/admin/login"],
  ["/adminlogin", "/admin/login"],
  ["/admindashboard", "/admin/dashboard"],
  ["/adminn", "/admin/dashboard"],
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
  "/shop",
  "/shop/success",
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

  if (isStaticRscTextPrefetch(pathname, url)) {
    return new Response(null, {
      status: 204,
      headers: NO_STORE_HEADERS
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
    if (routeFunnel.type === "paidProgram") {
      if (pathname === routeFunnel.successPath) {
        const paidAccess = await getPaidAccess(context.request, context.env);
        if (
          paidAccess?.funnel.id === routeFunnel.id &&
          hasMatchingAccessHash(url, paidAccess.accessHash)
        ) {
          return context.next();
        }
      } else {
        const activeAccess = await getActiveFunnelAccess(context.request, context.env);
        if (
          activeAccess?.funnel.id === routeFunnel.id &&
          isPathAllowedForFunnel(activeAccess.funnel, pathname) &&
          hasMatchingAccessHash(url, activeAccess.accessHash)
        ) {
          return context.next();
        }
      }

      return paidFunnelSupportResponse({
        env: context.env,
        funnel: routeFunnel,
        funnelStep: pathname === routeFunnel.successPath ? "paid_success" : "paid_page_access",
        request: context.request,
        safeMessage:
          "This paid masterclass page could not verify the access link. Please contact support.",
        status: 403,
        technicalDigest:
          pathname === routeFunnel.successPath
            ? "paid_success_hash_or_cookie_missing"
            : "paid_page_access_hash_or_cookie_missing",
        userAction: "Open paid masterclass page"
      });
    }

    const activeAccess = await getActiveFunnelAccess(context.request, context.env);
    if (
      activeAccess?.funnel.id === routeFunnel.id &&
      isPathAllowedForFunnel(activeAccess.funnel, pathname)
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
  const profile = session ? await getAdminAccessProfile(session.email, context.env) : null;

  if (session && profile) {
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

  if (isSocialPreviewRequest(context.request) && url.searchParams.get("open") !== "1") {
    return funnelSocialPreviewResponse({ funnel, request: context.request });
  }

  const accessHash = createFunnelAccessHash();
  const accessCookie = await createFunnelAccessCookie({
    accessHash,
    entryCode: funnel.entryCode,
    funnelId: funnel.id,
    secret,
    secure: url.protocol === "https:"
  });
  const redirectUrl = new URL(funnel.canonicalPath, context.request.url);
  if (funnel.type === "paidProgram") {
    redirectUrl.searchParams.set(FUNNEL_ACCESS_HASH_QUERY, accessHash);
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: redirectUrl.toString(),
      "set-cookie": accessCookie
    }
  });
}

async function getActiveFunnelAccess(request: Request, env: Env) {
  const secret = resolveFunnelAccessSecret(env);
  if (!secret) return null;

  const access = await verifyFunnelAccessFromCookie({
    cookieHeader: request.headers.get("cookie"),
    secret
  });
  if (!access) return null;

  const funnel = getFunnelById(access.funnelId);

  return funnel ? { accessHash: access.accessHash, funnel } : null;
}

async function getPaidAccess(request: Request, env: Env) {
  if (!env.SUCCESS_ACCESS_SECRET) return null;

  const access = await verifyPaymentAccessFromCookie({
    cookieHeader: request.headers.get("cookie"),
    secret: env.SUCCESS_ACCESS_SECRET
  });
  if (!access) return null;

  const funnel = getFunnelById(access.funnelId);

  return funnel ? { accessHash: access.accessHash, funnel } : null;
}

function hasMatchingAccessHash(url: URL, accessHash: string) {
  return url.searchParams.get(FUNNEL_ACCESS_HASH_QUERY) === accessHash;
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

function isStaticRscTextPrefetch(pathname: string, url: URL) {
  return pathname.includes("/__next.") && pathname.endsWith(".txt") && url.searchParams.has("_rsc");
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
  const lowerPathname = normalizeAdminRecoveryPath(pathname);

  if (ADMIN_ROUTE_ALIASES.has(lowerPathname)) {
    return ADMIN_ROUTE_ALIASES.get(lowerPathname) || null;
  }

  if (isAdminLoginRecoveryPath(lowerPathname)) {
    return "/admin/login";
  }

  if (isAdminDashboardRecoveryPath(lowerPathname)) {
    return "/admin/dashboard";
  }

  if (
    lowerPathname === "/admin" ||
    PUBLIC_ADMIN_PAGE_PATHS.has(lowerPathname) ||
    PROTECTED_ADMIN_PAGE_PATHS.has(lowerPathname)
  ) {
    return lowerPathname;
  }

  if (lowerPathname.startsWith("/admin/")) {
    return "/admin/dashboard";
  }

  return null;
}

function isAdminLoginRecoveryPath(pathname: string) {
  return (
    pathname === "/admin-login" ||
    pathname.startsWith("/admin-login/") ||
    pathname === "/adminlogin" ||
    pathname.startsWith("/adminlogin/")
  );
}

function isAdminDashboardRecoveryPath(pathname: string) {
  const compactPathname = pathname.replace(/[-_]/g, "");

  return (
    pathname === "/admil" ||
    pathname.startsWith("/admil/") ||
    pathname === "/admim" ||
    pathname.startsWith("/admim/") ||
    pathname === "/admn" ||
    pathname.startsWith("/admn/") ||
    pathname === "/adminn" ||
    pathname.startsWith("/adminn/") ||
    pathname === "/admindashboard" ||
    pathname.startsWith("/admindashboard/") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/admin-dashboard") ||
    pathname.startsWith("/admin_dashboard") ||
    pathname.startsWith("/admin-panel") ||
    pathname.startsWith("/admin_panel") ||
    pathname.startsWith("/adminpanel") ||
    compactPathname.startsWith("/admindashboard") ||
    compactPathname.startsWith("/admindashbord") ||
    compactPathname.startsWith("/admindashbaord") ||
    compactPathname.startsWith("/adminpanel") ||
    compactPathname.startsWith("/adminpanal") ||
    compactPathname.startsWith("/adminpannel")
  );
}

function normalizeAdminRecoveryPath(pathname: string) {
  const decodedPathname = safelyDecodePathname(pathname);
  const normalizedPathname = decodedPathname
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");

  return normalizedPathname || "/";
}

function safelyDecodePathname(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}
