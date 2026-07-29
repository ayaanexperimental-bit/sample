import { expect, test } from "@playwright/test";

const runAdminV2Smoke = process.env.ADMIN_V2_SMOKE === "true";
const smokeMode = process.env.ADMIN_V2_SMOKE_MODE || "owner";
const smokeEmail = process.env.ADMIN_V2_SMOKE_EMAIL || "admin-v2-smoke@example.com";
const smokeOtp = process.env.ADMIN_V2_SMOKE_OTP || "123456";

test.describe("Admin V2 Pages smoke", () => {
  test.skip(!runAdminV2Smoke, "Set ADMIN_V2_SMOKE=true for local Admin V2 Pages preview smoke.");

  test("logs in through local demo OTP and renders the production-wired V2 shell", async ({
    page
  }) => {
    const consoleProblems: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleProblems.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    if (smokeMode === "limited") {
      await page.route("**/api/admin/error-reports", async (route) => {
        if (route.request().method() !== "GET") {
          await route.continue();
          return;
        }

        await route.fulfill({
          body: JSON.stringify({
            configured: true,
            errorReports: [
              {
                browser: "private-browser-signature",
                category: "API error",
                createdAt: "2026-07-14T00:00:00.000Z",
                deviceType: "desktop",
                errorCode: "YW-ERR-2001",
                pagePath: "/admin/reports",
                referenceId: "YW-ERR-2001-LIMITED",
                referrer: "https://private.example/path?token=must-not-render",
                safeMessage: "The request could not complete.",
                screenSize: "1440x900-private",
                sessionId: "private-session-id",
                severity: "medium",
                status: "New",
                technicalDetails: "must-never-render-technical-detail",
                userAction: "Open reports"
              }
            ],
            ok: true,
            persistence: "d1_table"
          }),
          contentType: "application/json",
          status: 200
        });
      });
    }

    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();

    await page.getByLabel("Admin email").fill(smokeEmail);
    await page.getByRole("button", { name: "Send one-time code" }).click();
    await expect(page.getByRole("heading", { name: "Verify Your Identity" })).toBeVisible();

    await page.getByLabel("6-digit verification code").fill(smokeOtp);
    await page.getByRole("button", { name: "Verify & Enter Admin Panel" }).click();

    await page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 });
    const adminV2Mount = page.locator('[data-admin-v2="true"]');
    await expect(adminV2Mount).toBeVisible();
    await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();
    const moreModules = page.locator("details.admin-more");
    await expect(moreModules).toBeVisible();
    await expect(moreModules).not.toHaveAttribute("open", "");
    await moreModules.locator("summary").click();
    await expect(page.getByRole("heading", { name: "Open admin modules" })).toBeVisible();
    await expect(page.getByRole("status", { name: /Owner|Admin|admin-v2-smoke/i })).toBeVisible();

    if (smokeMode === "limited") {
      await expect(page.getByRole("button", { exact: true, name: "Overview" })).toBeVisible();
      await expect(page.getByRole("button", { exact: true, name: "Reports" })).toBeVisible();
      await expect(page.getByRole("button", { exact: true, name: "Shop" })).toHaveCount(0);
      await expect(page.getByRole("button", { exact: true, name: "Admin Users" })).toHaveCount(0);
      await expect(page.getByRole("button", { exact: true, name: "Create Site" })).toHaveCount(0);

      await page.getByRole("button", { exact: true, name: "Reports" }).click();
      await expect(page.getByRole("heading", { exact: true, name: "Error Reports" })).toBeVisible();
      await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();
      await expect(page.getByLabel("Cleanup target")).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Cleanup permission required" })
      ).toBeDisabled();

      await page.getByRole("button", { name: "Open maintenance" }).click();
      await expect(
        page.getByRole("heading", { exact: true, name: "Backup & Cleanup" })
      ).toHaveCount(0);

      await page.getByRole("button", { name: "View details for YW-ERR-2001" }).click();
      const detailDialog = page.getByRole("dialog", { name: "Error Details" });
      await expect(detailDialog).toBeVisible();
      await expect(detailDialog.getByText("Restricted by permission")).toBeVisible();
      await expect(
        detailDialog.getByText(
          "Restricted: error_reports.technical_details permission is required."
        )
      ).toBeVisible();
      await expect(detailDialog.getByRole("button", { name: "Mark Reviewing" })).toBeVisible();
      await expect(detailDialog.getByRole("button", { name: "Mark Fixed" })).toBeVisible();
      await expect(detailDialog.getByRole("button", { name: "Ignore" })).toBeVisible();
      await expect(detailDialog.getByRole("button", { name: "Copy prompt" })).toBeVisible();
      await expect(detailDialog).not.toContainText("private-browser-signature");
      await expect(detailDialog).not.toContainText("must-never-render-technical-detail");
      await detailDialog.getByRole("button", { name: "Close action dialog" }).click();
    } else {
      await page.getByRole("button", { name: "30 days" }).click();
      await expect(page.getByRole("button", { name: "30 days" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );

      const coachTableSearch = page.getByLabel("Search coach performance table");
      await coachTableSearch.fill("no-matching-coach-record");
      await expect(
        page.getByText("No coach-site records match the current filters.")
      ).toBeVisible();
      await coachTableSearch.fill("");

      await page.getByRole("button", { name: "Review Shop Source" }).click();
      await expect(
        page.getByRole("heading", { exact: true, name: "Shop Website Builder" })
      ).toBeVisible();
      await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();

      await page.getByRole("button", { exact: true, name: "Overview" }).click();
      const moduleSearch = page.getByLabel("Search admin modules");
      await moduleSearch.fill("Shop");
      await expect(page.getByRole("option", { name: /Shop Website purchases/i })).toBeVisible();
      await moduleSearch.press("Enter");
      await expect(
        page.getByRole("heading", { exact: true, name: "Shop Website Builder" })
      ).toBeVisible();
    }

    await page.goto("/admin/dashboard");
    await expect(adminV2Mount).toBeVisible();
    await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();

    await page.getByRole("button", { name: "Logout" }).click();
    await page.waitForURL(/\/admin\/login/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleProblems).toEqual([]);
  });
});
