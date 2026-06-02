import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import {
  demoCoachSites,
  type CoachSiteRecord,
  type CoachSiteStatus
} from "../../../../lib/admin-coach-sites";
import { adminJson, readJsonBody, requireAdmin } from "../../../../lib/server/admin-auth";
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
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  COACH_MEDIA_BUCKET?: R2Bucket;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type CoachSitesBody = {
  site?: unknown;
  siteId?: unknown;
  status?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method === "GET") {
    const admin = await requireAdmin(request, env, { requiredRole: "owner" });
    if (!admin.ok) return admin.response;

    const persistedSites = await listCoachSitesFromDb(env);

    return adminJson({
      coachSites: mergeCoachSitesWithStaticFallback(persistedSites),
      configured: Boolean(env.ADMIN_DB),
      fallbackUsed: !persistedSites || persistedSites.length === 0,
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

    const savedSite = await upsertCoachSiteToDb({
      adminEmail: admin.admin.email,
      env,
      payload: site
    });

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
    const siteId = typeof body?.siteId === "string" ? body.siteId.trim() : "";
    const status = parseCoachStatus(body?.status);

    if (!siteId || !status) {
      return adminJson({ ok: false, error: "Coach site id and status are required." }, 400);
    }

    const updatedSite = await updateCoachSiteStatusInDb({
      adminEmail: admin.admin.email,
      env,
      id: siteId,
      status
    });

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

function parseCoachStatus(value: unknown): CoachSiteStatus | null {
  return value === "archived" ||
    value === "draft" ||
    value === "paused" ||
    value === "published" ||
    value === "removed"
    ? value
    : null;
}

function mergeCoachSitesWithStaticFallback(persistedSites: CoachSiteRecord[] | null) {
  const merged = new Map<string, CoachSiteRecord>();

  for (const site of persistedSites || []) {
    merged.set(site.slug, site);
  }

  for (const site of demoCoachSites) {
    if (!merged.has(site.slug)) {
      merged.set(site.slug, {
        ...site,
        analytics: {
          ...site.analytics,
          lastUpdated: persistedSites
            ? "Static fallback; save this site to move it into D1"
            : "Demo fallback until first admin save"
        }
      });
    }
  }

  return Array.from(merged.values());
}
