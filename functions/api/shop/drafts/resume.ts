import type { D1Database } from "@cloudflare/workers-types";
import { readJsonBody } from "../../../../lib/server/admin-auth";
import { getPublicShopOrder } from "../../../../lib/server/shop";

type Env = {
  ADMIN_DB?: D1Database;
  SHOP_PAYMENT_PAGE_URL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type ResumeBody = {
  accessKey?: unknown;
  orderId?: unknown;
};

export async function onRequestPost({ request, env }: PagesContext) {
  const body = await readJsonBody<ResumeBody>(request);
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const accessKey =
    typeof body?.accessKey === "string"
      ? body.accessKey
      : request.headers.get("x-shop-access-key") || "";
  const order = orderId ? await getPublicShopOrder({ accessKey, env, orderId }) : null;

  return shopJson({
    ok: Boolean(order && order.siteStatus !== "protected"),
    order
  });
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
