import { expect, test } from "@playwright/test";
import { getFunnelById } from "../../lib/coach-platform";
import { createFunnelAccessCookie } from "../../lib/server/funnel-access";
import { createPaymentAccessCookie } from "../../lib/server/payment-access";
import {
  getPrivatePaymentPageUrl,
  getPrivateWhatsappGroupUrl,
  getPrivateWhatsappLinkMetadata
} from "../../lib/server/private-funnel-links";
import {
  createAdminCsrfToken,
  createAdminSessionCookie,
  type AdminSessionPayload
} from "../../lib/server/admin-auth";
import { onRequest as privateLinkRequest } from "../../functions/api/admin/masterclass-private-link";
import { onRequest as paymentStartRequest } from "../../functions/api/payment/start";
import { onRequest as whatsappAccessRequest } from "../../functions/api/whatsapp-access";

const FUNNEL_ACCESS_SECRET = "local-funnel-secret";
const SUCCESS_ACCESS_SECRET = "local-success-secret";
const PAID_FUNNEL_ID = "gyana-pcos-51";
const PRIVATE_WHATSAPP_URL = "https://chat.whatsapp.com/localRegressionInvite";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_DEV_OTP = "123456";
const ADMIN_SESSION_SECRET = "local-admin-private-link-reveal-secret";
const TABLE_WHATSAPP_URL = "https://chat.whatsapp.com/tableRegressionInvite";
const TABLE_PAYMENT_URL = "https://pages.razorpay.com/pl_localRegressionPayment/view";

