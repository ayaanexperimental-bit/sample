import type { D1Database } from "@cloudflare/workers-types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const ADMIN_SESSION_COOKIE = "yw_admin_session";
export const ADMIN_GOOGLE_STATE_COOKIE = "yw_admin_google_state";
export const ADMIN_CSRF_HEADER = "x-yw-admin-csrf";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const ADMIN_REMEMBERED_SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;
export const ADMIN_OAUTH_STATE_TTL_SECONDS = 10 * 60;
export const ADMIN_CSRF_TTL_SECONDS = 8 * 60 * 60;
export const GENERIC_ADMIN_AUTH_ERROR = "Invalid credentials or unauthorized admin access.";

export type AdminAuthEnv = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_OAUTH_STATE_SECRET?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
};

export type AdminSessionPayload = {
  email: string;
  expiresAt: number;
  issuedAt: number;
  otpVerified: true;
  source: "admin_auth";
};

export type AdminRole = "owner";

type SignedTokenPayload = Record<string, unknown>;

type AdminGoogleStatePayload = {
  expiresAt: number;
  issuedAt: number;
  redirectPath: string;
  source: "admin_google_oauth_state";
};

type AdminCsrfPayload = {
  email: string;
  expiresAt: number;
  issuedAt: number;
  sessionIssuedAt: number;
  source: "admin_csrf";
};

export type RequireAdminResult =
  | {
      admin: {
        email: string;
        role: AdminRole;
      };
      ok: true;
      session: AdminSessionPayload;
    }
  | {
      ok: false;
      response: Response;
    };

export function adminJson(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export async function readJsonBody<T extends Record<string, unknown>>(request: Request) {
  try {
    const payload = (await request.json()) as unknown;

    return isRecord(payload) ? (payload as T) : null;
  } catch {
    return null;
  }
}

export async function requireAdmin(
  request: Request,
  env: AdminAuthEnv,
  options: {
    requireCsrf?: boolean;
    requiredRole?: AdminRole;
  } = {}
): Promise<RequireAdminResult> {
  const session = await verifyAdminSessionFromRequest(request, env);
  if (!session) {
    return {
      ok: false,
      response: adminJson({ authenticated: false, error: "Admin authentication required." }, 401)
    };
  }

  const role = await getAdminRoleForEmail(session.email, env);
  if (!role || role !== (options.requiredRole || "owner")) {
    return {
      ok: false,
      response: adminJson({ authenticated: false, error: "Admin authorization required." }, 403)
    };
  }

  if (options.requireCsrf && !(await verifyAdminCsrfFromRequest(request, env, session))) {
    return {
      ok: false,
      response: adminJson(
        { authenticated: false, error: "Admin request verification failed." },
        403
      )
    };
  }

  return {
    admin: {
      email: session.email,
      role
    },
    ok: true,
    session
  };
}

export async function createAdminSessionCookie({
  email,
  env,
  nowSeconds,
  rememberDevice,
  secure
}: {
  email: string;
  env: AdminAuthEnv;
  nowSeconds?: number;
  rememberDevice: boolean;
  secure: boolean;
}) {
  const secret = resolveAdminSessionSecret(env);
  if (!secret) return null;

  const now = nowSeconds || Math.floor(Date.now() / 1000);
  const ttl = rememberDevice ? ADMIN_REMEMBERED_SESSION_TTL_SECONDS : ADMIN_SESSION_TTL_SECONDS;
  const token = await createSignedToken(
    {
      email: normalizeAdminEmail(email),
      expiresAt: now + ttl,
      issuedAt: now,
      otpVerified: true,
      source: "admin_auth"
    },
    secret
  );

  return serializeAdminCookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: ttl,
    path: "/",
    sameSite: "Strict",
    secure
  });
}

export async function createAdminGoogleStateCookie({
  env,
  redirectPath = "/admin",
  secure
}: {
  env: AdminAuthEnv;
  redirectPath?: string;
  secure: boolean;
}) {
  const secret = resolveAdminOauthStateSecret(env);
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const state = await createSignedToken(
    {
      expiresAt: now + ADMIN_OAUTH_STATE_TTL_SECONDS,
      issuedAt: now,
      redirectPath,
      source: "admin_google_oauth_state"
    },
    secret
  );
  const cookie = serializeAdminCookie(ADMIN_GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: ADMIN_OAUTH_STATE_TTL_SECONDS,
    path: "/",
    sameSite: "Lax",
    secure
  });

  return { cookie, state };
}

