import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? process.env.SITE_URL ?? "https://ywcoach.com";

export default defineConfig({
  testDir: "./tests/e2e",
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
