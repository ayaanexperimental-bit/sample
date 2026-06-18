import type { D1Database } from "@cloudflare/workers-types";
import { verifyHmacSha256Hex } from "../../../lib/server/payment-access";
import {
  findPendingShopOrderByContact,
  getShopOrderByPaymentReference,
  markShopOrderPaymentVerified,
  recordShopFailure
} from "../../../lib/server/shop";

type Env = {
  ADMIN_DB?: D1Database;
  SHOP_PAYMENT_PAGE_URL?: string;
  SHOP_RAZORPAY_WEBHOOK_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

const SUCCESS_EVENTS = new Set([
  "order.paid",
  "payment.captured",
  "payment_link.paid",
  "payment_page.paid"
]);

const SHOP_ORDER_FIELD_KEYS = new Set([
  "shop_order_id",
  "shoporderid",
  "shoporder",
  "order_id",
  "orderid",
  "reference_id",
  "referenceid"
]);

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return shopWebhookJson({ ok: false, reason: "method_not_allowed" }, 405, {
      allow: "POST"
    });
  }

  if (!env.ADMIN_DB || !env.SHOP_RAZORPAY_WEBHOOK_SECRET) {
    return shopWebhookJson({ ok: false, reason: "shop_webhook_not_configured" }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";
  const signatureValid = await verifyHmacSha256Hex(
    rawBody,
    signature,
    env.SHOP_RAZORPAY_WEBHOOK_SECRET
  );

  if (!signatureValid) {
    await recordInvalidSignatureDiagnostic(env, rawBody);
    return shopWebhookJson({ ok: false, reason: "invalid_signature" }, 401);
  }

  const payload = parseJson(rawBody);
  if (!payload) {
    await recordShopFailure({
      env,
      message: "Shop Razorpay webhook sent invalid JSON after signature verification.",
      severity: "high",
      stage: "webhook_invalid_payload"
    });
    return shopWebhookJson({ ok: false, reason: "invalid_payload" }, 400);
  }

  if (!isSuccessfulPaymentPayload(payload)) {
    return shopWebhookJson({ ok: true, ignored: true, reason: "non_success_event" });
  }

  const contact = findPaymentContact(payload);
  let orderId = findShopOrderId(payload);
  if (!orderId) {
    const hasPageSignal = hasShopPaymentPageSignal(payload);
    const fallback = await findPendingShopOrderByContact({
      email: contact.email,
      env,
      phone: contact.phone
    });

    if (!fallback.ok) {
      const existingOrder = await getShopOrderByPaymentReference({
        env,
        providerPaymentId: findPaymentId(payload)
      });
      if (existingOrder) {
        return shopWebhookJson({
          ok: true,
          published: existingOrder.siteStatus === "published",
          reason: "already_verified"
        });
      }

      await recordShopFailure({
        coachEmail: contact.email,
        env,
        message: `Signed Shop Razorpay webhook could not be matched to an order. Reason ${fallback.reason}; matches ${fallback.matchCount}; page signal ${hasPageSignal ? "yes" : "no"}; event ${getStringField(payload, "event") || getStringField(payload, "id")}; payment ${findPaymentId(payload) || "unknown"}.`,
        severity: "high",
        stage: "webhook_order_match"
      });
      return shopWebhookJson(
        {
          acceptedForManualReview: true,
          matchCount: fallback.matchCount,
          ok: true,
          reason: `missing_shop_order_id:${fallback.reason}`
        }
      );
    }

    orderId = fallback.order.orderId;
  }

  const result = await markShopOrderPaymentVerified({
    adminEmail: "shop-razorpay-webhook",
    env,
    orderId,
    payerEmail: contact.email,
    payerPhone: contact.phone,
    providerEventId: getStringField(payload, "id") || getStringField(payload, "event"),
    providerPaymentId: findPaymentId(payload)
  });

  return shopWebhookJson(
    {
      ok: result.ok,
      published: result.ok ? result.order?.siteStatus === "published" : false,
      reason: result.ok ? "verified" : result.error
    },
    result.ok ? 200 : 202
  );
}

async function recordInvalidSignatureDiagnostic(env: Env, rawBody: string) {
  const payload = parseJson(rawBody);
  if (!payload) return;

  const orderId = findShopOrderId(payload);
  if (!orderId && !hasShopPaymentPageSignal(payload)) return;

  const contact = findPaymentContact(payload);
  await recordShopFailure({
    coachEmail: contact.email,
    env,
    message: `Shop Razorpay webhook had an invalid signature. Event ${getStringField(payload, "event") || getStringField(payload, "id") || "unknown"}; payment ${findPaymentId(payload) || "unknown"}.`,
    orderId,
    severity: "high",
    stage: "webhook_signature"
  });
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

  return paymentId || getStringField(payload, "payment_id") || "";
}

function findPaymentContact(payload: unknown) {
  const payment = getNestedRecord(payload, ["payload", "payment", "entity"]);
  const email =
    firstStringFromUnknown(payment, ["email", "customer_email", "customerEmail"]) ||
    firstStringFromUnknown(payload, ["email", "customer_email", "customerEmail"]);
  const phone =
    firstStringFromUnknown(payment, ["contact", "phone", "mobile", "customer_phone"]) ||
    firstStringFromUnknown(payload, ["contact", "phone", "mobile", "customer_phone"]);

  return { email, phone };
}

function firstStringFromUnknown(value: unknown, fieldNames: string[], depth = 0): string {
  if (depth > 8 || value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstStringFromUnknown(item, fieldNames, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (!isRecord(value)) return "";

  const direct = firstStringField(value, fieldNames);
  if (direct) return direct;

  for (const nestedValue of Object.values(value)) {
    const found = firstStringFromUnknown(nestedValue, fieldNames, depth + 1);
    if (found) return found;
  }

  return "";
}

function hasShopPaymentPageSignal(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) return false;

  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return (
      lower.includes("ywcoach_shop") ||
      lower.includes("rzp.io/rzp/webb") ||
      lower.includes("pages.razorpay.com/webb") ||
      lower.includes("web site builder")
    );
  }

  if (Array.isArray(value)) return value.some((item) => hasShopPaymentPageSignal(item, depth + 1));
  if (!isRecord(value)) return false;

  return Object.entries(value).some(
    ([key, nestedValue]) => hasShopPaymentPageSignal(key, depth + 1) || hasShopPaymentPageSignal(nestedValue, depth + 1)
  );
}

function findShopOrderId(value: unknown, depth = 0): string {
  if (depth > 8 || value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findShopOrderId(item, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (!isRecord(value)) return "";

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
  if (label && labelValue && isShopOrderFieldKey(label) && isValidShopOrderId(labelValue)) {
    return labelValue.trim();
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      typeof nestedValue === "string" &&
      isShopOrderFieldKey(key) &&
      isValidShopOrderId(nestedValue)
    ) {
      return nestedValue.trim();
    }
  }

  for (const nestedValue of Object.values(value)) {
    const found = findShopOrderId(nestedValue, depth + 1);
    if (found) return found;
  }

  return "";
}

function firstStringField(value: Record<string, unknown>, fieldNames: string[]) {
  for (const fieldName of fieldNames) {
    const fieldValue = value[fieldName];
    if (typeof fieldValue === "string" && fieldValue.trim()) return fieldValue.trim();
  }

  return "";
}

function isShopOrderFieldKey(value: string) {
  return SHOP_ORDER_FIELD_KEYS.has(normalizeFieldKey(value));
}

function normalizeFieldKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isValidShopOrderId(value: string) {
  return /^shop-order-[a-zA-Z0-9-]{8,}$/.test(value.trim());
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
  if (!isRecord(value)) return "";
  const fieldValue = value[key];

  return typeof fieldValue === "string" ? fieldValue : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function shopWebhookJson(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}
