import { expect, test } from "@playwright/test";

const runActivityChartSmoke = process.env.ADMIN_V2_ACTIVITY_CHART_SMOKE === "true";
const smokeEmail = process.env.ADMIN_V2_SMOKE_EMAIL || "admin-v2-smoke@example.com";
const smokeOtp = process.env.ADMIN_V2_SMOKE_OTP || "123456";

test.describe("Admin V2 real activity chart smoke", () => {
  test.skip(
    !runActivityChartSmoke,
    "Set ADMIN_V2_ACTIVITY_CHART_SMOKE=true for local real activity chart smoke."
  );

  test("loads dense real buckets and supports hover, pin, scrub, legend, ranges, and summaries", async ({
    page,
    request,
  }, testInfo) => {
    const suffix = Date.now().toString(36);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const seedResults = await Promise.all(
      [
        "coach_site_view",
        "coach_site_view",
        "coach_site_view",
        "coach_site_view",
        "coach_register_click",
        "coach_register_click",
      ].map((eventName, index) =>
        request.post("/api/coach-events", {
          data: {
            coachSlug: `chart-smoke-${suffix}`,
            eventName,
            funnelId: `chart-smoke-${suffix}`,
            funnelType: "free_guest_link",
            pagePath: `/coach/chart-smoke-${suffix}`,
            sessionId: `chart-smoke-${suffix}-${index}`,
            source: index % 2 ? "direct" : "smoke-share",
          },
        })
      )
    );
    const seedPayloads = await Promise.all(seedResults.map((response) => response.json()));
    expect(seedResults.every((response) => response.ok())).toBe(true);
    expect(seedPayloads.some((payload) => payload.persisted === true)).toBe(true);

    await loginToAdminV2(page);

    const chart = page.locator('section[data-point-count][aria-labelledby="activity-chart-title"]');
    await expect(chart).toBeVisible();
    await expect(chart.getByRole("heading", { name: "Coach Site Activity" })).toBeVisible();
    await expect
      .poll(async () => Number(await chart.getAttribute("data-point-count")))
      .toBeGreaterThanOrEqual(160);
    const initialPointCount = Number(await chart.getAttribute("data-point-count"));
    expect(initialPointCount).toBeLessThanOrEqual(220);
    await expect(chart.getByText(new RegExp(`${initialPointCount} inspectable buckets`))).toBeVisible();

    const svg = chart.getByRole("img", { name: /Coach Site Activity/ });
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    const scrubber = chart.getByLabel("Inspect exact bucket");
    const touchProject = testInfo.project.name === "mobile" || testInfo.project.name === "tablet";
    if (touchProject) {
      await scrubber.fill(String(Math.round(initialPointCount * 0.6)));
    } else {
      await page.mouse.move(
        (box?.x || 0) + (box?.width || 0) * 0.6,
        (box?.y || 0) + (box?.height || 0) * 0.5
      );
    }
    const tooltip = chart.locator('[data-activity-tooltip="true"]');
    await expect(tooltip).toHaveAttribute("data-visible", "true");
    await expect(tooltip).toContainText("Current visits:");
    await expect(tooltip).toContainText("Previous range:");
    await expect(tooltip).toContainText("Delta:");
    await expect(tooltip).toContainText("Register clicks:");

    if (!touchProject) {
      await page.mouse.click(
        (box?.x || 0) + (box?.width || 0) * 0.6,
        (box?.y || 0) + (box?.height || 0) * 0.5
      );
    }
    await expect(svg).toHaveAttribute("data-pinned", "true");
    await expect(tooltip).toContainText("Pinned.");

    const previousToggle = chart.getByRole("button", { name: "Previous range" });
    await previousToggle.click();
    await expect(previousToggle).toHaveAttribute("aria-pressed", "false");
    await previousToggle.click();
    await expect(previousToggle).toHaveAttribute("aria-pressed", "true");

    await scrubber.fill(String(Math.min(10, initialPointCount - 1)));
    await expect(svg).toHaveAttribute("data-pinned", "true");
    await chart.getByRole("button", { name: "Clear pin" }).click();
    await expect(svg).toHaveAttribute("data-pinned", "false");

    const rangeResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/analytics-events") &&
        response.url().includes("range=30d") &&
        response.ok()
    );
    await chart.getByRole("tab", { name: "1M" }).click();
    await rangeResponse;
    const monthChart = page.locator('section[data-point-count][aria-labelledby="activity-chart-title"]');
    await expect(monthChart.getByRole("tab", { name: "1M" })).toHaveAttribute("aria-selected", "true");
    await expect.poll(async () => Number(await monthChart.getAttribute("data-point-count"))).toBeGreaterThanOrEqual(100);
    await expect(monthChart.getByText(/30 days: .* real buckets\./)).toBeVisible();
    await expect(monthChart.getByText("Visits", { exact: true })).toBeVisible();
    await expect(monthChart.getByText("Register clicks", { exact: true })).toBeVisible();
    await expect(monthChart.getByText("Peak window", { exact: true })).toBeVisible();
    await expect(monthChart.getByText("Best source", { exact: true })).toBeVisible();

    const documentWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client + 1);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});

async function loginToAdminV2(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Admin email").fill(smokeEmail);
  await page.getByRole("button", { name: "Send one-time code" }).click();
  await expect(page.getByRole("heading", { name: "Verify Your Identity" })).toBeVisible();
  await page.getByLabel("6-digit verification code").fill(smokeOtp);
  await page.getByRole("button", { name: "Verify & Enter Admin Panel" }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 });
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
}
