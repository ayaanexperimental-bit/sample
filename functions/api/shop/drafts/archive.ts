import type { D1Database } from "@cloudflare/workers-types";
import { readJsonBody } from "../../../../lib/server/admin-auth";
import { archiveShopDraft } from "../../../../lib/server/shop";

type Env = {
  ADMIN_DB?: D1Database;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type ArchiveBody = {
  accessKey?: unknown;
  orderId?: unknown;
};

export async function onRequestPost({ request, env }: PagesContext) {
  const body = await readJsonBody<ArchiveBody>(request);
  const result = await archiveShopDraft({
    accessKey:
      typeof body?.accessKey === "string"
        ? body.accessKey
        : request.headers.get("x-shop-access-key") || undefined,
    env,
    orderId: typeof body?.orderId === "string" ? body.orderId : "",
    reason: "archive"
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
