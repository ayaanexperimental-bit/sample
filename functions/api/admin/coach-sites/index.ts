import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import {
  type CoachSiteRecord,
  type CoachSiteStatus,
  normalizeCoachSlug
} from "../../../../lib/admin-coach-sites";
import { COACH_TEMPLATE_THEME_IDS } from "../../../../lib/coach-template-themes";
import {
  adminJson,
  isAdminDemoAuthEnabled,
  isValidOtp,
  readJsonBody,
  requireAdmin
} from "../../../../lib/server/admin-auth";
import { startAdminEmailOtp, verifyAdminEmailOtp } from "../../../../lib/server/admin-email-otp";
import {
  listCoachSitesFromDb,
  updateCoachSiteStatusInDb,
  upsertCoachSiteToDb
} from "../../../../lib/server/coach-site-storage";

type Env = {
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
  COACH_MEDIA_BUCKET?: R2Bucket;
  RESEND_API_KEY?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type CoachSitesBody = {
  action?: unknown;
  otp?: unknown;
  removalReason?: unknown;
  site?: unknown;
  siteId?: unknown;
  status?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET") {
    const admin = await requireAdmin(request, env, { requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    let persistedSites: CoachSiteRecord[] | null;
    try {
      persistedSites = await listCoachSitesFromDb(env);
    } catch {
      return adminJson(
        { configured: Boolean(env.ADMIN_DB), error: "Coach site database read failed.", ok: false },
        500
      );
    }

    return adminJson({
      coachSites: persistedSites || [],
      configured: Boolean(env.ADMIN_DB),
      fallbackUsed: false,
      ok: true
    });
  }

  if (request.method === "POST") {
    const admin = await requireAdmin(request, env, { requireCsrf: true, requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    const body = await readJsonBody<CoachSitesBody>(request);
    const site = parseCoachSiteBody(body?.site);
    if (!site) {
      return adminJson({ ok: false, error: "Coach site payload is required." }, 400);
    }

    if (site.status === "published") {
      const publishError = getPublishValidationError(site);
      if (publishError) {
        return adminJson({ ok: false, error: publishError }, 400);
      }
    }

    let savedSite: CoachSiteRecord | null;
    try {
      savedSite = await upsertCoachSiteToDb({
        adminEmail: admin.admin.email,
        env,
        payload: site
      });
    } catch {
      return adminJson(
        {
          configured: Boolean(env.ADMIN_DB),
          error: "Coach site database write failed.",
          ok: false
        },
        500
      );
    }

    if (!savedSite) {
      return adminJson(
        { configured: false, error: "Coach site database is not configured.", ok: false },
        503
      );
    }

    return adminJson({
      coachSite: savedSite,
      configured: true,
      ok: true
    });
  }

  if (request.method === "PATCH") {
    const admin = await requireAdmin(request, env, { requireCsrf: true, requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    const body = await readJsonBody<CoachSitesBody>(request);
    const action = typeof body?.action === "string" ? body.action.trim() : "";
    const siteId = typeof body?.siteId === "string" ? body.siteId.trim() : "";
    const status = parseCoachStatus(body?.status);

    if (!siteId || (action !== "reactivate" && !status)) {
      return adminJson({ ok: false, error: "Coach site id and status are required." }, 400);
    }

    if (action === "reactivate") {
      if (!env.ADMIN_DB) {
        return adminJson(
          { configured: false, error: "Coach site database is not configured.", ok: false },
          503
        );
      }

      let coachSites: CoachSiteRecord[] | null;
      try {
        coachSites = await listCoachSitesFromDb(env);
      } catch {
        return adminJson(
          { configured: true, error: "Coach site database read failed.", ok: false },
          500
        );
      }
      const currentSite = coachSites?.find((site) => site.id === siteId);

      if (!currentSite) {
        return adminJson({ configured: true, error: "Coach site not found.", ok: false }, 404);
      }

      if (currentSite.status !== "archived") {
        return adminJson(
          { configured: true, error: "Only archived coach sites can be reactivated.", ok: false },
          400
        );
      }

      const nextStatus: CoachSiteStatus = currentSite.publishedAt ? "published" : "draft";
      let updatedSite: CoachSiteRecord | null;
      try {
        updatedSite = await updateCoachSiteStatusInDb({
          adminEmail: admin.admin.email,
          env,
          id: siteId,
          status: nextStatus
        });
      } catch {
        return adminJson(
          { configured: true, error: "Coach site database write failed.", ok: false },
          500
        );
      }

      if (!updatedSite) {
        return adminJson({ configured: true, error: "Coach site not found.", ok: false }, 404);
      }

      return adminJson({
        coachSite: updatedSite,
        configured: true,
        ok: true
      });
    }

    if (action === "delete_draft") {
      if (!status) {
        return adminJson({ ok: false, error: "Coach site id and status are required." }, 400);
      }

      if (status !== "removed") {
        return adminJson({ ok: false, error: "Draft delete must use removed status." }, 400);
      }

      if (!env.ADMIN_DB) {
        return adminJson(
          { configured: false, error: "Coach site database is not configured.", ok: false },
          503
        );
      }

      let coachSites: CoachSiteRecord[] | null;
      try {
        coachSites = await listCoachSitesFromDb(env);
      } catch {
        return adminJson(
          { configured: true, error: "Coach site database read failed.", ok: false },
          500
        );
      }
      const currentSite = coachSites?.find((site) => site.id === siteId);

      if (!currentSite) {
        return adminJson({ configured: true, error: "Coach draft not found.", ok: false }, 404);
      }

      if (currentSite.status !== "draft") {
        return adminJson(
          { configured: true, error: "Only draft coach sites can use Delete Draft.", ok: false },
          400
        );
      }

      let updatedSite: CoachSiteRecord | null;
      try {
        updatedSite = await updateCoachSiteStatusInDb({
          adminEmail: admin.admin.email,
          env,
          id: siteId,
          status
        });
      } catch {
        return adminJson(
          { configured: true, error: "Coach site database write failed.", ok: false },
          500
        );
      }

      if (!updatedSite) {
        return adminJson({ configured: true, error: "Coach draft not found.", ok: false }, 404);
      }

      return adminJson({
        coachSite: updatedSite,
        configured: true,
        ok: true
      });
    }

    if (!status) {
      return adminJson({ ok: false, error: "Coach site id and status are required." }, 400);
    }

    if (status === "published") {
      if (!env.ADMIN_DB) {
        return adminJson(
          { configured: false, error: "Coach site database is not configured.", ok: false },
          503
        );
      }

      let coachSites: CoachSiteRecord[] | null;
      try {
        coachSites = await listCoachSitesFromDb(env);
      } catch {
        return adminJson(
          { configured: true, error: "Coach site database read failed.", ok: false },
          500
        );
      }
      const currentSite = coachSites?.find((site) => site.id === siteId);
      if (!currentSite) {
        return adminJson({ configured: true, error: "Coach site not found.", ok: false }, 404);
      }

      const publishError = getPublishValidationError(currentSite);
      if (publishError) {
        return adminJson({ configured: true, error: publishError, ok: false }, 400);
      }
    }

    if (isDangerousStatus(status)) {
      if (!env.ADMIN_DB) {
        return adminJson(
          { configured: false, error: "Coach site database is not configured.", ok: false },
          503
        );
      }

      if (action === "send_otp") {
        const result = await startAdminEmailOtp({
          email: admin.admin.email,
          env,
          request
        });

        if (
          !result.ok &&
          result.reason === "not_configured" &&
          isLocalDemoOtpAvailable(request, env)
        ) {
          return adminJson({
            localOtpMode: true,
            message: "Local OTP is available for this coach-site action.",
            ok: true
          });
        }

        if (!result.ok) {
          return adminJson(
            {
              ok: false,
              error:
                "Admin email OTP is not configured. Configure Resend/admin OTP before archive or remove."
            },
            result.reason === "rate_limited" ? 429 : 503
          );
        }

        return adminJson({
          message: "OTP sent to the current admin email.",
          ok: true
        });
      }

      const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
      if (!isValidOtp(otp)) {
        return adminJson({ ok: false, error: "Enter a valid 6-digit OTP." }, 400);
      }

      const reason = typeof body?.removalReason === "string" ? body.removalReason.trim() : "";
      if (reason.length < 3) {
        return adminJson({ ok: false, error: "Removal reason is required." }, 400);
      }

      const otpOk = await verifyCoachSiteActionOtp({
        email: admin.admin.email,
        env,
        otp,
        request
      });

      if (!otpOk) {
        return adminJson({ ok: false, error: "OTP is invalid, expired, or not configured." }, 401);
      }
    }

    let updatedSite: CoachSiteRecord | null;
    try {
      updatedSite = await updateCoachSiteStatusInDb({
        adminEmail: admin.admin.email,
        env,
        id: siteId,
        status
      });
    } catch {
      return adminJson(
        {
          configured: Boolean(env.ADMIN_DB),
          error: "Coach site database write failed.",
          ok: false
        },
        500
      );
    }

    if (!updatedSite) {
      return adminJson(
        { configured: Boolean(env.ADMIN_DB), error: "Coach site not found.", ok: false },
        404
      );
    }

    return adminJson({
      coachSite: updatedSite,
      configured: true,
      ok: true
    });
  }

  return adminJson({ ok: false, error: "Method not allowed." }, 405, {
    allow: "GET, POST, PATCH"
  });
}

function parseCoachSiteBody(value: unknown): Partial<CoachSiteRecord> | null {
  return value && typeof value === "object" ? (value as Partial<CoachSiteRecord>) : null;
}

function getPublishValidationError(site: Partial<CoachSiteRecord>) {
  const coachName = typeof site.coachName === "string" ? site.coachName.trim() : "";
  const niche = typeof site.niche === "string" ? site.niche.trim() : "";
  const slug = normalizeCoachSlug(
    typeof site.slug === "string" && site.slug.trim() ? site.slug : coachName
  );
  const googleFormUrl = typeof site.googleFormUrl === "string" ? site.googleFormUrl.trim() : "";
  const selectedThemeId =
    typeof site.selectedThemeId === "string" ? site.selectedThemeId.trim() : "";
  const heroMediaType =
    site.heroMediaType === "image" || site.heroMediaType === "video" || site.heroMediaType === "none"
      ? site.heroMediaType
      : "none";

  if (!coachName || !niche || !slug) {
    return "Coach name, niche, and slug are required before publishing.";
  }

  if (
    !COACH_TEMPLATE_THEME_IDS.includes(
      selectedThemeId as (typeof COACH_TEMPLATE_THEME_IDS)[number]
    )
  ) {
    return "Select a valid coach-site template/theme before publishing.";
  }

  if (!googleFormUrl) {
    return "Google Form registration link is required before publishing.";
  }

  if (!/^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(googleFormUrl)) {
    return "Use a valid Google Form registration link before publishing.";
  }

  if (heroMediaType === "image") {
    const photoUrl = typeof site.photoUrl === "string" ? site.photoUrl.trim() : "";
    const logoUrl = typeof site.logoUrl === "string" ? site.logoUrl.trim() : "";
    if (!photoUrl && !logoUrl) {
      return "Add a coach photo/logo or choose No Media before publishing.";
    }
  }

  if (heroMediaType === "video") {
    const videoUrl = typeof site.videoUrl === "string" ? site.videoUrl.trim() : "";
    if (!videoUrl) {
      return "Add a video URL/upload or choose No Media before publishing.";
    }
  }

  return "";
}

function parseCoachStatus(value: unknown): CoachSiteStatus | null {
  return value === "archived" ||
    value === "draft" ||
    value === "paused" ||
    value === "published" ||
    value === "removed"
    ? value
    : null;
}

function isDangerousStatus(status: CoachSiteStatus) {
  return status === "archived" || status === "removed";
}

async function verifyCoachSiteActionOtp({
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