export async function createAdminCsrfToken({
  env,
  session
}: {
  env: AdminAuthEnv;
  session: AdminSessionPayload;
}) {
  const secret = resolveAdminSessionSecret(env);
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = Math.min(session.expiresAt, now + ADMIN_CSRF_TTL_SECONDS);

  return createSignedToken(
    {
      email: session.email,
      expiresAt,
      issuedAt: now,
      sessionIssuedAt: session.issuedAt,
      source: "admin_csrf"
    },
    secret
  );
}

export function clearAdminSessionCookie({ secure }: { secure: boolean }) {
  return serializeAdminCookie(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Strict",
    secure
  });
}

export function clearAdminGoogleStateCookie({ secure }: { secure: boolean }) {
  return serializeAdminCookie(ADMIN_GOOGLE_STATE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    secure
  });
}

export async function verifyAdminSessionFromRequest(request: Request, env: AdminAuthEnv) {
  const secret = resolveAdminSessionSecret(env);
  if (!secret) return null;

  const token = getCookieValue(request.headers.get("cookie"), ADMIN_SESSION_COOKIE);
  if (!token) return null;

  const payload = await verifySignedToken(token, secret);
  if (!isAdminSessionPayload(payload)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.expiresAt <= now) return null;

  const role = await getAdminRoleForEmail(payload.email, env);
  if (!role) return null;

  return payload;
}

export async function verifyAdminCsrfFromRequest(
  request: Request,
  env: AdminAuthEnv,
  session: AdminSessionPayload
) {
  const secret = resolveAdminSessionSecret(env);
  if (!secret) return false;
  if (!hasTrustedAdminRequestOrigin(request)) return false;

  const token = request.headers.get(ADMIN_CSRF_HEADER);
  if (!token) return false;

  const payload = await verifySignedToken(token, secret);
  if (!isAdminCsrfPayload(payload)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (payload.expiresAt <= now) return false;
  if (normalizeAdminEmail(payload.email) !== normalizeAdminEmail(session.email)) return false;
  if (payload.sessionIssuedAt !== session.issuedAt) return false;

  return true;
}

export async function verifyAdminGoogleStateFromRequest({
  env,
  request,
  state
}: {
  env: AdminAuthEnv;
  request: Request;
  state: string;
}) {
  const secret = resolveAdminOauthStateSecret(env);
  if (!secret || !state) return null;

  const cookieState = getCookieValue(request.headers.get("cookie"), ADMIN_GOOGLE_STATE_COOKIE);
  if (!cookieState || cookieState !== state) return null;

  const payload = await verifySignedToken(state, secret);
  if (!isAdminGoogleStatePayload(payload)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.expiresAt <= now) return null;

  return payload;
}

export function isAdminEmailAllowed(email: string, env: AdminAuthEnv) {
  const normalizedEmail = normalizeAdminEmail(email);
  if (!normalizedEmail) return false;

  return parseAdminAllowedEmails(env).has(normalizedEmail);
}

export async function getAdminRoleForEmail(
  email: string,
  env: AdminAuthEnv
): Promise<AdminRole | null> {
  const databaseRole = await getAdminRoleFromDatabase(email, env);
  if (databaseRole) return databaseRole;

  if (env.ADMIN_REQUIRE_DB_ADMIN_ROLES === "true") {
    return null;
  }

  return isAdminEmailAllowed(email, env) ? "owner" : null;
}

export function isAdminDemoAuthEnabled(env: AdminAuthEnv) {
  return env.ADMIN_AUTH_DEMO_ENABLED === "true";
}

export function isValidAdminEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeAdminEmail(email));
}

export function isValidOtp(otp: string) {
  return /^\d{6}$/.test(otp);
}

export function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getAdminPasswordChecks(password: string) {
  return {
    hasLowercase: /[a-z]/.test(password),
    hasMinLength: password.length >= 12,
    hasNumber: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
    hasUppercase: /[A-Z]/.test(password)
  };
}

