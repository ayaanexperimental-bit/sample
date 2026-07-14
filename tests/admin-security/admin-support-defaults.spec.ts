import { expect, test } from "@playwright/test";
import type { D1Database } from "@cloudflare/workers-types";
import { onRequest as supportDefaultsRequest } from "../../functions/api/admin/support-defaults";
import {
  createAdminCsrfToken,
  createAdminSessionCookie,
  type AdminSessionPayload
} from "../../lib/server/admin-auth";

const OWNER_EMAIL = "owner@example.com";
const SESSION_SECRET = "support-defaults-test-secret-at-least-32";

type SupportDefaultsRow = {
  created_at: number;
  id: string;
  support_email: string;
  support_message: string;
  support_name: string;
  support_phone: string;
  support_whatsapp: string;
  updated_at: number;
  updated_by: string;
};

type SupportDefaultsEnv = {
  ADMIN_ALLOWED_EMAILS: string;
  ADMIN_DB?: D1Database;
  ADMIN_SESSION_SECRET: string;
  NEXT_PUBLIC_SUPPORT_EMAIL?: string;
  NEXT_PUBLIC_SUPPORT_MESSAGE?: string;
  NEXT_PUBLIC_SUPPORT_NAME?: string;
  NEXT_PUBLIC_SUPPORT_PHONE?: string;
  NEXT_PUBLIC_SUPPORT_WHATSAPP?: string;
  ROOT_OWNER_EMAIL: string;
};

test.describe("admin support defaults API", () => {
  test("returns environment fallback values for an authenticated owner before DB values exist", async () => {
    const harness = createSupportDefaultsDb();
    const env = createEnv({ ADMIN_DB: harness.db });
    const { cookie } = await createAdminTestSession(env);

    const response = await supportDefaultsRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/support-defaults", {
        headers: { cookie }
      })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      defaults: {
        source: "env",
        supportEmail: "support@ywcoach.com",
        supportMessage: "Fallback support from env.",
        supportName: "YW Support",
        supportPhone: "+15551234567",
        supportWhatsapp: "https://wa.me/15551234567"
      },
      editable: true,
      ok: true
    });
  });

  test("rejects support default updates without a valid CSRF token", async () => {
    const harness = createSupportDefaultsDb();
    const env = createEnv({ ADMIN_DB: harness.db });
    const { cookie } = await createAdminTestSession(env);

    const response = await supportDefaultsRequest({
      env,
      request: jsonRequest(
        "https://ywcoach.com/api/admin/support-defaults",
        validSupportDefaultsInput(),
        { cookie }
      )
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({
      authenticated: true,
      authorized: false,
      error: "Admin request verification failed."
    });
    expect(harness.row).toBeNull();
  });

  test("validates support default input before persisting", async () => {
    const harness = createSupportDefaultsDb();
    const env = createEnv({ ADMIN_DB: harness.db });
    const { cookie, csrfToken } = await createAdminTestSession(env);

    const response = await supportDefaultsRequest({
      env,
      request: jsonRequest(
        "https://ywcoach.com/api/admin/support-defaults",
        {
          ...validSupportDefaultsInput(),
          supportEmail: "not-an-email"
        },
        {
          cookie,
          "x-yw-admin-csrf": csrfToken
        }
      )
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      error: "Enter a valid support email.",
      ok: false
    });
    expect(harness.row).toBeNull();
  });

  test("persists valid support defaults through the D1 table", async () => {
    const harness = createSupportDefaultsDb();
    const env = createEnv({ ADMIN_DB: harness.db });
    const { cookie, csrfToken } = await createAdminTestSession(env);

    const saveResponse = await supportDefaultsRequest({
      env,
      request: jsonRequest(
        "https://ywcoach.com/api/admin/support-defaults",
        validSupportDefaultsInput({
          supportEmail: "Desk@YWCoach.com",
          supportName: "Coach Success Desk"
        }),
        {
          cookie,
          "x-yw-admin-csrf": csrfToken
        }
      )
    });

    expect(saveResponse.status).toBe(200);
    const saveBody = await saveResponse.json();
    expect(saveBody).toMatchObject({
      defaults: {
        source: "d1_table",
        supportEmail: "desk@ywcoach.com",
        supportName: "Coach Success Desk",
        updatedBy: OWNER_EMAIL
      },
      editable: true,
      ok: true
    });
    expect(harness.row).toMatchObject({
      support_email: "desk@ywcoach.com",
      support_name: "Coach Success Desk",
      updated_by: OWNER_EMAIL
    });

    const getResponse = await supportDefaultsRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/support-defaults", {
        headers: { cookie }
      })
    });

    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody).toMatchObject({
      defaults: {
        source: "d1_table",
        supportEmail: "desk@ywcoach.com",
        supportName: "Coach Success Desk",
        updatedBy: OWNER_EMAIL
      },
      ok: true
    });
  });

  test("does not save editable support defaults when D1 is not configured", async () => {
    const env = createEnv();
    const { cookie, csrfToken } = await createAdminTestSession(env);

    const response = await supportDefaultsRequest({
      env,
      request: jsonRequest(
        "https://ywcoach.com/api/admin/support-defaults",
        validSupportDefaultsInput(),
        {
          cookie,
          "x-yw-admin-csrf": csrfToken
        }
      )
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({
      error: "Support defaults database is not configured.",
      ok: false
    });
  });
});

