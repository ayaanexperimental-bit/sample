import type { D1Database } from "@cloudflare/workers-types";
import { readJsonBody } from "../../../lib/server/admin-auth";
import { startShopCheckout } from "../../../lib/server/shop";
import type { ShopBuilderState } from "../../../lib/shop-builder";

type Env = {
  ADMIN_DB?: D1Database;
  SHOP_PAYMENT_PAGE_URL?: string;
  SHOP_RAZORPAY_WEBHOOK_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type CheckoutBody = {
  idempotencyKey?: unknown;
  state?: Partial<ShopBuilderState>;
};

export async function onRequestPost({ request, env }: PagesContext) {
  const body = await readJsonBody<CheckoutBody>(request);
  const result = await startShopCheckout({
    env,
    idempotencyKey: typeof body?.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    state: body?.state || {}
  });

  return shopJson(result, result.ok ? 200 : getCheckoutFailureStatus(result.error));
}

export async function onRequestOptions() {
  return shopJson({ ok: true });
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

function getCheckoutFailureStatus(error?: string) {
  if (!error) return 400;
  if (
    error.includes("not configured") ||
    error.includes("temporarily unavailable") ||
    error.includes("verification is not configured")
  ) {
    return 503;
  }
  return 400;
}
