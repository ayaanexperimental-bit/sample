import { expect, test } from "@playwright/test";
import { onRequest as middlewareRequest } from "../../functions/_middleware";
import { onRequest as dashboardOverviewRequest } from "../../functions/api/admin/dashboard/overview";
import { onRequest as forgotPasswordRequest } from "../../functions/api/admin/auth/forgot-password";
import { onRequest as loginRequest } from "../../functions/api/admin/auth/login";
import { onRequest as logoutRequest } from "../../functions/api/admin/auth/logout";
import { onRequest as resendOtpRequest } from "../../functions/api/admin/auth/resend-otp";
import { onRequest as resetPasswordRequest } from "../../functions/api/admin/auth/reset-password";
import { onRequest as sessionRequest } from "../../functions/api/admin/auth/session";
import { onRequest as verifyOtpRequest } from "../../functions/api/admin/auth/verify-otp";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_DEV_OTP = "123456";
const GENERIC_ADMIN_AUTH_ERROR = "Invalid credentials or unauthorized admin access.";

const env = {
  ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
  ADMIN_AUTH_DEMO_ENABLED: "true",
  ADMIN_DEV_OTP,
  ADMIN_EMAIL_OTP_ENABLED: "false",
  ADMIN_SESSION_SECRET: "local-admin-security-regression-secret",
  FUNNEL_ACCESS_SECRET: "local-funnel-secret"
};

type JsonRecord = Record<string, unknown>;

