import type { R2Bucket } from "@cloudflare/workers-types";
import {
  insertCoachSiteMedia,
  type CoachSiteStorageEnv,
  updateCoachSiteMediaProcessing,
} from "./coach-site-storage";

export type CoachImageProvider =
  | "already-transparent"
  | "local-browser"
  | "none"
  | "photoroom"
  | "removebg";

export type CoachImageProviderPreference = "auto" | "photoroom" | "removebg";

export type CoachImageProcessingEnv = CoachSiteStorageEnv & {
  IMAGE_BG_REMOVAL_ENABLED?: string;
  IMAGE_BG_REMOVAL_PROVIDER?: string;
  IMAGE_BG_REMOVAL_QUALITY_THRESHOLD?: string;
  PHOTOROOM_API_KEY?: string;
  REMOVEBG_API_KEY?: string;
};

export type CoachImageMediaResult = {
  cutoutUrl?: string;
  fallbackMode: "cutout" | "framed";
  height?: number;
  mediaType: "image";
  objectKey: string;
  originalObjectKey: string;
  originalUrl: string;
  processingAttemptErrorCodes: string[];
  processingErrorCode: string;
  processingProvider: CoachImageProvider;
  processingStatus: "cutout_ready" | "disabled" | "framed_fallback" | "not_configured";
  publicUrl: string;
  qualityStatus: "needs_manual_review" | "passed" | "skipped";
  safeMessage: string;
  sizeBytes: number;
  width?: number;
};

type ProcessCoachImageInput = {
  clientCutoutFile?: File | null;
  env: CoachImageProcessingEnv;
  fetcher?: typeof fetch;
  originalFile: File;
  providerOverride?: CoachImageProviderPreference;
};

type PersistCoachImageInput = ProcessCoachImageInput & {
  originalObjectKey: string;
  originalUrl: string;
  slug: string;
  uploadedBy: string;
};

type ProcessedCutout = {
  attemptErrorCodes: string[];
  bytes?: Uint8Array;
  contentType?: "image/png" | "image/webp";
  errorCode: string;
  fallbackMode: "cutout" | "framed";
  height?: number;
  provider: CoachImageProvider;
  qualityStatus: "needs_manual_review" | "passed" | "skipped";
  safeMessage: string;
  status: "cutout_ready" | "disabled" | "framed_fallback" | "not_configured";
  width?: number;
};

const MAX_PROCESSED_IMAGE_BYTES = 16 * 1024 * 1024;
const MIN_PROCESSED_IMAGE_BYTES = 2048;
const PROVIDER_TIMEOUT_MS = 30_000;

export async function processAndPersistCoachImage(
  input: PersistCoachImageInput
): Promise<CoachImageMediaResult> {
  const processed = await processCoachImageCutout(input);

  if (!processed.bytes || !processed.contentType) {
    await updateCoachSiteMediaProcessing({
      env: input.env,
      fallbackMode: "framed",
      imageHeight: processed.height,
      imageWidth: processed.width,
      objectKey: input.originalObjectKey,
      originalObjectKey: input.originalObjectKey,
      processingErrorCode: processed.errorCode,
      processingProvider: processed.provider,
      processingStatus: processed.status,
      qualityStatus: processed.qualityStatus,
      variant: "original",
    });

    return buildFramedMediaResult(input, processed);
  }

  const bucket = input.env.COACH_MEDIA_BUCKET;
  if (!bucket) {
    throw new Error("Coach media storage is not configured.");
  }

  const extension = processed.contentType === "image/webp" ? ".webp" : ".png";
  const cutoutObjectKey = createCoachImageObjectKey(input.slug, "cutout", extension);
  const cutoutUrl = `/api/coach-media?key=${encodeURIComponent(cutoutObjectKey)}`;
  try {
    await bucket.put(cutoutObjectKey, processed.bytes, {
      httpMetadata: { contentType: processed.contentType },
    });
    await updateCoachSiteMediaProcessing({
      env: input.env,
      fallbackMode: "cutout",
      imageHeight: processed.height,
      imageWidth: processed.width,
      objectKey: input.originalObjectKey,
      originalObjectKey: input.originalObjectKey,
      processingErrorCode: processed.errorCode,
      processingProvider: processed.provider,
      processingStatus: "cutout_ready",
      qualityStatus: "passed",
      variant: "original",
    });
    await insertCoachSiteMedia({
      adminEmail: input.uploadedBy,
      contentType: processed.contentType,
      env: input.env,
      fallbackMode: "cutout",
      fileName: replaceFileExtension(input.originalFile.name, extension),
      imageHeight: processed.height,
      imageWidth: processed.width,
      mediaType: "image",
      objectKey: cutoutObjectKey,
      originalObjectKey: input.originalObjectKey,
      processingErrorCode: processed.errorCode,
      processingProvider: processed.provider,
      processingStatus: "cutout_ready",
      publicUrl: cutoutUrl,
      qualityStatus: "passed",
      sizeBytes: processed.bytes.byteLength,
      slug: input.slug,
      variant: "cutout",
    });
  } catch {
    await bucket.delete(cutoutObjectKey).catch(() => undefined);
    const fallback = framedFallback({
      attemptErrorCodes: [...processed.attemptErrorCodes, "cutout_persistence_failed"],
      errorCode: "cutout_persistence_failed",
      provider: processed.provider,
      status: "framed_fallback",
    });
    await updateCoachSiteMediaProcessing({
      env: input.env,
      fallbackMode: "framed",
      objectKey: input.originalObjectKey,
      originalObjectKey: input.originalObjectKey,
      processingErrorCode: fallback.errorCode,
      processingProvider: fallback.provider,
      processingStatus: fallback.status,
      qualityStatus: fallback.qualityStatus,
      variant: "original",
    }).catch(() => undefined);
    return buildFramedMediaResult(input, fallback);
  }

  return {
    cutoutUrl,
    fallbackMode: "cutout",
    height: processed.height,
    mediaType: "image",
    objectKey: cutoutObjectKey,
    originalObjectKey: input.originalObjectKey,
    originalUrl: input.originalUrl,
    processingAttemptErrorCodes: processed.attemptErrorCodes,
    processingErrorCode: processed.errorCode,
    processingProvider: processed.provider,
    processingStatus: "cutout_ready",
    publicUrl: cutoutUrl,
    qualityStatus: "passed",
    safeMessage: processed.safeMessage,
    sizeBytes: processed.bytes.byteLength,
    width: processed.width,
  };
}