test.describe("private WhatsApp links", () => {
  test("does not keep the paid WhatsApp invite in public funnel config", () => {
    const funnel = getFunnelById(PAID_FUNNEL_ID);

    expect(funnel).toBeTruthy();
    expect("whatsappGroupUrl" in (funnel as Record<string, unknown>)).toBe(false);
  });

  test("resolves private WhatsApp URL only from the D1 server table", async () => {
    const funnel = getFunnelById(PAID_FUNNEL_ID);
    if (!funnel) throw new Error("Missing paid funnel fixture.");

    expect(await getPrivateWhatsappGroupUrl(funnel, {})).toBeNull();
    expect(
      await getPrivateWhatsappGroupUrl(funnel, {
        ADMIN_DB: createPrivateLinksDb({
          [PAID_FUNNEL_ID]: {
            updatedAt: 1780000000,
            updatedBy: ADMIN_EMAIL,
            whatsappGroupUrl: TABLE_WHATSAPP_URL
          }
        }).db
      })
    ).toBe(TABLE_WHATSAPP_URL);

    await expect(getPrivateWhatsappLinkMetadata(funnel, {})).resolves.toMatchObject({
      configured: false,
      storageSource: "none"
    });
  });

  test("resolves private payment URL only from the D1 server table", async () => {
    const funnel = getFunnelById(PAID_FUNNEL_ID);
    if (!funnel) throw new Error("Missing paid funnel fixture.");

    expect(await getPrivatePaymentPageUrl(funnel, {})).toBeNull();
    expect(
      await getPrivatePaymentPageUrl(funnel, {
        ADMIN_DB: createPrivateLinksDb({
          [PAID_FUNNEL_ID]: {
            paymentPageUrl: TABLE_PAYMENT_URL,
            paymentUpdatedAt: 1780000000,
            paymentUpdatedBy: ADMIN_EMAIL,
            updatedAt: 1780000000,
            updatedBy: ADMIN_EMAIL,
            whatsappGroupUrl: TABLE_WHATSAPP_URL
          }
        }).db
      })
    ).toBe(TABLE_PAYMENT_URL);

    await expect(getPrivateWhatsappLinkMetadata(funnel, {})).resolves.toMatchObject({
      paymentPageConfigured: false,
      paymentPageStorageSource: "none"
    });
  });

  test("paid WhatsApp API returns join URL only when the paid hash and cookie match", async () => {
    const accessHash = "paidWhatsappRegressionAccessHash1234567890";
    const noCookie = await whatsappAccessRequest({
      env: {
        ADMIN_DB: createPrivateLinksDb({
          [PAID_FUNNEL_ID]: {
            updatedAt: 1780000000,
            updatedBy: ADMIN_EMAIL,
            whatsappGroupUrl: PRIVATE_WHATSAPP_URL
          }
        }).db,
        SUCCESS_ACCESS_SECRET
      },
      request: new Request(
        `https://ywcoach.com/api/whatsapp-access?access=${encodeURIComponent(accessHash)}`
      )
    });
    expect(noCookie.status).toBe(200);
    expect(await noCookie.json()).toMatchObject({
      allowed: false,
      reason: "paid_access_required"
    });

    const paidCookie = await createPaymentAccessCookie({
      accessHash,
      funnelId: PAID_FUNNEL_ID,
      paymentId: "pay_local_regression",
      secret: SUCCESS_ACCESS_SECRET,
      source: "test_verified_payment"
    });
    const allowed = await whatsappAccessRequest({
      env: {
        ADMIN_DB: createPrivateLinksDb({
          [PAID_FUNNEL_ID]: {
            updatedAt: 1780000000,
            updatedBy: ADMIN_EMAIL,
            whatsappGroupUrl: PRIVATE_WHATSAPP_URL
          }
        }).db,
        SUCCESS_ACCESS_SECRET
      },
      request: new Request(
        `https://ywcoach.com/api/whatsapp-access?access=${encodeURIComponent(accessHash)}`,
        {
          headers: {
            cookie: paidCookie.split(";")[0]
          }
        }
      )
    });

    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      allowed: true,
      joinUrl: PRIVATE_WHATSAPP_URL
    });
  });

  test("admin private WhatsApp reveal requires admin session, CSRF, and OTP", async () => {
    const privateLinksDb = createPrivateLinksDb();
    const env = {
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
      ADMIN_AUTH_DEMO_ENABLED: "true",
      ADMIN_DB: privateLinksDb.db,
      ADMIN_DEV_OTP,
      ADMIN_SESSION_SECRET
    };

    const unauthenticated = await privateLinkRequest({
      env,
      request: jsonRequest("http://127.0.0.1/api/admin/masterclass-private-link", {
        action: "reveal",
        entryCode: PAID_FUNNEL_ID,
        otp: ADMIN_DEV_OTP
      })
    });
    expect(unauthenticated.status).toBe(401);

    const { cookie, csrfToken } = await createAdminTestSession(env);

    const missingCsrf = await privateLinkRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/masterclass-private-link",
        {
          action: "reveal",
          entryCode: PAID_FUNNEL_ID,
          otp: ADMIN_DEV_OTP
        },
        { cookie }
      )
    });
    expect(missingCsrf.status).toBe(403);

    const sendOtp = await privateLinkRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/masterclass-private-link",
        {
          action: "send_otp",
          entryCode: PAID_FUNNEL_ID
        },
        { cookie, "x-yw-admin-csrf": csrfToken }
      )
    });
    expect(sendOtp.status).toBe(200);
    expect(await sendOtp.json()).toMatchObject({
      localOtpMode: true,
      ok: true
    });

    const updateLink = await privateLinkRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/masterclass-private-link",
        {
          action: "update_whatsapp",
          entryCode: PAID_FUNNEL_ID,
          otp: ADMIN_DEV_OTP,
          whatsappGroupUrl: TABLE_WHATSAPP_URL
        },
        { cookie, "x-yw-admin-csrf": csrfToken }
      )
    });
    expect(updateLink.status).toBe(200);
    expect(await updateLink.json()).toMatchObject({
      metadata: {
        configured: true,
        funnelId: PAID_FUNNEL_ID,
        storageSource: "d1_table",
        updatedBy: ADMIN_EMAIL
      },
      ok: true,
      privateLinkValuesExposed: false
    });
    expect(privateLinksDb.records.get(PAID_FUNNEL_ID)?.whatsappGroupUrl).toBe(TABLE_WHATSAPP_URL);

    const badPaymentUpdate = await privateLinkRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/masterclass-private-link",
        {
          action: "update_payment",
          entryCode: PAID_FUNNEL_ID,
          otp: ADMIN_DEV_OTP,
          paymentPageUrl: "https://evil.example/checkout"
        },
        { cookie, "x-yw-admin-csrf": csrfToken }
      )
    });
    expect(badPaymentUpdate.status).toBe(400);
    expect(await badPaymentUpdate.json()).toMatchObject({
      currentPaymentLinkPreserved: true,
      ok: false,
      privateLinkValuesExposed: false
    });
    expect(privateLinksDb.records.get(PAID_FUNNEL_ID)?.paymentPageUrl).toBe("");

    const updatePayment = await privateLinkRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/masterclass-private-link",
        {
          action: "update_payment",
          entryCode: PAID_FUNNEL_ID,
          otp: ADMIN_DEV_OTP,
          paymentPageUrl: TABLE_PAYMENT_URL
        },
        { cookie, "x-yw-admin-csrf": csrfToken }
      )
    });
    expect(updatePayment.status).toBe(200);
    expect(await updatePayment.json()).toMatchObject({
      currentPaymentLinkPreserved: true,
      metadata: {
        funnelId: PAID_FUNNEL_ID,
        paymentPageConfigured: true,
        paymentPageStorageSource: "d1_table",
        paymentPageUpdatedBy: ADMIN_EMAIL
      },
      ok: true,
      privateLinkValuesExposed: false
    });
    expect(privateLinksDb.records.get(PAID_FUNNEL_ID)?.paymentPageUrl).toBe(TABLE_PAYMENT_URL);

    const metadata = await privateLinkRequest({
      env,
      request: new Request("http://127.0.0.1/api/admin/masterclass-private-link", {
        headers: { cookie }
      })
    });
    expect(metadata.status).toBe(200);
    const metadataBody = await metadata.json();
    expect(JSON.stringify(metadataBody)).not.toContain(TABLE_WHATSAPP_URL);
    expect(JSON.stringify(metadataBody)).not.toContain(TABLE_PAYMENT_URL);
    expect(metadataBody.links[0]).toMatchObject({
      coachName: expect.any(String),
      configured: true,
      displayName: expect.any(String),
      entryPath: expect.any(String),
      paidPagePath: expect.any(String),
      paymentPageConfigured: true,
      paymentStatus: expect.any(String),
      privateWhatsappStatus: expect.any(String),
      status: expect.any(String),
      storageSource: "d1_table",
      successPath: expect.any(String)
    });

    const badOtp = await privateLinkRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/masterclass-private-link",
        {
          action: "reveal",
          entryCode: PAID_FUNNEL_ID,
          otp: "000000"
        },
        { cookie, "x-yw-admin-csrf": csrfToken }
      )
    });
    expect(badOtp.status).toBe(401);
    expect(await badOtp.json()).not.toHaveProperty("joinUrl");

    const revealed = await privateLinkRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/masterclass-private-link",
        {
          action: "reveal",
          entryCode: PAID_FUNNEL_ID,
          otp: ADMIN_DEV_OTP
        },
        { cookie, "x-yw-admin-csrf": csrfToken }
      )
    });
    expect(revealed.status).toBe(200);
    expect(await revealed.json()).toMatchObject({
      joinUrl: TABLE_WHATSAPP_URL,
      ok: true
    });
  });

  test("payment start uses validated D1 payment URL and fallback is support-only on failure", async () => {
    const privateLinksDb = createPrivateLinksDb({
      [PAID_FUNNEL_ID]: {
        paymentPageUrl: TABLE_PAYMENT_URL,
        paymentUpdatedAt: 1780000000,
        paymentUpdatedBy: ADMIN_EMAIL,
        updatedAt: 1780000000,
        updatedBy: ADMIN_EMAIL,
        whatsappGroupUrl: TABLE_WHATSAPP_URL
      }
    });
    const paidCookie = await createFunnelAccessCookie({
      entryCode: PAID_FUNNEL_ID,
      funnelId: PAID_FUNNEL_ID,
      secret: FUNNEL_ACCESS_SECRET,
      secure: true
    });
    const paymentStart = await paymentStartRequest({
      env: {
        ADMIN_DB: privateLinksDb.db,
        FUNNEL_ACCESS_SECRET,
        SUCCESS_ACCESS_SECRET: "local-success-secret"
      },
      request: new Request("https://ywcoach.com/api/payment/start", {
        headers: {
          cookie: paidCookie.split(";")[0]
        }
      })
    });

    expect(paymentStart.status).toBe(302);
    const paymentLocation = paymentStart.headers.get("location") || "";
    expect(paymentLocation).toContain(TABLE_PAYMENT_URL);
    expect(paymentLocation).toContain("registration_id=");

    const missingSecret = await paymentStartRequest({
      env: {
        ADMIN_DB: privateLinksDb.db,
        FUNNEL_ACCESS_SECRET
      },
      request: new Request("https://ywcoach.com/api/payment/start", {
        headers: {
          cookie: paidCookie.split(";")[0]
        }
      })
    });
    const fallbackHtml = await missingSecret.text();
    expect(missingSecret.status).toBe(503);
    expect(fallbackHtml).toContain("YW-ERR-5003");
    expect(fallbackHtml).toContain("Contact Support");
    expect(fallbackHtml).not.toContain(TABLE_PAYMENT_URL);
    expect(fallbackHtml).not.toContain(TABLE_WHATSAPP_URL);
  });
});

