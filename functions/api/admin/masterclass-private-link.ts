import type { D1Database } from "@cloudflare/workers-types";
import { funnels, getFunnelByEntryCode, isPaidProgramFunnel } from "../../../lib/coach-platform";
import {
  adminJson,
  isAdminDemoAuthEnabled,
  isValidOtp,
  readJsonBody,
  requireAdmin
} from "../../../lib/server/admin-auth";
import { startAdminEmailOtp, verifyAdminEmailOtp } from "../../../lib/server/admin-email-otp";
import {
  getPrivateWhatsappLinkMetadata,
  getPrivateWhatsappGroupUrl,
  upsertPrivateWhatsappGroupUrl,
  type PrivateFunnelLinkEnv
} from "../../../lib/server/private-funnel-links";

type Env = PrivateFunnelLinkEnv & {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_EMAIL_OTP_ENABLED?: string;
  ADMIN_EMAIL_OTP_FROM?: string;
  ADMIN_EMAIL_OTP_FROM_NAME?: string;
  ADMIN_EMAIL_OTP_SECRET?: string;
  ADMIN_OTP_MAX_ATTEMPTS?: string;
  ADMIN_OTP_TTL_SECONDS?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type PrivateLinkBody = {
  action?: unknown;
  entryCode?: unknown;
  entryPath?: unknown;
  otp?: unknown;
  whatsappGroupUrl?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET") {
    const admin = await requireAdmin(request, env, { requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    return adminJson({
      links: await getPaidLinkMetadata(env),
      ok: true,
      privateLinkValuesExposed: false
    });
  }

  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "GET, POST" });
  }

  const admin = await requireAdmin(request, env, { requireCsrf: true, requiredRole: "owner" });
  if (!admin.ok) return admin.response;

  const body = await readJsonBody<PrivateLinkBody>(request);
  const action = typeof body?.action === "string" ? body.action : "";
  const entryCode = parseEntryCode(body);
  const funnel = entryCode ? getFunnelByEntryCode(entryCode) : null;

  if (!entryCode || !funnel || !isPaidProgramFunnel(funnel)) {
    return adminJson({ ok: false, error: "Paid masterclass link is not valid." }, 400);
  }

  if (action === "send_otp") {
    const result = await startAdminEmailOtp({
      email: admin.admin.email,
      env,
      request
    });

    if (!result.ok && result.reason === "not_configured" && isLocalDemoOtpAvailable(request, env)) {
      return adminJson({
        localOtpMode: true,
        message: "Local OTP is available for this reveal test.",
        ok: true
      });
    }

    if (!result.ok) {
      return adminJson(
        {
          ok: false,
          error: "Admin email OTP is not configured. Configure Resend/admin OTP before reveal."
        },
        result.reason === "rate_limited" ? 429 : 503
      );
    }

    return adminJson({
      message: "OTP sent to the current admin email.",
      ok: true
    });
  }

  if (action === "reveal") {
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
    if (!isValidOtp(otp)) {
      return adminJson({ ok: false, error: "Enter a valid 6-digit OTP." }, 400);
    }

    const otpOk = await verifyRevealOtp({
      email: admin.admin.email,
      env,
      otp,
      request
    });

    if (!otpOk) {
      return adminJson({ ok: false, error: "OTP is invalid, expired, or not configured." }, 401);
    }

    const privateWhatsappUrl = await getPrivateWhatsappGroupUrl(funnel, env);
    if (!privateWhatsappUrl) {
      return adminJson({ ok: false, error: "Private WhatsApp link is not configured." }, 404);
    }

    return adminJson({
      expiresInSeconds: 20,
      joinUrl: privateWhatsappUrl,
      ok: true
    });
  }

  if (action === "update_whatsapp") {
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
    if (!isValidOtp(otp)) {
      return adminJson({ ok: false, error: "Enter a valid 6-digit OTP before saving." }, 400);
    }

    const otpOk = await verifyRevealOtp({
      email: admin.admin.email,
      env,
      otp,
      request
    });

    if (!otpOk) {
      return adminJson({ ok: false, error: "OTP is invalid, expired, or not configured." }, 401);
    }

    const whatsappGroupUrl =
      typeof body?.whatsappGroupUrl === "string" ? body.whatsappGroupUrl.trim() : "";
    const result = await upsertPrivateWhatsappGroupUrl({
      env,
      funnel,
      updatedBy: admin.admin.email,
      whatsappGroupUrl
    });

    if (!result.ok) {
      return adminJson(
        { ok: false, error: result.error },
        result.error.includes("database") ? 503 : 400
      );
    }

    return adminJson({
      metadata: result.metadata,
      ok: true,
      privateLinkValuesExposed: false
    });
  }

  return adminJson({ ok: false, error: "Unsupported action." }, 400);
}

async function getPaidLinkMetadata(env: Env) {
  return Promise.all(
    funnels.filter(isPaidProgramFunnel).map(async (funnel) => ({
      entryCode: funnel.entryCode,
      ...(await getPrivateWhatsappLinkMetadata(funnel, env))
    }))
  );
}

async function verifyRevealOtp({
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
  const result = await verifyAdminEmailOtp({
    email,
    env,
    otp,
    request
  });
  if (result.ok) return true;

  return isLocalDemoOtpAvailable(request, env) && otp === env.ADMIN_DEV_OTP?.trim();
}

function parseEntryCode(body: PrivateLinkBody | null) {
  const directEntryCode = typeof body?.entryCode === "string" ? body.entryCode.trim() : "";
  if (directEntryCode) return directEntryCode;

  const entryPath = typeof body?.entryPath === "string" ? body.entryPath.trim() : "";
  const match = entryPath.match(/^\/go\/([a-z0-9-]+)$/i);

  return match?.[1] || "";
}

function isLocalDemoOtpAvailable(request: Request, env: Env) {
  return (
    isAdminDemoAuthEnabled(env) &&
    isLocalRequest(request) &&
    isValidOtp(env.ADMIN_DEV_OTP?.trim() || "")
  );
}

function isLocalRequest(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();

  return isLocalHostname(url.hostname.toLowerCase()) && isLocalHostname(host);
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}
