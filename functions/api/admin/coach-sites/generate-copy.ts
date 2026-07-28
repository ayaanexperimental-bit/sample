import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireAdmin } from "../../../../lib/server/admin-auth";
import {
  consumeCoachCopyUsage,
  type CoachCopyAiInput,
  type CoachCopyAiFailure,
  getCoachCopyRequestPreflight,
  generateCoachSiteCopyWithAi
} from "../../../../lib/server/coach-copy-ai";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  AI_ANALYTICS_MODEL?: string;
  AI_COPY_MODEL?: string;
  AI_COPY_REQUEST_TIMEOUT_MS?: string;
  AI_ENABLE_CACHING?: string;
  AI_EXTRACT_MODEL?: string;
  AI_MAX_INPUT_TOKENS?: string;
  AI_MAX_OUTPUT_TOKENS?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type GenerateCopyBody = {
  bio?: unknown;
  coachName?: unknown;
  confirmLargeRequest?: unknown;
  existingPaidFunnelUrl?: unknown;
  hasGoogleFormUrl?: unknown;
  hasSupportContact?: unknown;
  heroMediaType?: unknown;
  location?: unknown;
  niche?: unknown;
  paidFunnelContext?: unknown;
  registerButtonText?: unknown;
  scope?: unknown;
  supportText?: unknown;
  vision?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const admin = await requireAdmin(request, env, {
    requireCsrf: true,
    requiredPermission: "website_creator.ai_copy"
  });
  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody<GenerateCopyBody>(request);
  const input = parseGenerateCopyBody(body);
  if (!input) {
    return adminJson({ ok: false, error: "Coach name and coach niche are required." }, 400);
  }

  if (env.OPENAI_API_KEY?.trim()) {
    const preflight = getCoachCopyRequestPreflight(input, env);
    if (preflight.confirmationRequired && body?.confirmLargeRequest !== true) {
      return adminJson(
        {
          code: "large_input_confirmation_required",
          confirmationRequired: true,
          configured: true,
          message: "This AI copy request is large. Confirm it before using provider capacity.",
          ok: false,
          usageEstimate: preflight.usageEstimate
        },
        409
      );
    }

    const usageLimit = await consumeCoachCopyUsage(admin.admin.email, env);
    if (!usageLimit.allowed) {
      return usageLimit.reason === "limit"
        ? requestLimitResponse(env, usageLimit.retryAfterSeconds)
        : usageLimitUnavailableResponse(env, usageLimit.retryAfterSeconds);
    }
  }

  const result = await generateCoachSiteCopyWithAi(input, env);
  if (!result.ok && !result.configured) {
    return adminJson(
      {
        configured: false,
        message: result.message,
        ok: false
      },
      503
    );
  }

  if (!result.ok) {
    return adminJson(
      {
        configured: true,
        failure: result.failure,
        message: result.message,
        ok: false
      },
      result.failure.retryable ? 503 : 502,
      retryHeaders(result.failure)
    );
  }

  return adminJson({
    cache: result.cache,
    configured: true,
    content: result.content,
    ok: true,
    usageEstimate: result.usageEstimate
  });
}

function requestLimitResponse(env: Env, retryAfterSeconds: number) {
  const failure: CoachCopyAiFailure = {
    attempts: 0,
    code: "request_limit",
    retryAfterSeconds,
    retryable: true
  };
  return adminJson(
    {
      configured: Boolean(env.OPENAI_API_KEY?.trim()),
      failure,
      message: "AI copy request limit reached. Try again shortly.",
      ok: false
    },
    429,
    retryHeaders(failure)
  );
}

function usageLimitUnavailableResponse(env: Env, retryAfterSeconds: number) {
  const failure: CoachCopyAiFailure = {
    attempts: 0,
    code: "usage_limit_unavailable",
    retryAfterSeconds,
    retryable: true
  };
  return adminJson(
    {
      configured: Boolean(env.OPENAI_API_KEY?.trim()),
      failure,
      message: "AI copy usage controls are unavailable. Try again shortly.",
      ok: false
    },
    503,
    retryHeaders(failure)
  );
}

function retryHeaders(failure: CoachCopyAiFailure): Record<string, string> {
  return failure.retryAfterSeconds ? { "retry-after": String(failure.retryAfterSeconds) } : {};
}

function parseGenerateCopyBody(body: GenerateCopyBody | null): CoachCopyAiInput | null {
  const coachName = typeof body?.coachName === "string" ? body.coachName.trim() : "";
  const niche = typeof body?.niche === "string" ? body.niche.trim() : "";
  if (!coachName || !niche) return null;

  return {
    bio: typeof body?.bio === "string" ? body.bio.trim().slice(0, 1200) : "",
    coachName: coachName.slice(0, 160),
    existingPaidFunnelUrl:
      typeof body?.existingPaidFunnelUrl === "string"
        ? body.existingPaidFunnelUrl.trim().slice(0, 1200)
        : "",
    hasGoogleFormUrl: body?.hasGoogleFormUrl === true,
    hasSupportContact: body?.hasSupportContact === true,
    heroMediaType:
      body?.heroMediaType === "image" ||
      body?.heroMediaType === "none" ||
      body?.heroMediaType === "video"
        ? body.heroMediaType
        : "none",
    location: typeof body?.location === "string" ? body.location.trim().slice(0, 160) : "",
    niche: niche.slice(0, 160),
    paidFunnelContext:
      typeof body?.paidFunnelContext === "string"
        ? body.paidFunnelContext.trim().slice(0, 7000)
        : "",
    registerButtonText:
      typeof body?.registerButtonText === "string"
        ? body.registerButtonText.trim().slice(0, 80)
        : "",
    scope: parseCopyScope(body?.scope),
    supportText: typeof body?.supportText === "string" ? body.supportText.trim().slice(0, 400) : "",
    vision: typeof body?.vision === "string" ? body.vision.trim().slice(0, 1200) : ""
  };
}

function parseCopyScope(value: unknown): CoachCopyAiInput["scope"] {
  return value === "benefits" ||
    value === "cta" ||
    value === "faq" ||
    value === "footer" ||
    value === "hero" ||
    value === "intro" ||
    value === "journey" ||
    value === "media" ||
    value === "problem" ||
    value === "vision"
    ? value
    : "all";
}