test.describe("admin auth security protections", () => {
  test("blocks demo OTP session creation in production-like mode", async () => {
    const response = await verifyOtpRequest({
      env,
      request: jsonRequest("https://ywcoach.com/api/admin/auth/verify-otp", {
        email: ADMIN_EMAIL,
        otp: ADMIN_DEV_OTP
      })
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({
      error: GENERIC_ADMIN_AUTH_ERROR,
      ok: false
    });
  });

  test("keeps placeholder password login and reset-password backends disabled", async () => {
    const login = await loginRequest({
      env,
      request: jsonRequest("https://ywcoach.com/api/admin/auth/login", {
        email: ADMIN_EMAIL,
        password: "CorrectHorseBatteryStaple!123"
      })
    });
    await expectDisabledAuthResponse(login);

    const sessionAfterLogin = await sessionRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/auth/session")
    });
    await expectUnauthenticatedSession(sessionAfterLogin);

    const resetPassword = await resetPasswordRequest({
      env,
      request: jsonRequest("https://ywcoach.com/api/admin/auth/reset-password", {
        confirmPassword: "CorrectHorseBatteryStaple!123",
        email: ADMIN_EMAIL,
        newPassword: "CorrectHorseBatteryStaple!123"
      })
    });
    await expectDisabledAuthResponse(resetPassword);

    const forgotPassword = await forgotPasswordRequest({
      env,
      request: jsonRequest("https://ywcoach.com/api/admin/auth/forgot-password", {
        email: ADMIN_EMAIL
      })
    });
    await expectDisabledAuthResponse(forgotPassword);

    const resendOtp = await resendOtpRequest({
      env,
      request: jsonRequest("https://ywcoach.com/api/admin/auth/resend-otp", {
        email: ADMIN_EMAIL
      })
    });
    await expectDisabledAuthResponse(resendOtp);

    const sessionAfterReset = await sessionRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/auth/session")
    });
    await expectUnauthenticatedSession(sessionAfterReset);
  });

  test("guards admin dashboard/API and requires CSRF for authenticated logout", async () => {
    let publicLoginNextCalled = false;
    const publicLoginPage = await middlewareRequest({
      env,
      next: async () => {
        publicLoginNextCalled = true;
        return new Response("login");
      },
      request: new Request("https://ywcoach.com/admin/login")
    });
    expect(publicLoginNextCalled).toBe(true);
    expect(publicLoginPage.status).toBe(200);

    const unauthenticatedPage = await middlewareRequest({
      env,
      next: async () => new Response("dashboard"),
      request: new Request("https://ywcoach.com/admin/dashboard")
    });
    expect(unauthenticatedPage.status).toBe(302);
    expect(unauthenticatedPage.headers.get("location")).toBe(
      "https://ywcoach.com/admin/login?next=%2Fadmin%2Fdashboard"
    );

    let futureAdminNextCalled = false;
    const unauthenticatedFutureAdminPage = await middlewareRequest({
      env,
      next: async () => {
        futureAdminNextCalled = true;
        return new Response("future admin page");
      },
      request: new Request("https://ywcoach.com/admin/users")
    });
    expect(futureAdminNextCalled).toBe(false);
    expect(unauthenticatedFutureAdminPage.status).toBe(302);
    expect(unauthenticatedFutureAdminPage.headers.get("location")).toBe(
      "https://ywcoach.com/admin/login?next=%2Fadmin%2Fusers"
    );

    const blockedDashboardApi = await dashboardOverviewRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/dashboard/overview")
    });
    expect(blockedDashboardApi.status).toBe(401);
    await expectJson(blockedDashboardApi, { authenticated: false });

    const localDemoOtp = await verifyOtpRequest({
      env,
      request: jsonRequest("http://127.0.0.1/api/admin/auth/verify-otp", {
        email: ADMIN_EMAIL,
        otp: ADMIN_DEV_OTP
      })
    });
    expect(localDemoOtp.status).toBe(200);
    const localDemoBody = await localDemoOtp.json();
    expect(localDemoBody).toMatchObject({
      admin: { email: ADMIN_EMAIL },
      authenticated: true,
      ok: true
    });
    expect(typeof localDemoBody.csrfToken).toBe("string");
    expect(localDemoBody.csrfToken.length).toBeGreaterThan(40);

    const cookie = extractCookie(localDemoOtp);

    let nextCalled = false;
    const authenticatedPage = await middlewareRequest({
      env,
      next: async () => {
        nextCalled = true;
        return new Response("dashboard");
      },
      request: new Request("https://ywcoach.com/admin/dashboard", {
        headers: { cookie }
      })
    });
    expect(nextCalled).toBe(true);
    expect(authenticatedPage.status).toBe(200);

    let authenticatedFutureAdminNextCalled = false;
    const authenticatedFutureAdminPage = await middlewareRequest({
      env,
      next: async () => {
        authenticatedFutureAdminNextCalled = true;
        return new Response("future admin page");
      },
      request: new Request("https://ywcoach.com/admin/users", {
        headers: { cookie }
      })
    });
    expect(authenticatedFutureAdminNextCalled).toBe(true);
    expect(authenticatedFutureAdminPage.status).toBe(200);

    const dashboardApi = await dashboardOverviewRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/dashboard/overview", {
        headers: { cookie }
      })
    });
    expect(dashboardApi.status).toBe(200);
    const dashboardBody = await dashboardApi.json();
    expect(dashboardBody.admin).toMatchObject({
      email: ADMIN_EMAIL,
      role: "owner"
    });
    expect(dashboardBody.modules).toHaveLength(6);

    const dashboardWithRequiredDbRoles = await dashboardOverviewRequest({
      env: {
        ...env,
        ADMIN_REQUIRE_DB_ADMIN_ROLES: "true"
      },
      request: new Request("https://ywcoach.com/api/admin/dashboard/overview", {
        headers: { cookie }
      })
    });
    expect(dashboardWithRequiredDbRoles.status).toBe(403);

    const logoutWithoutCsrf = await logoutRequest({
      env,
      request: jsonRequest("https://ywcoach.com/api/admin/auth/logout", {}, { cookie })
    });
    expect(logoutWithoutCsrf.status).toBe(403);

    const logoutWithCrossSiteOrigin = await logoutRequest({
      env,
      request: jsonRequest(
        "https://ywcoach.com/api/admin/auth/logout",
        {},
        {
          cookie,
          origin: "https://evil.example",
          "x-yw-admin-csrf": String(localDemoBody.csrfToken)
        }
      )
    });
    expect(logoutWithCrossSiteOrigin.status).toBe(403);

    const logoutWithCsrf = await logoutRequest({
      env,
      request: jsonRequest(
        "https://ywcoach.com/api/admin/auth/logout",
        {},
        {
          cookie,
          "x-yw-admin-csrf": String(localDemoBody.csrfToken)
        }
      )
    });
    expect(logoutWithCsrf.status).toBe(200);
    await expectJson(logoutWithCsrf, { ok: true });
    expect(logoutWithCsrf.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

async function expectDisabledAuthResponse(response: Response) {
  expect(response.status).toBe(501);
  expect(response.headers.get("set-cookie")).toBeNull();
  await expectJson(response, {
    error: GENERIC_ADMIN_AUTH_ERROR,
    ok: false
  });
}

async function expectUnauthenticatedSession(response: Response) {
  expect(response.status).toBe(200);
  await expectJson(response, { authenticated: false });
}

async function expectJson(response: Response, expected: JsonRecord) {
  expect(await response.json()).toMatchObject(expected);
}

function jsonRequest(url: string, body: JsonRecord, headers: Record<string, string> = {}) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: new URL(url).host,
      ...headers
    },
    method: "POST"
  });
}

function extractCookie(response: Response) {
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) {
    throw new Error("Expected admin session cookie.");
  }

  return cookie;
}
