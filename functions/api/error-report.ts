import type { D1Database } from "@cloudflare/workers-types";
import {
  createSupportErrorReference,
  getPublicSupportErrorCode,
  normalizePublicErrorCategory
} from "../../lib/error-reporting";
import { insertWebsiteErrorReport } from "../../lib/server/error-reports";

type Env = {
  ADMIN_DB?: D1Database;
};

type PagesContext = {
  env?: Env;
  request: Request;
};

type PublicErrorReportBody = {
  browser?: unknown;
  category?: unknown;
  coachSlug?: unknown;
  digest?: unknown;
  errorCode?: unknown;
  funnelStep?: unknown;
  missingSupportFields?: unknown;
  pagePath?: unknown;
  referenceId?: unknown;
  referrer?: unknown;
  safeMessage?: unknown;
  screenSize?: unknown;
  supportSource?: unknown;
  technicalDetails?: unknown;
  userAction?: unknown;
};

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody(request);
  const category = normalizePublicErrorCategory(readText(body?.category, 80));
  const referenceId =
    readText(body?.referenceId, 80) ||
    createSupportErrorReference(category, readText(body?.pagePath, 80));
  const errorCode = readText(body?.errorCode, 24) || getPublicSupportErrorCode(category);
  const persistence = await insertWebsiteErrorReport(
    {
      browser: readText(body?.browser, 220),
      category,
      coachSlug: readText(body?.coachSlug, 120),
      digest: readText(body?.digest, 240),
      errorCode,
      funnelStep: readText(body?.funnelStep, 120),
      missingSupportFields: readStringArray(body?.missingSupportFields),
      pagePath: readText(body?.pagePath, 220),
      referenceId,
      referrer: readText(body?.referrer, 240),
      safeMessage: readText(body?.safeMessage, 320) || "We could not complete this step.",
      screenSize: readText(body?.screenSize, 40),
      supportSource: readText(body?.supportSource, 20),
      technicalDetails: readText(body?.technicalDetails, 1200),
      userAction: readText(body?.userAction, 160)
    },
    env || {}
  );

  return json({
    category,
    errorCode,
    ok: true,
    persisted: persistence.persisted,
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

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength) : "";
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.map((item) => readText(item, 80)).filter(Boolean);
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
