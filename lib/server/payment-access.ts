const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const PAYMENT_ACCESS_COOKIE = "yw_paid_access";
export const PAYMENT_ACCESS_TTL_SECONDS = 7 * 60;

export type PaymentAccessPayload = {
  expiresAt: number;
  paymentId: string;
  source: string;
  verifiedAt: number;
};

export async function createPaymentAccessCookie({
  paymentId,
  secret,
  source
}: {
  paymentId: string;
  secret: string;
  source: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const token = await createSignedToken(
    {
      paymentId,
      source,
      verifiedAt: now,
      expiresAt: now + PAYMENT_ACCESS_TTL_SECONDS
    },
    secret
  );

  return [
    `${PAYMENT_ACCESS_COOKIE}=${token}`,
    `Max-Age=${PAYMENT_ACCESS_TTL_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

export function clearPaymentAccessCookie() {
  return [
    `${PAYMENT_ACCESS_COOKIE}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

export async function verifyPaymentAccessFromCookie({
  cookieHeader,
  secret
}: {
  cookieHeader: string | null;
  secret: string;
}) {
  const token = getCookieValue(cookieHeader, PAYMENT_ACCESS_COOKIE);
  if (!token) return null;

  const payload = await verifySignedToken(token, secret);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.expiresAt <= now) return null;

  return payload;
}

async function createSignedToken(payload: PaymentAccessPayload, secret: string) {
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
    const decoded = JSON.parse(base64UrlDecodeToString(payloadPart)) as PaymentAccessPayload;
    if (
      typeof decoded.paymentId !== "string" ||
      typeof decoded.source !== "string" ||
      typeof decoded.verifiedAt !== "number" ||
      typeof decoded.expiresAt !== "number"
    ) {
      return null;
    }

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

function timingSafeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}
