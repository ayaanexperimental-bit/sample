import type { D1Database } from "@cloudflare/workers-types";
import {
  type AdminSessionPayload,
  createAdminSessionCookie,
  isAdminEmailAllowed,
  isRequestSecure,
  isValidAdminEmail,
  normalizeAdminEmail
} from "./admin-auth";

const textEncoder = new TextEncoder();

const DEFAULT_OTP_TTL_SECONDS = 10 * 60;
const DEFAULT_OTP_MAX_ATTEMPTS = 5;
const DEFAULT_OTP_REQUEST_WINDOW_SECONDS = 15 * 60;
const DEFAULT_OTP_MAX_REQUESTS_PER_WINDOW = 5;

type AdminEmailOtpEnv = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_EMAIL_OTP_ENABLED?: string;
  ADMIN_EMAIL_OTP_FROM?: string;
  ADMIN_EMAIL_OTP_FROM_NAME?: string;
  ADMIN_EMAIL_OTP_SECRET?: string;
  ADMIN_OTP_MAX_ATTEMPTS?: string;
  ADMIN_OTP_TTL_SECONDS?: string;
  ADMIN_SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
};

export type AdminEmailOtpContext = {
  env: AdminEmailOtpEnv & {
    ADMIN_DB?: D1Database;
  };
  request: Request;
};

type AdminOtpRow = {
  attempts: number;
  code_hash: string;
  email: string;
  expires_at: number;
  id: string;
  max_attempts: number;
};

type ResendSendResponse = {
  id?: string;
};

export function isAdminEmailOtpConfigured(env: AdminEmailOtpEnv) {
  return (
    env.ADMIN_EMAIL_OTP_ENABLED === "true" &&
    Boolean(env.ADMIN_SESSION_SECRET) &&
    Boolean(env.RESEND_API_KEY) &&
    Boolean(env.ADMIN_EMAIL_OTP_FROM)
  );
}

export async function startAdminEmailOtp({
  email,
  env,
  request
}: AdminEmailOtpContext & {
  email: string;
}) {
  void request;
  const normalizedEmail = normalizeAdminEmail(email);
  if (!isValidAdminEmail(normalizedEmail)) {
    return { ok: false, reason: "invalid_email" as const };
  }

  if (!env.ADMIN_DB || !isAdminEmailOtpConfigured(env)) {
    return { ok: false, reason: "not_configured" as const };
  }

  await cleanupExpiredOtps(env.ADMIN_DB);

  if (!isAdminEmailAllowed(normalizedEmail, env)) {
    await insertAdminAuditEvent(env.ADMIN_DB, {
      email: normalizedEmail,
      reason: "email_not_allowlisted",
      type: "email_otp_blocked"
    });
    return { ok: true, skipped: true };
  }

  const requestLimitOk = await checkRecentOtpRequestLimit(env.ADMIN_DB, normalizedEmail);
  if (!requestLimitOk) {
    await insertAdminAuditEvent(env.ADMIN_DB, {
      email: normalizedEmail,
      reason: "recent_request_limit",
      type: "email_otp_blocked"
    });
    return { ok: false, reason: "rate_limited" as const };
  }

  const code = createNumericOtp();
  const challengeId = crypto.randomUUID();
  const now = getNowSeconds();
  const expiresAt = now + getOtpTtlSeconds(env);
  const maxAttempts = getOtpMaxAttempts(env);
  const codeHash = await createOtpHash({
    challengeId,
    code,
    email: normalizedEmail,
    env
  });

  await env.ADMIN_DB.prepare(
    `INSERT INTO admin_email_otps
      (id, email, code_hash, expires_at, max_attempts, attempts, used_at, created_at, sent_at)
      VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`
  )
    .bind(challengeId, normalizedEmail, codeHash, expiresAt, maxAttempts, now, now)
    .run();

  const resendResult = await sendAdminOtpEmail({
    code,
    email: normalizedEmail,
    env,
    expiresInMinutes: Math.max(1, Math.round(getOtpTtlSeconds(env) / 60))
  });

  await env.ADMIN_DB.prepare(
    "UPDATE admin_email_otps SET resend_email_id = ?, resend_status = ? WHERE id = ?"
  )
    .bind(resendResult.id || null, "accepted", challengeId)
    .run();

  await insertAdminAuditEvent(env.ADMIN_DB, {
    email: normalizedEmail,
    reason: resendResult.id ? `resend_id:${resendResult.id}` : "resend_id:missing",
    type: "email_otp_sent"
  });

  return { ok: true };
}

