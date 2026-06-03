import {
  createErrorReference,
  getSupportErrorCode,
  normalizeWebsiteErrorCategory,
  type WebsiteErrorCategory,
  type WebsiteErrorCode
} from "./error-codes";

export const DEFAULT_SUPPORT_NAME = readPublicEnv("NEXT_PUBLIC_SUPPORT_NAME", "Yours Wellness Support");
export const DEFAULT_SUPPORT_EMAIL = readPublicEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "support@ywcoach.com");
export const DEFAULT_SUPPORT_PHONE = readPublicEnv("NEXT_PUBLIC_SUPPORT_PHONE", "");
export const DEFAULT_SUPPORT_WHATSAPP = readPublicEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "");
export const DEFAULT_SUPPORT_MESSAGE = readPublicEnv(
  "NEXT_PUBLIC_SUPPORT_MESSAGE",
  "We could not complete this step. Please contact support for help."
);
export const DEFAULT_SUPPORT_PENDING_MESSAGE = "Support contact will be updated soon.";

export type PublicWebsiteErrorCategory = WebsiteErrorCategory;

export type WebsiteErrorLogInput = {
  category: PublicWebsiteErrorCategory;
  coachSlug?: string;
  digest?: string;
  errorCode?: WebsiteErrorCode;
  funnelStep?: string;
  missingSupportFields?: string[];
  pagePath?: string;
  referenceId: string;
  referrer?: string;
  safeMessage: string;
  supportSource?: "coach" | "default";
  technicalDetails?: string;
  userAction: string;
};

export function createErrorReferenceId(seed = "") {
  return createErrorReference("unknown", seed);
}

export function createSupportErrorReference(category: PublicWebsiteErrorCategory, seed = "") {
  return createErrorReference(category, seed);
}

export function getPublicSupportErrorCode(category: PublicWebsiteErrorCategory | string) {
  return getSupportErrorCode(category);
}

export function normalizePublicErrorCategory(category: PublicWebsiteErrorCategory | string) {
  return normalizeWebsiteErrorCategory(category);
}

export async function logWebsiteError(input: WebsiteErrorLogInput) {
  if (typeof window === "undefined") return false;

  try {
    const category = normalizePublicErrorCategory(input.category);
    const payload = {
      browser: window.navigator.userAgent.slice(0, 220),
      category,
      coachSlug: input.coachSlug || "",
      digest: maskSensitiveText(input.digest || ""),
      errorCode: input.errorCode || getPublicSupportErrorCode(category),
      funnelStep: input.funnelStep || "",
      missingSupportFields: input.missingSupportFields || [],
      pagePath: input.pagePath || window.location.pathname,
      referenceId: input.referenceId,
      referrer: (input.referrer || document.referrer || "direct").slice(0, 240),
      safeMessage: input.safeMessage,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      supportSource: input.supportSource || "default",
      technicalDetails: maskSensitiveText(input.technicalDetails || input.digest || ""),
      userAction: input.userAction
    };

    await fetch("/api/error-report", {
      body: JSON.stringify(payload),
      cache: "no-store",
      headers: {
        "content-type": "application/json"
      },
      keepalive: true,
      method: "POST"
    });

    return true;
  } catch {
    return false;
  }
}

export function maskSensitiveText(value: string) {
  return value
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[masked-openai-key]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [masked-token]")
    .replace(/https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9_-]+/g, "https://chat.whatsapp.com/[masked]")
    .replace(/([?&](?:key|token|secret|signature|payment_id|order_id)=)[^&\s]+/gi, "$1[masked]")
    .slice(0, 1200);
}

function readPublicEnv(name: string, fallback: string) {
  if (typeof process === "undefined") return fallback;

  return process.env[name] || fallback;
}
