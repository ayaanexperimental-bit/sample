import type { D1Database } from "@cloudflare/workers-types";
import { getPublicShopOrder } from "../../../lib/server/shop";

type Env = {
  ADMIN_DB?: D1Database;
  SHOP_PAYMENT_PAGE_URL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

export async function onRequestGet({ request, env }: PagesContext) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order") || "";
  const accessKey = url.searchParams.get("key") || request.headers.get("x-shop-access-key") || "";
  const order = orderId ? await getPublicShopOrder({ accessKey, env, orderId }) : null;

  return shopJson({
    ok: true,
    order
  });
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