export async function verifyAdminEmailOtp({
  email,
  env,
  otp,
  request
}: AdminEmailOtpContext & {
  email: string;
  otp: string;
}) {
  const normalizedEmail = normalizeAdminEmail(email);
  if (!isValidAdminEmail(normalizedEmail) || !/^\d{6}$/.test(otp)) {
    return { ok: false, reason: "invalid_payload" as const };
  }

  if (!env.ADMIN_DB || !isAdminEmailOtpConfigured(env)) {
    return { ok: false, reason: "not_configured" as const };
  }

  if (!isAdminEmailAllowed(normalizedEmail, env)) {
    await insertAdminAuditEvent(env.ADMIN_DB, {
      email: normalizedEmail,
      reason: "email_not_allowlisted",
      type: "email_otp_failed"
    });
    return { ok: false, reason: "unauthorized" as const };
  }

  const now = getNowSeconds();
  const row = await env.ADMIN_DB.prepare(
    `SELECT id, email, code_hash, expires_at, max_attempts, attempts
      FROM admin_email_otps
      WHERE email = ? AND used_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 1`
  )
    .bind(normalizedEmail, now)
    .first<AdminOtpRow>();

  if (!row) {
    await insertAdminAuditEvent(env.ADMIN_DB, {
      email: normalizedEmail,
      reason: "no_active_challenge",
      type: "email_otp_failed"
    });
    return { ok: false, reason: "invalid_or_expired" as const };
  }

  const nextAttempts = row.attempts + 1;
  if (nextAttempts > row.max_attempts) {
    await expireOtpChallenge(env.ADMIN_DB, row.id, nextAttempts);
    return { ok: false, reason: "too_many_attempts" as const };
  }

  const submittedHash = await createOtpHash({
    challengeId: row.id,
    code: otp,
    email: normalizedEmail,
    env
  });

  if (!timingSafeEqual(submittedHash, row.code_hash)) {
    if (nextAttempts >= row.max_attempts) {
      await expireOtpChallenge(env.ADMIN_DB, row.id, nextAttempts);
    } else {
      await env.ADMIN_DB.prepare("UPDATE admin_email_otps SET attempts = ? WHERE id = ?")
        .bind(nextAttempts, row.id)
        .run();
    }

    await insertAdminAuditEvent(env.ADMIN_DB, {
      email: normalizedEmail,
      reason: "bad_code",
      type: "email_otp_failed"
    });
    return { ok: false, reason: "invalid_or_expired" as const };
  }

  await env.ADMIN_DB.prepare("UPDATE admin_email_otps SET attempts = ?, used_at = ? WHERE id = ?")
    .bind(nextAttempts, now, row.id)
    .run();

  const sessionCookie = await createAdminSessionCookie({
    email: normalizedEmail,
    env,
    nowSeconds: now,
    rememberDevice: false,
    secure: isRequestSecure(request)
  });
  if (!sessionCookie) {
    return { ok: false, reason: "not_configured" as const };
  }

  await insertAdminAuditEvent(env.ADMIN_DB, {
    email: normalizedEmail,
    type: "email_otp_verified"
  });

  return {
    email: normalizedEmail,
    ok: true,
    session: {
      email: normalizedEmail,
      expiresAt: now + 8 * 60 * 60,
      issuedAt: now,
      otpVerified: true,
      source: "admin_auth"
    } satisfies AdminSessionPayload,
    sessionCookie
  };
}

