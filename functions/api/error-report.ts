import { createErrorReferenceId, type PublicWebsiteErrorCategory } from "../../lib/error-reporting";

type PagesContext = {
  request: Request;
};

type PublicErrorReportBody = {
  browser?: unknown;
  category?: unknown;
  coachSlug?: unknown;
  digest?: unknown;
  funnelStep?: unknown;
  pagePath?: unknown;
  referenceId?: unknown;
  referrer?: unknown;
  safeMessage?: unknown;
  screenSize?: unknown;
  userAction?: unknown;
};

const ALLOWED_CATEGORIES = new Set<PublicWebsiteErrorCategory>([
  "admin_action_issue",
  "ai_generation_issue",
  "analytics_issue",
  "api_error",
  "authentication_issue",
  "coach_site_issue",
  "form_issue",
  "link_missing",
  "network_or_server_failure",
  "payment_flow_issue",
  "route_not_found",
  "ui_crash",
  "unknown",
  "video_issue"
]);

export async function onRequest({ request }: PagesContext) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody(request);
  const category = normalizeCategory(body?.category);
  const referenceId =
    readText(body?.referenceId, 40) || createErrorReferenceId(readText(body?.pagePath, 80));

  return json({
    category,
    message:
      "Error report accepted by placeholder service. Persistence waits for database approval.",
    ok: true,
    persisted: false,
    referenceId
  });
}

async function readJsonBody(request: Request) {
  try {
    const payload = (await request.json()) as unknown;

    return isRecord(payload) ? (payload as PublicErrorReportBody) : null;
  } catch {
    return null;
  }
}

function normalizeCategory(value: unknown): PublicWebsiteErrorCategory {
  const category = readText(value, 80) as PublicWebsiteErrorCategory;

  return ALLOWED_CATEGORIES.has(category) ? category : "unknown";
}

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
