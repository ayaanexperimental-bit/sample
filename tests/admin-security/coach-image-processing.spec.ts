import { expect, test } from "@playwright/test";
import { onRequestPost as handleShopMediaUpload } from "../../functions/api/shop/media";
import { onRequestPost as handleShopMediaReprocess } from "../../functions/api/shop/media-reprocess";
import {
  isOwnedCoachOriginalObjectKey,
  processAndPersistCoachImage,
  processCoachImageCutout,
} from "../../lib/server/coach-image-processing";

test.describe("coach image processing and Shop media ownership", () => {
  test("tries Photoroom before remove.bg and accepts only a validated transparent result", async () => {
    const calls: string[] = [];
    const transparentPng = createInspectablePng({ colorType: 6, height: 640, width: 480 });
    const result = await processCoachImageCutout({
      env: {
        IMAGE_BG_REMOVAL_PROVIDER: "auto",
        PHOTOROOM_API_KEY: "server-photoroom-key",
        REMOVEBG_API_KEY: "server-removebg-key",
      },
      fetcher: (async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("photoroom")) return new Response(null, { status: 503 });
        return new Response(transparentPng, {
          headers: { "content-type": "image/png" },
          status: 200,
        });
      }) as typeof fetch,
      originalFile: createOpaqueUpload(),
    });

    expect(calls).toEqual([
      "https://sdk.photoroom.com/v1/segment",
      "https://api.remove.bg/v1.0/removebg",
    ]);
    expect(result).toMatchObject({
      attemptErrorCodes: ["photoroom_http_503"],
      fallbackMode: "cutout",
      height: 640,
      provider: "removebg",
      qualityStatus: "passed",
      status: "cutout_ready",
      width: 480,
    });
  });

  test("uses the validated browser cutout last and otherwise keeps a framed original", async () => {
    const localResult = await processCoachImageCutout({
      clientCutoutFile: new File(
        [createInspectablePng({ colorType: 6, height: 512, width: 384 })],
        "local-cutout.png",
        { type: "image/png" }
      ),
      env: {},
      originalFile: createOpaqueUpload(),
    });
    expect(localResult).toMatchObject({
      attemptErrorCodes: ["photoroom_not_configured", "removebg_not_configured"],
      fallbackMode: "cutout",
      provider: "local-browser",
      status: "cutout_ready",
    });

    const fallbackResult = await processCoachImageCutout({
      env: { PHOTOROOM_API_KEY: "server-key", IMAGE_BG_REMOVAL_PROVIDER: "photoroom" },
      fetcher: (async () =>
        new Response(createInspectablePng({ colorType: 2, height: 640, width: 480 }), {
          headers: { "content-type": "image/png" },
          status: 200,
        })) as typeof fetch,
      originalFile: createOpaqueUpload(),
    });
    expect(fallbackResult).toMatchObject({
      attemptErrorCodes: ["photoroom_missing_alpha"],
      errorCode: "photoroom_missing_alpha",
      fallbackMode: "framed",
      provider: "none",
      qualityStatus: "needs_manual_review",
      status: "framed_fallback",
    });
    expect(fallbackResult.bytes).toBeUndefined();
  });

  test("rejects low-resolution provider output and cross-coach original keys", async () => {
    const result = await processCoachImageCutout({
      env: { PHOTOROOM_API_KEY: "server-key", IMAGE_BG_REMOVAL_PROVIDER: "photoroom" },
      fetcher: (async () =>
        new Response(createInspectablePng({ colorType: 6, height: 120, width: 120 }), {
          headers: { "content-type": "image/png" },
          status: 200,
        })) as typeof fetch,
      originalFile: createOpaqueUpload(),
    });

    expect(result).toMatchObject({
      attemptErrorCodes: ["photoroom_low_resolution"],
      fallbackMode: "framed",
      qualityStatus: "needs_manual_review",
    });
    expect(
      isOwnedCoachOriginalObjectKey(
        "coach-sites/owned-coach/image/original/photo.jpg",
        "owned-coach"
      )
    ).toBe(true);
    expect(
      isOwnedCoachOriginalObjectKey(
        "coach-sites/other-coach/image/original/photo.jpg",
        "owned-coach"
      )
    ).toBe(false);
    expect(
      isOwnedCoachOriginalObjectKey(
        "coach-sites/owned-coach/image/original/../other/photo.jpg",
        "owned-coach"
      )
    ).toBe(false);
  });

  test("falls back to the framed original when cutout metadata persistence fails", async () => {
    const harness = createCutoutPersistenceFailureHarness();
    const originalObjectKey =
      "coach-sites/owned-coach/image/original/original-transparent.png";
    const originalUrl = `/api/coach-media?key=${encodeURIComponent(originalObjectKey)}`;

    const result = await processAndPersistCoachImage({
      env: harness.env,
      originalFile: new File(
        [createInspectablePng({ colorType: 6, height: 640, width: 480 })],
        "original-transparent.png",
        { type: "image/png" }
      ),
      originalObjectKey,
      originalUrl,
      slug: "owned-coach",
      uploadedBy: "owner@example.com",
    });

    expect(result).toMatchObject({
      fallbackMode: "framed",
      objectKey: originalObjectKey,
      originalObjectKey,
      processingAttemptErrorCodes: ["cutout_persistence_failed"],
      processingErrorCode: "cutout_persistence_failed",
      processingProvider: "already-transparent",
      processingStatus: "framed_fallback",
      publicUrl: originalUrl,
      qualityStatus: "needs_manual_review",
    });
    expect(result.cutoutUrl).toBeUndefined();
    expect(harness.putKeys).toHaveLength(1);
    expect(harness.putKeys[0]).toMatch(/^coach-sites\/owned-coach\/image\/cutout\//);
    expect(harness.deleteKeys).toEqual(harness.putKeys);
    expect(harness.processingUpdates.map((values) => values[2])).toEqual([
      "cutout_ready",
      "framed_fallback",
    ]);
  });

  test("requires the private Shop access key and derives upload storage from the owned order", async () => {
    const harness = createShopMediaHarness();
    const denied = await handleShopMediaUpload({
      env: harness.env,
      request: createShopUploadRequest("wrong-private-key", "attacker-controlled"),
    });
    expect(denied.status).toBe(401);
    expect(harness.putKeys).toEqual([]);

    const disguisedExecutable = new Uint8Array(4096);
    disguisedExecutable.set([0x4d, 0x5a, 0x90, 0x00]);
    const rejectedFile = await handleShopMediaUpload({
      env: harness.env,
      request: createShopUploadRequest(
        harness.accessKey,
        "attacker-controlled",
        new File([disguisedExecutable], "portrait.jpg", { type: "image/jpeg" }),
        "image"
      ),
    });
    expect(rejectedFile.status).toBe(400);
    expect(harness.putKeys).toEqual([]);

    const accepted = await handleShopMediaUpload({
      env: harness.env,
      request: createShopUploadRequest(harness.accessKey, "attacker-controlled"),
    });
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toMatchObject({ ok: true });
    expect(harness.putKeys).toHaveLength(1);
    expect(harness.putKeys[0]).toMatch(/^coach-sites\/owned-coach\/video\//);
    expect(harness.putKeys[0]).not.toContain("attacker-controlled");
  });

  test("rejects reprocessing another coach's stored original before reading R2", async () => {
    const harness = createShopMediaHarness();
    const response = await handleShopMediaReprocess({
      env: harness.env,
      request: new Request("http://127.0.0.1:4802/api/shop/media-reprocess", {
        body: JSON.stringify({
          accessKey: harness.accessKey,
          orderId: harness.orderId,
          originalObjectKey: "coach-sites/other-coach/image/original/photo.jpg",
          provider: "auto",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "The original coach image reference is invalid.",
      ok: false,
    });
    expect(harness.getKeys).toEqual([]);
  });
});

function createOpaqueUpload() {
  const bytes = new Uint8Array(4096);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return new File([bytes], "coach.jpg", { type: "image/jpeg" });
}

function createInspectablePng({
  colorType,
  height,
  width,
}: {
  colorType: 2 | 4 | 6;
  height: number;
  width: number;
}) {
  const bytes = new Uint8Array(4096);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  writeAscii(bytes, 12, "IHDR");
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = colorType;
  writeAscii(bytes, bytes.length - 8, "IEND");
  return bytes;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function createShopUploadRequest(
  accessKey: string,
  untrustedSlug: string,
  file = new File([new Uint8Array([0, 0, 0, 24])], "intro.mp4", { type: "video/mp4" }),
  mediaType: "image" | "video" = "video"
) {
  const body = new FormData();
  body.append("accessKey", accessKey);
  body.append("file", file);
  body.append("mediaType", mediaType);
  body.append("orderId", "shop-order-owned");
  body.append("slug", untrustedSlug);
  return new Request("http://127.0.0.1:4802/api/shop/media", { body, method: "POST" });
}

function createShopMediaHarness() {
  const accessKey = "private-shop-access-key";
  const orderId = "shop-order-owned";
  const putKeys: string[] = [];
  const getKeys: string[] = [];
  const shopRow = {
    builder_json: JSON.stringify({
      coachEmail: "owner@example.com",
      coachName: "Owned Coach",
      email: "owner@example.com",
      niche: "General wellness",
      slug: "owned-coach",
      status: "draft",
    }),
    client_access_key: accessKey,
    coach_email: "owner@example.com",
    coach_name: "Owned Coach",
    coach_phone: "",
    contact_link: "",
    content_json: "{}",
    created_at: 1_700_000_000,
    id: "shop-site-owned",
    issue_status: "",
    location: "India",
    locked_at: null,
    niche: "General wellness",
    order_id: orderId,
    payment_date: null,
    payment_reference: "",
    payment_status: "draft",
    public_url: "",
    published_at: null,
    retry_count: 0,
    selected_theme_id: "canonical-coach-site-template",
    site_status: "draft",
    slug: "owned-coach",
    updated_at: 1_700_000_000,
    workflow_stage: "draft",
  };

  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        all: async () => ({ results: [] }),
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return statement;
        },
        first: async () => {
          if (/SELECT \* FROM shop_sites WHERE order_id/i.test(sql)) {
            return values[0] === orderId ? shopRow : null;
          }
          if (/SELECT client_access_key FROM shop_sites/i.test(sql)) {
            return values[0] === orderId ? { client_access_key: accessKey } : null;
          }
          return null;
        },
        run: async () => ({ meta: {}, success: true }),
      };
      return statement;
    },
  };

  const bucket = {
    get: async (key: string) => {
      getKeys.push(key);
      return null;
    },
    put: async (key: string) => {
      putKeys.push(key);
      return {};
    },
  };

  return {
    accessKey,
    env: { ADMIN_DB: db, COACH_MEDIA_BUCKET: bucket } as never,
    getKeys,
    orderId,
    putKeys,
  };
}

function createCutoutPersistenceFailureHarness() {
  const deleteKeys: string[] = [];
  const processingUpdates: unknown[][] = [];
  const putKeys: string[] = [];

  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return statement;
        },
        first: async () => ({ id: "coach-site-owned" }),
        run: async () => {
          if (/INSERT INTO coach_site_media/i.test(sql)) {
            throw new Error("simulated cutout metadata failure");
          }
          if (/UPDATE coach_site_media/i.test(sql)) {
            processingUpdates.push(values);
          }
          return { meta: {}, success: true };
        },
      };
      return statement;
    },
  };

  const bucket = {
    delete: async (key: string) => {
      deleteKeys.push(key);
    },
    put: async (key: string) => {
      putKeys.push(key);
      return {};
    },
  };

  return {
    deleteKeys,
    env: { ADMIN_DB: db, COACH_MEDIA_BUCKET: bucket } as never,
    processingUpdates,
    putKeys,
  };
}
