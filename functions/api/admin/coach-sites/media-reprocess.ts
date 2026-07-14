import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { normalizeCoachSlug } from "../../../../lib/admin-coach-sites";
import type { CoachImageProviderPreference } from "../../../../lib/server/coach-image-processing";
import { reprocessStoredCoachImage } from "../../../../lib/server/coach-image-processing";
import { adminJson, readJsonBody, requireAdmin } from "../../../../lib/server/admin-auth";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  COACH_MEDIA_BUCKET?: R2Bucket;
  IMAGE_BG_REMOVAL_ENABLED?: string;
  IMAGE_BG_REMOVAL_PROVIDER?: string;
  IMAGE_BG_REMOVAL_QUALITY_THRESHOLD?: string;
  PHOTOROOM_API_KEY?: string;
  REMOVEBG_API_KEY?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type ReprocessBody = {
  originalObjectKey?: unknown;
  provider?: unknown;
  slug?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const admin = await requireAdmin(request, env, {
    requireCsrf: true,
    requiredAnyPermission: ["website_creator.create", "website_creator.edit"]
  });
  if (!admin.ok) return admin.response;

  if (!env.COACH_MEDIA_BUCKET) {
    return adminJson(
      { ok: false, error: "Coach media storage is not configured." },
      503
    );
  }

  const body = await readJsonBody<ReprocessBody>(request);
  const slug = normalizeCoachSlug(typeof body?.slug === "string" ? body.slug : "");
  const originalObjectKey =
    typeof body?.originalObjectKey === "string" ? body.originalObjectKey : "";
  if (!slug || !originalObjectKey) {
    return adminJson({ ok: false, error: "Original coach image details are required." }, 400);
  }

  try {
    const media = await reprocessStoredCoachImage({
      env,
      originalObjectKey,
      providerOverride: normalizeProvider(body?.provider),
      slug,
      uploadedBy: admin.admin.email,
    });
    return adminJson({ configured: true, media, ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Coach photo could not be reprocessed safely.";
    return adminJson({ ok: false, error: message }, message.includes("not configured") ? 503 : 400);
  }
}

function normalizeProvider(value: unknown): CoachImageProviderPreference {
  return value === "photoroom" || value === "removebg" ? value : "auto";
}
