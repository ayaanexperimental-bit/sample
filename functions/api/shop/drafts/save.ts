import type { D1Database } from "@cloudflare/workers-types";
import { readJsonBody } from "../../../../lib/server/admin-auth";
import { saveShopDraft } from "../../../../lib/server/shop";
import type { ShopBuilderState } from "../../../../lib/shop-builder";

type Env = {
  ADMIN_DB?: D1Database;
  SHOP_PAYMENT_PAGE_URL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type DraftBody = {
  accessKey?: unknown;
  idempotencyKey?: unknown;
  state?: Partial<ShopBuilderState>;
};

export async function onRequestPost({ request, env }: PagesContext) {
  const body = await readJsonBody<DraftBody>(request);
  const result = await saveShopDraft({
    accessKey:
      typeof body?.accessKey === "string"
        ? body.accessKey
        : request.headers.get("x-shop-access-key") || undefined,
    env,
    idempotencyKey: typeof body?.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    state: body?.state || {}
  });

  return shopJson(result, result.ok ? 200 : getDraftFailureStatus(result.error));
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

function getDraftFailureStatus(error?: string) {
  if (!error) return 503;
  if (error.includes("saved draft exists")) return 409;
  if (error.includes("paid publishing workflow")) return 409;
  if (error.includes("not configured")) return 503;
  return 400;
}
