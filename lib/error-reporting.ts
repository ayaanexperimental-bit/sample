export const DEFAULT_SUPPORT_EMAIL = readPublicEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "support@ywcoach.com");
export const DEFAULT_SUPPORT_PHONE = readPublicEnv("NEXT_PUBLIC_SUPPORT_PHONE", "");
export const DEFAULT_SUPPORT_WHATSAPP = readPublicEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "");

export type PublicWebsiteErrorCategory =
  | "admin_action_issue"
  | "ai_generation_issue"
  | "analytics_issue"
  | "api_error"
  | "authentication_issue"
  | "coach_site_issue"
  | "form_issue"
  | "link_missing"
  | "network_or_server_failure"
  | "payment_flow_issue"
  | "route_not_found"
  | "ui_crash"
  | "unknown"
  | "video_issue";

export type WebsiteErrorLogInput = {
  category: PublicWebsiteErrorCategory;
  coachSlug?: string;
  digest?: string;
  funnelStep?: string;
  pagePath?: string;
  referenceId: string;
  safeMessage: string;
  userAction: string;
};

export function createErrorReferenceId(seed = "") {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = createRandomSuffix(seed);

  return `ERR-${datePart}-${randomPart}`;
}

export async function logWebsiteError(input: WebsiteErrorLogInput) {
  if (typeof window === "undefined") return false;

  try {
    const payload = {
      browser: window.navigator.userAgent.slice(0, 180),
      category: input.category,
      coachSlug: input.coachSlug || "",
      digest: input.digest || "",
      funnelStep: input.funnelStep || "",
      pagePath: input.pagePath || window.location.pathname,
      referenceId: input.referenceId,
      referrer: document.referrer.slice(0, 240),
      safeMessage: input.safeMessage,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
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

function createRandomSuffix(seed: string) {
  const normalizedSeed = seed.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
  if (normalizedSeed.length >= 4) return normalizedSeed;

  const randomValues = new Uint8Array(4);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(randomValues);
  } else {
    for (let index = 0; index < randomValues.length; index += 1) {
      randomValues[index] = Math.floor(Math.random() * 255);
    }
  }

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomPart = Array.from(randomValues)
    .map((value) => alphabet[value % alphabet.length])
    .join("");

  return `${normalizedSeed}${randomPart}`.slice(0, 4).padEnd(4, "X");
}

function readPublicEnv(name: string, fallback: string) {
  if (typeof process === "undefined") return fallback;

  return process.env[name] || fallback;
}
