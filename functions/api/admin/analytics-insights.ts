import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireAdmin } from "../../../lib/server/admin-auth";
import {
  generateAdminAiAnalyticsInsight,
  type AdminAiAnalyticsScope
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

  if (!scope || !payload) {
    return adminJson({ ok: false, error: "AI analytics scope and payload are required." }, 400);
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
        coachSlug: scope === "coach" ? getCoachSlugFromPayload(payload) : "",
        digest: "admin-ai-analytics-failed",
        errorCode: "",
        funnelStep: scope === "overview" ? "admin-overview-ai-analytics" : "coach-ai-analytics",
        missingSupportFields: [],
        pagePath: "/admin/dashboard",
        referenceId: "",
        referrer: "",
        safeMessage: "AI analytics generation failed.",
        screenSize: "",
        supportSource: "default",
        technicalDetails: "OpenAI analytics request failed or returned invalid structured output.",
        userAction:
          scope === "overview" ? "generate_overview_ai_insights" : "generate_coach_ai_insights"
      },
      env
    );

    return adminJson(
      {
        configured: true,
        message: result.message,
        ok: false
      },
      502
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

function parseScope(value: unknown): AdminAiAnalyticsScope | null {
  return value === "overview" || value === "coach" ? value : null;
}

function parseText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function getCoachSlugFromPayload(payload: unknown) {
  if (!isRecord(payload)) return "";
  const coach = payload.coach;
  if (!isRecord(coach)) return "";

  return parseText(coach.slug, 120);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