export async function reprocessStoredCoachImage({
  env,
  fetcher,
  originalObjectKey,
  providerOverride,
  slug,
  uploadedBy,
}: {
  env: CoachImageProcessingEnv;
  fetcher?: typeof fetch;
  originalObjectKey: string;
  providerOverride?: CoachImageProviderPreference;
  slug: string;
  uploadedBy: string;
}) {
  const bucket = env.COACH_MEDIA_BUCKET;
  if (!bucket) throw new Error("Coach media storage is not configured.");
  if (!isOwnedCoachOriginalObjectKey(originalObjectKey, slug)) {
    throw new Error("The original coach image reference is invalid.");
  }

  const object = await bucket.get(originalObjectKey).catch(() => null);
  if (!object) throw new Error("The original coach image could not be found.");

  const contentType = normalizeImageContentType(object.httpMetadata?.contentType || "image/jpeg");
  const originalFile = new File([await object.arrayBuffer()], getObjectFileName(originalObjectKey), {
    type: contentType,
  });
  const originalUrl = `/api/coach-media?key=${encodeURIComponent(originalObjectKey)}`;

  return processAndPersistCoachImage({
    env,
    fetcher,
    originalFile,
    originalObjectKey,
    originalUrl,
    providerOverride,
    slug,
    uploadedBy,
  });
}

function buildFramedMediaResult(
  input: PersistCoachImageInput,
  processed: ProcessedCutout
): CoachImageMediaResult {
  return {
    fallbackMode: "framed",
    height: processed.height,
    mediaType: "image",
    objectKey: input.originalObjectKey,
    originalObjectKey: input.originalObjectKey,
    originalUrl: input.originalUrl,
    processingAttemptErrorCodes: processed.attemptErrorCodes,
    processingErrorCode: processed.errorCode,
    processingProvider: processed.provider,
    processingStatus: processed.status,
    publicUrl: input.originalUrl,
    qualityStatus: processed.qualityStatus,
    safeMessage: processed.safeMessage,
    sizeBytes: input.originalFile.size,
    width: processed.width,
  };
}

