import type { D1Database } from "@cloudflare/workers-types";
import {
  ANALYTICS_EVENT_NAMES,
  type AnalyticsEventName,
  type AnalyticsFunnelType
} from "../../lib/analytics-events";
import { createSupportErrorReference, getPublicSupportErrorCode } from "../../lib/error-reporting";
import { recordAnalyticsEvent } from "../../lib/server/analytics-events";
import { insertWebsiteErrorReport } from "../../lib/server/error-reports";

type Env = {
  ADMIN_DB?: D1Database;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type CoachEventBody = {
  coachSlug?: unknown;
  eventName?: unknown;
  funnelId?: unknown;
  funnelType?: unknown;
  metadata?: unknown;
  pagePath?: unknown;
  pageUrl?: unknown;
  referrer?: unknown;
  sessionId?: unknown;
  source?: unknown;
};

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody(request);
  const eventName = typeof body?.eventName === "string" ? body.eventName : "";
  const coachSlug = typeof body?.coachSlug === "string" ? sanitizeSlug(body.coachSlug) : "";
  const funnelId = typeof body?.funnelId === "string" ? sanitizeToken(body.funnelId) : "";
  const funnelType = parseFunnelType(body?.funnelType);
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.slice(0, 240) : "";
  const pageUrl = typeof body?.pageUrl === "string" ? body.pageUrl.slice(0, 500) : "";
  const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 240) : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 120) : "";
  const source = typeof body?.source === "string" ? body.source.slice(0, 120) : "";
  const metadata =
    body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : undefined;

  if (!isAllowedEvent(eventName) || (!coachSlug && !funnelId)) {
    return json({ ok: false, error: "Invalid event." }, 400);
  }

  try {
    const persisted = await recordAnalyticsEvent(
      {
        coachSlug,
        eventName,
        funnelId,
        funnelType,
        metadata,
        pagePath,
        pageUrl,
        referrer,
        request,
        sessionId,
        source
      },
      env
    );

    return json({
      event: {
        coachSlug,
        eventName,
        funnelId,
        funnelType,
        pagePath,
        referrer,
        sessionId,
        source
      },
      ok: true,
      persisted: persisted.persisted
    });
  } catch {
    await logAnalyticsWriteFailure({
      coachSlug,
      eventName,
      env,
      funnelType,
      pagePath,
      referrer,
      request
    });

    return json({
      event: {
        coachSlug,
        eventName,
        funnelId,
        funnelType,
        pagePath,
        referrer,
        sessionId,
        source
      },
      ok: true,
      persisted: false
    });
  }
}

async function logAnalyticsWriteFailure({
  coachSlug,
  eventName,
  env,
  funnelType,
  pagePath,
  referrer,
  request
}: {
  coachSlug: string;
  env: Env;
  eventName: AnalyticsEventName;
  funnelType: AnalyticsFunnelType;
  pagePath: string;
  referrer: string;
  request: Request;
}) {
  try {
    const referenceId = createSupportErrorReference("analytics_issue", coachSlug || eventName);

    await insertWebsiteErrorReport(
      {
        browser: request.headers.get("user-agent") || "",
        category: "analytics_issue",
        coachSlug,
        digest: "analytics_event_write_failed",
        errorCode: getPublicSupportErrorCode("analytics_issue"),
        funnelStep: funnelType,
        missingSupportFields: [],
        pagePath: pagePath || new URL(request.url).pathname,
        referenceId,
        referrer: referrer || request.headers.get("referer") || "",
        safeMessage: "Analytics event storage failed but public flow continued.",
        screenSize: "",
        supportSource: "default",
        technicalDetails: "Analytics event insert or aggregate update failed.",
        userAction: eventName
      },
      env
    );
  } catch {
    // Error-report logging uses the same production DB path and must not block public journeys.
  }
}

function isAllowedEvent(value: string): value is AnalyticsEventName {
  return ANALYTICS_EVENT_NAMES.has(value as AnalyticsEventName);
}

function sanitizeToken(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, "")
    .slice(0, 120);
}

function parseFunnelType(value: unknown): AnalyticsFunnelType {
  return value === "paid_masterclass" || value === "free_guest_link"
    ? value
    : "free_guest_link";
}

function json(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

async function readJsonBody(request: Request): Promise<CoachEventBody | null> {
  try {
    const value = (await request.json()) as unknown;

    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as CoachEventBody)
      : null;
  } catch {
    return null;
  }
}

function sanitizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 72);
}