function createEnv(overrides: Partial<SupportDefaultsEnv> = {}): SupportDefaultsEnv {
  return {
    ADMIN_ALLOWED_EMAILS: OWNER_EMAIL,
    ADMIN_SESSION_SECRET: SESSION_SECRET,
    NEXT_PUBLIC_SUPPORT_EMAIL: "support@ywcoach.com",
    NEXT_PUBLIC_SUPPORT_MESSAGE: "Fallback support from env.",
    NEXT_PUBLIC_SUPPORT_NAME: "YW Support",
    NEXT_PUBLIC_SUPPORT_PHONE: "+15551234567",
    NEXT_PUBLIC_SUPPORT_WHATSAPP: "https://wa.me/15551234567",
    ROOT_OWNER_EMAIL: OWNER_EMAIL,
    ...overrides
  };
}

function createSupportDefaultsDb() {
  let row: SupportDefaultsRow | null = null;
  const statements: string[] = [];

  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const normalized = sql.toLowerCase().replace(/\s+/g, " ").trim();
      const statement = {
        all: async () => ({ results: [] }),
        bind: (...nextValues: unknown[]) => {
          values = nextValues;
          return statement;
        },
        first: async () => {
          statements.push(normalized);
          if (normalized.includes("from admin_support_defaults")) return row;
          return null;
        },
        run: async () => {
          statements.push(normalized);

          if (normalized.includes("insert into admin_support_defaults")) {
            const now = Number(values[6] || 0);
            row = {
              created_at: now,
              id: String(values[0] || ""),
              support_email: String(values[2] || ""),
              support_message: String(values[5] || ""),
              support_name: String(values[1] || ""),
              support_phone: String(values[3] || ""),
              support_whatsapp: String(values[4] || ""),
              updated_at: now,
              updated_by: String(values[7] || "")
            };
          }

          return { success: true };
        }
      };

      return statement;
    }
  } as unknown as D1Database;

  return {
    db,
    get row() {
      return row;
    },
    statements
  };
}

async function createAdminTestSession(env: SupportDefaultsEnv) {
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSessionPayload = {
    email: OWNER_EMAIL,
    expiresAt: now + 8 * 60 * 60,
    issuedAt: now,
    otpVerified: true,
    source: "admin_auth"
  };
  const sessionCookie = await createAdminSessionCookie({
    email: OWNER_EMAIL,
    env,
    nowSeconds: now,
    rememberDevice: false,
    secure: true
  });
  const csrfToken = await createAdminCsrfToken({ env, session });

  if (!sessionCookie || !csrfToken) throw new Error("Expected admin session credentials.");

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
      host: new URL(url).host,
      origin: new URL(url).origin,
      ...headers
    },
    method: "PATCH"
  });
}

function validSupportDefaultsInput(overrides: Record<string, unknown> = {}) {
  return {
    supportEmail: "support@ywcoach.com",
    supportMessage: "Contact the support desk for help.",
    supportName: "Yours Wellness Support",
    supportPhone: "+15551234567",
    supportWhatsapp: "https://wa.me/15551234567",
    ...overrides
  };
}
