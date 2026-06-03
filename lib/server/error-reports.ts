import type { D1Database } from "@cloudflare/workers-types";
import type { AdminErrorReport, AdminErrorReportStatus } from "../admin-control-center";
import {
  getSupportErrorDefinition,
  getSupportErrorCode,
  normalizeWebsiteErrorCategory,
  type WebsiteErrorCategory
} from "../error-codes";
import { maskSensitiveText } from "../error-reporting";

export type ErrorReportEnv = {
  ADMIN_DB?: D1Database;
};

export type PublicErrorReportPayload = {
  browser: string;
  category: WebsiteErrorCategory | string;
  coachSlug: string;
  digest: string;
  errorCode: string;
  funnelStep: string;
  missingSupportFields: string[];
  pagePath: string;
  referenceId: string;
  referrer: string;
  safeMessage: string;
  screenSize: string;
  supportSource: "coach" | "default" | string;
  technicalDetails: string;
  userAction: string;
};

type ErrorReportRow = {
  admin_notes: string;
  browser: string;
  category: string;
  coach_slug: string;
  created_at: number | string;
  device_type: "desktop" | "mobile" | "tablet" | "unknown";
  error_code: string;
  funnel_step: string;
  missing_support_fields: string;
  page_path: string;
  reference_id: string;
  referrer: string;
  safe_message: string;
  screen_size: string;
  session_id: string;
  severity: "high" | "low" | "medium";
  status: AdminErrorReportStatus;
  support_source: "coach" | "default";
  technical_details: string;
  updated_at: number | string;
  user_action: string;
};

