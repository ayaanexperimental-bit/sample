const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const FUNNEL_ACCESS_COOKIE = "yw_active_funnel";
export const FUNNEL_ACCESS_TTL_SECONDS = 24 * 60 * 60;

export type FunnelAccessPayload = {
  activatedAt: number;
  entryCode: string;
  expiresAt: number;
  funnelId: string;
  source: "go_link";
};

type SignedTokenPayload = Record<string, unknown>;

export async function createFunnelAccessCookie({
  entryCode,
  funnelId,
  secret,
  secure
}: {
  entryCode: string;
  funnelId: string;
  secret: string;
  secure: boolean;
}) {
  const now = Math.floor(Date.now() / 1000);
  const token = await createSignedToken(
    {
      activatedAt: now,
      entryCode,
      expiresAt: now + FUNNEL_ACCESS_TTL_SECONDS,
      funnelId,
      source: "go_link"
    },
    secret
  );
  const cookieParts = [`${FUNNEL_ACCESS_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax"];

  if (secure) {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

export async function verifyFunnelAccessFromCookie({
  cookieHeader,
  secret
}: {
  cookieHeader: string | null;
  secret: string;
}) {
  const token = getCookieValue(cookieHeader, FUNNEL_ACCESS_COOKIE);
  if (!token) return null;

  const payload = await verifySignedToken(token, secret);
  if (!isFunnelAccessPayload(payload)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.expiresAt <= now) return null;

  return payload;
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

function isFunnelAccessPayload(payload: SignedTokenPayload | null): payload is FunnelAccessPayload {
  return (
    isRecord(payload) &&
    payload.source === "go_link" &&
    typeof payload.activatedAt === "number" &&
    typeof payload.entryCode === "string" &&
    typeof payload.expiresAt === "number" &&
    typeof payload.funnelId === "string"
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
