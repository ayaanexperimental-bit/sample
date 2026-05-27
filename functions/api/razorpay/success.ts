import {
  clearPaymentAccessCookie,
  createPaymentAccessCookie
} from "../../../lib/server/payment-access";

type Env = {
  RAZORPAY_KEY_SECRET?: string;
  SUCCESS_ACCESS_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type VerificationResult = {
  paymentId: string;
  source: "payment_link" | "checkout";
};

const NO_STORE_HEADERS = {
  "cache-control": "no-store"
};

const textEncoder = new TextEncoder();

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...NO_STORE_HEADERS, allow: "GET, POST" }
    });
  }

  const keySecret = env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return redirectToLockedSuccess(request, "missing_configuration");
  }

  const params = await readCallbackParams(request);
  const verification = await verifyRazorpayCallback(params, keySecret);

  if (!verification) {
    return redirectToLockedSuccess(request, "verification_failed");
  }

  const accessSecret = env.SUCCESS_ACCESS_SECRET || keySecret;
  const accessCookie = await createPaymentAccessCookie({
    paymentId: verification.paymentId,
    source: verification.source,
    secret: accessSecret
  });

  return redirectToSuccess(request, accessCookie);
}

async function readCallbackParams(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);

  if (request.method !== "POST") return params;

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      Object.entries(body).forEach(([key, value]) => {
        if (typeof value === "string" || typeof value === "number") {
          params.set(key, String(value));
        }
      });
      return params;
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        if (typeof value === "string") {
          params.set(key, value);
        }
      });
      return params;
    }

    const body = await request.text();
    new URLSearchParams(body).forEach((value, key) => {
      params.set(key, value);
    });
  } catch {
    return params;
  }

  return params;
}

async function verifyRazorpayCallback(
  params: URLSearchParams,
  keySecret: string
): Promise<VerificationResult | null> {
  const signature = params.get("razorpay_signature");
  const paymentId = params.get("razorpay_payment_id");
  if (!signature || !paymentId) return null;

  const paymentLinkId = params.get("razorpay_payment_link_id");
  if (paymentLinkId) {
    const paymentLinkStatus = params.get("razorpay_payment_link_status");
    if (paymentLinkStatus !== "paid") return null;

    const paymentLinkReferenceId = params.get("razorpay_payment_link_reference_id") || "";
    const payload = [paymentLinkId, paymentLinkReferenceId, paymentLinkStatus, paymentId].join("|");
    const valid = await verifyHmacSha256Hex(payload, signature, keySecret);

    return valid ? { paymentId, source: "payment_link" } : null;
  }

  const orderId = params.get("razorpay_order_id");
  if (orderId) {
    const payload = `${orderId}|${paymentId}`;
    const valid = await verifyHmacSha256Hex(payload, signature, keySecret);

    return valid ? { paymentId, source: "checkout" } : null;
  }

  return null;
}

async function verifyHmacSha256Hex(payload: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(signature.toLowerCase(), expected);
}

function redirectToSuccess(request: Request, cookie: string) {
  const url = new URL("/success", request.url);

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: url.toString(),
      "set-cookie": cookie
    }
  });
}

function redirectToLockedSuccess(request: Request, reason: string) {
  const url = new URL("/success", request.url);
  url.searchParams.set("payment", reason);

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: url.toString(),
      "set-cookie": clearPaymentAccessCookie()
    }
  });
}

function timingSafeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}
