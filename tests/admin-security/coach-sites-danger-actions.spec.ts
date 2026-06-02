import { expect, test } from "@playwright/test";
import {
  createAdminCsrfToken,
  createAdminSessionCookie,
  type AdminSessionPayload
} from "../../lib/server/admin-auth";
import { onRequest as coachSitesRequest } from "../../functions/api/admin/coach-sites/index";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_DEV_OTP = "123456";
const ADMIN_SESSION_SECRET = "local-admin-coach-sites-danger-secret";

test.describe("coach site dangerous actions", () => {
  test("archive and remove require admin session, CSRF, and OTP", async () => {
    const coachSitesDb = createCoachSitesDb();
    const env = {
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
      ADMIN_AUTH_DEMO_ENABLED: "true",
      ADMIN_DB: coachSitesDb.db,
      ADMIN_DEV_OTP,
      ADMIN_SESSION_SECRET
    };

    const unauthenticated = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: ADMIN_DEV_OTP,
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        {},
        "PATCH"
      )
    });
    expect(unauthenticated.status).toBe(401);

    const { cookie, csrfToken } = await createAdminTestSession(env);

    const missingCsrf = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: ADMIN_DEV_OTP,
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        { cookie },
        "PATCH"
      )
    });
    expect(missingCsrf.status).toBe(403);

    const missingOtp = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(missingOtp.status).toBe(400);

    const sendOtp = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          action: "send_otp",
          siteId: "coach-site-local",
          status: "removed"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(sendOtp.status).toBe(200);
    expect(await sendOtp.json()).toMatchObject({
      demoMode: true,
      ok: true
    });

    const wrongOtp = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: "000000",
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(wrongOtp.status).toBe(401);
    expect(coachSitesDb.records.get("coach-site-local")?.status).toBe("published");

    const archive = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: ADMIN_DEV_OTP,
          removalReason: "duplicate site",
          siteId: "coach-site-local",
          status: "archived"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(archive.status).toBe(200);
    expect(await archive.json()).toMatchObject({
      coachSite: {
        id: "coach-site-local",
        status: "archived"
      },
      ok: true
    });

    const remove = await coachSitesRequest({
      env,
      request: jsonRequest(
        "http://127.0.0.1/api/admin/coach-sites",
        {
          otp: ADMIN_DEV_OTP,
          removalReason: "coach left program",
          siteId: "coach-site-local",
          status: "removed"
        },
        { cookie, "x-yw-admin-csrf": csrfToken },
        "PATCH"
      )
    });
    expect(remove.status).toBe(200);
    expect(await remove.json()).toMatchObject({
      coachSite: {
        id: "coach-site-local",
        status: "removed"
      },
      ok: true
    });

    const listed = await coachSitesRequest({
      env,
      request: new Request("http://127.0.0.1/api/admin/coach-sites", {
        headers: { cookie, host: "127.0.0.1" }
      })
    });
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.coachSites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "coach-site-local",
          status: "removed"
        })
      ])
    );
  });
});

type CoachSiteRowRecord = {
  analytics_json: string;
  bio: string;
  coach_email: string;
  coach_id: string;
  coach_name: string;
  coach_phone: string;
  content_json: string;
  created_at: number;
  created_by: string;
  google_form_url: string;
  hero_media_type: string;
  id: string;
  location: string;
  logo_url: string;
  niche: string;
  photo_url: string;
  public_url: string;
  register_button_text: string;
  selected_theme_id: string;
  slug: string;
  status: string;
  support_text: string;
  video_url: string;
  vision: string;
  whatsapp_link: string;
};

function createCoachSitesDb() {
  const records = new Map<string, CoachSiteRowRecord>([
    [
      "coach-site-local",
      {
        analytics_json: JSON.stringify({
          averageVisits: 0,
          conversionRate: "0%",
          dailyVisits: 0,
          deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
          lastUpdated: "Test",
          monthlyVisits: 0,
          region: "Test",
          source: "Test",
          totalRegisterClicks: 0,
          totalVisits: 0,
          totalWhatsappClicks: 0,
          videoPlays: 0,
          weeklyVisits: 0
        }),
        bio: "Test coach bio.",
        coach_email: "",
        coach_id: "coach-local",
        coach_name: "Local Coach",
        coach_phone: "",
        content_json: JSON.stringify({
          benefits: ["Benefit one", "Benefit two", "Benefit three"],
          coachIntro: "Intro",
          ctaText: "Register Now",
          faq: [{ answer: "Answer", question: "Question" }],
          heroHeadline: "Local coach headline",
          socialCopy: "Social copy",
          subheadline: "Subheadline",
          trustText: "Trust text",
          visionText: "Vision"
        }),
        created_at: 1780000000,
        created_by: ADMIN_EMAIL,
        google_form_url: "",
        hero_media_type: "none",
        id: "coach-site-local",
        location: "Local",
        logo_url: "",
        niche: "Wellness",
        photo_url: "",
        public_url: "/coach/local-coach",
        register_button_text: "Register Now",
        selected_theme_id: "default-current",
        slug: "local-coach",
        status: "published",
        support_text: "",
        video_url: "",
        vision: "Vision",
        whatsapp_link: ""
      }
    ]
  ]);

  return {
    db: {
      prepare(statement: string) {
        return {
          all: async () => ({ results: Array.from(records.values()) }),
          bind(...values: unknown[]) {
            return createCoachSitesStatement(statement, values, records);
          },
          first: async () => null,
          run: async () => ({ success: true })
        };
      }
    } as never,
    records
  };
}

function createCoachSitesStatement(
  statement: string,
  values: unknown[],
  records: Map<string, CoachSiteRowRecord>
) {
  return {
    first: async () => {
      if (statement.includes("SELECT * FROM coach_sites WHERE id")) {
        return records.get(String(values[0] || "")) || null;
      }

      return null;
    },
    run: async () => {
      if (statement.includes("UPDATE coach_sites")) {
        const [status, updatedAt, updatedBy, id] = values;
        const existing = records.get(String(id || ""));
        if (existing) {
          records.set(existing.id, {
            ...existing,
            created_by: existing.created_by || String(updatedBy || ""),
            status: String(status || existing.status),
            updated_at: Number(updatedAt || 0),
            updated_by: String(updatedBy || "")
          } as CoachSiteRowRecord & { updated_at: number; updated_by: string });
        }
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
  headers: Record<string, string> = {},
  method = "POST"
) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1",
      ...headers
    },
    method
  });
}
