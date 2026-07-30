import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.SITE_URL ?? "https://ywcoach.com";
const runDestructiveCoachSitesSmoke = process.env.ADMIN_V2_COACH_SITES_SMOKE === "true";
const runAdminV2CopilotSmoke = process.env.ADMIN_V2_COPILOT_SMOKE === "true";
const runAdminV2ActivityChartSmoke = process.env.ADMIN_V2_ACTIVITY_CHART_SMOKE === "true";
const runAdminImpeccableSmoke = process.env.ADMIN_IMPECCABLE_SMOKE === "true";
const runAdminV2PagesSmoke = process.env.ADMIN_V2_SMOKE === "true";
const runAdminV2Phase8Smoke = process.env.ADMIN_V2_PHASE8_SMOKE === "true";
const runShopBuilderSmoke = process.env.SHOP_BUILDER_SMOKE === "true";
const runSerialLocalAdminSmoke =
  runDestructiveCoachSitesSmoke ||
  runAdminImpeccableSmoke ||
  runAdminV2CopilotSmoke ||
  runAdminV2ActivityChartSmoke ||
  runAdminV2PagesSmoke ||
  runAdminV2Phase8Smoke ||
  runShopBuilderSmoke;

if (runSerialLocalAdminSmoke && !isLocalBaseUrl(baseURL)) {
  throw new Error("Admin V2 mutation/audit smoke tests must use a localhost PLAYWRIGHT_BASE_URL.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  workers: runSerialLocalAdminSmoke ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  outputDir: "test-results",
  reporter: [["list"]],
  use: {
    baseURL,
    browserName: "chromium",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: "tablet",
      use: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: "desktop",
      use: {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1
      }
    },
    {
      name: "large",
      use: {
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1
      }
    }
  ]
});

function isLocalBaseUrl(value: string) {
  const hostname = new URL(value).hostname.toLowerCase();

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