export async function processCoachImageCutout(
  input: ProcessCoachImageInput
): Promise<ProcessedCutout> {
  const attemptErrorCodes: string[] = [];
  const originalBytes = new Uint8Array(await input.originalFile.arrayBuffer());
  const originalInspection = inspectTransparentImage(originalBytes, input.originalFile.type, input.env);

  if (originalInspection.ok) {
    return {
      attemptErrorCodes,
      bytes: originalBytes,
      contentType: originalInspection.contentType,
      errorCode: "",
      fallbackMode: "cutout",
      height: originalInspection.height,
      provider: "already-transparent",
      qualityStatus: "passed",
      safeMessage: "Coach photo is ready.",
      status: "cutout_ready",
      width: originalInspection.width,
    };
  }

  if (!isImageProcessingEnabled(input.env.IMAGE_BG_REMOVAL_ENABLED)) {
    return framedFallback({
      attemptErrorCodes: ["processing_disabled"],
      errorCode: "processing_disabled",
      provider: "none",
      status: "disabled",
    });
  }

  const preference = normalizeProviderPreference(
    input.providerOverride || input.env.IMAGE_BG_REMOVAL_PROVIDER
  );
  const providers = getProviderOrder(preference);
  for (const provider of providers) {
    const key = provider === "photoroom" ? input.env.PHOTOROOM_API_KEY : input.env.REMOVEBG_API_KEY;
    if (!key?.trim()) {
      attemptErrorCodes.push(`${provider}_not_configured`);
      continue;
    }

    const providerResult = await requestProviderCutout({
      apiKey: key.trim(),
      fetcher: input.fetcher || fetch,
      file: input.originalFile,
      provider,
    });
    if (!providerResult.ok) {
      attemptErrorCodes.push(providerResult.errorCode);
      continue;
    }

    const inspection = inspectTransparentImage(
      providerResult.bytes,
      providerResult.contentType,
      input.env
    );
    if (!inspection.ok) {
      attemptErrorCodes.push(`${provider}_${inspection.errorCode}`);
      continue;
    }

    return {
      attemptErrorCodes,
      bytes: providerResult.bytes,
      contentType: inspection.contentType,
      errorCode: "",
      fallbackMode: "cutout",
      height: inspection.height,
      provider,
      qualityStatus: "passed",
      safeMessage: "Coach photo is ready.",
      status: "cutout_ready",
      width: inspection.width,
    };
  }

  if (input.clientCutoutFile) {
    const localBytes = new Uint8Array(await input.clientCutoutFile.arrayBuffer());
    const inspection = inspectTransparentImage(localBytes, input.clientCutoutFile.type, input.env);
    if (inspection.ok) {
      return {
        attemptErrorCodes,
        bytes: localBytes,
        contentType: inspection.contentType,
        errorCode: attemptErrorCodes.at(-1) || "",
        fallbackMode: "cutout",
        height: inspection.height,
        provider: "local-browser",
        qualityStatus: "passed",
        safeMessage: "Coach photo is ready using the local fallback.",
        status: "cutout_ready",
        width: inspection.width,
      };
    }
    attemptErrorCodes.push(`local_${inspection.errorCode}`);
  }

  const noConfiguredProvider = providers.every((provider) =>
    provider === "photoroom"
      ? !input.env.PHOTOROOM_API_KEY?.trim()
      : !input.env.REMOVEBG_API_KEY?.trim()
  );

  return framedFallback({
    attemptErrorCodes,
    errorCode: attemptErrorCodes.at(-1) || "cutout_unavailable",
    provider: "none",
    status: noConfiguredProvider ? "not_configured" : "framed_fallback",
  });
}

export function isOwnedCoachOriginalObjectKey(objectKey: string, slug: string) {
  if (!objectKey || objectKey.includes("..") || objectKey.includes("\\")) return false;
  return objectKey.startsWith(`coach-sites/${slug}/image/original/`);
}

function framedFallback({
  attemptErrorCodes,
  errorCode,
  provider,
  status,
}: {
  attemptErrorCodes: string[];
  errorCode: string;
  provider: CoachImageProvider;
  status: "disabled" | "framed_fallback" | "not_configured";
}): ProcessedCutout {
  return {
    attemptErrorCodes,
    errorCode,
    fallbackMode: "framed",
    provider,
    qualityStatus: "needs_manual_review",
    safeMessage:
      "We could not create a clean cutout, so we used a premium portrait frame instead.",
    status,
  };
}

