import type { D1Database } from "@cloudflare/workers-types";
import { claimSignedShopPaymentForOrder } from "../../../lib/server/shop";

type Env = {
  ADMIN_DB?: D1Database;
  SHOP_PAYMENT_PAGE_URL?: string;
  SHOP_RAZORPAY_WEBHOOK_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

export async function onRequestPost({ request, env }: PagesContext) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return shopJson({ ok: false, error: "Invalid payment verification request." }, 400);
  }

  const record = payload as Record<string, unknown>;
  const accessKey = request.headers.get("x-shop-access-key") || stringField(record.accessKey);
  const result = await claimSignedShopPaymentForOrder({
    accessKey,
    env,
    orderId: stringField(record.orderId),
    payerEmail: stringField(record.payerEmail),
    providerPaymentId: stringField(record.paymentId)
  });

  return shopJson(
    {
      ok: result.ok,
      error: result.ok ? "" : result.error,
      order: result.ok ? result.order : null
    },
    result.ok ? 200 : 400
  );
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function shopJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8"
    }
  });
}