const ERROR_REPORT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS error_reports (
    id TEXT PRIMARY KEY,
    reference_id TEXT NOT NULL UNIQUE,
    error_code TEXT NOT NULL,
    category TEXT NOT NULL,
    safe_message TEXT NOT NULL,
    page_path TEXT NOT NULL DEFAULT '',
    user_action TEXT NOT NULL DEFAULT '',
    coach_slug TEXT NOT NULL DEFAULT '',
    funnel_step TEXT NOT NULL DEFAULT '',
    browser TEXT NOT NULL DEFAULT '',
    screen_size TEXT NOT NULL DEFAULT '',
    referrer TEXT NOT NULL DEFAULT '',
    device_type TEXT NOT NULL DEFAULT 'unknown',
    support_source TEXT NOT NULL DEFAULT 'default',
    missing_support_fields TEXT NOT NULL DEFAULT '',
    technical_details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'New',
    admin_notes TEXT NOT NULL DEFAULT '',
    session_id TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'medium',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_error_reports_status_created_at
   ON error_reports (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_error_reports_category_created_at
   ON error_reports (category, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_error_reports_coach_slug_created_at
   ON error_reports (coach_slug, created_at DESC)`
];

export async function insertWebsiteErrorReport(payload: PublicErrorReportPayload, env: ErrorReportEnv) {
  if (!env.ADMIN_DB) return { persisted: false as const, reason: "ADMIN_DB not configured" };

  try {
    await ensureErrorReportsSchema(env.ADMIN_DB);

    const category = normalizeWebsiteErrorCategory(payload.category);
    const definition = getSupportErrorDefinition(category);
    const now = getNowSeconds();
    const referenceId = readText(payload.referenceId, 80) || createServerReferenceId(category);
    const errorCode = readText(payload.errorCode, 24) || getSupportErrorCode(category);
    const safeMessage = readText(payload.safeMessage, 320) || definition.publicMessage;
    const screenSize = readText(payload.screenSize, 40);
    const browser = readText(maskSensitiveText(payload.browser), 220);

    await env.ADMIN_DB.prepare(
      `INSERT INTO error_reports (
        id,
        reference_id,
        error_code,
        category,
        safe_message,
        page_path,
        user_action,
        coach_slug,
        funnel_step,
        browser,
        screen_size,
        referrer,
        device_type,
        support_source,
        missing_support_fields,
        technical_details,
        status,
        admin_notes,
        session_id,
        severity,
        created_at,
        updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 'New', '', ?17, ?18, ?19, ?19)
      ON CONFLICT(reference_id) DO UPDATE SET
        safe_message = excluded.safe_message,
        page_path = excluded.page_path,
        user_action = excluded.user_action,
        browser = excluded.browser,
        screen_size = excluded.screen_size,
        referrer = excluded.referrer,
        device_type = excluded.device_type,
        support_source = excluded.support_source,
        missing_support_fields = excluded.missing_support_fields,
        technical_details = excluded.technical_details,
        updated_at = excluded.updated_at`
    )
      .bind(
        referenceId,
        referenceId,
        errorCode,
        category,
        safeMessage,
        readText(payload.pagePath, 220),
        readText(payload.userAction, 160),
        readText(payload.coachSlug, 120),
        readText(payload.funnelStep, 120),
        browser,
        screenSize,
        readText(maskSensitiveText(payload.referrer), 240),
        detectDeviceType(screenSize, browser),
        payload.supportSource === "coach" ? "coach" : "default",
        payload.missingSupportFields.map((item) => readText(item, 80)).filter(Boolean).join(", "),
        readText(maskSensitiveText(payload.technicalDetails || payload.digest), 1200),
        createSessionId(browser, payload.pagePath),
        definition.severity,
        now
      )
      .run();

    return { persisted: true as const, referenceId };
  } catch {
    return { persisted: false as const, reason: "error_reports insert failed" };
  }
}

export async function listWebsiteErrorReports(env: ErrorReportEnv, limit = 100) {
  if (!env.ADMIN_DB) return null;

  try {
    await ensureErrorReportsSchema(env.ADMIN_DB);

    const result = await env.ADMIN_DB.prepare(
      `SELECT *
       FROM error_reports
       ORDER BY created_at DESC
       LIMIT ?1`
    )
      .bind(Math.max(1, Math.min(limit, 200)))
      .all<ErrorReportRow>();

    return (result.results || []).map(mapRowToAdminErrorReport);
  } catch {
    return null;
  }
}

export async function updateWebsiteErrorReportStatus({
  adminNotes,
  env,
  referenceId,
  status
}: {
  adminNotes?: string;
  env: ErrorReportEnv;
  referenceId: string;
  status: AdminErrorReportStatus;
}) {
  if (!env.ADMIN_DB) return { ok: false as const, error: "Error report database is not configured." };

  try {
    await ensureErrorReportsSchema(env.ADMIN_DB);

    const now = getNowSeconds();
    await env.ADMIN_DB.prepare(
      `UPDATE error_reports
       SET status = ?1,
           admin_notes = ?2,
           updated_at = ?3
       WHERE reference_id = ?4`
    )
      .bind(status, readText(adminNotes || "", 1000), now, readText(referenceId, 80))
      .run();

    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Error report status could not be updated." };
  }
}

export async function ensureErrorReportsSchema(db: D1Database) {
  for (const statement of ERROR_REPORT_SCHEMA) {
    await db.prepare(statement).run();
  }
}

function mapRowToAdminErrorReport(row: ErrorReportRow): AdminErrorReport {
  const definition = getSupportErrorDefinition(row.category);

  return {
    adminNotes: row.admin_notes || "",
    browser: row.browser || "unknown",
    category: definition.label as AdminErrorReport["category"],
    coachSlug: row.coach_slug || undefined,
    createdAt: secondsToIso(row.created_at) || "Unknown",
    deviceType: row.device_type || "unknown",
    errorCode: row.error_code || definition.code,
    funnelStep: row.funnel_step || undefined,
    missingSupportFields: row.missing_support_fields || "",
    pagePath: row.page_path || "unknown",
    referenceId: row.reference_id,
    referrer: row.referrer || "direct",
    safeMessage: row.safe_message || definition.publicMessage,
    screenSize: row.screen_size || "unknown",
    sessionId: row.session_id || "unknown",
    severity: row.severity || definition.severity,
    status: row.status || "New",
    supportSource: row.support_source || "default",
    technicalDetails: row.technical_details || "",
    updatedAt: secondsToIso(row.updated_at) || "Unknown",
    userAction: row.user_action || "unknown"
  };
}

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength) : "";
}

function detectDeviceType(screenSize: string, browser: string): "desktop" | "mobile" | "tablet" | "unknown" {
  const width = Number(screenSize.split("x")[0]);
  if (Number.isFinite(width) && width > 0) {
    if (width < 640) return "mobile";
    if (width < 1100) return "tablet";
    return "desktop";
  }

  if (/Mobile|Android|iPhone/i.test(browser)) return "mobile";
  if (/iPad|Tablet/i.test(browser)) return "tablet";

  return "unknown";
}

function createServerReferenceId(category: WebsiteErrorCategory) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `${getSupportErrorCode(category)}-${suffix}`;
}

function createSessionId(browser: string, pagePath: string) {
  const input = `${browser}:${pagePath}`.slice(0, 180);
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return `safe-${hash.toString(16)}`;
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function secondsToIso(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;

  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds)) return null;

  return new Date(seconds * 1000).toISOString();
}
