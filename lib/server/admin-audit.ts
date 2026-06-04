import type { D1Database } from "@cloudflare/workers-types";

export type AdminAuditEventType =
  | "backup_created"
  | "backup_test_email_sent"
  | "blocked_attempt"
  | "cleanup_completed"
  | "error_reports_cleared"
  | "forgot_password_requested"
  | "login_attempt"
  | "login_failed"
  | "logout"
  | "otp_failed"
  | "otp_requested"
  | "otp_verified"
  | "password_reset_requested";

export type AdminAuditEnv = {
  ADMIN_DB?: D1Database;
  ADMIN_SESSION_SECRET?: string;
};

export type AdminAuditEvent = {
  email?: string;
  env?: AdminAuditEnv;
  reason?: string;
  request: Request;
  type: AdminAuditEventType;
};

const MAX_AUDIT_REASON_LENGTH = 480;

export async function recordAdminAuditEvent(event: AdminAuditEvent) {
  const db = event.env?.ADMIN_DB;
  if (!db) return;

  try {
    await db
      .prepare(
        `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
        VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        event.type,
        normalizeAuditEmail(event.email),
        await createAuditReason(event),
        getNowSeconds()
      )
      .run();
  } catch {
    // Audit logging must never leak internals to users or crash the review UI.
  }
}

async function createAuditReason(event: AdminAuditEvent) {
  const url = new URL(event.request.url);
  const parts = [
    sanitizeAuditPart(event.reason),
    `path:${sanitizeAuditPart(url.pathname)}`,
    `fp:${await createRequestFingerprint(event.request, event.env)}`
  ].filter(Boolean);

  return parts.join("|").slice(0, MAX_AUDIT_REASON_LENGTH) || null;
}

async function createRequestFingerprint(request: Request, env?: AdminAuditEnv) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown-ip";
  const userAgent = request.headers.get("user-agent") || "unknown-agent";
  const material = `${ip}|${userAgent}`;
  const secret = env?.ADMIN_SESSION_SECRET || "yw-admin-audit";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(material));

  return base64UrlEncode(new Uint8Array(signature)).slice(0, 24);
}

function normalizeAuditEmail(email?: string) {
  const normalized = email?.trim().toLowerCase();

  return normalized && normalized.includes("@") ? normalized.slice(0, 254) : null;
}

function sanitizeAuditPart(value?: string) {
  if (!value) return "";

  return value.replace(/[^a-zA-Z0-9:./@_-]/g, "_").slice(0, 160);
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
