import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { normalizeCoachSlug } from "../../../lib/admin-coach-sites";
import { processAndPersistCoachImage } from "../../../lib/server/coach-image-processing";
import { hasSupportedCoachImageSignature } from "../../../lib/server/coach-media-file-validation";
import { insertCoachSiteMedia } from "../../../lib/server/coach-site-storage";
import { getShopOrderForClient } from "../../../lib/server/shop";

type Env = {
  ADMIN_DB?: D1Database;
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

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 70 * 1024 * 1024;
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
const ALLOWED_VIDEO_EXTENSIONS = new Set([
  ".3g2",
  ".3gp",
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ogg",
  ".ogv",
  ".webm",
  ".wmv"
]);
const ALLOWED_VIDEO_CONTENT_TYPES = new Set([
  "application/mp4",
  "application/ogg",
  "video/3gpp",
  "video/3gpp2",
  "video/mp4",
  "video/mpeg",
  "video/msvideo",
  "video/ogg",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-matroska",
  "video/x-ms-wmv",
  "video/x-msvideo"
]);

export async function onRequestPost({ request, env }: PagesContext) {
  if (!env.COACH_MEDIA_BUCKET) {
    return shopJson(
      {
        configured: false,
        error: "Shop media storage is not configured. Please use a secure HTTPS media link for now.",
        ok: false
      },
      503
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const rawCutoutFile = formData?.get("cutoutFile");
  const rawMediaType = formData?.get("mediaType");
  const rawAccessKey = formData?.get("accessKey");
  const rawOrderId = formData?.get("orderId");

  if (!(file instanceof File)) {
    return shopJson({ ok: false, error: "Media file is required." }, 400);
  }

  const mediaType = rawMediaType === "video" ? "video" : "image";
  const orderId = typeof rawOrderId === "string" ? rawOrderId : "";
  const accessKey =
    typeof rawAccessKey === "string"
      ? rawAccessKey
      : request.headers.get("x-shop-access-key") || "";
  const order = orderId ? await getShopOrderForClient({ accessKey, env, orderId }) : null;
  if (!order) {
    return shopJson(
      { ok: false, error: "Open a valid secure Shop draft before uploading media." },
      401
    );
  }
  if (
    ["paid", "published", "publishing"].includes(order.paymentStatus) ||
    ["published", "publishing"].includes(order.siteStatus)
  ) {
    return shopJson(
      { ok: false, error: "This paid or published website is locked from coach-side media edits." },
      409
    );
  }

  const slug = normalizeCoachSlug(order.slug) || "shop-draft";
  const maxBytes = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  let clientCutoutFile =
    mediaType === "image" && rawCutoutFile instanceof File ? rawCutoutFile : null;

  if (file.size <= 0) {
    return shopJson({ ok: false, error: "Upload a non-empty media file." }, 400);
  }

  if (file.size > maxBytes) {
    return shopJson(
      {
        error:
          mediaType === "image"
            ? "Image is too large. Upload an optimized photo under 12 MB."
            : "Video is too large. Use a video under 70 MB or paste a YouTube/video URL.",
        ok: false
      },
      413
    );
  }

  if (
    mediaType === "image" &&
    (!isAllowedImageFile(file) || !(await hasSupportedCoachImageSignature(file)))
  ) {
    return shopJson(
      {
        ok: false,
        error: "Upload a JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, BMP, or TIFF photo."
      },
      400
    );
  }

  if (
    clientCutoutFile &&
    (clientCutoutFile.size <= 2048 ||
      clientCutoutFile.size > MAX_IMAGE_BYTES ||
      !isAllowedImageFile(clientCutoutFile))
  ) {
    clientCutoutFile = null;
  }

  if (mediaType === "video" && !isAllowedVideoFile(file)) {
    return shopJson(
      {
        ok: false,
        error: "Upload a supported video file up to 70 MB, or paste a YouTube/video URL."
      },
      400
    );
  }

  const objectKey = createMediaObjectKey({
    fileName: file.name,
    mediaType,
    slug,
    variant: mediaType === "image" ? "original" : undefined
  });
  const contentType = getSafeContentType(file, mediaType);
  const body = await file.arrayBuffer();
  const mediaUrl = `/api/coach-media?key=${encodeURIComponent(objectKey)}`;
  try {
    await env.COACH_MEDIA_BUCKET.put(objectKey, body, {
      httpMetadata: { contentType }
    });
    await insertCoachSiteMedia({
      adminEmail: "public-shop-builder",
      contentType,
      env,
      fileName: file.name,
      mediaType,
      objectKey,
      publicUrl: mediaUrl,
      processingStatus: mediaType === "image" ? "processing" : "",
      sizeBytes: file.size,
      slug,
      variant: mediaType === "image" ? "original" : ""
    });
  } catch {
    return shopJson({ ok: false, error: "Coach media could not be stored safely." }, 503);
  }

  if (mediaType === "image") {
    const media = await processAndPersistCoachImage({
      clientCutoutFile,
      env,
      originalFile: file,
      originalObjectKey: objectKey,
      originalUrl: mediaUrl,
      slug,
      uploadedBy: "public-shop-builder",
    });
    return shopJson({ configured: true, media, ok: true });
  }

  return shopJson({
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

export async function onRequestOptions() {
  return shopJson({ ok: true });
}

function createMediaObjectKey({
  fileName,
  mediaType,
  slug,
  variant
}: {
  fileName: string;
  mediaType: "image" | "video";
  slug: string;
  variant?: "cutout" | "original";
}) {
  const extension = getSafeExtension(fileName, mediaType);
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);

  const directory = variant ? `${mediaType}/${variant}` : mediaType;
  return `coach-sites/${slug}/${directory}/${timestamp}-${crypto.randomUUID()}${extension}`;
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
  if (contentType.startsWith("video/") && extension) {
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
    case ".m4v":
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".ogv":
    case ".ogg":
      return "video/ogg";
    case ".3gp":
      return "video/3gpp";
    case ".3g2":
      return "video/3gpp2";
    case ".mpeg":
    case ".mpg":
      return "video/mpeg";
    case ".avi":
      return "video/x-msvideo";
    case ".wmv":
      return "video/x-ms-wmv";
    case ".mkv":
      return "video/x-matroska";
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

function shopJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8"
    }
  });
}
