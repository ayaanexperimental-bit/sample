import { expect, test } from "@playwright/test";

const runPhase8Smoke = process.env.ADMIN_V2_PHASE8_SMOKE === "true";
const smokeEmail = process.env.ADMIN_V2_SMOKE_EMAIL || "admin-v2-smoke@example.com";
const smokeOtp = process.env.ADMIN_V2_SMOKE_OTP || "123456";

async function loginToAdminV2(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();

  await page.getByLabel("Admin email").fill(smokeEmail);
  await page.getByRole("button", { name: "Send one-time code" }).click();
  await expect(page.getByRole("heading", { name: "Verify Your Identity" })).toBeVisible();

  await page.getByLabel("6-digit verification code").fill(smokeOtp);
  await page.getByRole("button", { name: "Verify & Enter Admin Panel" }).click();

  await page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 });
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
  await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();
}

test.describe("Admin V2 Phase 8 module smoke", () => {
  test.skip(!runPhase8Smoke, "Set ADMIN_V2_PHASE8_SMOKE=true for local Admin V2 Phase 8 smoke.");
  test.skip(
    process.env.ADMIN_V2_SMOKE_MODE === "limited",
    "Phase 8 module smoke needs owner-level module visibility."
  );

  test("opens Shop, paid links, reports, merged backup, settings, and merged admin users without runtime errors", async ({
    page
  }) => {
    const consoleProblems: string[] = [];
    const pageErrors: string[] = [];
    const protectedResponseProblems: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleProblems.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/api/admin/") && response.status() >= 400) {
        protectedResponseProblems.push(`${response.status()} ${url}`);
      }
    });

    await loginToAdminV2(page);

    const modules = [
      {
        button: /^Shop$/i,
        heading: "Shop Website Builder"
      },
      {
        button: /^Payments$/i,
        heading: "Link Settings"
      },
      {
        button: /^Reports$/i,
        heading: "Error Reports"
      },
      {
        button: /^Settings$/i,
        heading: "Settings"
      }
    ];

    for (const moduleSpec of modules) {
      await openAdminV2Module(page, moduleSpec.button);
      await expect(
        page
          .locator("section.dashboard-console")
          .filter({
            has: page.getByRole("heading", { exact: true, level: 2, name: moduleSpec.heading })
          })
          .first()
      ).toBeVisible();
      await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();
    }

    await openAdminV2Module(page, /^Payments$/i);
    await page.getByRole("button", { name: "Manage" }).first().click();
    const paymentDialog = page.getByRole("dialog", { name: "Manage paid masterclass" });
    await expect(paymentDialog).toBeVisible();
    await expect(paymentDialog.getByRole("button", { name: "Send OTP" })).toBeVisible();
    await expect(paymentDialog.getByRole("button", { name: "Reveal private link" })).toBeDisabled();
    await expect(paymentDialog.getByRole("button", { name: "Save payment link" })).toBeDisabled();
    await expect(paymentDialog.getByRole("button", { name: "Save private link" })).toBeDisabled();
    await paymentDialog.getByRole("button", { name: "Done" }).click();
    await expect(paymentDialog).toHaveCount(0);

    await openAdminV2Module(page, /^Reports$/i);
    await expect(
      page.getByRole("heading", { exact: true, level: 3, name: "Report cleanup" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Review cleanup" }).click();
    await expect(page.getByRole("dialog", { name: "Confirm report cleanup" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm cleanup" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: "Confirm report cleanup" })).toHaveCount(0);
    await page.getByRole("button", { name: "Open maintenance" }).click();
    await expect(
      page.getByRole("heading", { exact: true, level: 2, name: "Backup & Cleanup" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Run backup now" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run protected cleanup" })).toBeVisible();
    await expect(page.getByText("Recipients and strict-role readiness")).toBeVisible();
    await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();

    await openAdminV2Module(page, /^Settings$/i);
    await page.getByRole("button", { name: "Open users" }).click();
    await expect(
      page.getByRole("heading", { exact: true, level: 2, name: "Admin User Management" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite admin" })).toBeVisible();
    await page.getByRole("button", { name: "Invite admin" }).click();
    const inviteDialog = page.getByRole("dialog", { name: "Invite administrator" });
    await expect(inviteDialog).toBeVisible();
    await expect(inviteDialog.getByRole("region", { name: "Admin permissions" })).toBeVisible();
    await inviteDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(inviteDialog).toHaveCount(0);
    await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleProblems).toEqual([]);
    expect(protectedResponseProblems).toEqual([]);
  });
});

async function openAdminV2Module(page: import("@playwright/test").Page, name: RegExp) {
  const sidebar = page.locator("#admin-sidebar");
  const menuButton = page.getByRole("button", { name: /Open (admin )?navigation/i });
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
    await sidebar.getByRole("button", { name }).first().click();
    return;
  }

  const directButton = sidebar.getByRole("button", { name }).first();
  await directButton.click();
}