async function requestProviderCutout({
  apiKey,
  fetcher,
  file,
  provider,
}: {
  apiKey: string;
  fetcher: typeof fetch;
  file: File;
  provider: "photoroom" | "removebg";
}) {
  const formData = new FormData();
  formData.append("image_file", file, file.name);
  if (provider === "removebg") {
    formData.append("format", "png");
    formData.append("size", "auto");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetcher(
      provider === "photoroom"
        ? "https://sdk.photoroom.com/v1/segment"
        : "https://api.remove.bg/v1.0/removebg",
      {
        body: formData,
        headers:
          provider === "photoroom"
            ? { accept: "image/png", "x-api-key": apiKey }
            : { accept: "image/png", "X-Api-Key": apiKey },
        method: "POST",
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return {
        errorCode: `${provider}_http_${normalizeHttpStatus(response.status)}`,
        ok: false as const,
      };
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      bytes,
      contentType: response.headers.get("content-type") || "image/png",
      ok: true as const,
    };
  } catch (error) {
    return {
      errorCode:
        error instanceof DOMException && error.name === "AbortError"
          ? `${provider}_timeout`
          : `${provider}_request_failed`,
      ok: false as const,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function inspectTransparentImage(
  bytes: Uint8Array,
  declaredContentType: string,
  env: CoachImageProcessingEnv
) {
  if (bytes.byteLength < MIN_PROCESSED_IMAGE_BYTES) {
    return { errorCode: "output_too_small", ok: false as const };
  }
  if (bytes.byteLength > MAX_PROCESSED_IMAGE_BYTES) {
    return { errorCode: "output_too_large", ok: false as const };
  }

  const contentType = detectImageContentType(bytes, declaredContentType);
  const dimensions =
    contentType === "image/png" ? readPngDimensions(bytes) : readWebpDimensions(bytes);
  if (!dimensions) return { errorCode: "invalid_image", ok: false as const };
  if (!hasTransparentChannel(bytes, contentType)) {
    return { errorCode: "missing_alpha", ok: false as const };
  }

  const minimumDimension = getMinimumDimension(env.IMAGE_BG_REMOVAL_QUALITY_THRESHOLD);
  if (Math.min(dimensions.width, dimensions.height) < minimumDimension) {
    return { errorCode: "low_resolution", ok: false as const };
  }

  return {
    contentType,
    height: dimensions.height,
    ok: true as const,
    width: dimensions.width,
  };
}

function detectImageContentType(bytes: Uint8Array, declaredContentType: string) {
  if (isPng(bytes)) return "image/png" as const;
  if (isWebp(bytes)) return "image/webp" as const;
  const normalized = normalizeImageContentType(declaredContentType);
  return normalized === "image/webp" ? "image/webp" : "image/png";
}

function isPng(bytes: Uint8Array) {
  return (
    bytes.length > 32 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a &&
    asciiAt(bytes, 12, "IHDR") &&
    includesAscii(bytes, "IEND")
  );
}

function isWebp(bytes: Uint8Array) {
  return bytes.length > 30 && asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP");
}

function readPngDimensions(bytes: Uint8Array) {
  if (!isPng(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { height, width } : null;
}

function readWebpDimensions(bytes: Uint8Array) {
  if (!isWebp(bytes) || !asciiAt(bytes, 12, "VP8X")) return null;
  const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
  const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
  return width > 0 && height > 0 ? { height, width } : null;
}

function hasTransparentChannel(bytes: Uint8Array, contentType: "image/png" | "image/webp") {
  if (contentType === "image/png") {
    const colorType = bytes[25];
    return colorType === 4 || colorType === 6 || includesAscii(bytes, "tRNS");
  }
  return includesAscii(bytes, "ALPH") || (asciiAt(bytes, 12, "VP8X") && (bytes[20] & 0x10) !== 0);
}

function asciiAt(bytes: Uint8Array, offset: number, value: string) {
  return Array.from(value).every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function includesAscii(bytes: Uint8Array, value: string) {
  const target = Array.from(value).map((character) => character.charCodeAt(0));
  for (let index = 0; index <= bytes.length - target.length; index += 1) {
    if (target.every((byte, targetIndex) => bytes[index + targetIndex] === byte)) return true;
  }
  return false;
}

function createCoachImageObjectKey(slug: string, variant: "cutout" | "original", extension: ".png" | ".webp") {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return `coach-sites/${slug}/image/${variant}/${timestamp}-${crypto.randomUUID()}${extension}`;
}

function replaceFileExtension(fileName: string, extension: ".png" | ".webp") {
  const baseName = fileName.replace(/\.[a-z0-9]+$/i, "") || "coach-photo";
  return `${baseName}-cutout${extension}`;
}

function getObjectFileName(objectKey: string) {
  return objectKey.split("/").at(-1) || "coach-photo.jpg";
}

function normalizeImageContentType(value: string) {
  const normalized = value.split(";")[0].trim().toLowerCase();
  if (normalized === "image/x-png") return "image/png";
  if (normalized === "image/pjpeg") return "image/jpeg";
  return normalized.startsWith("image/") ? normalized : "image/jpeg";
}

function normalizeProviderPreference(value: unknown): CoachImageProviderPreference {
  return value === "photoroom" || value === "removebg" ? value : "auto";
}

function getProviderOrder(preference: CoachImageProviderPreference) {
  if (preference === "removebg") return ["removebg"] as const;
  if (preference === "photoroom") return ["photoroom"] as const;
  return ["photoroom", "removebg"] as const;
}

function isImageProcessingEnabled(value: string | undefined) {
  return !["0", "false", "no", "off", "disabled"].includes((value || "true").trim().toLowerCase());
}

function getMinimumDimension(value: string | undefined) {
  const normalized = (value || "high").trim().toLowerCase();
  if (normalized === "low") return 64;
  if (normalized === "medium" || normalized === "standard") return 128;
  return 256;
}

function normalizeHttpStatus(status: number) {
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 500;
}

export type CoachMediaBucket = R2Bucket;
