import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const runImpeccableSmoke = process.env.ADMIN_IMPECCABLE_SMOKE === "true";
const smokeEmail = process.env.ADMIN_V2_SMOKE_EMAIL || "admin-v2-smoke-final@example.com";
const smokeOtp = process.env.ADMIN_V2_SMOKE_OTP || "123456";
let authenticatedCookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];

const AUTH_ROUTES = [
  { heading: "Admin Login", path: "/admin/login" },
  { heading: "Reset Admin Password", path: "/admin/forgot-password" },
  { heading: "Reset Admin Password", path: "/admin/reset-password" },
  { heading: "Verify Your Identity", path: "/admin/verify" }
] as const;

const MODULES = [
  {
    id: "overview",
    subtitle:
      "Review current performance, operational risk, and the next actions that need attention.",
    title: "Admin Overview"
  },
  {
    id: "coach-analytics",
    subtitle: "Compare coach-level traffic, funnel signals, audiences, and source freshness.",
    title: "Analytics"
  },
  {
    id: "top-coaches",
    subtitle: "Find the strongest performers and inspect the evidence behind each ranking.",
    title: "Coaches"
  },
  {
    id: "coach-sites",
    subtitle: "Search, review, preview, edit, publish, archive, or restore coach websites.",
    title: "Coach Sites"
  },
  {
    id: "create-coach-site",
    subtitle:
      "Create or update a coach website through a verified draft, preview, and publish flow.",
    title: "Create Site"
  },
  {
    id: "shop",
    subtitle: "Manage website purchases, payment handoffs, recovery, and operational exports.",
    title: "Shop"
  },
  {
    id: "error-reports",
    subtitle: "Investigate active issues, update status, and retain a traceable support record.",
    title: "Reports"
  },
  {
    id: "paid-masterclass-settings",
    subtitle: "Maintain paid-entry links and protected redirect destinations.",
    title: "Payments"
  },
  {
    id: "settings",
    subtitle: "Maintain support defaults, protected controls, and permission-aware configuration.",
    title: "Settings"
  },
  {
    id: "backup-cleanup",
    subtitle: "Review retention health and run bounded backup or cleanup controls.",
    title: "Backup & Cleanup"
  },
  {
    id: "admin-users",
    subtitle: "Invite administrators and manage roles, permissions, and account lifecycle.",
    title: "Admin Users"
  }
] as const;

const VIEWPORTS = [
  { height: 720, width: 320 },
  { height: 812, width: 375 },
  { height: 844, width: 390 },
  { height: 896, width: 414 },
  { height: 1024, width: 768 },
  { height: 768, width: 1024 },
  { height: 800, width: 1280 },
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 }
] as const;

test.describe("Admin Impeccable full-panel regression", () => {
  test.skip(
    !runImpeccableSmoke,
    "Set ADMIN_IMPECCABLE_SMOKE=true for the local full-panel design regression."
  );

  test.beforeAll(async ({ browser }, testInfo) => {
    if (testInfo.project.name !== "desktop") return;

    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4802"
    });
    const page = await context.newPage();
    await loginToAdminV2(page);
    authenticatedCookies = await context.cookies();
    await context.close();
  });

  test("keeps every auth route readable, focused, and free of horizontal overflow", async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Auth route coverage runs once on desktop.");

    for (const route of AUTH_ROUTES) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route.path);
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      await assertNoHorizontalOverflow(page, route.path);

      const firstField = page.locator("input").first();
      if (await firstField.count()) {
        await expect(firstField).toBeVisible();
        const box = await firstField.boundingBox();
        expect(box?.height || 0, `${route.path} first input height`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("keeps the shared shell usable at every supported width", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Width matrix runs once on desktop.");
    test.setTimeout(180_000);

    await useAdminSession(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto("/admin/dashboard?view=overview");
      await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
      await assertNoHorizontalOverflow(page, `${viewport.width}px shell`);

      if (viewport.width <= 1100) {
        const menuButton = page.getByRole("button", { name: "Open navigation" });
        await menuButton.click();

        const sidebar = page.getByRole("complementary", { name: "Admin navigation" });
        await expect(sidebar).toBeVisible();
        const sidebarBox = await sidebar.boundingBox();
        expect(sidebarBox?.width || 0, `${viewport.width}px drawer width`).toBeGreaterThanOrEqual(
          280
        );
        await expect(sidebar.getByText("Key metrics and alerts", { exact: true })).toBeVisible();
        await expect(sidebar.getByRole("button", { name: "Close navigation panel" })).toBeFocused();

        for (const button of await sidebar.getByRole("button").all()) {
          const box = await button.boundingBox();
          if (box) {
            expect(
              Math.min(box.width, box.height),
              `${viewport.width}px drawer touch target`
            ).toBeGreaterThanOrEqual(44);
          }
        }

        await page.keyboard.press("Escape");
        await expect(sidebar).toBeHidden();
        await expect(menuButton).toBeFocused();
      }
    }
  });

  test("renders every module with distinct guidance in dark and light themes", async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Module matrix runs once on desktop.");
    test.setTimeout(240_000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await useAdminSession(page);

    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

      for (const moduleRoute of MODULES) {
        await page.goto(`/admin/dashboard?view=${moduleRoute.id}`);
        await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
        await expect(
          page.getByRole("heading", { name: moduleRoute.title, level: 1 })
        ).toBeVisible();
        await expect(page.locator(".page-subtitle")).toHaveText(moduleRoute.subtitle);
        await assertNoHorizontalOverflow(page, `${moduleRoute.id} at ${width}px`);
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/dashboard?view=overview");
    const mount = page.locator('[data-admin-v2="true"]');
    await expect(mount).toHaveAttribute("data-od-theme", "dark");
    await page.getByRole("button", { name: "Switch to light admin theme" }).click();
    await expect(mount).toHaveAttribute("data-od-theme", "light");
    await assertNoHorizontalOverflow(page, "light theme overview");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("progressively discloses custom permissions without removing role templates", async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Admin-user disclosure runs once on desktop.");

    await useAdminSession(page);
    await page.goto("/admin/dashboard?view=admin-users");
    await page.getByRole("button", { name: "Invite admin", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Invite administrator" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Admin role templates")).toBeVisible();

    const permissions = dialog.locator("details", { hasText: "Customize permissions" });
    await expect(permissions).not.toHaveAttribute("open", "");
    await expect(permissions.getByText(/selected permissions/i)).toBeVisible();
    await permissions.locator("summary").click();
    await expect(permissions).toHaveAttribute("open", "");
    await expect(dialog.getByLabel("Admin permissions")).toBeVisible();
  });
});

async function loginToAdminV2(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Admin email").fill(smokeEmail);
  await page.getByRole("button", { name: "Send one-time code" }).click();
  await expect(page.getByRole("heading", { name: "Verify Your Identity" })).toBeVisible();
  await page.getByLabel("6-digit verification code").fill(smokeOtp);
  await page.getByRole("button", { name: "Verify & Enter Admin Panel" }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 });
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
}

async function useAdminSession(page: Page) {
  expect(authenticatedCookies.length, "authenticated Admin session cookies").toBeGreaterThan(0);
  await page.context().addCookies(authenticatedCookies);
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));

  expect(
    result.scrollWidth,
    `${label} has horizontal overflow: ${JSON.stringify(result)}`
  ).toBeLessThanOrEqual(result.clientWidth + 1);
}