type PrivateLinksDbRecord = {
  paymentPageUrl?: string;
  paymentUpdatedAt?: number;
  paymentUpdatedBy?: string;
  updatedAt: number;
  updatedBy: string;
  whatsappGroupUrl: string;
};

function createPrivateLinksDb(initialRecords: Record<string, PrivateLinksDbRecord> = {}) {
  const records = new Map<string, PrivateLinksDbRecord>(
    Object.entries(initialRecords).map(([key, value]) => [key, { ...value }])
  );

  return {
    db: {
      prepare(statement: string) {
        return {
          bind(...values: unknown[]) {
            return createPrivateLinksStatement(statement, values, records);
          },
          first: async () => null,
          run: async () => ({ success: true })
        };
      }
    } as never,
    records
  };
}

function createPrivateLinksStatement(
  statement: string,
  values: unknown[],
  records: Map<string, PrivateLinksDbRecord>
) {
  return {
    first: async () => {
      if (!statement.includes("FROM private_funnel_links")) return null;

      const funnelId = String(values[0] || "");
      const record = records.get(funnelId);
      if (!record) return null;

      return {
        funnel_id: funnelId,
        payment_page_url: record.paymentPageUrl || "",
        payment_updated_at: record.paymentUpdatedAt || 0,
        payment_updated_by: record.paymentUpdatedBy || "",
        updated_at: record.updatedAt,
        updated_by: record.updatedBy,
        whatsapp_group_url: record.whatsappGroupUrl
      };
    },
    run: async () => {
      if (
        statement.includes("INSERT INTO private_funnel_links") &&
        statement.includes("payment_page_url")
      ) {
        const [funnelId, paymentPageUrl, paymentUpdatedAt, paymentUpdatedBy] = values;
        const current = records.get(String(funnelId)) || {
          updatedAt: 0,
          updatedBy: "",
          whatsappGroupUrl: ""
        };
        records.set(String(funnelId), {
          ...current,
          paymentPageUrl: String(paymentPageUrl || ""),
          paymentUpdatedAt: Number(paymentUpdatedAt),
          paymentUpdatedBy: String(paymentUpdatedBy || "")
        });
      } else if (statement.includes("INSERT INTO private_funnel_links")) {
        const [funnelId, whatsappGroupUrl, updatedAt, updatedBy] = values;
        const current: PrivateLinksDbRecord = records.get(String(funnelId)) || {
          paymentPageUrl: "",
          paymentUpdatedAt: 0,
          paymentUpdatedBy: "",
          updatedAt: 0,
          updatedBy: "",
          whatsappGroupUrl: ""
        };
        records.set(String(funnelId), {
          paymentPageUrl: current.paymentPageUrl || "",
          paymentUpdatedAt: current.paymentUpdatedAt || 0,
          paymentUpdatedBy: current.paymentUpdatedBy || "",
          updatedAt: Number(updatedAt),
          updatedBy: String(updatedBy || ""),
          whatsappGroupUrl: String(whatsappGroupUrl || "")
        });
      }

      return { success: true };
    }
  };
}

async function createAdminTestSession(env: {
  ADMIN_ALLOWED_EMAILS: string;
  ADMIN_SESSION_SECRET: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSessionPayload = {
    email: ADMIN_EMAIL,
    expiresAt: now + 8 * 60 * 60,
    issuedAt: now,
    otpVerified: true,
    source: "admin_auth"
  };
  const sessionCookie = await createAdminSessionCookie({
    email: ADMIN_EMAIL,
    env,
    nowSeconds: now,
    rememberDevice: false,
    secure: false
  });
  const csrfToken = await createAdminCsrfToken({ env, session });

  if (!sessionCookie) throw new Error("Expected admin session cookie.");
  if (!csrfToken) throw new Error("Expected admin CSRF token.");

  return {
    cookie: sessionCookie.split(";")[0],
    csrfToken
  };
}

function jsonRequest(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1",
      ...headers
    },
    method: "POST"
  });
}
