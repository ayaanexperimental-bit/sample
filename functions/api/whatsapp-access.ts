import { verifyPaymentAccessFromCookie } from "../../lib/server/payment-access";

type Env = {
  RAZORPAY_KEY_SECRET?: string;
  SUCCESS_ACCESS_SECRET?: string;
  WHATSAPP_GROUP_URL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET") {
    return json({ allowed: false, reason: "method_not_allowed" }, 405, {
      allow: "GET"
    });
  }

  const accessSecret = env.SUCCESS_ACCESS_SECRET || env.RAZORPAY_KEY_SECRET;
  if (!accessSecret || !env.WHATSAPP_GROUP_URL) {
    return json({ allowed: false, reason: "not_configured" });
  }

  const access = await verifyPaymentAccessFromCookie({
    cookieHeader: request.headers.get("cookie"),
    secret: accessSecret
  });

  if (!access) {
    return json({ allowed: false, reason: "payment_verification_required" });
  }

  return json({
    allowed: true,
    expiresAt: access.expiresAt,
    joinUrl: env.WHATSAPP_GROUP_URL
  });
}

function json(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers
    }
  });
}
