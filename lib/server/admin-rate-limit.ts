import type { D1Database } from "@cloudflare/workers-types";

export type AdminRateLimitResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
    };

export type AdminRateLimitEnv = {
  ADMIN_DB?: D1Database;
  ADMIN_SESSION_SECRET?: string;
};

type AdminRateLimitPolicy = {
  emailMaxAttempts?: number;
  fingerprintMaxAttempts: number;
  windowSeconds: number;
};

const DEFAULT_POLICY: AdminRateLimitPolicy = {
  emailMaxAttempts: 12,
  fingerprintMaxAttempts: 40,
  windowSeconds: 10 * 60
};

const POLICIES: Record<string, AdminRateLimitPolicy> = {
  admin_email_otp_start: {
    emailMaxAttempts: 5,
    fingerprintMaxAttempts: 25,
    windowSeconds: 15 * 60
  },
  admin_email_otp_verify: {
    emailMaxAttempts: 8,
    fingerprintMaxAttempts: 35,
    windowSeconds: 10 * 60
  },
  admin_forgot_password: {
    emailMaxAttempts: 5,
    fingerprintMaxAttempts: 20,
    windowSeconds: 15 * 60
  },
  admin_google_callback: {
    fingerprintMaxAttempts: 30,
    windowSeconds: 10 * 60
  },
  admin_google_start: {
    fingerprintMaxAttempts: 30,
    windowSeconds: 10 * 60
  },
  admin_login_password: {
    emailMaxAttempts: 8,
    fingerprintMaxAttempts: 30,
    windowSeconds: 10 * 60
  },
  admin_resend_otp: {
    emailMaxAttempts: 5,
    fingerprintMaxAttempts: 20,
    windowSeconds: 15 * 60
  },
  admin_reset_password: {
    emailMaxAttempts: 5,
    fingerprintMaxAttempts: 20,
    windowSeconds: 15 * 60
  },
  admin_verify_otp: {
    emailMaxAttempts: 8,
    fingerprintMaxAttempts: 35,
    windowSeconds: 10 * 60
  }
};

export async function checkAdminRateLimit(input: {
  action: string;
  email?: string;
  env?: AdminRateLimitEnv;
  request: Request;
}): Promise<AdminRateLimitResult> {
  const db = input.env?.ADMIN_DB;
  if (!db) {
    return { allowed: true };
  }

  try {
    const action = normalizeAction(input.action);
    const eventType = `rate_limit:${action}`;
    const policy = POLICIES[action] || DEFAULT_POLICY;
    const now = getNowSeconds();
    const cutoff = now - policy.windowSeconds;
    const email = normalizeEmail(input.email);
    const fingerprint = await createRequestFingerprint(input.request, input.env);
    const fingerprintReason = `fp:${fingerprint}`;

    const fingerprintAttempts = await countRecentAttempts({
      db,
      eventType,
      reason: fingerprintReason,
      since: cutoff
    });
    if (fingerprintAttempts >= policy.fingerprintMaxAttempts) {
      await insertRateLimitAudit({
        db,
        email,
        reason: `rate_limited:${action}:fingerprint:${fingerprint}`,
        type: "blocked_attempt"
      });
      return { allowed: false, retryAfterSeconds: policy.windowSeconds };
    }

    if (email && policy.emailMaxAttempts) {
      const emailAttempts = await countRecentAttempts({
        db,
        email,
        eventType,
        since: cutoff
      });
      if (emailAttempts >= policy.emailMaxAttempts) {
        await insertRateLimitAudit({
          db,
          email,
          reason: `rate_limited:${action}:email`,
          type: "blocked_attempt"
        });
        return { allowed: false, retryAfterSeconds: policy.windowSeconds };
      }
    }

    await insertRateLimitAudit({
      db,
      email,
      reason: fingerprintReason,
      type: eventType
    });

    return { allowed: true };
  } catch {
    // Keep the admin UI reviewable if local D1 is not migrated yet.
    return { allowed: true };
  }
}

async function countRecentAttempts({
  db,
  email,
  eventType,
  reason,
  since
}: {
  db: D1Database;
  email?: string | null;
  eventType: string;
  reason?: string;
  since: number;
}) {
  const query = email
    ? db
        .prepare(
          `SELECT COUNT(*) AS count
          FROM admin_audit_events
          WHERE event_type = ? AND email = ? AND created_at >= ?`
        )
        .bind(eventType, email, since)
    : db
        .prepare(
          `SELECT COUNT(*) AS count
          FROM admin_audit_events
          WHERE event_type = ? AND reason = ? AND created_at >= ?`
        )
        .bind(eventType, reason || null, since);
  const row = await query.first<{ count: number }>();

  return Number(row?.count || 0);
}

async function insertRateLimitAudit({
  db,
  email,
  reason,
  type
}: {
  db: D1Database;
  email?: string | null;
  reason: string;
  type: string;
}) {
  await db
    .prepare(
      `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
      VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), type, email || null, reason.slice(0, 480), getNowSeconds())
    .run();
}

async function createRequestFingerprint(request: Request, env?: AdminRateLimitEnv) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown-ip";
  const userAgent = request.headers.get("user-agent") || "unknown-agent";
  const material = `${ip}|${userAgent}`;
  const secret = env?.ADMIN_SESSION_SECRET || "yw-admin-rate-limit";
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

function normalizeAction(action: string) {
  return action.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "admin_unknown";
}

function normalizeEmail(email?: string) {
  const normalized = email?.trim().toLowerCase();

  return normalized && normalized.includes("@") ? normalized.slice(0, 254) : null;
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
