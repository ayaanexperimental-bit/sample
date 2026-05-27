import type { D1Database } from "@cloudflare/workers-types";
import {
  hashPaymentAttemptId,
  hashPaymentId,
  PAYMENT_ACCESS_TTL_SECONDS,
  PAYMENT_ATTEMPT_FIELD,
  verifyHmacSha256Hex
} from "../../../lib/server/payment-access";

type Env = {
  PAYMENT_ACCESS_DB?: D1Database;
  RAZORPAY_WEBHOOK_SECRET?: string;
  SUCCESS_ACCESS_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const SUCCESS_EVENTS = new Set(["order.paid", "payment.captured", "payment_link.paid"]);
const ATTEMPT_FIELD_KEYS = new Set([
  normalizeFieldKey(PAYMENT_ATTEMPT_FIELD),
  "registrationid",
  "customerreference",
  "paymentattemptid",
  "attemptid"
]);

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return json({ ok: false, reason: "method_not_allowed" }, 405, {
      allow: "POST"
    });
  }

  if (!env.RAZORPAY_WEBHOOK_SECRET || !env.SUCCESS_ACCESS_SECRET || !env.PAYMENT_ACCESS_DB) {
    return json({ ok: false, reason: "not_configured" }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";
  const signatureValid = await verifyHmacSha256Hex(
    rawBody,
    signature,
    env.RAZORPAY_WEBHOOK_SECRET
  );

  if (!signatureValid) {
    return json({ ok: false, reason: "invalid_signature" }, 401);
  }

  const payload = parseJson(rawBody);
  if (!payload) {
    return json({ ok: false, reason: "invalid_payload" }, 400);
  }

  if (!isSuccessfulPaymentPayload(payload)) {
    return json({ ok: true, ignored: true, reason: "non_success_event" });
  }

  const attemptId = findAttemptId(payload);
  if (!attemptId) {
    return json({ ok: true, ignored: true, reason: "missing_registration_id" }, 202);
  }

  const paymentId = findPaymentId(payload);
  const eventId = getStringField(payload, "id");
  const now = Math.floor(Date.now() / 1000);
  const attemptHash = await hashPaymentAttemptId(attemptId, env.SUCCESS_ACCESS_SECRET);
  const paymentHash = paymentId
    ? await hashPaymentId(paymentId, env.SUCCESS_ACCESS_SECRET)
    : null;

  await env.PAYMENT_ACCESS_DB.prepare("DELETE FROM paid_attempts WHERE expires_at <= ?")
    .bind(now)
    .run();

  await env.PAYMENT_ACCESS_DB.prepare(
    [
      "INSERT OR REPLACE INTO paid_attempts",
      "(attempt_hash, payment_hash, event_id, created_at, expires_at)",
      "VALUES (?, ?, ?, ?, ?)"
    ].join(" ")
  )
    .bind(attemptHash, paymentHash, eventId || null, now, now + PAYMENT_ACCESS_TTL_SECONDS)
    .run();

  return json({ ok: true });
}

function parseJson(rawBody: string) {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

function isSuccessfulPaymentPayload(payload: unknown) {
  const event = getStringField(payload, "event");
  if (event && SUCCESS_EVENTS.has(event)) return true;

  const payment = getNestedRecord(payload, ["payload", "payment", "entity"]);
  if (!payment) return false;

  return payment.captured === true || payment.status === "captured";
}

function findPaymentId(payload: unknown) {
  const payment = getNestedRecord(payload, ["payload", "payment", "entity"]);
  const paymentId = getStringField(payment, "id");

  return paymentId || getStringField(payload, "payment_id");
}

function findAttemptId(value: unknown, depth = 0): string | null {
  if (depth > 8 || value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAttemptId(item, depth + 1);
      if (found) return found;
    }

    return null;
  }

  if (!isRecord(value)) return null;

  const label = firstStringField(value, [
    "field",
    "field_name",
    "fieldName",
    "key",
    "label",
    "name",
    "title"
  ]);
  const labelValue = firstStringField(value, [
    "answer",
    "field_value",
    "fieldValue",
    "text",
    "value"
  ]);
  if (label && labelValue && isAttemptFieldKey(label) && isValidAttemptId(labelValue)) {
    return labelValue.trim();
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      typeof nestedValue === "string" &&
      isAttemptFieldKey(key) &&
      isValidAttemptId(nestedValue)
    ) {
      return nestedValue.trim();
    }
  }

  for (const nestedValue of Object.values(value)) {
    const found = findAttemptId(nestedValue, depth + 1);
    if (found) return found;
  }

  return null;
}

function firstStringField(value: Record<string, unknown>, fieldNames: string[]) {
  for (const fieldName of fieldNames) {
    const fieldValue = value[fieldName];
    if (typeof fieldValue === "string" && fieldValue.trim()) {
      return fieldValue;
    }
  }

  return null;
}

function getNestedRecord(value: unknown, path: string[]) {
  let current = value;

  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }

  return isRecord(current) ? current : null;
}

function getStringField(value: unknown, key: string) {
  if (!isRecord(value)) return null;

  const fieldValue = value[key];

  return typeof fieldValue === "string" && fieldValue.trim() ? fieldValue : null;
}

function isAttemptFieldKey(value: string) {
  return ATTEMPT_FIELD_KEYS.has(normalizeFieldKey(value));
}

function normalizeFieldKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isValidAttemptId(value: string) {
  return /^[A-Za-z0-9_-]{20,160}$/.test(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
