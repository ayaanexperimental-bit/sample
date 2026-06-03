import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, requireAdmin } from "../../../lib/server/admin-auth";
import {
  ensureAnalyticsEventTables,
  getAnalyticsMetricSummaries,
  getAnalyticsRangeWindow,
  getRecentAnalyticsEvents,
  serializeAnalyticsRange
} from "../../../lib/server/analytics-events";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "GET" });
  }

  const admin = await requireAdmin(request, env, { requiredRole: "owner" });
  if (!admin.ok) return admin.response;

  if (!env.ADMIN_DB) {
    return adminJson({
      analyticsSummaries: [],
      configured: false,
      ok: true,
      source: "not-configured"
    });
  }

  try {
    await ensureAnalyticsEventTables(env);
    const url = new URL(request.url);
    const rangeWindow = getAnalyticsRangeWindow(url.searchParams.get("range"));
    const [analyticsSummaries, previousAnalyticsSummaries, recentEvents] = await Promise.all([
      getAnalyticsMetricSummaries(env, {
        rangeEnd: rangeWindow.rangeEnd,
        rangeStart: rangeWindow.rangeStart
      }),
      rangeWindow.previousStart && rangeWindow.previousEnd
        ? getAnalyticsMetricSummaries(env, {
            rangeEnd: rangeWindow.previousEnd,
            rangeStart: rangeWindow.previousStart
          })
        : Promise.resolve([]),
      getRecentAnalyticsEvents(env, 14)
    ]);

    return adminJson({
      analyticsSummaries,
      configured: true,
      ok: true,
      previousAnalyticsSummaries,
      range: serializeAnalyticsRange(rangeWindow),
      recentEvents,
      source: "d1_analytics_events"
    });
  } catch {
    return adminJson(
      {
        analyticsSummaries: [],
        configured: true,
        error: "Analytics event database read failed.",
        ok: false,
        source: "unavailable"
      },
      500
    );
  }
}
