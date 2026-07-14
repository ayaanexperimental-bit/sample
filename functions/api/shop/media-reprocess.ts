import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { normalizeCoachSlug } from "../../../lib/admin-coach-sites";
import type { CoachImageProviderPreference } from "../../../lib/server/coach-image-processing";
import { reprocessStoredCoachImage } from "../../../lib/server/coach-image-processing";
import { readJsonBody } from "../../../lib/server/admin-auth";
import { getShopOrderForClient } from "../../../lib/server/shop";

type Env = {
  ADMIN_DB?: D1Database;
  COACH_MEDIA_BUCKET?: R2Bucket;
  IMAGE_BG_REMOVAL_ENABLED?: string;
  IMAGE_BG_REMOVAL_PROVIDER?: string;
  IMAGE_BG_REMOVAL_QUALITY_THRESHOLD?: string;
  PHOTOROOM_API_KEY?: string;
  REMOVEBG_API_KEY?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type ReprocessBody = {
  accessKey?: unknown;
  orderId?: unknown;
  originalObjectKey?: unknown;
  provider?: unknown;
};

export async function onRequestPost({ env, request }: PagesContext) {
  if (!env.COACH_MEDIA_BUCKET) {
    return shopJson({ ok: false, error: "Coach media storage is not configured." }, 503);
  }

  const body = await readJsonBody<ReprocessBody>(request);
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const accessKey =
    typeof body?.accessKey === "string"
      ? body.accessKey
      : request.headers.get("x-shop-access-key") || "";
  const order = orderId ? await getShopOrderForClient({ accessKey, env, orderId }) : null;
  if (!order) {
    return shopJson({ ok: false, error: "Open a valid secure Shop draft first." }, 401);
  }
  if (
    ["paid", "published", "publishing"].includes(order.paymentStatus) ||
    ["published", "publishing"].includes(order.siteStatus)
  ) {
    return shopJson(
      { ok: false, error: "This paid or published website is locked from coach-side edits." },
      409
    );
  }

  const originalObjectKey =
    typeof body?.originalObjectKey === "string" ? body.originalObjectKey : "";
  const slug = normalizeCoachSlug(order.slug);
  if (!slug || !originalObjectKey) {
    return shopJson({ ok: false, error: "Original coach image details are required." }, 400);
  }

  try {
    const media = await reprocessStoredCoachImage({
      env,
      originalObjectKey,
      providerOverride: normalizeProvider(body?.provider),
      slug,
      uploadedBy: "public-shop-builder",
    });
    return shopJson({ configured: true, media, ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Coach photo could not be reprocessed safely.";
    return shopJson({ ok: false, error: message }, message.includes("not configured") ? 503 : 400);
  }
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

function normalizeProvider(value: unknown): CoachImageProviderPreference {
  return value === "photoroom" || value === "removebg" ? value : "auto";
}
