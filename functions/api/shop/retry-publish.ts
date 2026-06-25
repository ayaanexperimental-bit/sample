import type { D1Database } from "@cloudflare/workers-types";
import { readJsonBody } from "../../../lib/server/admin-auth";
import { getPublicShopOrder, retryShopPublish } from "../../../lib/server/shop";

type Env = {
  ADMIN_DB?: D1Database;
  SHOP_PAYMENT_PAGE_URL?: string;
  SHOP_RAZORPAY_WEBHOOK_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type RetryBody = {
  accessKey?: unknown;
  orderId?: unknown;
};

export async function onRequestPost({ request, env }: PagesContext) {
  const body = (await readJsonBody<RetryBody>(request)) || {};
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const accessKey =
    typeof body.accessKey === "string"
      ? body.accessKey.trim()
      : request.headers.get("x-shop-access-key") || "";

  if (!orderId || !accessKey) {
    return shopJson({ ok: false, error: "Secure resume link is required to retry publishing." }, 403);
  }

  const order = await getPublicShopOrder({ accessKey, env, orderId });
  if (!order || !order.state) {
    return shopJson({ ok: false, error: "Secure resume link could not be verified." }, 403);
  }

  if (order.siteStatus === "published") {
    return shopJson({ ok: true, order });
  }

  if (order.siteStatus !== "publish_failed") {
    return shopJson({ ok: false, error: "This Shop order is not waiting for publish retry." }, 409);
  }

  if (order.paymentStatus !== "paid" && order.paymentStatus !== "publishing") {
    return shopJson({ ok: false, error: "Payment is not verified for this Shop order." }, 409);
  }

  const result = await retryShopPublish({
    adminEmail: "shop-customer-retry",
    env,
    orderId
  });

  return shopJson(result, result.ok ? 200 : 400);
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