export function isStrongAdminPassword(password: string) {
  const checks = getAdminPasswordChecks(password);

  return Object.values(checks).every(Boolean);
}

export function isRequestSecure(request: Request) {
  return new URL(request.url).protocol === "https:";
}

function parseAdminAllowedEmails(env: AdminAuthEnv) {
  return new Set(
    (env.ADMIN_ALLOWED_EMAILS || "")
      .split(",")
      .map((email) => normalizeAdminEmail(email))
      .filter(Boolean)
  );
}

async function getAdminRoleFromDatabase(
  email: string,
  env: AdminAuthEnv
): Promise<AdminRole | null> {
  const normalizedEmail = normalizeAdminEmail(email);
  const db = env.ADMIN_DB;
  if (!db || !normalizedEmail) return null;

  try {
    const row = await db
      .prepare("SELECT role FROM admin_users WHERE email = ? AND status = 'active' LIMIT 1")
      .bind(normalizedEmail)
      .first<{ role: string }>();

    return isDatabaseAdminRole(row?.role) ? "owner" : null;
  } catch {
    // Keep allowlisted admins reviewable until the optional admin_users table is migrated.
    return null;
  }
}

function isDatabaseAdminRole(role: string | undefined) {
  return role === "owner" || role === "admin" || role === "super_admin";
}

function hasTrustedAdminRequestOrigin(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return false;
  }

  if (origin) {
    return origin === url.origin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === url.origin;
    } catch {
      return false;
    }
  }

  return true;
}

function resolveAdminSessionSecret(env: AdminAuthEnv) {
  return env.ADMIN_SESSION_SECRET || null;
}

function resolveAdminOauthStateSecret(env: AdminAuthEnv) {
  return env.ADMIN_OAUTH_STATE_SECRET || env.ADMIN_SESSION_SECRET || null;
}

async function createSignedToken(payload: SignedTokenPayload, secret: string) {
  const payloadPart = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const signature = await hmacSha256Base64Url(payloadPart, secret);

  return `${payloadPart}.${signature}`;
}

async function verifySignedToken(token: string, secret: string) {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const expectedSignature = await hmacSha256Base64Url(payloadPart, secret);
  if (!timingSafeEqual(signaturePart, expectedSignature)) return null;

  try {
    const decoded = JSON.parse(base64UrlDecodeToString(payloadPart)) as unknown;
    if (!isRecord(decoded)) return null;

    return decoded;
  } catch {
    return null;
  }
}

async function hmacSha256Base64Url(payload: string, secret: string) {
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

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex < 0) continue;

    const cookieName = cookie.slice(0, separatorIndex);
    if (cookieName === name) {
      return cookie.slice(separatorIndex + 1);
    }
  }

  return null;
}

function serializeAdminCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    maxAge: number;
    path: string;
    sameSite: "Lax" | "Strict";
    secure: boolean;
  }
) {
  const cookieParts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite}`
  ];

  if (options.httpOnly) {
    cookieParts.push("HttpOnly");
  }

  if (options.secure) {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToString(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(paddedBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return textDecoder.decode(bytes);
}

function isAdminSessionPayload(payload: SignedTokenPayload | null): payload is AdminSessionPayload {
  return (
    isRecord(payload) &&
    payload.source === "admin_auth" &&
    payload.otpVerified === true &&
    typeof payload.email === "string" &&
    typeof payload.expiresAt === "number" &&
    typeof payload.issuedAt === "number"
  );
}

function isAdminGoogleStatePayload(
  payload: SignedTokenPayload | null
): payload is AdminGoogleStatePayload {
  return (
    isRecord(payload) &&
    payload.source === "admin_google_oauth_state" &&
    typeof payload.expiresAt === "number" &&
    typeof payload.issuedAt === "number" &&
    typeof payload.redirectPath === "string"
  );
}

function isAdminCsrfPayload(payload: SignedTokenPayload | null): payload is AdminCsrfPayload {
  return (
    isRecord(payload) &&
    payload.source === "admin_csrf" &&
    typeof payload.email === "string" &&
    typeof payload.expiresAt === "number" &&
    typeof payload.issuedAt === "number" &&
    typeof payload.sessionIssuedAt === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timingSafeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}
