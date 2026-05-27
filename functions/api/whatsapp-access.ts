import type { D1Database } from "@cloudflare/workers-types";
import {
  hashPaymentAttemptId,
  verifyPaymentAccessFromCookie,
  verifyPaymentAttemptFromCookie
} from "../../lib/server/payment-access";

type Env = {
  PAYMENT_ACCESS_DB?: D1Database;
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

  const cookieHeader = request.headers.get("cookie");
  const access = await verifyPaymentAccessFromCookie({
    cookieHeader,
    secret: accessSecret
  });

  if (access) {
    return json({
      allowed: true,
      expiresAt: access.expiresAt,
      joinUrl: env.WHATSAPP_GROUP_URL
    });
  }

  const paymentAttempt = await verifyPaymentAttemptFromCookie({
    cookieHeader,
    secret: accessSecret
  });

  if (!paymentAttempt) {
    return json({ allowed: false, reason: "payment_verification_required" });
  }

  if (!env.PAYMENT_ACCESS_DB) {
    return json({ allowed: false, reason: "payment_pending" });
  }

  const now = Math.floor(Date.now() / 1000);
  const attemptHash = await hashPaymentAttemptId(paymentAttempt.attemptId, accessSecret);
  const record = await env.PAYMENT_ACCESS_DB.prepare(
    "SELECT expires_at FROM paid_attempts WHERE attempt_hash = ? AND expires_at > ? LIMIT 1"
  )
    .bind(attemptHash, now)
    .first<{ expires_at: number }>();

  if (!record) {
    return json({ allowed: false, reason: "payment_pending" });
  }

  return json({
    allowed: true,
    expiresAt: record.expires_at,
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
