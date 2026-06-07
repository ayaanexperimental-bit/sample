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

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 24 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jfif",
  ".jpe",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp"
]);
const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/tiff",
  "image/webp",
  "image/x-ms-bmp",
  "image/x-png"
]);
const ALLOWED_VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".webm"]);
const ALLOWED_VIDEO_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm"
]);

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
            ? "Image is too large. Upload an optimized photo under 12 MB."
            : "Video is too large. Use a video under 24 MB or paste a video URL.",
        ok: false
      },
      413
    );
  }

  if (mediaType === "image" && !isAllowedImageFile(file)) {
    return adminJson(
      {
        ok: false,
        error: "Upload a JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, BMP, or TIFF photo."
      },
      400
    );
  }

  if (mediaType === "video" && !isAllowedVideoFile(file)) {
    return adminJson({ ok: false, error: "Upload an MP4, MOV, or WebM video file." }, 400);
  }

  const objectKey = createMediaObjectKey({
    fileName: file.name,
    mediaType,
    slug
  });
  const contentType = getSafeContentType(file, mediaType);
  const body = await file.arrayBuffer();
  await env.COACH_MEDIA_BUCKET.put(objectKey, body, {
    httpMetadata: {
      contentType
    }
  });

  const mediaUrl = `/api/coach-media?key=${encodeURIComponent(objectKey)}`;
  await insertCoachSiteMedia({
    adminEmail: admin.admin.email,
    contentType,
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

function isAllowedImageFile(file: File) {
  const contentType = normalizeContentType(file.type);
  const extension = getFileExtension(file.name);

  if (contentType === "image/svg+xml") return false;
  if (ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) return true;
  if ((contentType === "" || contentType === "application/octet-stream") && extension) {
    return ALLOWED_IMAGE_EXTENSIONS.has(extension);
  }

  return false;
}

function isAllowedVideoFile(file: File) {
  const contentType = normalizeContentType(file.type);
  const extension = getFileExtension(file.name);

  if (ALLOWED_VIDEO_CONTENT_TYPES.has(contentType)) return true;
  if ((contentType === "" || contentType === "application/octet-stream") && extension) {
    return ALLOWED_VIDEO_EXTENSIONS.has(extension);
  }

  return false;
}

function getSafeExtension(fileName: string, mediaType: "image" | "video") {
  const extension = getFileExtension(fileName);
  if (mediaType === "image" && extension && ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return extension === ".tif" ? ".tiff" : extension;
  }
  if (mediaType === "video" && extension && ALLOWED_VIDEO_EXTENSIONS.has(extension)) {
    return extension;
  }

  return mediaType === "image" ? ".jpg" : ".mp4";
}

function getSafeContentType(file: File, mediaType: "image" | "video") {
  const contentType = normalizeContentType(file.type);

  if (mediaType === "image" && ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    return normalizeImageContentType(contentType);
  }
  if (mediaType === "video" && ALLOWED_VIDEO_CONTENT_TYPES.has(contentType)) {
    return contentType;
  }

  return contentTypeFromExtension(getSafeExtension(file.name, mediaType), mediaType);
}

function contentTypeFromExtension(extension: string, mediaType: "image" | "video") {
  switch (extension) {
    case ".avif":
      return "image/avif";
    case ".bmp":
      return "image/bmp";
    case ".gif":
      return "image/gif";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    case ".jfif":
    case ".jpe":
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    case ".webp":
      return "image/webp";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    default:
      return mediaType === "image" ? "image/jpeg" : "video/mp4";
  }
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || "";
}

function normalizeContentType(contentType: string) {
  return contentType.trim().toLowerCase();
}

function normalizeImageContentType(contentType: string) {
  if (contentType === "image/pjpeg") return "image/jpeg";
  if (contentType === "image/x-png") return "image/png";
  if (contentType === "image/x-ms-bmp") return "image/bmp";
  return contentType;
}