async function sendAdminOtpEmail({
  code,
  email,
  env,
  expiresInMinutes
}: {
  code: string;
  email: string;
  env: AdminEmailOtpEnv;
  expiresInMinutes: number;
}) {
  const fromName = env.ADMIN_EMAIL_OTP_FROM_NAME || "YW Coach Admin";
  const fromEmail = env.ADMIN_EMAIL_OTP_FROM || "admin@ywcoach.com";
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      html: createOtpEmailHtml({ code, expiresInMinutes }),
      subject: "Your YW Coach admin login code",
      text: `Your YW Coach admin login code is ${code}. It expires in ${expiresInMinutes} minutes. If you did not request this code, ignore this email.`,
      to: [email]
    }),
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    method: "POST"
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error("resend_email_failed");
  }

  try {
    return JSON.parse(responseText) as ResendSendResponse;
  } catch {
    return {};
  }
}

function createOtpEmailHtml({
  code,
  expiresInMinutes
}: {
  code: string;
  expiresInMinutes: number;
}) {
  return `<!doctype html>
    <html>
      <body style="margin:0;background:#fff7fb;padding:24px;font-family:Arial,sans-serif;color:#251822;">
        <main style="max-width:520px;margin:0 auto;border:1px solid #f2c9da;border-radius:12px;background:#ffffff;padding:28px;">
          <p style="margin:0 0 12px;color:#087a73;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">YW Coach Admin</p>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;">Your login code</h1>
          <p style="margin:0 0 20px;color:#5f4a59;font-size:15px;line-height:1.6;">Use this one-time code to continue into the YW Coach admin panel. It expires in ${expiresInMinutes} minutes.</p>
          <p style="margin:0 0 20px;border-radius:10px;background:#f4fffd;padding:18px 20px;color:#0d70b7;font-size:34px;font-weight:900;letter-spacing:.28em;text-align:center;">${code}</p>
          <p style="margin:0;color:#75606c;font-size:13px;line-height:1.55;">If you did not request this code, ignore this email. Only allowlisted admin emails can use it.</p>
        </main>
      </body>
    </html>`;
}

async function cleanupExpiredOtps(db: D1Database) {
  const cutoff = getNowSeconds() - 24 * 60 * 60;
  await db.prepare("DELETE FROM admin_email_otps WHERE expires_at < ?").bind(cutoff).run();
}

async function checkRecentOtpRequestLimit(db: D1Database, email: string) {
  const cutoff = getNowSeconds() - DEFAULT_OTP_REQUEST_WINDOW_SECONDS;
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM admin_email_otps WHERE email = ? AND created_at >= ?")
    .bind(email, cutoff)
    .first<{ count: number }>();

  return Number(row?.count || 0) < DEFAULT_OTP_MAX_REQUESTS_PER_WINDOW;
}

async function expireOtpChallenge(db: D1Database, id: string, attempts: number) {
  await db
    .prepare("UPDATE admin_email_otps SET attempts = ?, used_at = ? WHERE id = ?")
    .bind(attempts, getNowSeconds(), id)
    .run();
}

async function insertAdminAuditEvent(
  db: D1Database,
  event: {
    email?: string;
    reason?: string;
    type: string;
  }
) {
  await db
    .prepare(
      `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
      VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      event.type,
      event.email || null,
      event.reason || null,
      getNowSeconds()
    )
    .run();
}

async function createOtpHash({
  challengeId,
  code,
  email,
  env
}: {
  challengeId: string;
  code: string;
  email: string;
  env: AdminEmailOtpEnv;
}) {
  const secret = env.ADMIN_EMAIL_OTP_SECRET || env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("admin_otp_secret_missing");
  }

  const payload = `${challengeId}.${email}.${code}`;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));

  return base64UrlEncode(new Uint8Array(signature));
}

function createNumericOtp() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);

  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

function getOtpTtlSeconds(env: AdminEmailOtpEnv) {
  return parsePositiveInteger(env.ADMIN_OTP_TTL_SECONDS, DEFAULT_OTP_TTL_SECONDS);
}

function getOtpMaxAttempts(env: AdminEmailOtpEnv) {
  return parsePositiveInteger(env.ADMIN_OTP_MAX_ATTEMPTS, DEFAULT_OTP_MAX_ATTEMPTS);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function timingSafeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}
