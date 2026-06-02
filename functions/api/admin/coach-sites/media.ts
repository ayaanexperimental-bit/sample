import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { normalizeCoachSlug } from "../../../../lib/admin-coach-sites";
import { adminJson, requireAdmin } from "../../../../lib/server/admin-auth";
import { insertCoachSiteMedia } from "../../../../lib/server/coach-site-storage";

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

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 24 * 1024 * 1024;

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const admin = await requireAdmin(request, env, { requireCsrf: true, requiredRole: "owner" });
  if (!admin.ok) return admin.response;

  if (!env.COACH_MEDIA_BUCKET) {
    return adminJson(
      {
        configured: false,
        error:
          "Coach media storage is not configured. Enable Cloudflare R2 and add the bucket binding.",
        ok: false
      },
      503
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const rawMediaType = formData?.get("mediaType");
  const rawSlug = formData?.get("slug");

  if (!(file instanceof File)) {
    return adminJson({ ok: false, error: "Media file is required." }, 400);
  }

  const mediaType = rawMediaType === "video" ? "video" : "image";
  const slug = normalizeCoachSlug(typeof rawSlug === "string" ? rawSlug : "") || "draft-coach";
  const maxBytes = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;

  if (file.size > maxBytes) {
    return adminJson(
      {
        error:
          mediaType === "image"
            ? "Image is too large. Use an image under 4 MB."
            : "Video is too large. Use a video under 24 MB or paste a video URL.",
        ok: false
      },
      413
    );
  }

  if (mediaType === "image" && !file.type.startsWith("image/")) {
    return adminJson({ ok: false, error: "Upload an image file." }, 400);
  }

  if (mediaType === "video" && !file.type.startsWith("video/")) {
    return adminJson({ ok: false, error: "Upload a video file." }, 400);
  }

  const objectKey = createMediaObjectKey({
    fileName: file.name,
    mediaType,
    slug
  });
  const body = await file.arrayBuffer();
  await env.COACH_MEDIA_BUCKET.put(objectKey, body, {
    httpMetadata: {
      contentType: file.type || (mediaType === "image" ? "image/jpeg" : "video/mp4")
    }
  });

  const mediaUrl = `/api/coach-media?key=${encodeURIComponent(objectKey)}`;
  await insertCoachSiteMedia({
    adminEmail: admin.admin.email,
    contentType: file.type,
    env,
    fileName: file.name,
    mediaType,
    objectKey,
    publicUrl: mediaUrl,
    sizeBytes: file.size,
    slug
  });

  return adminJson({
    configured: true,
    media: {
      mediaType,
      objectKey,
      publicUrl: mediaUrl,
      sizeBytes: file.size
    },
    ok: true
  });
}

function createMediaObjectKey({
  fileName,
  mediaType,
  slug
}: {
  fileName: string;
  mediaType: "image" | "video";
  slug: string;
}) {
  const extension = getSafeExtension(fileName, mediaType);
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);

  return `coach-sites/${slug}/${mediaType}/${timestamp}-${crypto.randomUUID()}${extension}`;
}

function getSafeExtension(fileName: string, mediaType: "image" | "video") {
  const match = fileName.toLowerCase().match(/\.(avif|gif|jpeg|jpg|mov|mp4|png|webm|webp)$/);
  if (match) return match[0];

  return mediaType === "image" ? ".jpg" : ".mp4";
}
