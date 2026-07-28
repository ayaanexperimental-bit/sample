import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireAdmin } from "../../../lib/server/admin-auth";
import {
  consumeAdminAiAnalyticsUsage,
  generateAdminAiAnalyticsInsight,
  type AdminAiAnalyticsFailure,
  type AdminAiAnalyticsScope,
  validateAdminAiAnalyticsPayload
} from "../../../lib/server/admin-ai-analytics";
import { insertWebsiteErrorReport } from "../../../lib/server/error-reports";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  AI_ANALYTICS_MODEL?: string;
  AI_ANALYTICS_REQUEST_TIMEOUT_MS?: string;
  AI_COPY_MODEL?: string;
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

type AnalyticsInsightBody = {
  dateRange?: unknown;
  forceRefresh?: unknown;
  payload?: unknown;
  scope?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const admin = await requireAdmin(request, env, {
    requireCsrf: true,
    requiredPermission: "coach_analytics.ai_insights"
  });
  if (!admin.ok) return admin.response;

  const body = await readJsonBody<AnalyticsInsightBody>(request);
  const scope = parseScope(body?.scope);
  const dateRange = parseText(body?.dateRange, 80) || "Selected period";
  const payload = body?.payload;

  if (!scope || payload === undefined || payload === null) {
    return adminJson({ ok: false, error: "AI analytics scope and payload are required." }, 400);
  }
  if (!validateAdminAiAnalyticsPayload(payload, scope)) {
    return adminJson(
      {
        ok: false,
        error: "AI analytics payload must include supported aggregate metrics."
      },
      400
    );
  }

  if (env.OPENAI_API_KEY?.trim()) {
    const usageLimit = await consumeAdminAiAnalyticsUsage(admin.admin.email, env);
    if (!usageLimit.allowed) {
      return usageLimit.reason === "limit"
        ? requestLimitResponse(env, usageLimit.retryAfterSeconds)
        : usageLimitUnavailableResponse(env, usageLimit.retryAfterSeconds);
    }
  }

  const result = await generateAdminAiAnalyticsInsight(
    {
      dateRange,
      forceRefresh: body?.forceRefresh === true,
      payload,
      scope
    },
    env
  );

  if (!result.ok && !result.configured) {
    return adminJson(
      {
        configured: false,
        fallback: "core-admin-analytics",
        message: result.message,
        ok: false
      },
      503
    );
  }

  if (!result.ok) {
    await insertWebsiteErrorReport(
      {
        browser: request.headers.get("user-agent") || "admin-api",
        category: "ai_generation_issue",
        coachSlug: "",
        digest: `admin-ai-analytics-${result.failure.code}`,
        errorCode: result.failure.code,
        funnelStep: scope === "overview" ? "admin-overview-ai-analytics" : "coach-ai-analytics",
        missingSupportFields: [],
        pagePath: "/admin/dashboard",
        referenceId: "",
        referrer: "",
        safeMessage: "AI analytics generation failed.",
        screenSize: "",
        supportSource: "default",
        technicalDetails: `Admin AI provider failure (${result.failure.code}) after ${result.failure.attempts} attempt(s).`,
        userAction:
          scope === "overview" ? "generate_overview_ai_insights" : "generate_coach_ai_insights"
      },
      env
    );

    return adminJson(
      {
        configured: true,
        failure: result.failure,
        fallback: "core-admin-analytics",
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
    insight: result.insight,
    ok: true,
    usageEstimate: result.usageEstimate
  });
}

function requestLimitResponse(env: Env, retryAfterSeconds: number) {
  const failure: AdminAiAnalyticsFailure = {
    attempts: 0,
    code: "request_limit",
    retryAfterSeconds,
    retryable: true
  };
  return adminJson(
    {
      configured: Boolean(env.OPENAI_API_KEY?.trim()),
      failure,
      fallback: "core-admin-analytics",
      message: "AI analytics request limit reached. Core admin analytics remain available.",
      ok: false
    },
    429,
    retryHeaders(failure)
  );
}

function usageLimitUnavailableResponse(env: Env, retryAfterSeconds: number) {
  const failure: AdminAiAnalyticsFailure = {
    attempts: 0,
    code: "usage_limit_unavailable",
    retryAfterSeconds,
    retryable: true
  };
  return adminJson(
    {
      configured: Boolean(env.OPENAI_API_KEY?.trim()),
      failure,
      fallback: "core-admin-analytics",
      message:
        "AI analytics usage controls are unavailable. Core admin analytics remain available.",
      ok: false
    },
    503,
    retryHeaders(failure)
  );
}

function retryHeaders(failure: AdminAiAnalyticsFailure): Record<string, string> {
  return failure.retryAfterSeconds ? { "retry-after": String(failure.retryAfterSeconds) } : {};
}

function parseScope(value: unknown): AdminAiAnalyticsScope | null {
  return value === "overview" || value === "coach" ? value : null;
}

function parseText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}
