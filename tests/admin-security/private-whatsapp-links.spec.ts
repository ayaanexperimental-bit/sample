import { expect, test } from "@playwright/test";
import { getFunnelById } from "../../lib/coach-platform";
import { createFunnelAccessCookie } from "../../lib/server/funnel-access";
import {
  getPrivateWhatsappGroupUrl,
  getPrivateWhatsappLinkMetadata
} from "../../lib/server/private-funnel-links";
import {
  createAdminCsrfToken,
  createAdminSessionCookie,
  type AdminSessionPayload
} from "../../lib/server/admin-auth";
import { onRequest as privateLinkRequest } from "../../functions/api/admin/masterclass-private-link";
import { onRequest as whatsappAccessRequest } from "../../functions/api/whatsapp-access";

const FUNNEL_ACCESS_SECRET = "local-funnel-secret";
const PAID_FUNNEL_ID = "gyana-pcos-51";
const PRIVATE_WHATSAPP_URL = "https://chat.whatsapp.com/localRegressionInvite";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_DEV_OTP = "123456";
const ADMIN_SESSION_SECRET = "local-admin-private-link-reveal-secret";
const TABLE_WHATSAPP_URL = "https://chat.whatsapp.com/tableRegressionInvite";

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

  test("paid WhatsApp API returns join URL only when env and funnel cookie match", async () => {
    const noCookie = await whatsappAccessRequest({
      env: {
        ADMIN_DB: createPrivateLinksDb({
          [PAID_FUNNEL_ID]: {
            updatedAt: 1780000000,
            updatedBy: ADMIN_EMAIL,
            whatsappGroupUrl: PRIVATE_WHATSAPP_URL
          }
        }).db,
        FUNNEL_ACCESS_SECRET
      },
      request: new Request("https://ywcoach.com/api/whatsapp-access")
    });
    expect(noCookie.status).toBe(200);
    expect(await noCookie.json()).toMatchObject({
      allowed: false,
      reason: "funnel_access_required"
    });

    const paidCookie = await createFunnelAccessCookie({
      entryCode: PAID_FUNNEL_ID,
      funnelId: PAID_FUNNEL_ID,
      secret: FUNNEL_ACCESS_SECRET,
      secure: true
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
        FUNNEL_ACCESS_SECRET
      },
      request: new Request("https://ywcoach.com/api/whatsapp-access", {
        headers: {
          cookie: paidCookie.split(";")[0]
        }
      })
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
      demoMode: true,
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

    const metadata = await privateLinkRequest({
      env,
      request: new Request("http://127.0.0.1/api/admin/masterclass-private-link", {
        headers: { cookie }
      })
    });
    expect(metadata.status).toBe(200);
    const metadataBody = await metadata.json();
    expect(JSON.stringify(metadataBody)).not.toContain(TABLE_WHATSAPP_URL);
    expect(metadataBody.links[0]).toMatchObject({
      configured: true,
      storageSource: "d1_table"
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
});

type PrivateLinksDbRecord = {
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
        updated_at: record.updatedAt,
        updated_by: record.updatedBy,
        whatsapp_group_url: record.whatsappGroupUrl
      };
    },
    run: async () => {
      if (statement.includes("INSERT INTO private_funnel_links")) {
        const [funnelId, whatsappGroupUrl, updatedAt, updatedBy] = values;
        records.set(String(funnelId), {
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
