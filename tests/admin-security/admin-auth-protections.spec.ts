import { expect, test } from "@playwright/test";
import { onRequest as middlewareRequest } from "../../functions/_middleware";
import { onRequest as backupCleanupRequest } from "../../functions/api/admin/backup-cleanup";
import { onRequest as dashboardOverviewRequest } from "../../functions/api/admin/dashboard/overview";
import {
  filterAdminErrorReportTechnicalDetails,
  onRequest as errorReportsRequest
} from "../../functions/api/admin/error-reports";
import { onRequest as forgotPasswordRequest } from "../../functions/api/admin/auth/forgot-password";
import { onRequest as loginRequest } from "../../functions/api/admin/auth/login";
import { onRequest as logoutRequest } from "../../functions/api/admin/auth/logout";
import { onRequest as masterclassSettingsRequest } from "../../functions/api/admin/masterclass-settings";
import { onRequest as resendOtpRequest } from "../../functions/api/admin/auth/resend-otp";
import { onRequest as resetPasswordRequest } from "../../functions/api/admin/auth/reset-password";
import { onRequest as sessionRequest } from "../../functions/api/admin/auth/session";
import { onRequest as verifyOtpRequest } from "../../functions/api/admin/auth/verify-otp";
import { onRequest as publicErrorReportRequest } from "../../functions/api/error-report";
import type { AdminErrorReport } from "../../lib/admin-control-center";
import { createAdminSessionCookie, getAdminRoleForEmail } from "../../lib/server/admin-auth";

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
  test("redacts technical error-report context unless the explicit permission is present", () => {
    const report: AdminErrorReport = {
      browser: "Browser/1.0",
      category: "API error",
      createdAt: "2026-07-14T00:00:00.000Z",
      deviceType: "desktop",
      pagePath: "/admin/reports",
      referenceId: "YW-ERR-2001-TEST",
      referrer: "https://private.example/path?token=masked",
      safeMessage: "The request could not complete.",
      screenSize: "1440x900",
      sessionId: "masked-session-id",
      severity: "medium",
      status: "New",
      technicalDetails: "masked_internal_detail",
      userAction: "Open reports"
    };

    expect(filterAdminErrorReportTechnicalDetails(report, false)).toMatchObject({
      browser: "Restricted",
      referrer: "Restricted",
      screenSize: "Restricted",
      sessionId: "Restricted",
      technicalDetails: ""
    });
    expect(filterAdminErrorReportTechnicalDetails(report, true)).toBe(report);
  });

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
      "https://ywcoach.com/admin/dashboard"
    );

    for (const aliasUrl of [
      "https://ywcoach.com/admil",
      "https://ywcoach.com/admil/dashboard",
      "https://ywcoach.com/admim",
      "https://ywcoach.com/admim/dashboard",
      "https://ywcoach.com/admn",
      "https://ywcoach.com/admn/dashboard",
      "https://ywcoach.com/admin_panel",
      "https://ywcoach.com/admin%20panel",
      "https://ywcoach.com/admin%20dashboard",
      "https://ywcoach.com/admin-panel/dashboard",
      "https://ywcoach.com/admin_panel/dashboard",
      "https://ywcoach.com/adminpanel/dashboard",
      "https://ywcoach.com/admin-panel/settings",
      "https://ywcoach.com/admin%20panel/settings",
      "https://ywcoach.com/adminpanel/coach-sites",
      "https://ywcoach.com/admindashboard",
      "https://ywcoach.com/admindashboard/overview",
      "https://ywcoach.com/adminn",
      "https://ywcoach.com/adminn/dashboard",
      "https://ywcoach.com/dashboard/overview"
    ]) {
      const adminPanelAlias = await middlewareRequest({
        env,
        next: async () => new Response("admin alias should redirect first"),
        request: new Request(aliasUrl)
      });
      expect(adminPanelAlias.status).toBe(302);
      expect(adminPanelAlias.headers.get("location")).toBe("https://ywcoach.com/admin/dashboard");
    }

    let rscPrefetchNextCalled = false;
    const staticRscPrefetch = await middlewareRequest({
      env,
      next: async () => {
        rscPrefetchNextCalled = true;
        return new Response("missing static rsc payload");
      },
      request: new Request(
        "https://ywcoach.com/coach-template-preview/__next.coach-template-preview.txt?_rsc=qa"
      )
    });
    expect(rscPrefetchNextCalled).toBe(false);
    expect(staticRscPrefetch.status).toBe(204);

    const blockedDashboardApi = await dashboardOverviewRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/dashboard/overview")
    });
    expect(blockedDashboardApi.status).toBe(401);
    await expectJson(blockedDashboardApi, { authenticated: false });

    for (const handler of [errorReportsRequest, backupCleanupRequest, masterclassSettingsRequest]) {
      const blockedAdminModuleApi = await handler({
        env,
        request: new Request("https://ywcoach.com/api/admin/protected-module")
      });
      expect(blockedAdminModuleApi.status).toBe(401);
      await expectJson(blockedAdminModuleApi, { authenticated: false });
    }

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
    expect(authenticatedFutureAdminNextCalled).toBe(false);
    expect(authenticatedFutureAdminPage.status).toBe(302);
    expect(authenticatedFutureAdminPage.headers.get("location")).toBe(
      "https://ywcoach.com/admin/dashboard"
    );

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
    expect(dashboardBody.dashboard.dataNotice).toContain("Only production records are shown");
    expect(dashboardBody.dashboard.navigation).toHaveLength(10);
    expect(dashboardBody.dashboard.summary).toHaveLength(12);
    expect(dashboardBody.dashboard.topCoaches).toEqual([]);
    expect(dashboardBody.controlCenter.errorReports).toEqual([]);
    expect(dashboardBody.coachSites).toEqual([]);

    const errorReports = await errorReportsRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/error-reports", {
        headers: { cookie }
      })
    });
    expect(errorReports.status).toBe(200);
    await expectJson(errorReports, { ok: true, persistence: "unavailable" });

    const backupCleanup = await backupCleanupRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/backup-cleanup", {
        headers: { cookie }
      })
    });
    expect(backupCleanup.status).toBe(200);
    await expectJson(backupCleanup, { ok: true, persistence: "unavailable" });

    const unauthenticatedBackupDownload = await backupCleanupRequest({
      env,
      request: new Request(
        "https://ywcoach.com/api/admin/backup-cleanup?download=analytics-backup-test&format=xls"
      )
    });
    expect(unauthenticatedBackupDownload.status).toBe(302);
    expect(unauthenticatedBackupDownload.headers.get("location")).toBe(
      "https://ywcoach.com/admin/login?next=%2Fapi%2Fadmin%2Fbackup-cleanup%3Fdownload%3Danalytics-backup-test%26format%3Dxls"
    );

    const unauthenticatedBackupDownloadHead = await backupCleanupRequest({
      env,
      request: new Request(
        "https://ywcoach.com/api/admin/backup-cleanup?download=analytics-backup-test&format=csv",
        { method: "HEAD" }
      )
    });
    expect(unauthenticatedBackupDownloadHead.status).toBe(302);
    expect(unauthenticatedBackupDownloadHead.headers.get("location")).toBe(
      "https://ywcoach.com/admin/login?next=%2Fapi%2Fadmin%2Fbackup-cleanup%3Fdownload%3Danalytics-backup-test%26format%3Dcsv"
    );

    const masterclassSettings = await masterclassSettingsRequest({
      env,
      request: new Request("https://ywcoach.com/api/admin/masterclass-settings", {
        headers: { cookie }
      })
    });
    expect(masterclassSettings.status).toBe(200);
    const masterclassSettingsBody = await masterclassSettings.json();
    expect(masterclassSettingsBody).toMatchObject({
      ok: true,
      privateLinkValuesExposed: false
    });
    expect(JSON.stringify(masterclassSettingsBody)).not.toContain("private.example.invalid");

    const backupWithoutCsrf = await backupCleanupRequest({
      env,
      request: jsonRequest(
        "https://ywcoach.com/api/admin/backup-cleanup",
        { action: "backup" },
        { cookie }
      )
    });
    expect(backupWithoutCsrf.status).toBe(403);

    const dashboardWithRequiredDbRoles = await dashboardOverviewRequest({
      env: {
        ...env,
        ADMIN_REQUIRE_DB_ADMIN_ROLES: "true"
      },
      request: new Request("https://ywcoach.com/api/admin/dashboard/overview", {
        headers: { cookie }
      })
    });
    expect(dashboardWithRequiredDbRoles.status).toBe(401);

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

  test("accepts public safe error reports without exposing technical details", async () => {
    const response = await publicErrorReportRequest({
      request: jsonRequest("https://ywcoach.com/api/error-report", {
        category: "ui_crash",
        pagePath: "/coach/gyana-ranjan",
        safeMessage: "This page could not load properly.",
        stack: "should not be echoed",
        userAction: "page_render"
      })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      category: "ui_crash",
      ok: true,
      persisted: false
    });
    expect(String(body.referenceId)).toMatch(/^YW-ERR-1001-[A-Z0-9]+-[A-Z0-9]{6}$/);
    expect(JSON.stringify(body)).not.toContain("should not be echoed");
  });

  test("shows live empty D1 error reports instead of demo fallback rows", async () => {
    const localDemoOtp = await verifyOtpRequest({
      env,
      request: jsonRequest("http://127.0.0.1/api/admin/auth/verify-otp", {
        email: ADMIN_EMAIL,
        otp: ADMIN_DEV_OTP
      })
    });
    const cookie = extractCookie(localDemoOtp);

    const response = await errorReportsRequest({
      env: {
        ...env,
        ADMIN_DB: createEmptyErrorReportsDb() as never
      },
      request: new Request("https://ywcoach.com/api/admin/error-reports", {
        headers: { cookie }
      })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      configured: true,
      errorReports: [],
      ok: true,
      persistence: "d1_table"
    });
    expect(JSON.stringify(body)).not.toContain("YW-ERR-5001-SMPL");
  });

  test("strict DB roles use active admin_users rows as the admin source of truth", async () => {
    const dbOnlyAdminEmail = "db-admin@example.com";
    const strictDbRoleEnv = {
      ...env,
      ADMIN_ALLOWED_EMAILS: "break-glass@example.com",
      ADMIN_DB: createAdminRoleDb("admin", "active", dbOnlyAdminEmail) as never,
      ADMIN_REQUIRE_DB_ADMIN_ROLES: "true"
    };
    const strictCookie = await createAdminSessionCookie({
      email: dbOnlyAdminEmail,
      env: strictDbRoleEnv,
      rememberDevice: false,
      secure: true
    });

    expect(strictCookie).toBeTruthy();
    const cookie = strictCookie?.split(";")[0] || "";
    const strictSession = await sessionRequest({
      env: strictDbRoleEnv,
      request: new Request("https://ywcoach.com/api/admin/auth/session", {
        headers: { cookie }
      })
    });

    expect(strictSession.status).toBe(200);
    const strictSessionBody = await strictSession.json();
    expect(strictSessionBody).toMatchObject({
      admin: { email: dbOnlyAdminEmail, role: "admin" },
      authenticated: true
    });

    let invitedAdminNextCalled = false;
    const invitedAdminDashboard = await middlewareRequest({
      env: strictDbRoleEnv,
      next: async () => {
        invitedAdminNextCalled = true;
        return new Response("invited admin dashboard");
      },
      request: new Request("https://ywcoach.com/admin/dashboard", {
        headers: { cookie }
      })
    });
    expect(invitedAdminNextCalled).toBe(true);
    expect(invitedAdminDashboard.status).toBe(200);

    const viewerCookie = await createAdminSessionCookie({
      email: "viewer@example.com",
      env: {
        ...strictDbRoleEnv,
        ADMIN_DB: createAdminRoleDb("viewer") as never
      },
      rememberDevice: false,
      secure: true
    });
    const blockedSession = await sessionRequest({
      env: {
        ...strictDbRoleEnv,
        ADMIN_DB: createAdminRoleDb("viewer") as never
      },
      request: new Request("https://ywcoach.com/api/admin/auth/session", {
        headers: { cookie: viewerCookie?.split(";")[0] || "" }
      })
    });
    expect(blockedSession.status).toBe(200);
    await expectUnauthenticatedSession(blockedSession);
  });

  test("suspended and revoked admins cannot keep using existing sessions", async () => {
    for (const status of ["disabled", "inactive"]) {
      const email = `${status}-admin@example.com`;
      const dbRoleEnv = {
        ...env,
        ADMIN_ALLOWED_EMAILS: "break-glass@example.com",
        ADMIN_DB: createAdminRoleDb("admin", status, email) as never,
        ADMIN_REQUIRE_DB_ADMIN_ROLES: "true"
      };
      const staleCookie = await createAdminSessionCookie({
        email,
        env: dbRoleEnv,
        rememberDevice: false,
        secure: true
      });
      expect(staleCookie).toBeTruthy();

      const session = await sessionRequest({
        env: dbRoleEnv,
        request: new Request("https://ywcoach.com/api/admin/auth/session", {
          headers: { cookie: staleCookie?.split(";")[0] || "" }
        })
      });
      expect(session.status).toBe(200);
      await expectUnauthenticatedSession(session);

      const dashboard = await dashboardOverviewRequest({
        env: dbRoleEnv,
        request: new Request("https://ywcoach.com/api/admin/dashboard/overview", {
          headers: { cookie: staleCookie?.split(";")[0] || "" }
        })
      });
      expect(dashboard.status).toBe(401);
    }
  });

  test("recognizes owner, admin, and super_admin DB rows as protected admin roles", async () => {
    for (const role of ["owner", "admin", "super_admin"]) {
      await expect(
        getAdminRoleForEmail(`${role}@example.com`, {
          ...env,
          ADMIN_DB: createAdminRoleDb(role) as never,
          ADMIN_REQUIRE_DB_ADMIN_ROLES: "true"
        })
      ).resolves.toBe(role);
    }

    await expect(
      getAdminRoleForEmail("viewer@example.com", {
        ...env,
        ADMIN_DB: createAdminRoleDb("viewer") as never,
        ADMIN_REQUIRE_DB_ADMIN_ROLES: "true"
      })
    ).resolves.toBeNull();
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

function createEmptyErrorReportsDb() {
  return {
    prepare: () => {
      const statement = {
        all: async <T>() => ({ results: [] as T[] }),
        bind: () => statement,
        run: async () => ({ success: true })
      };

      return statement;
    }
  };
}

function createAdminRoleDb(
  role: string,
  status = "active",
  email = role === "viewer" ? "viewer@example.com" : `${role}@example.com`
) {
  return {
    prepare: () => {
      const stmt = {
        bind: () => stmt,
        first: async <T>() => {
          return {
            email,
            first_name: "",
            is_owner: role === "owner" ? 1 : 0,
            last_name: "",
            role,
            role_key: role === "owner" ? "owner" : "custom",
            status
          } as T;
        }
      };

      return stmt;
    }
  };
}
